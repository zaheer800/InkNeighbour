import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../lib/countries'

/**
 * Renders a UPI payment QR code using the browser's Canvas API.
 * Falls back to showing the UPI ID text if QR generation fails.
 *
 * NOTE: Phase 1 uses a simple UPI deep link displayed as text + copy button.
 * Full QR code generation requires a library like qrcode.js — add in Phase 2
 * if needed. For now, we show the UPI ID prominently with copy functionality.
 */
export default function UPIQRCode({ upiId, amount, shopName, countryCode = 'IN' }) {
  const { t } = useTranslation()
  const formattedAmount = formatCurrency(amount, countryCode)

  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${(amount / 100).toFixed(2)}&cu=INR`

  function copyUPI() {
    navigator.clipboard.writeText(upiId).then(() => {
      alert(t('payment.upi_copied'))
    })
  }

  return (
    <div className="bg-bg rounded-xl p-5 space-y-4 text-center">
      {/* UPI App button */}
      <a
        href={upiLink}
        className="inline-flex items-center justify-center gap-2 w-full min-h-[52px] bg-gradient-to-r from-violet to-purple-600 text-white font-bold rounded-[14px] text-base shadow-violet"
      >
        {t('payment.pay_via_upi_app', { amount: formattedAmount })}
      </a>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-sm text-muted">{t('common.or')}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Manual UPI ID */}
      <div className="space-y-2">
        <p className="text-sm text-muted">{t('payment.upi_id_label')}</p>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-3">
          <span className="flex-1 font-mono text-lg font-bold text-ink">{upiId}</span>
          <button
            onClick={copyUPI}
            className="text-violet font-semibold text-sm min-h-[44px] px-3 rounded-xl hover:bg-violet/10 transition-colors"
          >
            {t('common.copy')}
          </button>
        </div>
        <p className="text-sm text-muted">{t('payment.upi_amount_hint', { amount: formattedAmount })}</p>
      </div>
    </div>
  )
}
