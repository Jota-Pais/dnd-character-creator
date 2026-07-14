import { EMPTY_DRAFT, WIZARD_STEPS, STEP_LABELS } from './types/character';
import { isStepComplete } from './utils/draftValidation';
import { PrintableSheet } from './components/PrintableSheet';
import { Dnd5eApp } from './Dnd5eApp';
import { getRace } from './utils/raceUtils';
import { getClass } from './utils/classUtils';
import type { IRpgSystem, StepConfig } from '../../core/types/system';
import type { CharacterDraft } from './types/character';
import { NameStep } from './components/steps/NameStep';
import { RaceStep } from './components/steps/RaceStep';
import { ClassStep } from './components/steps/ClassStep';
import { SpellStep } from './components/steps/SpellStep';
import { AbilitiesStep } from './components/steps/AbilitiesStep';
import { ImprovementsStep } from './components/steps/ImprovementsStep';
import { BackgroundStep } from './components/steps/BackgroundStep';
import { EquipmentStep } from './components/steps/EquipmentStep';
import { ReviewStep } from './components/steps/ReviewStep';

export const dnd5eSystem: IRpgSystem = {
  id: 'dnd5e',
  name: 'D&D 5e',
  subtitle: 'PHB 2014',
  getEmptyDraft: () => ({ ...EMPTY_DRAFT }),
  getSteps: (): StepConfig[] => {
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
  },
  PrintableSheet: PrintableSheet,
  formatDraftName: (draft: unknown) => {
    const dndDraft = draft as CharacterDraft;
    const race = dndDraft.race ? getRace(dndDraft.race) : undefined;
    const classNames = [
      ...(dndDraft.class ? [getClass(dndDraft.class)?.name] : []),
      ...(dndDraft.additionalClasses ?? []).map(c => getClass(c.classId)?.name),
    ].filter(Boolean);
    const classLabel = classNames.length > 0 ? classNames.join('/') : null;
    const parts = [race?.name, classLabel].filter(Boolean);
    return parts.length > 0
      ? `${parts.join(' · ')} — nível ${dndDraft.level ?? 1}`
      : `Nível ${dndDraft.level ?? 1}`;
  },
  Component: Dnd5eApp,
};
