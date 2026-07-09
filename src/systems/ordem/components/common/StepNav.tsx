type Props = {
  onPrev?: () => void
  onNext: () => void
  canAdvance: boolean
  nextLabel?: string
}

export function StepNav({ onPrev, onNext, canAdvance, nextLabel = 'Continuar ✦' }: Props) {
  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-parchment-900 px-4 py-3 flex justify-between items-center lg:hidden"
        style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
      >
        <NavButtons onPrev={onPrev} onNext={onNext} canAdvance={canAdvance} nextLabel={nextLabel} />
      </div>
      <div className="hidden lg:flex lg:absolute lg:bottom-8 lg:right-8 gap-3">
        <NavButtons onPrev={onPrev} onNext={onNext} canAdvance={canAdvance} nextLabel={nextLabel} />
      </div>
    </>
  )
}

function NavButtons({ onPrev, onNext, canAdvance, nextLabel }: Required<Omit<Props, 'onPrev'>> & Pick<Props, 'onPrev'>) {
  return (
    <>
      {onPrev ? (
        <button
          onClick={onPrev}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors text-sm font-fantasy"
        >
          ← Voltar
        </button>
      ) : <span />}
      <button
        onClick={onNext}
        disabled={!canAdvance}
        className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all bg-gold-500 text-parchment-950 hover:bg-gold-400 disabled:bg-parchment-900 disabled:text-parchment-700 disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </>
  )
}
