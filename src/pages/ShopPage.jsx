import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Printer, Zap, Clock, Users } from 'lucide-react'
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

const STEPS = ['details', 'upload', 'options', 'payment']
const STEP_LABELS = { details: 'Your details', upload: 'Upload document', options: 'Print options', payment: 'Price & payment' }

export default function ShopPage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [shop, setShop] = useState(null)          // society row with owners join
  const [reliability, setReliability] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [form, setForm] = useState({
    customer_name: '', customer_flat: '', customer_phone: '',
    file: null, pageCount: null, fileName: '',
    print_type: 'bw', paper_size: 'A4', copies: 1,
    payment_method: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    supabase
      .from('societies')
      .select(`id, slug, name, owners!inner(id, name, shop_name, status, bw_rate, color_rate, delivery_fee, upi_id, accept_cash, country_code, phone, max_active_jobs, feedback(star_rating))`)
      .eq('slug', slug)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { setLoading(false); return }
        setShop(data)

        const owner = data.owners[0]
        if (owner?.id) {
          const { data: rel } = await supabase
            .from('owner_reliability')
            .select('reliability_score, active_jobs_count, max_active_jobs, avg_response_minutes')
            .eq('owner_id', owner.id)
            .single()
          setReliability(rel || null)
        }

        // Set default payment method
        const methods = getPaymentMethods(owner.country_code, owner)
        if (methods.length > 0) setForm(f => ({ ...f, payment_method: methods[0].id }))
        setLoading(false)
      })
  }, [slug])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('common.loading')}</p></div>
  if (!shop || !shop.owners?.length) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('errors.shop_not_found')}</p></div>

  const owner = shop.owners[0]
  const countryCode = owner.country_code || 'IN'
  const country = getCountry(countryCode)
  const fmt = v => formatCurrency(v, countryCode)

  const rating = (() => {
    const fb = owner.feedback
    if (!fb?.length || fb.length < 3) return null
    const avg = fb.reduce((s, f) => s + f.star_rating, 0) / fb.length
    return { avg: avg.toFixed(1), count: fb.length }
  })()

  const paymentMethods = getPaymentMethods(countryCode, owner)
  const ratePerPage = getRatePerPage(form.print_type, owner)
  const pages = form.pageCount || 1
  const breakdown = getPriceBreakdown(pages, form.copies, ratePerPage, owner.delivery_fee)

  // Job limit check: rely on server-side view
  const activeCount = reliability?.active_jobs_count ?? 0
  const maxJobs = reliability?.max_active_jobs ?? owner.max_active_jobs ?? 3
  const isAtJobLimit = activeCount >= maxJobs

  // Transparency signals
  const avgMins = reliability?.avg_response_minutes
    ? parseFloat(reliability.avg_response_minutes)
    : null
  const reliabilityScore = reliability?.reliability_score
    ? parseFloat(reliability.reliability_score)
    : null

  function getTransparencySignal() {
    if (isAtJobLimit) return { type: 'busy', icon: Users }
    if (avgMins !== null) {
      if (avgMins <= 5) return { type: 'fast', icon: Zap }
      if (avgMins <= 12) return { type: 'normal', icon: Clock }
      return { type: 'slow', icon: Clock }
    }
    return null
  }
  const signal = getTransparencySignal()

  function setField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validateStep() {
    if (step === 0) {
      const e = {}
      if (!form.customer_name.trim()) e.customer_name = t('register.validation_required')
      if (!form.customer_flat.trim()) e.customer_flat = t('register.validation_required')
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
      // 1. Upload file to Supabase Storage
      const jobId = crypto.randomUUID()
      let filePath = null
      if (form.file) {
        filePath = `${jobId}/${form.file.name}`
        const { error: uploadErr } = await supabase.storage
          .from('job-files')
          .upload(filePath, form.file)
        if (uploadErr) throw uploadErr
      }

      // 2. Get next job number
      const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true })
      const jobNumber = `INK-${String((count || 0) + 1).padStart(4, '0')}`

      // 3. Insert job — society_id comes from the shop (society) row
      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          id: jobId,
          job_number: jobNumber,
          owner_id: owner.id,
          society_id: shop.id,   // fixed: use the resolved society ID
          customer_name: form.customer_name,
          customer_flat: form.customer_flat,
          customer_phone: form.customer_phone || null,
          file_path: filePath,
          file_name: form.file?.name || null,
          page_count: form.pageCount,
          print_type: form.print_type,
          paper_size: form.paper_size,
          copies: form.copies,
          total_amount: breakdown.total,
          payment_method: form.payment_method,
          payment_status: 'pending',
          status: 'submitted'
        })
        .select()
        .single()

      if (jobErr) throw jobErr
      navigate(`/${slug}/confirm/${job.id}`)
    } catch (err) {
      toast.error(err.message || t('errors.network'))
    } finally {
      setSubmitting(false)
    }
  }

  if (owner.status !== 'active') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <Printer size={48} className="text-muted mx-auto" />
          <h1 className="font-display text-2xl font-bold text-ink">{owner.shop_name || shop.name + ' Print Shop'}</h1>
          <Badge status={owner.status} />
          <p className="text-muted">{t('errors.shop_paused')}</p>
        </div>
      </div>
    )
  }

  // Owner is at active job limit — show busy notice instead of order form
  if (isAtJobLimit) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber/10 flex items-center justify-center mx-auto">
            <Users size={32} className="text-amber" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">{owner.shop_name || shop.name + ' Print Shop'}</h1>
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

  return (
    <div className="min-h-screen bg-bg">
      {/* Shop header */}
      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-lg mx-auto space-y-2">
          <h1 className="font-display text-3xl font-bold">{owner.shop_name || shop.name + ' Print Shop'}</h1>
          <p className="text-white/70">{t('shop.managed_by', { name: owner.name.split(' ')[0] })}</p>
          <div className="flex flex-wrap gap-2 text-sm mt-2">
            <span className="bg-white/10 px-3 py-1 rounded-pill">B&W {fmt(owner.bw_rate)}/page</span>
            <span className="bg-white/10 px-3 py-1 rounded-pill">Colour {fmt(owner.color_rate)}/page</span>
            <span className="bg-white/10 px-3 py-1 rounded-pill">
              {owner.delivery_fee > 0 ? `Delivery ${fmt(owner.delivery_fee)}` : 'Free delivery'}
            </span>
          </div>
          {rating && <StarDisplay rating={parseFloat(rating.avg)} count={rating.count} className="text-white" />}

          {/* Transparency signal */}
          {signal && (
            <div className={[
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mt-1',
              signal.type === 'fast'   ? 'bg-green/20 text-green-100'  :
              signal.type === 'slow'   ? 'bg-amber/20 text-amber-100'  :
              'bg-white/10 text-white/80'
            ].join(' ')}>
              <signal.icon size={12} />
              {signal.type === 'fast'   ? t('transparency.fast',   { minutes: Math.round(avgMins) }) :
               signal.type === 'normal' ? t('transparency.normal', { minutes: Math.round(avgMins) }) :
               signal.type === 'slow'   ? t('transparency.slow',   { minutes: Math.round(avgMins) }) :
               t('transparency.busy')}
            </div>
          )}

          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-orange' : 'bg-white/20'}`} />
            ))}
          </div>
          <p className="text-white/60 text-sm">{t('common.step_of', { current: step + 1, total: STEPS.length })} · {STEP_LABELS[STEPS[step]]}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
          {/* Step 1: Customer details */}
          {step === 0 && (
            <>
              <Input label={t('shop.name_label')} value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} error={errors.customer_name} placeholder="Your full name" required autoFocus />
              <Input label={`${country.flat_label} number`} value={form.customer_flat} onChange={e => setField('customer_flat', e.target.value)} error={errors.customer_flat} placeholder="e.g. B-302" required />
              <Input label={`${t('shop.phone_label')}`} type="tel" value={form.customer_phone} onChange={e => setField('customer_phone', e.target.value)} placeholder="Optional — for delivery updates" />
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
            </>
          )}

          {/* Step 3: Print options */}
          {step === 2 && (
            <>
              <div>
                <p className="text-base font-semibold text-ink mb-2">Print type</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'bw', label: '⬛ Black & White', rate: owner.bw_rate },
                    { id: 'color', label: '🌈 Colour', rate: owner.color_rate }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setField('print_type', opt.id)}
                      className={[
                        'flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-colors min-h-[80px]',
                        form.print_type === opt.id ? 'border-violet bg-violet/5' : 'border-border bg-bg hover:border-violet/40'
                      ].join(' ')}
                    >
                      <span className="text-2xl">{opt.id === 'bw' ? '⬛' : '🌈'}</span>
                      <span className="font-semibold text-ink text-sm">{opt.id === 'bw' ? 'Black & White' : 'Colour'}</span>
                      <span className="text-muted text-xs">{fmt(opt.rate)}/page</span>
                    </button>
                  ))}
                </div>
              </div>

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

              <div>
                <p className="text-base font-semibold text-ink mb-2">Copies</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setField('copies', Math.max(1, form.copies - 1))}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-bg text-ink text-2xl font-bold flex items-center justify-center hover:border-violet/40"
                  >−</button>
                  <span className="text-2xl font-bold text-ink w-8 text-center">{form.copies}</span>
                  <button
                    onClick={() => setField('copies', Math.min(20, form.copies + 1))}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-bg text-ink text-2xl font-bold flex items-center justify-center hover:border-violet/40"
                  >+</button>
                </div>
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
                deliveryFee={owner.delivery_fee}
                countryCode={countryCode}
              />

              {paymentMethods.length > 1 && (
                <div>
                  <p className="text-base font-semibold text-ink mb-2">Payment method</p>
                  <div className="flex gap-3">
                    {paymentMethods.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setField('payment_method', m.id)}
                        className={[
                          'flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[52px]',
                          form.payment_method === m.id ? 'border-violet bg-violet/5 text-violet' : 'border-border bg-bg text-muted'
                        ].join(' ')}
                      >
                        {m.id === 'upi' ? '📱 UPI' : '💵 Cash'}
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

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="flex-shrink-0">
              <ArrowLeft size={18} /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} className="flex-1">
              Next <ArrowRight size={18} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={submitting} className="flex-1" size="lg">
              {submitting ? 'Placing order...' : t('shop.place_order', { amount: fmt(breakdown.total) })}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
