import { cx } from './cx'

const TONES = {
  neutral: 'bg-ink/6 text-ink/45',
  accent: 'bg-accent/20 text-accent',
  teal: 'bg-teal/20 text-teal',
  amber: 'bg-amber/20 text-amber',
  green: 'bg-green/20 text-green',
  red: 'bg-red/20 text-red',
}

/**
 * Small uppercase mono label on a tint, e.g. PARTIAL on a fill-up row.
 *
 * @param {object} props
 * @param {'neutral' | 'accent' | 'teal' | 'amber' | 'green' | 'red'} [props.tone='neutral']
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children
 */
export function Badge({ tone = 'neutral', className, children, ...props }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-semibold uppercase whitespace-nowrap', TONES[tone], className)}
      {...props}
    >
      {children}
    </span>
  )
}

const STATUS = {
  ok: { tone: 'green', label: 'OK' },
  'coming-up': { tone: 'amber', label: 'Coming up' },
  overdue: { tone: 'red', label: 'Overdue' },
}

/**
 * Badge for a service interval's status (the `status` from getDueSoonItems).
 *
 * @param {object} props
 * @param {'ok' | 'coming-up' | 'overdue'} props.status ok is green, coming-up amber, overdue red.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} [props.children] Replaces the default label.
 */
export function StatusChip({ status, className, children }) {
  const { tone, label } = STATUS[status] ?? STATUS.ok
  return (
    <Badge tone={tone} className={className}>
      {children ?? label}
    </Badge>
  )
}
