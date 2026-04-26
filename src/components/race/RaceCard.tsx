import type { Race } from '../../types/race'
import { ABILITY_LABELS, formatBonus } from '../../utils/abilityScoreUtils'

type Props = {
  race: Race
  selected: boolean
  onSelect: () => void
}

const SIZE_LABEL: Record<string, string> = {
  Small: 'Pequeno',
  Medium: 'Médio',
  Large: 'Grande',
}

export function RaceCard({ race, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={[
        'w-full text-left p-4 rounded-xl border-2 transition-all duration-150',
        selected
          ? 'border-amber-500 bg-stone-800 shadow-lg shadow-amber-900/20'
          : 'border-stone-700 bg-stone-900 hover:border-stone-500 hover:bg-stone-800',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-bold text-stone-100 text-base leading-tight">{race.name}</span>
        {selected && <span className="text-amber-500 text-sm shrink-0">✓</span>}
      </div>

      <p className="text-stone-400 text-xs leading-relaxed mb-3 line-clamp-2">{race.description}</p>

      <div className="flex flex-wrap gap-1 mb-2">
        {race.abilityBonuses.map(b => (
          <span
            key={b.ability}
            className="px-1.5 py-0.5 bg-amber-900/40 text-amber-400 text-xs font-mono rounded"
          >
            {ABILITY_LABELS[b.ability].short} {formatBonus(b.value)}
          </span>
        ))}
        {race.choices.some(c => c.kind === 'ability') && (
          <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-400 text-xs font-mono rounded">
            +1 à escolha
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-stone-500">
        <span>{SIZE_LABEL[race.size] ?? race.size}</span>
        <span>·</span>
        <span>{race.speed} pés</span>
        {race.darkvision > 0 && (
          <>
            <span>·</span>
            <span>Vis. {race.darkvision} pés</span>
          </>
        )}
      </div>
    </button>
  )
}
