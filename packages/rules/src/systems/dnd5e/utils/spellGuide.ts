import type { CharacterDraft } from '../types/character'
import type { PlayState } from '../types/playState'
import type { AbilityScore } from '../types/race'
import type { Spell } from '../types/spell'
import type { SpellAmountPart, SpellDamagePart, SpellInstances, SpellMechanics } from '../types/spellMechanics'
import { ABILITY_LABELS, formatModifier } from './abilityScoreUtils'
import { getFinalAbilityScores } from './asiUtils'
import { getClass } from './classUtils'
import { getDamageLabel, getDamageTypeName } from './damageTypes'
import { damageEntry, healEntry, type GuideBreakdownItem, type RollGuideEntry } from './guideEntries'
import { getRollGuide, type RollGuide, type SpellcastingGuide } from './rollGuide'
import { getCantripSaveHalfDamage, getSpellDamageBonuses, type SheetSpellDamageBonus } from './sheetEffects'
import { getKnownSpells } from './sheetModel'
import { getSpellMechanics, scaledDiceCount, scaledFlat, type SpellCastContext } from './spellMechanics'
import { getCombinedSpellSlots, getPactSlots, getSpell } from './spellUtils'
import { joinPt } from './textUtils'

/**
 * O guia de uma magia (Fase 2, onda `magias-base`): a receita de leitura que as abas Magia e Regras
 * mostram — o ataque e a CD da conjuração, o dano por parte, a cura e os PV temporários, as
 * instâncias e o ganho do nível maior. Os números saem do dano estruturado revisado
 * (`data/spell-mechanics.json`) e da conjuração do guia de rolagens (`RollGuide.spellcasting`), e as
 * jogadas se montam pelos mesmos montadores do guia da ficha (`guideEntries.ts`). Nenhuma fórmula
 * de magia é montada em componente.
 *
 * - O crítico só existe na magia com jogada de ataque, e dobra todos os dados (pág. 198).
 * - O truque e os feixes da Rajada Mística crescem pelo nível de PERSONAGEM (`draft.level`;
 *   decisão de 2026-10-29, `docs/regras-conjuracao.md`, seção 2).
 * - Só a magia revisada tem guia: a que fica só no texto (`textOnly`) não ganha receita pela metade.
 */

/** Qual magia e por quem: a conjuração dá o ataque e a CD. */
export type SpellGuideRef = {
  /**
   * A conjuração (`SpellcastingGuide.key`: 'class:wizard', 'feat:<talento>'); null para a magia de
   * fora dela (o truque da raça, o da subclasse, as inatas): o guia fica só com o dano.
   */
  casterKey: string | null
  spellId: string
  /**
   * O nível do espaço (ou o nível em que a fonte a conjura: a inata "como uma magia de 2° nível").
   * Ausente, o espaço mais baixo que a conjuração da classe tem para ela (o de Pacto do bruxo;
   * `defaultCastLevel`), ou o da própria magia (0 no truque); abaixo do da magia, o da magia.
   */
  castLevel?: number
}

/**
 * O TR que o alvo faz: o atributo, a CD da conjuração (null sem ela) e o que o sucesso faz; `note`,
 * o condicional dele com a frase do livro (a cobertura que não vale contra a Chama Sagrada).
 */
export type SpellGuideSave = { ability: AbilityScore; dc: number | null; onSuccess: 'half' | 'none' | 'other'; text: string; note?: string }

export type SpellGuide = {
  ref: { casterKey: string | null; spellId: string; castLevel: number }
  name: string
  /** O nível da magia (0 no truque). */
  level: number
  castLevel: number
  /** A conjuração de onde vêm o ataque e a CD ("Mago"); null fora dela. */
  caster: { key: string; label: string } | null
  /** A jogada de ataque com magia: a da conjuração, com a magia no rótulo. */
  attack?: RollGuideEntry
  save?: SpellGuideSave
  /** Uma jogada por parte de dano; com instâncias, o dano de cada uma. */
  damage: RollGuideEntry[]
  heal?: RollGuideEntry
  tempHp?: RollGuideEntry
  maxHpIncrease?: RollGuideEntry
  /** "2 feixes": quantas jogadas separadas agora. */
  instances?: { count: number; noun: string; text: string }
  /** "Até 2 alvos." */
  targets?: { count: number; text: string }
  /** O que o espaço acima do da magia acrescenta: "No 4º nível: 9d6 (+1d6)". */
  upcastGain?: string
  /** O que vale para a magia inteira (sem a conjuração, sem o ataque nem a CD). */
  notes: string[]
}

const PLURAL: Record<SpellInstances['noun'], string> = { feixe: 'feixes', raio: 'raios', dardo: 'dardos', alvo: 'alvos' }

const nounFor = (noun: SpellInstances['noun'], count: number) => (count === 1 ? noun : PLURAL[noun])

/** "ácido, frio ou fogo": a lista da escolha. */
const joinOr = (items: readonly string[]) =>
  (items.length > 1 ? `${items.slice(0, -1).join(', ')} ou ${items[items.length - 1]}` : items.join(''))

// ── Ids ──────────────────────────────────────────────────────────────────────

/**
 * O id de uma jogada do guia da magia, que diz tudo para remontá-la: a magia, o nível do espaço, a
 * parte e a conjuração — `spell:fire-bolt:0:attack@class:wizard`. A folha da receita guarda só o id
 * e remonta a jogada a cada mudança do estado (`findSpellGuideEntry`), como as do guia da ficha.
 */
export function spellGuideEntryId(ref: SpellGuide['ref'], part: string): string {
  return `spell:${ref.spellId}:${ref.castLevel}:${part}@${ref.casterKey ?? ''}`
}

const ENTRY_ID = /^spell:([a-z0-9-]+):(\d+):([a-z0-9:-]+)@(.*)$/

// ── Montagem ─────────────────────────────────────────────────────────────────

/** O modificador do atributo de conjuração, com o rótulo do "de onde vem". */
type CasterAbility = { ability: AbilityScore; modifier: number }

/** O bônus de uma parte: o fixo, o que o espaço acima soma e o modificador de conjuração. */
function bonusParts(
  part: { bonus?: number | 'spellcastingModifier'; flat?: number; perSlotAbove?: SpellAmountPart['perSlotAbove'] },
  at: SpellCastContext,
  name: string,
  ability: CasterAbility | null,
): { modifier: number; breakdown: GuideBreakdownItem[]; missingModifier: boolean } {
  const fixed = (typeof part.bonus === 'number' ? part.bonus : 0) + scaledFlat(part, at)
  const breakdown: GuideBreakdownItem[] = fixed !== 0 ? [{ label: name, value: fixed }] : []
  const usesModifier = part.bonus === 'spellcastingModifier'
  if (usesModifier && ability) breakdown.push({ label: ABILITY_LABELS[ability.ability].long, value: ability.modifier })
  return {
    modifier: fixed + (usesModifier && ability ? ability.modifier : 0),
    breakdown,
    missingModifier: usesModifier && !ability,
  }
}

const MISSING_MODIFIER = 'Some o modificador do seu atributo de conjuração para esta magia: a ficha ainda não o calcula fora da conjuração de uma classe ou de um talento.'

/** "Truque: o dano cresce com o nível de personagem — 2d10 no 5º, 3d10 no 11º e 4d10 no 17º." */
function cantripStepsNote(part: SpellDamagePart): string | null {
  const steps = (part.byCharacterLevel ?? []).filter(s => s.from > 1)
  if (steps.length === 0) return null
  return `Truque: o dano cresce com o nível de personagem — ${joinPt(steps.map(s => `${s.value}d${part.sides} no ${s.from}º`))}.`
}

/** "A quantidade de feixes cresce com o nível de personagem — 2 no 5º, 3 no 11º e 4 no 17º." */
function instanceStepsNote(instances: SpellInstances): string | null {
  const steps = (instances.byCharacterLevel ?? []).filter(s => s.from > 1)
  if (steps.length === 0) return null
  return `A quantidade de ${PLURAL[instances.noun]} cresce com o nível de personagem — ${joinPt(steps.map(s => `${s.value} no ${s.from}º`))}.`
}

/** O texto do TR; `halfBy` é quem dá a metade no lugar do "nenhum dano" (o Truque Potente). */
function saveText(save: Omit<SpellGuideSave, 'text'>, halfBy: string | null = null): string {
  const dc = save.dc !== null ? ` (CD ${save.dc})` : ''
  const success = save.onSuccess === 'half' ? `no sucesso, metade do dano${halfBy ? ` (${halfBy})` : ''}`
    : save.onSuccess === 'none' ? 'no sucesso, nenhum dano'
      : 'o sucesso faz o que o texto da magia diz'
  return `TR de ${ABILITY_LABELS[save.ability].long} do alvo${dc}: ${success}.`
}

/**
 * O bônus vale nesta parte do dano da magia? Pelas palavras do livro: a magia (a rajada mística), a
 * escola e a lista da classe ("magia de evocação de mago"), o truque ("truque de clérigo") e o tipo
 * (o do ancestral dracônico; na escolha de tipo, quando ele está entre os da escolha).
 */
function bonusApplies(bonus: SheetSpellDamageBonus, spell: Spell, part: SpellDamagePart): boolean {
  const { ids, schools, spellClass, cantripsOnly, damageType } = bonus.match
  if (ids && !ids.includes(spell.id)) return false
  if (schools && !schools.includes(spell.school)) return false
  if (spellClass && !spell.classes.includes(spellClass)) return false
  if (cantripsOnly && spell.level !== 0) return false
  if (damageType && !(typeof part.type === 'string' ? [part.type] : part.type.choose).includes(damageType)) return false
  return true
}

/** "truques de clérigo", "magias de evocação de mago", "dano de fogo do seu ancestral": em quais magias o bônus vale. */
function bonusScope(bonus: SheetSpellDamageBonus): string | null {
  const { schools, spellClass, cantripsOnly, damageType } = bonus.match
  if (damageType) return `${getDamageLabel(damageType)} do seu ancestral`
  if (!schools && !spellClass && !cantripsOnly) return null
  const className = spellClass ? getClass(spellClass)?.name.toLowerCase() : undefined
  return [cantripsOnly ? 'truques' : 'magias', ...(schools ? [`de ${joinOr(schools)}`] : []), ...(className ? [`de ${className}`] : [])].join(' ')
}

/**
 * O bônus no dano que a fórmula ainda não soma (até a onda `magias-modificadores`), numa nota com o
 * valor: "Explosão Agonizante: some +3 (Carisma) ao dano de cada feixe que acerta; a fórmula ainda
 * não o inclui." Sem ela, a receita passaria por completa com o número errado.
 */
function pendingBonusNote(bonus: SheetSpellDamageBonus, instanceNoun: string | null, severalRolls: boolean): string {
  const scope = bonusScope(bonus)
  const ability = bonus.ability ? ` (${ABILITY_LABELS[bonus.ability].long})` : ''
  const where = bonus.per === 'instance' && instanceNoun ? `ao dano de cada ${instanceNoun} que acerta`
    : severalRolls ? 'a uma só jogada de dano da magia'
      : 'ao dano'
  return `${bonus.source}${scope ? ` (${scope})` : ''}: some ${formatModifier(bonus.value)}${ability} ${where}; a fórmula ainda não o inclui.`
}

/** "9d6 (+1d6)": o que cada parte ganhou com o espaço acima do da magia. */
function upcastGains(mech: SpellMechanics, at: SpellCastContext): string[] {
  if (at.slotsAbove <= 0) return []
  const base: SpellCastContext = { ...at, slotsAbove: 0 }
  const gains: string[] = []
  const amount = (part: SpellAmountPart | SpellDamagePart) => {
    if (!part.perSlotAbove) return
    if (part.sides !== undefined) {
      const now = scaledDiceCount(part, at)
      const diff = now - scaledDiceCount(part, base)
      if (diff > 0) gains.push(`${now}d${part.sides} (+${diff}d${part.sides})`)
    }
    const flatDiff = scaledFlat(part, at) - scaledFlat(part, base)
    if (flatDiff > 0) gains.push(`+${scaledFlat(part, at) + (typeof part.bonus === 'number' ? part.bonus : 0)} (+${flatDiff})`)
  }
  for (const part of mech.damage ?? []) amount(part)
  for (const part of [mech.heal, mech.tempHp, mech.maxHpIncrease]) if (part) amount(part)
  if (mech.instances?.perSlotAbove) {
    const diff = at.slotsAbove * mech.instances.perSlotAbove
    const now = mech.instances.count + diff
    gains.push(`${now} ${nounFor(mech.instances.noun, now)} (+${diff})`)
  }
  if (mech.targets?.perSlotAbove) {
    const diff = at.slotsAbove * mech.targets.perSlotAbove
    gains.push(`${mech.targets.count + diff} alvos (+${diff})`)
  }
  return gains
}

/** "No 4º nível: 9d6 (+1d6)": o ganho do espaço acima do da magia, quando há. */
function upcastGain(mech: SpellMechanics, at: SpellCastContext, castLevel: number): string | undefined {
  const gains = upcastGains(mech, at)
  return gains.length > 0 ? `No ${castLevel}º nível: ${gains.join('; ')}` : undefined
}

/**
 * O nível em que a magia da conjuração de uma classe sai quando quem chama não escolhe o espaço (a
 * tela ainda não escolhe; o Conjurar da onda `grimorio` escolherá): o espaço mais baixo que serve a
 * ela. O bruxo só tem os de Magia de Pacto, todos do mesmo nível, e conjura nele: a onda trovejante
 * no espaço de 3º sai como magia de 3º nível (pág. 58, linhas 4526-4537). Com Conjuração e Magia de
 * Pacto, os dois servem às magias das duas (pág. 166, linhas 14845-14851): fica o mais baixo, e
 * `pactLevel` diz o de Pacto, quando é outro. O talento e as magias de fora da conjuração não passam
 * por aqui: ficam no nível da magia, ou no que quem chama passar (a inata).
 */
function defaultCastLevel(draft: CharacterDraft, spell: Spell): { level: number; pactLevel: number | null } {
  const pool = getCombinedSpellSlots(draft)
  const pact = getPactSlots(draft)
  const poolLevel = pool.findIndex((count, i) => count > 0 && i + 1 >= spell.level) + 1 || null
  const pactLevel = pact && pact.slots > 0 && pact.slotLevel >= spell.level ? pact.slotLevel : null
  const level = Math.min(poolLevel ?? Infinity, pactLevel ?? Infinity)
  if (level === Infinity) return { level: spell.level, pactLevel: null }
  return { level, pactLevel: pactLevel !== null && pactLevel !== level ? pactLevel : null }
}

/**
 * O guia de uma magia revisada, para quem a conjura. `rollGuide`: o guia de rolagens da mesma ficha
 * e do mesmo estado, quando quem chama já o tem (a tela); sem ele, é montado aqui. Null para a
 * magia que não existe, que não tem mecânica ainda ou que fica só no texto.
 */
export function getSpellGuide(
  draft: CharacterDraft,
  state: PlayState,
  ref: SpellGuideRef,
  rollGuide: RollGuide = getRollGuide(draft, state),
): SpellGuide | null {
  const spell = getSpell(ref.spellId)
  const mech = getSpellMechanics(ref.spellId)
  if (!spell || !mech || mech.status !== 'reviewed') return null
  return buildSpellGuide(draft, spell, mech, ref, rollGuide)
}

function buildSpellGuide(draft: CharacterDraft, spell: Spell, mech: SpellMechanics, ref: SpellGuideRef, rollGuide: RollGuide): SpellGuide {
  const caster: SpellcastingGuide | null = ref.casterKey
    ? rollGuide.spellcasting.find(s => s.key === ref.casterKey) ?? null
    : null
  // Sem o espaço escolhido, a magia de 1º nível ou mais da conjuração de uma classe sai no espaço
  // mais baixo que ela tem (o de Pacto do bruxo); a do talento e a de fora, no nível dela.
  const slot = ref.castLevel === undefined && caster && !caster.featId && spell.level > 0
    ? defaultCastLevel(draft, spell)
    : null
  const castLevel = Math.max(spell.level, ref.castLevel ?? slot?.level ?? spell.level)
  const fullRef = { casterKey: ref.casterKey, spellId: spell.id, castLevel }
  const id = (part: string) => spellGuideEntryId(fullRef, part)
  const at: SpellCastContext = { characterLevel: draft.level ?? 1, slotsAbove: castLevel - spell.level }
  // O modificador é o da conjuração do guia de rolagens, o mesmo da CD e do ataque: uma conta só.
  const ability: CasterAbility | null = caster ? { ability: caster.ability, modifier: caster.abilityModifier } : null
  const { resolution } = mech
  const isAttack = resolution.kind === 'attack'
  const notes: string[] = []
  // Na multiclasse com Magia de Pacto, o espaço de Pacto também serve, e pode ser mais alto.
  const pactGains = slot?.pactLevel ? upcastGains(mech, { ...at, slotsAbove: slot.pactLevel - spell.level }) : []
  if (slot?.pactLevel && pactGains.length > 0) {
    notes.push(`Com um espaço de Magia de Pacto, ela sai no ${slot.pactLevel}º nível: ${pactGains.join('; ')}.`)
  }
  if (!caster && (resolution.kind === 'attack' || resolution.kind === 'save')) {
    notes.push('Sem o ataque e a CD: a ficha ainda não os calcula para as magias de fora da conjuração de uma classe ou de um talento.')
  }

  const instances = mech.instances
    ? (() => {
      const count = scaledDiceCount({
        count: mech.instances.count,
        byCharacterLevel: mech.instances.byCharacterLevel,
        ...(mech.instances.perSlotAbove ? { perSlotAbove: { count: mech.instances.perSlotAbove } } : {}),
      }, at)
      const noun = nounFor(mech.instances.noun, count)
      return { count, noun: mech.instances.noun, text: `${count} ${noun}` }
    })()
    : undefined

  // Truque Potente: quem passa no TR de um truque de dano seu sofre metade do dano, não nenhum.
  const halfBy = resolution.kind === 'save' && resolution.onSuccess === 'none' && spell.level === 0 && (mech.damage?.length ?? 0) > 0
    ? getCantripSaveHalfDamage(draft)
    : null
  const save: SpellGuideSave | undefined = resolution.kind === 'save'
    ? (() => {
      const base = { ability: resolution.ability, dc: caster?.saveDc ?? null, onSuccess: halfBy ? 'half' as const : resolution.onSuccess }
      return { ...base, text: saveText(base, halfBy), ...(resolution.note ? { note: resolution.note } : {}) }
    })()
    : undefined

  const targets = mech.targets && mech.targets.count > 1
    ? (() => {
      const count = mech.targets.count + Math.max(0, at.slotsAbove) * (mech.targets.perSlotAbove ?? 0)
      return { count, text: `Até ${count} alvos.` }
    })()
    : undefined

  const attack: RollGuideEntry | undefined = isAttack && caster
    ? {
      ...caster.attack,
      id: id('attack'),
      label: `${spell.name} — ataque`,
      notes: [
        `Ataque ${resolution.range === 'melee' ? 'corpo a corpo' : 'à distância'} com magia.`,
        // O condicional da jogada, com a frase do livro: a mesa marca o modo na folha.
        ...(resolution.note ? [resolution.note] : []),
        ...(instances && instances.count > 1 ? [`${instances.text}: uma jogada de ataque para cada um.`] : []),
        ...caster.attack.notes,
      ],
    }
    : undefined

  const damageParts = mech.damage ?? []
  // Os bônus no dano que a ficha tem e a fórmula ainda não soma: nota na parte e na magia.
  const bonuses = damageParts.length > 0 ? getSpellDamageBonuses(draft, getFinalAbilityScores(draft)) : []
  const severalRolls = damageParts.length > 1 || (instances?.count ?? 1) > 1
  const bonusNotes = (part: SpellDamagePart) => bonuses
    .filter(b => bonusApplies(b, spell, part))
    .map(b => pendingBonusNote(b, instances?.noun ?? null, severalRolls))
  for (const n of damageParts.flatMap(bonusNotes)) if (!notes.includes(n)) notes.push(n)
  const damage = damageParts.map((part, i) => {
    const typeName = typeof part.type === 'string' ? getDamageTypeName(part.type) : ''
    const bonus = bonusParts(part, at, spell.name, ability)
    const label = instances
      ? `${spell.name} — dano de cada ${instances.noun}`
      : damageParts.length > 1 && typeName ? `${spell.name} — dano ${typeName}` : `${spell.name} — dano`
    const partNotes = [
      ...(save ? [save.text, ...(save.note ? [save.note] : [])] : []),
      ...(typeof part.type === 'string' ? [] : [`Tipo à escolha: ${joinOr(part.type.choose.map(getDamageTypeName))}.`]),
      ...(part.when ? [`Só ${part.when}.`] : []),
      ...(bonus.missingModifier ? [MISSING_MODIFIER] : []),
      ...bonusNotes(part),
      ...(instances && instances.count > 1 ? [`${instances.text} no seu nível: cada ${instances.noun} que acerta causa este dano.`] : []),
      ...(mech.instances ? [instanceStepsNote(mech.instances)] : []),
      cantripStepsNote(part),
      ...(targets ? [`${targets.text} Jogue o dano uma única vez para todos (pág. 198).`] : []),
    ].filter((n): n is string => n !== null)
    return damageEntry({
      id: id(`damage:${i}`),
      label,
      parsed: { count: scaledDiceCount(part, at), sides: part.sides, modifier: bonus.modifier, damageType: typeName },
      damageType: typeName,
      breakdown: bonus.breakdown,
      notes: partNotes,
      critical: isAttack,
    })
  })

  const amount = (part: SpellAmountPart | undefined, partId: string, what: string): RollGuideEntry | undefined => {
    if (!part) return undefined
    const bonus = bonusParts(part, at, spell.name, ability)
    const count = part.sides !== undefined ? scaledDiceCount(part, at) : 0
    return healEntry({
      id: id(partId),
      label: `${spell.name} — ${what}`,
      dice: count > 0 ? `${count}d${part.sides}` : '',
      modifier: bonus.modifier,
      breakdown: bonus.breakdown,
      notes: bonus.missingModifier ? [MISSING_MODIFIER] : [],
    })
  }

  const gain = upcastGain(mech, at, castLevel)
  const heal = amount(mech.heal, 'heal', 'cura')
  const tempHp = amount(mech.tempHp, 'temp-hp', 'PV temporários')
  const maxHpIncrease = amount(mech.maxHpIncrease, 'max-hp', 'aumento do PV máximo')
  return {
    ref: fullRef,
    name: spell.name,
    level: spell.level,
    castLevel,
    caster: caster ? { key: caster.key, label: caster.label } : null,
    ...(attack ? { attack } : {}),
    ...(save ? { save } : {}),
    damage,
    ...(heal ? { heal } : {}),
    ...(tempHp ? { tempHp } : {}),
    ...(maxHpIncrease ? { maxHpIncrease } : {}),
    ...(instances ? { instances } : {}),
    ...(targets ? { targets } : {}),
    ...(gain ? { upcastGain: gain } : {}),
    notes,
  }
}

/** As jogadas do guia, na ordem da folha: o ataque, o dano, a cura, os PV temporários e o PV máximo. */
export function spellGuideRolls(guide: SpellGuide): RollGuideEntry[] {
  return [guide.attack, ...guide.damage, guide.heal, guide.tempHp, guide.maxHpIncrease]
    .filter((e): e is RollGuideEntry => e !== undefined)
}

/**
 * A jogada do guia de uma magia pelo id (`spellGuideEntryId`), remontada com o estado de agora — a
 * folha da receita aberta acompanha as condições e a Inspiração, como as jogadas do guia da ficha —,
 * com o guia dela (o ataque leva ao dano). Null para o id que não é de magia.
 */
export function findSpellGuideEntry(
  draft: CharacterDraft,
  state: PlayState,
  id: string,
  rollGuide: RollGuide = getRollGuide(draft, state),
): { guide: SpellGuide; entry: RollGuideEntry } | null {
  const m = ENTRY_ID.exec(id)
  if (!m) return null
  const [, spellId, castLevel, , casterKey] = m
  const guide = getSpellGuide(draft, state, { spellId, castLevel: Number(castLevel), casterKey: casterKey || null }, rollGuide)
  const entry = guide ? spellGuideRolls(guide).find(e => e.id === id) : undefined
  return guide && entry ? { guide, entry } : null
}

/**
 * Por conjuração do guia de rolagens (classe ou talento), as magias que ela conhece com receita —
 * truques primeiro, depois por nível, alfabética dentro de cada um. As mesmas magias da aba Regras
 * (`getKnownSpells`), só as revisadas com algo a rolar. A aba Magia lista daqui.
 */
export function getCasterSpellGuides(
  draft: CharacterDraft,
  state: PlayState,
  rollGuide: RollGuide = getRollGuide(draft, state),
): { casterKey: string; guides: SpellGuide[] }[] {
  const known = getKnownSpells(draft)
  return rollGuide.spellcasting.map(sc => {
    const spells = sc.featId
      ? (() => {
        const feat = known.feats.find(f => f.featId === sc.featId)
        return feat ? [...feat.cantrips, ...feat.spells] : []
      })()
      : known.classes.find(c => c.caster.cls.id === sc.classId)?.spells.map(s => s.spell) ?? []
    const guides = [...spells]
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'))
      .map(spell => getSpellGuide(draft, state, { casterKey: sc.key, spellId: spell.id }, rollGuide))
      .filter((g): g is SpellGuide => g !== null && spellGuideRolls(g).length > 0)
    return { casterKey: sc.key, guides }
  })
}
