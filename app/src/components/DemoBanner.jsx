import { useContext } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { Button, Card } from './ui'
import { useDemoData } from '../hooks/useDemoData'

/**
 * A slim notice above the page while any demo vehicle exists. "Clear demo data" deletes the demo vehicles and
 * everything logged on them, then reloads at `/`; vehicles added alongside the demo data stay.
 */
export default function DemoBanner() {
  const { vehicles } = useContext(VehicleContext)
  const clear = useDemoData('DELETE')
  if (!vehicles.some((v) => v.isDemo)) return null

  return (
    <div className="px-10 pt-4 max-w-[1180px] w-full">
      <Card tone="accent" padding="none">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <p className="text-sm min-w-0">
            <span className="font-semibold">You're looking at demo data.</span>{' '}
            <span className="text-ink/60">Clearing it removes the demo vehicles and anything logged on them.</span>
          </p>
          <div className="flex items-center gap-3 flex-none">
            {clear.error && <span role="alert" className="text-xs text-red">{clear.error}</span>}
            <Button variant="ghost" size="sm" onClick={clear.run} loading={clear.busy}>Clear demo data</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
