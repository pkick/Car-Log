import { cx } from './cx'

const TAG_TONES = {
  neutral: 'bg-ink/6 text-ink/45',
  accent: 'bg-accent/20 text-accent',
  teal: 'bg-teal/20 text-teal',
  amber: 'bg-amber/20 text-amber',
  green: 'bg-green/20 text-green',
  red: 'bg-red/20 text-red',
}

const SOLID_TONES = {
  neutral: 'bg-slate text-white',
  accent: 'bg-accent text-white',
  teal: 'bg-teal text-white',
  amber: 'bg-amber text-white',
  green: 'bg-green text-white',
  red: 'bg-red text-white',
}

const PILL_TONES = {
  neutral: 'bg-ink/6 text-ink/60',
  accent: 'bg-accent/10 text-accent',
  teal: 'bg-teal/10 text-teal',
  amber: 'bg-amber/10 text-amber',
  green: 'bg-green/10 text-green',
  red: 'bg-red/10 text-red',
}

const VARIANTS = {
  tag: { shape: 'px-2 py-1 rounded uppercase', tones: TAG_TONES },
  solid: { shape: 'px-2 py-1 rounded uppercase', tones: SOLID_TONES },
  pill: { shape: 'px-2.5 py-1.5 rounded-full', tones: PILL_TONES },
}

/**
 * Small mono label, e.g. PARTIAL on a fill-up row.
 *
 * @param {object} props
 * @param {'neutral' | 'accent' | 'teal' | 'amber' | 'green' | 'red'} [props.tone='neutral']
 * @param {'tag' | 'solid' | 'pill'} [props.variant='tag'] tag is an uppercase label on a tint;
 *   solid fills it with the tone, for a count that has to stand out ("3 DUE", a category's count);
 *   pill is a rounded sentence-case note on a lighter tint, e.g. "+2.1% vs prior fills".
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children
 */
export function Badge({ tone = 'neutral', variant = 'tag', className, children, ...props }) {
  const { shape, tones } = VARIANTS[variant]
  return (
    <span
      className={cx('inline-flex items-center gap-1 text-xs font-mono font-semibold whitespace-nowrap', shape, tones[tone], className)}
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
