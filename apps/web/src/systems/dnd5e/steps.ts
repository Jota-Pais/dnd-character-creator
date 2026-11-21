import { WIZARD_STEPS, STEP_LABELS } from '@rpg/rules/systems/dnd5e/types/character';
import { isStepComplete } from '@rpg/rules/systems/dnd5e/utils/draftValidation';
import type { StepConfig } from '../system';
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character';
import { NameStep } from './creator/steps/NameStep';
import { RaceStep } from './creator/steps/RaceStep';
import { ClassStep } from './creator/steps/ClassStep';
import { SpellStep } from './creator/steps/SpellStep';
import { AbilitiesStep } from './creator/steps/AbilitiesStep';
import { ImprovementsStep } from './creator/steps/ImprovementsStep';
import { BackgroundStep } from './creator/steps/BackgroundStep';
import { EquipmentStep } from './creator/steps/EquipmentStep';
import { ReviewStep } from './creator/steps/ReviewStep';

/**
 * As etapas do criador, com a tela de cada uma. Só o Dnd5eApp as usa: fora do contrato do sistema,
 * como no Ordem, onde elas descem sob demanda com o criador (systems/ordem/steps.ts).
 */
export function getSteps(): StepConfig[] {
  return WIZARD_STEPS.map((id) => {
    let component;
    switch (id) {
      case 'name': component = NameStep; break;
      case 'race': component = RaceStep; break;
      case 'class': component = ClassStep; break;
      case 'spells': component = SpellStep; break;
      case 'abilities': component = AbilitiesStep; break;
      case 'improvements': component = ImprovementsStep; break;
      case 'background': component = BackgroundStep; break;
      case 'equipment': component = EquipmentStep; break;
      case 'review': component = ReviewStep; break;
      default: throw new Error(`Unknown step id: ${id}`);
    }
    return {
      id,
      title: STEP_LABELS[id],
      component,
      isComplete: (draft) => isStepComplete(draft as CharacterDraft, id)
    };
  });
}
