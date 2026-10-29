/** Folga (px) entre o fim do formulário do d20 e o topo do aviso preso ao pé da tela. */
export const TOAST_GAP = 8

type VerticalRect = { top: number; bottom: number }

/**
 * Quanto rolar a página (px; positivo desce) quando o personagem cai a 0 PV. O teste contra a
 * morte vai para o meio da tela, mas o campo do d20 e o "Registrar" — o primeiro gesto que a tela
 * pede — nunca ficam sob o aviso da queda, preso ao pé (`bottomInset`: a altura dele, 0 sem aviso).
 * Se o centro deixaria o formulário embaixo do aviso, rola o que falta para ele terminar acima.
 */
export function getDeathSaveScrollDelta({ panel, form, viewportHeight, bottomInset }: {
  /** O cartão do teste contra a morte, em coordenadas da tela (`getBoundingClientRect`). */
  panel: VerticalRect
  /** O formulário do d20 (campo, "rolar" e "Registrar"). */
  form: VerticalRect
  viewportHeight: number
  bottomInset: number
}): number {
  const centered = (panel.top + panel.bottom) / 2 - viewportHeight / 2
  const limit = viewportHeight - bottomInset - TOAST_GAP
  const overflow = form.bottom - centered - limit
  return overflow > 0 ? centered + overflow : centered
}
