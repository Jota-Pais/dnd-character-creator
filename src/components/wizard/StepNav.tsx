type Props = {
  onPrev?: () => void
  onNext: () => void
  nextLabel?: string
  /** Cor de destaque do botão "Continuar" (varia por Raça/Classe em alguns passos do D&D). */
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
 * Rodapé de navegação do wizard, compartilhado pelos sistemas: barra fixa com borda superior,
 * "← Voltar" à esquerda e CTA à direita. No desktop começa depois da sidebar do WizardShell
 * (250px); abaixo de `lg` a sidebar some e a barra ocupa a largura toda.
 *
 * O accent padrão é o token `gold-500`, então cada sistema herda o próprio destaque (dourado no
 * D&D, vermelho sob `.theme-ordem`) sem passar nada.
 */
export function StepNav({
  onPrev,
  onNext,
  nextLabel = 'Continuar ✦',
  accent = 'var(--color-gold-500)',
  nextTitle,
  pendingReason,
  blocked = false,
}: Props) {
  return (
    <div
      className="fixed bottom-0 right-0 left-0 lg:left-[250px] z-20 border-t border-parchment-900 px-5 lg:px-10 py-3.5 flex justify-between items-center gap-3"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-surface-raised) 93%, transparent)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {onPrev ? (
        <button
          onClick={onPrev}
          className="px-4 py-2.5 text-parchment-500 hover:text-parchment-200 transition-colors text-sm font-fantasy shrink-0"
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
          title={nextTitle}
          className="px-8 py-3 rounded-[10px] font-fantasy font-bold text-[14.5px] transition-all shrink-0 enabled:hover:brightness-110"
          style={blocked
            // Estados derivados do accent pra qualquer destaque (inclusive os por classe do D&D).
            ? {
                backgroundColor: `color-mix(in srgb, ${accent} 35%, black)`,
                color: `color-mix(in srgb, ${accent} 45%, white)`,
                letterSpacing: '.06em',
                cursor: 'not-allowed',
              }
            : {
                backgroundColor: accent,
                color: 'var(--color-on-accent)',
                letterSpacing: '.06em',
                boxShadow: `0 4px 18px color-mix(in srgb, ${accent} 35%, transparent)`,
              }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
