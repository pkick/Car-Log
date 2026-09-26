import { cx } from '../ui/cx'

// Status colors match StatusChip: ok green, coming-up amber, overdue red.
const TONES = {
  light: {
    track: 'bg-ink/8',
    empty: 'border-ink/20',
    last: 'bg-ink/30',
    due: 'bg-ink/60',
    now: 'bg-ink ring-surface',
    label: 'text-ink/50',
    nowLabel: 'text-ink',
    fill: { ok: 'bg-green', 'coming-up': 'bg-amber', overdue: 'bg-red' },
  },
  dark: {
    track: 'bg-white/10',
    empty: 'border-white/20',
    last: 'bg-page/35',
    due: 'bg-page/70',
    now: 'bg-page ring-slate',
    label: 'text-page/60',
    nowLabel: 'text-page',
    fill: { ok: 'bg-green-on-dark', 'coming-up': 'bg-amber', overdue: 'bg-red' },
  },
}

const STATUS_TEXT = { ok: 'on track', 'coming-up': 'coming up', overdue: 'overdue' }

const OVERFLOW_STRIPES = 'repeating-linear-gradient(135deg, rgb(var(--red)) 0 3px, transparent 3px 6px)'

/**
 * How far through a service interval the car is: a track from the last service (left end) to the
 * due point (a tick at `dueAt` of the width), filled in the status color, with a "now" marker.
 * Past due, the fill stops at the tick and red stripes carry on toward the right end.
 *
 * `progress` null (no service on record yet) draws an empty dashed track.
 *
 * @param {object} props
 * @param {number | null} props.progress 0 at the last service, 1 at due; above 1 is overdue.
 * @param {'ok' | 'coming-up' | 'overdue'} [props.status='ok'] Fill color, as in StatusChip.
 * @param {string} props.ariaLabel Names the bar, e.g. "Oil + filter".
 * @param {string} [props.valueText] Spoken value, e.g. "92% of interval, due in 380 mi". Defaults
 *   to the percent, the status and `dueLabel`.
 * @param {import('react').ReactNode} [props.lastLabel] Above the left end, e.g. "Apr 22 · 79,630".
 * @param {import('react').ReactNode} [props.dueLabel] Above the due tick, ending at it, e.g.
 *   "due 84,630".
 * @param {import('react').ReactNode} [props.nowLabel] Under the now marker, e.g. "now".
 * @param {number} [props.dueAt=0.8] Where the due tick sits, as a share of the width. The rest is
 *   room for overdue overflow, which is cut off at `1 / dueAt` (125% by default). Use 1 when
 *   nothing on screen can be overdue.
 * @param {'light' | 'dark'} [props.tone='light'] dark on slate cards.
 * @param {string} [props.className] Layout only.
 */
export function ProgressTrack({
  progress,
  status = 'ok',
  ariaLabel,
  valueText,
  lastLabel,
  dueLabel,
  nowLabel,
  dueAt = 0.8,
  tone = 'light',
  className,
}) {
  const colors = TONES[tone] ?? TONES.light
  const known = Number.isFinite(progress)
  const value = known ? Math.max(0, progress) : 0
  const percent = Math.round(value * 100)
  const shown = Math.min(value, 1 / dueAt)
  const at = (p) => `${p * dueAt * 100}%`
  const nowShare = shown * dueAt
  const labelText = typeof dueLabel === 'string' ? dueLabel : null
  const spoken =
    valueText ??
    (known ? [`${percent}% of interval`, STATUS_TEXT[status], labelText].filter(Boolean).join(', ') : 'No record yet')

  const nowLabelStyle =
    nowShare < 0.08
      ? { left: 0 }
      : nowShare > 0.92
        ? { right: 0 }
        : { left: `${nowShare * 100}%`, transform: 'translateX(-50%)' }

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={known ? Math.max(100, percent) : undefined}
      aria-valuenow={known ? percent : undefined}
      aria-valuetext={spoken}
      className={cx('w-full min-w-0', className)}
    >
      {(lastLabel || dueLabel) && (
        <div className={cx('relative h-4 text-xs font-mono', colors.label)}>
          {lastLabel && <span className="absolute left-0 top-0 whitespace-nowrap">{lastLabel}</span>}
          {dueLabel && known && (
            <span className="absolute top-0 whitespace-nowrap" style={{ right: `${(1 - dueAt) * 100}%` }}>
              {dueLabel}
            </span>
          )}
        </div>
      )}

      <div className="relative h-4">
        {known ? (
          <>
            <div className={cx('absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full overflow-hidden', colors.track)}>
              <div
                className={cx('absolute inset-y-0 left-0', value > 1 ? 'rounded-l-full' : 'rounded-full', colors.fill[status])}
                style={{ width: at(Math.min(value, 1)) }}
              />
              {value > 1 && (
                <div
                  className="absolute inset-y-0 rounded-r-full"
                  style={{ left: at(1), width: at(shown - 1), backgroundImage: OVERFLOW_STRIPES }}
                />
              )}
            </div>
            <span className={cx('absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full', colors.last)} />
            <span
              className={cx('absolute top-1/2 -translate-y-1/2 -ml-px w-0.5 h-3.5 rounded-full', colors.due)}
              style={{ left: at(1) }}
            />
            <span
              className={cx('absolute top-1/2 -translate-y-1/2 -ml-px w-0.5 h-4 rounded-full ring-2', colors.now)}
              style={{ left: at(shown) }}
            />
          </>
        ) : (
          <div className={cx('absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full border border-dashed', colors.empty)} />
        )}
      </div>

      {nowLabel && known && (
        <div className={cx('relative h-4 text-xs font-mono', colors.nowLabel)}>
          <span className="absolute top-0 whitespace-nowrap" style={nowLabelStyle}>
            {nowLabel}
          </span>
        </div>
      )}
    </div>
  )
}
