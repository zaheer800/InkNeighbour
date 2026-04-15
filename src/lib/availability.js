/**
 * Client-side availability state utilities.
 *
 * These functions mirror the Postgres get_effective_state() function so the UI
 * can derive state without an extra round-trip. Always recompute — never cache.
 */

/**
 * Resolve the effective availability state for an owner.
 *
 * Priority order (highest first):
 *   1. system_override == FORCED_OFF  → UNAVAILABLE
 *   2. manual_state == OFF            → UNAVAILABLE
 *   3. manual_state == ON             → AVAILABLE
 *   4. schedule_state                 → AVAILABLE | UNAVAILABLE
 *
 * @param {object|null} owner     - Owner row from Supabase (may be null)
 * @param {Array}       schedules - Rows from availability_schedules table
 * @returns {'AVAILABLE'|'UNAVAILABLE'}
 */
export function getEffectiveState(owner, schedules = []) {
  if (!owner) return 'UNAVAILABLE'

  // 1. System override (highest priority)
  if (
    owner.system_override === 'FORCED_OFF' &&
    owner.override_expires_at &&
    new Date(owner.override_expires_at) > new Date()
  ) {
    return 'UNAVAILABLE'
  }

  // 2 & 3. Manual state
  if (owner.manual_state === 'OFF') return 'UNAVAILABLE'
  if (owner.manual_state === 'ON') return 'AVAILABLE'

  // 4. Fall back to schedule
  return getScheduleState(schedules) ? 'AVAILABLE' : 'UNAVAILABLE'
}

/**
 * Return true if the current moment falls inside any active schedule slot.
 *
 * @param {Array} schedules - Rows from availability_schedules
 * @returns {boolean}
 */
export function getScheduleState(schedules = []) {
  if (!schedules.length) return false

  const now = new Date()
  const dow = now.getDay() // 0 = Sunday … 6 = Saturday
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  return schedules.some(slot => {
    if (!slot.is_active) return false
    if (slot.day_of_week !== dow) return false

    const [sh, sm] = slot.start_time.split(':').map(Number)
    const [eh, em] = slot.end_time.split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em

    return currentMinutes >= startMin && currentMinutes < endMin
  })
}

/**
 * Resolve when the shop will next be open as a display string.
 *
 * Returns null when the shop is currently AVAILABLE or has no upcoming slot.
 *
 * @param {object|null} owner     - Owner row from Supabase
 * @param {Array}       schedules - Rows from availability_schedules
 * @returns {string|null}
 */
export function resolveNextAvailable(owner, schedules = []) {
  if (!owner) return null
  if (getEffectiveState(owner, schedules) === 'AVAILABLE') return null

  // System override — show when the cooldown expires
  if (
    owner.system_override === 'FORCED_OFF' &&
    owner.override_expires_at
  ) {
    const expiry = new Date(owner.override_expires_at)
    if (expiry > new Date()) {
      return expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  // No schedule — manual OFF with no slots configured
  if (!schedules.length) return null

  // Find the next upcoming schedule slot (look up to 7 days ahead)
  const now = new Date()
  const todayDow = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dow = (todayDow + dayOffset) % 7

    const daySlots = schedules
      .filter(s => s.is_active && s.day_of_week === dow)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    for (const slot of daySlots) {
      const [sh, sm] = slot.start_time.split(':').map(Number)
      const startMin = sh * 60 + sm

      // Skip slots that have already started today
      if (dayOffset === 0 && startMin <= currentMinutes) continue

      const nextDate = new Date(now)
      nextDate.setDate(nextDate.getDate() + dayOffset)
      nextDate.setHours(sh, sm, 0, 0)

      const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      if (dayOffset === 0) return timeStr
      if (dayOffset === 1) return `Tomorrow at ${timeStr}`

      const dayName = nextDate.toLocaleDateString([], { weekday: 'long' })
      return `${dayName} at ${timeStr}`
    }
  }

  return null
}

/**
 * Categorise the reason the shop is currently unavailable.
 * Used to pick the correct customer-facing message.
 *
 * @param {object|null} owner
 * @param {Array}       schedules
 * @returns {'available'|'system_override'|'manual_off'|'schedule_off'}
 */
export function getUnavailabilityCause(owner, schedules = []) {
  if (!owner) return 'manual_off'
  if (getEffectiveState(owner, schedules) === 'AVAILABLE') return 'available'

  if (
    owner.system_override === 'FORCED_OFF' &&
    owner.override_expires_at &&
    new Date(owner.override_expires_at) > new Date()
  ) {
    return 'system_override'
  }

  if (owner.manual_state === 'OFF') return 'manual_off'

  return 'schedule_off'
}

/**
 * Return true if the owner is allowed to toggle their manual state.
 * Enforces the 30-second minimum interval between toggles.
 *
 * @param {string|null} lastToggleAt - ISO timestamp or null
 * @returns {boolean}
 */
export function canToggle(lastToggleAt) {
  if (!lastToggleAt) return true
  const elapsedSeconds = (Date.now() - new Date(lastToggleAt).getTime()) / 1000
  return elapsedSeconds >= 30
}

/**
 * Return the number of seconds remaining in the rapid-toggle cooldown, or 0.
 *
 * @param {string|null} lastToggleAt - ISO timestamp or null
 * @returns {number}
 */
export function toggleCooldownRemaining(lastToggleAt) {
  if (!lastToggleAt) return 0
  const elapsedSeconds = (Date.now() - new Date(lastToggleAt).getTime()) / 1000
  return Math.max(0, Math.ceil(30 - elapsedSeconds))
}
