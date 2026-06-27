import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Home, Store, Filter, List, Map as MapIcon, LocateFixed } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl       from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl     from 'leaflet/dist/images/marker-shadow.png'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/countries'
import { getEffectiveState, resolveNextAvailable } from '../lib/availability'
import Button from '../components/ui/Button'
import Footer from '../components/Footer'
import AppNav from '../components/AppNav'
import ProviderCard from '../components/ProviderCard'

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const GPS_RADIUS_KM = 5

// Fix leaflet icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

// User location pulse icon for GPS mode
const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#FF6B35;border:3px solid white;
    box-shadow:0 0 0 4px rgba(255,107,53,0.3);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

// Custom div icons for map pins
const makeIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:${color};border:2px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
  "></div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
  popupAnchor:[0, -30],
})

const homeIcon = makeIcon('#FF6B35')   // orange
const shopIcon = makeIcon('#7C3AED')   // violet

const FILTERS = ['all', 'home', 'shop']
const INDIA_CENTER = [20.5937, 78.9629]
const PINCODE_RADIUS_KM = 5

async function geocodePincode(pincode) {
  if (!pincode) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(pincode)}&countrycodes=in&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { /* silent */ }
  return null
}

export default function Find() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const pincode = searchParams.get('pincode') || ''
  const locality = searchParams.get('locality') || ''
  const rawLat = searchParams.get('lat')
  const rawLng = searchParams.get('lng')
  const userLat = rawLat ? parseFloat(rawLat) : null
  const userLng = rawLng ? parseFloat(rawLng) : null
  const isGpsMode = Boolean(userLat && userLng)

  const [homeShops, setHomeShops]       = useState([])
  const [printShops, setPrintShops]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('all')
  const [viewMode, setViewMode]         = useState('list')  // 'list' | 'map'
  const [pincodeLatLng, setPincodeLatLng] = useState(null)  // geocoded pincode centre

  // Fetch shops
  useEffect(() => {
    if (!pincode && !locality && !isGpsMode) { setLoading(false); return }

    async function fetchAll() {
      setLoading(true)

      if (isGpsMode) {
        // GPS mode: fetch all active shops with coordinates, filter by radius client-side
        const { data: shops } = await supabase
          .from('owners')
          .select(`
            id, name, slug, shop_name, shop_address, locality, landmark, lat, lng,
            status, bw_rate, color_rate, delivery_fee, country_code, provider_type,
            manual_state, system_override, override_expires_at,
            feedback(star_rating),
            delivery_fee_tiers(max_km, fee)
          `)
          .eq('provider_type', 'shop')
          .eq('status', 'active')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .limit(200)

        const nearby = (shops || [])
          .map(s => ({ ...s, distance_km: haversineKm(userLat, userLng, s.lat, s.lng) }))
          .filter(s => s.distance_km <= GPS_RADIUS_KM)
          .sort((a, b) => a.distance_km - b.distance_km)

        setHomeShops([])
        setPrintShops(nearby)
        setLoading(false)
        return
      }

      // Pincode/locality mode — run home query, shop query, and pincode geocode in parallel
      const homeQuery = pincode
        ? supabase
            .from('owners')
            .select(`
              id, name, shop_name, status, bw_rate, color_rate, delivery_fee,
              country_code, provider_type, manual_state, system_override, override_expires_at,
              societies!inner(id, name, slug, city, state, postal_code),
              feedback(star_rating)
            `)
            .eq('provider_type', 'home')
            .eq('societies.postal_code', pincode)
            .eq('status', 'active')
        : Promise.resolve({ data: [] })

      const shopQuery = supabase
        .from('owners')
        .select(`
          id, name, slug, shop_name, shop_address, locality, landmark, lat, lng,
          status, bw_rate, color_rate, delivery_fee, country_code, provider_type,
          manual_state, system_override, override_expires_at,
          feedback(star_rating),
          delivery_fee_tiers(max_km, fee)
        `)
        .eq('provider_type', 'shop')
        .eq('status', 'active')
        .limit(100)

      const [homeRes, shopRes, pincodeCenter] = await Promise.all([
        homeQuery,
        shopQuery,
        geocodePincode(pincode),
      ])

      if (pincodeCenter) setPincodeLatLng([pincodeCenter.lat, pincodeCenter.lng])

      setHomeShops(homeRes.data || [])

      const rawShops = shopRes.data || []

      // Primary: proximity search using geocoded pincode centre (works even when
      // shop_address pincode differs from the searched pincode due to geocoding drift).
      // Fallback: text match in shop_address/locality for shops without coordinates.
      const filteredShops = rawShops
        .map(s => {
          const hasCoords = s.lat != null && s.lng != null
          const distKm = hasCoords && pincodeCenter
            ? haversineKm(pincodeCenter.lat, pincodeCenter.lng, s.lat, s.lng)
            : null
          return { ...s, _distKm: distKm }
        })
        .filter(s => {
          if (s._distKm != null) return s._distKm <= PINCODE_RADIUS_KM
          if (!pincode) return true
          return (s.shop_address || '').includes(pincode) || (s.locality || '').includes(pincode)
        })
        .sort((a, b) => {
          if (a._distKm != null && b._distKm != null) return a._distKm - b._distKm
          if (a._distKm != null) return -1
          if (b._distKm != null) return 1
          return 0
        })
        .map(({ _distKm, ...s }) => _distKm != null ? { ...s, distance_km: _distKm } : s)

      setPrintShops(filteredShops)
      setLoading(false)
    }

    fetchAll()
  }, [pincode, locality, isGpsMode, userLat, userLng])


  const allResults = useMemo(() => {
    const enrich = (s, slug) => {
      const isOpen = s.status === 'active' && getEffectiveState(s, []) === 'AVAILABLE'
      const nextAvailable = isOpen ? null : resolveNextAvailable(s, [])
      return { ...s, _slug: slug, isOpen, nextAvailable }
    }
    const home = homeShops.map(s => enrich(s, s.societies?.slug))
    const shop = printShops.map(s => enrich(s, s.slug))
    return [...home, ...shop].sort((a, b) => {
      // Open (accepting orders) first
      if (a.isOpen && !b.isOpen) return -1
      if (!a.isOpen && b.isOpen) return 1
      // Then nearest first (GPS and pincode geocode modes)
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km
      return 0
    })
  }, [homeShops, printShops])

  const displayed = useMemo(() => {
    if (filter === 'home') return allResults.filter(r => r.provider_type === 'home')
    if (filter === 'shop') return allResults.filter(r => r.provider_type === 'shop')
    return allResults
  }, [allResults, filter])

  const stats = useMemo(() => {
    if (!allResults.length) return null
    return {
      home:    allResults.filter(r => r.provider_type === 'home').length,
      shop:    allResults.filter(r => r.provider_type === 'shop').length,
      openNow: allResults.filter(r => r.isOpen).length,
    }
  }, [allResults])

  // Map centre: GPS user location > first result with coords > pincode geocode > India
  const mapCenter = useMemo(() => {
    if (isGpsMode && userLat && userLng) return [userLat, userLng]
    const withCoords = displayed.find(r => r.lat && r.lng)
    if (withCoords) return [withCoords.lat, withCoords.lng]
    if (pincodeLatLng) return pincodeLatLng
    return INDIA_CENTER
  }, [displayed, pincodeLatLng, isGpsMode, userLat, userLng])

  const backHref = isGpsMode
    ? `/find?lat=${userLat}&lng=${userLng}`
    : `/find?pincode=${pincode}`

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav back="/" />

      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="font-display text-3xl font-bold">
            {isGpsMode
              ? <span className="flex items-center gap-2"><LocateFixed size={24} className="text-orange" /> Printers near you</span>
              : t('find.title', { pincode })
            }
          </h1>
          {!loading && allResults.length > 0 && (
            <p className="text-white/60 text-sm mt-1">
              {isGpsMode
                ? `${allResults.length} printer${allResults.length !== 1 ? 's' : ''} within ${GPS_RADIUS_KM} km`
                : t('find.result_count', { count: allResults.length })
              }
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-4">

        {/* Toolbar: filters + view toggle */}
        {!loading && allResults.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Filter pills */}
            <div className="flex gap-2 flex-1">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-colors min-h-[40px]',
                    filter === f
                      ? 'bg-violet text-white'
                      : 'bg-surface text-muted border border-border hover:border-violet/40'
                  ].join(' ')}
                >
                  {f === 'home' && <Home  size={13} />}
                  {f === 'shop' && <Store size={13} />}
                  {f === 'all'  && <Filter size={13} />}
                  {t(`find.filter_short_${f}`)}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex-shrink-0 flex gap-1 bg-surface border border-border rounded-xl p-1">
              <button
                onClick={() => setViewMode('list')}
                title={t('find.view_list')}
                className={[
                  'flex items-center justify-center px-2.5 rounded-lg transition-colors min-h-[36px] min-w-[36px]',
                  viewMode === 'list' ? 'bg-violet text-white' : 'text-muted hover:text-ink'
                ].join(' ')}
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setViewMode('map')}
                title={t('find.view_map')}
                className={[
                  'flex items-center justify-center px-2.5 rounded-lg transition-colors min-h-[36px] min-w-[36px]',
                  viewMode === 'map' ? 'bg-violet text-white' : 'text-muted hover:text-ink'
                ].join(' ')}
              >
                <MapIcon size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Directory stats bar */}
        {!loading && stats && (
          <div className="flex items-center gap-3 text-sm bg-surface rounded-xl px-4 py-3 shadow-card">
            {stats.home > 0 && (
              <span className="flex items-center gap-1.5">
                <Home size={14} className="text-orange flex-shrink-0" />
                <span className="font-semibold text-ink">{stats.home}</span>
                <span className="text-muted">{stats.home === 1 ? 'home printer' : 'home printers'}</span>
              </span>
            )}
            {stats.home > 0 && stats.shop > 0 && <span className="text-border">·</span>}
            {stats.shop > 0 && (
              <span className="flex items-center gap-1.5">
                <Store size={14} className="text-violet flex-shrink-0" />
                <span className="font-semibold text-ink">{stats.shop}</span>
                <span className="text-muted">{stats.shop === 1 ? 'shop' : 'shops'}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 ml-auto flex-shrink-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stats.openNow > 0 ? 'bg-green' : 'bg-muted/40'}`} />
              <span className={`font-semibold ${stats.openNow > 0 ? 'text-green' : 'text-muted'}`}>
                {stats.openNow > 0 ? `${stats.openNow} open now` : 'None open now'}
              </span>
            </span>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <p className="text-center text-muted py-12">{t('find.loading')}</p>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-muted/10 rounded-xl flex items-center justify-center mx-auto">
              <Printer size={32} className="text-muted" />
            </div>
            <h2 className="font-bold text-xl text-ink">
              {allResults.length > 0 ? t('find.filter_empty') : t('find.empty_title')}
            </h2>
            <p className="text-muted">
              {allResults.length > 0
                ? t('find.filter_empty_desc')
                : isGpsMode
                  ? `No print shops found within ${GPS_RADIUS_KM} km of your location.`
                  : t('find.empty_desc')
              }
            </p>
            {allResults.length === 0 && (
              <Link to="/register">
                <Button className="mt-2">{t('nav.register')}</Button>
              </Link>
            )}
          </div>
        ) : viewMode === 'list' ? (
          displayed.map(owner => (
            <ProviderCard
              key={owner.id}
              owner={owner}
              slug={owner._slug}
              backHref={backHref}
              distanceKm={owner.distance_km ?? undefined}
              isOpen={owner.isOpen}
              nextAvailable={owner.nextAvailable}
            />
          ))
        ) : (
          /* ── Map view ────────────────────────────────────────────────── */
          <div className="rounded-xl overflow-hidden shadow-card" style={{ height: '500px' }}>
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              />

              {/* User location marker in GPS mode */}
              {isGpsMode && userLat && userLng && (
                <Marker position={[userLat, userLng]} icon={userIcon}>
                  <Popup><p className="text-sm font-semibold">Your location</p></Popup>
                </Marker>
              )}

              {displayed.map(owner => {
                const isShop = owner.provider_type === 'shop'
                const hasCords = owner.lat && owner.lng
                const position = hasCords
                  ? [owner.lat, owner.lng]
                  : (pincodeLatLng || null)

                if (!position) return null

                const fmt = v => formatCurrency(v, owner.country_code || 'IN')
                const shopTitle = owner.shop_name || (owner.societies ? `${owner.societies.name} Print Shop` : owner.name)

                // Delivery radius for print shops: max tier distance in metres
                const radiusM = isShop && owner.delivery_fee_tiers?.length
                  ? Math.max(...owner.delivery_fee_tiers.map(t => t.max_km)) * 1000
                  : null

                return (
                  <span key={owner.id}>
                    <Marker
                      position={position}
                      icon={isShop ? shopIcon : homeIcon}
                    >
                      <Popup minWidth={200}>
                        <div className="space-y-1.5 py-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                              isShop ? 'bg-violet/15 text-violet' : 'bg-orange/15 text-orange'
                            }`}>
                              {isShop ? '🏪 Print Shop' : '🏠 Home Owner'}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-ink leading-tight">{shopTitle}</p>
                          <p className="text-xs text-muted">by {owner.name.split(' ')[0]}</p>
                          <div className="flex gap-2 text-xs">
                            <span className="bg-bg px-2 py-0.5 rounded-full">B&W {fmt(owner.bw_rate)}/pg</span>
                            <span className="bg-bg px-2 py-0.5 rounded-full">Colour {fmt(owner.color_rate)}/pg</span>
                          </div>
                          {owner._slug && (
                            <Link
                              to={`/${owner._slug}`}
                              onClick={() => sessionStorage.setItem('find_back', backHref)}
                              className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs font-semibold text-violet hover:text-violet/70 transition-colors"
                            >
                              <span>{isShop ? t('find.order_cta') : t('find.order_home_cta')}</span>
                              <span>→</span>
                            </Link>
                          )}
                        </div>
                      </Popup>
                    </Marker>

                    {/* Delivery radius circle for print shops */}
                    {isShop && radiusM && hasCords && (
                      <Circle
                        center={position}
                        radius={radiusM}
                        pathOptions={{
                          color:     '#7C3AED',
                          fillColor: '#7C3AED',
                          fillOpacity: 0.06,
                          weight: 1.5,
                          dashArray: '4 4',
                        }}
                      />
                    )}
                  </span>
                )
              })}
            </MapContainer>
          </div>
        )}

        {/* Map legend */}
        {viewMode === 'map' && !loading && allResults.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted bg-surface rounded-xl px-4 py-2.5 shadow-card">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange inline-block" />
              {t('find.badge_home')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-violet inline-block" />
              {t('find.badge_shop')}
            </span>
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="w-4 border-t-2 border-dashed border-violet/50 inline-block" />
              {t('find.delivery_radius')}
            </span>
          </div>
        )}

      </div>

      <Footer />
    </div>
  )
}
