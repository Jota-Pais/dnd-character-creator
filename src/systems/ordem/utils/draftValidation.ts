import type { OrdemCharacterDraft, WizardStep } from '../types/character'
import { EMPTY_DRAFT, WIZARD_STEPS } from '../types/character'
import { isValidAttributes } from './attributeUtils'
import { getOrigin } from './originUtils'
import { getOrdemClass } from './classUtils'
import { getRequiredFreeSkillCount } from './characterUtils'

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
    attributes: { ...EMPTY_DRAFT.attributes, ...p.attributes },
    origin: typeof p.origin === 'string' ? p.origin : null,
    originGmSkillChoices: Array.isArray(p.originGmSkillChoices) ? p.originGmSkillChoices : [],
    class: p.class === 'combatant' || p.class === 'specialist' || p.class === 'occultist' ? p.class : null,
    classChoiceGroupPicks: Array.isArray(p.classChoiceGroupPicks) ? p.classChoiceGroupPicks : [],
    classFreeSkillChoices: Array.isArray(p.classFreeSkillChoices) ? p.classFreeSkillChoices : [],
  }
}
