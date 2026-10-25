import type { CharacterDraft, ClassEntry, FeatSelections } from '../types/character'
import type { Feat } from '../types/feat'
import type { ArmorProficiency, LevelFeature } from '../types/class'
import type { AbilityScore, RacialTrait } from '../types/race'
import type {
  ConditionalAcBonus, EquipmentRequirement, LoadingOverride, ResourceEffect, WeaponAttackEffect,
} from '../types/effects'
import { getFeat } from './featUtils'
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
import { getProgressionSlotsUpToLevel } from './progressionChoiceUtils'
import { getProgressionOptions, type ProgressionOption } from './progressionOptions'
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
    for (const effect of feat.effects?.resources ?? []) out.push({ effect, source, level: charLevel })
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

/**
 * Opções escolhidas nos slots de progressão de cada classe (invocações, manobras, metamágicas...),
 * só as dos slots que o nível NA classe já liberou, com a entrada de quem as escolheu.
 */
function getOwnedProgressionOptions(
  draft: CharacterDraft,
): { entry: ClassEntry; option: ProgressionOption }[] {
  return allClassEntries(draft).flatMap(entry => {
    const slots = getProgressionSlotsUpToLevel(entry.classId, entry.classChoices.subclass, entry.level)
    return slots.flatMap(slot => {
      const picked = entry.classChoices.progressionChoices[slot.id] ?? []
      if (picked.length === 0) return []
      const options = getProgressionOptions(slot.optionsListId)
      return picked
        .map(id => options.find(o => o.id === id))
        .filter((o): o is ProgressionOption => o !== undefined)
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
    const fromSlots = getProgressionSlotsUpToLevel(entry.classId, entry.classChoices.subclass, entry.level)
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
 * escolhido, features de classe (Golpes de Chi) e talentos. Cada fonte entra uma vez só. Quem
 * aplica numa arma é `getWeaponAttack` — o bônus incondicional no número, o resto como nota.
 */
export function getWeaponAttackEffects(draft: CharacterDraft): SheetEffect<WeaponAttackEffect>[] {
  const out: SheetEffect<WeaponAttackEffect>[] = []
  const seen = new Set<string>()
  const add = (source: string, effects: WeaponAttackEffect[] | undefined) => {
    if (!effects || seen.has(source)) return
    seen.add(source)
    for (const value of effects) out.push({ source, value })
  }
  for (const id of getOwnedFightingStyleIds(draft)) {
    const style = FIGHTING_STYLES.find(s => s.id === id)
    if (style) add(style.name, style.effects?.weaponAttacks)
  }
  for (const feature of getOwnedClassFeatures(draft)) add(feature.name, feature.effects?.weaponAttacks)
  for (const feat of getOwnedFeats(draft)) add(feat.name, feat.effects?.weaponAttacks)
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
