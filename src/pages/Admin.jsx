import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Clock, LogOut, MessageCircle, CheckCircle2, ArrowRight, Bell, MailCheck, MailX, Home, Store } from 'lucide-react'
import AppNav from '../components/AppNav'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../lib/countries'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Footer from '../components/Footer'

function buildWhatsAppLink(phone, shopUrl, ownerName, shopName) {
  const text = `Hi ${ownerName},\n\nYour InkNeighbour shop "${shopName}" has been approved and is ready to go live!\n\nShare this link with your neighbours:\n${shopUrl}\n\nPrint it. Drop it. Done.`
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

function buildRejectionWhatsAppLink(phone, ownerName, shopName) {
  const supportWhatsApp = import.meta.env.VITE_CONTACT_WHATSAPP
  const supportContact = supportWhatsApp ? `https://wa.me/${supportWhatsApp}` : import.meta.env.VITE_ADMIN_EMAIL
  const text = `Hi ${ownerName},\n\nWe regret to inform you that your InkNeighbour shop application for "${shopName}" has not been approved at this time.\n\nIf you have any questions, please contact us: ${supportContact}`
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export default function Admin() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const [shops, setShops] = useState([])
  const [societies, setSocieties] = useState([])
  const [stats, setStats] = useState({ jobs_today: 0, gmv_month: 0 })
  const [defaults, setDefaults] = useState({ bw: '2', color: '5', delivery: '8' })
  const [emailStatus, setEmailStatus] = useState({}) // user_id → boolean
  const [loading, setLoading] = useState(true)
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [justApproved, setJustApproved] = useState(null)
  const [justRejected, setJustRejected] = useState(null)

  const navigate = useNavigate()
  const fmt = v => formatCurrency(v, 'IN')

  useEffect(() => {
    async function loadData() {
      const [shopsRes, societiesRes, jobsRes, emailRes] = await Promise.all([
        supabase.from('owners').select(`*, societies(name, city, state, slug, postal_code)`).order('created_at', { ascending: false }),
        supabase.from('societies').select('*').order('name'),
        supabase.from('jobs').select('id, total_amount, status, created_at'),
        supabase.rpc('admin_get_owner_email_status')
      ])

      setShops(shopsRes.data || [])
      setSocieties(societiesRes.data || [])

      const statusMap = {}
      for (const row of (emailRes.data || [])) statusMap[row.user_id] = row.email_confirmed
      setEmailStatus(statusMap)

      const jobs = jobsRes.data || []
      const today = new Date().toDateString()
      const monthStart = new Date(); monthStart.setDate(1)
      setStats({
        jobs_today: jobs.filter(j => new Date(j.created_at).toDateString() === today).length,
        gmv_month: jobs.filter(j => j.status === 'delivered' && new Date(j.created_at) >= monthStart).reduce((s, j) => s + j.total_amount, 0)
      })

      const { data: config } = await supabase.from('platform_config').select('key, value')
      if (config) {
        const bw = config.find(c => c.key === 'default_bw_rate')
        const col = config.find(c => c.key === 'default_color_rate')
        const del = config.find(c => c.key === 'default_delivery_fee')
        setDefaults({
          bw:       bw  ? (parseInt(bw.value)  / 100).toString() : '2',
          color:    col ? (parseInt(col.value) / 100).toString() : '5',
          delivery: del ? (parseInt(del.value) / 100).toString() : '8'
        })
      }
      setLoading(false)
    }
    loadData()
  }, [])

  async function saveDefaults() {
    setSavingDefaults(true)
    const entries = [
      { key: 'default_bw_rate',      value: String(Math.round(parseFloat(defaults.bw)       * 100)) },
      { key: 'default_color_rate',   value: String(Math.round(parseFloat(defaults.color)    * 100)) },
      { key: 'default_delivery_fee', value: String(Math.round(parseFloat(defaults.delivery) * 100)) }
    ]
    for (const entry of entries) await supabase.from('platform_config').upsert(entry)
    setSavingDefaults(false)
    toast.success('Platform defaults saved!')
  }

  async function approveShop(shop) {
    const { error } = await supabase.from('owners').update({ status: 'active' }).eq('id', shop.id)
    if (error) { toast.error('Failed to approve shop'); return }
    const approved = { ...shop, status: 'active' }
    setShops(prev => prev.map(s => s.id === shop.id ? approved : s))
    setJustApproved(approved)
    toast.success('Shop approved!')
  }

  async function rejectShop(shop) {
    const { error } = await supabase.from('owners').update({ status: 'inactive' }).eq('id', shop.id)
    if (error) { toast.error('Failed to reject shop'); return }
    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, status: 'inactive' } : s))
    setJustRejected(shop)
    toast.success('Shop rejected.')

    // Notify owner by email
    supabase.functions.invoke('notify-owner', {
      body: {
        owner_id:          shop.id,
        type:              'rejected',
        shop_name:         shop.shop_name || shop.name,
        society_name:      shop.societies?.name || '',
        support_email:     import.meta.env.VITE_ADMIN_EMAIL,
        support_whatsapp:  import.meta.env.VITE_CONTACT_WHATSAPP || undefined,
      }
    })
  }

  const pendingCount = shops.filter(s => s.status === 'pending').length

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav wide right={
        <div className="flex items-center">
          {/* Pending approvals bell */}
          <div className="relative flex items-center justify-center min-h-[44px] w-10">
            <Bell size={18} className={pendingCount > 0 ? 'text-amber' : 'text-white/30'} />
            {pendingCount > 0 && (
              <span className="absolute top-2.5 right-1 bg-amber text-white text-[10px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                {pendingCount}
              </span>
            )}
          </div>
          <button onClick={signOut} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium min-h-[44px] px-2">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      } />

      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-xl font-bold text-ink">{t('admin.title')}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Overview stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('admin.societies'),  value: societies.length,                              href: '/admin/directory' },
            { label: t('admin.shops'),      value: shops.filter(s => s.status === 'active').length, href: '/admin/directory' },
            { label: t('admin.jobs_today'), value: stats.jobs_today,                              href: '/admin/jobs?period=today' },
            { label: t('admin.gmv'),        value: fmt(stats.gmv_month),                          href: '/admin/jobs?period=month' }
          ].map(s => (
            <button
              key={s.label}
              onClick={() => navigate(s.href)}
              className="group bg-surface rounded-xl shadow-card p-4 text-center hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98] cursor-pointer"
            >
              <p className="font-display text-3xl font-black text-ink group-hover:text-violet transition-colors">{s.value}</p>
              <p className="text-sm text-muted mt-1">{s.label}</p>
            </button>
          ))}
        </div>

        {/* ── Just-approved send link card ── */}
        {justApproved && (
          <div className="bg-green/10 border border-green/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={22} className="text-green shrink-0" />
              <div>
                <p className="font-bold text-ink">{justApproved.shop_name || justApproved.name} — approved!</p>
                <p className="text-sm text-muted">Now send the shop link to {justApproved.name} via WhatsApp.</p>
              </div>
            </div>
            {justApproved.phone && (justApproved.slug || justApproved.societies?.slug) && (
              <a
                href={buildWhatsAppLink(
                  justApproved.phone,
                  `${window.location.origin}/${justApproved.slug || justApproved.societies?.slug}`,
                  justApproved.name,
                  justApproved.shop_name || justApproved.name
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green text-white font-bold rounded-xl py-3 px-4 text-sm hover:bg-green/90 transition-colors min-h-[48px]"
              >
                <MessageCircle size={18} /> Send via WhatsApp
              </a>
            )}
            <button onClick={() => setJustApproved(null)} className="w-full text-xs text-muted hover:text-ink transition-colors min-h-[36px]">
              Dismiss
            </button>
          </div>
        )}

        {/* ── Just-rejected send notification card ── */}
        {justRejected && (
          <div className="bg-red/10 border border-red/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red/20 flex items-center justify-center shrink-0">
                <span className="text-red font-black text-sm">✕</span>
              </div>
              <div>
                <p className="font-bold text-ink">{justRejected.shop_name || justRejected.name} — rejected</p>
                <p className="text-sm text-muted">An email has been sent to the owner. You can also notify them on WhatsApp.</p>
              </div>
            </div>
            {justRejected.phone && (
              <a
                href={buildRejectionWhatsAppLink(justRejected.phone, justRejected.name, justRejected.shop_name || justRejected.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-red text-white font-bold rounded-xl py-3 px-4 text-sm hover:bg-red/90 transition-colors min-h-[48px]"
              >
                <MessageCircle size={18} /> Notify via WhatsApp
              </a>
            )}
            <button onClick={() => setJustRejected(null)} className="w-full text-xs text-muted hover:text-ink transition-colors min-h-[36px]">
              Dismiss
            </button>
          </div>
        )}

        {/* ── Pending approvals ── */}
        {shops.filter(s => s.status === 'pending').length > 0 && (
          <div className="bg-amber/10 border border-amber/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Clock size={22} className="text-amber" />
              <h2 className="font-bold text-xl text-ink">{t('admin.pending_approvals')}</h2>
              <span className="bg-amber text-white text-sm font-bold px-2.5 py-0.5 rounded-pill">
                {shops.filter(s => s.status === 'pending').length}
              </span>
            </div>
            <div className="space-y-3">
              {shops.filter(s => s.status === 'pending').map(shop => {
                const isShop   = shop.provider_type === 'shop'
                const shopSlug = isShop ? shop.slug : shop.societies?.slug
                const shopUrl  = shopSlug ? `${window.location.origin}/${shopSlug}` : null
                const location = isShop
                  ? [shop.locality, shop.shop_address].filter(Boolean).join(' · ')
                  : [shop.societies?.name, shop.societies?.city].filter(Boolean).join(' · ')
                return (
                  <div key={shop.id} className="bg-surface rounded-xl p-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-ink">{shop.shop_name || shop.name}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isShop ? 'bg-violet/10 text-violet' : 'bg-orange/10 text-orange'
                        }`}>
                          {isShop ? <><Store size={10} />Print Shop</> : <><Home size={10} />Home Owner</>}
                        </span>
                      </div>
                      {location && <p className="text-sm text-muted">{location}</p>}
                      <p className="text-sm text-ink font-medium">{shop.name} · {shop.phone}</p>
                      {shop.societies?.postal_code && (
                        <p className="text-xs text-muted">Pincode: {shop.societies.postal_code}</p>
                      )}
                      <p className="text-xs text-muted">
                        Applied {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(shop.created_at))}
                      </p>
                      {shop.user_id && emailStatus[shop.user_id] === true && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-green bg-green/10 px-2 py-1 rounded-lg w-fit">
                          <MailCheck size={13} /> Email verified
                        </div>
                      )}
                      {shop.user_id && emailStatus[shop.user_id] === false && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber bg-amber/10 px-2 py-1 rounded-lg w-fit">
                          <MailX size={13} /> Email not verified
                        </div>
                      )}
                    </div>

                    {/* Rate details */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
                      {[
                        { label: 'B&W/pg',   value: fmt(shop.bw_rate) },
                        { label: 'Colour/pg', value: fmt(shop.color_rate) },
                        { label: 'Delivery',  value: shop.delivery_fee > 0 ? fmt(shop.delivery_fee) : 'Free' }
                      ].map(r => (
                        <div key={r.label} className="text-center">
                          <p className="text-xs text-muted">{r.label}</p>
                          <p className="text-sm font-bold text-ink">{r.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Payment methods */}
                    <div className="flex gap-2 text-xs">
                      {shop.upi_id && <span className="bg-violet/10 text-violet px-2 py-1 rounded-lg font-medium">UPI: {shop.upi_id}</span>}
                      {shop.accept_cash && <span className="bg-green/10 text-green px-2 py-1 rounded-lg font-medium">Cash accepted</span>}
                    </div>

                    {shopUrl && (
                      <p className="text-xs text-muted font-mono break-all">{shopUrl}</p>
                    )}
                    {isShop && shop.lat && shop.lng && (
                      <p className="text-xs text-muted">📍 {shop.lat.toFixed(4)}, {shop.lng.toFixed(4)}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 border-t border-border">
                      <Button size="sm" onClick={() => approveShop(shop)} className="flex-1">{t('admin.approve')}</Button>
                      <Button size="sm" variant="danger" onClick={() => rejectShop(shop)} className="flex-1">{t('admin.reject')}</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Platform defaults */}
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
          <h2 className="font-bold text-xl text-ink">{t('admin.defaults')}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Input label={t('admin.bw_default') + ' (₹/page)'}    type="number" value={defaults.bw}       onChange={e => setDefaults(d => ({ ...d, bw: e.target.value }))}       min="0" step="0.5" />
            <Input label={t('admin.color_default') + ' (₹/page)'}  type="number" value={defaults.color}    onChange={e => setDefaults(d => ({ ...d, color: e.target.value }))}    min="0" step="0.5" />
            <Input label={t('admin.delivery_default') + ' (₹)'}    type="number" value={defaults.delivery} onChange={e => setDefaults(d => ({ ...d, delivery: e.target.value }))} min="0" step="1" />
          </div>
          <Button onClick={saveDefaults} loading={savingDefaults} size="sm">{t('admin.save_defaults')}</Button>
        </div>

        {/* Directory link */}
        <Link
          to="/admin/directory"
          className="flex items-center justify-between bg-surface rounded-xl shadow-card p-5 hover:shadow-md transition-shadow group"
        >
          <div>
            <p className="font-bold text-lg text-ink">Shops & Societies</p>
            <p className="text-sm text-muted mt-0.5">
              {shops.filter(s => s.status !== 'pending').length} shops · {societies.length} societies
            </p>
          </div>
          <ArrowRight size={20} className="text-muted group-hover:text-violet transition-colors" />
        </Link>

      </div>
      <Footer />
    </div>
  )
}
