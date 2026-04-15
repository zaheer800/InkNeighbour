/**
 * Status badge component for job and shop statuses.
 */
const variants = {
  green:  'bg-green/15 text-green',
  amber:  'bg-amber/15 text-amber',
  red:    'bg-red/15 text-red',
  violet: 'bg-violet/15 text-violet',
  sky:    'bg-sky/15 text-sky',
  muted:  'bg-border text-muted'
}

const STATUS_MAP = {
  submitted:        { label: 'Submitted',  variant: 'amber' },
  accepted:         { label: 'Accepted',   variant: 'sky' },
  printing:         { label: 'Printing',   variant: 'violet' },
  delivered:        { label: 'Delivered',  variant: 'green' },
  cancelled:        { label: 'Cancelled',  variant: 'red' },
  feedback_pending: { label: 'Pending Feedback', variant: 'amber' },
  feedback_done:    { label: 'Reviewed',   variant: 'green' },
  active:           { label: 'Open',       variant: 'green' },
  paused:           { label: 'Paused',     variant: 'amber' },
  inactive:         { label: 'Inactive',   variant: 'muted' },
  paid:             { label: 'Paid',       variant: 'green' },
  pending:          { label: 'Unpaid',     variant: 'amber' }
}

export default function Badge({ status, label: labelProp, variant: variantProp, className = '' }) {
  const mapped = STATUS_MAP[status]
  const label = labelProp ?? mapped?.label ?? status
  const variant = variantProp ?? mapped?.variant ?? 'muted'

  return (
    <span className={[
      'inline-flex items-center px-3 py-1 rounded-pill text-sm font-semibold',
      variants[variant] ?? variants.muted,
      className
    ].join(' ')}>
      {label}
    </span>
  )
}
