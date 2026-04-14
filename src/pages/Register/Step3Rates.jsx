import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
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
    setStep1(JSON.parse(s1))
    setStep2(JSON.parse(s2))
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
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: step1.email,
        password: step1.password
      })
      if (authError) throw authError

      const userId = authData.user.id

      // 2. Upsert society
      let societyId
      if (step2.isNew) {
        const slug = makeShopSlug(step2.society.name, step2.postalCode)
        const { data: soc, error: socErr } = await supabase
          .from('societies')
          .insert({
            name: step2.society.name,
            slug,
            postal_code: step2.postalCode,
            country_code: step1.country_code
          })
          .select()
          .single()
        if (socErr) throw socErr
        societyId = soc.id
      } else {
        societyId = step2.society.id
      }

      // 3. Create owner record
      const shopSlug = makeShopSlug(
        step2.isNew ? step2.society.name : step2.society.name,
        step2.postalCode
      )

      const { data: owner, error: ownerErr } = await supabase
        .from('owners')
        .insert({
          user_id: userId,
          name: step1.name,
          phone: step1.phone,
          flat_number: step1.flat_number,
          society_id: societyId,
          shop_name: `${step2.isNew ? step2.society.name : step2.society.name} Print Shop`,
          status: 'active',
          bw_rate: Math.round(parseFloat(form.bw_rate) * 100),
          color_rate: Math.round(parseFloat(form.color_rate) * 100),
          delivery_fee: Math.round(parseFloat(form.delivery_fee || '0') * 100),
          upi_id: form.upi_id.trim() || null,
          accept_cash: form.accept_cash,
          country_code: step1.country_code
        })
        .select()
        .single()

      if (ownerErr) throw ownerErr

      // 4. Store success data and navigate
      sessionStorage.setItem('reg_success', JSON.stringify({
        shopUrl: `${import.meta.env.VITE_APP_URL}/${shopSlug}`,
        societyName: step2.isNew ? step2.society.name : step2.society.name,
        ownerName: step1.name
      }))
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

  const societyName = step2.isNew ? step2.society.name : step2.society.name
  const previewSlug = makeShopSlug(societyName, step2.postalCode)
  const appUrl = import.meta.env.VITE_APP_URL || 'https://inkneighbour.zakapedia.in'

  return (
    <div className="min-h-screen bg-bg">
      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-lg mx-auto">
          <Link to="/register/society" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
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

        {/* Shop URL preview */}
        <div className="bg-violet/10 border border-violet/30 rounded-xl p-4">
          <p className="text-sm font-semibold text-violet mb-1">Your shop URL will be:</p>
          <p className="font-mono text-sm text-ink break-all">{appUrl}/{previewSlug}</p>
        </div>

        <Button onClick={handleLaunch} loading={submitting} className="w-full" size="lg">
          {submitting ? t('register.launching') : t('register.launch_cta')}
        </Button>
      </div>
    </div>
  )
}
