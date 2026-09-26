import { useState } from 'react'
import { FileIcon } from '../icons'
import { cx, FOCUS_RING } from './cx'

const SIZES = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const TONES = {
  neutral: 'border-ink/10 bg-ink/4 text-ink/55',
  red: 'border-red/30 bg-red/10 text-red',
}

/**
 * A square preview of an attached file: its image when there is one, otherwise a tile with the file's type (a PDF or
 * HEIC, or an image whose thumbnail failed to load). Also the "+2" tile after a row's last thumbnail.
 *
 * @param {object} props
 * @param {string} props.label The tile's text: a short type name ("PDF", "HEIC") or a count ("+2").
 * @param {string} [props.src] The image. When it's missing or fails to load, the tile shows instead.
 * @param {'sm' | 'md' | 'lg'} [props.size='sm'] 36, 48 or 64px. lg tiles add a file icon over the label.
 * @param {'neutral' | 'red'} [props.tone='neutral'] red marks a file that's missing or failed.
 * @param {() => void} [props.onClick] Makes it a button (give it an aria-label); otherwise it's decorative.
 * @param {string} [props.className] Layout only.
 * Other props (aria-label, title, ...) go to the element.
 */
export function FileThumb({ label, src, size = 'sm', tone = 'neutral', onClick, className, ...props }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const showImage = src && failedSrc !== src
  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-hidden={onClick ? undefined : true}
      className={cx(
        'relative inline-flex flex-col items-center justify-center gap-0.5 flex-none overflow-hidden rounded-control border text-xs font-mono font-semibold',
        SIZES[size],
        TONES[tone],
        onClick && cx('transition-colors hover:border-accent', FOCUS_RING),
        className
      )}
      {...props}
    >
      {showImage ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} className="w-full h-full object-cover" />
      ) : (
        <>
          {size === 'lg' && <FileIcon size={20} className="flex-none" />}
          {label}
        </>
      )}
    </Tag>
  )
}
