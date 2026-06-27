import { useState, useRef, useEffect } from 'react'
import { X, Loader2, Check, MapPin, LocateFixed, ChevronRight } from 'lucide-react'

const OLA_KEY = import.meta.env.VITE_OLA_MAPS_API_KEY
const OLA_BASE = 'https://api.olamaps.io/places/v1'

async function fetchPredictions(query) {
  const res = await fetch(`${OLA_BASE}/autocomplete?input=${encodeURIComponent(query)}&api_key=${OLA_KEY}`)
  if (!res.ok) throw new Error('autocomplete failed')
  const data = await res.json()
  return data.predictions ?? []
}

async function reverseGeocode(lat, lng) {
  const res = await fetch(`${OLA_BASE}/reverse-geocode?latlng=${lat},${lng}&api_key=${OLA_KEY}`)
  if (!res.ok) throw new Error('reverse-geocode failed')
  const data = await res.json()
  return data.results?.[0]?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

/**
 * Two-part delivery address entry:
 *   Step 1 — Search / GPS detect the building / street
 *   Step 2 — Enter flat / door number
 *
 * Props:
 *   value       string        current combined address (empty = start fresh)
 *   onChange    (address) => void   called with "FlatNo, Street Address"
 *   label       string
 *   error       string | undefined
 *   required    bool
 */
export default function AddressAutocomplete({ value, onChange, label, error, required }) {
  // phase: 'street' | 'flat' | 'done'
  const [phase, setPhase]             = useState(value ? 'done' : 'street')
  const [streetQuery, setStreetQuery] = useState('')
  const [predictions, setPredictions] = useState([])
  const [street, setStreet]           = useState('')
  const [flatNo, setFlatNo]           = useState('')
  const [searching, setSearching]     = useState(false)
  const [detecting, setDetecting]     = useState(false)
  const debounceRef                   = useRef(null)
  const flatInputRef                  = useRef(null)

  // Parse existing value back into parts on mount
  useEffect(() => {
    if (value && phase === 'done') {
      const commaIdx = value.indexOf(', ')
      if (commaIdx > 0) {
        setFlatNo(value.slice(0, commaIdx))
        setStreet(value.slice(commaIdx + 2))
      } else {
        setStreet(value)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset if parent clears value
  useEffect(() => {
    if (!value) { setPhase('street'); setStreet(''); setFlatNo(''); setStreetQuery('') }
  }, [value])

  // Autocomplete debounce
  useEffect(() => {
    if (phase !== 'street' || streetQuery.length < 3) { setPredictions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true)
        setPredictions(await fetchPredictions(streetQuery))
      } catch { /* silent */ }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [streetQuery, phase])

  function confirmStreet(address) {
    setStreet(address)
    setStreetQuery(address)
    setPredictions([])
    setPhase('flat')
    setTimeout(() => flatInputRef.current?.focus(), 100)
  }

  async function detectLocation() {
    if (!navigator.geolocation) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          confirmStreet(address)
        } catch { /* silent */ }
        finally { setDetecting(false) }
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function confirmFull() {
    if (!flatNo.trim()) return
    const combined = `${flatNo.trim()}, ${street}`
    setPhase('done')
    onChange(combined)
  }

  function handleReset() {
    setPhase('street')
    setStreet('')
    setFlatNo('')
    setStreetQuery('')
    setPredictions([])
    onChange('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-base font-semibold text-ink">
          {label}{required && <span className="text-red ml-0.5">*</span>}
        </label>
      )}

      {/* ── DONE ── */}
      {phase === 'done' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3 p-3.5 bg-green/10 rounded-xl border border-green/20">
            <Check size={16} className="text-green mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{flatNo || value?.split(', ')[0]}</p>
              <p className="text-xs text-muted mt-0.5 leading-snug">{street || value}</p>
            </div>
          </div>
          <button type="button" onClick={handleReset}
            className="text-sm text-violet font-medium hover:text-violet/80 transition-colors min-h-[44px] text-left">
            Change address
          </button>
        </div>
      )}

      {/* ── STREET SEARCH ── */}
      {phase === 'street' && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <div className={`flex items-center rounded-xl border ${error ? 'border-red' : 'border-border'} bg-surface focus-within:ring-2 focus-within:ring-violet/40 focus-within:border-violet overflow-hidden`}>
              <MapPin size={17} className="ml-4 text-muted flex-shrink-0" />
              <input
                type="text"
                value={streetQuery}
                onChange={e => setStreetQuery(e.target.value)}
                placeholder="Search building, street or area…"
                className="flex-1 min-h-[52px] px-3 text-base text-ink bg-transparent focus:outline-none placeholder:text-muted"
                autoComplete="off"
              />
              {(streetQuery || searching) && (
                <button type="button" onClick={() => { setStreetQuery(''); setPredictions([]) }}
                  className="mr-3 text-muted hover:text-ink transition-colors p-1">
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                </button>
              )}
            </div>

            {predictions.length > 0 && (
              <ul role="listbox"
                className="absolute z-[500] top-full left-0 right-0 mt-1 bg-surface rounded-xl border border-border shadow-card overflow-hidden">
                {predictions.map((p, i) => (
                  <li key={i}>
                    <button type="button" role="option" onClick={() => confirmStreet(p.description ?? p.structured_formatting?.main_text ?? '')}
                      className="w-full text-left px-4 py-3 hover:bg-bg transition-colors border-b border-border last:border-0 min-h-[48px] flex flex-col justify-center">
                      <span className="text-sm font-medium text-ink truncate">
                        {p.structured_formatting?.main_text ?? p.description}
                      </span>
                      {p.structured_formatting?.secondary_text && (
                        <span className="text-xs text-muted truncate">{p.structured_formatting.secondary_text}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {navigator.geolocation && (
            <button type="button" onClick={detectLocation} disabled={detecting}
              className="flex items-center gap-2 text-sm font-semibold text-violet hover:text-violet/80 transition-colors min-h-[44px] disabled:opacity-50">
              {detecting ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
              {detecting ? 'Detecting your location…' : 'Use my current location'}
            </button>
          )}
        </div>
      )}

      {/* ── FLAT NUMBER ── */}
      {phase === 'flat' && (
        <div className="flex flex-col gap-3">
          {/* Street confirmed pill */}
          <div className="flex items-center gap-2 px-3 py-2 bg-violet/8 rounded-xl border border-violet/20">
            <MapPin size={14} className="text-violet flex-shrink-0" />
            <p className="text-xs text-ink flex-1 truncate">{street}</p>
            <button type="button" onClick={() => setPhase('street')}
              className="text-xs text-violet font-semibold hover:text-violet/80 flex-shrink-0 min-h-[32px] px-1">
              Change
            </button>
          </div>

          {/* Flat / door number */}
          <div>
            <label className="text-sm font-semibold text-ink block mb-1.5">
              Flat / door number <span className="text-red">*</span>
            </label>
            <input
              ref={flatInputRef}
              type="text"
              value={flatNo}
              onChange={e => setFlatNo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && flatNo.trim()) confirmFull() }}
              placeholder="e.g. Flat 4B, Shop 12, House 3…"
              className="w-full min-h-[52px] px-4 text-base text-ink bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet placeholder:text-muted"
              autoComplete="off"
            />
          </div>

          <button type="button" onClick={confirmFull} disabled={!flatNo.trim()}
            className="flex items-center justify-center gap-2 min-h-[52px] w-full bg-violet text-white font-bold rounded-xl hover:bg-violet/90 transition-colors disabled:opacity-40">
            <Check size={17} />
            Confirm delivery address
          </button>
        </div>
      )}

      {error && phase !== 'done' && (
        <p role="alert" className="text-sm text-red font-medium">{error}</p>
      )}
    </div>
  )
}
