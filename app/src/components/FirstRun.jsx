import { lazy, Suspense, useRef } from 'react'
import { CarIcon } from './icons'
import { Button } from './ui'
import OnboardingSteps from './OnboardingSteps'
import { getOnboardingSteps } from '../lib/onboarding'
import { useDemoData } from '../hooks/useDemoData'
import { useCsvFile } from '../hooks/useCsvFile'

const ImportFillUpsModal = lazy(() => import('./ImportFillUpsModal'))

const STEPS = getOnboardingSteps(null)

/**
 * What `/` shows while there are no vehicles (the handoff's first-run screen). App hides the page header here.
 * Import CSV picks a file and opens the import with a Create vehicle step, since the fill-ups need a vehicle; once
 * it's created the app moves to it and the import finishes there.
 *
 * @param {object} props
 * @param {() => void} props.onAddVehicle Opens Add vehicle.
 */
export default function FirstRun({ onAddVehicle }) {
  const demo = useDemoData('POST')
  const csvInput = useRef(null)
  const csv = useCsvFile()

  return (
    <main className="min-h-full px-10 py-12 flex flex-col items-center justify-center gap-[26px] text-center">
      <CarIcon size={72} className="text-slate" />
      <div className="flex flex-col gap-3 max-w-[430px]">
        <h1 className="text-6xl font-semibold tracking-tight">Add your first vehicle</h1>
        <p className="text-xs font-mono leading-relaxed text-ink/55">
          Everything is stored on your own server. Log two fill-ups and mileage trends start appearing.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3.5">
        <div className="flex items-center gap-2.5">
          <Button onClick={onAddVehicle}>Add vehicle</Button>
          <Button variant="secondary" loading={csv.reading} onClick={() => csvInput.current.click()}>Import CSV</Button>
          <input
            ref={csvInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files[0]
              event.target.value = ''
              csv.read(file)
            }}
          />
        </div>
        {csv.error && <p role="alert" className="text-xs text-red max-w-[430px]">{csv.error}</p>}
        <p className="text-xs text-ink/50">
          Just looking?{' '}
          <Button variant="link" size="sm" onClick={demo.run} loading={demo.busy}>Explore with demo data</Button>
        </p>
        {demo.error && <p role="alert" className="text-xs text-red">{demo.error}</p>}
      </div>
      <OnboardingSteps steps={STEPS} align="center" className="pt-2" />
      {csv.source && (
        <Suspense fallback={null}>
          <ImportFillUpsModal source={csv.source} onClose={csv.clear} />
        </Suspense>
      )}
    </main>
  )
}
