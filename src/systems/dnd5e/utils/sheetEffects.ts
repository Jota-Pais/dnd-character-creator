import type { CharacterDraft, ClassEntry, FeatSelections } from '../types/character'
import type { Feat } from '../types/feat'
import type { ArmorProficiency, LevelFeature } from '../types/class'
import type { AbilityScore, RacialTrait } from '../types/race'
import type {
  AttackScope, CastingRestriction, ConditionalAcBonus, ConditionalRollNote, EquipmentRequirement, FeatureEffects,
  LevelStep, LoadingOverride, ResourceEffect,
} from '../types/effects'
import { getFeat } from './featUtils'
import { getOwnedFeats } from './ownedFeats'
import {
  getClass, getSubclass, getClassFeaturesUpToLevel, getClassFightingStyleOptions, FIGHTING_STYLES,
} from './classUtils'
import { getRace, getSubrace, getEffectiveTraits, getEffectiveSpeed } from './raceUtils'
import {
  getProficiencyBonus, calculateModifier, formatMeters, formatModifier, ALL_ABILITY_SCORES,
} from './abilityScoreUtils'
import { getEquippedArmor } from './equipmentUtils'
import {
  calculateArmorClass, type ArmorClassResult, type UnarmoredAcOption,
} from './armorClassUtils'
import {
  evaluateQuantity, evaluateResource, stepValue, type FinalScores, type ResourceSource, type SheetResource,
} from './classResourceUtils'
import { getActivePicks, getProgressionSlotsUpToLevel } from './progressionChoiceUtils'
import { getProgressionOptions, getUnmetRequirement, type ProgressionOption } from './progressionOptions'
import { formatManeuverSaveDc, getClassManeuvers, getManeuver, getManeuverSaveDc } from './maneuverUtils'
import { getFeatChosenSpell, getFeatSpellPicks, getSpellSources } from './spellUtils'
import type { SourcedAttackEffect } from './weaponFormat'
import {
  allClassEntries, getAllAsiChoices, getTotalHpAverage, getTotalHpRolled,
} from './multiclassUtils'

/**
 * Agregador dos efeitos que a ficha aplica sozinha, atravessando as fontes de característica
 * (talentos, features de classe e, por ora só nos recursos, nos PV e no deslocamento, traços raciais).
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

/** Talentos que o personagem possui — mora em `ownedFeats` (ver lá por quê). */
export { getOwnedFeats }

/**
 * Features de classe e subclasse que o personagem tem, de cada classe no nível que tem NELA: um
 * Guerreiro 5 / Bardo 1 não tem a Versatilidade do bardo 2.
 */
export function getOwnedClassFeatures(draft: CharacterDraft): LevelFeature[] {
  return getOwnedClassFeaturesByEntry(draft).flatMap(b => b.features)
}

/**
 * O mesmo que `getOwnedClassFeatures`, agrupado por classe — para o efeito que depende do nível
 * NA classe dona da feature (os recursos: Chi = nível de monge, não de personagem).
 */
export function getOwnedClassFeaturesByEntry(
  draft: CharacterDraft,
): { entry: ClassEntry; features: LevelFeature[] }[] {
  return allClassEntries(draft).flatMap(entry => {
    const cls = getClass(entry.classId)
    if (!cls) return []
    const sub = entry.classChoices.subclass ? getSubclass(cls, entry.classChoices.subclass) : null
    return [{ entry, features: getClassFeaturesUpToLevel(cls, sub ?? null, entry.level) }]
  })
}

/**
 * Traços raciais que o personagem tem, já com a sub-raça aplicada (ela pode substituir os da
 * raça-mãe), e quem os concede — a sub-raça, quando houver. `null` sem raça escolhida.
 */
function getOwnedRacialTraits(
  draft: CharacterDraft,
): { source: ResourceSource; traits: RacialTrait[] } | null {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return null
  const subrace = draft.subrace ? getSubrace(race, draft.subrace) ?? null : null
  return {
    source: { kind: 'race', id: subrace?.id ?? race.id, name: subrace?.name ?? race.name },
    traits: getEffectiveTraits(race, subrace),
  }
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

/**
 * Uma fonte de metade do bônus de proficiência nos testes sem proficiência (Versatilidade,
 * Atletismo Extraordinário), já com o valor no nível de personagem e os atributos em que vale.
 */
export type HalfProficiencySource = SheetEffect<number> & { abilities: AbilityScore[] }

/**
 * As fontes de meia proficiência que o personagem tem — features de classe com
 * `halfProficiencyOnChecks`, de cada classe no nível que tem NELA. O valor é metade do bônus de
 * proficiência (do nível de personagem), arredondada como a característica manda.
 */
export function getHalfProficiencySources(draft: CharacterDraft): HalfProficiencySource[] {
  const prof = getProficiencyBonus(draft.level ?? 1)
  const out: HalfProficiencySource[] = []
  for (const feature of getOwnedClassFeatures(draft)) {
    const half = feature.effects?.halfProficiencyOnChecks
    if (!half || out.some(s => s.source === feature.name)) continue
    const value = half.rounding === 'up' ? Math.ceil(prof / 2) : Math.floor(prof / 2)
    if (value > 0) out.push({ source: feature.name, value, abilities: half.abilities ?? ALL_ABILITY_SCORES })
  }
  return out
}

/**
 * A fonte que vale num teste do atributo: as fontes não se somam (o bônus de proficiência entra
 * uma vez só, p. 175), então fica a maior. No empate fica a de alcance mais largo — a
 * Versatilidade, que vale em todo teste, em vez do Atletismo Extraordinário.
 */
export function getBestHalfProficiencySource(
  sources: HalfProficiencySource[],
  ability: AbilityScore,
): HalfProficiencySource | undefined {
  let best: HalfProficiencySource | undefined
  for (const s of sources) {
    if (!s.abilities.includes(ability)) continue
    if (!best || s.value > best.value || (s.value === best.value && s.abilities.length > best.abilities.length)) {
      best = s
    }
  }
  return best
}

/**
 * A parcela do bônus de proficiência num TESTE DE HABILIDADE do atributo — perícia, iniciativa,
 * valor passivo.
 *
 * O livro aplica o bônus uma vez só e o multiplica uma vez só (p. 175): dobrado com
 * Especialização, inteiro com proficiência e, sem proficiência, metade para quem tem Versatilidade
 * (qualquer atributo, para baixo) ou Atletismo Extraordinário (FOR/DES/CON, para cima) — a maior
 * das duas. Nunca se somam. Resistência e ataque não passam por aqui — as duas são só de teste
 * de habilidade.
 */
export function getCheckProficiencyBonus(
  draft: CharacterDraft,
  proficiency: CheckProficiency,
  ability: AbilityScore,
): number {
  const prof = getProficiencyBonus(draft.level ?? 1)
  if (proficiency === 'expertise') return prof * 2
  if (proficiency === 'proficient') return prof
  return getBestHalfProficiencySource(getHalfProficiencySources(draft), ability)?.value ?? 0
}

// ── Iniciativa ─────────────────────────────────────────────────────────────────

/**
 * Bônus de iniciativa além da Destreza. Iniciativa é um teste de Destreza (p. 179) sem
 * proficiência, então a Versatilidade ou o Atletismo Extraordinário (a maior, não os dois) entra
 * aqui como linha própria.
 */
export function getInitiativeBonuses(draft: CharacterDraft): SheetEffect<number>[] {
  const fromFeats = collect(draft, f => f.effects?.initiativeBonus)
  const half = getBestHalfProficiencySource(getHalfProficiencySources(draft), 'DEX')
  return half ? [...fromFeats, { source: half.source, value: half.value }] : fromFeats
}

/** Soma dos bônus de iniciativa (Alerta +5, Versatilidade). Entra direto no número da ficha. */
export function getInitiativeBonusTotal(draft: CharacterDraft): number {
  return getInitiativeBonuses(draft).reduce((sum, e) => sum + e.value, 0)
}

/**
 * Quem dá vantagem nas jogadas de iniciativa (`initiativeAdvantage`: Instinto Selvagem, p. 49) —
 * features de classe no nível que se tem NELA e talentos —, pelo nome, sem repetir. Vazio sem
 * nenhuma. Incondicional: o guia de rolagens a põe no modo da iniciativa.
 */
export function getInitiativeAdvantageSources(draft: CharacterDraft): string[] {
  const sources = [
    ...getOwnedClassFeatures(draft).filter(f => f.effects?.initiativeAdvantage).map(f => f.name),
    ...getOwnedFeats(draft).filter(f => f.effects?.initiativeAdvantage).map(f => f.name),
  ]
  return [...new Set(sources)]
}

// ── Linhas condicionais das jogadas ────────────────────────────────────────────

/** Uma linha condicional de jogada d20, com quem a dá (o nome da feature, do talento ou do traço). */
export type SheetConditionalRoll = ConditionalRollNote & { source: string }

/**
 * As linhas condicionais das jogadas d20 (`conditionalRolls`): features de classe no nível que se
 * tem NELA (Sentido de Perigo), talentos e traços raciais (Resiliência Anã, Bravura, Sortudo). A
 * mesma característica vinda de duas classes entra uma vez. Nunca mudam número nem modo — quem as
 * põe nas receitas é o guia de rolagens.
 */
export function getConditionalRollNotes(draft: CharacterDraft): SheetConditionalRoll[] {
  const out: SheetConditionalRoll[] = []
  const add = (source: string, notes: ConditionalRollNote[] | undefined) => {
    for (const n of notes ?? []) {
      if (!out.some(o => o.source === source && o.text === n.text)) out.push({ ...n, source })
    }
  }
  for (const feature of getOwnedClassFeatures(draft)) add(feature.name, feature.effects?.conditionalRolls)
  for (const feat of getOwnedFeats(draft)) add(feat.name, feat.effects?.conditionalRolls)
  for (const trait of getOwnedRacialTraits(draft)?.traits ?? []) add(trait.name, trait.effects?.conditionalRolls)
  return out
}

// ── Restrições de conjuração ───────────────────────────────────────────────────

/** Uma restrição de conjuração condicional, com quem a dá (o nome da feature). */
export type SheetCastingRestriction = CastingRestriction & { source: string }

/**
 * O personagem "for capaz de conjurar magias" (Fúria, p. 48)? Com alguma fonte de magia da ficha
 * (`getSpellSources`: classe, talento, truque e magia inata da raça — toda raça que dá magia inata
 * dá um truque no 1º nível) ou com característica que conjura sem ser fonte (`castsSpells`: o
 * Conselheiro Espiritual do Guerreiro Totêmico, as Artes Sombrias, a disciplina elemental que
 * conjura, o Conjurador de Ritual).
 */
export function canCastSpells(draft: CharacterDraft): boolean {
  return getSpellSources(draft).length > 0
    || getOwnedClassFeatures(draft).some(f => f.effects?.castsSpells)
    || getOwnedProgressionOptions(draft).some(({ option }) => option.effects?.castsSpells)
    || getOwnedFeats(draft).some(f => f.effects?.castsSpells)
}

/**
 * O que proíbe conjurar numa situação que a ficha não conhece (`castingRestriction`: em fúria,
 * p. 48) — features de classe e subclasse no nível NA classe dona, pela origem, sem repetir. A
 * regra é para quem "for capaz de conjurar magias" (`canCastSpells`); quem não conjura nada fica
 * com a lista vazia. Nunca bloqueia nem muda número; quem a põe onde se conjura é o modo de jogo.
 */
export function getCastingRestrictions(draft: CharacterDraft): SheetCastingRestriction[] {
  const out: SheetCastingRestriction[] = []
  for (const feature of getOwnedClassFeatures(draft)) {
    const restriction = feature.effects?.castingRestriction
    if (restriction && !out.some(o => o.source === feature.name && o.text === restriction.text)) {
      out.push({ ...restriction, source: feature.name })
    }
  }
  return out.length > 0 && canCastSpells(draft) ? out : []
}

/** "Fúria: em fúria, você não pode conjurar magias nem se concentrar nelas (pág. 48)." */
export function formatCastingRestriction(restriction: SheetCastingRestriction): string {
  return `${restriction.source}: ${restriction.when}, ${restriction.text}`
}

// ── Deslocamento ───────────────────────────────────────────────────────────────

/** A armadura e o escudo equipados — o mesmo critério para a CA e para o deslocamento. */
function getDraftEquippedArmor(draft: CharacterDraft): ReturnType<typeof getEquippedArmor> {
  const cls = draft.class ? getClass(draft.class) : undefined
  return getEquippedArmor(draft.equipment, cls?.startingEquipment)
}

/**
 * Um bônus de deslocamento, em PÉS. Os de talento (Mobilidade) são incondicionais: sem
 * `condition`, sempre ativos. Os de equipamento trazem a condição e se ela está cumprida agora;
 * quando não está, `blockedBy` diz o que a impede ("Placas", "escudo").
 */
export type SheetSpeedBonus = SheetEffect<number> & {
  active: boolean
  condition?: string
  blockedBy?: string
}

/** O que, no equipamento atual, impede a condição — `undefined` quando ela está cumprida. */
function equipmentBlocker(
  requires: EquipmentRequirement,
  { bodyArmor, hasShield }: ReturnType<typeof getEquippedArmor>,
): string | undefined {
  if (requires === 'noHeavyArmor') {
    return bodyArmor?.category === 'heavy' ? bodyArmor.name : undefined
  }
  const worn = [bodyArmor?.name, hasShield ? 'escudo' : undefined].filter(Boolean)
  return worn.length > 0 ? worn.join(' e ') : undefined
}

/**
 * Todos os bônus de deslocamento: os de talento e os de feature de classe com condição de
 * equipamento (Movimento Rápido, Movimento sem Armadura), estes no nível NA classe dona — um
 * guerreiro 5 / monge 2 ganha os +10 pés do monge 2. A condição é avaliada com o equipamento
 * da ficha, do mesmo jeito que a CA lê a armadura vestida.
 */
export function getSpeedBonuses(draft: CharacterDraft): SheetSpeedBonus[] {
  const out: SheetSpeedBonus[] = collect(draft, f => f.effects?.speedBonus)
    .map(e => ({ ...e, active: true }))
  const equipped = getDraftEquippedArmor(draft)
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    for (const feature of features) {
      const bonus = feature.effects?.equipmentSpeedBonus
      const value = bonus ? stepValue(bonus.byLevel, entry.level) : undefined
      if (!bonus || !value) continue
      const blockedBy = equipmentBlocker(bonus.requires, equipped)
      out.push({
        source: feature.name, value, condition: bonus.condition, active: !blockedBy,
        ...(blockedBy ? { blockedBy } : {}),
      })
    }
  }
  return out
}

/** Bônus de deslocamento em PÉS, a unidade da raça: só os ativos (Mobilidade +10 pés). */
export function getSpeedBonusTotal(draft: CharacterDraft): number {
  return getSpeedBonuses(draft).reduce((sum, e) => (e.active ? sum + e.value : sum), 0)
}

/** Quanto a armadura pesada tira sem a Força da tabela: 3 m = 10 pés (p. 146). */
const ARMOR_STRENGTH_SPEED_PENALTY = 10

/**
 * A redução de deslocamento da armadura vestida: "For 13" / "For 15" na tabela tiram 3 m de quem
 * não tem a Força listada (p. 146), com a Força FINAL. `ignoredBy` diz quem a anula — o
 * Deslocamento do anão, que não é reduzido por armadura pesada (p. 20). `null` quando a armadura
 * não pede Força ou o personagem a tem.
 */
export type ArmorSpeedPenalty = {
  armor: string
  strengthRequirement: number
  strength: number
  /** Em PÉS, como o deslocamento da raça. */
  value: number
  ignoredBy?: string
}

export function getArmorSpeedPenalty(
  draft: CharacterDraft,
  finalScores: FinalScores,
): ArmorSpeedPenalty | null {
  const { bodyArmor } = getDraftEquippedArmor(draft)
  const requirement = bodyArmor?.strengthRequirement
  if (!bodyArmor || !requirement || finalScores.STR >= requirement) return null
  const racial = bodyArmor.category === 'heavy' ? getOwnedRacialTraits(draft) : null
  const trait = racial?.traits.find(t => t.effects?.heavyArmorSpeedUnreduced)
  return {
    armor: bodyArmor.name,
    strengthRequirement: requirement,
    strength: finalScores.STR,
    value: ARMOR_STRENGTH_SPEED_PENALTY,
    ...(racial && trait ? { ignoredBy: `${trait.name} (${racial.source.name})` } : {}),
  }
}

/**
 * O Deslocamento da ficha, em pés — a Revisão e o PDF chamam só isto: o da raça (sub-raça já
 * aplicada) mais os bônus ativos, menos a redução da armadura pesada sem a Força mínima (quando
 * nada a anula). `null` sem raça escolhida.
 */
export function getSheetSpeed(draft: CharacterDraft, finalScores: FinalScores): number | null {
  const race = draft.race ? getRace(draft.race) : undefined
  if (!race) return null
  const subrace = draft.subrace ? getSubrace(race, draft.subrace) ?? null : null
  const penalty = getArmorSpeedPenalty(draft, finalScores)
  const reduction = penalty && !penalty.ignoredBy ? penalty.value : 0
  return getEffectiveSpeed(race, subrace) + getSpeedBonusTotal(draft) - reduction
}

/**
 * As linhas do deslocamento com condição, o mesmo texto na Revisão e no PDF: os bônus que já
 * estão somados e os que ficaram de fora, com o motivo — pra valer na mesa quando o jogador troca
 * de equipamento —, e a redução da armadura pesada sem a Força mínima, aplicada ou anulada pelo
 * anão. Os incondicionais (Mobilidade) não ganham linha: já estão no número, sem ressalva.
 * Sem raça não há número (`getSheetSpeed` dá `null`, a ficha mostra "—"), então nem linha.
 */
export function describeSpeedBonuses(draft: CharacterDraft, finalScores: FinalScores): string[] {
  if (!draft.race || !getRace(draft.race)) return []
  const lines = getSpeedBonuses(draft)
    .filter(b => b.condition)
    .map(b => {
      const text = `+${formatMeters(b.value)} ${b.condition} (${b.source})`
      return b.active
        ? `Deslocamento inclui ${text}.`
        : `Não somado: ${text} — você está de ${b.blockedBy}.`
    })
  const penalty = getArmorSpeedPenalty(draft, finalScores)
  if (penalty) {
    const why = `${penalty.armor} pede Força ${penalty.strengthRequirement} e você tem ${penalty.strength}`
    lines.push(penalty.ignoredBy
      ? `Deslocamento não reduzido: ${why}, mas ${penalty.ignoredBy} ignora a redução de ${formatMeters(penalty.value)}.`
      : `Deslocamento reduzido em ${formatMeters(penalty.value)}: ${why}.`)
  }
  return lines
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
 * PV extras de traço racial no nível dado (Tenacidade Anã: 1 × nível, p. 20). Como o Robusto,
 * vão no máximo de PV, não no dado de vida — valem igual na média e na rolagem.
 */
export function getRacialHpBonus(draft: CharacterDraft, level: number): number {
  const owned = getOwnedRacialTraits(draft)
  if (!owned) return 0
  return owned.traits.reduce((sum, t) => sum + (t.effects?.hpPerLevel ?? 0) * level, 0)
}

/**
 * PV extras de feature de classe, cada uma pelo nível NA classe dona dela (Resiliência Dracônica:
 * 1 × nível de feiticeiro, p. 80). Na multiclasse, um guerreiro 3 / feiticeiro dracônico 2 ganha 2.
 */
export function getClassFeatureHpBonus(draft: CharacterDraft): number {
  return getOwnedClassFeaturesByEntry(draft).reduce(
    (sum, { entry, features }) =>
      sum + features.reduce((s, f) => s + (f.effects?.hpPerClassLevel ?? 0) * entry.level, 0),
    0,
  )
}

/** Todos os PV extras por nível, de talento e de traço racial. Os dois se acumulam. */
export function getHpPerLevelBonus(draft: CharacterDraft, level: number): number {
  return getFeatHpBonus(draft, level) + getRacialHpBonus(draft, level)
}

/**
 * PV totais da ficha: o poço de dados de vida das classes mais os extras de talento e de traço
 * racial, no nível de PERSONAGEM (na multiclasse, a soma de todas as classes), e os de feature de
 * classe, no nível de cada classe. Mora aqui, e não
 * em `multiclassUtils`, porque só este módulo enxerga talentos e traços — e `multiclassUtils`
 * não pode importá-lo (é ele quem fornece `getAllAsiChoices`).
 */
/**
 * A característica que impede reduzir o PV máximo (`hpMaxCannotBeReduced`: Acostumado à
 * Morte-Vida, p. 101), no nível NA classe dona, pelo nome; `null` sem nenhuma. O modo de jogo a
 * lê pelo `PlaySheet`: a Exaustão 4 não corta o máximo de quem a tem.
 */
export function getHpMaxReductionImmunity(draft: CharacterDraft): string | null {
  return getOwnedClassFeatures(draft).find(f => f.effects?.hpMaxCannotBeReduced)?.name ?? null
}

/**
 * O traço racial que deixa ficar com 1 PV em vez de cair a 0 (`dropToOneHpInstead`: Resistência
 * Implacável, p. 41), com o recurso que ele gasta e o nome; `null` sem nenhum.
 */
export function getDropToOneHp(draft: CharacterDraft): { resourceId: string; source: string } | null {
  for (const trait of getOwnedRacialTraits(draft)?.traits ?? []) {
    const drop = trait.effects?.dropToOneHpInstead
    if (drop) return { resourceId: drop.resourceId, source: trait.name }
  }
  return null
}

export function getTotalHp(draft: CharacterDraft, conModifier: number): number {
  const base = draft.hpMethod === 'roll'
    ? getTotalHpRolled(draft, conModifier)
    : getTotalHpAverage(draft, conModifier)
  return base + getHpPerLevelBonus(draft, draft.level ?? 1) + getClassFeatureHpBonus(draft)
}

// ── Recursos (classe, raça, talento) ───────────────────────────────────────────

/** Mais usos ganha; ilimitado ganha de qualquer número. */
function usesRank(r: SheetResource): number {
  if (r.uses === 'unlimited') return Infinity
  return r.uses ?? -Infinity
}

const sameSource = (a: ResourceSource, b: ResourceSource) => a.kind === b.kind && a.id === b.id

/** Uma declaração de recurso, com quem a dá e o nível que conta para ela. */
type ResourceDeclaration = { effect: ResourceEffect; source: ResourceSource; level: number }

/**
 * Todas as declarações de recurso do personagem, na ordem da ficha: classes (cada uma no nível
 * NELA), traços raciais e talentos (no nível de personagem — raça e talento não são de classe
 * nenhuma, e a Arma de Sopro cresce "no 6° nível", p. 34).
 */
function getResourceDeclarations(draft: CharacterDraft): ResourceDeclaration[] {
  const out: ResourceDeclaration[] = []
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    const source: ResourceSource = { kind: 'class', id: entry.classId, name: getClass(entry.classId)?.name ?? entry.classId }
    for (const feature of features) {
      for (const effect of feature.effects?.resources ?? []) out.push({ effect, source, level: entry.level })
    }
  }

  const charLevel = draft.level ?? 1
  const racial = getOwnedRacialTraits(draft)
  if (racial) {
    for (const trait of racial.traits) {
      for (const effect of trait.effects?.resources ?? []) {
        out.push({ effect, source: racial.source, level: charLevel })
      }
    }
  }

  for (const feat of getOwnedFeats(draft)) {
    const source: ResourceSource = { kind: 'feat', id: feat.id, name: feat.name }
    const spellChoice = feat.effects?.choices?.spellChoice
    for (const effect of feat.effects?.resources ?? []) {
      // O uso da magia do talento leva o nome da magia escolhida (Iniciado em Magia, p. 170).
      const chosen = effect.nameFromChosenSpell && spellChoice
        ? getFeatChosenSpell(spellChoice, draft.featSelections[feat.id] ?? {})
        : undefined
      out.push({ effect: chosen ? { ...effect, name: chosen.name } : effect, source, level: charLevel })
    }
  }
  return out
}

/**
 * Recursos do personagem — usos, poços e dados declarados em `effects.resources` das features de
 * classe e subclasse, dos traços raciais e dos talentos —, cada um calculado no nível que conta
 * para ele (o da classe dona; o de personagem para raça e talento) e com os atributos finais (a
 * Inspiração de Bardo depende do Carisma; a CD da Arma de Sopro, da Constituição).
 *
 * Recebe os atributos prontos, como `getSkillChecks`: quem os calcula (`asiUtils`) já importa
 * este módulo.
 *
 * O mesmo `id` vindo de duas fontes vira um recurso só, com os usos da que dá mais: clérigo 6 /
 * paladino 4 tem Canalizar Divindade 2 vezes, não 3 (p. 166). A exceção é a declaração com
 * `addsToExisting`, que SOMA ao recurso que já existe (o dado a mais do Adepto Marcial, p. 167).
 */
export function getSheetResources(draft: CharacterDraft, finalScores: FinalScores): SheetResource[] {
  const prof = getProficiencyBonus(draft.level ?? 1)
  const out: SheetResource[] = []
  const additions: SheetResource[] = []
  for (const { effect, source, level } of getResourceDeclarations(draft)) {
    const resource = evaluateResource(effect, source, level, finalScores, prof)
    if (effect.addsToExisting) {
      additions.push(resource)
      continue
    }
    const i = out.findIndex(r => r.id === resource.id)
    if (i < 0) {
      out.push(resource)
      continue
    }
    if (sameSource(out[i].source, resource.source)) continue
    const [keep, other] = usesRank(resource) > usesRank(out[i]) ? [resource, out[i]] : [out[i], resource]
    const shared = [...keep.sharedWith, other.source, ...other.sharedWith]
    out[i] = { ...keep, sharedWith: shared.filter((s, j) => shared.findIndex(t => sameSource(s, t)) === j) }
  }

  // Somas por último, pra encontrar o recurso-base qualquer que seja a ordem das fontes.
  for (const add of additions) {
    const i = out.findIndex(r => r.id === add.id)
    if (i < 0) {
      out.push(add)
      continue
    }
    const base = out[i]
    // Ilimitado mais um continua ilimitado; recurso sem contagem não tem onde somar.
    if (typeof base.uses !== 'number' || typeof add.uses !== 'number') continue
    out[i] = { ...base, uses: base.uses + add.uses, addedFrom: [...base.addedFrom, { source: add.source, uses: add.uses }] }
  }
  return out
}

// ── Valores passivos ───────────────────────────────────────────────────────────

/** Bônus no valor PASSIVO de uma perícia (Observador +5 em Percepção e Investigação). */
export function getPassiveScoreBonus(draft: CharacterDraft, skillId: string): number {
  return getOwnedFeats(draft).reduce((sum, f) => {
    const bonus = f.effects?.passiveScoreBonus
    return bonus?.skills.includes(skillId) ? sum + bonus.value : sum
  }, 0)
}

// ── Classe de Armadura ─────────────────────────────────────────────────────────

/**
 * As formas alternativas de calcular a CA sem armadura que as features de classe dão (Defesa sem
 * Armadura do bárbaro e do monge, Resiliência Dracônica), de todas as classes da multiclasse.
 *
 * A mesma característica vinda de duas classes fica só a da primeira: bárbaro / monge tem UMA
 * Defesa sem Armadura (p. 166), a da classe que a deu primeiro. Características diferentes
 * (Defesa sem Armadura e Resiliência Dracônica) ficam as duas — quem escolhe entre elas é
 * `calculateArmorClass`, pela regra geral da p. 14.
 */
export function getUnarmoredAcOptions(draft: CharacterDraft): UnarmoredAcOption[] {
  const out: UnarmoredAcOption[] = []
  for (const feature of getOwnedClassFeatures(draft)) {
    const formula = feature.effects?.unarmoredAc
    if (!formula || out.some(o => o.id === formula.id)) continue
    out.push({ ...formula, source: feature.name })
  }
  return out
}

/**
 * A CA da ficha — a Revisão e o PDF chamam só isto. Junta a armadura e o escudo equipados, as
 * fórmulas sem armadura das features e o Estilo de Luta Defesa de qualquer classe.
 */
export function getSheetArmorClass(draft: CharacterDraft, finalScores: FinalScores): ArmorClassResult {
  const { bodyArmor, hasShield } = getDraftEquippedArmor(draft)
  const mods = Object.fromEntries(
    ALL_ABILITY_SCORES.map(ab => [ab, calculateModifier(finalScores[ab])]),
  ) as Record<AbilityScore, number>
  return calculateArmorClass({
    mods,
    bodyArmor,
    hasShield,
    unarmoredAc: getUnarmoredAcOptions(draft),
    hasDefenseFightingStyle: getOwnedFightingStyleIds(draft).includes('defense'),
  })
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

// ── Testes de resistência condicionais ─────────────────────────────────────────

/** Um bônus condicional nos testes de resistência, já calculado, com a condição e quem o dá. */
export type SheetConditionalSave = { value: number; condition: string; source: string }

/**
 * Bônus em todos os testes de resistência que dependem de uma situação (Aura de Proteção, p. 111).
 * Ficam FORA do número de cada resistência — a ficha não sabe se você está consciente nem quem
 * está a até 3 m — e viram linha com a condição. Feature de classe e subclasse, no nível NA classe
 * dona (paladino 6 / guerreiro 12 tem a aura de 3 m), com os atributos finais.
 */
export function getConditionalSaveBonuses(
  draft: CharacterDraft,
  finalScores: FinalScores,
): SheetConditionalSave[] {
  const prof = getProficiencyBonus(draft.level ?? 1)
  const out: SheetConditionalSave[] = []
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    for (const feature of features) {
      const bonus = feature.effects?.conditionalSaveBonus
      if (!bonus) continue
      const condition = stepValue(bonus.condition, entry.level)
      if (condition === undefined || out.some(o => o.source === feature.name)) continue
      const value = evaluateQuantity(bonus.value, entry.level, finalScores, prof)
      out.push({ value, condition, source: feature.name })
    }
  }
  return out
}

/**
 * As linhas que a Revisão e a ficha imprimível mostram junto das resistências — o mesmo texto nas
 * duas. Vazio para quem não tem bônus condicional.
 */
export function describeConditionalSaveBonuses(draft: CharacterDraft, finalScores: FinalScores): string[] {
  return getConditionalSaveBonuses(draft, finalScores).map(b =>
    `${formatModifier(b.value)} em todos os testes de resistência (${b.source}: ${b.condition})`,
  )
}

// ── Ataques por ação ───────────────────────────────────────────────────────────

/** O total de ataques da ação de Atacar e a característica que o dá. */
export type SheetAttacksPerAction = { value: number; source: string | null }

/**
 * Quantos ataques a ação de Atacar faz — o "2×" de cada arma, via `getSheetAttacks` (arma de recarga
 * fica em 1, p. 149). Vem do `attacksPerAction`
 * das features de classe e subclasse (Ataque Extra), cada uma no nível que se tem NA classe dona:
 * o guerreiro 11 faz 3 (p. 85), o bardo do Colégio da Bravura 6 faz 2 (p. 55).
 *
 * Não soma entre fontes — "se você ganhar a característica Ataque Extra de mais de uma classe,
 * elas não se acumulam" (p. 166): vale a maior, e só o Ataque Extra do guerreiro passa de dois.
 * Sem nenhuma, 1 ataque e `source` nula.
 */
export function getAttacksPerAction(draft: CharacterDraft): SheetAttacksPerAction {
  let best: SheetAttacksPerAction = { value: 1, source: null }
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    for (const feature of features) {
      const steps = feature.effects?.attacksPerAction
      const value = steps ? stepValue(steps, entry.level) ?? 1 : 1
      if (value > best.value) best = { value, source: feature.name }
    }
  }
  return best
}

// ── Acerto crítico ─────────────────────────────────────────────────────────────

/**
 * Um efeito de crítico com o alcance dele: a linha de ataque o recebe quando está no escopo
 * (`isSheetAttackInScope`, em attackUtils, que pergunta à arma ou ao golpe desarmado).
 */
export type ScopedSheetEffect = SheetEffect<number> & { weapons: AttackScope }

/**
 * A margem de crítico dos ataques com arma (`weaponCritThreshold`: Crítico Aprimorado 19, Crítico
 * Superior 18 do campeão), de cada feature no nível NA classe dona. Não soma: vale a menor margem.
 * `null` sem nenhuma — o crítico fica no 20 natural (p. 196). O alcance é "seus ataques com armas"
 * (`weapon-attack`): as armas e o golpe desarmado, que é ataque com arma sem ser arma (decisão 20
 * de `regras-dano-e-morte.md`, revista em 2026-10-29).
 */
export function getWeaponCritThreshold(draft: CharacterDraft): ScopedSheetEffect | null {
  let best: ScopedSheetEffect | null = null
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    for (const feature of features) {
      const steps = feature.effects?.weaponCritThreshold
      const value = steps ? stepValue(steps, entry.level) : undefined
      if (value !== undefined && value < (best?.value ?? 20)) best = { source: feature.name, value, weapons: 'weapon-attack' }
    }
  }
  return best
}

/**
 * Dados de dano da arma a mais no crítico corpo a corpo (`meleeCritExtraWeaponDice`), um por fonte:
 * Crítico Brutal pelo nível NA classe de bárbaro (p. 49), Ataques Selvagens do meio-orc e talentos
 * pelo nível de personagem (p. 41). Cada fonte fica na sua linha — o guia mostra como nota no dano
 * crítico, sem mexer na fórmula. O alcance é todo ataque corpo a corpo com arma
 * (`melee-weapon-attack`): as armas corpo a corpo e o golpe desarmado, que só ganha o dado a mais
 * quando tem dado (decisão 21 de `regras-dano-e-morte.md`, revista em 2026-10-29).
 */
export function getMeleeCritExtraWeaponDice(draft: CharacterDraft): ScopedSheetEffect[] {
  const out: ScopedSheetEffect[] = []
  const add = (source: string, steps: LevelStep[] | undefined, level: number) => {
    const value = steps ? stepValue(steps, level) : undefined
    if (value && value > 0 && !out.some(o => o.source === source)) out.push({ source, value, weapons: 'melee-weapon-attack' })
  }
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    for (const feature of features) add(feature.name, feature.effects?.meleeCritExtraWeaponDice, entry.level)
  }
  const charLevel = draft.level ?? 1
  for (const trait of getOwnedRacialTraits(draft)?.traits ?? []) add(trait.name, trait.effects?.meleeCritExtraWeaponDice, charLevel)
  for (const feat of getOwnedFeats(draft)) add(feat.name, feat.effects?.meleeCritExtraWeaponDice, charLevel)
  return out
}

/**
 * Opções escolhidas nos slots de progressão de cada classe (invocações, manobras, metamágicas...),
 * só as dos slots que o nível NA classe já liberou, com a entrada de quem as escolheu. A que perdeu
 * o pré-requisito de opção (Lâmina Sedenta sem o Pacto da Lâmina) não vale: fica pendente na etapa
 * Classe e de fora daqui.
 */
function getOwnedProgressionOptions(
  draft: CharacterDraft,
): { entry: ClassEntry; option: ProgressionOption }[] {
  return allClassEntries(draft).flatMap(entry => {
    const { classId, level, classChoices: { subclass, progressionChoices } } = entry
    const slots = getProgressionSlotsUpToLevel(classId, subclass, level, progressionChoices)
    const activePicks = getActivePicks(classId, subclass, level, progressionChoices)
    return slots.flatMap(slot => {
      const picked = progressionChoices[slot.id] ?? []
      if (picked.length === 0) return []
      const options = getProgressionOptions(slot.optionsListId)
      return picked
        .map(id => options.find(o => o.id === id))
        .filter((o): o is ProgressionOption => o !== undefined)
        .filter(option => !getUnmetRequirement(classId, subclass, activePicks, option))
        .map(option => ({ entry, option }))
    })
  })
}

/** Ataques por ação que só valem numa situação, com a condição e quem os dá. */
export type SheetConditionalAttacks = { value: number; condition: string; source: string }

/**
 * Ataques a mais que dependem de uma situação (Lâmina Sedenta: dois "com sua arma do pacto",
 * p. 61). Ficam FORA do número das armas, cada um numa linha com a condição — a ficha não sabe
 * qual arma é a do pacto. O degrau segue o nível na classe que escolheu a opção (o "5° nível" do
 * pré-requisito). Somem quando o personagem já faz tantos ataques quanto eles dão: "a invocação
 * mística de bruxo Lâmina Sedenta não lhe concede ataques adicionais se você também tiver Ataque
 * Extra" (p. 166).
 */
export function getConditionalAttacks(draft: CharacterDraft): SheetConditionalAttacks[] {
  const base = getAttacksPerAction(draft).value
  const out: SheetConditionalAttacks[] = []
  for (const { entry, option } of getOwnedProgressionOptions(draft)) {
    const conditional = option.effects?.conditionalAttacksPerAction
    if (!conditional) continue
    const value = stepValue(conditional.byLevel, entry.level) ?? 1
    if (value <= base || out.some(o => o.source === option.name)) continue
    out.push({ value, condition: conditional.condition, source: option.name })
  }
  return out
}

/**
 * As linhas de ataques por ação que a Revisão e a ficha imprimível mostram — o mesmo texto nas
 * duas. Vazio para quem faz um ataque só.
 */
export function describeAttacksPerAction(draft: CharacterDraft): string[] {
  const { value, source } = getAttacksPerAction(draft)
  const lines = value > 1 && source
    ? [`${source}: você faz ${value} ataques ao usar a ação de Atacar.`]
    : []
  for (const c of getConditionalAttacks(draft)) {
    lines.push(`${c.source}: você faz ${c.value} ataques ao usar a ação de Atacar, ${c.condition}.`)
  }
  return lines
}

// ── Linhas de ataque: Estilo de Luta, Artes Marciais, golpe desarmado ──────────

/**
 * Os Estilos de Luta que o personagem tem: o de cada classe da multiclasse que dá um (guerreiro,
 * paladino, patrulheiro) e o Estilo de Luta Adicional do campeão 10, escolhido num slot de
 * progressão. Sem repetir — o mesmo estilo não vale duas vezes.
 */
export function getOwnedFightingStyleIds(draft: CharacterDraft): string[] {
  return [...new Set(getFightingStylePicks(draft).map(p => p.id))]
}

/** De onde vem um Estilo de Luta: o seletor da classe ou um slot de progressão dela (campeão 10). */
export type FightingStyleSource = 'class' | 'slot'

type FightingStylePick = { classId: string; source: FightingStyleSource; id: string }

/**
 * Cada Estilo de Luta escolhido que conta na ficha, com a fonte: o seletor de cada classe da
 * multiclasse (no nível em que ela o dá) e os slots `FIGHTING_STYLES` liberados pelo nível nela.
 */
function getFightingStylePicks(draft: CharacterDraft): FightingStylePick[] {
  return allClassEntries(draft).flatMap(entry => {
    const own = getEntryFightingStyle(entry)
    const fromClass: FightingStylePick[] = own ? [{ classId: entry.classId, source: 'class', id: own.id }] : []
    const fromSlots = getProgressionSlotsUpToLevel(entry.classId, entry.classChoices.subclass, entry.level, entry.classChoices.progressionChoices)
      .filter(slot => slot.optionsListId === 'FIGHTING_STYLES')
      .flatMap(slot => entry.classChoices.progressionChoices[slot.id] ?? [])
      .filter(id => FIGHTING_STYLES.some(s => s.id === id))
      .map((id): FightingStylePick => ({ classId: entry.classId, source: 'slot', id }))
    return [...fromClass, ...fromSlots]
  })
}

/**
 * Os Estilos de Luta que OUTRAS fontes já tomaram — o que o seletor (`'class'`) ou o slot do
 * campeão (`'slot'`) da classe `classId` não pode oferecer. "Você não pode escolher o mesmo Estilo
 * de Combate mais de uma vez, mesmo se puder escolher de novo" (p. 85, 110 e 117): vale entre as
 * classes da multiclasse (guerreiro + paladino) e entre o estilo da classe e o Adicional do campeão.
 */
export function getFightingStylesTakenElsewhere(
  draft: CharacterDraft,
  classId: string,
  source: FightingStyleSource,
): string[] {
  const others = getFightingStylePicks(draft).filter(p => p.classId !== classId || p.source !== source)
  return [...new Set(others.map(p => p.id))]
}

/** O que o painel de uma classe não pode oferecer no seletor de Estilo de Luta e no slot do campeão. */
export type TakenFightingStyles = Record<FightingStyleSource, string[]>

export function getTakenFightingStyles(draft: CharacterDraft, classId: string): TakenFightingStyles {
  return {
    class: getFightingStylesTakenElsewhere(draft, classId, 'class'),
    slot: getFightingStylesTakenElsewhere(draft, classId, 'slot'),
  }
}

/** Algum Estilo de Luta escolhido duas vezes (p. 85) — a etapa Classe não fica completa assim. */
export function hasRepeatedFightingStyle(draft: CharacterDraft): boolean {
  return getRepeatedFightingStyles(draft).length > 0
}

/** Os Estilos de Luta escolhidos mais de uma vez (ids, sem repetir) — o que o aviso da Revisão nomeia. */
export function getRepeatedFightingStyles(draft: CharacterDraft): string[] {
  const ids = getFightingStylePicks(draft).map(p => p.id)
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
}

/**
 * O Estilo de Luta que a classe da entrada dá e que conta na ficha: o escolhido, se a classe já o
 * deu no nível que se tem NELA (guerreiro no 1º; paladino e patrulheiro no 2º, p. 110 e 117) e se
 * ele está na lista da classe. Abaixo do nível a escolha continua no draft — volta a valer quando
 * o nível volta — mas não mexe em CA nem em ataque.
 */
function getEntryFightingStyle(entry: ClassEntry): (typeof FIGHTING_STYLES)[number] | undefined {
  const cls = getClass(entry.classId)
  if (!cls) return undefined
  return getClassFightingStyleOptions(cls, entry.level).find(s => s.id === entry.classChoices.fightingStyle)
}

/** Um Estilo de Luta como a ficha o mostra: a classe que o deu e o estilo, com nome e texto. */
export type SheetFightingStyle = { classId: string; style: (typeof FIGHTING_STYLES)[number] }

/**
 * O Estilo de Luta escolhido por cada classe da multiclasse que dá um (guerreiro, paladino,
 * patrulheiro), com o texto — o bloco "Estilo de Luta" da Revisão e da ficha imprimível. Estilo
 * de Proteção não mexe em número nenhum, então sem este bloco a escolha some da ficha. O Estilo
 * de Luta Adicional do campeão fica de fora: é slot de progressão e sai em "Escolhas de Progressão".
 */
export function getSheetFightingStyles(draft: CharacterDraft): SheetFightingStyle[] {
  return allClassEntries(draft).flatMap(entry => {
    const style = getEntryFightingStyle(entry)
    return style ? [{ classId: entry.classId, style }] : []
  })
}

/**
 * O que as características fazem nas linhas de ataque (`effects.weaponAttacks`): o Estilo de Luta
 * escolhido, features de classe (Golpes de Chi, Fúria) e talentos. Cada fonte entra uma vez só.
 * Quem aplica é `getWeaponAttack` numa arma e `getUnarmedStrike` no golpe desarmado — o bônus
 * incondicional no número, o resto como nota.
 *
 * O bônus de dano condicional (`conditionalDamage`) sai daqui calculado: o `amount` do recurso que
 * a MESMA característica declara, no nível NA classe dona (bárbaro 9 / guerreiro 3 tem o Dano de
 * Fúria +3; talento, no de personagem), com os atributos finais, e o equipamento que descumpre a
 * condição — a armadura vestida, o mesmo critério da CA.
 */
export function getWeaponAttackEffects(draft: CharacterDraft, finalScores: FinalScores): SourcedAttackEffect[] {
  const charLevel = draft.level ?? 1
  const prof = getProficiencyBonus(charLevel)
  const equipped = getDraftEquippedArmor(draft)
  const out: SourcedAttackEffect[] = []
  const seen = new Set<string>()
  const add = (source: string, effects: FeatureEffects | undefined, level: number) => {
    if (!effects?.weaponAttacks || seen.has(source)) return
    seen.add(source)
    for (const value of effects.weaponAttacks) {
      const damage = value.conditionalDamage
      const resource = damage && effects.resources?.find(r => r.id === damage.resource)
      if (!damage || !resource?.amount) {
        out.push({ source, value })
        continue
      }
      const blockedBy = damage.requires ? equipmentBlocker(damage.requires, equipped) : undefined
      out.push({
        source, value,
        conditionalDamage: {
          value: evaluateQuantity(resource.amount.value, level, finalScores, prof),
          name: resource.name, condition: damage.condition,
          ...(blockedBy ? { blockedBy } : {}),
        },
      })
    }
  }
  for (const id of getOwnedFightingStyleIds(draft)) {
    const style = FIGHTING_STYLES.find(s => s.id === id)
    if (style) add(style.name, style.effects, charLevel)
  }
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    for (const feature of features) add(feature.name, feature.effects, entry.level)
  }
  for (const feat of getOwnedFeats(draft)) add(feat.name, feat.effects, charLevel)
  return out
}

/**
 * Artes Marciais na ficha: o dado (lados) no nível de monge e se o equipamento deixa usá-la
 * agora. Como o Movimento sem Armadura, a ficha confere a armadura e o escudo equipados; quando
 * algo impede, `blockedBy` diz o quê. `null` para quem não tem.
 */
export type SheetMartialArts = {
  source: string
  die: number
  condition: string
  active: boolean
  blockedBy?: string
}

export function getMartialArts(draft: CharacterDraft, finalScores: FinalScores): SheetMartialArts | null {
  let best: SheetMartialArts | null = null
  for (const { entry, features } of getOwnedClassFeaturesByEntry(draft)) {
    for (const feature of features) {
      const martialArts = feature.effects?.martialArts
      if (!martialArts) continue
      const resource = feature.effects?.resources?.find(r => r.id === martialArts.dieResource)
      const die = resource?.die ? evaluateQuantity(resource.die.size, entry.level, finalScores) : 0
      if (die <= 0 || (best && best.die >= die)) continue
      const blockedBy = equipmentBlocker(martialArts.requires, getDraftEquippedArmor(draft))
      best = {
        source: feature.name, die, condition: martialArts.condition, active: !blockedBy,
        ...(blockedBy ? { blockedBy } : {}),
      }
    }
  }
  return best
}

/**
 * Dado de dano do golpe desarmado que uma característica dá no lugar do 1 fixo (Especialista em
 * Briga: d4, p. 169). Vale o maior; `null` sem nenhum.
 */
export function getUnarmedDamageDie(draft: CharacterDraft): SheetEffect<number> | null {
  let best: SheetEffect<number> | null = null
  const consider = (source: string, die: number | undefined) => {
    if (die && (!best || die > best.value)) best = { source, value: die }
  }
  for (const feat of getOwnedFeats(draft)) consider(feat.name, feat.effects?.unarmedDamageDie)
  for (const feature of getOwnedClassFeatures(draft)) consider(feature.name, feature.effects?.unarmedDamageDie)
  return best
}

/**
 * O que ignora a propriedade recarga (Especialista em Besta, p. 169), de talentos e features.
 * Quem decide se vale numa arma — id e proficiência — é `getWeaponAttack`.
 */
export function getLoadingOverrides(draft: CharacterDraft): SheetEffect<LoadingOverride>[] {
  const out: SheetEffect<LoadingOverride>[] = []
  for (const feat of getOwnedFeats(draft)) {
    if (feat.effects?.ignoresLoading) out.push({ source: feat.name, value: feat.effects.ignoresLoading })
  }
  for (const feature of getOwnedClassFeatures(draft)) {
    if (feature.effects?.ignoresLoading) out.push({ source: feature.name, value: feature.effects.ignoresLoading })
  }
  return out
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
  /**
   * Manobras que o personagem já conhece pelo Mestre de Batalha (`getClassManeuvers`) — o
   * Adepto Marcial não as oferece. Vazio para talento sem `maneuverChoice`.
   */
  takenManeuvers: string[]
}

/**
 * Talentos possuídos que abrem escolhas (Perito, Poliglota, Mestre de Armas: proficiências;
 * Adepto Marcial: manobras; Iniciado em Magia: classe, truques e magia).
 */
export function getFeatChoiceSlots(draft: CharacterDraft): FeatChoiceSlot[] {
  return getOwnedFeats(draft)
    .filter(feat => {
      const choices = feat.effects?.choices
      // savingThrowFromAbilityChoice não abre slot: reaproveita o atributo do +1 do talento.
      return choices?.skillOrToolChoice || choices?.languageChoice || choices?.weaponChoice || choices?.maneuverChoice
        || choices?.spellChoice
    })
    .map(feat => ({
      feat,
      choices: feat.effects!.choices!,
      selections: draft.featSelections[feat.id] ?? {},
      takenManeuvers: feat.effects?.choices?.maneuverChoice ? getClassManeuvers(draft) : [],
    }))
}

/**
 * Manobras escolhidas no talento que o personagem já conhece pelo Mestre de Batalha. O seletor
 * não as oferece; só chegam aqui por ficha antiga ou importada, ou por subclasse trocada e
 * desfeita. Seguram a etapa do talento até serem trocadas.
 */
export function getRepeatedFeatManeuvers(slot: FeatChoiceSlot): string[] {
  return (slot.selections.maneuvers ?? []).filter(id => slot.takenManeuvers.includes(id))
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
  if (choices.maneuverChoice) {
    if ((selections.maneuvers?.length ?? 0) < choices.maneuverChoice.count) return false
    if (getRepeatedFeatManeuvers(slot).length > 0) return false
  }
  const spellGaps = getFeatSpellChoiceGaps(slot)
  if (spellGaps && (spellGaps.needsClass || spellGaps.cantrips > 0 || spellGaps.spells > 0)) return false
  return true
}

/**
 * O que falta no slot de magias do talento (Iniciado em Magia, p. 170): a classe, e quantos
 * truques e magias da lista dela. Conta só as escolhas válidas (getFeatSpellPicks) — magia de
 * outra lista, de ficha importada, não preenche. null para talento sem `spellChoice`.
 */
export function getFeatSpellChoiceGaps(
  slot: FeatChoiceSlot,
): { needsClass: boolean; cantrips: number; spells: number; spellLevel: number } | null {
  const choice = slot.choices.spellChoice
  if (!choice) return null
  const picks = getFeatSpellPicks(choice, slot.selections)
  return {
    needsClass: picks.spellClass === null,
    cantrips: choice.cantrips - picks.cantrips.length,
    spells: choice.spells - picks.spells.length,
    spellLevel: choice.spellLevel,
  }
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

/** As chaves de `FeatSelections` que são listas (a classe do Iniciado em Magia é uma só). */
type FeatSelectionList = 'skills' | 'tools' | 'languages' | 'weapons' | 'maneuvers'

/**
 * O que cada talento possuído escolheu numa lista, com o talento dono — as perícias e ferramentas
 * do Perito entram assim nas concessões de `proficiencyUtils`, que precisa saber de qual talento
 * cada uma veio para dizer o que repete.
 */
export function getFeatSelectionsByFeat(
  draft: CharacterDraft,
  key: FeatSelectionList,
): { featId: string; ids: string[] }[] {
  return getOwnedFeats(draft).map(f => ({ featId: f.id, ids: draft.featSelections[f.id]?.[key] ?? [] }))
}

function selectionsOf(draft: CharacterDraft, key: FeatSelectionList): string[] {
  return getFeatSelectionsByFeat(draft, key).flatMap(s => s.ids)
}

/** Idiomas aprendidos por talento (Poliglota). */
export function getFeatGrantedLanguages(draft: CharacterDraft): string[] {
  return selectionsOf(draft, 'languages')
}

/** Armas liberadas por talento (Mestre de Armas). */
export function getFeatWeaponProficiencies(draft: CharacterDraft): string[] {
  return selectionsOf(draft, 'weapons')
}

/** Manobras aprendidas por talento (Adepto Marcial) — o que o slot de manobra da classe não oferece. */
export function getFeatManeuvers(draft: CharacterDraft): string[] {
  return [...new Set(selectionsOf(draft, 'maneuvers'))]
}

/** Uma manobra do talento como a ficha a mostra; `repeated` quando o Mestre de Batalha já a dá. */
export type SheetFeatManeuver = { id: string; name: string; text: string; repeated: boolean }

/**
 * As manobras que um talento ensina (Adepto Marcial, p. 167), com o texto, e a linha da CD
 * (8 + proficiência + FOR ou DES, com os atributos FINAIS) — o que a Revisão e o PDF mostram
 * sob o talento. null para talento sem `maneuverChoice` ou sem manobra escolhida.
 */
export function getFeatManeuverBlock(
  draft: CharacterDraft,
  featId: string,
  scores: FinalScores,
): { maneuvers: SheetFeatManeuver[]; saveDc: string } | null {
  const slot = getFeatChoiceSlots(draft).find(s => s.feat.id === featId)
  if (!slot?.choices.maneuverChoice) return null
  const repeated = new Set(getRepeatedFeatManeuvers(slot))
  const maneuvers = (slot.selections.maneuvers ?? []).flatMap((id): SheetFeatManeuver[] => {
    const m = getManeuver(id)
    return m ? [{ id, name: m.name, text: m.description ?? '', repeated: repeated.has(id) }] : []
  })
  if (maneuvers.length === 0) return null
  return { maneuvers, saveDc: formatManeuverSaveDc(getManeuverSaveDc(draft.level, scores)) }
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

/**
 * Resistências ganhas por característica de classe ou subclasse (Mente Escorregadia, Alma de
 * Diamante), cada classe da multiclasse no nível que tem nela: um guerreiro 5 / ladino 15 ganha
 * Sabedoria. A regra da p. 166 corta só as proficiências INICIAIS da classe adicional, não o que
 * ela dá por nível.
 */
export function getClassFeatureSavingThrows(draft: CharacterDraft): AbilityScore[] {
  const out = getOwnedClassFeatures(draft).flatMap(f => {
    const granted = f.effects?.savingThrowProficiencies
    return granted === 'all' ? ALL_ABILITY_SCORES : (granted ?? [])
  })
  return [...new Set(out)]
}

// ── Condições (estado de jogo) ─────────────────────────────────────────────────
//
// O estado de jogo é mais uma fonte deste agregador, não um agregador paralelo: ele passa as
// condições gravadas e o nível de exaustão, e daqui sai o que está valendo — o modo de cada
// jogada, falhas automáticas, deslocamento, PV máximo, concentração e as linhas condicionais.
// Regras em `docs/regras-condicoes.md` (Apêndice A, págs. 291-293). Mesma regra de ouro do resto
// do arquivo: incondicional entra no número/modo; condicional vira linha com a origem.
//
// Os imports ficam aqui, e não no topo, pra seção poder ser acrescentada sem mexer no resto.

import conditionsData from '../data/conditions.json'
import type {
  Condition, ConditionCatalog, ConditionEffect, ConditionId, ExhaustionLevel, ImmuneDamageType, RollMode,
} from '../types/condition'

const CONDITION_CATALOG = conditionsData as ConditionCatalog

/** As 14 condições do Apêndice A, na ordem do livro em português. */
export const CONDITIONS: Condition[] = CONDITION_CATALOG.conditions

/** A exaustão, com a tabela de 6 níveis cumulativa (pág. 292). */
export const EXHAUSTION = CONDITION_CATALOG.exhaustion

const CONDITIONS_BY_ID = new Map(CONDITIONS.map(c => [c.id, c]))

const ALL_ABILITIES: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export function getCondition(id: ConditionId): Condition | undefined {
  return CONDITIONS_BY_ID.get(id)
}

/** O que o estado de jogo guarda das condições: as gravadas e o nível de exaustão. */
export type ConditionState = { conditions: readonly ConditionId[]; exhaustion: ExhaustionLevel }

/**
 * Origem estável de um efeito, no formato do motor de rolagem (`regras-rolagens-e-concentracao.md`,
 * 11.2): `condition:poisoned` / "Envenenado", `exhaustion:3` / "Exaustão 3".
 */
export type ConditionSource = { source: string; label: string }

/** Condição valendo agora: gravada (`direct`) e/ou derivada de outra (`impliedBy`). */
export type EffectiveCondition = {
  id: ConditionId
  name: string
  direct: boolean
  impliedBy: ConditionId[]
  /**
   * Só em `getActiveConditionEffects`: condições ativas que suspendem esta (Petrificado →
   * Envenenado). Suspensa continua na lista, para a UI marcar, mas não tem efeito.
   */
  suspendedBy?: ConditionId[]
}

/** Uma jogada sob as condições: as fontes de cada lado, o modo já resolvido e as falhas automáticas. */
export type ConditionRoll = {
  mode: RollMode
  advantage: ConditionSource[]
  disadvantage: ConditionSource[]
  autoFail: ConditionSource[]
}

export type ConditionFlag = { active: boolean; sources: ConditionSource[] }

/** Linha condicional para a UI: nunca altera número. */
export type ConditionLine = {
  kind: Extract<ConditionEffect, { scope: 'notice' }>['kind']
  text: string
  source: ConditionSource
  page?: number
}

export type ActiveConditionEffects = {
  conditions: EffectiveCondition[]
  exhaustion: ExhaustionLevel
  attack: ConditionRoll
  abilityChecks: Record<AbilityScore, ConditionRoll>
  savingThrows: Record<AbilityScore, ConditionRoll>
  /** Iniciativa é teste de Destreza (pág. 179): o mesmo que `abilityChecks.DEX`. */
  initiative: ConditionRoll
  /**
   * Teste contra a morte: só as fontes que valem para TODOS os testes de resistência (hoje, a
   * Exaustão 3), nunca as de um atributo, e sem falha automática — a do Inconsciente é só de FOR
   * e DES (`regras-dano-e-morte.md`, Notas, "Teste contra a morte"; `regras-condicoes.md`, item 16).
   */
  deathSave: ConditionRoll
  /** Ajuste do valor passivo por atributo: +5 com vantagem, −5 com desvantagem (pág. 177). */
  passiveModifier: Record<AbilityScore, -5 | 0 | 5>
  /** `zero` prevalece sobre `half`. */
  speed: {
    result: 'normal' | 'half' | 'zero'
    ignoreBonuses: boolean
    zero: ConditionSource[]
    half: ConditionSource[]
  }
  hpMax: { multiplier: 1 | 0.5; sources: ConditionSource[] }
  noActions: ConditionFlag
  noReactions: ConditionFlag
  cannotSpeak: ConditionFlag
  endsConcentration: ConditionFlag
  resistAllDamage: ConditionFlag
  /** Imunidades a um tipo de dano (Petrificado: veneno), cada uma com quem a dá. */
  damageImmunities: ConditionDamageImmunity[]
  dead: ConditionFlag
  lines: ConditionLine[]
}

/** Imunidade ativa a um tipo de dano: o dano desse tipo vira 0 no rastreador de PV. */
export type ConditionDamageImmunity = { damageType: ImmuneDamageType; damageLabel: string; sources: ConditionSource[] }

/**
 * Vantagem e desvantagem (pág. 175): várias do mesmo lado valem uma; uma de cada lado anula,
 * qualquer que seja a quantidade. Candidata a morar em `src/core/dice` (a regra não depende do
 * que é cada fonte) — até lá, serve para juntar as fontes da ficha às das condições.
 */
export function resolveRollMode(advantage: readonly unknown[], disadvantage: readonly unknown[]): RollMode {
  if (advantage.length > 0 && disadvantage.length > 0) return 'normal'
  if (advantage.length > 0) return 'advantage'
  if (disadvantage.length > 0) return 'disadvantage'
  return 'normal'
}

/**
 * Condições efetivas: as gravadas mais as que elas implicam (Paralisado ⇒ Incapacitado), sem
 * repetir — "ou a criatura tem a condição ou não" (pág. 291). Ids desconhecidos são ignorados.
 */
export function getEffectiveConditions(ids: readonly ConditionId[]): EffectiveCondition[] {
  const direct = new Set(ids.filter(id => CONDITIONS_BY_ID.has(id)))
  const out = new Map<ConditionId, EffectiveCondition>()
  const visit = (id: ConditionId, parent?: ConditionId) => {
    const cond = CONDITIONS_BY_ID.get(id)
    if (!cond) return
    const existing = out.get(id)
    const entry = existing ?? { id, name: cond.name, direct: direct.has(id), impliedBy: [] }
    if (!existing) out.set(id, entry)
    if (parent && !entry.impliedBy.includes(parent)) entry.impliedBy.push(parent)
    if (!existing) for (const child of cond.implies) visit(child, id)
  }
  for (const id of direct) visit(id)
  return [...out.values()]
}

/**
 * Aplica uma condição à lista gravada, com o que ela dispara ao ser aplicada (`onApply`):
 * Inconsciente grava também o Caído, que fica depois de acordar (sai ao levantar).
 */
export function withConditionApplied(conditions: readonly ConditionId[], id: ConditionId): ConditionId[] {
  const added = [id, ...(getCondition(id)?.onApply?.addConditions ?? [])]
  return [...new Set([...conditions, ...added])]
}

function clampExhaustion(level: number): ExhaustionLevel {
  return Math.max(0, Math.min(6, Math.floor(level))) as ExhaustionLevel
}

function conditionSourceOf(cond: EffectiveCondition): ConditionSource {
  if (cond.direct || cond.impliedBy.length === 0) return { source: `condition:${cond.id}`, label: cond.name }
  const parents = cond.impliedBy.map(id => getCondition(id)?.name ?? id).join(', ')
  return { source: `condition:${cond.id}`, label: `${cond.name} (por ${parents})` }
}

const emptyRoll = (): ConditionRoll => ({ mode: 'normal', advantage: [], disadvantage: [], autoFail: [] })

const byAbility = <T>(make: (ability: AbilityScore) => T): Record<AbilityScore, T> =>
  Object.fromEntries(ALL_ABILITIES.map(a => [a, make(a)])) as Record<AbilityScore, T>

const flag = (sources: ConditionSource[]): ConditionFlag => ({ active: sources.length > 0, sources })

/**
 * Os efeitos ATIVOS das condições e da exaustão, resolvidos. Pura: o estado de jogo passa o que
 * guardou, a ficha não muda. A exaustão é cumulativa (nível N aplica 1..N); o nível 6 sinaliza
 * morte e encerra a concentração. As falhas automáticas não impedem rolar ("rolar mesmo assim"
 * é da UI); a desvantagem em testes de habilidade vale também na iniciativa e no passivo.
 * Condição suspensa por outra ativa (`suspends`: Petrificado → Envenenado) fica na lista com
 * `suspendedBy`, sem efeito nenhum, e com uma linha dizendo que está suspensa.
 */
export function getActiveConditionEffects(state: ConditionState): ActiveConditionEffects {
  const exhaustion = clampExhaustion(state.exhaustion)
  const lines: ConditionLine[] = []

  const effective = getEffectiveConditions(state.conditions)
  const suspendedBy = new Map<ConditionId, ConditionId[]>()
  for (const cond of effective) {
    for (const effect of getCondition(cond.id)?.effects ?? []) {
      if (effect.kind !== 'suspends') continue
      for (const id of effect.conditions) {
        if (id === cond.id || !effective.some(c => c.id === id)) continue
        suspendedBy.set(id, [...(suspendedBy.get(id) ?? []), cond.id])
        lines.push({
          kind: 'notice',
          text: `${getCondition(id)?.name ?? id} fica suspenso enquanto durar ${cond.name}: sem efeito, mas não removido.`,
          source: conditionSourceOf(cond),
          page: 293,
        })
      }
    }
  }
  const conditions = effective.map(cond =>
    suspendedBy.has(cond.id) ? { ...cond, suspendedBy: suspendedBy.get(cond.id) } : cond)

  const tagged: { source: ConditionSource; effect: ConditionEffect }[] = [
    ...conditions.filter(cond => !cond.suspendedBy).flatMap(cond => {
      const source = conditionSourceOf(cond)
      return (getCondition(cond.id)?.effects ?? []).map(effect => ({ source, effect }))
    }),
    ...EXHAUSTION.levels
      .filter(row => row.level <= exhaustion)
      .flatMap(row => {
        const source = { source: `exhaustion:${row.level}`, label: `Exaustão ${row.level}` }
        return row.effects.map(effect => ({ source, effect }))
      }),
  ]

  const attack = emptyRoll()
  const abilityChecks = byAbility(() => emptyRoll())
  const savingThrows = byAbility(() => emptyRoll())
  const deathSave = emptyRoll()
  const speedZero: ConditionSource[] = []
  const speedHalf: ConditionSource[] = []
  let ignoreBonuses = false
  const hpHalf: ConditionSource[] = []
  const stateFlags = {
    noActions: [] as ConditionSource[],
    noReactions: [] as ConditionSource[],
    cannotSpeak: [] as ConditionSource[],
    endsConcentration: [] as ConditionSource[],
    death: [] as ConditionSource[],
  }
  const resistAll: ConditionSource[] = []
  const immunities: ConditionDamageImmunity[] = []

  for (const { source, effect } of tagged) {
    if (effect.scope === 'notice') {
      const page = effect.kind === 'notice' ? effect.page : undefined
      lines.push(page ? { kind: effect.kind, text: effect.text, source, page } : { kind: effect.kind, text: effect.text, source })
      continue
    }
    switch (effect.kind) {
      case 'rollMode': {
        const side = effect.mode === 'advantage' ? 'advantage' : 'disadvantage'
        for (const roll of effect.rolls) {
          if (roll === 'attack') {
            attack[side].push(source)
            continue
          }
          const table = roll === 'save' ? savingThrows : abilityChecks
          for (const ability of effect.abilities ?? ALL_ABILITIES) table[ability][side].push(source)
          if (roll === 'save' && !effect.abilities) deathSave[side].push(source)
        }
        break
      }
      case 'autoFail': {
        const table = effect.roll === 'save' ? savingThrows : abilityChecks
        for (const ability of effect.abilities ?? ALL_ABILITIES) table[ability].autoFail.push(source)
        break
      }
      case 'speed':
        if (effect.op === 'zero') {
          speedZero.push(source)
          if (effect.ignoreBonuses) ignoreBonuses = true
        } else {
          speedHalf.push(source)
        }
        break
      case 'hpMax':
        hpHalf.push(source)
        break
      case 'damageResistance':
        resistAll.push(source)
        break
      case 'damageImmunity': {
        const existing = immunities.find(i => i.damageType === effect.damageType)
        if (existing) existing.sources.push(source)
        else immunities.push({ damageType: effect.damageType, damageLabel: effect.damageLabel, sources: [source] })
        break
      }
      case 'noActions':
      case 'noReactions':
      case 'cannotSpeak':
      case 'endsConcentration':
      case 'death':
        stateFlags[effect.kind].push(source)
        break
      case 'suspends':
        // Já tratado antes do laço: a condição suspensa nem entra em `tagged`.
        break
    }
  }

  for (const roll of [attack, deathSave, ...Object.values(abilityChecks), ...Object.values(savingThrows)]) {
    roll.mode = resolveRollMode(roll.advantage, roll.disadvantage)
  }
  const passive = (mode: RollMode) => (mode === 'advantage' ? 5 : mode === 'disadvantage' ? -5 : 0)

  return {
    conditions,
    exhaustion,
    attack,
    abilityChecks,
    savingThrows,
    initiative: { ...abilityChecks.DEX },
    deathSave,
    passiveModifier: byAbility(a => passive(abilityChecks[a].mode)),
    speed: {
      result: speedZero.length > 0 ? 'zero' : speedHalf.length > 0 ? 'half' : 'normal',
      ignoreBonuses,
      zero: speedZero,
      half: speedHalf,
    },
    hpMax: { multiplier: hpHalf.length > 0 ? 0.5 : 1, sources: hpHalf },
    noActions: flag(stateFlags.noActions),
    noReactions: flag(stateFlags.noReactions),
    cannotSpeak: flag(stateFlags.cannotSpeak),
    endsConcentration: flag(stateFlags.endsConcentration),
    resistAllDamage: flag(resistAll),
    damageImmunities: immunities,
    dead: flag(stateFlags.death),
    lines,
  }
}

/**
 * Metade de um deslocamento em pés, arredondada para baixo na grade de 1,5 m (5 pés): 25 pés →
 * 10 pés (3 m), 30 → 15 (4,5 m). Decisão de 2026-10-25 (`regras-condicoes.md`, item 10): vale para
 * toda metade de deslocamento do modo de jogo (Exaustão 2, levantar-se).
 */
export function halveSpeedOnGrid(speedFeet: number): number {
  return Math.floor(speedFeet / 10) * 5
}

/**
 * Deslocamento efetivo em pés, a partir do da ficha JÁ com bônus: 0 se algo zera (o "sem bônus"
 * do Agarrado/Impedido dá no mesmo); metade na grade de 1,5 m na Exaustão 2 (`halveSpeedOnGrid`).
 */
export function applyConditionSpeed(speedFeet: number, effects: Pick<ActiveConditionEffects, 'speed'>): number {
  if (effects.speed.result === 'zero') return 0
  if (effects.speed.result === 'half') return halveSpeedOnGrid(speedFeet)
  return speedFeet
}

/** PV máximo efetivo: metade, arredondada para baixo, a partir da Exaustão 4 (págs. 7, 292). */
export function getEffectiveHpMax(hpMax: number, effects: Pick<ActiveConditionEffects, 'hpMax'>): number {
  return Math.floor(hpMax * effects.hpMax.multiplier)
}
