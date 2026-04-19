import { useState, useEffect } from 'react'
import { Download, CheckCircle, Printer, XCircle, Clock, AlertCircle, ShieldCheck, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { formatCurrency } from '../lib/countries'
import { useJobs } from '../hooks/useJobs'

export default function JobCard({ job, onRefresh, shopSlug }) {
  const { t } = useTranslation()
  const { acceptJob, markPrinting, markDelivered, cancelJob, getSignedUrl } = useJobs()
  const [downloading, setDownloading] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  // Persisted per tab-session so navigating away and back doesn't reset it
  const sessionKey = `downloaded_${job.id}`
  const [downloaded, setDownloaded] = useState(
    () => sessionStorage.getItem(sessionKey) === '1'
  )

  // Live expiry check — re-evaluates every 10 s so the UI reacts without a manual refresh
  const [isExpired, setIsExpired] = useState(
    () => job.sla_deadline ? new Date(job.sla_deadline) < new Date() : false
  )
  useEffect(() => {
    if (!job.sla_deadline || job.status !== 'submitted') return
    const check = () => setIsExpired(new Date(job.sla_deadline) < new Date())
    check()
    const id = setInterval(check, 10_000)
    return () => clearInterval(id)
  }, [job.sla_deadline, job.status])

  const countryCode = job.country_code || 'IN'

  async function handleDownload() {
    setDownloading(true)
    const { url, error } = await getSignedUrl(job.file_path)
    if (error) { alert(t('errors.download_failed')); setDownloading(false); return }
    window.open(url, '_blank')
    setDownloading(false)
    setDownloaded(true)
    sessionStorage.setItem(sessionKey, '1')
  }

  async function handleAction(action) {
    await action(job.id)
    onRefresh?.()
  }

  const formattedAmount = formatCurrency(job.total_amount, countryCode)
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }).format(new Date(job.created_at))

  // Show download button while the file still exists (before delivered/cancelled)
  const canDownload = job.file_path && ['submitted', 'accepted', 'printing'].includes(job.status)

  return (
    <div className="bg-surface rounded-xl shadow-card p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-ink text-lg">#{job.job_number}</p>
          <p className="text-sm text-muted flex items-center gap-1">
            <Clock size={14} /> {formattedDate}
          </p>
        </div>
        <Badge status={job.status} />
      </div>

      {/* Customer info */}
      <div className="bg-bg rounded-xl p-3 space-y-1">
        <p className="font-semibold text-ink">{job.customer_name} · Flat {job.customer_flat}</p>
        {job.customer_phone && (
          <a href={`tel:${job.customer_phone}`} className="text-sm text-violet font-medium">
            {job.customer_phone}
          </a>
        )}
      </div>

      {/* Print details */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="col-span-2 min-w-0">
          <span className="text-muted">{t('job.file')}: </span>
          <span className="font-medium text-ink break-all">{job.file_name}</span>
        </div>
        <div>
          <span className="text-muted">{t('job.pages')}: </span>
          <span className="font-medium text-ink">{job.page_count ?? '?'}</span>
        </div>
        <div>
          <span className="text-muted">{t('job.type')}: </span>
          <span className="font-medium text-ink">{job.print_type === 'bw' ? 'B&W' : 'Colour'}</span>
        </div>
        <div>
          <span className="text-muted">{t('job.copies')}: </span>
          <span className="font-medium text-ink">{job.copies}</span>
        </div>
        <div>
          <span className="text-muted">{t('job.paper')}: </span>
          <span className="font-medium text-ink">{job.paper_size}</span>
        </div>
        <div>
          <span className="text-muted">{t('job.payment')}: </span>
          <span className="font-medium text-ink capitalize">{job.payment_method}</span>
        </div>
      </div>

      {/* Tracking link */}
      {shopSlug && job.customer_phone && !['cancelled','feedback_done'].includes(job.status) && (
        <a
          href={`https://wa.me/${job.customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${job.customer_name.split(' ')[0]}, track your print order ${job.job_number} here:\n\n${(import.meta.env.VITE_APP_URL || window.location.origin)}/${shopSlug}/confirm/${job.id}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs font-semibold text-green hover:text-green/80 transition-colors min-h-[36px]"
        >
          <MessageCircle size={13} /> Send tracking link to customer
        </a>
      )}

      {/* Amount */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-muted text-sm">{t('job.total')}</span>
        <span className="text-xl font-bold text-ink">{formattedAmount}</span>
      </div>

      {/* Download — visible as long as file exists */}
      {canDownload && (
        <Button
          variant={downloaded ? 'muted' : 'ghost'}
          size="sm"
          loading={downloading}
          onClick={handleDownload}
          className="w-full"
        >
          <Download size={15} />
          {downloaded ? 'Download again' : 'Download document'}
        </Button>
      )}

      {/* Must-download nudge before marking as Printing */}
      {job.status === 'accepted' && !downloaded && (
        <div className="flex items-start gap-2 bg-amber/10 border border-amber/30 rounded-xl px-3 py-2.5 text-sm text-amber font-medium">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          Download the document before marking as Printing.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 items-center">
        {job.status === 'submitted' && (
          isExpired ? (
            <div className="flex-1 flex items-center gap-2 bg-red/10 border border-red/30 rounded-xl px-3 py-2 text-sm text-red font-semibold">
              <Clock size={14} className="shrink-0" /> Timer expired — this order will be auto-cancelled on next refresh.
            </div>
          ) : (
            <>
              <Button size="sm" onClick={() => handleAction(acceptJob)}>
                <CheckCircle size={15} /> Accept
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleAction(cancelJob)}>
                <XCircle size={15} /> Decline
              </Button>
            </>
          )
        )}
        {job.status === 'accepted' && (
          <Button
            size="sm"
            disabled={!downloaded}
            title={downloaded ? undefined : 'Download the document first'}
            onClick={() => handleAction(markPrinting)}
            className="flex-1"
          >
            <Printer size={15} /> Mark as Printing
          </Button>
        )}
        {job.status === 'printing' && (
          job.delivery_pin ? (
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="number"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Enter delivery PIN"
                    value={pinInput}
                    onChange={e => { setPinInput(e.target.value.slice(0, 4)); setPinError(false) }}
                    className={[
                      'w-full pl-9 pr-3 py-2 rounded-xl border-2 text-base font-mono font-bold tracking-widest bg-bg text-ink focus:outline-none focus:ring-2 focus:ring-violet/40',
                      pinError ? 'border-red' : 'border-border'
                    ].join(' ')}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (pinInput === job.delivery_pin) {
                      handleAction(markDelivered)
                    } else {
                      setPinError(true)
                      setPinInput('')
                    }
                  }}
                >
                  <CheckCircle size={15} /> Delivered
                </Button>
              </div>
              {pinError && (
                <p className="text-xs text-red font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> Wrong PIN — ask the customer to check their order page.
                </p>
              )}
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => handleAction(markDelivered)} className="flex-1">
              <CheckCircle size={15} /> Mark as Delivered
            </Button>
          )
        )}
      </div>
    </div>
  )
}
