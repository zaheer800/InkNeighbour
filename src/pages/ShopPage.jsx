import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Printer, Zap, Clock, Users, Smartphone, Banknote,
  Copy as CopyIcon, Layers, Search, Phone, MessageCircle, Navigation, ShieldCheck,
  ScanLine, BookOpen, Camera, Star, Package, CheckCircle2, Truck, Info
} from 'lucide-react'
import { getEffectiveState } from '../lib/availability'
import { OlaMaps, defaultStyleJson } from 'olamaps-web-sdk'
import AppNav from '../components/AppNav'
import Footer from '../components/Footer'
import AddressAutocomplete from '../components/AddressAutocomplete'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { formatCurrency, getCountry } from '../lib/countries'
import { getRatePerPage, getPriceBreakdown } from '../lib/pricing'
import { StarDisplay } from '../components/StarRating'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import UploadZone from '../components/UploadZone'
import PriceBreakdown from '../components/PriceBreakdown'
import UPIQRCode from '../components/UPIQRCode'
import { getPaymentMethods } from '../payments/index'

const OLA_KEY = import.meta.env.VITE_OLA_MAPS_API_KEY

const STEPS = ['details', 'upload', 'options', 'payment']
const STEP_LABELS = {
  details: 'Your details',
  upload:  'Upload document',
  options: 'Print options',
  payment: 'Price & payment'
}

export default function ShopPage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()

  // shop data — one of two shapes depending on lookup path
  const [shopData, setShopData] = useState(null)   // { owner, society|null }
  const [reliability, setReliability] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    customer_name: '', customer_flat: '', customer_phone: '',
    file: null, pageCount: null, fileName: '',
    print_type: 'bw', paper_size: 'A4', copies: 1, sides: 'single',
    notes: '', payment_method: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    async function load() {
      try {
        // ── Path 1: Home owner (via society slug) ───────────────────────────
        const { data: socData } = await supabase
          .from('societies')
          .select(`id, slug, name, postal_code, owners!inner(
            id, name, shop_name, status, bw_rate, color_rate, delivery_fee,
            upi_id, accept_cash, country_code, phone, max_active_jobs, provider_type,
            manual_state, system_override, override_expires_at,
            feedback(star_rating)
          )`)
          .eq('slug', slug)
          .maybeSingle()

        if (socData?.owners) {
          const owners = Array.isArray(socData.owners) ? socData.owners : [socData.owners]
          if (owners.length > 0 && owners[0].status !== 'inactive') {
            const owner = owners[0]
            setShopData({ owner, society: socData })
            if (owner.id) {
              const { data: rel } = await supabase
                .from('owner_reliability')
                .select('reliability_score, active_jobs_count, max_active_jobs, avg_response_minutes, completed_jobs')
                .eq('owner_id', owner.id)
                .maybeSingle()
              setReliability(rel || null)
            }
            const methods = getPaymentMethods(owner.country_code, owner)
            if (methods.length > 0) setForm(f => ({ ...f, payment_method: methods[0].id }))
            setLoading(false)
            return
          }
        }

        // ── Path 2: Print shop (via owners.slug) ────────────────────────────
        const { data: shopOwner } = await supabase
          .from('owners')
          .select(`
            id, name, slug, shop_name, shop_address, locality, landmark, lat, lng,
            status, bw_rate, color_rate, delivery_fee, upi_id, accept_cash,
            country_code, phone, max_active_jobs, provider_type, gst_number,
            manual_state, system_override, override_expires_at,
            feedback(star_rating),
            service_menu(service_code, is_enabled, display_price),
            delivery_fee_tiers(max_km, fee)
          `)
          .eq('slug', slug)
          .eq('provider_type', 'shop')
          .maybeSingle()

        if (shopOwner && shopOwner.status !== 'inactive') {
          // Fetch reliability before setting state so all updates batch into
          // a single render — this ensures shopMapRef is attached when the
          // map effect fires (ref is null while loading=true hides the div).
          const { data: rel } = await supabase
            .from('owner_reliability')
            .select('reliability_score, active_jobs_count, max_active_jobs, avg_response_minutes, completed_jobs')
            .eq('owner_id', shopOwner.id)
            .maybeSingle()
          setShopData({ owner: shopOwner, society: null })
          setReliability(rel || null)
          const methods = getPaymentMethods(shopOwner.country_code, shopOwner)
          if (methods.length > 0) setForm(f => ({ ...f, payment_method: methods[0].id }))
        }
      } catch {
        // leave shopData null → "not found" shown below
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  const shopMapRef = useRef(null)
  const shopMapInstanceRef = useRef(null)

  useEffect(() => {
    const lat = shopData?.owner?.lat
    const lng = shopData?.owner?.lng
    const isShop = shopData?.owner?.provider_type === 'shop'
    if (!isShop || !lat || !lng) return

    let cancelled = false
    ;(async () => {
      await new Promise(r => requestAnimationFrame(r))
      if (cancelled || !shopMapRef.current) return
      try {
        const ola = new OlaMaps({ apiKey: OLA_KEY })
        const map = await ola.init({
          style: defaultStyleJson,
          container: shopMapRef.current,
          center: [lng, lat],
          zoom: 16,
          scrollZoom: false,
          dragPan: false,
          keyboard: false,
          doubleClickZoom: false,
          touchZoomRotate: false,
          attributionControl: false,
        })
        if (cancelled) { try { map?.remove() } catch { /* ignore */ } ; return }
        shopMapInstanceRef.current = map
        ola.addMarker({ draggable: false }).setLngLat([lng, lat]).addTo(map)
      } catch (err) {
        console.error('[ShopPage] map init error:', err)
      }
    })()

    return () => {
      cancelled = true
      try { shopMapInstanceRef.current?.remove() } catch { /* ignore */ }
      shopMapInstanceRef.current = null
    }
  }, [shopData?.owner?.lat, shopData?.owner?.lng, shopData?.owner?.provider_type])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted">{t('common.loading')}</p>
    </div>
  )

  if (!shopData) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted">{t('errors.shop_not_found')}</p>
    </div>
  )

  const { owner, society } = shopData
  const isShop       = owner.provider_type === 'shop'
  const countryCode  = owner.country_code || 'IN'
  const country      = getCountry(countryCode)
  const fmt          = v => formatCurrency(v, countryCode)

  const feedbackList = owner.feedback || []
  const rating = feedbackList.length >= 3
    ? { avg: (feedbackList.reduce((s, f) => s + f.star_rating, 0) / feedbackList.length).toFixed(1), count: feedbackList.length }
    : feedbackList.length === 0
      ? { avg: '5.0', count: 0 }
      : null

  const paymentMethods = getPaymentMethods(countryCode, owner)
  const ratePerPage    = getRatePerPage(form.print_type, owner)
  const pages          = form.pageCount || 1

  // For print shops with tiers, delivery fee is confirmed by the owner on accept.
  // Show minimum tier as estimate so total isn't misleading.
  const effectiveDeliveryFee = isShop
    ? (owner.delivery_fee_tiers?.length
        ? Math.min(...owner.delivery_fee_tiers.map(t => t.fee))
        : owner.delivery_fee ?? 0)
    : owner.delivery_fee

  const breakdown = getPriceBreakdown(pages, form.copies, ratePerPage, effectiveDeliveryFee)

  const activeCount = reliability?.active_jobs_count ?? 0
  const maxJobs     = reliability?.max_active_jobs ?? owner.max_active_jobs ?? 3
  const isAtJobLimit = activeCount >= maxJobs

  const avgMins          = reliability?.avg_response_minutes ? parseFloat(reliability.avg_response_minutes) : null
  const reliabilityScore = reliability?.reliability_score   ? parseFloat(reliability.reliability_score)    : null
  const completedJobs    = reliability?.completed_jobs      ? parseInt(reliability.completed_jobs)          : 0
  const slotsOpen        = Math.max(0, maxJobs - activeCount)
  const isOpen           = owner.status === 'active' && getEffectiveState(owner, []) === 'AVAILABLE'

  function getTransparencySignal() {
    if (isAtJobLimit) return { type: 'busy', icon: Users }
    if (avgMins !== null) {
      if (avgMins <= 5)  return { type: 'fast',   icon: Zap }
      if (avgMins <= 12) return { type: 'normal', icon: Clock }
      return { type: 'slow', icon: Clock }
    }
    return null
  }
  const signal = getTransparencySignal()

  const shopTitle = owner.shop_name || (society ? `${society.name} Print Shop` : owner.name)

  // ── Not-active screens ───────────────────────────────────────────────────
  if (owner.status !== 'active') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <Printer size={48} className="text-muted mx-auto" />
          <h1 className="font-display text-2xl font-bold text-ink">{shopTitle}</h1>
          <Badge status={owner.status} />
          <p className="text-muted">
            {owner.status === 'pending' ? t('errors.shop_pending') : t('errors.shop_paused')}
          </p>
        </div>
      </div>
    )
  }

  if (isAtJobLimit) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber/10 flex items-center justify-center mx-auto">
            <Users size={32} className="text-amber" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">{shopTitle}</h1>
          <p className="text-lg text-ink font-semibold">{t('transparency.busy')}</p>
          <p className="text-muted text-base">{t('job_limit.reached')}</p>
          <p className="text-sm text-muted">
            {avgMins !== null
              ? t('transparency.try_again_avg', { minutes: Math.round(avgMins) })
              : t('transparency.try_again_later')}
          </p>
        </div>
      </div>
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function setField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }


  function validateStep() {
    if (step === 0) {
      const e = {}
      if (!form.customer_name.trim())  e.customer_name  = t('register.validation_required')
      if (!form.customer_flat.trim())  e.customer_flat  = t('register.validation_required')
      if (!form.customer_phone.trim()) e.customer_phone = t('register.validation_required')
      return e
    }
    if (step === 1) {
      if (!form.file) return { file: 'Please upload a document to print' }
    }
    return {}
  }

  function handleNext() {
    const e = validateStep()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  async function handleSubmit() {
    if (!form.payment_method) { toast.error('Select a payment method'); return }
    setSubmitting(true)
    try {
      const jobId = crypto.randomUUID()
      let filePath = null
      if (form.file) {
        filePath = `${jobId}/${form.file.name}`
        const { error: uploadErr } = await supabase.storage
          .from('job-files')
          .upload(filePath, form.file)
        if (uploadErr) throw uploadErr
      }

      const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true })
      const jobNumber = `INK-${String((count || 0) + 1).padStart(4, '0')}`

      const deliveryPin = String(Math.floor(1000 + Math.random() * 9000))
      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          id: jobId,
          job_number: jobNumber,
          owner_id: owner.id,
          society_id: society?.id || null,
          customer_name: form.customer_name,
          customer_flat: form.customer_flat,
          customer_phone: form.customer_phone || null,
          file_path: filePath,
          file_name: form.file?.name || null,
          page_count: form.pageCount,
          print_type: form.print_type,
          paper_size: form.paper_size,
          copies: form.copies,
          sides: form.sides,
          notes: form.notes.trim() || null,
          total_amount: breakdown.total,
          payment_method: form.payment_method,
          payment_status: 'pending',
          status: 'submitted',
          delivery_pin: deliveryPin,
          has_delivery_pin: true
        })
        .select()
        .single()

      if (jobErr) throw jobErr

      localStorage.setItem('last_order', JSON.stringify({
        slug,
        jobId: job.id,
        jobNumber: job.job_number,
        shopName: shopTitle,
        createdAt: new Date().toISOString()
      }))

      navigate(`/${slug}/confirm/${job.id}`)
    } catch (err) {
      toast.error(err.message || t('errors.network'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delivery copy for header ─────────────────────────────────────────────
  function deliveryHeaderCopy() {
    if (isShop) {
      const tiers = owner.delivery_fee_tiers
      if (tiers?.length) {
        const minFee = Math.min(...tiers.map(t => t.fee))
        return minFee === 0 ? 'Free delivery' : `Delivery from ${fmt(minFee)}`
      }
    }
    return owner.delivery_fee > 0 ? `Delivery ${fmt(owner.delivery_fee)}` : 'Free delivery'
  }

  // Short version for the 3-up rate tile — keeps text to one line
  function deliveryTileCopy() {
    if (isShop) {
      const tiers = owner.delivery_fee_tiers
      if (tiers?.length) {
        const minFee = Math.min(...tiers.map(t => t.fee))
        return minFee === 0 ? 'Free' : `From ${fmt(minFee)}`
      }
    }
    return owner.delivery_fee > 0 ? fmt(owner.delivery_fee) : 'Free'
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav back={sessionStorage.getItem('find_back') || undefined} />

      {/* ══════════════════════════════════════════
          STOREFRONT HERO
      ══════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #0A0A0F 0%, #1A1A2E 55%, #1E1040 100%)' }}
      >
        {/* Decorative faded printer in background */}
        <div className="absolute -right-6 -top-4 opacity-[0.04] pointer-events-none select-none" aria-hidden>
          <Printer size={260} strokeWidth={0.7} />
        </div>

        <div className="max-w-lg mx-auto px-4 pt-8 pb-10 relative z-10">

          {/* Trust / signal badges */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {/* Open / closed live indicator */}
            <span className={[
              'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border',
              isOpen
                ? 'bg-green/20 border-green/30 text-green-300'
                : 'bg-amber/20 border-amber/30 text-amber-300'
            ].join(' ')}>
              <span className={`relative flex h-1.5 w-1.5`}>
                {isOpen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isOpen ? 'bg-green' : 'bg-amber'}`} />
              </span>
              {isOpen ? 'Open now' : 'Closed'}
            </span>

            {!isShop && (
              <span className="inline-flex items-center gap-1.5 bg-green/20 border border-green/30 text-green text-xs font-bold px-3 py-1.5 rounded-full">
                <ShieldCheck size={12} /> Verified local printer
              </span>
            )}
            {isShop && owner.gst_number && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 text-white/70 text-xs font-bold px-3 py-1.5 rounded-full">
                <CheckCircle2 size={12} /> GST registered
              </span>
            )}
            {signal && (
              <span className={[
                'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border',
                signal.type === 'fast'   ? 'bg-green/15 border-green/30 text-green-300' :
                signal.type === 'slow'   ? 'bg-amber/15 border-amber/30 text-amber-300' :
                                           'bg-white/10 border-white/15 text-white/70'
              ].join(' ')}>
                <signal.icon size={12} />
                {signal.type === 'fast'   ? t('transparency.fast',   { minutes: Math.round(avgMins) }) :
                 signal.type === 'normal' ? t('transparency.normal', { minutes: Math.round(avgMins) }) :
                 signal.type === 'slow'   ? t('transparency.slow',   { minutes: Math.round(avgMins) }) :
                 t('transparency.busy')}
              </span>
            )}
          </div>

          {/* Shop name — large */}
          <h1 className="font-display text-4xl font-black leading-tight tracking-tight mb-2">
            {shopTitle}
          </h1>

          {/* Subtitle */}
          {isShop ? (
            <div className="mb-4 space-y-1">
              <p className="text-white/70 text-base">
                {t('shop.managed_by', { name: owner.name.split(' ')[0] })}
              </p>
              {owner.locality && (
                <p className="text-white/50 text-sm flex items-center gap-1.5">
                  <Navigation size={12} className="shrink-0" />
                  {[owner.locality, owner.landmark].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-white/70 text-base mb-4">
              Right in your building · <span className="text-white font-semibold">{society?.name || 'Your society'}</span>
            </p>
          )}

          {/* Rating */}
          {rating && (
            <div className="mb-5">
              <StarDisplay rating={parseFloat(rating.avg)} count={rating.count} className="text-white" />
            </div>
          )}

          {/* Rate cards */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { label: 'B&W print',    value: `${fmt(owner.bw_rate)}/pg`,    bg: 'bg-violet/20',  border: 'border-violet/25' },
              { label: 'Colour print', value: `${fmt(owner.color_rate)}/pg`, bg: 'bg-orange/20',  border: 'border-orange/25' },
              { label: 'Delivery',     value: deliveryTileCopy(),             bg: 'bg-sky/20',     border: 'border-sky/25'    },
            ].map(c => (
              <div key={c.label} className={`${c.bg} border ${c.border} rounded-2xl px-2 py-3 text-center`}>
                <p className="text-white font-bold text-sm leading-snug">{c.value}</p>
                <p className="text-white/50 text-[11px] mt-0.5 font-medium leading-tight">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <a
            href="#order-form"
            className="flex items-center justify-center gap-2 w-full min-h-[54px] bg-orange hover:bg-orange/90 active:scale-[0.98] text-white font-bold text-base rounded-2xl transition-all shadow-lg shadow-orange/20"
          >
            <Printer size={18} />
            Place a print order
          </a>

          {/* Find another */}
          {society?.postal_code && (
            <div className="text-center mt-4">
              <Link
                to={`/find?pincode=${society.postal_code}`}
                className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/60 text-xs transition-colors"
              >
                <Search size={11} />
                Find another printer in {society.postal_code}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          STOREFRONT INFO STRIP (all provider types)
      ══════════════════════════════════════════ */}
      <div className="max-w-lg mx-auto w-full px-4 pt-5 space-y-3">

        {/* Availability + Stats card */}
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className={`px-4 py-3 flex items-center justify-between border-b ${
            isOpen ? 'bg-green/5 border-green/15' : 'bg-amber/5 border-amber/15'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                {isOpen && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-60" />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOpen ? 'bg-green' : 'bg-amber'}`} />
              </span>
              <span className={`font-bold text-sm ${isOpen ? 'text-green' : 'text-amber'}`}>
                {isOpen ? 'Open now · Accepting orders' : 'Currently closed · Not accepting orders'}
              </span>
            </div>
          </div>
          {(completedJobs > 0 || reliabilityScore != null || avgMins != null) && (
            <div className="grid divide-x divide-border" style={{ gridTemplateColumns: `repeat(${[completedJobs > 0, reliabilityScore != null, avgMins != null].filter(Boolean).length}, 1fr)` }}>
              {completedJobs > 0 && (
                <div className="px-4 py-3 text-center">
                  <p className="text-xl font-black text-ink">{completedJobs}</p>
                  <p className="text-[11px] text-muted mt-0.5">Orders done</p>
                </div>
              )}
              {reliabilityScore != null && (
                <div className="px-4 py-3 text-center">
                  <p className="text-xl font-black text-ink">{Math.round(reliabilityScore)}%</p>
                  <p className="text-[11px] text-muted mt-0.5">Reliable</p>
                </div>
              )}
              {avgMins != null && (
                <div className="px-4 py-3 text-center">
                  <p className="text-xl font-black text-ink">~{Math.round(avgMins)}m</p>
                  <p className="text-[11px] text-muted mt-0.5">Avg response</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment methods + Capacity row */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${paymentMethods.length + (maxJobs > 0 ? 1 : 0)}, 1fr)` }}>
          {paymentMethods.map(m => (
            <div key={m.id} className="bg-surface rounded-xl shadow-card p-3 flex flex-col items-center gap-1.5 text-center">
              {m.id === 'upi'
                ? <Smartphone size={20} className="text-violet" />
                : <Banknote size={20} className="text-green" />
              }
              <span className="text-xs font-bold text-ink">{m.id === 'upi' ? 'UPI pay' : 'Cash'}</span>
              <span className="text-[10px] text-muted leading-tight">{m.id === 'upi' ? 'Scan & pay' : 'On delivery'}</span>
            </div>
          ))}
          {maxJobs > 0 && (
            <div className="bg-surface rounded-xl shadow-card p-3 flex flex-col items-center gap-1.5 text-center">
              <div className="flex gap-0.5 items-end h-5">
                {Array.from({ length: Math.min(maxJobs, 5) }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-2 rounded-sm transition-colors ${i < Math.min(slotsOpen, 5) ? 'bg-green h-full' : 'bg-border h-3'}`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-ink">{slotsOpen}/{maxJobs} slots</span>
              <span className="text-[10px] text-muted leading-tight">Available now</span>
            </div>
          )}
        </div>

        {/* Home owners: how it works */}
        {!isShop && (
          <div className="bg-surface rounded-2xl shadow-card p-4">
            <p className="font-bold text-base text-ink mb-3">How it works</p>
            <div className="space-y-3">
              {[
                { n: '1', icon: Package,      text: 'Upload your document and choose B&W or colour' },
                { n: '2', icon: Printer,      text: `${owner.name.split(' ')[0]} prints it right in ${society?.name || 'your building'}` },
                { n: '3', icon: Truck,        text: 'Delivered to your door — usually within the hour' },
              ].map(({ n, icon: Icon, text }) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-violet/10 text-violet text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {n}
                  </span>
                  <span className="text-sm text-muted leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════
          PRINT SHOP INFO (map, contact, services)
      ══════════════════════════════════════════ */}
      {isShop && (
        <div className="max-w-lg mx-auto w-full px-4 py-5 space-y-4">

          {/* Map + address + contact */}
          {owner.lat && owner.lng ? (
            <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
              <div ref={shopMapRef} className="h-52" />
              <div className="p-4 space-y-3">
                {owner.shop_address && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Address</p>
                    <p className="text-sm font-medium text-ink">{owner.shop_address}</p>
                    {owner.landmark && (
                      <p className="text-xs text-muted mt-0.5">Near {owner.landmark}</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  {owner.phone && (
                    <a href={`tel:${owner.phone}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg border border-border hover:bg-violet/5 transition-colors text-sm font-semibold text-ink min-h-[48px]">
                      <Phone size={15} className="text-violet" />{t('shop.contact_call')}
                    </a>
                  )}
                  {owner.phone && (
                    <a href={`https://wa.me/${owner.phone.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg border border-border hover:bg-green/5 transition-colors text-sm font-semibold text-ink min-h-[48px]">
                      <MessageCircle size={15} className="text-green" />{t('shop.contact_whatsapp')}
                    </a>
                  )}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${owner.lat},${owner.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg border border-border hover:bg-sky/5 transition-colors text-sm font-semibold text-ink min-h-[48px]">
                    <Navigation size={15} className="text-sky" />{t('shop.contact_directions')}
                  </a>
                </div>
              </div>
            </div>
          ) : owner.phone ? (
            <div className="bg-surface rounded-2xl shadow-card p-4 space-y-3">
              <p className="font-bold text-base text-ink">{t('shop.contact_title')}</p>
              <div className="flex gap-2">
                <a href={`tel:${owner.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg border border-border text-sm font-semibold text-ink min-h-[48px]">
                  <Phone size={15} className="text-violet" />{t('shop.contact_call')}
                </a>
                <a href={`https://wa.me/${owner.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg border border-border text-sm font-semibold text-ink min-h-[48px]">
                  <MessageCircle size={15} className="text-green" />{t('shop.contact_whatsapp')}
                </a>
              </div>
            </div>
          ) : null}

          {/* Services — show only enabled ones as a clean list */}
          {owner.service_menu?.filter(s => s.is_enabled).length > 0 && (
            <div className="bg-surface rounded-2xl shadow-card p-4">
              <p className="font-bold text-base text-ink mb-3">{t('shop.services_title')}</p>
              <div className="divide-y divide-border">
                {owner.service_menu.filter(s => s.is_enabled).map(s => {
                  const META = { scan: { icon: ScanLine, label: 'Scanning' }, photocopy: { icon: CopyIcon, label: 'Photocopy' }, binding: { icon: BookOpen, label: 'Binding' }, lamination: { icon: Layers, label: 'Lamination' }, passport_photo: { icon: Camera, label: 'Passport Photo' } }
                  const m = META[s.service_code]
                  if (!m) return null
                  const Icon = m.icon
                  return (
                    <div key={s.service_code} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet/10 flex items-center justify-center flex-shrink-0">
                          <Icon size={15} className="text-violet" />
                        </div>
                        <span className="text-sm font-semibold text-ink">{t(`services.${s.service_code}`) || m.label}</span>
                      </div>
                      {s.display_price
                        ? <span className="text-sm font-bold text-violet">{s.display_price}</span>
                        : <span className="text-xs text-green font-semibold">Available</span>
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Delivery tiers */}
          {owner.delivery_fee_tiers?.length > 0 && (
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <p className="font-bold text-lg text-ink mb-3">{t('shop.delivery_tiers_title')}</p>
              <div className="divide-y divide-border">
                {owner.delivery_fee_tiers
                  .slice().sort((a, b) => a.max_km - b.max_km)
                  .map((tier, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5">
                      <span className="text-sm text-muted">Up to {tier.max_km} km</span>
                      <span className="text-sm font-bold text-ink">
                        {tier.fee === 0 ? <span className="text-green font-bold">Free</span> : fmt(tier.fee)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          ORDER FORM
      ══════════════════════════════════════════ */}
      <div id="order-form" className="max-w-lg mx-auto w-full px-4 pb-28">

        {/* Section divider */}
        <div className="flex items-center gap-4 py-6">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-bold text-muted uppercase tracking-widest">Place your order</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Numbered step progress */}
        <div className="flex items-center mb-2">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all',
                i < step  ? 'bg-green text-white' :
                i === step ? 'bg-violet text-white ring-4 ring-violet/20' :
                             'bg-bg border-2 border-border text-muted'
              ].join(' ')}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${i < step ? 'bg-green' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm font-semibold text-violet mb-5">{STEP_LABELS[STEPS[step]]}</p>

        {/* Form card */}
        <div className="bg-surface rounded-2xl shadow-card p-5 space-y-4">

          {/* Step 1: Customer details */}
          {step === 0 && (
            <>
              <Input label={t('shop.name_label')} value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} error={errors.customer_name} placeholder="Your full name" required />
              {isShop ? (
                <AddressAutocomplete
                  label="Delivery address"
                  value={form.customer_flat}
                  onChange={address => setField('customer_flat', address)}
                  error={errors.customer_flat}
                  placeholder="Search your delivery address…"
                  required
                />
              ) : (
                <Input label={`${country.flat_label} number`} value={form.customer_flat} onChange={e => setField('customer_flat', e.target.value)} error={errors.customer_flat} placeholder="e.g. B-302" required />
              )}
              <Input label={t('shop.phone_label')} type="tel" value={form.customer_phone} onChange={e => setField('customer_phone', e.target.value)} error={errors.customer_phone} placeholder="For delivery updates" required />
            </>
          )}

          {/* Step 2: Upload */}
          {step === 1 && (
            <>
              {errors.file && <p className="text-sm text-red">{errors.file}</p>}
              <UploadZone
                onFileReady={({ file, pageCount }) => {
                  setField('file', file)
                  setField('pageCount', pageCount)
                  setField('fileName', file?.name || '')
                }}
              />
              <p className="text-xs text-muted text-center leading-relaxed">
                🔒 Your file is encrypted, printed immediately, and permanently deleted. Nobody stores your documents.
              </p>
            </>
          )}

          {/* Step 3: Print options */}
          {step === 2 && (
            <>
              <div>
                <p className="text-base font-semibold text-ink mb-2">Print type</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'bw',    label: 'Black & White', rate: owner.bw_rate    },
                    { id: 'color', label: 'Colour',        rate: owner.color_rate }
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setField('print_type', opt.id)}
                      className={['flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-colors min-h-[80px]',
                        form.print_type === opt.id ? 'border-violet bg-violet/5' : 'border-border bg-bg hover:border-violet/40'].join(' ')}>
                      <Printer size={22} className={form.print_type === opt.id ? 'text-violet' : 'text-muted'} />
                      <span className="font-semibold text-ink text-sm">{opt.label}</span>
                      <span className="text-muted text-xs">{fmt(opt.rate)}/page</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-base font-semibold text-ink mb-2">Sides</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'single', label: 'Single sided', sub: 'One side per page' },
                    { id: 'double', label: 'Double sided', sub: 'Front & back'      }
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setField('sides', opt.id)}
                      className={['flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-colors min-h-[80px]',
                        form.sides === opt.id ? 'border-violet bg-violet/5' : 'border-border bg-bg hover:border-violet/40'].join(' ')}>
                      <Layers size={22} className={form.sides === opt.id ? 'text-violet' : 'text-muted'} />
                      <span className="font-semibold text-ink text-sm">{opt.label}</span>
                      <span className="text-muted text-xs">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-base font-semibold text-ink mb-2">Paper size</p>
                <div className="flex gap-2 flex-wrap">
                  {country.paper_sizes.map(size => (
                    <button key={size} onClick={() => setField('paper_size', size)}
                      className={['px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[48px]',
                        form.paper_size === size ? 'border-violet bg-violet/5 text-violet' : 'border-border bg-bg text-muted hover:border-violet/40'].join(' ')}>
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-base font-semibold text-ink mb-2">Copies</p>
                <div className="flex items-center justify-center gap-6 py-2">
                  <button onClick={() => setField('copies', Math.max(1, form.copies - 1))}
                    className="w-11 h-11 rounded-xl border-2 border-border bg-bg text-ink text-2xl font-bold flex items-center justify-center hover:border-violet/40">−</button>
                  <span className="text-3xl font-bold text-ink w-10 text-center">{form.copies}</span>
                  <button onClick={() => setField('copies', Math.min(20, form.copies + 1))}
                    className="w-11 h-11 rounded-xl border-2 border-border bg-bg text-ink text-2xl font-bold flex items-center justify-center hover:border-violet/40">+</button>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-ink mb-2">
                  Printing instructions <span className="text-sm font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="e.g. Staple pages, print page 2 only, landscape mode…"
                  maxLength={300} rows={3}
                  className="w-full border border-border rounded-xl px-4 py-3 text-base bg-bg text-ink focus:outline-none focus:ring-2 focus:ring-violet/40 resize-none placeholder:text-muted"
                />
                {form.notes.length > 0 && (
                  <p className="text-xs text-muted text-right mt-1">{form.notes.length}/300</p>
                )}
              </div>
            </>
          )}

          {/* Step 4: Price & payment */}
          {step === 3 && (
            <>
              <PriceBreakdown
                pages={pages}
                copies={form.copies}
                ratePerPage={ratePerPage}
                deliveryFee={effectiveDeliveryFee}
                countryCode={countryCode}
              />
              {isShop && owner.delivery_fee_tiers?.length > 0 && (
                <div className="bg-amber/10 border border-amber/20 rounded-xl px-4 py-3 text-sm text-amber leading-snug">
                  Delivery fee is based on your distance and will be confirmed by the shop when they accept your order.
                </div>
              )}
              {paymentMethods.length > 1 && (
                <div>
                  <p className="text-base font-semibold text-ink mb-2">Payment method</p>
                  <div className="flex gap-3">
                    {paymentMethods.map(m => (
                      <button key={m.id} onClick={() => setField('payment_method', m.id)}
                        className={['flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[52px]',
                          form.payment_method === m.id ? 'border-violet bg-violet/5 text-violet' : 'border-border bg-bg text-muted'].join(' ')}>
                        {m.id === 'upi' ? <><Smartphone size={16} /> UPI</> : <><Banknote size={16} /> Cash</>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.payment_method === 'upi' && owner.upi_id && (
                <p className="text-sm text-muted text-center">You'll be shown the UPI payment details after placing your order.</p>
              )}
              {form.payment_method === 'cash' && (
                <div className="bg-amber/10 border border-amber/30 rounded-xl p-3 text-sm text-amber font-medium">
                  Pay {fmt(breakdown.total)} in cash when {owner.name.split(' ')[0]} delivers your printout.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-border px-4 py-3 z-20">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={() => setStep(s => s - 1)} className="flex-shrink-0">
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="md" onClick={handleNext} className="flex-1">
              Continue
            </Button>
          ) : (
            <Button size="md" onClick={handleSubmit} loading={submitting} className="flex-1">
              {submitting ? 'Placing order...' : t('shop.place_order', { amount: fmt(breakdown.total) })}
            </Button>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
