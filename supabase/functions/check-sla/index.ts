/**
 * InkNeighbour — check-sla Edge Function
 *
 * Called every minute by pg_cron (and immediately after a new order by a database trigger, with
 * ?mode=drain). Protected by a shared secret: `Authorization: Bearer <SLA_SECRET>`, verify_jwt off.
 *
 * tick (default):
 *   1. queue 10-minute and 5-minute reminders for submitted jobs close to their deadline,
 *   2. auto-cancel submitted jobs past their deadline (only if still 'submitted'), record the miss,
 *      queue a "cancelled" message for the customer, delete the uploaded file,
 *   3. soft-lock owners whose reliability fell below the threshold,
 *   4. send everything waiting in notification_outbox.
 * drain: step 4 only.
 *
 * Messages go through the shared WhatsApp CRM (crm-send) as Meta-approved templates.
 * See docs/order-alerts-design.md.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const SLA_SECRET = Deno.env.get('SLA_SECRET') ?? ''
const CRM_API_KEY = Deno.env.get('CRM_API_KEY') ?? ''
const CRM_SEND_URL = Deno.env.get('CRM_SEND_URL') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://inkneighbour.zakapedia.in'
const SOFT_LOCK_THRESHOLD = 70
const MAX_ATTEMPTS = 3
const BATCH = 25

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? ''
  if (!SLA_SECRET || !timingSafeEqual(auth, `Bearer ${SLA_SECRET}`)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const mode = new URL(req.url).searchParams.get('mode')
    const summary: Record<string, number> = {}
    if (mode !== 'drain') Object.assign(summary, await tick())
    Object.assign(summary, await drainOutbox())
    return json({ ok: true, ...summary }, 200)
  } catch (err) {
    console.error('check-sla error:', err)
    return json({ ok: false, error: 'internal error' }, 500)
  }
})

async function tick() {
  const now = new Date()

  // 1. Reminders. Unique (kind, job_id) makes this safe to repeat every minute.
  const { data: waiting } = await supabase
    .from('jobs').select('id, owner_id, sla_deadline')
    .eq('status', 'submitted')
    .gt('sla_deadline', now.toISOString())
    .lte('sla_deadline', new Date(now.getTime() + 10 * 60000).toISOString())
  let reminders = 0
  for (const job of waiting ?? []) {
    if (!job.owner_id) continue
    const minutesLeft = (new Date(job.sla_deadline).getTime() - now.getTime()) / 60000
    const kind = minutesLeft <= 5 ? 'order_reminder_5' : 'order_reminder_10'
    const { error } = await supabase.from('notification_outbox')
      .upsert({ kind, job_id: job.id, owner_id: job.owner_id }, { onConflict: 'kind,job_id', ignoreDuplicates: true })
    if (!error) reminders++
  }

  // 2. Auto-cancel. The status filter makes this a compare-and-set: a job the owner accepted a
  // moment ago is not touched.
  const { data: cancelled } = await supabase
    .from('jobs').update({ status: 'cancelled' })
    .eq('status', 'submitted').lt('sla_deadline', now.toISOString())
    .select('id, owner_id, file_path')

  const cancelledOwners = new Set<string>()
  for (const job of cancelled ?? []) {
    if (job.owner_id) {
      await supabase.from('missed_jobs').insert({ job_id: job.id, owner_id: job.owner_id, reason: 'sla_expired' })
      cancelledOwners.add(job.owner_id)
    }
    await supabase.from('notification_outbox')
      .upsert({ kind: 'order_cancelled_customer', job_id: job.id, owner_id: job.owner_id },
        { onConflict: 'kind,job_id', ignoreDuplicates: true })
    if (job.file_path) await supabase.storage.from('job-files').remove([job.file_path])
  }

  // 3. Soft lock
  let locked = 0
  for (const ownerId of cancelledOwners) {
    const { data: rel } = await supabase.from('owner_reliability')
      .select('reliability_score, total_jobs').eq('owner_id', ownerId).single()
    const score = rel?.reliability_score != null ? parseFloat(rel.reliability_score) : null
    if (rel && rel.total_jobs >= 5 && score !== null && score < SOFT_LOCK_THRESHOLD) {
      await supabase.rpc('apply_soft_lock', { p_owner_id: ownerId })
      locked++
    }
  }

  return { reminders_queued: reminders, cancelled: cancelled?.length ?? 0, soft_locked: locked }
}

async function drainOutbox() {
  const { data: rows } = await supabase
    .from('notification_outbox').select('id, kind, job_id, owner_id, attempts')
    .eq('status', 'pending').lt('attempts', MAX_ATTEMPTS)
    .order('created_at').limit(BATCH)

  let sent = 0, failed = 0, skipped = 0
  for (const row of rows ?? []) {
    const outcome = await deliver(row)
    const patch = outcome.status === 'sent'
      ? { status: 'sent', sent_at: new Date().toISOString(), attempts: row.attempts + 1, error: null }
      : outcome.status === 'skipped'
        ? { status: 'skipped', error: outcome.reason }
        : { status: row.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending', attempts: row.attempts + 1, error: outcome.reason }
    await supabase.from('notification_outbox').update(patch).eq('id', row.id)
    if (outcome.status === 'sent') sent++
    else if (outcome.status === 'skipped') skipped++
    else failed++
  }
  return { sent, send_failed: failed, skipped }
}

type Outcome = { status: 'sent' } | { status: 'skipped' | 'retry'; reason: string }

async function deliver(row: { kind: string; job_id: string; owner_id: string | null }): Promise<Outcome> {
  const { data: job } = await supabase.from('jobs')
    .select('id, job_number, status, customer_name, customer_phone, customer_whatsapp_optin, page_count, total_amount, sla_deadline, owners(name, phone, shop_name, slug)')
    .eq('id', row.job_id).single()
  if (!job) return { status: 'skipped', reason: 'job not found' }
  const owner = Array.isArray(job.owners) ? job.owners[0] : job.owners

  const isOwnerMessage = row.kind !== 'order_cancelled_customer'
  // Owner messages are only useful while the order still waits for an answer.
  if (isOwnerMessage && job.status !== 'submitted') return { status: 'skipped', reason: `job is ${job.status}` }

  const shopName = owner?.shop_name || owner?.name || 'the shop'
  let to: string | null | undefined
  let template: string
  let params: string[]

  if (row.kind === 'order_new') {
    to = owner?.phone; template = 'owner_new_order'
    params = [job.job_number, job.customer_name ?? 'a customer', String(job.page_count ?? '?'), String(job.total_amount ?? '?'), `${APP_URL}/dashboard`]
  } else if (row.kind === 'order_reminder_10' || row.kind === 'order_reminder_5') {
    to = owner?.phone; template = 'owner_order_reminder'
    const mins = Math.max(1, Math.ceil((new Date(job.sla_deadline).getTime() - Date.now()) / 60000))
    params = [job.job_number, String(mins), `${APP_URL}/dashboard`]
  } else {
    if (!job.customer_whatsapp_optin) return { status: 'skipped', reason: 'customer did not opt in' }
    to = job.customer_phone; template = 'customer_order_cancelled'
    params = [job.job_number, shopName, APP_URL]
  }

  to = normalizePhone(to)
  if (!to) return { status: 'skipped', reason: 'no usable phone number' }
  if (!CRM_API_KEY || !CRM_SEND_URL) return { status: 'retry', reason: 'CRM_API_KEY / CRM_SEND_URL not configured' }

  const res = await fetch(CRM_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CRM_API_KEY },
    body: JSON.stringify({
      to, type: 'template',
      template: { name: template, language: 'en', components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] },
    }),
  })
  if (res.ok) return { status: 'sent' }
  const detail = (await res.text()).slice(0, 200)
  // 400 = bad number / 403 = opted out: retrying cannot help.
  if (res.status === 400 || res.status === 403) return { status: 'skipped', reason: `crm ${res.status}: ${detail}` }
  return { status: 'retry', reason: `crm ${res.status}: ${detail}` }
}

// Digits only. A bare 10-digit Indian mobile number gets the 91 prefix; anything else must already carry its country code.
function normalizePhone(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/[^0-9]/g, '')
  if (/^[6-9][0-9]{9}$/.test(d)) return '91' + d
  return /^[1-9][0-9]{7,14}$/.test(d) ? d : null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
