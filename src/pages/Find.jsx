import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Home, Store, Filter, List, Map as MapIcon, LocateFixed } from 'lucide-react'
import { OlaMaps, defaultStyleJson } from 'olamaps-web-sdk'
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
const OLA_KEY = import.meta.env.VITE_OLA_MAPS_API_KEY

function circleFeature(centerLng, centerLat, radiusKm) {
  const pts = 64
  const coords = []
  for (let i = 0; i <= pts; i++) {
    const angle = (i / pts) * 2 * Math.PI
    const dLng = (radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angle)
    const dLat = (radiusKm / 110.574) * Math.cos(angle)
    coords.push([centerLng + dLng, centerLat + dLat])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
}

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
        // GPS mode: fetch both home owners and shops with coordinates, filter by radius client-side
        const [homeRes, shopRes] = await Promise.all([
          supabase
            .from('owners')
            .select(`
              id, name, shop_name, status, bw_rate, color_rate, delivery_fee,
              country_code, provider_type, manual_state, system_override, override_expires_at,
              lat, lng,
              societies(id, name, slug, city, state, postal_code),
              feedback(star_rating)
            `)
            .eq('provider_type', 'home')
            .eq('status', 'active')
            .not('lat', 'is', null)
            .not('lng', 'is', null)
            .limit(200),
          supabase
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
            .limit(200),
        ])

        const addDistance = rows =>
          (rows || [])
            .map(s => ({ ...s, distance_km: haversineKm(userLat, userLng, s.lat, s.lng) }))
            .filter(s => s.distance_km <= GPS_RADIUS_KM)
            .sort((a, b) => a.distance_km - b.distance_km)

        setHomeShops(addDistance(homeRes.data))
        setPrintShops(addDistance(shopRes.data))
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
      // Schedules aren't fetched in search results, so use only explicit signals.
      // manual_state null (not set) → treat as open; owner hasn't explicitly closed.
      const forcedOff = s.system_override === 'FORCED_OFF' &&
        s.override_expires_at && new Date(s.override_expires_at) > new Date()
      const isOpen = s.status === 'active' && !forcedOff && s.manual_state !== 'OFF'
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

  const mapContainerRef = useRef(null)
  const olaMapsRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (viewMode !== 'map') return

    let cancelled = false
    ;(async () => {
      await new Promise(r => requestAnimationFrame(r))
      if (cancelled || !mapContainerRef.current) return
      try {
        const ola = new OlaMaps({ apiKey: OLA_KEY })
        olaMapsRef.current = ola
        const map = await ola.init({
          style: defaultStyleJson,
          container: mapContainerRef.current,
          center: [mapCenter[1], mapCenter[0]],
          zoom: 13,
          scrollZoom: false,
          attributionControl: false,
        })
        if (cancelled) { try { map?.remove() } catch { /* ignore */ } ; return }
        mapInstanceRef.current = map

        // Wait for style before adding sources/layers
        if (!map.isStyleLoaded()) {
          await new Promise(r => map.once('load', r))
        }
        if (cancelled) return

        // User location dot in GPS mode
        if (isGpsMode && userLat && userLng) {
          const el = document.createElement('div')
          el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#FF6B35;border:3px solid white;box-shadow:0 0 0 4px rgba(255,107,53,0.3);'
          ola.addMarker({ element: el }).setLngLat([userLng, userLat]).addTo(map)
        }

        // Provider markers + popups
        for (const owner of displayed) {
          const isShop = owner.provider_type === 'shop'
          const hasCords = owner.lat && owner.lng
          const pos = hasCords
            ? [owner.lng, owner.lat]
            : pincodeLatLng ? [pincodeLatLng[1], pincodeLatLng[0]] : null
          if (!pos) continue

          const color = isShop ? '#7C3AED' : '#FF6B35'
          const el = document.createElement('div')
          el.style.cssText = `width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:rotate(-45deg);cursor:pointer;`

          const fmt = v => formatCurrency(v, owner.country_code || 'IN')
          const shopTitle = owner.shop_name || (owner.societies ? `${owner.societies.name} Print Shop` : owner.name)
          const slug = owner._slug
          const badge = isShop ? '🏪 Print Shop' : '🏠 Home Owner'
          const badgeBg = isShop ? '#ede9fe' : '#fff7ed'
          const badgeClr = isShop ? '#7C3AED' : '#FF6B35'

          const popupHtml = `<div style="min-width:180px;font-family:Inter,sans-serif;">
  <span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:100px;background:${badgeBg};color:${badgeClr};display:inline-block;margin-bottom:6px;">${badge}</span>
  <p style="font-weight:700;font-size:13px;color:#0A0A0F;line-height:1.3;margin:0 0 2px">${shopTitle}</p>
  <p style="font-size:11px;color:#6B7280;margin:0 0 8px">by ${owner.name.split(' ')[0]}</p>
  <div style="display:flex;gap:6px;font-size:11px;flex-wrap:wrap;margin-bottom:${slug ? '8' : '0'}px">
    <span style="background:#F4F3FF;padding:2px 8px;border-radius:100px;">B&amp;W ${fmt(owner.bw_rate)}/pg</span>
    <span style="background:#F4F3FF;padding:2px 8px;border-radius:100px;">Colour ${fmt(owner.color_rate)}/pg</span>
  </div>
  ${slug ? `<a href="/${slug}" data-back="1" style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #E5E7EB;padding-top:8px;font-size:12px;font-weight:600;color:#7C3AED;text-decoration:none;"><span>Order here</span><span>→</span></a>` : ''}
</div>`

          const popup = ola.addPopup({ closeButton: false, offset: 25 }).setHTML(popupHtml)
          ola.addMarker({ element: el }).setLngLat(pos).setPopup(popup).addTo(map)
        }

        // Delivery radius circles for print shops
        const circleFeatures = displayed
          .filter(o => o.provider_type === 'shop' && o.lat && o.lng && o.delivery_fee_tiers?.length)
          .map(o => circleFeature(o.lng, o.lat, Math.max(...o.delivery_fee_tiers.map(t => t.max_km))))

        if (circleFeatures.length > 0) {
          map.addSource('delivery-circles', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: circleFeatures },
          })
          map.addLayer({ id: 'delivery-circles-fill', type: 'fill', source: 'delivery-circles', paint: { 'fill-color': '#7C3AED', 'fill-opacity': 0.06 } })
          map.addLayer({ id: 'delivery-circles-stroke', type: 'line', source: 'delivery-circles', paint: { 'line-color': '#7C3AED', 'line-width': 1.5, 'line-dasharray': [4, 4], 'line-opacity': 0.5 } })
        }

        // Track back URL when a popup order link is clicked
        map.getContainer().addEventListener('click', e => {
          if (e.target.closest('[data-back]')) sessionStorage.setItem('find_back', backHref)
        })
      } catch (err) {
        console.error('[Find] map init error:', err)
      }
    })()

    return () => {
      cancelled = true
      try { mapInstanceRef.current?.remove() } catch { /* ignore */ }
      mapInstanceRef.current = null
      olaMapsRef.current = null
    }
  }, [viewMode, displayed, mapCenter, isGpsMode, userLat, userLng, pincodeLatLng, backHref]) // eslint-disable-line react-hooks/exhaustive-deps

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
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-colors min-h-[44px]',
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
                  'flex items-center justify-center px-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px]',
                  viewMode === 'list' ? 'bg-violet text-white' : 'text-muted hover:text-ink'
                ].join(' ')}
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setViewMode('map')}
                title={t('find.view_map')}
                className={[
                  'flex items-center justify-center px-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px]',
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
              <span className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Home size={14} className="text-orange flex-shrink-0" />
                <span className="font-semibold text-ink">{stats.home}</span>
                <span className="text-muted">{stats.home === 1 ? 'home printer' : 'home printers'}</span>
              </span>
            )}
            {stats.home > 0 && stats.shop > 0 && <span className="text-border flex-shrink-0">·</span>}
            {stats.shop > 0 && (
              <span className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Store size={14} className="text-violet flex-shrink-0" />
                <span className="font-semibold text-ink">{stats.shop}</span>
                <span className="text-muted">{stats.shop === 1 ? 'shop' : 'shops'}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 ml-auto flex-shrink-0 whitespace-nowrap">
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
          <div
            ref={mapContainerRef}
            className="rounded-xl overflow-hidden shadow-card h-80 sm:h-[500px]"
          />
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
