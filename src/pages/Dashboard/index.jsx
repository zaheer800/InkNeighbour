import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell, RefreshCw, ToggleLeft, ToggleRight,
  Flame, Lock, Clock, LogOut, MessageCircle,
  CheckCircle, Printer, Copy, ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useOwner } from '../../hooks/useOwner'
import { useJobs } from '../../hooks/useJobs'
import { useReliability } from '../../hooks/useReliability'
import JobCard from '../../components/JobCard'
import DashboardNav from '../../components/DashboardNav'
import AppNav from '../../components/AppNav'
import Footer from '../../components/Footer'
import SLACountdown from '../../components/SLACountdown'
import ReliabilityScore from '../../components/ReliabilityScore'
import PreCommitmentPrompt from '../../components/PreCommitmentPrompt'
import { formatCurrency } from '../../lib/countries'
import { setupOwnerPush } from '../../notifications/index'
import { playNotificationSound, unlockAudio } from '../../lib/sound'
import { buildShopShareLink } from '../../notifications/whatsapp'
import { makeShopSlug } from '../../lib/slugify'

const TABS = ['submitted', 'accepted', 'printing', 'delivered', 'cancelled']
const TAB_LABELS = {
  submitted:  'Pending',
  accepted:   'Accepted',
  printing:   'Printing',
  delivered:  'Delivered',
  cancelled:  'Cancelled'
}

export default function DashboardJobs() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const { owner, loading: ownerLoading, toggleStatus, isSoftLocked, fetchOwner } = useOwner()
  const { jobs, loading, fetchJobs } = useJobs()
  const {
    score, grade, hasEnoughData, streak,
    acceptanceRate, completionRate,
    isSoftLocked: reliabilitySoftLocked,
    refetch: refetchReliability
  } = useReliability()

  const [activeTab, setActiveTab] = useState('submitted')
  const [toggling, setToggling] = useState(false)
  const [showCommitPrompt, setShowCommitPrompt] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [autoCompleting, setAutoCompleting] = useState(false)

  // Track submitted job IDs to detect new arrivals; null = initial load (no sound).
  const knownSubmittedIdsRef = useRef(null)

  // After email-confirmation redirect: complete pending owner creation
  useEffect(() => {
    if (ownerLoading || owner || autoCompleting) return
    const raw = localStorage.getItem('reg_pending')
    if (!raw) return
    async function complete() {
      setAutoCompleting(true)
      try {
        const p = JSON.parse(raw)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setAutoCompleting(false); return }

        // Resolve societyId — create the society now if it was a new one
        // (deferred from registration because email confirmation was enabled).
        let societyId = p.societyId
        if (p.isNewSociety) {
          const slug = makeShopSlug(p.societyName, p.societyPostalCode)
          const { data: soc, error: socErr } = await supabase
            .from('societies')
            .insert({
              name:         p.societyName,
              slug,
              postal_code:  p.societyPostalCode,
              country_code: p.country_code
            })
            .select()
            .single()

          if (socErr?.code === '23505') {
            // Society was already created (e.g. previous failed attempt).
            const { data: existing } = await supabase
              .from('societies').select('id').eq('slug', slug).single()
            societyId = existing?.id
          } else if (socErr) {
            throw socErr
          } else {
            societyId = soc.id
          }
        }

        // Guard: if this user already has an owner record, don't insert a duplicate
        const { data: existingOwner } = await supabase
          .from('owners').select('id').eq('user_id', user.id).maybeSingle()
        if (existingOwner) {
          localStorage.removeItem('reg_pending')
          window.location.reload()
          return
        }

        const isShop = p.provider_type === 'shop'
        const ownerRow = isShop
          ? {
              user_id:         user.id,
              provider_type:   'shop',
              slug:            p.slug || null,
              name:            p.name,
              phone:           p.phone,
              shop_name:       p.shop_name,
              shop_address:    p.shop_address,
              gst_number:      p.gst_number,
              locality:        p.locality,
              landmark:        p.landmark,
              lat:             p.lat,
              lng:             p.lng,
              bw_rate:         p.bw_rate,
              color_rate:      p.color_rate,
              upi_id:          p.upi_id,
              accept_cash:     p.accept_cash,
              country_code:    p.country_code,
              max_active_jobs: p.max_active_jobs,
            }
          : {
              user_id:         user.id,
              provider_type:   'home',
              name:            p.name,
              phone:           p.phone,
              flat_number:     p.flat_number,
              society_id:      societyId,
              shop_name:       p.shop_name,
              bw_rate:         p.bw_rate,
              color_rate:      p.color_rate,
              delivery_fee:    p.delivery_fee,
              upi_id:          p.upi_id,
              accept_cash:     p.accept_cash,
              country_code:    p.country_code,
              max_active_jobs: p.max_active_jobs,
            }

        const { data: newOwner, error } = await supabase.from('owners').insert(ownerRow).select('id').single()
        if (error?.code === '23505') {
          localStorage.removeItem('reg_pending')
          if (error.message?.includes('phone')) {
            sessionStorage.setItem('reg_error', 'phone_taken')
          } else if (error.message?.includes('user_id')) {
            window.location.reload()
            return
          } else {
            sessionStorage.setItem('reg_error', 'society_taken')
          }
          window.location.replace('/register')
          return
        }
        if (!error && newOwner) {
          // Print shop: insert delivery tiers, seed service menu, add schedules
          if (isShop) {
            const tiers = (p.delivery_tiers || [])
              .filter(t => parseFloat(t.max_km) > 0)
              .map(t => ({ owner_id: newOwner.id, max_km: parseFloat(t.max_km), fee: Math.round(parseFloat(t.fee) * 100) }))
            if (tiers.length > 0) await supabase.from('delivery_fee_tiers').insert(tiers)

            await supabase.rpc('seed_service_menu', { p_owner_id: newOwner.id })

            const schedules = (p.operating_hours || [])
              .map((h, dow) => h.enabled ? { owner_id: newOwner.id, day_of_week: dow, start_time: h.start + ':00', end_time: h.end + ':00' } : null)
              .filter(Boolean)
            if (schedules.length > 0) await supabase.from('availability_schedules').insert(schedules)
          }

          localStorage.removeItem('reg_pending')
          await supabase.functions.invoke('notify-admin', {
            body: {
              owner_name:   p.name,
              shop_name:    p.shop_name,
              society_name: p.societyName || p.locality,
              email:        user.email,
              phone:        p.phone,
              admin_url:    `${window.location.origin}/admin`,
            }
          })
        }
        window.location.reload()
      } catch {
        setAutoCompleting(false)
      }
    }
    complete()
  }, [ownerLoading, owner, autoCompleting])

  // Detect new submitted jobs and play notification sound.
  useEffect(() => {
    const currentIds = new Set(jobs.filter(j => j.status === 'submitted').map(j => j.id))
    if (knownSubmittedIdsRef.current !== null) {
      for (const id of currentIds) {
        if (!knownSubmittedIdsRef.current.has(id)) {
          playNotificationSound()
          break
        }
      }
    }
    knownSubmittedIdsRef.current = currentIds
  }, [jobs])

  // Poll for new jobs every 30 s when shop is live.
  useEffect(() => {
    if (owner?.status !== 'active') return
    const interval = setInterval(() => fetchJobs(), 30_000)
    return () => clearInterval(interval)
  }, [owner?.status, fetchJobs])

  const countryCode = owner?.country_code || 'IN'
  const fmt = v => formatCurrency(v, countryCode)

  const today = new Date().toDateString()
  const jobsToday = jobs.filter(j => new Date(j.created_at).toDateString() === today).length
  const weekStart = new Date()
  const _wd = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (_wd === 0 ? 6 : _wd - 1))
  weekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const earningsWeek  = jobs.filter(j => j.status === 'delivered' && new Date(j.updated_at) >= weekStart).reduce((s, j) => s + j.total_amount, 0)
  const earningsMonth = jobs.filter(j => j.status === 'delivered' && new Date(j.updated_at) >= monthStart).reduce((s, j) => s + j.total_amount, 0)

  const DELIVERED_STATUSES = ['delivered', 'feedback_pending', 'feedback_done']
  const filteredJobs = activeTab === 'delivered'
    ? jobs.filter(j => DELIVERED_STATUSES.includes(j.status))
    : jobs.filter(j => j.status === activeTab)

  const shopSlug = owner?.slug || owner?.societies?.slug || ''
  const shopUrl = shopSlug ? `${window.location.origin}/${shopSlug}` : ''

  function handleToggleClick() {
    if (!owner) return
    unlockAudio()
    if (isSoftLocked || reliabilitySoftLocked) {
      const lockUntil = owner.soft_lock_until
        ? new Date(owner.soft_lock_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : ''
      toast.error(t('soft_lock.message', { time: lockUntil }))
      return
    }
    if (owner.status !== 'active') {
      setShowCommitPrompt(true)
    } else {
      doToggle()
    }
  }

  async function doToggle() {
    setToggling(true)
    const result = await toggleStatus()
    if (result?.blocked === 'soft_lock') {
      toast.error(t('soft_lock.active'))
    } else if (result?.error) {
      toast.error(t('errors.network'))
    } else {
      const nowActive = result?.data?.status === 'active'
      toast.success(nowActive ? 'Shop is now live! Customers can send you orders.' : 'Shop paused.')
    }
    refetchReliability()
    setToggling(false)
  }

  async function handleCommitConfirm() {
    setShowCommitPrompt(false)
    await doToggle()
  }

  async function enablePush() {
    if (!owner) return
    unlockAudio()
    const sub = await setupOwnerPush(owner.id)
    if (sub) toast.success('Push notifications enabled!')
    else toast.error('Could not enable notifications. Check browser permissions.')
  }

  function copyShopLink() {
    if (!shopUrl) return
    const write = navigator.clipboard
      ? navigator.clipboard.writeText(shopUrl)
      : Promise.resolve().then(() => {
          const el = document.createElement('textarea')
          el.value = shopUrl
          Object.assign(el.style, { position: 'fixed', opacity: '0' })
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        })
    write.then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const softLockExpiry = owner?.soft_lock_until ? new Date(owner.soft_lock_until) : null
  const isLocked = softLockExpiry && softLockExpiry > new Date()
  const isPending  = owner?.status === 'pending'
  const isInactive = owner?.status === 'inactive'
  const isActive   = owner?.status === 'active'

  // Owner row doesn't exist — completing pending registration or registration was incomplete
  if (!ownerLoading && !owner) {
    if (autoCompleting) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full border-4 border-violet/30 border-t-violet animate-spin mx-auto" />
            <p className="text-muted text-base">Finishing your shop setup…</p>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-md w-full space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red/10 flex items-center justify-center mx-auto">
            <Clock size={32} className="text-red" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-black text-ink">Shop setup incomplete</h1>
            <p className="text-muted text-base leading-relaxed">
              Your account was created but the shop registration didn't finish.
              This happens when email confirmation is enabled in Supabase.
            </p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5 text-left space-y-3 text-sm text-muted">
            <p className="font-semibold text-ink">To fix this:</p>
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>Open <strong className="text-ink">Supabase Studio → Authentication → Providers → Email</strong></li>
              <li>Turn off <strong className="text-ink">"Enable email confirmations"</strong> and save</li>
              <li>Go to <strong className="text-ink">Authentication → Users</strong> and delete your current user</li>
              <li>Re-register at <strong className="text-ink">/register</strong></li>
            </ol>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-muted hover:text-ink transition-colors min-h-[44px] px-4"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (isInactive) {
    const supportEmail    = import.meta.env.VITE_ADMIN_EMAIL
    const supportWhatsApp = import.meta.env.VITE_CONTACT_WHATSAPP
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <AppNav right={
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium min-h-[44px] px-2"
          >
            <LogOut size={16} /> Sign out
          </button>
        } />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-sm w-full space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red/10 flex items-center justify-center mx-auto">
              <Lock size={32} className="text-red" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-black text-ink">Application rejected</h1>
              <p className="text-muted text-base leading-relaxed">
                Your shop <strong className="text-ink">{owner.shop_name}</strong> was not approved.
                You cannot access the dashboard. Please contact support if you think this is a mistake.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
              <p className="font-semibold text-ink text-sm">Contact support</p>
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="flex items-center justify-center gap-2 text-violet text-base font-medium min-h-[48px] hover:underline"
                >
                  {supportEmail}
                </a>
              )}
              {supportWhatsApp && (
                <a
                  href={`https://wa.me/${supportWhatsApp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-green text-white font-bold rounded-xl py-3 px-4 text-sm hover:bg-green/90 transition-colors min-h-[48px] w-full"
                >
                  <MessageCircle size={16} /> Chat on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <PreCommitmentPrompt
        open={showCommitPrompt}
        onConfirm={handleCommitConfirm}
        onCancel={() => setShowCommitPrompt(false)}
        loading={toggling}
      />

      {/* ── Top navbar ─────────────────────────────────── */}
      <nav style={{ backgroundColor: '#1A1A2E' }} className="text-white px-4 sticky top-0 z-30 border-b border-white/10">
        <div className="max-w-2xl mx-auto">

          {/* Brand row */}
          <div className="flex items-center justify-between pt-2.5 pb-1">
            <span className="font-display font-black text-[13px] tracking-tight text-white/90">
              Ink<span className="text-orange">Neighbour</span>
            </span>
            <div className="flex items-center">
              {streak > 0 && (
                <div className="flex items-center gap-1 bg-amber/20 text-amber px-2 py-0.5 rounded-full text-[11px] font-bold mr-1">
                  <Flame size={10} /> {streak}
                </div>
              )}
              <button
                onClick={enablePush}
                className="p-2 text-white/40 hover:text-white transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Enable notifications"
              >
                <Bell size={16} />
              </button>
              <button
                onClick={signOut}
                className="p-2 text-white/40 hover:text-white transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* Shop row */}
          <div className="flex items-center justify-between gap-3 pb-3">
            <div className="min-w-0">
              <p className="font-display font-bold text-[17px] leading-tight truncate">
                {owner?.shop_name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isPending ? (
                  <><Clock size={10} className="text-amber shrink-0" /><span className="text-xs text-amber">Awaiting approval</span></>
                ) : isInactive ? (
                  <><span className="text-xs text-red">Application rejected</span></>
                ) : isLocked ? (
                  <><Lock size={10} className="text-red shrink-0" /><span className="text-xs text-red">Locked</span></>
                ) : (
                  <><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green' : 'bg-amber'}`} />
                  <span className="text-xs text-white/50">{isActive ? 'Live' : 'Paused'}</span></>
                )}
              </div>
            </div>

            {/* Toggle — only when approved and not rejected */}
            {!isPending && !isInactive && (
              <button
                onClick={handleToggleClick}
                disabled={toggling || isLocked}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all shrink-0 disabled:opacity-40',
                  isActive
                    ? 'bg-green/20 text-green hover:bg-green/30'
                    : 'bg-white/10 text-white hover:bg-white/20'
                ].join(' ')}
              >
                {isLocked ? (
                  <><Lock size={14} /> Locked</>
                ) : isActive ? (
                  <><ToggleRight size={16} /> Pause</>
                ) : (
                  <><ToggleLeft size={16} /> Go live</>
                )}
              </button>
            )}
          </div>

        </div>
      </nav>

      {/* Soft lock notice */}
      {isLocked && (
        <div className="bg-red/10 border-b border-red/20 px-4 py-3">
          <p className="text-sm text-red font-medium text-center max-w-2xl mx-auto">
            {t('soft_lock.message', {
              time: softLockExpiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })}
          </p>
        </div>
      )}

      {/* Stats bar */}
      {owner && !isPending && (
        <div style={{ backgroundColor: '#1A1A2E' }} className="text-white px-4 pt-2 pb-3">
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-2">
            {[
              { label: 'Jobs today',   value: jobsToday },
              { label: 'This week',    value: fmt(earningsWeek) },
              { label: 'This month',   value: fmt(earningsMonth) }
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-lg px-2 py-1.5 text-center">
                <p className="text-sm font-bold leading-tight">{s.value}</p>
                <p className="text-[10px] text-white/50 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Pending approval banner ──────────────────── */}
        {isPending && (
          <div className="bg-amber/10 border border-amber/30 rounded-2xl overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber/20 flex items-center justify-center shrink-0">
                  <Clock size={20} className="text-amber" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-ink">Your shop is under review</h2>
                  <p className="text-muted text-sm mt-1 leading-relaxed">
                    Our team will approve your shop shortly — usually within a few hours.
                    You'll be able to go live once approved.
                  </p>
                </div>
              </div>

              {/* What happens next */}
              <div className="bg-white/60 rounded-xl p-4 space-y-2.5">
                <p className="text-sm font-bold text-ink">While you wait — do this now:</p>
                {[
                  { icon: Bell,            text: 'Enable notifications so you hear when an order arrives' },
                  { icon: Printer,         text: 'Make sure your printer has ink and paper loaded' },
                  { icon: MessageCircle,   text: 'Your shop link will be sent to your WhatsApp once approved' },
                  { icon: CheckCircle,     text: 'Once approved, tap "Go live" to start accepting orders' }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-muted">
                    <item.icon size={15} className="text-amber shrink-0 mt-0.5" />
                    {item.text}
                  </div>
                ))}
              </div>

              <button
                onClick={fetchOwner}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-violet font-semibold hover:text-violet/70 transition-colors min-h-[44px]"
              >
                <RefreshCw size={13} /> Check approval status
              </button>

              <p className="text-xs text-muted text-center">
                Questions? WhatsApp us at{' '}
                <a href="{`https://wa.me/${import.meta.env.VITE_CONTACT_WHATSAPP}`}" target="_blank" rel="noopener noreferrer" className="text-violet font-semibold">
                  +91 63816 01740
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Reliability score */}
        {!isPending && hasEnoughData && (
          <ReliabilityScore
            score={score}
            grade={grade}
            acceptanceRate={acceptanceRate}
            completionRate={completionRate}
            hasEnoughData={hasEnoughData}
          />
        )}

        {/* ── Jobs section ────────────────────────────── */}
        {!isPending && (
          <>
            {/* Tab chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {TABS.map(tab => {
                const count = tab === 'delivered'
                  ? jobs.filter(j => DELIVERED_STATUSES.includes(j.status)).length
                  : jobs.filter(j => j.status === tab).length
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={[
                      'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap',
                      activeTab === tab
                        ? 'bg-violet text-white'
                        : 'bg-surface text-muted border border-border hover:border-violet/40'
                    ].join(' ')}
                  >
                    {TAB_LABELS[tab]}
                    {count > 0 && (
                      <span className={`ml-1.5 text-xs ${activeTab === tab ? 'text-white/70' : 'text-muted'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Refresh */}
            <div className="flex justify-end -mt-1">
              <button
                onClick={() => { fetchJobs(); refetchReliability() }}
                className="flex items-center gap-1.5 text-sm text-violet hover:text-violet/70 transition-colors min-h-[44px] px-2"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {/* Jobs list */}
            {loading ? (
              <p className="text-center text-muted py-12">{t('common.loading')}</p>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                {activeTab === 'submitted' ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-violet/10 flex items-center justify-center mx-auto">
                      <Printer size={24} className="text-violet" />
                    </div>
                    <p className="font-semibold text-ink">No orders yet</p>
                    {isPending ? (
                      <p className="text-muted text-sm max-w-xs mx-auto">
                        Your shop link will be sent via WhatsApp once our team approves your shop.
                      </p>
                    ) : (
                      <>
                        <p className="text-muted text-sm max-w-xs mx-auto">
                          Share your shop link with neighbours to get your first print job.
                        </p>
                        {shopUrl && (
                          <div className="flex gap-2 justify-center mt-2">
                            <button
                              onClick={copyShopLink}
                              className="flex items-center gap-1.5 bg-surface border border-border rounded-xl px-4 py-2 text-sm font-semibold text-ink min-h-[44px] hover:bg-bg transition-colors"
                            >
                              <Copy size={14} /> {linkCopied ? 'Copied!' : 'Copy link'}
                            </button>
                            <a
                              href={buildShopShareLink(shopUrl, owner?.societies?.name || '')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 bg-green text-white rounded-xl px-4 py-2 text-sm font-semibold min-h-[44px] hover:bg-green/90"
                            >
                              <ExternalLink size={14} /> WhatsApp
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-muted">
                    {activeTab === 'printing'  ? 'No jobs being printed right now.' :
                     activeTab === 'delivered' ? 'No delivered jobs yet.' :
                     activeTab === 'accepted'  ? 'No accepted jobs.' :
                                                 'No cancelled jobs.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map(job => (
                  <div key={job.id} className="space-y-1">
                    {job.status === 'submitted' && job.sla_deadline && (
                      <div className="flex justify-end px-1">
                        <SLACountdown deadline={job.sla_deadline} />
                      </div>
                    )}
                    <JobCard job={job} onRefresh={fetchJobs} shopSlug={shopSlug} deliveryTiers={owner?.delivery_fee_tiers || []} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <DashboardNav />
    </div>
  )
}
