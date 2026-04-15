import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

/**
 * Live SLA countdown timer for a submitted job.
 * Updates every second. Turns amber < 5 min, red < 3 min.
 * Shows "Expired" once the deadline has passed.
 */
export default function SLACountdown({ deadline }) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!deadline) return

    function tick() {
      const diff = Math.floor((new Date(deadline) - Date.now()) / 1000)
      setRemaining(diff)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (!deadline) return null

  if (remaining === null) return null

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red bg-red/10 px-2 py-0.5 rounded-full">
        <Clock size={12} />
        {t('sla.expired')}
      </span>
    )
  }

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const label = t('sla.expires_in', {
    time: `${minutes}:${String(seconds).padStart(2, '0')}`
  })

  const isRed = remaining < 3 * 60    // < 3 min
  const isAmber = remaining < 5 * 60  // < 5 min

  const colorClass = isRed
    ? 'text-red bg-red/10'
    : isAmber
    ? 'text-amber bg-amber/10'
    : 'text-sky bg-sky/10'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
      <Clock size={12} />
      {label}
    </span>
  )
}
