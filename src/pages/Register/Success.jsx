import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Mail, MessageCircle, Clock, Printer, Bell } from 'lucide-react'
import Button from '../../components/ui/Button'
import AppNav from '../../components/AppNav'
import Footer from '../../components/Footer'

export default function Success() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('reg_success')
    if (!saved) { navigate('/register'); return }
    setData(JSON.parse(saved))
  }, [navigate])

  if (!data) return null

  const needsEmailVerify = Boolean(data.pendingEmail)

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden">
      <AppNav />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full space-y-6 text-center">

        {/* Icon */}
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto ${needsEmailVerify ? 'bg-violet/10' : 'bg-green/15'}`}>
          {needsEmailVerify
            ? <Mail size={48} className="text-violet" />
            : <CheckCircle2 size={48} className="text-green" />
          }
        </div>

        {needsEmailVerify ? (
          <>
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-black text-ink">Check your email</h1>
              <p className="text-muted text-base leading-relaxed">
                We sent a confirmation link to{' '}
                <strong className="text-ink">{data.pendingEmail}</strong>.
                Click the link to verify your account.
              </p>
            </div>

            <div className="bg-surface rounded-xl shadow-card p-5 text-left space-y-3">
              <p className="text-sm font-bold text-ink">What happens next</p>
              {[
                { icon: Mail,          text: 'Click the link in your email to confirm your account' },
                { icon: Clock,         text: 'Our team reviews your shop — usually within a few hours' },
                { icon: MessageCircle, text: 'We\'ll send your shop link to your WhatsApp once approved' },
                { icon: Printer,       text: 'Go live and start accepting print orders from neighbours' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-muted">
                  <item.icon size={16} className="text-violet shrink-0 mt-0.5" />
                  {item.text}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted">
              Didn't receive it? Check your spam folder, or{' '}
              <Link to="/register" className="text-violet font-semibold hover:underline">start again</Link>.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-black text-ink">Shop submitted!</h1>
              <p className="text-muted text-base leading-relaxed">
                Your shop is under review. Once approved, we'll send your shop link directly to your WhatsApp number.
              </p>
            </div>

            <div className="bg-surface rounded-xl shadow-card p-5 text-left space-y-3">
              <p className="text-sm font-bold text-ink">While you wait</p>
              {[
                { icon: Clock,         text: 'Our team reviews your shop — usually within a few hours' },
                { icon: MessageCircle, text: 'Your shop link will be sent to your WhatsApp once approved' },
                { icon: Bell,          text: 'Enable notifications in the dashboard to hear when orders arrive' },
                { icon: Printer,       text: 'Make sure your printer has ink and paper loaded' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-muted">
                  <item.icon size={16} className="text-green shrink-0 mt-0.5" />
                  {item.text}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Link to="/dashboard">
                <Button className="w-full" size="md">
                  {t('success.go_dashboard')}
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
      </div>
      <Footer />
    </div>
  )
}
