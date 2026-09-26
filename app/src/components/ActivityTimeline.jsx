import { useId, useRef, useState } from 'react'
import { FuelIcon, InsuranceIcon, MoreIcon, PencilIcon, RegistrationIcon, TrashIcon } from './icons'
import { Badge, Button, Card, IconButton, Menu, MenuItem, Segmented } from './ui'
import { cx } from './ui/cx'
import { ACTIVITY_FILTERS, filterActivity, groupActivityByMonth } from '../lib/activity'
import { formatDateTick } from '../lib/chartScale'
import { CATEGORY_BY_ID, CATEGORY_ICON, CATEGORY_TEXT_CLASS, CATEGORY_TILE_CLASS } from '../lib/serviceCategories'

/** Rows shown at first, and added by each "Show more". */
const PAGE_SIZE = 20

const NOUN = { fuel: 'fill-up', service: 'service', payment: 'payment' }

const money = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—')

function ItemIcon({ item }) {
  let Icon = FuelIcon
  let tile = 'bg-accent/10 text-accent'
  if (item.kind === 'payment') {
    const registration = item.type === 'registration'
    Icon = registration ? RegistrationIcon : InsuranceIcon
    tile = registration ? 'bg-teal/12 text-teal' : 'bg-accent/12 text-accent'
  } else if (item.kind === 'service') {
    const { color } = CATEGORY_BY_ID[item.categoryId] ?? CATEGORY_BY_ID.other
    Icon = CATEGORY_ICON[item.categoryId] ?? CATEGORY_ICON.other
    tile = cx(CATEGORY_TILE_CLASS[color], CATEGORY_TEXT_CLASS[color])
  }
  return (
    <span className={cx('w-8 h-8 rounded-control flex items-center justify-center flex-none', tile)}>
      <Icon size={16} />
    </span>
  )
}

/**
 * One timeline row. Edit and More show on hover and whenever focus is inside the row, so Tab reaches them; on a
 * touch screen, which can't hover, they always show.
 */
function ActivityRow({ item, onEdit, onDelete }) {
  const name = `${NOUN[item.kind]} ${formatDateTick(item.date) || item.date}`
  return (
    <li className="group grid grid-cols-[52px_32px_minmax(0,1fr)_auto_88px] items-center gap-3.5 px-3 py-2.5 rounded-control transition-colors hover:bg-ink/3 focus-within:bg-ink/3">
      <span className="text-xs font-mono text-ink/50 whitespace-nowrap">{formatDateTick(item.date) || '—'}</span>
      <ItemIcon item={item} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold truncate">{item.title}</p>
          {item.partial && <Badge tone="amber">Partial</Badge>}
        </div>
        <p className="text-xs font-mono text-ink/50 truncate">{item.detail}</p>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <Button variant="ghost" size="sm" aria-label={`Edit ${name}`} onClick={() => onEdit(item)}>
          <PencilIcon size={14} className="flex-none" />
          Edit
        </Button>
        <Menu
          align="end"
          trigger={(props) => (
            <IconButton size="sm" aria-label={`More actions for ${name}`} {...props}>
              <MoreIcon size={16} />
            </IconButton>
          )}
        >
          <MenuItem icon={TrashIcon} tone="danger" onSelect={() => onDelete(item)}>
            Delete
          </MenuItem>
        </Menu>
      </div>
      <span className="text-sm font-semibold tabular-nums text-right whitespace-nowrap">{money(item.amount)}</span>
    </li>
  )
}

/**
 * The Dashboard's activity feed: fill-ups, services and payments grouped by month, newest first, with an All /
 * Fuel / Service / Documents filter (leaving out what the vehicle doesn't track) and Edit and Delete on each row.
 * Key it by vehicle, so switching vehicles starts from All.
 *
 * @param {object} props
 * @param {import('../lib/activity').ActivityItem[]} props.items from `getActivityItems`, newest first
 * @param {boolean} props.tracksFuel
 * @param {boolean} props.tracksService
 * @param {(item: import('../lib/activity').ActivityItem) => void} props.onEdit opens the matching modal
 * @param {(item: import('../lib/activity').ActivityItem) => void} props.onDelete deletes it with Undo
 */
export default function ActivityTimeline({ items, tracksFuel, tracksService, onEdit, onDelete }) {
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const headingRef = useRef(null)
  const headingId = useId()

  const filters = ACTIVITY_FILTERS.filter((f) => (f.kind === 'fuel' ? tracksFuel : f.kind === 'service' ? tracksService : true))
  const filter = filters.find((f) => f.value === selectedFilter) ?? filters[0]
  const shown = filterActivity(items, filter.value)
  const months = groupActivityByMonth(shown.slice(0, limit))

  const changeFilter = (value) => {
    setSelectedFilter(value)
    setLimit(PAGE_SIZE)
  }

  const handleDelete = (item) => {
    onDelete(item)
    // The row and its menu are about to go; keep focus in the timeline rather than dropping it on the page.
    headingRef.current?.focus()
  }

  return (
    <Card as="section" aria-labelledby={headingId} padding="none">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ink/8">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-2xl font-bold focus:outline-none">
          Activity
        </h2>
        {filters.length > 1 && (
          <Segmented aria-label="Activity filter" options={filters} value={filter.value} onChange={changeFilter} />
        )}
      </div>

      {months.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink/45">
          {filter.kind ? `No ${filter.label.toLowerCase()} activity logged yet.` : 'No activity logged yet.'}
        </p>
      ) : (
        <div className="px-3 pb-3">
          {months.map((month) => (
            <div key={month.month}>
              <h3 className="px-3 pt-4 pb-2 text-xs font-mono font-semibold tracking-widest uppercase text-ink/45">{month.label}</h3>
              <ul className="flex flex-col">
                {month.items.map((item) => (
                  <ActivityRow key={item.key} item={item} onEdit={onEdit} onDelete={handleDelete} />
                ))}
              </ul>
            </div>
          ))}
          {shown.length > limit && (
            <div className="px-3 pt-3">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setLimit(limit + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
