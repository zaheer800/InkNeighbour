import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Search, X, MessageCircle, ChevronLeft, LogOut, RefreshCw, Home, Store, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../lib/countries'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import AppNav from '../components/AppNav'
import Footer from '../components/Footer'

const STATUS_FILTERS = ['all', 'pending', 'active', 'paused', 'inactive']
const STATUS_LABELS  = { all: 'All', pending: 'Pending', active: 'Active', paused: 'Paused', inactive: 'Inactive' }
const TYPE_FILTERS   = ['all', 'home', 'shop']
const TYPE_LABELS    = { all: 'All types', home: 'Home Owners', shop: 'Print Shops' }
const PAGE_SIZE = 20

function buildWhatsAppLink(phone, shopUrl, ownerName, shopName) {
  const text = `Hi ${ownerName},\n\nYour InkNeighbour shop "${shopName}" is live!\n\nShare this link with your neighbours:\n${shopUrl}\n\nPrint it. Drop it. Done.`
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export default function AdminDirectory() {
  const { signOut } = useAuth()
  const [shops, setShops] = useState([])
  const [societies, setSocieties] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [shopSearch, setShopSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [shopPage, setShopPage] = useState(1)

  const fmt = v => formatCurrency(v, 'IN')

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    const [shopsRes, societiesRes] = await Promise.all([
      supabase.from('owners').select(`*, societies(name, city, state, slug, postal_code), feedback(star_rating)`).order('created_at', { ascending: false }),
      supabase.from('societies').select('*').order('name')
    ])

    if (shopsRes.error) {
      toast.error('Could not load shops: ' + shopsRes.error.message)
    } else {
      setShops(shopsRes.data || [])
    }

    if (societiesRes.error) {
      toast.error('Could not load societies: ' + societiesRes.error.message)
    } else {
      setSocieties(societiesRes.data || [])
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateShopStatus(shopId, status) {
    const { error } = await supabase.from('owners').update({ status }).eq('id', shopId)
    if (error) { toast.error('Failed to update shop'); return }
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, status } : s))
    toast.success(`Shop ${status === 'active' ? 'reactivated' : 'deactivated'}`)
  }

  function getAvgRating(shop) {
    const fb = shop.feedback || []
    if (fb.length < 3) return null
    return fb.reduce((s, f) => s + f.star_rating, 0) / fb.length
  }

  const filtered = shops.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (typeFilter !== 'all' && (s.provider_type || 'home') !== typeFilter) return false
    if (shopSearch && ![s.shop_name, s.name, s.phone, s.societies?.name, s.localities, s.societies?.city]
      .some(v => v?.toLowerCase().includes(shopSearch.toLowerCase()))) return false
    return true
  })
  const visible = filtered.slice(0, shopPage * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden">
      <AppNav
        wide
        left={
          <Link to="/admin" className="flex items-center gap-1 text-white font-semibold text-base min-h-[44px] pr-2">
            <ChevronLeft size={22} />
            <span className="font-display font-black text-[18px] tracking-tight">
              Ink<span className="text-orange">Neighbour</span>
            </span>
          </Link>
        }
        right={
          <div className="flex items-center">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              title="Refresh"
              className="flex items-center justify-center min-h-[44px] w-10 text-white/50 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={signOut} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium min-h-[44px] px-2">
              <LogOut size={18} /> Sign out
            </button>
          </div>
        }
      />

      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2">
        <h1 className="font-display text-2xl font-bold text-ink">Shops & Societies</h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* ── All Shops ── */}
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-ink">All Shops</h2>
            <span className="text-sm text-muted">
              {shops.length} registered
            </span>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={shopSearch}
                onChange={e => { setShopSearch(e.target.value); setShopPage(1) }}
                placeholder="Search by shop name, owner or society..."
                className="w-full pl-9 pr-9 py-3 rounded-xl border border-border text-base text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet min-h-[48px]"
              />
              {shopSearch && (
                <button onClick={() => { setShopSearch(''); setShopPage(1) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => { setStatusFilter(f); setShopPage(1) }}
                  className={['px-4 py-1.5 rounded-pill text-sm font-semibold transition-colors min-h-[36px]', statusFilter === f ? 'bg-violet text-white' : 'bg-bg text-muted hover:bg-border'].join(' ')}
                >
                  {STATUS_LABELS[f]}
                  <span className="ml-1.5 opacity-60">({shops.filter(s => f === 'all' || s.status === f).length})</span>
                </button>
              ))}
            </div>

            {/* Provider type filter */}
            <div className="flex gap-2 flex-wrap">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => { setTypeFilter(f); setShopPage(1) }}
                  className={['px-3 py-1.5 rounded-pill text-sm font-semibold transition-colors min-h-[36px] flex items-center gap-1.5',
                    typeFilter === f ? 'bg-orange text-white' : 'bg-bg text-muted hover:bg-border'].join(' ')}
                >
                  {f === 'home' && <Home size={12} />}
                  {f === 'shop' && <Store size={12} />}
                  {TYPE_LABELS[f]}
                  <span className="opacity-60">({shops.filter(s => f === 'all' || (s.provider_type || 'home') === f).length})</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-muted text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted text-center py-8">
              {shopSearch ? 'No shops match your search.' : 'No shops found.'}
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map(shop => {
                const isShop   = (shop.provider_type || 'home') === 'shop'
                const shopSlug = isShop ? shop.slug : shop.societies?.slug
                const shopUrl  = shopSlug ? `${window.location.origin}/${shopSlug}` : null
                const location = isShop
                  ? [shop.locality, shop.shop_address].filter(Boolean).join(' · ')
                  : [shop.societies?.name, shop.societies?.city].filter(Boolean).join(' · ')

                const avgRating = getAvgRating(shop)
                const isLowRating = avgRating !== null && avgRating < 3.5

                return (
                  <div key={shop.id} className={`p-4 bg-bg rounded-xl border ${isLowRating ? 'border-amber/40' : 'border-transparent'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-ink">{shop.shop_name || shop.name}</p>
                          <Badge status={shop.status} />
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isShop ? 'bg-violet/10 text-violet' : 'bg-orange/10 text-orange'
                          }`}>
                            {isShop ? <><Store size={10} />Shop</> : <><Home size={10} />Home</>}
                          </span>
                          {isLowRating && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber/10 text-amber">
                              <AlertTriangle size={10} /> {avgRating.toFixed(1)}★
                            </span>
                          )}
                        </div>
                        {location && <p className="text-sm text-muted">{location}</p>}
                        <p className="text-xs text-muted">{shop.name} · {shop.phone}</p>
                        {shop.societies?.postal_code && <p className="text-xs text-muted">Pincode: {shop.societies.postal_code}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted pt-0.5">
                          <span>B&W {fmt(shop.bw_rate)}/pg</span>
                          <span>Colour {fmt(shop.color_rate)}/pg</span>
                          {!isShop && <span>Delivery {shop.delivery_fee > 0 ? fmt(shop.delivery_fee) : 'Free'}</span>}
                        </div>
                        {shopUrl && <p className="font-mono text-xs text-muted break-all">{shopUrl}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {shop.status === 'active' && shopUrl && (
                          <a
                            href={buildWhatsAppLink(shop.phone, shopUrl, shop.name, shop.shop_name || shop.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Send shop link via WhatsApp"
                            className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] bg-green/10 text-green rounded-lg hover:bg-green/20 transition-colors"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                        {shop.status === 'active' ? (
                          <Button variant="danger" size="xs" onClick={() => updateShopStatus(shop.id, 'inactive')}>Off</Button>
                        ) : (
                          <Button size="xs" onClick={() => updateShopStatus(shop.id, 'active')}>On</Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {hasMore && (
                <button onClick={() => setShopPage(p => p + 1)} className="w-full py-3 text-violet font-semibold text-sm hover:text-violet/70 transition-colors">
                  Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Societies ── */}
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-ink">Societies</h2>
            <span className="text-sm text-muted">{societies.length} registered</span>
          </div>
          {loading ? (
            <p className="text-muted text-center py-6">Loading...</p>
          ) : societies.length === 0 ? (
            <p className="text-muted text-center py-6">No societies yet.</p>
          ) : (
            <div className="space-y-2">
              {societies.map(s => (
                <div key={s.id} className="p-3 bg-bg rounded-xl text-sm">
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-muted">{s.city}{s.state ? `, ${s.state}` : ''} · {s.postal_code}</p>
                  <p className="font-mono text-xs text-muted break-all">{s.slug}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      <Footer />
    </div>
  )
}
