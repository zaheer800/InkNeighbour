import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Upload, Package, ArrowRight, Search, Star, Zap, Shield } from 'lucide-react'
import Button from '../components/ui/Button'

export default function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pincode, setPincode] = useState('')

  function handleFind(e) {
    e.preventDefault()
    if (pincode.trim()) navigate(`/find?pincode=${pincode.trim()}`)
  }

  return (
    <div className="min-h-screen bg-bg overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="bg-ink2/95 backdrop-blur-sm text-white sticky top-0 z-40 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="font-display font-black text-xl shrink-0">
            Ink<span className="text-orange">Neighbour</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              to="/login"
              className="text-white/70 hover:text-white text-sm font-semibold transition-colors px-3 py-2 min-h-[44px] flex items-center whitespace-nowrap"
            >
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">{t('nav.login')}</span>
            </Link>
            <Link to="/register">
              <button className="bg-orange hover:bg-orange/90 text-white font-bold text-sm px-3 sm:px-4 py-2.5 rounded-xl transition-colors min-h-[44px] flex items-center gap-1.5 whitespace-nowrap shadow-orange">
                <Printer size={15} />
                <span className="hidden sm:inline">{t('nav.register')}</span>
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink2 text-white">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-ink2 via-[#1e1545] to-[#0f0f1a]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet/20 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange/15 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-full text-sm font-semibold mb-6 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
            Neighbourhood printing, made simple
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.1] tracking-tight mb-5">
            Print it.{' '}
            <span className="text-orange">Drop it.</span>{' '}
            Done.
          </h1>

          <p className="text-white/70 text-lg sm:text-xl max-w-lg mx-auto leading-relaxed mb-10">
            {t('landing.hero_sub')}
          </p>

          {/* Search form */}
          <form onSubmit={handleFind} className="max-w-md mx-auto mb-6">
            <div className="flex gap-2 bg-white/10 border border-white/20 backdrop-blur-sm p-2 rounded-2xl">
              <div className="flex-1 flex items-center gap-2 px-3">
                <Search size={18} className="text-white/40 shrink-0" />
                <input
                  type="text"
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                  placeholder={t('landing.pincode_placeholder')}
                  className="flex-1 min-h-[44px] bg-transparent text-white placeholder:text-white/40 text-base font-medium focus:outline-none"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                />
              </div>
              <button
                type="submit"
                disabled={!pincode.trim()}
                className="bg-orange hover:bg-orange/90 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl transition-colors shrink-0 min-h-[44px]"
              >
                Find
              </button>
            </div>
          </form>

          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-medium"
          >
            Own a printer? Set up your shop <ArrowRight size={14} />
          </Link>
        </div>

        {/* Bottom wave */}
        <div className="relative h-12 overflow-hidden">
          <svg viewBox="0 0 1440 48" className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" fill="#F4F3FF" />
          </svg>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────── */}
      <section className="py-6 sm:py-8 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
          {[
            { icon: Zap,    label: 'Same-day delivery',   color: 'text-orange bg-orange/10' },
            { icon: Shield, label: 'Trusted neighbour',   color: 'text-violet bg-violet/10' },
            { icon: Star,   label: 'Rated by residents',  color: 'text-amber  bg-amber/10'  }
          ].map((item, i) => (
            <div key={i} className="flex-1 flex items-center gap-3 bg-surface rounded-xl px-4 py-3 shadow-card border border-border/50">
              <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                <item.icon size={17} />
              </div>
              <span className="text-sm font-semibold text-ink">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-black text-ink">
            {t('landing.how_title')}
          </h2>
          <p className="text-muted text-base mt-2 max-w-md mx-auto">
            Three easy steps, no apps to download.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 relative">
          {/* Connector line on desktop */}
          <div className="hidden sm:block absolute top-14 left-[calc(16.7%+28px)] right-[calc(16.7%+28px)] h-px bg-gradient-to-r from-violet/30 via-border to-orange/30" />

          {[
            {
              step: '01',
              icon: Search,
              title: t('landing.step1_title'),
              desc: t('landing.step1_desc'),
              accent: 'from-violet/25 to-violet/5',
              iconColor: 'text-violet bg-violet/15',
              numColor: 'text-violet/15'
            },
            {
              step: '02',
              icon: Upload,
              title: t('landing.step2_title'),
              desc: t('landing.step2_desc'),
              accent: 'from-orange/25 to-orange/5',
              iconColor: 'text-orange bg-orange/15',
              numColor: 'text-orange/15'
            },
            {
              step: '03',
              icon: Package,
              title: t('landing.step3_title'),
              desc: t('landing.step3_desc'),
              accent: 'from-green/25 to-green/5',
              iconColor: 'text-green bg-green/15',
              numColor: 'text-green/15'
            }
          ].map((step, i) => (
            <div
              key={i}
              className="relative bg-surface rounded-2xl p-6 sm:p-7 shadow-card border border-border/60 overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl ${step.accent} rounded-bl-[90px] pointer-events-none`} />
              <span className={`absolute top-3 right-4 font-display text-5xl font-black ${step.numColor} select-none`}>
                {step.step}
              </span>
              <div className={`w-12 h-12 rounded-xl ${step.iconColor} flex items-center justify-center mb-5`}>
                <step.icon size={22} />
              </div>
              <h3 className="font-display font-bold text-ink text-xl mb-2">{step.title}</h3>
              <p className="text-muted text-base leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Owner CTA ──────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="relative bg-ink2 rounded-3xl overflow-hidden text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-ink2 to-[#2d1b69]" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange/20 rounded-full blur-[80px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-violet/25 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          <div className="relative z-10 max-w-xl mx-auto text-center px-6 py-12 sm:py-16 space-y-5">
            <div className="w-16 h-16 bg-orange/20 border border-orange/30 rounded-2xl flex items-center justify-center mx-auto">
              <Printer size={30} className="text-orange" />
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-black">
              {t('landing.owners_title')}
            </h2>
            <p className="text-white/70 text-lg leading-relaxed">
              {t('landing.owners_desc')}
            </p>
            <Link to="/register">
              <button className="inline-flex items-center gap-2 bg-orange hover:bg-orange/90 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-colors shadow-orange mt-2 min-h-[52px]">
                Set up your shop <ArrowRight size={20} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-ink text-white/50 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="text-center sm:text-left">
              <p className="font-display font-black text-lg text-white/80">
                Ink<span className="text-orange">Neighbour</span>
              </p>
              <p className="text-xs mt-1 text-white/30">
                © {new Date().getFullYear()} InkNeighbour. All rights reserved.
              </p>
            </div>

            {/* Links */}
            <div className="flex items-center flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
              <a
                href="mailto:zaheer@zakapedia.in"
                className="hover:text-white transition-colors"
              >
                Contact
              </a>
              <span className="text-white/20">·</span>
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <span className="text-white/20">·</span>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
