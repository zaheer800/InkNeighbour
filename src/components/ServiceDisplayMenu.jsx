import { useTranslation } from 'react-i18next'
import { ScanLine, Copy, BookOpen, Layers, Camera, CheckCircle, XCircle } from 'lucide-react'

const SERVICE_META = {
  scan:           { icon: ScanLine,  labelKey: 'services.scan',           descKey: 'services.scan_desc' },
  photocopy:      { icon: Copy,      labelKey: 'services.photocopy',       descKey: 'services.photocopy_desc' },
  binding:        { icon: BookOpen,  labelKey: 'services.binding',         descKey: 'services.binding_desc' },
  lamination:     { icon: Layers,    labelKey: 'services.lamination',      descKey: 'services.lamination_desc' },
  passport_photo: { icon: Camera,    labelKey: 'services.passport_photo',  descKey: 'services.passport_photo_desc' },
}

const ALL_CODES = ['scan', 'photocopy', 'binding', 'lamination', 'passport_photo']

/**
 * Props:
 *   services – array of { service_code, is_enabled, display_price? } from Supabase
 *              Pass an empty array or omit to show all services as unavailable.
 */
export default function ServiceDisplayMenu({ services = [] }) {
  const { t } = useTranslation()

  const map = {}
  services.forEach(s => { map[s.service_code] = s })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {ALL_CODES.map(code => {
        const meta    = SERVICE_META[code]
        const svc     = map[code]
        const enabled = svc?.is_enabled ?? false
        const price   = svc?.display_price

        const Icon = meta.icon

        return (
          <div
            key={code}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
              enabled
                ? 'border-violet/30 bg-violet/5'
                : 'border-border bg-bg opacity-60'
            }`}
          >
            {/* Icon blob */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
              enabled ? 'bg-violet/15' : 'bg-border/60'
            }`}>
              <Icon size={20} className={enabled ? 'text-violet' : 'text-muted'} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`font-semibold text-sm leading-tight ${enabled ? 'text-ink' : 'text-muted'}`}>
                  {t(meta.labelKey)}
                </p>
                {enabled
                  ? <CheckCircle size={16} className="text-green flex-shrink-0" />
                  : <XCircle    size={16} className="text-muted flex-shrink-0" />
                }
              </div>

              <p className={`text-xs mt-0.5 leading-snug ${enabled ? 'text-muted' : 'text-muted/60'}`}>
                {t(meta.descKey)}
              </p>

              {enabled && price && (
                <p className="text-xs font-semibold text-violet mt-1">{price}</p>
              )}

              {!enabled && (
                <p className="text-xs text-muted/60 mt-1">{t('services.not_available')}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
