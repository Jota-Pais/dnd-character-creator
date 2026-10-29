import { describe, it, expect } from 'vitest'
import { getStartingInventory } from '../sheetModel'
import { formatInventoryItem } from '../equipmentUtils'
import { getEquippedWeapons } from '../attackUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { EquipmentDraft } from '../../types/equipment'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), race: 'human', ...overrides }
}

const equipment = (e: Partial<EquipmentDraft>): EquipmentDraft => ({ ...structuredClone(EMPTY_DRAFT.equipment), ...e })

/** Bardo acólito no método padrão: rapieira não, maça (arma simples), Pacote de Artista e alaúde. */
const bardAcolyte = (e: Partial<EquipmentDraft>) => draft({
  class: 'bard',
  background: 'acolyte',
  // O símbolo sagrado escolhido; o livro de preces ainda a escolher.
  backgroundChoices: { items: { 'holy-symbol': 'amulet' } },
  equipment: equipment({
    method: 'standard',
    classResolutions: [
      { optionIndex: 2, pickedIds: ['mace'] },
      { optionIndex: 1, pickedIds: [] },
      { optionIndex: 0, pickedIds: [] },
    ],
    ...e,
  }),
})

const summary = (d: CharacterDraft) => getStartingInventory(d).map(i => [i.source, i.id, i.quantity])

describe('getStartingInventory (o inventário da Revisão, da ficha imprimível e dos ataques)', () => {
  it('método padrão: itens fixos da classe, as opções escolhidas e o antecedente, nessa ordem', () => {
    expect(summary(bardAcolyte({}))).toEqual([
      ['class-fixed', 'leather', 1],
      ['class-fixed', 'dagger', 1],
      ['class-choice', 'mace', 1],
      ['class-choice', 'entertainers-pack', 1],
      ['class-choice', 'lute', 1],
      ['background', 'amulet', 1],
      ['background', null, 1],
      ['background', 'incense-stick', 5],
      ['background', 'vestments', 1],
      ['background', 'common-clothes', 1],
    ])
  })

  it('cada item com o rótulo de inventário; o do antecedente a escolher diz que falta', () => {
    const labels = getStartingInventory(bardAcolyte({})).map(i => i.label)
    expect(labels).toContain(formatInventoryItem('entertainers-pack'))
    expect(labels).toContain(formatInventoryItem('incense-stick', 5))
    expect(labels).toContain('Livro de Preces ou Conta de Orações (a escolher)')
  })

  it('opção ainda não escolhida fica de fora', () => {
    const d = bardAcolyte({ classResolutions: [{ optionIndex: -1, pickedIds: [] }] })
    expect(summary(d).filter(([source]) => source === 'class-choice')).toEqual([])
  })

  it('método riqueza: as compras no lugar do equipamento da classe; o do antecedente continua (a leitura do app, como no dinheiro)', () => {
    const d = bardAcolyte({ method: 'wealth', purchasedItems: [{ itemId: 'rapier', quantity: 2, source: 'purchased' }] })
    expect(summary(d)).toEqual([
      ['purchased', 'rapier', 2],
      ['background', 'amulet', 1],
      ['background', null, 1],
      ['background', 'incense-stick', 5],
      ['background', 'vestments', 1],
      ['background', 'common-clothes', 1],
    ])
  })

  it('carrinho de um método riqueza abandonado não entra no método padrão', () => {
    const d = bardAcolyte({ purchasedItems: [{ itemId: 'rapier', quantity: 1, source: 'purchased' }] })
    expect(summary(d).some(([source]) => source === 'purchased')).toBe(false)
  })

  it('as armas dos ataques saem do mesmo inventário: classe e antecedente', () => {
    expect(getEquippedWeapons(bardAcolyte({})).map(w => w.id)).toEqual(['dagger', 'mace'])
    const outlander = draft({ class: 'fighter', background: 'outlander', equipment: equipment({ method: 'wealth' }) })
    expect(getEquippedWeapons(outlander).map(w => w.id)).toEqual(['quarterstaff'])
  })
})
