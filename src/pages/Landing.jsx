import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Printer, Upload, Package, Search,
  CheckCircle, MapPin, Home, Store, MessageCircle,
  FileText, IndianRupee, ArrowRight, Zap, Shield, Star
} from 'lucide-react'

export default function Landing() {
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
      <nav style={{ backgroundColor: '#0d0d20' }} className="text-white sticky top-0 z-40 border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link to="/" className="font-display font-black text-xl tracking-tight shrink-0 flex items-center gap-0.5">
            Ink<span className="text-orange">Neighbour</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/find" className="hidden sm:flex text-white/60 hover:text-white text-sm font-medium transition-colors px-3 min-h-[44px] items-center whitespace-nowrap">
              Find a Printer
            </Link>
            <Link to="/login" className="flex items-center min-h-[36px] px-4 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm font-semibold transition-colors whitespace-nowrap">
              Owner Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(160deg, #0d0d20 0%, #1A1A2E 50%, #120e2a 100%)' }}>

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Glows */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 text-center">

          {/* Tagline pill */}
          <div className="inline-flex items-center gap-2.5 border border-white/[0.12] px-4 py-2 rounded-full text-sm font-bold mb-8" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
            </span>
            <span className="text-white/80">Print it.&nbsp;</span>
            <span className="text-orange">Drop it.&nbsp;</span>
            <span className="text-white/80">Done.</span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-black text-4xl sm:text-6xl text-white leading-[1.05] tracking-tight mb-6">
            Printing, delivered<br />
            <span style={{ background: 'linear-gradient(90deg, #FF6B35, #FF8C61)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              to your door.
            </span>
          </h1>

          <p className="text-white/55 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-10">
            Upload your file. A nearby <strong className="text-white/85 font-semibold">home printer owner</strong> or <strong className="text-white/85 font-semibold">local print shop</strong> prints it and delivers it to you — today.
          </p>

          {/* Flow icons */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {[
              { icon: FileText, label: 'Upload',   bg: 'rgba(124,58,237,0.2)',  border: 'rgba(124,58,237,0.35)', color: '#A78BFA' },
              { icon: Printer,  label: 'Print',    bg: 'rgba(255,107,53,0.2)',  border: 'rgba(255,107,53,0.35)', color: '#FF8C61' },
              { icon: Package,  label: 'Deliver',  bg: 'rgba(16,185,129,0.2)',  border: 'rgba(16,185,129,0.35)', color: '#10B981' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                    <item.icon size={20} style={{ color: item.color }} />
                  </div>
                  <span className="text-xs font-bold text-white/50">{item.label}</span>
                </div>
                {i < 2 && <ArrowRight size={14} className="text-white/20 mb-4 shrink-0" />}
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div className="max-w-md mx-auto">
            <form onSubmit={handleFind}>
              <div className="flex gap-2 p-1.5 rounded-2xl border border-white/[0.12]" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}>
                <div className="flex-1 min-w-0 flex items-center gap-2.5 pl-3">
                  <MapPin size={16} className="text-orange shrink-0" />
                  <input
                    type="text"
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    placeholder="Enter your pincode"
                    className="flex-1 min-w-0 min-h-[50px] bg-transparent text-white placeholder:text-white/35 text-base font-medium focus:outline-none"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                  />
                </div>
                <button type="submit" className="shrink-0 text-white font-bold text-sm px-6 rounded-xl min-h-[50px] transition-opacity hover:opacity-90" style={{ background: 'linear-gradient(135deg, #FF6B35, #e85d25)' }}>
                  Find Printer
                </button>
              </div>
            </form>

            {lastOrder && (
              <Link to={`/${lastOrder.slug}/confirm/${lastOrder.jobId}`} className="mt-3 flex items-center justify-between w-full rounded-xl px-4 py-2.5 transition-colors border border-white/10 hover:border-white/20" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="text-left">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Recent order</p>
                  <p className="text-white/80 font-semibold text-sm">{lastOrder.jobNumber} · {lastOrder.shopName}</p>
                </div>
                <span className="text-orange text-xs font-bold ml-3">Track →</span>
              </Link>
            )}

            <p className="text-white/30 text-xs mt-4">No sign-up required &nbsp;·&nbsp; No app download</p>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #F4F3FF)' }} />
      </section>

      {/* ── Trust strip ────────────────────────────────────── */}
      <section className="bg-bg px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-3">
          {[
            { icon: Zap,    label: 'Same-day',   sub: 'delivery',       color: 'text-orange', bg: 'bg-orange/8',  ring: 'ring-orange/15' },
            { icon: Shield, label: 'Verified',   sub: 'neighbours',     color: 'text-violet', bg: 'bg-violet/8',  ring: 'ring-violet/15' },
            { icon: Star,   label: 'Rated',      sub: 'by customers',   color: 'text-amber',  bg: 'bg-amber/8',   ring: 'ring-amber/15'  },
          ].map((item, i) => (
            <div key={i} className={`flex flex-col items-center gap-2 bg-surface rounded-2xl p-4 shadow-card ring-1 ${item.ring}`}>
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                <item.icon size={18} className={item.color} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-ink">{item.label}</p>
                <p className="text-xs text-muted">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What is InkNeighbour ────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-bg">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-violet/10 text-violet text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 border border-violet/15">What we do</span>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink mb-4">Your neighbourhood<br className="hidden sm:block" /> print network</h2>
            <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
              InkNeighbour connects you with nearby print providers — home printer owners in your building or local print shops — for fast, on-demand printing delivered to you.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: FileText, color: 'text-violet', bg: 'bg-violet/10', border: 'border-violet/15', step: '01', title: 'You upload',   desc: 'Share your PDF or image from your phone. No USB, no email, no hassle.' },
              { icon: Printer,  color: 'text-orange', bg: 'bg-orange/10', border: 'border-orange/15', step: '02', title: 'They print',   desc: 'A neighbour or local shop prints your document at their end.' },
              { icon: Package,  color: 'text-green',  bg: 'bg-green/10',  border: 'border-green/15',  step: '03', title: 'You receive',  desc: 'Delivered to your flat or ready for pickup — tracked in real time.' },
            ].map((item, i) => (
              <div key={i} className={`relative bg-surface rounded-2xl border ${item.border} p-6 overflow-hidden group hover:shadow-card transition-shadow`}>
                <span className="absolute top-3 right-4 font-display font-black text-5xl text-ink/[0.04] leading-none select-none">{item.step}</span>
                <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center mb-5`}>
                  <item.icon size={22} className={item.color} />
                </div>
                <h3 className="font-display font-bold text-ink text-xl mb-2">{item.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two provider types ──────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #F4F3FF 0%, #ffffff 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-orange/10 text-orange text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 border border-orange/15">Two types of providers</span>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink mb-4">Find the right printer for you</h2>
            <p className="text-muted text-base">Search by pincode — you'll see both.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Home printer */}
            <div className="relative bg-surface rounded-3xl overflow-hidden border border-orange/20 shadow-card">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(255,107,53,0.08)', transform: 'translate(30%, -30%)' }} />
              <div className="relative p-7 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(255,140,97,0.1))', border: '1px solid rgba(255,107,53,0.2)' }}>
                    <Home size={22} className="text-orange" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-ink text-xl leading-tight">Home Printer Owner</p>
                    <p className="text-xs text-orange font-semibold mt-0.5">Same building as you</p>
                  </div>
                </div>
                <p className="text-muted text-sm leading-relaxed">Your neighbour has a printer and delivers to your door within the same apartment complex.</p>
                <ul className="space-y-2.5">
                  {[
                    'Delivers to your flat door',
                    'Typically ₹2–5 per page',
                    'Best for everyday small jobs',
                    'Verified building resident',
                  ].map((pt, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-ink">
                      <div className="w-5 h-5 rounded-full bg-orange/15 flex items-center justify-center shrink-0">
                        <CheckCircle size={11} className="text-orange" />
                      </div>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Print shop */}
            <div className="relative bg-surface rounded-3xl overflow-hidden border border-violet/20 shadow-card">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(124,58,237,0.08)', transform: 'translate(30%, -30%)' }} />
              <div className="relative p-7 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(167,139,250,0.1))', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <Store size={22} className="text-violet" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-ink text-xl leading-tight">Local Print Shop</p>
                    <p className="text-xs text-violet font-semibold mt-0.5">Within 1–5 km of you</p>
                  </div>
                </div>
                <p className="text-muted text-sm leading-relaxed">A professional print shop nearby — order online and get delivery or pick up in person.</p>
                <ul className="space-y-2.5">
                  {[
                    'Delivery or walk-in pickup',
                    'Scanning, binding, lamination',
                    'Best for bulk or professional jobs',
                    'GST receipts available',
                  ].map((pt, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-ink">
                      <div className="w-5 h-5 rounded-full bg-violet/15 flex items-center justify-center shrink-0">
                        <CheckCircle size={11} className="text-violet" />
                      </div>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <form onSubmit={handleFind} className="inline-flex gap-2">
              <div className="flex gap-2 p-1.5 rounded-2xl border border-border bg-surface shadow-card">
                <div className="flex items-center gap-2 pl-3">
                  <MapPin size={15} className="text-orange shrink-0" />
                  <input
                    type="text"
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    placeholder="Your pincode"
                    className="w-32 min-h-[44px] bg-transparent text-ink placeholder:text-muted text-base focus:outline-none"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                  />
                </div>
                <button type="submit" className="shrink-0 px-5 rounded-xl text-white font-bold text-sm min-h-[44px] transition-opacity hover:opacity-90" style={{ background: 'linear-gradient(135deg, #FF6B35, #e85d25)' }}>
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── For owners ──────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6" style={{ background: 'linear-gradient(160deg, #0d0d20 0%, #1A1A2E 60%, #1a0e38 100%)' }}>
        <div className="max-w-4xl mx-auto">

          <div className="text-center mb-12">
            <span className="inline-block bg-orange/15 text-orange text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 border border-orange/20">For owners</span>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-white mb-4">
              Have a printer?<br />
              <span style={{ background: 'linear-gradient(90deg, #FF6B35, #FF8C61)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Start earning from it.
              </span>
            </h2>
            <p className="text-white/50 text-lg max-w-md mx-auto">List your printer for free and start accepting print jobs from people nearby.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 mb-8">
            {/* Home owner */}
            <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] p-7 space-y-5" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(255,107,53,0.08), transparent 60%)' }} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.25)' }}>
                    <Home size={22} className="text-orange" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-white text-xl leading-tight">Home Printer Owner</p>
                    <p className="text-xs text-orange font-semibold mt-0.5">No business needed</p>
                  </div>
                </div>
                <p className="text-white/50 text-sm leading-relaxed mb-5">You have a home printer. Register your building, set your rates, and earn from neighbours who need documents printed.</p>
                <ul className="space-y-2 mb-6">
                  {['Free to register', 'Set your own price per page', 'Cover your ink costs — and more'].map((pt, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle size={13} className="text-green shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <button className="w-full min-h-[48px] rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90" style={{ background: 'linear-gradient(135deg, #FF6B35, #e85d25)' }}>
                    Register as Home Owner →
                  </button>
                </Link>
              </div>
            </div>

            {/* Print shop */}
            <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] p-7 space-y-5" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.10), transparent 60%)' }} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <Store size={22} className="text-violet2" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-white text-xl leading-tight">Print Shop</p>
                    <p className="text-xs text-violet2 font-semibold mt-0.5">Grow beyond walk-ins</p>
                  </div>
                </div>
                <p className="text-white/50 text-sm leading-relaxed mb-5">You run a print business. Accept online orders, showcase your services, and reach customers within 1–5 km who can't walk in.</p>
                <ul className="space-y-2 mb-6">
                  {['Free to list your shop', 'Distance-based delivery pricing', 'Full service menu display'].map((pt, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle size={13} className="text-green shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <button className="w-full min-h-[48px] rounded-xl font-bold text-sm text-white bg-violet hover:bg-violet/90 transition-colors">
                    Register your Shop →
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Value strip */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.08] p-4 flex items-start gap-3" style={{ background: 'rgba(255,107,53,0.06)' }}>
              <span className="text-2xl shrink-0">🖨️</span>
              <div>
                <p className="font-bold text-white text-sm">Your printer already runs. Let it pay for itself.</p>
                <p className="text-white/40 text-xs mt-1 leading-relaxed">Stop buying ink out of pocket. Your neighbours cover your cartridge costs — and you pocket the rest.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] p-4 flex items-start gap-3" style={{ background: 'rgba(124,58,237,0.06)' }}>
              <span className="text-2xl shrink-0">📦</span>
              <div>
                <p className="font-bold text-white text-sm">Every customer who can't walk in is a lost order.</p>
                <p className="text-white/40 text-xs mt-1 leading-relaxed">InkNeighbour puts your shop in front of nearby customers who need printing but won't travel for it.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-ink border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-center space-y-4">
          <p className="font-display font-black text-2xl text-white tracking-tight">
            Ink<span className="text-orange">Neighbour</span>
          </p>
          <p className="text-white/30 text-sm font-medium tracking-widest uppercase">Print it. Drop it. Done.</p>
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
