type Props = {
  onPrev?: () => void
  onNext: () => void
  nextLabel?: string
  /**
   * O que falta nesta etapa. NÃO bloqueia o avanço (a ordem de preenchimento é do jogador):
   * vira um aviso ao lado do CTA, e a cobrança de verdade acontece só na Revisão.
   */
  pendingReason?: string
  /** Trava o avanço de fato. Só a Revisão usa: é o gate final da ficha. */
  blocked?: boolean
}

/**
 * Rodapé de navegação do wizard (handoff "Redesign Ordem"): barra fixa com borda superior,
 * "← Voltar" à esquerda e CTA vermelho à direita. No desktop, começa depois da sidebar (250px).
 */
export function StepNav({ onPrev, onNext, nextLabel = 'Continuar ✦', pendingReason, blocked = false }: Props) {
  return (
    <div
      className="fixed bottom-0 right-0 left-0 lg:left-[250px] px-5 lg:px-10 py-3.5 flex justify-between items-center gap-3 z-20"
      style={{ backgroundColor: '#0e080aee', borderTop: '1px solid #2a1518', backdropFilter: 'blur(8px)' }}
    >
      {onPrev ? (
        <button
          onClick={onPrev}
          className="px-4 py-2.5 text-sm font-fantasy transition-colors shrink-0"
          style={{ color: '#b3a094' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ede2d6' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#b3a094' }}
        >
          ← Voltar
        </button>
      ) : <span />}

      <div className="flex items-center gap-3 min-w-0 justify-end">
        {pendingReason && (
          <span
            className="text-[12px] leading-tight text-right hidden sm:block"
            style={{ color: '#c9a05a' }}
            title="Você pode seguir e voltar aqui depois — só não dá pra concluir a ficha com pendências."
          >
            ⚠ {pendingReason}
          </span>
        )}
        <button
          onClick={onNext}
          disabled={blocked}
          className="px-8 py-3 rounded-[10px] font-fantasy font-bold text-[14.5px] transition-all shrink-0"
          style={blocked
            ? { backgroundColor: '#5a1214', color: '#c9a5a5', letterSpacing: '.06em', cursor: 'not-allowed' }
            : { backgroundColor: '#dc2626', color: '#ffffff', letterSpacing: '.06em', boxShadow: '0 4px 18px rgba(220,38,38,.35)' }}
          onMouseEnter={e => { if (!blocked) e.currentTarget.style.backgroundColor = '#ef4444' }}
          onMouseLeave={e => { if (!blocked) e.currentTarget.style.backgroundColor = '#dc2626' }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
