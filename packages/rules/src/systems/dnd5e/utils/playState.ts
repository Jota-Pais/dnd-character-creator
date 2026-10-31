import type { RollRecord } from '../../../core/dice'
import type { ConditionId, ExhaustionLevel } from '../types/condition'
import type { DamageTypeId } from '../types/damage'
import {
  CONDITION_NOTE_MAX_LENGTH, HIT_DIE_SIZES, PLAY_STATE_VERSION, ROLL_HISTORY_LIMIT,
  type ActiveToggle, type Concentration, type DamageInput, type DamagePart, type DeathSaveCount, type LifeState, type PlayNotice, type PlayNoticeKind,
  type PlayResult, type PlaySheet, type PlayState, type SheetSnapshot, type SheetSnapshotAttack, type SheetSnapshotSpellcasting,
  type SpellCastRecord, type TurnSlot, type TurnState,
} from '../types/playState'
import type { ActionTiming, SheetAction } from '../types/actions'
import type { Spell } from '../types/spell'
import type { CastingTimeKind, SpellbookEntry, SpellPayment } from '../types/spellbook'
import {
  getActiveConditionEffects, getCondition, getEffectiveConditions, getEffectiveHpMax,
  applyConditionSpeed, damageTypeSetHas, halveSpeedOnGrid, isConditionSuspended, withConditionApplied,
  type ActiveConditionEffects, type ConditionState, type SheetDamageDefense,
} from './sheetEffects'
import type { ZeroHpSave } from '../types/effects'
import type { ResolvedToggle, SheetToggle } from '../types/session'
import { ABILITY_LABELS, formatMeters } from './abilityScoreUtils'
import type { SheetResource } from './classResourceUtils'
import { resolveActiveEffects } from './activeEffects'
import { describeUnproficientArmorCasting } from './proficiencyUtils'
import { getDamageLabel, getDamageTypeName } from './damageTypes'
import { countLabel, joinPt } from './textUtils'
import { findSpellbookEntry } from './spellbook'
import { getSpellMechanics } from './spellMechanics'
import { castingTimeKind, getSpell, hasVerbalComponent } from './spellUtils'

/**
 * Operações do estado de jogo: funções puras que recebem (estado, PlaySheet, …) e devolvem
 * `{ state, notices }`. Nunca recebem o draft — é assim que jogar não altera a ficha. Toda
 * operação que precisa da ficha começa por `reconcilePlayState`, que encaixa o gasto nos máximos
 * atuais (a ficha pode ter mudado no criador desde a última sessão).
 *
 * Regras: Notas de implementação de `docs/regras-descanso.md`, `docs/regras-dano-e-morte.md`,
 * `docs/regras-condicoes.md` e `docs/regras-rolagens-e-concentracao.md`. Onde o livro não decide
 * (Pontos em aberto), a função recusa ou avisa com `unresolvedRule` — não chuta.
 *
 * Recusa: o estado devolvido é o MESMO objeto recebido, com um aviso `refused`.
 */

const SPELL_LEVELS = 9

// ── Utilidades internas ─────────────────────────────────────────────────────

const note = (kind: PlayNoticeKind, text: string, dc?: number): PlayNotice =>
  dc === undefined ? { kind, text } : { kind, text, dc }

const done = (state: PlayState, notices: PlayNotice[] = []): PlayResult => ({ state, notices })

const refuse = (state: PlayState, text: string, kind: PlayNoticeKind = 'refused'): PlayResult =>
  ({ state, notices: [note(kind, text)] })

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(n)))

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

const toCount = (n: number): DeathSaveCount => clampInt(n, 0, 3) as DeathSaveCount

const signed = (n: number) => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`)

/** O ajuste do PV máximo como se escreve na ficha: "+5", "−3". */
export const formatHpAdjustment = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`)

const ZERO_SAVES = { successes: 0, failures: 0 } as const

/** O turno sem nada usado: o começo do jogo, o Novo turno e a Nova sessão. */
export function emptyTurn(): TurnState {
  return {
    action: false, bonusAction: false, movement: false, reaction: false,
    extraActions: 0, extraTurnActionUsed: false, dashes: 0, movementSpent: 0, attacked: false, afterTurn: false, beforeTurn: false, used: [],
    spellsCast: [],
  }
}

/** Estado novo, vazio, para uma ficha que começa a jogar. */
export function createPlayState(characterId: string, now = 0): PlayState {
  return {
    version: PLAY_STATE_VERSION,
    characterId,
    updatedAt: now,
    damageTaken: 0,
    maxHpAdjustment: 0,
    tempHp: 0,
    lifeState: 'conscious',
    deathSaves: { ...ZERO_SAVES },
    hitDiceSpent: {},
    spellSlotsSpent: Array(SPELL_LEVELS).fill(0),
    pactSlotsSpent: 0,
    resourcesSpent: {},
    conditions: [],
    exhaustionLevel: 0,
    concentration: null,
    activeEffects: [],
    turn: emptyTurn(),
    restCounters: {},
    inspiration: false,
    note: '',
    rolls: [],
  }
}

// ── Leituras derivadas ──────────────────────────────────────────────────────

/** 0 PV: `dying` ou `stable`. O Inconsciente desses estados é derivado, nunca gravado. */
export function isAtZeroHp(state: Pick<PlayState, 'lifeState'>): boolean {
  return state.lifeState === 'dying' || state.lifeState === 'stable'
}

/**
 * Consciente: vivo, acima de 0 PV e sem o Inconsciente gravado (o sono mágico). É o "enquanto você
 * estiver consciente" das auras do paladino (págs. 111-112): a imunidade das de Coragem e de
 * Devoção e o bônus da de Proteção nos TR.
 */
export function isConscious(state: Pick<PlayState, 'lifeState' | 'conditions'>): boolean {
  return state.lifeState === 'conscious' && !state.conditions.includes('unconscious')
}

/**
 * O que o agregador de condições (`sheetEffects.ts`) recebe deste estado: as condições gravadas,
 * mais o Inconsciente enquanto o personagem está a 0 PV (`regras-condicoes.md`, 6.4); os efeitos
 * ligados já resolvidos (`toggles`) e a imunidade a condição das defesas da ficha (`defenses`: a
 * Pureza Corporal), que valem só sem situação nem bloqueio. A de "enquanto você estiver consciente"
 * (`whileConscious`: as Auras de Coragem e de Devoção, págs. 111-112) só vale consciente: não a 0
 * PV, nem com o Inconsciente gravado, nem morto.
 */
export function getPlayConditionState(
  state: PlayState,
  toggles: readonly ResolvedToggle[] = [],
  defenses: readonly SheetDamageDefense[] = [],
): ConditionState {
  const conditions: ConditionId[] = isAtZeroHp(state) && !state.conditions.includes('unconscious')
    ? [...state.conditions, 'unconscious']
    : [...state.conditions]
  const conscious = isConscious(state)
  const conditionImmunities = defenses
    .filter(d => d.kind === 'conditionImmunity' && d.conditions?.length && !d.blockedBy && !d.condition && !d.exceptWhen)
    .filter(d => conscious || !d.whileConscious)
    .map(d => ({ source: d.source, conditions: d.conditions ?? [] }))
  return {
    conditions,
    exhaustion: state.exhaustionLevel,
    ...(toggles.length > 0 ? { toggles } : {}),
    ...(conditionImmunities.length > 0 ? { conditionImmunities } : {}),
  }
}

/** Os efeitos ligados do estado, resolvidos contra a ficha (`resolveActiveEffects`). */
export function getPlayToggles(state: PlayState, sheet: PlaySheet): ResolvedToggle[] {
  return resolveActiveEffects(state.activeEffects, sheet.toggles)
}

/**
 * Os efeitos em vigor deste estado: condições, exaustão e efeitos ligados (em fúria), com a
 * imunidade a condição da ficha — o mesmo agregador da ficha, uma escada só (p. 175).
 */
export function getPlayEffects(state: PlayState, sheet: PlaySheet): ActiveConditionEffects {
  return getActiveConditionEffects(getPlayConditionState(state, getPlayToggles(state, sheet), sheet.defenses))
}

/**
 * PV máximo antes da exaustão: o da ficha mais o ajuste temporário (`maxHpAdjustment`: Ajuda +5).
 * É contra ele que `damageTaken` se mede.
 */
export function getBaseMaxHp(state: PlayState, sheet: PlaySheet): number {
  return Math.max(0, sheet.maxHp + state.maxHpAdjustment)
}

/**
 * PV máximo efetivo: o da ficha com o ajuste temporário (`getBaseMaxHp`) × multiplicador da
 * exaustão (metade a partir da 4, pág. 292) — a Exaustão 4 corta o máximo JÁ somado ao ajuste
 * (decisão do dono, 2026-10-25). Com a característica que impede reduzir o máximo (Acostumado à
 * Morte-Vida, pág. 101), sem o corte.
 */
export function getEffectiveMaxHp(state: PlayState, sheet: PlaySheet): number {
  const baseMax = getBaseMaxHp(state, sheet)
  if (sheet.hpMaxReductionImmunity) return baseMax
  return getEffectiveHpMax(baseMax, getPlayEffects(state, sheet))
}

/**
 * A linha que explica por que a Exaustão 4 (ou mais) não cortou o PV máximo: só com a
 * característica que o impede (Acostumado à Morte-Vida) e a exaustão que corta. `null` fora disso.
 */
export function describeHpMaxImmunity(state: PlayState, sheet: PlaySheet): string | null {
  if (!sheet.hpMaxReductionImmunity) return null
  if (getPlayEffects(state, sheet).hpMax.multiplier === 1) return null
  return `Exaustão ${state.exhaustionLevel} sem efeito no PV máximo (${sheet.hpMaxReductionImmunity}): seu máximo de pontos de vida não pode ser reduzido (pág. 101).`
}

/**
 * PV atual = max(0, máx. base − dano sofrido), lido do estado JÁ reconciliado com esta ficha:
 * um estado salvo antes de a ficha mudar no criador nunca mostra PV acima do máximo efetivo, nem
 * PV positivo a 0 PV, nem 0 PV consciente.
 */
export function getCurrentHp(state: PlayState, sheet: PlaySheet): number {
  return Math.max(0, getBaseMaxHp(state, sheet) - reconcilePlayState(state, sheet).damageTaken)
}

/** Deslocamento efetivo em pés, com as condições e a exaustão. */
export function getPlaySpeed(state: PlayState, sheet: PlaySheet): number {
  return applyConditionSpeed(sheet.speed, getPlayEffects(state, sheet))
}

export type HitDiceAvailability = { die: number; total: number; spent: number; available: number }

/** Dados de Vida por tipo: total do poço da ficha, gastos e disponíveis. */
export function getHitDiceAvailable(state: PlayState, sheet: PlaySheet): HitDiceAvailability[] {
  return sheet.hitDice.map(({ die, count }) => {
    const spent = clampInt(state.hitDiceSpent[die] ?? 0, 0, count)
    return { die, total: count, spent, available: count - spent }
  })
}

/** Espaços do pool disponíveis por nível (9 posições). */
export function getSpellSlotsAvailable(state: PlayState, sheet: PlaySheet): number[] {
  return Array.from({ length: SPELL_LEVELS }, (_, i) => {
    const max = sheet.spellSlots[i] ?? 0
    return max - clampInt(state.spellSlotsSpent[i] ?? 0, 0, max)
  })
}

/** Espaços de Pacto disponíveis (0 sem bruxo). */
export function getPactSlotsAvailable(state: PlayState, sheet: PlaySheet): number {
  const max = sheet.pactSlots?.slots ?? 0
  return max - clampInt(state.pactSlotsSpent, 0, max)
}

/**
 * Usos restantes de um recurso: número, `'unlimited'` ou null (id desconhecido, ou recurso que é
 * só um dado, sem usos contados).
 */
export function getResourceAvailable(state: PlayState, sheet: PlaySheet, id: string): number | 'unlimited' | null {
  const r = sheet.resources.find(x => x.id === id)
  if (!r || r.uses === undefined) return null
  if (r.uses === 'unlimited') return 'unlimited'
  return r.uses - clampInt(state.resourcesSpent[id] ?? 0, 0, r.uses)
}

// ── Reconciliação com a ficha ───────────────────────────────────────────────

/**
 * Encaixa o estado nos máximos da ficha atual: gasto nunca acima do máximo, tipos de Dado de Vida,
 * recursos e contadores do descanso que a ficha não tem mais saem, a 0 PV e morto o dano é o
 * máximo, e vale o invariante `máx. da ficha − damageTaken ≤ máx. efetivo` (o corte da exaustão 4,
 * decisão 4).
 *
 * Exceção: com máximo efetivo 0 (ficha com 1 PV na exaustão 4) o corte não é aplicado a quem
 * está consciente — o livro não trata do caso (`regras-dano-e-morte.md`, Ponto em aberto 17).
 *
 * Consciente fica com pelo menos 1 PV: se a ficha encolheu abaixo do dano sofrido (nível ou CON
 * menores no criador), o dano vira máx. − 1. Reduzir o máximo nunca leva a 0 PV sozinho, e o
 * `lifeState` só muda pelo pipeline de dano (`regras-dano-e-morte.md`, Notas; pág. 199).
 */
export function reconcilePlayState(state: PlayState, sheet: PlaySheet): PlayState {
  const sheetMax = getBaseMaxHp(state, sheet)
  const effMax = getEffectiveMaxHp(state, sheet)
  let damageTaken = clampInt(state.damageTaken, 0, sheetMax)
  // Morto tem 0 PV, qualquer que seja a causa (Exaustão 6: decisão de 2026-10-25).
  if (isAtZeroHp(state) || state.lifeState === 'dead') damageTaken = sheetMax
  else if (effMax >= 1) damageTaken = Math.max(damageTaken, sheetMax - effMax)
  if (state.lifeState === 'conscious' && sheetMax >= 1) damageTaken = Math.min(damageTaken, sheetMax - 1)

  const hitDiceSpent: Record<number, number> = {}
  for (const { die, count } of sheet.hitDice) {
    const spent = clampInt(state.hitDiceSpent[die] ?? 0, 0, count)
    if (spent > 0) hitDiceSpent[die] = spent
  }

  const resourcesSpent: Record<string, number> = {}
  for (const r of sheet.resources) {
    if (typeof r.uses !== 'number') continue
    const spent = clampInt(state.resourcesSpent[r.id] ?? 0, 0, r.uses)
    if (spent > 0) resourcesSpent[r.id] = spent
  }

  return {
    ...state,
    damageTaken,
    hitDiceSpent,
    spellSlotsSpent: Array.from({ length: SPELL_LEVELS }, (_, i) =>
      clampInt(state.spellSlotsSpent[i] ?? 0, 0, sheet.spellSlots[i] ?? 0)),
    pactSlotsSpent: clampInt(state.pactSlotsSpent, 0, sheet.pactSlots?.slots ?? 0),
    resourcesSpent,
    // O contador que nenhum teste da ficha declara mais (a Fúria Implacável saiu no criador) sai,
    // como o gasto do recurso que ela não tem: o descanso só zera os da ficha, e a CD voltaria alta
    // com a característica de volta.
    restCounters: Object.fromEntries(Object.entries(state.restCounters)
      .filter(([id]) => getRestCounterSaves(sheet).some(s => s.counter === id))),
    // O efeito ligado que a ficha não tem mais (a característica saiu no criador) sai; a opção que
    // ela não tem mais também.
    activeEffects: state.activeEffects.flatMap(a => {
      const toggle = sheet.toggles.find(t => t.id === a.id)
      if (!toggle) return []
      return a.option && !toggle.options.some(o => o.id === a.option) ? [{ id: a.id, startedAt: a.startedAt }] : [a]
    }),
  }
}

/**
 * Reconciliação de quem CARREGA o estado (abrir o modo de jogo, importar): o mesmo
 * `reconcilePlayState`, com aviso quando a ficha mudada mexeu no PV de quem está consciente —
 * o corte da exaustão 4 sobre um máximo maior (`hpCut`, decisão 4) ou o 1 PV de quem ficaria com
 * 0 numa ficha menor. Use com `buildPlaySheet(draft)` antes de mostrar o estado.
 */
export function reconcileLoadedPlayState(state: PlayState, sheet: PlaySheet): PlayResult {
  const next = reconcilePlayState(state, sheet)
  const gone = state.activeEffects.filter(a => !next.activeEffects.some(n => n.id === a.id))
  // A opção que caiu também avisa: o que ela fazia, inclusive ao terminar (o nível de exaustão do
  // Frenesi), deixa de valer.
  const optionLost = next.activeEffects.flatMap(n => {
    const before = state.activeEffects.find(a => a.id === n.id)
    const toggle = sheet.toggles.find(t => t.id === n.id)
    return before?.option && !n.option && toggle ? [toggle] : []
  })
  const toggleNotices = [
    ...(gone.length > 0
      ? [note('info', gone.length === 1
        ? 'A ficha mudou: 1 efeito ligado deixou de valer e foi desligado, porque a ficha não o tem mais.'
        : `A ficha mudou: ${gone.length} efeitos ligados deixaram de valer e foram desligados, porque a ficha não os tem mais.`)]
      : []),
    ...optionLost.map(t => note('info', `A ficha mudou: continua ${lowerFirst(t.label)}, sem a opção escolhida ao ligar, porque a ficha não a tem mais; o que ela fazia, inclusive ao terminar, deixa de valer.`)),
  ]
  if (state.lifeState !== 'conscious') return done(next, toggleNotices)
  const sheetMax = getBaseMaxHp(state, sheet)
  const before = Math.max(0, sheetMax - state.damageTaken)
  const after = Math.max(0, sheetMax - next.damageTaken)
  const effMax = getEffectiveMaxHp(next, sheet)
  const notices: PlayNotice[] = []
  if (after < before && effMax < sheetMax && after === effMax) {
    // Sem "antes": o PV de antes com o máximo novo nunca existiu na mesa (o jogador viu o do
    // máximo antigo, que não é guardado).
    notices.push(note('hpCut', `A ficha mudou: com a exaustão ${next.exhaustionLevel}, o PV máximo é ${effMax}. O PV atual fica em ${after}; o que foi cortado não volta quando a exaustão baixar.`))
  } else if (before === 0 && after > 0) {
    notices.push(note('info', `A ficha mudou: o PV máximo (${sheetMax}) ficou abaixo do dano sofrido. O personagem fica com ${after} PV — reduzir o máximo não leva a 0 PV sozinho.`))
  }
  return done(next, [...notices, ...toggleNotices])
}

// ── Transições de vida (internas, mutam o rascunho `next` da operação) ─────────

/**
 * Encerra a concentração, com o motivo, e o que ela sustenta: a magia que você mesmo conjurou em si
 * (`sustainedByConcentration`: a Bênção, o Auxílio Divino) acaba junto, por qualquer motivo — fim
 * voluntário, dano, incapacitação, outra concentração —, com o aviso e o que vem ao acabar (a
 * letargia da Velocidade). A recebida de um aliado fica: quem a mantém é ele.
 */
function endConcentrationInto(next: PlayState, sheet: PlaySheet, notices: PlayNotice[], reason: string): void {
  if (!next.concentration) return
  notices.push(note('concentrationEnded', `A concentração em ${next.concentration.label} terminou: ${reason}.`))
  next.concentration = null
  endSustainedToggles(next, sheet, notices)
}

/** As magias que a concentração que acabou sustentava acabam junto, com aviso. */
function endSustainedToggles(next: PlayState, sheet: PlaySheet, notices: PlayNotice[]): void {
  for (const active of next.activeEffects.filter(a => a.sustainedByConcentration)) {
    const toggle = sheet.toggles.find(t => t.id === active.id)
    notices.push(note('info', `${toggle?.source ?? active.id}: terminou com a sua concentração.`))
    endToggleInto(next, sheet, active.id, notices)
  }
}

/**
 * A morte, por qualquer caminho: encerra a concentração (assumido F) e o que acaba ao cair
 * inconsciente (a Fúria). A morte instantânea (pág. 199) e a da exaustão 6 (pág. 292) não deixam o
 * personagem inconsciente, e o morto não continua em fúria (decisão de 2026-10-30): o efeito acaba
 * aqui, com o aviso e a exaustão do Frenesi, e o "Fui revivido" volta sem ele. Na morte a 0 PV, ele
 * já tinha acabado na queda.
 */
function toDead(next: PlayState, sheet: PlaySheet, notices: PlayNotice[], why: string): void {
  next.lifeState = 'dead'
  notices.push(note('died', why))
  endConcentrationInto(next, sheet, notices, 'morte (pág. 205)')
  endTogglesOnUnconscious(next, sheet, notices, 'death')
}

/**
 * Queda a 0 PV, morrendo ou estável (nocaute): o `onApply` do Inconsciente vale aqui, porque o
 * Inconsciente dos 0 PV não é "aplicado" (`regras-condicoes.md`, 6.4): grava o Caído, avisa de
 * largar o que segura e encerra a concentração.
 */
function toZeroHp(next: PlayState, sheet: PlaySheet, notices: PlayNotice[], lifeState: 'dying' | 'stable'): void {
  next.lifeState = lifeState
  next.deathSaves = { ...ZERO_SAVES }
  notices.push(note('fellUnconscious', lifeState === 'stable'
    ? 'Nocauteado: caiu inconsciente com 0 PV e está estável (pág. 200).'
    : 'Caiu inconsciente com 0 PV: faça um teste contra a morte no início de cada turno (pág. 199).'))
  const onApply = getCondition('unconscious')?.onApply
  for (const id of onApply?.addConditions ?? []) {
    if (!next.conditions.includes(id)) next.conditions = [...next.conditions, id]
  }
  if (onApply?.dropHeldItems) notices.push(note('droppedItems', 'Largou o que estava segurando (pág. 292).'))
  endConcentrationInto(next, sheet, notices, 'ficou inconsciente (pág. 205)')
  endTogglesOnUnconscious(next, sheet, notices)
}

/**
 * Saída dos 0 PV com PV de verdade: consciente, contadores zerados; o Caído gravado continua.
 * `text.awake` é o aviso de quem acorda; `text.cause`, o começo do aviso quando há um Inconsciente
 * GRAVADO (sono mágico…), que não sai com a cura (`regras-condicoes.md`, 6.4): aí ele não acordou.
 */
function toConscious(next: PlayState, notices: PlayNotice[], text: { awake: string; cause: string }): void {
  next.lifeState = 'conscious'
  next.deathSaves = { ...ZERO_SAVES }
  const prone = next.conditions.includes('prone') ? ' Continua Caído até se levantar.' : ''
  if (next.conditions.includes('unconscious')) {
    notices.push(note('warning', `${text.cause}: saiu dos 0 PV, mas continua Inconsciente (condição gravada).${prone}`))
  } else {
    notices.push(note('regainedConsciousness', `${text.awake}${prone}`))
  }
}

// ── Dano ────────────────────────────────────────────────────────────────────

export type { DamageInput }

/**
 * O traço de ficar com 1 PV em vez de cair (Resistência Implacável), quando ainda tem uso. `null`
 * sem o traço, sem uso ou com máximo efetivo abaixo de 1.
 */
function availableDropToOneHp(state: PlayState, sheet: PlaySheet): PlaySheet['dropToOneHp'] | null {
  const drop = sheet.dropToOneHp
  if (!drop || getEffectiveMaxHp(state, sheet) < 1) return null
  const available = getResourceAvailable(state, sheet, drop.resourceId)
  return available === 'unlimited' || (typeof available === 'number' && available > 0) ? drop : null
}

/** O teste para ficar com 1 PV (a Fúria Implacável), com o efeito ligado que ele pede. */
type ZeroHpSaveOffer = { toggle: SheetToggle; save: NonNullable<SheetToggle['zeroHpSave']> }

/**
 * Os testes da ficha cujos usos moram em `PlayState.restCounters` (hoje, o da Fúria Implacável).
 * Quem lê os contadores pela ficha lê daqui: o descanso, que os zera, e a reconciliação, que tira
 * os que a ficha não declara mais.
 */
function getRestCounterSaves(sheet: PlaySheet): NonNullable<SheetToggle['zeroHpSave']>[] {
  return sheet.toggles.flatMap(t => (t.zeroHpSave ? [t.zeroHpSave] : []))
}

/**
 * A CD de agora do teste para ficar com 1 PV: a de partida mais `dcStep` por uso desde o último
 * descanso (a Fúria Implacável, pág. 49: 10, depois 15, 20…).
 */
export function getZeroHpSaveDc(state: PlayState, save: ZeroHpSave): number {
  return save.dc + save.dcStep * (state.restCounters[save.counter] ?? 0)
}

/**
 * O teste para ficar com 1 PV que vale agora: o efeito que o dá está ligado (em fúria, mesmo de
 * armadura pesada: ele não está entre os benefícios) e o máximo efetivo é de pelo menos 1. `null`
 * sem a característica ou fora do efeito.
 */
function availableZeroHpSave(state: PlayState, sheet: PlaySheet): ZeroHpSaveOffer | null {
  if (getEffectiveMaxHp(state, sheet) < 1) return null
  const toggle = sheet.toggles.find(t => t.zeroHpSave && state.activeEffects.some(a => a.id === t.id))
  return toggle?.zeroHpSave ? { toggle, save: toggle.zeroHpSave } : null
}

/**
 * A queda que mata pela exaustão que o fim de um efeito traz: o Furioso 11 em Frenesi na exaustão 5
 * cai a 0 PV, a queda encerra a fúria, e o Frenesi leva à exaustão 6 (pág. 292). As ofertas de ficar
 * com 1 PV continuam, e a frase delas diz que a morte também não vem: quem fica com 1 PV não caiu, a
 * fúria não acaba e a exaustão do Frenesi não chega (decisão de 2026-10-30, Ponto em aberto 29 de
 * `regras-dano-e-morte.md`). Vazia quando a queda não matou.
 */
function describeFallDeath(before: PlayState, after: PlayState, sheet: PlaySheet): string {
  if (after.lifeState !== 'dead') return ''
  const cause = before.activeEffects.flatMap(active => {
    const option = active.option ? sheet.toggles.find(t => t.id === active.id)?.options.find(o => o.id === active.option) : undefined
    return option?.onEnd?.exhaustion ? [option.label] : []
  })[0]
  return ` Ficando com 1 PV, você não cai, e a morte pela exaustão${cause ? ` do ${cause}` : ''} também não acontece.`
}

/**
 * As defesas contra dano em vigor: as da ficha (`PlaySheet.defenses`), as dos efeitos ligados (a
 * Fúria: concussão, cortante e perfurante) e as das condições, no mesmo formato — o Petrificado dá
 * resistência a todo dano e imunidade a veneno (pág. 293). O pipeline de dano e a aba Estado leem
 * daqui.
 */
export function getPlayDamageDefenses(state: PlayState, sheet: PlaySheet): SheetDamageDefense[] {
  const effects = getPlayEffects(state, sheet)
  return [
    ...sheet.defenses,
    ...effects.defenses,
    ...effects.resistAllDamage.sources.map((s): SheetDamageDefense => ({ source: s.label, kind: 'resistance', types: 'all' })),
    ...effects.damageImmunities.flatMap(i => i.sources.map((s): SheetDamageDefense =>
      ({ source: s.label, kind: 'immunity', types: [i.damageType] }))),
  ]
}

/**
 * A pergunta da caixa de uma defesa condicional no painel de PV, a mesma nos avisos que a citam:
 * "Dano de magia?", "Dano de ataque não mágico?".
 */
export function formatDefenseConditionQuestion(condition: string): string {
  return `Dano ${condition}?`
}

/**
 * A defesa vale neste dano: não impedida pelo equipamento, com a situação confirmada e sem a exceção
 * marcada. O pipeline e a linha embaixo dos chips do painel de PV perguntam aqui.
 */
export function defenseApplies(
  d: SheetDamageDefense,
  input: Pick<DamageInput, 'conditionalDefenses' | 'exceptions'>,
): boolean {
  if (d.blockedBy) return false
  if (d.condition && !(input.conditionalDefenses ?? []).includes(d.condition)) return false
  return !(d.exceptWhen && (input.exceptions ?? []).includes(d.exceptWhen))
}

/**
 * A defesa alcança a parcela? Com tipo, pelo conjunto dela; sem tipo, só a de todo dano — o app não
 * chuta o tipo (o Urso, "exceto psíquico", precisa saber qual é).
 */
const defenseCovers = (d: SheetDamageDefense, type: DamageTypeId | undefined) =>
  type ? damageTypeSetHas(d.types, type) : d.types === 'all'

const sourcesOf = (defenses: SheetDamageDefense[]) => [...new Set(defenses.map(d => d.source))].join(', ')

/**
 * As parcelas do evento na ordem em que foram digitadas, inteiras e com piso 0 (decisão 3). Sem
 * `parts`, o evento é uma parcela só, com o tipo informado ou sem tipo.
 */
function getDamageParts(input: DamageInput): DamagePart[] {
  const parts = input.parts?.length ? input.parts : [{ amount: input.amount, damageType: input.damageType }]
  return parts.map(part => {
    const amount = Math.max(0, Math.floor(part.amount))
    return part.damageType ? { amount, damageType: part.damageType } : { amount }
  })
}

/**
 * A redução fixa (Maestria em Armadura Pesada), uma vez por evento, sobre as parcelas do tipo que ela
 * alcança, com um aviso por parcela reduzida. Alcançando mais de uma, ela sai da parcela digitada
 * primeiro, e o que sobrar, da seguinte (decisão de 2026-10-30, Ponto em aberto 28 de
 * `regras-dano-e-morte.md`): com outra defesa nelas (a metade arredonda por tipo), a ordem muda o
 * resultado, e é a da mesa que digita.
 */
function applyDamageReductions(parts: DamagePart[], reductions: SheetDamageDefense[], notices: PlayNotice[]): DamagePart[] {
  const left = new Map(reductions.map(d => [d, d.amount ?? 0]))
  return parts.map(part => {
    let amount = part.amount
    for (const [d, rest] of left) {
      if (rest <= 0 || amount <= 0 || !defenseCovers(d, part.damageType)) continue
      const taken = Math.min(rest, amount)
      left.set(d, rest - taken)
      const typeName = part.damageType ? ` em ${getDamageTypeName(part.damageType)}` : ''
      notices.push(note('resisted', `Redução de ${taken}${typeName} (${d.source}): ${amount} → ${amount - taken}.`))
      amount -= taken
    }
    return { ...part, amount }
  })
}

/**
 * As parcelas somadas por tipo: a resistência arredonda por tipo, somando antes as parcelas do mesmo
 * tipo (decisão de 2026-10-30, item 12). A parcela sem tipo ("Outro tipo") fica sozinha: o app não
 * sabe se duas sem tipo são do mesmo tipo, e quem separa o dano em parcelas separa dois tipos (a
 * tempestade de gelo: concussão e frio).
 */
function groupDamageParts(parts: DamagePart[]): DamagePart[] {
  const groups: DamagePart[] = []
  for (const part of parts) {
    const group = part.damageType ? groups.find(g => g.damageType === part.damageType) : undefined
    if (group) group.amount += part.amount
    else groups.push({ ...part })
  }
  return groups
}

/**
 * O dano depois das defesas (p. 199, decisões de 2026-10-30), com um aviso por passo que mudou algo:
 * 1. redução fixa (Maestria em Armadura Pesada), uma vez por evento, sobre as parcelas do tipo que
 *    ela alcança, da digitada primeiro para a seguinte (`applyDamageReductions`);
 * 2. imunidade, da ficha ou de condição: a parcela vira 0;
 * 3. resistência — a da ficha, a de condição, a marcada no painel e as condicionais confirmadas
 *    contam como uma só: metade, para baixo, sobre a soma das parcelas do mesmo tipo;
 * 4. vulnerabilidade, só sem resistência ao mesmo tipo (decisão 10): o dobro.
 * Depois soma os tipos.
 */
function applyDamageDefenses(input: DamageInput, defenses: SheetDamageDefense[], notices: PlayNotice[]): number {
  const active = defenses.filter(d => defenseApplies(d, input))
  const reduced = applyDamageReductions(getDamageParts(input), active.filter(d => d.kind === 'reduction'), notices)
  const results: number[] = []
  for (const { amount, damageType } of groupDamageParts(reduced)) {
    const typeName = damageType ? getDamageTypeName(damageType) : undefined
    const immune = damageType ? active.filter(d => d.kind === 'immunity' && defenseCovers(d, damageType)) : []
    if (damageType && immune.length > 0) {
      notices.push(note('resisted', `Imune a ${getDamageLabel(damageType)} (${sourcesOf(immune)}): o dano vira 0.`))
      results.push(0)
      continue
    }

    const resisted = active.filter(d => d.kind === 'resistance' && defenseCovers(d, damageType))
    const resistedBy = [...(input.resisted ? ['você marcou'] : []), ...new Set(resisted.map(d => d.source))]
    const vulnerable = damageType ? active.filter(d => d.kind === 'vulnerability' && defenseCovers(d, damageType)) : []
    let after = amount
    if (resistedBy.length > 0) {
      after = Math.floor(amount / 2)
      notices.push(note('resisted', `Resistência${typeName ? ` a ${typeName}` : ''} (${resistedBy.join(', ')}): ${amount} → ${after}.`))
      if (vulnerable.length > 0) {
        notices.push(note('info', `Vulnerabilidade a ${typeName} (${sourcesOf(vulnerable)}) junto da resistência: vale só a resistência.`))
      }
    } else if (vulnerable.length > 0) {
      after = amount * 2
      notices.push(note('warning', `Vulnerabilidade a ${typeName} (${sourcesOf(vulnerable)}): ${amount} → ${after}.`))
    }
    results.push(after)
  }
  const total = results.reduce((sum, n) => sum + n, 0)
  if (results.length > 1) notices.push(note('info', `Dano somado: ${results.join(' + ')} = ${total}.`))
  return total
}

/**
 * Um evento de dano (`regras-dano-e-morte.md`, "Ordem de aplicação de um dano recebido"): as
 * defesas da ficha e das condições, parcela por parcela (`applyDamageDefenses`: redução, imunidade,
 * resistência, vulnerabilidade; sem tipo informado, só a resistência a todo dano e a marcada); PV
 * temporários absorvem primeiro; consciente → 0 PV com morte instantânea pelo máximo EFETIVO
 * (assumido C), nocaute → estável; já a 0 PV → +1 fracasso (2 se crítico), mesmo se os temporários
 * absorvem tudo (decisão 5), e o estável volta a morrer (assumido D). Concentração: aviso de TR de
 * CON com CD max(10, ⌊total/2⌋), contando o absorvido (assumido E); 0 PV e morte a encerram
 * (assumido F).
 *
 * Quem cai a 0 PV sem morrer e tem a Resistência Implacável com uso recebe também o aviso
 * `dropToOneHp`, com o dano: a tela desfaz e reaplica por `applyDamageDroppingToOneHp`. Quem cai em
 * fúria com a Fúria Implacável recebe o `dropToOneHpSave`, com a CD do teste e o dano: quem passa, a
 * tela desfaz e reaplica por `applyDamageDroppingToOneHp(…, 'save')`; quem falha, por aqui, com
 * `zeroHpSaveFailed` no dano — a queda fica, e o uso conta (decisão de 2026-10-30).
 */
export function applyDamage(state0: PlayState, sheet: PlaySheet, input: DamageInput): PlayResult {
  return damagePipeline(state0, sheet, input, null)
}

/**
 * De onde vem o 1 PV: o traço que gasta um uso (a Resistência Implacável) ou o teste de resistência
 * em que o jogador passou (a Fúria Implacável).
 */
export type DropToOneHpBy = 'trait' | 'save'

/**
 * O mesmo evento de dano de `applyDamage`, terminando em 1 PV quando ele deixaria o personagem a 0
 * PV sem matar — sem cair inconsciente, sem o Caído e sem perder a concentração (o TR de
 * Constituição continua). Parte do estado ANTERIOR ao dano (a tela desfaz antes).
 * - `'trait'`: a Resistência Implacável (pág. 41), que gasta um uso do recurso;
 * - `'save'`: a Fúria Implacável (pág. 49), em fúria, com o teste em que o jogador passou: conta um
 *   uso (a próxima CD sobe 5), e a fúria continua, porque ele não caiu.
 * Se não se aplica (sem uso, fora da fúria, o dano não leva a 0 PV ou mata na hora), aplica o dano
 * normal e avisa — o dano nunca se perde.
 */
export function applyDamageDroppingToOneHp(
  state0: PlayState,
  sheet: PlaySheet,
  input: DamageInput,
  by: DropToOneHpBy = 'trait',
): PlayResult {
  return damagePipeline(state0, sheet, input, by)
}

function damagePipeline(state0: PlayState, sheet: PlaySheet, input: DamageInput, dropBy: DropToOneHpBy | null): PlayResult {
  const amounts = input.parts?.length ? input.parts.map(p => p.amount) : [input.amount]
  if (!amounts.every(Number.isFinite)) return refuse(state0, 'Valor de dano inválido.')
  if (state0.lifeState === 'dead') return refuse(state0, 'O personagem está morto: o dano não tem efeito.')
  const state = reconcilePlayState(state0, sheet)
  const notices: PlayNotice[] = []
  const total = applyDamageDefenses(input, getPlayDamageDefenses(state, sheet), notices)

  // Dano 0 não é dano (decisão de 2026-10-25, Ponto em aberto 19): sem fracasso a 0 PV e sem TR de
  // concentração.
  if (total === 0) {
    notices.push(note('info', 'Dano total 0: não conta como dano. Nada foi alterado.'))
    return done(state0, notices)
  }

  const sheetMax = getBaseMaxHp(state, sheet)
  const effMax = getEffectiveMaxHp(state, sheet)
  const absorbed = Math.min(state.tempHp, total)
  const rest = total - absorbed
  // Sofreu dano, mesmo o que os PV temporários absorveram: o fim prematuro da Fúria pergunta por ele.
  const next: PlayState = { ...state, tempHp: state.tempHp - absorbed, turn: { ...state.turn, afterTurn: true } }
  if (absorbed > 0) notices.push(note('tempHpAbsorbed', `Os PV temporários absorveram ${absorbed}.`))

  const drop = availableDropToOneHp(state, sheet)
  const zeroHpSave = availableZeroHpSave(state, sheet)
  let dropped = false
  let failedCounted = false
  if (state.lifeState === 'conscious') {
    const current = getCurrentHp(state, sheet)
    if (rest < current) {
      next.damageTaken = state.damageTaken + rest
    } else {
      const overflow = rest - current
      next.damageTaken = sheetMax
      // "Cada vez que você utilizar essa característica" (pág. 49): a falha no teste também é uso
      // (decisão de 2026-10-30), e a próxima CD sobe. O resto segue como sem o teste: a queda, ou a
      // Resistência Implacável, que o meio-orc ainda pode usar.
      if (overflow < effMax && input.zeroHpSaveFailed && zeroHpSave && dropBy !== 'save') {
        failedCounted = true
        const { save } = zeroHpSave
        const dc = getZeroHpSaveDc(state, save)
        next.restCounters = { ...next.restCounters, [save.counter]: (next.restCounters[save.counter] ?? 0) + 1 }
        notices.push(note('info', `${save.source}: não passou no teste de resistência de ${ABILITY_LABELS[save.ability].long} (CD ${dc}). A falha também conta como uso: a próxima CD é ${dc + save.dcStep} (pág. ${save.page}).`))
      }
      if (overflow >= effMax) {
        toDead(next, sheet, notices, `Morte instantânea: o dano que sobrou (${overflow}) é igual ou maior que o PV máximo (${effMax}) (pág. 199).`)
      } else if (dropBy === 'save' && zeroHpSave) {
        // "Se você for bem sucedido, você volta para 1 ponto de vida ao invés disso" (pág. 49): ele
        // não caiu, então nada do que a queda faz acontece, e a fúria continua.
        dropped = true
        const { toggle, save } = zeroHpSave
        const dc = getZeroHpSaveDc(state, save)
        next.damageTaken = sheetMax - 1
        next.restCounters = { ...next.restCounters, [save.counter]: (next.restCounters[save.counter] ?? 0) + 1 }
        notices.push(note('info', `${save.source}: passou no teste de resistência de ${ABILITY_LABELS[save.ability].long} (CD ${dc}) e ficou com 1 PV em vez de cair a 0; continua ${lowerFirst(toggle.label)}. A próxima CD é ${dc + save.dcStep} (pág. ${save.page}).`))
      } else if (dropBy === 'trait' && drop) {
        // "Reduzido a 0 pontos de vida mas não é completamente morto": volta para 1 PV (pág. 41).
        dropped = true
        next.damageTaken = sheetMax - 1
        const spent = next.resourcesSpent[drop.resourceId] ?? 0
        if (getResourceAvailable(state, sheet, drop.resourceId) !== 'unlimited') {
          next.resourcesSpent = { ...next.resourcesSpent, [drop.resourceId]: spent + 1 }
        }
        notices.push(note('info', `${drop.source}: em vez de cair a 0 PV, ficou com 1 PV (gastou 1 uso).`))
      } else {
        toZeroHp(next, sheet, notices, input.knockout ? 'stable' : 'dying')
        const fallDeath = describeFallDeath(state, next, sheet)
        if (drop) {
          notices.push({
            kind: 'dropToOneHp',
            text: `${drop.source}: em vez de cair a 0 PV, você pode ficar com 1 PV (gasta 1 uso).${fallDeath}`,
            damage: { ...input },
          })
        }
        // A fúria já acabou com a queda (toZeroHp); quem passa no teste não caiu, e a tela reaplica.
        // Quem já falhou nele não o faz de novo.
        if (zeroHpSave && !failedCounted) {
          const { toggle, save } = zeroHpSave
          const dc = getZeroHpSaveDc(state, save)
          notices.push({
            kind: 'dropToOneHpSave',
            text: `${save.source}: você caiu a 0 PV ${lowerFirst(toggle.label)}. Faça um teste de resistência de ${ABILITY_LABELS[save.ability].long} CD ${dc}: se passar, fica com 1 PV em vez disso e continua ${lowerFirst(toggle.label)} (pág. ${save.page}).${fallDeath}`,
            dc,
            damage: { ...input },
          })
        }
      }
    }
  } else if (rest >= effMax) {
    toDead(next, sheet, notices, `Morte instantânea: ${rest} de dano a 0 PV é igual ou maior que o PV máximo (${effMax}) (pág. 199).`)
  } else {
    const added = input.critical ? 2 : 1
    const failures = toCount(state.deathSaves.failures + added)
    next.deathSaves = { ...state.deathSaves, failures }
    if (state.lifeState === 'stable') {
      next.lifeState = 'dying'
      notices.push(note('lostStability', 'Sofreu dano estável: deixa de estar estável e volta aos testes contra a morte (pág. 200).'))
    }
    notices.push(note('deathSaveFailure', `${added === 2 ? '2 fracassos (crítico)' : '1 fracasso'} no teste contra a morte por sofrer dano a 0 PV: ${failures}/3.`))
    if (failures >= 3) toDead(next, sheet, notices, 'Três fracassos no teste contra a morte (pág. 199).')
  }
  // O 1 PV ou a falha no teste que não cabem neste dano: o dano vale como veio, e o aviso diz por quê.
  const missed: DropToOneHpBy | null = dropBy && !dropped ? dropBy
    : input.zeroHpSaveFailed && !failedCounted && dropBy !== 'save' ? 'save' : null
  if (missed) {
    const declared = sheet.toggles.find(t => t.zeroHpSave)
    const [source, need] = missed === 'trait'
      ? [sheet.dropToOneHp?.source ?? 'Ficar com 1 PV', 'com um uso disponível']
      : [declared?.zeroHpSave?.source ?? 'O teste para ficar com 1 PV', declared ? lowerFirst(declared.label) : 'com o efeito ligado']
    notices.push(note('warning', `${source} não se aplica a este dano: só quando ele deixaria você a 0 PV sem matar na hora, e ${need}. O dano foi aplicado normalmente.`))
  }

  checkConcentration(next, sheet, notices)
  if (next.concentration) {
    const dc = Math.max(10, Math.floor(total / 2))
    notices.push(note('concentrationCheck', `TR de Constituição para manter ${next.concentration.label} — CD ${dc}.`, dc))
  }
  return done(next, notices)
}

// ── Cura e PV temporários ───────────────────────────────────────────────────

/** Cura já com o estado reconciliado. Interna: também serve ao Dado de Vida. */
function heal(state: PlayState, sheet: PlaySheet, amount: number, notices: PlayNotice[]): PlayState {
  const value = Math.max(0, Math.floor(amount))
  const current = getCurrentHp(state, sheet)
  const effMax = getEffectiveMaxHp(state, sheet)
  const after = Math.max(current, Math.min(effMax, current + value))
  const next: PlayState = { ...state, damageTaken: getBaseMaxHp(state, sheet) - after }
  const lost = current + value - after
  notices.push(note('healed', `Recuperou ${after - current} PV (${current} → ${after})${lost > 0 ? `; ${lost} acima do máximo se perderam` : ''}.`))
  if (isAtZeroHp(state) && after > 0) toConscious(next, notices, { awake: 'Recuperou PV e acordou.', cause: 'Recuperou PV' })
  return next
}

/**
 * Cura (pág. 199): piso 0, teto no máximo efetivo (assumido C), excedente perdido. Morto não
 * recupera PV. A 0 PV, qualquer cura acorda e zera os contadores. Não toca os PV temporários.
 */
export function applyHealing(state0: PlayState, sheet: PlaySheet, amount: number): PlayResult {
  if (!Number.isFinite(amount)) return refuse(state0, 'Valor de cura inválido.')
  if (state0.lifeState === 'dead') {
    return refuse(state0, 'Uma criatura morta não recupera pontos de vida (pág. 199). Use "fui revivido".')
  }
  if (Math.floor(amount) <= 0) return done(state0)
  const notices: PlayNotice[] = []
  return done(heal(reconcilePlayState(state0, sheet), sheet, amount, notices), notices)
}

/** Sugestão de PV temporários quando já há alguns: o maior (a escolha é do jogador, pág. 200). */
export function suggestTempHpChoice(state: PlayState, amount: number): 'keep' | 'replace' {
  return state.tempHp >= amount ? 'keep' : 'replace'
}

/**
 * Ganha PV temporários (pág. 200): não se somam. Com temporários já presentes, o jogador decide
 * manter (`keep`) ou ficar com os novos (`replace`); sem a escolha, a função recusa e pergunta.
 * Não acordam nem estabilizam quem está a 0 PV. Morto recusa, como a cura: os PV temporários não
 * têm o que proteger.
 */
export function grantTempHp(state: PlayState, amount: number, choice?: 'keep' | 'replace'): PlayResult {
  if (!Number.isFinite(amount)) return refuse(state, 'Valor de PV temporários inválido.')
  if (state.lifeState === 'dead') {
    return refuse(state, 'O personagem está morto: PV temporários não têm efeito. Use "fui revivido".')
  }
  const value = Math.max(0, Math.floor(amount))
  if (value === 0) return done(state)
  if (state.tempHp > 0 && !choice) {
    return refuse(state, `Já tem ${state.tempHp} PV temporários: manter ${state.tempHp} ou ficar com ${value}? Eles não se somam (pág. 200).`)
  }
  const tempHp = state.tempHp > 0 && choice === 'keep' ? state.tempHp : value
  const notices = isAtZeroHp(state)
    ? [note('info', 'PV temporários não recuperam a consciência nem estabilizam (pág. 200).')]
    : []
  return done({ ...state, tempHp }, notices)
}

/**
 * Ajuste temporário do PV máximo (`maxHpAdjustment`), em `delta` sobre o atual. Zera no descanso
 * longo (`completeLongRest`); antes disso, quando o efeito acaba, a tela desfaz o ajuste com o
 * delta oposto.
 *
 * - Aumentar sobe o máximo e o atual juntos, como a magia Ajuda (pág. 215). A Exaustão 4 corta o
 *   máximo já somado ao ajuste (decisão do dono), e o atual nunca passa dele.
 * - Diminuir só corta o atual que passar do máximo novo: os PV atuais vão do máximo até 0
 *   (pág. 198).
 * - A 0 PV, só o máximo muda: o livro não diz se o atual que a Ajuda acrescenta conta como
 *   recuperar PV (acordar). O aviso manda registrar a cura, se a mesa decidir que conta.
 *
 * Recusa morto, valor inválido, máximo que ficaria abaixo de 1 (o que acontece depende do efeito)
 * e reduzir abaixo do máximo da ficha com a característica que o impede (Acostumado à Morte-Vida,
 * pág. 101).
 */
export function adjustMaxHp(state0: PlayState, sheet: PlaySheet, delta: number): PlayResult {
  if (!isInt(delta)) return refuse(state0, 'Ajuste do PV máximo inválido.')
  if (delta === 0) return done(state0)
  if (state0.lifeState === 'dead') {
    return refuse(state0, 'O personagem está morto: o ajuste do PV máximo não tem efeito. Use "fui revivido".')
  }
  const adjustment = state0.maxHpAdjustment + delta
  if (adjustment < 0 && sheet.hpMaxReductionImmunity) {
    return refuse(state0, `${sheet.hpMaxReductionImmunity}: seu máximo de pontos de vida não pode ser reduzido (pág. 101).`)
  }
  if (sheet.maxHp + adjustment < 1) {
    return refuse(state0, `O PV máximo ficaria em ${Math.max(0, sheet.maxHp + adjustment)}: o que acontece depende do efeito que o reduziu, e o livro não traz uma regra geral. Combine com o Mestre.`, 'unresolvedRule')
  }

  const state = reconcilePlayState(state0, sheet)
  const current = getCurrentHp(state, sheet)
  const maxBefore = getEffectiveMaxHp(state, sheet)
  const next: PlayState = { ...state, maxHpAdjustment: adjustment }
  const baseAfter = getBaseMaxHp(next, sheet)
  const maxAfter = getEffectiveMaxHp(next, sheet)
  const notices: PlayNotice[] = []
  const label = `Ajuste do PV máximo: ${formatHpAdjustment(adjustment)}`

  if (isAtZeroHp(state)) {
    next.damageTaken = baseAfter
    notices.push(note('info', `${label}. Máximo ${maxBefore} → ${maxAfter}; continua com 0 PV.`))
    if (delta > 0) {
      notices.push(note('unresolvedRule', 'A 0 PV, o livro não diz se o atual que o efeito acrescenta (Ajuda) conta como recuperar PV. Se a mesa decidir que conta, registre como cura.'))
    }
    return done(next, notices)
  }

  const raised = delta > 0 ? current + delta : current
  const currentAfter = Math.min(raised, maxAfter)
  if (currentAfter < 1) {
    // Máximo efetivo 0 com a Exaustão 4: o mesmo caso que `setExhaustion` recusa (Ponto em aberto 17).
    return refuse(state0, `Com a exaustão ${state.exhaustionLevel}, o PV máximo efetivo ficaria em ${maxAfter} e levaria a 0 PV sem dano: o livro não trata do caso.`, 'unresolvedRule')
  }
  next.damageTaken = baseAfter - currentAfter
  notices.push(note('info', `${label}. Máximo ${maxBefore} → ${maxAfter}; PV atual ${current} → ${currentAfter}.`))
  return done(next, notices)
}

/** Fim dos PV temporários antes do descanso longo (a característica que os deu tinha duração). */
export function clearTempHp(state: PlayState): PlayResult {
  return state.tempHp === 0 ? done(state) : done({ ...state, tempHp: 0 })
}

// ── Teste contra a morte, estabilizar, reviver ──────────────────────────────

export type DeathSaveInput = {
  /** O d20 que valeu (o mantido, depois de vantagem/desvantagem). */
  natural: number
  /** d20 + bônus que valem para todo teste de resistência. */
  total: number
}

/**
 * Registra um teste contra a morte (pág. 199; decisão 8): 1 natural = 2 fracassos; 20 natural =
 * recupera 1 PV e acorda; senão o TOTAL ≥ 10 é sucesso. 3 sucessos = estável; 3 fracassos = morto.
 * Só para quem está morrendo. A rolagem em si vai para o histórico por `recordRoll`.
 */
export function recordDeathSave(state0: PlayState, sheet: PlaySheet, input: DeathSaveInput): PlayResult {
  const { natural, total } = input
  if (!isInt(natural) || natural < 1 || natural > 20 || !isInt(total)) {
    return refuse(state0, 'Teste contra a morte inválido: informe o d20 natural (1 a 20) e o total.')
  }
  if (state0.lifeState !== 'dying') {
    return refuse(state0, 'Só quem está morrendo (0 PV, não estável) faz teste contra a morte.')
  }
  const state = reconcilePlayState(state0, sheet)
  const notices: PlayNotice[] = []
  const next: PlayState = { ...state }

  if (natural === 20) {
    next.damageTaken = Math.max(0, getBaseMaxHp(state, sheet) - 1)
    toConscious(next, notices, {
      awake: '20 natural no teste contra a morte: recupera 1 PV e acorda (pág. 199).',
      cause: '20 natural no teste contra a morte: recupera 1 PV (pág. 199)',
    })
    return done(next, notices)
  }

  let { successes, failures } = state.deathSaves
  if (natural === 1) {
    failures = toCount(failures + 2)
    notices.push(note('deathSaveFailure', `1 natural: conta como 2 fracassos (${failures}/3).`))
  } else if (total >= 10) {
    successes = toCount(successes + 1)
    notices.push(note('deathSaveSuccess', `Sucesso no teste contra a morte (${successes}/3).`))
  } else {
    failures = toCount(failures + 1)
    notices.push(note('deathSaveFailure', `Fracasso no teste contra a morte (${failures}/3).`))
  }
  next.deathSaves = { successes, failures }

  if (failures >= 3) {
    toDead(next, sheet, notices, 'Três fracassos no teste contra a morte (pág. 199).')
  } else if (successes >= 3) {
    next.lifeState = 'stable'
    next.deathSaves = { ...ZERO_SAVES }
    notices.push(note('stabilized', 'Três sucessos: estável. Continua inconsciente com 0 PV (pág. 199).'))
  }
  return done(next, notices)
}

/** Estabiliza quem está morrendo (Medicina CD 10, magia…): sem testes, contadores zerados. */
export function stabilize(state: PlayState): PlayResult {
  if (state.lifeState === 'stable') return done(state)
  if (state.lifeState !== 'dying') return refuse(state, 'Só quem está morrendo pode ser estabilizado.')
  return done(
    { ...state, lifeState: 'stable', deathSaves: { ...ZERO_SAVES } },
    [note('stabilized', 'Estável: não faz mais testes contra a morte, mas continua inconsciente (pág. 200).')],
  )
}

/**
 * Estável que ninguém curou: "recupera 1 ponto de vida depois de 1d4 horas" (pág. 200). O app não
 * conta o tempo do jogo: o jogador confirma que ele passou. Só para quem está estável; a cura de 1
 * PV acorda, como qualquer cura a 0 PV.
 */
export function regainHpWhileStable(state0: PlayState, sheet: PlaySheet): PlayResult {
  if (state0.lifeState !== 'stable') {
    return refuse(state0, 'Só quem está estável, com 0 PV, recupera 1 PV depois de 1d4 horas (pág. 200).')
  }
  const notices: PlayNotice[] = []
  return done(heal(reconcilePlayState(state0, sheet), sheet, 1, notices), notices)
}

/**
 * "Fui revivido" (decisão 13): de morto para consciente com 1 PV e contadores zerados. Com exaustão
 * 6 recusa: o que fazer com ela ao reviver não está decidido (`regras-dano-e-morte.md`, Ponto em
 * aberto 18) — o jogador baixa a exaustão antes, se a mesa assim decidir.
 */
export function revive(state0: PlayState, sheet: PlaySheet): PlayResult {
  if (state0.lifeState !== 'dead') return refuse(state0, 'O personagem não está morto.')
  if (state0.exhaustionLevel >= 6) {
    return refuse(state0, 'Com exaustão 6 a morte continua: o livro não diz o que acontece com a exaustão ao reviver. Ajuste o nível de exaustão antes.', 'unresolvedRule')
  }
  const state = reconcilePlayState(state0, sheet)
  const next: PlayState = { ...state, damageTaken: Math.max(0, getBaseMaxHp(state, sheet) - 1) }
  const notices: PlayNotice[] = []
  toConscious(next, notices, { awake: 'Revivido: consciente com 1 PV.', cause: 'Revivido com 1 PV' })
  return done(next, notices)
}

// ── Espaços de magia ────────────────────────────────────────────────────────

function validSpellLevel(level: number): boolean {
  return isInt(level) && level >= 1 && level <= SPELL_LEVELS
}

/** Gasta um espaço do pool combinado no nível dado (1 a 9). */
export function spendSpellSlot(state0: PlayState, sheet: PlaySheet, level: number): PlayResult {
  if (!validSpellLevel(level)) return refuse(state0, 'Nível de espaço inválido.')
  const state = reconcilePlayState(state0, sheet)
  if (getSpellSlotsAvailable(state, sheet)[level - 1] <= 0) {
    return refuse(state0, `Sem espaços de ${level}º nível disponíveis.`)
  }
  const spellSlotsSpent = [...state.spellSlotsSpent]
  spellSlotsSpent[level - 1] += 1
  return done({ ...state, spellSlotsSpent })
}

/** Devolve um espaço do pool (desfazer, Recuperação Arcana, Recuperação Natural). */
export function recoverSpellSlot(state0: PlayState, sheet: PlaySheet, level: number): PlayResult {
  if (!validSpellLevel(level)) return refuse(state0, 'Nível de espaço inválido.')
  const state = reconcilePlayState(state0, sheet)
  if (state.spellSlotsSpent[level - 1] <= 0) return refuse(state0, `Nenhum espaço de ${level}º nível gasto.`)
  const spellSlotsSpent = [...state.spellSlotsSpent]
  spellSlotsSpent[level - 1] -= 1
  return done({ ...state, spellSlotsSpent })
}

/** Gasta um espaço de Magia de Pacto. */
export function spendPactSlot(state0: PlayState, sheet: PlaySheet): PlayResult {
  const state = reconcilePlayState(state0, sheet)
  if (getPactSlotsAvailable(state, sheet) <= 0) return refuse(state0, 'Sem espaços de Pacto disponíveis.')
  return done({ ...state, pactSlotsSpent: state.pactSlotsSpent + 1 })
}

/** Devolve um espaço de Magia de Pacto. */
export function recoverPactSlot(state0: PlayState, sheet: PlaySheet): PlayResult {
  const state = reconcilePlayState(state0, sheet)
  if (state.pactSlotsSpent <= 0) return refuse(state0, 'Nenhum espaço de Pacto gasto.')
  return done({ ...state, pactSlotsSpent: state.pactSlotsSpent - 1 })
}

// ── Recursos ────────────────────────────────────────────────────────────────

function resourceChange(state0: PlayState, sheet: PlaySheet, id: string, delta: number): PlayResult {
  const r = sheet.resources.find(x => x.id === id)
  if (!r) return refuse(state0, `Recurso desconhecido: ${id}.`)
  if (r.uses === 'unlimited') return done(state0, [note('info', `${r.name}: usos ilimitados, nada a marcar.`)])
  if (r.uses === undefined) return refuse(state0, `${r.name} não tem usos contados.`)
  const state = reconcilePlayState(state0, sheet)
  const spent = state.resourcesSpent[id] ?? 0
  const after = spent + delta
  if (after > r.uses) return refuse(state0, `${r.name}: só restam ${r.uses - spent}.`)
  if (after < 0) return refuse(state0, `${r.name}: só ${countLabel(spent, 'gasto', 'gastos')} para recuperar.`)
  const resourcesSpent = { ...state.resourcesSpent }
  if (after === 0) delete resourcesSpent[id]
  else resourcesSpent[id] = after
  return done({ ...state, resourcesSpent })
}

/** Gasta `amount` usos (ou PV, pontos, dados) de um recurso pelo `id`. Ilimitado não rastreia. */
export function spendResource(state: PlayState, sheet: PlaySheet, id: string, amount = 1): PlayResult {
  if (!isInt(amount) || amount < 1) return refuse(state, 'Quantidade inválida.')
  return resourceChange(state, sheet, id, amount)
}

/** Devolve `amount` usos de um recurso (desfazer, efeitos que recuperam). */
export function recoverResource(state: PlayState, sheet: PlaySheet, id: string, amount = 1): PlayResult {
  if (!isInt(amount) || amount < 1) return refuse(state, 'Quantidade inválida.')
  return resourceChange(state, sheet, id, -amount)
}

// ── Efeitos ligados e ações ─────────────────────────────────────────────────

/** "Em fúria" → "em fúria", no meio da frase. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Quando os usos voltam, para o aviso de quem não tem mais nenhum. */
const RECHARGE_TEXT: Record<NonNullable<SheetResource['recharge']>, string> = {
  short: 'voltam num descanso curto ou longo',
  long: 'voltam num descanso longo',
  day: 'voltam uma vez por dia',
}

/**
 * O que a tela passa ao ligar: a opção escolhida (o Frenesi), o momento, para o `startedAt`, e se a
 * magia de concentração foi você que conjurou em si (`sustainedByConcentration`: começa a sua
 * concentração nela, e ela acaba junto com a concentração).
 */
export type ToggleOn = { option?: string; now: number; sustainedByConcentration?: true }

/** O nome como se digita: sem acento, sem maiúscula e sem espaço nas pontas ("bencao" é a Bênção). */
const comparableName = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

/**
 * A concentração já é na magia do efeito: pelo id, ou, na digitada sem id (a seção Concentração só
 * guarda o rótulo), pelo nome dela.
 */
function concentratesOn(concentration: Concentration, toggle: SheetToggle): boolean {
  if (!toggle.spellId) return false
  if (concentration.spellId) return concentration.spellId === toggle.spellId
  return comparableName(concentration.label) === comparableName(toggle.source)
}

/**
 * Tira um efeito ligado do rascunho `next` da operação, com o que vem quando ele acaba: o que o app
 * não aplica, em aviso (a letargia da Velocidade), e o que a opção custa (o Frenesi: um nível de
 * exaustão, pelo caminho do `setExhaustion`, com os avisos dele).
 *
 * A magia que você conjurou em si e sustentava (`sustainedByConcentration`) leva junto a
 * concentração nela, por qualquer caminho do fim — o "Já acabou", o descanso —, porque a
 * concentração dura no máximo o que a magia dura (pág. 205, linhas 18299-18302). A que acaba PELA
 * concentração já a encontra encerrada.
 */
function endToggleInto(next: PlayState, sheet: PlaySheet, id: string, notices: PlayNotice[]): void {
  const active = next.activeEffects.find(a => a.id === id)
  if (!active) return
  next.activeEffects = next.activeEffects.filter(a => a.id !== id)
  const toggle = sheet.toggles.find(t => t.id === id)
  if (toggle?.onEnd) notices.push(note('warning', `${toggle.source} acabou: ${toggle.onEnd.notice} (pág. ${toggle.page}).`))
  if (active.sustainedByConcentration && toggle?.spellId && next.concentration?.spellId === toggle.spellId) {
    endConcentrationInto(next, sheet, notices, `${toggle.source} acabou`)
  }
  const option = active.option ? toggle?.options.find(o => o.id === active.option) : undefined
  const exhaustion = option?.onEnd?.exhaustion ?? 0
  if (!option || exhaustion === 0) return
  const before = next.exhaustionLevel
  const r = setExhaustion(next, sheet, before + exhaustion)
  if (r.state.exhaustionLevel !== before) {
    notices.push(note('warning', `${option.label}: ao terminar, você sofre um nível de exaustão (${before} → ${r.state.exhaustionLevel}, pág. 292).`))
  }
  Object.assign(next, r.state)
  notices.push(...r.notices)
}

/**
 * Cair inconsciente encerra o que declara `endsOn: 'unconscious'` (a Fúria, pág. 48), com aviso; a
 * morte também (`toDead`), com o aviso dela. O Inconsciente incapacita (pág. 292): o que acaba
 * incapacitado (o Esquivar) acaba aqui também.
 */
function endTogglesOnUnconscious(next: PlayState, sheet: PlaySheet, notices: PlayNotice[], by: 'unconscious' | 'death' = 'unconscious'): void {
  for (const toggle of sheet.toggles) {
    const ends = toggle.endsOn.includes('unconscious') || toggle.endsOn.includes('incapacitated')
    if (!ends || !next.activeEffects.some(a => a.id === toggle.id)) continue
    notices.push(note('info', by === 'death'
      ? `${toggle.source}: terminou com a morte.`
      : `${toggle.source}: terminou ao cair inconsciente (pág. ${toggle.page}).`))
    endToggleInto(next, sheet, toggle.id, notices)
  }
}

/**
 * Ficar incapacitado (gravado ou derivado: Atordoado, Paralisado) ou com o deslocamento em 0
 * (Agarrado, Exaustão 5) encerra o que declara `endsOn` 'incapacitated' e 'speedZero' (o Esquivar,
 * pág. 194: "Você perde esse benefício"), com aviso. O Inconsciente vai por `endTogglesOnUnconscious`.
 */
function endTogglesOnState(next: PlayState, sheet: PlaySheet, notices: PlayNotice[]): void {
  const fx = getPlayEffects(next, sheet)
  const incapacitated = fx.conditions.find(c => c.id === 'incapacitated' && !isConditionSuspended(c))
  const stopped = getPlaySpeed(next, sheet) === 0
  for (const toggle of sheet.toggles) {
    if (!next.activeEffects.some(a => a.id === toggle.id)) continue
    const why = incapacitated && toggle.endsOn.includes('incapacitated')
      ? `você está incapacitado (${incapacitated.direct ? incapacitated.name : getCondition(incapacitated.impliedBy[0])?.name ?? incapacitated.name})`
      : stopped && toggle.endsOn.includes('speedZero') ? 'seu deslocamento caiu para 0' : null
    if (!why) continue
    notices.push(note('info', `${toggle.source}: terminou, ${why} (pág. ${toggle.page}).`))
    endToggleInto(next, sheet, toggle.id, notices)
  }
}

/**
 * O começo do descanso: os efeitos que declaram acabar nele (`endsOn` 'shortRest'/'longRest': a
 * Fúria, de 1 minuto, num descanso de pelo menos 1 hora, pág. 48 e 188) terminam, com aviso e com o
 * que a opção custa ao acabar (o Frenesi: um nível de exaustão) — ANTES do que o descanso devolve,
 * porque acabaram no começo dele: a exaustão do Frenesi vem antes do −1 do descanso longo, e os
 * Dados de Vida do curto, gastos no fim (pág. 188), já veem o PV máximo depois dela. A magia que
 * você sustentava (a sua Bênção) acaba com a concentração nela, com o aviso (`endToggleInto`).
 *
 * O descanso não dá benefícios a quem morre: se o fim leva à exaustão 6 (pág. 292), recusa e diz
 * para encerrar o efeito antes, na seção Efeitos ativos. Sem efeito a encerrar, devolve o estado
 * reconciliado e nenhum aviso; morto também, porque não descansa. As prévias e as duas conclusões
 * passam por aqui.
 */
export function endTogglesOnRest(state0: PlayState, sheet: PlaySheet, rest: 'shortRest' | 'longRest'): PlayResult {
  const state = reconcilePlayState(state0, sheet)
  if (state.lifeState === 'dead') return done(state)
  const next: PlayState = { ...state }
  const notices: PlayNotice[] = []
  for (const toggle of sheet.toggles) {
    if (!toggle.endsOn.includes(rest) || !next.activeEffects.some(a => a.id === toggle.id)) continue
    notices.push(note('info', `${toggle.source}: acaba durante o descanso (pág. ${toggle.page}).`))
    endToggleInto(next, sheet, toggle.id, notices)
  }
  if (next.lifeState === 'dead') {
    return refuse(state0, `${notices.map(n => n.text).join(' ')} O descanso não dá benefícios a quem morre: se for o caso, encerre o efeito antes, na seção Efeitos ativos.`)
  }
  return done(next, notices)
}

/**
 * O que se perde "se seu deslocamento cair para 0" (o Esquivar, pág. 194) não dá o benefício a quem
 * já está com ele em 0 (o Agarrado, o Impedido, a Exaustão 5; decisão de 2026-10-30, Ponto em aberto 4
 * de `regras-acoes-em-combate.md`): ligado, ele acabaria na hora. A frase com a regra, ou null quando
 * o efeito pode ligar.
 */
function describeSpeedZeroBlock(state: PlayState, sheet: PlaySheet, toggle: SheetToggle): string | null {
  if (!toggle.endsOn.includes('speedZero') || getPlaySpeed(state, sheet) !== 0) return null
  return `${toggle.source} sem o benefício: seu deslocamento está em 0, e o benefício se perde com o deslocamento em 0 (pág. ${toggle.page}).`
}

/**
 * Liga um efeito (em fúria), sem custo: quem paga é a ação que liga (`performAction`), e o efeito
 * recebido de um aliado liga de graça. Recusa morto, o efeito já ligado (a mesma magia não acumula,
 * pág. 207) e a opção que a ficha não tem; o da ficha, também inconsciente. A magia recebida, não:
 * o app só registra o que a mesa já fez, e a Bênção num aliado a 0 PV vale nos testes contra a morte. Os efeitos colaterais vêm com aviso,
 * no mesmo passo do desfazer: a restrição em vigor encerra a concentração (decisão (e), pág. 48),
 * as condições de que agora você está imune ficam suspensas, e de armadura pesada o efeito liga sem
 * os benefícios (pág. 48).
 */
export function activateToggle(state0: PlayState, sheet: PlaySheet, id: string, on: ToggleOn): PlayResult {
  const { option, now } = on
  const toggle = sheet.toggles.find(t => t.id === id)
  if (!toggle) return refuse(state0, `Efeito desconhecido: ${id}.`)
  if (state0.lifeState === 'dead') return refuse(state0, `${toggle.label}: o personagem está morto.`)
  if (!toggle.spellId && getPlayConditionState(state0).conditions.includes('unconscious')) {
    return refuse(state0, `${toggle.label}: o personagem está inconsciente.`)
  }
  if (state0.activeEffects.some(a => a.id === id)) return refuse(state0, `Já está ${lowerFirst(toggle.label)}.`)
  if (option && !toggle.options.some(o => o.id === option)) return refuse(state0, `${toggle.label}: opção desconhecida (${option}).`)
  const speedZero = describeSpeedZeroBlock(state0, sheet, toggle)
  if (speedZero) return refuse(state0, speedZero)
  // A de alcance Pessoal com concentração (o Auxílio Divino) é sempre sua: quem conjura sustenta.
  const sustained = toggle.concentration && (on.sustainedByConcentration || toggle.selfOnly)

  let state = reconcilePlayState(state0, sheet)
  const notices: PlayNotice[] = []
  const current = state.concentration
  if (sustained && current && concentratesOn(current, toggle)) {
    // Já concentrado nela — começada pela magia, ou digitada com o nome dela na seção Concentração
    // ("Bênção") —, a concentração é a mesma: ganha o id da magia, sem aviso nem novo começo.
    if (!current.spellId && toggle.spellId) state = { ...state, concentration: { ...current, spellId: toggle.spellId } }
  } else if (sustained) {
    // Começar a concentração recusa como sempre (inconsciente, incapacitado, em fúria), e a de
    // antes termina, com o que ela sustentava.
    const r = startConcentration(state, sheet, { ...(toggle.spellId ? { spellId: toggle.spellId } : {}), label: toggle.source }, now)
    const refused = r.notices.find(n => n.kind === 'refused')
    if (refused) return refuse(state0, refused.text)
    state = r.state
    notices.push(...r.notices)
  }
  const next: PlayState = {
    ...state,
    activeEffects: [...state.activeEffects, { id, startedAt: now, ...(option ? { option } : {}), ...(sustained ? { sustainedByConcentration: true as const } : {}) }],
  }
  const resolved = getPlayToggles(next, sheet).find(t => t.id === id)
  if (resolved?.blockedBy) {
    notices.push(note('warning', `${toggle.source} sem os benefícios: você está de ${resolved.blockedBy} (pág. ${toggle.page}).`))
  }
  if (resolved?.effects.some(e => e.effect.kind === 'endsConcentration')) {
    endConcentrationInto(next, sheet, notices, `entrar ${lowerFirst(toggle.label)} (pág. ${toggle.page})`)
  }
  const wasSuspended = new Set(getPlayEffects(state, sheet).conditions.filter(c => c.immuneBy).map(c => c.id))
  for (const c of getPlayEffects(next, sheet).conditions) {
    if (c.immuneBy && !wasSuspended.has(c.id)) {
      notices.push(note('info', `${c.name} fica suspenso: você está imune (${c.immuneBy.join(', ')}).`))
    }
  }
  return done(next, notices)
}

/**
 * Desliga um efeito ligado, com o que a opção dele custa ao acabar (o Frenesi: +1 de exaustão). A
 * magia que você conjurou em si e sustentava acabou: a concentração nela também (`endToggleInto`).
 */
export function deactivateToggle(state0: PlayState, sheet: PlaySheet, id: string): PlayResult {
  const toggle = sheet.toggles.find(t => t.id === id)
  if (!state0.activeEffects.some(a => a.id === id)) {
    return refuse(state0, toggle ? `Não está ${lowerFirst(toggle.label)}.` : `Efeito desconhecido: ${id}.`)
  }
  const next: PlayState = { ...reconcilePlayState(state0, sheet) }
  const notices: PlayNotice[] = []
  endToggleInto(next, sheet, id, notices)
  return done(next, notices)
}

// ── O turno ─────────────────────────────────────────────────────────────────

/**
 * A casa do checklist que cada momento marca; livre e especial não marcam nenhuma. O movimento
 * também não: o levantar-se gasta só metade do deslocamento (`standUp`), e a casa do movimento é
 * o jogador que marca ao andar.
 */
const TURN_SLOT_OF: Partial<Record<ActionTiming, TurnSlot>> = {
  action: 'action', bonusAction: 'bonusAction', reaction: 'reaction',
}

/** A ação a mais de cada turno que um efeito ligado dá (a Velocidade, pág. 289): para quais ações, e de quem. */
type ExtraTurnAction = { actions: string[]; source: string; page: number }

function getExtraTurnAction(state: PlayState, sheet: PlaySheet): ExtraTurnAction | null {
  for (const t of getPlayToggles(state, sheet)) {
    for (const { effect } of t.effects) {
      if (effect.kind === 'extraTurnAction') return { actions: effect.actions, source: t.source, page: t.page }
    }
  }
  return null
}

/**
 * As ações a mais ainda por usar neste turno: as do Surto de Ação e a de cada turno de um efeito
 * ligado (a Velocidade), enquanto não usada. O "+1" da casa da ação no checklist.
 */
export function getTurnExtraActions(state: PlayState, sheet: PlaySheet): number {
  const perTurn = getExtraTurnAction(state, sheet) && !state.turn.extraTurnActionUsed ? 1 : 0
  return state.turn.extraActions + perTurn
}

/**
 * Marca no turno o que a ação usou: o id dela (`used`) e a casa do momento. O que já foi usado só
 * avisa — o app não sabe se a mesa já passou ao turno seguinte sem o Novo turno, e o checklist nunca
 * impede de jogar —, e a ação que vem depois de outra (a outra mão, depois de Atacar) também só
 * avisa sem ela. A ação a mais do Surto de Ação cobre a segunda ação, sem aviso; a de cada turno da
 * Velocidade também, quando ela ou a ação já feita no turno é uma das que essa ação a mais aceita.
 *
 * Quem marca é uma ação da ficha ou a magia conjurada pelo grimório (`castSpell`): a de 1 ação vem
 * como Conjurar uma Magia, com o nome dela; a de ação bônus e a de reação, sem id, não entram em
 * `used` — não são uma ação da aba.
 */
type TurnUse = Pick<SheetAction, 'name' | 'timing' | 'page' | 'oncePerTurn' | 'afterAction'> & { id?: string }

function spendTurn(turn: TurnState, action: TurnUse, sheet: PlaySheet, extraTurn: ExtraTurnAction | null, notices: PlayNotice[]): TurnState {
  if (action.oncePerTurn && action.id && turn.used.includes(action.id)) {
    notices.push(note('warning', `${action.name}: só uma vez por turno, e já foi usada neste (pág. ${action.page}).`))
  }
  if (action.afterAction && !turn.used.includes(action.afterAction)) {
    const before = sheet.actions.find(a => a.id === action.afterAction)?.name ?? action.afterAction
    notices.push(note('warning', `${action.name}: pede a ação de ${before} antes, no mesmo turno, e ela não foi usada neste (pág. ${action.page}).`))
  }
  const next = !action.id || turn.used.includes(action.id) ? turn : { ...turn, used: [...turn.used, action.id] }
  const slot = TURN_SLOT_OF[action.timing]
  if (!slot) return next
  if (slot === 'action' && next.action) {
    if (next.extraActions > 0) return { ...next, extraActions: next.extraActions - 1 }
    // Qualquer das duas pode ser a da Velocidade: a de agora, ou uma de ação já feita no turno.
    const fits = (id: string) => extraTurn?.actions.includes(id) ?? false
    const doneBefore = turn.used.filter(id => sheet.actions.find(a => a.id === id)?.timing === 'action')
    if (extraTurn && !next.extraTurnActionUsed && ((action.id !== undefined && fits(action.id)) || doneBefore.some(fits))) {
      return { ...next, extraTurnActionUsed: true }
    }
    const names = joinPt((extraTurn?.actions ?? []).map(id => sheet.actions.find(a => a.id === id)?.name ?? id))
    const why = !extraTurn ? ''
      : next.extraTurnActionUsed ? `, e também a ação a mais de ${extraTurn.source}`
        : `, e a ação a mais de ${extraTurn.source} só serve para ${names} (pág. ${extraTurn.page})`
    notices.push(note('warning', `${action.name}: você já usou a ação deste turno (pág. 191)${why}. Se já é outro turno, toque em Novo turno.`))
  } else if (slot === 'bonusAction' && next.bonusAction) {
    notices.push(note('warning', `${action.name}: você já usou a ação bônus deste turno, e só há uma por turno (pág. 191).`))
  } else if (slot === 'reaction' && next.reaction) {
    notices.push(note('warning', `${action.name}: você já usou a sua reação, e ela só volta no início do seu próximo turno (pág. 192).`))
  }
  return { ...next, [slot]: true }
}

/**
 * Por que não se conjura agora, um motivo por fonte: a restrição de um efeito ligado ("Em fúria você
 * não pode conjurar magias", pág. 48) e a armadura vestida sem proficiência (pág. 144). Vazio,
 * conjura. A ação de conjurar (`requires: 'spellcaster'`) some da aba (`getTurnActions`) e o "Usar"
 * dela recusa com eles (`performAction`).
 */
export function getCastingBlockers(state: PlayState, sheet: PlaySheet): string[] {
  const toggles = getPlayToggles(state, sheet)
    .filter(t => t.effects.some(e => e.effect.kind === 'cannotCast'))
    .map(t => `${t.label} você não pode conjurar magias (pág. ${t.page}).`)
  const armor = sheet.unproficientArmor.length > 0 ? [describeUnproficientArmorCasting(sheet.unproficientArmor)] : []
  return [...toggles, ...armor]
}

/**
 * As ações que valem agora, na ordem da ficha: some a que pede um efeito ligado que não está
 * (encerrar a fúria fora dela), a que liga o que já está ligado (entrar em fúria em fúria, Esquivar
 * esquivando), a que pede estar Caído (Levantar-se) e a de conjurar quando não se pode
 * (`getCastingBlockers`: em fúria, de armadura sem proficiência). As condições da ficha (duas armas
 * leves, ser capaz de conjurar) já vêm cumpridas de `getSheetActions`.
 */
export function getTurnActions(state: PlayState, sheet: PlaySheet): SheetAction[] {
  const on = (id: string) => state.activeEffects.some(a => a.id === id)
  const castingBlocked = getCastingBlockers(state, sheet).length > 0
  return sheet.actions.filter(action => {
    if (action.requiresToggle && !on(action.requiresToggle)) return false
    if (action.requires === 'prone' && !state.conditions.includes('prone')) return false
    if (action.requires === 'spellcaster' && castingBlocked) return false
    return !(action.outcomes ?? []).some(o => o.kind === 'toggleOn' && on(o.toggle))
  })
}

/**
 * O deslocamento que resta no turno, em pés: o de agora (`getPlaySpeed`, com os efeitos e as
 * condições) uma vez mais por Disparada — o aumento é o deslocamento depois de qualquer modificador
 * (pág. 194), e com ele em 0 a Disparada dá 0 —, menos o que o app viu gastar (levantar-se, pág.
 * 192). O andar o app não conta: é a casa do movimento.
 */
export function getTurnMovement(state: PlayState, sheet: PlaySheet): number {
  return Math.max(0, getPlaySpeed(state, sheet) * (1 + state.turn.dashes) - state.turn.movementSpent)
}

/**
 * Marca ou desmarca uma casa do checklist à mão: o toque que corrige o que o "Usar" marcou, ou marca
 * o que se fez sem ele (mover-se, conjurar pela aba Magia).
 */
export function markTurn(state: PlayState, slot: TurnSlot, used: boolean): PlayResult {
  if (state.turn[slot] === used) return done(state)
  return done({ ...state, turn: { ...state.turn, [slot]: used } })
}

/**
 * O Novo turno, no início do seu turno: a ação, a ação bônus, o movimento e a reação voltam (a
 * reação volta no início do SEU turno, pág. 192), e o que dura "até o início do seu próximo turno"
 * acaba (o Escudo Arcano, o Esquivar), com aviso. Os efeitos que duram mais seguem ligados.
 *
 * O fim prematuro (a Fúria) olha o fim do turno que acabou e "desde o seu último turno" (pág. 48):
 * o ataque no seu turno (`attacked`) e o dano ou o ataque de reação entre o fim do seu turno anterior
 * e o começo dele (`beforeTurn`). O dano e a reação depois do Novo turno o app conta como vindos
 * depois do seu turno: vão para o próximo (`afterTurn` vira `beforeTurn`). Sem nada disso, lembra o
 * fim, sem desligar — o app não vê a mesa, e o jogador marca o "Já acabou". Sem esse lembrete quem o
 * tira (a Fúria Persistente).
 */
export function newTurn(state0: PlayState, sheet: PlaySheet): PlayResult {
  const state = reconcilePlayState(state0, sheet)
  const next: PlayState = { ...state, turn: { ...emptyTurn(), beforeTurn: state.turn.afterTurn } }
  const notices: PlayNotice[] = [note('info', 'Novo turno: a ação, a ação bônus, o movimento e a reação estão de volta.')]
  for (const toggle of sheet.toggles) {
    if (!state.activeEffects.some(a => a.id === toggle.id)) continue
    if (toggle.earlyEndReminder && !state.turn.attacked && !state.turn.beforeTurn) {
      notices.push(note('warning', `${toggle.source}: nenhum ataque nem dano registrados entre o fim do seu turno anterior e o fim do último. ${toggle.earlyEndReminder} O app conta o dano como vindo depois do seu turno: se você sofreu dano durante o último, ela continua. Se ela acabou, toque em “Já acabou” em Efeitos ativos, na aba Estado.`))
    }
    if (toggle.endsOn.includes('startOfYourTurn')) {
      notices.push(note('info', `${toggle.source}: terminou no início do seu turno (pág. ${toggle.page}).`))
      endToggleInto(next, sheet, toggle.id, notices)
    }
  }
  return done(next, notices)
}

/**
 * Usa uma ação da ficha (`sheet.actions`): confere e gasta o custo, aplica o que ela causa (liga ou
 * desliga o efeito, a ação a mais do Surto de Ação, a Disparada, o ataque, o levantar-se) e marca o
 * turno (`spendTurn`), tudo num passo só do desfazer. Recusa morto, quem não pode agir (Incapacitado,
 * pág. 292; o levantar-se, que é movimento, fica com o deslocamento), a ação que pede um efeito
 * ligado que não está, e o custo sem usos — sem gastar nada. O que a ação liga recusa como
 * `activateToggle` (já em fúria), também sem gastar; o Esquivar com o deslocamento já em 0 conta a
 * ação, sem o benefício, que não liga (pág. 194). O momento já usado no turno só avisa.
 */
export function performAction(state0: PlayState, sheet: PlaySheet, actionId: string, on: ToggleOn): PlayResult {
  const action = sheet.actions.find(a => a.id === actionId)
  if (!action) return refuse(state0, `Ação desconhecida: ${actionId}.`)
  if (state0.lifeState === 'dead') return refuse(state0, `${action.name}: o personagem está morto.`)
  // Levantar-se é movimento, não ação (pág. 192): quem decide é o deslocamento (`standUp`), como no
  // "Levantar" da condição Caído.
  const noActions = getPlayEffects(state0, sheet).noActions
  if (noActions.active && action.timing !== 'movement') {
    return refuse(state0, `${action.name}: ${noActions.sources.map(s => s.label).join(', ')}, sem ações nem reações (pág. 292).`)
  }
  if (action.requiresToggle && !state0.activeEffects.some(a => a.id === action.requiresToggle)) {
    const toggle = sheet.toggles.find(t => t.id === action.requiresToggle)
    return refuse(state0, `${action.name}: só ${toggle ? lowerFirst(toggle.label) : 'com o efeito ligado'}.`)
  }
  const castingBlockers = action.requires === 'spellcaster' ? getCastingBlockers(state0, sheet) : []
  if (castingBlockers.length > 0) return refuse(state0, `${action.name}: ${castingBlockers.join(' ')}`)

  let next = reconcilePlayState(state0, sheet)
  const notices: PlayNotice[] = []
  for (const cost of action.cost ?? []) {
    const r = sheet.resources.find(x => x.id === cost.resource)
    const available = getResourceAvailable(next, sheet, cost.resource)
    if (!r || available === null) return refuse(state0, `${action.name}: recurso desconhecido (${cost.resource}).`)
    if (available === 'unlimited') continue
    if (available < cost.amount) {
      const back = r.recharge ? `: eles ${RECHARGE_TEXT[r.recharge]}` : ''
      return refuse(state0, `${action.name}: sem usos de ${r.name}${back}.`)
    }
    next = { ...next, resourcesSpent: { ...next.resourcesSpent, [r.id]: (next.resourcesSpent[r.id] ?? 0) + cost.amount } }
  }
  for (const outcome of action.outcomes ?? []) {
    if (outcome.kind === 'extraAction') {
      next = { ...next, turn: { ...next.turn, extraActions: next.turn.extraActions + 1 } }
      notices.push(note('info', `${action.name}: mais uma ação neste turno, além da sua ação e da possível ação bônus (pág. ${action.page}).`))
      continue
    }
    if (outcome.kind === 'dash') {
      next = { ...next, turn: { ...next.turn, dashes: next.turn.dashes + 1 } }
      continue
    }
    if (outcome.kind === 'attack') {
      // O ataque de reação (o de oportunidade) vem no turno de outra criatura, depois do seu: conta
      // para o fim do seu próximo turno, como o dano (`TurnState.afterTurn`).
      next = { ...next, turn: action.timing === 'reaction' ? { ...next.turn, afterTurn: true } : { ...next.turn, attacked: true } }
      continue
    }
    // O Esquivar com o deslocamento já em 0: a ação foi feita, então gasta e marca o turno, mas o
    // benefício não vem (decisão de 2026-10-30), e o aviso diz a regra.
    const toggled = outcome.kind === 'toggleOn' ? sheet.toggles.find(t => t.id === outcome.toggle) : undefined
    const speedZero = toggled ? describeSpeedZeroBlock(next, sheet, toggled) : null
    if (speedZero) {
      notices.push(note('warning', `${speedZero} A ação conta.`))
      continue
    }
    const r = outcome.kind === 'toggleOn' ? activateToggle(next, sheet, outcome.toggle, on)
      : outcome.kind === 'toggleOff' ? deactivateToggle(next, sheet, outcome.toggle)
        : standUp(next, sheet)
    // A recusa volta ao estado de antes, sem gastar nada.
    const refused = r.notices.find(n => n.kind === 'refused')
    if (refused) return refuse(state0, refused.text)
    next = r.state
    notices.push(...r.notices)
  }
  next = { ...next, turn: spendTurn(next.turn, action, sheet, getExtraTurnAction(next, sheet), notices) }
  return done(next, notices)
}

// ── Conjurar pelo grimório ──────────────────────────────────────────────────

/** Os tempos de conjuração que o turno lembra (`SpellCastRecord.timing`). */
const CASTING_TIME_KINDS: readonly CastingTimeKind[] = ['action', 'bonusAction', 'reaction', 'longer']

/** A ação em combate pela qual a magia de 1 ação sai (pág. 194): é ela que o turno marca. */
const CAST_A_SPELL = 'cast-a-spell'

/**
 * Um jeito de pagar uma magia do grimório agora: o nível em que ela sai e o que resta dele (null: o
 * que não se conta, o truque e o ritual).
 */
export type SpellCastOption = { pay: SpellPayment; castLevel: number; available: number | 'unlimited' | null }

/**
 * Os jeitos de conjurar uma magia do grimório agora (`PlaySheet.spellbook`), na ordem da folha: sem
 * gastar (o truque, a inata), os espaços do pool do nível dela para cima, o de Pacto, o uso do
 * talento e, por último, o ritual, que não gasta e por isso não sobe de nível (pág. 204). Vazio para
 * a magia fora do grimório. O `castSpell` confere a escolha por aqui: uma regra só.
 */
export function getSpellCastOptions(state0: PlayState, sheet: PlaySheet, casterKey: string, spellId: string): SpellCastOption[] {
  const found = findSpellbookEntry(sheet.spellbook, casterKey, spellId)
  const spell = getSpell(spellId)
  if (!found || !spell) return []
  const { entry } = found
  const state = reconcilePlayState(state0, sheet)
  const slots = getSpellSlotsAvailable(state, sheet)
  const own = entry.castLevel ?? spell.level
  return [
    ...(entry.free ? [{ pay: 'free' as const, castLevel: own, available: null }] : []),
    ...entry.slotLevels.map(level => ({ pay: 'slot' as const, castLevel: level, available: slots[level - 1] ?? 0 })),
    ...(entry.pactLevel !== null ? [{ pay: 'pact' as const, castLevel: entry.pactLevel, available: getPactSlotsAvailable(state, sheet) }] : []),
    ...(entry.resourceId
      ? [{ pay: 'resource' as const, castLevel: own, available: getResourceAvailable(state, sheet, entry.resourceId) ?? 0 }]
      : []),
    ...(entry.ritual ? [{ pay: 'ritual' as const, castLevel: spell.level, available: null }] : []),
  ]
}

/**
 * O efeito que a magia liga em quem a recebe, do catálogo (`data/active-effects.json`): pelo
 * `targetEffect` do dano estruturado, quando ele o diz, ou pela magia da declaração (`spellId`) — o
 * Escudo Arcano, a Bênção, a Armadura Arcana. Undefined: ela não tem efeito marcado em você.
 */
export function getSpellSelfToggle(sheet: PlaySheet, spellId: string): SheetToggle | undefined {
  const target = getSpellMechanics(spellId)?.targetEffect
  return sheet.toggles.find(t => (target ? t.id === target : t.spellId === spellId))
}

/**
 * O que a mesa rolou para você, quando o alvo da magia é você: a cura, os PV temporários (com a
 * escolha de manter ou ficar com os novos, se já houver alguns: eles não se somam, pág. 200) e o
 * aumento do PV máximo (a Ajuda, pág. 215).
 */
export type SelfSpellResult = { heal?: number; tempHp?: number; tempHpChoice?: 'keep' | 'replace'; maxHpIncrease?: number }

export type SpellCast = {
  /** A conjuração do grimório: 'class:<classe>', 'feat:<talento>' ou 'other'. */
  casterKey: string
  spellId: string
  /** O nível em que ela sai: o do espaço escolhido, o de Pacto, o que a fonte fixa; o dela no truque e no ritual. */
  castLevel: number
  pay: SpellPayment
  /** O momento, para o começo da concentração e do efeito ligado. */
  now: number
  /** O alvo é você: o efeito da magia liga em você, e o que a mesa rolou se aplica. */
  self?: SelfSpellResult
}

/** O truque de 1 ação: a única outra magia do turno da magia de ação bônus (pág. 204). */
const fitsWithBonusSpell = (r: SpellCastRecord) => r.level === 0 && r.timing === 'action'

/**
 * A magia de ação bônus (pág. 204, linhas 18204-18210): no turno em que se conjura uma, a única outra
 * magia possível é um truque de 1 ação, e o turno inteiro conta, antes ou depois dela (decisão de
 * 2026-10-30, pelo esclarecimento oficial; Ponto em aberto 2 de `regras-conjuracao.md`). Só avisa: o
 * app não sabe se a mesa já passou a outro turno. A de reação no turno de outra criatura é outro
 * turno, e o app também não sabe de quem é o turno: o aviso diz isso.
 */
function describeBonusActionSpellRule(before: readonly SpellCastRecord[], cast: SpellCastRecord): string | null {
  const bonus = cast.timing === 'bonusAction' ? cast : before.find(r => r.timing === 'bonusAction')
  if (!bonus) return null
  const others = cast === bonus ? before.filter(r => !fitsWithBonusSpell(r)) : fitsWithBonusSpell(cast) ? [] : [cast]
  if (others.length === 0) return null
  const name = (r: SpellCastRecord) => getSpell(r.spellId)?.name ?? r.spellId
  const own = [...new Set(others.filter(r => r.timing !== 'reaction').map(name))]
  const reactions = [...new Set(others.filter(r => r.timing === 'reaction').map(name))]
  return [
    `${name(bonus)} é de ação bônus: no turno dela, a única outra magia possível é um truque de 1 ação, antes ou depois dela (pág. 204).`,
    ...(own.length > 0 ? [`${joinPt(own)} ${own.length === 1 ? 'não é' : 'não são'}.`] : []),
    ...(reactions.length > 0
      ? [`${joinPt(reactions)}, de reação, só ${reactions.length === 1 ? 'entra' : 'entram'} nessa regra no seu turno: no de outra criatura, vale.`]
      : []),
    'Se já é outro turno, toque em Novo turno.',
  ].join(' ')
}

/** Por que o jeito de pagar escolhido não serve a esta magia. */
function describeUnavailablePay(spell: Spell, entry: SpellbookEntry, cast: SpellCast): string {
  if (spell.level === 0 && cast.pay !== 'free') return `${spell.name} é truque: não gasta espaço nem sobe de nível (pág. 203).`
  switch (cast.pay) {
    case 'slot':
      if (cast.castLevel < spell.level) return `${spell.name} é de ${spell.level}º nível: o espaço precisa ser desse nível ou maior (pág. 201).`
      return entry.slotLevels.length === 0
        ? `${spell.name}: os espaços de magia não servem a ela.`
        : `${spell.name}: a ficha não tem espaço de ${cast.castLevel}º nível para ela.`
    case 'pact':
      return entry.pactLevel === null
        ? `${spell.name}: os espaços de Pacto não servem a ela.`
        : `${spell.name}: o espaço de Pacto é de ${entry.pactLevel}º nível.`
    case 'resource':
      return `${spell.name}: não sai pelo uso de um recurso.`
    case 'ritual':
      return entry.ritual
        ? `${spell.name}: o ritual não gasta espaço e por isso não sobe de nível (pág. 204).`
        : `${spell.name} não vai como ritual nesta ficha: a característica de quem a dá não alcança a magia (pág. 204).`
    case 'free':
      return entry.free
        ? `${spell.name} sai no ${entry.castLevel ?? spell.level}º nível.`
        : `${spell.name} é de ${spell.level}º nível: escolha o espaço.`
  }
}

/** Por que o jeito de pagar escolhido está esgotado. */
function describeEmptyPay(spell: Spell, option: SpellCastOption, sheet: PlaySheet, entry: SpellbookEntry, listLabel: string): string {
  if (option.pay === 'pact') return `${spell.name}: sem espaços de Pacto disponíveis.`
  if (option.pay === 'resource') {
    const recharge = sheet.resources.find(r => r.id === entry.resourceId)?.recharge
    return `${spell.name}: o uso de ${listLabel} já foi gasto${recharge ? `, e os usos ${RECHARGE_TEXT[recharge]}` : ''}.`
  }
  return `${spell.name}: sem espaços de ${option.castLevel}º nível disponíveis.`
}

/** O que a conjuração gastou, para o aviso: "Curar Ferimentos, no 2º nível: gastou um espaço de 2º nível." */
function describeCastPayment(spell: Spell, cast: SpellCast, entry: SpellbookEntry, listLabel: string): string {
  const at = cast.castLevel > spell.level ? `, no ${cast.castLevel}º nível` : ''
  switch (cast.pay) {
    case 'slot': return `${spell.name}${at}: gastou um espaço de ${cast.castLevel}º nível.`
    case 'pact': return `${spell.name}${at}: gastou um espaço de Pacto.`
    case 'resource': return `${spell.name}: gastou o uso de ${listLabel}.`
    case 'ritual': return `${spell.name} como ritual: 10 minutos a mais, sem gastar espaço (pág. 204).`
    case 'free': return spell.level === 0
      ? `${spell.name}: truque, sem gastar espaço (pág. 203).`
      : `${spell.name}${at}: sem gastar espaço.${entry.note ? ` ${entry.note}` : ''}`
  }
}

/** O passo que recusou (o estado volta o mesmo, com o aviso), para o `castSpell` desistir inteiro. */
const refusedStep = (before: PlayState, r: PlayResult) =>
  (r.state === before ? r.notices.find(n => n.kind === 'refused' || n.kind === 'unresolvedRule') : undefined)

/**
 * Conjura uma magia do grimório (`PlaySheet.spellbook`), num passo só do desfazer — o espaço, a
 * concentração e o PV voltam juntos. Nenhum gasto de espaço é feito pela tela: tudo passa por aqui.
 *
 * Recusa, sem gastar nada: morto, quem não pode agir (Incapacitado, pág. 292), o que proíbe conjurar
 * (`getCastingBlockers`: em fúria, pág. 48; de armadura sem proficiência, pág. 144), a magia com
 * componente verbal sem poder falar (pág. 205), o jeito de pagar que não serve (`getSpellCastOptions`:
 * o espaço abaixo do nível dela, o ritual que sobe de nível, pág. 204) e o esgotado.
 *
 * Feita, ela:
 * - gasta o escolhido: o espaço do pool, o de Pacto ou o uso do talento; o truque, a inata e o ritual
 *   não gastam;
 * - marca o turno pelo tempo de conjuração (a de 1 ação como Conjurar uma Magia; a de ação bônus e a
 *   de reação, na casa delas; minutos, horas e o ritual, nada), com os avisos de sempre do momento já
 *   usado, e avisa da regra da magia de ação bônus (`describeBonusActionSpellRule`) — o toque no
 *   checklist corrige;
 * - começa a concentração, trocando a anterior com o aviso de sempre (`startConcentration`);
 * - com o alvo sendo você, liga o efeito dela em você (`getSpellSelfToggle`; a de concentração fica
 *   sustentada pela sua concentração e acaba com ela) e aplica o que a mesa rolou: a cura
 *   (`applyHealing`), os PV temporários (`grantTempHp`) e o aumento do PV máximo (`adjustMaxHp`).
 *   O passo que recusar (os PV temporários sem a escolha de manter ou trocar) desfaz a conjuração
 *   inteira, com o motivo;
 * - grava a magia no turno (`TurnState.spellsCast`).
 */
export function castSpell(state0: PlayState, sheet: PlaySheet, cast: SpellCast): PlayResult {
  const found = findSpellbookEntry(sheet.spellbook, cast.casterKey, cast.spellId)
  const spell = getSpell(cast.spellId)
  if (!found || !spell) return refuse(state0, `Magia fora do grimório: ${cast.spellId}.`)
  const { list, entry } = found
  if (state0.lifeState === 'dead') return refuse(state0, `${spell.name}: o personagem está morto.`)
  const fx = getPlayEffects(state0, sheet)
  if (fx.noActions.active) {
    return refuse(state0, `${spell.name}: ${fx.noActions.sources.map(s => s.label).join(', ')}, sem ações nem reações (pág. 292).`)
  }
  const blockers = getCastingBlockers(state0, sheet)
  if (blockers.length > 0) return refuse(state0, `${spell.name}: ${blockers.join(' ')}`)
  if (fx.cannotSpeak.active && hasVerbalComponent(spell)) {
    return refuse(state0, `${spell.name}: ${fx.cannotSpeak.sources.map(s => s.label).join(', ')}, sem poder falar, e ela tem componente verbal (pág. 205).`)
  }
  const option = getSpellCastOptions(state0, sheet, cast.casterKey, cast.spellId)
    .find(o => o.pay === cast.pay && o.castLevel === cast.castLevel)
  if (!option) return refuse(state0, describeUnavailablePay(spell, entry, cast))
  if (option.available === 0) return refuse(state0, describeEmptyPay(spell, option, sheet, entry, list.label))

  let next = reconcilePlayState(state0, sheet)
  const notices: PlayNotice[] = [note('info', describeCastPayment(spell, cast, entry, list.label))]
  if (cast.pay === 'slot') {
    const spellSlotsSpent = [...next.spellSlotsSpent]
    spellSlotsSpent[cast.castLevel - 1] += 1
    next = { ...next, spellSlotsSpent }
  } else if (cast.pay === 'pact') {
    next = { ...next, pactSlotsSpent: next.pactSlotsSpent + 1 }
  } else if (cast.pay === 'resource' && entry.resourceId && option.available !== 'unlimited') {
    next = { ...next, resourcesSpent: { ...next.resourcesSpent, [entry.resourceId]: (next.resourcesSpent[entry.resourceId] ?? 0) + 1 } }
  }

  // O turno: o ritual leva 10 minutos a mais, e minutos ou horas ficam fora do checklist (pág. 204).
  const timing: CastingTimeKind = cast.pay === 'ritual' ? 'longer' : castingTimeKind(spell)
  const record: SpellCastRecord = { spellId: spell.id, level: cast.castLevel, timing }
  const bonusRule = describeBonusActionSpellRule(next.turn.spellsCast, record)
  let turn = next.turn
  if (timing !== 'longer') {
    const castAction = sheet.actions.find(a => a.id === CAST_A_SPELL)
    const use: TurnUse = timing === 'action' && castAction ? { ...castAction, name: spell.name } : { name: spell.name, timing, page: 204 }
    turn = spendTurn(turn, use, sheet, getExtraTurnAction(next, sheet), notices)
  }
  if (bonusRule) notices.push(note('warning', bonusRule))
  next = { ...next, turn: { ...turn, spellsCast: [...turn.spellsCast, record] } }

  // A concentração e o efeito em você; o passo recusado desfaz a conjuração inteira.
  const apply = (r: PlayResult): PlayNotice | undefined => {
    const refused = refusedStep(next, r)
    if (refused) return refused
    next = r.state
    notices.push(...r.notices)
    return undefined
  }
  const toggle = cast.self ? getSpellSelfToggle(sheet, spell.id) : undefined
  if (toggle && !next.activeEffects.some(a => a.id === toggle.id)) {
    // A de concentração conjurada em si fica sustentada pela sua concentração: ligá-la a começa.
    const refused = apply(activateToggle(next, sheet, toggle.id, { now: cast.now, ...(spell.concentration ? { sustainedByConcentration: true as const } : {}) }))
    if (refused) return refuse(state0, refused.text, refused.kind)
  } else {
    if (toggle) notices.push(note('info', `${toggle.source} já está em você: a mesma magia não acumula (pág. 207).`))
    if (spell.concentration && next.concentration?.spellId === spell.id) {
      // Conjurada de novo, a concentração é na mesma magia: segue, contando de agora.
      next = { ...next, concentration: { ...next.concentration, startedAt: cast.now } }
    } else if (spell.concentration) {
      const refused = apply(startConcentration(next, sheet, { spellId: spell.id, label: spell.name }, cast.now))
      if (refused) return refuse(state0, refused.text, refused.kind)
    }
  }
  const self = cast.self
  const steps: (() => PlayResult)[] = [
    ...(self?.heal && self.heal > 0 ? [() => applyHealing(next, sheet, self.heal ?? 0)] : []),
    ...(self?.tempHp && self.tempHp > 0 ? [() => grantTempHp(next, self.tempHp ?? 0, self.tempHpChoice)] : []),
    ...(self?.maxHpIncrease && self.maxHpIncrease > 0 ? [() => adjustMaxHp(next, sheet, self.maxHpIncrease ?? 0)] : []),
  ]
  for (const step of steps) {
    const refused = apply(step())
    if (refused) return refuse(state0, `${spell.name}: ${refused.text}`, refused.kind)
  }
  return done(next, notices)
}

// ── Condições e exaustão ────────────────────────────────────────────────────

/** Encerra a concentração se o estado novo incapacita ou mata (assumido F). */
function checkConcentration(next: PlayState, sheet: PlaySheet, notices: PlayNotice[]): void {
  if (!next.concentration) return
  const ends = getPlayEffects(next, sheet).endsConcentration
  if (ends.active) endConcentrationInto(next, sheet, notices, `${ends.sources.map(s => s.label).join(', ')} (pág. 205)`)
}

/**
 * Aplica uma condição gravada, com o `onApply` dela (Inconsciente grava o Caído e avisa de largar o
 * que segura). Condição que incapacita encerra a concentração (assumido F). Recusa a condição de que
 * o personagem está imune agora: a da ficha (Pureza Corporal: Envenenado) e a de um efeito ligado
 * (Fúria Inconsciente, em fúria: Enfeitiçado e Amedrontado).
 */
export function addCondition(state: PlayState, sheet: PlaySheet, id: ConditionId): PlayResult {
  const cond = getCondition(id)
  if (!cond) return refuse(state, `Condição desconhecida: ${id}.`)
  if (state.conditions.includes(id)) return done(state)
  const immune = getPlayEffects(state, sheet).conditionImmunities.find(i => i.condition === id)
  if (immune) {
    return refuse(state, `Imune a ${cond.name} (${[...new Set(immune.sources.map(s => s.label))].join(', ')}): a condição não foi aplicada.`)
  }
  const notices: PlayNotice[] = []
  const next: PlayState = { ...state, conditions: withConditionApplied(state.conditions, id) }
  if (cond.onApply?.dropHeldItems) notices.push(note('droppedItems', 'Largou o que estava segurando (pág. 292).'))
  checkConcentration(next, sheet, notices)
  if (id === 'unconscious') endTogglesOnUnconscious(next, sheet, notices)
  endTogglesOnState(next, sheet, notices)
  return done(next, notices)
}

/**
 * Remove uma condição gravada. A que só existe por derivação (Incapacitado por Paralisado, o
 * Inconsciente dos 0 PV) não sai por aqui: sai junto com a origem. Tirar o Inconsciente não tira o
 * Caído (decisão 14). Para o Caído na mesa, prefira `standUp`, que confere o deslocamento.
 */
export function removeCondition(state: PlayState, id: ConditionId): PlayResult {
  if (state.conditions.includes(id)) {
    return done(withoutCondition(state, id))
  }
  if (id === 'unconscious' && isAtZeroHp(state)) {
    return refuse(state, 'O Inconsciente vem dos 0 PV: acaba quando o personagem recupera PV (pág. 199).')
  }
  const derived = getEffectiveConditions(getPlayConditionState(state).conditions).find(c => c.id === id)
  if (derived) {
    const parents = derived.impliedBy.map(p => getCondition(p)?.name ?? p).join(', ')
    return refuse(state, `${derived.name} vem de ${parents}: some junto com a condição de origem.`)
  }
  return done(state)
}

/**
 * Levantar-se (págs. 192-193): tira o Caído e gasta metade do deslocamento do turno
 * (`TurnState.movementSpent`, que `getTurnMovement` desconta), com o aviso do custo. Recusa com
 * deslocamento efetivo 0 (o livro proíbe). O "Usar" da aba Ações e o "Levantar" do Caído passam
 * por aqui.
 */
export function standUp(state: PlayState, sheet: PlaySheet): PlayResult {
  if (!state.conditions.includes('prone')) return refuse(state, 'O personagem não está Caído.')
  const speed = getPlaySpeed(state, sheet)
  if (speed <= 0) return refuse(state, 'Com deslocamento 0 não é possível se levantar (pág. 193).')
  const cost = halveSpeedOnGrid(speed)
  const up = withoutCondition(state, 'prone')
  return done(
    { ...up, turn: { ...up.turn, movementSpent: up.turn.movementSpent + cost } },
    [note('info', `Levantar-se custa metade do deslocamento (${formatMeters(cost)}) (pág. 192).`)],
  )
}

/** Tira a nota de uma condição; o campo some quando não sobra nenhuma. */
function withoutConditionNote(state: PlayState, id: ConditionId): PlayState {
  if (state.conditionNotes?.[id] === undefined) return state
  const rest = { ...state.conditionNotes }
  delete rest[id]
  const next: PlayState = { ...state }
  if (Object.keys(rest).length > 0) next.conditionNotes = rest
  else delete next.conditionNotes
  return next
}

/** Tira uma condição gravada, junto com a nota de duração dela. */
function withoutCondition(state: PlayState, id: ConditionId): PlayState {
  return withoutConditionNote({ ...state, conditions: state.conditions.filter(c => c !== id) }, id)
}

/**
 * Nota de duração de uma condição gravada ("até o fim do próximo turno do mago"): o app não conta
 * tempo, só guarda o lembrete. Texto aparado e cortado em `CONDITION_NOTE_MAX_LENGTH`; vazio
 * apaga a nota. Condição só derivada (Incapacitado por Paralisado) ou ausente não leva nota.
 */
export function setConditionNote(state: PlayState, id: ConditionId, text: string): PlayResult {
  if (!state.conditions.includes(id)) {
    return refuse(state, `${getCondition(id)?.name ?? id} não está gravada: só condição aplicada leva nota de duração.`)
  }
  const value = text.trim().slice(0, CONDITION_NOTE_MAX_LENGTH).trim()
  if (!value) return done(withoutConditionNote(state, id))
  if (state.conditionNotes?.[id] === value) return done(state)
  return done({ ...state, conditionNotes: { ...state.conditionNotes, [id]: value } })
}

/**
 * Define o nível de exaustão (0 a 6). Ao chegar na 4 ou mais, o PV atual acima do novo máximo SE
 * PERDE: o corte é gravado em `damageTaken` e não volta quando a exaustão baixa (decisão 4).
 * Exaustão 6 = morte com 0 PV (decisão de 2026-10-25), que encerra a concentração (assumido F).
 * Recusa a entrada na exaustão 4 que
 * daria máximo efetivo 0 a quem está consciente (Ponto em aberto 17 de `regras-dano-e-morte.md`).
 */
export function setExhaustion(state0: PlayState, sheet: PlaySheet, level: number): PlayResult {
  if (!isInt(level)) return refuse(state0, 'Nível de exaustão inválido.')
  const target = clampInt(level, 0, 6) as ExhaustionLevel
  if (target === state0.exhaustionLevel) return done(state0)
  const state = reconcilePlayState(state0, sheet)
  const before = state.exhaustionLevel
  const notices: PlayNotice[] = []
  const next: PlayState = { ...state, exhaustionLevel: target }

  const sheetMax = getBaseMaxHp(state, sheet)
  if (target === 6) {
    if (state.lifeState !== 'dead') toDead(next, sheet, notices, 'Exaustão 6: morte, com 0 PV (pág. 292).')
    // Quem morre por Exaustão 6 fica com 0 PV (decisão de 2026-10-25); o desfazer volta o de antes.
    next.damageTaken = sheetMax
    return done(next, notices)
  }

  const effMax = getEffectiveMaxHp(next, sheet)
  const current = getCurrentHp(state, sheet)
  if (effMax < sheetMax && current > effMax) {
    if (effMax < 1 && state.lifeState === 'conscious') {
      return refuse(state0, `Com PV máximo ${sheetMax}, a exaustão ${target} deixa o máximo efetivo em 0 e levaria a 0 PV sem dano: o livro não trata do caso.`, 'unresolvedRule')
    }
    next.damageTaken = sheetMax - effMax
    notices.push(note('hpCut', `Exaustão ${target}: PV máximo ${effMax}. O PV atual cai de ${current} para ${effMax} e não volta quando a exaustão baixar.`))
  }
  const immunity = describeHpMaxImmunity(next, sheet)
  if (immunity && before < 4) notices.push(note('info', immunity))
  if (before >= 4 && target < 4 && !sheet.hpMaxReductionImmunity) {
    notices.push(note('info', `O PV máximo volta a ${sheetMax}; o PV atual fica em ${getCurrentHp(next, sheet)} (o corte da exaustão não volta).`))
  }
  if (before === 6 && next.lifeState === 'dead') {
    notices.push(note('info', 'Continua morto: use "fui revivido" para voltar.'))
  }
  checkConcentration(next, sheet, notices)
  endTogglesOnState(next, sheet, notices)
  return done(next, notices)
}

// ── Concentração, inspiração, nota, histórico ───────────────────────────────

/**
 * Começa a se concentrar. Uma concentração por vez (pág. 205): a anterior termina, com aviso.
 * Recusa a quem não está consciente ou está incapacitado, e com a restrição de um efeito ligado em
 * vigor: "Em fúria você não pode se concentrar (pág. 48)".
 */
export function startConcentration(
  state: PlayState,
  sheet: PlaySheet,
  spell: { spellId?: string; label: string },
  now: number,
): PlayResult {
  const label = spell.label.trim()
  if (!label) return refuse(state, 'Informe a magia da concentração.')
  if (state.lifeState !== 'conscious') return refuse(state, 'Só um personagem consciente pode se concentrar.')
  const blocking = getPlayToggles(state, sheet).find(t =>
    t.effects.some(e => e.effect.kind === 'endsConcentration' || e.effect.kind === 'cannotCast'))
  if (blocking) return refuse(state, `${blocking.label} você não pode se concentrar (pág. ${blocking.page}).`)
  const ends = getPlayEffects(state, sheet).endsConcentration
  if (ends.active) return refuse(state, `Não é possível se concentrar: ${ends.sources.map(s => s.label).join(', ')}.`)
  const notices: PlayNotice[] = []
  const next: PlayState = { ...state }
  if (state.concentration) {
    notices.push(note('concentrationReplaced', `A concentração em ${state.concentration.label} termina: não dá para se concentrar em duas magias (pág. 205).`))
    endSustainedToggles(next, sheet, notices)
  }
  next.concentration = { ...(spell.spellId ? { spellId: spell.spellId } : {}), label, startedAt: now }
  return done(next, notices)
}

/**
 * Encerra a concentração (voluntário, ou fracasso no TR de Constituição), com a magia que você
 * conjurou em si e ela sustentava (a Bênção própria).
 */
export function endConcentration(state: PlayState, sheet: PlaySheet): PlayResult {
  if (!state.concentration) return done(state)
  const notices: PlayNotice[] = []
  const next = { ...state }
  endConcentrationInto(next, sheet, notices, 'encerrada')
  return done(next, notices)
}

/** Inspiração: ganhar (o Mestre concedeu) ou gastar/abrir mão. Binária, não acumula (pág. 127). */
export function setInspiration(state: PlayState, inspiration: boolean): PlayResult {
  return state.inspiration === inspiration ? done(state) : done({ ...state, inspiration })
}

export function setNote(state: PlayState, text: string): PlayResult {
  return done({ ...state, note: text })
}

/** Guarda uma rolagem no histórico, mantendo só as `ROLL_HISTORY_LIMIT` mais recentes. */
export function recordRoll(state: PlayState, record: RollRecord): PlayResult {
  return done({ ...state, rolls: [...state.rolls, record].slice(-ROLL_HISTORY_LIMIT) })
}

/**
 * "Nova sessão" (decisão 10.2.20): esvazia o histórico de rolagens e zera o turno em curso — PV,
 * espaços, recursos, condições, efeitos ligados e a nota ficam como estão (tempo de relógio não é
 * tempo de jogo). Sem rolagens nem turno marcado, devolve o mesmo estado.
 */
export function clearRollHistory(state: PlayState): PlayResult {
  const turnEmpty = JSON.stringify(state.turn) === JSON.stringify(emptyTurn())
  return state.rolls.length === 0 && turnEmpty ? done(state) : done({ ...state, rolls: [], turn: emptyTurn() })
}

// ── Descanso curto ──────────────────────────────────────────────────────────

/** Avisos do que mexe na cura por Dado de Vida e ainda não está declarado como efeito nos dados. */
const UNAUTOMATED_HIT_DIE_FEATS: Record<string, string> = {
  resistente: 'O mínimo do talento Resistente (2 × mod. de CON, mínimo 2, pág. 172) não está automatizado.',
}

export type HitDieSpend = {
  /** Tipo do dado (6, 8, 10, 12), um dos do poço. */
  die: number
  /** Face tirada: do motor de dados ou digitada do dado físico (1 ao número de lados). */
  value: number
}

/**
 * Gasta UM Dado de Vida no descanso curto (pág. 188): cura = face + mod. de CON, com piso 0
 * (decisão 3), pela mesma operação de cura (teto no máximo efetivo). Só tipos disponíveis. A UI
 * guarda o resultado como rascunho até o "Confirmar" do descanso.
 *
 * Recusa a 0 PV: quem está a 0 PV não gasta Dados de Vida no descanso curto (decisão de 2026-10-25,
 * `regras-descanso.md`, Ponto em aberto 6).
 */
export function spendHitDie(state0: PlayState, sheet: PlaySheet, spend: HitDieSpend): PlayResult {
  if (state0.lifeState === 'dead') return refuse(state0, 'Uma criatura morta não recupera pontos de vida (pág. 199).')
  if (isAtZeroHp(state0)) {
    return refuse(state0, 'A 0 PV não dá para gastar Dados de Vida: primeiro é preciso recuperar ao menos 1 PV. Nada foi gasto.')
  }
  const state = reconcilePlayState(state0, sheet)
  const pool = getHitDiceAvailable(state, sheet).find(p => p.die === spend.die)
  if (!pool) return refuse(state0, `O personagem não tem Dados de Vida d${spend.die}.`)
  if (pool.available <= 0) return refuse(state0, `Não restam Dados de Vida d${spend.die}.`)
  if (!isInt(spend.value) || spend.value < 1 || spend.value > spend.die) {
    return refuse(state0, `${spend.value} não é uma face de d${spend.die}.`)
  }

  const con = sheet.conModifier
  const amount = Math.max(0, spend.value + con)
  const floor = spend.value + con < 0 ? ' (a cura nunca vira dano)' : ''
  const notices: PlayNotice[] = [
    note('hitDie', `d${spend.die}: ${spend.value} ${signed(con)} = ${amount}${floor}.`),
    ...sheet.featIds.flatMap(id => (UNAUTOMATED_HIT_DIE_FEATS[id] ? [note('warning', UNAUTOMATED_HIT_DIE_FEATS[id])] : [])),
  ]
  const healed = heal(state, sheet, amount, notices)
  return done({ ...healed, hitDiceSpent: { ...healed.hitDiceSpent, [spend.die]: pool.spent + 1 } }, notices)
}

export type ShortRestOptions = {
  /**
   * Quantos Dados de Vida foram gastos NESTE descanso (a UI sabe, pelo rascunho da fase 2). Só
   * serve para o aviso da Canção de Descanso, que vale uma vez e só se gastou algum.
   */
  hitDiceSpent?: number
}

export type ShortRestPreview = {
  /** Espaços de Magia de Pacto gastos, que voltam. */
  pactSlots: number
  /** Recursos de recarga `'short'` com usos gastos, que voltam inteiros. */
  resources: { id: string; name: string; amount: number }[]
  /** Os avisos dos efeitos ligados que acabam no descanso (`endTogglesOnRest`): a Fúria, o Frenesi. */
  effectsEnding: string[]
  /** Por que o descanso não pode ser concluído: o fim de um efeito leva à exaustão 6. */
  blockReason?: string
}

/**
 * Prévia pura do que o descanso curto devolve além dos Dados de Vida (`regras-descanso.md`, 6.2):
 * os espaços de Pacto e os recursos `'short'`, e os efeitos ligados que acabam nele. É a mesma
 * conta do `completeShortRest`.
 */
export function previewShortRest(state0: PlayState, sheet: PlaySheet): ShortRestPreview {
  const ending = endTogglesOnRest(state0, sheet, 'shortRest')
  const refusal = ending.notices.find(n => n.kind === 'refused')
  const state = refusal ? reconcilePlayState(state0, sheet) : ending.state
  return {
    pactSlots: state.pactSlotsSpent,
    resources: sheet.resources
      .filter(r => r.recharge === 'short' && (state.resourcesSpent[r.id] ?? 0) > 0)
      .map(r => ({ id: r.id, name: r.name, amount: state.resourcesSpent[r.id] })),
    effectsEnding: refusal ? [] : ending.notices.map(n => n.text),
    ...(refusal ? { blockReason: refusal.text } : {}),
  }
}

export type ShortRestSlotRecovery = {
  id: string
  name: string
  /** Soma máxima dos níveis dos espaços recuperados (metade do nível de mago, para cima…). */
  levels: number
  maxSlotLevel: number
  page: number
  /** O lembrete pronto para a tela. */
  text: string
}

/**
 * Os recursos que recuperam espaços de magia num descanso curto (`slotRecovery`: Recuperação
 * Arcana, Recuperação Natural) e ainda têm uso. Só lembrete (decisão de 2026-10-25): quais espaços
 * voltar é escolha do jogador, nas bolinhas da aba Magia, e o uso é marcado lá também.
 */
export function getShortRestSlotRecovery(state0: PlayState, sheet: PlaySheet): ShortRestSlotRecovery[] {
  if (state0.lifeState === 'dead') return []
  const state = reconcilePlayState(state0, sheet)
  return sheet.resources.flatMap(r => {
    const recovery = r.slotRecovery
    if (!recovery || r.amount?.unit !== 'slotLevels' || r.amount.value < 1) return []
    const available = getResourceAvailable(state, sheet, r.id)
    if (available !== 'unlimited' && !(typeof available === 'number' && available > 0)) return []
    const levels = r.amount.value
    const text = `${r.name}: neste descanso curto, você pode recuperar espaços de magia gastos que somem até ${countLabel(levels, 'nível', 'níveis')}, nenhum de ${recovery.maxSlotLevel + 1}º nível ou superior (pág. ${recovery.page}). Escolha quais e devolva nas bolinhas da aba Magia; depois marque o uso.`
    return [{ id: r.id, name: r.name, levels, maxSlotLevel: recovery.maxSlotLevel, page: recovery.page, text }]
  })
}

/** Id do recurso da Canção de Descanso do bardo em `class-progression-features.json`. */
const SONG_OF_REST_ID = 'song-of-rest'

/**
 * Os contadores que o descanso zera, com aviso (a Fúria Implacável: "assim que você terminar um
 * descanso curto ou longo a CD volta para 10", pág. 49). `resetsOn` 'short' zera nos dois; 'long',
 * só no longo. Devolve os contadores de depois.
 */
function resetRestCounters(state: PlayState, sheet: PlaySheet, rest: 'short' | 'long', notices: PlayNotice[]): Record<string, number> {
  const restCounters = { ...state.restCounters }
  for (const save of getRestCounterSaves(sheet)) {
    if ((restCounters[save.counter] ?? 0) === 0 || (rest === 'short' && save.resetsOn !== 'short')) continue
    delete restCounters[save.counter]
    notices.push(note('info', `${save.source}: a CD volta a ${save.dc} (pág. ${save.page}).`))
  }
  return restCounters
}

/**
 * Conclui o descanso curto: voltam os espaços de Pacto (pág. 58) e os recursos de recarga
 * `'short'`. O pool combinado só volta no longo (`regras-descanso.md`, 6.3). Os Dados de Vida
 * gastos com `spendHitDie` já estão no estado e não voltam aqui. Os efeitos ligados que acabam no
 * descanso (a Fúria) terminam antes, com aviso (`endTogglesOnRest`); a tela os encerra antes dos
 * Dados de Vida, e aqui nada sobra para encerrar.
 *
 * Canção de Descanso (bardo 2+): o dado extra não está automatizado — vira UM aviso, só se algum
 * Dado de Vida foi gasto neste descanso (`regras-descanso.md`, 6.2 e 6.4; pág. 54).
 */
export function completeShortRest(state0: PlayState, sheet: PlaySheet, options: ShortRestOptions = {}): PlayResult {
  if (state0.lifeState === 'dead') return refuse(state0, 'O personagem está morto.')
  const ending = endTogglesOnRest(state0, sheet, 'shortRest')
  if (ending.notices.some(n => n.kind === 'refused')) return ending
  const state = ending.state
  const preview = previewShortRest(state, sheet)
  const recovered: string[] = []
  if (preview.pactSlots > 0) recovered.push(countLabel(preview.pactSlots, 'espaço de Pacto', 'espaços de Pacto'))
  const resourcesSpent = { ...state.resourcesSpent }
  for (const r of preview.resources) {
    recovered.push(r.name)
    delete resourcesSpent[r.id]
  }
  const notices = [
    ...ending.notices,
    ...(recovered.length > 0 ? [note('recovered', `Descanso curto concluído. De volta: ${recovered.join(', ')}.`)] : []),
  ]
  const restCounters = resetRestCounters(state, sheet, 'short', notices)
  const song = sheet.resources.find(r => r.id === SONG_OF_REST_ID)
  if (song && (options.hitDiceSpent ?? 0) > 0) {
    const die = song.die ? ` (${song.die})` : ''
    notices.push(note('warning', `${song.name}${die} não está automatizada: como gastou Dados de Vida neste descanso, role o dado uma vez e aplique como cura (pág. 54).`))
  }
  return done({ ...state, pactSlotsSpent: 0, resourcesSpent, restCounters }, notices)
}

// ── Descanso longo ──────────────────────────────────────────────────────────

/** Quantos Dados de Vida o descanso longo devolve: max(1, ⌊total/2⌋), limitado aos gastos (decisão 1). */
export function getLongRestHitDiceRecoverable(state: PlayState, sheet: PlaySheet): number {
  const pool = getHitDiceAvailable(state, sheet)
  const total = pool.reduce((s, p) => s + p.total, 0)
  const spent = pool.reduce((s, p) => s + p.spent, 0)
  if (total === 0) return 0
  return Math.min(spent, Math.max(1, Math.floor(total / 2)))
}

/** Sugestão de quais tipos voltam: os maiores primeiro (decisão 2). O jogador pode trocar. */
export function suggestLongRestHitDice(state: PlayState, sheet: PlaySheet): Record<number, number> {
  let left = getLongRestHitDiceRecoverable(state, sheet)
  const out: Record<number, number> = {}
  for (const p of [...getHitDiceAvailable(state, sheet)].sort((a, b) => b.die - a.die)) {
    const take = Math.min(left, p.spent)
    if (take > 0) out[p.die] = take
    left -= take
  }
  return out
}

export type LongRestOptions = {
  /** "Comeu e bebeu": −1 de exaustão. Marcado por padrão (decisão 14). */
  ateAndDrank?: boolean
}

export type LongRestPreview = {
  /** Sem benefício nenhum: começou com 0 PV, ou está morto (assumido A). */
  blocked: boolean
  blockReason?: string
  hp: { before: number; after: number; max: number }
  hitDice: { recoverable: number; suggestion: Record<number, number> }
  /** Espaços do pool que voltam, por nível (9 posições). */
  spellSlots: number[]
  pactSlots: number
  resources: { id: string; name: string; amount: number }[]
  tempHpLost: number
  /** O ajuste temporário do PV máximo que acaba com o descanso (0 sem ajuste). */
  maxHpAdjustmentEnds: number
  /** Antes já conta a exaustão que o fim de um efeito ligado dá no começo do descanso (o Frenesi). */
  exhaustion: { before: ExhaustionLevel; after: ExhaustionLevel }
  /** Os avisos dos efeitos ligados que acabam no descanso (`endTogglesOnRest`): a Fúria, o Frenesi. */
  effectsEnding: string[]
  /** Avisos fixos da prévia (24 horas, interrupção). */
  notices: PlayNotice[]
}

const LONG_REST_RECHARGES = new Set(['short', 'long', 'day'])

/**
 * Prévia pura do descanso longo (pág. 188): o que volta e o que não. PV até o máximo efetivo
 * DEPOIS do −1 de exaustão (`regras-descanso.md`, 6.1 e Ponto em aberto 12), metade dos Dados de
 * Vida, todos os espaços, recursos `'short'`/`'long'`/`'day'` (assumido B), fim dos PV
 * temporários. Com 0 PV no início, nenhum benefício (assumido A). Os efeitos ligados que acabam no
 * descanso (a Fúria) terminam no começo dele (`endTogglesOnRest`), e a conta parte do estado de
 * depois: a exaustão do Frenesi vem antes do −1; se ela matar, nenhum benefício.
 */
export function previewLongRest(state0: PlayState, sheet: PlaySheet, options: LongRestOptions = {}): LongRestPreview {
  const ateAndDrank = options.ateAndDrank ?? true
  const ending = endTogglesOnRest(state0, sheet, 'longRest')
  const endingRefusal = ending.notices.find(n => n.kind === 'refused')
  const state = endingRefusal ? reconcilePlayState(state0, sheet) : ending.state
  const current = getCurrentHp(state, sheet)
  const notices = [
    note('info', 'Só um descanso longo a cada 24 horas no jogo (pág. 188).'),
    note('info', 'Confirme só o descanso que terminou: 1 hora de caminhada, combate ou conjuração interrompe e ele recomeça (pág. 188).'),
  ]
  const blockReason = state.lifeState === 'dead'
    ? 'O personagem está morto: o descanso longo não dá benefícios.'
    : current === 0
      ? 'É preciso ter pelo menos 1 PV no início do descanso longo para obter seus benefícios (pág. 188). Quem está estável recupera 1 PV depois de 1d4 horas (pág. 200).'
      : endingRefusal?.text
  const effMax = getEffectiveMaxHp(state, sheet)

  if (blockReason) {
    return {
      blocked: true,
      blockReason,
      hp: { before: current, after: current, max: effMax },
      hitDice: { recoverable: 0, suggestion: {} },
      spellSlots: Array(SPELL_LEVELS).fill(0),
      pactSlots: 0,
      resources: [],
      tempHpLost: 0,
      maxHpAdjustmentEnds: 0,
      exhaustion: { before: state.exhaustionLevel, after: state.exhaustionLevel },
      effectsEnding: [],
      notices,
    }
  }

  const exhaustionAfter = (ateAndDrank ? Math.max(0, state.exhaustionLevel - 1) : state.exhaustionLevel) as ExhaustionLevel
  // O ajuste temporário do PV máximo termina com o descanso: o máximo depois é o da ficha.
  const after = { ...state, exhaustionLevel: exhaustionAfter, maxHpAdjustment: 0 }
  const maxAfter = getEffectiveMaxHp(after, sheet)
  return {
    blocked: false,
    // Nunca acima do máximo base de depois (o ajuste que acabou não fica); sem o ajuste, só sobe.
    hp: { before: current, after: Math.max(Math.min(current, getBaseMaxHp(after, sheet)), maxAfter), max: maxAfter },
    hitDice: {
      recoverable: getLongRestHitDiceRecoverable(state, sheet),
      suggestion: suggestLongRestHitDice(state, sheet),
    },
    spellSlots: [...state.spellSlotsSpent],
    pactSlots: state.pactSlotsSpent,
    resources: sheet.resources
      .filter(r => r.recharge && LONG_REST_RECHARGES.has(r.recharge) && (state.resourcesSpent[r.id] ?? 0) > 0)
      .map(r => ({ id: r.id, name: r.name, amount: state.resourcesSpent[r.id] })),
    tempHpLost: state.tempHp,
    maxHpAdjustmentEnds: state.maxHpAdjustment,
    exhaustion: { before: state.exhaustionLevel, after: exhaustionAfter },
    effectsEnding: ending.notices.map(n => n.text),
    notices,
  }
}

export type LongRestCompletion = LongRestOptions & {
  /** Tipos de Dado de Vida que voltam, escolhidos pelo jogador; sem isso, vale a sugestão. */
  hitDice?: Record<number, number>
  /** Data real, só para `lastLongRestAt`. */
  now?: number
}

/**
 * Conclui o descanso longo com a escolha do jogador. Recusa quando a prévia bloqueia e quando a
 * escolha de Dados de Vida é inválida (tipo fora do poço, mais que os gastos daquele tipo, ou mais
 * que o total que volta). Escolher menos que o máximo vale: o livro diz que ele "pode" recuperar.
 * Os efeitos ligados que acabam no descanso (a Fúria) terminam primeiro, com os avisos deles, no
 * mesmo passo do desfazer.
 */
export function completeLongRest(state0: PlayState, sheet: PlaySheet, options: LongRestCompletion = {}): PlayResult {
  const preview = previewLongRest(state0, sheet, options)
  if (preview.blocked) return refuse(state0, preview.blockReason ?? 'Descanso longo sem benefícios.')
  // A prévia não bloqueou: o fim dos efeitos não foi recusado.
  const ending = endTogglesOnRest(state0, sheet, 'longRest')
  const state = ending.state

  const choice = options.hitDice ?? preview.hitDice.suggestion
  const pool = getHitDiceAvailable(state, sheet)
  let chosen = 0
  for (const [key, count] of Object.entries(choice)) {
    const p = pool.find(x => x.die === Number(key))
    if (!p || !isInt(count) || count < 0 || count > p.spent) {
      return refuse(state0, `Escolha de Dados de Vida inválida: d${key} × ${count}.`)
    }
    chosen += count
  }
  if (chosen > preview.hitDice.recoverable) {
    return refuse(state0, `O descanso longo devolve no máximo ${countLabel(preview.hitDice.recoverable, 'Dado de Vida', 'Dados de Vida')}.`)
  }

  const hitDiceSpent: Record<number, number> = {}
  for (const p of pool) {
    const left = p.spent - (choice[p.die] ?? 0)
    if (left > 0) hitDiceSpent[p.die] = left
  }
  const resourcesSpent = { ...state.resourcesSpent }
  for (const r of preview.resources) delete resourcesSpent[r.id]
  const counterNotices: PlayNotice[] = []
  const restCounters = resetRestCounters(state, sheet, 'long', counterNotices)

  const next: PlayState = {
    ...state,
    exhaustionLevel: preview.exhaustion.after,
    maxHpAdjustment: 0,
    // Todos os PV perdidos até o máximo efetivo depois do −1 de exaustão (Ponto em aberto 12),
    // medidos contra o máximo da ficha: o ajuste temporário acabou.
    damageTaken: Math.max(0, sheet.maxHp) - preview.hp.after,
    tempHp: 0,
    hitDiceSpent,
    spellSlotsSpent: Array(SPELL_LEVELS).fill(0),
    pactSlotsSpent: 0,
    resourcesSpent,
    restCounters,
    deathSaves: { ...ZERO_SAVES },
    ...(options.now !== undefined ? { lastLongRestAt: options.now } : {}),
  }

  const parts = [
    `PV ${preview.hp.before} → ${preview.hp.after}`,
    ...(chosen > 0 ? [countLabel(chosen, 'Dado de Vida', 'Dados de Vida')] : []),
    ...(preview.maxHpAdjustmentEnds !== 0 ? [`o ajuste do PV máximo (${formatHpAdjustment(preview.maxHpAdjustmentEnds)}) acabou`] : []),
    ...(preview.exhaustion.after < preview.exhaustion.before ? [`exaustão ${preview.exhaustion.before} → ${preview.exhaustion.after}`] : []),
  ]
  return done(next, [...ending.notices, note('recovered', `Descanso longo: ${parts.join('; ')}.`), ...counterNotices])
}

// ── Sanitizador ─────────────────────────────────────────────────────────────

const LIFE_STATES: readonly LifeState[] = ['conscious', 'dying', 'stable', 'dead']

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

const nonNegInt = (x: unknown, fallback = 0): number =>
  typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : fallback

/** Conferência estrutural mínima de um `RollRecord` vindo do armazenamento. */
function isRollRecord(x: unknown): x is RollRecord {
  if (!isRecord(x)) return false
  return typeof x.id === 'string'
    && typeof x.at === 'number'
    && typeof x.notation === 'string'
    && typeof x.total === 'number'
    && typeof x.modifierTotal === 'number'
    && Array.isArray(x.terms)
    && isRecord(x.formula)
    && Array.isArray(x.formula.dice)
    && Array.isArray(x.formula.modifiers)
}

function sanitizeConcentration(x: unknown): Concentration | null {
  if (!isRecord(x) || typeof x.label !== 'string' || !x.label.trim()) return null
  return {
    ...(typeof x.spellId === 'string' && x.spellId ? { spellId: x.spellId } : {}),
    label: x.label.trim(),
    startedAt: typeof x.startedAt === 'number' && Number.isFinite(x.startedAt) ? x.startedAt : 0,
  }
}

/**
 * Contagem por id (os usos gastos de cada recurso, os contadores do descanso): inteiros positivos; o
 * zero e o que não é número saem.
 */
function sanitizeCounts(x: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isRecord(x)) return out
  for (const [id, value] of Object.entries(x)) {
    const n = nonNegInt(value)
    if (id && n > 0) out[id] = n
  }
  return out
}

/**
 * Os efeitos ligados: entrada sem id ou com tipo errado sai, e o mesmo id fica uma vez só (a
 * primeira). Se a ficha ainda tem o efeito, quem confere é a reconciliação, que conhece a ficha.
 */
function sanitizeActiveEffects(x: unknown): ActiveToggle[] {
  if (!Array.isArray(x)) return []
  const out: ActiveToggle[] = []
  for (const item of x) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || out.some(t => t.id === item.id)) continue
    out.push({
      id: item.id,
      startedAt: typeof item.startedAt === 'number' && Number.isFinite(item.startedAt) ? item.startedAt : 0,
      ...(typeof item.option === 'string' && item.option ? { option: item.option } : {}),
      ...(item.sustainedByConcentration === true ? { sustainedByConcentration: true as const } : {}),
    })
  }
  return out
}

/** O turno gravado: casa que não é `true` fica livre, contagem que não é número fica 0. */
function sanitizeTurn(x: unknown): TurnState {
  if (!isRecord(x)) return emptyTurn()
  return {
    action: x.action === true,
    bonusAction: x.bonusAction === true,
    movement: x.movement === true,
    reaction: x.reaction === true,
    extraActions: nonNegInt(x.extraActions),
    extraTurnActionUsed: x.extraTurnActionUsed === true,
    dashes: nonNegInt(x.dashes),
    movementSpent: nonNegInt(x.movementSpent),
    attacked: x.attacked === true,
    afterTurn: x.afterTurn === true,
    beforeTurn: x.beforeTurn === true,
    used: Array.isArray(x.used)
      ? [...new Set(x.used.filter((id): id is string => typeof id === 'string' && id !== ''))]
      : [],
    // A magia que o turno lembra: id, nível inteiro de 0 a 9 e um tempo de conjuração conhecido.
    spellsCast: Array.isArray(x.spellsCast)
      ? x.spellsCast.flatMap((r): SpellCastRecord[] => isRecord(r) && typeof r.spellId === 'string' && r.spellId
        && isInt(r.level) && r.level >= 0 && r.level <= SPELL_LEVELS && CASTING_TIME_KINDS.includes(r.timing as CastingTimeKind)
        ? [{ spellId: r.spellId, level: r.level, timing: r.timing as CastingTimeKind }]
        : [])
      : [],
  }
}

/**
 * O retrato da ficha só vale inteiro: torto em qualquer parte, sai (a próxima abertura tira outro,
 * sem aviso — melhor calar uma correção do que inventar uma).
 */
function sanitizeSheetSnapshot(x: unknown): SheetSnapshot | null {
  if (!isRecord(x)) return null
  const { sheetUpdatedAt, draftFingerprint, maxHp, armorClass, spellcasting, spellSlots, pactSlots, attacks } = x
  if (typeof sheetUpdatedAt !== 'number' || !Number.isFinite(sheetUpdatedAt)) return null
  if (typeof draftFingerprint !== 'string' || !isInt(maxHp) || !isInt(armorClass)) return null
  if (!Array.isArray(spellcasting) || !Array.isArray(spellSlots) || spellSlots.length !== SPELL_LEVELS) return null
  if (!spellSlots.every(n => isInt(n) && n >= 0)) return null
  const casting = spellcasting.filter((c): c is SheetSnapshotSpellcasting =>
    isRecord(c) && typeof c.key === 'string' && typeof c.label === 'string' && isInt(c.saveDc) && isInt(c.attackBonus))
  if (casting.length !== spellcasting.length) return null
  if (pactSlots !== null && !(isRecord(pactSlots) && isInt(pactSlots.slots) && isInt(pactSlots.slotLevel))) return null
  // Os ataques entraram depois (2026-10-30): o retrato de antes não os tem, e vale assim.
  if (attacks !== undefined && !Array.isArray(attacks)) return null
  const lines = (attacks ?? []).filter((a): a is SheetSnapshotAttack =>
    isRecord(a) && typeof a.key === 'string' && typeof a.label === 'string' && typeof a.damage === 'string' && typeof a.extraDamage === 'string')
  if (attacks !== undefined && lines.length !== attacks.length) return null
  return {
    sheetUpdatedAt,
    draftFingerprint,
    maxHp,
    armorClass,
    spellcasting: casting.map(({ key, label, saveDc, attackBonus }) => ({ key, label, saveDc, attackBonus })),
    spellSlots: [...spellSlots],
    pactSlots: pactSlots === null ? null : { slots: pactSlots.slots as number, slotLevel: pactSlots.slotLevel as number },
    ...(attacks !== undefined
      ? { attacks: lines.map(({ key, label, damage, extraDamage }) => ({ key, label, damage, extraDamage })) }
      : {}),
  }
}

/**
 * Transforma qualquer coisa (o JSON do localStorage, um import) num `PlayState` válido: campos
 * ausentes viram o padrão, números saem inteiros e não negativos, contadores entre 0 e 3,
 * condições e tipos de dado desconhecidos são descartados e a versão vira a atual. O
 * `characterId` vem de quem chama (a chave do armazenamento manda). Os limites que dependem da
 * ficha ficam com `reconcilePlayState` (inclusive o 1 PV mínimo de quem está consciente).
 *
 * A máquina de estados de vida também é conferida (`regras-dano-e-morte.md`): exaustão 6 é morte
 * (assumido F); morrendo com 3 fracassos está morto e com 3 sucessos está estável (pág. 199),
 * contadores zerados; quem não está consciente não mantém concentração (assumido F).
 */
export function sanitizePlayState(raw: unknown, characterId: string): PlayState {
  const base = createPlayState(characterId)
  if (!isRecord(raw)) return base

  const saves = isRecord(raw.deathSaves) ? raw.deathSaves : {}
  const exhaustionLevel = clampInt(nonNegInt(raw.exhaustionLevel), 0, 6) as ExhaustionLevel
  let lifeState: LifeState = LIFE_STATES.includes(raw.lifeState as LifeState) ? raw.lifeState as LifeState : 'conscious'
  let deathSaves: PlayState['deathSaves'] = lifeState === 'dying'
    ? { successes: toCount(nonNegInt(saves.successes)), failures: toCount(nonNegInt(saves.failures)) }
    : { ...ZERO_SAVES }
  if (exhaustionLevel === 6 || deathSaves.failures >= 3) lifeState = 'dead'
  else if (deathSaves.successes >= 3) lifeState = 'stable'
  if (lifeState !== 'dying') deathSaves = { ...ZERO_SAVES }

  const hitDiceSpent: Record<number, number> = {}
  if (isRecord(raw.hitDiceSpent)) {
    for (const [key, value] of Object.entries(raw.hitDiceSpent)) {
      const die = Number(key)
      const n = nonNegInt(value)
      if ((HIT_DIE_SIZES as readonly number[]).includes(die) && n > 0) hitDiceSpent[die] = n
    }
  }

  const slots = Array.isArray(raw.spellSlotsSpent) ? raw.spellSlotsSpent : []

  const sheetSnapshot = sanitizeSheetSnapshot(raw.sheetSnapshot)

  const conditions = Array.isArray(raw.conditions)
    ? [...new Set(raw.conditions.filter((c): c is ConditionId => typeof c === 'string' && getCondition(c as ConditionId) !== undefined))]
    : []
  // Notas de duração: só das condições que ficaram, texto aparado e dentro do teto.
  const conditionNotes: Partial<Record<ConditionId, string>> = {}
  if (isRecord(raw.conditionNotes)) {
    for (const id of conditions) {
      const text = raw.conditionNotes[id]
      const value = typeof text === 'string' ? text.trim().slice(0, CONDITION_NOTE_MAX_LENGTH).trim() : ''
      if (value) conditionNotes[id] = value
    }
  }

  return {
    ...base,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    damageTaken: nonNegInt(raw.damageTaken),
    maxHpAdjustment: typeof raw.maxHpAdjustment === 'number' && Number.isFinite(raw.maxHpAdjustment)
      ? Math.trunc(raw.maxHpAdjustment)
      : 0,
    tempHp: nonNegInt(raw.tempHp),
    lifeState,
    deathSaves,
    hitDiceSpent,
    spellSlotsSpent: Array.from({ length: SPELL_LEVELS }, (_, i) => nonNegInt(slots[i])),
    pactSlotsSpent: nonNegInt(raw.pactSlotsSpent),
    resourcesSpent: sanitizeCounts(raw.resourcesSpent),
    conditions,
    ...(Object.keys(conditionNotes).length > 0 ? { conditionNotes } : {}),
    exhaustionLevel,
    concentration: lifeState === 'conscious' ? sanitizeConcentration(raw.concentration) : null,
    // A magia sustentada pela sua concentração não fica sem ela (quem não está consciente não se
    // concentra, acima).
    activeEffects: sanitizeActiveEffects(raw.activeEffects)
      .filter(a => !a.sustainedByConcentration || (lifeState === 'conscious' && sanitizeConcentration(raw.concentration) !== null)),
    turn: sanitizeTurn(raw.turn),
    restCounters: sanitizeCounts(raw.restCounters),
    inspiration: raw.inspiration === true,
    note: typeof raw.note === 'string' ? raw.note : '',
    rolls: Array.isArray(raw.rolls) ? raw.rolls.filter(isRollRecord).slice(-ROLL_HISTORY_LIMIT) : [],
    ...(typeof raw.lastLongRestAt === 'number' && Number.isFinite(raw.lastLongRestAt)
      ? { lastLongRestAt: raw.lastLongRestAt }
      : {}),
    ...(sheetSnapshot ? { sheetSnapshot } : {}),
  }
}
