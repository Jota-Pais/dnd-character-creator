import { EMPTY_DRAFT, WIZARD_STEPS, STEP_LABELS } from './types/character'
import { isStepComplete } from './utils/draftValidation'
import { getOrigin } from './utils/originUtils'
import { getOrdemClass } from './utils/classUtils'
import { PrintableSheet } from './components/PrintableSheet'
import { OrdemApp } from './OrdemApp'
import type { IRpgSystem, StepConfig } from '../../core/types/system'
import type { OrdemCharacterDraft } from './types/character'
import { NameStep } from './components/steps/NameStep'
import { AttributesStep } from './components/steps/AttributesStep'
import { OriginStep } from './components/steps/OriginStep'
import { ClassStep } from './components/steps/ClassStep'
import { SkillsStep } from './components/steps/SkillsStep'
import { ProgressionStep } from './components/steps/ProgressionStep'
import { ParanormalPowersStep } from './components/steps/ParanormalPowersStep'
import { RitualsStep } from './components/steps/RitualsStep'
import { EquipmentStep } from './components/steps/EquipmentStep'
import { ReviewStep } from './components/steps/ReviewStep'

export const ordemSystem: IRpgSystem = {
  id: 'ordem',
  name: 'Ordem Paranormal',
  subtitle: 'RPG de investigação paranormal',
  getEmptyDraft: () => ({ ...EMPTY_DRAFT }),
  getSteps: (): StepConfig[] => {
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
  },
  PrintableSheet,
  formatDraftName: (draft: unknown) => {
    const d = draft as OrdemCharacterDraft
    const origin = d.origin ? getOrigin(d.origin) : undefined
    const cls = d.class ? getOrdemClass(d.class) : undefined
    const parts = [origin?.name, cls?.name].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : 'Agente incompleto'
  },
  Component: OrdemApp,
}
