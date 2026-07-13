import type { Skill } from '../types/skill'
import skillsData from '../data/skills.json'

export const SKILLS: Skill[] = skillsData as Skill[]

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find(s => s.id === id)
}

export function getSkillName(id: string): string {
  return getSkill(id)?.name ?? id
}

const ATTR_ABBREV: Record<string, string> = {
  agility: 'AGI',
  strength: 'FOR',
  intellect: 'INT',
  presence: 'PRE',
  vigor: 'VIG',
}

/** Sigla do atributo-base da perícia (AGI/FOR/INT/PRE/VIG). */
export function getSkillAttributeAbbrev(id: string): string {
  const skill = getSkill(id)
  return skill ? ATTR_ABBREV[skill.attribute] ?? '' : ''
}

/** Rótulo da perícia com o atributo de que ela deriva, ex.: "Atletismo (FOR)". */
export function formatSkillWithAttribute(id: string): string {
  const abbrev = getSkillAttributeAbbrev(id)
  return abbrev ? `${getSkillName(id)} (${abbrev})` : getSkillName(id)
}
