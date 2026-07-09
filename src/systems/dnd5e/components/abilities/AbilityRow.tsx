import type { ReactNode } from 'react'
import type { AbilityScore } from '../../types/race'
import { ABILITY_LABELS, calculateModifier, formatModifier, formatBonus } from '../../utils/abilityScoreUtils'

type Props = {
  ability: AbilityScore
  baseScore: number | null
  racialBonus: number
  children: ReactNode
}

export function AbilityRow({ ability, baseScore, racialBonus, children }: Props) {
  const finalScore = baseScore !== null ? baseScore + racialBonus : null
  const mod = finalScore !== null ? calculateModifier(finalScore) : null
  const label = ABILITY_LABELS[ability]

  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-parchment-900/50 last:border-b-0">
      <div className="w-14 flex-shrink-0">
        <span className="text-parchment-200 font-bold text-sm font-fantasy block">{label.short}</span>
        <span className="text-parchment-700 text-xs">{label.long}</span>
      </div>

      <div className="flex-1 min-w-0">
        {children}
      </div>

      <div className="w-10 text-center flex-shrink-0">
        {racialBonus !== 0 ? (
          <span className="text-xs font-mono font-semibold" style={{ color: '#10b981' }}>
            {formatBonus(racialBonus)}
          </span>
        ) : (
          <span className="text-xs text-parchment-800">—</span>
        )}
      </div>

      <div className="w-9 text-center flex-shrink-0">
        {finalScore !== null ? (
          <span className="text-parchment-100 font-bold text-base font-fantasy">{finalScore}</span>
        ) : (
          <span className="text-parchment-800 text-base">—</span>
        )}
      </div>

      <div className="w-12 text-center flex-shrink-0">
        {mod !== null ? (
          <span
            className="text-sm font-bold font-mono px-1.5 py-0.5 rounded-md"
            style={{
              color: mod >= 0 ? '#d4900a' : '#f87171',
              backgroundColor: mod >= 0 ? '#d4900a15' : '#f8717115',
            }}
          >
            {formatModifier(mod)}
          </span>
        ) : (
          <span className="text-parchment-800 text-sm">—</span>
        )}
      </div>
    </div>
  )
}
