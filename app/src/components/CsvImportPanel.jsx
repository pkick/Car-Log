import { lazy, Suspense, useRef, useState } from 'react'
import { FuelIcon } from './icons'
import { Button, Card } from './ui'
import { useCsvFile } from '../hooks/useCsvFile'

const ImportFillUpsModal = lazy(() => import('./ImportFillUpsModal'))

/**
 * Settings' "Import fill-ups from CSV": a drop target and a file button, then the mapping and preview modal.
 */
export default function CsvImportPanel() {
  const input = useRef(null)
  const csv = useCsvFile()
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    csv.read(event.dataTransfer.files[0])
  }

  return (
    <div>
      <p className="font-semibold text-sm">Import fill-ups from CSV</p>
      <p className="text-xs font-mono text-ink/50">Fuelly, Drivvo or an Odometer CSV export, or any file with dates and odometer readings</p>

      <Card
        tone={dragging ? 'accent' : 'muted'}
        padding="md"
        className="mt-3 flex items-center justify-between gap-4"
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
        }}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FuelIcon size={20} className="flex-none text-ink/45" />
          <p className="text-xs font-mono text-ink/60">
            {dragging ? 'Drop the file to import it' : 'Drop a .csv file here, or choose one'}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files[0]
            event.target.value = ''
            csv.read(file)
          }}
        />
        <Button variant="secondary" size="sm" className="flex-none" loading={csv.reading} onClick={() => input.current.click()}>
          Choose CSV file
        </Button>
      </Card>

      {csv.error && <p role="alert" className="text-xs text-red mt-3">{csv.error}</p>}
      {csv.source && (
        <Suspense fallback={null}>
          <ImportFillUpsModal source={csv.source} onClose={csv.clear} />
        </Suspense>
      )}
    </div>
  )
}
