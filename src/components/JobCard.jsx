import { useState } from 'react'
import { Download, CheckCircle, Printer, XCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { formatCurrency } from '../lib/countries'
import { useJobs } from '../hooks/useJobs'

export default function JobCard({ job, onRefresh }) {
  const { t } = useTranslation()
  const { acceptJob, markPrinting, markDelivered, cancelJob, getSignedUrl } = useJobs()
  const [downloading, setDownloading] = useState(false)

  const countryCode = job.country_code || 'IN'

  async function handleDownload() {
    setDownloading(true)
    const { url, error } = await getSignedUrl(job.file_path)
    if (error) { alert(t('errors.download_failed')); setDownloading(false); return }
    window.open(url, '_blank')
    setDownloading(false)
  }

  async function handleAction(action) {
    await action(job.id)
    onRefresh?.()
  }

  const formattedAmount = formatCurrency(job.total_amount, countryCode)
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }).format(new Date(job.created_at))

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
        <div>
          <span className="text-muted">{t('job.file')}: </span>
          <span className="font-medium text-ink truncate">{job.file_name}</span>
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

      {/* Amount */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-muted text-sm">{t('job.total')}</span>
        <span className="text-xl font-bold text-ink">{formattedAmount}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {['submitted', 'accepted'].includes(job.status) && job.file_path && (
          <Button variant="ghost" size="sm" loading={downloading} onClick={handleDownload}>
            <Download size={16} /> {t('job.download')}
          </Button>
        )}
        {job.status === 'submitted' && (
          <>
            <Button size="sm" onClick={() => handleAction(acceptJob)}>
              <CheckCircle size={16} /> {t('job.accept')}
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleAction(cancelJob)}>
              <XCircle size={16} /> {t('job.cancel')}
            </Button>
          </>
        )}
        {job.status === 'accepted' && (
          <Button size="sm" onClick={() => handleAction(markPrinting)}>
            <Printer size={16} /> {t('job.mark_printing')}
          </Button>
        )}
        {job.status === 'printing' && (
          <Button size="sm" variant="secondary" onClick={() => handleAction(markDelivered)}>
            <CheckCircle size={16} /> {t('job.mark_delivered')}
          </Button>
        )}
      </div>
    </div>
  )
}
