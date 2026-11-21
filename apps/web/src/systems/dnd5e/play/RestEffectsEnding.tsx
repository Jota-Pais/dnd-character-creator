/**
 * Os efeitos ligados que acabam no descanso, que dura mais que eles (a Fúria, com o Frenesi): os
 * avisos que a conclusão vai dar (`effectsEnding` das prévias), antes do que volta. Nos dois
 * descansos; sem efeito a encerrar, nada.
 */
export function RestEffectsEnding({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="space-y-0.5" data-testid="rest-effects-ending">
      {lines.map(line => <li key={line} className="text-xs text-amber-200 leading-snug">{line}</li>)}
    </ul>
  )
}
