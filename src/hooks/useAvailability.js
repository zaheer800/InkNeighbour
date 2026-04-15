import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOwner } from './useOwner'
import {
  getEffectiveState,
  canToggle,
  toggleCooldownRemaining
} from '../lib/availability'

/**
 * Hook for the full availability system:
 *   - Derives effectiveState from owner row + schedules
 *   - Exposes toggleManualState (with rapid-toggle protection)
 *   - Exposes schedule CRUD against availability_schedules
 *
 * Pattern: mutations optimistically update local state, then re-fetch owner.
 */
export function useAvailability() {
  const { owner, fetchOwner } = useOwner()

  const [schedules, setSchedules] = useState([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState(null)

  // ── Schedules ────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    if (!owner) return
    setLoadingSchedules(true)
    const { data, error: fetchErr } = await supabase
      .from('availability_schedules')
      .select('*')
      .eq('owner_id', owner.id)
      .order('day_of_week')
    if (fetchErr) {
      setError(fetchErr)
    } else {
      // Secondary sort by start_time done client-side
      setSchedules(sortSlots(data ?? []))
    }
    setLoadingSchedules(false)
  }, [owner])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  // ── Derived state ────────────────────────────────────────────

  const effectiveState = getEffectiveState(owner, schedules)
  const isAvailable = effectiveState === 'AVAILABLE'

  const isSystemOverride =
    owner?.system_override === 'FORCED_OFF' &&
    owner?.override_expires_at != null &&
    new Date(owner.override_expires_at) > new Date()

  const overrideExpiresAt = isSystemOverride
    ? new Date(owner.override_expires_at)
    : null

  // ── Manual toggle ────────────────────────────────────────────

  /**
   * Toggle manual_state between ON and OFF.
   *
   * Returns one of:
   *   { newState }                                  — success
   *   { blocked: 'system_override' }                — cannot toggle while FORCED_OFF
   *   { blocked: 'rapid_toggle', cooldown: Number } — toggled too recently
   *   { error }                                     — Supabase error
   */
  const toggleManualState = useCallback(async () => {
    if (!owner) return { error: new Error('No owner record') }

    if (isSystemOverride) {
      return { blocked: 'system_override' }
    }

    if (!canToggle(owner.last_toggle_at)) {
      return {
        blocked: 'rapid_toggle',
        cooldown: toggleCooldownRemaining(owner.last_toggle_at)
      }
    }

    const newState = owner.manual_state === 'ON' ? 'OFF' : 'ON'
    setToggling(true)

    const { error: updateErr } = await supabase
      .from('owners')
      .update({
        manual_state: newState,
        last_toggle_at: new Date().toISOString()
      })
      .eq('id', owner.id)

    await fetchOwner()
    setToggling(false)

    if (updateErr) return { error: updateErr }
    return { newState }
  }, [owner, isSystemOverride, fetchOwner])

  // ── Schedule CRUD ────────────────────────────────────────────

  /**
   * Add a new schedule slot.
   * @param {{ day_of_week: number, start_time: string, end_time: string, is_active?: boolean }} slot
   */
  const addScheduleSlot = useCallback(async (slot) => {
    if (!owner) return { error: new Error('No owner record') }

    const { data, error: insertErr } = await supabase
      .from('availability_schedules')
      .insert({ ...slot, owner_id: owner.id })
      .select()
      .single()

    if (!insertErr && data) {
      setSchedules(prev => sortSlots([...prev, data]))
    }
    return { data, error: insertErr }
  }, [owner])

  /**
   * Update an existing schedule slot.
   * @param {string} id
   * @param {Partial<{ day_of_week, start_time, end_time, is_active }>} updates
   */
  const updateScheduleSlot = useCallback(async (id, updates) => {
    const { data, error: updateErr } = await supabase
      .from('availability_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!updateErr && data) {
      setSchedules(prev => sortSlots(prev.map(s => (s.id === id ? data : s))))
    }
    return { data, error: updateErr }
  }, [])

  /**
   * Delete a schedule slot by ID.
   * @param {string} id
   */
  const deleteScheduleSlot = useCallback(async (id) => {
    const { error: deleteErr } = await supabase
      .from('availability_schedules')
      .delete()
      .eq('id', id)

    if (!deleteErr) {
      setSchedules(prev => prev.filter(s => s.id !== id))
    }
    return { error: deleteErr }
  }, [])

  return {
    // State
    schedules,
    loadingSchedules,
    effectiveState,
    isAvailable,
    isSystemOverride,
    overrideExpiresAt,
    toggling,
    error,
    // Actions
    toggleManualState,
    addScheduleSlot,
    updateScheduleSlot,
    deleteScheduleSlot,
    fetchSchedules
  }
}

// ── Helpers ──────────────────────────────────────────────────

function sortSlots(slots) {
  return [...slots].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
    return a.start_time.localeCompare(b.start_time)
  })
}
