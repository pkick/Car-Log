import { useId } from 'react'
import { ProgressTrack } from './charts'
import { Badge, Button, Card } from './ui'
import { cx } from './ui/cx'
import { CATEGORY_BY_ID, CATEGORY_ICON } from '../lib/serviceCategories'

// The category hues with more alpha than CATEGORY_TILE_CLASS, so the tint reads on the slate card.
const DUE_TILE_CLASS = {
  amber: 'bg-amber/24',
  red: 'bg-red/24',
  teal: 'bg-teal/24',
  accent: 'bg-accent/24',
  slate: 'bg-white/10',
}

// Status colors as in StatusChip and ProgressTrack, with the green that reads on slate.
const REMAINING_CLASS = {
  overdue: 'text-red',
  'coming-up': 'text-amber',
  ok: 'text-green-on-dark',
}

/**
 * The Dashboard's "Up next" card: the three most urgent service intervals, each with how far through it the car
 * is, and a link to the full schedule.
 *
 * @param {object} props
 * @param {import('../lib/vehicleStats').DueItem[]} props.items most urgent first; the first three are shown
 * @param {number} props.dueCount intervals overdue or coming up
 * @param {number} props.overdueCount
 * @param {() => void} props.onViewSchedule opens the Maintenance page
 */
export default function UpNextCard({ items, dueCount, overdueCount, onViewSchedule }) {
  const titleId = useId()
  return (
    <Card as="section" aria-labelledby={titleId} tone="dark" padding="lg" className="min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 id={titleId} className="text-2xl font-bold">
          Up next
        </h2>
        {overdueCount > 0 ? (
          <Badge variant="solid" tone="red">
            {overdueCount} overdue
          </Badge>
        ) : (
          dueCount > 0 && (
            <Badge variant="solid" tone="amber">
              {dueCount} due
            </Badge>
          )
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-page/60">No service intervals yet. Add them in Edit vehicle.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {items.slice(0, 3).map((item) => {
            const { color } = CATEGORY_BY_ID[item.categoryId] ?? CATEGORY_BY_ID.other
            const Icon = CATEGORY_ICON[item.categoryId] ?? CATEGORY_ICON.other
            return (
              <li key={item.intervalId} className="flex items-start gap-3.5">
                <span className={cx('w-9 h-9 rounded-control flex items-center justify-center flex-none', DUE_TILE_CLASS[color])}>
                  <Icon size={18} className="text-page" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold truncate">{item.name}</h3>
                    <span className={cx('text-xs font-mono font-semibold whitespace-nowrap', REMAINING_CLASS[item.status])}>
                      {item.remainingLabel}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-page/60 mt-0.5 mb-2">{item.detailLabel}</p>
                  <ProgressTrack
                    tone="dark"
                    ariaLabel={item.name}
                    progress={item.progress}
                    status={item.status}
                    lastLabel={item.lastLabel}
                    dueLabel={item.dueLabel ?? undefined}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-auto pt-5">
        <Button variant="link" tone="dark" size="sm" onClick={onViewSchedule}>
          View schedule →
        </Button>
      </div>
    </Card>
  )
}
