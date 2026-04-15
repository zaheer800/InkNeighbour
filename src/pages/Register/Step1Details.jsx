import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { countryOptions, DEFAULT_COUNTRY } from '../../lib/countries'

export default function Step1Details() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '',
    flat_number: '', country_code: DEFAULT_COUNTRY
  })
  const [errors, setErrors] = useState({})

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = t('register.validation_required')
    if (!form.phone.trim()) e.phone = t('register.validation_required')
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, '')) && form.country_code === 'IN') {
      e.phone = t('register.validation_phone')
    }
    if (!form.email.trim()) e.email = t('register.validation_required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('register.validation_email')
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (!form.flat_number.trim()) e.flat_number = t('register.validation_required')
    return e
  }

  function handleNext() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    sessionStorage.setItem('reg_step1', JSON.stringify(form))
    navigate('/register/society')
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-lg mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <p className="text-white/60 text-sm font-medium mb-1">{t('common.step_of', { current: 1, total: 3 })}</p>
          <h1 className="font-display text-3xl font-bold">{t('register.step1_title')}</h1>

          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {[1,2,3].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 1 ? 'bg-orange' : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
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
          <Input
            label={t('register.phone_label')}
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            error={errors.phone}
            placeholder="10-digit mobile number"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />
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
          <Input
            label={t('register.flat_label')}
            value={form.flat_number}
            onChange={e => set('flat_number', e.target.value)}
            error={errors.flat_number}
            placeholder="e.g. A-204"
            required
          />

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

        <Button onClick={handleNext} className="w-full" size="lg">
          {t('common.next')} →
        </Button>
      </div>
    </div>
  )
}
