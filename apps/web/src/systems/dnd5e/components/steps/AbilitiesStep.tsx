import { useCharacterStore } from '../../stores/characterStore'
import { ALL_ABILITY_SCORES } from '@rpg/rules/systems/dnd5e/utils/abilityScoreUtils'
import { getRacialBonuses } from '@rpg/rules/systems/dnd5e/utils/asiUtils'
import { MethodSelector } from '../abilities/MethodSelector'
import { StandardArrayPanel } from '../abilities/StandardArrayPanel'
import { PointBuyPanel } from '../abilities/PointBuyPanel'
import { RollPanel } from '../abilities/RollPanel'
import { CustomPanel } from '../abilities/CustomPanel'
import { StepNav } from '../../../../components/wizard/StepNav'
import { formatPendingHint, getStepPendingReasons } from '@rpg/rules/systems/dnd5e/utils/pendingReasons'

const ACCENT = '#d4900a'

export function AbilitiesStep() {
  const draft = useCharacterStore(state => state.draft)
  const setAbilityMethod = useCharacterStore(state => state.setAbilityMethod)
  const setAbilityScore = useCharacterStore(state => state.setAbilityScore)
  const setRolledValues = useCharacterStore(state => state.setRolledValues)
  const nextStep = useCharacterStore(state => state.nextStep)
  const prevStep = useCharacterStore(state => state.prevStep)

  // Função compartilhada em vez de recalcular aqui: era o que fazia esta etapa esquecer o +1
  // do meio-talento do Humano Variante e divergir da Revisão.
  const racialBonuses = getRacialBonuses(draft)

  const hasAnyBonus = ALL_ABILITY_SCORES.some(a => racialBonuses[a] !== 0)

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
          {draft.abilityMethod === 'custom' && (
            <CustomPanel
              scores={draft.abilityScores}
              racialBonuses={racialBonuses}
              onScoreChange={setAbilityScore}
            />
          )}
        </div>
      )}

      <StepNav
        onPrev={prevStep}
        onNext={nextStep}
        accent={ACCENT}
        pendingReason={formatPendingHint(getStepPendingReasons(draft, 'abilities'))}
      />
    </div>
  )
}
