import type { CharacterDraft } from '../types/character'
import type { ClassChoiceSelections, ArmorProficiency } from '../types/class'
import type { AbilityScore } from '../types/race'
import type { Armor, ArmorCategory, Weapon } from '../types/equipment'
import {
  getRace, getSubrace, getRaceGrantedSkills, getRaceGrantedTools,
  getEffectiveGrantedProficiencies,
} from './raceUtils'
import { getClass, getSubclass } from './classUtils'
import { getBackground } from './backgroundUtils'
import { getEquippedArmor, getArmor, getWeaponById, ALL_WEAPONS } from './equipmentUtils'
import {
  getFeatArmorProficiencies, getFeatWeaponProficiencies, getFeatSavingThrows,
  getFeatGrantedSkills, getFeatGrantedTools, getFeatGrantedLanguages,
} from './sheetEffects'

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
  return uniq([
    ...ALL_SOURCES.filter(s => s !== source).flatMap(s => bySource[s]),
    ...getFeatGrantedSkills(draft),
  ])
}

/** Ferramentas já concedidas por fontes DIFERENTES da informada (para excluir do picker). */
export function getExcludedTools(draft: CharacterDraft, source: ProficiencySource): string[] {
  const bySource = getToolsBySource(draft)
  return uniq([
    ...ALL_SOURCES.filter(s => s !== source).flatMap(s => bySource[s]),
    ...getFeatGrantedTools(draft),
  ])
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
    ...getFeatGrantedSkills(draft),
    ...classSkillSlots(draft).filter(s => !sameSlot(s.slot, slot)).flatMap(s => s.skills),
  ])
}

/** Idem para ferramentas. */
export function getExcludedToolsForClassSlot(draft: CharacterDraft, slot: ClassSlot): string[] {
  return uniq([
    ...raceTools(draft),
    ...backgroundTools(draft),
    ...getFeatGrantedTools(draft),
    ...classToolSlots(draft).filter(s => !sameSlot(s.slot, slot)).flatMap(s => s.tools),
  ])
}

// ── Exclusões dos pickers de talento ───────────────────────────────────────────

/**
 * O que o picker de UM talento não pode oferecer: tudo que o personagem já tem por outra via,
 * menos o que o próprio talento já escolheu (senão não daria pra desmarcar).
 */
function excludedForFeat(all: string[], own: string[]): string[] {
  const mine = new Set(own)
  return uniq(all.filter(id => !mine.has(id)))
}

export function getExcludedSkillsForFeat(draft: CharacterDraft, featId: string): string[] {
  return excludedForFeat(getAllGrantedSkills(draft), draft.featSelections[featId]?.skills ?? [])
}

export function getExcludedToolsForFeat(draft: CharacterDraft, featId: string): string[] {
  return excludedForFeat(getAllGrantedTools(draft), draft.featSelections[featId]?.tools ?? [])
}

export function getExcludedLanguagesForFeat(draft: CharacterDraft, featId: string): string[] {
  return excludedForFeat(getAllGrantedLanguages(draft), draft.featSelections[featId]?.languages ?? [])
}

/** Armas que o personagem já sabe usar (por categoria ou nominalmente) não entram no picker. */
export function getExcludedWeaponsForFeat(draft: CharacterDraft, featId: string): string[] {
  const mine = new Set(draft.featSelections[featId]?.weapons ?? [])
  return ALL_WEAPONS
    .filter(w => !mine.has(w.id) && hasWeaponProficiency(draft, w))
    .map(w => w.id)
}

/** Todas as perícias em que o personagem é proficiente (união das fontes). */
export function getAllGrantedSkills(draft: CharacterDraft): string[] {
  const b = getSkillsBySource(draft)
  return uniq([...b.race, ...b.class, ...b.background, ...getFeatGrantedSkills(draft)])
}

/** Todas as ferramentas em que o personagem é proficiente (união das fontes). */
export function getAllGrantedTools(draft: CharacterDraft): string[] {
  const b = getToolsBySource(draft)
  return uniq([...b.race, ...b.class, ...b.background, ...getFeatGrantedTools(draft)])
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

// ── Armaduras, armas e resistências (a permissão de USAR) ──────────────────────

/** Proficiências raciais de um tipo (ex.: anão da montanha = armadura leve e média). */
function raceGranted(draft: CharacterDraft, type: 'armor' | 'weapon'): string[] {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return []
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  return getEffectiveGrantedProficiencies(race, subrace)
    .filter(g => g.type === type)
    .map(g => g.value)
}

/**
 * Proficiências de armadura de todas as fontes.
 *
 * A classe INICIAL concede a lista cheia; as adicionais só o subconjunto da Tabela de
 * Proficiências de Multiclasse (p. 163) — por isso `multiclassProficiencies.armor`.
 */
export function getArmorProficiencies(draft: CharacterDraft): ArmorProficiency[] {
  const fromPrimary = draft.class ? (getClass(draft.class)?.armorProficiencies ?? []) : []
  const fromAdditional = draft.additionalClasses.flatMap(
    e => getClass(e.classId)?.multiclassProficiencies.armor ?? [],
  )
  const fromSubclasses = classEntries(draft).flatMap(
    ({ classId, choices }) => subclassExtrasOf(classId, choices)?.grantedArmorProficiencies ?? [],
  )
  return uniq([
    ...raceGranted(draft, 'armor'),
    ...fromPrimary,
    ...fromAdditional,
    ...fromSubclasses,
    ...getFeatArmorProficiencies(draft),
  ]) as ArmorProficiency[]
}

/** Proficiências de arma: os tokens 'simple'/'martial' e/ou ids de armas específicas. */
export function getWeaponProficiencies(draft: CharacterDraft): string[] {
  const fromPrimary = draft.class ? (getClass(draft.class)?.weaponProficiencies ?? []) : []
  const fromAdditional = draft.additionalClasses.flatMap(
    e => getClass(e.classId)?.multiclassProficiencies.weapons ?? [],
  )
  const fromSubclasses = classEntries(draft).flatMap(
    ({ classId, choices }) => subclassExtrasOf(classId, choices)?.grantedWeaponProficiencies ?? [],
  )
  return uniq([
    ...raceGranted(draft, 'weapon'),
    ...fromPrimary,
    ...fromAdditional,
    ...fromSubclasses,
    ...getFeatWeaponProficiencies(draft),
  ])
}

/**
 * Testes de resistência com proficiência. Só a classe INICIAL concede: multiclassar nunca dá
 * proficiência em resistência (p. 163) — é a diferença mais esquecida da tabela.
 */
export function getSavingThrowProficiencies(draft: CharacterDraft): AbilityScore[] {
  const fromClass = draft.class ? (getClass(draft.class)?.savingThrows ?? []) : []
  return uniq([...fromClass, ...getFeatSavingThrows(draft)]) as AbilityScore[]
}

/** O catálogo de armaduras diz 'shield'; a proficiência de classe diz 'shields'. */
const ARMOR_CATEGORY_TO_PROFICIENCY: Record<ArmorCategory, ArmorProficiency> = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  shield: 'shields',
}

export function hasArmorProficiency(draft: CharacterDraft, armor: Armor): boolean {
  return getArmorProficiencies(draft).includes(ARMOR_CATEGORY_TO_PROFICIENCY[armor.category])
}

/** Proficiente com a arma pela categoria (simples/marcial) ou por concessão específica. */
export function hasWeaponProficiency(draft: CharacterDraft, weapon: Weapon): boolean {
  const profs = getWeaponProficiencies(draft)
  return profs.includes(weapon.category) || profs.includes(weapon.id)
}

/**
 * Armadura/escudo equipados sem a proficiência correspondente.
 *
 * "Se você vestir uma armadura com a qual não tem proficiência, terá desvantagem em qualquer
 * teste de habilidade, teste de resistência ou jogada de ataque que envolva Força ou Destreza, e
 * não poderá conjurar magias" (p. 144). O análogo da penalidade em dados do Ordem: a ficha não
 * some com o número, mostra a condição.
 */
export function getUnproficientArmor(draft: CharacterDraft): Armor[] {
  const classEquipment = draft.class ? getClass(draft.class)?.startingEquipment : undefined
  const { bodyArmor, hasShield } = getEquippedArmor(draft.equipment, classEquipment)
  // getEquippedArmor devolve só um booleano pro escudo; o item vem do catálogo pra nomear o aviso.
  const shield = hasShield ? getArmor('shield') : undefined
  const worn = [bodyArmor, shield].filter((a): a is Armor => a !== undefined)
  return worn.filter(armor => !hasArmorProficiency(draft, armor))
}

// ── Rótulos ────────────────────────────────────────────────────────────────────

export const ARMOR_PROFICIENCY_LABELS: Record<ArmorProficiency, string> = {
  light: 'Armaduras Leves',
  medium: 'Armaduras Médias',
  heavy: 'Armaduras Pesadas',
  shields: 'Escudos',
}

const WEAPON_CATEGORY_LABELS: Record<string, string> = {
  simple: 'Armas Simples',
  martial: 'Armas Marciais',
}

export function getArmorProficiencyLabels(draft: CharacterDraft): string[] {
  return getArmorProficiencies(draft).map(p => ARMOR_PROFICIENCY_LABELS[p] ?? p)
}

/** Categorias primeiro, depois as armas avulsas (as raciais), cada uma pelo nome do catálogo. */
export function getWeaponProficiencyLabels(draft: CharacterDraft): string[] {
  const profs = getWeaponProficiencies(draft)
  const categories = profs.filter(p => p in WEAPON_CATEGORY_LABELS)
  const specific = profs.filter(p => !(p in WEAPON_CATEGORY_LABELS))
  return [
    ...categories.map(c => WEAPON_CATEGORY_LABELS[c]),
    // Uma arma específica é redundante se a categoria dela já entrou (anão guerreiro: machado
    // de batalha é marcial, e o guerreiro já tem todas as marciais).
    ...specific
      .filter(id => {
        const weapon = getWeaponById(id)
        return !weapon || !categories.includes(weapon.category)
      })
      .map(id => getWeaponById(id)?.name ?? id),
  ]
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
  return uniq([
    ...ALL_SOURCES.filter(s => s !== source).flatMap(s => bySource[s]),
    ...getFeatGrantedLanguages(draft),
  ])
}

/** Todos os idiomas que o personagem fala (união das fontes). */
export function getAllGrantedLanguages(draft: CharacterDraft): string[] {
  const b = getLanguagesBySource(draft)
  return uniq([...b.race, ...b.class, ...b.background, ...getFeatGrantedLanguages(draft)])
}
