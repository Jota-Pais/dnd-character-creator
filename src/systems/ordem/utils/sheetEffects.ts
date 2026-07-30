import type { OrdemCharacterDraft } from '../types/character'
import type { ClassPower } from '../types/power'
import type { OrdemClass } from '../types/class'
import type { ConditionalSkillBonus, ConditionalDefenseBonus } from '../types/effects'
import { getOrigin } from './originUtils'
import { getPower } from './powerUtils'
import { getPatente } from './patenteUtils'
import { getReachedTrilhaFeaturesWithSource, hasClassPower, getOriginEffects } from './characterUtils'
import { getExpansionGrantedClassPowers, getParanormalInstances } from './paranormalPowerUtils'
import {
  getLoadPenaltySkillBonuses, getAccessorySkillBonuses, getEquipmentByInstance, getInstanceLabel,
  hasProtectionProficiency,
} from './equipmentUtils'
import { getSheetAttributes } from './curseUtils'
import { getPeLimit } from './progressionUtils'
import { getDicePool, NO_PROFICIENCY_DICE_PENALTY, type DicePool } from './attributeUtils'
import { getSkill } from './skillUtils'

/**
 * Agregador dos efeitos que a ficha EXIBE somados, atravessando as quatro famílias de habilidade
 * (origem, classe, trilha e poder paranormal) e o equipamento. Fica num módulo próprio, e não em
 * `characterUtils`, porque precisa ler o loadout (`equipmentUtils`) — que por sua vez lê
 * `characterUtils`. Nada importa este módulo além da UI, então não há ciclo.
 *
 * Regra geral: efeito INCONDICIONAL entra no número da ficha; efeito CONDICIONAL vira linha
 * própria com a condição, porque somá-lo seria mentir (o +5 do Hacker não vale em todo teste de
 * Tecnologia, o +10 do Inquebrável só vale machucado).
 */

// ── Bônus de perícia ───────────────────────────────────────────────────────────

export type SheetSkillBonus = {
  skillId: string
  value: number
  /** Nome da habilidade ou do item que concede (ex.: "Gatuno", "Hacker", "Utensílio"). */
  source: string
  /** Condição de aplicação; ausente = incondicional (soma no total da perícia). */
  condition?: string
  /**
   * Bônus que não acumula com outros do mesmo grupo: "bônus fornecidos por itens não são
   * cumulativos" (p. 63). Numa perícia com vários deles, só o MAIOR entra no total — os demais
   * ficam listados como redundantes. Penalidades (ex.: carga) nunca são marcadas, pra sempre somarem.
   */
  nonCumulative?: boolean
}

/** Poderes de classe que o agente possui, por qualquer via, com os dados do catálogo. */
function getOwnedClassPowers(draft: OrdemCharacterDraft): ClassPower[] {
  const ids = new Set<string>()
  for (const id of draft.powerChoices) if (id) ids.add(id)
  if (draft.versatilityChoice?.kind === 'power') ids.add(draft.versatilityChoice.powerId)
  for (const granted of getExpansionGrantedClassPowers(draft)) ids.add(granted.powerId)
  return [...ids].map(getPower).filter((p): p is ClassPower => Boolean(p))
}

/**
 * TODOS os bônus de perícia da ficha, com a fonte de cada um — origem, poderes de classe
 * (inclusive os aprendidos por Expansão de Conhecimento), features de trilha alcançadas, poderes
 * paranormais e a penalidade de carga da Proteção Pesada (bônus negativo).
 */
export function getSheetSkillBonuses(draft: OrdemCharacterDraft): SheetSkillBonus[] {
  const out: SheetSkillBonus[] = []
  const push = (
    source: string,
    flat: Record<string, number> | undefined,
    conditional: ConditionalSkillBonus[] | undefined,
  ) => {
    for (const [skillId, value] of Object.entries(flat ?? {})) out.push({ skillId, value, source })
    for (const entry of conditional ?? []) {
      for (const skillId of entry.skills) {
        out.push({ skillId, value: entry.value, source, condition: entry.condition })
      }
    }
  }

  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  if (origin?.power.effects) {
    push(origin.power.name, origin.power.effects.skillBonus, origin.power.effects.conditionalSkillBonus)
  }
  for (const power of getOwnedClassPowers(draft)) {
    push(power.name, power.effects?.skillBonus, power.effects?.conditionalSkillBonus)
  }
  for (const { feature } of getReachedTrilhaFeaturesWithSource(draft)) {
    push(feature.name, feature.effects?.skillBonus, feature.effects?.conditionalSkillBonus)
  }
  for (const instance of getParanormalInstances(draft)) {
    if (!instance.valid || !instance.power) continue
    const effects = instance.isAffinityCopy ? instance.power.affinityEffects : instance.power.effects
    if (effects) push(instance.power.name, effects.skillBonus, effects.conditionalSkillBonus)
  }
  out.push(...getAccessorySkillBonuses(draft))
  out.push(...getLoadPenaltySkillBonuses(draft))
  return out
}

/**
 * Bônus INCONDICIONAIS numa perícia — o número que entra na coluna da ficha.
 *
 * Habilidades somam entre si; bônus de ITEM não ("bônus fornecidos por itens não são cumulativos",
 * p. 63), então entra só o MAIOR deles. A penalidade de carga da Proteção Pesada é somada sempre,
 * porque é penalidade, não bônus concorrente.
 */
export function getSkillBonusTotal(draft: OrdemCharacterDraft, skillId: string): number {
  const applicable = getSheetSkillBonuses(draft).filter(b => b.skillId === skillId && !b.condition)
  const cumulative = applicable.filter(b => !b.nonCumulative).reduce((s, b) => s + b.value, 0)
  const bestItem = applicable.filter(b => b.nonCumulative).reduce((max, b) => Math.max(max, b.value), 0)
  return cumulative + bestItem
}

/** Perícias com bônus incondicional (positivo ou negativo), pra listar as não treinadas afetadas. */
export function getSkillsWithUnconditionalBonus(draft: OrdemCharacterDraft): string[] {
  return [...new Set(getSheetSkillBonuses(draft).filter(b => !b.condition).map(b => b.skillId))]
}

/** Bônus condicionais, agrupados por fonte+condição+valor pra virar uma linha por habilidade. */
export function getConditionalSkillBonuses(
  draft: OrdemCharacterDraft,
): { source: string; condition: string; value: number; skillIds: string[] }[] {
  const groups = new Map<string, { source: string; condition: string; value: number; skillIds: string[] }>()
  for (const bonus of getSheetSkillBonuses(draft)) {
    if (!bonus.condition) continue
    const key = `${bonus.source}::${bonus.condition}::${bonus.value}`
    const group = groups.get(key)
    if (group) group.skillIds.push(bonus.skillId)
    else groups.set(key, { source: bonus.source, condition: bonus.condition, value: bonus.value, skillIds: [bonus.skillId] })
  }
  return [...groups.values()]
}

// ── Penalidades em DADOS (proficiência) ────────────────────────────────────────

/**
 * Proteções equipadas com as quais o agente NÃO tem proficiência. "Se você usar uma proteção com a
 * qual não seja proficiente, sofre –ØØ em testes baseados em Força ou Agilidade" (p. 62).
 */
export function getUnproficientProtections(draft: OrdemCharacterDraft): string[] {
  return draft.equipmentChoices.filter(uid => {
    const item = getEquipmentByInstance(uid)
    return item?.type === 'protection' && !hasProtectionProficiency(draft, item)
  })
}

/**
 * Penalidade em DADOS nos testes de um atributo. Hoje a única fonte é a proteção sem proficiência
 * (–ØØ em Força e Agilidade); não acumula por peça, porque a penalidade é da condição de "estar
 * usando proteção sem proficiência", não de cada proteção separada.
 */
export function getAttributeDicePenalty(
  draft: OrdemCharacterDraft,
  attribute: 'agility' | 'strength' | 'intellect' | 'presence' | 'vigor',
): number {
  if (attribute !== 'strength' && attribute !== 'agility') return 0
  return getUnproficientProtections(draft).length > 0 ? NO_PROFICIENCY_DICE_PENALTY : 0
}

/** Pool de d20 de uma perícia na ficha, já com atributo 0 e a penalidade de proteção. */
export function getSkillDicePool(draft: OrdemCharacterDraft, skillId: string): DicePool {
  const skill = getSkill(skillId)
  if (!skill) return { dice: 1, mode: 'best' }
  const attribute = skill.attribute as 'agility' | 'strength' | 'intellect' | 'presence' | 'vigor'
  const attrs = getSheetAttributes(draft)
  return getDicePool(attrs[attribute], getAttributeDicePenalty(draft, attribute))
}

// ── Defesa condicional ─────────────────────────────────────────────────────────

export type SheetConditionalDefense = ConditionalDefenseBonus & { source: string }

/**
 * Bônus de Defesa condicionais de todas as fontes (Reflexos Defensivos, Inquebrável, Campo
 * Protetor). Ficam FORA do valor de Defesa da ficha — cada um é uma linha com a condição.
 */
export function getConditionalDefenseBonuses(draft: OrdemCharacterDraft): SheetConditionalDefense[] {
  const out: SheetConditionalDefense[] = []
  for (const power of getOwnedClassPowers(draft)) {
    for (const entry of power.effects?.conditionalDefenseBonus ?? []) out.push({ ...entry, source: power.name })
  }
  for (const { feature } of getReachedTrilhaFeaturesWithSource(draft)) {
    for (const entry of feature.effects?.conditionalDefenseBonus ?? []) out.push({ ...entry, source: feature.name })
  }
  for (const instance of getParanormalInstances(draft)) {
    if (!instance.valid || !instance.power) continue
    const effects = instance.isAffinityCopy ? instance.power.affinityEffects : instance.power.effects
    for (const entry of effects?.conditionalDefenseBonus ?? []) out.push({ ...entry, source: instance.power.name })
  }
  return out
}

// ── DT de habilidades e itens (p. 80) ──────────────────────────────────────────

/**
 * DT de um teste de resistência forçado pelo agente: **10 + limite de PE por rodada + atributo**
 * (p. 80). Usa o limite BASE (Tabela 1.2): bônus de limite por turno (Dedicação, Encarar a Morte)
 * dão mais PE para gastar, não deixam os efeitos mais difíceis de resistir.
 *
 * O livro escreve essa DT como "DT Agi" / "DT Vig" no texto das habilidades e dos itens; é a mesma
 * fórmula que `getRitualDt` usa com Presença.
 */
export function getAbilityDt(draft: OrdemCharacterDraft, attribute: keyof ReturnType<typeof getSheetAttributes>): number {
  return 10 + getPeLimit(draft.nex) + getSheetAttributes(draft)[attribute]
}

/** Siglas de atributo como o livro as escreve nas DTs, e o atributo correspondente. */
const DT_ABBREV: Record<string, keyof ReturnType<typeof getSheetAttributes>> = {
  Agi: 'agility',
  For: 'strength',
  Int: 'intellect',
  Pre: 'presence',
  Vig: 'vigor',
}

/**
 * Troca as DTs escritas em sigla pelo número já calculado: "Reflexos (DT Agi)" → "Reflexos (DT 18
 * — Agi)". O livro deixa a conta para o jogador em toda habilidade e item que force um teste de
 * resistência (Cai Dentro, Assassinar, Taser, Amarras...), e a ficha já resolve a mesma fórmula
 * para explosivos e rituais — resolver no texto cobre o resto sem precisar estruturar cada caso.
 *
 * Mantém a sigla à mostra para o jogador saber de onde vem o número (e conferir se mudou de
 * atributo depois de um Aumento).
 */
export function resolveDtInText(draft: OrdemCharacterDraft, text: string): string {
  return text.replace(/DT (Agi|For|Int|Pre|Vig)\b/g, (_match, abbrev: string) => {
    const attribute = DT_ABBREV[abbrev]
    return `DT ${getAbilityDt(draft, attribute)} — ${abbrev}`
  })
}

// ── Explosivos ─────────────────────────────────────────────────────────────────

export type SheetExplosive = {
  uid: string
  name: string
  /** Dano em dados com o tipo (ex.: "8d6 perfuração"); null quando o explosivo não causa dano. */
  damage: string | null
  area: string
  range: string
  /** Teste de resistência com a DT já calculada; null quando o explosivo não permite teste. */
  resistance: { skill: string; dt: number; effect: string; notes: string[] } | null
}

/**
 * Explosivos do loadout com a DT já resolvida. A regra da p. 80 vale para itens: a DT é
 * 10 + limite de PE + o atributo indicado na descrição do item ("DT Agi" nas granadas, "DT Int"
 * na mina). O poder Perito em Explosivos soma o Intelecto por cima.
 *
 * Usa o limite de PE BASE (Tabela 1.2), como `getRitualDt` — bônus de limite por turno
 * (Dedicação, Encarar a Morte) não mexem na dificuldade do efeito.
 */
export function getSheetExplosives(draft: OrdemCharacterDraft): SheetExplosive[] {
  const attrs = getSheetAttributes(draft)
  const expert = hasClassPower(draft, 'explosives-expert')
  const out: SheetExplosive[] = []
  for (const uid of draft.equipmentChoices) {
    const item = getEquipmentByInstance(uid)
    if (!item || item.type !== 'explosive') continue
    let resistance: SheetExplosive['resistance'] = null
    if (item.resistance) {
      const notes: string[] = []
      let dt = getAbilityDt(draft, item.resistance.attribute)
      if (expert) {
        dt += attrs.intellect
        notes.push(`Perito em Explosivos +${attrs.intellect}`)
      }
      resistance = { skill: item.resistance.skill, dt, effect: item.resistance.effect, notes }
    }
    out.push({
      uid,
      name: getInstanceLabel(draft, uid),
      damage: item.damage ? `${item.damage} ${item.damageType ?? ''}`.trim() : null,
      area: item.area,
      range: item.range,
      resistance,
    })
  }
  return out
}

// ── Notas com valores já resolvidos ────────────────────────────────────────────

/** Ordem dos limites de crédito da Tabela 3.1, pro Patrocinador da Ordem subir um degrau. */
const CREDIT_LEVELS = ['Baixo', 'Médio', 'Alto', 'Ilimitado']

/**
 * Limite de crédito efetivo: o da Patente, subido pelos degraus que a origem conceder
 * (Patrocinador da Ordem, do Magnata: "sempre considerado um acima do atual"). Teto em Ilimitado.
 */
export function getEffectiveCreditLimit(draft: OrdemCharacterDraft): { level: string; source: string | null } {
  const base = getPatente(draft.patente).credit
  const steps = getOriginEffects(draft).creditLimitSteps ?? 0
  if (steps <= 0) return { level: base, source: null }
  const index = CREDIT_LEVELS.indexOf(base)
  if (index < 0) return { level: base, source: null }
  const raised = CREDIT_LEVELS[Math.min(CREDIT_LEVELS.length - 1, index + steps)]
  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  return { level: raised, source: origin?.power.name ?? null }
}

/**
 * Notas de habilidade com o valor do NEX/atributo já substituído, pra ficha não imprimir a
 * escada inteira nem deixar o jogador fazendo conta: habilidade de classe (Ataque Especial),
 * features de trilha com `noteByNex` (Paramédico, Discurso Motivador) e poderes de classe com
 * valor derivado de atributo (Criar Selo = Presença).
 */
export function getResolvedAbilityNotes(draft: OrdemCharacterDraft, cls: OrdemClass | undefined): { source: string; note: string }[] {
  const out: { source: string; note: string }[] = []
  const attrs = getSheetAttributes(draft)

  const scaling = cls?.classAbility.scalingByNex?.filter(s => s.nex <= draft.nex) ?? []
  if (scaling.length > 0 && cls) {
    out.push({ source: cls.classAbility.name, note: `no seu NEX: ${scaling[scaling.length - 1].note}` })
  }
  for (const { feature } of getReachedTrilhaFeaturesWithSource(draft)) {
    const reached = feature.effects?.noteByNex?.filter(s => s.nex <= draft.nex) ?? []
    if (reached.length > 0) out.push({ source: feature.name, note: `no seu NEX: ${reached[reached.length - 1].note}` })
  }
  // Criar Selo: "número máximo de selos criados igual à sua Presença".
  if (hasClassPower(draft, 'create-seal')) {
    out.push({ source: 'Criar Selo', note: `pode manter até ${attrs.presence} selos criados (Presença)` })
  }
  // Técnica Medicinal (origem Agente de Saúde): +Intelecto no total de PV curados.
  if (getOriginEffects(draft).healingBonusEqualsIntellect) {
    out.push({ source: 'Técnica Medicinal', note: `some +${attrs.intellect} (Intelecto) no total de PV que curar` })
  }
  // Ferramentas Paranormais: ativa os itens paranormais do loadout sem gastar PE.
  if (hasClassPower(draft, 'paranormal-tools')) {
    const paranormalItems = draft.equipmentChoices
      .map(uid => getEquipmentByInstance(uid))
      .filter(item => item?.paranormal)
    if (paranormalItems.length > 0) {
      out.push({ source: 'Ferramentas Paranormais', note: 'ativa os itens paranormais do inventário sem pagar o custo em PE' })
    }
  }
  return out
}

// ── Dados de dano extra escalonados por NEX ────────────────────────────────────

/**
 * Dados de dano extra escalonados por NEX já resolvidos no NEX atual (Ataque Furtivo do
 * Infiltrador: +1d6 em 10%, +2d6 em 40%, +3d6 em 65%, +4d6 em 99%). Vence o maior degrau
 * alcançado — a ficha mostra o dado de agora, não a escada inteira.
 */
export function getExtraDamageDiceNotes(draft: OrdemCharacterDraft): { source: string; dice: string }[] {
  const out: { source: string; dice: string }[] = []
  for (const { feature } of getReachedTrilhaFeaturesWithSource(draft)) {
    const steps = feature.effects?.extraDamageDiceByNex
    if (!steps) continue
    const reached = steps.filter(s => s.nex <= draft.nex)
    if (reached.length > 0) out.push({ source: feature.name, dice: reached[reached.length - 1].dice })
  }
  return out
}
