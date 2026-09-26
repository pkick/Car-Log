import { cx } from './cx'

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
 * @param {'light' | 'dark'} [props.tone='light'] dark is the slate panel ("Coming up", "Cost per mile").
 * @param {'none' | 'sm' | 'md' | 'lg'} [props.padding='md'] 0, 16, 22 (the handoff's card
 *   padding) or 24px. Use none for tables and lists that run edge to edge.
 * @param {import('react').ElementType} [props.as='div'] e.g. 'section'.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children
 */
export function Card({ tone = 'light', padding = 'md', as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag
      className={cx(
        'rounded-card border border-ink/10',
        tone === 'dark' ? 'bg-slate text-page' : 'bg-surface',
        PADDING[padding],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}
