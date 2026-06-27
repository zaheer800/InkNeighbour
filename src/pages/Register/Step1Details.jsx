import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import AppNav from '../../components/AppNav'
import Footer from '../../components/Footer'
import ProviderTypeSelector from '../../components/ProviderTypeSelector'
import { countryOptions, DEFAULT_COUNTRY, COUNTRIES } from '../../lib/countries'
import { supabase } from '../../lib/supabase'

const DIAL_OPTIONS = Object.values(COUNTRIES).map(c => ({
  countryCode: c.code,
  prefix: c.phone_prefix,
  label: `${c.phone_prefix} (${c.code})`
}))

const DEFAULT_FORM = {
  provider_type: '',
  name: '', phone: '', phoneDial: DEFAULT_COUNTRY, email: '', password: '',
  country_code: DEFAULT_COUNTRY,
  flat_number: '',
  shop_name: '',
  gst_number: '',
}

export default function Step1Details() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem('reg_step1')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Strip dial prefix from phone if it was stored as the full E.164 number
        // (happens when the user returns to Step 1 after a phone conflict in Step 3)
        const prefix = COUNTRIES[parsed.phoneDial || DEFAULT_COUNTRY]?.phone_prefix || ''
        if (prefix && typeof parsed.phone === 'string' && parsed.phone.startsWith(prefix)) {
          parsed.phone = parsed.phone.slice(prefix.length)
        }
        return parsed
      }
    } catch {}
    return DEFAULT_FORM
  })

  const [errors, setErrors]   = useState({})
  const [regError, setRegError] = useState(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const err = sessionStorage.getItem('reg_error')
    if (err) {
      setRegError(err)
      sessionStorage.removeItem('reg_error')
    }
  }, [])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}

    if (!form.provider_type) {
      e.provider_type = t('register.provider_validation')
    }

    if (!form.name.trim()) e.name = t('register.validation_required')

    const rawPhone = form.phone.replace(/\s/g, '')
    if (!rawPhone) {
      e.phone = t('register.validation_required')
    } else {
      const regex = COUNTRIES[form.phoneDial]?.phone_regex
      if (regex && !regex.test(rawPhone)) e.phone = t('register.validation_phone')
    }

    if (!form.email.trim()) e.email = t('register.validation_required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('register.validation_email')

    if (!form.password || form.password.length < 6) {
      e.password = t('register.validation_password_min')
    }

    if (form.provider_type === 'shop') {
      if (!form.shop_name.trim()) e.shop_name = t('register.validation_required')
    }

    return e
  }

  async function handleNext() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const prefix   = COUNTRIES[form.phoneDial]?.phone_prefix || ''
    const fullPhone = `${prefix}${form.phone.replace(/\s/g, '')}`

    // If we already created the auth account for this email (e.g., returned to Step 1
    // after a phone conflict in Step 3), skip the duplicate signUp call.
    const prevSaved = (() => { try { return JSON.parse(sessionStorage.getItem('reg_step1') || '{}') } catch { return {} } })()
    if (prevSaved._userId && prevSaved._signedUpEmail === form.email) {
      sessionStorage.setItem('reg_step1', JSON.stringify({
        ...form,
        phone:       fullPhone,
        _userId:     prevSaved._userId,
        _hasSession: prevSaved._hasSession,
        _signedUpEmail: form.email,
      }))
      navigate('/register/society')
      return
    }

    setChecking(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options:  { emailRedirectTo: `${window.location.origin}/dashboard` },
      })

      if (authError) {
        if (authError.status === 422 || authError.message?.toLowerCase().includes('already registered')) {
          setErrors(prev => ({ ...prev, email: 'An account with this email already exists. Sign in instead.' }))
          return
        }
        throw authError
      }

      // Supabase returns identities:[] when email confirmation is on and email is already taken
      if (authData.user?.identities?.length === 0) {
        setErrors(prev => ({ ...prev, email: 'An account with this email already exists. Sign in instead.' }))
        return
      }

      sessionStorage.setItem('reg_step1', JSON.stringify({
        ...form,
        phone:          fullPhone,
        _userId:        authData.user?.id,
        _hasSession:    !!authData.session,
        _signedUpEmail: form.email,
      }))
      navigate('/register/society')
    } catch (err) {
      toast.error(err.message || t('errors.network'))
    } finally {
      setChecking(false)
    }
  }

  const isShop = form.provider_type === 'shop'
  const isHome = form.provider_type === 'home'

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden">
      <AppNav back="/" />

      <div className="flex-1">
        {/* Back-navigation error banners */}
        {regError === 'society_taken' && (
          <div className="bg-amber/10 border-b border-amber/30 px-4 py-3">
            <p className="text-sm text-amber font-medium text-center max-w-lg mx-auto">
              Someone else registered that society while you were verifying your email. Please choose a different society.
            </p>
          </div>
        )}
        {regError === 'phone_taken' && (
          <div className="bg-red/10 border-b border-red/20 px-4 py-3">
            <p className="text-sm text-red font-medium text-center max-w-lg mx-auto">
              This phone number is already linked to another account. Please use a different number.
            </p>
          </div>
        )}

        {/* Hero */}
        <div className="page-hero px-4 py-6 text-white relative">
          <div className="relative z-10 max-w-lg mx-auto">
            <p className="text-white/60 text-sm font-medium mb-1">
              {t('common.step_of', { current: 1, total: 3 })}
            </p>
            <h1 className="font-display text-3xl font-bold">{t('register.step1_title')}</h1>
            <div className="flex gap-2 mt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 1 ? 'bg-orange' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

          {/* Provider type selector */}
          <ProviderTypeSelector
            value={form.provider_type}
            onChange={v => set('provider_type', v)}
            error={errors.provider_type}
          />

          {/* Common fields */}
          <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">

            <Input
              label={t('register.name_label')}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              error={errors.name}
              placeholder="Your full name"
              required
              autoComplete="name"
            />

            {/* Phone with dial-code selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-base font-semibold text-ink">
                {t('register.phone_label')} <span className="text-red">*</span>
              </label>
              <div className={`flex rounded-xl border ${errors.phone ? 'border-red' : 'border-border'} overflow-hidden focus-within:ring-2 focus-within:ring-violet/40 focus-within:border-violet`}>
                <select
                  value={form.phoneDial}
                  onChange={e => set('phoneDial', e.target.value)}
                  className="shrink-0 bg-bg text-ink text-base font-semibold px-3 min-h-[52px] border-r border-border focus:outline-none"
                >
                  {DIAL_OPTIONS.map(o => (
                    <option key={o.countryCode} value={o.countryCode}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder={form.phoneDial === 'IN' ? '98765 43210' : 'Phone number'}
                  className="flex-1 min-h-[52px] px-4 text-base text-ink bg-surface focus:outline-none"
                />
              </div>
              {errors.phone && <p className="text-sm text-red">{errors.phone}</p>}
            </div>

            <Input
              label={t('register.email_label')}
              value={form.email}
              onChange={e => set('email', e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
              required
              type="email"
              autoComplete="email"
            />

            <Input
              label={t('register.password_label')}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              error={errors.password}
              placeholder="At least 6 characters"
              required
              type="password"
              autoComplete="new-password"
            />

            {/* Country */}
            <div className="flex flex-col gap-1.5">
              <label className="text-base font-semibold text-ink">{t('register.country_label')}</label>
              <select
                value={form.country_code}
                onChange={e => set('country_code', e.target.value)}
                className="w-full min-h-[52px] px-4 py-3 rounded-xl border border-border text-base text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet"
              >
                {countryOptions().map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Home owner: flat number */}
          {isHome && (
            <div className="bg-surface rounded-xl shadow-card p-6">
              <Input
                label={t('register.flat_label')}
                value={form.flat_number}
                onChange={e => set('flat_number', e.target.value)}
                error={errors.flat_number}
                placeholder={t('register.flat_placeholder')}
                autoComplete="off"
              />
            </div>
          )}

          {/* Print shop: shop name, address, GST */}
          {isShop && (
            <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <span className="text-xl" aria-hidden="true">🏪</span>
                <p className="font-display font-bold text-ink">{t('register.shop_details_heading')}</p>
              </div>

              <Input
                label={t('register.shop_name_label')}
                value={form.shop_name}
                onChange={e => set('shop_name', e.target.value)}
                error={errors.shop_name}
                placeholder={t('register.shop_name_placeholder')}
                required
                autoComplete="organization"
              />

              <Input
                label={t('register.gst_label')}
                value={form.gst_number}
                onChange={e => set('gst_number', e.target.value)}
                error={errors.gst_number}
                placeholder={t('register.gst_placeholder')}
                autoComplete="off"
              />
            </div>
          )}

          <Button onClick={handleNext} loading={checking} disabled={checking} className="w-full" size="lg">
            {checking ? 'Checking…' : t('common.next')}
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  )
}
