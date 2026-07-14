import { useState } from 'react'
import { useCharacterStore } from '../../stores/characterStore'
import type { AbilityScore } from '../../types/race'
import type { AsiChoice } from '../../types/character'
import { ABILITY_LABELS, ALL_ABILITY_SCORES, calculateModifier, formatModifier } from '../../utils/abilityScoreUtils'
import {
  getReachedAsiLevels,
  getRacialBonuses,
  getAsiBonuses,
  getFinalAbilityScores,
  isImprovementsStepComplete,
  isAsiChoiceComplete,
} from '../../utils/asiUtils'
import { getAllFeats, getFeat } from '../../utils/featUtils'
import { getClass } from '../../utils/classUtils'
import { getPrimaryLevel } from '../../utils/multiclassUtils'

const ACCENT = '#c0961a'
type Mode = 'plus2' | 'split' | 'feat'

export function ImprovementsStep() {
  const draft = useCharacterStore(state => state.draft)
  const setAsiChoice = useCharacterStore(state => state.setAsiChoice)
  const setAdditionalAsiChoice = useCharacterStore(state => state.setAdditionalAsiChoice)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const finalScores = getFinalAbilityScores(draft)
  const canAdvance = isImprovementsStepComplete(draft)
  const racial = getRacialBonuses(draft)

  // Uma trilha de ASI por classe: a primária (nível derivado) + cada classe adicional no nível dela.
  const primaryLevel = getPrimaryLevel(draft)
  const groups = [
    ...(draft.class ? [{ key: 'primary', classId: draft.class, level: primaryLevel, choices: draft.asiChoices, set: setAsiChoice }] : []),
    ...draft.additionalClasses.map(e => ({
      key: e.classId, classId: e.classId, level: e.level, choices: e.asiChoices,
      set: (i: number, c: AsiChoice | null) => setAdditionalAsiChoice(e.classId, i, c),
    })),
  ]
  const multi = groups.length > 1

  // Slots achatados para o preview do teto de 20 (soma de TODAS as escolhas, menos a que se edita).
  const flat: { gi: number; slot: number; choice: AsiChoice | undefined }[] = []
  groups.forEach((g, gi) => getReachedAsiLevels(g.classId, g.level).forEach((_, slot) => flat.push({ gi, slot, choice: g.choices[slot] })))

  if (flat.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-3">Aprimoramentos</h2>
        <div className="rounded-2xl border-2 border-dashed border-parchment-800 p-8 mb-8">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-parchment-400 leading-relaxed">
            Seu personagem ainda não alcançou um nível de Incremento no Valor de Habilidade.
            As classes ganham o primeiro no <strong className="text-parchment-200">nível 4</strong>
            {' '}(guerreiro no 6, ladino no 10).
          </p>
        </div>
        <StepNav canAdvance onPrev={prevStep} onNext={nextStep} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1 text-center">Aprimoramentos</h2>
      <p className="text-parchment-500 text-sm mb-6 text-center">
        A cada Incremento no Valor de Habilidade, aumente <strong>um atributo em +2</strong> ou{' '}
        <strong>dois atributos em +1</strong> (máximo de 20 em cada).
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {ALL_ABILITY_SCORES.map(ab => (
          <div key={ab} className="rounded-lg border border-parchment-800 bg-parchment-950 p-2 text-center">
            <p className="text-xs font-fantasy text-parchment-600 uppercase">{ABILITY_LABELS[ab].short}</p>
            <p className="text-lg font-bold font-fantasy" style={{ color: ACCENT }}>{finalScores[ab]}</p>
            <p className="text-xs text-parchment-600">{formatModifier(calculateModifier(finalScores[ab]))}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {groups.map((g, gi) => {
          const reached = getReachedAsiLevels(g.classId, g.level)
          if (reached.length === 0) return null
          return (
            <div key={g.key}>
              {multi && (
                <p className="text-xs font-fantasy text-parchment-500 uppercase tracking-widest mb-2">
                  {getClass(g.classId)?.name ?? g.classId} · nível {g.level}
                </p>
              )}
              <div className="space-y-4">
                {reached.map((asiLevel, slot) => (
                  <AsiSlot
                    key={slot}
                    asiLevel={asiLevel}
                    choice={g.choices[slot]}
                    baseScore={ab => draft.abilityScores[ab] ?? 10}
                    otherBonuses={getAsiBonuses(flat.filter(f => !(f.gi === gi && f.slot === slot)).map(f => f.choice).filter((c): c is AsiChoice => Boolean(c)))}
                    racial={racial}
                    onChange={c => g.set(slot, c)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <StepNav canAdvance={canAdvance} onPrev={prevStep} onNext={nextStep} />
    </div>
  )
}

type AsiSlotProps = {
  asiLevel: number
  choice: AsiChoice | undefined
  baseScore: (ab: AbilityScore) => number
  otherBonuses: Record<AbilityScore, number>
  racial: Record<AbilityScore, number>
  onChange: (choice: AsiChoice) => void
}

function AsiSlot({ asiLevel, choice, baseScore, otherBonuses, racial, onChange }: AsiSlotProps) {
  const asi = choice?.kind === 'asi' ? choice : undefined
  const initialMode: Mode =
    choice?.kind === 'feat'
      ? 'feat'
      : asi && asi.abilities.length === 2 && asi.abilities[0] === asi.abilities[1]
        ? 'plus2'
        : 'split'
  const [mode, setMode] = useState<Mode>(initialMode)

  const selected = asi?.abilities ?? []
  const complete = isAsiChoiceComplete(choice)
  const scoreWithout = (ab: AbilityScore) => baseScore(ab) + racial[ab] + otherBonuses[ab]

  function changeMode(next: Mode) {
    setMode(next)
    if (next === 'feat') onChange({ kind: 'feat', featId: '' })
    else onChange({ kind: 'asi', abilities: [] })
  }

  function pick(ab: AbilityScore) {
    if (mode === 'plus2') {
      onChange({ kind: 'asi', abilities: [ab, ab] })
      return
    }
    const distinct = [...new Set(selected)]
    let next: AbilityScore[]
    if (distinct.includes(ab)) next = distinct.filter(a => a !== ab)
    else if (distinct.length >= 2) return
    else next = [...distinct, ab]
    onChange({ kind: 'asi', abilities: next })
  }

  const featChoice = choice?.kind === 'feat' ? choice : undefined
  const selectedFeat = featChoice?.featId ? getFeat(featChoice.featId) : undefined
  const halfOptions = selectedFeat?.abilityIncrease ?? []

  return (
    <div
      className="rounded-xl border-2 p-4"
      style={{ borderColor: complete ? `${ACCENT}60` : 'rgba(90,62,36,0.5)', backgroundColor: complete ? `${ACCENT}08` : 'transparent' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-fantasy font-bold text-parchment-200">Incremento — Nível {asiLevel}</span>
        {!complete && <span className="text-red-500 text-xs">pendente</span>}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <ModeButton active={mode === 'plus2'} onClick={() => changeMode('plus2')}>+2 em um atributo</ModeButton>
        <ModeButton active={mode === 'split'} onClick={() => changeMode('split')}>+1 em dois atributos</ModeButton>
        <ModeButton active={mode === 'feat'} onClick={() => changeMode('feat')}>Talento</ModeButton>
      </div>

      {mode === 'feat' ? (
        <div>
          <select
            value={featChoice?.featId ?? ''}
            onChange={e => onChange({ kind: 'feat', featId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border text-parchment-200 text-sm bg-parchment-950 mb-2"
            style={{ borderColor: featChoice?.featId ? ACCENT : 'rgba(90,62,36,0.6)' }}
          >
            <option value="">— escolha um talento —</option>
            {getAllFeats().map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          {selectedFeat && (
            <>
              {selectedFeat.prerequisite && (
                <p className="text-xs text-gold-600 mb-1">Pré-requisito: {selectedFeat.prerequisite}</p>
              )}
              <p className="text-xs text-parchment-500 leading-relaxed whitespace-pre-line mb-2">
                {selectedFeat.description}
              </p>
              {halfOptions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-parchment-300 mb-1">
                    +1 no atributo (parte do talento):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {halfOptions.map(ab => {
                      const isSel = featChoice?.abilities?.[0] === ab
                      const wouldExceed = !isSel && scoreWithout(ab) + 1 > 20
                      return (
                        <button
                          key={ab}
                          onClick={() => { if (!wouldExceed) onChange({ kind: 'feat', featId: featChoice!.featId, abilities: [ab] }) }}
                          disabled={wouldExceed}
                          title={wouldExceed ? 'Excederia o máximo de 20' : undefined}
                          className="px-2 py-1 rounded-lg border text-xs font-semibold font-fantasy"
                          style={{
                            borderColor: isSel ? ACCENT : 'rgba(58,38,20,0.6)',
                            backgroundColor: isSel ? `${ACCENT}20` : 'transparent',
                            color: isSel ? ACCENT : wouldExceed ? '#4a3520' : '#b8946f',
                            cursor: wouldExceed ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {ABILITY_LABELS[ab].short}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {ALL_ABILITY_SCORES.map(ab => {
            const isSel = selected.includes(ab)
            const projected = mode === 'plus2' ? scoreWithout(ab) + 2 : scoreWithout(ab) + 1
            const wouldExceed = !isSel && projected > 20
            const disabled = wouldExceed || (mode === 'split' && !isSel && new Set(selected).size >= 2)
            return (
              <button
                key={ab}
                onClick={() => { if (!disabled) pick(ab) }}
                disabled={disabled}
                title={wouldExceed ? 'Excederia o máximo de 20' : undefined}
                className="px-2 py-1.5 rounded-lg border text-xs font-semibold font-fantasy transition-all"
                style={{
                  borderColor: isSel ? ACCENT : 'rgba(58,38,20,0.6)',
                  backgroundColor: isSel ? `${ACCENT}20` : 'transparent',
                  color: isSel ? ACCENT : disabled ? '#4a3520' : '#b8946f',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {ABILITY_LABELS[ab].short}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-3 py-2 rounded-lg border text-xs font-fantasy font-semibold transition-all"
      style={{
        borderColor: active ? ACCENT : 'rgba(90,62,36,0.5)',
        backgroundColor: active ? `${ACCENT}18` : 'transparent',
        color: active ? ACCENT : '#9a7650',
      }}
    >
      {children}
    </button>
  )
}

function StepNav({ canAdvance, onPrev, onNext }: { canAdvance: boolean; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex justify-between items-center mt-8">
      <button onClick={onPrev} className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors text-sm font-fantasy">
        ← Voltar
      </button>
      <button
        onClick={onNext}
        disabled={!canAdvance}
        className="px-6 py-2 rounded-xl font-fantasy font-bold text-sm tracking-wide transition-all"
        style={{
          backgroundColor: canAdvance ? ACCENT : '#3a2614',
          color: canAdvance ? '#0a0704' : '#5a3e24',
          cursor: canAdvance ? 'pointer' : 'not-allowed',
        }}
      >
        Continuar ✦
      </button>
    </div>
  )
}
