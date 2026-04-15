import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/countries'
import UPIQRCode from '../components/UPIQRCode'
import Button from '../components/ui/Button'

export default function OrderConfirm() {
  const { slug, jobId } = useParams()
  const { t } = useTranslation()
  const [job, setJob] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('jobs')
      .select(`*, owners(id, name, phone, upi_id, shop_name, country_code)`)
      .eq('id', jobId)
      .single()
      .then(({ data }) => {
        if (data) {
          setJob(data)
          setOwner(data.owners)
        }
        setLoading(false)
      })
  }, [jobId])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('common.loading')}</p></div>
  if (!job || !owner) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('errors.shop_not_found')}</p></div>

  const countryCode = owner.country_code || 'IN'
  const fmt = v => formatCurrency(v, countryCode)

  return (
    <div className="min-h-screen bg-bg">
      {/* Success header */}
      <div className="page-hero px-4 py-12 text-white text-center relative">
        <div className="relative z-10 max-w-sm mx-auto space-y-3">
          <div className="w-16 h-16 bg-green/20 rounded-xl flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green" />
          </div>
          <h1 className="font-display text-3xl font-bold">{t('order_confirm.title')}</h1>
          <p className="text-white/70">{t('order_confirm.subtitle')}</p>
          <p className="text-white/60 text-sm font-mono">#{job.job_number}</p>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-8 space-y-5">
        {/* Order summary */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <h2 className="font-bold text-lg text-ink">{t('order_confirm.summary_title')}</h2>
          <div className="space-y-2 text-base">
            {[
              { label: 'Document', value: job.file_name || 'Uploaded file' },
              { label: 'Pages', value: job.page_count ?? 'To be confirmed' },
              { label: 'Type', value: job.print_type === 'bw' ? 'Black & White' : 'Colour' },
              { label: 'Copies', value: job.copies },
              { label: 'Paper', value: job.paper_size },
              { label: 'Total', value: <span className="font-bold text-orange text-xl">{fmt(job.total_amount)}</span> }
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted">{row.label}</span>
                <span className="font-medium text-ink">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment instructions */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
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
        </div>

        {/* Contact */}
        {owner.phone && (
          <div className="bg-surface rounded-xl shadow-card p-5">
            <p className="text-muted text-sm">{t('order_confirm.contact', { name: owner.name.split(' ')[0] })}</p>
            <a href={`tel:${owner.phone}`} className="text-violet font-bold text-lg mt-1 block hover:underline">
              {owner.phone}
            </a>
          </div>
        )}

        <Link to={`/${slug}`}>
          <Button variant="ghost" className="w-full">← Place another order</Button>
        </Link>
      </div>
    </div>
  )
}
