type Props = {
  onPrev?: () => void
  onNext: () => void
  nextLabel?: string
  /** Cor de destaque do botão "Continuar" (varia por Raça/Classe em alguns passos). */
  accent?: string
  /** Dica exibida no hover do botão de avançar (ex.: "Salva a ficha e volta à galeria" na Revisão). */
  nextTitle?: string
  /**
   * O que falta nesta etapa. NÃO bloqueia o avanço (a ordem de preenchimento é do jogador):
   * vira um aviso ao lado do CTA, e a cobrança de verdade acontece só na Revisão.
   */
  pendingReason?: string
  /** Trava o avanço de fato. Só a Revisão usa: é o gate final da ficha. */
  blocked?: boolean
}

/**
 * Rodapé de navegação do wizard D&D: barra fixa em qualquer largura (sem sidebar pra
 * deslocar, ao contrário do Ordem) — elimina a duplicação mobile/desktop que cada passo
 * reimplementava à mão.
 */
export function StepNav({
  onPrev,
  onNext,
  nextLabel = 'Continuar ✦',
  accent = '#d4900a',
  nextTitle,
  pendingReason,
  blocked = false,
}: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-parchment-900 px-4 py-3 flex justify-between items-center gap-3"
      style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
    >
      {onPrev ? (
        <button
          onClick={onPrev}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors text-sm font-fantasy shrink-0"
        >
          ← Voltar
        </button>
      ) : <span />}

      <div className="flex items-center gap-3 min-w-0 justify-end">
        {pendingReason && (
          <span
            className="text-xs leading-tight text-right text-gold-600/90 hidden sm:block"
            title="Você pode seguir e voltar aqui depois — só não dá pra concluir a ficha com pendências."
          >
            ⚠ {pendingReason}
          </span>
        )}
        <button
          onClick={onNext}
          disabled={blocked}
          title={nextTitle}
          className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all shrink-0"
          style={{
            backgroundColor: blocked ? '#3a2614' : accent,
            color: blocked ? '#5a3e24' : '#0a0704',
            cursor: blocked ? 'not-allowed' : 'pointer',
          }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
