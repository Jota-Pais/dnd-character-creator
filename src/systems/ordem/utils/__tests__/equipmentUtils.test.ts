import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, EMPTY_ATTRIBUTES } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import {
  getMaxCapacity,
  getCurrentSpaces,
  getCategoryICount,
  getEquippedDefenseBonus,
  getEquipmentCarryBonus,
  getTotalCarryCapacity,
  isEquipmentStepComplete,
  EQUIPMENTS,
} from '../equipmentUtils'

function makeDraft(over: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, ...over }
}

describe('equipmentUtils', () => {
  it('getMaxCapacity = max(2, 5×Força)', () => {
    expect(getMaxCapacity(0)).toBe(2)
    expect(getMaxCapacity(1)).toBe(5)
    expect(getMaxCapacity(3)).toBe(15)
  })

  it('getCurrentSpaces soma os espaços (id desconhecido conta 0)', () => {
    expect(getCurrentSpaces([])).toBe(0)
    expect(getCurrentSpaces(['faca'])).toBe(1)
    expect(getCurrentSpaces(['faca', 'inexistente'])).toBe(1)
  })

  it('getCategoryICount conta apenas itens de Categoria I', () => {
    expect(getCategoryICount(['faca'])).toBe(0) // cat 0
    expect(getCategoryICount(['municao-balas-longas'])).toBe(1) // cat I
    expect(getCategoryICount(['faca', 'municao-balas-longas', 'municao-cartuchos'])).toBe(2)
  })

  it('loadout vazio é válido', () => {
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant' }))).toBe(true)
  })

  it('bloqueia mais de 2 itens de Categoria I', () => {
    const draft = makeDraft({
      class: 'combatant',
      equipmentChoices: ['municao-balas-longas', 'municao-cartuchos', 'municao-foguete'],
    })
    expect(getCategoryICount(draft.equipmentChoices)).toBe(3)
    expect(isEquipmentStepComplete(draft)).toBe(false)
  })

  it('bloqueia carga acima da capacidade', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 }, // capacidade 2
      equipmentChoices: ['faca', 'martelo', 'punhal'], // 3 espaços > 2
    })
    expect(isEquipmentStepComplete(draft)).toBe(false)
  })

  it('usa a Força EFETIVA: aumento de atributo por NEX eleva a capacidade', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 },
      attributeIncreaseChoices: ['strength'], // Força efetiva 1 → capacidade 5
      equipmentChoices: ['faca', 'martelo', 'punhal'], // 3 espaços ≤ 5
    })
    expect(isEquipmentStepComplete(draft)).toBe(true)
  })

  it('exige proficiência de arma da classe', () => {
    // machadinha é arma Tática: combatente é proficiente, ocultista não
    expect(isEquipmentStepComplete(makeDraft({ class: 'occultist', equipmentChoices: ['machadinha'] }))).toBe(false)
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', equipmentChoices: ['machadinha'] }))).toBe(true)
  })

  it('getEquippedDefenseBonus soma o bônus das proteções (proteção-leve +5, escudo +2)', () => {
    expect(getEquippedDefenseBonus([])).toBe(0)
    expect(getEquippedDefenseBonus(['faca'])).toBe(0) // arma não conta
    expect(getEquippedDefenseBonus(['protecao-leve'])).toBe(5)
    expect(getEquippedDefenseBonus(['protecao-leve', 'escudo'])).toBe(7)
  })

  it('bloqueia itens de Categoria II+ (fora do loadout Recruta, defesa contra import)', () => {
    // proteção-pesada é Cat II, não é arma (isola a checagem de categoria da de proficiência)
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', equipmentChoices: ['protecao-pesada'] }))).toBe(false)
    // fuzil-assalto é Cat II e arma Tática: mesmo com proficiência do combatente, a categoria barra
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', equipmentChoices: ['fuzil-assalto'] }))).toBe(false)
  })

  it('Mochila Militar dá +2 de capacidade de carga (livro pág. 66)', () => {
    expect(getEquipmentCarryBonus([])).toBe(0)
    expect(getEquipmentCarryBonus(['faca'])).toBe(0) // item comum não dá bônus
    expect(getEquipmentCarryBonus(['mochila-militar'])).toBe(2)
    // a própria mochila não ocupa espaço
    expect(getCurrentSpaces(['mochila-militar'])).toBe(0)
  })

  it('getTotalCarryCapacity soma a base (5×Força) com o bônus dos itens', () => {
    const semMochila = makeDraft({ attributes: { ...EMPTY_ATTRIBUTES, strength: 1 } }) // base 5
    expect(getTotalCarryCapacity(semMochila)).toBe(5)
    const comMochila = makeDraft({ attributes: { ...EMPTY_ATTRIBUTES, strength: 1 }, equipmentChoices: ['mochila-militar'] })
    expect(getTotalCarryCapacity(comMochila)).toBe(7) // 5 + 2
  })

  it('todo item de equipamento tem uma descrição não vazia (F11)', () => {
    const semDescricao = EQUIPMENTS.filter(e => !e.description || e.description.trim().length < 5)
    expect(semDescricao.map(e => e.id)).toEqual([])
  })

  it('a Mochila Militar permite carregar além do limite base de Força', () => {
    // Força 0 → base 2. 3 itens de 1 espaço estouram o limite base...
    const semMochila = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 },
      equipmentChoices: ['faca', 'martelo', 'punhal'], // 3 espaços > 2
    })
    expect(isEquipmentStepComplete(semMochila)).toBe(false)
    // ...mas com a Mochila Militar (+2 → capacidade 4, e ela mesma ocupa 0 espaço) passam a caber.
    const comMochila = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 },
      equipmentChoices: ['mochila-militar', 'faca', 'martelo', 'punhal'], // 3 espaços ≤ 4
    })
    expect(isEquipmentStepComplete(comMochila)).toBe(true)
  })
})
