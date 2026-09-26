import { CheckIcon } from './icons'
import { cx } from './ui/cx'

const COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }

/**
 * The numbered setup steps (Add the vehicle, Set intervals, Log a fill-up), each marked to do or done.
 *
 * @param {object} props
 * @param {import('../lib/onboarding').OnboardingStep[]} props.steps From `getOnboardingSteps`.
 * @param {'center' | 'start'} [props.align='start'] center is the first-run strip: narrow centered columns.
 *   start spreads the steps across a card, marker beside the text.
 * @param {Partial<Record<import('../lib/onboarding').OnboardingStepId, import('react').ReactNode>>} [props.actions]
 *   A control per step id, shown under the step while it is still to do.
 * @param {string} [props.className] Layout only.
 */
export default function OnboardingSteps({ steps, align = 'start', actions = {}, className }) {
  const centered = align === 'center'
  return (
    <ol className={cx(centered ? 'flex justify-center gap-7' : cx('grid gap-6', COLUMNS[steps.length]), className)}>
      {steps.map((step) => (
        <li
          key={step.id}
          className={cx('flex', centered ? 'w-[150px] flex-col items-center gap-2 text-center' : 'items-start gap-3')}
        >
          <span
            className={cx(
              'w-[26px] h-[26px] rounded-control flex items-center justify-center flex-none text-xs font-mono font-semibold',
              step.done ? 'bg-green/12 text-green' : 'bg-accent/10 text-accent'
            )}
            aria-hidden="true"
          >
            {step.done ? <CheckIcon size={12} /> : step.n}
          </span>
          <div className={cx('flex flex-col gap-1 min-w-0', centered && 'items-center')}>
            <span className={cx('text-sm font-semibold', step.done && 'text-ink/50')}>
              <span className="sr-only">{`Step ${step.n}, ${step.done ? 'done' : 'to do'}: `}</span>
              {step.title}
            </span>
            <span className="text-xs font-mono leading-relaxed text-ink/50">{step.body}</span>
            {!step.done && actions[step.id] && <div className="mt-1">{actions[step.id]}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
