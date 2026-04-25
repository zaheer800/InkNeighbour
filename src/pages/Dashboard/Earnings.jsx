import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Copy } from 'lucide-react'
import { useOwner } from '../../hooks/useOwner'
import { useJobs } from '../../hooks/useJobs'
import { formatCurrency } from '../../lib/countries'
import { buildShopShareLink } from '../../notifications/whatsapp'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import AppNav from '../../components/AppNav'
import DashboardNav from '../../components/DashboardNav'

const PERIODS = ['today', 'week', 'month', 'all']
const PERIOD_LABELS = { today: 'Today', week: 'This week', month: 'This month', all: 'All time' }

function getPeriodStart(period) {
  const d = new Date()
  if (period === 'today') {
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (period === 'week') {
    // Monday of the current week at midnight
    const day = d.getDay() // 0=Sun … 6=Sat
    const daysFromMonday = day === 0 ? 6 : day - 1
    d.setDate(d.getDate() - daysFromMonday)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (period === 'month') {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }
  return new Date(0) // all time
}

export default function DashboardEarnings() {
  const { t } = useTranslation()
  const { owner } = useOwner()
  const { jobs } = useJobs()
  const [period, setPeriod] = useState('today')
  const [cartridgeCost, setCartridgeCost] = useState('')
  const [copied, setCopied] = useState(false)

  const countryCode = owner?.country_code || 'IN'
  const fmt = v => formatCurrency(v, countryCode)

  const start = getPeriodStart(period)
  const deliveredJobs = jobs.filter(j =>
    j.status === 'delivered' && new Date(j.updated_at) >= start
  )

  const totalEarned = deliveredJobs.reduce((s, j) => s + j.total_amount, 0)
  const pagesTotal = deliveredJobs.reduce((s, j) => s + (j.page_count || 0) * (j.copies || 1), 0)
  const bwPages = deliveredJobs.filter(j => j.print_type === 'bw').reduce((s, j) => s + (j.page_count || 0) * (j.copies || 1), 0)
  const colorPages = deliveredJobs.filter(j => j.print_type === 'color').reduce((s, j) => s + (j.page_count || 0) * (j.copies || 1), 0)
  // Derive per-job delivery fee from what was actually charged, not the current owner rate
  const deliveryTotal = deliveredJobs.reduce((s, j) => {
    const pages = (j.page_count || 0) * (j.copies || 1)
    const rate = j.print_type === 'color' ? (owner?.color_rate || 0) : (owner?.bw_rate || 0)
    const printCost = pages * rate
    return s + Math.max(0, j.total_amount - printCost)
  }, 0)

  const cartridgePaise = cartridgeCost ? Math.round(parseFloat(cartridgeCost) * 100) : 0
  const netProfit = totalEarned - cartridgePaise

  let motivationMsg = ''
  if (totalEarned === 0) motivationMsg = t('earnings.loss_msg')
  else if (cartridgePaise > 0) {
    if (netProfit > 0) motivationMsg = t('earnings.profitable_msg')
    else if (netProfit >= -1000) motivationMsg = t('earnings.breakeven_msg')
    else motivationMsg = t('earnings.loss_msg')
  }

  const shopSlug = owner?.societies?.slug
  const appUrl = window.location.origin
  const shopUrl = shopSlug ? `${appUrl}/${shopSlug}` : ''

  function copyLink() {
    const write = navigator.clipboard
      ? navigator.clipboard.writeText(shopUrl)
      : Promise.resolve().then(() => {
          const el = document.createElement('textarea')
          el.value = shopUrl
          Object.assign(el.style, { position: 'fixed', opacity: '0' })
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        })
    write.then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <AppNav />
      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-xl font-bold text-ink">{t('earnings.title')}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Period selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={[
                'flex-shrink-0 px-4 py-2 rounded-pill text-sm font-semibold transition-colors',
                period === p ? 'bg-violet text-white' : 'bg-surface text-muted hover:bg-border'
              ].join(' ')}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Summary card */}
        <div className="bg-ink2 text-white rounded-xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-white/60 text-sm">{t('earnings.total_earned')}</p>
            <p className="font-display text-5xl font-black mt-1">{fmt(totalEarned)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{pagesTotal}</p>
              <p className="text-xs text-white/60">{t('earnings.pages_printed')}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{deliveredJobs.length}</p>
              <p className="text-xs text-white/60">{t('earnings.jobs_count')}</p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <h2 className="font-bold text-ink">{t('earnings.bw_breakdown')}</h2>
          {[
            { label: `B&W ${bwPages} pages × ${fmt(owner?.bw_rate || 0)}`, value: fmt((owner?.bw_rate || 0) * bwPages) },
            { label: `Colour ${colorPages} pages × ${fmt(owner?.color_rate || 0)}`, value: fmt((owner?.color_rate || 0) * colorPages) },
            { label: t('earnings.delivery_total'), value: fmt(deliveryTotal) }
          ].map(row => (
            <div key={row.label} className="flex justify-between text-base">
              <span className="text-muted">{row.label}</span>
              <span className="font-semibold text-ink">{row.value}</span>
            </div>
          ))}

          <div className="border-t border-border pt-3 space-y-2">
            <Input
              label={t('earnings.cartridge_cost')}
              type="number"
              value={cartridgeCost}
              onChange={e => setCartridgeCost(e.target.value)}
              placeholder="e.g. 800"
              min="0"
              hint="Optional — enter your actual cartridge cost (₹)"
            />
            {cartridgePaise > 0 && (
              <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                <span className="text-ink">{t('earnings.net_profit')}</span>
                <span className={netProfit >= 0 ? 'text-green' : 'text-red'}>{fmt(netProfit)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Motivational message */}
        {motivationMsg && (
          <div className="bg-green/10 border border-green/30 rounded-xl p-4 text-green font-semibold text-base text-center">
            {motivationMsg}
          </div>
        )}

        {/* Share link */}
        {shopUrl && (
          <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
            <h2 className="font-bold text-ink">{t('earnings.share_link')}</h2>
            <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-4 py-3">
              <span className="flex-1 font-mono text-sm text-ink break-all">{shopUrl}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={copyLink} className="flex-1">
                <Copy size={16} /> {copied ? 'Copied!' : t('success.copy_link')}
              </Button>
              <a
                href={buildShopShareLink(shopUrl, owner?.societies?.name || '')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 bg-green text-white font-bold rounded-[14px] text-sm hover:opacity-90 transition-opacity"
              >
                <ExternalLink size={16} /> WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      <DashboardNav />
    </div>
  )
}
