import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Printer, Upload, Package, ArrowRight, Search,
  Star, Zap, Shield, MessageCircle, CheckCircle, MapPin
} from 'lucide-react'

export default function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pincode, setPincode] = useState('')

  const lastOrder = (() => {
    try { return JSON.parse(localStorage.getItem('last_order')) } catch { return null }
  })()

  function handleFind(e) {
    e.preventDefault()
    if (pincode.trim()) navigate(`/find?pincode=${pincode.trim()}`)
  }

  return (
    <div className="min-h-screen bg-bg overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav style={{ backgroundColor: '#1A1A2E' }} className="text-white sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link to="/" className="font-display font-black text-[22px] tracking-tight shrink-0 flex items-center">
            Ink<span className="text-orange">Neighbour</span>
          </Link>
          <Link
            to="/login"
            className="text-white/70 hover:text-white text-[13px] font-medium transition-colors px-2 py-1.5 min-h-[44px] flex items-center"
          >
            Owner Login
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink2 text-white">
        {/* Deep layered background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d20] via-ink2 to-[#120e2a]" />

        {/* Halftone dot grid — more visible */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1.2px, transparent 1.2px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Subtle edge glow — kept very dim so text stays readable */}
        <div className="absolute top-[-10%] right-[-8%] w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'rgba(255,107,53,0.08)' }} />
        <div className="absolute bottom-[-5%] left-[-5%] w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: 'rgba(124,58,237,0.08)' }} />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-4 text-center">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2.5 bg-white/[0.08] border border-white/[0.12] px-4 py-2 rounded-full text-sm font-semibold mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
            </span>
            Neighbourhood printing, made easy
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            {/* Print it */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,107,53,0.18)', border: '1px solid rgba(255,107,53,0.3)' }}>
                <Printer size={20} className="text-orange" />
              </div>
              <span className="font-display font-bold text-white text-sm leading-none px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>Print it.</span>
            </div>

            <ArrowRight size={14} className="text-white/30 mt-[-16px] shrink-0" />

            {/* Drop it */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <Package size={20} className="text-violet2" />
              </div>
              <span className="font-display font-bold text-white text-sm leading-none px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>Drop it.</span>
            </div>

            <ArrowRight size={14} className="text-white/30 mt-[-16px] shrink-0" />

            {/* Done */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <CheckCircle size={20} className="text-green" />
              </div>
              <span className="font-display font-bold text-white text-sm leading-none px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>Done.</span>
            </div>
          </div>

          <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-white leading-tight tracking-tight mb-4">
            Printing, delivered to<br className="hidden sm:block" /> your door.
          </h1>

          <p className="text-white/55 text-base sm:text-lg max-w-sm mx-auto leading-relaxed mb-10">
            Find a home printer in your building and get your documents at your door — today.
          </p>

          {/* Search card */}
          <form onSubmit={handleFind} className="max-w-[420px] mx-auto mb-8">
            <div
              className="flex gap-2 p-2 rounded-2xl border border-white/15"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex-1 min-w-0 flex items-center gap-2.5 pl-3">
                <MapPin size={16} className="text-orange shrink-0" />
                <input
                  type="text"
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                  placeholder="Enter your pincode"
                  className="flex-1 min-w-0 min-h-[48px] bg-transparent text-white placeholder:text-white/40 text-base font-medium focus:outline-none"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                />
              </div>
              <button
                type="submit"
                className="text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shrink-0 min-h-[48px]"
                style={{ backgroundColor: '#FF6B35' }}
              >
                Find Printer
              </button>
            </div>
          </form>

        </div>

        {/* Track existing order */}
        {lastOrder && (
          <div className="max-w-[420px] mx-auto pb-8 px-4">
            <Link
              to={`/${lastOrder.slug}/confirm/${lastOrder.jobId}`}
              className="flex items-center justify-between w-full bg-white/8 hover:bg-white/12 border border-white/15 rounded-xl px-4 py-3 transition-colors"
            >
              <div className="text-left">
                <p className="text-white/50 text-[11px] font-medium uppercase tracking-wide">Recent order</p>
                <p className="text-white font-semibold text-sm">{lastOrder.jobNumber} · {lastOrder.shopName}</p>
              </div>
              <span className="text-orange text-xs font-bold shrink-0 ml-3">Track →</span>
            </Link>
          </div>
        )}

        {/* Bottom fade into bg */}
        <div className="h-6 bg-gradient-to-b from-transparent to-bg" />
      </section>

      {/* ── Trust strip ────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-6 bg-bg">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Zap,    label: 'Same-day',        sub: 'delivery',        ring: 'ring-orange/20',  bg: 'bg-orange/8',   iconC: 'text-orange'  },
              { icon: Shield, label: 'Trusted',         sub: 'neighbour',       ring: 'ring-violet/20',  bg: 'bg-violet/8',   iconC: 'text-violet'  },
              { icon: Star,   label: 'Resident',        sub: 'rated',           ring: 'ring-amber/20',   bg: 'bg-amber/8',    iconC: 'text-amber'   }
            ].map((item, i) => (
              <div
                key={i}
                className={`flex flex-col items-center gap-2 bg-surface rounded-2xl px-3 py-4 shadow-card border border-border/40 ring-1 ${item.ring}`}
              >
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <item.icon size={18} className={item.iconC} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-ink leading-tight">{item.label}</p>
                  <p className="text-xs text-muted leading-tight">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        {/* Subtle section background */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #0A0A0F 0px, #0A0A0F 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, #0A0A0F 0px, #0A0A0F 1px, transparent 1px, transparent 32px)'
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="text-center mb-12">
            <span className="inline-block bg-violet/10 text-violet text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 border border-violet/20">
              How it works
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight">
              {t('landing.how_title')}
            </h2>
            <p className="text-muted text-base mt-3 max-w-sm mx-auto">
              Three steps. No app download. No signup.
            </p>
          </div>

          {/* Steps */}
          <div className="relative">
            {/* Desktop connecting dashes */}
            <div className="hidden sm:block absolute top-[52px] left-[calc(33.3%+8px)] right-[calc(33.3%+8px)] border-t-2 border-dashed border-border z-0" />

            <div className="grid sm:grid-cols-3 gap-5 sm:gap-6">
              {[
                {
                  n: '01',
                  icon: Search,
                  title: t('landing.step1_title'),
                  desc: 'Enter your pincode to discover a printer owner in your building.',
                  iconBg: 'bg-violet text-white',
                  numC: 'text-violet/10',
                  border: 'border-violet/20',
                  glow: 'bg-violet/5'
                },
                {
                  n: '02',
                  icon: Upload,
                  title: t('landing.step2_title'),
                  desc: 'Share your PDF or image. We detect the page count for you.',
                  iconBg: 'bg-orange text-white',
                  numC: 'text-orange/10',
                  border: 'border-orange/20',
                  glow: 'bg-orange/5'
                },
                {
                  n: '03',
                  icon: Package,
                  title: t('landing.step3_title'),
                  desc: 'Your neighbour prints and drops it right to your door.',
                  iconBg: 'bg-green text-white',
                  numC: 'text-green/10',
                  border: 'border-green/20',
                  glow: 'bg-green/5'
                }
              ].map((s, i) => (
                <div
                  key={i}
                  className={`relative bg-surface rounded-2xl border ${s.border} shadow-card overflow-hidden group`}
                >
                  {/* Background number watermark */}
                  <span className={`absolute -bottom-4 -right-2 font-display text-[90px] font-black ${s.numC} leading-none select-none pointer-events-none`}>
                    {s.n}
                  </span>

                  <div className={`absolute inset-0 ${s.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  <div className="relative z-10 p-6 sm:p-7">
                    {/* Icon circle */}
                    <div className={`w-[52px] h-[52px] rounded-2xl ${s.iconBg} flex items-center justify-center mb-5 shadow-sm`}>
                      <s.icon size={22} />
                    </div>
                    <h3 className="font-display font-bold text-ink text-[19px] leading-snug mb-2">
                      {s.title}
                    </h3>
                    <p className="text-muted text-base leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Owner CTA (split layout) ────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="relative bg-ink rounded-3xl overflow-hidden text-white">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d20] via-ink2 to-[#1a0e38]" />
          <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-orange/15 rounded-full blur-[100px] translate-x-1/4 -translate-y-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet/20 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />

          <div className="relative z-10 grid lg:grid-cols-2 gap-0">

            {/* Left: content */}
            <div className="px-8 sm:px-12 py-12 sm:py-16 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 bg-orange/15 border border-orange/25 px-3 py-1.5 rounded-full text-sm font-bold text-orange mb-6 w-fit">
                <Printer size={14} />
                For printer owners
              </div>

              <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-4">
                {t('landing.owners_title')}
                <br />
                <span className="text-orange">Earn from every page.</span>
              </h2>

              <p className="text-white/65 text-lg leading-relaxed mb-8 max-w-sm">
                {t('landing.owners_desc')}
              </p>

              {/* Benefits list */}
              <ul className="space-y-3 mb-8">
                {[
                  'Free to set up — no upfront cost',
                  'You set your own rates',
                  'Earn ₹2–₹5 per page printed'
                ].map((b, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80 text-base">
                    <CheckCircle size={17} className="text-green shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-4">
                <Link to="/register">
                  <button className="inline-flex items-center gap-2.5 bg-orange hover:bg-orange/90 active:scale-[0.97] text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-orange min-h-[52px] w-fit">
                    Set up your shop
                  </button>
                </Link>
                <Link
                  to="/login"
                  className="text-white/60 hover:text-white text-base font-medium transition-colors min-h-[44px] flex items-center"
                >
                  Already registered? Login →
                </Link>
              </div>
            </div>

            {/* Right: earnings visual */}
            <div className="hidden lg:flex items-center justify-center px-8 py-12 relative">
              {/* Mock earnings card */}
              <div className="w-full max-w-[280px] relative">
                {/* Floating card */}
                <div
                  className="bg-white/[0.06] border border-white/[0.1] rounded-2xl p-6 backdrop-blur-sm"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}
                >
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">This month</p>
                  <div className="flex items-end gap-2 mb-5">
                    <span className="font-display text-[44px] font-black text-white leading-none">₹2,340</span>
                    <span className="text-green text-sm font-bold mb-1.5">+18%</span>
                  </div>

                  {/* Mini bar chart */}
                  <div className="flex items-end gap-1.5 h-[48px] mb-4">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${h}%`,
                          background: i === 5
                            ? 'rgba(255,107,53,0.9)'
                            : 'rgba(255,255,255,0.12)'
                        }}
                      />
                    ))}
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-2">
                    {[
                      { label: 'Pages printed', val: '312' },
                      { label: 'Print jobs',    val: '47' }
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-white/45">{row.label}</span>
                        <span className="text-white/90 font-semibold">{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating badge */}
                <div
                  className="absolute -top-3 -right-3 bg-green text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                  style={{ boxShadow: '0 4px 12px rgba(16,185,129,0.5)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                  Shop is live
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-ink text-white/40 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">

            {/* Brand + tagline */}
            <div className="text-center sm:text-left space-y-1">
              <p className="font-display font-black text-xl text-white/90 tracking-tight">
                Ink<span className="text-orange">Neighbour</span>
              </p>
              <p className="text-xs text-white/30 font-medium">Print it. Drop it. Done.</p>
              <p className="text-xs text-white/20 mt-1">
                © {new Date().getFullYear()} InkNeighbour. All rights reserved.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px]">
              <a
                href="https://wa.me/916381601740"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-white transition-colors group"
              >
                <MessageCircle size={14} className="group-hover:text-green transition-colors" />
                Contact us
              </a>
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
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
