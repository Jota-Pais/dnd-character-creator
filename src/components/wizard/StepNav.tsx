type Props = {
  onPrev?: () => void
  onNext: () => void
  canAdvance: boolean
  nextLabel?: string
  /** Cor de destaque do botão "Continuar" (varia por Raça/Classe em alguns passos). */
  accent?: string
  /** Dica exibida no hover do botão de avançar (ex.: "Salva a ficha e volta à galeria" na Revisão). */
  nextTitle?: string
}

/**
 * Rodapé de navegação do wizard D&D: barra fixa em qualquer largura (sem sidebar pra
 * deslocar, ao contrário do Ordem) — elimina a duplicação mobile/desktop que cada passo
 * reimplementava à mão.
 */
export function StepNav({ onPrev, onNext, canAdvance, nextLabel = 'Continuar ✦', accent = '#d4900a', nextTitle }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-parchment-900 px-4 py-3 flex justify-between items-center"
      style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
    >
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
        title={nextTitle}
        className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
        style={{
          backgroundColor: canAdvance ? accent : '#3a2614',
          color: canAdvance ? '#0a0704' : '#5a3e24',
          cursor: canAdvance ? 'pointer' : 'not-allowed',
        }}
      >
        {nextLabel}
      </button>
    </div>
  )
}
