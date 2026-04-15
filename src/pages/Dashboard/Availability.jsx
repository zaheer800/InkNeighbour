import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BarChart2, MessageSquare, Settings, Clock, Plus, Trash2,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import { useAvailability } from '../../hooks/useAvailability'
import { useOwner } from '../../hooks/useOwner'
import { resolveNextAvailable } from '../../lib/availability'
import Button from '../../components/ui/Button'
import PreCommitmentPrompt from '../../components/PreCommitmentPrompt'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function DashboardAvailability() {
  const { t } = useTranslation()
  const { owner } = useOwner()
  const {
    schedules,
    loadingSchedules,
    effectiveState,
    isAvailable,
    isSystemOverride,
    overrideExpiresAt,
    toggling,
    toggleManualState,
    addScheduleSlot,
    updateScheduleSlot,
    deleteScheduleSlot
  } = useAvailability()

  const [showCommitPrompt, setShowCommitPrompt] = useState(false)
  const [addingSlot, setAddingSlot] = useState(false)
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: '09:00', end_time: '21:00' })
  const [savingSlot, setSavingSlot] = useState(false)

  const nextAvailable = resolveNextAvailable(owner, schedules)

  // ── Toggle ─────────────────────────────────────────────────

  function handleToggleClick() {
    if (isSystemOverride) {
      const time = overrideExpiresAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? ''
      toast.error(t('availability.override_active', { time }))
      return
    }
    if (owner?.manual_state !== 'ON') {
      // Going live — show pre-commitment prompt
      setShowCommitPrompt(true)
    } else {
      doToggle()
    }
  }

  async function doToggle() {
    const result = await toggleManualState()
    if (result?.blocked === 'system_override') {
      toast.error(t('availability.override_active_short'))
    } else if (result?.blocked === 'rapid_toggle') {
      toast.error(t('availability.rapid_toggle', { seconds: result.cooldown }))
    } else if (result?.error) {
      toast.error(t('errors.network'))
    } else {
      const key = result?.newState === 'ON' ? 'availability.now_live' : 'availability.now_paused'
      toast.success(t(key))
    }
  }

  async function handleCommitConfirm() {
    setShowCommitPrompt(false)
    await doToggle()
  }

  // ── Schedule slot ──────────────────────────────────────────

  async function handleAddSlot(e) {
    e.preventDefault()
    if (newSlot.start_time >= newSlot.end_time) {
      toast.error(t('availability.slot_time_invalid'))
      return
    }
    setSavingSlot(true)
    const { error } = await addScheduleSlot({ ...newSlot, is_active: true })
    setSavingSlot(false)
    if (error) {
      toast.error(t('errors.network'))
    } else {
      toast.success(t('availability.slot_added'))
      setAddingSlot(false)
      setNewSlot({ day_of_week: 1, start_time: '09:00', end_time: '21:00' })
    }
  }

  async function handleDeleteSlot(id) {
    const { error } = await deleteScheduleSlot(id)
    if (error) toast.error(t('errors.network'))
    else toast.success(t('availability.slot_deleted'))
  }

  async function handleToggleSlot(slot) {
    const { error } = await updateScheduleSlot(slot.id, { is_active: !slot.is_active })
    if (error) toast.error(t('errors.network'))
  }

  // ── Group schedules by day ─────────────────────────────────
  const slotsByDay = DAY_NAMES.map((name, dow) => ({
    dow,
    name,
    short: DAY_SHORT[dow],
    slots: schedules.filter(s => s.day_of_week === dow)
  }))

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Pre-commitment prompt */}
      <PreCommitmentPrompt
        open={showCommitPrompt}
        onConfirm={handleCommitConfirm}
        onCancel={() => setShowCommitPrompt(false)}
        loading={toggling}
      />

      {/* Header */}
      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="font-display text-3xl font-bold">{t('availability.title')}</h1>
          <p className="text-white/70 mt-1 text-base">{t('availability.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── System override banner ─────────────────────────── */}
        {isSystemOverride && (
          <div className="bg-red/10 border border-red/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red">{t('availability.override_title')}</p>
              <p className="text-sm text-ink mt-1">
                {t('availability.override_message', {
                  time: overrideExpiresAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? ''
                })}
              </p>
            </div>
          </div>
        )}

        {/* ── Effective state card ───────────────────────────── */}
        <div className={[
          'rounded-xl border p-5 flex items-center justify-between',
          isAvailable
            ? 'bg-green/10 border-green/30'
            : 'bg-amber/10 border-amber/30'
        ].join(' ')}>
          <div>
            <p className="text-sm font-medium text-muted">{t('availability.current_status')}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green' : 'bg-amber'}`} />
              <span className={`text-xl font-bold ${isAvailable ? 'text-green' : 'text-ink'}`}>
                {isAvailable ? t('availability.status_available') : t('availability.status_unavailable')}
              </span>
            </div>
            {!isAvailable && nextAvailable && (
              <p className="text-sm text-muted mt-1 flex items-center gap-1">
                <Clock size={13} />
                {t('availability.next_available', { time: nextAvailable })}
              </p>
            )}
          </div>

          {/* Manual toggle button */}
          <button
            onClick={handleToggleClick}
            disabled={toggling || isSystemOverride}
            className="p-2 disabled:opacity-40 transition-opacity min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label={t('availability.toggle_aria')}
          >
            {owner?.manual_state === 'ON'
              ? <ToggleRight size={40} className="text-green" />
              : <ToggleLeft size={40} className="text-muted" />
            }
          </button>
        </div>

        {/* State explanation */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm text-muted">
          {[
            {
              active: owner?.system_override === 'FORCED_OFF',
              icon: AlertTriangle,
              color: 'text-red',
              label: t('availability.explain_override')
            },
            {
              active: owner?.manual_state === 'ON',
              icon: CheckCircle2,
              color: 'text-green',
              label: t('availability.explain_manual_on')
            },
            {
              active: owner?.manual_state === 'OFF',
              icon: ToggleLeft,
              color: 'text-amber',
              label: t('availability.explain_manual_off')
            },
            {
              active: owner?.manual_state == null,
              icon: Calendar,
              color: 'text-violet',
              label: t('availability.explain_schedule')
            }
          ].map((row, i) => (
            <div key={i} className={`flex items-start gap-2 ${row.active ? 'opacity-100' : 'opacity-40'}`}>
              <row.icon size={15} className={`${row.color} flex-shrink-0 mt-0.5`} />
              <span>{row.label}</span>
            </div>
          ))}
        </div>

        {/* ── Schedule section ───────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-ink">{t('availability.schedule_title')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingSlot(v => !v)}
            >
              <Plus size={16} />
              {t('availability.add_slot')}
            </Button>
          </div>

          {/* Add slot form */}
          {addingSlot && (
            <form onSubmit={handleAddSlot} className="bg-surface border border-violet/30 rounded-xl p-4 mb-4 space-y-4">
              <p className="font-semibold text-ink">{t('availability.new_slot')}</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">{t('availability.day_label')}</label>
                  <select
                    value={newSlot.day_of_week}
                    onChange={e => setNewSlot(s => ({ ...s, day_of_week: Number(e.target.value) }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 min-h-[48px]"
                  >
                    {DAY_NAMES.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">{t('availability.from_label')}</label>
                  <input
                    type="time"
                    value={newSlot.start_time}
                    onChange={e => setNewSlot(s => ({ ...s, start_time: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 min-h-[48px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">{t('availability.to_label')}</label>
                  <input
                    type="time"
                    value={newSlot.end_time}
                    onChange={e => setNewSlot(s => ({ ...s, end_time: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 min-h-[48px]"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => setAddingSlot(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" size="sm" className="flex-1" loading={savingSlot}>
                  {t('availability.save_slot')}
                </Button>
              </div>
            </form>
          )}

          {/* Slots by day */}
          {loadingSchedules ? (
            <p className="text-center text-muted py-8">{t('common.loading')}</p>
          ) : schedules.length === 0 && !addingSlot ? (
            <div className="bg-surface border border-border rounded-xl p-6 text-center">
              <Calendar size={36} className="text-muted mx-auto mb-3" />
              <p className="text-ink font-semibold">{t('availability.no_schedule_title')}</p>
              <p className="text-muted text-sm mt-1">{t('availability.no_schedule_desc')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {slotsByDay
                .filter(day => day.slots.length > 0)
                .map(day => (
                  <div key={day.dow} className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="bg-bg px-4 py-2 border-b border-border">
                      <span className="font-semibold text-sm text-ink">{day.name}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {day.slots.map(slot => (
                        <SlotRow
                          key={slot.id}
                          slot={slot}
                          onToggle={() => handleToggleSlot(slot)}
                          onDelete={() => handleDeleteSlot(slot.id)}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-30">
        {[
          { to: '/dashboard', icon: null, label: 'Jobs' },
          { to: '/dashboard/earnings', icon: BarChart2, label: 'Earnings' },
          { to: '/dashboard/feedback', icon: MessageSquare, label: 'Feedback' },
          { to: '/dashboard/availability', icon: Clock, label: 'Hours', active: true },
          { to: '/dashboard/settings', icon: Settings, label: 'Settings' }
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors min-h-[56px]',
              item.active ? 'text-violet' : 'text-muted hover:text-ink'
            ].join(' ')}
          >
            {item.icon && <item.icon size={18} />}
            {!item.icon && <span className="text-base">📋</span>}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function SlotRow({ slot, onToggle, onDelete, t }) {
  const timeStr = `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Clock size={16} className={slot.is_active ? 'text-green' : 'text-muted'} />
      <span className={`flex-1 text-sm font-medium ${slot.is_active ? 'text-ink' : 'text-muted line-through'}`}>
        {timeStr}
      </span>
      <button
        onClick={onToggle}
        className="text-xs text-violet hover:text-violet/70 font-semibold px-2 py-1 min-h-[36px] transition-colors"
      >
        {slot.is_active ? t('availability.disable_slot') : t('availability.enable_slot')}
      </button>
      <button
        onClick={onDelete}
        className="p-1.5 text-red/60 hover:text-red transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
        aria-label={t('availability.delete_slot')}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
