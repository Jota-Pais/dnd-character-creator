import { formatModifier } from '../../utils/abilityScoreUtils'
import type { NumberSource } from './numberSources'
import { PlayDialog } from './PlayDialog'

/**
 * A folha "de onde vem este número" de um valor que não se rola (CA, CD de magia, Percepção
 * passiva): o número grande, a conta parcela a parcela e as linhas condicionais, fora do número.
 */
export function NumberSourceSheet({ source, onClose }: { source: NumberSource; onClose: () => void }) {
  return (
    <PlayDialog title={source.title} titleId="number-source-title" onClose={onClose}>
      <p className="mt-2 font-fantasy font-bold text-3xl text-gold-300" data-testid="source-value">{source.value}</p>
      {source.hint && <p className="mt-1 text-sm text-parchment-400 leading-snug">{source.hint}</p>}

      {source.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {source.notes.map((n, i) => (
            <li key={i} className="text-xs text-parchment-400 leading-snug">• {n}</li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wider text-parchment-600">De onde vem</p>
        <ul className="mt-1 divide-y divide-parchment-900" data-testid="source-items">
          {source.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3 py-1 text-sm">
              <span className="text-parchment-400">{item.label}</span>
              <span className="text-parchment-200">{i === 0 ? item.value : formatModifier(item.value)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-1 text-sm font-bold">
            <span className="text-parchment-300">Total</span>
            <span className="text-parchment-100">{source.value}</span>
          </li>
        </ul>
        {source.formula && <p className="mt-1 text-[11px] text-parchment-600">{source.formula}</p>}
      </div>
    </PlayDialog>
  )
}
