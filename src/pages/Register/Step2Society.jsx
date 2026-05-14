import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import AppNav from '../../components/AppNav'
import SocietySearch from '../../components/SocietySearch'
import ShopLocationMap from '../../components/ShopLocationMap'
import Footer from '../../components/Footer'
import { Info } from 'lucide-react'

export default function Step2Society() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [step1, setStep1] = useState(null)

  // ── Home owner state ─────────────────────────────────────────────────────
  const [postalCode, setPostalCode]   = useState('')
  const [postalError, setPostalError] = useState('')

  // ── Print shop state ─────────────────────────────────────────────────────
  const [shopForm, setShopForm] = useState({ locality: '', landmark: '', lat: null, lng: null })
  const [shopErrors, setShopErrors] = useState({})

  // Restore from sessionStorage so back-nav keeps state
  useEffect(() => {
    const saved = sessionStorage.getItem('reg_step1')
    if (!saved) { navigate('/register'); return }
    const parsed = JSON.parse(saved)
    setStep1(parsed)

    const step2 = sessionStorage.getItem('reg_step2')
    if (step2) {
      const s2 = JSON.parse(step2)
      if (parsed.provider_type === 'home') {
        if (s2.postalCode) setPostalCode(s2.postalCode)
      } else {
        setShopForm({
          locality: s2.locality  || '',
          landmark: s2.landmark  || '',
          lat:      s2.lat       ?? null,
          lng:      s2.lng       ?? null,
        })
      }
    }
  }, [navigate])

  // ── Home owner: society selected ─────────────────────────────────────────
  function handleSocietySelect(societyData) {
    sessionStorage.setItem('reg_step2', JSON.stringify({ ...societyData, postalCode }))
    navigate('/register/rates')
  }

  // ── Print shop: validate and advance ─────────────────────────────────────
  function handleShopNext() {
    const e = {}
    if (!shopForm.locality.trim()) e.locality = t('register.validation_required')
    if (shopForm.lat == null || shopForm.lng == null) e.map = t('register.shop_map_required')
    if (Object.keys(e).length > 0) { setShopErrors(e); return }

    sessionStorage.setItem('reg_step2', JSON.stringify({
      locality: shopForm.locality.trim(),
      landmark: shopForm.landmark.trim(),
      lat:      shopForm.lat,
      lng:      shopForm.lng,
    }))
    navigate('/register/rates')
  }

  function setShop(field, value) {
    setShopForm(f => ({ ...f, [field]: value }))
    setShopErrors(e => ({ ...e, [field]: undefined }))
  }

  if (!step1) return null

  const isShop = step1.provider_type === 'shop'
  const title  = isShop ? t('register.step2_shop_title') : t('register.step2_title')

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden">
      <AppNav back="/register" />

      <div className="flex-1">
        {/* Hero */}
        <div className="page-hero px-4 py-6 text-white relative">
          <div className="relative z-10 max-w-lg mx-auto">
            <p className="text-white/60 text-sm font-medium mb-1">
              {t('common.step_of', { current: 2, total: 3 })}
            </p>
            <h1 className="font-display text-3xl font-bold">{title}</h1>
            <div className="flex gap-2 mt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= 2 ? 'bg-orange' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Home owner flow ──────────────────────────────────────────── */}
        {!isShop && (
          <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
            <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
              <Input
                label={t('register.postal_code_label')}
                value={postalCode}
                onChange={e => { setPostalCode(e.target.value); setPostalError('') }}
                error={postalError}
                placeholder={t('register.postal_code_placeholder')}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                required
              />

              {postalCode.length >= 5 && (
                <SocietySearch
                  postalCode={postalCode}
                  countryCode={step1.country_code}
                  onSelect={handleSocietySelect}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Print shop flow ──────────────────────────────────────────── */}
        {isShop && (
          <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

            {/* Locality + Landmark */}
            <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
              <Input
                label={t('register.locality_label')}
                value={shopForm.locality}
                onChange={e => setShop('locality', e.target.value)}
                error={shopErrors.locality}
                placeholder={t('register.locality_placeholder')}
                required
                autoComplete="off"
              />
              <Input
                label={t('register.landmark_label')}
                value={shopForm.landmark}
                onChange={e => setShop('landmark', e.target.value)}
                error={shopErrors.landmark}
                placeholder={t('register.landmark_placeholder')}
                autoComplete="off"
              />
            </div>

            {/* Map pin */}
            <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
              <div>
                <p className="text-base font-semibold text-ink mb-0.5">
                  {t('register.map_pin_label')} <span className="text-red">*</span>
                </p>
                <p className="text-sm text-muted">{t('register.map_pin_hint')}</p>
              </div>

              <ShopLocationMap
                lat={shopForm.lat}
                lng={shopForm.lng}
                onChange={({ lat, lng }) => {
                  setShopForm(f => ({ ...f, lat, lng }))
                  setShopErrors(e => ({ ...e, map: undefined }))
                }}
                error={shopErrors.map}
              />

              {/* Privacy note */}
              <div className="flex items-start gap-2 text-sm text-muted bg-bg rounded-xl p-3">
                <Info size={15} className="mt-0.5 flex-shrink-0 text-violet" />
                <span>{t('register.map_pin_privacy')}</span>
              </div>
            </div>

            <Button onClick={handleShopNext} className="w-full" size="lg">
              {t('common.next')}
            </Button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
