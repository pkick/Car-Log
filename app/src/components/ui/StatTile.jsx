import { cx } from './cx'

const DELTA_TONES = {
  good: 'text-green',
  bad: 'text-red',
  neutral: 'text-ink/45',
}

/**
 * One number on the dashboard stat rail.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label e.g. "Avg MPG"; shown uppercase.
 * @param {import('react').ReactNode} props.value The formatted number, or "—".
 * @param {import('react').ReactNode} [props.unit] e.g. "mpg", "per mi".
 * @param {import('react').ReactNode} [props.delta] e.g. "+4%"; top right.
 * @param {'good' | 'bad' | 'neutral'} [props.deltaTone='neutral'] Whether the change is good news,
 *   not whether it went up: higher fuel spend is bad.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} [props.children] Under the value; the slot for a sparkline.
 */
export function StatTile({ label, value, unit, delta, deltaTone = 'neutral', className, children }) {
  return (
    <div className={cx('bg-surface border border-ink/10 rounded-card p-4.5 flex flex-col gap-3 hover:shadow-sm transition-shadow', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 whitespace-nowrap">{label}</span>
        {delta != null && delta !== '' && (
          <span className={cx('text-xs font-mono font-semibold whitespace-nowrap', DELTA_TONES[deltaTone])}>{delta}</span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tighter">{value}</span>
        {unit && <span className="text-xs font-mono whitespace-nowrap">{unit}</span>}
      </div>
      {children}
    </div>
  )
}
