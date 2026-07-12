import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemWeapon } from '../../types/equipment'
import { getEquipmentById } from '../equipmentUtils'
import { getOrdemWeaponAttack } from '../ordemWeaponUtils'

function makeDraft(over: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, ...over }
}

const faca = getEquipmentById('faca') as OrdemWeapon         // corpo a corpo, 1d4 C (corte), crít 19
const pistola = getEquipmentById('pistola') as OrdemWeapon   // fogo, 1d12 B (balístico), crít 18

const AGI3_FOR2 = makeDraft({ attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 } })

describe('ordemWeaponUtils', () => {
  it('arma corpo a corpo usa Luta (rola Força d20) e soma Força no dano', () => {
    const a = getOrdemWeaponAttack(faca, AGI3_FOR2, [])
    expect(a.skill).toBe('Luta')
    expect(a.rollDice).toBe(2) // Força
    expect(a.attackBonus).toBe(0) // destreinado em Luta
    expect(a.damage).toBe('1d4+2 corte') // + Força 2
    expect(a.critical).toBe('19')
  })

  it('arma de fogo usa Pontaria (rola Agilidade d20) e NÃO soma atributo no dano', () => {
    const a = getOrdemWeaponAttack(pistola, AGI3_FOR2, [])
    expect(a.skill).toBe('Pontaria')
    expect(a.rollDice).toBe(3) // Agilidade
    expect(a.damage).toBe('1d12 balístico') // sem Força
    expect(a.critical).toBe('18')
  })

  it('grau de treinamento entra no bônus de ataque (treinado = +5)', () => {
    const treinado = makeDraft({
      attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      class: 'combatant',
      classFreeSkillChoices: ['fighting'], // treinado em Luta
    })
    expect(getOrdemWeaponAttack(faca, treinado, []).attackBonus).toBe(5)
  })

  it('perícia de ataque escolhida (Lâmina Maldita): Ocultismo rola Intelecto e usa o treino de Ocultismo', () => {
    const ocultista = makeDraft({
      attributes: { agility: 1, strength: 2, intellect: 3, presence: 1, vigor: 1 },
      class: 'occultist', // Ocultismo é perícia fixa → treinado (+5)
    })
    const a = getOrdemWeaponAttack(faca, ocultista, [], [], 'occultism')
    expect(a.skill).toBe('Ocultismo')
    expect(a.rollDice).toBe(3) // Intelecto
    expect(a.attackBonus).toBe(5) // treinado em Ocultismo
    expect(a.damage).toBe('1d4+2 corte') // dano corpo a corpo segue somando Força
  })

  it('modificações de combate entram nos números', () => {
    // Certeira (+2 ataque) + Cruel (+2 dano) na faca corpo a corpo
    const cc = getOrdemWeaponAttack(faca, AGI3_FOR2, ['certeira', 'cruel'])
    expect(cc.attackBonus).toBe(2) // 0 treino + 2 Certeira
    expect(cc.damage).toBe('1d4+4 corte') // Força 2 + Cruel 2
    // Calibre Grosso (+1 dado) na arma de fogo
    expect(getOrdemWeaponAttack(pistola, AGI3_FOR2, ['calibre-grosso']).damage).toBe('2d12 balístico')
    // Perigosa amplia a margem de ameaça: crítico 19 → 17
    expect(getOrdemWeaponAttack(faca, AGI3_FOR2, ['perigosa']).critical).toBe('17')
  })
})
