import type { AbilityScore } from '../types/race'
import type { GameClass, CasterProgression, ArmorProficiency } from '../types/class'
import type { CharacterDraft, ClassEntry, AsiChoice } from '../types/character'
import { getClass, getAverageHpPerLevel, getHpAtLevel1 } from './classUtils'

/** Mínimo de atributo para qualquer pré-requisito de multiclasse (PHB pág. 166 — sempre 13). */
export const MULTICLASS_MIN_SCORE = 13

/** Atende ao pré-requisito de atributo para ter níveis nesta classe? (usa atributos FINAIS) */
export function meetsMulticlassPrereq(
  cls: GameClass,
  finalScores: Partial<Record<AbilityScore, number>>,
): boolean {
  const { mode, abilities } = cls.multiclassPrereq
  const ok = (ab: AbilityScore) => (finalScores[ab] ?? 0) >= MULTICLASS_MIN_SCORE
  return mode === 'any' ? abilities.some(ok) : abilities.every(ok)
}

/**
 * Atributos que impedem o pré-requisito (para mensagem de UI). Vazio quando cumpre.
 * 'any' não cumprido → devolve todos (qualquer um resolveria); 'all' → só os abaixo de 13.
 */
export function getUnmetPrereqAbilities(
  cls: GameClass,
  finalScores: Partial<Record<AbilityScore, number>>,
): AbilityScore[] {
  if (meetsMulticlassPrereq(cls, finalScores)) return []
  const { mode, abilities } = cls.multiclassPrereq
  if (mode === 'any') return abilities
  return abilities.filter(ab => (finalScores[ab] ?? 0) < MULTICLASS_MIN_SCORE)
}

/**
 * Progressão de conjuração efetiva (classe + subclasse) para o nível de conjurador combinado.
 * Guerreiro e Ladino são 'none' na classe, mas 'third' via Cavaleiro Arcano / Trapaceiro Arcano.
 */
export function getCasterProgression(
  cls: GameClass,
  subclassId: string | null | undefined,
): CasterProgression {
  if (cls.casterProgression !== 'none') return cls.casterProgression
  if (subclassId) {
    const sub = cls.subclasses.find(s => s.id === subclassId)
    if (sub?.casterProgression) return sub.casterProgression
  }
  return 'none'
}

// ── Agregação de classes (primária + adicionais) ────────────────────────────────

/** Há mais de uma classe? É o que define, mecanicamente, "é multiclasse". */
export function isMulticlassed(draft: CharacterDraft): boolean {
  return draft.additionalClasses.length > 0
}

/** Nível da classe primária = nível total (orçamento) − soma dos níveis das adicionais (mín. 1). */
export function getPrimaryLevel(draft: CharacterDraft): number {
  const additional = draft.additionalClasses.reduce((sum, c) => sum + c.level, 0)
  return Math.max(1, draft.level - additional)
}

/**
 * Todas as classes como uma lista uniforme: a primária (campos de topo do draft, com o nível
 * derivado) seguida das adicionais. Lista vazia se nenhuma classe foi escolhida. É a base para
 * iterar features/magias/PV de forma simétrica na Revisão e na ficha.
 */
export function allClassEntries(draft: CharacterDraft): ClassEntry[] {
  if (!draft.class) return []
  return [
    {
      classId: draft.class,
      level: getPrimaryLevel(draft),
      classChoices: draft.classChoices,
      spellChoices: draft.spellChoices,
      asiChoices: draft.asiChoices,
      hpRolls: draft.hpRolls,
    },
    ...draft.additionalClasses,
  ]
}

/**
 * PV total pela média. A 1ª classe (primária) recebe o dado máximo no 1º nível; todo nível
 * seguinte, de qualquer classe, usa a média do dado dela. CON soma por nível de personagem.
 * Para classe única equivale a getAverageHpAtLevel.
 */
export function getTotalHpAverage(draft: CharacterDraft, conModifier: number): number {
  let total = 0
  allClassEntries(draft).forEach((entry, i) => {
    const cls = getClass(entry.classId)
    if (!cls) return
    const avgGain = getAverageHpPerLevel(cls) + conModifier
    if (i === 0) {
      total += getHpAtLevel1(cls, conModifier) + Math.max(0, entry.level - 1) * avgGain
    } else {
      total += entry.level * avgGain
    }
  })
  return total
}

/**
 * PV total pelas rolagens. hpRolls é por classe: na primária cobre os níveis 2..L; nas adicionais
 * cobre os níveis 1..L (nenhum nível de classe adicional usa o dado máximo). Rolagem ausente cai
 * na média do dado daquela classe. Para classe única equivale a getRolledHpAtLevel.
 */
export function getTotalHpRolled(draft: CharacterDraft, conModifier: number): number {
  let total = 0
  allClassEntries(draft).forEach((entry, i) => {
    const cls = getClass(entry.classId)
    if (!cls) return
    const avgGain = getAverageHpPerLevel(cls)
    const startLevel = i === 0 ? 2 : 1
    if (i === 0) total += getHpAtLevel1(cls, conModifier)
    for (let lvl = startLevel; lvl <= entry.level; lvl++) {
      const roll = entry.hpRolls[lvl - startLevel]
      total += (roll !== undefined ? roll : avgGain) + conModifier
    }
  })
  return total
}

/** Poço de Dados de Vida agrupado por tipo de dado, do maior pro menor (ex.: 3d10 + 2d6). */
export function getHitDicePool(draft: CharacterDraft): { die: number; count: number }[] {
  const byDie = new Map<number, number>()
  for (const entry of allClassEntries(draft)) {
    const cls = getClass(entry.classId)
    if (!cls) continue
    byDie.set(cls.hitDie, (byDie.get(cls.hitDie) ?? 0) + entry.level)
  }
  return [...byDie.entries()].sort((a, b) => b[0] - a[0]).map(([die, count]) => ({ die, count }))
}

/**
 * Proficiências de armadura do personagem: as completas da classe primária + o subconjunto de
 * multiclasse (Tabela de Proficiências, PHB pág. 166) de cada classe adicional.
 */
export function getAllArmorProficiencies(draft: CharacterDraft): ArmorProficiency[] {
  const set = new Set<ArmorProficiency>()
  const primary = draft.class ? getClass(draft.class) : undefined
  primary?.armorProficiencies.forEach(a => set.add(a))
  for (const entry of draft.additionalClasses) {
    getClass(entry.classId)?.multiclassProficiencies.armor.forEach(a => set.add(a))
  }
  return [...set]
}

/** Proficiências de arma: completas da classe primária + subconjunto de multiclasse das adicionais. */
export function getAllWeaponProficiencies(draft: CharacterDraft): string[] {
  const set = new Set<string>()
  const primary = draft.class ? getClass(draft.class) : undefined
  primary?.weaponProficiencies.forEach(w => set.add(w))
  for (const entry of draft.additionalClasses) {
    getClass(entry.classId)?.multiclassProficiencies.weapons.forEach(w => set.add(w))
  }
  return [...set]
}

/** Todas as escolhas de ASI/talento do personagem (primária + adicionais), para os atributos finais. */
export function getAllAsiChoices(draft: CharacterDraft): AsiChoice[] {
  return [...draft.asiChoices, ...draft.additionalClasses.flatMap(c => c.asiChoices)]
}

/**
 * Nível de conjurador combinado (PHB pág. 166-167): soma níveis inteiros de conjuradores plenos,
 * metade (⌊÷2⌋) dos meio-conjuradores e um terço (⌊÷3⌋) dos de subclasse (Cavaleiro Arcano /
 * Trapaceiro Arcano). Bruxo (Pacto) e não-conjuradores não entram. Indexa a tabela de slots plena.
 */
export function getCombinedCasterLevel(draft: CharacterDraft): number {
  let total = 0
  for (const entry of allClassEntries(draft)) {
    const cls = getClass(entry.classId)
    if (!cls) continue
    const prog = getCasterProgression(cls, entry.classChoices.subclass)
    if (prog === 'full') total += entry.level
    else if (prog === 'half') total += Math.floor(entry.level / 2)
    else if (prog === 'third') total += Math.floor(entry.level / 3)
  }
  return total
}

/** Níveis já alocados às classes adicionais (o resto do orçamento fica com a primária). */
export function getAdditionalLevelsUsed(draft: CharacterDraft): number {
  return draft.additionalClasses.reduce((sum, c) => sum + c.level, 0)
}

/** Ainda cabe outra classe? A primária precisa manter ao menos 1 nível. */
export function canAddAnotherClass(draft: CharacterDraft): boolean {
  return getAdditionalLevelsUsed(draft) < draft.level - 1
}

/**
 * Todas as classes cumprem seus pré-requisitos de multiclasse (PHB pág. 166)? Só se aplica quando
 * há multiclasse — classe única não tem pré-requisito. Usa os atributos FINAIS (o chamador passa
 * getFinalAbilityScores; assim este módulo não depende de asiUtils, evitando ciclo de import).
 */
export function meetsAllMulticlassPrereqs(
  draft: CharacterDraft,
  finalScores: Partial<Record<AbilityScore, number>>,
): boolean {
  if (!isMulticlassed(draft)) return true
  for (const entry of allClassEntries(draft)) {
    const cls = getClass(entry.classId)
    if (!cls || !meetsMulticlassPrereq(cls, finalScores)) return false
  }
  return true
}
