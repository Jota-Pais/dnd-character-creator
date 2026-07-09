import { useCharacterStore } from '../../stores/characterStore'
import { getRace, getSubrace, getEffectiveAbilityBonuses } from '../../utils/raceUtils'
import { ALL_ABILITY_SCORES, isAbilitiesStepComplete } from '../../utils/abilityScoreUtils'
import type { AbilityScore } from '../../types/race'
import { MethodSelector } from '../abilities/MethodSelector'
import { StandardArrayPanel } from '../abilities/StandardArrayPanel'
import { PointBuyPanel } from '../abilities/PointBuyPanel'
import { RollPanel } from '../abilities/RollPanel'

const ACCENT = '#d4900a'

export function AbilitiesStep() {
  const draft = useCharacterStore(state => state.draft)
  const setAbilityMethod = useCharacterStore(state => state.setAbilityMethod)
  const setAbilityScore = useCharacterStore(state => state.setAbilityScore)
  const setRolledValues = useCharacterStore(state => state.setRolledValues)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  const race = draft.race ? getRace(draft.race) : undefined
  const subrace = race && draft.subrace ? getSubrace(race, draft.subrace) : null

  const racialBonuses: Record<AbilityScore, number> = {
    STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0,
  }
  if (race) {
    for (const bonus of getEffectiveAbilityBonuses(race, subrace ?? null, draft.raceChoices)) {
      racialBonuses[bonus.ability] += bonus.value
    }
  }

  const hasAnyBonus = ALL_ABILITY_SCORES.some(a => racialBonuses[a] !== 0)

  const canAdvance = isAbilitiesStepComplete(
    draft.abilityMethod,
    draft.abilityScores,
    draft.rolledValues,
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-fantasy text-2xl font-bold text-parchment-200 mb-1">
          Defina seus atributos
        </h2>
        <p className="text-parchment-500 text-sm">
          Os 6 atributos fundamentais definem as capacidades físicas e mentais do seu personagem.
          {hasAnyBonus && (
            <span className="text-parchment-600"> Os bônus da sua raça serão aplicados automaticamente.</span>
          )}
        </p>
      </div>

      <MethodSelector selected={draft.abilityMethod} onSelect={setAbilityMethod} />

      {draft.abilityMethod && (
        <div>
          {draft.abilityMethod === 'standard-array' && (
            <StandardArrayPanel
              scores={draft.abilityScores}
              racialBonuses={racialBonuses}
              onScoreChange={setAbilityScore}
            />
          )}
          {draft.abilityMethod === 'point-buy' && (
            <PointBuyPanel
              scores={draft.abilityScores}
              racialBonuses={racialBonuses}
              onScoreChange={(ability, score) => setAbilityScore(ability, score)}
            />
          )}
          {draft.abilityMethod === 'roll' && (
            <RollPanel
              rolledValues={draft.rolledValues}
              scores={draft.abilityScores}
              racialBonuses={racialBonuses}
              onRolledValues={setRolledValues}
              onScoreChange={setAbilityScore}
            />
          )}
        </div>
      )}

      {/* Navegação — mobile (fixo no rodapé) */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-parchment-900 px-4 py-3 flex justify-between items-center lg:hidden"
        style={{ backgroundColor: '#0a0704ee', backdropFilter: 'blur(8px)' }}
      >
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors text-sm font-fantasy"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
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

      {/* Navegação — desktop (inline no rodapé do conteúdo) */}
      <div className="hidden lg:flex justify-between items-center pt-4 border-t border-parchment-900 mt-2">
        <button
          onClick={prevStep}
          className="px-4 py-2 text-parchment-500 hover:text-parchment-300 transition-colors font-fantasy text-sm"
        >
          ← Voltar
        </button>
        <button
          onClick={nextStep}
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
    </div>
  )
}
