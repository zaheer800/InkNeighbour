import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import AppNav from '../../components/AppNav'
import SocietySearch from '../../components/SocietySearch'
import Footer from '../../components/Footer'

export default function Step2Society() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step1, setStep1] = useState(null)
  const [postalCode, setPostalCode] = useState('')
  const [selectedSociety, setSelectedSociety] = useState(null)
  const [postalError, setPostalError] = useState('')

  useEffect(() => {
    const saved = sessionStorage.getItem('reg_step1')
    if (!saved) { navigate('/register'); return }
    setStep1(JSON.parse(saved))
  }, [navigate])

  function handlePostalNext() {
    if (!postalCode.trim() || postalCode.length < 5) {
      setPostalError('Enter a valid pincode (at least 5 digits)')
      return
    }
    setPostalError('')
  }

  function handleSelect(societyData) {
    setSelectedSociety(societyData)
    sessionStorage.setItem('reg_step2', JSON.stringify({ ...societyData, postalCode }))
    navigate('/register/rates')
  }

  if (!step1) return null

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden">
      <AppNav back="/register" />
      <div className="flex-1">
      <div className="page-hero px-4 py-6 text-white relative">
        <div className="relative z-10 max-w-lg mx-auto">
          <p className="text-white/60 text-sm font-medium mb-1">{t('common.step_of', { current: 2, total: 3 })}</p>
          <h1 className="font-display text-3xl font-bold">{t('register.step2_title')}</h1>

          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {[1,2,3].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= 2 ? 'bg-orange' : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-5">
          {/* Postal code input */}
          <Input
            label={`Your pincode`}
            value={postalCode}
            onChange={e => { setPostalCode(e.target.value); setPostalError('') }}
            error={postalError}
            placeholder="Enter your pincode"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            required
          />

          {postalCode.length >= 5 && (
            <SocietySearch
              postalCode={postalCode}
              countryCode={step1.country_code}
              onSelect={handleSelect}
            />
          )}
        </div>
      </div>
      </div>
      <Footer />
    </div>
  )
}
