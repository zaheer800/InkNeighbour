import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Printer, Zap, Clock, Users, Smartphone, Banknote,
  Copy as CopyIcon, Layers, Search, Phone, MessageCircle, Navigation
} from 'lucide-react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl         from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl   from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl       from 'leaflet/dist/images/marker-shadow.png'
import AppNav from '../components/AppNav'
import Footer from '../components/Footer'
import ServiceDisplayMenu from '../components/ServiceDisplayMenu'
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

// Fix leaflet default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

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
    notes: '', payment_method: ''
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
                .select('reliability_score, active_jobs_count, max_active_jobs, avg_response_minutes')
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
            feedback(star_rating),
            service_menu(service_code, is_enabled, display_price),
            delivery_fee_tiers(max_km, fee)
          `)
          .eq('slug', slug)
          .eq('provider_type', 'shop')
          .maybeSingle()

        if (shopOwner && shopOwner.status !== 'inactive') {
          setShopData({ owner: shopOwner, society: null })
          const { data: rel } = await supabase
            .from('owner_reliability')
            .select('reliability_score, active_jobs_count, max_active_jobs, avg_response_minutes')
            .eq('owner_id', shopOwner.id)
            .maybeSingle()
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
    : null

  const paymentMethods = getPaymentMethods(countryCode, owner)
  const ratePerPage    = getRatePerPage(form.print_type, owner)
  const pages          = form.pageCount || 1

  // For print shops, compute delivery fee from tiers based on a flat assumption
  // (the shop page shows estimated price; actual is confirmed by owner).
  const effectiveDeliveryFee = isShop
    ? (owner.delivery_fee_tiers?.length
        ? Math.min(...owner.delivery_fee_tiers.map(t => t.fee))
        : owner.delivery_fee ?? 0)
    : owner.delivery_fee

  const breakdown = getPriceBreakdown(pages, form.copies, ratePerPage, effectiveDeliveryFee)

  const activeCount = reliability?.active_jobs_count ?? 0
  const maxJobs     = reliability?.max_active_jobs ?? owner.max_active_jobs ?? 3
  const isAtJobLimit = activeCount >= maxJobs

  const avgMins         = reliability?.avg_response_minutes ? parseFloat(reliability.avg_response_minutes) : null
  const reliabilityScore = reliability?.reliability_score   ? parseFloat(reliability.reliability_score)    : null

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
          delivery_pin: deliveryPin
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

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav back={sessionStorage.getItem('find_back') || undefined} />

      {/* ── Shop header ────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#1A1A2E' }} className="px-4 py-5 text-white">
        <div className="max-w-lg mx-auto space-y-2">
          <h1 className="font-display text-xl font-bold leading-tight">{shopTitle}</h1>
          <p className="text-white/60 text-sm">{t('shop.managed_by', { name: owner.name.split(' ')[0] })}</p>
          {isShop && owner.locality && (
            <p className="text-white/50 text-xs">{[owner.locality, owner.landmark].filter(Boolean).join(' · ')}</p>
          )}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="bg-white/15 border border-white/20 px-2.5 py-1 rounded-full font-medium">B&W {fmt(owner.bw_rate)}/pg</span>
            <span className="bg-white/15 border border-white/20 px-2.5 py-1 rounded-full font-medium">Colour {fmt(owner.color_rate)}/pg</span>
            <span className="bg-white/15 border border-white/20 px-2.5 py-1 rounded-full font-medium">{deliveryHeaderCopy()}</span>
          </div>
          {rating && <StarDisplay rating={parseFloat(rating.avg)} count={rating.count} className="text-white" />}

          {signal && (
            <div className={[
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
              signal.type === 'fast' ? 'bg-green/20 text-green-100' :
              signal.type === 'slow' ? 'bg-amber/20 text-amber-100' :
              'bg-white/10 text-white/80'
            ].join(' ')}>
              <signal.icon size={12} />
              {signal.type === 'fast'   ? t('transparency.fast',   { minutes: Math.round(avgMins) }) :
               signal.type === 'normal' ? t('transparency.normal', { minutes: Math.round(avgMins) }) :
               signal.type === 'slow'   ? t('transparency.slow',   { minutes: Math.round(avgMins) }) :
               t('transparency.busy')}
            </div>
          )}

          {/* Find another printer */}
          {society?.postal_code && (
            <Link
              to={`/find?pincode=${society.postal_code}`}
              className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors"
            >
              <Search size={12} />
              Find another printer in {society.postal_code}
            </Link>
          )}

          {/* Order progress bar */}
          <div className="flex gap-2 pt-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-orange' : 'bg-white/20'}`} />
            ))}
          </div>
          <p className="text-white/60 text-sm">{t('common.step_of', { current: step + 1, total: STEPS.length })} · {STEP_LABELS[STEPS[step]]}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pt-5 pb-24 space-y-4">

        {/* ── Print Shop info sections (shown before the order form) ────────── */}
        {isShop && (
          <>
            {/* Contact bar */}
            <div className="bg-surface rounded-xl shadow-card p-4">
              <p className="font-bold text-base text-ink mb-3">{t('shop.contact_title')}</p>
              <div className="grid grid-cols-3 gap-2">
                {owner.phone && (
                  <a
                    href={`tel:${owner.phone}`}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-bg hover:bg-violet/5 transition-colors text-center"
                  >
                    <Phone size={20} className="text-violet" />
                    <span className="text-xs font-semibold text-ink">{t('shop.contact_call')}</span>
                  </a>
                )}
                {owner.phone && (
                  <a
                    href={`https://wa.me/${owner.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-bg hover:bg-green/5 transition-colors text-center"
                  >
                    <MessageCircle size={20} className="text-green" />
                    <span className="text-xs font-semibold text-ink">{t('shop.contact_whatsapp')}</span>
                  </a>
                )}
                {owner.lat && owner.lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${owner.lat},${owner.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-bg hover:bg-sky/5 transition-colors text-center"
                  >
                    <Navigation size={20} className="text-sky" />
                    <span className="text-xs font-semibold text-ink">{t('shop.contact_directions')}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Static map pin */}
            {owner.lat && owner.lng && (
              <div className="bg-surface rounded-xl shadow-card overflow-hidden">
                <div className="h-44">
                  <MapContainer
                    center={[owner.lat, owner.lng]}
                    zoom={15}
                    scrollWheelZoom={false}
                    dragging={false}
                    touchZoom={false}
                    doubleClickZoom={false}
                    zoomControl={false}
                    attributionControl={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[owner.lat, owner.lng]} />
                  </MapContainer>
                </div>
                {owner.shop_address && (
                  <p className="px-4 py-3 text-sm text-muted">{owner.shop_address}</p>
                )}
              </div>
            )}

            {/* Services menu */}
            {owner.service_menu?.length > 0 && (
              <div className="bg-surface rounded-xl shadow-card p-4 space-y-3">
                <p className="font-bold text-base text-ink">{t('shop.services_title')}</p>
                <ServiceDisplayMenu services={owner.service_menu} />
              </div>
            )}

            {/* Delivery tiers */}
            {owner.delivery_fee_tiers?.length > 0 && (
              <div className="bg-surface rounded-xl shadow-card p-4 space-y-3">
                <p className="font-bold text-base text-ink">{t('shop.delivery_tiers_title')}</p>
                <div className="space-y-2">
                  {owner.delivery_fee_tiers
                    .slice()
                    .sort((a, b) => a.max_km - b.max_km)
                    .map((tier, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                        <span className="text-sm text-ink">Up to {tier.max_km} km</span>
                        <span className="text-sm font-semibold text-ink">
                          {tier.fee === 0 ? 'Free' : fmt(tier.fee)}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Order form ───────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-xl shadow-card p-4 space-y-4">
          {/* Step 1: Customer details */}
          {step === 0 && (
            <>
              <Input label={t('shop.name_label')} value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} error={errors.customer_name} placeholder="Your full name" required autoFocus />
              <Input label={`${country.flat_label} number`} value={form.customer_flat} onChange={e => setField('customer_flat', e.target.value)} error={errors.customer_flat} placeholder="e.g. B-302" required />
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
                Your document is deleted from our servers as soon as the job is marked delivered or cancelled.
              </p>
            </>
          )}

          {/* Step 3: Print options */}
          {step === 2 && (
            <>
              {/* Print type */}
              <div>
                <p className="text-base font-semibold text-ink mb-2">Print type</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'bw',    label: 'Black & White', rate: owner.bw_rate    },
                    { id: 'color', label: 'Colour',        rate: owner.color_rate }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setField('print_type', opt.id)}
                      className={[
                        'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-colors min-h-[80px]',
                        form.print_type === opt.id ? 'border-violet bg-violet/5' : 'border-border bg-bg hover:border-violet/40'
                      ].join(' ')}
                    >
                      <Printer size={22} className={form.print_type === opt.id ? 'text-violet' : 'text-muted'} />
                      <span className="font-semibold text-ink text-sm">{opt.label}</span>
                      <span className="text-muted text-xs">{fmt(opt.rate)}/page</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sides */}
              <div>
                <p className="text-base font-semibold text-ink mb-2">Sides</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'single', label: 'Single sided', sub: 'One side per page' },
                    { id: 'double', label: 'Double sided', sub: 'Front & back'      }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setField('sides', opt.id)}
                      className={[
                        'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-colors min-h-[80px]',
                        form.sides === opt.id ? 'border-violet bg-violet/5' : 'border-border bg-bg hover:border-violet/40'
                      ].join(' ')}
                    >
                      <Layers size={22} className={form.sides === opt.id ? 'text-violet' : 'text-muted'} />
                      <span className="font-semibold text-ink text-sm">{opt.label}</span>
                      <span className="text-muted text-xs">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paper size */}
              <div>
                <p className="text-base font-semibold text-ink mb-2">Paper size</p>
                <div className="flex gap-2 flex-wrap">
                  {country.paper_sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setField('paper_size', size)}
                      className={[
                        'px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[44px]',
                        form.paper_size === size ? 'border-violet bg-violet/5 text-violet' : 'border-border bg-bg text-muted hover:border-violet/40'
                      ].join(' ')}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Copies */}
              <div>
                <p className="text-base font-semibold text-ink mb-2">Copies</p>
                <div className="flex items-center justify-center gap-6 py-2">
                  <button
                    onClick={() => setField('copies', Math.max(1, form.copies - 1))}
                    className="w-11 h-11 rounded-xl border-2 border-border bg-bg text-ink text-2xl font-bold flex items-center justify-center hover:border-violet/40"
                  >−</button>
                  <span className="text-3xl font-bold text-ink w-10 text-center">{form.copies}</span>
                  <button
                    onClick={() => setField('copies', Math.min(20, form.copies + 1))}
                    className="w-11 h-11 rounded-xl border-2 border-border bg-bg text-ink text-2xl font-bold flex items-center justify-center hover:border-violet/40"
                  >+</button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-base font-semibold text-ink mb-2">
                  Printing instructions <span className="text-sm font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="e.g. Staple pages, print page 2 only, landscape mode…"
                  maxLength={300}
                  rows={3}
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
                <p className="text-xs text-muted text-center">
                  {t('shop.delivery_fee_estimated')}
                </p>
              )}

              {paymentMethods.length > 1 && (
                <div>
                  <p className="text-base font-semibold text-ink mb-2">Payment method</p>
                  <div className="flex gap-3">
                    {paymentMethods.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setField('payment_method', m.id)}
                        className={[
                          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[52px]',
                          form.payment_method === m.id ? 'border-violet bg-violet/5 text-violet' : 'border-border bg-bg text-muted'
                        ].join(' ')}
                      >
                        {m.id === 'upi'
                          ? <><Smartphone size={16} /> UPI</>
                          : <><Banknote   size={16} /> Cash</>
                        }
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

      {/* Sticky nav buttons */}
      <div className="sticky bottom-0 bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 z-10">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} className="flex-shrink-0">
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={handleNext} className="flex-1">
              Next
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} loading={submitting} className="flex-1">
              {submitting ? 'Placing order...' : t('shop.place_order', { amount: fmt(breakdown.total) })}
            </Button>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
