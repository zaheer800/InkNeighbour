import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  MapPin, LocateFixed, Loader2, Upload, Package,
  CheckCircle, Home, Store, Star, Clock, Printer,
  ArrowRight, ChevronRight, Zap, Shield, IndianRupee
} from 'lucide-react'

/* ── Mock provider cards shown in the directory preview ── */
const MOCK_PROVIDERS = [
  {
    type: 'home',
    label: 'Home Printer',
    name: 'Flat 4B · Sunrise Residency',
    bw: '₹2',
    color: '₹5',
    rating: 4.9,
    reviews: 38,
    badge: 'Open now',
    badgeColor: 'text-green',
    badgeBg: 'bg-green/10',
    accentColor: 'text-orange',
    accentBg: 'bg-orange/8',
    borderColor: 'border-orange/15',
    icon: Home,
  },
  {
    type: 'shop',
    label: 'Print Shop',
    name: 'CopyKing Print Solutions',
    bw: '₹1.5',
    color: '₹4',
    rating: 4.7,
    reviews: 124,
    badge: '0.8 km away',
    badgeColor: 'text-sky',
    badgeBg: 'bg-sky/10',
    accentColor: 'text-violet',
    accentBg: 'bg-violet/8',
    borderColor: 'border-violet/15',
    icon: Store,
  },
  {
    type: 'home',
    label: 'Home Printer',
    name: 'Flat 12A · Green Park Apts',
    bw: '₹2.5',
    color: '₹6',
    rating: 4.8,
    reviews: 21,
    badge: 'Open now',
    badgeColor: 'text-green',
    badgeBg: 'bg-green/10',
    accentColor: 'text-orange',
    accentBg: 'bg-orange/8',
    borderColor: 'border-orange/15',
    icon: Home,
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const [pincode, setPincode] = useState('')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  const lastOrder = (() => {
    try { return JSON.parse(localStorage.getItem('last_order')) } catch { return null }
  })()

  function handleFind(e) {
    e.preventDefault()
    if (pincode.trim()) navigate(`/find?pincode=${pincode.trim()}`)
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocError('Location not supported. Please enter your pincode.')
      return
    }
    setLocating(true)
    setLocError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        navigate(`/find?lat=${pos.coords.latitude.toFixed(6)}&lng=${pos.coords.longitude.toFixed(6)}`)
      },
      () => {
        setLocating(false)
        setLocError('Could not detect location. Enter your pincode below.')
      },
      { timeout: 10000, maximumAge: 300000 }
    )
  }

  return (
    <div className="min-h-screen bg-bg overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav style={{ backgroundColor: '#0d0d20' }} className="text-white sticky top-0 z-40 border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link to="/" className="font-display font-black text-xl tracking-tight shrink-0">
            Ink<span className="text-orange">Neighbour</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#find"
              className="hidden sm:flex text-white/60 hover:text-white text-sm font-medium transition-colors px-3 min-h-[44px] items-center"
            >
              Find a Printer
            </a>
            <Link
              to="/login"
              className="flex items-center min-h-[36px] px-4 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm font-semibold transition-colors"
            >
              Owner Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        id="find"
        className="relative flex flex-col items-center justify-center min-h-[90vh] px-4 text-white overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d0d20 0%, #1A1A2E 55%, #120e2a 100%)' }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
        {/* Glows */}
        <div className="absolute top-[-5%] right-[-5%] w-[700px] h-[700px] rounded-full blur-[160px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.10) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)' }} />

        <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center text-center pt-12 pb-16">

          {/* Headline */}
          <h1
            className="font-display font-black leading-[1.02] tracking-tight mb-5"
            style={{ fontSize: 'clamp(2.6rem, 7vw, 4.25rem)' }}
          >
            On-demand printing,<br />
            <span style={{ background: 'linear-gradient(90deg, #FF6B35 10%, #FF8C61 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              near you.
            </span>
          </h1>

          <p className="text-white/60 text-lg max-w-md mx-auto leading-relaxed mb-10">
            Browse home printer owners and local print shops near you. Upload your document and get it printed and delivered — on demand.
          </p>

          {/* Primary CTA */}
          <button
            type="button"
            onClick={detectLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold text-base transition-all min-h-[58px] px-6 mb-3 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #e85d25)', boxShadow: '0 0 40px rgba(255,107,53,0.28)' }}
          >
            {locating
              ? <><Loader2 size={18} className="animate-spin" /> Detecting your location…</>
              : <><LocateFixed size={18} /> Find printers near me</>
            }
          </button>

          {locError && <p className="text-red/80 text-xs mb-2">{locError}</p>}

          {/* Divider */}
          <div className="flex items-center gap-3 w-full mb-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/25 text-xs font-medium">or enter pincode</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Pincode search */}
          <form onSubmit={handleFind} className="w-full mb-6">
            <div
              className="flex items-stretch rounded-2xl border border-white/[0.12] overflow-hidden min-h-[52px]"
              style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex-1 flex items-center gap-2.5 px-4 min-w-0">
                <MapPin size={15} className="text-orange shrink-0" />
                <input
                  type="text"
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                  placeholder="Enter your pincode"
                  className="flex-1 min-w-0 bg-transparent text-white placeholder:text-white/30 text-base font-medium focus:outline-none"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                />
              </div>
              <button
                type="submit"
                className="shrink-0 w-14 flex items-center justify-center transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #e85d25)' }}
              >
                <ArrowRight size={18} className="text-white" />
              </button>
            </div>
          </form>

          {/* Recent order */}
          {lastOrder && (
            <Link
              to={`/${lastOrder.slug}/confirm/${lastOrder.jobId}`}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 mb-5 border border-white/10 hover:border-white/20 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="text-left">
                <p className="text-white/35 text-[10px] font-bold uppercase tracking-widest">Recent order</p>
                <p className="text-white/75 font-semibold text-sm">{lastOrder.jobNumber} · {lastOrder.shopName}</p>
              </div>
              <span className="text-orange text-xs font-bold ml-3 shrink-0">Track →</span>
            </Link>
          )}

          {/* Trust pills */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { label: 'Same-day delivery', dot: 'bg-green' },
              { label: 'From ₹2 per page', dot: 'bg-orange' },
              { label: 'Verified providers', dot: 'bg-violet' },
            ].map(({ label, dot }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70">
                <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #F4F3FF)' }} />
      </section>

      {/* ── How it works ── */}
      <section className="bg-bg py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-muted mb-10">How it works</p>
          <div className="grid grid-cols-3 gap-4 sm:gap-8 relative">
            {[
              { icon: LocateFixed, color: 'text-orange', bg: 'bg-orange/10', label: 'Find',    desc: 'Browse home printers and shops near you by pincode or location.' },
              { icon: Upload,      color: 'text-violet', bg: 'bg-violet/10', label: 'Upload',  desc: 'Share your PDF or image. No USB, no email, no hassle.' },
              { icon: Package,     color: 'text-green',  bg: 'bg-green/10',  label: 'Receive', desc: 'Your printout is delivered to your door or ready for pickup.' },
            ].map(({ icon: Icon, color, bg, label, desc }, i) => (
              <div key={label} className="flex flex-col items-center text-center gap-3 relative">
                <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={20} className={color} />
                </div>
                <div>
                  <p className="font-display font-bold text-ink text-base">{label}</p>
                  <p className="text-muted text-xs sm:text-sm leading-relaxed mt-1 hidden sm:block">{desc}</p>
                </div>
                {i < 2 && (
                  <ArrowRight size={14} className="text-border absolute top-[22px] right-[-14px] sm:right-[-22px] hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Directory preview ── */}
      <section className="py-16 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #F4F3FF 0%, #ffffff 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-orange/10 text-orange text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 border border-orange/15">
              Who you'll find
            </span>
            <h2 className="font-display font-black text-ink text-3xl sm:text-4xl mb-3">
              Two types of providers.<br className="hidden sm:block" /> One place to find them.
            </h2>
            <p className="text-muted text-base max-w-lg mx-auto">
              Home printer owners in your building and professional print shops nearby — all on one platform.
            </p>
          </div>

          {/* Mock provider cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {MOCK_PROVIDERS.map((p, i) => {
              const Icon = p.icon
              return (
                <div
                  key={i}
                  className={`bg-surface rounded-2xl border ${p.borderColor} shadow-card p-5 space-y-4 relative overflow-hidden`}
                >
                  {/* Subtle glow accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-60"
                    style={{ background: p.type === 'home' ? 'rgba(255,107,53,0.08)' : 'rgba(124,58,237,0.08)', transform: 'translate(30%,-30%)' }}
                  />

                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-xl ${p.accentBg} flex items-center justify-center shrink-0`}>
                      <Icon size={18} className={p.accentColor} />
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${p.badgeBg} ${p.badgeColor}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                      {p.badge}
                    </span>
                  </div>

                  {/* Name & type */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">{p.label}</p>
                    <p className="font-display font-bold text-ink text-base leading-tight">{p.name}</p>
                  </div>

                  {/* Pricing */}
                  <div className="flex gap-3">
                    <div className="flex-1 bg-bg rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-muted font-medium">B&W</p>
                      <p className="font-bold text-ink text-sm">{p.bw}<span className="text-muted font-normal">/pg</span></p>
                    </div>
                    <div className="flex-1 bg-bg rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-muted font-medium">Colour</p>
                      <p className="font-bold text-ink text-sm">{p.color}<span className="text-muted font-normal">/pg</span></p>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1.5 border-t border-border pt-3">
                    <Star size={13} className="text-amber fill-amber shrink-0" />
                    <span className="font-bold text-ink text-sm">{p.rating}</span>
                    <span className="text-muted text-xs">({p.reviews} reviews)</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={detectLocation}
              className="inline-flex items-center gap-2 font-bold text-sm text-white px-7 py-3.5 rounded-2xl transition-opacity hover:opacity-90 min-h-[52px]"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #e85d25)' }}
            >
              <LocateFixed size={16} /> See printers near you
            </button>
            <p className="text-muted text-xs mt-3">No account needed · Free to browse</p>
          </div>
        </div>
      </section>

      {/* ── For providers ── */}
      <section
        className="py-20 px-4 sm:px-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d0d20 0%, #1A1A2E 60%, #1a0e38 100%)' }}
      >
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-orange/15 text-orange text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5 border border-orange/20">
              For providers
            </span>
            <h2
              className="font-display font-black text-white leading-tight mb-4"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}
            >
              List your printer.<br />
              <span style={{ background: 'linear-gradient(90deg, #FF6B35, #FF8C61)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Get customers.
              </span>
            </h2>
            <p className="text-white/50 text-base max-w-md mx-auto">
              Join the InkNeighbour directory and start receiving print jobs from people near you — home printer or professional shop.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-10">
            {[
              {
                icon: Home,
                accent: 'rgba(255,107,53,0.15)',
                accentBorder: 'rgba(255,107,53,0.25)',
                iconColor: 'text-orange',
                glow: 'rgba(255,107,53,0.08)',
                title: 'Home Printer Owner',
                sub: 'No business registration needed',
                subColor: 'text-orange',
                desc: 'You have a home printer. Register it, set your rates, and earn from neighbours who need documents printed.',
                points: ['Free to list', 'Set your own price per page', 'Get paid per job — cash or UPI'],
                cta: 'List my home printer',
                ctaStyle: { background: 'linear-gradient(135deg, #FF6B35, #e85d25)' },
              },
              {
                icon: Store,
                accent: 'rgba(124,58,237,0.15)',
                accentBorder: 'rgba(124,58,237,0.25)',
                iconColor: 'text-violet2',
                glow: 'rgba(124,58,237,0.08)',
                title: 'Print Shop',
                sub: 'Reach customers who can\'t walk in',
                subColor: 'text-violet2',
                desc: 'Accept online orders, showcase your full service menu, and add delivery to grow beyond walk-in traffic.',
                points: ['Free to list your shop', 'Distance-based delivery pricing', 'Binding, scanning, lamination — all listed'],
                cta: 'List my print shop',
                ctaStyle: { background: '#7C3AED' },
              },
            ].map(({ icon: Icon, accent, accentBorder, iconColor, glow, title, sub, subColor, desc, points, cta, ctaStyle }) => (
              <div
                key={title}
                className="relative rounded-3xl overflow-hidden border border-white/[0.08] p-7 flex flex-col gap-4"
                style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at top right, ${glow}, transparent 60%)` }} />
                <div className="relative flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: accent, border: `1px solid ${accentBorder}` }}>
                    <Icon size={20} className={iconColor} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-white text-base leading-tight">{title}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${subColor}`}>{sub}</p>
                  </div>
                </div>
                <p className="relative text-white/45 text-sm leading-relaxed">{desc}</p>
                <ul className="relative space-y-2 flex-1">
                  {points.map(pt => (
                    <li key={pt} className="flex items-center gap-2.5 text-sm text-white/65">
                      <CheckCircle size={13} className="text-green shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="relative block mt-1">
                  <button
                    className="w-full min-h-[48px] rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
                    style={ctaStyle}
                  >
                    {cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
            {[
              { icon: Zap,          value: 'Same day',  label: 'turnaround'        },
              { icon: IndianRupee,  value: 'Free',      label: 'to list your shop' },
              { icon: Shield,       value: 'Verified',  label: 'providers only'    },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl border border-white/[0.08] p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Icon size={16} className="text-orange mx-auto mb-2 opacity-70" />
                <p className="font-display font-bold text-white text-sm">{value}</p>
                <p className="text-white/35 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-ink border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-center space-y-4">
          <p className="font-display font-black text-2xl text-white tracking-tight">
            Ink<span className="text-orange">Neighbour</span>
          </p>
          <p className="text-white/25 text-sm font-medium tracking-widest uppercase">Print it. Drop it. Done.</p>
          <div className="flex items-center justify-center gap-3 text-sm text-white/30 pt-2">
            <a href={`https://wa.me/${import.meta.env.VITE_CONTACT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contact us</a>
            <span>·</span>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-white/15 text-xs">© {new Date().getFullYear()} InkNeighbour. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
