import { Component } from 'react'
import { AlertIcon } from './icons'
import { Button, EmptyState } from './ui'

/**
 * Full-screen failure with a Retry that reloads the page: the error boundary's fallback, and what the app shows
 * when its first load fails.
 *
 * @param {object} props
 * @param {string} [props.title='Something went wrong']
 * @param {string} [props.message] The error's message, shown in a small mono line.
 */
export function ErrorScreen({ title = 'Something went wrong', message }) {
  return (
    <main className="flex h-screen items-center justify-center bg-page px-6">
      <EmptyState
        icon={AlertIcon}
        title={title}
        body={message}
        action={
          <Button size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
        className="w-full max-w-[480px]"
      />
    </main>
  )
}

/** Catches a render error anywhere below it and shows ErrorScreen instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) return <ErrorScreen message={error.message || String(error)} />
    return this.props.children
  }
}
