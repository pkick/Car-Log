import { cx } from './cx'

/**
 * Dashed panel for "nothing here yet" and "this is turned off", with one way forward.
 *
 * @param {object} props
 * @param {import('react').ComponentType<{ size?: number, className?: string }>} [props.icon] An
 *   icon component from icons.jsx, e.g. CarIcon.
 * @param {import('react').ReactNode} props.title
 * @param {import('react').ReactNode} [props.body] One or two short sentences.
 * @param {import('react').ReactNode} [props.action] Usually a Button.
 * @param {string} [props.className] Layout only.
 */
export function EmptyState({ icon: Icon, title, body, action, className }) {
  return (
    <div className={cx('bg-surface rounded-card border border-dashed border-ink/20 px-6 py-[44px] flex flex-col items-center justify-center gap-[15px] text-center', className)}>
      {Icon && (
        <div className="w-[34px] h-[34px] rounded-10 bg-ink/5 flex items-center justify-center">
          <Icon size={20} className="text-ink/35" />
        </div>
      )}
      <div className="flex flex-col gap-[7px] max-w-[320px]">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {body && <p className="text-xs font-mono leading-relaxed text-ink/55">{body}</p>}
      </div>
      {action}
    </div>
  )
}
