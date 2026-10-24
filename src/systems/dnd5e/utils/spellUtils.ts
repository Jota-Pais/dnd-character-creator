import type { Spell, SpellClass, SpellChoices, SpellSchool } from '../types/spell'
import type { GameClass, ClassSpellcasting } from '../types/class'
import type { AbilityScore } from '../types/race'
import type { CharacterDraft, ClassEntry } from '../types/character'
import { calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { isActiveCaster, getClass, getSpellcastingSource } from './classUtils'
import { allClassEntries, getCasterProgression, getCombinedCasterLevel } from './multiclassUtils'
import spellsData from '../data/spells.json'
import progressionData from '../data/progression.json'

export const SPELLS: Spell[] = spellsData as Spell[]

const BY_ID = new Map(SPELLS.map(s => [s.id, s]))

export function getSpell(id: string): Spell | undefined {
  return BY_ID.get(id)
}

export function getSpellsByClass(classId: SpellClass | string): Spell[] {
  return SPELLS.filter(s => s.classes.includes(classId as SpellClass))
}

export function getCantrips(classId: SpellClass | string): Spell[] {
  return SPELLS.filter(s => s.level === 0 && s.classes.includes(classId as SpellClass))
}

export function getSpellsByLevel(classId: SpellClass | string, level: number): Spell[] {
  return SPELLS.filter(
    s => s.level === level && s.classes.includes(classId as SpellClass),
  )
}

// ── Progression helpers ───────────────────────────────────────────────────────

/** Tabela de espaços que a classe usa sozinha: plena, meia, um terço (via subclasse) ou Pacto. */
export type CasterType = 'full' | 'half' | 'third' | 'warlock'

/**
 * Tipo de conjurador da classe, já resolvendo a subclasse: guerreiro e ladino só conjuram como
 * Cavaleiro Arcano / Trapaceiro Arcano (um terço). Vem do `casterProgression` de classes.json.
 */
export function getCasterType(classId: string, subclassId?: string | null): CasterType | null {
  const cls = getClass(classId)
  if (!cls) return null
  const progression = getCasterProgression(cls, subclassId)
  if (progression === 'pact') return 'warlock'
  return progression === 'none' ? null : progression
}

function padSlots(row: number[]): number[] {
  return [...row, ...Array(9 - row.length).fill(0)]
}

/**
 * Espaços de magia por nível de magia (9 elementos, índice 0 = 1º nível) na tabela da própria
 * classe — ou da subclasse que conjura (Cavaleiro Arcano p. 86, Trapaceiro Arcano p. 93).
 */
export function getSpellSlots(classId: string, charLevel: number, subclassId?: string | null): number[] {
  const ctype = getCasterType(classId, subclassId)
  if (!ctype) return Array(9).fill(0)
  const idx = Math.max(1, Math.min(20, charLevel)) - 1

  if (ctype === 'warlock') {
    const entry = progressionData.spellSlots.warlock[idx]
    const arr = Array(9).fill(0)
    arr[entry.slotLevel - 1] = entry.slots
    return arr
  }
  if (ctype === 'half') return padSlots(progressionData.spellSlots.half[idx])
  if (ctype === 'third') return padSlots(progressionData.spellSlots.third[idx])
  return progressionData.spellSlots.full[idx]
}

/** Pact magic descriptor for warlocks (null for other classes). */
export function getWarlockPactSlots(charLevel: number): { slots: number; slotLevel: number } | null {
  const idx = Math.max(1, Math.min(20, charLevel)) - 1
  return progressionData.spellSlots.warlock[idx]
}

// ── Multiclasse: pool de espaços combinado (PHB pág. 166-167) ───────────────────

/**
 * Classes que compartilham o pool combinado: plenas, meias e um terço (Cavaleiro/Trapaceiro
 * Arcano), já conjurando no nível que têm. O Bruxo fica de fora (Pacto).
 */
function pooledCasterEntries(draft: CharacterDraft): ClassEntry[] {
  return allClassEntries(draft).filter(e => {
    const ct = getCasterType(e.classId, e.classChoices.subclass)
    const cls = getClass(e.classId)
    return (ct === 'full' || ct === 'half' || ct === 'third') && !!cls
      && isActiveCaster(cls, e.level, e.classChoices.subclass)
  })
}

/**
 * Espaços de magia do pool combinado (9 elementos, índice 0 = 1º nível). Com UMA classe
 * conjuradora usa a tabela própria dela (regra da classe); com DUAS ou mais, indexa a tabela
 * Multiclasse para Conjurador (= a de pleno, p. 167) pelo nível de conjurador combinado
 * (getCombinedCasterLevel: plenos inteiros, ⌊÷2⌋ dos meios, ⌊÷3⌋ dos de subclasse — p. 166).
 * O Bruxo (Pacto) nunca entra aqui — ver getPactSlots.
 */
export function getCombinedSpellSlots(draft: CharacterDraft): number[] {
  const pooled = pooledCasterEntries(draft)
  if (pooled.length === 0) return Array(9).fill(0)
  if (pooled.length === 1) return getSpellSlots(pooled[0].classId, pooled[0].level, pooled[0].classChoices.subclass)
  const level = getCombinedCasterLevel(draft)
  if (level < 1) return Array(9).fill(0)
  return progressionData.spellSlots.full[Math.min(20, level) - 1]
}

/** Espaços de Magia de Pacto do bruxo (separados do pool combinado), ou null se não houver bruxo. */
export function getPactSlots(draft: CharacterDraft): { slots: number; slotLevel: number } | null {
  const warlock = allClassEntries(draft).find(e => e.classId === 'warlock')
  const cls = getClass('warlock')
  if (!warlock || !cls || !isActiveCaster(cls, warlock.level)) return null
  return getWarlockPactSlots(warlock.level)
}

/**
 * Maior nível de magia que a classe aprende, pela tabela DELA (0 = nenhum). Na multiclasse as
 * magias conhecidas seguem cada classe "como se fosse um membro de única classe" (p. 166).
 */
export function getMaxSpellLevel(classId: string, charLevel: number, subclassId?: string | null): number {
  const slots = getSpellSlots(classId, charLevel, subclassId)
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] > 0) return i + 1
  }
  return 0
}

/**
 * Truques conhecidos no nível dado (0 se não houver tabela). `casterId` é a classe, ou a
 * subclasse que conjura (eldritch-knight, arcane-trickster) — ver getSpellcastingSource.
 */
export function getCantripsKnownCount(casterId: string, charLevel: number): number {
  const table = (progressionData.cantripsKnown as Record<string, number[]>)[casterId]
  if (!table) return 0
  return table[Math.max(1, Math.min(20, charLevel)) - 1]
}

/** Magias conhecidas (conjuradores `known`) no nível dado; `casterId` como em getCantripsKnownCount. */
export function getSpellsKnownCount(casterId: string, charLevel: number): number {
  const table = (progressionData.spellsKnown as Record<string, number[]>)[casterId]
  if (!table) return 0
  return table[Math.max(1, Math.min(20, charLevel)) - 1]
}

// ── Conjuração por classe da ficha (classe ou subclasse) ──────────────────────

/**
 * A conjuração de uma classe da ficha, já resolvida: quem conjura (a classe ou a subclasse que dá
 * conjuração), a lista de onde escolhe e o rótulo. É a fonte única que a etapa Magias, a
 * Revisão, a ficha imprimível e a validação consultam — nunca `cls.spellcasting` direto.
 */
export type EntrySpellcasting = {
  spellcasting: ClassSpellcasting
  /** Chave das tabelas de progression.json: id da classe, ou da subclasse que conjura. */
  casterId: string
  /** Lista de magias de onde escolhe (o mago, para o Cavaleiro e o Trapaceiro Arcano). */
  spellList: SpellClass
  /** "Mago", ou "Guerreiro (Cavaleiro Arcano)" quando a conjuração vem da subclasse. */
  label: string
}

export function getEntrySpellcasting(
  cls: GameClass | null | undefined,
  subclassId?: string | null,
): EntrySpellcasting | null {
  if (!cls) return null
  const source = getSpellcastingSource(cls, subclassId)
  if (!source) return null
  return {
    spellcasting: source.spellcasting,
    casterId: source.id,
    spellList: source.spellcasting.spellList ?? (cls.id as SpellClass),
    label: source.subclass ? `${cls.name} (${source.subclass.name})` : cls.name,
  }
}

/** Truques que a conjuração dá sem escolha (Trapaceiro Arcano: mãos mágicas). */
export function getRequiredCantrips(spellcasting: ClassSpellcasting): string[] {
  return spellcasting.requiredCantrips ?? []
}

/** Total de truques conhecidos no nível (os dados de graça inclusos). */
export function getCantripsNeeded(casting: EntrySpellcasting, classLevel: number): number {
  return getCantripsKnownCount(casting.casterId, classLevel) || casting.spellcasting.cantripsKnown
}

/** Truques conhecidos: os que a característica dá, mais os escolhidos (sem repetir). */
export function getKnownCantrips(spellcasting: ClassSpellcasting, choices: SpellChoices): string[] {
  return [...new Set([...getRequiredCantrips(spellcasting), ...choices.cantrips])]
}

/** Uma classe da ficha que conjura no nível que tem nela, com as magias que conhece. */
export type CasterEntry = {
  entry: ClassEntry
  cls: GameClass
  casting: EntrySpellcasting
  /** Truques conhecidos, os dados pela característica inclusos (mãos mágicas do Trapaceiro). */
  cantrips: string[]
  spells: string[]
}

/** Classes conjuradoras ativas da ficha (primária + adicionais), na ordem da multiclasse. */
export function getCasterEntries(draft: CharacterDraft): CasterEntry[] {
  return allClassEntries(draft).flatMap(entry => {
    const cls = getClass(entry.classId)
    const subclass = entry.classChoices.subclass
    const casting = getEntrySpellcasting(cls, subclass)
    if (!cls || !casting || !isActiveCaster(cls, entry.level, subclass)) return []
    return [{
      entry,
      cls,
      casting,
      cantrips: getKnownCantrips(casting.spellcasting, entry.spellChoices),
      spells: entry.spellChoices.spells,
    }]
  })
}

// ── Restrição de escola (Cavaleiro Arcano p. 86, Trapaceiro Arcano p. 93) ──────

export type SchoolRestrictionStatus = {
  schools: SpellSchool[]
  /** Quantas magias conhecidas podem ser de qualquer escola até este nível da classe. */
  freeSlots: number
  /** Quantas das escolhidas já estão fora das escolas. */
  freeUsed: number
}

/** A magia (de 1° nível ou superior) cai fora das escolas da restrição? Truques nunca. */
export function isOutsideSchoolRestriction(spellcasting: ClassSpellcasting, spell: Spell): boolean {
  const restriction = spellcasting.schoolRestriction
  return !!restriction && spell.level > 0 && !restriction.schools.includes(spell.school)
}

/**
 * Situação da restrição de escola: as escolhas livres acumuladas até o nível da classe (uma das três
 * iniciais e as do 8°, 14° e 20°) contra as escolhidas fora da escola. null sem restrição.
 */
export function getSchoolRestrictionStatus(
  spellcasting: ClassSpellcasting,
  classLevel: number,
  spellIds: string[],
): SchoolRestrictionStatus | null {
  const restriction = spellcasting.schoolRestriction
  if (!restriction) return null
  const freeSlots = restriction.freeChoices
    .filter(c => classLevel >= c.level)
    .reduce((sum, c) => sum + c.count, 0)
  const freeUsed = spellIds.filter(id => {
    const spell = getSpell(id)
    return !!spell && isOutsideSchoolRestriction(spellcasting, spell)
  }).length
  return { schools: restriction.schools, freeSlots, freeUsed }
}

/** A restrição de escola ainda deixa acrescentar esta magia? (fora da escola só com escolha livre sobrando) */
export function isAllowedBySchoolRestriction(
  spellcasting: ClassSpellcasting,
  classLevel: number,
  spellIds: string[],
  spell: Spell,
): boolean {
  if (!isOutsideSchoolRestriction(spellcasting, spell)) return true
  const status = getSchoolRestrictionStatus(spellcasting, classLevel, spellIds)
  return !status || status.freeUsed < status.freeSlots
}

/** Wizard spellbook size at a given level (6 at level 1, +2 per level). */
export function getWizardSpellbookSize(charLevel: number): number {
  return 6 + 2 * (Math.max(1, charLevel) - 1)
}

// ── Spell casting stats ───────────────────────────────────────────────────────

export function getSpellSaveDC(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  return 8 + getProficiencyBonus(level) + calculateModifier(score)
}

export function getSpellAttackBonus(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  return getProficiencyBonus(level) + calculateModifier(score)
}

export function formatSpellAttackBonus(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): string {
  const bonus = getSpellAttackBonus(spellcasting, abilityScores, level)
  return bonus >= 0 ? `+${bonus}` : `${bonus}`
}

/** Foco e rituais de uma classe conjuradora, já em texto — a Revisão e a ficha imprimível leem daqui. */
export type CastingAids = {
  /** `null` quando o livro não dá foco à classe (patrulheiro do PHB 2014). */
  focus: string | null
  /** `null` quando a classe não conjura rituais. */
  ritual: string | null
}

/**
 * O foco substitui os componentes materiais que não têm custo indicado (p. 204) — é o que faz o
 * alaúde do bardo valer pela "lã" da Ilusão Menor. O ritual leva 10 minutos a mais e não gasta
 * espaço (p. 202); quais magias valem depende da classe: o mago usa qualquer uma do grimório, mesmo
 * sem prepará-la (p. 96); os demais, as que têm preparadas ou conhecem (p. 202).
 */
export function describeCastingAids(spellcasting: ClassSpellcasting): CastingAids {
  const focus = spellcasting.focus
    ? `Foco de conjuração: ${spellcasting.focus} — substitui componentes materiais sem custo indicado.`
    : null
  if (!spellcasting.ritualCasting) return { focus, ritual: null }
  const which = spellcasting.type === 'hybrid'
    ? 'qualquer magia com o descritor ritual que esteja no grimório, mesmo sem prepará-la'
    : spellcasting.type === 'prepared'
      ? 'as magias com o descritor ritual que você tem preparadas'
      : 'as magias com o descritor ritual que você conhece'
  return { focus, ritual: `Rituais: conjura como ritual ${which} (+10 minutos, sem gastar espaço).` }
}

export function getMaxPreparedSpells(
  spellcasting: ClassSpellcasting,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  level = 1,
): number {
  const score = abilityScores[spellcasting.ability] ?? 10
  const modifier = calculateModifier(score)
  if (spellcasting.preparedFormula?.includes('metade')) {
    // Paladin: floor(level/2) + modifier
    return Math.max(1, Math.floor(level / 2) + modifier)
  }
  return Math.max(1, modifier + level)
}

/**
 * Quantas magias de 1° nível ou superior a classe escolhe na etapa: preparadas (fórmula), o
 * grimório do mago, ou as conhecidas da tabela (a da subclasse, no Cavaleiro/Trapaceiro Arcano).
 */
export function getSpellsToChoose(
  casting: EntrySpellcasting,
  classLevel: number,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
): number {
  const sc = casting.spellcasting
  if (sc.type === 'prepared') return getMaxPreparedSpells(sc, abilityScores, classLevel)
  if (sc.type === 'hybrid') return getWizardSpellbookSize(classLevel)
  return getSpellsKnownCount(casting.casterId, classLevel) || sc.spellsAtLevel1
}

/** Magias escolhidas além do teto da classe (ver getSpellChoiceOverflow). */
export type SpellChoiceOverflow = {
  /** "Clérigo", ou "Guerreiro (Cavaleiro Arcano)". */
  label: string
  chosen: number
  max: number
  excess: number
  /** Texto pronto para a etapa Magias, a Revisão e a ficha imprimível. */
  text: string
}

/**
 * Mais magias escolhidas do que o teto da classe permite com os atributos FINAIS (raça +
 * aprimoramentos) — tipicamente o jogador voltou e baixou o atributo de conjuração de um
 * conjurador preparado. A ficha não decide qual magia sai: nada é apagado, vira aviso.
 * null quando está dentro do teto.
 */
export function getSpellChoiceOverflow(
  caster: CasterEntry,
  finalScores: Partial<Record<AbilityScore, number | null>>,
): SpellChoiceOverflow | null {
  const max = getSpellsToChoose(caster.casting, caster.entry.level, finalScores)
  const chosen = caster.spells.length
  if (max === Infinity || chosen <= max) return null
  const excess = chosen - max
  const type = caster.casting.spellcasting.type
  const what = type === 'prepared' ? 'magias preparadas'
    : type === 'hybrid' ? 'magias no grimório'
    : 'magias conhecidas'
  const label = caster.casting.label
  return {
    label,
    chosen,
    max,
    excess,
    text: `${label}: ${chosen} ${what}, mas o máximo é ${max} — ${excess} a mais. Desmarque ${excess === 1 ? 'uma' : excess} na etapa Magias.`,
  }
}

export function isSpellStepComplete(
  cls: GameClass | null,
  choices: SpellChoices,
  level = 1,
  subclassId?: string | null,
): boolean {
  const casting = getEntrySpellcasting(cls, subclassId)
  if (!cls || !casting) return true
  if (!isActiveCaster(cls, level, subclassId)) return true

  const sc = casting.spellcasting
  const cantripsNeeded = getCantripsNeeded(casting, level)

  if (cantripsNeeded > 0 && getKnownCantrips(sc, choices).length < cantripsNeeded) return false

  if (sc.type === 'known') {
    const needed = getSpellsKnownCount(casting.casterId, level) || sc.spellsAtLevel1
    if (needed > 0 && choices.spells.length < needed) return false
  }

  // Cavaleiro/Trapaceiro Arcano: mais magias fora da escola do que as escolhas livres permitem.
  const school = getSchoolRestrictionStatus(sc, level, choices.spells)
  if (school && school.freeUsed > school.freeSlots) return false

  if (sc.type === 'hybrid') {
    const needed = getWizardSpellbookSize(level)
    if (choices.spells.length < needed) return false
  }

  // Conjuradores preparados: PHB exige preparar ao menos 1 magia (mín. da fórmula).
  // O teto (mod + nível) é imposto na seleção; aqui garantimos que não finalize com 0.
  if (sc.type === 'prepared') {
    if (choices.spells.length < 1) return false
  }

  return true
}

export const SCHOOL_COLORS: Record<string, string> = {
  abjuração:   '#2e86c1',
  adivinhação: '#8e44ad',
  conjuração:  '#1e8449',
  encantamento:'#c0392b',
  evocação:    '#d35400',
  ilusão:      '#7d3c98',
  necromancia: '#2c3e50',
  transmutação:'#b7770d',
}

export const SCHOOL_EMOJI: Record<string, string> = {
  abjuração:   '🛡️',
  adivinhação: '🔮',
  conjuração:  '🌀',
  encantamento:'💫',
  evocação:    '✨',
  ilusão:      '👁️',
  necromancia: '💀',
  transmutação:'⚗️',
}
