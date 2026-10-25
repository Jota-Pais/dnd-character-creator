import type { Spell, SpellClass, SpellChoices, SpellSchool } from '../types/spell'
import type { GameClass, ClassSpellcasting } from '../types/class'
import type { AbilityScore } from '../types/race'
import type { CharacterDraft, ClassEntry } from '../types/character'
import { calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { isActiveCaster, getClass, getSpellcastingSource } from './classUtils'
import { allClassEntries, getCasterProgression, getCombinedCasterLevel } from './multiclassUtils'
import { getKnownColumnSecretIds, getProgressionSlotsUpToLevel, getProgressionSpellIds, isSpellChoiceSlot } from './progressionChoiceUtils'
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

/** Segredos Mágicos que ocupam vaga das colunas de conhecidas, já separados por coluna. */
export type KnownColumnSecrets = { cantrips: string[]; spells: string[] }

/**
 * Os Segredos Mágicos do bardo "já estão incluídos no número da coluna Magias Conhecidas" (p. 54):
 * escolhidos nos slots com `countsAsKnownSpell`, ocupam vaga da tabela em vez de somar por cima.
 * Decisão do usuário (2026-10-25) para o que o livro não diz: Segredo escolhido como magia ocupa
 * vaga de Magias Conhecidas; escolhido como TRUQUE, ocupa vaga de Truques Conhecidos. Os Adicionais
 * do Colégio do Conhecimento (p. 55) "não contam no número" e ficam de fora.
 */
export function getKnownColumnSecrets(
  classId: string,
  subclassId: string | null | undefined,
  classLevel: number,
  progressionChoices: Record<string, string[]> | undefined,
): KnownColumnSecrets {
  const ids = getKnownColumnSecretIds(classId, subclassId ?? null, classLevel, progressionChoices ?? {})
  const cantrips: string[] = []
  const spells: string[] = []
  for (const id of ids) {
    const spell = getSpell(id)
    if (!spell) continue
    if (spell.level === 0) cantrips.push(id)
    else spells.push(id)
  }
  return { cantrips, spells }
}

/**
 * Quantos Segredos Mágicos (slots `countsAsKnownSpell`) podem ser truque: a coluna Truques
 * Conhecidos inteira da classe no nível que tem nela (decisão do usuário, ver
 * getKnownColumnSecrets). `used` são os que já são truque. O seletor da etapa Classe não deixa
 * passar de `max`, e getSecretSpellIssues reprova a ficha antiga ou importada que passou.
 */
export function getSecretCantripRoom(
  classId: string,
  subclassId: string | null | undefined,
  classLevel: number,
  progressionChoices: Record<string, string[]> | undefined,
): { max: number; used: string[] } {
  const casting = getEntrySpellcasting(getClass(classId), subclassId)
  const max = casting ? getCantripsNeeded(casting, classLevel) : 0
  return { max, used: getKnownColumnSecrets(classId, subclassId, classLevel, progressionChoices).cantrips }
}

/** Um problema nos Segredos Mágicos de uma classe que só se resolve na etapa Classe. */
export type SecretSpellIssue =
  | {
      kind: 'too-many-cantrips'
      /** Os Segredos que são truque. */
      cantrips: string[]
      /** Vagas da coluna Truques Conhecidos. */
      max: number
      excess: number
    }
  | {
      kind: 'above-level'
      /** "Segredos Mágicos" — o rótulo do slot onde a magia está. */
      slotLabel: string
      spellId: string
      spellLevel: number
      /** Maior nível que a classe conjura pela tabela dela (getMaxSpellLevel). */
      maxLevel: number
    }

/**
 * Segredos Mágicos que a etapa Classe precisa trocar: magia acima do nível que a classe conjura
 * ("de um nível que você possa conjurar, como mostrado na tabela O Bardo", pp. 54-55 — vale
 * também para os Adicionais do Conhecimento) e mais truques do que a coluna Truques Conhecidos
 * comporta. A etapa Classe reprova (draftValidation) e diz o motivo (pendingReasons).
 */
export function getSecretSpellIssues(
  classId: string,
  subclassId: string | null | undefined,
  classLevel: number,
  progressionChoices: Record<string, string[]> | undefined,
): SecretSpellIssue[] {
  const issues: SecretSpellIssue[] = []
  const maxLevel = getMaxSpellLevel(classId, classLevel, subclassId)
  for (const slot of getProgressionSlotsUpToLevel(classId, subclassId ?? null, classLevel).filter(isSpellChoiceSlot)) {
    for (const spellId of progressionChoices?.[slot.id] ?? []) {
      const spell = getSpell(spellId)
      if (spell && spell.level > maxLevel) {
        issues.push({ kind: 'above-level', slotLabel: slot.label, spellId, spellLevel: spell.level, maxLevel })
      }
    }
  }
  const room = getSecretCantripRoom(classId, subclassId, classLevel, progressionChoices)
  if (room.used.length > room.max) {
    issues.push({ kind: 'too-many-cantrips', cantrips: room.used, max: room.max, excess: room.used.length - room.max })
  }
  return issues
}

/** Uma classe da ficha que conjura no nível que tem nela, com as magias que conhece. */
export type CasterEntry = {
  entry: ClassEntry
  cls: GameClass
  casting: EntrySpellcasting
  /** Truques conhecidos, os dados pela característica inclusos (mãos mágicas do Trapaceiro). */
  cantrips: string[]
  spells: string[]
  /**
   * Magias aprendidas em Segredos Mágicos (bardo 10/14/18, p. 54; Colégio do Conhecimento 6,
   * p. 55), guardadas nas escolhas de progressão e não em `spells`. Contam como magias da classe,
   * então a Revisão e a ficha imprimível as mostram junto das dela. Podem incluir truques.
   */
  bonusSpells: string[]
  /** Os de `bonusSpells` que ocupam vaga de Truques/Magias Conhecidas (getKnownColumnSecrets). */
  knownSecrets: KnownColumnSecrets
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
      bonusSpells: getProgressionSpellIds(entry),
      knownSecrets: getKnownColumnSecrets(entry.classId, subclass, entry.level, entry.classChoices.progressionChoices),
    }]
  })
}

/** Um grupo de Segredos Mágicos da Revisão e da ficha imprimível (getSecretSpellGroups). */
export type SecretSpellGroup = {
  kind: 'in-columns' | 'additional'
  /** "Segredos Mágicos (contam nas conhecidas)" ou "Segredos Mágicos Adicionais (por cima das conhecidas)". */
  title: string
  spells: Spell[]
}

/**
 * Os Segredos da classe em dois grupos, para quem lê a ficha saber quais estão dentro do número de
 * conhecidas: os Segredos Mágicos do bardo, que ocupam vaga das colunas (p. 54, knownSecrets), e os
 * Adicionais do Colégio do Conhecimento, que vêm por cima (p. 55). Grupo vazio fica de fora.
 */
export function getSecretSpellGroups(caster: CasterEntry): SecretSpellGroup[] {
  const inColumns = new Set([...caster.knownSecrets.cantrips, ...caster.knownSecrets.spells])
  const toSpells = (ids: string[]) => ids.map(getSpell).filter((s): s is Spell => s !== undefined)
  const groups: SecretSpellGroup[] = [
    {
      kind: 'in-columns',
      title: 'Segredos Mágicos (contam nas conhecidas)',
      spells: toSpells(caster.bonusSpells.filter(id => inColumns.has(id))),
    },
    {
      kind: 'additional',
      title: 'Segredos Mágicos Adicionais (por cima das conhecidas)',
      spells: toSpells(caster.bonusSpells.filter(id => !inColumns.has(id))),
    },
  ]
  return groups.filter(g => g.spells.length > 0)
}

/** "Bola de Fogo (3º)", "Raio de Fogo (truque)" — como um Segredo aparece na Revisão e no PDF. */
export function formatSecretSpellName(spell: Spell): string {
  return `${spell.name} (${spell.level === 0 ? 'truque' : `${spell.level}º`})`
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

/**
 * Uma coluna de conhecidas (truques ou magias) da etapa Magias: o total da tabela, quanto os
 * Segredos Mágicos já ocupam e quanto sobra para escolher. Um Segredo que repete uma escolhida
 * não ocupa duas vagas (conta uma vez só).
 */
export type KnownColumn = {
  /** Vagas da coluna: tabela, fórmula de preparadas ou grimório. */
  total: number
  /** Escolhidas na etapa (nos truques, com os dados pela característica). */
  chosen: number
  /** Vagas que os Segredos Mágicos já ocupam. */
  fromSecrets: number
  /** O que a etapa deixa escolher: total − fromSecrets. */
  toChoose: number
}

function buildColumn(total: number, chosenIds: string[], secretIds: string[]): KnownColumn {
  const fromSecrets = secretIds.filter(id => !chosenIds.includes(id)).length
  return {
    total,
    chosen: chosenIds.length,
    fromSecrets,
    toChoose: total === Infinity ? Infinity : Math.max(0, total - fromSecrets),
  }
}

/** A coluna Truques Conhecidos da classe, com os Segredos Mágicos que a ocupam. */
export function getCantripColumn(
  casting: EntrySpellcasting,
  classLevel: number,
  choices: SpellChoices,
  secrets: KnownColumnSecrets,
): KnownColumn {
  return buildColumn(
    getCantripsNeeded(casting, classLevel),
    getKnownCantrips(casting.spellcasting, choices),
    secrets.cantrips,
  )
}

/** A coluna de magias (conhecidas, preparadas ou grimório), com os Segredos Mágicos que a ocupam. */
export function getSpellColumn(
  casting: EntrySpellcasting,
  classLevel: number,
  abilityScores: Partial<Record<AbilityScore, number | null>>,
  choices: SpellChoices,
  secrets: KnownColumnSecrets,
): KnownColumn {
  return buildColumn(getSpellsToChoose(casting, classLevel, abilityScores), choices.spells, secrets.spells)
}

/** "12 + 2 de Segredos Mágicos = 14" — de onde vem o total da coluna; null sem Segredo ocupando vaga. */
export function describeSecretsInColumn(column: KnownColumn): string | null {
  if (column.fromSecrets === 0 || column.total === Infinity) return null
  return `${column.toChoose} + ${column.fromSecrets} de Segredos Mágicos = ${column.total}`
}

/** Escolhas além do teto de uma coluna (ver getSpellChoiceOverflows). */
export type SpellChoiceOverflow = {
  /** "Clérigo", ou "Guerreiro (Cavaleiro Arcano)". */
  label: string
  /** Total na coluna: as escolhidas mais as vagas dos Segredos Mágicos. */
  chosen: number
  max: number
  excess: number
  /** Quantas vagas os Segredos Mágicos ocupam nesse total. */
  fromSecrets: number
  /** Texto pronto para a etapa Magias, a Revisão e a ficha imprimível. */
  text: string
}

function countWord(n: number, one: string): string {
  return n === 1 ? one : String(n)
}

/**
 * Mais magias do que o teto da classe permite com os atributos FINAIS (raça + aprimoramentos) —
 * o jogador voltou e baixou o atributo de um conjurador preparado — ou, no bardo, escolhidas
 * contando os Segredos Mágicos por cima (fichas salvas antes de eles ocuparem vaga, p. 54). A
 * ficha não decide qual magia sai: nada é apagado, vira aviso. null quando está dentro do teto.
 */
export function getSpellChoiceOverflow(
  caster: CasterEntry,
  finalScores: Partial<Record<AbilityScore, number | null>>,
): SpellChoiceOverflow | null {
  const col = getSpellColumn(caster.casting, caster.entry.level, finalScores, caster.entry.spellChoices, caster.knownSecrets)
  const chosen = col.chosen + col.fromSecrets
  const max = col.total
  if (max === Infinity || chosen <= max) return null
  const excess = chosen - max
  const type = caster.casting.spellcasting.type
  const what = type === 'prepared' ? 'magias preparadas'
    : type === 'hybrid' ? 'magias no grimório'
    : 'magias conhecidas'
  const label = caster.casting.label
  const text = col.fromSecrets > max
    ? secretsOverflowText(label, col, 'magias de 1º nível ou mais', 'Magias Conhecidas', 'por um truque', 'as', 'escolhidas')
    : col.fromSecrets === 0
    ? `${label}: ${chosen} ${what}, mas o máximo é ${max} — ${excess} a mais. Desmarque ${countWord(excess, 'uma')} na etapa Magias.`
    : `${label}: ${col.chosen} ${what} escolhidas + ${col.fromSecrets} de Segredos Mágicos = ${chosen}, mas o máximo é ${max} — ${excess} a mais. `
      + `Os Segredos Mágicos já ocupam vaga de Magias Conhecidas (p. 54): desmarque ${countWord(excess, 'uma')} das ${col.chosen} escolhidas na etapa Magias `
      + `(fica ${col.chosen - excess} + ${col.fromSecrets} = ${max}).`
  return { label, chosen, max, excess, fromSecrets: col.fromSecrets, text }
}

/**
 * Os Segredos Mágicos sozinhos passam da coluna: desmarcar na etapa Magias não resolve, a troca é
 * de Segredo, na etapa Classe (que fica pendente — getSecretSpellIssues). As escolhidas na etapa
 * Magias, se houver, também sobram.
 */
function secretsOverflowText(
  label: string,
  col: KnownColumn,
  what: string,
  column: string,
  swapFor: string,
  article: 'os' | 'as',
  chosenWord: string,
): string {
  const secretsExcess = col.fromSecrets - col.total
  const also = col.chosen > 0 ? ` Depois, desmarque ${article} ${col.chosen} ${chosenWord} na etapa Magias: a coluna fica toda com os Segredos.` : ''
  return `${label}: ${col.fromSecrets} Segredos Mágicos são ${what}, mas a coluna ${column} tem ${col.total}. `
    + `Na etapa Classe, troque ${secretsExcess} desses Segredos ${swapFor}.${also}`
}

/**
 * Mais truques do que a coluna Truques Conhecidos — no bardo, um Segredo Mágico escolhido como
 * truque, que ocupa vaga dessa coluna (decisão do usuário, ver getKnownColumnSecrets). Aviso,
 * nada apagado. null quando está dentro do teto.
 */
export function getCantripChoiceOverflow(caster: CasterEntry): SpellChoiceOverflow | null {
  const col = getCantripColumn(caster.casting, caster.entry.level, caster.entry.spellChoices, caster.knownSecrets)
  const chosen = col.chosen + col.fromSecrets
  const max = col.total
  if (chosen <= max) return null
  const excess = chosen - max
  const label = caster.casting.label
  const text = col.fromSecrets > max
    ? secretsOverflowText(label, col, 'truques', 'Truques Conhecidos', 'por magia de 1º nível ou mais', 'os', 'escolhidos')
    : col.fromSecrets === 0
    ? `${label}: ${chosen} truques, mas o máximo é ${max} — ${excess} a mais. Desmarque ${countWord(excess, 'um')} na etapa Magias.`
    : `${label}: ${col.chosen} truques escolhidos + ${col.fromSecrets} de Segredos Mágicos = ${chosen}, mas o máximo é ${max} — ${excess} a mais. `
      + `O Segredo Mágico escolhido como truque ocupa vaga de Truques Conhecidos: desmarque ${countWord(excess, 'um')} dos ${col.chosen} escolhidos na etapa Magias `
      + `(fica ${col.chosen - excess} + ${col.fromSecrets} = ${max}).`
  return { label, chosen, max, excess, fromSecrets: col.fromSecrets, text }
}

/** Os avisos de excesso da classe — truques e magias — na ordem em que a ficha mostra. */
export function getSpellChoiceOverflows(
  caster: CasterEntry,
  finalScores: Partial<Record<AbilityScore, number | null>>,
): SpellChoiceOverflow[] {
  return [getCantripChoiceOverflow(caster), getSpellChoiceOverflow(caster, finalScores)]
    .filter((o): o is SpellChoiceOverflow => o !== null)
}

export function isSpellStepComplete(
  cls: GameClass | null,
  choices: SpellChoices,
  level = 1,
  subclassId?: string | null,
  /** Escolhas de progressão da classe: os Segredos Mágicos ocupam vaga das colunas (p. 54). */
  progressionChoices: Record<string, string[]> = {},
): boolean {
  const casting = getEntrySpellcasting(cls, subclassId)
  if (!cls || !casting) return true
  if (!isActiveCaster(cls, level, subclassId)) return true

  const sc = casting.spellcasting
  const secrets = getKnownColumnSecrets(cls.id, subclassId, level, progressionChoices)

  const cantrips = getCantripColumn(casting, level, choices, secrets)
  if (cantrips.total > 0 && cantrips.chosen + cantrips.fromSecrets < cantrips.total) return false

  if (sc.type === 'known') {
    const needed = getSpellsKnownCount(casting.casterId, level) || sc.spellsAtLevel1
    const fromSecrets = secrets.spells.filter(id => !choices.spells.includes(id)).length
    if (needed > 0 && choices.spells.length + fromSecrets < needed) return false
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
