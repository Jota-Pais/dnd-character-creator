/**
 * O que fica na tela enquanto desce o pedaço de uma tela sob demanda (core/utils/lazyScreen.ts):
 * só na primeira visita, no toque antes de o pedaço descer sozinho (depois da primeira tela e das
 * fontes dela). Nas aberturas seguintes, o pedaço sai do SW antes de a galeria aparecer.
 */
export function Loading({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center text-parchment-400 text-sm font-fantasy ${className}`}>
      Carregando…
    </p>
  )
}
