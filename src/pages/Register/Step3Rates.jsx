import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Rocket } from 'lucide-react'
import AppNav from '../../components/AppNav'
import { toast } from 'sonner'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { supabase } from '../../lib/supabase'
import { makeShopSlug } from '../../lib/slugify'

const PLATFORM_DEFAULTS = { bw: 200, color: 500, delivery: 800 } // paise

export default function Step3Rates() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step1, setStep1] = useState(null)
  const [step2, setStep2] = useState(null)
  const [form, setForm] = useState({
    shop_name: '',
    bw_rate: '2',      // display in rupees
    color_rate: '5',
    delivery_fee: '8',
    upi_id: '',
    accept_cash: true
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const s1 = sessionStorage.getItem('reg_step1')
    const s2 = sessionStorage.getItem('reg_step2')
    if (!s1 || !s2) { navigate('/register'); return }
    const parsed2 = JSON.parse(s2)
    setStep1(JSON.parse(s1))
    setStep2(parsed2)
    setForm(f => ({ ...f, shop_name: `${parsed2.society.name} Print Shop` }))
  }, [navigate])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}
    const bw = parseFloat(form.bw_rate)
    const col = parseFloat(form.color_rate)
    if (isNaN(bw) || bw <= 0) e.bw_rate = 'Enter a valid B&W rate'
    if (isNaN(col) || col <= 0) e.color_rate = 'Enter a valid colour rate'
    return e
  }

  async function handleLaunch() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSubmitting(true)
    try {
      // 1. Create auth user FIRST — we need to know whether email confirmation
      //    is required before writing any other DB records.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: step1.email,
        password: step1.password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` }
      })
      if (authError) throw authError

      // Build the data we'll need whether we continue now or after email verification.
      const ownerPayload = {
        isNewSociety:       step2.isNew,
        societyId:          step2.isNew ? null : step2.society.id,
        societyName:        step2.isNew ? step2.society.name : null,
        societyPostalCode:  step2.isNew ? step2.postalCode : null,
        name:         step1.name,
        phone:        step1.phone,
        country_code: step1.country_code,
        shop_name:    form.shop_name.trim() || `${step2.society.name} Print Shop`,
        bw_rate:      Math.round(parseFloat(form.bw_rate) * 100),
        color_rate:   Math.round(parseFloat(form.color_rate) * 100),
        delivery_fee: Math.round(parseFloat(form.delivery_fee || '0') * 100),
        upi_id:       form.upi_id.trim() || null,
        accept_cash:  form.accept_cash,
      }

      if (!authData.session) {
        // Email confirmation is enabled — defer ALL DB writes (society + owner)
        // until the owner clicks the verification link and lands on /dashboard.
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

      // 2. No email confirmation — create society and owner now.
      let societyId
      if (step2.isNew) {
        const slug = makeShopSlug(step2.society.name, step2.postalCode)
        const { data: soc, error: socErr } = await supabase
          .from('societies')
          .insert({
            name:         step2.society.name,
            slug,
            postal_code:  step2.postalCode,
            country_code: step1.country_code
          })
          .select()
          .single()

        if (socErr) {
          // Duplicate slug: society was already created by a prior attempt.
          if (socErr.code === '23505') {
            const { data: existing, error: fetchErr } = await supabase
              .from('societies')
              .select('id')
              .eq('slug', slug)
              .single()
            if (fetchErr) throw fetchErr
            societyId = existing.id
          } else {
            throw socErr
          }
        } else {
          societyId = soc.id
        }
      } else {
        societyId = step2.society.id
      }

      const userId = authData.user.id

      // 3. Guard against duplicate shop for the same user
      const { data: existingOwner } = await supabase
        .from('owners')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existingOwner) {
        throw new Error('You already have a shop registered. Please log in to manage it.')
      }

      // 4. Create owner record (status defaults to 'pending' via DB constraint)
      const { error: ownerErr } = await supabase
        .from('owners')
        .insert({
          user_id:      userId,
          name:         ownerPayload.name,
          phone:        ownerPayload.phone,
          society_id:   societyId,
          shop_name:    ownerPayload.shop_name,
          bw_rate:      ownerPayload.bw_rate,
          color_rate:   ownerPayload.color_rate,
          delivery_fee: ownerPayload.delivery_fee,
          upi_id:       ownerPayload.upi_id,
          accept_cash:  ownerPayload.accept_cash,
          country_code: ownerPayload.country_code,
        })

      if (ownerErr) {
        if (ownerErr.code === '23505') {
          throw new Error('This society already has a registered printer owner. Please select a different society or contact support.')
        }
        throw ownerErr
      }

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

  return (
    <div className="min-h-screen bg-bg">
      <AppNav back="/register/society" />
      <div className="page-hero px-4 py-6 text-white relative">
        <div className="relative z-10 max-w-lg mx-auto">
          <p className="text-white/60 text-sm font-medium mb-1">{t('common.step_of', { current: 3, total: 3 })}</p>
          <h1 className="font-display text-3xl font-bold">{t('register.step3_title')}</h1>

          <div className="flex gap-2 mt-4">
            {[1,2,3].map(i => (
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
            placeholder="e.g. Sunshine Apartments Print Shop"
            hint="This is what customers will see when they visit your shop"
            required
          />
        </div>

        {/* Rates */}
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
          <h2 className="font-bold text-lg text-ink">Print rates</h2>
          <Input
            label={t('register.bw_rate_label')}
            type="number"
            value={form.bw_rate}
            onChange={e => set('bw_rate', e.target.value)}
            error={errors.bw_rate}
            min="0"
            step="0.5"
            hint={`Platform default: ₹${PLATFORM_DEFAULTS.bw / 100}/page`}
          />
          <Input
            label={t('register.color_rate_label')}
            type="number"
            value={form.color_rate}
            onChange={e => set('color_rate', e.target.value)}
            error={errors.color_rate}
            min="0"
            step="0.5"
            hint={`Platform default: ₹${PLATFORM_DEFAULTS.color / 100}/page`}
          />
          <Input
            label={t('register.delivery_fee_label')}
            type="number"
            value={form.delivery_fee}
            onChange={e => set('delivery_fee', e.target.value)}
            min="0"
            step="1"
            hint={`Platform default: ₹${PLATFORM_DEFAULTS.delivery / 100}`}
          />
        </div>

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

        <Button onClick={handleLaunch} loading={submitting} className="w-full" size="lg">
          <Rocket size={18} />
          {submitting ? t('register.launching') : t('register.launch_cta')}
        </Button>
      </div>
    </div>
  )
}
