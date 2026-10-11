import type { CharacterDraft, FeatSelections } from '../types/character'
import type { Feat } from '../types/feat'
import type { ArmorProficiency, LevelFeature } from '../types/class'
import type { AbilityScore } from '../types/race'
import type { ConditionalAcBonus } from '../types/effects'
import { getFeat } from './featUtils'
import { getClass, getSubclass, getClassFeaturesUpToLevel } from './classUtils'
import { getProficiencyBonus } from './abilityScoreUtils'
import {
  allClassEntries, getAllAsiChoices, getTotalHpAverage, getTotalHpRolled,
} from './multiclassUtils'

/**
 * Agregador dos efeitos que a ficha aplica sozinha, atravessando as fontes de característica
 * (talentos e features de classe; raça entra no mesmo formato quando for estruturada).
 * Espelha `src/systems/ordem/utils/sheetEffects.ts`.
 *
 * Regra geral: efeito INCONDICIONAL entra no número da ficha; efeito CONDICIONAL vira linha
 * própria com a condição, porque somá-lo seria mentir — o +1 do Ambidestro não vale quando você
 * está de escudo.
 *
 * Fica num módulo próprio, e não em `featUtils`, porque cruza talento com nível e com o draft
 * inteiro; `featUtils` continua sendo só o acesso ao catálogo.
 */

/** Uma linha de efeito na ficha: o valor e de onde ele veio. */
export type SheetEffect<T> = { source: string; value: T }

/**
 * Talentos que o personagem possui, por qualquer via: o do Humano Variante e os escolhidos em
 * cada espaço de ASI (da classe primária e das adicionais). Sem repetir — o livro não deixa pegar
 * o mesmo talento duas vezes, mas a ficha não deve dobrar o bônus se isso escapar.
 */
export function getOwnedFeats(draft: CharacterDraft): Feat[] {
  const ids = [
    ...(draft.raceChoices.feat ? [draft.raceChoices.feat] : []),
    ...getAllAsiChoices(draft)
      .filter(c => c.kind === 'feat')
      .map(c => (c as { featId: string }).featId)
      .filter(Boolean),
  ]
  return [...new Set(ids)]
    .map(getFeat)
    .filter((f): f is Feat => f !== undefined)
}

/**
 * Features de classe e subclasse que o personagem tem, de cada classe no nível que tem NELA: um
 * Guerreiro 5 / Bardo 1 não tem a Versatilidade do bardo 2.
 */
export function getOwnedClassFeatures(draft: CharacterDraft): LevelFeature[] {
  return allClassEntries(draft).flatMap(entry => {
    const cls = getClass(entry.classId)
    if (!cls) return []
    const sub = entry.classChoices.subclass ? getSubclass(cls, entry.classChoices.subclass) : null
    return getClassFeaturesUpToLevel(cls, sub ?? null, entry.level)
  })
}

/** Percorre os talentos possuídos extraindo um efeito, junto com o nome de quem concedeu. */
function collect<T>(draft: CharacterDraft, pick: (feat: Feat) => T | undefined): SheetEffect<T>[] {
  const out: SheetEffect<T>[] = []
  for (const feat of getOwnedFeats(draft)) {
    const value = pick(feat)
    if (value !== undefined) out.push({ source: feat.name, value })
  }
  return out
}

// ── Testes de habilidade ───────────────────────────────────────────────────────

/** Quanto do bônus de proficiência um teste de habilidade leva: nada, inteiro ou dobrado. */
export type CheckProficiency = 'none' | 'proficient' | 'expertise'

/** Tem Versatilidade (bardo 2+)? Metade do bônus em todo teste de habilidade sem proficiência. */
export function hasHalfProficiencyOnChecks(draft: CharacterDraft): boolean {
  return getOwnedClassFeatures(draft).some(f => f.effects?.halfProficiencyOnChecks)
}

/**
 * A parcela do bônus de proficiência num TESTE DE HABILIDADE — perícia, iniciativa, valor passivo.
 *
 * O livro aplica o bônus uma vez só e o multiplica uma vez só (p. 175): dobrado com
 * Especialização, inteiro com proficiência e, sem proficiência, metade arredondada para baixo
 * para quem tem Versatilidade. Os três nunca se somam. Resistência e ataque não passam por aqui —
 * Versatilidade é só de teste de habilidade.
 */
export function getCheckProficiencyBonus(draft: CharacterDraft, proficiency: CheckProficiency): number {
  const prof = getProficiencyBonus(draft.level ?? 1)
  if (proficiency === 'expertise') return prof * 2
  if (proficiency === 'proficient') return prof
  return hasHalfProficiencyOnChecks(draft) ? Math.floor(prof / 2) : 0
}

// ── Iniciativa ─────────────────────────────────────────────────────────────────

/**
 * Bônus de iniciativa além da Destreza. Iniciativa é um teste de Destreza (p. 179) sem
 * proficiência, então a Versatilidade entra aqui como linha própria.
 */
export function getInitiativeBonuses(draft: CharacterDraft): SheetEffect<number>[] {
  const fromFeats = collect(draft, f => f.effects?.initiativeBonus)
  const half = getCheckProficiencyBonus(draft, 'none')
  return half > 0 ? [...fromFeats, { source: 'Versatilidade', value: half }] : fromFeats
}

/** Soma dos bônus de iniciativa (Alerta +5, Versatilidade). Entra direto no número da ficha. */
export function getInitiativeBonusTotal(draft: CharacterDraft): number {
  return getInitiativeBonuses(draft).reduce((sum, e) => sum + e.value, 0)
}

// ── Deslocamento ───────────────────────────────────────────────────────────────

export function getSpeedBonuses(draft: CharacterDraft): SheetEffect<number>[] {
  return collect(draft, f => f.effects?.speedBonus)
}

/** Bônus de deslocamento em PÉS, a unidade da raça (Mobilidade +10 pés). */
export function getSpeedBonusTotal(draft: CharacterDraft): number {
  return getSpeedBonuses(draft).reduce((sum, e) => sum + e.value, 0)
}

// ── Pontos de vida ─────────────────────────────────────────────────────────────

/**
 * PV extras de talento no nível dado (Robusto: 2 × nível). Some ao total de PV, não ao dado de
 * vida — o livro fala em "máximo de pontos de vida", não em rolagem.
 */
export function getFeatHpBonus(draft: CharacterDraft, level: number): number {
  return getOwnedFeats(draft).reduce((sum, f) => sum + (f.effects?.hpPerLevel ?? 0) * level, 0)
}

/**
 * PV totais da ficha: o poço de dados de vida das classes mais os extras de talento. Mora aqui,
 * e não em `multiclassUtils`, porque só este módulo enxerga os talentos — e `multiclassUtils`
 * não pode importá-lo (é ele quem fornece `getAllAsiChoices`).
 */
export function getTotalHp(draft: CharacterDraft, conModifier: number): number {
  const base = draft.hpMethod === 'roll'
    ? getTotalHpRolled(draft, conModifier)
    : getTotalHpAverage(draft, conModifier)
  return base + getFeatHpBonus(draft, draft.level ?? 1)
}

// ── Valores passivos ───────────────────────────────────────────────────────────

/** Bônus no valor PASSIVO de uma perícia (Observador +5 em Percepção e Investigação). */
export function getPassiveScoreBonus(draft: CharacterDraft, skillId: string): number {
  return getOwnedFeats(draft).reduce((sum, f) => {
    const bonus = f.effects?.passiveScoreBonus
    return bonus?.skills.includes(skillId) ? sum + bonus.value : sum
  }, 0)
}

// ── Classe de Armadura condicional ─────────────────────────────────────────────

export type SheetConditionalAc = ConditionalAcBonus & { source: string }

/**
 * Bônus de CA que dependem de uma situação. Ficam FORA do valor de CA — cada um vira uma linha
 * com a condição, do mesmo jeito que o Ordem lista a Defesa condicional.
 */
export function getConditionalAcBonuses(draft: CharacterDraft): SheetConditionalAc[] {
  return getOwnedFeats(draft).flatMap(feat =>
    (feat.effects?.conditionalAcBonus ?? []).map(bonus => ({ ...bonus, source: feat.name })),
  )
}

// ── Proficiências concedidas ───────────────────────────────────────────────────

/** Armaduras liberadas por talento (Proteção Leve / Moderada / Pesada). */
export function getFeatArmorProficiencies(draft: CharacterDraft): ArmorProficiency[] {
  return getOwnedFeats(draft).flatMap(f => f.effects?.grantedArmorProficiencies ?? [])
}

// ── Escolhas abertas pelos talentos ────────────────────────────────────────────

/** Um talento possuído que ainda pede escolhas do jogador, com o que já foi escolhido. */
export type FeatChoiceSlot = {
  feat: Feat
  choices: NonNullable<NonNullable<Feat['effects']>['choices']>
  selections: FeatSelections
}

/** Talentos possuídos que abrem escolhas de proficiência (Perito, Poliglota, Mestre de Armas). */
export function getFeatChoiceSlots(draft: CharacterDraft): FeatChoiceSlot[] {
  return getOwnedFeats(draft)
    .filter(feat => {
      const choices = feat.effects?.choices
      // savingThrowFromAbilityChoice não abre slot: reaproveita o atributo do +1 do talento.
      return choices?.skillOrToolChoice || choices?.languageChoice || choices?.weaponChoice
    })
    .map(feat => ({
      feat,
      choices: feat.effects!.choices!,
      selections: draft.featSelections[feat.id] ?? {},
    }))
}

/** Todas as escolhas de um talento estão preenchidas? Portão de conclusão da etapa dona dele. */
export function isFeatChoiceComplete(slot: FeatChoiceSlot): boolean {
  const { choices, selections } = slot
  if (choices.skillOrToolChoice) {
    const picked = (selections.skills?.length ?? 0) + (selections.tools?.length ?? 0)
    if (picked < choices.skillOrToolChoice.count) return false
  }
  if (choices.languageChoice && (selections.languages?.length ?? 0) < choices.languageChoice.count) {
    return false
  }
  if (choices.weaponChoice && (selections.weapons?.length ?? 0) < choices.weaponChoice.count) {
    return false
  }
  return true
}

/**
 * Os talentos indicados tiveram suas escolhas resolvidas? Sem `featIds`, vale para todos —
 * cada etapa passa os seus, porque quem trava o avanço é a etapa dona do talento.
 */
export function areFeatChoicesComplete(draft: CharacterDraft, featIds?: string[]): boolean {
  return getFeatChoiceSlots(draft)
    .filter(slot => !featIds || featIds.includes(slot.feat.id))
    .every(isFeatChoiceComplete)
}

function selectionsOf(draft: CharacterDraft, key: keyof FeatSelections): string[] {
  return getOwnedFeats(draft).flatMap(f => draft.featSelections[f.id]?.[key] ?? [])
}

/** Perícias ganhas por talento (Perito). */
export function getFeatGrantedSkills(draft: CharacterDraft): string[] {
  return selectionsOf(draft, 'skills')
}

/** Ferramentas ganhas por talento (Perito). */
export function getFeatGrantedTools(draft: CharacterDraft): string[] {
  return selectionsOf(draft, 'tools')
}

/** Idiomas aprendidos por talento (Poliglota). */
export function getFeatGrantedLanguages(draft: CharacterDraft): string[] {
  return selectionsOf(draft, 'languages')
}

/** Armas liberadas por talento (Mestre de Armas). */
export function getFeatWeaponProficiencies(draft: CharacterDraft): string[] {
  return selectionsOf(draft, 'weapons')
}

/**
 * Resistências ganhas por talento (Resiliente): o atributo escolhido para o +1 do próprio
 * talento. Vale tanto pelo Humano Variante quanto por um espaço de ASI.
 */
export function getFeatSavingThrows(draft: CharacterDraft): AbilityScore[] {
  const out: AbilityScore[] = []
  const add = (featId: string | undefined, ability: AbilityScore | undefined) => {
    if (!featId || !ability) return
    if (getFeat(featId)?.effects?.choices?.savingThrowFromAbilityChoice) out.push(ability)
  }
  add(draft.raceChoices.feat, draft.raceChoices.featAbility)
  for (const choice of getAllAsiChoices(draft)) {
    if (choice.kind === 'feat') add(choice.featId, choice.abilities?.[0])
  }
  return [...new Set(out)]
}
