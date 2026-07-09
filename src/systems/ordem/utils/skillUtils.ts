import type { Skill } from '../types/skill'
import skillsData from '../data/skills.json'

export const SKILLS: Skill[] = skillsData as Skill[]

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find(s => s.id === id)
}

export function getSkillName(id: string): string {
  return getSkill(id)?.name ?? id
}
