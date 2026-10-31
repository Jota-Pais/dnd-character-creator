import { describe, it, expect } from 'vitest'
import { roll, sequenceRoller } from '../../../../core/dice'
import type { PlaySheet, PlayState } from '../../types/playState'
import { CONDITION_NOTE_MAX_LENGTH, PLAY_STATE_VERSION, ROLL_HISTORY_LIMIT } from '../../types/playState'
import type { SheetResource } from '../classResourceUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { buildPlaySheet } from '../playSheet'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import {
  activateToggle, addCondition, adjustMaxHp, applyDamage, applyDamageDroppingToOneHp, applyHealing, clearRollHistory, clearTempHp, completeLongRest, completeShortRest,
  createPlayState, deactivateToggle, describeHpMaxImmunity, emptyTurn, endConcentration, getBaseMaxHp, getTurnActions, getTurnMovement, getCurrentHp, getEffectiveMaxHp, getHitDiceAvailable,
  getLongRestHitDiceRecoverable, getPactSlotsAvailable, getPlayEffects, getPlayConditionState, getPlayDamageDefenses, getPlaySpeed,
  getResourceAvailable, getShortRestSlotRecovery, performAction, getSpellSlotsAvailable, grantTempHp, previewLongRest, previewShortRest, reconcileLoadedPlayState,
  markTurn, newTurn, reconcilePlayState,
  recordDeathSave, recordRoll, recoverPactSlot, regainHpWhileStable, recoverResource, recoverSpellSlot, removeCondition,
  revive, sanitizePlayState, setConditionNote, setExhaustion, setInspiration, setNote, spendHitDie, spendPactSlot,
  spendResource, spendSpellSlot, stabilize, standUp, startConcentration, suggestLongRestHitDice,
  suggestTempHpChoice,
} from '../playState'

// ── Montagem ─────────────────────────────────────────────────────────────────

function resource(id: string, uses: SheetResource['uses'], recharge?: SheetResource['recharge']): SheetResource {
  return {
    id,
    name: id,
    source: { kind: 'class', id: 'fighter', name: 'Guerreiro' },
    ...(uses !== undefined ? { uses } : {}),
    unit: 'uses',
    ...(recharge ? { recharge } : {}),
    sharedWith: [],
    addedFrom: [],
  }
}

const ZERO = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }

function sheet(overrides: Partial<PlaySheet> = {}): PlaySheet {
  return {
    maxHp: 20,
    abilityScores: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    abilityModifiers: { ...ZERO, CON: 2 },
    conModifier: 2,
    proficiencyBonus: 2,
    savingThrows: {
      STR: { bonus: 0, proficient: false }, DEX: { bonus: 0, proficient: false },
      CON: { bonus: 4, proficient: true }, INT: { bonus: 0, proficient: false },
      WIS: { bonus: 0, proficient: false }, CHA: { bonus: 0, proficient: false },
    },
    initiativeBonus: 0,
    speed: 30,
    hitDice: [{ die: 8, count: 4 }],
    spellSlots: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    pactSlots: null,
    resources: [
      resource('second-wind', 1, 'short'),
      resource('rage', 3, 'long'),
      resource('arcane-recovery', 1, 'day'),
      resource('relentless', 1),
      resource('infinite', 'unlimited'),
      resource('die-only', undefined),
      { ...resource('lay-on-hands', 20, 'long'), unit: 'hp' },
    ],
    featIds: [],
    defenses: [],
    toggles: [],
    actions: [],
    ...overrides,
  }
}

const S = sheet()

function state(overrides: Partial<PlayState> = {}): PlayState {
  return { ...createPlayState('char-1', 1000), ...overrides }
}

const kinds = (r: { notices: { kind: string }[] }) => r.notices.map(n => n.kind)

/** O invariante da exaustão 4: o PV atual nunca passa do máximo efetivo. */
function expectInvariant(s: PlayState, sh: PlaySheet) {
  expect(getBaseMaxHp(s, sh) - s.damageTaken).toBeLessThanOrEqual(getEffectiveMaxHp(s, sh))
}

// ── Estado novo e leituras ────────────────────────────────────────────────────

describe('createPlayState', () => {
  it('começa sem gasto nenhum, consciente, na versão atual', () => {
    const s = createPlayState('abc', 42)
    expect(s.version).toBe(PLAY_STATE_VERSION)
    expect(s.characterId).toBe('abc')
    expect(s.updatedAt).toBe(42)
    expect(s.damageTaken).toBe(0)
    expect(s.lifeState).toBe('conscious')
    expect(s.spellSlotsSpent).toHaveLength(9)
    expect(s.concentration).toBeNull()
    expect(s.turn).toEqual(emptyTurn())
    expect(getCurrentHp(s, S)).toBe(20)
  })
})

describe('leituras derivadas', () => {
  it('a 0 PV o Inconsciente é derivado, sem ser gravado', () => {
    const s = state({ lifeState: 'dying', damageTaken: 20 })
    expect(getPlayConditionState(s).conditions).toContain('unconscious')
    expect(s.conditions).not.toContain('unconscious')
    const fx = getPlayEffects(s, S)
    expect(fx.savingThrows.STR.autoFail.length).toBeGreaterThan(0)
    expect(fx.endsConcentration.active).toBe(true)
  })

  it('máximo efetivo é metade, para baixo, a partir da exaustão 4', () => {
    expect(getEffectiveMaxHp(state({ exhaustionLevel: 3 }), sheet({ maxHp: 21 }))).toBe(21)
    expect(getEffectiveMaxHp(state({ exhaustionLevel: 4 }), sheet({ maxHp: 21 }))).toBe(10)
  })

  it('Dados de Vida, espaços e recursos disponíveis', () => {
    const s = state({ hitDiceSpent: { 8: 3 }, spellSlotsSpent: [1, 3, 0, 0, 0, 0, 0, 0, 0], resourcesSpent: { rage: 2 } })
    expect(getHitDiceAvailable(s, S)).toEqual([{ die: 8, total: 4, spent: 3, available: 1 }])
    expect(getSpellSlotsAvailable(s, S).slice(0, 2)).toEqual([3, 0])
    expect(getResourceAvailable(s, S, 'rage')).toBe(1)
    expect(getResourceAvailable(s, S, 'infinite')).toBe('unlimited')
    expect(getResourceAvailable(s, S, 'die-only')).toBeNull()
    expect(getResourceAvailable(s, S, 'nope')).toBeNull()
  })
})

// ── Dano ─────────────────────────────────────────────────────────────────────

describe('applyDamage', () => {
  it('PV temporários absorvem primeiro (5 temporários e 7 de dano: perde os 5 e sofre 2, pág. 200)', () => {
    const r = applyDamage(state({ tempHp: 5 }), S, { amount: 7 })
    expect(r.state.tempHp).toBe(0)
    expect(getCurrentHp(r.state, S)).toBe(18)
    expect(kinds(r)).toContain('tempHpAbsorbed')
  })

  it('dano negativo tem piso 0 e nunca vira cura (decisão 3)', () => {
    const s = state({ damageTaken: 5 })
    const r = applyDamage(s, S, { amount: -3 })
    expect(r.state).toBe(s)
  })

  it('resistência: metade arredondada para baixo', () => {
    const r = applyDamage(state(), S, { amount: 7, resisted: true })
    expect(getCurrentHp(r.state, S)).toBe(17)
    expect(kinds(r)).toContain('resisted')
  })

  it('Petrificado aplica a resistência sozinho, e não acumula com outra (metade, não um quarto)', () => {
    const s = state({ conditions: ['petrified'] })
    expect(getCurrentHp(applyDamage(s, S, { amount: 9 }).state, S)).toBe(16)
    expect(getCurrentHp(applyDamage(s, S, { amount: 9, resisted: true }).state, S)).toBe(16)
  })

  it('Petrificado: dano de veneno vira 0 (imunidade) e não muda nada; sem o tipo, só a resistência', () => {
    const s = state({ conditions: ['petrified'], damageTaken: 2 })
    const r = applyDamage(s, S, { amount: 9, damageType: 'poison' })
    expect(r.state).toBe(s)
    expect(r.notices.map(n => n.text)).toEqual([
      'Imune a dano de veneno (Petrificado): o dano vira 0.',
      'Dano total 0: não conta como dano. Nada foi alterado.',
    ])
    expect(getCurrentHp(applyDamage(s, S, { amount: 9 }).state, S)).toBe(14)
    // Sem a condição, o tipo não muda nada.
    expect(getCurrentHp(applyDamage(state(), S, { amount: 9, damageType: 'poison' }).state, S)).toBe(11)
  })

  it('Petrificado suspende o Envenenado, aplicado antes ou depois, e ele volta ao sair', () => {
    const before = addCondition(addCondition(state(), S, 'poisoned').state, S, 'petrified').state
    const after = addCondition(addCondition(state(), S, 'petrified').state, S, 'poisoned').state
    for (const s of [before, after]) {
      const poisoned = getPlayEffects(s, S).conditions.find(c => c.id === 'poisoned')
      expect(poisoned?.suspendedBy).toEqual(['petrified'])
      expect(getPlayEffects(s, S).attack.disadvantage).toEqual([])
    }
    const freed = removeCondition(after, 'petrified').state
    expect(getPlayEffects(freed, S).attack.disadvantage.map(d => d.label)).toEqual(['Envenenado'])
  })

  it('cair a 0 PV: morrendo, Caído gravado, aviso de largar o que segura e fim da concentração', () => {
    const s = state({ damageTaken: 15, concentration: { label: 'Bênção', startedAt: 0 } })
    const r = applyDamage(s, S, { amount: 8 })
    expect(r.state.lifeState).toBe('dying')
    expect(getCurrentHp(r.state, S)).toBe(0)
    expect(r.state.conditions).toContain('prone')
    expect(r.state.conditions).not.toContain('unconscious')
    expect(r.state.concentration).toBeNull()
    expect(kinds(r)).toEqual(expect.arrayContaining(['fellUnconscious', 'droppedItems', 'concentrationEnded']))
    expect(kinds(r)).not.toContain('concentrationCheck')
  })

  it('PV temporários não somem ao cair a 0 PV (decisão 6)', () => {
    const r = applyDamage(state({ damageTaken: 15, tempHp: 3 }), S, { amount: 10 })
    expect(r.state.tempHp).toBe(0)
    const r2 = applyDamage(state({ damageTaken: 18 }), S, { amount: 2 })
    expect(r2.state.lifeState).toBe('dying')
    const withTemp = grantTempHp(r2.state, 4).state
    expect(applyDamage(withTemp, S, { amount: 1 }).state.tempHp).toBe(3)
  })

  it('nocaute: inconsciente e estável', () => {
    const r = applyDamage(state({ damageTaken: 18 }), S, { amount: 5, knockout: true })
    expect(r.state.lifeState).toBe('stable')
    expect(r.state.conditions).toContain('prone')
  })

  it('nocaute com dano massivo: a morte instantânea vence o nocaute', () => {
    const r = applyDamage(state({ damageTaken: 10 }), S, { amount: 31, knockout: true })
    expect(r.state.lifeState).toBe('dead')
    expect(kinds(r)).toContain('died')
    expect(kinds(r)).not.toContain('fellUnconscious')
  })

  it('morte instantânea (exemplo do livro: máximo 12, com 6 PV, sofre 18)', () => {
    const sh = sheet({ maxHp: 12 })
    const r = applyDamage(state({ damageTaken: 6 }), sh, { amount: 18 })
    expect(r.state.lifeState).toBe('dead')
    expect(kinds(r)).toContain('died')
    // 17 de dano deixaria sobrar 11 < 12: só cai.
    expect(applyDamage(state({ damageTaken: 6 }), sh, { amount: 17 }).state.lifeState).toBe('dying')
  })

  it('morte instantânea usa o máximo EFETIVO (assumido C)', () => {
    // máximo 20, exaustão 4 → efetivo 10, com 10 PV; 20 de dano sobra 10 ≥ 10.
    const s = state({ exhaustionLevel: 4, damageTaken: 10 })
    expect(applyDamage(s, S, { amount: 20 }).state.lifeState).toBe('dead')
    expect(applyDamage(s, S, { amount: 19 }).state.lifeState).toBe('dying')
  })

  it('dano a 0 PV: 1 fracasso, 2 se crítico', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20 })
    expect(applyDamage(dying, S, { amount: 3 }).state.deathSaves.failures).toBe(1)
    expect(applyDamage(dying, S, { amount: 3, critical: true }).state.deathSaves.failures).toBe(2)
  })

  it('dano a 0 PV totalmente absorvido pelos PV temporários CONTA fracasso (decisão 5)', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20, tempHp: 10 })
    const r = applyDamage(dying, S, { amount: 4 })
    expect(r.state.tempHp).toBe(6)
    expect(r.state.deathSaves.failures).toBe(1)
    expect(kinds(r)).toContain('deathSaveFailure')
  })

  it('terceiro fracasso por dano mata', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20, deathSaves: { successes: 1, failures: 2 } })
    expect(applyDamage(dying, S, { amount: 1 }).state.lifeState).toBe('dead')
  })

  it('a 0 PV, dano ≥ máximo mata na hora', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20 })
    expect(applyDamage(dying, S, { amount: 20 }).state.lifeState).toBe('dead')
  })

  it('estável que sofre dano volta a morrer, com o fracasso (assumido D)', () => {
    const r = applyDamage(state({ lifeState: 'stable', damageTaken: 20 }), S, { amount: 2, critical: true })
    expect(r.state.lifeState).toBe('dying')
    expect(r.state.deathSaves.failures).toBe(2)
    expect(kinds(r)).toContain('lostStability')
  })

  it('aviso de concentração: CD max(10, metade), contando o absorvido (assumido E)', () => {
    const c = { label: 'Bênção', startedAt: 0 }
    const r1 = applyDamage(state({ concentration: c }), S, { amount: 7 })
    expect(r1.notices.find(n => n.kind === 'concentrationCheck')?.dc).toBe(10)
    const r2 = applyDamage(state({ concentration: c, tempHp: 10 }), sheet({ maxHp: 40 }), { amount: 25 })
    expect(r2.notices.find(n => n.kind === 'concentrationCheck')?.dc).toBe(12)
    expect(r2.state.concentration).toEqual(c)
  })

  it('dano total 0 não é dano: sem fracasso a 0 PV nem TR de concentração (Ponto em aberto 19)', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20 })
    const r = applyDamage(dying, S, { amount: 1, resisted: true })
    expect(r.state).toBe(dying)
    expect(kinds(r)).toEqual(['resisted', 'info'])
    const concentrating = state({ concentration: { label: 'Bênção', startedAt: 0 } })
    expect(kinds(applyDamage(concentrating, S, { amount: 0 }))).toEqual(['info'])
  })

  it('morto: recusa e devolve o mesmo estado', () => {
    const dead = state({ lifeState: 'dead', damageTaken: 20 })
    const r = applyDamage(dead, S, { amount: 5 })
    expect(r.state).toBe(dead)
    expect(kinds(r)).toEqual(['refused'])
  })

  it('valor não numérico é recusado', () => {
    const s = state()
    expect(applyDamage(s, S, { amount: Number.NaN }).state).toBe(s)
  })
})

describe('Resistência Implacável (ficar com 1 PV em vez de cair, pág. 41)', () => {
  const HO = sheet({ dropToOneHp: { resourceId: 'relentless', source: 'Resistência Implacável' } })
  const concentrating = { concentration: { label: 'Bênção', startedAt: 0 } }

  it('cair a 0 PV sem morrer, com uso: cai normalmente e avisa, levando o dano', () => {
    const r = applyDamage(state(), HO, { amount: 25, critical: true })
    expect(r.state.lifeState).toBe('dying')
    const offer = r.notices.find(n => n.kind === 'dropToOneHp')
    expect(offer?.text).toContain('Resistência Implacável')
    expect(offer?.damage).toEqual({ amount: 25, critical: true })
  })

  it('applyDamageDroppingToOneHp: o mesmo dano termina em 1 PV, gasta o uso, sem Caído e com o TR de concentração', () => {
    const r = applyDamageDroppingToOneHp(state({ tempHp: 3, ...concentrating }), HO, { amount: 25 })
    expect(r.state.lifeState).toBe('conscious')
    expect(getCurrentHp(r.state, HO)).toBe(1)
    expect(r.state.tempHp).toBe(0)
    expect(r.state.resourcesSpent).toEqual({ relentless: 1 })
    expect(getResourceAvailable(r.state, HO, 'relentless')).toBe(0)
    expect(r.state.conditions).toEqual([])
    expect(r.state.concentration?.label).toBe('Bênção')
    expect(kinds(r)).toEqual(['tempHpAbsorbed', 'info', 'concentrationCheck'])
    expect(r.notices.find(n => n.kind === 'concentrationCheck')?.dc).toBe(12)
  })

  it('sem uso, sem o traço ou com morte instantânea: nem aviso, nem 1 PV', () => {
    const spent = state({ resourcesSpent: { relentless: 1 } })
    expect(kinds(applyDamage(spent, HO, { amount: 25 }))).not.toContain('dropToOneHp')
    expect(kinds(applyDamage(state(), S, { amount: 25 }))).not.toContain('dropToOneHp')
    const massive = applyDamage(state(), HO, { amount: 40 })
    expect(massive.state.lifeState).toBe('dead')
    expect(kinds(massive)).not.toContain('dropToOneHp')
    // Dano que não derruba: nada a oferecer.
    expect(kinds(applyDamage(state(), HO, { amount: 5 }))).not.toContain('dropToOneHp')
  })

  it('pedido sem caber (sem uso, ou o dano não derruba): aplica o dano normal e avisa — o dano nunca se perde', () => {
    const spent = applyDamageDroppingToOneHp(state({ resourcesSpent: { relentless: 1 } }), HO, { amount: 25 })
    expect(spent.state.lifeState).toBe('dying')
    expect(kinds(spent)).toContain('warning')
    const light = applyDamageDroppingToOneHp(state(), HO, { amount: 5 })
    expect(getCurrentHp(light.state, HO)).toBe(15)
    expect(light.state.resourcesSpent).toEqual({})
    expect(kinds(light)).toContain('warning')
  })
})

// ── Cura e PV temporários ────────────────────────────────────────────────────

describe('applyHealing', () => {
  it('teto no máximo, excedente perdido (exemplo do livro: 14/20 + 8 recupera 6)', () => {
    const r = applyHealing(state({ damageTaken: 6 }), S, 8)
    expect(getCurrentHp(r.state, S)).toBe(20)
    expect(r.notices[0].text).toContain('Recuperou 6 PV')
  })

  it('teto no máximo efetivo com exaustão 4', () => {
    const r = applyHealing(state({ exhaustionLevel: 4, damageTaken: 15 }), S, 20)
    expect(getCurrentHp(r.state, S)).toBe(10)
    expectInvariant(r.state, S)
  })

  it('a 0 PV acorda, zera os contadores e o Caído continua (decisão 14)', () => {
    const s = state({ lifeState: 'dying', damageTaken: 20, deathSaves: { successes: 2, failures: 1 }, conditions: ['prone'] })
    const r = applyHealing(s, S, 3)
    expect(r.state.lifeState).toBe('conscious')
    expect(r.state.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(r.state.conditions).toContain('prone')
    expect(getCurrentHp(r.state, S)).toBe(3)
  })

  it('Inconsciente GRAVADO (sono mágico) não sai com a cura: o aviso não diz que acordou', () => {
    let s = addCondition(state(), S, 'unconscious').state
    s = applyDamage(s, S, { amount: 25 }).state
    expect(s.lifeState).toBe('dying')
    const r = applyHealing(s, S, 5)
    expect(r.state.lifeState).toBe('conscious')
    expect(r.state.conditions).toEqual(['unconscious', 'prone'])
    expect(kinds(r)).not.toContain('regainedConsciousness')
    const warning = r.notices.find(n => n.kind === 'warning')
    expect(warning?.text).toContain('continua Inconsciente (condição gravada)')
    expect(warning?.text).not.toContain('acordou')
    expect(getPlayEffects(r.state, S).noActions.active).toBe(true)
    // Sem o Inconsciente gravado, o aviso de sempre.
    expect(kinds(applyHealing(state({ lifeState: 'dying', damageTaken: 20 }), S, 2))).toContain('regainedConsciousness')
  })

  it('estável que recebe cura acorda, com os contadores zerados', () => {
    const stable = state({ lifeState: 'stable', damageTaken: 20, deathSaves: { successes: 0, failures: 1 } })
    const r = applyHealing(stable, S, 4)
    expect(r.state.lifeState).toBe('conscious')
    expect(r.state.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(getCurrentHp(r.state, S)).toBe(4)
    expect(kinds(r)).toContain('regainedConsciousness')
  })

  it('morto não recupera PV', () => {
    const dead = state({ lifeState: 'dead', damageTaken: 20 })
    expect(applyHealing(dead, S, 10).state).toBe(dead)
  })

  it('cura negativa ou zero não muda nada, e não mexe nos PV temporários', () => {
    const s = state({ damageTaken: 5, tempHp: 3 })
    expect(applyHealing(s, S, -4).state).toBe(s)
    expect(applyHealing(s, S, 2).state.tempHp).toBe(3)
  })
})

describe('grantTempHp', () => {
  it('sem temporários, fica com os novos', () => {
    expect(grantTempHp(state(), 8).state.tempHp).toBe(8)
  })

  it('não somam: sem a escolha recusa; manter ou trocar (10 e 12 dá 10 ou 12, nunca 22)', () => {
    const s = state({ tempHp: 10 })
    expect(grantTempHp(s, 12).state).toBe(s)
    expect(kinds(grantTempHp(s, 12))).toEqual(['refused'])
    expect(grantTempHp(s, 12, 'keep').state.tempHp).toBe(10)
    expect(grantTempHp(s, 12, 'replace').state.tempHp).toBe(12)
    expect(suggestTempHpChoice(s, 12)).toBe('replace')
    expect(suggestTempHpChoice(s, 4)).toBe('keep')
  })

  it('a 0 PV não acorda nem estabiliza', () => {
    const r = grantTempHp(state({ lifeState: 'dying', damageTaken: 20 }), 5)
    expect(r.state.lifeState).toBe('dying')
    expect(r.state.tempHp).toBe(5)
  })

  it('morto recusa, como a cura', () => {
    const dead = state({ lifeState: 'dead', damageTaken: 20 })
    const r = grantTempHp(dead, 5)
    expect(r.state).toBe(dead)
    expect(kinds(r)).toEqual(['refused'])
  })

  it('clearTempHp zera', () => {
    expect(clearTempHp(state({ tempHp: 4 })).state.tempHp).toBe(0)
  })
})

// ── Teste contra a morte, estabilizar, reviver ───────────────────────────────

describe('recordDeathSave', () => {
  const dying = state({ lifeState: 'dying', damageTaken: 20 })

  it('20 natural: recupera 1 PV e acorda', () => {
    const r = recordDeathSave({ ...dying, deathSaves: { successes: 0, failures: 2 } }, S, { natural: 20, total: 20 })
    expect(r.state.lifeState).toBe('conscious')
    expect(getCurrentHp(r.state, S)).toBe(1)
    expect(r.state.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('20 natural com Inconsciente GRAVADO: recupera 1 PV, mas continua Inconsciente', () => {
    const r = recordDeathSave({ ...dying, conditions: ['unconscious', 'prone'] }, S, { natural: 20, total: 20 })
    expect(r.state.lifeState).toBe('conscious')
    expect(getCurrentHp(r.state, S)).toBe(1)
    expect(kinds(r)).not.toContain('regainedConsciousness')
    expect(r.notices.find(n => n.kind === 'warning')?.text).toContain('continua Inconsciente')
  })

  it('1 natural conta 2 fracassos, mesmo com bônus que levaria o total a 10', () => {
    expect(recordDeathSave(dying, S, { natural: 1, total: 11 }).state.deathSaves.failures).toBe(2)
  })

  it('o 10 é comparado ao TOTAL (decisão 8)', () => {
    expect(recordDeathSave(dying, S, { natural: 8, total: 10 }).state.deathSaves.successes).toBe(1)
    expect(recordDeathSave(dying, S, { natural: 11, total: 9 }).state.deathSaves.failures).toBe(1)
  })

  it('3 sucessos: estável, contadores zerados', () => {
    const r = recordDeathSave({ ...dying, deathSaves: { successes: 2, failures: 2 } }, S, { natural: 15, total: 15 })
    expect(r.state.lifeState).toBe('stable')
    expect(r.state.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('3 fracassos: morto', () => {
    const r = recordDeathSave({ ...dying, deathSaves: { successes: 0, failures: 2 } }, S, { natural: 3, total: 3 })
    expect(r.state.lifeState).toBe('dead')
    expect(kinds(r)).toContain('died')
  })

  it('recusa quem não está morrendo e entrada inválida', () => {
    const s = state()
    expect(recordDeathSave(s, S, { natural: 12, total: 12 }).state).toBe(s)
    expect(recordDeathSave(dying, S, { natural: 21, total: 21 }).state).toBe(dying)
    expect(recordDeathSave(dying, S, { natural: 0, total: 0 }).state).toBe(dying)
  })
})

describe('stabilize e revive', () => {
  it('estabiliza quem está morrendo', () => {
    const r = stabilize(state({ lifeState: 'dying', damageTaken: 20, deathSaves: { successes: 1, failures: 2 } }))
    expect(r.state.lifeState).toBe('stable')
    expect(r.state.deathSaves).toEqual({ successes: 0, failures: 0 })
    const ok = state()
    expect(stabilize(ok).state).toBe(ok)
  })

  it('"fui revivido": consciente com 1 PV e contadores zerados (decisão 13)', () => {
    const r = revive(state({ lifeState: 'dead', damageTaken: 20, deathSaves: { successes: 1, failures: 3 } }), S)
    expect(r.state.lifeState).toBe('conscious')
    expect(getCurrentHp(r.state, S)).toBe(1)
    expect(r.state.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('estável sem cura: passadas 1d4 horas, recupera 1 PV e acorda (pág. 200)', () => {
    const r = regainHpWhileStable(state({ lifeState: 'stable', damageTaken: 20, conditions: ['prone'] }), S)
    expect(r.state.lifeState).toBe('conscious')
    expect(getCurrentHp(r.state, S)).toBe(1)
    expect(kinds(r)).toEqual(['healed', 'regainedConsciousness'])
    // Só para quem está estável.
    for (const lifeState of ['conscious', 'dying', 'dead'] as const) {
      const s = state({ lifeState, damageTaken: lifeState === 'conscious' ? 5 : 20 })
      const refused = regainHpWhileStable(s, S)
      expect(refused.state).toBe(s)
      expect(kinds(refused)).toEqual(['refused'])
    }
  })
  it('recusa quem não está morto, e a morte por exaustão 6 (Ponto em aberto 18)', () => {
    const alive = state()
    expect(revive(alive, S).state).toBe(alive)
    const ex6 = state({ lifeState: 'dead', exhaustionLevel: 6 })
    const r = revive(ex6, S)
    expect(r.state).toBe(ex6)
    expect(kinds(r)).toEqual(['unresolvedRule'])
  })
})

// ── Espaços e recursos ───────────────────────────────────────────────────────

describe('espaços de magia', () => {
  it('gasta até o limite e recusa depois', () => {
    let s = state()
    for (let i = 0; i < 3; i++) s = spendSpellSlot(s, S, 2).state
    expect(s.spellSlotsSpent[1]).toBe(3)
    const r = spendSpellSlot(s, S, 2)
    expect(r.state).toBe(s)
    expect(kinds(r)).toEqual(['refused'])
    expect(spendSpellSlot(state(), S, 3).notices[0].kind).toBe('refused')
    expect(spendSpellSlot(state(), S, 10).notices[0].kind).toBe('refused')
  })

  it('recupera sem passar de zero', () => {
    const s = spendSpellSlot(state(), S, 1).state
    expect(recoverSpellSlot(s, S, 1).state.spellSlotsSpent[0]).toBe(0)
    expect(recoverSpellSlot(state(), S, 1).notices[0].kind).toBe('refused')
  })

  it('Pacto separado, com limite; sem bruxo recusa', () => {
    const sh = sheet({ pactSlots: { slots: 2, slotLevel: 3 } })
    let s = spendPactSlot(state(), sh).state
    s = spendPactSlot(s, sh).state
    expect(getPactSlotsAvailable(s, sh)).toBe(0)
    expect(spendPactSlot(s, sh).state).toBe(s)
    expect(recoverPactSlot(s, sh).state.pactSlotsSpent).toBe(1)
    expect(spendPactSlot(state(), S).notices[0].kind).toBe('refused')
  })
})

describe('recursos', () => {
  it('gasta e recupera por id, com limites', () => {
    let s = spendResource(state(), S, 'rage').state
    s = spendResource(s, S, 'rage', 2).state
    expect(getResourceAvailable(s, S, 'rage')).toBe(0)
    expect(spendResource(s, S, 'rage').state).toBe(s)
    expect(recoverResource(s, S, 'rage', 3).state.resourcesSpent).toEqual({})
    expect(recoverResource(state(), S, 'rage').notices[0].kind).toBe('refused')
  })

  it('poço de PV gasta aos poucos', () => {
    const s = spendResource(state(), S, 'lay-on-hands', 7).state
    expect(getResourceAvailable(s, S, 'lay-on-hands')).toBe(13)
    expect(spendResource(s, S, 'lay-on-hands', 14).notices[0].kind).toBe('refused')
  })

  it('ilimitado não rastreia; id desconhecido e recurso sem usos recusam', () => {
    const s = state()
    const r = spendResource(s, S, 'infinite')
    expect(r.state).toBe(s)
    expect(kinds(r)).toEqual(['info'])
    expect(kinds(spendResource(s, S, 'ghost'))).toEqual(['refused'])
    expect(kinds(spendResource(s, S, 'die-only'))).toEqual(['refused'])
    expect(kinds(spendResource(s, S, 'rage', 0))).toEqual(['refused'])
  })
})

// ── Condições e exaustão ─────────────────────────────────────────────────────

describe('condições', () => {
  const c = { label: 'Bênção', startedAt: 0 }

  it('condição que incapacita encerra a concentração (assumido F); Envenenado não', () => {
    const r = addCondition(state({ concentration: c }), S, 'paralyzed')
    expect(r.state.concentration).toBeNull()
    expect(kinds(r)).toContain('concentrationEnded')
    expect(addCondition(state({ concentration: c }), S, 'poisoned').state.concentration).toEqual(c)
  })

  it('Inconsciente manual grava o Caído e avisa de largar o que segura; tirá-lo deixa o Caído', () => {
    const r = addCondition(state(), S, 'unconscious')
    expect(r.state.conditions).toEqual(['unconscious', 'prone'])
    expect(kinds(r)).toContain('droppedItems')
    expect(removeCondition(r.state, 'unconscious').state.conditions).toEqual(['prone'])
  })

  it('não remove condição derivada', () => {
    const s = state({ conditions: ['paralyzed'] })
    expect(removeCondition(s, 'incapacitated').state).toBe(s)
    const dying = state({ lifeState: 'dying', damageTaken: 20 })
    expect(kinds(removeCondition(dying, 'unconscious'))).toEqual(['refused'])
  })

  it('id desconhecido é recusado; repetida não duplica', () => {
    const s = state({ conditions: ['poisoned'] })
    expect(kinds(addCondition(s, S, 'sleepy' as never))).toEqual(['refused'])
    expect(addCondition(s, S, 'poisoned').state).toBe(s)
  })

  it('levantar: tira o Caído, mas não com deslocamento 0', () => {
    expect(standUp(state({ conditions: ['prone'] }), S).state.conditions).toEqual([])
    const grappled = state({ conditions: ['prone', 'grappled'] })
    expect(standUp(grappled, S).state).toBe(grappled)
    expect(kinds(standUp(state(), S))).toEqual(['refused'])
  })

  it('o aviso de levantar fala em metros, como a barra de vitais (30 pés → 4,5 m)', () => {
    const r = standUp(state({ conditions: ['prone'] }), S)
    expect(r.notices[0].text).toContain('(4,5 m)')
    expect(r.notices[0].text).not.toContain('pés')
  })

  it('metade do deslocamento na grade de 1,5 m: 25 pés → 3 m; com Exaustão 2, levantar de 15 pés custa 1,5 m', () => {
    const slow = sheet({ speed: 25 })
    expect(standUp(state({ conditions: ['prone'] }), slow).notices[0].text).toContain('(3 m)')
    expect(getPlaySpeed(state({ exhaustionLevel: 2 }), slow)).toBe(10)
    // Exaustão 2 com 30 pés: anda 15 (4,5 m); levantar custa a metade disso na grade, 5 pés (1,5 m).
    const tired = state({ conditions: ['prone'], exhaustionLevel: 2 })
    expect(getPlaySpeed(tired, S)).toBe(15)
    expect(standUp(tired, S).notices[0].text).toContain('(1,5 m)')
  })
})

describe('nota de duração das condições', () => {
  it('grava aparada, cortada no teto, e apaga com texto vazio', () => {
    const s = state({ conditions: ['poisoned'] })
    const r = setConditionNote(s, 'poisoned', '  até o fim do próximo turno do mago  ')
    expect(r.state.conditionNotes).toEqual({ poisoned: 'até o fim do próximo turno do mago' })
    expect(setConditionNote(r.state, 'poisoned', 'x'.repeat(500)).state.conditionNotes?.poisoned)
      .toHaveLength(CONDITION_NOTE_MAX_LENGTH)
    const cleared = setConditionNote(r.state, 'poisoned', '   ').state
    expect(cleared.conditionNotes).toBeUndefined()
    expect('conditionNotes' in cleared).toBe(false)
  })

  it('a mesma nota devolve o mesmo estado; só condição gravada leva nota', () => {
    const s = state({ conditions: ['paralyzed'], conditionNotes: { paralyzed: '1 minuto' } })
    expect(setConditionNote(s, 'paralyzed', '1 minuto').state).toBe(s)
    expect(kinds(setConditionNote(s, 'incapacitated', 'derivada'))).toEqual(['refused'])
    expect(kinds(setConditionNote(state(), 'poisoned', 'x'))).toEqual(['refused'])
  })

  it('a nota sai junto com a condição (removeCondition e standUp)', () => {
    const s = state({ conditions: ['poisoned', 'prone'], conditionNotes: { poisoned: '1 hora', prone: 'empurrado' } })
    const removed = removeCondition(s, 'poisoned').state
    expect(removed.conditionNotes).toEqual({ prone: 'empurrado' })
    const stood = standUp(removed, S).state
    expect(stood.conditions).toEqual([])
    expect(stood.conditionNotes).toBeUndefined()
  })

  it('o sanitizador aceita o campo, só das condições gravadas e com texto', () => {
    const s = sanitizePlayState({
      conditions: ['poisoned', 'blinded'],
      conditionNotes: { poisoned: '  1 hora ', blinded: '', prone: 'sem condição', charmed: 3, bogus: 'x' },
    }, 'c')
    expect(s.conditionNotes).toEqual({ poisoned: '1 hora' })
    expect('conditionNotes' in sanitizePlayState({ conditions: ['poisoned'], conditionNotes: 'x' }, 'c')).toBe(false)
  })
})

describe('setExhaustion', () => {
  it('exaustão 4 grava o corte e não devolve ao baixar (decisão 4)', () => {
    const r = setExhaustion(state(), S, 4)
    expect(getCurrentHp(r.state, S)).toBe(10)
    expect(r.state.damageTaken).toBe(10)
    expect(kinds(r)).toContain('hpCut')
    const back = setExhaustion(r.state, S, 3)
    expect(getEffectiveMaxHp(back.state, S)).toBe(20)
    expect(getCurrentHp(back.state, S)).toBe(10)
  })

  it('sem corte quando o PV já está abaixo do novo máximo', () => {
    const r = setExhaustion(state({ damageTaken: 15 }), S, 4)
    expect(r.state.damageTaken).toBe(15)
    expect(kinds(r)).not.toContain('hpCut')
  })

  it('o invariante vale depois de cada operação com exaustão 4', () => {
    let s = setExhaustion(state(), S, 4).state
    s = applyHealing(s, S, 50).state
    expectInvariant(s, S)
    s = applyDamage(s, S, { amount: 3 }).state
    s = spendHitDie(s, S, { die: 8, value: 8 }).state
    expectInvariant(s, S)
    s = completeLongRest(s, S, { ateAndDrank: false }).state
    expectInvariant(s, S)
  })

  it('exaustão 6 = morte e encerra a concentração (assumido F)', () => {
    const r = setExhaustion(state({ concentration: { label: 'Bênção', startedAt: 0 } }), S, 6)
    expect(r.state.lifeState).toBe('dead')
    expect(r.state.concentration).toBeNull()
    expect(kinds(r)).toEqual(expect.arrayContaining(['died', 'concentrationEnded']))
  })

  it('quem morre por exaustão 6 fica com 0 PV, e o estado de antes é o que o desfazer devolve (decisão de 2026-10-25)', () => {
    const sh = sheet({ maxHp: 40 })
    const before = state({ damageTaken: 5 })
    const r = setExhaustion(before, sh, 6)
    expect(r.state.lifeState).toBe('dead')
    expect(r.state.damageTaken).toBe(40)
    expect(getCurrentHp(r.state, sh)).toBe(0)
    expect(r.notices.find(n => n.kind === 'died')?.text).toBe('Exaustão 6: morte, com 0 PV (pág. 292).')
    expectInvariant(r.state, sh)
    // A operação é pura: o estado anterior (o do desfazer) continua com os seus PV.
    expect(getCurrentHp(before, sh)).toBe(35)
    // Baixar a exaustão de um morto não devolve PV; um estado antigo, morto com PV, lê 0.
    expect(getCurrentHp(setExhaustion(r.state, sh, 5).state, sh)).toBe(0)
    expect(getCurrentHp(state({ lifeState: 'dead', exhaustionLevel: 6, damageTaken: 0 }), sh)).toBe(0)
  })

  it('recusa a exaustão 4 que daria máximo efetivo 0 a quem está consciente (Ponto em aberto 17)', () => {
    const sh = sheet({ maxHp: 1 })
    const s = state()
    const r = setExhaustion(s, sh, 4)
    expect(r.state).toBe(s)
    expect(kinds(r)).toEqual(['unresolvedRule'])
  })

  it('Acostumado à Morte-Vida: a exaustão 4 não corta o PV máximo, com a linha que explica', () => {
    const sh = sheet({ hpMaxReductionImmunity: 'Acostumado à Morte-Vida' })
    expect(describeHpMaxImmunity(state({ exhaustionLevel: 3 }), sh)).toBeNull()
    const r = setExhaustion(state({ exhaustionLevel: 3 }), sh, 4)
    expect(getEffectiveMaxHp(r.state, sh)).toBe(20)
    expect(getCurrentHp(r.state, sh)).toBe(20)
    expect(r.state.damageTaken).toBe(0)
    expect(kinds(r)).not.toContain('hpCut')
    const line = 'Exaustão 4 sem efeito no PV máximo (Acostumado à Morte-Vida): seu máximo de pontos de vida não pode ser reduzido (pág. 101).'
    expect(r.notices.map(n => n.text)).toContain(line)
    expect(describeHpMaxImmunity(r.state, sh)).toBe(line)
    // A cura chega ao máximo da ficha, e baixar a exaustão não fala em PV que volta.
    expect(getCurrentHp(applyHealing(state({ exhaustionLevel: 5, damageTaken: 8 }), sh, 50).state, sh)).toBe(20)
    const back = setExhaustion(r.state, sh, 3)
    expect(back.notices).toEqual([])
    // Sem a característica, nada muda: o corte de sempre e nenhuma linha.
    expect(describeHpMaxImmunity(state({ exhaustionLevel: 4 }), S)).toBeNull()
  })

  it('limita a 0..6 e recusa não inteiro', () => {
    expect(setExhaustion(state(), S, -2).state.exhaustionLevel).toBe(0)
    expect(setExhaustion(state(), S, 2).state.exhaustionLevel).toBe(2)
    expect(kinds(setExhaustion(state(), S, 1.5))).toEqual(['refused'])
  })
})

// ── Concentração, inspiração, nota, histórico ────────────────────────────────

describe('concentração', () => {
  it('começa, troca com aviso e termina', () => {
    let r = startConcentration(state(), S, { spellId: 'bless', label: 'Bênção' }, 5)
    expect(r.state.concentration).toEqual({ spellId: 'bless', label: 'Bênção', startedAt: 5 })
    r = startConcentration(r.state, S, { label: 'Raio de Luar' }, 6)
    expect(kinds(r)).toEqual(['concentrationReplaced'])
    expect(r.state.concentration?.label).toBe('Raio de Luar')
    expect(endConcentration(r.state, S).state.concentration).toBeNull()
  })

  it('recusa quem está incapacitado ou a 0 PV, e rótulo vazio', () => {
    expect(kinds(startConcentration(state({ conditions: ['stunned'] }), S, { label: 'X' }, 0))).toEqual(['refused'])
    expect(kinds(startConcentration(state({ lifeState: 'dying', damageTaken: 20 }), S, { label: 'X' }, 0))).toEqual(['refused'])
    expect(kinds(startConcentration(state(), S, { label: '  ' }, 0))).toEqual(['refused'])
  })
})

describe('inspiração, nota e histórico', () => {
  it('inspiração é binária', () => {
    const s = setInspiration(state(), true).state
    expect(s.inspiration).toBe(true)
    expect(setInspiration(s, true).state).toBe(s)
    expect(setInspiration(s, false).state.inspiration).toBe(false)
  })

  it('nota livre', () => {
    expect(setNote(state(), 'devo 10 po ao anão').state.note).toBe('devo 10 po ao anão')
  })

  it(`histórico guarda só as ${ROLL_HISTORY_LIMIT} rolagens mais recentes`, () => {
    let s = state()
    for (let i = 0; i < ROLL_HISTORY_LIMIT + 5; i++) {
      s = recordRoll(s, roll('1d20', { roller: sequenceRoller([10]), id: `r${i}`, at: i })).state
    }
    expect(s.rolls).toHaveLength(ROLL_HISTORY_LIMIT)
    expect(s.rolls[0].id).toBe('r5')
    expect(s.rolls.at(-1)?.id).toBe(`r${ROLL_HISTORY_LIMIT + 4}`)
  })

  it('"Nova sessão" esvazia o histórico e zera o turno; o resto fica', () => {
    const before = state({
      damageTaken: 4, tempHp: 2, conditions: ['poisoned'], inspiration: true, note: 'pistas',
      activeEffects: [{ id: 'spell:bless', startedAt: 1 }],
    })
    const withRolls = recordRoll(before, roll('1d20', { roller: sequenceRoller([10]), id: 'r', at: 1 })).state
    const r = clearRollHistory(withRolls)
    expect(r.state).toEqual({ ...withRolls, rolls: [] })
    expect(r.notices).toEqual([])
    const marked = { ...withRolls, turn: { ...emptyTurn(), action: true, afterTurn: true, beforeTurn: true } }
    expect(clearRollHistory(marked).state).toEqual({ ...withRolls, rolls: [] })
    // Sem rolagem e sem turno marcado, nada a fazer: o mesmo estado.
    expect(clearRollHistory(before).state).toBe(before)
  })
})

// ── Descanso curto ───────────────────────────────────────────────────────────

describe('spendHitDie', () => {
  it('cura = dado + CON, mostrando a conta', () => {
    const r = spendHitDie(state({ damageTaken: 10 }), S, { die: 8, value: 5 })
    expect(getCurrentHp(r.state, S)).toBe(17)
    expect(r.state.hitDiceSpent).toEqual({ 8: 1 })
    expect(r.notices[0].text).toBe('d8: 5 + 2 = 7.')
  })

  it('CON negativa tem piso 0: 1 − 2 = 0, nunca −1 (decisão 3)', () => {
    const sh = sheet({ conModifier: -2, hitDice: [{ die: 6, count: 2 }] })
    const r = spendHitDie(state({ damageTaken: 10 }), sh, { die: 6, value: 1 })
    expect(getCurrentHp(r.state, sh)).toBe(10)
    expect(r.state.hitDiceSpent).toEqual({ 6: 1 })
    expect(r.notices[0].text).toContain('1 − 2 = 0')
  })

  it('teto no máximo efetivo com exaustão 4 (exemplo da 6.1)', () => {
    const sh = sheet({ conModifier: 0 })
    let s = state({ exhaustionLevel: 4, damageTaken: 15 })
    s = spendHitDie(s, sh, { die: 8, value: 5 }).state
    expect(getCurrentHp(s, sh)).toBe(10)
    const r = spendHitDie(s, sh, { die: 8, value: 4 })
    expect(getCurrentHp(r.state, sh)).toBe(10)
    expect(r.state.hitDiceSpent).toEqual({ 8: 2 })
  })

  it('só tipos do poço e disponíveis; face válida', () => {
    const s = state({ hitDiceSpent: { 8: 4 } })
    expect(kinds(spendHitDie(s, S, { die: 8, value: 3 }))).toEqual(['refused'])
    expect(kinds(spendHitDie(state(), S, { die: 10, value: 3 }))).toEqual(['refused'])
    expect(kinds(spendHitDie(state(), S, { die: 8, value: 9 }))).toEqual(['refused'])
  })

  it('a 0 PV recusa (decidido, Ponto em aberto 6); morto recusa', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20 })
    expect(spendHitDie(dying, S, { die: 8, value: 3 }).state).toBe(dying)
    expect(kinds(spendHitDie(dying, S, { die: 8, value: 3 }))).toEqual(['refused'])
    expect(kinds(spendHitDie(state({ lifeState: 'dead' }), S, { die: 8, value: 3 }))).toEqual(['refused'])
  })

  it('avisa que o talento Resistente não está automatizado', () => {
    const r = spendHitDie(state({ damageTaken: 5 }), sheet({ featIds: ['resistente'] }), { die: 8, value: 1 })
    expect(kinds(r)).toContain('warning')
  })
})

describe('completeShortRest', () => {
  it('voltam os recursos de recarga curta; os de longa e "por dia" não', () => {
    const s = state({ resourcesSpent: { 'second-wind': 1, rage: 2, 'arcane-recovery': 1 } })
    const r = completeShortRest(s, S)
    expect(r.state.resourcesSpent).toEqual({ rage: 2, 'arcane-recovery': 1 })
    expect(kinds(r)).toEqual(['recovered'])
  })

  it('bruxo/mago: o descanso curto recupera só o Pacto entre os espaços', () => {
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'warlock',
      level: 5,
      abilityScores: { STR: 10, DEX: 14, CON: 14, INT: 15, WIS: 10, CHA: 15 },
      additionalClasses: [{
        classId: 'wizard', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
    }
    const sh = buildPlaySheet(draft)
    expect(sh.pactSlots?.slots).toBe(2)
    expect(sh.spellSlots[0]).toBeGreaterThan(0)

    let s = spendPactSlot(state(), sh).state
    s = spendSpellSlot(s, sh, 1).state
    const rested = completeShortRest(s, sh).state
    expect(rested.pactSlotsSpent).toBe(0)
    expect(rested.spellSlotsSpent[0]).toBe(1)
    expect(getPactSlotsAvailable(rested, sh)).toBe(2)
  })

  it('morto recusa', () => {
    expect(kinds(completeShortRest(state({ lifeState: 'dead' }), S))).toEqual(['refused'])
  })

  it('a 0 PV: Pacto e recarga curta voltam; só os Dados de Vida são recusados (decisão de 2026-10-25)', () => {
    const sh = sheet({ pactSlots: { slots: 2, slotLevel: 1 } })
    const stable = state({ lifeState: 'stable', damageTaken: 20, pactSlotsSpent: 2, resourcesSpent: { 'second-wind': 1, rage: 1 } })
    expect(kinds(spendHitDie(stable, sh, { die: 8, value: 5 }))).toEqual(['refused'])
    const rested = completeShortRest(stable, sh)
    expect(kinds(rested)).toEqual(['recovered'])
    expect(rested.state.pactSlotsSpent).toBe(0)
    expect(rested.state.resourcesSpent).toEqual({ rage: 1 })
    // Continua com 0 PV, estável.
    expect(rested.state.lifeState).toBe('stable')
    expect(getCurrentHp(rested.state, sh)).toBe(0)
    expect(kinds(completeShortRest(state({ lifeState: 'dying', damageTaken: 20, pactSlotsSpent: 1 }), sh))).toEqual(['recovered'])
  })

  it('recurso de recarga curta e Pacto voltam no mesmo descanso', () => {
    const sh = sheet({ pactSlots: { slots: 2, slotLevel: 3 } })
    const s = state({ pactSlotsSpent: 2, resourcesSpent: { 'second-wind': 1, rage: 1 } })
    const rested = completeShortRest(s, sh).state
    expect(rested.pactSlotsSpent).toBe(0)
    expect(rested.resourcesSpent).toEqual({ rage: 1 })
    expect(getPactSlotsAvailable(rested, sh)).toBe(2)
    expect(getResourceAvailable(rested, sh, 'second-wind')).toBe(1)
  })

  it('Canção de Descanso: um aviso só com Dados de Vida gastos neste descanso, nenhum sem', () => {
    const bard = sheet({ resources: [{ ...resource('song-of-rest', undefined), name: 'Canção de Descanso', die: 'd6' }] })
    const r = completeShortRest(state({ hitDiceSpent: { 8: 2 } }), bard, { hitDiceSpent: 2 })
    const warnings = r.notices.filter(n => n.kind === 'warning')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].text).toContain('Canção de Descanso (d6)')
    expect(kinds(completeShortRest(state({ hitDiceSpent: { 8: 2 } }), bard, { hitDiceSpent: 0 }))).not.toContain('warning')
    expect(kinds(completeShortRest(state(), bard))).not.toContain('warning')
    expect(kinds(completeShortRest(state(), S, { hitDiceSpent: 3 }))).not.toContain('warning')
  })
})

describe('getShortRestSlotRecovery (Recuperação Arcana)', () => {
  const wizard = (level: number) => buildPlaySheet({
    ...structuredClone(EMPTY_DRAFT), class: 'wizard', level,
    abilityScores: { STR: 10, DEX: 14, CON: 14, INT: 16, WIS: 10, CHA: 8 },
  })

  it('com uso disponível: o lembrete com a soma dos níveis (metade do nível de mago, para cima) e o teto', () => {
    const sh = wizard(5)
    expect(getShortRestSlotRecovery(state(), sh)).toEqual([{
      id: 'arcane-recovery', name: 'Recuperação Arcana', levels: 3, maxSlotLevel: 5, page: 97,
      text: 'Recuperação Arcana: neste descanso curto, você pode recuperar espaços de magia gastos que somem até 3 níveis, nenhum de 6º nível ou superior (pág. 97). Escolha quais e devolva nas bolinhas da aba Magia; depois marque o uso.',
    }])
    expect(getShortRestSlotRecovery(state(), wizard(1))[0].text).toContain('até 1 nível,')
  })

  it('sem uso, morto ou sem o recurso: nada', () => {
    const sh = wizard(5)
    expect(getShortRestSlotRecovery(state({ resourcesSpent: { 'arcane-recovery': 1 } }), sh)).toEqual([])
    expect(getShortRestSlotRecovery(state({ lifeState: 'dead' }), sh)).toEqual([])
    // O recurso sem a declaração `slotRecovery` (a ficha de teste) não vira lembrete.
    expect(getShortRestSlotRecovery(state(), S)).toEqual([])
  })
})

describe('previewShortRest', () => {
  it('lista o Pacto e os recursos de recarga curta gastos, o mesmo que o completeShortRest devolve', () => {
    const sh = sheet({ pactSlots: { slots: 2, slotLevel: 2 } })
    const s = state({ pactSlotsSpent: 1, resourcesSpent: { 'second-wind': 1, rage: 2 } })
    const preview = previewShortRest(s, sh)
    expect(preview).toEqual({ pactSlots: 1, resources: [{ id: 'second-wind', name: 'second-wind', amount: 1 }], effectsEnding: [] })
    const done = completeShortRest(s, sh).state
    expect(done.pactSlotsSpent).toBe(0)
    expect(done.resourcesSpent).toEqual({ rage: 2 })
  })

  it('nada gasto: nada a voltar; gasto acima do máximo é lido já reconciliado', () => {
    expect(previewShortRest(state(), S)).toEqual({ pactSlots: 0, resources: [], effectsEnding: [] })
    expect(previewShortRest(state({ resourcesSpent: { 'second-wind': 9 } }), S).resources[0].amount).toBe(1)
  })
})

// ── Descanso longo ───────────────────────────────────────────────────────────

describe('Dados de Vida no descanso longo', () => {
  const spentAll = (hitDice: PlaySheet['hitDice']) =>
    state({ hitDiceSpent: Object.fromEntries(hitDice.map(p => [p.die, p.count])) })

  it('max(1, ⌊total/2⌋), limitado aos gastos (decisão 1)', () => {
    const cases: [number, number][] = [[1, 1], [5, 2], [8, 4]]
    for (const [total, expected] of cases) {
      const sh = sheet({ hitDice: [{ die: 8, count: total }] })
      expect(getLongRestHitDiceRecoverable(spentAll(sh.hitDice), sh)).toBe(expected)
    }
    expect(getLongRestHitDiceRecoverable(state(), S)).toBe(0)
    expect(getLongRestHitDiceRecoverable(state({ hitDiceSpent: { 8: 1 } }), sheet({ hitDice: [{ die: 8, count: 8 }] }))).toBe(1)
  })

  it('sugere os maiores primeiro (5d10 + 5d8, todos gastos, voltam 5 → 5d10)', () => {
    const sh = sheet({ hitDice: [{ die: 10, count: 5 }, { die: 8, count: 5 }] })
    expect(suggestLongRestHitDice(spentAll(sh.hitDice), sh)).toEqual({ 10: 5 })
    expect(suggestLongRestHitDice(state({ hitDiceSpent: { 10: 2, 8: 5 } }), sh)).toEqual({ 10: 2, 8: 3 })
  })

  it('a escolha do jogador vale sobre a sugestão, e escolha inválida é recusada', () => {
    const sh = sheet({ hitDice: [{ die: 10, count: 5 }, { die: 8, count: 5 }] })
    const s = spentAll(sh.hitDice)
    expect(completeLongRest(s, sh, { hitDice: { 8: 5 } }).state.hitDiceSpent).toEqual({ 10: 5 })
    expect(completeLongRest(s, sh, { hitDice: { 8: 3 } }).state.hitDiceSpent).toEqual({ 10: 5, 8: 2 })
    expect(kinds(completeLongRest(s, sh, { hitDice: { 8: 6 } }))).toEqual(['refused'])
    expect(kinds(completeLongRest(s, sh, { hitDice: { 10: 3, 8: 3 } }))).toEqual(['refused'])
    expect(kinds(completeLongRest(s, sh, { hitDice: { 12: 1 } }))).toEqual(['refused'])
  })
})

describe('previewLongRest e completeLongRest', () => {
  const busy = state({
    damageTaken: 12, tempHp: 4, hitDiceSpent: { 8: 3 },
    spellSlotsSpent: [2, 1, 0, 0, 0, 0, 0, 0, 0], pactSlotsSpent: 0,
    resourcesSpent: { 'second-wind': 1, rage: 2, 'arcane-recovery': 1, relentless: 1 },
    exhaustionLevel: 2,
  })

  it('prévia: o que volta, com "comeu e bebeu" marcado por padrão', () => {
    const p = previewLongRest(busy, S)
    expect(p.blocked).toBe(false)
    expect(p.hp).toEqual({ before: 8, after: 20, max: 20 })
    expect(p.hitDice).toEqual({ recoverable: 2, suggestion: { 8: 2 } })
    expect(p.spellSlots.slice(0, 2)).toEqual([2, 1])
    expect(p.resources.map(r => r.id)).toEqual(['second-wind', 'rage', 'arcane-recovery'])
    expect(p.tempHpLost).toBe(4)
    expect(p.exhaustion).toEqual({ before: 2, after: 1 })
    expect(p.notices.length).toBeGreaterThan(0)
    expect(previewLongRest(busy, S, { ateAndDrank: false }).exhaustion.after).toBe(2)
  })

  it('conclui: PV cheios, espaços, recursos curtos/longos/diários, fim dos temporários, exaustão −1', () => {
    const r = completeLongRest(busy, S, { now: 777 })
    expect(getCurrentHp(r.state, S)).toBe(20)
    expect(r.state.tempHp).toBe(0)
    expect(r.state.hitDiceSpent).toEqual({ 8: 1 })
    expect(r.state.spellSlotsSpent).toEqual(Array(9).fill(0))
    expect(r.state.resourcesSpent).toEqual({ relentless: 1 })
    expect(r.state.exhaustionLevel).toBe(1)
    expect(r.state.lastLongRestAt).toBe(777)
    expect(completeLongRest(busy, S, { ateAndDrank: false }).state.exhaustionLevel).toBe(2)
  })

  it('volta o Pacto no longo também', () => {
    const sh = sheet({ pactSlots: { slots: 2, slotLevel: 1 } })
    expect(completeLongRest(state({ pactSlotsSpent: 2 }), sh).state.pactSlotsSpent).toBe(0)
  })

  it('com exaustão 4: "comeu e bebeu" (4 → 3) dá PV cheio; sem, PV no máximo efetivo', () => {
    const s = setExhaustion(state({ damageTaken: 2 }), S, 4).state
    expect(getCurrentHp(completeLongRest(s, S).state, S)).toBe(20)
    const stay = completeLongRest(s, S, { ateAndDrank: false }).state
    expect(getCurrentHp(stay, S)).toBe(10)
    expectInvariant(stay, S)
    const five = completeLongRest(state({ exhaustionLevel: 5, damageTaken: 15 }), S).state
    expect(five.exhaustionLevel).toBe(4)
    expect(getCurrentHp(five, S)).toBe(10)
  })

  it('a 0 PV no início a prévia bloqueia e a conclusão não muda NADA (assumido A)', () => {
    const atZero = { ...busy, lifeState: 'stable' as const, damageTaken: 20 }
    const p = previewLongRest(atZero, S)
    expect(p.blocked).toBe(true)
    expect(p.blockReason).toContain('pelo menos 1 PV')
    expect(p.hitDice.recoverable).toBe(0)
    expect(p.resources).toEqual([])
    const r = completeLongRest(atZero, S)
    expect(r.state).toBe(atZero)
    expect(kinds(r)).toEqual(['refused'])
  })

  it('morto: bloqueado, mesmo com PV (exaustão 6)', () => {
    const dead = state({ lifeState: 'dead', exhaustionLevel: 6 })
    expect(previewLongRest(dead, S).blocked).toBe(true)
    expect(completeLongRest(dead, S).state).toBe(dead)
  })
})

describe('ajuste temporário do PV máximo (Ajuda, pág. 215)', () => {
  const hp = (s: PlayState, sh = S) => [getCurrentHp(s, sh), getEffectiveMaxHp(s, sh)]

  it('Ajuda +5 em 20/20 dá 25/25, e o descanso longo volta a 20/20', () => {
    const r = adjustMaxHp(state(), S, 5)
    expect(r.state.maxHpAdjustment).toBe(5)
    expect(hp(r.state)).toEqual([25, 25])
    expect(r.notices[0].text).toBe('Ajuste do PV máximo: +5. Máximo 20 → 25; PV atual 20 → 25.')
    const preview = previewLongRest(r.state, S)
    expect(preview.hp).toEqual({ before: 25, after: 20, max: 20 })
    expect(preview.maxHpAdjustmentEnds).toBe(5)
    const rested = completeLongRest(r.state, S)
    expect(rested.state.maxHpAdjustment).toBe(0)
    expect(hp(rested.state)).toEqual([20, 20])
    expect(rested.notices[0].text).toContain('o ajuste do PV máximo (+5) acabou')
  })

  it('ferido também sobe 5; o dano e a cura usam o máximo novo', () => {
    const aided = adjustMaxHp(state({ damageTaken: 8 }), S, 5).state
    expect(hp(aided)).toEqual([17, 25])
    expect(hp(applyHealing(aided, S, 20).state)).toEqual([25, 25])
    expect(hp(applyDamage(aided, S, { amount: 10 }).state)).toEqual([7, 25])
  })

  it('desfazer o ajuste só corta o atual que passar do máximo (pág. 198)', () => {
    const full = adjustMaxHp(state(), S, 5).state
    expect(hp(adjustMaxHp(full, S, -5).state)).toEqual([20, 20])
    const hurt = applyDamage(full, S, { amount: 8 }).state
    expect(hp(adjustMaxHp(hurt, S, -5).state)).toEqual([17, 20])
  })

  it('a Exaustão 4 corta o máximo já somado ao ajuste (decisão do dono)', () => {
    const tired = setExhaustion(state(), S, 4).state
    expect(hp(tired)).toEqual([10, 10])
    // 20 + 5 = 25, metade 12: o atual sobe até o máximo, não 15.
    const aided = adjustMaxHp(tired, S, 5).state
    expect(hp(aided)).toEqual([12, 12])
    expectInvariant(aided, S)
    // Na ordem inversa, o mesmo máximo.
    const later = setExhaustion(adjustMaxHp(state(), S, 5).state, S, 4).state
    expect(hp(later)).toEqual([12, 12])
  })

  it('Acostumado à Morte-Vida: reduzir abaixo da ficha é recusado; aumentar e voltar ao normal, não', () => {
    const sh = sheet({ hpMaxReductionImmunity: 'Acostumado à Morte-Vida' })
    const refused = adjustMaxHp(state(), sh, -3)
    expect(kinds(refused)).toEqual(['refused'])
    const aided = adjustMaxHp(state(), sh, 5).state
    expect(adjustMaxHp(aided, sh, -5).state.maxHpAdjustment).toBe(0)
  })

  it('recusa máximo abaixo de 1, morto, valor quebrado; 0 não muda nada', () => {
    expect(kinds(adjustMaxHp(state(), S, -20))).toEqual(['unresolvedRule'])
    const reduced = adjustMaxHp(state(), S, -19).state
    expect(hp(reduced)).toEqual([1, 1])
    expect(kinds(adjustMaxHp(state({ lifeState: 'dead' }), S, 5))).toEqual(['refused'])
    expect(kinds(adjustMaxHp(state(), S, 2.5))).toEqual(['refused'])
    const s = state()
    expect(adjustMaxHp(s, S, 0).state).toBe(s)
  })

  it('a 0 PV só o máximo muda, com o aviso de que o livro não decide se acorda', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20 })
    const r = adjustMaxHp(dying, S, 5)
    expect(hp(r.state)).toEqual([0, 25])
    expect(r.state.lifeState).toBe('dying')
    expect(kinds(r)).toEqual(['info', 'unresolvedRule'])
    // A cura depois usa o máximo novo.
    expect(hp(applyHealing(r.state, S, 30).state)).toEqual([25, 25])
  })

  it('o sanitizador aceita inteiro (inclusive negativo) e zera o resto', () => {
    expect(sanitizePlayState({ maxHpAdjustment: 5 }, 'c').maxHpAdjustment).toBe(5)
    expect(sanitizePlayState({ maxHpAdjustment: -4 }, 'c').maxHpAdjustment).toBe(-4)
    expect(sanitizePlayState({ maxHpAdjustment: 'x' }, 'c').maxHpAdjustment).toBe(0)
    expect(sanitizePlayState({}, 'c').maxHpAdjustment).toBe(0)
  })
})
// ── Reconciliação e sanitizador ──────────────────────────────────────────────

describe('reconcilePlayState', () => {
  it('encaixa o gasto nos máximos da ficha atual', () => {
    const s = state({
      damageTaken: 99, hitDiceSpent: { 8: 9, 12: 1 }, spellSlotsSpent: [9, 9, 9, 0, 0, 0, 0, 0, 0],
      pactSlotsSpent: 3, resourcesSpent: { rage: 9, ghost: 1, infinite: 2 },
    })
    const r = reconcilePlayState(s, S)
    // Consciente: o dano para em máx. − 1, nunca 0 PV consciente.
    expect(r.damageTaken).toBe(19)
    expect(r.lifeState).toBe('conscious')
    expect(getCurrentHp(r, S)).toBe(1)
    expect(r.hitDiceSpent).toEqual({ 8: 4 })
    expect(r.spellSlotsSpent.slice(0, 3)).toEqual([4, 3, 0])
    expect(r.pactSlotsSpent).toBe(0)
    expect(r.resourcesSpent).toEqual({ rage: 3 })
  })

  it('a 0 PV o dano é o máximo; com exaustão 4 vale o corte', () => {
    expect(reconcilePlayState(state({ lifeState: 'dying', damageTaken: 3 }), S).damageTaken).toBe(20)
    expect(reconcilePlayState(state({ exhaustionLevel: 4 }), S).damageTaken).toBe(10)
  })

  it('ficha que encolheu com o personagem ferido: fica com 1 PV, consciente (Notas de regras-dano-e-morte.md)', () => {
    // Máximo 30 → 20 (CON corrigida), com 25 de dano (5 PV).
    const s = state({ damageTaken: 25, concentration: { label: 'Bênção', startedAt: 0 } })
    const sh20 = sheet({ maxHp: 20 })
    const r = reconcilePlayState(s, sh20)
    expect(r.damageTaken).toBe(19)
    expect(r.lifeState).toBe('conscious')
    expect(previewLongRest(s, sh20).blocked).toBe(false)
    // 1 de dano agora leva a 0 PV de verdade, pelo pipeline.
    const hit = applyDamage(s, sh20, { amount: 1 })
    expect(hit.state.lifeState).toBe('dying')
    expect(kinds(hit)).toContain('fellUnconscious')
    // A mesma coisa por uma operação qualquer: 12 PV, 10 de dano, e a ficha cai para 9.
    const two = applyDamage(state(), sheet({ maxHp: 12 }), { amount: 10 }).state
    const after = spendSpellSlot(two, sheet({ maxHp: 9 }), 1).state
    expect(after.damageTaken).toBe(8)
    expect(after.lifeState).toBe('conscious')
    expect(startConcentration(after, S, { label: 'X' }, 0).state.concentration?.label).toBe('X')
  })

  it('ficha encolhida com exaustão 4: o mínimo de 1 PV vale sobre o corte', () => {
    const r = reconcilePlayState(state({ exhaustionLevel: 4, damageTaken: 25 }), sheet({ maxHp: 20 }))
    expect(r.damageTaken).toBe(19)
    expectInvariant(r, sheet({ maxHp: 20 }))
  })
})

describe('leitura de estado salvo contra uma ficha mudada', () => {
  it('getCurrentHp lê já reconciliado: exaustão 4 com ficha maior não passa do efetivo', () => {
    // Salvo com máximo 20 na exaustão 4 (10/10); a ficha sobe para 30.
    const s = state({ exhaustionLevel: 4, damageTaken: 10 })
    const sh30 = sheet({ maxHp: 30 })
    expect(getEffectiveMaxHp(s, sh30)).toBe(15)
    expect(getCurrentHp(s, sh30)).toBe(15)
  })

  it('getCurrentHp a 0 PV continua 0 com ficha maior, e 0 PV consciente nunca aparece', () => {
    expect(getCurrentHp(state({ lifeState: 'dying', damageTaken: 20 }), sheet({ maxHp: 30 }))).toBe(0)
    expect(getCurrentHp(state({ damageTaken: 25 }), sheet({ maxHp: 20 }))).toBe(1)
  })

  it('reconcileLoadedPlayState avisa do corte da exaustão (hpCut) e do 1 PV mínimo', () => {
    const cut = reconcileLoadedPlayState(state({ exhaustionLevel: 4, damageTaken: 10 }), sheet({ maxHp: 30 }))
    expect(cut.state.damageTaken).toBe(15)
    expect(kinds(cut)).toEqual(['hpCut'])
    expect(cut.notices[0].text).toContain('o PV máximo é 15. O PV atual fica em 15')
    expect(cut.notices[0].text).not.toContain('cai de')

    const shrunk = reconcileLoadedPlayState(state({ damageTaken: 25 }), sheet({ maxHp: 20 }))
    expect(getCurrentHp(shrunk.state, sheet({ maxHp: 20 }))).toBe(1)
    expect(kinds(shrunk)).toEqual(['info'])

    expect(kinds(reconcileLoadedPlayState(state({ damageTaken: 5 }), S))).toEqual([])
    expect(kinds(reconcileLoadedPlayState(state({ lifeState: 'dying', damageTaken: 20 }), sheet({ maxHp: 30 })))).toEqual([])
  })

  it('estado importado com dano ≥ máximo e consciente: sanitizar + reconciliar dá 1 PV', () => {
    const s = sanitizePlayState({ lifeState: 'conscious', damageTaken: 99 }, 'c')
    const r = reconcileLoadedPlayState(s, S)
    expect(r.state.lifeState).toBe('conscious')
    expect(getCurrentHp(r.state, S)).toBe(1)
  })
})

describe('sanitizePlayState', () => {
  it('lixo vira estado novo, com o characterId de quem chama', () => {
    for (const raw of [null, undefined, 'x', 42, [], true]) {
      expect(sanitizePlayState(raw, 'id-9')).toEqual(createPlayState('id-9'))
    }
  })

  it('limpa campo a campo: clamp, ids desconhecidos, versão', () => {
    const s = sanitizePlayState({
      version: 999,
      characterId: 'outro',
      updatedAt: 'ontem',
      damageTaken: -5,
      tempHp: 3.7,
      lifeState: 'zumbi',
      deathSaves: { successes: 7, failures: -1 },
      hitDiceSpent: { 8: 2, 7: 1, abc: 3, 10: -2 },
      spellSlotsSpent: [1, 'dois', -1],
      pactSlotsSpent: Infinity,
      resourcesSpent: { rage: 2, ki: 'muito', '': 1 },
      conditions: ['poisoned', 'cursed', 'poisoned', 7],
      exhaustionLevel: 12,
      concentration: { label: '  Bênção ', spellId: 5 },
      inspiration: 'sim',
      note: 123,
      rolls: [{ id: 'nope' }, roll('1d6', { roller: sequenceRoller([3]), id: 'ok', at: 1 })],
      lastLongRestAt: 'nunca',
    }, 'char-1')
    expect(s.version).toBe(PLAY_STATE_VERSION)
    expect(s.characterId).toBe('char-1')
    expect(s.updatedAt).toBe(0)
    expect(s.damageTaken).toBe(0)
    expect(s.tempHp).toBe(3)
    // 'zumbi' viraria consciente, mas a exaustão 12 → 6 é morte (assumido F).
    expect(s.lifeState).toBe('dead')
    expect(s.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(s.hitDiceSpent).toEqual({ 8: 2 })
    expect(s.spellSlotsSpent).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(s.pactSlotsSpent).toBe(0)
    expect(s.resourcesSpent).toEqual({ rage: 2 })
    expect(s.conditions).toEqual(['poisoned'])
    expect(s.exhaustionLevel).toBe(6)
    // Morto não mantém concentração.
    expect(s.concentration).toBeNull()
    expect(s.inspiration).toBe(false)
    expect(s.note).toBe('')
    expect(s.rolls.map(r => r.id)).toEqual(['ok'])
    expect('lastLongRestAt' in s).toBe(false)
  })

  it('os efeitos ligados: estado salvo sem o campo carrega com [], sem aviso nem versão nova', () => {
    const old: Partial<PlayState> = createPlayState('c', 5)
    delete old.activeEffects
    const s = sanitizePlayState(old, 'c')
    expect(s.activeEffects).toEqual([])
    expect(s.version).toBe(PLAY_STATE_VERSION)
    expect(reconcileLoadedPlayState(s, S).notices).toEqual([])
  })

  it('os efeitos ligados: entrada sem id ou com tipo errado sai; o mesmo id fica uma vez', () => {
    const s = sanitizePlayState({
      activeEffects: [
        { id: 'rage', startedAt: 7, option: 'frenzy' },
        { id: 'rage', startedAt: 9 },
        { startedAt: 3 },
        { id: '', startedAt: 1 },
        { id: 42 },
        'rage',
        null,
        { id: 'spell:bless', startedAt: 'ontem', option: 3 },
      ],
    }, 'c')
    expect(s.activeEffects).toEqual([
      { id: 'rage', startedAt: 7, option: 'frenzy' },
      { id: 'spell:bless', startedAt: 0 },
    ])
    expect(sanitizePlayState({ activeEffects: 'rage' }, 'c').activeEffects).toEqual([])
  })

  it('os contadores do descanso: sem o campo, {}; ficam só os inteiros positivos', () => {
    const old: Partial<PlayState> = createPlayState('c', 5)
    delete old.restCounters
    expect(sanitizePlayState(old, 'c').restCounters).toEqual({})
    expect(sanitizePlayState({ restCounters: { 'relentless-rage': 2.7, zero: 0, neg: -1, text: 'x', '': 3 } }, 'c').restCounters)
      .toEqual({ 'relentless-rage': 2 })
    expect(sanitizePlayState({ restCounters: [1] }, 'c').restCounters).toEqual({})
  })

  it('concentração limpa e mantida quando consciente', () => {
    const s = sanitizePlayState({ concentration: { label: '  Bênção ', spellId: 5 } }, 'c')
    expect(s.lifeState).toBe('conscious')
    expect(s.concentration).toEqual({ label: 'Bênção', startedAt: 0 })
  })

  it('contadores do teste contra a morte só valem morrendo, entre 0 e 2', () => {
    const s = sanitizePlayState({ lifeState: 'dying', deathSaves: { successes: 2, failures: 1 } }, 'c')
    expect(s.lifeState).toBe('dying')
    expect(s.deathSaves).toEqual({ successes: 2, failures: 1 })
    expect(sanitizePlayState({ lifeState: 'stable', deathSaves: { successes: 2, failures: 1 } }, 'c').deathSaves)
      .toEqual({ successes: 0, failures: 0 })
  })

  it('depois de sanitizar, o estado obedece à máquina de estados de vida', () => {
    // 3 sucessos = estável, contadores zerados (pág. 199).
    const stable = sanitizePlayState({ lifeState: 'dying', deathSaves: { successes: 9, failures: 2 } }, 'c')
    expect(stable.lifeState).toBe('stable')
    expect(stable.deathSaves).toEqual({ successes: 0, failures: 0 })
    // 3 fracassos = morto (vence os 3 sucessos, como em recordDeathSave).
    for (const deathSaves of [{ successes: 0, failures: 3 }, { successes: 3, failures: 3 }]) {
      const dead = sanitizePlayState({ lifeState: 'dying', deathSaves }, 'c')
      expect(dead.lifeState).toBe('dead')
      expect(dead.deathSaves).toEqual({ successes: 0, failures: 0 })
    }
    // Exaustão 6 = morto, e as operações tratam como tal.
    const ex6 = sanitizePlayState({ exhaustionLevel: 6, lifeState: 'conscious', concentration: { label: 'X' } }, 'c')
    expect(ex6.lifeState).toBe('dead')
    expect(ex6.concentration).toBeNull()
    expect(kinds(applyDamage(ex6, S, { amount: 3 }))).toEqual(['refused'])
    expect(kinds(revive(ex6, S))).toEqual(['unresolvedRule'])
    // A 0 PV também não há concentração (assumido F).
    expect(sanitizePlayState({ lifeState: 'stable', concentration: { label: 'X' } }, 'c').concentration).toBeNull()
  })

  it('um estado válido passa intacto', () => {
    const s = completeLongRest(applyDamage(state({ tempHp: 2 }), S, { amount: 9 }).state, S, { now: 5 }).state
    const withRoll = recordRoll(s, roll('2d6+1', { roller: sequenceRoller([2, 5]), id: 'x', at: 3 })).state
    expect(sanitizePlayState(JSON.parse(JSON.stringify(withRoll)), withRoll.characterId)).toEqual(withRoll)
  })
})

// ── Tipos de dano e defesas (p. 199; decisões de 2026-10-30) ─────────────────

describe('applyDamage — o tipo do dano e as defesas da ficha', () => {
  const SCORES = { STR: 15, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: 10 }
  /** A ficha de jogo de um personagem de verdade (guerreiro 5 com CON 14, salvo o que vier). */
  const sheetOf = (overrides: Partial<CharacterDraft>) => buildPlaySheet({
    ...structuredClone(EMPTY_DRAFT), level: 5, class: 'fighter', race: 'human', abilityScores: SCORES, ...overrides,
  })
  const sub = (classId: string, level: number, subclass: string) =>
    ({ class: classId, level, classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass } })
  /** Quanto o evento tirou do PV. */
  const lost = (sh: PlaySheet, input: Parameters<typeof applyDamage>[2], s = state()) =>
    getCurrentHp(s, sh) - getCurrentHp(applyDamage(s, sh, input).state, sh)
  const texts = (r: { notices: { text: string }[] }) => r.notices.map(n => n.text)

  const TIEFLING = sheetOf({ race: 'tiefling' })

  it('tiefling, 13 de fogo: 6, com o aviso da origem', () => {
    const r = applyDamage(state(), TIEFLING, { amount: 13, damageType: 'fire' })
    expect(getCurrentHp(state(), TIEFLING) - getCurrentHp(r.state, TIEFLING)).toBe(6)
    expect(texts(r)).toEqual(['Resistência a fogo (Resistência Infernal): 13 → 6.'])
  })

  it('sem tipo informado, nada é automático; outro tipo, também', () => {
    expect(lost(TIEFLING, { amount: 13 })).toBe(13)
    expect(lost(TIEFLING, { amount: 13, damageType: 'cold' })).toBe(13)
  })

  it('anão, 9 de veneno: 4', () => {
    expect(lost(sheetOf({ race: 'dwarf', subrace: 'hill-dwarf' }), { amount: 9, damageType: 'poison' })).toBe(4)
  })

  it('monge 10, veneno: 0, sem TR de concentração', () => {
    const monk = sheetOf({ class: 'monk', level: 10 })
    const s = state({ concentration: { label: 'Bênção', startedAt: 1 } })
    const r = applyDamage(s, monk, { amount: 12, damageType: 'poison' })
    expect(r.state).toBe(s)
    expect(texts(r)).toEqual([
      'Imune a dano de veneno (Pureza Corporal): o dano vira 0.',
      'Dano total 0: não conta como dano. Nada foi alterado.',
    ])
    expect(kinds(r)).not.toContain('concentrationCheck')
  })

  it('tiefling, 10 cortante + 7 fogo: 13 (a resistência só na parcela de fogo)', () => {
    const r = applyDamage(state(), TIEFLING, {
      amount: 17, parts: [{ amount: 10, damageType: 'slashing' }, { amount: 7, damageType: 'fire' }],
    })
    expect(getCurrentHp(state(), TIEFLING) - getCurrentHp(r.state, TIEFLING)).toBe(13)
    expect(texts(r)).toEqual(['Resistência a fogo (Resistência Infernal): 7 → 3.', 'Dano somado: 10 + 3 = 13.'])
  })

  it('parcelas do mesmo tipo somam antes da metade: 7 + 7 de fogo dão 7, não 6 (item 12)', () => {
    expect(lost(TIEFLING, { amount: 14, parts: [{ amount: 7, damageType: 'fire' }, { amount: 7, damageType: 'fire' }] })).toBe(7)
  })

  it('duas parcelas sem tipo são dois tipos: a tempestade de gelo, 7 de concussão e 9 de frio, dá 3 + 4 (item 12)', () => {
    // Tiefling paladino dos Anciões 7: os chips são Fogo e Outro tipo, e as duas parcelas vão como Outro tipo.
    const tieflingPaladin = sheetOf({ race: 'tiefling', ...sub('paladin', 7, 'oath-of-the-ancients') })
    const r = applyDamage(state(), tieflingPaladin, { amount: 16, parts: [{ amount: 7 }, { amount: 9 }], conditionalDefenses: ['de magia'] })
    expect(getCurrentHp(state(), tieflingPaladin) - getCurrentHp(r.state, tieflingPaladin)).toBe(7)
    expect(texts(r)).toEqual([
      'Resistência (Aura de Vigilância): 7 → 3.',
      'Resistência (Aura de Vigilância): 9 → 4.',
      'Dano somado: 3 + 4 = 7.',
    ])
    // A resistência marcada no painel arredonda do mesmo jeito.
    expect(lost(TIEFLING, { amount: 16, parts: [{ amount: 7 }, { amount: 9 }], resisted: true })).toBe(7)
  })

  it('resistência e vulnerabilidade ao mesmo tipo: só a metade (decisão 10); só a vulnerabilidade: o dobro', () => {
    const vulnerable = { source: 'Maldição', kind: 'vulnerability', types: ['fire'] } as const
    const both = sheet({ defenses: [...TIEFLING.defenses, { ...vulnerable, types: [...vulnerable.types] }] })
    const r = applyDamage(state(), both, { amount: 13, damageType: 'fire' })
    expect(getCurrentHp(state(), both) - getCurrentHp(r.state, both)).toBe(6)
    expect(texts(r)).toContain('Vulnerabilidade a fogo (Maldição) junto da resistência: vale só a resistência.')
    expect(lost(sheet({ defenses: [{ ...vulnerable, types: ['fire'] }] }), { amount: 6, damageType: 'fire' })).toBe(12)
  })

  it('condicional sem confirmação não reduz; confirmada, reduz: Aura de Vigilância (paladino dos Anciões 7)', () => {
    const paladin = sheetOf(sub('paladin', 7, 'oath-of-the-ancients'))
    expect(lost(paladin, { amount: 10, damageType: 'fire' })).toBe(10)
    expect(lost(paladin, { amount: 10 })).toBe(10)
    // "De magia" alcança todo tipo, e também o dano sem tipo informado.
    expect(lost(paladin, { amount: 10, damageType: 'fire', conditionalDefenses: ['de magia'] })).toBe(5)
    expect(lost(paladin, { amount: 10, conditionalDefenses: ['de magia'] })).toBe(5)
    // Outra situação confirmada não liga esta.
    expect(lost(paladin, { amount: 10, conditionalDefenses: ['de ataque não mágico'] })).toBe(10)
  })

  it('mago abjurador 14, 20 de fogo de uma bola de fogo: 10 com "de magia" confirmada (Resistência à Magia, p. 98)', () => {
    const abjurer = sheetOf(sub('wizard', 14, 'abjuration'))
    expect(lost(abjurer, { amount: 20, damageType: 'fire' })).toBe(20)
    const r = applyDamage(state(), abjurer, { amount: 20, damageType: 'fire', conditionalDefenses: ['de magia'] })
    expect(getCurrentHp(state(), abjurer) - getCurrentHp(r.state, abjurer)).toBe(10)
    expect(texts(r)).toEqual(['Resistência a fogo (Resistência à Magia): 20 → 10.'])
  })

  it('a condicional confirmada e a da ficha contam como uma só: metade, não um quarto', () => {
    const tieflingPaladin = sheetOf({ race: 'tiefling', ...sub('paladin', 7, 'oath-of-the-ancients') })
    const r = applyDamage(state(), tieflingPaladin, { amount: 13, damageType: 'fire', conditionalDefenses: ['de magia'] })
    expect(getCurrentHp(state(), tieflingPaladin) - getCurrentHp(r.state, tieflingPaladin)).toBe(6)
    expect(texts(r)).toEqual(['Resistência a fogo (Resistência Infernal, Aura de Vigilância): 13 → 6.'])
  })

  describe('Maestria em Armadura Pesada (p. 170)', () => {
    const wearing = (...itemIds: string[]) => ({
      ...structuredClone(EMPTY_DRAFT.equipment), method: 'wealth' as const,
      purchasedItems: itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const })),
    })
    const master = (...armor: string[]) =>
      sheetOf({ raceChoices: { feat: 'maestria-em-armadura-pesada' }, equipment: wearing(...armor) })
    const NON_MAGICAL = { conditionalDefenses: ['de ataque não mágico'] }

    it('8 cortante de ataque não mágico: 5 de Placas; 8 sem armadura pesada ou sem confirmar', () => {
      const r = applyDamage(state(), master('plate'), { amount: 8, damageType: 'slashing', ...NON_MAGICAL })
      expect(getCurrentHp(state(), master('plate')) - getCurrentHp(r.state, master('plate'))).toBe(5)
      expect(texts(r)).toEqual(['Redução de 3 em cortante (Maestria em Armadura Pesada): 8 → 5.'])
      expect(lost(master('half-plate'), { amount: 8, damageType: 'slashing', ...NON_MAGICAL })).toBe(8)
      expect(lost(master('plate'), { amount: 8, damageType: 'slashing' })).toBe(8)
      expect(lost(master('plate'), { amount: 8, damageType: 'fire', ...NON_MAGICAL })).toBe(8)
    })

    it('a redução vem antes da resistência (p. 199) e vale uma vez por evento, nas parcelas que alcança', () => {
      // Petrificado: 8 − 3 = 5, metade 2 (o exemplo da aura de 5 no livro, p. 199).
      const petrified = state({ conditions: ['petrified'] })
      expect(lost(master('plate'), { amount: 8, damageType: 'slashing', ...NON_MAGICAL }, petrified)).toBe(2)
      // 2 cortante + 5 perfurante, sem outra defesa: a ordem não muda o total; tira 3 do evento.
      expect(lost(master('plate'), {
        amount: 7, parts: [{ amount: 2, damageType: 'slashing' }, { amount: 5, damageType: 'piercing' }], ...NON_MAGICAL,
      })).toBe(4)
    })

    it('alcançando duas parcelas com outra defesa, a ordem muda o resultado: não aplica e avisa (Ponto em aberto 28)', () => {
      const petrified = state({ conditions: ['petrified'] })
      const r = applyDamage(petrified, master('plate'), {
        amount: 9, parts: [{ amount: 4, damageType: 'slashing' }, { amount: 5, damageType: 'piercing' }], ...NON_MAGICAL,
      })
      // Só a resistência do Petrificado: 2 + 2.
      expect(getCurrentHp(petrified, master('plate')) - getCurrentHp(r.state, master('plate'))).toBe(4)
      expect(kinds(r)).toContain('unresolvedRule')
      expect(texts(r)[0]).toBe('Maestria em Armadura Pesada: a redução de 3 alcança mais de uma parcela (cortante e perfurante), e o livro não diz de qual ela sai; com as outras defesas, isso muda o resultado. O app não a aplicou: combine com o Mestre e, se for o caso, desfaça e digite as parcelas já com a redução, sem marcar "Dano de ataque não mágico?".')
      // Numa parcela só, a regra está decidida: aplica.
      expect(lost(master('plate'), { amount: 9, parts: [{ amount: 4, damageType: 'slashing' }, { amount: 5, damageType: 'fire' }], ...NON_MAGICAL }, petrified))
        .toBe(2) // cortante: 4 − 3 = 1, metade 0; fogo: metade de 5, 2
    })

    it('quem segue o aviso digita as parcelas já reduzidas sem a caixa: a redução não se aplica de novo', () => {
      // 3 cortante + 5 perfurante, petrificado; o Mestre tira os 3 do cortante: sobra 5 perfurante.
      const petrified = state({ conditions: ['petrified'] })
      expect(lost(master('plate'), { amount: 5, damageType: 'piercing' }, petrified)).toBe(2)
      // Com a caixa marcada, a parcela única passa pela redução outra vez (5 − 3, metade 1): é o que
      // o aviso manda evitar.
      expect(lost(master('plate'), { amount: 5, damageType: 'piercing', ...NON_MAGICAL }, petrified)).toBe(1)
    })
  })

  it('exceção marcada cancela a defesa ("arma mágica ou de prata")', () => {
    const fiend = sheet({ defenses: [{ source: 'Resistência Demoníaca', kind: 'resistance', types: ['slashing'], exceptWhen: 'arma mágica ou de prata' }] })
    expect(lost(fiend, { amount: 9, damageType: 'slashing' })).toBe(4)
    expect(lost(fiend, { amount: 9, damageType: 'slashing', exceptions: ['arma mágica ou de prata'] })).toBe(9)
  })

  it('a Resistência Demoníaca sem escolha não se aplica a tipo nenhum', () => {
    const fiend = sheetOf(sub('warlock', 10, 'the-fiend'))
    expect(fiend.defenses).toHaveLength(1)
    expect(lost(fiend, { amount: 9, damageType: 'fire' })).toBe(9)
  })

  it('o Petrificado continua zerando o veneno e as defesas dele somam às da ficha', () => {
    const s = state({ conditions: ['petrified'] })
    expect(lost(TIEFLING, { amount: 9, damageType: 'poison' }, s)).toBe(0)
    expect(getPlayDamageDefenses(s, TIEFLING)).toEqual([
      { source: 'Resistência Infernal', kind: 'resistance', types: ['fire'] },
      { source: 'Petrificado', kind: 'resistance', types: 'all' },
      { source: 'Petrificado', kind: 'immunity', types: ['poison'] },
    ])
  })

  it('o estado de antes fica intacto: o desfazer do playStore volta o PV', () => {
    const s = state({ damageTaken: 2 })
    const r = applyDamage(s, TIEFLING, { amount: 13, damageType: 'fire' })
    expect(r.state).not.toBe(s)
    expect(s.damageTaken).toBe(2)
    expect(getCurrentHp(s, TIEFLING) - getCurrentHp(r.state, TIEFLING)).toBe(6)
  })

  it('parcela com valor inválido recusa o evento inteiro', () => {
    const s = state()
    const r = applyDamage(s, TIEFLING, { amount: 5, parts: [{ amount: 5, damageType: 'fire' }, { amount: Number.NaN }] })
    expect(r.state).toBe(s)
    expect(kinds(r)).toEqual(['refused'])
  })
})

// ── Efeitos ligados e ações (Fase 2, onda efeitos-ativos) ─────────────────────

describe('efeitos ligados: a Fúria pela ação que a liga', () => {
  /** Bárbaro meio-orc (Krusk) no nível dado, com um caminho e o que carrega. */
  const barbarian = (level: number, patch: Partial<CharacterDraft> = {}, subclass: string | null = null): PlaySheet => {
    const base = structuredClone(COMPLETE_DRAFT)
    return buildPlaySheet({ ...base, level, ...patch, classChoices: { ...base.classChoices, subclass } })
  }
  const plate = {
    equipment: {
      ...structuredClone(EMPTY_DRAFT.equipment),
      method: 'wealth' as const,
      purchasedItems: [{ itemId: 'plate', quantity: 1, source: 'purchased' as const }],
    },
  }
  const enter = (s: PlayState, sh: PlaySheet, option?: string) => performAction(s, sh, 'rage-enter', { now: 5, ...(option ? { option } : {}) })
  const end = (s: PlayState, sh: PlaySheet) => performAction(s, sh, 'rage-end', { now: 6 })

  it('entrar em fúria gasta 1 uso, liga o efeito e encerra a concentração, com o motivo (decisão (e), pág. 48)', () => {
    const sh = barbarian(3, { race: 'tiefling' })
    const concentrating = startConcentration(state(), sh, { label: 'Bênção' }, 0).state
    const r = enter(concentrating, sh)
    expect(r.state.activeEffects).toEqual([{ id: 'rage', startedAt: 5 }])
    expect(r.state.resourcesSpent).toEqual({ rage: 1 })
    expect(r.state.concentration).toBeNull()
    expect(r.notices).toEqual([{ kind: 'concentrationEnded', text: 'A concentração em Bênção terminou: entrar em fúria (pág. 48).' }])
    // O de antes não muda: um passo só do desfazer volta a fúria, o uso e a concentração.
    expect(concentrating.concentration?.label).toBe('Bênção')
    expect(concentrating.activeEffects).toEqual([])
  })

  it('sem usos, recusa sem gastar nada; já em fúria, também', () => {
    const sh = barbarian(1)
    const spent = { ...state(), resourcesSpent: { rage: 2 } }
    const r = enter(spent, sh)
    expect(r.state).toBe(spent)
    expect(r.notices).toEqual([{ kind: 'refused', text: 'Entrar em fúria: sem usos de Fúria: eles voltam num descanso longo.' }])
    const raging = enter(state(), sh).state
    const again = enter(raging, sh)
    expect(again.state).toBe(raging)
    expect(again.notices).toEqual([{ kind: 'refused', text: 'Já está em fúria.' }])
  })

  it('no 20º nível os usos são ilimitados: liga sem gastar e ainda encerra a concentração de quem conjura', () => {
    const sh = barbarian(20, { race: 'tiefling' })
    const r = enter(startConcentration(state(), sh, { label: 'Escuridão' }, 0).state, sh)
    expect(r.state.resourcesSpent).toEqual({})
    expect(r.state.activeEffects.map(a => a.id)).toEqual(['rage'])
    expect(r.state.concentration).toBeNull()
  })

  it('morto, inconsciente ou incapacitado não entra em fúria', () => {
    const sh = barbarian(1)
    expect(enter({ ...state(), lifeState: 'dead' }, sh).notices[0]).toEqual({ kind: 'refused', text: 'Entrar em fúria: o personagem está morto.' })
    expect(enter({ ...state(), conditions: ['stunned'] }, sh).notices[0].kind).toBe('refused')
    expect(enter({ ...state(), lifeState: 'dying', damageTaken: sh.maxHp }, sh).notices[0].text)
      .toBe('Entrar em fúria: Incapacitado (por Inconsciente), sem ações nem reações (pág. 292).')
    // O liga direto (o efeito sem custo) recusa o inconsciente gravado também.
    expect(activateToggle({ ...state(), conditions: ['unconscious'] }, sh, 'rage', { now: 1 }).notices[0])
      .toEqual({ kind: 'refused', text: 'Em fúria: o personagem está inconsciente.' })
  })

  it('encerrar pede estar em fúria; em fúria, desliga sem custo', () => {
    const sh = barbarian(1)
    expect(end(state(), sh).notices).toEqual([{ kind: 'refused', text: 'Encerrar a fúria: só em fúria.' }])
    // Num turno seguinte: no mesmo, encerrar seria a segunda ação bônus, que só avisa.
    const raging = newTurn(enter(state(), sh).state, sh).state
    const r = end(raging, sh)
    expect(r.state.activeEffects).toEqual([])
    expect(r.state.resourcesSpent).toEqual({ rage: 1 })
    expect(r.notices).toEqual([])
  })

  // "Sua fúria dura por 1 minuto. Ela termina prematuramente se [...] seu turno acabar e você não
  // tiver atacado [...]" (pág. 48): esse fim não é ação. Só encerrar por vontade é ação bônus.
  it('atordoado em fúria: a ação de encerrar recusa, e o fim que não é ação desliga, com a exaustão do Frenesi', () => {
    const sh = barbarian(3, {}, 'berserker')
    for (const condition of ['stunned', 'paralyzed', 'incapacitated', 'petrified'] as const) {
      const stuck = addCondition(enter(state(), sh, 'frenzy').state, sh, condition).state
      expect(end(stuck, sh).notices[0].kind).toBe('refused')
      const r = deactivateToggle(stuck, sh, 'rage')
      expect(r.state.activeEffects).toEqual([])
      expect(r.state.exhaustionLevel).toBe(1)
      expect(r.notices).toEqual([{ kind: 'warning', text: 'Frenesi: ao terminar, você sofre um nível de exaustão (0 → 1, pág. 292).' }])
    }
  })

  it('cair a 0 PV encerra a fúria, com aviso; aplicar o Inconsciente também', () => {
    const sh = barbarian(1)
    const raging = enter(state(), sh).state
    const down = applyDamage(raging, sh, { amount: sh.maxHp })
    expect(down.state.lifeState).toBe('dying')
    expect(down.state.activeEffects).toEqual([])
    expect(down.notices.map(n => n.text)).toContain('Fúria: terminou ao cair inconsciente (pág. 48).')
    const asleep = addCondition(raging, sh, 'unconscious')
    expect(asleep.state.activeEffects).toEqual([])
    expect(asleep.notices.map(n => n.text)).toContain('Fúria: terminou ao cair inconsciente (pág. 48).')
    // Outra condição não encerra.
    expect(addCondition(raging, sh, 'prone').state.activeEffects).toHaveLength(1)
  })

  // A morte instantânea (pág. 199) e a da exaustão 6 (pág. 292) não passam pelo Inconsciente; o
  // morto não continua em fúria (decisão de 2026-10-30).
  it('a morte instantânea encerra a fúria, com a exaustão do Frenesi, e o "Fui revivido" volta sem ela', () => {
    const sh = barbarian(3, {}, 'berserker')
    const frenzy = enter(state(), sh, 'frenzy').state
    const dead = applyDamage(frenzy, sh, { amount: sh.maxHp * 2 })
    expect(dead.state.lifeState).toBe('dead')
    expect(dead.state.activeEffects).toEqual([])
    expect(dead.state.exhaustionLevel).toBe(1)
    expect(dead.notices.map(n => n.text)).toEqual([
      `Morte instantânea: o dano que sobrou (${sh.maxHp}) é igual ou maior que o PV máximo (${sh.maxHp}) (pág. 199).`,
      'Fúria: terminou com a morte.',
      'Frenesi: ao terminar, você sofre um nível de exaustão (0 → 1, pág. 292).',
    ])
    const back = revive(dead.state, sh)
    expect(back.state.lifeState).toBe('conscious')
    expect(back.state.activeEffects).toEqual([])
  })

  it('a exaustão 6 encerra a fúria; com o Frenesi, a exaustão fica na 6', () => {
    const sh = barbarian(3, {}, 'berserker')
    const raging = { ...enter(state(), sh).state, exhaustionLevel: 5 as const }
    const r = setExhaustion(raging, sh, 6)
    expect(r.state.lifeState).toBe('dead')
    expect(r.state.activeEffects).toEqual([])
    expect(r.notices.map(n => n.text)).toEqual(['Exaustão 6: morte, com 0 PV (pág. 292).', 'Fúria: terminou com a morte.'])
    const frenzy = { ...enter(state(), sh, 'frenzy').state, exhaustionLevel: 5 as const }
    const f = setExhaustion(frenzy, sh, 6)
    expect(f.state.activeEffects).toEqual([])
    expect(f.state.exhaustionLevel).toBe(6)
    expect(f.notices.map(n => n.text)).toEqual(['Exaustão 6: morte, com 0 PV (pág. 292).', 'Fúria: terminou com a morte.'])
  })

  it('o Frenesi: escolhido ao entrar, ao terminar dá +1 de exaustão pelo caminho do setExhaustion, num passo só', () => {
    const sh = barbarian(3, {}, 'berserker')
    const frenzy = newTurn(enter(state(), sh, 'frenzy').state, sh).state
    expect(frenzy.activeEffects).toEqual([{ id: 'rage', startedAt: 5, option: 'frenzy' }])
    const r = end(frenzy, sh)
    expect(r.state.activeEffects).toEqual([])
    expect(r.state.exhaustionLevel).toBe(1)
    expect(r.notices).toEqual([{ kind: 'warning', text: 'Frenesi: ao terminar, você sofre um nível de exaustão (0 → 1, pág. 292).' }])
    // Cair inconsciente também acaba a fúria: a exaustão vem junto.
    const down = applyDamage(frenzy, sh, { amount: sh.maxHp })
    expect(down.state.exhaustionLevel).toBe(1)
    // Sem frenesi, nada; opção que a ficha não tem, recusa.
    expect(end(enter(state(), sh).state, sh).state.exhaustionLevel).toBe(0)
    expect(enter(state(), barbarian(3), 'frenzy').notices[0]).toEqual({ kind: 'refused', text: 'Em fúria: opção desconhecida (frenzy).' })
  })

  // A Fúria dura 1 minuto (pág. 48); o descanso curto, pelo menos 1 hora, e o longo, 8 (pág. 188).
  describe('o descanso encerra a fúria, antes do que ele devolve', () => {
    const ENDS = 'Fúria: acaba durante o descanso (pág. 48).'
    const FRENZY = 'Frenesi: ao terminar, você sofre um nível de exaustão (0 → 1, pág. 292).'

    it('descanso curto: a fúria acaba, com o Frenesi, e a prévia já diz', () => {
      const sh = barbarian(3, {}, 'berserker')
      const frenzy = enter(state(), sh, 'frenzy').state
      expect(previewShortRest(frenzy, sh).effectsEnding).toEqual([ENDS, FRENZY])
      const r = completeShortRest(frenzy, sh)
      expect(r.state.activeEffects).toEqual([])
      expect(r.state.exhaustionLevel).toBe(1)
      expect(r.notices.map(n => n.text)).toEqual([ENDS, FRENZY])
      // A Fúria é de descanso longo: o uso continua gasto.
      expect(r.state.resourcesSpent).toEqual({ rage: 1 })
      // Sem o Frenesi, só acaba.
      expect(completeShortRest(enter(state(), sh).state, sh).notices.map(n => n.text)).toEqual([ENDS])
    })

    it('descanso longo: a exaustão do Frenesi vem antes do −1, e os usos voltam', () => {
      const sh = barbarian(3, {}, 'berserker')
      const frenzy = enter(state(), sh, 'frenzy').state
      const p = previewLongRest(frenzy, sh)
      expect(p.effectsEnding).toEqual([ENDS, FRENZY])
      expect(p.exhaustion).toEqual({ before: 1, after: 0 })
      const r = completeLongRest(frenzy, sh)
      expect(r.state.activeEffects).toEqual([])
      expect(r.state.exhaustionLevel).toBe(0)
      expect(r.state.resourcesSpent).toEqual({})
      expect(r.notices.map(n => n.text)).toEqual([ENDS, FRENZY, `Descanso longo: PV ${sh.maxHp} → ${sh.maxHp}; exaustão 1 → 0.`])
      // Sem comer e beber, o nível do Frenesi fica.
      expect(completeLongRest(frenzy, sh, { ateAndDrank: false }).state.exhaustionLevel).toBe(1)
    })

    it('se o fim do Frenesi levar à exaustão 6, o descanso não conclui e diz o que fazer', () => {
      const sh = barbarian(3, {}, 'berserker')
      const frenzy = { ...enter(state(), sh, 'frenzy').state, exhaustionLevel: 5 as const }
      const reason = 'Fúria: acaba durante o descanso (pág. 48). Frenesi: ao terminar, você sofre um nível de exaustão (5 → 6, pág. 292). Exaustão 6: morte, com 0 PV (pág. 292). O descanso não dá benefícios a quem morre: se for o caso, encerre o efeito antes, na seção Efeitos ativos.'
      expect(previewLongRest(frenzy, sh)).toMatchObject({ blocked: true, blockReason: reason, effectsEnding: [] })
      expect(previewShortRest(frenzy, sh)).toMatchObject({ blockReason: reason, effectsEnding: [] })
      for (const r of [completeLongRest(frenzy, sh), completeShortRest(frenzy, sh)]) {
        expect(r.state).toBe(frenzy)
        expect(r.notices).toEqual([{ kind: 'refused', text: reason }])
      }
    })
  })

  // "Se você cair para 0 pontos de vida enquanto estiver em fúria e não morrer, você pode realizar
  // um teste de resistência de Constituição CD 10. [...] Cada vez que você utilizar essa
  // característica após a primeira, a CD aumenta em 5" (Fúria Implacável, pág. 49).
  describe('Fúria Implacável (bárbaro 11)', () => {
    const OFFER = (dc: number) => `Fúria Implacável: você caiu a 0 PV em fúria. Faça um teste de resistência de Constituição CD ${dc}: se passar, fica com 1 PV em vez disso e continua em fúria (pág. 49).`
    const RESET = 'Fúria Implacável: a CD volta a 10 (pág. 49).'
    const offerOf = (r: { notices: { kind: string; dc?: number }[] }) => r.notices.find(n => n.kind === 'dropToOneHpSave')

    it('cair a 0 PV em fúria oferece o teste, com a CD e o dano, ao lado da Resistência Implacável', () => {
      const sh = barbarian(11)
      const r = applyDamage(enter(state(), sh).state, sh, { amount: sh.maxHp })
      // A queda acontece: a fúria acaba, como em quem não tem a característica.
      expect(r.state.lifeState).toBe('dying')
      expect(r.state.activeEffects).toEqual([])
      expect(offerOf(r)).toEqual({ kind: 'dropToOneHpSave', text: OFFER(10), dc: 10, damage: { amount: sh.maxHp } })
      // O meio-orc também tem a Resistência Implacável: as duas, à escolha.
      expect(r.notices.some(n => n.kind === 'dropToOneHp')).toBe(true)
      // De Placas, a fúria liga sem os benefícios, e a Fúria Implacável não é um deles.
      const plated = barbarian(11, plate)
      expect(offerOf(applyDamage(enter(state(), plated).state, plated, { amount: plated.maxHp }))?.dc).toBe(10)
    })

    it('quem passa fica com 1 PV e em fúria, sem a exaustão do Frenesi; a CD sobe 5 a cada uso', () => {
      const sh = barbarian(11, {}, 'berserker')
      const raging = enter(state(), sh, 'frenzy').state
      const r = applyDamageDroppingToOneHp(raging, sh, { amount: sh.maxHp }, 'save')
      expect(getCurrentHp(r.state, sh)).toBe(1)
      expect(r.state.lifeState).toBe('conscious')
      expect(r.state.conditions).toEqual([])
      expect(r.state.activeEffects).toEqual([{ id: 'rage', startedAt: 5, option: 'frenzy' }])
      expect(r.state.exhaustionLevel).toBe(0)
      expect(r.state.restCounters).toEqual({ 'relentless-rage': 1 })
      // A Resistência Implacável fica com o uso dela.
      expect(r.state.resourcesSpent).toEqual({ rage: 1 })
      expect(r.notices).toEqual([{
        kind: 'info',
        text: 'Fúria Implacável: passou no teste de resistência de Constituição (CD 10) e ficou com 1 PV em vez de cair a 0; continua em fúria. A próxima CD é 15 (pág. 49).',
      }])
      expect(offerOf(applyDamage(r.state, sh, { amount: 1 }))?.dc).toBe(15)
      const twice = applyDamageDroppingToOneHp(r.state, sh, { amount: 1 }, 'save')
      expect(twice.state.restCounters).toEqual({ 'relentless-rage': 2 })
      expect(offerOf(applyDamage(twice.state, sh, { amount: 1 }))?.dc).toBe(20)
    })

    it('o descanso curto ou longo volta a CD a 10, com aviso; sem uso, sem aviso', () => {
      const sh = barbarian(11)
      const used = { ...state(), restCounters: { 'relentless-rage': 2 } }
      for (const r of [completeShortRest(used, sh), completeLongRest(used, sh)]) {
        expect(r.state.restCounters).toEqual({})
        expect(r.notices.map(n => n.text)).toContain(RESET)
        expect(offerOf(applyDamage(enter(r.state, sh).state, sh, { amount: sh.maxHp }))?.dc).toBe(10)
      }
      expect(completeShortRest(state(), sh).notices.map(n => n.text)).not.toContain(RESET)
    })

    // O descanso só zera os contadores que a ficha declara: o que ficou sem dono voltaria com a CD
    // de antes do descanso.
    it('a ficha que perde a característica perde o contador: descansa no 10 e, de volta ao 11, a CD é 10', () => {
      const sh11 = barbarian(11)
      const sh10 = barbarian(10)
      const used = { ...state(), restCounters: { 'relentless-rage': 2 } }
      expect(reconcilePlayState(used, sh11).restCounters).toEqual({ 'relentless-rage': 2 })
      expect(reconcilePlayState(used, sh10).restCounters).toEqual({})
      // Na abertura, sem aviso, como o gasto do recurso que a ficha não tem.
      expect(reconcileLoadedPlayState(used, sh10)).toEqual({ state: { ...used, restCounters: {} }, notices: [] })
      const rested = completeLongRest(used, sh10).state
      expect(rested.restCounters).toEqual({})
      expect(offerOf(applyDamage(enter(rested, sh11).state, sh11, { amount: sh11.maxHp }))?.dc).toBe(10)
    })

    it('fora da fúria, antes do 11º nível ou na morte instantânea, nada; o "passei" fora da fúria aplica o dano e avisa', () => {
      const sh = barbarian(11)
      expect(offerOf(applyDamage(state(), sh, { amount: sh.maxHp }))).toBeUndefined()
      const sh10 = barbarian(10)
      expect(offerOf(applyDamage(enter(state(), sh10).state, sh10, { amount: sh10.maxHp }))).toBeUndefined()
      expect(offerOf(applyDamage(enter(state(), sh).state, sh, { amount: sh.maxHp * 2 }))).toBeUndefined()
      const calm = applyDamageDroppingToOneHp(state(), sh, { amount: sh.maxHp }, 'save')
      expect(calm.state.lifeState).toBe('dying')
      expect(calm.state.restCounters).toEqual({})
      expect(calm.notices).toContainEqual({
        kind: 'warning',
        text: 'Fúria Implacável não se aplica a este dano: só quando ele deixaria você a 0 PV sem matar na hora, e em fúria. O dano foi aplicado normalmente.',
      })
    })
  })

  it('de Placas: gasta o uso, liga e avisa que não há benefícios', () => {
    const sh = barbarian(1, plate)
    const r = enter(state(), sh)
    expect(r.state.resourcesSpent).toEqual({ rage: 1 })
    expect(r.state.activeEffects.map(a => a.id)).toEqual(['rage'])
    expect(r.notices).toEqual([{ kind: 'warning', text: 'Fúria sem os benefícios: você está de Placas (pág. 48).' }])
  })

  it('Fúria Inconsciente: entrar suspende o Amedrontado gravado, com aviso', () => {
    const sh = barbarian(6, {}, 'berserker')
    const r = enter({ ...state(), conditions: ['frightened'] }, sh)
    expect(r.state.conditions).toEqual(['frightened'])
    expect(r.notices).toEqual([{ kind: 'info', text: 'Amedrontado fica suspenso: você está imune (Fúria Inconsciente).' }])
  })

  it('em fúria não se concentra: startConcentration recusa, com a página', () => {
    const sh = barbarian(3, { race: 'tiefling' })
    const raging = enter(state(), sh).state
    const r = startConcentration(raging, sh, { label: 'Escuridão' }, 9)
    expect(r.state).toBe(raging)
    expect(r.notices).toEqual([{ kind: 'refused', text: 'Em fúria você não pode se concentrar (pág. 48).' }])
  })

  it('a reconciliação tira o efeito que a ficha não tem mais, com aviso; a opção perdida também avisa', () => {
    const raging = enter(state(), barbarian(3, {}, 'berserker'), 'frenzy').state
    const fighter = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), class: 'fighter', level: 3 })
    const r = reconcileLoadedPlayState(raging, fighter)
    expect(r.state.activeEffects).toEqual([])
    expect(r.notices).toEqual([{ kind: 'info', text: 'A ficha mudou: 1 efeito ligado deixou de valer e foi desligado, porque a ficha não o tem mais.' }])
    // Trocou de caminho (ou baixou do 3º nível): a fúria fica, sem o Frenesi, e o aviso diz que a
    // exaustão do fim não vem mais.
    for (const sh of [barbarian(3), barbarian(2, {}, 'berserker')]) {
      const lost = reconcileLoadedPlayState(raging, sh)
      expect(lost.state.activeEffects).toEqual([{ id: 'rage', startedAt: 5 }])
      expect(lost.notices).toEqual([{ kind: 'info', text: 'A ficha mudou: continua em fúria, sem a opção escolhida ao ligar, porque a ficha não a tem mais; o que ela fazia, inclusive ao terminar, deixa de valer.' }])
      expect(end(lost.state, sh).state.exhaustionLevel).toBe(0)
    }
    expect(reconcileLoadedPlayState(raging, barbarian(3, {}, 'berserker')).notices).toEqual([])
  })

  it('gastar a Fúria pela bolinha do recurso só gasta: quem encerra a concentração é entrar em fúria', () => {
    const sh = barbarian(3, { race: 'tiefling' })
    const concentrating = startConcentration(state(), sh, { label: 'Bênção' }, 0).state
    const r = spendResource(concentrating, sh, 'rage')
    expect(r.state.concentration?.label).toBe('Bênção')
    expect(r.notices).toEqual([])
  })
})

describe('efeitos recebidos: o catálogo no estado de jogo', () => {
  const fighter = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'fighter', level: 3 })
  const on = (s: PlayState, id: string) => activateToggle(s, fighter, id, { now: 5 })
  const ids = (s: PlayState) => s.activeEffects.map(a => a.id)

  it('a magia recebida liga a 0 PV (a Bênção vale no teste contra a morte); a do personagem morto, não', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 20 })
    expect(ids(on(dying, 'spell:bless').state)).toEqual(['spell:bless'])
    const dead = state({ lifeState: 'dead', damageTaken: 20 })
    expect(on(dead, 'spell:bless').notices).toEqual([{ kind: 'refused', text: 'Sob a Bênção: o personagem está morto.' }])
  })

  // "Você perde esse benefício se estiver incapacitado [...] ou se seu deslocamento cair para 0"
  // (linhas 17413-17414).
  it('o Esquivar acaba incapacitado, derivado também, e com o deslocamento em 0', () => {
    const dodging = on(state(), 'action:dodge').state
    const stunned = addCondition(dodging, fighter, 'stunned')
    expect(ids(stunned.state)).toEqual([])
    expect(stunned.notices).toContainEqual({ kind: 'info', text: 'Esquivar: terminou, você está incapacitado (Atordoado) (pág. 194).' })
    const grappled = addCondition(dodging, fighter, 'grappled')
    expect(ids(grappled.state)).toEqual([])
    expect(grappled.notices).toContainEqual({ kind: 'info', text: 'Esquivar: terminou, seu deslocamento caiu para 0 (pág. 194).' })
    expect(ids(setExhaustion(dodging, fighter, 5).state)).toEqual([])
    // O Inconsciente incapacita: a queda a 0 PV o encerra como encerra a fúria.
    const fallen = applyDamage(dodging, fighter, { amount: 30 })
    expect(ids(fallen.state)).toEqual([])
    expect(fallen.notices).toContainEqual({ kind: 'info', text: 'Esquivar: terminou ao cair inconsciente (pág. 194).' })
    // O que não incapacita nem para, não.
    expect(ids(addCondition(dodging, fighter, 'poisoned').state)).toEqual(['action:dodge'])
    expect(ids(setExhaustion(dodging, fighter, 2).state)).toEqual(['action:dodge'])
  })

  // "Quando a magia acabar, o alvo não poderá se mover ou realizar ações até depois do seu próximo
  // turno" (linhas 28217-28219): o app não aplica, e o aviso do fim o diz.
  it('a Velocidade avisa a letargia quando acaba', () => {
    const hasted = on(state(), 'spell:haste').state
    expect(deactivateToggle(hasted, fighter, 'spell:haste').notices).toEqual([{
      kind: 'warning',
      text: 'Velocidade acabou: você não pode se mover nem realizar ações até depois do seu próximo turno (pág. 289).',
    }])
  })

  it('o descanso encerra o que dura menos que ele: a Bênção no curto, a Armadura Arcana só no longo', () => {
    const both = on(on(state(), 'spell:bless').state, 'spell:mage-armor').state
    const short = completeShortRest(both, fighter)
    expect(ids(short.state)).toEqual(['spell:mage-armor'])
    expect(short.notices).toContainEqual({ kind: 'info', text: 'Bênção: acaba durante o descanso (pág. 223).' })
    expect(ids(completeLongRest(both, fighter).state)).toEqual([])
  })
})

describe('efeitos recebidos: o deslocamento ao vivo (getPlaySpeed)', () => {
  const human = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'fighter', level: 1 })
  const on = (s: PlayState, ...ids: string[]) =>
    ids.reduce((acc, id) => activateToggle(acc, human, id, { now: 1 }).state, s)

  // "o deslocamento do alvo é dobrado" (linhas 28211-28212); "aumenta em 3 metros" (linhas 25906-25907).
  it('a Velocidade dobra o deslocamento; Passos Longos soma 3 m antes do dobro', () => {
    expect(getPlaySpeed(state(), human)).toBe(30)
    expect(getPlaySpeed(on(state(), 'spell:haste'), human)).toBe(60)
    expect(getPlaySpeed(on(state(), 'spell:longstrider'), human)).toBe(40)
    expect(getPlaySpeed(on(state(), 'spell:haste', 'spell:longstrider'), human)).toBe(80)
    // A Exaustão 2 corta a metade por último, na grade de 1,5 m.
    expect(getPlaySpeed(on(state({ exhaustionLevel: 2 }), 'spell:longstrider'), human)).toBe(20)
  })

  it('o Agarrado zera mesmo com Passos Longos: não se beneficia de bônus (pág. 291)', () => {
    const grappled = on(state({ conditions: ['grappled'] }), 'spell:longstrider', 'spell:haste')
    expect(getPlaySpeed(grappled, human)).toBe(0)
  })
})

// "Recebeu uma magia?": quem conjura é quem mantém a concentração. A magia que você conjurou em si e
// sustenta acaba junto com a sua concentração; a de um aliado só sai à mão.
describe('efeitos recebidos: a magia sustentada pela sua concentração', () => {
  const cleric = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'cleric', level: 3 })
  const self = (s: PlayState, id: string) => activateToggle(s, cleric, id, { now: 5, sustainedByConcentration: true })
  const ally = (s: PlayState, id: string) => activateToggle(s, cleric, id, { now: 5 })
  const ids = (s: PlayState) => s.activeEffects.map(a => a.id)

  it('conjurar em si começa a concentração na magia, e a de antes termina', () => {
    const before = startConcentration(state(), cleric, { label: 'Raio de Luar' }, 1).state
    const r = self(before, 'spell:bless')
    expect(r.state.concentration).toEqual({ spellId: 'bless', label: 'Bênção', startedAt: 5 })
    expect(r.state.activeEffects).toEqual([{ id: 'spell:bless', startedAt: 5, sustainedByConcentration: true }])
    expect(kinds(r)).toEqual(['concentrationReplaced'])
  })

  it('a concentração digitada com o nome da magia é a mesma: sem aviso de duas magias nem novo começo', () => {
    const typed = startConcentration(state(), cleric, { label: 'bencao ' }, 1).state
    const r = self(typed, 'spell:bless')
    expect(r.notices).toEqual([])
    expect(r.state.concentration).toEqual({ spellId: 'bless', label: 'bencao', startedAt: 1 })
    expect(r.state.activeEffects).toEqual([{ id: 'spell:bless', startedAt: 5, sustainedByConcentration: true }])
    // Sustentada por ela: acaba junto.
    expect(endConcentration(r.state, cleric).state.activeEffects).toEqual([])
    // Outro nome é outra magia: a de antes termina.
    expect(kinds(self(startConcentration(state(), cleric, { label: 'Bênção Maior' }, 1).state, 'spell:bless'))).toEqual(['concentrationReplaced'])
  })

  it('perder a concentração desliga a Bênção própria e mantém a de aliado', () => {
    const both = ally(self(state(), 'spell:bless').state, 'spell:shield-of-faith').state
    const ended = endConcentration(both, cleric)
    expect(ids(ended.state)).toEqual(['spell:shield-of-faith'])
    expect(ended.notices).toEqual([
      { kind: 'concentrationEnded', text: 'A concentração em Bênção terminou: encerrada.' },
      { kind: 'info', text: 'Bênção: terminou com a sua concentração.' },
    ])
    // Pelo dano que deixa inconsciente, pela incapacitação e por outra concentração, igual.
    expect(ids(applyDamage(both, cleric, { amount: 30 }).state)).toEqual(['spell:shield-of-faith'])
    expect(ids(addCondition(both, cleric, 'stunned').state)).toEqual(['spell:shield-of-faith'])
    expect(ids(startConcentration(both, cleric, { label: 'Raio de Luar' }, 9).state)).toEqual(['spell:shield-of-faith'])
    // A de aliado não depende da concentração de ninguém aqui.
    const allyBless = ally(state(), 'spell:bless').state
    expect(ids(endConcentration(startConcentration(allyBless, cleric, { label: 'Raio de Luar' }, 9).state, cleric).state)).toEqual(['spell:bless'])
  })

  it('o "Já acabou" da magia própria encerra a concentração nela', () => {
    const blessed = self(state(), 'spell:bless').state
    const r = deactivateToggle(blessed, cleric, 'spell:bless')
    expect(r.state.concentration).toBeNull()
    expect(r.notices).toEqual([{ kind: 'concentrationEnded', text: 'A concentração em Bênção terminou: Bênção acabou.' }])
  })

  // A concentração dura no máximo o que a magia dura (pág. 205, linhas 18299-18302): a magia própria
  // que o descanso encerra leva a concentração junto, como o "Já acabou".
  it('o descanso que encerra a magia própria encerra a concentração nela; a de aliado não mexe na sua', () => {
    const short = completeShortRest(self(state(), 'spell:bless').state, cleric)
    expect(short.state.activeEffects).toEqual([])
    expect(short.state.concentration).toBeNull()
    expect(short.notices).toContainEqual({ kind: 'info', text: 'Bênção: acaba durante o descanso (pág. 223).' })
    expect(short.notices).toContainEqual({ kind: 'concentrationEnded', text: 'A concentração em Bênção terminou: Bênção acabou.' })
    // A Bênção de um aliado acaba no descanso, e a sua concentração em outra magia fica.
    const allyBless = ally(startConcentration(state(), cleric, { label: 'Raio de Luar' }, 1).state, 'spell:bless').state
    const rested = completeShortRest(allyBless, cleric)
    expect(rested.state.activeEffects).toEqual([])
    expect(rested.state.concentration?.label).toBe('Raio de Luar')
  })

  it('o descanso longo encerra o Auxílio Divino do paladino e a concentração nele', () => {
    const paladin = buildPlaySheet({
      ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'paladin', level: 2,
      spellChoices: { cantrips: [], spells: ['divine-favor'] },
    })
    const favored = activateToggle(state(), paladin, 'spell:divine-favor', { now: 1 }).state
    const long = completeLongRest(favored, paladin)
    expect(long.state.activeEffects).toEqual([])
    expect(long.state.concentration).toBeNull()
    expect(long.notices).toContainEqual({ kind: 'concentrationEnded', text: 'A concentração em Auxílio Divino terminou: Auxílio Divino acabou.' })
  })

  it('a Velocidade própria que acaba com a concentração avisa a letargia', () => {
    const wizard = buildPlaySheet({ ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'wizard', level: 5 })
    const hasted = activateToggle(state(), wizard, 'spell:haste', { now: 1, sustainedByConcentration: true }).state
    expect(endConcentration(hasted, wizard).notices.map(n => n.text)).toContain(
      'Velocidade acabou: você não pode se mover nem realizar ações até depois do seu próximo turno (pág. 289).')
  })

  it('quem não pode se concentrar não conjura em si: inconsciente, incapacitado', () => {
    const dying = state({ lifeState: 'dying', damageTaken: 99 })
    expect(self(dying, 'spell:bless').notices).toEqual([{ kind: 'refused', text: 'Só um personagem consciente pode se concentrar.' }])
    // Recebida de um aliado, a mesma Bênção liga (vale nos testes contra a morte).
    expect(ids(ally(dying, 'spell:bless').state)).toEqual(['spell:bless'])
    const stunned = state({ conditions: ['stunned'] })
    expect(self(stunned, 'spell:bless').state).toBe(stunned)
  })

  it('o Auxílio Divino (Pessoal, concentração) é sempre seu: sustentado sem pedir', () => {
    const paladin = buildPlaySheet({
      ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'paladin', level: 2,
      spellChoices: { cantrips: [], spells: ['divine-favor'] },
    })
    const r = activateToggle(state(), paladin, 'spell:divine-favor', { now: 1 })
    expect(r.state.activeEffects).toEqual([{ id: 'spell:divine-favor', startedAt: 1, sustainedByConcentration: true }])
    expect(r.state.concentration?.label).toBe('Auxílio Divino')
  })

  it('a magia sem concentração ignora o "conjurei em mim"', () => {
    const r = self(state(), 'spell:longstrider')
    expect(r.state.activeEffects).toEqual([{ id: 'spell:longstrider', startedAt: 5 }])
    expect(r.state.concentration).toBeNull()
  })

  it('volta do armazenamento; a sustentada sem concentração não fica', () => {
    const blessed = self(state(), 'spell:bless').state
    const stored = JSON.parse(JSON.stringify(blessed))
    expect(sanitizePlayState(stored, 'char-1').activeEffects).toEqual(blessed.activeEffects)
    expect(sanitizePlayState({ ...stored, concentration: null }, 'char-1').activeEffects).toEqual([])
  })
})

// ── O turno (onda `turno`) ─────────────────────────────────────────────────

describe('o turno: o checklist, o Usar e o Novo turno', () => {
  const draftOf = (classId: string, level: number, subclass: string | null = null): CharacterDraft => {
    const base = structuredClone(COMPLETE_DRAFT)
    return { ...base, class: classId, level, classChoices: { ...base.classChoices, subclass } }
  }
  const fighter = (level: number) => buildPlaySheet(draftOf('fighter', level))
  const barbarian = (level: number, subclass: string | null = null) => buildPlaySheet(draftOf('barbarian', level, subclass))
  /** Uma ação de 1 ação sem efeito, para ver a casa da ação sozinha. */
  const withAnAction = (sh: PlaySheet): PlaySheet => ({
    ...sh,
    actions: [...sh.actions, { id: 'test-action', name: 'Ação de teste', timing: 'action', page: 1, source: 'teste', description: '' }],
  })
  const use = (s: PlayState, sh: PlaySheet, id: string) => performAction(s, sh, id, { now: 7 })

  it('markTurn marca e desmarca uma casa; o mesmo valor devolve o mesmo estado', () => {
    const marked = markTurn(state(), 'movement', true).state
    expect(marked.turn).toEqual({ ...emptyTurn(), movement: true })
    expect(markTurn(marked, 'movement', true).state).toBe(marked)
    expect(markTurn(marked, 'movement', false).state.turn).toEqual(emptyTurn())
  })

  // "Durante o seu turno, você pode realizar uma ação adicional juntamente com sua ação e possível
  // ação bônus" (Surto de Ação, linhas 7265-7273).
  it('o Surto de Ação gasta o uso e dá mais uma ação: a segunda ação do turno não avisa', () => {
    const sh = withAnAction(fighter(2))
    const surged = use(state(), sh, 'action-surge')
    expect(surged.state.resourcesSpent).toEqual({ 'action-surge': 1 })
    expect(surged.state.turn).toEqual({ ...emptyTurn(), extraActions: 1, oncePerTurnUsed: ['action-surge'] })
    expect(surged.notices).toEqual([{ kind: 'info', text: 'Surto de Ação: mais uma ação neste turno, além da sua ação e da possível ação bônus (pág. 85).' }])
    const first = use(surged.state, sh, 'test-action')
    expect(first.state.turn.action).toBe(true)
    expect(first.state.turn.extraActions).toBe(1)
    const second = use(first.state, sh, 'test-action')
    expect(second.notices).toEqual([])
    expect(second.state.turn.extraActions).toBe(0)
    // A terceira já não tem ação a mais: avisa, sem recusar.
    const third = use(second.state, sh, 'test-action')
    expect(third.state).not.toBe(second.state)
    expect(third.notices).toEqual([{ kind: 'warning', text: 'Ação de teste: você já usou a ação deste turno (pág. 191). Se já é outro turno, toque em Novo turno.' }])
  })

  // "A partir do 17º nível, você pode usá-la duas vezes antes do descanso, porém somente uma vez por
  // turno" (linhas 7271-7273).
  it('o Surto de Ação é uma vez por turno: o segundo no mesmo turno avisa, e no turno seguinte não', () => {
    const sh = fighter(17)
    const once = use(state(), sh, 'action-surge').state
    const twice = use(once, sh, 'action-surge')
    expect(twice.state.resourcesSpent).toEqual({ 'action-surge': 2 })
    expect(twice.notices).toContainEqual({ kind: 'warning', text: 'Surto de Ação: só uma vez por turno, e já foi usada neste (pág. 85).' })
    const next = use(newTurn(once, sh).state, sh, 'action-surge')
    expect(next.notices.map(n => n.kind)).toEqual(['info'])
  })

  it('usar sem o recurso recusa sem gastar nem marcar o turno', () => {
    const sh = fighter(2)
    const spent = state({ resourcesSpent: { 'action-surge': 1 } })
    const r = use(spent, sh, 'action-surge')
    expect(r.state).toBe(spent)
    expect(r.notices).toEqual([{ kind: 'refused', text: 'Surto de Ação: sem usos de Surto de Ação: eles voltam num descanso curto ou longo.' }])
  })

  it('o guerreiro 1 não tem o Surto de Ação (é do 2º nível)', () => {
    expect(fighter(1).actions.map(a => a.id)).not.toContain('action-surge')
    expect(use(state(), fighter(1), 'action-surge').notices[0].kind).toBe('refused')
  })

  // Ação bônus: "você pode realizar apenas uma ação bônus no seu turno" (linhas 17082-17098).
  it('a segunda ação bônus no turno avisa, sem recusar: o checklist nunca impede de jogar', () => {
    const sh = barbarian(1)
    const raging = use(state(), sh, 'rage-enter').state
    expect(raging.turn.bonusAction).toBe(true)
    const ended = use(raging, sh, 'rage-end')
    expect(ended.state.activeEffects).toEqual([])
    expect(ended.notices).toEqual([{ kind: 'warning', text: 'Encerrar a fúria: você já usou a ação bônus deste turno, e só há uma por turno (pág. 191).' }])
  })

  it('o dano marca que você sofreu dano (mesmo o que os PV temporários absorvem); o dano 0, não', () => {
    expect(applyDamage(state({ tempHp: 5 }), S, { amount: 3 }).state.turn.afterTurn).toBe(true)
    expect(applyDamage(state(), S, { amount: 0 }).state.turn.afterTurn).toBe(false)
  })

  // "A reação volta no início do seu próximo turno" (linhas 17130-17131).
  it('o Novo turno zera as quatro casas, a ação a mais e a uma vez por turno, com aviso', () => {
    const sh = fighter(2)
    const busy = state({ turn: { action: true, bonusAction: true, movement: true, reaction: true, extraActions: 1, dashes: 1, attacked: true, afterTurn: false, beforeTurn: true, oncePerTurnUsed: ['action-surge'] } })
    const r = newTurn(busy, sh)
    expect(r.state.turn).toEqual(emptyTurn())
    expect(r.notices).toEqual([{ kind: 'info', text: 'Novo turno: a ação, a ação bônus, o movimento e a reação estão de volta.' }])
    // O dano sofrido depois do Novo turno vai para o turno seguinte: o próximo Novo turno o leva.
    const hit = { ...busy, turn: { ...busy.turn, afterTurn: true } }
    expect(newTurn(hit, sh).state.turn).toEqual({ ...emptyTurn(), beforeTurn: true })
  })

  // Escudo Arcano: "até o início do seu próximo turno" (linhas 23192-23203); Esquivar: "até o
  // começo do seu próximo turno" (linhas 17408-17414).
  it('o Novo turno encerra o Escudo Arcano e o Esquivar, com aviso; a Bênção fica', () => {
    // O Escudo Arcano é de alcance Pessoal: só quem o conhece o liga.
    const sh = buildPlaySheet({ ...draftOf('wizard', 1), spellChoices: { cantrips: [], spells: ['shield'] } })
    const on = (s: PlayState, id: string) => activateToggle(s, sh, id, { now: 5 }).state
    const covered = on(on(on(state(), 'spell:shield'), 'action:dodge'), 'spell:bless')
    const r = newTurn(covered, sh)
    expect(r.state.activeEffects.map(a => a.id)).toEqual(['spell:bless'])
    expect(r.notices).toContainEqual({ kind: 'info', text: 'Escudo Arcano: terminou no início do seu turno (pág. 243).' })
    expect(r.notices).toContainEqual({ kind: 'info', text: 'Esquivar: terminou no início do seu turno (pág. 194).' })
  })

  // "Ela termina prematuramente se [...] seu turno acabar e você não tiver atacado [...] desde seu
  // último turno ou não tiver sofrido dano nesse período" (linhas 3662-3667), pelo inglês: só sem
  // ataque E sem dano.
  it('a Fúria sem ataque nem dano no turno lembra o fim prematuro no Novo turno, sem desligar', () => {
    const sh = barbarian(3)
    const raging = use(state(), sh, 'rage-enter').state
    const r = newTurn(raging, sh)
    expect(r.state.activeEffects.map(a => a.id)).toEqual(['rage'])
    expect(r.notices).toContainEqual({
      kind: 'warning',
      text: 'Fúria: nenhum ataque nem dano registrados entre o fim do seu turno anterior e o fim do último. A fúria acaba no fim do seu turno se, desde o seu último turno, você não atacou nenhuma criatura hostil nem sofreu dano (pág. 48). O app conta o dano como vindo depois do seu turno: se você sofreu dano durante o último, ela continua. Se ela acabou, toque em “Já acabou” em Efeitos ativos, na aba Estado.',
    })
    // Com ataque no turno, ou dano entre o fim do turno anterior e o começo dele, não lembra.
    expect(newTurn({ ...raging, turn: { ...raging.turn, attacked: true } }, sh).notices.map(n => n.kind)).toEqual(['info'])
    expect(newTurn({ ...raging, turn: { ...raging.turn, beforeTurn: true } }, sh).notices.map(n => n.kind)).toEqual(['info'])
  })

  // A janela do livro vai do fim do seu turno anterior ao fim deste (linhas 3662-3666); a do Novo
  // turno, do começo de um turno ao do outro.
  it('a janela do fim prematuro é a do livro: o dano antes do seu turno segura a fúria dele, e o de depois vai para o próximo', () => {
    const sh = barbarian(3)
    const hasReminder = (s: PlayState) => newTurn(s, sh).notices.some(n => n.kind === 'warning')
    // Turno 1: entra em fúria e ataca. No turno do inimigo, sofre 7.
    const turn1 = use(use(newTurn(state(), sh).state, sh, 'rage-enter').state, sh, 'attack').state
    const hitAfter1 = applyDamage(turn1, sh, { amount: 7 }).state
    expect(hasReminder(hitAfter1)).toBe(false)
    // Turno 2: só a Disparada, e ninguém o acerta. O dano depois do turno 1 conta para o fim do 2.
    const turn2 = use(newTurn(hitAfter1, sh).state, sh, 'dash').state
    expect(hasReminder(turn2)).toBe(false)
    // Turno 3: sem ataque nem dano desde o fim do turno 2, ela acaba no fim do 3 — mesmo que um
    // inimigo o acerte depois, no turno dele.
    const turn3 = use(newTurn(turn2, sh).state, sh, 'dash').state
    expect(hasReminder(applyDamage(turn3, sh, { amount: 5 }).state)).toBe(true)
  })

  it('o ataque de oportunidade, depois do seu turno, segura a fúria do turno seguinte, não a do que acabou', () => {
    const sh = barbarian(3)
    const raging = use(newTurn(state(), sh).state, sh, 'rage-enter').state
    const reacted = use(raging, sh, 'opportunity-attack').state
    expect(newTurn(reacted, sh).notices.some(n => n.kind === 'warning')).toBe(true)
    const next = newTurn(reacted, sh).state
    expect(newTurn(next, sh).notices.some(n => n.kind === 'warning')).toBe(false)
  })

  // Fúria Persistente: "sua fúria é tão violenta que ela só termina prematuramente se você cair
  // inconsciente ou se escolher terminá-la" (linhas 3743-3746).
  it('o bárbaro 15 (Fúria Persistente) não recebe o lembrete', () => {
    const sh = barbarian(15)
    const raging = use(state(), sh, 'rage-enter').state
    expect(newTurn(raging, sh).notices.map(n => n.kind)).toEqual(['info'])
  })

  it('o estado de antes não muda: o desfazer do store volta o turno', () => {
    const sh = barbarian(1)
    const before = state()
    use(before, sh, 'rage-enter')
    expect(before.turn).toEqual(emptyTurn())
  })

  it('sanitizePlayState: sem o turno, carrega vazio; casa torta fica livre e contagem torta, 0', () => {
    // O estado gravado antes da onda não tem o campo.
    const old: Record<string, unknown> = JSON.parse(JSON.stringify(createPlayState('c')))
    delete old.turn
    expect(sanitizePlayState(old, 'c').turn).toEqual(emptyTurn())
    const torn = { ...old, turn: { action: 'sim', bonusAction: true, extraActions: -2, oncePerTurnUsed: ['action-surge', 3, 'action-surge', ''] } }
    expect(sanitizePlayState(torn, 'c').turn).toEqual({ ...emptyTurn(), bonusAction: true, oncePerTurnUsed: ['action-surge'] })
  })
})

describe('o turno: as ações em combate', () => {
  const draftOf = (classId: string, level: number, patch: Partial<CharacterDraft> = {}): CharacterDraft => {
    const base = structuredClone(COMPLETE_DRAFT)
    return { ...base, class: classId, level, ...patch }
  }
  const krusk = buildPlaySheet(draftOf('barbarian', 3))
  const use = (s: PlayState, sh: PlaySheet, id: string) => performAction(s, sh, id, { now: 7 })
  const turnIds = (s: PlayState, sh: PlaySheet) => getTurnActions(s, sh).map(a => a.id)

  it('Atacar marca a ação e que você atacou; o ataque de oportunidade, a reação', () => {
    const attacked = use(state(), krusk, 'attack')
    expect(attacked.state.turn).toEqual({ ...emptyTurn(), action: true, attacked: true })
    expect(attacked.notices).toEqual([])
    const opportunity = use(state(), krusk, 'opportunity-attack').state
    // O de oportunidade vem no turno de outra criatura: conta para o fim do seu próximo turno.
    expect(opportunity.turn).toEqual({ ...emptyTurn(), reaction: true, afterTurn: true })
  })

  it('a ação que só marca o momento (Desengajar) marca a ação, e nada mais', () => {
    expect(use(state(), krusk, 'disengage').state.turn).toEqual({ ...emptyTurn(), action: true })
  })

  // "O aumento equivale ao seu valor de deslocamento, depois de aplicar qualquer modificador"
  // (linhas 17389-17400).
  it('a Disparada soma o deslocamento já modificado: 9 m viram 18; com o deslocamento em 0, 0', () => {
    const dashed = use(state(), krusk, 'dash').state
    expect(dashed.turn).toEqual({ ...emptyTurn(), action: true, dashes: 1 })
    expect(getTurnMovement(state(), krusk)).toBe(30)
    expect(getTurnMovement(dashed, krusk)).toBe(60)
    // Exaustão 2: metade do deslocamento, e a Disparada dobra a metade.
    expect(getTurnMovement({ ...dashed, exhaustionLevel: 2 }, krusk)).toBe(30)
    expect(getTurnMovement({ ...dashed, conditions: ['grappled'] }, krusk)).toBe(0)
  })

  it('Esquivar liga o efeito do Esquivar e marca a ação; esquivando, ele sai da lista', () => {
    const dodging = use(state(), krusk, 'dodge').state
    expect(dodging.activeEffects.map(a => a.id)).toEqual(['action:dodge'])
    expect(dodging.turn.action).toBe(true)
    expect(turnIds(dodging, krusk)).not.toContain('dodge')
    expect(turnIds(state(), krusk)).toContain('dodge')
  })

  // "Você perde esse benefício [...] se seu deslocamento cair para 0" (linhas 17413-17414): com ele
  // já em 0, o livro não diz se o benefício chega a valer.
  it('Esquivar com o deslocamento já em 0 (Agarrado) não marca nada e diz que o livro não decide', () => {
    const grappled = state({ conditions: ['grappled'] })
    const r = use(grappled, krusk, 'dodge')
    expect(r.state).toBe(grappled)
    expect(r.notices).toEqual([{
      kind: 'unresolvedRule',
      text: 'Esquivar: seu deslocamento já é 0, e o livro só diz que você perde o benefício se ele cair para 0 (pág. 194). O app não sabe se ele vale assim: decida com o Mestre; nada foi marcado.',
    }])
  })

  it('Levantar-se só aparece Caído: tira o Caído e marca o movimento; com o deslocamento em 0, recusa', () => {
    expect(turnIds(state(), krusk)).not.toContain('stand-up')
    const prone = state({ conditions: ['prone'] })
    expect(turnIds(prone, krusk)).toContain('stand-up')
    const up = use(prone, krusk, 'stand-up')
    expect(up.state.conditions).toEqual([])
    expect(up.state.turn).toEqual({ ...emptyTurn(), movement: true })
    expect(up.notices).toEqual([{ kind: 'info', text: 'Levantar-se custa metade do deslocamento (4,5 m) (pág. 192).' }])
    const stuck = state({ conditions: ['prone', 'grappled'] })
    const refused = use(stuck, krusk, 'stand-up')
    expect(refused.state).toBe(stuck)
    expect(refused.notices).toEqual([{ kind: 'refused', text: 'Com deslocamento 0 não é possível se levantar (pág. 193).' }])
  })

  // "Uma criatura incapacitada não pode realizar ações ou reações" (pág. 292); levantar-se "custa
  // metade do seu deslocamento" (linhas 17223-17231): é movimento, e o deslocamento decide.
  it('Levantar-se é movimento: Incapacitado, com deslocamento, levanta como o "Levantar" do Caído; as ações recusam', () => {
    const dazed = state({ conditions: ['prone', 'incapacitated'] })
    expect(turnIds(dazed, krusk)).toContain('stand-up')
    const up = use(dazed, krusk, 'stand-up')
    expect(up.state.conditions).toEqual(['incapacitated'])
    expect(up.state.conditions).toEqual(standUp(dazed, krusk).state.conditions)
    expect(kinds(up)).toEqual(['info'])
    expect(use(dazed, krusk, 'dash').notices).toEqual([{ kind: 'refused', text: 'Disparada: Incapacitado, sem ações nem reações (pág. 292).' }])
    // Paralisado também incapacita, mas zera o deslocamento: quem recusa é o standUp.
    const paralyzed = state({ conditions: ['prone', 'paralyzed'] })
    expect(use(paralyzed, krusk, 'stand-up').notices).toEqual([{ kind: 'refused', text: 'Com deslocamento 0 não é possível se levantar (pág. 193).' }])
  })

  it('a Fúria: entrar some da lista em fúria, e encerrar só aparece nela', () => {
    expect(turnIds(state(), krusk)).toEqual(expect.arrayContaining(['rage-enter']))
    expect(turnIds(state(), krusk)).not.toContain('rage-end')
    const raging = use(state(), krusk, 'rage-enter').state
    expect(turnIds(raging, krusk)).toContain('rage-end')
    expect(turnIds(raging, krusk)).not.toContain('rage-enter')
  })

  it('Atacar com a ação conta como ataque para o fim prematuro da Fúria: sem lembrete no Novo turno', () => {
    const raging = use(state(), krusk, 'rage-enter').state
    const attacked = use(raging, krusk, 'attack').state
    expect(newTurn(attacked, krusk).notices.map(n => n.kind)).toEqual(['info'])
  })
})
