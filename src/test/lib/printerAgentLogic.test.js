import { describe, it, expect } from 'vitest'
import {
  normalisePairingCode, parseCredential, validatePair, validateRegister, validateReading,
  validateTelemetry, shouldRecordStatus, shouldRecordConsumable, evaluateAlerts,
} from '../../../supabase/functions/printer-agent/logic.ts'

const now = new Date('2026-11-16T10:00:00Z')
const PID = '11111111-1111-4111-8111-111111111111'
const reading = (over = {}) => ({ printer_id: PID, status: 'ready', observed_at: '2026-11-16T09:59:00Z', ...over })

describe('pairing + credential', () => {
  it('normalises codes', () => {
    expect(normalisePairingCode('ab12c-d34ef')).toBe('AB12CD34EF')
    expect(normalisePairingCode('xyz')).toBeNull()
    expect(normalisePairingCode(42)).toBeNull()
  })
  it('parses a bearer credential and rejects malformed ones', () => {
    const id = '22222222-2222-4222-8222-222222222222'
    const secret = 'a'.repeat(43)
    expect(parseCredential(`Bearer ${id}.${secret}`)).toEqual({ agentId: id, secret })
    expect(parseCredential(null)).toBeNull()
    expect(parseCredential(`Bearer ${id}`)).toBeNull()
    expect(parseCredential(`Bearer ${id}.short`)).toBeNull()
  })
  it('validates pair body and strips control characters', () => {
    const v = validatePair({ code: 'AAAAA-BBBBB'.replace(/[^A-F-]/g, 'A'), device_name: 'PC\u0007 one' })
    expect(v.ok).toBe(true)
    expect(v.value.deviceName).toBe('PC one')
    expect(validatePair({ code: 'AAAAAAAAAA' }).ok).toBe(false)
  })
})

describe('register', () => {
  it('derives a name and defaults connection type', () => {
    const v = validateRegister({ device_identifier: 'x', manufacturer: 'HP', model: 'LaserJet', connection_type: 'bogus' })
    expect(v.ok).toBe(true)
    expect(v.value.name).toBe('HP LaserJet')
    expect(v.value.connectionType).toBe('other')
  })
  it('rejects missing identifier and oversized capabilities', () => {
    expect(validateRegister({ name: 'x' }).ok).toBe(false)
    expect(validateRegister({ device_identifier: 'x', name: 'n', capabilities: { a: 'z'.repeat(5000) } }).ok).toBe(false)
  })
})

describe('readings', () => {
  it('accepts a valid reading', () => {
    const v = validateReading(reading({ page_count: 10, consumables: [{ type: 'toner', colour: 'black', level: 42.4, source: 'actual' }] }), now)
    expect(v.ok).toBe(true)
    expect(v.value.consumables[0].level).toBe(42)
  })
  it('rejects future, ancient, and bad values', () => {
    expect(validateReading(reading({ observed_at: '2026-11-16T11:00:00Z' }), now).ok).toBe(false)
    expect(validateReading(reading({ observed_at: '2026-10-01T00:00:00Z' }), now).ok).toBe(false)
    expect(validateReading(reading({ status: 'weird' }), now).ok).toBe(false)
    expect(validateReading(reading({ printer_id: 'nope' }), now).ok).toBe(false)
    expect(validateReading(reading({ page_count: -1 }), now).ok).toBe(false)
  })
  it('never accepts manual from an agent, and requires a level unless unsupported', () => {
    expect(validateReading(reading({ consumables: [{ type: 'ink', colour: 'black', level: 50, source: 'manual' }] }), now).ok).toBe(false)
    expect(validateReading(reading({ consumables: [{ type: 'ink', colour: 'black', source: 'actual' }] }), now).ok).toBe(false)
    expect(validateReading(reading({ consumables: [{ type: 'ink', colour: 'black', level: 150, source: 'actual' }] }), now).ok).toBe(false)
    const u = validateReading(reading({ consumables: [{ type: 'ink', colour: 'black', level: 80, source: 'unsupported' }] }), now)
    expect(u.ok).toBe(true)
    expect(u.value.consumables[0].level).toBeNull()
  })
  it('limits telemetry batches', () => {
    expect(validateTelemetry({ readings: [] }, now).ok).toBe(false)
    expect(validateTelemetry({ readings: Array(26).fill(reading()) }, now).ok).toBe(false)
    expect(validateTelemetry({ readings: [reading()] }, now).ok).toBe(true)
  })
})

describe('dedupe', () => {
  const t0 = new Date('2026-11-16T09:00:00Z')
  it('records status on change or after repeat window', () => {
    expect(shouldRecordStatus(null, 'ready', t0)).toBe(true)
    expect(shouldRecordStatus({ status: 'ready', at: t0 }, 'ready', new Date(t0.getTime() + 60_000))).toBe(false)
    expect(shouldRecordStatus({ status: 'ready', at: t0 }, 'error', new Date(t0.getTime() + 60_000))).toBe(true)
    expect(shouldRecordStatus({ status: 'ready', at: t0 }, 'ready', new Date(t0.getTime() + 16 * 60_000))).toBe(true)
  })
  it('records consumables on change or after 6h', () => {
    const prev = { level: 50, source: 'actual', at: t0 }
    expect(shouldRecordConsumable(prev, { level: 50, source: 'actual' }, new Date(t0.getTime() + 3600_000))).toBe(false)
    expect(shouldRecordConsumable(prev, { level: 49, source: 'actual' }, new Date(t0.getTime() + 60_000))).toBe(true)
    expect(shouldRecordConsumable(prev, { level: 50, source: 'actual' }, new Date(t0.getTime() + 7 * 3600_000))).toBe(true)
  })
})

describe('evaluateAlerts', () => {
  const base = { printerId: PID, printerName: 'Front desk', statusDetail: null, threshold: 15, consumables: [] }
  it('raises offline and error alerts', () => {
    expect(evaluateAlerts({ ...base, status: 'offline' })[0].type).toBe('printer_offline')
    const e = evaluateAlerts({ ...base, status: 'error', statusDetail: 'Paper jam' })[0]
    expect(e.severity).toBe('critical')
    expect(e.message).toContain('Paper jam')
  })
  it('raises low supply only for real readings at or below threshold', () => {
    const a = evaluateAlerts({ ...base, status: 'ready', consumables: [
      { type: 'toner', colour: 'black', level: 15, source: 'actual' },
      { type: 'toner', colour: 'cyan', level: 4, source: 'estimated' },
      { type: 'toner', colour: 'magenta', level: 80, source: 'actual' },
      { type: 'toner', colour: 'yellow', level: null, source: 'unsupported' },
    ] })
    expect(a.map((x) => x.dedupeKey)).toEqual([`low_supply:${PID}:toner:black`, `low_supply:${PID}:toner:cyan`])
    expect(a[1].severity).toBe('critical')
  })
  it('raises nothing for a healthy printer', () => {
    expect(evaluateAlerts({ ...base, status: 'ready' })).toEqual([])
  })
})

describe('length limits', () => {
  it('caps derived printer names at 120 chars', () => {
    const v = validateRegister({ device_identifier: 'x', manufacturer: 'M'.repeat(80), model: 'N'.repeat(120) })
    expect(v.value.name.length).toBe(120)
  })
  it('caps alert messages at 300 chars', () => {
    const [a] = evaluateAlerts({ printerId: PID, printerName: 'P'.repeat(120), status: 'error', statusDetail: 'd'.repeat(300), threshold: 15, consumables: [] })
    expect(a.message.length).toBeLessThanOrEqual(300)
  })
})

describe('round-2 rules', () => {
  it('rejects duplicate supplies in one reading', () => {
    const c = { type: 'toner', colour: 'black', level: 50, source: 'actual' }
    expect(validateReading(reading({ consumables: [c, { ...c, level: 10 }] }), now).ok).toBe(false)
  })
})
