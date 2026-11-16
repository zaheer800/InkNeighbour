// Pure validation and alert logic for the printer-agent edge function. No Deno or network imports,
// so it is unit-tested from src/test/lib/printerAgentLogic.test.js.

export const STATUSES = ['ready', 'busy', 'error', 'offline', 'unknown'] as const
export const CONNECTIONS = ['usb', 'network', 'other'] as const
export const CONSUMABLE_TYPES = ['ink', 'toner', 'drum', 'other'] as const
export const COLOURS = ['black', 'cyan', 'magenta', 'yellow', 'colour', 'other'] as const
// Agents may only report what the printer told them; 'manual' is user-entered, never agent-sent.
export const AGENT_SOURCES = ['actual', 'estimated', 'unsupported'] as const

export const MAX_READINGS_PER_CALL = 25
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const STATUS_REPEAT_MS = 15 * 60 * 1000
export const CONSUMABLE_REPEAT_MS = 6 * 60 * 60 * 1000

type Result<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  // Strip control characters so agent-supplied text cannot smuggle markup-breaking bytes into the UI.
  const t = v.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (t.length === 0) return null
  return t.slice(0, max)
}

function oneOf<T extends readonly string[]>(list: T, v: unknown): T[number] | null {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T[number]) : null
}

export function normalisePairingCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const c = raw.replace(/[\s-]/g, '').toUpperCase()
  return /^[0-9A-F]{10}$/.test(c) ? c : null
}

export function parseCredential(header: string | null): { agentId: string; secret: string } | null {
  if (!header) return null
  const m = /^Bearer ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32,128})$/i.exec(header.trim())
  return m ? { agentId: m[1].toLowerCase(), secret: m[2] } : null
}

export function validatePair(body: Record<string, unknown>): Result<{ code: string; deviceName: string; version: string | null }> {
  const code = normalisePairingCode(body.code)
  if (!code) return fail('invalid_code')
  const deviceName = str(body.device_name, 120)
  if (!deviceName) return fail('invalid_device_name')
  return { ok: true, value: { code, deviceName, version: str(body.agent_version, 40) } }
}

export interface RegisterInput {
  deviceIdentifier: string
  name: string
  manufacturer: string | null
  model: string | null
  connectionType: (typeof CONNECTIONS)[number]
  ipAddress: string | null
  driverInfo: string | null
  capabilities: Record<string, unknown>
}

export function validateRegister(body: Record<string, unknown>): Result<RegisterInput> {
  const deviceIdentifier = str(body.device_identifier, 200)
  if (!deviceIdentifier) return fail('invalid_device_identifier')
  const manufacturer = str(body.manufacturer, 80)
  const model = str(body.model, 120)
  const name = str(body.name, 120) ?? [manufacturer, model].filter(Boolean).join(' ').slice(0, 120)
  if (!name) return fail('invalid_name')
  const connectionType = oneOf(CONNECTIONS, body.connection_type) ?? 'other'
  let capabilities: Record<string, unknown> = {}
  if (body.capabilities !== undefined) {
    if (!isObj(body.capabilities) || JSON.stringify(body.capabilities).length > 4000) return fail('invalid_capabilities')
    capabilities = body.capabilities
  }
  return {
    ok: true,
    value: {
      deviceIdentifier, name, manufacturer, model, connectionType,
      ipAddress: str(body.ip_address, 64), driverInfo: str(body.driver_info, 200), capabilities,
    },
  }
}

export interface ConsumableReading {
  type: (typeof CONSUMABLE_TYPES)[number]
  colour: (typeof COLOURS)[number]
  level: number | null
  source: (typeof AGENT_SOURCES)[number]
}

export interface Reading {
  printerId: string
  observedAt: Date
  status: (typeof STATUSES)[number]
  statusDetail: string | null
  pageCount: number | null
  consumables: ConsumableReading[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateReading(raw: unknown, now: Date): Result<Reading> {
  if (!isObj(raw)) return fail('invalid_reading')
  if (typeof raw.printer_id !== 'string' || !UUID.test(raw.printer_id)) return fail('invalid_printer_id')
  const status = oneOf(STATUSES, raw.status)
  if (!status) return fail('invalid_status')
  const t = typeof raw.observed_at === 'string' ? Date.parse(raw.observed_at) : NaN
  if (Number.isNaN(t)) return fail('invalid_observed_at')
  if (t - now.getTime() > MAX_FUTURE_SKEW_MS) return fail('observed_at_in_future')
  if (now.getTime() - t > MAX_AGE_MS) return fail('observed_at_too_old')

  let pageCount: number | null = null
  if (raw.page_count !== undefined && raw.page_count !== null) {
    if (typeof raw.page_count !== 'number' || !Number.isInteger(raw.page_count) || raw.page_count < 0 || raw.page_count > 1e9) {
      return fail('invalid_page_count')
    }
    pageCount = raw.page_count
  }

  const consumables: ConsumableReading[] = []
  if (raw.consumables !== undefined) {
    if (!Array.isArray(raw.consumables) || raw.consumables.length > 16) return fail('invalid_consumables')
    for (const c of raw.consumables) {
      if (!isObj(c)) return fail('invalid_consumable')
      const type = oneOf(CONSUMABLE_TYPES, c.type)
      const colour = oneOf(COLOURS, c.colour)
      const source = oneOf(AGENT_SOURCES, c.source)
      if (!type || !colour || !source) return fail('invalid_consumable')
      let level: number | null = null
      if (source !== 'unsupported') {
        if (typeof c.level !== 'number' || !Number.isFinite(c.level) || c.level < 0 || c.level > 100) {
          return fail('invalid_consumable_level')
        }
        level = Math.round(c.level)
      }
      if (consumables.some((x) => x.type === type && x.colour === colour)) return fail('duplicate_consumable')
      consumables.push({ type, colour, level, source })
    }
  }

  return {
    ok: true,
    value: { printerId: raw.printer_id.toLowerCase(), observedAt: new Date(t), status, statusDetail: str(raw.status_detail, 300), pageCount, consumables },
  }
}

export function validateTelemetry(body: Record<string, unknown>, now: Date): Result<Reading[]> {
  if (!Array.isArray(body.readings) || body.readings.length === 0) return fail('invalid_readings')
  if (body.readings.length > MAX_READINGS_PER_CALL) return fail('too_many_readings')
  const out: Reading[] = []
  for (const r of body.readings) {
    const v = validateReading(r, now)
    if (!v.ok) return v
    out.push(v.value)
  }
  return { ok: true, value: out }
}

// Keep telemetry volume down: record a status only when it changes or the last one is old.
export function shouldRecordStatus(prev: { status: string; at: Date } | null, status: string, at: Date): boolean {
  if (!prev) return true
  return prev.status !== status || at.getTime() - prev.at.getTime() >= STATUS_REPEAT_MS
}

export function shouldRecordPageCount(prev: { count: number; at: Date } | null, count: number, at: Date): boolean {
  if (!prev) return true
  return prev.count !== count && at.getTime() - prev.at.getTime() >= STATUS_REPEAT_MS
}

export function shouldRecordConsumable(
  prev: { level: number | null; source: string; at: Date } | null,
  next: { level: number | null; source: string },
  at: Date,
): boolean {
  if (!prev) return true
  if (prev.level !== next.level || prev.source !== next.source) return true
  return at.getTime() - prev.at.getTime() >= CONSUMABLE_REPEAT_MS
}

export interface WantedAlert {
  dedupeKey: string
  type: 'printer_offline' | 'printer_error' | 'low_supply'
  severity: 'warning' | 'critical'
  message: string
}

const COLOUR_LABEL: Record<string, string> = {
  black: 'Black', cyan: 'Cyan', magenta: 'Magenta', yellow: 'Yellow', colour: 'Colour', other: '',
}

// The alerts that should be active right now for this printer given its latest reading.
// Anything active in the database that is not in this list is resolved by the caller.
export function evaluateAlerts(p: {
  printerId: string
  printerName: string
  status: string
  statusDetail: string | null
  threshold: number
  consumables: ConsumableReading[]
}): WantedAlert[] {
  const out: WantedAlert[] = []
  if (p.status === 'offline') {
    out.push({
      dedupeKey: `printer_offline:${p.printerId}`, type: 'printer_offline', severity: 'warning',
      message: `${p.printerName} is offline. Possible causes: printer switched off, network lost, or USB cable unplugged.`,
    })
  }
  if (p.status === 'error') {
    out.push({
      dedupeKey: `printer_error:${p.printerId}`, type: 'printer_error', severity: 'critical',
      message: p.statusDetail ? `${p.printerName} reports a problem: ${p.statusDetail}` : `${p.printerName} reports a problem.`,
    })
  }
  for (const c of p.consumables) {
    // Unsupported readings never raise a low-supply alert: no data is not low data.
    if (c.level === null || c.source === 'unsupported') continue
    if (c.level <= p.threshold) {
      const label = `${COLOUR_LABEL[c.colour] ? COLOUR_LABEL[c.colour] + ' ' : ''}${c.type}`
      out.push({
        dedupeKey: `low_supply:${p.printerId}:${c.type}:${c.colour}`, type: 'low_supply',
        severity: c.level <= 5 ? 'critical' : 'warning',
        message: `${label} is low (${c.level}%) on ${p.printerName}.`,
      })
    }
  }
  return out.map((a) => ({ ...a, message: a.message.slice(0, 300) }))
}
