import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getEffectiveState,
  getScheduleState,
  resolveNextAvailable,
  getUnavailabilityCause,
  canToggle,
  toggleCooldownRemaining
} from '../../lib/availability'

// ── Helpers ────────────────────────────────────────────────

function makeOwner(overrides = {}) {
  return {
    manual_state: 'OFF',
    system_override: 'NONE',
    override_expires_at: null,
    last_toggle_at: null,
    ...overrides
  }
}

// Build a schedule slot active today at the given minutes range
function makeSlot(dow, startHour, startMin, endHour, endMin, active = true) {
  const pad = n => String(n).padStart(2, '0')
  return {
    id: `slot-${dow}-${startHour}`,
    day_of_week: dow,
    start_time: `${pad(startHour)}:${pad(startMin)}:00`,
    end_time: `${pad(endHour)}:${pad(endMin)}:00`,
    is_active: active
  }
}

// Pin "now" to a specific Date so schedule tests are deterministic
function pinTime(date) {
  vi.useFakeTimers()
  vi.setSystemTime(date)
}

// ── getEffectiveState ──────────────────────────────────────

describe('getEffectiveState', () => {
  afterEach(() => vi.useRealTimers())

  it('returns UNAVAILABLE when owner is null', () => {
    expect(getEffectiveState(null)).toBe('UNAVAILABLE')
  })

  it('returns UNAVAILABLE when system_override is FORCED_OFF and not expired', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const owner = makeOwner({
      manual_state: 'ON',
      system_override: 'FORCED_OFF',
      override_expires_at: future
    })
    expect(getEffectiveState(owner)).toBe('UNAVAILABLE')
  })

  it('ignores expired system_override and falls through to manual state', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const owner = makeOwner({
      manual_state: 'ON',
      system_override: 'FORCED_OFF',
      override_expires_at: past
    })
    expect(getEffectiveState(owner)).toBe('AVAILABLE')
  })

  it('returns UNAVAILABLE when manual_state is OFF (override NONE)', () => {
    const owner = makeOwner({ manual_state: 'OFF' })
    expect(getEffectiveState(owner)).toBe('UNAVAILABLE')
  })

  it('returns AVAILABLE when manual_state is ON (override NONE)', () => {
    const owner = makeOwner({ manual_state: 'ON' })
    expect(getEffectiveState(owner)).toBe('AVAILABLE')
  })

  it('falls back to schedule state when manual_state is null', () => {
    // Wednesday 10:00 — inside a 09:00–12:00 Wed slot
    pinTime(new Date('2024-01-03T10:00:00')) // Wed
    const owner = makeOwner({ manual_state: null })
    const schedules = [makeSlot(3, 9, 0, 12, 0)] // Wednesday = dow 3
    expect(getEffectiveState(owner, schedules)).toBe('AVAILABLE')
  })

  it('returns UNAVAILABLE when no schedule matches', () => {
    pinTime(new Date('2024-01-03T10:00:00')) // Wed
    const owner = makeOwner({ manual_state: null })
    const schedules = [makeSlot(1, 9, 0, 12, 0)] // Monday only
    expect(getEffectiveState(owner, schedules)).toBe('UNAVAILABLE')
  })
})

// ── getScheduleState ───────────────────────────────────────

describe('getScheduleState', () => {
  afterEach(() => vi.useRealTimers())

  it('returns false for empty schedules', () => {
    expect(getScheduleState([])).toBe(false)
  })

  it('returns true when current time is inside an active slot', () => {
    // Monday 08:30 — inside 07:00–09:00
    pinTime(new Date('2024-01-01T08:30:00')) // Monday
    const schedules = [makeSlot(1, 7, 0, 9, 0)]
    expect(getScheduleState(schedules)).toBe(true)
  })

  it('returns false when slot is inactive', () => {
    pinTime(new Date('2024-01-01T08:30:00')) // Monday
    const schedules = [makeSlot(1, 7, 0, 9, 0, false)]
    expect(getScheduleState(schedules)).toBe(false)
  })

  it('returns false when time is before slot start', () => {
    pinTime(new Date('2024-01-01T06:59:00')) // Monday 06:59
    const schedules = [makeSlot(1, 7, 0, 9, 0)]
    expect(getScheduleState(schedules)).toBe(false)
  })

  it('returns false when time equals slot end (exclusive end)', () => {
    pinTime(new Date('2024-01-01T09:00:00')) // Monday 09:00
    const schedules = [makeSlot(1, 7, 0, 9, 0)]
    expect(getScheduleState(schedules)).toBe(false)
  })

  it('returns false when slot is for a different day', () => {
    pinTime(new Date('2024-01-01T08:30:00')) // Monday
    const schedules = [makeSlot(2, 7, 0, 9, 0)] // Tuesday
    expect(getScheduleState(schedules)).toBe(false)
  })

  it('returns true when any one of multiple slots matches', () => {
    pinTime(new Date('2024-01-01T19:30:00')) // Monday evening
    const schedules = [
      makeSlot(1, 7, 0, 9, 0),   // morning
      makeSlot(1, 18, 0, 21, 0)  // evening ← matches
    ]
    expect(getScheduleState(schedules)).toBe(true)
  })
})

// ── resolveNextAvailable ───────────────────────────────────

describe('resolveNextAvailable', () => {
  afterEach(() => vi.useRealTimers())

  it('returns null when owner is null', () => {
    expect(resolveNextAvailable(null)).toBeNull()
  })

  it('returns null when shop is currently AVAILABLE', () => {
    const owner = makeOwner({ manual_state: 'ON' })
    expect(resolveNextAvailable(owner)).toBeNull()
  })

  it('returns override expiry time when system_override is FORCED_OFF', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    const owner = makeOwner({
      manual_state: 'OFF',
      system_override: 'FORCED_OFF',
      override_expires_at: future.toISOString()
    })
    const result = resolveNextAvailable(owner)
    // Should return a time string like "10:00 AM" — not null
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('returns null when manual OFF with no schedules', () => {
    const owner = makeOwner({ manual_state: 'OFF' })
    expect(resolveNextAvailable(owner, [])).toBeNull()
  })

  it('returns time of next slot today when a later slot exists', () => {
    // Monday 06:00 — before the 09:00 slot
    pinTime(new Date('2024-01-01T06:00:00')) // Monday
    const owner = makeOwner({ manual_state: 'OFF' })
    const schedules = [makeSlot(1, 9, 0, 12, 0)]
    const result = resolveNextAvailable(owner, schedules)
    expect(result).toBeTruthy()
    expect(result).not.toContain('Tomorrow')
  })

  it('returns "Tomorrow at HH:MM" when next slot is tomorrow', () => {
    // Monday 22:00 — past all Monday slots
    pinTime(new Date('2024-01-01T22:00:00')) // Monday
    const owner = makeOwner({ manual_state: 'OFF' })
    const schedules = [makeSlot(2, 9, 0, 12, 0)] // Tuesday
    const result = resolveNextAvailable(owner, schedules)
    expect(result).toMatch(/tomorrow/i)
  })

  it('returns day name for slots further than tomorrow', () => {
    // Monday 22:00 — next slot is Thursday
    pinTime(new Date('2024-01-01T22:00:00')) // Monday
    const owner = makeOwner({ manual_state: 'OFF' })
    const schedules = [makeSlot(4, 9, 0, 12, 0)] // Thursday
    const result = resolveNextAvailable(owner, schedules)
    expect(result).toMatch(/thursday/i)
  })
})

// ── getUnavailabilityCause ─────────────────────────────────

describe('getUnavailabilityCause', () => {
  afterEach(() => vi.useRealTimers())

  it('returns available when shop is AVAILABLE', () => {
    const owner = makeOwner({ manual_state: 'ON' })
    expect(getUnavailabilityCause(owner)).toBe('available')
  })

  it('returns system_override when FORCED_OFF and not expired', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const owner = makeOwner({
      system_override: 'FORCED_OFF',
      override_expires_at: future
    })
    expect(getUnavailabilityCause(owner)).toBe('system_override')
  })

  it('returns manual_off when manual_state is OFF and no override', () => {
    const owner = makeOwner({ manual_state: 'OFF' })
    expect(getUnavailabilityCause(owner)).toBe('manual_off')
  })

  it('returns schedule_off when manual is null and no matching slot', () => {
    pinTime(new Date('2024-01-01T22:00:00')) // Monday, no evening slot
    const owner = makeOwner({ manual_state: null })
    const schedules = [makeSlot(1, 7, 0, 9, 0)] // only morning
    expect(getUnavailabilityCause(owner, schedules)).toBe('schedule_off')
  })

  it('returns manual_off for null owner', () => {
    expect(getUnavailabilityCause(null)).toBe('manual_off')
  })
})

// ── canToggle ──────────────────────────────────────────────

describe('canToggle', () => {
  afterEach(() => vi.useRealTimers())

  it('returns true when lastToggleAt is null', () => {
    expect(canToggle(null)).toBe(true)
  })

  it('returns true when 30+ seconds have elapsed', () => {
    const ago = new Date(Date.now() - 31_000).toISOString()
    expect(canToggle(ago)).toBe(true)
  })

  it('returns true at exactly 30 seconds', () => {
    const ago = new Date(Date.now() - 30_000).toISOString()
    expect(canToggle(ago)).toBe(true)
  })

  it('returns false when fewer than 30 seconds have elapsed', () => {
    const ago = new Date(Date.now() - 15_000).toISOString()
    expect(canToggle(ago)).toBe(false)
  })
})

// ── toggleCooldownRemaining ────────────────────────────────

describe('toggleCooldownRemaining', () => {
  afterEach(() => vi.useRealTimers())

  it('returns 0 when lastToggleAt is null', () => {
    expect(toggleCooldownRemaining(null)).toBe(0)
  })

  it('returns 0 when cooldown has fully elapsed', () => {
    const ago = new Date(Date.now() - 31_000).toISOString()
    expect(toggleCooldownRemaining(ago)).toBe(0)
  })

  it('returns remaining seconds (ceiling) when in cooldown', () => {
    const ago = new Date(Date.now() - 15_000).toISOString()
    const remaining = toggleCooldownRemaining(ago)
    // Should be roughly 15 (30 - 15), allow ±1 for timing
    expect(remaining).toBeGreaterThanOrEqual(14)
    expect(remaining).toBeLessThanOrEqual(16)
  })

  it('returns 30 immediately after toggle', () => {
    const now = new Date().toISOString()
    const remaining = toggleCooldownRemaining(now)
    expect(remaining).toBe(30)
  })
})
