import { useState } from 'react'
import type { AbilityScore } from '../../types/race'
import type { BaseAbilityScores } from '../../types/character'
import { ALL_ABILITY_SCORES, rollAbilityScore } from '../../utils/abilityScoreUtils'
import { AbilityRow } from './AbilityRow'
import { AbilityTableHeader } from './AbilityTableHeader'

type RollEntry = {
  rolls: number[]
  result: number
}

type Props = {
  rolledValues: number[]
  scores: BaseAbilityScores
  racialBonuses: Record<AbilityScore, number>
  onRolledValues: (values: number[]) => void
  onScoreChange: (ability: AbilityScore, score: number | null) => void
}

export function RollPanel({ rolledValues, scores, racialBonuses, onRolledValues, onScoreChange }: Props) {
  const [entries, setEntries] = useState<(RollEntry | null)[]>(() => {
    if (rolledValues.length === 6) {
      return rolledValues.map(result => ({ rolls: [], result }))
    }
    return Array(6).fill(null) as null[]
  })

  const allRolled = entries.every(e => e !== null)

  function handleRoll(index: number) {
    const entry = rollAbilityScore()
    const next = [...entries]
    next[index] = entry
    setEntries(next)
    if (next.every(e => e !== null)) {
      onRolledValues(next.map(e => e!.result))
    }
  }

  function handleRollAll() {
    const next = Array.from({ length: 6 }, () => rollAbilityScore())
    setEntries(next)
    onRolledValues(next.map(e => e.result))
  }

  function handleRerollAll() {
    setEntries(Array(6).fill(null) as null[])
    onRolledValues([])
  }

  const rolledResults = entries.map(e => e?.result ?? null).filter((v): v is number => v !== null)

  function getPoolForAbility(ability: AbilityScore): number[] {
    const pool = [...rolledResults]
    for (const ab of ALL_ABILITY_SCORES) {
      if (ab === ability) continue
      const val = scores[ab]
      if (val !== null) {
        const idx = pool.indexOf(val)
        if (idx !== -1) pool.splice(idx, 1)
      }
    }
    return pool
  }

  function getUnassignedDisplay(): { val: number; used: boolean }[] {
    const assigned = ALL_ABILITY_SCORES.map(a => scores[a]).filter((v): v is number => v !== null)
    const sorted = [...rolledResults].sort((a, b) => b - a)
    const remaining = [...assigned]
    return sorted.map(val => {
      const idx = remaining.indexOf(val)
      if (idx !== -1) {
        remaining.splice(idx, 1)
        return { val, used: true }
      }
      return { val, used: false }
    })
  }

  if (!allRolled) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-parchment-500 text-sm">
            Role os 6 valores de atributo clicando nos botões abaixo.
          </p>
          <button
            onClick={handleRollAll}
            className="px-4 py-2 rounded-xl font-fantasy font-bold text-sm transition-all border"
            style={{ backgroundColor: '#d4900a15', color: '#d4900a', borderColor: '#d4900a40' }}
          >
            🎲 Rolar Tudo
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="rounded-xl border border-parchment-900 bg-parchment-950/60 p-3 text-center"
            >
              <p className="text-parchment-700 text-xs font-fantasy mb-2">Rolagem {index + 1}</p>
              {entry ? (
                <>
                  <p className="text-3xl font-bold font-fantasy mb-1" style={{ color: '#d4900a' }}>
                    {entry.result}
                  </p>
                  {entry.rolls.length > 0 && (
                    <div className="flex justify-center gap-1">
                      {[...entry.rolls].sort((a, b) => a - b).map((die, i) => {
                        const isDropped = i === 0
                        return (
                          <span
                            key={i}
                            className="w-6 h-6 rounded text-xs font-mono flex items-center justify-center"
                            style={{
                              backgroundColor: isDropped ? '#3a1010' : '#2a1f0e',
                              color: isDropped ? '#f87171' : '#c4a66a',
                              textDecoration: isDropped ? 'line-through' : 'none',
                            }}
                          >
                            {die}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleRoll(index)}
                  className="px-3 py-2 rounded-lg font-fantasy text-sm transition-all w-full"
                  style={{ backgroundColor: '#2a1f0e', color: '#c4a66a' }}
                >
                  🎲 Rolar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const display = getUnassignedDisplay()

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 flex-wrap">
          {display.map(({ val, used }, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-lg text-sm font-bold font-mono transition-all"
              style={{
                backgroundColor: used ? '#1a1007' : '#d4900a20',
                color: used ? '#5a3e24' : '#d4900a',
                textDecoration: used ? 'line-through' : 'none',
              }}
            >
              {val}
            </span>
          ))}
        </div>
        <button
          onClick={handleRerollAll}
          className="px-3 py-1.5 rounded-lg font-fantasy text-xs transition-all border border-parchment-800 text-parchment-500 hover:text-parchment-300 hover:border-parchment-600 ml-3 flex-shrink-0"
        >
          ↺ Rolar Novamente
        </button>
      </div>

      <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 overflow-hidden">
        <AbilityTableHeader />
        <div className="px-4">
          {ALL_ABILITY_SCORES.map(ability => {
            const current = scores[ability]
            const pool = getPoolForAbility(ability)

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
                  {[...new Set(pool)].sort((a, b) => b - a).map(val => (
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
