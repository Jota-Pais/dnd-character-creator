import type { WizardStep } from '../../types/character'
import { WIZARD_STEPS, STEP_LABELS } from '../../types/character'

type Props = {
  currentStep: WizardStep
}

export function StepIndicator({ currentStep }: Props) {
  const currentIdx = WIZARD_STEPS.indexOf(currentStep)

  return (
    <nav aria-label="Etapas de criação">
      <ol className="flex items-center gap-0">
        {WIZARD_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx
          const isActive = idx === currentIdx

          return (
            <li key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors',
                    isDone
                      ? 'bg-amber-500 border-amber-500 text-stone-950'
                      : isActive
                        ? 'bg-stone-900 border-amber-500 text-amber-500'
                        : 'bg-stone-900 border-stone-600 text-stone-500',
                  ].join(' ')}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span
                  className={[
                    'mt-1 text-xs font-medium hidden sm:block',
                    isActive ? 'text-amber-500' : isDone ? 'text-stone-400' : 'text-stone-600',
                  ].join(' ')}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {idx < WIZARD_STEPS.length - 1 && (
                <div
                  className={[
                    'h-0.5 w-8 sm:w-12 mx-1 mb-4 transition-colors',
                    isDone ? 'bg-amber-500' : 'bg-stone-700',
                  ].join(' ')}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
