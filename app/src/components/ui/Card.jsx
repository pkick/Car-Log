import { Link } from 'react-router'
import { cx } from './cx'

const TONES = {
  light: 'bg-surface border-ink/10',
  dark: 'bg-slate text-page border-ink/10',
  muted: 'bg-ink/3 border-ink/10',
  accent: 'bg-accent/10 border-accent/30',
  red: 'bg-red/10 border-red/30',
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5.5',
  lg: 'p-6',
}

/**
 * Surface for a group of content: 10px radius, hairline border.
 *
 * @param {object} props
 * @param {'light' | 'dark' | 'muted' | 'accent' | 'red'} [props.tone='light'] dark is the slate
 *   panel ("Coming up", "Cost per mile"); muted is a sunken panel on whatever is behind it (a picker
 *   inside a modal, a history row); accent and red are callouts (the next service due, a warning,
 *   an overdue renewal).
 * @param {'none' | 'sm' | 'md' | 'lg'} [props.padding='md'] 0, 16, 22 (the handoff's card
 *   padding) or 24px. Use none for tables and lists that run edge to edge.
 * @param {import('react').ElementType} [props.as='div'] e.g. 'section'.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children
 */
export function Card({ tone = 'light', padding = 'md', as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={cx('rounded-card border', TONES[tone], PADDING[padding], className)} {...props}>
      {children}
    </Tag>
  )
}

/**
 * The link that opens a whole Card. Put it on the card's title: its click area stretches over the card
 * (the stretched-link pattern), so the card is one target named by its title. Give the Card
 * `className="relative"`, and wrap the card's other controls in `relative z-10` so they stay clickable.
 * Hovering the card turns the title accent; keyboard focus rings the whole card.
 *
 * @param {object} props
 * @param {string} props.to Where it goes, as for react-router's Link.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children The title text.
 * Other props go to the Link.
 */
export function CardLink({ className, children, ...props }) {
  return (
    <Link
      className={cx(
        'transition-colors hover:text-accent after:absolute after:inset-0 after:rounded-card',
        'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent',
        className
      )}
      {...props}
    >
      {children}
    </Link>
  )
}
