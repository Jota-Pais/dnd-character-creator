import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { buildPlaySheet } from '../playSheet'
import { createPlayState } from '../playState'
import {
  formatBagQuantity, formatCoinPurse, formatKg, getBagItemInfo, getBagItems, getCarriedWeight, getCarryingCapacity, getCoins,
  getItemUseGuide, getSheetInventory, getStartingCoins, getWeaponAmmo, isBagAdjustable,
} from '../inventoryPlay'
import { getFinalAbilityScores } from '../asiUtils'

/**
 * A base da bolsa do jogo (Fase 2, onda `inventario`): o inventário da ficha em peças, o dinheiro em
 * moedas e a capacidade de carga. As operações (gastar, recuperar, usar) moram em `playState.test.ts`.
 */

// Humano: +1 em tudo, Força final 8.
const SCORES = { STR: 7, DEX: 13, CON: 11, INT: 9, WIS: 9, CHA: 9 }

/** Um personagem que compra (método riqueza, 100 po) o que carrega. */
const buyer = (items: [string, number][], patch: Partial<CharacterDraft> = {}): CharacterDraft => ({
  ...structuredClone(EMPTY_DRAFT), level: 3, class: 'fighter', race: 'human', abilityScores: SCORES,
  equipment: {
    ...structuredClone(EMPTY_DRAFT.equipment), method: 'wealth', rolledGold: 100,
    purchasedItems: items.map(([itemId, quantity]) => ({ itemId, quantity, source: 'purchased' as const })),
  },
  ...patch,
})

describe('o inventário da ficha em peças', () => {
  // "Flechas (20)" (pág. 152): um pacote são 20 flechas, e a bolsa conta flechas.
  it('a munição em peças, e o pacote de equipamento aberto no que ele tem', () => {
    const inventory = getSheetInventory(buyer([['longbow', 1], ['arrows', 2], ['explorers-pack', 1], ['torch', 2]]))
    expect(inventory).toEqual([
      { id: 'longbow', quantity: 1 },
      { id: 'arrows', quantity: 40 },
      { id: 'backpack', quantity: 1 },
      { id: 'bedroll', quantity: 1 },
      { id: 'mess-kit', quantity: 1 },
      { id: 'tinderbox', quantity: 1 },
      // As 10 do pacote e as 2 compradas à parte: o mesmo item soma.
      { id: 'torch', quantity: 12 },
      { id: 'rations', quantity: 10 },
      { id: 'waterskin', quantity: 1 },
      { id: 'hempen-rope', quantity: 1 },
    ])
  })

  it('o Kit de Primeiros-Socorros conta dez usos', () => {
    expect(getSheetInventory(buyer([['healers-kit', 1]]))).toEqual([{ id: 'healers-kit', quantity: 10 }])
  })

  it('o nome da peça perde o "(20)" da unidade, e o peso da unidade se divide pelas peças', () => {
    expect(getBagItemInfo('arrows')).toMatchObject({ name: 'Flechas', category: 'ammunition', piecesPerUnit: 20, weightPerPiece: 0.025 })
    expect(getBagItemInfo('blowgun-needles')).toMatchObject({ name: 'Agulhas de Zarabatana', piecesPerUnit: 50, weightPerPiece: 0.01 })
    expect(getBagItemInfo('potion-of-healing')).toMatchObject({ name: 'Poção de Cura', piecesPerUnit: 1, weightPerPiece: 0.25 })
    expect(getBagItemInfo('longbow')).toMatchObject({ kind: 'weapon', weightPerPiece: 1 })
    expect(getBagItemInfo('explorers-pack')).toBeNull()
  })

  it('como a bolsa escreve quantos: a munição, os usos e o resto', () => {
    expect(formatBagQuantity(getBagItemInfo('arrows')!, 18)).toBe('18')
    expect(formatBagQuantity(getBagItemInfo('healers-kit')!, 1)).toBe('1 uso')
    expect(formatBagQuantity(getBagItemInfo('healers-kit')!, 9)).toBe('9 usos')
    expect(formatBagQuantity(getBagItemInfo('potion-of-healing')!, 2)).toBe('×2')
  })

  it('arma e armadura não mudam pela bolsa; o item de antecedente só se a ficha o tem', () => {
    const sheet = buildPlaySheet(buyer([['longbow', 1], ['leather', 1]]))
    expect(isBagAdjustable(sheet, 'longbow')).toBe(false)
    expect(isBagAdjustable(sheet, 'leather')).toBe(false)
    expect(isBagAdjustable(sheet, 'potion-of-healing')).toBe(true)
    expect(isBagAdjustable(sheet, 'arrows')).toBe(true)
    expect(isBagAdjustable(sheet, 'bone-dice')).toBe(false)
    expect(isBagAdjustable(sheet, 'thieves-tools')).toBe(false)
  })
})

describe('o dinheiro em moedas', () => {
  // O total da Revisão (`getStartingMoney`) em ouro, prata e cobre, como `formatCoins`.
  it('o dinheiro da ficha em po, pp e pc, menos o que se comprou', () => {
    // 100 po − Arco Longo (50 po) − Flechas (1 po) − Balas de Funda (4 pc) = 48 po 9 pp 6 pc.
    expect(getStartingCoins(buyer([['longbow', 1], ['arrows', 1], ['sling-bullets', 1]]))).toEqual({ pp: 0, gp: 48, ep: 0, sp: 9, cp: 6 })
    // O marinheiro do Krusk (10 po) e a riqueza rolada (50 po).
    expect(getStartingCoins(COMPLETE_DRAFT)).toEqual({ pp: 0, gp: 60, ep: 0, sp: 0, cp: 0 })
  })

  it('a bolsa escreve as moedas com as siglas do livro, da maior para a menor', () => {
    expect(formatCoinPurse({ pp: 1, gp: 15, ep: 2, sp: 3, cp: 0 })).toBe('1 pl · 15 po · 2 pe · 3 pp')
    expect(formatCoinPurse({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })).toBe('nenhuma moeda')
  })

  it('as moedas de agora são as da ficha mais o que mudou no jogo', () => {
    const sheet = buildPlaySheet(buyer([]))
    const state = { ...createPlayState('c'), inventory: { itemDelta: {}, coinDelta: { gp: -30, ep: 4 }, ammoSpentSinceRecovery: {}, customItems: [] } }
    expect(getCoins(state, sheet)).toEqual({ pp: 0, gp: 70, ep: 4, sp: 0, cp: 0 })
  })
})

describe('a carga', () => {
  // "Sua capacidade de carga máxima é igual a 7,5 vezes o seu valor de Força" (pág. 178).
  it('7,5 × a Força final, em kg', () => {
    const draft = buyer([])
    expect(getCarryingCapacity(draft, getFinalAbilityScores(draft))).toEqual({ kg: 60, strength: 8, multiplier: null })
  })

  // "Sua capacidade de carga (incluindo carga máxima e capacidade de erguer) é dobrada" (pág. 50).
  it('o Aspecto da Besta do Urso (bárbaro 6) dobra; o da Águia, não', () => {
    const barbarian = (aspect: string): CharacterDraft => buyer([], {
      class: 'barbarian', level: 6, abilityScores: { ...SCORES, STR: 15 },
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'totem-warrior',
        progressionChoices: { 'totem-warrior-totem-3': ['wolf'], 'totem-warrior-aspect-6': [aspect] },
      },
    })
    expect(buildPlaySheet(barbarian('bear')).carryingCapacity).toEqual({
      kg: 240, strength: 16, multiplier: { value: 2, source: 'Aspecto da Besta — Urso' },
    })
    expect(buildPlaySheet(barbarian('eagle')).carryingCapacity).toEqual({ kg: 120, strength: 16, multiplier: null })
    // Antes do 6º nível, o Aspecto da Besta não existe.
    expect(buildPlaySheet({ ...barbarian('bear'), level: 5 }).carryingCapacity.multiplier).toBeNull()
  })

  // 100 moedas pesam 1 kg (pág. 145): a bolsa soma os itens (as armas e a armadura também) e as moedas.
  it('o peso: cada item em peças, as armas e armaduras, e as moedas', () => {
    const sheet = buildPlaySheet(buyer([['longbow', 1], ['arrows', 1], ['leather', 1]]))
    // 1 kg do arco + 0,5 kg das 20 flechas + 5 kg do Couro + 39 po (100 − 50 − 1 − 10; 0,39 kg).
    expect(getCarriedWeight(createPlayState('c'), sheet)).toBe(6.89)
    expect(formatKg(6.89)).toBe('6,89 kg')
    expect(formatKg(60)).toBe('60 kg')
  })
})

describe('a bolsa agora', () => {
  it('os itens da ficha na ordem dela, e depois os que entraram no jogo', () => {
    const sheet = buildPlaySheet(buyer([['longbow', 1], ['arrows', 1]]))
    const state = {
      ...createPlayState('c'),
      inventory: { itemDelta: { 'arrows': -5, 'potion-of-healing': 2 }, coinDelta: {}, ammoSpentSinceRecovery: { arrows: 5 }, customItems: [] },
    }
    expect(getBagItems(state, sheet).map(i => [i.id, i.quantity, i.sheetQuantity, i.spent])).toEqual([
      ['longbow', 1, 1, 0],
      ['arrows', 15, 20, 5],
      ['potion-of-healing', 2, 0, 0],
    ])
    expect(getWeaponAmmo(state, sheet, 'longbow')).toEqual({ ammoId: 'arrows', name: 'Flechas', quantity: 15, spent: 5, recoverable: 2 })
    expect(getWeaponAmmo(state, sheet, 'longsword')).toBeNull()
  })
})

describe('o que rolar ao usar um item', () => {
  it('a Poção de Cura: 2d4 + 2, a parcela com o nome da poção', () => {
    const guide = getItemUseGuide('potion-of-healing')
    expect(guide?.heal).toMatchObject({ kind: 'heal', formula: '2d4 + 2', notation: '2d4+2', breakdown: [{ label: 'Poção de Cura', value: 2 }] })
    expect(guide?.damage).toEqual([])
    expect(guide?.lines).toEqual([])
  })

  // Só o dano do acerto dobra no crítico (pág. 196): o ácido sim; o fogo alquímico queima no início
  // dos turnos do alvo, e o veneno vem do TR falhado.
  it('o dano com o tipo, o crítico só do acerto, a situação e o TR em linhas', () => {
    const acid = getItemUseGuide('acid-vial')
    expect(acid?.damage.map(d => [d.formula, d.crit?.formula])).toEqual([['2d6 ácido', '4d6 ácido']])
    expect(acid?.lines).toEqual(['Um ataque à distância, tratando o item como arma improvisada (pág. 148): o bônus desse ataque o app ainda não calcula.'])
    expect(getItemUseGuide('holy-water-flask')?.damage[0].notes).toEqual(['Se o alvo for um corruptor ou morto-vivo.'])
    const fire = getItemUseGuide('alchemists-fire')?.damage[0]
    expect([fire?.formula, fire?.crit, fire?.notes]).toEqual(['1d4 fogo', undefined, ['No início de cada turno do alvo, até ele apagar as chamas.']])
    const poison = getItemUseGuide('basic-poison')
    expect(poison?.lines).toEqual(['O alvo faz um teste de resistência de Constituição CD 10: se falhar, sofre o dano.'])
    expect(poison?.damage[0].crit).toBeUndefined()
    expect(getItemUseGuide('torch')).toBeNull()
  })
})
