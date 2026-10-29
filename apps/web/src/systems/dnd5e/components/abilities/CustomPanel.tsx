import { useState } from 'react'
import type { AbilityScore } from '../../types/race'
import type { BaseAbilityScores } from '../../types/character'
import { ALL_ABILITY_SCORES, CUSTOM_MIN, CUSTOM_MAX, clampCustomScore } from '../../utils/abilityScoreUtils'
import { AbilityRow } from './AbilityRow'
import { AbilityTableHeader } from './AbilityTableHeader'

type Props = {
  scores: BaseAbilityScores
  racialBonuses: Record<AbilityScore, number>
  onScoreChange: (ability: AbilityScore, score: number) => void
}

export function CustomPanel({ scores, racialBonuses, onScoreChange }: Props) {
  const asNumbers = scores as Record<AbilityScore, number>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-xl border border-parchment-900 bg-parchment-950/60">
        <span className="text-parchment-500 text-sm font-fantasy">
          Digite o valor de cada atributo — de <strong className="text-parchment-300">{CUSTOM_MIN}</strong> a{' '}
          <strong className="text-parchment-300">{CUSTOM_MAX}</strong> (a faixa que os dados permitem na criação).
          Os bônus de raça entram por cima.
        </span>
      </div>

      <div className="rounded-xl border border-parchment-900 bg-parchment-950/60 overflow-hidden">
        <AbilityTableHeader />
        <div className="px-4">
          {ALL_ABILITY_SCORES.map(ability => (
            <AbilityRow
              key={ability}
              ability={ability}
              baseScore={asNumbers[ability] ?? 10}
              racialBonus={racialBonuses[ability]}
            >
              <ScoreInput
                value={asNumbers[ability] ?? 10}
                onCommit={score => onScoreChange(ability, score)}
              />
            </AbilityRow>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Input numérico editável (3–18) com +/−; comita o valor limitado ao sair do campo. */
function ScoreInput({ value, onCommit }: { value: number; onCommit: (score: number) => void }) {
  const [text, setText] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  // Sincroniza o campo quando o valor externo muda (ex.: botões +/−), sem useEffect
  // (padrão do React: ajustar estado durante o render — https://react.dev/learn/you-might-not-need-an-effect).
  if (value !== prevValue) {
    setPrevValue(value)
    setText(String(value))
  }

  function commit() {
    const parsed = Number(text)
    const next = clampCustomScore(Number.isNaN(parsed) ? value : parsed)
    setText(String(next))
    if (next !== value) onCommit(next)
  }

  const stepBtn = (delta: number, label: string, disabled: boolean) => (
    <button
      onClick={() => !disabled && onCommit(clampCustomScore(value + delta))}
      disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all select-none"
      style={{
        backgroundColor: disabled ? '#120c04' : '#2a1f0e',
        color: disabled ? '#3a2614' : '#c4a66a',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-1.5">
      {stepBtn(-1, '−', value <= CUSTOM_MIN)}
      <input
        type="number"
        inputMode="numeric"
        min={CUSTOM_MIN}
        max={CUSTOM_MAX}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-12 text-center rounded-lg bg-parchment-950 border border-parchment-800 text-parchment-200 font-bold font-mono text-sm py-1 outline-none focus:border-gold-600"
      />
      {stepBtn(1, '+', value >= CUSTOM_MAX)}
    </div>
  )
}
