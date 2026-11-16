/**
 * InkNeighbour — printer-agent Edge Function
 *
 * The only door for InkNeighbour Connect (the Windows agent). verify_jwt is OFF because agents hold
 * no Supabase session; they authenticate with their own credential instead:
 *   - action "pair": one-time pairing code (made by a signed-in user in the app) -> credential
 *   - every other action: Authorization: Bearer <agent_id>.<secret>  (only a SHA-256 hash is stored)
 *
 * Actions (POST JSON {action, ...}): pair, heartbeat, register-printer, telemetry.
 * Not callable from browsers (no CORS headers on purpose). Never accepts commands or returns any.
 * Rate limited per agent and, for pairing, per caller IP.
 *
 * Deploy with verify_jwt = false. Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (auto-provided).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  evaluateAlerts, parseCredential, shouldRecordConsumable, shouldRecordPageCount, shouldRecordStatus,
  validatePair, validateReading, validateRegister, MAX_READINGS_PER_CALL,
  type Reading,
} from './logic.ts'

const MAX_BODY_BYTES = 64 * 1024
const MAX_PRINTERS_PER_ACCOUNT = 50
const HEARTBEAT_SECONDS = 60

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const enc = new TextEncoder()
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function must<T extends { error: { message: string } | null }>(r: T): T {
  if (r.error) throw new Error(r.error.message)
  return r
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface Agent { id: string; account_id: string; status: string }

async function authenticate(req: Request): Promise<Agent | Response> {
  const cred = parseCredential(req.headers.get('Authorization'))
  if (!cred) return json(401, { error: 'unauthorized' })
  const { data: agent } = await db.from('printer_agents')
    .select('id, account_id, status, secret_hash').eq('id', cred.agentId).maybeSingle()
  const ok = agent && agent.status !== 'revoked' && safeEqual(await sha256Hex(cred.secret), agent.secret_hash)
  if (!ok) return json(401, { error: 'unauthorized' })
  const { data: allowed } = await db.rpc('printer_rate_check', { p_key: `agent:${agent.id}`, p_limit: 120, p_window_seconds: 60 })
  if (!allowed) return json(429, { error: 'rate_limited' })
  return { id: agent.id, account_id: agent.account_id, status: agent.status }
}

async function handlePair(req: Request, body: Record<string, unknown>) {
  // Throttle guessing of pairing codes by caller IP.
  // The last hop is the one our own proxy appended; earlier entries can be forged by the caller.
  const hops = (req.headers.get('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  const ip = req.headers.get('cf-connecting-ip') ?? hops[hops.length - 1] ?? 'unknown'
  const { data: allowed } = await db.rpc('printer_rate_check', { p_key: `pair:${await sha256Hex(ip)}`, p_limit: 10, p_window_seconds: 600 })
  if (!allowed) return json(429, { error: 'rate_limited' })

  const v = validatePair(body)
  if (!v.ok) return json(400, { error: v.error })
  const secret = randomSecret()
  const { data: agentId, error } = await db.rpc('printer_pair_agent', {
    p_code_hash: await sha256Hex(v.value.code),
    p_secret_hash: await sha256Hex(secret),
    p_device_name: v.value.deviceName,
    p_version: v.value.version,
  })
  if (error) return json(409, { error: 'pairing_failed' })
  if (!agentId) return json(400, { error: 'invalid_or_expired_code' })
  return json(200, { agent_id: agentId, credential: `${agentId}.${secret}`, heartbeat_interval_seconds: HEARTBEAT_SECONDS })
}

async function handleHeartbeat(agent: Agent, body: Record<string, unknown>) {
  const version = typeof body.agent_version === 'string' ? body.agent_version.slice(0, 40) : null
  const patch: Record<string, unknown> = { status: 'online', last_heartbeat_at: new Date().toISOString() }
  if (agent.status !== 'online') patch.online_since = patch.last_heartbeat_at
  if (version) patch.agent_version = version
  must(await db.from('printer_agents').update(patch).eq('id', agent.id).neq('status', 'revoked'))
  must(await db.from('printer_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('dedupe_key', `agent_offline:${agent.id}`).in('status', ['open', 'acknowledged']))
  return json(200, { ok: true, server_time: new Date().toISOString(), heartbeat_interval_seconds: HEARTBEAT_SECONDS })
}

async function handleRegister(agent: Agent, body: Record<string, unknown>) {
  const v = validateRegister(body)
  if (!v.ok) return json(400, { error: v.error })
  const r = v.value
  const { data: existing } = await db.from('printers').select('id')
    .eq('account_id', agent.account_id).eq('device_identifier', r.deviceIdentifier).maybeSingle()
  if (existing) {
    // Same physical device: refresh its details but keep the user's chosen name.
    must(await db.from('printers').update({
      agent_id: agent.id, manufacturer: r.manufacturer, model: r.model, connection_type: r.connectionType,
      ip_address: r.ipAddress, driver_info: r.driverInfo, capabilities: r.capabilities,
    }).eq('id', existing.id))
    return json(200, { printer_id: existing.id, created: false })
  }
  const { count } = await db.from('printers').select('id', { count: 'exact', head: true }).eq('account_id', agent.account_id)
  if ((count ?? 0) >= MAX_PRINTERS_PER_ACCOUNT) return json(409, { error: 'printer_limit_reached' })
  const { data: created, error } = await db.from('printers').insert({
    account_id: agent.account_id, agent_id: agent.id, name: r.name, manufacturer: r.manufacturer, model: r.model,
    connection_type: r.connectionType, device_identifier: r.deviceIdentifier, ip_address: r.ipAddress,
    driver_info: r.driverInfo, capabilities: r.capabilities,
  }).select('id').single()
  if (error) return json(409, { error: 'register_failed' })
  return json(200, { printer_id: created.id, created: true })
}

async function handleTelemetry(agent: Agent, body: Record<string, unknown>) {
  const now = new Date()
  if (!Array.isArray(body.readings) || body.readings.length === 0) return json(400, { error: 'invalid_readings' })
  if (body.readings.length > MAX_READINGS_PER_CALL) return json(400, { error: 'too_many_readings' })
  // One bad reading must not discard the good ones: validate each and report the rejects.
  const readings: Reading[] = []
  const results: { printer_id: string; accepted: boolean; error?: string }[] = []
  for (const raw of body.readings) {
    const v = validateReading(raw, now)
    if (v.ok) readings.push(v.value)
    else results.push({ printer_id: String((raw as Record<string, unknown>)?.printer_id ?? ''), accepted: false, error: v.error })
  }

  const processReading = async (r: Reading): Promise<{ printer_id: string; accepted: boolean; error?: string }> => {
    const { data: printer } = await db.from('printers')
      .select('id, name, account_id, low_supply_threshold, last_seen_at')
      .eq('id', r.printerId).eq('account_id', agent.account_id).maybeSingle()
    if (!printer) return { printer_id: r.printerId, accepted: false, error: 'unknown_printer' }

    const stale = printer.last_seen_at && new Date(printer.last_seen_at).getTime() > r.observedAt.getTime()
    if (!stale) {
      must(await db.from('printers').update({
        status: r.status, status_detail: r.statusDetail, last_seen_at: r.observedAt.toISOString(), agent_id: agent.id,
      }).eq('id', printer.id))
    }

    const { data: lastStatus } = await db.from('printer_metrics').select('value_text, recorded_at')
      .eq('printer_id', printer.id).eq('metric_type', 'status').order('recorded_at', { ascending: false }).limit(1).maybeSingle()
    if (shouldRecordStatus(lastStatus ? { status: lastStatus.value_text, at: new Date(lastStatus.recorded_at) } : null, r.status, r.observedAt)) {
      must(await db.from('printer_metrics').insert({
        printer_id: printer.id, metric_type: 'status', value_text: r.status, source: 'actual', recorded_at: r.observedAt.toISOString(),
      }))
    }
    if (r.pageCount !== null) {
      const { data: lastPages } = await db.from('printer_metrics').select('value_num, recorded_at')
        .eq('printer_id', printer.id).eq('metric_type', 'page_count').order('recorded_at', { ascending: false }).limit(1).maybeSingle()
      const prevPages = lastPages ? { count: Number(lastPages.value_num), at: new Date(lastPages.recorded_at) } : null
      if (shouldRecordPageCount(prevPages, r.pageCount, r.observedAt)) {
        must(await db.from('printer_metrics').insert({
          printer_id: printer.id, metric_type: 'page_count', value_num: r.pageCount, source: 'actual', recorded_at: r.observedAt.toISOString(),
        }))
      }
    }

    await Promise.all(r.consumables.map(async (c) => {
      const { data: prev } = await db.from('printer_consumables').select('level_percentage, source, observed_at')
        .eq('printer_id', printer.id).eq('consumable_type', c.type).eq('colour', c.colour)
        .order('observed_at', { ascending: false }).limit(1).maybeSingle()
      const prevShape = prev ? { level: prev.level_percentage, source: prev.source, at: new Date(prev.observed_at) } : null
      if (shouldRecordConsumable(prevShape, c, r.observedAt)) {
        must(await db.from('printer_consumables').insert({
          printer_id: printer.id, consumable_type: c.type, colour: c.colour,
          level_percentage: c.level, source: c.source, observed_at: r.observedAt.toISOString(),
        }))
      }
    }))

    if (!stale) {
      const wanted = evaluateAlerts({
        printerId: printer.id, printerName: printer.name, status: r.status, statusDetail: r.statusDetail,
        threshold: printer.low_supply_threshold, consumables: r.consumables,
      })
      for (const a of wanted) {
        must(await db.rpc('printer_raise_alert', {
          p_account: printer.account_id, p_printer: printer.id, p_agent: null, p_type: a.type,
          p_severity: a.severity, p_message: a.message, p_dedupe: a.dedupeKey,
        }))
      }
      // A supply the printer did not mention this time keeps its existing alert; everything else resolves.
      const { data: lowActive } = await db.from('printer_alerts').select('dedupe_key')
        .eq('printer_id', printer.id).eq('alert_type', 'low_supply').in('status', ['open', 'acknowledged'])
      const reported = new Set(r.consumables.filter((c) => c.source !== 'unsupported').map((c) => `low_supply:${printer.id}:${c.type}:${c.colour}`))
      const keep = [
        ...wanted.map((a) => a.dedupeKey),
        ...(lowActive ?? []).map((a) => a.dedupe_key as string).filter((k) => !reported.has(k)),
      ]
      must(await db.rpc('printer_resolve_alerts', { p_printer: printer.id, p_keep: keep }))
    }
    return { printer_id: printer.id, accepted: true }
  }

  // Printers run in parallel; readings for the same printer stay in order. A failed write rejects only that printer.
  const groups = new Map<string, Reading[]>()
  for (const r of readings) groups.set(r.printerId, [...(groups.get(r.printerId) ?? []), r])
  const settled = await Promise.all([...groups.values()].map(async (group) => {
    const out: { printer_id: string; accepted: boolean; error?: string }[] = []
    for (const r of group) {
      try { out.push(await processReading(r)) } catch (e) {
        console.error('telemetry write failed', e instanceof Error ? e.message : 'unknown')
        out.push({ printer_id: r.printerId, accepted: false, error: 'write_failed' })
      }
    }
    return out
  }))
  results.push(...settled.flat())
  return json(200, { ok: true, results })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > MAX_BODY_BYTES) return json(413, { error: 'too_large' })

  let body: Record<string, unknown>
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' })
    const parsed = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return json(400, { error: 'invalid_json' })
    body = parsed
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  try {
    const action = body.action
    if (action === 'pair') return await handlePair(req, body)

    const agent = await authenticate(req)
    if (agent instanceof Response) return agent
    if (action === 'heartbeat') return await handleHeartbeat(agent, body)
    if (action === 'register-printer') return await handleRegister(agent, body)
    if (action === 'telemetry') return await handleTelemetry(agent, body)
    return json(400, { error: 'unknown_action' })
  } catch (e) {
    console.error('printer-agent error', e instanceof Error ? e.message : 'unknown')
    return json(500, { error: 'server_error' })
  }
})
