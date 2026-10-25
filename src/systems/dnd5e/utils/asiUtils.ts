import type { AbilityScore } from '../types/race'
import type { CharacterDraft, AsiChoice, ClassEntry } from '../types/character'
import type { Feat } from '../types/feat'
import type { LevelFeature } from '../types/class'
import { getRace, getSubrace, getEffectiveAbilityBonuses } from './raceUtils'
import { ALL_ABILITY_SCORES, ABILITY_LABELS } from './abilityScoreUtils'
import { getFeat } from './featUtils'
import { areFeatChoicesComplete } from './sheetEffects'
import { getClass, getSubclass, getClassFeaturesUpToLevel } from './classUtils'
import { allClassEntries, getAllAsiChoices } from './multiclassUtils'
import { describeFeaturePick } from './progressionOptions'

/**
 * Níveis em que cada classe ganha um Incremento no Valor de Habilidade (ASI),
 * conforme o PHB 2014. Todas ganham nos níveis 4/8/12/16/19; guerreiro ganha
 * dois extras (6 e 14) e ladino um extra (10).
 */
const BASE_ASI_LEVELS = [4, 8, 12, 16, 19]
const EXTRA_ASI_LEVELS: Record<string, number[]> = {
  fighter: [6, 14],
  rogue: [10],
}

export function getAsiLevels(classId: string | null | undefined): number[] {
  if (!classId) return []
  const extra = EXTRA_ASI_LEVELS[classId] ?? []
  return [...BASE_ASI_LEVELS, ...extra].sort((a, b) => a - b)
}

/** Quantos espaços de ASI o personagem já ganhou no nível informado. */
export function getAsiSlotCount(classId: string | null | undefined, level: number): number {
  return getAsiLevels(classId).filter(l => l <= level).length
}

/** Os níveis de ASI que o personagem já alcançou (para rotular cada espaço). */
export function getReachedAsiLevels(classId: string | null | undefined, level: number): number[] {
  return getAsiLevels(classId).filter(l => l <= level)
}

/**
 * Soma dos aumentos de atributo por atributo: +1 por entrada de um ASI e +1 pelo
 * atributo escolhido de um meio-talento (kind: 'feat' com abilities).
 */
export function getAsiBonuses(asiChoices: AsiChoice[]): Record<AbilityScore, number> {
  const bonuses: Record<AbilityScore, number> = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
  for (const choice of asiChoices) {
    const abilities = choice.kind === 'asi' ? choice.abilities : (choice.abilities ?? [])
    for (const ability of abilities) {
      bonuses[ability] += 1
    }
  }
  return bonuses
}

/** +1 do talento racial (Humano Variante) quando for um meio-talento. */
export function getRaceFeatBonus(draft: CharacterDraft): Record<AbilityScore, number> {
  const bonuses: Record<AbilityScore, number> = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
  const featId = draft.raceChoices.feat
  const featAbility = draft.raceChoices.featAbility
  if (featId && featAbility && (getFeat(featId)?.abilityIncrease?.includes(featAbility) ?? false)) {
    bonuses[featAbility] += 1
  }
  return bonuses
}

/**
 * O que o jogador fez num espaço de ASI, em texto de ficha: "+2 FOR", "+1 CAR, +1 SAB",
 * "Talento: Ator (+1 CAR)", "Talento: Sortudo". `null` quando o espaço ainda está vazio.
 * [a, a] vira +2 em a (o modelo de getAsiBonuses: cada entrada vale +1).
 */
export function describeAsiChoice(choice: AsiChoice | undefined): string | null {
  if (!choice) return null
  if (choice.kind === 'feat') {
    const feat = choice.featId ? getFeat(choice.featId) : undefined
    if (!feat) return null
    // +1 do meio-talento só quando o atributo é opção do talento (o mesmo corte de isAsiChoiceComplete).
    const ab = choice.abilities?.[0]
    const half = ab && feat.abilityIncrease?.includes(ab) ? ` (+1 ${ABILITY_LABELS[ab].short})` : ''
    return `Talento: ${feat.name}${half}`
  }
  const counts = new Map<AbilityScore, number>()
  for (const ab of choice.abilities) counts.set(ab, (counts.get(ab) ?? 0) + 1)
  if (counts.size === 0) return null
  return [...counts].map(([ab, n]) => `+${n} ${ABILITY_LABELS[ab].short}`).join(', ')
}

export const ASI_FEATURE_NAME = 'Incremento no Valor de Habilidade'
const ASI_FEATURE_DESCRIPTION =
  'Aumente um valor de habilidade em 2, ou dois valores de habilidade em 1, sem passar de 20; ' +
  'ou, pela regra opcional de talentos, troque o incremento por um talento.'

/**
 * Característica de classe como a ficha mostra: com a escolha feita, quando ela abre uma.
 * `chosenLabel` troca o "Escolha" da linha (Afinidade Elemental: "Tipo de dano").
 */
export type SheetClassFeature = LevelFeature & { chosen: string | null; chosenLabel?: string }

/**
 * Uma linha "Incremento no Valor de Habilidade" por espaço de ASI que a classe já alcançou (níveis
 * de getAsiLevels, com os extras do guerreiro e do ladino), cada uma com a escolha do espaço. O
 * espaço i é o i-ésimo nível alcançado, a mesma correspondência de isImprovementsStepComplete.
 *
 * As linhas saem daqui, e não de class-progression-features.json, para os níveis de ASI terem uma
 * fonte só. Não têm `effects`: o número já entra em getFinalAbilityScores.
 */
export function getAsiFeatures(entry: ClassEntry): SheetClassFeature[] {
  return getReachedAsiLevels(entry.classId, entry.level).map((level, i) => ({
    level,
    name: ASI_FEATURE_NAME,
    description: ASI_FEATURE_DESCRIPTION,
    chosen: describeAsiChoice(entry.asiChoices?.[i]),
  }))
}

/**
 * Habilidades de Classe de uma classe (da multiclasse, no nível que o personagem tem nela) para a
 * ficha imprimível e a Revisão: features da classe e da subclasse mais os Incrementos, em ordem de
 * nível (dentro do mesmo nível, a ordem dos dados: classe, subclasse, incremento).
 */
export function getSheetClassFeatures(entry: ClassEntry): SheetClassFeature[] {
  const cls = getClass(entry.classId)
  if (!cls) return []
  const sub = entry.classChoices.subclass ? (getSubclass(cls, entry.classChoices.subclass) ?? null) : null
  const features: SheetClassFeature[] = getClassFeaturesUpToLevel(cls, sub, entry.level).map(f => {
    const pick = describeFeaturePick(entry, f)
    return pick ? { ...f, chosen: pick.text, chosenLabel: pick.label } : { ...f, chosen: null }
  })
  return [...features, ...getAsiFeatures(entry)].sort((a, b) => a.level - b.level)
}

export type CharacterFeat = {
  feat: Feat
  /**
   * De onde o talento veio, em texto de ficha: "Talento racial (Humano (Variante))" ou
   * "Incremento nv 4" (na multiclasse, com a classe: "Incremento nv 4 (Guerreiro)").
   */
  origin: string
}

/**
 * Talentos do personagem para a caixa Talentos da ficha e da Revisão: o talento racial (Humano
 * Variante) e os dos Aprimoramentos de todas as classes, cada um com a origem e sem repetir (se o
 * mesmo talento vier de duas origens, as duas aparecem).
 */
export function getCharacterFeats(draft: CharacterDraft): CharacterFeat[] {
  const result: CharacterFeat[] = []
  const add = (featId: string, origin: string) => {
    const feat = getFeat(featId)
    if (!feat) return
    const existing = result.find(r => r.feat.id === featId)
    if (existing) existing.origin = `${existing.origin}, ${origin}`
    else result.push({ feat, origin })
  }
  if (draft.raceChoices.feat) {
    const race = draft.race ? getRace(draft.race) : undefined
    const subrace = race && draft.subrace ? getSubrace(race, draft.subrace) : undefined
    const raceName = subrace?.name ?? race?.name
    add(draft.raceChoices.feat, raceName ? `Talento racial (${raceName})` : 'Talento racial')
  }
  const entries = allClassEntries(draft)
  for (const entry of entries) {
    const reached = getReachedAsiLevels(entry.classId, entry.level)
    const className = entries.length > 1 ? getClass(entry.classId)?.name : undefined
    entry.asiChoices.forEach((c, i) => {
      if (c?.kind !== 'feat' || !c.featId) return
      const level = reached[i]
      add(c.featId, `Incremento${level ? ` nv ${level}` : ''}${className ? ` (${className})` : ''}`)
    })
  }
  return result
}

/**
 * Bônus raciais de atributo: os fixos e escolhidos da raça MAIS o +1 do meio-talento que o
 * Humano Variante ganha junto com o talento.
 *
 * O +1 do talento entra aqui, e não como um termo à parte, porque para o jogador ele é bônus de
 * raça como qualquer outro: o Humano Variante que escolhe Carisma e depois pega Ator termina com
 * +2 de Carisma antes de qualquer ASI. Deixá-lo de fora fazia a etapa Atributos mostrar +1
 * enquanto a Revisão mostrava +2.
 */
export function getRacialBonuses(draft: CharacterDraft): Record<AbilityScore, number> {
  const bonuses: Record<AbilityScore, number> = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return bonuses
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  for (const b of getEffectiveAbilityBonuses(race, subrace, draft.raceChoices)) {
    bonuses[b.ability] += b.value
  }
  const featBonus = getRaceFeatBonus(draft)
  for (const ab of ALL_ABILITY_SCORES) bonuses[ab] += featBonus[ab]
  return bonuses
}

/**
 * Atributos finais = base + bônus racial (já com o +1 do talento racial) + ASIs, limitados a um
 * teto de 20 por atributo (regra do PHB: incrementos não elevam um atributo acima de 20).
 */
export function getFinalAbilityScores(draft: CharacterDraft): Record<AbilityScore, number> {
  const racial = getRacialBonuses(draft)
  // ASI de TODAS as classes (primária + adicionais) — para multiclasse; single-class é idêntico.
  const asi = getAsiBonuses(getAllAsiChoices(draft))
  const final = {} as Record<AbilityScore, number>
  for (const ab of ALL_ABILITY_SCORES) {
    const baseWithRacial = (draft.abilityScores[ab] ?? 10) + racial[ab]
    const capped = Math.min(baseWithRacial + asi[ab], Math.max(20, baseWithRacial))
    final[ab] = capped
  }
  return final
}

/**
 * Um espaço de ASI está preenchido de forma válida? Modelamos o incremento como
 * duas entradas de atributo: [a, a] = +2 em a; [a, b] = +1 em a e +1 em b.
 * Cada entrada vale +1 (ver getAsiBonuses), somando sempre +2 no total.
 */
export function isAsiChoiceComplete(choice: AsiChoice | undefined): boolean {
  if (!choice) return false
  if (choice.kind === 'feat') {
    if (!choice.featId) return false
    // meio-talento: exige escolher exatamente 1 atributo dentre os elegíveis
    const options = getFeat(choice.featId)?.abilityIncrease
    if (options && options.length > 0) {
      return (choice.abilities?.length === 1) && options.includes(choice.abilities[0])
    }
    return true
  }
  return (
    choice.abilities.length === 2 &&
    choice.abilities.every(a => (ALL_ABILITY_SCORES as AbilityScore[]).includes(a))
  )
}

/**
 * Passo de Aprimoramentos completo: todos os espaços de ASI já alcançados estão
 * preenchidos de forma válida (respeitando o teto 20). Sem espaços, está completo.
 */
export function isImprovementsStepComplete(draft: CharacterDraft): boolean {
  // Cada classe valida seus próprios espaços de ASI, no nível que tem NELA (multiclasse);
  // para classe única é uma só entrada no nível total, idêntico ao comportamento anterior.
  const reached: AsiChoice[] = []
  for (const entry of allClassEntries(draft)) {
    const slots = getAsiSlotCount(entry.classId, entry.level)
    const choices = entry.asiChoices ?? []
    if (choices.length < slots) return false
    for (let i = 0; i < slots; i++) {
      if (!isAsiChoiceComplete(choices[i])) return false
      reached.push(choices[i])
    }
  }
  // Talentos que abrem escolhas (Perito, Poliglota, Mestre de Armas) só fecham o passo
  // quando o jogador resolve o que eles pedem.
  const featIds = reached
    .filter(c => c?.kind === 'feat')
    .map(c => (c as { featId: string }).featId)
  if (!areFeatChoicesComplete(draft, featIds)) return false

  // teto de 20 sobre o conjunto de todas as escolhas alcançadas (todas as classes)
  const racial = getRacialBonuses(draft)
  const asi = getAsiBonuses(reached)
  for (const ab of ALL_ABILITY_SCORES) {
    const baseWithRacial = (draft.abilityScores[ab] ?? 10) + racial[ab]
    if (baseWithRacial + asi[ab] > Math.max(20, baseWithRacial)) return false
  }
  return true
}
