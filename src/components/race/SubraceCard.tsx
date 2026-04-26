import type { Subrace } from '../../types/race'
import { ABILITY_LABELS, formatBonus } from '../../utils/abilityScoreUtils'

type Props = {
  subrace: Subrace
  selected: boolean
  onSelect: () => void
}

export function SubraceCard({ subrace, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={[
        'w-full text-left p-3 rounded-lg border-2 transition-all duration-150',
        selected
          ? 'border-amber-500 bg-stone-800'
          : 'border-stone-700 bg-stone-900 hover:border-stone-500 hover:bg-stone-800',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-stone-100 text-sm">{subrace.name}</span>
        {selected && <span className="text-amber-500 text-xs">✓</span>}
      </div>

      <p className="text-stone-400 text-xs mb-2 leading-relaxed">{subrace.description}</p>

      <div className="flex flex-wrap gap-1">
        {subrace.abilityBonuses.map(b => (
          <span
            key={b.ability}
            className="px-1.5 py-0.5 bg-amber-900/40 text-amber-400 text-xs font-mono rounded"
          >
            {ABILITY_LABELS[b.ability].short} {formatBonus(b.value)}
          </span>
        ))}
        {subrace.traits.map(t => (
          <span
            key={t.name}
            className="px-1.5 py-0.5 bg-stone-700 text-stone-300 text-xs rounded"
          >
            {t.name}
          </span>
        ))}
      </div>
    </button>
  )
}
