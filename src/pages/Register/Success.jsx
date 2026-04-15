import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, Copy, ExternalLink } from 'lucide-react'
import Button from '../../components/ui/Button'
import { buildShopShareLink } from '../../notifications/whatsapp'

export default function Success() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('reg_success')
    if (!saved) { navigate('/register'); return }
    setData(JSON.parse(saved))
  }, [navigate])

  function copyLink() {
    navigator.clipboard.writeText(data.shopUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!data) return null

  const whatsappLink = buildShopShareLink(data.shopUrl, data.societyName)

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full space-y-6 text-center">
        {/* Pending icon */}
        <div className="w-20 h-20 bg-amber/15 rounded-xl flex items-center justify-center mx-auto">
          <Clock size={48} className="text-amber" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-4xl font-black text-ink">{t('success.pending_title')}</h1>
          <p className="text-muted text-lg">{t('success.pending_desc')}</p>
        </div>

        {/* Shop URL — for reference */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3 text-left">
          <p className="text-sm font-semibold text-muted">{t('success.url_preview')}</p>
          <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-4 py-3">
            <span className="flex-1 font-mono text-sm text-ink break-all">{data.shopUrl}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyLink}
              className="flex-1"
            >
              <Copy size={16} /> {copied ? t('success.link_copied') : t('success.copy_link')}
            </Button>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 bg-green text-white font-bold rounded-[14px] text-sm hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={16} /> {t('success.share_whatsapp')}
            </a>
          </div>
        </div>

        <Link to="/dashboard">
          <Button className="w-full" size="lg">
            {t('success.go_dashboard')} →
          </Button>
        </Link>
      </div>
    </div>
  )
}
