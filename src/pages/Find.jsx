import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Home, Store, Filter, List, Map as MapIcon } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl       from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl     from 'leaflet/dist/images/marker-shadow.png'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/countries'
import Button from '../components/ui/Button'
import Footer from '../components/Footer'
import AppNav from '../components/AppNav'
import ProviderCard from '../components/ProviderCard'

// Fix leaflet icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

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

export default function Find() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const pincode = searchParams.get('pincode') || ''
  const locality = searchParams.get('locality') || ''

  const [homeShops, setHomeShops]       = useState([])
  const [printShops, setPrintShops]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('all')
  const [viewMode, setViewMode]         = useState('list')  // 'list' | 'map'
  const [pincodeLatLng, setPincodeLatLng] = useState(null)  // geocoded pincode centre

  // Fetch shops
  useEffect(() => {
    if (!pincode && !locality) { setLoading(false); return }

    async function fetchAll() {
      setLoading(true)

      const homeQuery = pincode
        ? supabase
            .from('owners')
            .select(`
              id, name, shop_name, status, bw_rate, color_rate, delivery_fee,
              country_code, provider_type,
              societies!inner(id, name, slug, city, state, postal_code),
              feedback(star_rating)
            `)
            .eq('provider_type', 'home')
            .eq('societies.postal_code', pincode)
            .neq('status', 'inactive')
        : Promise.resolve({ data: [] })

      const shopQuery = supabase
        .from('owners')
        .select(`
          id, name, slug, shop_name, shop_address, locality, landmark, lat, lng,
          status, bw_rate, color_rate, delivery_fee, country_code, provider_type,
          feedback(star_rating),
          delivery_fee_tiers(max_km, fee)
        `)
        .eq('provider_type', 'shop')
        .neq('status', 'inactive')
        .limit(50)

      const [homeRes, shopRes] = await Promise.all([homeQuery, shopQuery])

      setHomeShops(homeRes.data || [])

      const rawShops = shopRes.data || []
      const filtered = pincode
        ? rawShops.filter(s =>
            (s.shop_address || '').includes(pincode) ||
            (s.locality     || '').includes(pincode)
          )
        : rawShops

      setPrintShops(filtered)
      setLoading(false)
    }

    fetchAll()
  }, [pincode, locality])

  // Geocode the pincode once (lazy — only when user opens map view)
  useEffect(() => {
    if (viewMode !== 'map' || !pincode || pincodeLatLng) return

    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(pincode)}&countrycodes=in&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) {
          setPincodeLatLng([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        }
      })
      .catch(() => {})
  }, [viewMode, pincode, pincodeLatLng])

  const allResults = useMemo(() => {
    const home = homeShops.map(s => ({ ...s, _slug: s.societies?.slug }))
    const shop = printShops.map(s => ({ ...s, _slug: s.slug }))
    return [...home, ...shop].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1
      return 0
    })
  }, [homeShops, printShops])

  const displayed = useMemo(() => {
    if (filter === 'home') return allResults.filter(r => r.provider_type === 'home')
    if (filter === 'shop') return allResults.filter(r => r.provider_type === 'shop')
    return allResults
  }, [allResults, filter])

  // Map centre: first shop with coords, then pincode geocode, then India
  const mapCenter = useMemo(() => {
    const withCoords = displayed.find(r => r.lat && r.lng)
    if (withCoords) return [withCoords.lat, withCoords.lng]
    if (pincodeLatLng) return pincodeLatLng
    return INDIA_CENTER
  }, [displayed, pincodeLatLng])

  const backHref = `/find?pincode=${pincode}`

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav back="/" />

      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="font-display text-3xl font-bold">
            {t('find.title', { pincode })}
          </h1>
          {!loading && allResults.length > 0 && (
            <p className="text-white/60 text-sm mt-1">
              {t('find.result_count', { count: allResults.length })}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-4">

        {/* Toolbar: filters + view toggle */}
        {!loading && allResults.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1 -ml-0">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={[
                    'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors min-h-[40px]',
                    filter === f
                      ? 'bg-violet text-white'
                      : 'bg-surface text-muted border border-border hover:border-violet/40'
                  ].join(' ')}
                >
                  {f === 'home' && <Home  size={14} />}
                  {f === 'shop' && <Store size={14} />}
                  {f === 'all'  && <Filter size={14} />}
                  {t(`find.filter_${f}`)}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex-shrink-0 flex gap-1 bg-surface border border-border rounded-xl p-1">
              <button
                onClick={() => setViewMode('list')}
                title={t('find.view_list')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors min-h-[36px]',
                  viewMode === 'list' ? 'bg-violet text-white' : 'text-muted hover:text-ink'
                ].join(' ')}
              >
                <List size={15} />
                <span className="hidden sm:inline">{t('find.view_list')}</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                title={t('find.view_map')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors min-h-[36px]',
                  viewMode === 'map' ? 'bg-violet text-white' : 'text-muted hover:text-ink'
                ].join(' ')}
              >
                <MapIcon size={15} />
                <span className="hidden sm:inline">{t('find.view_map')}</span>
              </button>
            </div>
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
              {allResults.length > 0 ? t('find.filter_empty_desc') : t('find.empty_desc')}
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
                              className="block mt-2 bg-violet text-white text-xs font-bold text-center py-2 px-3 rounded-lg hover:bg-violet/90 transition-colors"
                            >
                              {t('find.order_cta')}
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
