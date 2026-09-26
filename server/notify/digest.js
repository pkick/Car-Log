import { monthKey, parseISODate } from '../../shared/dates.js'
import { getReminderItems } from './plan.js'

const SPEND_PARTS = [
  ['fuel', 'fills', 'total'],
  ['service', 'services', 'cost'],
  ['insurance', 'policies', 'cost', 'insurance'],
  ['registration', 'policies', 'cost', 'registration'],
]

const dollars = (amount) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Spend from the 1st of `today`'s month through `today`, across every vehicle.
 * @param {{ fills?: Array<{ date: string, total: number }>, services?: Array<{ date: string, cost: number }>,
 *   policies?: Array<{ date: string, cost: number, type: string }> }} records
 * @param {string} today `YYYY-MM-DD`
 * @returns {{ total: number, fuel: number, service: number, insurance: number, registration: number }} rounded to the cent
 */
export function monthToDateSpend(records, today) {
  const month = monthKey(today)
  const spend = { total: 0 }
  for (const [part, list, field, type] of SPEND_PARTS) {
    const amount = (records[list] ?? [])
      .filter((r) => monthKey(r.date) === month && r.date <= today && (!type || r.type === type) && Number.isFinite(r[field]))
      .reduce((sum, r) => sum + r[field], 0)
    spend[part] = Math.round(amount * 100) / 100
    spend.total += amount
  }
  spend.total = Math.round(spend.total * 100) / 100
  return spend
}

/**
 * The weekly digest: what is overdue and coming up on every vehicle, then this month's spend so far.
 * @param {import('./plan.js').ReminderData} data
 * @returns {{ title: string, message: string }}
 */
export function buildDigest(data) {
  const items = getReminderItems(data)
  const sections = [
    ['Overdue', items.filter((item) => item.state === 'overdue')],
    ['Coming up', items.filter((item) => item.state === 'coming-up')],
  ]
    .filter(([, list]) => list.length)
    .map(([heading, list]) => [heading, ...list.map((item) => `- ${item.message}`)].join('\n'))

  const monthName = parseISODate(data.today).toLocaleDateString('en-US', { month: 'long' })
  const spend = monthToDateSpend(data, data.today)
  const parts = SPEND_PARTS.map(([part]) => part).filter((part) => spend[part] > 0)
  const spendLine = spend.total > 0
    ? `Spent in ${monthName} so far: ${dollars(spend.total)} (${parts.map((part) => `${part} ${dollars(spend[part])}`).join(', ')}).`
    : `Nothing spent yet in ${monthName}.`

  return {
    title: 'Odometer weekly digest',
    message: [...(sections.length ? sections : ['Nothing is overdue or coming up.']), spendLine].join('\n\n'),
  }
}
