import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Upload, Package, ArrowRight, Search } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pincode, setPincode] = useState('')

  function handleFind(e) {
    e.preventDefault()
    if (pincode.trim()) navigate(`/find?pincode=${pincode.trim()}`)
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Navbar */}
      <nav className="bg-ink2 text-white px-4 py-4 flex items-center justify-between">
        <Link to="/" className="font-display font-bold text-xl text-white">
          Ink<span className="text-orange">Neighbour</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-white/70 hover:text-white text-sm font-medium transition-colors">
            {t('nav.login')}
          </Link>
          <Link to="/register">
            <Button size="sm" className="whitespace-nowrap">{t('nav.register')}</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="page-hero px-4 py-16 md:py-24 text-white text-center relative">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-pill text-sm font-semibold">
            <Printer size={16} className="text-orange" />
            Neighbourhood printing, made simple
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-black text-white leading-tight">
            {t('landing.hero_title')}
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-xl mx-auto">
            {t('landing.hero_sub')}
          </p>

          {/* Pincode search */}
          <form onSubmit={handleFind} className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              value={pincode}
              onChange={e => setPincode(e.target.value)}
              placeholder={t('landing.pincode_placeholder')}
              className="flex-1 min-h-[52px] px-4 rounded-[14px] text-ink bg-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-orange/50"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
            />
            <Button type="submit" disabled={!pincode.trim()}>
              <Search size={18} /> {t('landing.cta_find')}
            </Button>
          </form>

          <Link to="/register" className="inline-flex items-center gap-1 text-white/70 hover:text-white transition-colors text-base font-medium">
            {t('landing.cta_register')} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 max-w-3xl mx-auto">
        <h2 className="font-display text-3xl font-bold text-ink text-center mb-10">
          {t('landing.how_title')}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Search, title: t('landing.step1_title'), desc: t('landing.step1_desc'), color: 'bg-violet/15 text-violet' },
            { icon: Upload, title: t('landing.step2_title'), desc: t('landing.step2_desc'), color: 'bg-orange/15 text-orange' },
            { icon: Package, title: t('landing.step3_title'), desc: t('landing.step3_desc'), color: 'bg-green/15 text-green' }
          ].map((step, i) => (
            <div key={i} className="bg-surface rounded-xl p-6 shadow-card text-center space-y-3">
              <div className={`w-14 h-14 rounded-xl ${step.color} flex items-center justify-center mx-auto`}>
                <step.icon size={28} />
              </div>
              <h3 className="font-bold text-ink text-lg">{step.title}</h3>
              <p className="text-muted text-base">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Owner CTA */}
      <section className="px-4 py-16 bg-ink2 text-white text-center">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="w-16 h-16 bg-orange/20 rounded-xl flex items-center justify-center mx-auto">
            <Printer size={32} className="text-orange" />
          </div>
          <h2 className="font-display text-3xl font-bold">{t('landing.owners_title')}</h2>
          <p className="text-white/75 text-lg">{t('landing.owners_desc')}</p>
          <Link to="/register">
            <Button size="lg" className="mt-2">
              {t('landing.owners_cta')} <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-white/50 px-4 py-8 text-center text-sm">
        <p>© 2025 InkNeighbour · A <a href="https://zakapedia.in" className="text-white/70 hover:text-white">Zakapedia</a> product</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="mailto:zaheer@zakapedia.in" className="hover:text-white transition-colors">Contact</a>
          <span>·</span>
          <a href="https://zakapedia.in" className="hover:text-white transition-colors">About</a>
        </div>
      </footer>
    </div>
  )
}
