import { monthKey, parseISODate } from './dates'
import { formatFullDate } from './renewals'
import { computeFillMpg } from './vehicleStats'

/**
 * @typedef {'fuel' | 'service' | 'payment'} ActivityKind
 *
 * @typedef {object} ActivityItem
 * @property {string} key unique across kinds: `fuel-12`, `service-3`, `payment-1`
 * @property {ActivityKind} kind
 * @property {number} id the record's id
 * @property {string} date `YYYY-MM-DD`
 * @property {number} odometer the reading logged with it; 0 for payments
 * @property {string} title `Fill-up · 31.1 mpg`, `Brake pads, Brake rotors`, `Insurance payment`
 * @property {string} detail one mono line: gallons and price, shop and odometer, or provider and renewal
 * @property {number} amount what it cost
 * @property {boolean} partial a partial fill-up
 * @property {string | null} categoryId services: the category of the first service, for the icon
 * @property {'insurance' | 'registration' | null} type payments
 * @property {object} record the fill-up, service record or payment itself, for Edit and Delete
 *
 * @typedef {object} ActivityMonth
 * @property {string} month `YYYY-MM`, or `undated` for records without a valid date
 * @property {string} label `September 2026`, or `No date`
 * @property {ActivityItem[]} items newest first
 */

/** The timeline filters and the kind each one shows; `all` shows every kind. */
export const ACTIVITY_FILTERS = [
  { value: 'all', label: 'All', kind: null },
  { value: 'fuel', label: 'Fuel', kind: 'fuel' },
  { value: 'service', label: 'Service', kind: 'service' },
  { value: 'documents', label: 'Documents', kind: 'payment' },
]

const KIND_ORDER = { fuel: 0, service: 1, payment: 2 }

const number = (n) => n.toLocaleString('en-US')

/**
 * @param {string[]} services
 * @returns {string} `Brake pads, Brake rotors`, or `Brake pads, Brake rotors, +2 more`
 */
export function formatServicesList(services) {
  if (services.length <= 2) return services.join(', ')
  return `${services.slice(0, 2).join(', ')}, +${services.length - 2} more`
}

/**
 * Fill-ups, service records and insurance and registration payments as one feed, newest first. Records on the
 * same day go by the higher odometer first, then fill-ups, services, payments, then the later entry.
 * @param {object} records for ONE vehicle; leave out the kinds the vehicle doesn't track
 * @param {import('./vehicleStats').FillUp[]} [records.fills]
 * @param {import('./vehicleStats').ServiceRecord[]} [records.services]
 * @param {import('./renewals').PolicyPayment[]} [records.payments]
 * @returns {ActivityItem[]}
 */
export function getActivityItems({ fills = [], services = [], payments = [] }) {
  const withMpg = computeFillMpg([...fills].sort((a, b) => a.odometer - b.odometer))
  const fillById = new Map(fills.map((f) => [f.id, f]))
  const base = { partial: false, categoryId: null, type: null }

  const items = [
    ...withMpg.map((f) => ({
      ...base,
      key: `fuel-${f.id}`,
      kind: 'fuel',
      id: f.id,
      date: f.date,
      odometer: f.odometer,
      title: f.isFull ? (f.mpg != null ? `Fill-up · ${f.mpg} mpg` : 'Fill-up') : 'Partial fill-up',
      detail: [`${f.gallons} gal`, Number.isFinite(f.pricePerGal) && `$${f.pricePerGal.toFixed(2)}/gal`, f.odometer > 0 && `${number(f.odometer)} mi`]
        .filter(Boolean)
        .join(' · '),
      amount: f.total,
      partial: !f.isFull,
      record: fillById.get(f.id),
    })),
    ...services.map((r) => ({
      ...base,
      key: `service-${r.id}`,
      kind: 'service',
      id: r.id,
      date: r.date,
      odometer: r.odometer,
      title: formatServicesList(r.services ?? []) || 'Service',
      detail: [r.shopName || 'DIY', r.odometer > 0 && `${number(r.odometer)} mi`].filter(Boolean).join(' · '),
      amount: r.cost,
      categoryId: r.categoryId ?? null,
      record: r,
    })),
    ...payments.map((p) => ({
      ...base,
      key: `payment-${p.id}`,
      kind: 'payment',
      id: p.id,
      date: p.date,
      odometer: 0,
      title: p.type === 'registration' ? 'Registration payment' : 'Insurance payment',
      detail: [p.provider, p.renewalDate && `renews ${formatFullDate(p.renewalDate)}`].filter(Boolean).join(' · ') || '—',
      amount: p.cost,
      type: p.type,
      record: p,
    })),
  ]

  return items.sort(
    (a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '') ||
      (b.odometer || 0) - (a.odometer || 0) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      b.id - a.id,
  )
}

/**
 * The items one timeline filter shows.
 * @param {ActivityItem[]} items
 * @param {string} filter a value from {@link ACTIVITY_FILTERS}; an unknown one shows everything
 * @returns {ActivityItem[]}
 */
export function filterActivity(items, filter) {
  const kind = ACTIVITY_FILTERS.find((f) => f.value === filter)?.kind
  return kind ? items.filter((item) => item.kind === kind) : items
}

/**
 * Groups a newest-first feed by calendar month, keeping its order. Records without a valid date go in a last
 * `No date` group.
 * @param {ActivityItem[]} items from {@link getActivityItems}
 * @returns {ActivityMonth[]} newest month first
 */
export function groupActivityByMonth(items) {
  const groups = new Map()
  for (const item of items) {
    const month = monthKey(item.date) ?? 'undated'
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month).push(item)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'undated') - (b === 'undated') || b.localeCompare(a))
    .map(([month, monthItems]) => ({
      month,
      label:
        month === 'undated'
          ? 'No date'
          : parseISODate(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      items: monthItems,
    }))
}
