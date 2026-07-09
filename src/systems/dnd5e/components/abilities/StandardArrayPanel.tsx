import type { AbilityScore } from '../../types/race'
import type { BaseAbilityScores } from '../../types/character'
import { ALL_ABILITY_SCORES, STANDARD_ARRAY } from '../../utils/abilityScoreUtils'
import { AbilityRow } from './AbilityRow'
import { AbilityTableHeader } from './AbilityTableHeader'

type Props = {
  scores: BaseAbilityScores
  racialBonuses: Record<AbilityScore, number>
  onScoreChange: (ability: AbilityScore, score: number | null) => void
}

export function StandardArrayPanel({ scores, racialBonuses, onScoreChange }: Props) {
  const assignedValues = ALL_ABILITY_SCORES
    .map(a => scores[a])
    .filter((v): v is number => v !== null)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[...STANDARD_ARRAY].map(val => {
          const used = assignedValues.includes(val)
          return (
            <span
              key={val}
              className="px-3 py-1 rounded-lg text-sm font-bold font-mono transition-all"
              style={{
                backgroundColor: used ? '#1a1007' : '#d4900a20',
                color: used ? '#5a3e24' : '#d4900a',
                textDecoration: used ? 'line-through' : 'none',
              }}
            >
              {val}
            </span>
          )
        })}
      </div>

      <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 overflow-hidden">
        <AbilityTableHeader />
        <div className="px-4">
          {ALL_ABILITY_SCORES.map(ability => {
            const current = scores[ability]
            const otherAssigned = ALL_ABILITY_SCORES
              .filter(a => a !== ability)
              .map(a => scores[a])
              .filter((v): v is number => v !== null)

            const pool = [...STANDARD_ARRAY].filter(val => {
              if (val === current) return true
              const countInPool = STANDARD_ARRAY.filter(v => v === val).length
              const countUsed = otherAssigned.filter(v => v === val).length
              return countUsed < countInPool
            })

            return (
              <AbilityRow
                key={ability}
                ability={ability}
                baseScore={current}
                racialBonus={racialBonuses[ability]}
              >
                <select
                  value={current ?? ''}
                  onChange={e => onScoreChange(ability, e.target.value ? Number(e.target.value) : null)}
                  className="w-full text-parchment-200 text-sm border border-parchment-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-parchment-600 transition-colors"
                  style={{ backgroundColor: '#1a1007' }}
                >
                  <option value="">— escolha —</option>
                  {pool.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </AbilityRow>
            )
          })}
        </div>
      </div>
    </div>
  )
}
