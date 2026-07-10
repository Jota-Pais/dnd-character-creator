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
  hasWeaponProficiency,
  getEquipmentById,
  getEffectiveCategory,
  getModifiedSpaces,
  getModifiedDefenseBonus,
  getEffectiveCategoryCount,
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

  it('proficiência de arma é informativa (não bloqueia a escolha; o livro permite possuir sem proficiência)', () => {
    // machadinha (Cat 0, arma Tática): ambos podem requisitar; a proficiência só é sinalizada
    expect(isEquipmentStepComplete(makeDraft({ class: 'occultist', equipmentChoices: ['machadinha'] }))).toBe(true)
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', equipmentChoices: ['machadinha'] }))).toBe(true)
    const machadinha = getEquipmentById('machadinha')!
    expect(hasWeaponProficiency(makeDraft({ class: 'occultist' }), machadinha)).toBe(false)
    expect(hasWeaponProficiency(makeDraft({ class: 'combatant' }), machadinha)).toBe(true)
  })

  it('a Patente limita os itens por categoria (Tabela 3.1)', () => {
    // proteção-pesada é Cat II
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', patente: 'recruta', equipmentChoices: ['protecao-pesada'] }))).toBe(false)
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', patente: 'operador', equipmentChoices: ['protecao-pesada'] }))).toBe(true)
  })

  it('Recruta permite 2 itens de Cat I; Operador permite 3', () => {
    const tresCatI = ['municao-balas-longas', 'municao-cartuchos', 'municao-foguete'] // 3× Cat I
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', patente: 'recruta', equipmentChoices: tresCatI }))).toBe(false)
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', patente: 'operador', equipmentChoices: tresCatI }))).toBe(true)
  })

  it('getEquippedDefenseBonus soma o bônus das proteções (proteção-leve +5, escudo +2)', () => {
    expect(getEquippedDefenseBonus([])).toBe(0)
    expect(getEquippedDefenseBonus(['faca'])).toBe(0) // arma não conta
    expect(getEquippedDefenseBonus(['protecao-leve'])).toBe(5)
    expect(getEquippedDefenseBonus(['protecao-leve', 'escudo'])).toBe(7)
  })

  it('Recruta (patente padrão) não acessa Categoria II+', () => {
    // proteção-pesada e fuzil-assalto são Cat II; Recruta tem limite 0 para Cat II
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', equipmentChoices: ['protecao-pesada'] }))).toBe(false)
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', equipmentChoices: ['fuzil-assalto'] }))).toBe(false)
    // ...mas um Agente de Elite acessa
    expect(isEquipmentStepComplete(makeDraft({ class: 'combatant', patente: 'agente-elite', equipmentChoices: ['fuzil-assalto'] }))).toBe(true)
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

  // ── Modificações (F12, Fase B) ──

  it('getEffectiveCategory sobe com as modificações (teto IV)', () => {
    const pistola = getEquipmentById('pistola')! // Cat I
    expect(getEffectiveCategory(pistola, 0)).toBe(1)
    expect(getEffectiveCategory(pistola, 2)).toBe(3)
    expect(getEffectiveCategory(pistola, 9)).toBe(4) // teto
  })

  it('modificações aplicam variação de espaço e Defesa, e sobem a categoria efetiva', () => {
    // Reforçada na proteção leve (Cat I, Defesa +5, 2 espaços): +2 Defesa, +1 espaço, Cat I → II
    const draft = makeDraft({
      class: 'combatant', patente: 'operador',
      equipmentChoices: ['protecao-leve'],
      equipmentModifications: { 'protecao-leve': ['reforcada'] },
    })
    expect(getModifiedDefenseBonus(draft)).toBe(7) // 5 + 2
    expect(getModifiedSpaces(draft)).toBe(3) // 2 + 1
    expect(getEffectiveCategoryCount(draft, 2)).toBe(1) // virou Cat II
    expect(getEffectiveCategoryCount(draft, 1)).toBe(0)
  })

  it('uma modificação que estoura o limite da Patente invalida o loadout', () => {
    const base = {
      class: 'combatant' as const, patente: 'recruta' as const,
      attributes: { ...EMPTY_ATTRIBUTES, strength: 1 }, // capacidade 5
      equipmentChoices: ['protecao-leve'],
    }
    // sem modificação: proteção-leve é Cat I → Recruta (limite 2 Cat I) aceita
    expect(isEquipmentStepComplete(makeDraft(base))).toBe(true)
    // com Reforçada: vira Cat II → Recruta não tem Cat II → inválido
    expect(isEquipmentStepComplete(makeDraft({ ...base, equipmentModifications: { 'protecao-leve': ['reforcada'] } }))).toBe(false)
    // um Operador (1 slot Cat II) já aceita a mesma proteção modificada
    expect(isEquipmentStepComplete(makeDraft({ ...base, patente: 'operador', equipmentModifications: { 'protecao-leve': ['reforcada'] } }))).toBe(true)
  })
})
