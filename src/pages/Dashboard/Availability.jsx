import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Plus, Trash2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useAvailability } from '../../hooks/useAvailability'
import Button from '../../components/ui/Button'
import AppNav from '../../components/AppNav'
import DashboardNav from '../../components/DashboardNav'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DashboardAvailability() {
  const { t } = useTranslation()
  const {
    schedules,
    loadingSchedules,
    addScheduleSlot,
    updateScheduleSlot,
    deleteScheduleSlot
  } = useAvailability()

  const [addingSlot, setAddingSlot] = useState(false)
  const [selectedDays, setSelectedDays] = useState(new Set([1, 2, 3, 4, 5])) // Mon–Fri default
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('21:00')
  const [savingSlot, setSavingSlot] = useState(false)

  function toggleDay(d) {
    setSelectedDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  // ── Schedule slot ──────────────────────────────────────────

  async function handleAddSlot(e) {
    e.preventDefault()
    if (selectedDays.size === 0) { toast.error('Select at least one day.'); return }
    if (startTime >= endTime) { toast.error(t('availability.slot_time_invalid')); return }
    setSavingSlot(true)
    let anyError = false
    for (const d of [...selectedDays].sort()) {
      const { error } = await addScheduleSlot({ day_of_week: d, start_time: startTime, end_time: endTime, is_active: true })
      if (error) anyError = true
    }
    setSavingSlot(false)
    if (anyError) {
      toast.error(t('errors.network'))
    } else {
      toast.success(t('availability.slot_added'))
      setAddingSlot(false)
      setSelectedDays(new Set([1, 2, 3, 4, 5]))
      setStartTime('09:00')
      setEndTime('21:00')
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
    slots: schedules.filter(s => s.day_of_week === dow)
  }))

  return (
    <div className="min-h-screen bg-bg pb-24">
      <AppNav />
      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-xl font-bold text-ink">{t('availability.title')}</h1>
          <p className="text-muted text-sm mt-0.5">Set when your shop is open for orders</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Info banner */}
        <div className="bg-violet/10 border border-violet/20 rounded-xl p-4 text-sm text-ink leading-relaxed">
          When you add opening hours, customers can only place orders during those times.
          If no hours are set, your shop follows your <strong>Go live / Pause</strong> toggle on the Jobs tab.
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

              {/* Day pills — multi-select */}
              <div>
                <label className="block text-sm text-muted mb-2">{t('availability.day_label')}</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_SHORT.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={[
                        'w-10 h-10 rounded-xl text-sm font-bold transition-colors',
                        selectedDays.has(i)
                          ? 'bg-violet text-white'
                          : 'bg-bg border border-border text-muted hover:border-violet/40'
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1.5">{t('availability.from_label')}</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-3 text-base bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 min-h-[52px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1.5">{t('availability.to_label')}</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-3 text-base bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 min-h-[52px]"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => setAddingSlot(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" size="sm" className="flex-1" loading={savingSlot}>
                  Save
                  {selectedDays.size > 1 && (
                    <span className="ml-1 bg-white/25 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {selectedDays.size}
                    </span>
                  )}
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

      <DashboardNav />
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
