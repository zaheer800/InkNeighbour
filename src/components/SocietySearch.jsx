import { useState, useCallback } from 'react'
import { Search, MapPin, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { getDuplicateWarning } from '../lib/fuzzyMatch'
import Input from './ui/Input'
import Button from './ui/Button'

/**
 * Society search + selection component for owner registration Step 2.
 * Handles known societies, taken slots, fuzzy duplicate detection.
 */
export default function SocietySearch({ postalCode, countryCode = 'IN', onSelect }) {
  const { t } = useTranslation()
  const [societies, setSocieties] = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [manualName, setManualName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [warning, setWarning] = useState(null)
  const [confirmedOverride, setConfirmedOverride] = useState(false)

  const searchSocieties = useCallback(async () => {
    if (!postalCode) return
    setLoading(true)
    const { data } = await supabase
      .from('societies')
      .select(`id, name, slug, city, state, owners(id, name, status)`)
      .eq('postal_code', postalCode)
      .eq('country_code', countryCode)

    setSocieties(data || [])
    setSearched(true)
    setLoading(false)
  }, [postalCode, countryCode])

  function handleManualNameChange(e) {
    const val = e.target.value
    setManualName(val)
    setConfirmedOverride(false)

    if (val.length > 2) {
      const match = getDuplicateWarning(val, societies)
      setWarning(match)
    } else {
      setWarning(null)
    }
  }

  function handleSelectExisting(society) {
    const owner = society.owners?.[0]
    if (owner && owner.status !== 'inactive') {
      alert(t('register.society_taken', { name: owner.name }))
      return
    }
    onSelect({ society, isNew: false })
  }

  function handleConfirmManual() {
    if (warning && !confirmedOverride) {
      setConfirmedOverride(true)
      return
    }
    onSelect({ society: { name: manualName, postal_code: postalCode, country_code: countryCode }, isNew: true })
  }

  return (
    <div className="space-y-4">
      {!searched ? (
        <Button onClick={searchSocieties} loading={loading} className="w-full">
          <Search size={18} /> {t('register.search_societies')}
        </Button>
      ) : (
        <div className="space-y-3">
          {societies.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted uppercase tracking-wide">
                {t('register.known_societies')}
              </p>
              {societies.map(s => {
                const owner = s.owners?.[0]
                const taken = owner && owner.status !== 'inactive'
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectExisting(s)}
                    className={[
                      'w-full text-left p-4 rounded-xl border transition-colors',
                      taken
                        ? 'border-border bg-bg text-muted cursor-not-allowed opacity-60'
                        : 'border-border bg-surface hover:border-violet hover:bg-violet/5 cursor-pointer'
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className={taken ? 'text-muted' : 'text-violet'} />
                        <span className="font-semibold text-ink">{s.name}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-pill ${taken ? 'bg-red/10 text-red' : 'bg-green/10 text-green'}`}>
                        {taken ? t('register.taken') : t('register.available')}
                      </span>
                    </div>
                    {s.city && <p className="text-sm text-muted mt-1 ml-6">{s.city}{s.state ? `, ${s.state}` : ''}</p>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Manual entry */}
          {!showManual ? (
            <button
              onClick={() => setShowManual(true)}
              className="w-full py-3 text-violet font-semibold text-base underline-offset-2 hover:underline"
            >
              + {t('register.add_my_society')}
            </button>
          ) : (
            <div className="space-y-3 border border-violet/30 rounded-xl p-4">
              <Input
                label={t('register.society_name')}
                value={manualName}
                onChange={handleManualNameChange}
                placeholder={t('register.society_name_placeholder')}
              />
              {warning && (
                <div className="flex items-start gap-2 p-3 bg-amber/10 border border-amber/30 rounded-xl text-sm text-amber">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t('register.similar_exists', { name: warning.name })}</p>
                    {confirmedOverride
                      ? <p className="text-muted mt-1">{t('register.override_confirmed')}</p>
                      : <p className="text-muted mt-1">{t('register.confirm_different')}</p>}
                  </div>
                </div>
              )}
              <Button
                onClick={handleConfirmManual}
                disabled={!manualName.trim()}
                className="w-full"
              >
                {warning && !confirmedOverride ? t('register.yes_different') : t('register.confirm_society')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
