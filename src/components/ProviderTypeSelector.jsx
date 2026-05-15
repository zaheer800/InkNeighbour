import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

const TYPES = [
  {
    value: 'home',
    emoji: '🏠',
    titleKey: 'register.provider_home_title',
    descKey:  'register.provider_home_desc',
    bullets: [
      'register.provider_home_b1',
      'register.provider_home_b2',
      'register.provider_home_b3',
    ],
    accentClass:       'border-orange/60 bg-orange/5',
    iconBgClass:       'bg-gradient-to-br from-orange to-orange2',
    checkBgClass:      'bg-orange',
    bulletDotClass:    'bg-orange',
  },
  {
    value: 'shop',
    emoji: '🏪',
    titleKey: 'register.provider_shop_title',
    descKey:  'register.provider_shop_desc',
    bullets: [
      'register.provider_shop_b1',
      'register.provider_shop_b2',
      'register.provider_shop_b3',
    ],
    accentClass:       'border-violet/60 bg-violet/5',
    iconBgClass:       'bg-gradient-to-br from-violet to-purple-600',
    checkBgClass:      'bg-violet',
    bulletDotClass:    'bg-violet',
  },
]

/**
 * ProviderTypeSelector — large visual card pair for choosing Home Owner vs Print Shop.
 *
 * Props:
 *   value     'home' | 'shop' | ''   — currently selected type
 *   onChange  (value) => void         — called with 'home' or 'shop' on selection
 *   error     string | undefined      — validation message shown below cards
 */
export default function ProviderTypeSelector({ value, onChange, error }) {
  const { t } = useTranslation()
  const noneSelected = !value

  return (
    <div>
      <div className="mb-3">
        <p className="text-lg font-bold text-ink">
          {t('register.provider_question')} <span className="text-red" aria-hidden="true">*</span>
        </p>
        <p className="text-sm text-muted mt-0.5">{t('register.provider_question_sub')}</p>
      </div>

      {/* Card grid — stacked on mobile, side by side on sm+ */}
      <div
        role="radiogroup"
        aria-label={t('register.provider_question')}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {TYPES.map((type) => {
          const selected = value === type.value

          return (
            <button
              key={type.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(type.value)}
              className={[
                'relative text-left rounded-xl border-2 p-5 transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/50',
                'min-h-[48px] w-full',
                selected
                  ? `${type.accentClass} shadow-md`
                  : 'border-border bg-surface hover:border-muted/40 hover:shadow-sm',
              ].join(' ')}
            >
              {/* Top-right badge */}
              {selected ? (
                <span
                  className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white ${type.checkBgClass}`}
                  aria-hidden="true"
                >
                  <Check size={11} strokeWidth={3} />
                  Selected
                </span>
              ) : noneSelected && (
                <span
                  className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium text-muted bg-bg border border-border"
                  aria-hidden="true"
                >
                  Tap to select
                </span>
              )}

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${
                  selected ? type.iconBgClass : 'bg-bg'
                }`}
                aria-hidden="true"
              >
                {type.emoji}
              </div>

              {/* Title */}
              <p className="font-display text-lg font-bold text-ink leading-tight mb-1">
                {t(type.titleKey)}
              </p>

              {/* Short description */}
              <p className="text-sm text-muted leading-snug mb-3">
                {t(type.descKey)}
              </p>

              {/* Bullet points */}
              <ul className="space-y-1.5" aria-label={t(type.titleKey)}>
                {type.bullets.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm text-ink/80">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        selected ? type.bulletDotClass : 'bg-muted'
                      }`}
                      aria-hidden="true"
                    />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
