import type { CharacterDraft } from '../types/character'
import type { AdvantageMode, ConditionEffect, RollCategory, RollMode } from '../types/condition'
import type { ActiveEffect } from '../types/effects'
import {
  closeBreakdown, critNote, d20Entry, d20Notation, damageEntry, formatGuideFormula, formatGuideNotation, healEntry,
  inspirationNote, isInspirationNote,
  type D20Input, type GuideBreakdownItem, type GuideExtraDice, type GuideReason, type ParsedDamage,
  type RollGuideEntry,
} from './guideEntries'
import type { PlayState } from '../types/playState'
import type { SheetSession } from '../types/session'
import type { SpellcastingKind } from '../types/spellbook'
import type { AbilityScore } from '../types/race'
import { ABILITY_LABELS, ALL_ABILITY_SCORES, calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { getSheetSession } from './activeEffects'
import { getFinalAbilityScores } from './asiUtils'
import { getSheetAttacks, isSheetAttackInScope, type SheetAttack } from './attackUtils'
import type { FinalScores } from './classResourceUtils'
import { SKILLS } from './backgroundUtils'
import { getHitDicePool } from './multiclassUtils'
import { getPlayConditionState, isConscious } from './playState'
import { getRace } from './raceUtils'
import { describeUnproficientArmorCasting, getSavingThrowChecks, getSkillChecks, getPassiveScore, getUnproficientArmor } from './proficiencyUtils'
import {
  EXHAUSTION, formatCastingRestriction, formatConditionalSaveBonus, getActiveConditionEffects, getAttacksPerAction,
  getBestHalfProficiencySource, getCastingRestrictions, getCondition, getConditionalRollNotes, getConditionalSaveBonuses, getDamageDefenses, isConditionSuspended,
  getHalfProficiencySources, getMeleeCritExtraWeaponDice,
  getInitiativeAdvantageSources, getInitiativeBonuses, getOwnedFeats, getSheetArmorClass, getWeaponCritThreshold, resolveRollMode,
  type ActiveConditionEffects, type ConditionRoll, type ScopedSheetEffect, type SheetConditionalSave,
} from './sheetEffects'
import { getCasterEntries, getFeatSpellBlocks, getSpellAttackBonus, getSpellSaveDC } from './spellUtils'
import { getOtherSpellcastings } from './sheetModel'
import { DAMAGE_TYPE_PT, scopeCaveat } from './weaponFormat'

/**
 * Guia de rolagens do modo de jogo: a "receita" de cada jogada da ficha — o que rolar, quanto
 * somar, com vantagem ou desvantagem e por quê, falha automática, de onde vem cada número. O
 * jogador rola os próprios dados (decisão de 2026-10-25); a tela diz o que rolar a partir daqui,
 * e a `notation` alimenta o motor de `src/core/dice` quando os dados do app estão ligados.
 *
 * Nenhuma conta da ficha é refeita: os números vêm das fontes únicas da Revisão e do PDF
 * (`getSkillChecks`, `getSavingThrowChecks`, `getSheetAttacks`, `getSpellSaveDC`…); daqui sai só a
 * explicação (`breakdown`) e o modo. Regra de ouro do `sheetEffects`: o incondicional entra no
 * número ou no modo; o condicional vira linha em `notes`, nunca no número.
 *
 * Fontes do modo: as condições e a exaustão do estado de jogo (`getPlayConditionEffects`) somadas
 * às da ficha — desvantagem de Furtividade da armadura, armadura sem proficiência (pág. 144) e arma
 * pesada nas mãos de criatura Pequena (pág. 149) —,
 * resolvidas por `resolveRollMode` (uma de cada lado anula, pág. 175). O que só a folha aberta sabe
 * entra por cima, com a mesma regra: a circunstância da mesa (`withTableMode`) e a Inspiração gasta
 * (`withInspirationSpent`).
 *
 * As entradas (a jogada de d20, a de dano, a de cura) se montam em `guideEntries.ts`, o mesmo módulo
 * do guia da magia (`spellGuide.ts`); os tipos e a formatação seguem saindo daqui também.
 */

export type { GuideBreakdownItem, GuideExtraDice, GuideKind, GuideReason, ParsedDamage, RollGuideEntry } from './guideEntries'
export { formatGuideFormula, formatGuideNotation } from './guideEntries'

/** Uma linha da tabela de ataques: a jogada de ataque, o dano e o dano a duas mãos (versátil). */
export type AttackGuide = {
  key: string
  name: string
  /** "Força" ou "Destreza". */
  ability: string
  properties: string
  attacksPerAction: number
  /**
   * A partir de que d20 natural o ataque é crítico (se acertar): 20, ou a margem dos ataques com
   * arma do Campeão (`getWeaponCritThreshold`: 19 no 3º, 18 no 15º), golpe desarmado incluído.
   */
  critThreshold: number
  /** As notas da linha de ataque da ficha (Duelismo, Artes Marciais, recarga…), menos as já no `breakdown`. */
  notes: string[]
  attack: RollGuideEntry
  /** Null quando a arma não causa dano (a Rede), salvo com dano extra (o Auxílio Divino): aí, só ele. */
  damage: RollGuideEntry | null
  versatile: RollGuideEntry | null
}

/**
 * Conjuração de uma classe, de um talento que ensina magias (Iniciado em Magia, p. 170), da raça (o
 * truque e as inatas) ou do truque de uma subclasse (`getOtherSpellcastings`, decisão de
 * 2026-10-31): a CD que os alvos enfrentam e o ataque de magia.
 */
export type SpellcastingGuide = {
  /**
   * Única no guia: `class:<classId>`, `feat:<featId>`, `race:<raça>` ou `subclass:<subclasse>` — o
   * clérigo com Iniciado em Magia de clérigo tem as duas primeiras, cada uma com a sua CD.
   */
  key: string
  kind: SpellcastingKind
  /**
   * A classe da lista e do atributo: a conjuradora, a escolhida no talento ou a dona da subclasse;
   * null na raça.
   */
  classId: string | null
  /** O talento que ensina as magias; null fora do talento. */
  featId: string | null
  /** "Mago", "Guerreiro (Cavaleiro Arcano)", "Iniciado em Magia (Clérigo)", "Tiefling", "Domínio da Natureza". */
  label: string
  ability: AbilityScore
  /**
   * O modificador do atributo de conjuração, a parcela do "de onde vem" da CD e do ataque: o guia
   * da magia soma daqui o modificador da cura e do dano (`spellGuide.ts`), sem outra conta.
   */
  abilityModifier: number
  saveDc: number
  saveDcBreakdown: GuideBreakdownItem[]
  attack: RollGuideEntry
}

/** Valor passivo (pág. 177): o da ficha, mais o ±5 da vantagem ou desvantagem em vigor. */
export type PassiveGuide = {
  id: string
  label: string
  value: number
  /** O valor da ficha, sem as condições (`getPassiveScore`). */
  sheetValue: number
  adjustment: -5 | 0 | 5
  advantage: GuideReason[]
  disadvantage: GuideReason[]
  breakdown: GuideBreakdownItem[]
  notes: string[]
}

export type RollGuide = {
  checks: Record<AbilityScore, RollGuideEntry>
  saves: Record<AbilityScore, RollGuideEntry>
  /** Por id da perícia (`SKILLS`), como `getSkillChecks`. */
  skills: Record<string, RollGuideEntry>
  initiative: RollGuideEntry
  passivePerception: PassiveGuide
  attacks: AttackGuide[]
  spellcasting: SpellcastingGuide[]
  deathSave: RollGuideEntry
  /** Um por tipo de Dado de Vida do poço, do maior para o menor. */
  hitDice: RollGuideEntry[]
  /**
   * Linhas que valem para a ficha toda: Incapacitado (sem ações nem reações), sem fala (sem
   * componente verbal) e não conjurar com armadura sem proficiência.
   */
  notes: string[]
  /**
   * O que proíbe conjurar numa situação (em fúria, pág. 48 — `getCastingRestrictions`) que o estado
   * de jogo não cumpre agora: condicional, nunca em `notes`, que é só o que está em vigor. Também
   * nas notas do ataque de magia e da concentração.
   */
  castingRestrictions: string[]
  /**
   * A mesma restrição com o efeito da situação ligado (em fúria): em vigor, sai de
   * `castingRestrictions` e entra aqui e em `notes` (a caixa vermelha da aba Magia).
   */
  activeCastingRestrictions: string[]
}

/**
 * O acerto crítico de uma jogada de dano com alguns grupos de dados a mais sem dobrar (o
 * "desmarcar" do item 6 de `regras-dano-e-morte.md`: o livro dobra todos, pág. 198, e o jogador
 * pode tirar um grupo da conta). Sem grupo desmarcado, é o `crit` da jogada.
 */
export function getCritRecipe(entry: RollGuideEntry, undoubled: readonly string[] = []): NonNullable<RollGuideEntry['crit']> | null {
  if (!entry.crit) return null
  if (undoubled.length === 0) return entry.crit
  const extra = entry.extraDice ?? []
  return {
    ...entry.crit,
    formula: formatGuideFormula(entry.crit.dice, entry.modifier, entry.damageType, extra, true, undoubled),
    notation: formatGuideNotation(entry.crit.dice, entry.modifier, extra, true, undoubled),
  }
}

const labels = (reasons: GuideReason[]) => reasons.map(r => r.label).join(', ')

/**
 * A frase da mesa: "1d20 + 5, com desvantagem (Envenenado)"; "1d20 + 2 — falha automática
 * (Paralisado)"; quando uma de cada lado se anula, diz quais.
 */
export function describeRollGuide(entry: RollGuideEntry): string {
  const parts = [entry.formula]
  if (entry.mode === 'advantage') parts.push(`com vantagem (${labels(entry.advantage)})`)
  else if (entry.mode === 'disadvantage') parts.push(`com desvantagem (${labels(entry.disadvantage)})`)
  else if (entry.advantage.length > 0 && entry.disadvantage.length > 0) {
    parts.push(`normal: vantagem (${labels(entry.advantage)}) e desvantagem (${labels(entry.disadvantage)}) se anulam`)
  }
  const text = parts.join(', ')
  return entry.autoFail.length > 0 ? `${text} — falha automática (${labels(entry.autoFail)})` : text
}

// ── Dano em texto ────────────────────────────────────────────────────────────

const DAMAGE_TEXT = /^(?:(\d+)d(\d+))?\s*([+-]\s*\d+|\d+)?\s*(.*)$/

/**
 * Lê o dano como `weaponFormat` o escreve: "1d8+3 cortante", "1d6 perfurante", "1d4-1 perfurante",
 * "1d10+3" (versátil, sem tipo), o fixo "4 concussão" / "-1 concussão" (golpe desarmado,
 * Zarabatana). "—" (Rede) ou texto que não bate dá null. `count` 0 = dano fixo, sem dado.
 */
export function parseDamageText(text: string): ParsedDamage | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '—') return null
  const m = DAMAGE_TEXT.exec(trimmed)
  if (!m) return null
  const [, countRaw, sidesRaw, modRaw, rest] = m
  if (countRaw === undefined && modRaw === undefined) return null
  // Dano fixo começa pelo número: "4 concussão". Um "+3" sem dado na frente não é texto da ficha.
  if (countRaw === undefined && /^[+]/.test(modRaw)) return null
  const damageType = rest.trim()
  if (damageType && !/^[\p{L} ]+$/u.test(damageType)) return null
  return {
    count: countRaw === undefined ? 0 : Number(countRaw),
    sides: sidesRaw === undefined ? 0 : Number(sidesRaw),
    modifier: modRaw === undefined ? 0 : Number(modRaw.replace(/\s+/g, '')),
    damageType,
  }
}

// ── Fontes do modo ───────────────────────────────────────────────────────────

type SheetModeSources = {
  /** Armadura/escudo sem proficiência: desvantagem em tudo de FOR e DES (pág. 144). */
  unproficientArmor: GuideReason[]
  /** Armadura que impõe desvantagem em Furtividade. */
  stealth: GuideReason[]
}

const STR_DEX: readonly AbilityScore[] = ['STR', 'DEX']

/**
 * Linha condicional de uma condição ou característica, já com a categoria de jogada que ela
 * alcança. `deathSave`: vale também no teste contra a morte (Sortudo).
 */
type ConditionalLine = {
  rolls: RollCategory[]
  abilities?: AbilityScore[]
  deathSave?: boolean
  /** Quem deixa jogar de novo o 1 natural (Sortudo): o nome, para a tela oferecer a rolagem. */
  rerollNaturalOne?: string
  text: string
}

/**
 * As linhas condicionais de jogada das condições em vigor (Amedrontado "com a fonte do medo na
 * linha de visão", Cego/Surdo "teste que requeira a visão/audição") e dos efeitos ligados (o
 * Antídoto: vantagem nos TR "contra veneno") — as que o agregador entrega só como texto solto.
 * Condição suspensa (Envenenado sob Petrificado) não entra.
 */
function getConditionalLines(effects: ActiveConditionEffects, session: SheetSession): ConditionalLine[] {
  const tagged: { label: string; effect: ConditionEffect | ActiveEffect }[] = [
    ...effects.conditions.filter(c => !isConditionSuspended(c)).flatMap(c =>
      (getCondition(c.id)?.effects ?? []).map(effect => ({ label: c.name, effect }))),
    ...EXHAUSTION.levels.filter(row => row.level <= effects.exhaustion).flatMap(row =>
      row.effects.map(effect => ({ label: `Exaustão ${row.level}`, effect }))),
    ...session.active.flatMap(t => t.effects.map(({ source, effect }) => ({ label: source, effect }))),
  ]
  return tagged.flatMap(({ label, effect }): ConditionalLine[] => {
    if (effect.scope !== 'notice') return []
    if (effect.kind === 'rollMode') return [{ rolls: effect.rolls, abilities: effect.abilities, text: `${effect.text} (${label})` }]
    if (effect.kind === 'autoFail') return [{ rolls: [effect.roll], abilities: effect.abilities, text: `${effect.text} (${label})` }]
    return []
  })
}

/**
 * As linhas condicionais que a ficha declara (`getConditionalRollNotes`): Resiliência Anã, Bravura,
 * Sortudo, Sentido de Perigo — "Sortudo: tirou 1 natural no d20?…". A ressalva do livro vai no
 * texto; a que o estado de jogo conhece (`unlessConditions`: Cego, Surdo, Incapacitado, gravados ou
 * derivados) tira a linha enquanto valer (decisão de 2026-10-25).
 */
function getSheetConditionalLines(draft: CharacterDraft, effects: ActiveConditionEffects): ConditionalLine[] {
  const active = new Set(effects.conditions.filter(c => !isConditionSuspended(c)).map(c => c.id))
  return getConditionalRollNotes(draft).filter(n => !n.unlessConditions?.some(id => active.has(id))).map(n => ({
    rolls: n.rolls,
    ...(n.abilities ? { abilities: n.abilities } : {}),
    ...(n.deathSave ? { deathSave: true } : {}),
    ...(n.rerollNaturalOne ? { rerollNaturalOne: n.source } : {}),
    text: `${n.source}: ${n.text}`,
  }))
}

function linesFor(lines: ConditionalLine[], roll: RollCategory, ability?: AbilityScore): string[] {
  return lines
    .filter(l => l.rolls.includes(roll) && (!l.abilities || (ability !== undefined && l.abilities.includes(ability))))
    .map(l => l.text)
}

/**
 * Mais uma fonte de vantagem ou desvantagem numa jogada de d20 já montada (a Inspiração gasta, a
 * circunstância da mesa): o modo é recalculado pela pág. 175 — várias do mesmo lado valem uma; uma
 * de cada lado anula, qualquer que seja a quantidade —, com a notação que os dados do app rolam.
 * `effect` diz o que a fonte fez quando não é só dar o modo dela (null nesse caso): a regra avisa,
 * não impede.
 */
function addModeSource(
  entry: RollGuideEntry,
  side: AdvantageMode,
  reason: GuideReason,
): { next: RollGuideEntry; effect: string | null } {
  const advantage = side === 'advantage' ? [...entry.advantage, reason] : entry.advantage
  const disadvantage = side === 'disadvantage' ? [...entry.disadvantage, reason] : entry.disadvantage
  const mode = resolveRollMode(advantage, disadvantage)
  const [chosen, chosenPlural, opposite] = side === 'advantage'
    ? ['vantagem', 'vantagens', 'desvantagem']
    : ['desvantagem', 'desvantagens', 'vantagem']
  const canceled = entry.advantage.length > 0 && entry.disadvantage.length > 0
  const effect = entry.autoFail.length > 0
    ? 'não muda nada — a jogada falha automaticamente.'
    : entry.mode === side
      ? `a jogada já tinha ${chosen}; não muda nada (${chosenPlural} não se somam, pág. 175).`
      : entry.mode !== 'normal'
        ? `anula a ${opposite}: role um d20 só (pág. 175).`
        : canceled
          ? 'não muda nada — vantagem e desvantagem já se anulavam, qualquer que seja a quantidade (pág. 175).'
          : null
  return { next: { ...entry, advantage, disadvantage, mode, notation: d20Notation(mode, entry.modifier, entry.extraDice) }, effect }
}

/** A fonte de vantagem da Inspiração gasta numa jogada (pág. 127). */
export const INSPIRATION_REASON: GuideReason = { source: 'inspiration', label: 'Inspiração' }

/**
 * A jogada com a Inspiração gasta (`regras-rolagens-e-concentracao.md`, 11.5): a fonte
 * `inspiration` entra na lista de vantagem (`addModeSource`). A primeira nota diz o que o gasto fez
 * — inclusive quando não mudou nada (já com vantagem, vantagem e desvantagem já anuladas, falha
 * automática). Só d20; as demais jogadas voltam iguais.
 */
export function withInspirationSpent(entry: RollGuideEntry): RollGuideEntry {
  if (entry.kind !== 'd20' || entry.advantage.some(r => r.source === INSPIRATION_REASON.source)) return entry
  const { next, effect } = addModeSource(entry, 'advantage', INSPIRATION_REASON)
  return { ...next, notes: [`Inspiração gasta: ${effect ?? 'role com vantagem (pág. 127).'}`, ...entry.notes] }
}

/**
 * A vantagem ou desvantagem que a mesa dá e a ficha não conhece: a circunstância que o Mestre
 * decide (pág. 175), o Ataque Descuidado, a ação Ajudar. Escolhida à mão na folha da receita.
 */
export const TABLE_MODE_REASONS: Record<Exclude<RollMode, 'normal'>, GuideReason> = {
  advantage: { source: 'table:advantage', label: 'Circunstância da mesa' },
  disadvantage: { source: 'table:disadvantage', label: 'Circunstância da mesa' },
}

/**
 * A jogada com o Normal / Vantagem / Desvantagem escolhido na folha: a circunstância da mesa entra
 * como mais uma fonte (`addModeSource`). Quando a escolha não muda o modo (já havia o mesmo, já se
 * anulavam, falha automática) ou anula o outro lado, a primeira nota diz por quê; a nota da
 * Inspiração ainda não gasta, qualquer que seja, passa a dizer o que ela faz no modo novo. `normal`
 * e as jogadas que não são d20 voltam iguais.
 */
export function withTableMode(entry: RollGuideEntry, choice: RollMode): RollGuideEntry {
  if (entry.kind !== 'd20' || choice === 'normal') return entry
  const reason = TABLE_MODE_REASONS[choice]
  const sameSide = choice === 'advantage' ? entry.advantage : entry.disadvantage
  if (sameSide.some(r => r.source === reason.source)) return entry
  const { next, effect } = addModeSource(entry, choice, reason)
  const notes = entry.notes.map(n => (isInspirationNote(n) ? inspirationNote(next) : n))
  const label = choice === 'advantage' ? 'Vantagem da mesa' : 'Desvantagem da mesa'
  return { ...next, notes: effect ? [`${label}: ${effect}`, ...notes] : notes }
}


const ABILITY_BY_LONG_NAME = new Map(ALL_ABILITY_SCORES.map(ab => [ABILITY_LABELS[ab].long, ab]))

/** O que todo ataque da ficha compartilha: o personagem, o estado de jogo e as fontes do modo. */
type AttackGuideContext = {
  mods: Record<AbilityScore, number>
  proficiencyBonus: number
  condition: ConditionRoll
  sheet: SheetModeSources
  lines: ConditionalLine[]
  inspiration: boolean
  /** O que impede de agir (Incapacitado): vale para todo ataque. */
  cannotAct: string[]
  /** Quem dá os ataques a mais da ação de Atacar (Ataque Extra), para a nota da linha. */
  attacksPerActionSource: string | null
  /** Margem de crítico dos ataques com arma (Crítico Aprimorado/Superior), com o alcance; null = só o 20. */
  weaponCrit: ScopedSheetEffect | null
  /** A raça é de tamanho Pequeno (halfling, gnomo): desvantagem com arma pesada (pág. 149). */
  small: boolean
  /** Dados de arma a mais no crítico corpo a corpo, por fonte (Crítico Brutal, Ataques Selvagens), com o alcance. */
  meleeCritExtraDice: ScopedSheetEffect[]
}

function attackGuide(attack: SheetAttack, ctx: AttackGuideContext): AttackGuide {
  const { mods, proficiencyBonus, condition, sheet, lines, inspiration, cannotAct } = ctx
  const ability = ABILITY_BY_LONG_NAME.get(attack.ability) ?? 'STR'
  const breakdown: GuideBreakdownItem[] = [
    { label: attack.ability, value: mods[ability] },
    ...(attack.proficient ? [{ label: 'Proficiência', value: proficiencyBonus }] : []),
  ]
  // O que a linha já somou (`includedBonuses`: a Arquearia no ataque, o Dano de Fúria ligado no
  // dano) vira parcela do "de onde vem", e a nota que o diz sai das notas. As outras notas da arma
  // (Duelismo, outra mão, recarga, Artes Marciais) valem no ataque e no dano: a folha de cada jogada
  // diz o que muda nela.
  const included = attack.includedBonuses ?? { attack: [], damage: [] }
  for (const b of included.attack) breakdown.push({ label: b.label, value: b.value })
  const includedNotes = new Set([...included.attack, ...included.damage].flatMap(b => (b.note ? [b.note] : [])))
  const notes = attack.notes.filter(n => !includedNotes.has(n))
  const includedDamage = included.damage.reduce((sum, b) => sum + b.value, 0)
  // A margem do Campeão vale na linha que está no alcance dela: as armas e o golpe desarmado (decisão
  // 20 de regras-dano-e-morte.md, revista em 2026-10-29).
  const weaponCrit = ctx.weaponCrit && isSheetAttackInScope(attack, ctx.weaponCrit.weapons) ? ctx.weaponCrit : null
  const critThreshold = weaponCrit?.value ?? 20
  // Pesada: "criaturas pequenas têm desvantagem nas jogadas de ataque com estas armas" (pág. 149).
  const heavySmall: GuideReason[] = attack.weapon?.heavy && ctx.small
    ? [{ source: 'weapon:heavy-small', label: `${attack.name} pesada para criatura Pequena` }]
    : []
  // Todo ataque corpo a corpo com arma, golpe desarmado incluído (decisão 21, revista em 2026-10-29).
  const critExtraDice = ctx.meleeCritExtraDice
    .filter(e => isSheetAttackInScope(attack, e.weapons))
    .map(e => ({ source: e.source, value: e.value, caveat: scopeCaveat(e.weapons, ability === 'DEX', attack.weapon?.thrown ?? false) }))
  const extraAttacks = attack.attacksPerAction > 1
    ? [`${ctx.attacksPerActionSource ?? 'Ataque Extra'}: você faz ${attack.attacksPerAction} ataques ao usar a ação de Atacar — role cada um.`]
    : []

  const attackEntry = d20Entry({
    id: `attack:${attack.key}`,
    label: `${attack.name} — ataque`,
    attackRoll: true,
    ability,
    modifier: Number(attack.attackBonus),
    breakdown,
    condition,
    extraDisadvantage: [...(STR_DEX.includes(ability) ? sheet.unproficientArmor : []), ...heavySmall],
    notes: [
      ...cannotAct,
      ...(attack.proficient ? [] : [`Sem proficiência com ${attack.name}: o bônus de proficiência não entra (pág. 148).`]),
      ...(heavySmall.length > 0 ? ['Arma pesada: criaturas Pequenas têm desvantagem nas jogadas de ataque com ela (pág. 149).'] : []),
      ...extraAttacks,
      ...notes,
      critNote(critThreshold, weaponCrit?.source),
      ...linesFor(lines, 'attack'),
    ],
  }, inspiration)

  // O texto do dano fixo já vem com o piso 0 ("0 concussão"): a conta aberta sai do valor fixo da
  // arma mais o modificador e o que a linha somou, e o damageEntry põe de volta o piso como parcela
  // ("Mínimo 0").
  const text = parseDamageText(attack.damage)
  const parsed = text && text.count === 0 && attack.fixedDamageBase !== undefined
    ? { ...text, modifier: attack.fixedDamageBase + mods[ability] + includedDamage }
    : text
  // O dano extra de outro tipo (o Auxílio Divino ligado), parcela própria nas duas empunhaduras.
  const extraDice: GuideExtraDice[] = (attack.extraDamage ?? []).map(e =>
    ({ label: e.label, count: e.count, sides: e.sides, sign: 1, damageType: DAMAGE_TYPE_PT[e.damageType] }))
  const damageBreakdown = (p: ParsedDamage): GuideBreakdownItem[] => [
    ...(p.count === 0 ? [{ label: attack.name, value: attack.fixedDamageBase ?? p.modifier - mods[ability] - includedDamage }] : []),
    { label: attack.ability, value: mods[ability] },
    ...included.damage.map(b => ({ label: b.label, value: b.value })),
  ]
  // A arma que acerta sem causar dano (a Rede) com dano extra (o Auxílio Divino ligado, decisão de
  // 2026-10-30): a jogada de dano é só o dado a mais, sem o modificador do atributo.
  const extraOnly = !parsed && extraDice.length > 0
  const damage = parsed || extraOnly
    ? damageEntry({
      id: `damage:${attack.key}`,
      label: `${attack.name} — dano`,
      parsed: parsed ?? { count: 0, sides: 0, modifier: 0, damageType: '' },
      damageType: parsed?.damageType ?? '',
      breakdown: parsed ? damageBreakdown(parsed) : [],
      notes,
      critExtraDice,
      unarmedStrike: attack.weapon === null,
      extraDice,
      noWeaponDamage: extraOnly,
    })
    : null

  const versatileParsed = attack.versatileDamage ? parseDamageText(attack.versatileDamage) : null
  const versatile = versatileParsed && parsed
    ? damageEntry({
      id: `damage:${attack.key}:versatile`,
      label: `${attack.name} — dano a duas mãos`,
      parsed: versatileParsed,
      damageType: versatileParsed.damageType || parsed.damageType,
      breakdown: damageBreakdown(versatileParsed),
      notes,
      critExtraDice,
      extraDice,
    })
    : null

  return {
    key: attack.key,
    name: attack.name,
    ability: attack.ability,
    properties: attack.properties,
    attacksPerAction: attack.attacksPerAction,
    critThreshold,
    notes,
    attack: attackEntry,
    damage,
    versatile,
  }
}

const WAR_CASTER_ID = 'conjurador-de-guerra'

function hasWarCaster(draft: CharacterDraft): { source: string; label: string } | null {
  const feat = getOwnedFeats(draft).find(f => f.id === WAR_CASTER_ID)
  return feat ? { source: `feat:${feat.id}`, label: feat.name } : null
}

/**
 * Os bônus que dependem da situação em todo TR (a Aura de Proteção, pág. 111), com o estado de jogo:
 * o que só pede você consciente, consciente, entra no número com a parcela nomeada (`included`,
 * decisão de 2026-10-30, o critério das Auras de Coragem e de Devoção); o resto — e ele mesmo, sem
 * você consciente — fica na nota, com o texto da Revisão e do PDF (`notes`).
 */
function getSaveBonuses(draft: CharacterDraft, scores: FinalScores, state: PlayState): { included: GuideBreakdownItem[]; notes: string[] } {
  const bonuses = getConditionalSaveBonuses(draft, scores)
  const inNumber = (b: SheetConditionalSave) => !!b.whileConscious && isConscious(state)
  return {
    included: bonuses.filter(inNumber).map(b => ({ label: b.source, value: b.value })),
    notes: bonuses.filter(b => !inNumber(b)).map(formatConditionalSaveBonus),
  }
}

/** O TR de base, que a concentração reaproveita, com os bônus da situação (`getSaveBonuses`). */
function saveInput(
  ability: AbilityScore,
  check: { proficient: boolean; bonus: number },
  mods: Record<AbilityScore, number>,
  proficiencyBonus: number,
  effects: ActiveConditionEffects,
  sheet: SheetModeSources,
  lines: ConditionalLine[],
  bonuses: { included: GuideBreakdownItem[]; notes: string[] },
): D20Input {
  return {
    id: `save:${ability}`,
    label: `TR de ${ABILITY_LABELS[ability].long}`,
    ability,
    modifier: check.bonus + bonuses.included.reduce((sum, b) => sum + b.value, 0),
    breakdown: [
      { label: ABILITY_LABELS[ability].long, value: mods[ability] },
      ...(check.proficient ? [{ label: 'Proficiência', value: proficiencyBonus }] : []),
      ...bonuses.included,
    ],
    condition: effects.savingThrows[ability],
    extraDisadvantage: STR_DEX.includes(ability) ? sheet.unproficientArmor : [],
    notes: [...linesFor(lines, 'save', ability), ...bonuses.notes],
  }
}

/**
 * Os efeitos em vigor para o guia: as condições e a exaustão do estado, os efeitos ligados da sessão
 * e a imunidade a condição da ficha — o mesmo agregador das operações (`getPlayEffects`), com as
 * mesmas entradas tiradas da ficha em vez do `PlaySheet`.
 */
function getGuideEffects(draft: CharacterDraft, state: PlayState, session: SheetSession): ActiveConditionEffects {
  return getActiveConditionEffects(getPlayConditionState(state, session.active, getDamageDefenses(draft, session)))
}

/** Uma conjuração (classe ou talento) com a CD e o bônus de ataque já calculados pela fonte dela. */
type SpellcastingInput = Omit<SpellcastingGuide, 'saveDcBreakdown' | 'attack' | 'abilityModifier'> & { attackId: string; attackModifier: number }

/** O guia de todas as jogadas da ficha, com o estado de jogo aplicado. Pura. */
export function getRollGuide(draft: CharacterDraft, state: PlayState): RollGuide {
  const scores = getFinalAbilityScores(draft)
  const mods = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => [ab, calculateModifier(scores[ab])])) as Record<AbilityScore, number>
  const level = draft.level ?? 1
  const prof = getProficiencyBonus(level)
  // A sessão sai do estado que o guia já recebe: os efeitos ligados (em fúria) e o que fazem agora,
  // na mesma escada das condições (a vantagem da Fúria nas jogadas de Força).
  const session = getSheetSession(draft, state)
  const effects = getGuideEffects(draft, state, session)
  // As linhas das condições e as da ficha. O valor passivo leva só as das condições: rerrolar ou
  // "vantagem contra veneno" não alcançam um número que não se rola.
  const conditionLines = getConditionalLines(effects, session)
  const lines = [...conditionLines, ...getSheetConditionalLines(draft, effects)]
  const inspiration = state.inspiration

  // Fontes da ficha, com a armadura vestida no jogo (a da sessão): a proficiência e a Furtividade.
  const unproficient = getUnproficientArmor(draft, session)
  const ac = getSheetArmorClass(draft, scores, session)
  const sheet: SheetModeSources = {
    unproficientArmor: unproficient.map(a => ({ source: `armor:${a.id}`, label: `${a.name} sem proficiência` })),
    stealth: ac.stealthDisadvantage
      ? [{ source: 'armor:stealth', label: ac.components[0]?.label ?? 'Armadura' }]
      : [],
  }
  const cannotCast = unproficient.length > 0
    ? [describeUnproficientArmorCasting(unproficient.map(a => a.name))]
    : []
  const warCaster = hasWarCaster(draft)
  // Incapacitado (gravado ou implicado: Paralisado, Atordoado, Inconsciente…) e sem fala. A ficha
  // não bloqueia a jogada — só diz, no ataque, no ataque de magia e nas notas gerais.
  const cannotAct = effects.noActions.active
    ? [`${labels(effects.noActions.sources)}: não pode realizar ações nem reações (pág. 292).`]
    : []
  const cannotSpeak = effects.cannotSpeak.active
    ? [`Não pode falar (${labels(effects.cannotSpeak.sources)}): sem o componente verbal, a magia que o exige não pode ser conjurada (pág. 205).`]
    : []
  // Em fúria não se conjura (pág. 48): desligada, é nota; ligada (a sessão), está em vigor e vai às
  // notas que valem agora — a caixa vermelha da aba Magia.
  const restrictions = getCastingRestrictions(draft, session)
  const castingRestrictions = restrictions.filter(r => !r.active).map(formatCastingRestriction)
  const activeCastingRestrictions = restrictions.filter(r => r.active).map(formatCastingRestriction)

  // Testes de atributo puros: modificador + meia proficiência quando a ficha a tem (Versatilidade).
  const halfSources = getHalfProficiencySources(draft)
  const checkDisadvantage = (ab: AbilityScore) => (STR_DEX.includes(ab) ? sheet.unproficientArmor : [])
  const checks = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => {
    const half = getBestHalfProficiencySource(halfSources, ab)
    const breakdown = [
      { label: ABILITY_LABELS[ab].long, value: mods[ab] },
      ...(half ? [{ label: half.source, value: half.value }] : []),
    ]
    return [ab, d20Entry({
      id: `check:${ab}`,
      label: `Teste de ${ABILITY_LABELS[ab].long}`,
      ability: ab,
      modifier: mods[ab] + (half?.value ?? 0),
      breakdown,
      condition: effects.abilityChecks[ab],
      extraDisadvantage: checkDisadvantage(ab),
      notes: linesFor(lines, 'abilityCheck', ab),
    }, inspiration)]
  })) as Record<AbilityScore, RollGuideEntry>

  const saveChecks = getSavingThrowChecks(draft, scores)
  // Bônus que depende da situação (Aura de Proteção, pág. 111): consciente, no número; senão, a nota
  // com o texto da Revisão e do PDF.
  const saveBonuses = getSaveBonuses(draft, scores, state)
  const saves = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => {
    const input = saveInput(ab, saveChecks[ab], mods, prof, effects, sheet, lines, saveBonuses)
    if (ab === 'CON' && warCaster) {
      input.notes = [...(input.notes ?? []), `${warCaster.label}: vantagem neste TR para manter a concentração ao sofrer dano (pág. 169).`]
    }
    return [ab, d20Entry(input, inspiration)]
  })) as Record<AbilityScore, RollGuideEntry>

  const skillChecks = getSkillChecks(draft, scores)
  const skills = Object.fromEntries(SKILLS.map(skill => {
    const check = skillChecks[skill.id]
    const ab = check.ability
    const half = check.proficiency === 'none' ? getBestHalfProficiencySource(halfSources, ab) : undefined
    const profPart: GuideBreakdownItem[] = check.proficiency === 'expertise'
      ? [{ label: 'Especialização', value: prof * 2 }]
      : check.proficiency === 'proficient'
        ? [{ label: 'Proficiência', value: prof }]
        : half ? [{ label: half.source, value: half.value }] : []
    return [skill.id, d20Entry({
      id: `skill:${skill.id}`,
      label: skill.name,
      ability: ab,
      modifier: check.bonus,
      breakdown: [{ label: ABILITY_LABELS[ab].long, value: mods[ab] }, ...profPart],
      condition: effects.abilityChecks[ab],
      extraDisadvantage: [...checkDisadvantage(ab), ...(skill.id === 'stealth' ? sheet.stealth : [])],
      notes: linesFor(lines, 'abilityCheck', ab),
    }, inspiration)]
  })) as Record<string, RollGuideEntry>

  // Iniciativa: teste de Destreza (pág. 179) com os bônus próprios (Alerta, Versatilidade).
  const initiativeBonuses = getInitiativeBonuses(draft)
  const initiative = d20Entry({
    id: 'initiative',
    label: 'Iniciativa',
    ability: 'DEX',
    modifier: mods.DEX + initiativeBonuses.reduce((sum, b) => sum + b.value, 0),
    breakdown: [
      { label: ABILITY_LABELS.DEX.long, value: mods.DEX },
      ...initiativeBonuses.map(b => ({ label: b.source, value: b.value })),
    ],
    condition: effects.initiative,
    extraAdvantage: getInitiativeAdvantageSources(draft).map(name => ({ source: `feature:${name}`, label: name })),
    extraDisadvantage: sheet.unproficientArmor,
    notes: linesFor(lines, 'abilityCheck', 'DEX'),
  }, inspiration)

  // Percepção passiva: o valor da ficha, +5/−5 com vantagem/desvantagem no teste (pág. 177).
  const perception = skills.perception
  const sheetPassive = getPassiveScore(draft, 'perception', skillChecks)
  const adjustment = perception.mode === 'advantage' ? 5 : perception.mode === 'disadvantage' ? -5 : 0
  const passiveFeats = getOwnedFeats(draft).flatMap(f => {
    const bonus = f.effects?.passiveScoreBonus
    return bonus?.skills.includes('perception') ? [{ label: f.name, value: bonus.value }] : []
  })
  const passivePerception: PassiveGuide = {
    id: 'passive:perception',
    label: 'Percepção passiva',
    value: sheetPassive + adjustment,
    sheetValue: sheetPassive,
    adjustment,
    advantage: perception.advantage,
    disadvantage: perception.disadvantage,
    breakdown: closeBreakdown([
      { label: 'Base', value: 10 },
      ...perception.breakdown,
      ...passiveFeats,
      ...(adjustment > 0 ? [{ label: `Vantagem (${labels(perception.advantage)})`, value: 5 }] : []),
      ...(adjustment < 0 ? [{ label: `Desvantagem (${labels(perception.disadvantage)})`, value: -5 }] : []),
    ], sheetPassive + adjustment),
    notes: linesFor(conditionLines, 'abilityCheck', 'WIS'),
  }

  const attackContext: AttackGuideContext = {
    mods, proficiencyBonus: prof, condition: effects.attack, sheet, lines, inspiration, cannotAct,
    attacksPerActionSource: getAttacksPerAction(draft).source,
    weaponCrit: getWeaponCritThreshold(draft),
    small: (draft.race ? getRace(draft.race)?.size : undefined) === 'Small',
    meleeCritExtraDice: getMeleeCritExtraWeaponDice(draft),
  }
  const attacks = getSheetAttacks(draft, scores, session).map(a => attackGuide(a, attackContext))

  // A CD e o ataque de magia de uma conjuração, com os números prontos da fonte dela.
  const spellcastingGuide = ({ attackId, attackModifier, ...source }: SpellcastingInput): SpellcastingGuide => {
    const abilityPart = { label: ABILITY_LABELS[source.ability].long, value: mods[source.ability] }
    return {
      ...source,
      abilityModifier: abilityPart.value,
      saveDcBreakdown: closeBreakdown([{ label: 'Base', value: 8 }, { label: 'Proficiência', value: prof }, abilityPart], source.saveDc),
      attack: d20Entry({
        id: attackId,
        label: `Ataque de magia — ${source.label}`,
        attackRoll: true,
        ability: source.ability,
        modifier: attackModifier,
        breakdown: [abilityPart, { label: 'Proficiência', value: prof }],
        condition: effects.attack,
        notes: [
          ...cannotAct,
          ...cannotSpeak,
          ...cannotCast,
          ...activeCastingRestrictions,
          ...castingRestrictions,
          critNote(20),
          ...linesFor(lines, 'attack'),
        ],
      }, inspiration),
    }
  }
  const spellcasting = [
    ...getCasterEntries(draft).map(caster => {
      const sc = caster.casting.spellcasting
      return spellcastingGuide({
        key: `class:${caster.cls.id}`,
        kind: 'class',
        classId: caster.cls.id,
        featId: null,
        label: caster.casting.label,
        ability: sc.ability,
        saveDc: getSpellSaveDC(sc, scores, level),
        attackId: `spell-attack:${caster.cls.id}`,
        attackModifier: getSpellAttackBonus(sc, scores, level),
      })
    }),
    // Talento que ensina magias (Iniciado em Magia, p. 170): a CD e o ataque pelo atributo da classe
    // escolhida nele, os de getFeatSpellBlocks — os mesmos da Revisão e do PDF.
    ...getFeatSpellBlocks(draft, scores).map(block => spellcastingGuide({
      key: `feat:${block.featId}`,
      kind: 'feat',
      classId: block.spellClass,
      featId: block.featId,
      label: block.label,
      ability: block.ability,
      saveDc: block.saveDc,
      attackId: `spell-attack:feat:${block.featId}`,
      attackModifier: Number(block.attackBonus),
    })),
    // De fora da classe e do talento (decisão de 2026-10-31): a raça (o truque do Alto Elfo, as inatas
    // do drow e do tiferino) e o truque da subclasse, cada um pelo atributo que o dado declara — a
    // mesma conta da classe, 8 + proficiência + o modificador, com os atributos finais.
    ...getOtherSpellcastings(draft).map(source => spellcastingGuide({
      key: source.key,
      kind: source.kind,
      classId: source.classId,
      featId: null,
      label: source.label,
      ability: source.ability,
      saveDc: getSpellSaveDC(source, scores, level),
      attackId: `spell-attack:${source.key}`,
      attackModifier: getSpellAttackBonus(source, scores, level),
    })),
  ]

  // Teste contra a morte: d20 puro, sem atributo (pág. 199); só as fontes de TODO teste de resistência.
  // Sortudo vale nele (decisão de 2026-10-25): a nota e, com os dados do app, o "rolar de novo".
  const deathSaveLines = lines.filter(l => l.deathSave)
  const deathSaveRerolls = deathSaveLines.flatMap(l => (l.rerollNaturalOne ? [l.rerollNaturalOne] : []))
  const deathSave: RollGuideEntry = {
    ...d20Entry({
      id: 'death-save',
      label: 'Teste contra a morte',
      modifier: 0,
      breakdown: [],
      condition: effects.deathSave,
      notes: [
        '10 ou mais: sucesso; 1: dois fracassos; 20: recupera 1 PV (pág. 199).',
        ...deathSaveLines.map(l => l.text),
      ],
    }, inspiration),
    ...(deathSaveRerolls.length > 0 ? { rerollNaturalOne: deathSaveRerolls } : {}),
  }

  const resilient = getOwnedFeats(draft).find(f => f.id === 'resistente')
  const hitDice = getHitDicePool(draft).map(({ die }) => healEntry({
    id: `hit-die:${die}`,
    label: `Dado de Vida (d${die})`,
    ability: 'CON',
    dice: `1d${die}`,
    modifier: mods.CON,
    breakdown: [{ label: ABILITY_LABELS.CON.long, value: mods.CON }],
    notes: [
      ...(mods.CON < 0 ? ['Se o total der menos que 0, recupera 0: a cura nunca vira dano.'] : []),
      ...(resilient
        ? [`${resilient.name}: cada dado recupera no mínimo 2 × mod. de Constituição (mínimo 2) (pág. 172) — confira na mesa.`]
        : []),
    ],
  }))

  return {
    checks, saves, skills, initiative, passivePerception, attacks, spellcasting, deathSave, hitDice,
    notes: [...cannotAct, ...cannotSpeak, ...cannotCast, ...activeCastingRestrictions],
    castingRestrictions,
    activeCastingRestrictions,
  }
}

/**
 * O TR de Constituição para manter a concentração depois de um dano (pág. 205): CD =
 * max(10, metade do dano, para baixo). O dano é o total do evento, depois da resistência e
 * contando o que os PV temporários absorveram (assumido E, `regras-rolagens-e-concentracao.md`).
 * Conjurador de Guerra (pág. 169) entra como vantagem — aqui o efeito vale sempre. A restrição de
 * conjuração vira nota: em fúria não se concentra (pág. 48), e entrar em fúria encerra a
 * concentração (decisão de 2026-10-29); com a fúria ligada, a nota diz que ela está em vigor.
 */
export function getConcentrationGuide(draft: CharacterDraft, state: PlayState, damage: number): RollGuideEntry {
  const scores = getFinalAbilityScores(draft)
  const mods = Object.fromEntries(ALL_ABILITY_SCORES.map(ab => [ab, calculateModifier(scores[ab])])) as Record<AbilityScore, number>
  const prof = getProficiencyBonus(draft.level ?? 1)
  const session = getSheetSession(draft, state)
  const effects = getGuideEffects(draft, state, session)
  const lines = [...getConditionalLines(effects, session), ...getSheetConditionalLines(draft, effects)]
  const sheet: SheetModeSources = { unproficientArmor: [], stealth: [] }
  const input = saveInput('CON', getSavingThrowChecks(draft, scores).CON, mods, prof, effects, sheet, lines, getSaveBonuses(draft, scores, state))
  const amount = Number.isFinite(damage) ? Math.max(0, Math.floor(damage)) : 0
  const warCaster = hasWarCaster(draft)
  const spell = state.concentration?.label
  return d20Entry({
    ...input,
    id: 'concentration',
    label: spell ? `Concentração em ${spell} — TR de Constituição` : 'Concentração — TR de Constituição',
    extraAdvantage: warCaster ? [warCaster] : [],
    notes: [...getCastingRestrictions(draft, session).map(formatCastingRestriction), ...(input.notes ?? [])],
    dc: Math.max(10, Math.floor(amount / 2)),
  }, state.inspiration)
}

/**
 * A receita do teste para ficar com 1 PV (a Fúria Implacável, pág. 49): o TR do atributo dele, o
 * mesmo da aba Testes, com a CD do aviso e o nome de quem o dá. O estado é o de ANTES do dano, o
 * mesmo de onde o "Passei" o reaplica: quem passa não caiu, então o teste é feito ainda em fúria e
 * sem o que a queda traz — a exaustão do Frenesi, que no estado de depois daria a desvantagem da
 * exaustão 3 a quem estava na 2. O id é próprio, como o da concentração: a folha aberta não o
 * troca pela entrada do TR sem a CD.
 */
export function getZeroHpSaveGuide(
  draft: CharacterDraft,
  stateBefore: PlayState,
  save: { ability: AbilityScore; source: string },
  dc: number,
): RollGuideEntry {
  return {
    ...getRollGuide(draft, stateBefore).saves[save.ability],
    id: 'zero-hp-save',
    label: `${save.source} — TR de ${ABILITY_LABELS[save.ability].long}`,
    dc,
  }
}

/** Acha uma entrada pelo `id` em qualquer parte do guia (a UI guarda só o id da jogada aberta). */
export function findRollGuideEntry(guide: RollGuide, id: string): RollGuideEntry | undefined {
  const all: (RollGuideEntry | null)[] = [
    ...Object.values(guide.checks),
    ...Object.values(guide.saves),
    ...Object.values(guide.skills),
    guide.initiative,
    ...guide.attacks.flatMap(a => [a.attack, a.damage, a.versatile]),
    ...guide.spellcasting.map(s => s.attack),
    guide.deathSave,
    ...guide.hitDice,
  ]
  return all.find((e): e is RollGuideEntry => e !== null && e.id === id)
}
