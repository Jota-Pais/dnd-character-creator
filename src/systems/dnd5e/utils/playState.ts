import type { RollRecord } from '../../../core/dice'
import type { ConditionId, ExhaustionLevel } from '../types/condition'
import {
  CONDITION_NOTE_MAX_LENGTH, HIT_DIE_SIZES, PLAY_STATE_VERSION, ROLL_HISTORY_LIMIT,
  type Concentration, type DamageInput, type DeathSaveCount, type LifeState, type PlayNotice, type PlayNoticeKind,
  type PlayResult, type PlaySheet, type PlayState, type SheetSnapshot, type SheetSnapshotSpellcasting,
} from '../types/playState'
import {
  getActiveConditionEffects, getCondition, getEffectiveConditions, getEffectiveHpMax,
  applyConditionSpeed, halveSpeedOnGrid, withConditionApplied,
  type ActiveConditionEffects, type ConditionState,
} from './sheetEffects'
import { formatMeters } from './abilityScoreUtils'
import { countLabel } from './textUtils'

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
 * O que o agregador de condições (`sheetEffects.ts`) recebe deste estado: as condições gravadas,
 * mais o Inconsciente enquanto o personagem está a 0 PV (`regras-condicoes.md`, 6.4).
 */
export function getPlayConditionState(state: PlayState): ConditionState {
  const conditions: ConditionId[] = isAtZeroHp(state) && !state.conditions.includes('unconscious')
    ? [...state.conditions, 'unconscious']
    : [...state.conditions]
  return { conditions, exhaustion: state.exhaustionLevel }
}

/** Efeitos ativos das condições e da exaustão deste estado (o mesmo agregador da ficha). */
export function getPlayConditionEffects(state: PlayState): ActiveConditionEffects {
  return getActiveConditionEffects(getPlayConditionState(state))
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
  return getEffectiveHpMax(baseMax, getPlayConditionEffects(state))
}

/**
 * A linha que explica por que a Exaustão 4 (ou mais) não cortou o PV máximo: só com a
 * característica que o impede (Acostumado à Morte-Vida) e a exaustão que corta. `null` fora disso.
 */
export function describeHpMaxImmunity(state: PlayState, sheet: PlaySheet): string | null {
  if (!sheet.hpMaxReductionImmunity) return null
  if (getPlayConditionEffects(state).hpMax.multiplier === 1) return null
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
  return applyConditionSpeed(sheet.speed, getPlayConditionEffects(state))
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
 * Encaixa o estado nos máximos da ficha atual: gasto nunca acima do máximo, tipos de Dado de Vida
 * e recursos que a ficha não tem mais saem, a 0 PV e morto o dano é o máximo, e vale o invariante
 * `máx. da ficha − damageTaken ≤ máx. efetivo` (o corte da exaustão 4, decisão 4).
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
  if (state.lifeState !== 'conscious') return done(next)
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
  return done(next, notices)
}

// ── Transições de vida (internas, mutam o rascunho `next` da operação) ─────────

function endConcentrationInto(next: PlayState, notices: PlayNotice[], reason: string): void {
  if (!next.concentration) return
  notices.push(note('concentrationEnded', `A concentração em ${next.concentration.label} terminou: ${reason}.`))
  next.concentration = null
}

function toDead(next: PlayState, notices: PlayNotice[], why: string): void {
  next.lifeState = 'dead'
  notices.push(note('died', why))
  endConcentrationInto(next, notices, 'morte (pág. 205)')
}

/**
 * Queda a 0 PV, morrendo ou estável (nocaute): o `onApply` do Inconsciente vale aqui, porque o
 * Inconsciente dos 0 PV não é "aplicado" (`regras-condicoes.md`, 6.4): grava o Caído, avisa de
 * largar o que segura e encerra a concentração.
 */
function toZeroHp(next: PlayState, notices: PlayNotice[], lifeState: 'dying' | 'stable'): void {
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
  endConcentrationInto(next, notices, 'ficou inconsciente (pág. 205)')
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

/**
 * Um evento de dano (`regras-dano-e-morte.md`, "Ordem de aplicação de um dano recebido"):
 * imunidade de condição ao tipo informado (Petrificado: veneno → 0); piso 0; resistência informada
 * ou do Petrificado (uma só, metade para baixo); PV temporários
 * absorvem primeiro; consciente → 0 PV com morte instantânea pelo máximo EFETIVO (assumido C),
 * nocaute → estável; já a 0 PV → +1 fracasso (2 se crítico), mesmo se os temporários absorvem
 * tudo (decisão 5), e o estável volta a morrer (assumido D). Concentração: aviso de TR de CON com
 * CD max(10, ⌊total/2⌋), contando o absorvido (assumido E); 0 PV e morte a encerram (assumido F).
 *
 * Quem cai a 0 PV sem morrer e tem a Resistência Implacável com uso recebe também o aviso
 * `dropToOneHp`, com o dano: a tela desfaz e reaplica por `applyDamageDroppingToOneHp`.
 */
export function applyDamage(state0: PlayState, sheet: PlaySheet, input: DamageInput): PlayResult {
  return damagePipeline(state0, sheet, input, false)
}

/**
 * O mesmo evento de dano de `applyDamage`, usando a Resistência Implacável (pág. 41): quando ele
 * deixaria o personagem a 0 PV sem matar, ele fica com 1 PV e gasta um uso do recurso — sem cair
 * inconsciente, sem o Caído e sem perder a concentração (o TR de Constituição continua). Parte do
 * estado ANTERIOR ao dano (a tela desfaz antes). Se o traço não se aplica (sem uso, o dano não
 * leva a 0 PV ou mata na hora), aplica o dano normal e avisa — o dano nunca se perde.
 */
export function applyDamageDroppingToOneHp(state0: PlayState, sheet: PlaySheet, input: DamageInput): PlayResult {
  return damagePipeline(state0, sheet, input, true)
}

function damagePipeline(state0: PlayState, sheet: PlaySheet, input: DamageInput, dropToOneHp: boolean): PlayResult {
  if (!Number.isFinite(input.amount)) return refuse(state0, 'Valor de dano inválido.')
  if (state0.lifeState === 'dead') return refuse(state0, 'O personagem está morto: o dano não tem efeito.')
  const state = reconcilePlayState(state0, sheet)
  const notices: PlayNotice[] = []
  const effects = getPlayConditionEffects(state)

  // Imunidade de condição ao tipo informado (Petrificado: veneno, decisão de 2026-10-25): o dano
  // vira 0 e, como dano 0, não muda nada (abaixo).
  const immunity = input.damageType
    ? effects.damageImmunities.find(i => i.damageType === input.damageType)
    : undefined
  if (immunity) {
    notices.push(note('resisted', `Imune a ${immunity.damageLabel} (${immunity.sources.map(s => s.label).join(', ')}): o dano vira 0.`))
  }

  // Piso 0 (decisão 3) e resistência: várias contam como uma (pág. 199).
  const raw = immunity ? 0 : Math.max(0, Math.floor(input.amount))
  const resistedBy = immunity ? [] : [
    ...(input.resisted ? ['resistência'] : []),
    ...effects.resistAllDamage.sources.map(s => s.label),
  ]
  const total = resistedBy.length > 0 ? Math.floor(raw / 2) : raw
  if (resistedBy.length > 0) notices.push(note('resisted', `Resistência (${resistedBy.join(', ')}): ${raw} → ${total}.`))

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
  const next: PlayState = { ...state, tempHp: state.tempHp - absorbed }
  if (absorbed > 0) notices.push(note('tempHpAbsorbed', `Os PV temporários absorveram ${absorbed}.`))

  const drop = availableDropToOneHp(state, sheet)
  let dropped = false
  if (state.lifeState === 'conscious') {
    const current = getCurrentHp(state, sheet)
    if (rest < current) {
      next.damageTaken = state.damageTaken + rest
    } else {
      const overflow = rest - current
      next.damageTaken = sheetMax
      if (overflow >= effMax) {
        toDead(next, notices, `Morte instantânea: o dano que sobrou (${overflow}) é igual ou maior que o PV máximo (${effMax}) (pág. 199).`)
      } else if (dropToOneHp && drop) {
        // "Reduzido a 0 pontos de vida mas não é completamente morto": volta para 1 PV (pág. 41).
        dropped = true
        next.damageTaken = sheetMax - 1
        const spent = next.resourcesSpent[drop.resourceId] ?? 0
        if (getResourceAvailable(state, sheet, drop.resourceId) !== 'unlimited') {
          next.resourcesSpent = { ...next.resourcesSpent, [drop.resourceId]: spent + 1 }
        }
        notices.push(note('info', `${drop.source}: em vez de cair a 0 PV, ficou com 1 PV (gastou 1 uso).`))
      } else {
        toZeroHp(next, notices, input.knockout ? 'stable' : 'dying')
        if (drop) {
          notices.push({
            kind: 'dropToOneHp',
            text: `${drop.source}: em vez de cair a 0 PV, você pode ficar com 1 PV (gasta 1 uso).`,
            damage: { ...input },
          })
        }
      }
    }
  } else if (rest >= effMax) {
    toDead(next, notices, `Morte instantânea: ${rest} de dano a 0 PV é igual ou maior que o PV máximo (${effMax}) (pág. 199).`)
  } else {
    const added = input.critical ? 2 : 1
    const failures = toCount(state.deathSaves.failures + added)
    next.deathSaves = { ...state.deathSaves, failures }
    if (state.lifeState === 'stable') {
      next.lifeState = 'dying'
      notices.push(note('lostStability', 'Sofreu dano estável: deixa de estar estável e volta aos testes contra a morte (pág. 200).'))
    }
    notices.push(note('deathSaveFailure', `${added === 2 ? '2 fracassos (crítico)' : '1 fracasso'} no teste contra a morte por sofrer dano a 0 PV: ${failures}/3.`))
    if (failures >= 3) toDead(next, notices, 'Três fracassos no teste contra a morte (pág. 199).')
  }
  if (dropToOneHp && !dropped) {
    const source = sheet.dropToOneHp?.source ?? 'Ficar com 1 PV'
    notices.push(note('warning', `${source} não se aplica a este dano: só quando ele deixaria você a 0 PV sem matar na hora, e com um uso disponível. O dano foi aplicado normalmente.`))
  }

  checkConcentration(next, notices)
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
    toDead(next, notices, 'Três fracassos no teste contra a morte (pág. 199).')
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

// ── Condições e exaustão ────────────────────────────────────────────────────

/** Encerra a concentração se o estado novo incapacita ou mata (assumido F). */
function checkConcentration(next: PlayState, notices: PlayNotice[]): void {
  if (!next.concentration) return
  const ends = getPlayConditionEffects(next).endsConcentration
  if (ends.active) endConcentrationInto(next, notices, `${ends.sources.map(s => s.label).join(', ')} (pág. 205)`)
}

/**
 * Aplica uma condição gravada, com o `onApply` dela (Inconsciente grava o Caído e avisa de largar o
 * que segura). Condição que incapacita encerra a concentração (assumido F).
 */
export function addCondition(state: PlayState, id: ConditionId): PlayResult {
  const cond = getCondition(id)
  if (!cond) return refuse(state, `Condição desconhecida: ${id}.`)
  if (state.conditions.includes(id)) return done(state)
  const notices: PlayNotice[] = []
  const next: PlayState = { ...state, conditions: withConditionApplied(state.conditions, id) }
  if (cond.onApply?.dropHeldItems) notices.push(note('droppedItems', 'Largou o que estava segurando (pág. 292).'))
  checkConcentration(next, notices)
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
 * Levantar-se (págs. 192-193): tira o Caído. Recusa com deslocamento efetivo 0 (o livro proíbe);
 * o custo de metade do deslocamento fica como aviso, porque o app não conta movimento.
 */
export function standUp(state: PlayState, sheet: PlaySheet): PlayResult {
  if (!state.conditions.includes('prone')) return refuse(state, 'O personagem não está Caído.')
  const speed = getPlaySpeed(state, sheet)
  if (speed <= 0) return refuse(state, 'Com deslocamento 0 não é possível se levantar (pág. 193).')
  return done(
    withoutCondition(state, 'prone'),
    [note('info', `Levantar-se custa metade do deslocamento (${formatMeters(halveSpeedOnGrid(speed))}) (pág. 192).`)],
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
    if (state.lifeState !== 'dead') toDead(next, notices, 'Exaustão 6: morte, com 0 PV (pág. 292).')
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
  checkConcentration(next, notices)
  return done(next, notices)
}

// ── Concentração, inspiração, nota, histórico ───────────────────────────────

/**
 * Começa a se concentrar. Uma concentração por vez (pág. 205): a anterior termina, com aviso.
 * Recusa a quem não está consciente ou está incapacitado.
 */
export function startConcentration(
  state: PlayState,
  spell: { spellId?: string; label: string },
  now: number,
): PlayResult {
  const label = spell.label.trim()
  if (!label) return refuse(state, 'Informe a magia da concentração.')
  if (state.lifeState !== 'conscious') return refuse(state, 'Só um personagem consciente pode se concentrar.')
  const ends = getPlayConditionEffects(state).endsConcentration
  if (ends.active) return refuse(state, `Não é possível se concentrar: ${ends.sources.map(s => s.label).join(', ')}.`)
  const notices: PlayNotice[] = []
  if (state.concentration) {
    notices.push(note('concentrationReplaced', `A concentração em ${state.concentration.label} termina: não dá para se concentrar em duas magias (pág. 205).`))
  }
  const concentration: Concentration = { ...(spell.spellId ? { spellId: spell.spellId } : {}), label, startedAt: now }
  return done({ ...state, concentration }, notices)
}

/** Encerra a concentração (voluntário, ou fracasso no TR de Constituição). */
export function endConcentration(state: PlayState): PlayResult {
  if (!state.concentration) return done(state)
  const notices: PlayNotice[] = []
  const next = { ...state }
  endConcentrationInto(next, notices, 'encerrada')
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
}

/**
 * Prévia pura do que o descanso curto devolve além dos Dados de Vida (`regras-descanso.md`, 6.2):
 * os espaços de Pacto e os recursos `'short'`. É a mesma conta do `completeShortRest`.
 */
export function previewShortRest(state0: PlayState, sheet: PlaySheet): ShortRestPreview {
  const state = reconcilePlayState(state0, sheet)
  return {
    pactSlots: state.pactSlotsSpent,
    resources: sheet.resources
      .filter(r => r.recharge === 'short' && (state.resourcesSpent[r.id] ?? 0) > 0)
      .map(r => ({ id: r.id, name: r.name, amount: state.resourcesSpent[r.id] })),
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
 * Conclui o descanso curto: voltam os espaços de Pacto (pág. 58) e os recursos de recarga
 * `'short'`. O pool combinado só volta no longo (`regras-descanso.md`, 6.3). Os Dados de Vida
 * gastos com `spendHitDie` já estão no estado e não voltam aqui.
 *
 * Canção de Descanso (bardo 2+): o dado extra não está automatizado — vira UM aviso, só se algum
 * Dado de Vida foi gasto neste descanso (`regras-descanso.md`, 6.2 e 6.4; pág. 54).
 */
export function completeShortRest(state0: PlayState, sheet: PlaySheet, options: ShortRestOptions = {}): PlayResult {
  if (state0.lifeState === 'dead') return refuse(state0, 'O personagem está morto.')
  const state = reconcilePlayState(state0, sheet)
  const preview = previewShortRest(state, sheet)
  const recovered: string[] = []
  if (preview.pactSlots > 0) recovered.push(countLabel(preview.pactSlots, 'espaço de Pacto', 'espaços de Pacto'))
  const resourcesSpent = { ...state.resourcesSpent }
  for (const r of preview.resources) {
    recovered.push(r.name)
    delete resourcesSpent[r.id]
  }
  const notices = recovered.length > 0 ? [note('recovered', `Descanso curto concluído. De volta: ${recovered.join(', ')}.`)] : []
  const song = sheet.resources.find(r => r.id === SONG_OF_REST_ID)
  if (song && (options.hitDiceSpent ?? 0) > 0) {
    const die = song.die ? ` (${song.die})` : ''
    notices.push(note('warning', `${song.name}${die} não está automatizada: como gastou Dados de Vida neste descanso, role o dado uma vez e aplique como cura (pág. 54).`))
  }
  return done({ ...state, pactSlotsSpent: 0, resourcesSpent }, notices)
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
  exhaustion: { before: ExhaustionLevel; after: ExhaustionLevel }
  /** Avisos fixos da prévia (24 horas, interrupção). */
  notices: PlayNotice[]
}

const LONG_REST_RECHARGES = new Set(['short', 'long', 'day'])

/**
 * Prévia pura do descanso longo (pág. 188): o que volta e o que não. PV até o máximo efetivo
 * DEPOIS do −1 de exaustão (`regras-descanso.md`, 6.1 e Ponto em aberto 12), metade dos Dados de
 * Vida, todos os espaços, recursos `'short'`/`'long'`/`'day'` (assumido B), fim dos PV
 * temporários. Com 0 PV no início, nenhum benefício (assumido A).
 */
export function previewLongRest(state0: PlayState, sheet: PlaySheet, options: LongRestOptions = {}): LongRestPreview {
  const ateAndDrank = options.ateAndDrank ?? true
  const state = reconcilePlayState(state0, sheet)
  const current = getCurrentHp(state, sheet)
  const notices = [
    note('info', 'Só um descanso longo a cada 24 horas no jogo (pág. 188).'),
    note('info', 'Confirme só o descanso que terminou: 1 hora de caminhada, combate ou conjuração interrompe e ele recomeça (pág. 188).'),
  ]
  const blockReason = state.lifeState === 'dead'
    ? 'O personagem está morto: o descanso longo não dá benefícios.'
    : current === 0
      ? 'É preciso ter pelo menos 1 PV no início do descanso longo para obter seus benefícios (pág. 188). Quem está estável recupera 1 PV depois de 1d4 horas (pág. 200).'
      : undefined
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
 */
export function completeLongRest(state0: PlayState, sheet: PlaySheet, options: LongRestCompletion = {}): PlayResult {
  const preview = previewLongRest(state0, sheet, options)
  if (preview.blocked) return refuse(state0, preview.blockReason ?? 'Descanso longo sem benefícios.')
  const state = reconcilePlayState(state0, sheet)

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
    deathSaves: { ...ZERO_SAVES },
    ...(options.now !== undefined ? { lastLongRestAt: options.now } : {}),
  }

  const parts = [
    `PV ${preview.hp.before} → ${preview.hp.after}`,
    ...(chosen > 0 ? [countLabel(chosen, 'Dado de Vida', 'Dados de Vida')] : []),
    ...(preview.maxHpAdjustmentEnds !== 0 ? [`o ajuste do PV máximo (${formatHpAdjustment(preview.maxHpAdjustmentEnds)}) acabou`] : []),
    ...(preview.exhaustion.after < preview.exhaustion.before ? [`exaustão ${preview.exhaustion.before} → ${preview.exhaustion.after}`] : []),
  ]
  return done(next, [note('recovered', `Descanso longo: ${parts.join('; ')}.`)])
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
 * O retrato da ficha só vale inteiro: torto em qualquer parte, sai (a próxima abertura tira outro,
 * sem aviso — melhor calar uma correção do que inventar uma).
 */
function sanitizeSheetSnapshot(x: unknown): SheetSnapshot | null {
  if (!isRecord(x)) return null
  const { sheetUpdatedAt, draftFingerprint, maxHp, armorClass, spellcasting, spellSlots, pactSlots } = x
  if (typeof sheetUpdatedAt !== 'number' || !Number.isFinite(sheetUpdatedAt)) return null
  if (typeof draftFingerprint !== 'string' || !isInt(maxHp) || !isInt(armorClass)) return null
  if (!Array.isArray(spellcasting) || !Array.isArray(spellSlots) || spellSlots.length !== SPELL_LEVELS) return null
  if (!spellSlots.every(n => isInt(n) && n >= 0)) return null
  const casting = spellcasting.filter((c): c is SheetSnapshotSpellcasting =>
    isRecord(c) && typeof c.key === 'string' && typeof c.label === 'string' && isInt(c.saveDc) && isInt(c.attackBonus))
  if (casting.length !== spellcasting.length) return null
  if (pactSlots !== null && !(isRecord(pactSlots) && isInt(pactSlots.slots) && isInt(pactSlots.slotLevel))) return null
  return {
    sheetUpdatedAt,
    draftFingerprint,
    maxHp,
    armorClass,
    spellcasting: casting.map(({ key, label, saveDc, attackBonus }) => ({ key, label, saveDc, attackBonus })),
    spellSlots: [...spellSlots],
    pactSlots: pactSlots === null ? null : { slots: pactSlots.slots as number, slotLevel: pactSlots.slotLevel as number },
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
  const resourcesSpent: Record<string, number> = {}
  if (isRecord(raw.resourcesSpent)) {
    for (const [id, value] of Object.entries(raw.resourcesSpent)) {
      const n = nonNegInt(value)
      if (id && n > 0) resourcesSpent[id] = n
    }
  }

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
    resourcesSpent,
    conditions,
    ...(Object.keys(conditionNotes).length > 0 ? { conditionNotes } : {}),
    exhaustionLevel,
    concentration: lifeState === 'conscious' ? sanitizeConcentration(raw.concentration) : null,
    inspiration: raw.inspiration === true,
    note: typeof raw.note === 'string' ? raw.note : '',
    rolls: Array.isArray(raw.rolls) ? raw.rolls.filter(isRollRecord).slice(-ROLL_HISTORY_LIMIT) : [],
    ...(typeof raw.lastLongRestAt === 'number' && Number.isFinite(raw.lastLongRestAt)
      ? { lastLongRestAt: raw.lastLongRestAt }
      : {}),
    ...(sheetSnapshot ? { sheetSnapshot } : {}),
  }
}
