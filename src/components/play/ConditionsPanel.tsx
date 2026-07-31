import { useState } from 'react'
import type { PlayCondition } from '../../core/play/types'

type Props = {
  /** Ids ativos, já incluindo as derivadas do estado. */
  active: string[]
  catalog: PlayCondition[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}

/**
 * Condições ativas na mesa.
 *
 * As **derivadas** (Machucado, Morrendo) o motor liga sozinho a partir dos PV — aparecem
 * marcadas e sem botão de remover, porque removê-las seria mentir sobre o estado da ficha.
 */
export function ConditionsPanel({ active, catalog, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const byId = new Map(catalog.map(c => [c.id, c]))
  const activeConditions = active
    .map(id => byId.get(id))
    .filter((c): c is PlayCondition => Boolean(c))
  // Condição já ativa continua ofertada QUANDO agrava — é o único jeito de alcançar o
  // agravamento do livro (receber Abalado de novo vira Apavorado, p. 310).
  const available = catalog.filter(c =>
    !c.derived && (!active.includes(c.id) || Boolean(c.escalatesTo)))

  return (
    <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold font-fantasy text-parchment-600 uppercase tracking-widest">
          Condições
        </h3>
        <button
          onClick={() => setAdding(v => !v)}
          className="text-[11px] font-fantasy transition-colors"
          style={{ color: adding ? 'var(--color-gold-400)' : '#8a7368' }}
        >
          {adding ? 'fechar' : '+ aplicar'}
        </button>
      </div>

      {activeConditions.length === 0 && !adding && (
        <p className="text-[11px] text-parchment-700">Nenhuma condição ativa.</p>
      )}

      {activeConditions.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {activeConditions.map(condition => (
            <li
              key={condition.id}
              className="rounded-lg border px-2.5 py-1.5"
              style={{
                borderColor: condition.derived ? 'var(--color-gold-800)' : 'rgba(90,62,36,0.45)',
                backgroundColor: condition.derived
                  ? 'color-mix(in srgb, var(--color-gold-900) 45%, transparent)'
                  : 'transparent',
              }}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-fantasy text-[13px] font-bold text-parchment-200 flex-1">
                  {condition.name}
                </span>
                {condition.derived ? (
                  <span
                    className="text-[9px] uppercase tracking-widest shrink-0"
                    style={{ color: 'var(--color-gold-400)' }}
                    title="Derivada dos pontos de vida — o motor liga e desliga sozinho"
                  >
                    automática
                  </span>
                ) : (
                  <button
                    onClick={() => onRemove(condition.id)}
                    className="text-[11px] text-parchment-700 hover:text-parchment-300 transition-colors shrink-0"
                    title={`Remover ${condition.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-[11px] text-parchment-600 leading-snug mt-0.5">
                {condition.description}
              </p>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-parchment-900">
          {available.map(condition => {
            const willEscalate = active.includes(condition.id) && condition.escalatesTo
            const nextName = willEscalate
              ? catalog.find(c => c.id === condition.escalatesTo)?.name ?? condition.escalatesTo
              : null
            return (
              <button
                key={condition.id}
                onClick={() => onAdd(condition.id)}
                title={willEscalate
                  ? `Já está ativa — aplicar de novo agrava para ${nextName}`
                  : condition.description}
                className="mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors"
                style={willEscalate
                  ? { borderColor: 'var(--color-gold-700)', color: 'var(--color-gold-400)' }
                  : { borderColor: '#3d2a2c', color: '#b3a094' }}
              >
                {willEscalate ? `${condition.name} → ${nextName}` : condition.name}
              </button>
            )
          })}
          {available.length === 0 && (
            <p className="text-[11px] text-parchment-700 mt-1">Todas já estão ativas.</p>
          )}
        </div>
      )}
    </div>
  )
}
