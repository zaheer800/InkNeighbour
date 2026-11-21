import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { X, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from './ui/Button'

/**
 * Full-screen printable QR code for a shop's public link, so an owner can
 * print it and put it up for walk-in customers to scan. Rendered via a
 * portal to document.body (a sibling of #root) and paired with a scoped
 * print rule that hides #root only while this is open — never affects
 * printing any other page.
 */
export default function ShopQRCode({ shopUrl, shopName, onClose }) {
  const { t } = useTranslation()

  useEffect(() => {
    document.body.classList.add('print-qr-only')
    return () => document.body.classList.remove('print-qr-only')
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-bg flex items-center justify-center p-6">
      <div className="relative bg-surface rounded-2xl shadow-xl max-w-sm w-full p-8 text-center space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-ink hover:bg-bg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center print:hidden"
          aria-label={t('common.close')}
        >
          <X size={20} />
        </button>

        <h2 className="font-display text-2xl font-bold text-ink">{shopName}</h2>

        <div className="flex justify-center p-4 bg-white rounded-xl">
          <QRCodeSVG value={shopUrl} size={240} />
        </div>

        <p className="text-base text-ink font-semibold">{t('earnings.qr_scan_hint')}</p>
        <p className="font-mono text-sm text-muted break-all">{shopUrl}</p>

        <div className="flex gap-2 print:hidden">
          <Button onClick={() => window.print()} className="flex-1">
            <Printer size={16} /> {t('earnings.qr_print')}
          </Button>
          <Button variant="muted" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
