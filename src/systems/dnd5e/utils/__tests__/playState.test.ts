import { describe, it, expect } from 'vitest'
import { roll, sequenceRoller } from '../../../../core/dice'
import type { PlaySheet, PlayState } from '../../types/playState'
import { CONDITION_NOTE_MAX_LENGTH, PLAY_STATE_VERSION, ROLL_HISTORY_LIMIT } from '../../types/playState'
import type { SheetResource } from '../classResourceUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { buildPlaySheet } from '../playSheet'
import {
  addCondition, adjustMaxHp, applyDamage, applyDamageDroppingToOneHp, applyHealing, clearTempHp, completeLongRest, completeShortRest,
  createPlayState, describeHpMaxImmunity, endConcentration, getBaseMaxHp, getCurrentHp, getEffectiveMaxHp, getHitDiceAvailable,
  getLongRestHitDiceRecoverable, getPactSlotsAvailable, getPlayConditionEffects, getPlayConditionState, getPlaySpeed,
  getResourceAvailable, getSpellSlotsAvailable, grantTempHp, previewLongRest, previewShortRest, reconcileLoadedPlayState,
  reconcilePlayState,
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
    expect(getCurrentHp(s, S)).toBe(20)
  })
})

describe('leituras derivadas', () => {
  it('a 0 PV o Inconsciente é derivado, sem ser gravado', () => {
    const s = state({ lifeState: 'dying', damageTaken: 20 })
    expect(getPlayConditionState(s).conditions).toContain('unconscious')
    expect(s.conditions).not.toContain('unconscious')
    const fx = getPlayConditionEffects(s)
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
    const before = addCondition(addCondition(state(), 'poisoned').state, 'petrified').state
    const after = addCondition(addCondition(state(), 'petrified').state, 'poisoned').state
    for (const s of [before, after]) {
      const poisoned = getPlayConditionEffects(s).conditions.find(c => c.id === 'poisoned')
      expect(poisoned?.suspendedBy).toEqual(['petrified'])
      expect(getPlayConditionEffects(s).attack.disadvantage).toEqual([])
    }
    const freed = removeCondition(after, 'petrified').state
    expect(getPlayConditionEffects(freed).attack.disadvantage.map(d => d.label)).toEqual(['Envenenado'])
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
    let s = addCondition(state(), 'unconscious').state
    s = applyDamage(s, S, { amount: 25 }).state
    expect(s.lifeState).toBe('dying')
    const r = applyHealing(s, S, 5)
    expect(r.state.lifeState).toBe('conscious')
    expect(r.state.conditions).toEqual(['unconscious', 'prone'])
    expect(kinds(r)).not.toContain('regainedConsciousness')
    const warning = r.notices.find(n => n.kind === 'warning')
    expect(warning?.text).toContain('continua Inconsciente (condição gravada)')
    expect(warning?.text).not.toContain('acordou')
    expect(getPlayConditionEffects(r.state).noActions.active).toBe(true)
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
    const r = addCondition(state({ concentration: c }), 'paralyzed')
    expect(r.state.concentration).toBeNull()
    expect(kinds(r)).toContain('concentrationEnded')
    expect(addCondition(state({ concentration: c }), 'poisoned').state.concentration).toEqual(c)
  })

  it('Inconsciente manual grava o Caído e avisa de largar o que segura; tirá-lo deixa o Caído', () => {
    const r = addCondition(state(), 'unconscious')
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
    expect(kinds(addCondition(s, 'sleepy' as never))).toEqual(['refused'])
    expect(addCondition(s, 'poisoned').state).toBe(s)
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
    let r = startConcentration(state(), { spellId: 'bless', label: 'Bênção' }, 5)
    expect(r.state.concentration).toEqual({ spellId: 'bless', label: 'Bênção', startedAt: 5 })
    r = startConcentration(r.state, { label: 'Raio de Luar' }, 6)
    expect(kinds(r)).toEqual(['concentrationReplaced'])
    expect(r.state.concentration?.label).toBe('Raio de Luar')
    expect(endConcentration(r.state).state.concentration).toBeNull()
  })

  it('recusa quem está incapacitado ou a 0 PV, e rótulo vazio', () => {
    expect(kinds(startConcentration(state({ conditions: ['stunned'] }), { label: 'X' }, 0))).toEqual(['refused'])
    expect(kinds(startConcentration(state({ lifeState: 'dying', damageTaken: 20 }), { label: 'X' }, 0))).toEqual(['refused'])
    expect(kinds(startConcentration(state(), { label: '  ' }, 0))).toEqual(['refused'])
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

describe('previewShortRest', () => {
  it('lista o Pacto e os recursos de recarga curta gastos, o mesmo que o completeShortRest devolve', () => {
    const sh = sheet({ pactSlots: { slots: 2, slotLevel: 2 } })
    const s = state({ pactSlotsSpent: 1, resourcesSpent: { 'second-wind': 1, rage: 2 } })
    const preview = previewShortRest(s, sh)
    expect(preview).toEqual({ pactSlots: 1, resources: [{ id: 'second-wind', name: 'second-wind', amount: 1 }] })
    const done = completeShortRest(s, sh).state
    expect(done.pactSlotsSpent).toBe(0)
    expect(done.resourcesSpent).toEqual({ rage: 2 })
  })

  it('nada gasto: nada a voltar; gasto acima do máximo é lido já reconciliado', () => {
    expect(previewShortRest(state(), S)).toEqual({ pactSlots: 0, resources: [] })
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
    expect(startConcentration(after, { label: 'X' }, 0).state.concentration?.label).toBe('X')
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
