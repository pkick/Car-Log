import { useState } from 'react'
import { InsuranceIcon, RegistrationIcon } from './icons'
import { Button, Card } from './ui'
import { cx } from './ui/cx'
import { getAttentionItems, pickAttentionItem, snoozeItem } from '../lib/attention'
import { todayISO } from '../lib/dates'
import { CATEGORY_ICON } from '../lib/serviceCategories'

const RENEWAL_ICON = { insurance: InsuranceIcon, registration: RegistrationIcon }

// Snoozes live in this browser only, per vehicle. P4-D (reminders) may move them server-side, so a snooze
// follows the household to every device and quiets that item's notifications too.
const storageKey = (vehicleId) => `odometer:attention-snoozes:${vehicleId}`

function readSnoozes(vehicleId) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(vehicleId)) ?? '{}')
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  } catch {
    return {}
  }
}

function writeSnoozes(vehicleId, snoozes) {
  try {
    localStorage.setItem(storageKey(vehicleId), JSON.stringify(snoozes))
  } catch {
    // Storage is unavailable: the snooze lasts until the page reloads.
  }
}

/**
 * The single most urgent thing about a vehicle: an overdue or coming-up service interval or renewal (see
 * `getAttentionItems`), with its action and "Snooze 2 wks". Renders nothing when nothing is due or everything
 * due is snoozed. Key it by vehicle, so switching vehicles reads that vehicle's snoozes.
 *
 * @param {object} props
 * @param {number} props.vehicleId
 * @param {import('../lib/vehicleStats').DueItem[]} props.dueItems empty when the vehicle doesn't track service
 * @param {import('../lib/renewals').RenewalItem[]} props.renewals
 * @param {number | null} props.milesPerDay the vehicle's driving pace, to rank mileage limits against dates
 * @param {(categoryId: string) => void} props.onLogService opens Log service on that category
 * @param {(type: 'insurance' | 'registration') => void} props.onLogPayment opens Log payment for that type
 */
export default function AttentionBanner({ vehicleId, dueItems, renewals, milesPerDay, onLogService, onLogPayment }) {
  const [snoozes, setSnoozes] = useState(() => readSnoozes(vehicleId))
  const today = todayISO()
  const item = pickAttentionItem(getAttentionItems({ dueItems, renewals, milesPerDay }, today), snoozes, today)
  if (!item) return null

  const overdue = item.status === 'overdue'
  const Icon = item.kind === 'service' ? (CATEGORY_ICON[item.categoryId] ?? CATEGORY_ICON.other) : RENEWAL_ICON[item.type]

  const snooze = () => {
    const next = snoozeItem(snoozes, item.key, today)
    setSnoozes(next)
    writeSnoozes(vehicleId, next)
  }

  return (
    <Card as="section" aria-label="Needs attention" tone={overdue ? 'red' : 'light'} padding="sm" className="flex items-center gap-4 mb-5.5">
      <span
        className={cx(
          'w-10 h-10 rounded-control flex items-center justify-center flex-none text-white',
          overdue ? 'bg-red' : 'bg-amber'
        )}
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
        <p className="text-base font-semibold">{item.title}</p>
        <p className="text-xs font-mono text-ink/60 mt-0.5">{item.detail}</p>
      </div>
      <div className="flex items-center gap-4 flex-none">
        {item.kind === 'service' ? (
          <Button size="sm" onClick={() => onLogService(item.categoryId)}>
            Log service
          </Button>
        ) : (
          <Button size="sm" onClick={() => onLogPayment(item.type)}>
            Log payment
          </Button>
        )}
        <Button variant="link-muted" size="sm" onClick={snooze}>
          Snooze 2 wks
        </Button>
      </div>
    </Card>
  )
}
