import { useTranslation } from 'react-i18next'
import { getPriceBreakdown } from '../lib/pricing'
import { formatCurrency } from '../lib/countries'

/**
 * Displays a clear, line-by-line price breakdown for a print job.
 * No hidden fees — transparent pricing per PRD requirement.
 */
export default function PriceBreakdown({ pages, copies, ratePerPage, deliveryFee, countryCode = 'IN' }) {
  const { t } = useTranslation()
  const { printSubtotal, total } = getPriceBreakdown(pages, copies, ratePerPage, deliveryFee)

  const fmt = (v) => formatCurrency(v, countryCode)

  if (!pages || !copies || !ratePerPage) return null

  return (
    <div className="bg-bg rounded-xl p-4 space-y-2 text-base">
      <div className="flex justify-between text-muted">
        <span>{pages} {t('price.pages')} × {copies} {t('price.copies')} × {fmt(ratePerPage)}</span>
        <span className="font-medium text-ink">{fmt(printSubtotal)}</span>
      </div>
      {deliveryFee > 0 && (
        <div className="flex justify-between text-muted">
          <span>{t('price.delivery_fee')}</span>
          <span className="font-medium text-ink">{fmt(deliveryFee)}</span>
        </div>
      )}
      <div className="border-t border-border pt-2 flex justify-between">
        <span className="font-bold text-ink text-lg">{t('price.total')}</span>
        <span className="font-bold text-orange text-xl">{fmt(total)}</span>
      </div>
    </div>
  )
}
