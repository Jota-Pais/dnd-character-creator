import type { Skill } from '../types/skill'
import skillsData from '../data/skills.json'
import { ATTRIBUTE_ABBREV } from './attributeUtils'

export const SKILLS: Skill[] = skillsData as Skill[]

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find(s => s.id === id)
}

export function getSkillName(id: string): string {
  return getSkill(id)?.name ?? id
}

/** Nome do kit que a perícia exige, capitalizado (ex.: "Kit de medicina"); vazio se não exigir. */
export function getSkillKitName(id: string): string {
  const kit = getSkill(id)?.kit
  return kit ? `Kit de ${kit.name}` : ''
}

/** Em que usos da perícia o kit é exigido (ex.: "nos usos arrombar e sabotar"). */
export function getSkillKitScope(id: string): string {
  return getSkill(id)?.kit?.scope ?? ''
}

/** Sigla do atributo-base da perícia (AGI/FOR/INT/PRE/VIG). */
export function getSkillAttributeAbbrev(id: string): string {
  const skill = getSkill(id)
  return skill ? ATTRIBUTE_ABBREV[skill.attribute] ?? '' : ''
}

/** Rótulo da perícia com o atributo de que ela deriva, ex.: "Atletismo (FOR)". */
export function formatSkillWithAttribute(id: string): string {
  const abbrev = getSkillAttributeAbbrev(id)
  return abbrev ? `${getSkillName(id)} (${abbrev})` : getSkillName(id)
}
