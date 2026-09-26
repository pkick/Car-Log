import { Button } from './ui'

/**
 * "Delete this?" asked in place of the control that asked it, instead of `confirm()`. Keep takes focus, so Enter or
 * Space right after the first click doesn't delete.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.message e.g. "Delete receipt.pdf? The file is removed from the server."
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {string} [props.confirmLabel='Delete']
 * @param {boolean} [props.busy=false] Shows the spinner while the delete runs.
 * @param {string | null} [props.error] Why the last attempt failed.
 */
export default function InlineConfirm({ message, onConfirm, onCancel, confirmLabel = 'Delete', busy = false, error }) {
  return (
    <div role="group" aria-label="Confirm delete">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm min-w-0">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="danger" size="sm" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel} autoFocus>
            Keep
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-red mt-2">{error}</p>}
    </div>
  )
}
