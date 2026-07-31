/**
 * D20 em SVG inline — marca do módulo D&D 5e, equivalente ao Símbolo Maior do Ordem.
 *
 * Traçado (não silhueta sólida) porque a marca serve em dois tamanhos muito diferentes: 34px na
 * sidebar e 640px girando de fundo. Sólido vira um borrão hexagonal no tamanho grande.
 * A cor sai de `currentColor`, então quem usa controla pelo texto (`text-gold-500`).
 */
export function D20Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      {/* Silhueta do icosaedro visto de face */}
      <path d="M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z" strokeWidth={4.5} />
      {/* Face superior (o triângulo que carrega o número num dado de verdade) */}
      <path d="M50 30 L74 68 L26 68 Z" strokeWidth={3.5} />
      {/* Arestas do triângulo central até os vértices alternados */}
      <path d="M50 30 V3 M26 68 L9 73.5 M74 68 L91 73.5" strokeWidth={2.5} />
      {/* Arestas dos três vértices restantes, fechando as facetas */}
      <path
        d="M91 26.5 L50 30 M91 26.5 L74 68 M50 97 L26 68 M50 97 L74 68 M9 26.5 L50 30 M9 26.5 L26 68"
        strokeWidth={2}
        opacity={0.7}
      />
    </svg>
  )
}
