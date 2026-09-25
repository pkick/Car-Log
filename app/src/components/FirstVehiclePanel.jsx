import { CarIcon } from './icons'

// Stand-in until P4-G builds the real first-run screen.
export default function FirstVehiclePanel({ onAddVehicle }) {
  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <div className="bg-white rounded-2.5 border border-dashed border-ink/20 px-6 py-[44px] flex flex-col items-center justify-center gap-[15px] text-center">
        <div className="w-[34px] h-[34px] rounded-10 bg-ink/5 flex items-center justify-center">
          <CarIcon size={20} className="text-ink/35" />
        </div>
        <div className="flex flex-col gap-[7px] max-w-[320px]">
          <h2 className="text-xl font-semibold tracking-tight">Add your first vehicle</h2>
          <p className="text-xs font-mono leading-relaxed text-ink/55">
            Fill-ups, maintenance, insurance and registration are all tracked per vehicle.
          </p>
        </div>
        <button
          onClick={onAddVehicle}
          className="px-4.5 py-3 rounded-lg bg-slate text-page text-xs font-medium hover:bg-slate/90 transition-colors"
        >
          Add vehicle
        </button>
      </div>
    </main>
  )
}
