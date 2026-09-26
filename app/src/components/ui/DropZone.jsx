import { useEffect, useId, useRef, useState } from 'react'
import { cx } from './cx'

const SIZES = {
  sm: 'px-4 py-4 gap-1',
  md: 'px-6 py-6 gap-1.5',
}

const ICON_SIZES = { sm: 24, md: 32 }

const FOCUS_WITHIN = 'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent'

const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files')

/**
 * The dashed target for attaching files. Drop files on it, click it (or Tab to it and press Space) to pick them, or
 * paste them: a zone inside a dialog takes files pasted anywhere in that dialog, and one on the page takes pastes while
 * no dialog is open. It only collects files; checking and uploading them is up to `onFiles`.
 *
 * @param {object} props
 * @param {(files: File[]) => void} props.onFiles Called with every file dropped, picked or pasted at once.
 * @param {import('react').ReactNode} props.title e.g. "Drop a receipt, paste one, or click to attach".
 * @param {import('react').ReactNode} [props.hint] Mono line under the title: where files go, which types, the limit.
 * @param {string} [props.accept] The file input's accept list, e.g. ".pdf,image/png".
 * @param {boolean} [props.multiple=true]
 * @param {import('react').ComponentType<{ size?: number, className?: string }>} [props.icon] e.g. PaperclipIcon.
 * @param {import('react').ReactNode} [props.error] Red message under the zone; also turns its border red.
 * @param {boolean} [props.disabled=false]
 * @param {'sm' | 'md'} [props.size='md'] sm for a zone beside other fields.
 * @param {string} [props.className] Layout only.
 */
export function DropZone({ onFiles, title, hint, accept, multiple = true, icon: Icon, error, disabled = false, size = 'md', className }) {
  const [dragging, setDragging] = useState(false)
  const zoneRef = useRef(null)
  const onFilesRef = useRef(onFiles)
  // dragenter and dragleave fire for every child the pointer crosses; count them so the highlight doesn't flicker.
  const depth = useRef(0)
  const titleId = useId()
  const hintId = useId()
  const errorId = useId()

  useEffect(() => {
    onFilesRef.current = onFiles
  })

  useEffect(() => {
    if (disabled) return
    const handlePaste = (event) => {
      const files = [...(event.clipboardData?.files ?? [])]
      if (files.length === 0) return
      const dialog = zoneRef.current?.closest('[role="dialog"]')
      const ours = dialog ? dialog.contains(event.target) : !document.querySelector('[aria-modal="true"]')
      if (!ours) return
      event.preventDefault()
      onFilesRef.current(files)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [disabled])

  const endDrag = () => {
    depth.current = 0
    setDragging(false)
  }

  const look = disabled
    ? 'border-ink/20 opacity-40 cursor-not-allowed'
    : cx(
        'cursor-pointer',
        dragging ? 'border-accent bg-accent/12' : error ? 'border-red/50 bg-red/5 hover:bg-red/10' : 'border-accent/35 bg-accent/6 hover:bg-accent/10'
      )

  return (
    <div className={className}>
      <label
        ref={zoneRef}
        className={cx('flex flex-col items-center justify-center text-center rounded-card border-2 border-dashed transition-colors', SIZES[size], look, FOCUS_WITHIN)}
        onDragEnter={(event) => {
          if (disabled || !hasFiles(event)) return
          event.preventDefault()
          depth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => {
          if (disabled || !hasFiles(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={() => {
          depth.current -= 1
          if (depth.current <= 0) endDrag()
        }}
        onDrop={(event) => {
          if (disabled || !hasFiles(event)) return
          event.preventDefault()
          endDrag()
          const files = [...event.dataTransfer.files]
          if (files.length > 0) onFiles(files)
        }}
      >
        <input
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-labelledby={titleId}
          aria-describedby={cx(hint && hintId, error && errorId) || undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const files = [...event.target.files]
            // Cleared so picking the same file again still fires a change.
            event.target.value = ''
            if (files.length > 0) onFiles(files)
          }}
        />
        {Icon && <Icon size={ICON_SIZES[size]} className="flex-none text-accent" />}
        <span id={titleId} className="text-sm font-semibold">
          {title}
        </span>
        {hint && (
          <span id={hintId} className="text-xs font-mono text-ink/50">
            {hint}
          </span>
        )}
      </label>
      {error && (
        <p id={errorId} className="text-xs text-red mt-1.5">
          {error}
        </p>
      )}
    </div>
  )
}
