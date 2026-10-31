/**
 * O que fica na tela enquanto desce o pedaço de uma tela sob demanda (core/utils/lazyScreen.ts):
 * só no toque logo na primeira abertura, antes de o pedaço descer sozinho depois do `load`.
 */
export function Loading({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center text-parchment-400 text-sm font-fantasy ${className}`}>
      Carregando…
    </p>
  )
}
