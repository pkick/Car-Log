import { useId, useState } from 'react'
import { CloseIcon } from './icons'
import { Button, Card, IconButton } from './ui'
import OnboardingSteps from './OnboardingSteps'
import { getOnboardingSteps, needsDefaultIntervals } from '../lib/onboarding'
import { useDefaultIntervals } from '../hooks/useDefaultIntervals'

const dismissedKey = (vehicleId) => `odometer:setup-dismissed:${vehicleId}`

function readDismissed(vehicleId) {
  try {
    return localStorage.getItem(dismissedKey(vehicleId)) === '1'
  } catch {
    return false
  }
}

function SetupSteps({ vehicle, fillUps, serviceRecords, onEditVehicle, onLogFillup }) {
  const titleId = useId()
  const [dismissed, setDismissed] = useState(() => readDismissed(vehicle.id))
  const waitForDefaults = needsDefaultIntervals(vehicle, serviceRecords)
  const defaults = useDefaultIntervals(waitForDefaults && !dismissed)

  // Until the defaults arrive, "Set intervals" could still turn out done; showing the card early would flash it.
  if (dismissed || (waitForDefaults && defaults.status === 'loading')) return null
  const steps = getOnboardingSteps(vehicle, { fillUps, serviceRecords, defaultIntervals: defaults.intervals })
  const doneCount = steps.filter((step) => step.done).length
  if (doneCount === steps.length) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(dismissedKey(vehicle.id), '1')
    } catch {
      // Storage is unavailable: the card stays hidden until the page reloads.
    }
  }

  return (
    <Card as="section" aria-labelledby={titleId} className="mb-5.5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 id={titleId} className="text-2xl font-bold">Set up {vehicle.nickname}</h2>
          <p className="text-xs font-mono text-ink/45 mt-1.5">{doneCount} of {steps.length} done</p>
        </div>
        <IconButton size="sm" aria-label="Hide setup steps" onClick={dismiss}>
          <CloseIcon size={16} />
        </IconButton>
      </div>
      <OnboardingSteps
        steps={steps}
        actions={{
          intervals: <Button variant="link" size="sm" onClick={onEditVehicle}>Edit intervals</Button>,
          fillUp: <Button variant="link" size="sm" onClick={onLogFillup}>Log fill-up</Button>,
        }}
      />
    </Card>
  )
}

/**
 * The setup steps on a vehicle's Dashboard, until all of them are done for that vehicle or someone hides them
 * (remembered per vehicle in this browser). See `getOnboardingSteps` for when each step counts as done.
 *
 * @param {object} props
 * @param {object} props.vehicle
 * @param {object[]} props.fillUps The vehicle's fill-ups.
 * @param {object[]} props.serviceRecords The vehicle's service records.
 * @param {() => void} props.onEditVehicle Opens Edit vehicle, where the intervals are.
 * @param {() => void} props.onLogFillup Opens Log fill-up.
 */
export default function SetupCard(props) {
  // Keyed by vehicle, so switching vehicles reads that vehicle's hidden state afresh.
  return <SetupSteps key={props.vehicle.id} {...props} />
}
