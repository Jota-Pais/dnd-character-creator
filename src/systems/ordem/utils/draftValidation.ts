import type { OrdemCharacterDraft, WizardStep } from '../types/character'
import { EMPTY_DRAFT, WIZARD_STEPS } from '../types/character'
import { isValidAttributes } from './attributeUtils'
import { getOrigin } from './originUtils'
import { getOrdemClass } from './classUtils'
import {
  getRequiredFreeSkillCount,
  getRequiredPowerSlots,
  getRequiredAttributeIncreaseSlots,
  getRequiredSkillGradeSlots,
} from './characterUtils'
import { hasTrilha, hasVersatility } from './progressionUtils'
import { isRitualStepComplete } from './ritualUtils'
import { isEquipmentStepComplete } from './equipmentUtils'
import { isValidPatente } from './patenteUtils'

function countFilled(arr: (string | null)[], required: number): boolean {
  return arr.slice(0, required).filter(Boolean).length === required
}

export function isStepComplete(draft: OrdemCharacterDraft, step: WizardStep): boolean {
  switch (step) {
    case 'name':
      return draft.name.trim().length > 0

    case 'attributes':
      return isValidAttributes(draft.attributes)

    case 'origin': {
      if (!draft.origin) return false
      const origin = getOrigin(draft.origin)
      if (!origin) return false
      // Amnésico não tem perícias fixas — o jogador precisa escolher 2 no lugar do mestre.
      if (origin.skillProficiencies.length === 0) return draft.originGmSkillChoices.length === 2
      return true
    }

    case 'class':
      return draft.class !== null

    case 'skills': {
      if (!draft.class) return false
      const cls = getOrdemClass(draft.class)
      if (!cls) return false
      const groupsFilled = draft.classChoiceGroupPicks.length === cls.skills.choiceGroups.length
        && draft.classChoiceGroupPicks.every(pick => Boolean(pick))
      const freeCount = getRequiredFreeSkillCount(draft, cls)
      return groupsFilled && draft.classFreeSkillChoices.length === freeCount
    }

    case 'progression': {
      if (!draft.class) return false
      const cls = getOrdemClass(draft.class)
      if (!cls) return false

      if (hasTrilha(draft.nex) && !draft.trilha) return false

      const requiredPowers = getRequiredPowerSlots(draft.nex)
      if (!countFilled(draft.powerChoices, requiredPowers)) return false

      const requiredAttrIncreases = getRequiredAttributeIncreaseSlots(draft.nex)
      if (!countFilled(draft.attributeIncreaseChoices, requiredAttrIncreases)) return false

      const requiredGradeSlots = getRequiredSkillGradeSlots(draft.nex)
      const gradeSlotsFilled = draft.skillGradeChoices.slice(0, requiredGradeSlots)
        .filter(slot => Array.isArray(slot) && slot.length === cls.skillGradeCount + draft.attributes.intellect).length
      if (gradeSlotsFilled !== requiredGradeSlots) return false

      if (hasVersatility(draft.nex) && !draft.versatilityChoice) return false

      return true
    }

    case 'rituals': {
      if (draft.class !== 'occultist') return true
      return isRitualStepComplete(draft.nex, draft.class, draft.ritualChoices, draft.ritualElementChoices)
    }

    case 'equipment':
      return isEquipmentStepComplete(draft)

    case 'review':
      return WIZARD_STEPS.filter(s => s !== 'review').every(s => isStepComplete(draft, s))

    default:
      return false
  }
}

export function getFirstIncompleteStep(draft: OrdemCharacterDraft): WizardStep {
  return WIZARD_STEPS.find(s => s !== 'review' && !isStepComplete(draft, s)) ?? 'review'
}

/** Valida estruturalmente um JSON importado; devolve null se não parecer uma ficha de Ordem Paranormal. */
export function sanitizeImportedDraft(parsed: unknown): OrdemCharacterDraft | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Partial<OrdemCharacterDraft>
  if (typeof p.name !== 'string') return null
  if (!p.attributes || typeof p.attributes !== 'object') return null

  return {
    ...EMPTY_DRAFT,
    name: p.name,
    concept: typeof p.concept === 'string' ? p.concept : '',
    nex: typeof p.nex === 'number' ? p.nex : EMPTY_DRAFT.nex,
    attributes: { ...EMPTY_DRAFT.attributes, ...p.attributes },
    origin: typeof p.origin === 'string' ? p.origin : null,
    originGmSkillChoices: Array.isArray(p.originGmSkillChoices) ? p.originGmSkillChoices : [],
    class: p.class === 'combatant' || p.class === 'specialist' || p.class === 'occultist' ? p.class : null,
    classChoiceGroupPicks: Array.isArray(p.classChoiceGroupPicks) ? p.classChoiceGroupPicks : [],
    classFreeSkillChoices: Array.isArray(p.classFreeSkillChoices) ? p.classFreeSkillChoices : [],
    trilha: typeof p.trilha === 'string' ? p.trilha : null,
    powerChoices: Array.isArray(p.powerChoices) ? p.powerChoices : [],
    attributeIncreaseChoices: Array.isArray(p.attributeIncreaseChoices) ? p.attributeIncreaseChoices : [],
    skillGradeChoices: Array.isArray(p.skillGradeChoices) ? p.skillGradeChoices : [],
    versatilityChoice: p.versatilityChoice ?? null,
    ritualChoices: Array.isArray(p.ritualChoices) ? p.ritualChoices : [],
    ritualElementChoices: p.ritualElementChoices && typeof p.ritualElementChoices === 'object' && !Array.isArray(p.ritualElementChoices)
      ? p.ritualElementChoices
      : {},
    patente: isValidPatente(p.patente) ? p.patente : 'recruta',
    equipmentChoices: Array.isArray(p.equipmentChoices) ? p.equipmentChoices : [],
  }
}
