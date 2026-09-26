import { cx } from './cx'

const TONES = {
  light: 'bg-ink/6',
  dark: 'bg-white/10',
}

/**
 * A grey placeholder block for content that is still loading. It pulses unless reduced motion is on, and is
 * hidden from screen readers: mark the region it fills with aria-busy instead.
 *
 * @param {object} props
 * @param {'light' | 'dark'} [props.tone='light'] Use dark on slate panels (the sidebar).
 * @param {'block' | 'circle'} [props.shape='block'] block has the control radius; circle is round.
 * @param {string} props.className Size and layout: `h-4 w-32`, `h-28`, `flex-1`.
 */
export function Skeleton({ tone = 'light', shape = 'block', className }) {
  return (
    <div
      aria-hidden="true"
      className={cx(TONES[tone], shape === 'circle' ? 'rounded-full' : 'rounded-control', 'motion-safe:animate-pulse', className)}
    />
  )
}
