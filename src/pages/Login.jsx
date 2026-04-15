import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
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
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="page-hero px-4 py-12 text-white relative">
        <div className="relative z-10 text-center max-w-sm mx-auto">
          <Link to="/" className="font-display font-bold text-2xl text-white">
            Ink<span className="text-orange">Neighbour</span>
          </Link>
          <h1 className="font-display text-3xl font-bold mt-4">{t('login.title')}</h1>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-card p-6 space-y-5">
            <Input
              label={t('login.email_label')}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
            />
            <Input
              label={t('login.password_label')}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            {error && (
              <p className="text-sm text-red bg-red/5 border border-red/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              {loading ? t('login.signing_in') : t('login.cta')}
            </Button>
          </form>

          <p className="text-center text-muted mt-6 text-base">
            {t('login.no_account')}{' '}
            <Link to="/register" className="text-violet font-semibold hover:underline">
              {t('login.register_link')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
