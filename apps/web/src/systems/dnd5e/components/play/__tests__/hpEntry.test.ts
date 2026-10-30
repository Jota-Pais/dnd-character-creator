import { describe, it, expect } from 'vitest'
import type { SheetDamageDefense } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import {
  choiceToDamageType, getDefendedDamageTypes, getDefenseQuestions, getDefensesForTypes, normalizeMinus, parseHpEntry,
  resolveHpAction, stripHpSign,
} from '../hpEntry'

describe('normalizeMinus', () => {
  it('o tipográfico e a meia-risca viram o menos do teclado', () => {
    expect(normalizeMinus('−7')).toBe('-7')
    expect(normalizeMinus('–3')).toBe('-3')
    expect(normalizeMinus('-2')).toBe('-2')
    expect(normalizeMinus('+5')).toBe('+5')
  })
})

describe('parseHpEntry', () => {
  it('lê o número com ou sem sinal', () => {
    expect(parseHpEntry('7')).toEqual({ sign: null, amount: 7 })
    expect(parseHpEntry('+5')).toEqual({ sign: 'plus', amount: 5 })
    expect(parseHpEntry('-7')).toEqual({ sign: 'minus', amount: 7 })
    expect(parseHpEntry(' − 12 ')).toEqual({ sign: 'minus', amount: 12 })
    expect(parseHpEntry('–3')).toEqual({ sign: 'minus', amount: 3 })
    expect(parseHpEntry('0')).toEqual({ sign: null, amount: 0 })
  })

  it('ainda digitando: só o sinal, ou nada', () => {
    expect(parseHpEntry('')).toEqual({ sign: null, amount: null })
    expect(parseHpEntry('-')).toEqual({ sign: 'minus', amount: null })
    expect(parseHpEntry('+')).toEqual({ sign: 'plus', amount: null })
  })

  it('o que não é número inteiro dá null', () => {
    for (const text of ['abc', '5a', '2.5', '1,5', '+-3', '--3', '3-', '5 5']) {
      expect(parseHpEntry(text)).toBeNull()
    }
  })
})

describe('resolveHpAction', () => {
  it('o sinal manda: "−" é dano e "+" é cura, sem botão escolhido', () => {
    expect(resolveHpAction(parseHpEntry('-7'), null)).toBe('damage')
    expect(resolveHpAction(parseHpEntry('+5'), null)).toBe('heal')
    // O sinal vence o botão escolhido.
    expect(resolveHpAction(parseHpEntry('+5'), 'damage')).toBe('heal')
    expect(resolveHpAction(parseHpEntry('-5'), 'heal')).toBe('damage')
    expect(resolveHpAction(parseHpEntry('-5'), 'temp')).toBe('damage')
  })

  it('sem sinal, vale o botão; sem botão, nada', () => {
    expect(resolveHpAction(parseHpEntry('7'), 'damage')).toBe('damage')
    expect(resolveHpAction(parseHpEntry('7'), 'temp')).toBe('temp')
    expect(resolveHpAction(parseHpEntry('7'), null)).toBeNull()
    expect(resolveHpAction(null, 'heal')).toBe('heal')
  })

  it('com PV temporários escolhido, o "+" continua PV temporário', () => {
    expect(resolveHpAction(parseHpEntry('+5'), 'temp')).toBe('temp')
  })
})

describe('stripHpSign', () => {
  it('tira o sinal e mantém o número', () => {
    expect(stripHpSign('-7')).toBe('7')
    expect(stripHpSign(' + 5')).toBe('5')
    expect(stripHpSign('−3')).toBe('3')
    expect(stripHpSign('9')).toBe('9')
  })
})

describe('o tipo do dano e as caixas das defesas', () => {
  const infernal: SheetDamageDefense = { source: 'Resistência Infernal', kind: 'resistance', types: ['fire'] }
  const avatar: SheetDamageDefense = {
    source: 'Avatar da Batalha', kind: 'resistance', types: ['bludgeoning', 'piercing', 'slashing'], condition: 'de ataque com arma não mágica',
  }
  const aura: SheetDamageDefense = { source: 'Aura de Vigilância', kind: 'resistance', types: 'all', condition: 'de magia' }
  const master: SheetDamageDefense = {
    source: 'Maestria em Armadura Pesada', kind: 'reduction', types: ['bludgeoning', 'piercing', 'slashing'], amount: 3,
    condition: 'de ataque não mágico', requires: 'heavyArmor',
  }
  const fiend: SheetDamageDefense = { source: 'Resistência Demoníaca', kind: 'resistance', types: ['fire'], exceptWhen: 'arma mágica ou de prata' }
  const purity: SheetDamageDefense = { source: 'Pureza Corporal', kind: 'conditionImmunity', types: [], conditions: ['poisoned'] }

  it('os chips são os tipos com defesa, na ordem do livro; a de todo dano e a impedida não viram chip', () => {
    expect(getDefendedDamageTypes([])).toEqual([])
    expect(getDefendedDamageTypes([infernal])).toEqual(['fire'])
    expect(getDefendedDamageTypes([infernal, avatar])).toEqual(['bludgeoning', 'slashing', 'fire', 'piercing'])
    expect(getDefendedDamageTypes([aura, purity])).toEqual([])
    expect(getDefendedDamageTypes([{ ...master, blockedBy: 'sem armadura pesada' }])).toEqual([])
  })

  it('"Outro tipo" e nenhum escolhido não levam tipo', () => {
    expect(choiceToDamageType('fire')).toBe('fire')
    expect(choiceToDamageType('other')).toBeUndefined()
    expect(choiceToDamageType(null)).toBeUndefined()
  })

  it('as caixas: só das defesas que alcançam os tipos escolhidos; a de todo dano, sempre', () => {
    expect(getDefenseQuestions([avatar, aura], [undefined])).toEqual({
      conditions: [{ text: 'de magia', sources: ['Aura de Vigilância'] }], exceptions: [],
    })
    expect(getDefenseQuestions([avatar, master], ['slashing']).conditions).toEqual([
      { text: 'de ataque com arma não mágica', sources: ['Avatar da Batalha'] },
      { text: 'de ataque não mágico', sources: ['Maestria em Armadura Pesada'] },
    ])
    expect(getDefenseQuestions([avatar], ['fire']).conditions).toEqual([])
    expect(getDefenseQuestions([fiend], ['fire']).exceptions).toEqual([{ text: 'arma mágica ou de prata', sources: ['Resistência Demoníaca'] }])
    expect(getDefenseQuestions([fiend], [undefined]).exceptions).toEqual([])
    // A defesa impedida pelo equipamento não pergunta nada.
    expect(getDefenseQuestions([{ ...master, blockedBy: 'sem armadura pesada' }], ['slashing']).conditions).toEqual([])
  })

  it('a mesma situação de duas fontes é uma caixa só, com as duas origens', () => {
    const other: SheetDamageDefense = { ...aura, source: 'Outra Aura' }
    expect(getDefenseQuestions([aura, other], [undefined]).conditions).toEqual([
      { text: 'de magia', sources: ['Aura de Vigilância', 'Outra Aura'] },
    ])
  })

  it('a linha embaixo dos chips: as defesas que alcançam os tipos escolhidos', () => {
    expect(getDefensesForTypes([infernal, avatar, aura], ['fire'])).toEqual([infernal])
    expect(getDefensesForTypes([infernal, avatar], [])).toEqual([])
  })
})
