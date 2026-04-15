import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Printer, ArrowRight, Mail, Lock, ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(t('login.error_invalid'))
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col lg:flex-row overflow-x-hidden">

      {/* ── Left panel — brand (desktop only) ──────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] shrink-0 relative overflow-hidden bg-ink2 flex-col justify-between p-12">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-ink2 via-[#1e1545] to-[#0f0f1a]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-violet/25 rounded-full blur-[80px] translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-1/4 left-0 w-56 h-56 bg-orange/20 rounded-full blur-[70px] -translate-x-1/3 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 space-y-6">
          <Link to="/" className="font-display font-black text-2xl text-white inline-block">
            Ink<span className="text-orange">Neighbour</span>
          </Link>

          <div className="space-y-3 pt-8">
            <div className="w-14 h-14 bg-orange/20 border border-orange/30 rounded-2xl flex items-center justify-center">
              <Printer size={26} className="text-orange" />
            </div>
            <h1 className="font-display text-4xl font-black text-white leading-tight">
              Welcome back,<br />
              <span className="text-orange">Owner.</span>
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              Sign in to manage your print jobs, track earnings, and keep your neighbours happy.
            </p>
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 bg-white/8 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-amber text-sm">★</span>
            ))}
          </div>
          <p className="text-white/80 text-sm leading-relaxed">
            "I cover my ink costs every month now. Set it up once, print when neighbours ask — it's that simple."
          </p>
          <p className="text-white/40 text-xs mt-3 font-semibold">Owner · Sunshine Apartments, Mumbai</p>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">

        {/* Mobile header */}
        <div className="lg:hidden bg-ink2 px-4 pt-6 pb-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-ink2 to-[#2d1b69]" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet/20 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="relative z-10 flex items-center mb-6">
            <Link
              to="/"
              aria-label="Back to home"
              className="p-2 text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
            >
              <ChevronLeft size={22} />
            </Link>
            {/* Logo centred in the remaining space, offset by button width so it's visually centred */}
            <span className="flex-1 text-center font-display font-black text-white text-lg" style={{ marginRight: '44px' }}>
              Ink<span className="text-orange">Neighbour</span>
            </span>
          </div>
          <div className="relative z-10 text-center">
            <div className="w-12 h-12 bg-orange/20 border border-orange/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Printer size={22} className="text-orange" />
            </div>
            <h1 className="font-display text-2xl font-black text-white">{t('login.title')}</h1>
            <p className="text-white/60 text-sm mt-1.5">Access your shop dashboard</p>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 lg:py-0">
          <div className="w-full max-w-sm">

            {/* Desktop back link */}
            <Link
              to="/"
              className="hidden lg:inline-flex items-center gap-1.5 text-muted hover:text-ink text-sm font-medium transition-colors mb-8 min-h-[44px]"
            >
              <ChevronLeft size={16} />
              Back to home
            </Link>

            {/* Desktop heading */}
            <div className="hidden lg:block mb-8">
              <h2 className="font-display text-3xl font-black text-ink">Sign in</h2>
              <p className="text-muted text-base mt-1.5">Access your InkNeighbour dashboard</p>
            </div>

            {/* Form card */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-semibold text-ink">
                  {t('login.email_label')}
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full min-h-[52px] pl-11 pr-4 py-3 rounded-xl border border-border bg-surface text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet transition-colors"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-sm font-semibold text-ink">
                  {t('login.password_label')}
                </label>
                <div className="relative">
                  <Lock
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full min-h-[52px] pl-11 pr-4 py-3 rounded-xl border border-border bg-surface text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet transition-colors"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red/5 border border-red/20 rounded-xl px-4 py-3">
                  <p className="text-sm text-red font-medium">{error}</p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                loading={loading}
                className="w-full mt-2"
                size="lg"
              >
                {loading ? t('login.signing_in') : t('login.cta')}
                {!loading && <ArrowRight size={18} />}
              </Button>
            </form>

            {/* Register link */}
            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-muted text-[15px]">
                {t('login.no_account')}{' '}
                <Link
                  to="/register"
                  className="text-violet font-bold hover:text-violet/80 transition-colors"
                >
                  {t('login.register_link')}
                </Link>
              </p>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-muted/60 mt-6">
              By signing in, you agree to our{' '}
              <Link to="/terms" className="hover:text-muted transition-colors underline underline-offset-2">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="hover:text-muted transition-colors underline underline-offset-2">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
