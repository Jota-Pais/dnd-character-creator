type Props = {
  steps: { id: string; label: string }[]
  currentStepId: string
}

export function StepIndicator({ steps, currentStepId }: Props) {
  const currentIdx = steps.findIndex(s => s.id === currentStepId)

  return (
    <nav aria-label="Etapas de criação">
      <ol className="flex items-center gap-0">
        {steps.map((step, idx) => {
          const isDone = idx < currentIdx
          const isActive = idx === currentIdx

          return (
            <li key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 font-fantasy',
                    isDone
                      ? 'bg-gold-500 border-gold-400 text-parchment-950 shadow-md shadow-gold-900/40'
                      : isActive
                        ? 'bg-parchment-950 border-gold-400 text-gold-400 shadow-md shadow-gold-900/30'
                        : 'bg-parchment-950 border-parchment-800 text-parchment-700',
                  ].join(' ')}
                >
                  {isDone ? '✦' : idx + 1}
                </div>
                <span
                  className={[
                    'mt-1.5 text-xs font-medium hidden sm:block font-fantasy',
                    isActive
                      ? 'text-gold-400'
                      : isDone
                        ? 'text-parchment-500'
                        : 'text-parchment-800',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={[
                    'h-px w-6 sm:w-10 mx-1 mb-5 transition-colors duration-300',
                    isDone ? 'bg-gold-600' : 'bg-parchment-800',
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
