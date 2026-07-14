import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemWeapon } from '../../types/equipment'
import { getEquipmentById } from '../equipmentUtils'
import { getOrdemWeaponAttack, getWeaponSkillName, formatWeaponSummary, isMelee } from '../ordemWeaponUtils'

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

  it('poderes de combate entram no dano (F25): Golpe Pesado, Tiro Certeiro, Balística Avançada, Ninja Urbano', () => {
    // Golpe Pesado: +1 dado do mesmo tipo em armas corpo a corpo.
    const golpePesado = makeDraft({ attributes: AGI3_FOR2.attributes, powerChoices: ['heavy-blow'] })
    expect(getOrdemWeaponAttack(faca, golpePesado, []).damage).toBe('2d4+2 corte')
    expect(getOrdemWeaponAttack(pistola, golpePesado, []).damage).toBe('1d12 balístico') // não é corpo a corpo
    // Tiro Certeiro: +Agilidade no dano de armas de DISPARO (não armas de fogo).
    const tiroCerteiro = makeDraft({ attributes: AGI3_FOR2.attributes, powerChoices: ['sure-shot'] })
    const balestra = getEquipmentById('balestra') as OrdemWeapon // disparo
    if (balestra) expect(getOrdemWeaponAttack(balestra, tiroCerteiro, []).damage).toContain('+3')
    expect(getOrdemWeaponAttack(pistola, tiroCerteiro, []).damage).toBe('1d12 balístico') // fogo: sem bônus
    // Balística Avançada: +2 no dano de armas TÁTICAS de fogo (fuzil de caça é simples → sem bônus).
    const balistica = makeDraft({ attributes: AGI3_FOR2.attributes, powerChoices: ['advanced-ballistics'] })
    const submetralhadora = getEquipmentById('submetralhadora') as OrdemWeapon
    expect(getOrdemWeaponAttack(submetralhadora, balistica, []).damage).toBe('2d6+2 balístico')
    const fuzilCaca = getEquipmentById('fuzil-de-caca') as OrdemWeapon
    expect(getOrdemWeaponAttack(fuzilCaca, balistica, []).damage).toBe('2d8 balístico')
  })

  it('poderes de origem entram no dano: Mão Pesada (+2 corpo a corpo) e Para Bellum (+2 armas de fogo)', () => {
    // Mão Pesada (Lutador): +2 em dano corpo a corpo; nada em armas de fogo.
    const maoPesada = makeDraft({ attributes: AGI3_FOR2.attributes, origin: 'brawler' })
    expect(getOrdemWeaponAttack(faca, maoPesada, []).damage).toBe('1d4+4 corte') // Força 2 + Mão Pesada 2
    expect(getOrdemWeaponAttack(pistola, maoPesada, []).damage).toBe('1d12 balístico') // fogo: sem bônus
    // Para Bellum (Militar): +2 em dano com armas de fogo; nada corpo a corpo.
    const paraBellum = makeDraft({ attributes: AGI3_FOR2.attributes, origin: 'military' })
    expect(getOrdemWeaponAttack(pistola, paraBellum, []).damage).toBe('1d12+2 balístico')
    expect(getOrdemWeaponAttack(faca, paraBellum, []).damage).toBe('1d4+2 corte') // corpo a corpo: só a Força
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

describe('resumo de arma pro card de escolha (getWeaponSkillName / formatWeaponSummary)', () => {
  it('getWeaponSkillName segue a mesma regra do teste de ataque', () => {
    expect(getWeaponSkillName(faca)).toBe('Luta')
    expect(getWeaponSkillName(pistola)).toBe('Pontaria')
    expect(isMelee(faca)).toBe(true)
    expect(isMelee(pistola)).toBe(false)
  })

  it('formatWeaponSummary inclui perícia, tipo, alcance (quando houver), empunhadura e proficiência', () => {
    expect(formatWeaponSummary(faca)).toBe('Luta · corpo a corpo · alcance Curto · leve · proficiência simples')
    expect(formatWeaponSummary(pistola)).toBe('Pontaria · arma de fogo · alcance Curto · leve · proficiência simples')
  })

  it('omite o alcance quando a arma não tem (ex.: punhal, corpo a corpo puro)', () => {
    const punhal = getEquipmentById('punhal') as OrdemWeapon
    expect(punhal.range).toBe('-')
    expect(formatWeaponSummary(punhal)).toBe('Luta · corpo a corpo · leve · proficiência simples')
  })

  it('lança-chamas: Pontaria, arma de fogo, alcance curto, duas mãos, proficiência pesada', () => {
    const lancaChamas = getEquipmentById('lanca-chamas') as OrdemWeapon
    expect(formatWeaponSummary(lancaChamas)).toBe('Pontaria · arma de fogo · alcance Curto · duas mãos · proficiência pesada')
  })
})
