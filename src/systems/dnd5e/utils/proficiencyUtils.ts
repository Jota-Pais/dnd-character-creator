import type { CharacterDraft, ClassEntry } from '../types/character'
import type { ClassChoiceSelections, ArmorProficiency } from '../types/class'
import type { AbilityScore } from '../types/race'
import type { Armor, ArmorCategory, Tool, Weapon } from '../types/equipment'
import {
  getRace, getSubrace, getRaceGrantedSkills, getRaceGrantedTools,
  getEffectiveGrantedProficiencies, getLanguageName, isExoticLanguage,
} from './raceUtils'
import { getClass, getSubclass, getExpertiseCount, getSpellcastingSource } from './classUtils'
import { allClassEntries } from './multiclassUtils'
import { getBackground, resolveBackgroundItems } from './backgroundUtils'
import {
  getEquippedArmor, getArmor, getWeaponById, ALL_WEAPONS, getCarriedToolIds, getToolEquivalent, getItemName,
} from './equipmentUtils'
import {
  getFeatArmorProficiencies, getFeatWeaponProficiencies, getFeatSavingThrows,
  getClassFeatureSavingThrows,
  getFeatGrantedSkills, getFeatGrantedTools, getFeatGrantedLanguages,
  getCheckProficiencyBonus, getPassiveScoreBonus, type CheckProficiency,
  getHalfProficiencySources, getBestHalfProficiencySource,
} from './sheetEffects'
import {
  calculateModifier, getProficiencyBonus, ALL_ABILITY_SCORES, ABILITY_LABELS,
} from './abilityScoreUtils'

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
 * O que o picker de UM slot (talento, idiomas de subclasse) não pode oferecer: tudo que o
 * personagem já tem por outra via, menos o que o próprio slot já escolheu (senão não daria pra
 * desmarcar).
 */
function excludedExceptOwn(all: string[], own: string[]): string[] {
  const mine = new Set(own)
  return uniq(all.filter(id => !mine.has(id)))
}

export function getExcludedSkillsForFeat(draft: CharacterDraft, featId: string): string[] {
  return excludedExceptOwn(getAllGrantedSkills(draft), draft.featSelections[featId]?.skills ?? [])
}

export function getExcludedToolsForFeat(draft: CharacterDraft, featId: string): string[] {
  return excludedExceptOwn(getAllGrantedTools(draft), draft.featSelections[featId]?.tools ?? [])
}

export function getExcludedLanguagesForFeat(draft: CharacterDraft, featId: string): string[] {
  return excludedExceptOwn(getAllGrantedLanguages(draft), draft.featSelections[featId]?.languages ?? [])
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

// ── Especialização (bônus de proficiência dobrado) ─────────────────────────────

/**
 * A Especialização/Aptidão escolhida numa classe, só nas levas já liberadas pelo nível NELA: se o
 * nível baixou e sobraram escolhas, valem as primeiras, que são as das levas mais antigas.
 */
function chosenExpertise(entry: ClassEntry): string[] {
  const cls = getClass(entry.classId)
  return cls ? entry.classChoices.expertiseItems.slice(0, getExpertiseCount(cls, entry.level)) : []
}

/** Perícias que a subclasse já concede dobradas (Domínio do Conhecimento, p. 66). */
function subclassExpertise(entry: ClassEntry): string[] {
  const from = subclassExtrasOf(entry.classId, entry.classChoices)?.expertiseSkills?.from ?? []
  return (entry.classChoices.subclassExtras.skills ?? []).filter(id => from.includes(id))
}

/**
 * Perícias com o bônus de proficiência dobrado, de todas as fontes: a Especialização de CADA
 * classe da multiclasse (antes a ficha lia só a da classe inicial) e as perícias do Domínio do
 * Conhecimento (antes nunca dobravam). Só perícias que o personagem tem — as ferramentas de
 * ladrão ficam em `getExpertiseTools`.
 */
export function getExpertiseSkills(draft: CharacterDraft): string[] {
  const granted = new Set(getAllGrantedSkills(draft))
  return uniq(
    allClassEntries(draft).flatMap(entry => [...chosenExpertise(entry), ...subclassExpertise(entry)]),
  ).filter(id => granted.has(id))
}

/** Ferramentas com o bônus dobrado (hoje só as de ladrão, pela Especialização do ladino). */
export function getExpertiseTools(draft: CharacterDraft): string[] {
  const granted = new Set(getAllGrantedTools(draft))
  return uniq(allClassEntries(draft).flatMap(chosenExpertise)).filter(id => granted.has(id))
}

// ── Testes de perícia (o número da ficha) ──────────────────────────────────────

export const SKILL_ABILITY: Record<string, AbilityScore> = {
  acrobatics: 'DEX', 'animal-handling': 'WIS', arcana: 'INT', athletics: 'STR',
  deception: 'CHA', history: 'INT', insight: 'WIS', intimidation: 'CHA',
  investigation: 'INT', medicine: 'WIS', nature: 'INT', perception: 'WIS',
  performance: 'CHA', persuasion: 'CHA', religion: 'INT', 'sleight-of-hand': 'DEX',
  stealth: 'DEX', survival: 'WIS',
}

export type SkillCheck = { ability: AbilityScore; proficiency: CheckProficiency; bonus: number }

/**
 * O número de cada perícia: modificador do atributo + a parcela do bônus de proficiência que cabe
 * — dobrada com Especialização, inteira com proficiência, metade com Versatilidade ou Atletismo
 * Extraordinário (este só nas de Força e Destreza), nunca somadas.
 * Fonte única da Revisão e do PDF, que antes repetiam a conta cada um do seu jeito e só
 * enxergavam a Especialização da classe inicial.
 */
export function getSkillChecks(
  draft: CharacterDraft,
  finalScores: Record<AbilityScore, number>,
): Record<string, SkillCheck> {
  const granted = new Set(getAllGrantedSkills(draft))
  const doubled = new Set(getExpertiseSkills(draft))
  return Object.fromEntries(Object.entries(SKILL_ABILITY).map(([skillId, ability]) => {
    const proficiency: CheckProficiency =
      doubled.has(skillId) ? 'expertise' : granted.has(skillId) ? 'proficient' : 'none'
    const bonus = calculateModifier(finalScores[ability]) + getCheckProficiencyBonus(draft, proficiency, ability)
    return [skillId, { ability, proficiency, bonus }]
  }))
}

/** "a", "a e b", "a, b e c" — com a conjunção pedida. */
function joinPt(items: string[], conjunction: 'e' | 'ou'): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`
}

/** Uma linha explicativa de meia proficiência na Revisão e no PDF: a fonte e o que ela faz. */
export type HalfProficiencyLine = { source: string; text: string }

/**
 * As linhas de Versatilidade / Atletismo Extraordinário que a Revisão e o PDF mostram embaixo das
 * perícias. O número das perícias e da iniciativa já leva a parcela; a linha diz onde ela já está
 * somada e onde mais vale (teste de atributo puro e de ferramenta, que a ficha não imprime).
 *
 * Com as duas, cada uma aparece só nos atributos em que é a que vale (a maior, p. 175) — a que
 * não vale em nenhum (empate ou menor) some, porque não muda nada na mesa.
 */
export function describeHalfProficiencyOnChecks(draft: CharacterDraft): HalfProficiencyLine[] {
  const sources = getHalfProficiencySources(draft)
  const skillAbilities = new Set(Object.values(SKILL_ABILITY))
  const names = (abilities: AbilityScore[], conjunction: 'e' | 'ou') =>
    joinPt(abilities.map(ab => ABILITY_LABELS[ab].long), conjunction)

  return sources.flatMap(source => {
    const wins = ALL_ABILITY_SCORES.filter(ab => getBestHalfProficiencySource(sources, ab) === source)
    if (wins.length === 0) return []
    const everyAbility = wins.length === ALL_ABILITY_SCORES.length

    const withSkills = wins.filter(ab => skillAbilities.has(ab))
    const skillsPart = withSkills.length === 0 ? []
      : everyAbility ? ['nas perícias sem proficiência']
        : [`nas perícias de ${names(withSkills, 'e')} sem proficiência`]
    const added = [...skillsPart, ...(wins.includes('DEX') ? ['na iniciativa'] : [])]
    const also = everyAbility
      ? 'em testes de atributo e de ferramenta sem proficiência'
      : `em testes de ${names(wins, 'ou')} sem proficiência (de atributo ou de ferramenta)`
    const others = sources.filter(s => s !== source).map(s => s.source)

    const text = [
      added.length > 0
        ? `+${source.value} já somado ${joinPt(added, 'e')}; vale também ${also}.`
        : `+${source.value} ${also}.`,
      ...(others.length > 0 ? [`Não se soma com ${joinPt(others, 'e')}: em cada teste vale o maior.`] : []),
    ].join(' ')
    return [{ source: source.source, text }]
  })
}

/**
 * Valor passivo de uma perícia (p. 177): "10 + todos os modificadores que se aplicam normalmente
 * ao teste" — então leva a Especialização e a Versatilidade (ou o Atletismo Extraordinário) junto
 * — mais o que só vale no
 * passivo (Observador +5).
 */
export function getPassiveScore(
  draft: CharacterDraft,
  skillId: string,
  checks: Record<string, SkillCheck>,
): number {
  return 10 + checks[skillId].bonus + getPassiveScoreBonus(draft, skillId)
}

/**
 * O que já está dobrado por OUTRA fonte que não o seletor de Especialização desta classe: as das
 * outras classes e as de subclasse. O bônus de proficiência só se multiplica uma vez (p. 175), então
 * escolher de novo seria jogar a escolha fora.
 */
function expertiseOutsideClassPicker(draft: CharacterDraft, classId: string): string[] {
  const entries = allClassEntries(draft)
  return uniq([
    ...entries.filter(e => e.classId !== classId).flatMap(chosenExpertise),
    ...entries.flatMap(subclassExpertise),
  ])
}

/**
 * Tudo que o painel de uma classe precisa saber sobre proficiências: o que já está tomado em
 * cada um dos seus dois slots, o que o personagem tem no total (base da Especialização) e o que já
 * está dobrado por outra fonte.
 */
export type ClassSlotProficiencies = {
  excludedBaseSkills: string[]
  excludedBaseTools: string[]
  excludedSubclassSkills: string[]
  excludedSubclassTools: string[]
  excludedSubclassLanguages: string[]
  grantedSkills: string[]
  grantedTools: string[]
  excludedExpertise: string[]
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
    excludedSubclassLanguages: getExcludedLanguagesForClassSlot(draft, classId),
    grantedSkills: getAllGrantedSkills(draft),
    grantedTools: getAllGrantedTools(draft),
    excludedExpertise: expertiseOutsideClassPicker(draft, classId),
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
 * Testes de resistência com proficiência. Das proficiências INICIAIS, só a classe inicial concede:
 * multiclassar nunca dá proficiência em resistência (p. 166) — é a diferença mais esquecida da
 * tabela. Somam-se o talento (Resiliente) e as características de classe que dão resistência
 * (Mente Escorregadia, Alma de Diamante), estas de qualquer classe da multiclasse.
 */
export function getSavingThrowProficiencies(draft: CharacterDraft): AbilityScore[] {
  const fromClass = draft.class ? (getClass(draft.class)?.savingThrows ?? []) : []
  const granted = new Set([
    ...fromClass, ...getFeatSavingThrows(draft), ...getClassFeatureSavingThrows(draft),
  ])
  // Na ordem da ficha (FOR, DES, CON, INT, SAB, CAR), não na ordem das fontes.
  return ALL_ABILITY_SCORES.filter(ab => granted.has(ab))
}

export type SavingThrowCheck = { proficient: boolean; bonus: number }

/**
 * O número de cada teste de resistência: modificador do atributo + o bônus de proficiência, se
 * proficiente. Fonte única da Revisão e do PDF, que antes liam só `savingThrows` da classe e
 * perdiam o Resiliente. A Versatilidade não entra: ela vale para testes de habilidade, não de
 * resistência (p. 54).
 */
export function getSavingThrowChecks(
  draft: CharacterDraft,
  finalScores: Record<AbilityScore, number>,
): Record<AbilityScore, SavingThrowCheck> {
  const proficient = new Set(getSavingThrowProficiencies(draft))
  const prof = getProficiencyBonus(draft.level ?? 1)
  return Object.fromEntries(ALL_ABILITY_SCORES.map(ab => {
    const isProficient = proficient.has(ab)
    return [ab, { proficient: isProficient, bonus: calculateModifier(finalScores[ab]) + (isProficient ? prof : 0) }]
  })) as Record<AbilityScore, SavingThrowCheck>
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

/** O foco do bardo (p. 53), como `spellcasting.focus` o grava em classes.json. */
const INSTRUMENT_FOCUS = 'instrumento musical'

/**
 * Alguma classe do personagem (multiclasse inclusa) já conjura usando um instrumento musical
 * como foco — o bardo, desde o 1º nível (p. 53).
 */
export function hasInstrumentSpellcastingFocus(draft: CharacterDraft): boolean {
  return allClassEntries(draft).some(entry => {
    const cls = getClass(entry.classId)
    const sc = cls ? getSpellcastingSource(cls, entry.classChoices.subclass)?.spellcasting : undefined
    return sc?.focus === INSTRUMENT_FOCUS && entry.level >= sc.castingStartsAtLevel
  })
}

export type UnproficientTool = {
  /** A ferramenta para a regra (dados de osso → Conjunto de Dados). */
  tool: Tool
  /** O item como está no inventário: pode ser outro, quando declara `countsAsTool`. */
  itemId: string
  itemName: string
  /** Instrumento de quem conjura com foco instrumento musical: serve de foco mesmo sem proficiência. */
  spellcastingFocus: boolean
}

/**
 * Ferramentas e instrumentos carregados (equipamento de classe, escolhas, compras e itens do
 * antecedente) sem a proficiência correspondente. Não é erro de regra: o livro deixa usar, só
 * não soma o bônus de proficiência nos testes com ela (p. 156). E o instrumento continua sendo
 * foco de conjuração do bardo, que não exige proficiência (p. 53).
 *
 * Como `getUnproficientArmor`, vira aviso na ficha e não bloqueia nada.
 */
export function getUnproficientTools(draft: CharacterDraft): UnproficientTool[] {
  const classEquipment = draft.class ? getClass(draft.class)?.startingEquipment : undefined
  const carried = uniq([...getCarriedToolIds(draft.equipment, classEquipment), ...getBackgroundItemIds(draft)])
  const granted = new Set(getAllGrantedTools(draft))
  const instrumentFocus = hasInstrumentSpellcastingFocus(draft)
  return carried.flatMap(itemId => {
    // Os dados de osso do Soldado valem como conjunto de dados (p. 142): é a proficiência nele que conta.
    const tool = getToolEquivalent(itemId)
    if (!tool || granted.has(tool.id)) return []
    return [{
      tool,
      itemId,
      itemName: getItemName(itemId),
      spellcastingFocus: instrumentFocus && tool.category === 'musical-instrument',
    }]
  })
}

/** Ids dos itens que o antecedente dá, com as escolhas de item já resolvidas. */
function getBackgroundItemIds(draft: CharacterDraft): string[] {
  const bg = draft.background ? getBackground(draft.background) : undefined
  return bg
    ? resolveBackgroundItems(bg, draft.backgroundChoices)
      .map(item => item.id)
      .filter((id): id is string => id !== null)
    : []
}

/**
 * Os de `getUnproficientTools` que vêm do antecedente — o aviso da etapa Antecedente, onde se faz a
 * escolha que causa isso (os Dados de Osso do Soldado com proficiência em Baralho de Cartas).
 */
export function getBackgroundUnproficientTools(draft: CharacterDraft): UnproficientTool[] {
  const fromBackground = new Set(getBackgroundItemIds(draft))
  return getUnproficientTools(draft).filter(u => fromBackground.has(u.itemId))
}

/**
 * O que significa carregar a ferramenta sem proficiência, pra ler ao lado do nome: "pode usar,
 * mas não soma o bônus de proficiência nos testes com ele; continua servindo de foco de
 * conjuração". Fonte única do texto da etapa Equipamento, da Revisão e da ficha imprimível.
 */
export function describeToolWithoutProficiency(spellcastingFocus: boolean): string {
  const base = 'pode usar, mas não soma o bônus de proficiência nos testes com ele'
  return spellcastingFocus ? `${base}; continua servindo de foco de conjuração` : base
}

/**
 * Linha da Revisão, da ficha e da etapa Antecedente: "Sem proficiência: Alaúde — pode usar, mas não soma...". Item que
 * vale como outra ferramenta leva o nome dela junto: "Dados de Osso (Conjunto de Dados)".
 */
export function formatUnproficientTool({ tool, itemName, spellcastingFocus }: UnproficientTool): string {
  const name = itemName === tool.name ? tool.name : `${itemName} (${tool.name})`
  return `Sem proficiência: ${name} — ${describeToolWithoutProficiency(spellcastingFocus)}`
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

/**
 * O que o seletor de idiomas da subclasse de UMA classe (Domínio do Conhecimento) não pode
 * oferecer: todo idioma que o personagem já fala — raça, antecedente, talento, idiomas fixos e
 * escolhidos de subclasse das outras classes da multiclasse — menos os que este slot escolheu.
 * `getExcludedLanguages(draft, 'class')` não serve: ignora a fonte 'class' inteira, então
 * deixaria livres os idiomas de subclasse de outra classe.
 */
export function getExcludedLanguagesForClassSlot(draft: CharacterDraft, classId: string): string[] {
  const own = classEntries(draft).find(e => e.classId === classId)?.choices.subclassExtras.languages ?? []
  return excludedExceptOwn(getAllGrantedLanguages(draft), own)
}

/** Todos os idiomas que o personagem fala (união das fontes). */
export function getAllGrantedLanguages(draft: CharacterDraft): string[] {
  const b = getLanguagesBySource(draft)
  return uniq([...b.race, ...b.class, ...b.background, ...getFeatGrantedLanguages(draft)])
}

/**
 * Idiomas exóticos que o jogador ESCOLHEU — raça (humano, alto elfo, meio-elfo), antecedente,
 * subclasse (Domínio do Conhecimento) e talento (Poliglota). Pelo livro (p. 125) a escolha sai
 * da tabela Idiomas Padrão; um exótico só com a permissão do Mestre. A ficha deixa escolher e
 * avisa, em vez de vetar.
 *
 * Os concedidos fixos não contam (Dracônico do draconato, Infernal do tiferino, Dracônico da
 * Linhagem Dracônica): esses o livro já dá, sem depender do Mestre.
 */
export function getChosenExoticLanguages(draft: CharacterDraft): string[] {
  const race = draft.race ? getRace(draft.race) : undefined
  const entries = classEntries(draft)
  const fixed = new Set([
    ...(race?.grantedLanguages ?? []),
    ...entries.flatMap(({ classId, choices }) => subclassExtrasOf(classId, choices)?.grantedLanguages ?? []),
  ])
  const chosen = [
    ...(draft.raceChoices.languages ?? []),
    ...entries.flatMap(({ choices }) => choices.subclassExtras.languages ?? []),
    ...(draft.backgroundChoices.languages ?? []),
    ...getFeatGrantedLanguages(draft),
  ]
  return uniq(chosen).filter(id => isExoticLanguage(id) && !fixed.has(id))
}

/** Nota que acompanha a marca "*" dos idiomas de getLanguageLabels, na Revisão e no PDF. */
export const EXOTIC_LANGUAGE_NOTE = '* idioma exótico: requer permissão do Mestre (p. 125)'

/**
 * Os idiomas da ficha em texto, como a Revisão e o PDF mostram: o exótico escolhido leva "*"
 * ("Dracônico*") e `hasExoticNote` diz se a EXOTIC_LANGUAGE_NOTE deve acompanhar a lista.
 */
export function getLanguageLabels(draft: CharacterDraft): { labels: string[]; hasExoticNote: boolean } {
  const exotic = new Set(getChosenExoticLanguages(draft))
  return {
    labels: getAllGrantedLanguages(draft).map(id => `${getLanguageName(id)}${exotic.has(id) ? '*' : ''}`),
    hasExoticNote: exotic.size > 0,
  }
}
