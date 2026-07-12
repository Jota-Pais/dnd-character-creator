type Props = {
  steps: { id: string; label: string; clickable?: boolean }[]
  currentStepId: string
  /** Torna as etapas clicáveis (navegação livre) — chamado com o id da etapa. */
  onStepClick?: (id: string) => void
}

export function StepIndicator({ steps, currentStepId, onStepClick }: Props) {
  const currentIdx = steps.findIndex(s => s.id === currentStepId)

  return (
    <nav aria-label="Etapas de criação">
      <ol className="flex items-center gap-0">
        {steps.map((step, idx) => {
          const isDone = idx < currentIdx
          const isActive = idx === currentIdx
          const isClickable = Boolean(onStepClick && step.clickable && !isActive)

          return (
            <li key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => { if (isClickable) onStepClick?.(step.id) }}
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
                title={isClickable ? `Ir para ${step.label}` : undefined}
                className={[
                  'flex flex-col items-center bg-transparent border-0 p-0 group',
                  isClickable ? 'cursor-pointer' : 'cursor-default',
                ].join(' ')}
              >
                <div
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 font-fantasy',
                    isDone
                      ? 'bg-gold-500 border-gold-400 text-parchment-950 shadow-md shadow-gold-900/40'
                      : isActive
                        ? 'bg-parchment-950 border-gold-400 text-gold-400 shadow-md shadow-gold-900/30'
                        : 'bg-parchment-950 border-parchment-800 text-parchment-700',
                    isClickable ? 'group-hover:scale-110 group-hover:border-gold-300 group-hover:shadow-lg' : '',
                  ].join(' ')}
                >
                  {isDone ? '✦' : idx + 1}
                </div>
                <span
                  className={[
                    'mt-1.5 text-xs font-medium hidden sm:block font-fantasy transition-colors',
                    isActive
                      ? 'text-gold-400'
                      : isDone
                        ? 'text-parchment-500'
                        : 'text-parchment-800',
                    isClickable ? 'group-hover:text-gold-400' : '',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </button>

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
