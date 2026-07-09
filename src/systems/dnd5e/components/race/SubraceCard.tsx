import type { Subrace } from '../../types/race'
import { ABILITY_LABELS, formatBonus } from '../../utils/abilityScoreUtils'

type Props = {
  subrace: Subrace
  selected: boolean
  accent: string
  onSelect: () => void
}

export function SubraceCard({ subrace, selected, accent, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-3 rounded-xl border-2 transition-all duration-150"
      style={{
        borderColor: selected ? accent : 'rgba(90, 62, 36, 0.5)',
        backgroundColor: selected ? `${accent}12` : 'rgba(18, 12, 4, 0.7)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-fantasy font-semibold text-parchment-200 text-sm">
          {subrace.name}
        </span>
        {selected && <span style={{ color: accent }}>✦</span>}
      </div>

      <p className="text-parchment-500 text-xs mb-2 leading-relaxed">{subrace.description}</p>

      <div className="flex flex-wrap gap-1">
        {subrace.abilityBonuses.map(b => (
          <span
            key={b.ability}
            className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            {ABILITY_LABELS[b.ability].short} {formatBonus(b.value)}
          </span>
        ))}
        {subrace.traits.map(t => (
          <span
            key={t.name}
            className="px-1.5 py-0.5 rounded text-xs text-parchment-400 bg-parchment-900/60"
          >
            {t.name}
          </span>
        ))}
      </div>
    </button>
  )
}
