import { WIZARD_STEPS, STEP_LABELS } from '@rpg/rules/systems/ordem/types/character'
import { isStepComplete } from '@rpg/rules/systems/ordem/utils/draftValidation'
import type { StepConfig } from '../system'
import type { OrdemCharacterDraft } from '@rpg/rules/systems/ordem/types/character'
import { NameStep } from './creator/steps/NameStep'
import { AttributesStep } from './creator/steps/AttributesStep'
import { OriginStep } from './creator/steps/OriginStep'
import { ClassStep } from './creator/steps/ClassStep'
import { SkillsStep } from './creator/steps/SkillsStep'
import { ProgressionStep } from './creator/steps/ProgressionStep'
import { ParanormalPowersStep } from './creator/steps/ParanormalPowersStep'
import { RitualsStep } from './creator/steps/RitualsStep'
import { EquipmentStep } from './creator/steps/EquipmentStep'
import { ReviewStep } from './creator/steps/ReviewStep'

/**
 * As etapas do criador, com a tela de cada uma. Só o OrdemApp as usa, e elas descem com ele, sob
 * demanda (core/utils/lazyScreen.ts): fora do `index.ts`, que a galeria carrega na abertura.
 */
export function getSteps(): StepConfig[] {
  return WIZARD_STEPS.map((id) => {
    let component
    switch (id) {
      case 'name': component = NameStep; break
      case 'attributes': component = AttributesStep; break
      case 'origin': component = OriginStep; break
      case 'class': component = ClassStep; break
      case 'skills': component = SkillsStep; break
      case 'progression': component = ProgressionStep; break
      case 'paranormal': component = ParanormalPowersStep; break
      case 'rituals': component = RitualsStep; break
      case 'equipment': component = EquipmentStep; break
      case 'review': component = ReviewStep; break
      default: throw new Error(`Unknown step id: ${id}`)
    }
    return {
      id,
      title: STEP_LABELS[id],
      component,
      isComplete: (draft) => isStepComplete(draft as OrdemCharacterDraft, id),
    }
  })
}
