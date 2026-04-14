import { useTranslation } from 'react-i18next'
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react'

const GRADE_CONFIG = {
  green: {
    icon: ShieldCheck,
    textClass: 'text-green',
    bgClass: 'bg-green/10',
    borderClass: 'border-green/30'
  },
  amber: {
    icon: Shield,
    textClass: 'text-amber',
    bgClass: 'bg-amber/10',
    borderClass: 'border-amber/30'
  },
  red: {
    icon: ShieldAlert,
    textClass: 'text-red',
    bgClass: 'bg-red/10',
    borderClass: 'border-red/30'
  }
}

/**
 * Colour-coded reliability score badge.
 *
 * Props:
 *   score          — 0-100 numeric or null
 *   grade          — 'green' | 'amber' | 'red' or null
 *   acceptanceRate — 0-100 numeric or null
 *   completionRate — 0-100 numeric or null
 *   hasEnoughData  — show full badge only when enough jobs exist
 *   compact        — if true, show just the score badge (no breakdown)
 */
export default function ReliabilityScore({
  score,
  grade,
  acceptanceRate,
  completionRate,
  hasEnoughData,
  compact = false
}) {
  const { t } = useTranslation()

  if (!hasEnoughData || score === null) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted bg-border/50 px-3 py-1.5 rounded-full">
        <Shield size={13} />
        <span>{t('reliability.building')}</span>
      </div>
    )
  }

  const config = GRADE_CONFIG[grade] ?? GRADE_CONFIG.amber
  const Icon = config.icon

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${config.textClass} ${config.bgClass} ${config.borderClass}`}>
        <Icon size={12} />
        {score}%
      </span>
    )
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${config.bgClass} ${config.borderClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={20} className={config.textClass} />
          <span className="font-semibold text-ink">{t('reliability.score')}</span>
        </div>
        <span className={`text-2xl font-bold ${config.textClass}`}>{score}%</span>
      </div>

      <div className="space-y-1.5">
        <RateRow
          label={t('reliability.acceptance_rate')}
          value={acceptanceRate}
          config={config}
        />
        <RateRow
          label={t('reliability.completion_rate')}
          value={completionRate}
          config={config}
        />
      </div>

      {grade === 'red' && (
        <p className="text-xs text-red font-medium">
          {t('reliability.warning')}
        </p>
      )}
    </div>
  )
}

function RateRow({ label, value, config }) {
  if (value === null) return null
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${config.textClass}`}>{value}%</span>
    </div>
  )
}
