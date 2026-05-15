import { useState, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { MapPin, Search, Locate, X } from 'lucide-react'
import { toast } from 'sonner'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Vite/Leaflet default marker icon path issue
import markerIconPng from 'leaflet/dist/images/marker-icon.png'
import markerIcon2xPng from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIcon2xPng,
  shadowUrl: markerShadowPng,
})

const INDIA_CENTER = [20.5937, 78.9629]
const DEFAULT_ZOOM  = 5
const PIN_ZOOM      = 15
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'info@zakapedia.in'

// Child component — flies the map to new coordinates without remounting
function MapFlyTo({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], PIN_ZOOM, { animate: true, duration: 0.8 })
    }
  }, [lat, lng, map])
  return null
}

/**
 * ShopLocationMap — Leaflet map with Nominatim geocoding and a draggable pin.
 * Used in print shop registration (Step 2) and dashboard settings.
 *
 * Props:
 *   lat       number | null    current pin latitude
 *   lng       number | null    current pin longitude
 *   onChange  ({ lat, lng }) => void   called after drag, geocode, or geolocation
 *   error     string | undefined       validation message shown below map
 */
export default function ShopLocationMap({ lat, lng, onChange, error }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [geolocating, setGeolocating] = useState(false)
  const inputRef = useRef(null)

  const hasPin = lat != null && lng != null

  // ── Nominatim geocoding ──────────────────────────────────────────────────
  async function geocode() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setResults([])
    try {
      const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(q)}&limit=5&email=${NOMINATIM_EMAIL}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      if (!res.ok) throw new Error('Nominatim error')
      const data = await res.json()
      setResults(data)
    } catch {
      toast.error('Address search failed. Try again or drag the pin manually.')
    } finally {
      setSearching(false)
    }
  }

  function pickResult(result) {
    onChange({
      lat: parseFloat(parseFloat(result.lat).toFixed(7)),
      lng: parseFloat(parseFloat(result.lon).toFixed(7)),
    })
    setResults([])
    setQuery(result.display_name.split(',').slice(0, 3).join(', '))
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  // ── Browser geolocation ──────────────────────────────────────────────────
  function handleGeolocate() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.')
      return
    }
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: parseFloat(pos.coords.latitude.toFixed(7)),
          lng: parseFloat(pos.coords.longitude.toFixed(7)),
        })
        setGeolocating(false)
      },
      () => {
        toast.error("Could not get your location. Please search or pin manually.")
        setGeolocating(false)
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  // ── Marker drag ──────────────────────────────────────────────────────────
  function handleDragEnd(e) {
    const { lat: newLat, lng: newLng } = e.target.getLatLng()
    onChange({
      lat: parseFloat(newLat.toFixed(7)),
      lng: parseFloat(newLng.toFixed(7)),
    })
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Search bar */}
      <div className="relative">
        <div className={`flex rounded-xl border overflow-hidden focus-within:ring-2 focus-within:ring-violet/40 focus-within:border-violet ${error ? 'border-red' : 'border-border'}`}>
          <div className="relative flex-1 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && geocode()}
              placeholder="Search address to drop a pin…"
              className={`w-full min-h-[52px] pl-4 text-base text-ink bg-surface focus:outline-none placeholder:text-muted ${query ? 'pr-8' : 'pr-4'}`}
              aria-label="Search address"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 text-muted hover:text-ink transition-colors p-1"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={geocode}
            disabled={searching || !query.trim()}
            className="shrink-0 whitespace-nowrap px-4 bg-violet text-white min-h-[52px] flex items-center gap-2 text-sm font-semibold hover:bg-violet/90 transition-colors disabled:opacity-50"
            aria-label="Search"
          >
            <Search size={16} />
            <span className="hidden sm:inline">{searching ? 'Searching…' : 'Search'}</span>
          </button>
        </div>

        {/* Nominatim results dropdown */}
        {results.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-[1000] top-full left-0 right-0 mt-1 bg-surface rounded-xl border border-border shadow-card overflow-hidden"
          >
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  role="option"
                  onClick={() => pickResult(r)}
                  className="w-full text-left px-4 py-3 text-sm text-ink hover:bg-bg transition-colors border-b border-border last:border-0 min-h-[48px]"
                >
                  <span className="font-medium">{r.display_name.split(',')[0]}</span>
                  <span className="text-muted ml-1 text-xs">
                    {r.display_name.split(',').slice(1, 3).join(',')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Use my location button */}
      <button
        type="button"
        onClick={handleGeolocate}
        disabled={geolocating}
        className="flex items-center gap-2 text-sm font-semibold text-violet hover:text-violet/80 transition-colors min-h-[48px] disabled:opacity-50"
      >
        <Locate size={16} />
        {geolocating ? 'Getting location…' : '📍 Use my current location'}
      </button>

      {/* Map */}
      <div className={`rounded-xl overflow-hidden border ${error ? 'border-red' : 'border-border'}`} style={{ height: 280 }}>
        <MapContainer
          center={hasPin ? [lat, lng] : INDIA_CENTER}
          zoom={hasPin ? PIN_ZOOM : DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {hasPin && (
            <>
              <MapFlyTo lat={lat} lng={lng} />
              <Marker
                position={[lat, lng]}
                draggable
                eventHandlers={{ dragend: handleDragEnd }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Status row */}
      {hasPin ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <MapPin size={14} className="text-violet flex-shrink-0" />
          <span>
            Pin set · {lat.toFixed(5)}, {lng.toFixed(5)} ·{' '}
            <span className="text-ink/70">Drag the pin to adjust</span>
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted">
          <MapPin size={14} className="flex-shrink-0" />
          <span>No pin set — search an address or use your location</span>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
