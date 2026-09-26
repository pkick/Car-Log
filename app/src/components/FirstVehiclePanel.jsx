import { CarIcon } from './icons'
import { Button, EmptyState } from './ui'

// Stand-in until P4-G builds the real first-run screen.
export default function FirstVehiclePanel({ onAddVehicle }) {
  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <EmptyState
        icon={CarIcon}
        title="Add your first vehicle"
        body="Fill-ups, maintenance, insurance and registration are all tracked per vehicle."
        action={<Button size="sm" onClick={onAddVehicle}>Add vehicle</Button>}
      />
    </main>
  )
}
