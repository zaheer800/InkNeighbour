import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Home, Store, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Footer from '../components/Footer'
import AppNav from '../components/AppNav'
import ProviderCard from '../components/ProviderCard'

const FILTERS = ['all', 'home', 'shop']

export default function Find() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const pincode = searchParams.get('pincode') || ''
  const locality = searchParams.get('locality') || ''   // future: search by locality for shops

  const [homeShops, setHomeShops] = useState([])
  const [printShops, setPrintShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')  // 'all' | 'home' | 'shop'

  useEffect(() => {
    if (!pincode && !locality) { setLoading(false); return }

    async function fetchAll() {
      setLoading(true)

      // ── Home owners: via societies by postal_code ─────────────────────────
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

      // ── Print shops: by locality text match or postal_code area ───────────
      // Phase 1: show shops that have the same postal_code stored in shop_address
      // (a full geo-radius query is Phase 2 with PostGIS).
      // For now we fetch all active print shops and filter by pincode in their locality.
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

      // Client-side filter shops by pincode appearing in shop_address or locality
      const rawShops = shopRes.data || []
      const filtered = pincode
        ? rawShops.filter(s =>
            (s.shop_address || '').includes(pincode) ||
            (s.locality || '').includes(pincode)
          )
        : rawShops

      setPrintShops(filtered)
      setLoading(false)
    }

    fetchAll()
  }, [pincode, locality])

  const allResults = useMemo(() => {
    const home = homeShops.map(s => ({ ...s, _slug: s.societies?.slug }))
    const shop = printShops.map(s => ({ ...s, _slug: s.slug }))
    return [...home, ...shop].sort((a, b) => {
      // Active first, then by rating
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
        {/* Filter bar */}
        {!loading && allResults.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
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
                {f === 'home' && <Home size={14} />}
                {f === 'shop' && <Store size={14} />}
                {f === 'all'  && <Filter size={14} />}
                {t(`find.filter_${f}`)}
              </button>
            ))}
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
        ) : (
          displayed.map(owner => (
            <ProviderCard
              key={owner.id}
              owner={owner}
              slug={owner._slug}
              backHref={backHref}
            />
          ))
        )}
      </div>

      <Footer />
    </div>
  )
}
