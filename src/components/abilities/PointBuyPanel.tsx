import type { AbilityScore } from '../../types/race'
import type { BaseAbilityScores } from '../../types/character'
import {
  ALL_ABILITY_SCORES,
  POINT_BUY_TOTAL,
  getPointBuyCost,
  getTotalPointsSpent,
} from '../../utils/abilityScoreUtils'
import { AbilityRow } from './AbilityRow'
import { AbilityTableHeader } from './AbilityTableHeader'

type Props = {
  scores: BaseAbilityScores
  racialBonuses: Record<AbilityScore, number>
  onScoreChange: (ability: AbilityScore, score: number) => void
}

export function PointBuyPanel({ scores, racialBonuses, onScoreChange }: Props) {
  const asNumbers = scores as Record<AbilityScore, number>
  const spent = getTotalPointsSpent(asNumbers)
  const remaining = POINT_BUY_TOTAL - spent
  const progress = (spent / POINT_BUY_TOTAL) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-xl border border-parchment-900 bg-parchment-950/60">
        <span className="text-parchment-500 text-sm font-fantasy">Pontos restantes</span>
        <span
          className="text-2xl font-bold font-fantasy"
          style={{ color: remaining === 0 ? '#d4900a' : remaining <= 5 ? '#fb923c' : '#c4a66a' }}
        >
          {remaining}
        </span>
        <span className="text-parchment-700 text-sm">/ {POINT_BUY_TOTAL}</span>
        <div className="ml-auto w-28 h-1.5 rounded-full overflow-hidden bg-parchment-900">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${progress}%`,
              backgroundColor: remaining === 0 ? '#d4900a' : '#c4a66a',
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 overflow-hidden">
        <AbilityTableHeader />
        <div className="px-4">
          {ALL_ABILITY_SCORES.map(ability => {
            const current = asNumbers[ability] ?? 8
            const costIncrease = getPointBuyCost(current + 1) - getPointBuyCost(current)
            const canIncrease = current < 15 && remaining >= costIncrease
            const canDecrease = current > 8

            return (
              <AbilityRow
                key={ability}
                ability={ability}
                baseScore={current}
                racialBonus={racialBonuses[ability]}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => canDecrease && onScoreChange(ability, current - 1)}
                    disabled={!canDecrease}
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all select-none"
                    style={{
                      backgroundColor: canDecrease ? '#2a1f0e' : '#120c04',
                      color: canDecrease ? '#c4a66a' : '#3a2614',
                      cursor: canDecrease ? 'pointer' : 'not-allowed',
                    }}
                  >
                    −
                  </button>
                  <span className="text-parchment-200 font-bold font-mono text-sm w-5 text-center">
                    {current}
                  </span>
                  <button
                    onClick={() => canIncrease && onScoreChange(ability, current + 1)}
                    disabled={!canIncrease}
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all select-none"
                    style={{
                      backgroundColor: canIncrease ? '#2a1f0e' : '#120c04',
                      color: canIncrease ? '#c4a66a' : '#3a2614',
                      cursor: canIncrease ? 'pointer' : 'not-allowed',
                    }}
                  >
                    +
                  </button>
                  <span className="text-parchment-800 text-xs ml-1">
                    {getPointBuyCost(current)} pts
                  </span>
                </div>
              </AbilityRow>
            )
          })}
        </div>
      </div>
    </div>
  )
}
