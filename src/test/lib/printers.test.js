import { describe, it, expect } from 'vitest'
import {
  printerLiveState, describeConsumable, filterPrinters, formatPairingCode, timeAgo,
} from '../../lib/printers'

const now = Date.parse('2026-11-16T10:00:00Z')
const ago = (ms) => new Date(now - ms).toISOString()
const agent = { id: 'a1', status: 'online', last_heartbeat_at: ago(30_000) }
const printer = (over = {}) => ({ id: 'p1', agent_id: 'a1', status: 'ready', last_seen_at: ago(30_000), low_supply_threshold: 15, ...over })

describe('printerLiveState', () => {
  it('shows stored status when fresh', () => {
    expect(printerLiveState(printer(), agent, now)).toBe('ready')
  })
  it('never looks healthy when the agent has gone quiet', () => {
    const quiet = { ...agent, last_heartbeat_at: ago(10 * 60_000) }
    expect(printerLiveState(printer(), quiet, now)).toBe('agent_offline')
  })
  it('is offline when printer data is stale but agent is alive', () => {
    expect(printerLiveState(printer({ last_seen_at: ago(10 * 60_000) }), agent, now)).toBe('offline')
  })
  it('is unknown when never seen and disconnected when revoked', () => {
    expect(printerLiveState(printer({ last_seen_at: null }), agent, now)).toBe('unknown')
    expect(printerLiveState(printer(), { ...agent, status: 'revoked' }, now)).toBe('disconnected')
  })
})

describe('describeConsumable', () => {
  it('never turns unsupported into 0%', () => {
    const d = describeConsumable({ source: 'unsupported', level_percentage: null, consumable_type: 'ink', colour: 'black' }, 15, now)
    expect(d.unavailable).toBe(true)
    expect(d.percent).toBeNull()
    expect(d.low).toBe(false)
  })
  it('flags low and stale readings', () => {
    const d = describeConsumable({ source: 'actual', level_percentage: 10, observed_at: ago(48 * 3600_000) }, 15, now)
    expect(d.low).toBe(true)
    expect(d.stale).toBe(true)
  })
})

describe('filterPrinters', () => {
  const printers = [printer(), printer({ id: 'p2', status: 'error' }), printer({ id: 'p3' })]
  const ctx = {
    agentsById: { a1: agent }, now,
    consumablesByPrinter: { p3: [{ source: 'actual', level_percentage: 5 }] },
    alerts: [],
  }
  it('filters by state', () => {
    expect(filterPrinters(printers, 'all', ctx)).toHaveLength(3)
    expect(filterPrinters(printers, 'online', ctx).map((p) => p.id)).toEqual(['p1', 'p3'])
    expect(filterPrinters(printers, 'attention', ctx).map((p) => p.id)).toEqual(['p2'])
    expect(filterPrinters(printers, 'low_supplies', ctx).map((p) => p.id)).toEqual(['p3'])
  })
})

describe('formatters', () => {
  it('formats pairing codes', () => {
    expect(formatPairingCode('ABCDE12345')).toBe('ABCDE-12345')
    expect(formatPairingCode(null)).toBeNull()
  })
  it('formats relative time', () => {
    expect(timeAgo(null, now)).toBeNull()
    expect(timeAgo(ago(5 * 60_000), now)).toMatch(/5 minutes ago/)
  })
})
