import type { Race } from '../../types/race'
import { ABILITY_LABELS, formatBonus } from '../../utils/abilityScoreUtils'
import { RACE_PRESENTATION } from '../../utils/raceUtils'

type Props = {
  race: Race
  selected: boolean
  onSelect: () => void
}

export function RaceCard({ race, selected, onSelect }: Props) {
  const presentation = RACE_PRESENTATION[race.id]
  const accent = presentation?.accent ?? '#d4900a'
  const emoji = presentation?.emoji ?? '⚔️'

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden group"
      style={{
        borderColor: selected ? accent : 'rgba(90, 62, 36, 0.6)',
        backgroundColor: selected ? 'rgba(30, 22, 12, 0.95)' : 'rgba(20, 14, 6, 0.8)',
        boxShadow: selected ? `0 0 20px ${accent}25, 0 4px 12px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Faixa superior colorida */}
      <div
        className="h-1 w-full opacity-80"
        style={{ backgroundColor: accent }}
      />

      <div className="p-4">
        {/* Emoji + nome */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{emoji}</span>
          <div>
            <h3 className="font-fantasy font-bold text-parchment-200 text-base leading-tight">
              {race.name}
            </h3>
            <span className="text-xs text-parchment-600">
              {race.size === 'Small' ? 'Tamanho Pequeno' : 'Tamanho Médio'}
            </span>
          </div>
          {selected && (
            <span className="ml-auto text-lg" style={{ color: accent }}>✦</span>
          )}
        </div>

        <p className="text-parchment-500 text-xs leading-relaxed mb-3 line-clamp-2">
          {race.description}
        </p>

        {/* Bônus */}
        <div className="flex flex-wrap gap-1 mb-2">
          {race.abilityBonuses.map(b => (
            <span
              key={b.ability}
              className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              {ABILITY_LABELS[b.ability].short} {formatBonus(b.value)}
            </span>
          ))}
          {race.choices.some(c => c.kind === 'ability') && (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              +1 à escolha
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-parchment-700">
          <span>🏃 {race.speed} pés</span>
          {race.darkvision > 0 && <span>· 👁️ {race.darkvision} pés</span>}
          {race.subraces.length > 0 && (
            <span className="ml-auto text-parchment-800">
              {race.subraces.length} subraças
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
