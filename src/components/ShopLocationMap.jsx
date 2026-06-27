import { useState, useRef, useEffect } from 'react'
import { OlaMaps, defaultStyleJson } from 'olamaps-web-sdk'
import { MapPin, Search, X, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

const OLA_KEY = import.meta.env.VITE_OLA_MAPS_API_KEY
const OLA_BASE = 'https://api.olamaps.io/places/v1'

function extractLocality(components = []) {
  const priority = ['sublocality_level_1', 'sublocality', 'neighborhood', 'locality']
  for (const type of priority) {
    const match = components.find(c => c.types?.includes(type))
    if (match) return match.long_name
  }
  return ''
}

async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `${OLA_BASE}/reverse-geocode?latlng=${lat},${lng}&api_key=${OLA_KEY}`
  )
  if (!res.ok) throw new Error('reverse-geocode failed')
  const data = await res.json()
  const result = data.results?.[0]
  return {
    address:  result?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    locality: extractLocality(result?.address_components),
  }
}

async function fetchPredictions(query) {
  const res = await fetch(
    `${OLA_BASE}/autocomplete?input=${encodeURIComponent(query)}&api_key=${OLA_KEY}`
  )
  if (!res.ok) throw new Error('autocomplete failed')
  const data = await res.json()
  return data.predictions ?? []
}

async function geocodePlace(address) {
  const res = await fetch(
    `${OLA_BASE}/geocode?address=${encodeURIComponent(address)}&api_key=${OLA_KEY}`
  )
  if (!res.ok) throw new Error('geocode failed')
  const data = await res.json()
  const r = data.geocodingResults?.[0]
  if (!r?.geometry?.location) return null
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    address: r.formatted_address ?? address,
  }
}

/**
 * ShopLocationMap — Ola Maps location picker with three methods:
 *   1. GPS auto-detect on mount
 *   2. Address search (autocomplete)
 *   3. Manual pin (tap map)
 *
 * Props:
 *   lat      number | null    pre-existing latitude
 *   lng      number | null    pre-existing longitude
 *   address  string | null    pre-existing address label (optional)
 *   onChange ({ lat, lng, address, location_method }) => void
 *   error    string | undefined
 */
export default function ShopLocationMap({ lat: initLat, lng: initLng, address: initAddress, onChange, error }) {
  const hasInit = initLat != null && initLng != null

  // ── State machine ──────────────────────────────────────────────────────────
  // detecting | searching | confirming | confirmed
  const [uiState, setUiState] = useState(hasInit ? 'confirmed' : 'detecting')

  const [resolved, setResolved] = useState(hasInit ? {
    lat: initLat,
    lng: initLng,
    address: initAddress ?? '',
    location_method: 'gps',
  } : null)

  const [searchQuery, setSearchQuery]     = useState('')
  const [predictions, setPredictions]     = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  const debounceRef     = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef          = useRef(null)
  const markerRef       = useRef(null)
  const olaMapsRef      = useRef(null)
  const resolvedRef     = useRef(resolved)

  useEffect(() => { resolvedRef.current = resolved }, [resolved])

  // ── Method 1: GPS auto-detect on mount ────────────────────────────────────
  useEffect(() => {
    if (hasInit) return
    if (!navigator.geolocation) { setUiState('searching'); return }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = parseFloat(pos.coords.latitude.toFixed(7))
          const lng = parseFloat(pos.coords.longitude.toFixed(7))
          const { address, locality } = await reverseGeocode(lat, lng)
          const r = { lat, lng, address, locality, location_method: 'gps' }
          setResolved(r)
          resolvedRef.current = r
          setUiState('confirming')
        } catch {
          setUiState('searching')
        }
      },
      () => setUiState('searching'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Method 2: Autocomplete debounced search ───────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 3) { setPredictions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        setPredictions(await fetchPredictions(searchQuery))
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery])

  // ── Map: show when we have a resolved location (except during detecting) ──
  const showMap = resolved !== null && uiState !== 'detecting'

  // ── Map init / update ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!showMap || !resolved || !mapContainerRef.current) return

    if (mapRef.current) {
      // Already initialised — fly to updated position
      mapRef.current.resize()
      markerRef.current?.setLngLat([resolved.lng, resolved.lat])
      mapRef.current.flyTo({ center: [resolved.lng, resolved.lat], zoom: 16, duration: 800 })
      return
    }

    // index.js entry-point wraps OlaMaps with an async init() that dynamically
    // imports the real SDK bundle. We must await it before calling addMarker().
    let cancelled = false

    ;(async () => {
      // Wait one rAF so the browser finishes layout after display:none → block.
      // Without this MapLibre sees a 0-width container and never renders tiles.
      await new Promise(r => requestAnimationFrame(r))
      if (cancelled) return

      try {
        const ola = new OlaMaps({ apiKey: OLA_KEY })
        olaMapsRef.current = ola

        // attributionControl:false stops MapLibre's built-in control from calling
        // map._getUIString() which is unavailable on the SDK's map proxy.
        const map = await ola.init({
          style: defaultStyleJson,
          container: mapContainerRef.current,
          center: [resolved.lng, resolved.lat],
          zoom: 16,
          scrollZoom: false,
          attributionControl: false,
        })

        if (cancelled) { try { map?.remove() } catch { /* ignore */ }; return }

        mapRef.current = map

        const marker = ola.addMarker({ draggable: true })
          .setLngLat([resolved.lng, resolved.lat])
          .addTo(map)
        markerRef.current = marker

        // Marker drag → reverse-geocode → require re-confirmation
        marker.on('dragend', async () => {
          const lngLat = marker.getLngLat()
          const lat = parseFloat(lngLat.lat.toFixed(7))
          const lng = parseFloat(lngLat.lng.toFixed(7))
          try {
            const { address, locality } = await reverseGeocode(lat, lng)
            const r = { lat, lng, address, locality, location_method: resolvedRef.current?.location_method ?? 'manual' }
            setResolved(r)
            resolvedRef.current = r
          } catch {
            const r = { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, locality: '', location_method: 'manual' }
            setResolved(r)
            resolvedRef.current = r
          }
          setUiState('confirming')
        })

        // Map tap → manual pin
        map.on('click', async (e) => {
          const lat = parseFloat(e.lngLat.lat.toFixed(7))
          const lng = parseFloat(e.lngLat.lng.toFixed(7))
          marker.setLngLat([lng, lat])
          map.flyTo({ center: [lng, lat], zoom: 16 })
          try {
            const { address, locality } = await reverseGeocode(lat, lng)
            const r = { lat, lng, address, locality, location_method: 'manual' }
            setResolved(r)
            resolvedRef.current = r
          } catch {
            const r = { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, locality: '', location_method: 'manual' }
            setResolved(r)
            resolvedRef.current = r
          }
          setUiState('confirming')
        })
      } catch (err) {
        if (cancelled) return
        console.error('[ShopLocationMap] init error:', err)
        toast.error('Map failed to load. Search for your address instead.')
        if (!resolvedRef.current) setUiState('searching')
      }
    })()

    return () => {
      cancelled = true
      try { mapRef.current?.remove() } catch { /* ignore */ }
      mapRef.current   = null
      markerRef.current = null
    }
  }, [showMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function pickPrediction(pred) {
    setPredictions([])
    setSearchQuery(pred.description ?? '')
    setSearchLoading(true)
    try {
      const geo = await geocodePlace(pred.description)
      if (!geo) throw new Error('no result')
      const { locality } = await reverseGeocode(geo.lat, geo.lng).catch(() => ({ locality: '' }))
      const r = { lat: geo.lat, lng: geo.lng, address: geo.address, locality, location_method: 'search' }
      setResolved(r)
      resolvedRef.current = r
      setUiState('confirming')
      // If map is already initialised, fly straight to the new location
      if (mapRef.current && markerRef.current) {
        markerRef.current.setLngLat([geo.lng, geo.lat])
        mapRef.current.flyTo({ center: [geo.lng, geo.lat], zoom: 16, duration: 800 })
      }
    } catch {
      toast.error('Could not get location for this address. Try again.')
    } finally {
      setSearchLoading(false)
    }
  }

  function handleConfirm() {
    if (!resolved) return
    setUiState('confirmed')
    onChange({
      lat:             resolved.lat,
      lng:             resolved.lng,
      address:         resolved.address,
      locality:        resolved.locality ?? '',
      location_method: resolved.location_method,
    })
  }

  function handleChange() {
    setUiState('searching')
    setSearchQuery('')
    setPredictions([])
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* DETECTING — GPS spinner */}
      {uiState === 'detecting' && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted">
          <Loader2 size={28} className="animate-spin text-violet" />
          <p className="text-base font-medium">Detecting your location…</p>
        </div>
      )}

      {/* SEARCHING — search input + autocomplete */}
      {uiState === 'searching' && (
        <div className="relative">
          <div className={`flex items-center rounded-xl border ${error ? 'border-red' : 'border-border'} bg-surface focus-within:ring-2 focus-within:ring-violet/40 focus-within:border-violet overflow-hidden`}>
            <Search size={18} className="ml-4 text-muted flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search address or shop name…"
              className="flex-1 min-h-[52px] px-3 text-base text-ink bg-transparent focus:outline-none placeholder:text-muted"
              autoFocus
              autoComplete="off"
              aria-label="Search address"
            />
            {(searchQuery || searchLoading) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setPredictions([]) }}
                className="mr-3 text-muted hover:text-ink transition-colors p-1"
                aria-label="Clear search"
              >
                {searchLoading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <X size={16} />
                }
              </button>
            )}
          </div>

          {predictions.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-[500] top-full left-0 right-0 mt-1 bg-surface rounded-xl border border-border shadow-card overflow-hidden"
            >
              {predictions.map((p, i) => (
                <li key={i}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => pickPrediction(p)}
                    className="w-full text-left px-4 py-3 hover:bg-bg transition-colors border-b border-border last:border-0 min-h-[48px] flex flex-col justify-center"
                  >
                    <span className="text-sm font-medium text-ink truncate">
                      {p.structured_formatting?.main_text ?? p.description}
                    </span>
                    {p.structured_formatting?.secondary_text && (
                      <span className="text-xs text-muted truncate">
                        {p.structured_formatting.secondary_text}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* MAP — shown whenever resolved is non-null and not detecting */}
      <div
        ref={mapContainerRef}
        style={{ height: 280, display: showMap ? 'block' : 'none' }}
        className={`rounded-xl overflow-hidden border ${error ? 'border-red' : 'border-border'}`}
      />

      {/* "Tap the map" hint — shown during searching when map is also visible */}
      {uiState === 'searching' && resolved && (
        <p className="text-xs text-muted text-center">
          Or tap the map to place pin manually
        </p>
      )}

      {/* CONFIRMING — address card + action buttons */}
      {uiState === 'confirming' && resolved && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 p-3 bg-bg rounded-xl">
            <MapPin size={16} className="text-violet mt-0.5 flex-shrink-0" />
            <p className="text-sm text-ink leading-snug">
              {resolved.address || `${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full min-h-[52px] rounded-xl bg-violet text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-violet/90 active:bg-violet/80 transition-colors"
            >
              <Check size={18} />
              Yes, this is my shop
            </button>
            <button
              type="button"
              onClick={handleChange}
              className="w-full min-h-[44px] rounded-xl border border-border text-ink font-medium text-sm hover:bg-bg transition-colors"
            >
              Change location
            </button>
          </div>
          <p className="text-xs text-muted text-center">Or tap the map to place pin manually</p>
        </div>
      )}

      {/* CONFIRMED — green confirmation banner + change link */}
      {uiState === 'confirmed' && resolved && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3 p-3 bg-green/10 rounded-xl border border-green/20">
            <Check size={16} className="text-green mt-0.5 flex-shrink-0" />
            <p className="text-sm text-ink leading-snug">
              {resolved.address || `${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleChange}
            className="text-sm text-violet font-medium hover:text-violet/80 transition-colors min-h-[44px] text-center"
          >
            Change location
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red font-medium">{error}</p>
      )}
    </div>
  )
}
