import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, Copy, Check, RefreshCw, PackageCheck, Printer, Truck, ClipboardList, ShieldCheck, Link2, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/countries'
import UPIQRCode from '../components/UPIQRCode'
import Button from '../components/ui/Button'
import AppNav from '../components/AppNav'
import Footer from '../components/Footer'

const STATUS_STEPS = [
  { key: 'submitted',  label: 'Received',  icon: ClipboardList },
  { key: 'accepted',   label: 'Accepted',  icon: CheckCircle },
  { key: 'printing',   label: 'Printing',  icon: Printer },
  { key: 'delivered',  label: 'Delivered', icon: Truck },
]

const STATUS_ORDER = ['submitted', 'accepted', 'printing', 'delivered', 'feedback_pending', 'feedback_done']

function getStepIndex(status) {
  if (status === 'cancelled') return -1
  const i = STATUS_ORDER.indexOf(status)
  // feedback_pending / feedback_done both map to "delivered" step visually
  return Math.min(i, 3)
}

export default function OrderConfirm() {
  const { slug, jobId } = useParams()
  const { t } = useTranslation()
  const [job, setJob] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const fetchJob = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    const { data } = await supabase
      .from('jobs')
      .select(`*, owners(id, name, phone, upi_id, shop_name, country_code)`)
      .eq('id', jobId)
      .single()
    if (data) {
      setJob(data)
      setOwner(data.owners)
    }
    setLoading(false)
    setRefreshing(false)
  }, [jobId])

  useEffect(() => {
    fetchJob(true)
    const interval = setInterval(() => fetchJob(true), 30000)
    return () => clearInterval(interval)
  }, [fetchJob])

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
  const trackingUrl = `${appUrl}/${slug}/confirm/${jobId}`

  function copyOrderId() {
    navigator.clipboard.writeText(job.job_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyTrackingLink() {
    navigator.clipboard.writeText(trackingUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('common.loading')}</p></div>
  if (!job || !owner) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('errors.shop_not_found')}</p></div>

  const countryCode = owner.country_code || 'IN'
  const fmt = v => formatCurrency(v, countryCode)
  const stepIndex = getStepIndex(job.status)
  const isCancelled = job.status === 'cancelled'

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav />

      {/* Header — changes based on cancellation */}
      <div className="page-hero px-4 py-10 text-white text-center relative">
        <div className="relative z-10 max-w-sm mx-auto space-y-3">
          {isCancelled ? (
            <>
              <div className="w-16 h-16 bg-red/20 rounded-xl flex items-center justify-center mx-auto">
                <XCircle size={40} className="text-red" />
              </div>
              <h1 className="font-display text-3xl font-bold">Order Cancelled</h1>
              <p className="text-white/70 text-base">This order was declined by the shop owner.</p>
              <button
                onClick={copyOrderId}
                className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 mx-auto"
              >
                <span className="font-mono font-bold text-white text-lg tracking-wider">{job.job_number}</span>
                {copied ? <Check size={16} className="text-green shrink-0" /> : <Copy size={16} className="text-white/60 shrink-0" />}
              </button>
              <p className="text-white/50 text-xs">Tap to copy your Order ID</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green/20 rounded-xl flex items-center justify-center mx-auto">
                <CheckCircle size={40} className="text-green" />
              </div>
              <h1 className="font-display text-3xl font-bold">{t('order_confirm.title')}</h1>
              <p className="text-white/70 text-base">{t('order_confirm.subtitle')}</p>

              {/* Copyable Order ID */}
              <button
                onClick={copyOrderId}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-4 py-2.5 transition-colors mx-auto"
              >
                <span className="font-mono font-bold text-white text-lg tracking-wider">{job.job_number}</span>
                {copied
                  ? <Check size={16} className="text-green shrink-0" />
                  : <Copy size={16} className="text-white/60 shrink-0" />
                }
              </button>
              <p className="text-white/50 text-xs">Tap to copy your Order ID</p>

              {/* Tracking link */}
              <div className="flex gap-2 justify-center pt-1">
                <button
                  onClick={copyTrackingLink}
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-xs font-semibold text-white/80 transition-colors"
                >
                  {linkCopied ? <Check size={13} className="text-green" /> : <Link2 size={13} />}
                  {linkCopied ? 'Link copied!' : 'Copy tracking link'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Track my InkNeighbour order ${job.job_number}\n\n${trackingUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-xs font-semibold text-white/80 transition-colors"
                >
                  <MessageCircle size={13} /> Save to WhatsApp
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-sm mx-auto w-full px-4 py-5 pb-8 space-y-4">

        {/* Delivery PIN */}
        {job.delivery_pin && job.status !== 'delivered' && job.status !== 'cancelled' && job.status !== 'feedback_pending' && job.status !== 'feedback_done' && (
          <div className="bg-violet/5 border-2 border-violet/30 rounded-xl p-5 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-violet font-bold text-base">
              <ShieldCheck size={18} /> Delivery PIN
            </div>
            <p className="text-5xl font-black font-mono tracking-[0.2em] text-ink">{job.delivery_pin}</p>
            <p className="text-sm text-muted leading-relaxed">
              Share this PIN with the owner when they arrive at your door.<br />
              They'll need it to confirm delivery.
            </p>
          </div>
        )}

        {/* Order Status Tracker */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-ink">Order Status</h2>
            <button
              onClick={() => fetchJob(false)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-violet font-semibold min-h-[36px] px-2 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {isCancelled ? (
            <div className="bg-red/10 border border-red/30 rounded-xl p-4 text-red font-semibold text-base text-center">
              Order Cancelled
            </div>
          ) : (
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" style={{ left: '10%', right: '10%' }} />
              <div
                className="absolute top-5 h-0.5 bg-green transition-all duration-500"
                style={{ left: '10%', width: `${stepIndex > 0 ? (stepIndex / 3) * 80 : 0}%` }}
              />

              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, i) => {
                  const done = i < stepIndex
                  const active = i === stepIndex
                  const Icon = step.icon
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-1.5 w-16">
                      <div className={[
                        'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-surface',
                        done   ? 'border-green bg-green/10'   :
                        active ? 'border-orange bg-orange/10' :
                        'border-border'
                      ].join(' ')}>
                        <Icon size={18} className={done ? 'text-green' : active ? 'text-orange' : 'text-muted'} />
                      </div>
                      <span className={[
                        'text-xs font-semibold text-center leading-tight',
                        done ? 'text-green' : active ? 'text-orange' : 'text-muted'
                      ].join(' ')}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!isCancelled && stepIndex < 3 && (
            <p className="text-xs text-muted text-center">Updates every 30 seconds · Tap Refresh to check now</p>
          )}
          {stepIndex === 3 && (
            <div className="flex items-center justify-center gap-2 text-green text-sm font-semibold">
              <PackageCheck size={16} /> Your printout has been delivered!
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <h2 className="font-bold text-lg text-ink">{t('order_confirm.summary_title')}</h2>
          <div className="space-y-2 text-base">
            {[
              { label: 'Order ID',  value: <span className="font-mono font-bold text-violet">{job.job_number}</span> },
              { label: 'Document', value: job.file_name || 'Uploaded file' },
              { label: 'Pages',    value: job.page_count ?? 'To be confirmed' },
              { label: 'Type',     value: job.print_type === 'bw' ? 'Black & White' : 'Colour' },
              { label: 'Copies',   value: job.copies },
              { label: 'Paper',    value: job.paper_size },
              { label: 'Total',    value: <span className="font-bold text-orange text-xl">{fmt(job.total_amount)}</span> }
            ].map(row => (
              <div key={row.label} className="flex justify-between gap-3">
                <span className="text-muted shrink-0">{row.label}</span>
                <span className="font-medium text-ink text-right break-all">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment instructions — hidden when cancelled */}
        {!isCancelled && <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <h2 className="font-bold text-lg text-ink">{t('order_confirm.payment_title')}</h2>
          {job.payment_method === 'upi' && owner.upi_id ? (
            <UPIQRCode
              upiId={owner.upi_id}
              amount={job.total_amount}
              shopName={owner.shop_name || 'InkNeighbour'}
              countryCode={countryCode}
            />
          ) : (
            <div className="bg-amber/10 border border-amber/30 rounded-xl p-4 text-amber font-medium text-base">
              {t('order_confirm.cash_instructions', {
                amount: fmt(job.total_amount),
                ownerName: owner.name.split(' ')[0]
              })}
            </div>
          )}
        </div>}

        {/* Contact */}
        {owner.phone && (
          <div className="bg-surface rounded-xl shadow-card p-5">
            <p className="text-muted text-sm">{t('order_confirm.contact', { name: owner.name.split(' ')[0] })}</p>
            <a href={`tel:${owner.phone}`} className="text-violet font-bold text-lg mt-1 block hover:underline">
              {owner.phone}
            </a>
          </div>
        )}

        {/* Place another order */}
        <Link to={`/${slug}`} className="block">
          <Button variant="muted" size="md" className="w-full">
            Place Another Order
          </Button>
        </Link>
      </div>

      <Footer />
    </div>
  )
}
