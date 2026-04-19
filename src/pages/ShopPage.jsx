import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Zap, Clock, Users, Smartphone, Banknote, Copy as CopyIcon, Layers, Search } from 'lucide-react'
import AppNav from '../components/AppNav'
import Footer from '../components/Footer'
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
    print_type: 'bw', paper_size: 'A4', copies: 1, sides: 'single',
    notes: '', payment_method: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('societies')
          .select(`id, slug, name, postal_code, owners!inner(id, name, shop_name, status, bw_rate, color_rate, delivery_fee, upi_id, accept_cash, country_code, phone, max_active_jobs)`)
          .eq('slug', slug)
          .maybeSingle()

        console.log('[ShopPage] slug:', slug, 'data:', data, 'error:', error)
        if (error || !data) return

        // Supabase returns owners as a single object (not array) when society_id is UNIQUE
        const normalizedData = {
          ...data,
          owners: data.owners
            ? Array.isArray(data.owners) ? data.owners : [data.owners]
            : []
        }
        if (!normalizedData.owners.length) return

        setShop(normalizedData)
        const owner = normalizedData.owners[0]

        if (owner?.id) {
          const { data: rel } = await supabase
            .from('owner_reliability')
            .select('reliability_score, active_jobs_count, max_active_jobs, avg_response_minutes')
            .eq('owner_id', owner.id)
            .maybeSingle()
          setReliability(rel || null)
        }

        const methods = getPaymentMethods(owner.country_code, owner)
        if (methods.length > 0) setForm(f => ({ ...f, payment_method: methods[0].id }))
      } catch {
        // leave shop null → "not found" message shown below
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('common.loading')}</p></div>
  if (!shop || !shop.owners?.length) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('errors.shop_not_found')}</p></div>


  const owner = shop.owners[0]
  const countryCode = owner.country_code || 'IN'
  const country = getCountry(countryCode)
  const fmt = v => formatCurrency(v, countryCode)

  const rating = null // ratings shown once owner_stats view has public GRANT

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
      const deliveryPin = String(Math.floor(1000 + Math.random() * 9000))
      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          id: jobId,
          job_number: jobNumber,
          owner_id: owner.id,
          society_id: shop.id,
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

      // Persist so customer can find tracking link after closing the browser
      localStorage.setItem('last_order', JSON.stringify({
        slug,
        jobId: job.id,
        jobNumber: job.job_number,
        shopName: owner.shop_name || shop.name,
        createdAt: new Date().toISOString()
      }))

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
          <p className="text-muted">
            {owner.status === 'pending' ? t('errors.shop_pending') : t('errors.shop_paused')}
          </p>
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
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Navbar */}
      <AppNav back={sessionStorage.getItem('find_back') || undefined} />

      {/* Shop header */}
      <div style={{ backgroundColor: '#1A1A2E' }} className="px-4 py-5 text-white">
        <div className="max-w-lg mx-auto space-y-2">
          <h1 className="font-display text-xl font-bold leading-tight">{owner.shop_name || shop.name + ' Print Shop'}</h1>
          <p className="text-white/60 text-sm">{t('shop.managed_by', { name: owner.name.split(' ')[0] })}</p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="bg-white/15 border border-white/20 px-2.5 py-1 rounded-full font-medium">B&W {fmt(owner.bw_rate)}/pg</span>
            <span className="bg-white/15 border border-white/20 px-2.5 py-1 rounded-full font-medium">Colour {fmt(owner.color_rate)}/pg</span>
            <span className="bg-white/15 border border-white/20 px-2.5 py-1 rounded-full font-medium">
              {owner.delivery_fee > 0 ? `Delivery ${fmt(owner.delivery_fee)}` : 'Free delivery'}
            </span>
          </div>
          {rating && <StarDisplay rating={parseFloat(rating.avg)} count={rating.count} className="text-white" />}

          {/* Transparency signal */}
          {signal && (
            <div className={[
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
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

          {/* Find another printer */}
          {shop.postal_code && (
            <Link
              to={`/find?pincode=${shop.postal_code}`}
              className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors"
            >
              <Search size={12} />
              Find another printer in {shop.postal_code}
            </Link>
          )}

          {/* Progress bar */}
          <div className="flex gap-2 pt-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-orange' : 'bg-white/20'}`} />
            ))}
          </div>
          <p className="text-white/60 text-sm">{t('common.step_of', { current: step + 1, total: STEPS.length })} · {STEP_LABELS[STEPS[step]]}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        <div className="bg-surface rounded-xl shadow-card p-4 space-y-4">
          {/* Step 1: Customer details */}
          {step === 0 && (
            <>
              <Input label={t('shop.name_label')} value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} error={errors.customer_name} placeholder="Your full name" required autoFocus />
              <Input label={`${country.flat_label} number`} value={form.customer_flat} onChange={e => setField('customer_flat', e.target.value)} error={errors.customer_flat} placeholder="e.g. B-302" required />
              <Input label={`${t('shop.phone_label')}`} type="tel" value={form.customer_phone} onChange={e => setField('customer_phone', e.target.value)} error={errors.customer_phone} placeholder="For WhatsApp delivery updates" required />
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
                Your document is deleted from our servers as soon as the job is marked delivered or cancelled. We do not retain any files.
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
                    { id: 'bw', label: 'Black & White', rate: owner.bw_rate },
                    { id: 'color', label: 'Colour', rate: owner.color_rate }
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
                    { id: 'double', label: 'Double sided', sub: 'Front & back' }
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

              {/* Printing instructions */}
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
                          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[52px]',
                          form.payment_method === m.id ? 'border-violet bg-violet/5 text-violet' : 'border-border bg-bg text-muted'
                        ].join(' ')}
                      >
                        {m.id === 'upi'
                          ? <><Smartphone size={16} /> UPI</>
                          : <><Banknote size={16} /> Cash</>
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
