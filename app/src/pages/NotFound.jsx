import { useNavigate } from 'react-router'
import { MapPinIcon } from '../components/icons'
import { Button, EmptyState } from '../components/ui'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <EmptyState
        icon={MapPinIcon}
        title="Page not found"
        body="Nothing lives at this address. The link may be old or mistyped."
        action={<Button size="sm" onClick={() => navigate('/')}>Go to Dashboard</Button>}
      />
    </main>
  )
}
