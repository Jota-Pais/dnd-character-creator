/**
 * O último controle tocado (ou clicado) no jogo. No Safari — no WebKit em geral, também no iPhone —
 * o toque e o clique não dão foco ao botão: quem abre uma folha não está no `document.activeElement`,
 * que fica no body, e o foco não teria para onde voltar ao fechar (o VoiceOver iria ao topo da
 * página). A folha (`PlayDialog`) pergunta aqui quem a abriu quando o foco não diz.
 */

const CONTROL = 'button, a[href], input, select, textarea, [tabindex]'

let lastPressed: HTMLElement | null = null

/** Passa a anotar o controle sob cada toque; devolve o que desliga (a limpeza do efeito). */
export function trackPressedControls(doc: Document = document): () => void {
  const onPointerDown = (e: Event) => {
    const control = e.target instanceof Element ? e.target.closest(CONTROL) : null
    lastPressed = control instanceof HTMLElement ? control : null
  }
  doc.addEventListener('pointerdown', onPointerDown, true)
  return () => {
    doc.removeEventListener('pointerdown', onPointerDown, true)
    lastPressed = null
  }
}

/** Quem abriu a folha: o que tem o foco ou, com o foco no body (o toque no Safari), o último tocado. */
export function getOpener(doc: Document = document): HTMLElement | null {
  const active = doc.activeElement
  if (active instanceof HTMLElement && active !== doc.body) return active
  return lastPressed?.isConnected ? lastPressed : null
}
