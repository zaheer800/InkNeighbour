import { useTranslation } from 'react-i18next'
import { Clock, CheckCircle2 } from 'lucide-react'
import Button from './ui/Button'
import Modal from './ui/Modal'

/**
 * Pre-commitment prompt shown when an owner toggles their shop to LIVE.
 * Reminds them of the 15-minute SLA before they confirm going online.
 *
 * Props:
 *   open      — boolean
 *   onConfirm — called when owner confirms going live
 *   onCancel  — called when owner backs out
 *   loading   — disable confirm button while toggling
 */
export default function PreCommitmentPrompt({ open, onConfirm, onCancel, loading }) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onCancel} title={t('commitment.title')}>
      <div className="space-y-5">
        {/* SLA commitment message */}
        <div className="flex items-start gap-3 bg-violet/5 border border-violet/20 rounded-xl p-4">
          <Clock size={22} className="text-violet flex-shrink-0 mt-0.5" />
          <p className="text-base text-ink leading-relaxed">
            {t('commitment.message')}
          </p>
        </div>

        {/* Commitment points */}
        <ul className="space-y-2">
          {[
            t('commitment.point1'),
            t('commitment.point2'),
            t('commitment.point3')
          ].map((point, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink">
              <CheckCircle2 size={16} className="text-green flex-shrink-0 mt-0.5" />
              {point}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="flex gap-3 pt-1">
          <Button
            variant="ghost"
            size="md"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            {t('commitment.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
