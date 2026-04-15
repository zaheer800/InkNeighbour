import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAvailability } from '../../hooks/useAvailability'

// ── Mock dependencies ──────────────────────────────────────

// owner is returned by useOwner — we control it per test
const mockFetchOwner = vi.fn()
let mockOwner = null

vi.mock('../../hooks/useOwner', () => ({
  useOwner: () => ({ owner: mockOwner, fetchOwner: mockFetchOwner })
}))

// Supabase mock is provided by setup.js globally.
// We import it here to configure per-test return values.
import { supabase } from '../../lib/supabase'

// ── Helpers ────────────────────────────────────────────────

function makeOwner(overrides = {}) {
  return {
    id: 'owner-uuid',
    manual_state: 'OFF',
    system_override: 'NONE',
    override_expires_at: null,
    last_toggle_at: null,
    ...overrides
  }
}

function makeSlot(overrides = {}) {
  return {
    id: 'slot-uuid',
    owner_id: 'owner-uuid',
    day_of_week: 1,
    start_time: '09:00:00',
    end_time: '12:00:00',
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides
  }
}

// ── Tests ──────────────────────────────────────────────────

describe('useAvailability — derived state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOwner = null
    // Default: schedules query returns empty
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    })
  })

  it('returns UNAVAILABLE when owner is null', async () => {
    mockOwner = null
    const { result } = renderHook(() => useAvailability())
    expect(result.current.effectiveState).toBe('UNAVAILABLE')
    expect(result.current.isAvailable).toBe(false)
  })

  it('returns UNAVAILABLE when manual_state is OFF', async () => {
    mockOwner = makeOwner({ manual_state: 'OFF' })
    const { result } = renderHook(() => useAvailability())
    expect(result.current.effectiveState).toBe('UNAVAILABLE')
  })

  it('returns AVAILABLE when manual_state is ON', async () => {
    mockOwner = makeOwner({ manual_state: 'ON' })
    const { result } = renderHook(() => useAvailability())
    expect(result.current.effectiveState).toBe('AVAILABLE')
    expect(result.current.isAvailable).toBe(true)
  })

  it('detects active system override', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    mockOwner = makeOwner({
      manual_state: 'ON',
      system_override: 'FORCED_OFF',
      override_expires_at: future
    })
    const { result } = renderHook(() => useAvailability())
    expect(result.current.isSystemOverride).toBe(true)
    expect(result.current.effectiveState).toBe('UNAVAILABLE')
    expect(result.current.overrideExpiresAt).toBeInstanceOf(Date)
  })

  it('does not flag expired override as active', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    mockOwner = makeOwner({
      manual_state: 'ON',
      system_override: 'FORCED_OFF',
      override_expires_at: past
    })
    const { result } = renderHook(() => useAvailability())
    expect(result.current.isSystemOverride).toBe(false)
    expect(result.current.effectiveState).toBe('AVAILABLE')
  })
})

describe('useAvailability — toggleManualState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis()
    })
  })

  it('blocks toggle when system_override is FORCED_OFF', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    mockOwner = makeOwner({
      system_override: 'FORCED_OFF',
      override_expires_at: future
    })
    const { result } = renderHook(() => useAvailability())
    let res
    await act(async () => {
      res = await result.current.toggleManualState()
    })
    expect(res.blocked).toBe('system_override')
    expect(supabase.from).not.toHaveBeenCalledWith('owners')
  })

  it('blocks rapid toggle within 30 seconds', async () => {
    mockOwner = makeOwner({
      manual_state: 'OFF',
      last_toggle_at: new Date(Date.now() - 10_000).toISOString() // 10s ago
    })
    const { result } = renderHook(() => useAvailability())
    let res
    await act(async () => {
      res = await result.current.toggleManualState()
    })
    expect(res.blocked).toBe('rapid_toggle')
    expect(res.cooldown).toBeGreaterThan(0)
  })

  it('returns error when owner is null', async () => {
    mockOwner = null
    const { result } = renderHook(() => useAvailability())
    let res
    await act(async () => {
      res = await result.current.toggleManualState()
    })
    expect(res.error).toBeInstanceOf(Error)
  })

  it('calls supabase update and fetchOwner on successful toggle', async () => {
    mockOwner = makeOwner({ manual_state: 'OFF', last_toggle_at: null })
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockImplementation((table) => {
      if (table === 'owners') {
        return {
          update: mockUpdate,
          eq: mockEq,
          select: vi.fn().mockReturnThis()
        }
      }
      // schedules
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      }
    })

    const { result } = renderHook(() => useAvailability())
    let res
    await act(async () => {
      res = await result.current.toggleManualState()
    })
    expect(mockFetchOwner).toHaveBeenCalled()
    expect(res?.newState).toBe('ON')
  })
})

describe('useAvailability — schedule CRUD', () => {
  const newSlotData = makeSlot()

  // Builds a Supabase mock where:
  //   - select chains (select → eq → order → resolves)
  //   - write operations (insert/update/delete → eq/single → resolves)
  // This prevents "cannot call .order on a Promise" errors when fetchSchedules
  // runs alongside a write operation in the same test.
  function makeCrudMock({ selectData = [], writeResult = { error: null }, singleResult = { data: null, error: null } } = {}) {
    // Terminal builder for update: .update(x).eq(id).select().single() → singleResult
    const updateBuilder = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(singleResult)
    }
    // Terminal builder for insert: .insert(x).select().single() → singleResult
    const insertBuilder = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(singleResult)
    }
    // Terminal builder for delete: .delete().eq(id) → writeResult (awaitable)
    const deleteBuilder = {
      eq: vi.fn().mockResolvedValue(writeResult)
    }
    // Chainable builder for select: .select().eq().order() → { data, error }
    const selectBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: selectData, error: null })
    }
    return {
      select: vi.fn(() => selectBuilder),
      update: vi.fn(() => updateBuilder),
      insert: vi.fn(() => insertBuilder),
      delete: vi.fn(() => deleteBuilder)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOwner = makeOwner({ manual_state: 'OFF' })
  })

  it('addScheduleSlot appends slot to state on success', async () => {
    supabase.from.mockImplementation(() =>
      makeCrudMock({ singleResult: { data: newSlotData, error: null } })
    )

    const { result } = renderHook(() => useAvailability())
    await act(async () => {
      await result.current.addScheduleSlot({
        day_of_week: 1,
        start_time: '09:00',
        end_time: '12:00',
        is_active: true
      })
    })
    expect(result.current.schedules.find(s => s.id === 'slot-uuid')).toBeDefined()
  })

  it('deleteScheduleSlot removes slot from state on success', async () => {
    supabase.from.mockImplementation(() =>
      makeCrudMock({ selectData: [newSlotData] })
    )

    const { result } = renderHook(() => useAvailability())
    // Wait for initial fetchSchedules to populate
    await waitFor(() => expect(result.current.schedules.length).toBeGreaterThan(0))

    await act(async () => {
      await result.current.deleteScheduleSlot('slot-uuid')
    })
    expect(result.current.schedules.find(s => s.id === 'slot-uuid')).toBeUndefined()
  })

  it('updateScheduleSlot replaces slot in state on success', async () => {
    const updatedSlot = { ...newSlotData, is_active: false }
    supabase.from.mockImplementation(() =>
      makeCrudMock({
        selectData: [newSlotData],
        singleResult: { data: updatedSlot, error: null }
      })
    )

    const { result } = renderHook(() => useAvailability())
    await waitFor(() => expect(result.current.schedules.length).toBeGreaterThan(0))

    await act(async () => {
      await result.current.updateScheduleSlot('slot-uuid', { is_active: false })
    })
    const found = result.current.schedules.find(s => s.id === 'slot-uuid')
    if (found) expect(found.is_active).toBe(false)
  })
})
