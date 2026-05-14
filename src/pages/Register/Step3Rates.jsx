import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Rocket, Plus, X, Clock } from 'lucide-react'
import AppNav from '../../components/AppNav'
import { toast } from 'sonner'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { supabase } from '../../lib/supabase'
import { makeShopSlug } from '../../lib/slugify'
import Footer from '../../components/Footer'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_HOURS = [
  { enabled: false, start: '09:00', end: '21:00' }, // 0 Sun
  { enabled: true,  start: '09:00', end: '21:00' }, // 1 Mon
  { enabled: true,  start: '09:00', end: '21:00' }, // 2 Tue
  { enabled: true,  start: '09:00', end: '21:00' }, // 3 Wed
  { enabled: true,  start: '09:00', end: '21:00' }, // 4 Thu
  { enabled: true,  start: '09:00', end: '21:00' }, // 5 Fri
  { enabled: true,  start: '09:00', end: '14:00' }, // 6 Sat
]

const DEFAULT_TIERS = [
  { max_km: '1.0', fee: '15' },
  { max_km: '2.0', fee: '25' },
  { max_km: '3.0', fee: '35' },
]

export default function Step3Rates() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [step1, setStep1] = useState(null)
  const [step2, setStep2] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  const [form, setForm] = useState({
    shop_name:      '',
    bw_rate:        '2',
    color_rate:     '5',
    delivery_fee:   '8',    // home owners only (flat)
    upi_id:         '',
    accept_cash:    true,
    max_active_jobs: '3',
    // shop only
    delivery_tiers: DEFAULT_TIERS,
    hours:          DEFAULT_HOURS,
  })

  useEffect(() => {
    const s1 = sessionStorage.getItem('reg_step1')
    const s2 = sessionStorage.getItem('reg_step2')
    if (!s1 || !s2) { navigate('/register'); return }
    const p1 = JSON.parse(s1)
    const p2 = JSON.parse(s2)
    setStep1(p1)
    setStep2(p2)

    const isShop = p1.provider_type === 'shop'

    // Pre-fill shop name
    const defaultShopName = isShop
      ? (p1.shop_name || '')
      : (p2.society?.name ? `${p2.society.name} Print Shop` : '')

    supabase.from('platform_config').select('key, value').then(({ data: config }) => {
      if (!config?.length) return
      const get = (key, fallback) => {
        const row = config.find(c => c.key === key)
        return row ? parseInt(row.value) : fallback
      }
      const bw       = isShop ? get('default_bw_rate_shop',    300) : get('default_bw_rate_home',    200)
      const col      = isShop ? get('default_color_rate_shop',  800) : get('default_color_rate_home',  500)
      const del      = get('default_delivery_fee', 800)
      const maxJobs  = isShop ? get('default_max_jobs_shop', 10) : get('default_max_jobs_home', 3)

      setForm(f => ({
        ...f,
        shop_name:       defaultShopName,
        bw_rate:         (bw  / 100).toString(),
        color_rate:      (col / 100).toString(),
        delivery_fee:    (del / 100).toString(),
        max_active_jobs: maxJobs.toString(),
      }))
    })
  }, [navigate])

  // ── Helpers ──────────────────────────────────────────────────────────────
  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function setTier(i, field, value) {
    setForm(f => {
      const tiers = f.delivery_tiers.map((t, idx) => idx === i ? { ...t, [field]: value } : t)
      return { ...f, delivery_tiers: tiers }
    })
    setErrors(e => ({ ...e, delivery_tiers: undefined }))
  }

  function addTier() {
    setForm(f => ({
      ...f,
      delivery_tiers: [...f.delivery_tiers, { max_km: '', fee: '' }]
    }))
  }

  function removeTier(i) {
    setForm(f => ({ ...f, delivery_tiers: f.delivery_tiers.filter((_, idx) => idx !== i) }))
  }

  function setHour(dow, field, value) {
    setForm(f => {
      const hours = f.hours.map((h, i) => i === dow ? { ...h, [field]: value } : h)
      return { ...f, hours }
    })
  }

  // ── Validation ───────────────────────────────────────────────────────────
  function validate() {
    const e = {}
    const isShop = step1?.provider_type === 'shop'

    const bw  = parseFloat(form.bw_rate)
    const col = parseFloat(form.color_rate)
    if (isNaN(bw)  || bw  <= 0) e.bw_rate    = 'Enter a valid B&W rate'
    if (isNaN(col) || col <= 0) e.color_rate  = 'Enter a valid colour rate'

    const maxJobs = parseInt(form.max_active_jobs)
    if (isNaN(maxJobs) || maxJobs < 1) e.max_active_jobs = 'Must be at least 1'

    if (!isShop) {
      const del = parseFloat(form.delivery_fee)
      if (isNaN(del) || del < 0) e.delivery_fee = 'Enter a valid delivery fee (0 for free)'
    }

    if (isShop) {
      if (form.delivery_tiers.length === 0) {
        e.delivery_tiers = 'Add at least one delivery distance band'
      } else {
        form.delivery_tiers.forEach((tier, i) => {
          const km  = parseFloat(tier.max_km)
          const fee = parseFloat(tier.fee)
          if (isNaN(km)  || km  <= 0) e[`tier_km_${i}`]  = 'Enter km > 0'
          if (isNaN(fee) || fee <  0) e[`tier_fee_${i}`] = 'Enter fee ≥ 0'
        })
      }
    }

    return e
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleLaunch() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSubmitting(true)
    const isShop = step1.provider_type === 'shop'

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    step1.email,
        password: step1.password,
        options:  { emailRedirectTo: `${window.location.origin}/dashboard` }
      })

      if (authError) {
        if (authError.status === 422 || authError.message?.toLowerCase().includes('already registered')) {
          sessionStorage.removeItem('reg_step1')
          sessionStorage.removeItem('reg_step2')
          throw new Error('An account already exists with this email. Please sign in instead.')
        }
        throw authError
      }
      if (authData.user?.identities?.length === 0) {
        sessionStorage.removeItem('reg_step1')
        sessionStorage.removeItem('reg_step2')
        throw new Error('An account already exists with this email. Please sign in instead.')
      }

      // Build the serialisable payload used by both immediate and deferred paths
      // Slug is needed for print shops; for home owners it's derived from society on Dashboard
      const pendingShopSlug = step1.provider_type === 'shop'
        ? makeShopSlug(form.shop_name.trim()) + '-' + (authData.user?.id || '').split('-')[0]
        : null

      const ownerPayload = {
        provider_type:  step1.provider_type,
        slug:           pendingShopSlug,
        name:           step1.name,
        phone:          step1.phone,
        country_code:   step1.country_code,
        shop_name:      form.shop_name.trim(),
        bw_rate:        Math.round(parseFloat(form.bw_rate)  * 100),
        color_rate:     Math.round(parseFloat(form.color_rate) * 100),
        upi_id:         form.upi_id.trim() || null,
        accept_cash:    form.accept_cash,
        max_active_jobs: parseInt(form.max_active_jobs),
        // Home-only
        isNewSociety:       isShop ? false : step2.isNew,
        societyId:          isShop ? null  : (step2.isNew ? null : step2.society?.id),
        societyName:        isShop ? null  : (step2.isNew ? step2.society?.name : null),
        societyPostalCode:  isShop ? null  : (step2.isNew ? step2.postalCode : null),
        flat_number:        isShop ? null  : (step1.flat_number || null),
        delivery_fee:       isShop ? 0     : Math.round(parseFloat(form.delivery_fee || '0') * 100),
        // Shop-only
        shop_address:    isShop ? (step1.shop_address || null) : null,
        gst_number:      isShop ? (step1.gst_number  || null) : null,
        locality:        isShop ? step2.locality : null,
        landmark:        isShop ? (step2.landmark || null) : null,
        lat:             isShop ? step2.lat : null,
        lng:             isShop ? step2.lng : null,
        delivery_tiers:  isShop ? form.delivery_tiers : null,
        operating_hours: isShop ? form.hours : null,
      }

      if (!authData.session) {
        // Deferred path: email confirmation enabled — store payload and wait
        localStorage.setItem('reg_pending', JSON.stringify(ownerPayload))
        sessionStorage.setItem('reg_success', JSON.stringify({
          ownerName: step1.name,
          pendingEmail: step1.email
        }))
        sessionStorage.removeItem('reg_step1')
        sessionStorage.removeItem('reg_step2')
        navigate('/register/success')
        return
      }

      // ── Immediate path ───────────────────────────────────────────────────
      const userId = authData.user.id

      const { data: existingOwner } = await supabase
        .from('owners').select('id').eq('user_id', userId).maybeSingle()
      if (existingOwner) {
        throw new Error('You already have a shop registered. Please log in to manage it.')
      }

      let societyId = null
      if (!isShop) {
        if (step2.isNew) {
          const slug = makeShopSlug(step2.society.name, step2.postalCode)
          const { data: soc, error: socErr } = await supabase
            .from('societies')
            .insert({ name: step2.society.name, slug, postal_code: step2.postalCode, country_code: step1.country_code })
            .select().single()

          if (socErr?.code === '23505') {
            const { data: ex } = await supabase.from('societies').select('id').eq('slug', slug).single()
            societyId = ex.id
          } else if (socErr) {
            throw socErr
          } else {
            societyId = soc.id
          }
        } else {
          societyId = step2.society.id
        }
      }

      const shopSlug = isShop
        ? makeShopSlug(ownerPayload.shop_name) + '-' + userId.split('-')[0]
        : null

      const ownerRow = isShop
        ? {
            user_id:         userId,
            provider_type:   'shop',
            slug:            shopSlug,
            name:            ownerPayload.name,
            phone:           ownerPayload.phone,
            shop_name:       ownerPayload.shop_name,
            shop_address:    ownerPayload.shop_address,
            gst_number:      ownerPayload.gst_number,
            locality:        ownerPayload.locality,
            landmark:        ownerPayload.landmark,
            lat:             ownerPayload.lat,
            lng:             ownerPayload.lng,
            bw_rate:         ownerPayload.bw_rate,
            color_rate:      ownerPayload.color_rate,
            upi_id:          ownerPayload.upi_id,
            accept_cash:     ownerPayload.accept_cash,
            country_code:    ownerPayload.country_code,
            max_active_jobs: ownerPayload.max_active_jobs,
          }
        : {
            user_id:         userId,
            provider_type:   'home',
            name:            ownerPayload.name,
            phone:           ownerPayload.phone,
            flat_number:     ownerPayload.flat_number,
            society_id:      societyId,
            shop_name:       ownerPayload.shop_name,
            bw_rate:         ownerPayload.bw_rate,
            color_rate:      ownerPayload.color_rate,
            delivery_fee:    ownerPayload.delivery_fee,
            upi_id:          ownerPayload.upi_id,
            accept_cash:     ownerPayload.accept_cash,
            country_code:    ownerPayload.country_code,
            max_active_jobs: ownerPayload.max_active_jobs,
          }

      const { data: newOwner, error: ownerErr } = await supabase
        .from('owners').insert(ownerRow).select('id').single()

      if (ownerErr) {
        if (ownerErr.code === '23505') {
          if (ownerErr.message?.includes('phone'))   throw new Error('This phone number is already registered to another shop.')
          if (ownerErr.message?.includes('user_id')) { sessionStorage.removeItem('reg_step1'); sessionStorage.removeItem('reg_step2'); throw new Error('You already have a shop registered.') }
          throw new Error('This society already has a registered owner.')
        }
        throw ownerErr
      }

      if (isShop && newOwner) {
        const tiersToInsert = form.delivery_tiers
          .filter(t => parseFloat(t.max_km) > 0)
          .map(t => ({
            owner_id: newOwner.id,
            max_km:   parseFloat(t.max_km),
            fee:      Math.round(parseFloat(t.fee) * 100),
          }))
        if (tiersToInsert.length > 0) {
          await supabase.from('delivery_fee_tiers').insert(tiersToInsert)
        }

        await supabase.rpc('seed_service_menu', { p_owner_id: newOwner.id })

        const scheduleRows = form.hours
          .map((h, dow) => h.enabled ? { owner_id: newOwner.id, day_of_week: dow, start_time: h.start + ':00', end_time: h.end + ':00' } : null)
          .filter(Boolean)
        if (scheduleRows.length > 0) {
          await supabase.from('availability_schedules').insert(scheduleRows)
        }
      }

      await supabase.functions.invoke('notify-admin', {
        body: {
          owner_name:   ownerPayload.name,
          shop_name:    ownerPayload.shop_name,
          society_name: ownerPayload.societyName || ownerPayload.locality,
          email:        step1.email,
          phone:        ownerPayload.phone,
          admin_url:    `${window.location.origin}/admin`,
        }
      })

      sessionStorage.setItem('reg_success', JSON.stringify({ ownerName: step1.name }))
      sessionStorage.removeItem('reg_step1')
      sessionStorage.removeItem('reg_step2')
      navigate('/register/success')
    } catch (err) {
      toast.error(err.message || t('errors.network'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!step1 || !step2) return null

  const isShop = step1.provider_type === 'shop'

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden">
      <AppNav back="/register/society" />
      <div className="flex-1">
        <div className="page-hero px-4 py-6 text-white relative">
          <div className="relative z-10 max-w-lg mx-auto">
            <p className="text-white/60 text-sm font-medium mb-1">{t('common.step_of', { current: 3, total: 3 })}</p>
            <h1 className="font-display text-3xl font-bold">{t('register.step3_title')}</h1>
            <div className="flex gap-2 mt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-1.5 flex-1 rounded-full bg-orange" />
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

          {/* Shop name */}
          <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
            <h2 className="font-bold text-lg text-ink">Shop details</h2>
            <Input
              label="Shop name"
              value={form.shop_name}
              onChange={e => set('shop_name', e.target.value)}
              error={errors.shop_name}
              placeholder="e.g. Quick Print Tarnaka"
              hint="This is what customers will see"
              required
            />
          </div>

          {/* Print rates */}
          <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
            <h2 className="font-bold text-lg text-ink">Print rates</h2>
            <Input
              label={t('register.bw_rate_label')}
              type="number" inputMode="decimal"
              value={form.bw_rate}
              onChange={e => set('bw_rate', e.target.value)}
              error={errors.bw_rate}
              min="0" step="0.5"
            />
            <Input
              label={t('register.color_rate_label')}
              type="number" inputMode="decimal"
              value={form.color_rate}
              onChange={e => set('color_rate', e.target.value)}
              error={errors.color_rate}
              min="0" step="0.5"
            />
            {!isShop && (
              <Input
                label={t('register.delivery_fee_label')}
                type="number" inputMode="decimal"
                value={form.delivery_fee}
                onChange={e => set('delivery_fee', e.target.value)}
                error={errors.delivery_fee}
                min="0" step="1"
                hint="Set to 0 for free delivery"
              />
            )}
          </div>

          {/* Delivery tiers — shop only */}
          {isShop && (
            <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
              <div>
                <h2 className="font-bold text-lg text-ink">Delivery fees</h2>
                <p className="text-sm text-muted mt-0.5">Set your fee per distance band</p>
              </div>

              {errors.delivery_tiers && (
                <p className="text-sm text-red">{errors.delivery_tiers}</p>
              )}

              <div className="space-y-3">
                {form.delivery_tiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-muted shrink-0">Up to</span>
                    <input
                      type="number" inputMode="decimal"
                      value={tier.max_km}
                      onChange={e => setTier(i, 'max_km', e.target.value)}
                      placeholder="km"
                      min="0.1" step="0.5"
                      className={`w-20 min-h-[44px] px-3 rounded-xl border text-base text-center text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40 ${errors[`tier_km_${i}`] ? 'border-red' : 'border-border'}`}
                    />
                    <span className="text-sm text-muted shrink-0">km → ₹</span>
                    <input
                      type="number" inputMode="decimal"
                      value={tier.fee}
                      onChange={e => setTier(i, 'fee', e.target.value)}
                      placeholder="fee"
                      min="0" step="1"
                      className={`w-20 min-h-[44px] px-3 rounded-xl border text-base text-center text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40 ${errors[`tier_fee_${i}`] ? 'border-red' : 'border-border'}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      disabled={form.delivery_tiers.length <= 1}
                      className="text-muted hover:text-red transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-30"
                      aria-label="Remove tier"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addTier}
                className="flex items-center gap-1.5 text-sm font-semibold text-violet hover:text-violet/80 transition-colors min-h-[44px]"
              >
                <Plus size={16} />
                Add distance band
              </button>
            </div>
          )}

          {/* Operating hours — shop only */}
          {isShop && (
            <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-violet" />
                <h2 className="font-bold text-lg text-ink">Operating hours</h2>
              </div>

              <div className="space-y-2">
                {form.hours.map((h, dow) => (
                  <div key={dow} className="flex items-center gap-3 min-h-[48px]">
                    <label className="flex items-center gap-2 cursor-pointer w-14 shrink-0">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={e => setHour(dow, 'enabled', e.target.checked)}
                        className="w-4 h-4 accent-violet"
                      />
                      <span className="text-sm font-semibold text-ink">{DAY_NAMES[dow]}</span>
                    </label>

                    {h.enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={h.start}
                          onChange={e => setHour(dow, 'start', e.target.value)}
                          className="min-h-[40px] px-2 rounded-lg border border-border text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40"
                        />
                        <span className="text-muted text-sm">–</span>
                        <input
                          type="time"
                          value={h.end}
                          onChange={e => setHour(dow, 'end', e.target.value)}
                          className="min-h-[40px] px-2 rounded-lg border border-border text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted italic">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
            <h2 className="font-bold text-lg text-ink">Payment methods</h2>
            <Input
              label={t('register.upi_id_label')}
              value={form.upi_id}
              onChange={e => set('upi_id', e.target.value)}
              placeholder={t('register.upi_id_placeholder')}
              hint="Optional — allows customers to pay via UPI"
            />
            <label className="flex items-center gap-3 cursor-pointer min-h-[52px]">
              <input
                type="checkbox"
                checked={form.accept_cash}
                onChange={e => set('accept_cash', e.target.checked)}
                className="w-5 h-5 rounded accent-violet"
              />
              <span className="text-base font-medium text-ink">{t('register.accept_cash_label')}</span>
            </label>
          </div>

          {/* Active job limit — both types */}
          <div className="bg-surface rounded-xl shadow-card p-6 space-y-2">
            <h2 className="font-bold text-lg text-ink">Capacity</h2>
            <Input
              label="Maximum active jobs at once"
              type="number" inputMode="numeric"
              value={form.max_active_jobs}
              onChange={e => set('max_active_jobs', e.target.value)}
              error={errors.max_active_jobs}
              min="1" max="50" step="1"
              hint={isShop ? 'Default is 10 for print shops' : 'Default is 3 for home owners'}
            />
          </div>

          <Button onClick={handleLaunch} loading={submitting} className="w-full" size="lg">
            <Rocket size={18} />
            {submitting ? t('register.launching') : t('register.launch_cta')}
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  )
}
