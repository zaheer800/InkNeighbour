// Display rules for printer management. Online/offline is derived from timestamps at read time so a
// silent agent can never leave a printer looking healthy.

export const STALE_AFTER_MS = 3 * 60 * 1000
export const READING_STALE_AFTER_MS = 24 * 60 * 60 * 1000

const ms = (iso) => (iso ? new Date(iso).getTime() : null)

// 'ready' | 'busy' | 'error' | 'offline' | 'agent_offline' | 'disconnected' | 'unknown'
export function printerLiveState(printer, agent, now = Date.now()) {
  if (agent?.status === 'revoked') return 'disconnected'
  const seen = ms(printer.last_seen_at)
  if (seen === null) return 'unknown'
  const beat = ms(agent?.last_heartbeat_at)
  if (!agent || beat === null || now - beat > STALE_AFTER_MS) return 'agent_offline'
  if (now - seen > STALE_AFTER_MS) return 'offline'
  return printer.status
}

export const isOnlineState = (s) => s === 'ready' || s === 'busy'

// One supply reading as the screen should show it. Unsupported is never shown as 0% or healthy.
export function describeConsumable(c, threshold, now = Date.now()) {
  const unavailable = c.source === 'unsupported' || c.level_percentage === null || c.level_percentage === undefined
  const observed = ms(c.observed_at)
  const stale = observed !== null && now - observed > READING_STALE_AFTER_MS
  return {
    unavailable,
    percent: unavailable ? null : c.level_percentage,
    source: c.source,
    stale,
    low: !unavailable && c.level_percentage <= threshold,
    key: `${c.consumable_type}:${c.colour}`,
    colour: c.colour,
    type: c.consumable_type,
  }
}

export function printerNeedsAttention(printer, agent, consumables, openAlerts, now = Date.now()) {
  const state = printerLiveState(printer, agent, now)
  if (state === 'error' || state === 'offline' || state === 'agent_offline') return true
  return openAlerts.some((a) => a.printer_id === printer.id)
}

export function hasLowSupply(printer, consumables, now = Date.now()) {
  return consumables.some((c) => describeConsumable(c, printer.low_supply_threshold, now).low)
}

export function filterPrinters(printers, filter, ctx) {
  const { agentsById, consumablesByPrinter, alerts, now = Date.now() } = ctx
  return printers.filter((p) => {
    const agent = agentsById[p.agent_id]
    const state = printerLiveState(p, agent, now)
    switch (filter) {
      case 'online': return isOnlineState(state)
      case 'offline': return state === 'offline' || state === 'agent_offline' || state === 'disconnected'
      case 'attention': return printerNeedsAttention(p, agent, consumablesByPrinter[p.id] ?? [], alerts, now)
      case 'low_supplies': return hasLowSupply(p, consumablesByPrinter[p.id] ?? [], now)
      default: return true
    }
  })
}

export function formatPairingCode(code) {
  return code && code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code
}

export function timeAgo(iso, now = Date.now(), locale = 'en') {
  const t = ms(iso)
  if (t === null) return null
  const diff = Math.round((t - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}
