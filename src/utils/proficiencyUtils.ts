import type { CharacterDraft } from '../types/character'
import { getRace, getSubrace, getRaceGrantedSkills, getRaceGrantedTools } from './raceUtils'
import { getClass } from './classUtils'
import { getBackground } from './backgroundUtils'

/**
 * Deduplicação de proficiências entre raça, classe e antecedente (PHB 2014).
 * Regra do livro: ao ganhar uma proficiência que já se possui de outra fonte,
 * escolhe-se outra do mesmo tipo. Aqui centralizamos, por fonte, as perícias e
 * ferramentas concedidas (fixas + escolhidas), para os pickers oferecerem só o
 * que ainda não se tem e a ficha refletir todas as proficiências reais.
 */
export type ProficiencySource = 'race' | 'class' | 'background'

const ALL_SOURCES: ProficiencySource[] = ['race', 'class', 'background']

function uniq(ids: string[]): string[] {
  return [...new Set(ids)]
}

function raceSkills(draft: CharacterDraft): string[] {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return []
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  return [...getRaceGrantedSkills(race, subrace), ...(draft.raceChoices.skills ?? [])]
}

function classSkills(draft: CharacterDraft): string[] {
  return [...draft.classChoices.skills, ...(draft.classChoices.subclassExtras.skills ?? [])]
}

function backgroundSkills(draft: CharacterDraft): string[] {
  const bg = draft.background ? getBackground(draft.background) : undefined
  return bg?.skillProficiencies ?? []
}

function raceTools(draft: CharacterDraft): string[] {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return []
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  return [...getRaceGrantedTools(race, subrace), ...(draft.raceChoices.tools ?? [])]
}

function classTools(draft: CharacterDraft): string[] {
  const cls = draft.class ? getClass(draft.class) : undefined
  return [...(cls?.toolProficiencies.granted ?? []), ...draft.classChoices.tools]
}

function backgroundTools(draft: CharacterDraft): string[] {
  const bg = draft.background ? getBackground(draft.background) : undefined
  return [...(bg?.toolProficiencies ?? []), ...(draft.backgroundChoices.tools ?? [])]
}

export function getSkillsBySource(draft: CharacterDraft): Record<ProficiencySource, string[]> {
  return {
    race: raceSkills(draft),
    class: classSkills(draft),
    background: backgroundSkills(draft),
  }
}

export function getToolsBySource(draft: CharacterDraft): Record<ProficiencySource, string[]> {
  return {
    race: raceTools(draft),
    class: classTools(draft),
    background: backgroundTools(draft),
  }
}

/** Perícias já concedidas por fontes DIFERENTES da informada (para excluir do picker). */
export function getExcludedSkills(draft: CharacterDraft, source: ProficiencySource): string[] {
  const bySource = getSkillsBySource(draft)
  return uniq(ALL_SOURCES.filter(s => s !== source).flatMap(s => bySource[s]))
}

/** Ferramentas já concedidas por fontes DIFERENTES da informada (para excluir do picker). */
export function getExcludedTools(draft: CharacterDraft, source: ProficiencySource): string[] {
  const bySource = getToolsBySource(draft)
  return uniq(ALL_SOURCES.filter(s => s !== source).flatMap(s => bySource[s]))
}

/** Todas as perícias em que o personagem é proficiente (união das fontes). */
export function getAllGrantedSkills(draft: CharacterDraft): string[] {
  const b = getSkillsBySource(draft)
  return uniq([...b.race, ...b.class, ...b.background])
}

/** Todas as ferramentas em que o personagem é proficiente (união das fontes). */
export function getAllGrantedTools(draft: CharacterDraft): string[] {
  const b = getToolsBySource(draft)
  return uniq([...b.race, ...b.class, ...b.background])
}
