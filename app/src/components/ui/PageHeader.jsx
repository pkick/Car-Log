import { cx } from './cx'

/**
 * The title block at the top of every page: mono eyebrow, page title, optional subtitle, and the
 * page's primary action on the right. It brings its own bottom margin so every page lines up.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.eyebrow Shown uppercase above the title, e.g. "Dashboard".
 * @param {import('react').ReactNode} props.title The page's h1.
 * @param {import('react').ReactNode} [props.subtitle] One muted line under the title.
 * @param {import('react').ReactNode} [props.action] Usually one primary Button.
 * @param {string} [props.className] Layout only.
 */
export function PageHeader({ eyebrow, title, subtitle, action, className }) {
  return (
    <div className={cx('flex items-end justify-between gap-6 mb-5.5', className)}>
      <div className="min-w-0">
        <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2">{eyebrow}</p>
        <h1 className="text-5xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink/60 mt-2">{subtitle}</p>}
      </div>
      {action && <div className="flex-none flex items-center gap-2.5">{action}</div>}
    </div>
  )
}
