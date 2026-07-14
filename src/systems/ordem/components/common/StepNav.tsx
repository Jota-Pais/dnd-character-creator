type Props = {
  onPrev?: () => void
  onNext: () => void
  canAdvance: boolean
  nextLabel?: string
  disabledReason?: string
}

/**
 * Rodapé de navegação do wizard (handoff "Redesign Ordem"): barra fixa com borda superior,
 * "← Voltar" à esquerda e CTA vermelho à direita. No desktop, começa depois da sidebar (250px).
 */
export function StepNav({ onPrev, onNext, canAdvance, nextLabel = 'Continuar ✦', disabledReason }: Props) {
  return (
    <div
      className="fixed bottom-0 right-0 left-0 lg:left-[250px] px-5 lg:px-10 py-3.5 flex justify-between items-center z-20"
      style={{ backgroundColor: '#0e080aee', borderTop: '1px solid #2a1518', backdropFilter: 'blur(8px)' }}
    >
      {onPrev ? (
        <button
          onClick={onPrev}
          className="px-4 py-2.5 text-sm font-fantasy transition-colors"
          style={{ color: '#b3a094' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ede2d6' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#b3a094' }}
        >
          ← Voltar
        </button>
      ) : <span />}
      <button
        onClick={onNext}
        disabled={!canAdvance}
        className="px-8 py-3 rounded-[10px] font-fantasy font-bold text-[14.5px] transition-all"
        style={canAdvance
          ? { backgroundColor: '#dc2626', color: '#ffffff', letterSpacing: '.06em', boxShadow: '0 4px 18px rgba(220,38,38,.35)' }
          : { backgroundColor: '#5a1214', color: '#c9a5a5', letterSpacing: '.06em', cursor: 'not-allowed' }}
        onMouseEnter={e => { if (canAdvance) e.currentTarget.style.backgroundColor = '#ef4444' }}
        onMouseLeave={e => { if (canAdvance) e.currentTarget.style.backgroundColor = '#dc2626' }}
      >
        {canAdvance || !disabledReason ? nextLabel : disabledReason}
      </button>
    </div>
  )
}
