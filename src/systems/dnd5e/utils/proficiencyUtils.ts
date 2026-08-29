import type { CharacterDraft } from '../types/character'
import type { ClassChoiceSelections } from '../types/class'
import { getRace, getSubrace, getRaceGrantedSkills, getRaceGrantedTools } from './raceUtils'
import { getClass, getSubclass } from './classUtils'
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

/**
 * Um ponto de escolha DENTRO da classe. A lista base da classe e os extras da subclasse são
 * concessões independentes — e, na multiclasse, cada classe tem as suas —, então cada uma é um
 * slot próprio: sem isso um bardo do Colégio do Conhecimento poderia pegar a mesma perícia na
 * lista da classe e de novo nas três do colégio.
 */
export type ClassSlot = { classId: string; part: 'base' | 'subclass' }

function uniq(ids: string[]): string[] {
  return [...new Set(ids)]
}

/** Classe primária + adicionais da multiclasse, cada uma com suas escolhas. */
function classEntries(draft: CharacterDraft): { classId: string; choices: ClassChoiceSelections }[] {
  const primary = draft.class ? [{ classId: draft.class, choices: draft.classChoices }] : []
  const extra = draft.additionalClasses.map(e => ({ classId: e.classId, choices: e.classChoices }))
  return [...primary, ...extra]
}

function subclassExtrasOf(classId: string, choices: ClassChoiceSelections) {
  const cls = getClass(classId)
  if (!cls || !choices.subclass) return null
  return getSubclass(cls, choices.subclass)?.extras ?? null
}

// ── Perícias ───────────────────────────────────────────────────────────────────

/** Perícias por slot de classe, para exclusão cruzada dentro da própria classe. */
function classSkillSlots(draft: CharacterDraft): { slot: ClassSlot; skills: string[] }[] {
  return classEntries(draft).flatMap(({ classId, choices }) => [
    { slot: { classId, part: 'base' } as ClassSlot, skills: choices.skills },
    { slot: { classId, part: 'subclass' } as ClassSlot, skills: choices.subclassExtras.skills ?? [] },
  ])
}

function raceSkills(draft: CharacterDraft): string[] {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return []
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  return [...getRaceGrantedSkills(race, subrace), ...(draft.raceChoices.skills ?? [])]
}

function classSkills(draft: CharacterDraft): string[] {
  return classSkillSlots(draft).flatMap(s => s.skills)
}

function backgroundSkills(draft: CharacterDraft): string[] {
  const bg = draft.background ? getBackground(draft.background) : undefined
  return bg?.skillProficiencies ?? []
}

// ── Ferramentas ────────────────────────────────────────────────────────────────

/** Ferramentas por slot de classe: fixas + escolhidas da classe, fixas + escolhidas da subclasse. */
function classToolSlots(draft: CharacterDraft): { slot: ClassSlot; tools: string[] }[] {
  return classEntries(draft).flatMap(({ classId, choices }) => {
    const extras = subclassExtrasOf(classId, choices)
    return [
      {
        slot: { classId, part: 'base' } as ClassSlot,
        tools: [...(getClass(classId)?.toolProficiencies.granted ?? []), ...choices.tools],
      },
      {
        slot: { classId, part: 'subclass' } as ClassSlot,
        tools: [...(extras?.grantedTools ?? []), ...(choices.subclassExtras.tools ?? [])],
      },
    ]
  })
}

function raceTools(draft: CharacterDraft): string[] {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return []
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  return [...getRaceGrantedTools(race, subrace), ...(draft.raceChoices.tools ?? [])]
}

function classTools(draft: CharacterDraft): string[] {
  return classToolSlots(draft).flatMap(s => s.tools)
}

function backgroundTools(draft: CharacterDraft): string[] {
  const bg = draft.background ? getBackground(draft.background) : undefined
  return [...(bg?.toolProficiencies ?? []), ...(draft.backgroundChoices.tools ?? [])]
}

// ── Consultas ──────────────────────────────────────────────────────────────────

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

function sameSlot(a: ClassSlot, b: ClassSlot): boolean {
  return a.classId === b.classId && a.part === b.part
}

/**
 * Perícias fora de alcance de UM slot de classe: raça, antecedente e todos os outros slots de
 * classe (a outra parte da mesma classe e as demais classes da multiclasse).
 */
export function getExcludedSkillsForClassSlot(draft: CharacterDraft, slot: ClassSlot): string[] {
  return uniq([
    ...raceSkills(draft),
    ...backgroundSkills(draft),
    ...classSkillSlots(draft).filter(s => !sameSlot(s.slot, slot)).flatMap(s => s.skills),
  ])
}

/** Idem para ferramentas. */
export function getExcludedToolsForClassSlot(draft: CharacterDraft, slot: ClassSlot): string[] {
  return uniq([
    ...raceTools(draft),
    ...backgroundTools(draft),
    ...classToolSlots(draft).filter(s => !sameSlot(s.slot, slot)).flatMap(s => s.tools),
  ])
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

/**
 * Tudo que o painel de uma classe precisa saber sobre proficiências: o que já está tomado em
 * cada um dos seus dois slots e o que o personagem tem no total (base da Especialização).
 */
export type ClassSlotProficiencies = {
  excludedBaseSkills: string[]
  excludedBaseTools: string[]
  excludedSubclassSkills: string[]
  excludedSubclassTools: string[]
  grantedSkills: string[]
  grantedTools: string[]
}

export function getClassSlotProficiencies(
  draft: CharacterDraft,
  classId: string,
): ClassSlotProficiencies {
  const base: ClassSlot = { classId, part: 'base' }
  const subclass: ClassSlot = { classId, part: 'subclass' }
  return {
    excludedBaseSkills: getExcludedSkillsForClassSlot(draft, base),
    excludedBaseTools: getExcludedToolsForClassSlot(draft, base),
    excludedSubclassSkills: getExcludedSkillsForClassSlot(draft, subclass),
    excludedSubclassTools: getExcludedToolsForClassSlot(draft, subclass),
    grantedSkills: getAllGrantedSkills(draft),
    grantedTools: getAllGrantedTools(draft),
  }
}

// ── Idiomas ────────────────────────────────────────────────────────────────────

/**
 * Idiomas por fonte. Os da CLASSE vêm da subclasse — fixos (Dracônico da Linhagem Dracônica) e
 * escolhidos (os dois do Domínio do Conhecimento) —, que antes só apareciam como selo no passo
 * de classe e sumiam da ficha.
 */
export function getLanguagesBySource(draft: CharacterDraft): Record<ProficiencySource, string[]> {
  const race = draft.race ? getRace(draft.race) : undefined
  return {
    race: [...(race?.grantedLanguages ?? []), ...(draft.raceChoices.languages ?? [])],
    class: classEntries(draft).flatMap(({ classId, choices }) => [
      ...(subclassExtrasOf(classId, choices)?.grantedLanguages ?? []),
      ...(choices.subclassExtras.languages ?? []),
    ]),
    background: draft.backgroundChoices.languages ?? [],
  }
}

/** Idiomas já vindos de fontes DIFERENTES da informada (para excluir do picker). */
export function getExcludedLanguages(draft: CharacterDraft, source: ProficiencySource): string[] {
  const bySource = getLanguagesBySource(draft)
  return uniq(ALL_SOURCES.filter(s => s !== source).flatMap(s => bySource[s]))
}

/** Todos os idiomas que o personagem fala (união das fontes). */
export function getAllGrantedLanguages(draft: CharacterDraft): string[] {
  const b = getLanguagesBySource(draft)
  return uniq([...b.race, ...b.class, ...b.background])
}
