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
  hasProtectionProficiency,
  hasItemProficiency,
  getLoadPenaltySkillBonuses,
  getLoadState,
  isOverloaded,
  getAccessorySkillSlots,
  getAccessorySkillOptions,
  areAccessorySkillChoicesComplete,
  getNonCumulativeSkillConflicts,
  formatAccessorySkills,
  getAccessorySkillBonuses,
  getWornVestimentas,
  getKitSlots,
  getKitSkillOptions,
  getKitSkills,
  hasKitForSkill,
  getSkillsMissingKit,
  areKitChoicesComplete,
  formatKitSkill,
  getEquipmentById,
  getEffectiveCategory,
  getModifiedSpaces,
  getModifiedDefenseBonus,
  getEffectiveCategoryCount,
  getDraftInstanceCategory,
  fitsPatenteSlots,
  getCategorySlotAllocation,
  getMissingRitualComponentElements,
  getCatalogCategory,
  getEquipmentDamageResistances,
  EQUIPMENTS,
} from '../equipmentUtils'
import { getPatente } from '../patenteUtils'
import { SKILLS } from '../skillUtils'
import { canApplyModification } from '../modificationUtils'
import { getSkillBonusTotal } from '../sheetEffects'
import { getOrdemClass } from '../classUtils'
import { getCursedDerivedStats } from '../curseUtils'

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

  it('passar da capacidade NÃO bloqueia: fica sobrecarregado (p. 55)', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 }, // capacidade 2, teto 4
      equipmentChoices: ['faca', 'martelo', 'punhal'], // 3 espaços > 2
    })
    const load = getLoadState(draft)
    expect(load).toMatchObject({ spaces: 3, capacity: 2, max: 4, overloaded: true, impossible: false })
    expect(isEquipmentStepComplete(draft)).toBe(true)
  })

  it('bloqueia só acima do DOBRO da capacidade', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 }, // capacidade 2, teto 4
      equipmentChoices: ['faca', 'martelo', 'punhal', 'machete', 'lanca'], // 5 espaços > 4
    })
    expect(getLoadState(draft).impossible).toBe(true)
    expect(isEquipmentStepComplete(draft)).toBe(false)
  })

  it('sobrecarga aplica −5 na Defesa, −5 nas perícias de carga e −3m de deslocamento', () => {
    const cls = getOrdemClass('combatant')!
    const base = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0, agility: 2 },
      equipmentChoices: ['faca'], // 1 espaço ≤ 2
    })
    const sobrecarregado = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0, agility: 2 },
      equipmentChoices: ['faca', 'martelo', 'punhal'], // 3 > 2
    })
    expect(isOverloaded(base)).toBe(false)
    expect(isOverloaded(sobrecarregado)).toBe(true)
    // A penalidade entra pela contribuição de equipamento na Defesa.
    expect(getModifiedDefenseBonus(base) - getModifiedDefenseBonus(sobrecarregado)).toBe(5)
    expect(getCursedDerivedStats(base, cls, getModifiedDefenseBonus(base)).defense
      - getCursedDerivedStats(sobrecarregado, cls, getModifiedDefenseBonus(sobrecarregado)).defense).toBe(5)
    // Crime tem penalidade de carga → −5 pela sobrecarga.
    expect(getLoadPenaltySkillBonuses(sobrecarregado).filter(p => p.source === 'Sobrecarregado').length)
      .toBe(SKILLS.filter(s => s.loadPenalty).length)
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

  it('Ferramenta de Trabalho (origem Operário) dá proficiência só com a arma escolhida', () => {
    const machadinha = getEquipmentById('machadinha')!
    const semEscolha = makeDraft({ class: 'occultist', origin: 'laborer' })
    expect(hasWeaponProficiency(semEscolha, machadinha)).toBe(false)
    const comEscolha = makeDraft({ class: 'occultist', origin: 'laborer', workToolWeapon: 'machadinha' })
    expect(hasWeaponProficiency(comEscolha, machadinha)).toBe(true)
    // Outra arma tática não escolhida continua sem proficiência.
    const espada = getEquipmentById('espada')!
    expect(hasWeaponProficiency(comEscolha, espada)).toBe(false)
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

  it('Inventário Otimizado (Técnico NEX 10%) soma Intelecto à Força pro cálculo de carga', () => {
    const semTrilha = makeDraft({ attributes: { ...EMPTY_ATTRIBUTES, strength: 1, intellect: 3 } })
    expect(getTotalCarryCapacity(semTrilha)).toBe(5) // só a Força (1×5), Intelecto não entra
    const comTecnico = makeDraft({
      class: 'specialist', trilha: 'technician', nex: 10,
      attributes: { ...EMPTY_ATTRIBUTES, strength: 1, intellect: 3 },
    })
    expect(getTotalCarryCapacity(comTecnico)).toBe(20) // (1+3)×5
    const antesDoNex = makeDraft({
      class: 'specialist', trilha: 'technician', nex: 5,
      attributes: { ...EMPTY_ATTRIBUTES, strength: 1, intellect: 3 },
    })
    expect(getTotalCarryCapacity(antesDoNex)).toBe(5) // ainda não alcançou NEX 10%
  })

  it('todo item de equipamento tem uma descrição não vazia (F11)', () => {
    const semDescricao = EQUIPMENTS.filter(e => !e.description || e.description.trim().length < 5)
    expect(semDescricao.map(e => e.id)).toEqual([])
  })

  it('a Mochila Militar eleva a capacidade e tira o agente da sobrecarga', () => {
    // Força 0 → base 2. 3 itens de 1 espaço passam do limite base (sobrecarregado)...
    const semMochila = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 },
      equipmentChoices: ['faca', 'martelo', 'punhal'], // 3 espaços > 2
    })
    expect(isOverloaded(semMochila)).toBe(true)
    // ...mas com a Mochila Militar (+2 → capacidade 4, e ela mesma ocupa 0 espaço) cabem sem penalidade.
    const comMochila = makeDraft({
      class: 'combatant',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 0 },
      equipmentChoices: ['mochila-militar', 'faca', 'martelo', 'punhal'], // 3 espaços ≤ 4
    })
    expect(isOverloaded(comMochila)).toBe(false)
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

describe('vagas da Patente com transbordo (F21) — item menor ocupa vaga maior', () => {
  it('fitsPatenteSlots: viável ⟺ itens de cat ≥ k cabem nas vagas de cat ≥ k, pra todo k', () => {
    const operador = getPatente('operador') // 3× Cat I, 1× Cat II
    expect(fitsPatenteSlots([0, 4, 0, 0, 0], operador)).toBe(true) // 4 Cat I: 3 na I + 1 na II
    expect(fitsPatenteSlots([0, 5, 0, 0, 0], operador)).toBe(false) // 5 > 4 vagas totais
    expect(fitsPatenteSlots([0, 3, 1, 0, 0], operador)).toBe(true) // exato
    expect(fitsPatenteSlots([0, 4, 1, 0, 0], operador)).toBe(false) // 5 itens, 4 vagas
    expect(fitsPatenteSlots([0, 0, 0, 1, 0], operador)).toBe(false) // Cat III sem vaga ≥ III
  })

  it('Operador com 4 armas Cat I: válido (a 4ª ocupa a vaga de Cat II)', () => {
    const quatroRevolveres = makeDraft({
      class: 'combatant',
      patente: 'operador',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 1 }, // capacidade 5 ≥ 4 espaços
      equipmentChoices: ['revolver', 'revolver#2', 'revolver#3', 'revolver#4'],
    })
    expect(isEquipmentStepComplete(quatroRevolveres)).toBe(true)
    // Com um 5º item Cat I não há mais vaga nenhuma.
    expect(isEquipmentStepComplete(makeDraft({
      ...quatroRevolveres,
      attributes: { ...EMPTY_ATTRIBUTES, strength: 2 },
      equipmentChoices: [...quatroRevolveres.equipmentChoices, 'revolver#5'],
    }))).toBe(false)
  })

  it('alocação pra exibição: Operador + 4 Cat I → "4/3" na I e vaga da II ocupada por 1 de cat. menor', () => {
    const draft = makeDraft({
      patente: 'operador',
      equipmentChoices: ['revolver', 'revolver#2', 'revolver#3', 'revolver#4'],
    })
    const alloc = getCategorySlotAllocation(draft, getPatente('operador'))
    const cat1 = alloc.find(s => s.category === 1)!
    const cat2 = alloc.find(s => s.category === 2)!
    expect(cat1).toMatchObject({ items: 4, usedSlots: 3, spillIn: 0, limit: 3, overflow: false })
    expect(cat2).toMatchObject({ items: 0, usedSlots: 1, spillIn: 1, limit: 1, overflow: false })
  })

  it('item de categoria maior tem prioridade na própria vaga (Cat II real + excedente de Cat I não cabem juntos)', () => {
    // Operador: 3× Cat I + 1 proteção pesada (Cat II) = ok; +1 Cat I não tem mais onde entrar.
    const cheio = makeDraft({
      class: 'combatant',
      patente: 'operador',
      attributes: { ...EMPTY_ATTRIBUTES, strength: 2 },
      equipmentChoices: ['revolver', 'revolver#2', 'revolver#3', 'protecao-pesada'],
    })
    expect(isEquipmentStepComplete(cheio)).toBe(true)
    expect(isEquipmentStepComplete(makeDraft({
      ...cheio,
      attributes: { ...EMPTY_ATTRIBUTES, strength: 3 },
      equipmentChoices: [...cheio.equipmentChoices, 'revolver#4'],
    }))).toBe(false)
  })
})

describe('poderes com efeito mecânico no equipamento (F25)', () => {
  it('Tanque de Guerra: +2 na Defesa da proteção pesada (só com ela equipada)', () => {
    const comPesada = makeDraft({ powerChoices: ['war-tank'], equipmentChoices: ['protecao-pesada'] })
    const semPoder = makeDraft({ equipmentChoices: ['protecao-pesada'] })
    expect(getModifiedDefenseBonus(comPesada)).toBe(getModifiedDefenseBonus(semPoder) + 2)
    // Com proteção leve, o poder não faz nada.
    const comLeve = makeDraft({ powerChoices: ['war-tank'], equipmentChoices: ['protecao-leve'] })
    expect(getModifiedDefenseBonus(comLeve)).toBe(getModifiedDefenseBonus(makeDraft({ equipmentChoices: ['protecao-leve'] })))
  })

  it('getEquipmentDamageResistances: RD base da Proteção Pesada e do Traje Hazmat', () => {
    expect(getEquipmentDamageResistances(makeDraft({ equipmentChoices: ['protecao-pesada'] })))
      .toEqual([{ source: 'Proteção Pesada', label: 'balístico, corte, impacto e perfuração', value: 2 }])
    expect(getEquipmentDamageResistances(makeDraft({ equipmentChoices: ['traje-hazmat'] })))
      .toEqual([{ source: 'Traje Hazmat', label: 'químico', value: 10 }])
    // Proteção Leve não tem RD nenhuma.
    expect(getEquipmentDamageResistances(makeDraft({ equipmentChoices: ['protecao-leve'] }))).toEqual([])
  })

  it('Blindada substitui (não soma) a RD da proteção pesada para 5', () => {
    const draft = makeDraft({
      equipmentChoices: ['protecao-pesada'],
      equipmentModifications: { 'protecao-pesada': ['blindada'] },
    })
    expect(getEquipmentDamageResistances(draft)).toEqual([
      { source: 'Proteção Pesada', label: 'balístico, corte, impacto e perfuração', value: 5 },
    ])
  })

  it('Tanque de Guerra soma +2 na RD da proteção pesada, com ou sem Blindada', () => {
    const semBlindada = makeDraft({ powerChoices: ['war-tank'], equipmentChoices: ['protecao-pesada'] })
    expect(getEquipmentDamageResistances(semBlindada)[0].value).toBe(4) // 2 + 2
    const comBlindada = makeDraft({
      powerChoices: ['war-tank'],
      equipmentChoices: ['protecao-pesada'],
      equipmentModifications: { 'protecao-pesada': ['blindada'] },
    })
    expect(getEquipmentDamageResistances(comBlindada)[0].value).toBe(7) // 5 (Blindada) + 2
  })

  it('maldição Cinética dá RD 2 em proteção leve ou 5 em proteção pesada', () => {
    const leve = makeDraft({ equipmentChoices: ['protecao-leve'], equipmentCurses: { 'protecao-leve': ['cinetica'] } })
    expect(getEquipmentDamageResistances(leve)).toEqual([{ source: 'Proteção Leve — maldição Cinética', label: 'geral', value: 2 }])
    const pesada = makeDraft({ equipmentChoices: ['protecao-pesada'], equipmentCurses: { 'protecao-pesada': ['cinetica'] } })
    expect(getEquipmentDamageResistances(pesada)).toContainEqual({ source: 'Proteção Pesada — maldição Cinética', label: 'geral', value: 5 })
  })

  it('proficiência via poder: Armamento Pesado destrava armas pesadas', () => {
    const metralhadora = getEquipmentById('metralhadora')!
    const combatente = makeDraft({ class: 'combatant' })
    expect(hasWeaponProficiency(combatente, metralhadora)).toBe(false)
    const comPoder = makeDraft({ class: 'combatant', powerChoices: ['heavy-weapons'] })
    expect(hasWeaponProficiency(comPoder, metralhadora)).toBe(true)
  })
})

describe('Mochila de Utilidades (F27) — item escolhido conta −1 categoria e −1 espaço', () => {
  it('aplica só com o poder, na unidade escolhida, e nunca em armas', () => {
    const base = {
      powerChoices: ['utility-backpack'],
      equipmentChoices: ['protecao-leve', 'revolver'],
      utilityBackpackItem: 'protecao-leve',
    }
    const draft = makeDraft(base)
    expect(getDraftInstanceCategory(draft, 'protecao-leve')).toBe(0) // Cat I → 0
    expect(getModifiedSpaces(draft)).toBe(1 + 1) // proteção 2−1 + revólver 1
    // Sem o poder, a escolha não faz nada.
    expect(getDraftInstanceCategory(makeDraft({ ...base, powerChoices: [] }), 'protecao-leve')).toBe(1)
    // Arma escolhida é ignorada.
    expect(getDraftInstanceCategory(makeDraft({ ...base, utilityBackpackItem: 'revolver' }), 'revolver')).toBe(1)
  })
})

describe('Arma Favorita (trilha Aniquilador) — reduz a categoria da arma escolhida', () => {
  it('getCatalogCategory reduz mesmo sem unidade escolhida (destrava o "cabe na Patente" antes de requisitar)', () => {
    const lancaChamas = getEquipmentById('lanca-chamas')! // Cat III
    const semTrilha = makeDraft({ favoriteWeapon: 'lanca-chamas' })
    expect(getCatalogCategory(semTrilha, lancaChamas)).toBe(3) // sem a trilha, marcar não faz nada

    const nex10 = makeDraft({ trilha: 'annihilator', nex: 10, favoriteWeapon: 'lanca-chamas' })
    expect(getCatalogCategory(nex10, lancaChamas)).toBe(2) // III − I

    const nex40 = makeDraft({ trilha: 'annihilator', nex: 40, favoriteWeapon: 'lanca-chamas' })
    expect(getCatalogCategory(nex40, lancaChamas)).toBe(1) // III − II
  })

  it('um Operador (sem Cat III) só consegue requisitar o lança-chamas depois de marcá-lo como favorito', () => {
    const base = { class: 'combatant' as const, patente: 'operador' as const, equipmentChoices: ['lanca-chamas'] }
    // Sem a trilha: Cat III não cabe no Operador (limite 0 pra Cat III).
    expect(isEquipmentStepComplete(makeDraft(base))).toBe(false)
    // Aniquilador em NEX 10% reduz pra Cat II, que cabe no único slot de Cat II do Operador.
    expect(isEquipmentStepComplete(makeDraft({ ...base, trilha: 'annihilator', nex: 10, favoriteWeapon: 'lanca-chamas' }))).toBe(true)
    // Marcar outra arma como favorita não ajuda o lança-chamas.
    expect(isEquipmentStepComplete(makeDraft({ ...base, trilha: 'annihilator', nex: 10, favoriteWeapon: 'faca' }))).toBe(false)
  })

  it('getDraftInstanceCategory reflete a redução na unidade já escolhida', () => {
    const draft = makeDraft({ trilha: 'annihilator', nex: 65, equipmentChoices: ['lanca-chamas'], favoriteWeapon: 'lanca-chamas' })
    expect(getDraftInstanceCategory(draft, 'lanca-chamas')).toBe(0) // III − III
  })

  it('nunca reduz abaixo de 0, mesmo em NEX 99%', () => {
    const faca = getEquipmentById('faca')! // Cat 0
    const draft = makeDraft({ trilha: 'annihilator', nex: 99, favoriteWeapon: 'faca' })
    expect(getCatalogCategory(draft, faca)).toBe(0)
  })
})

describe('Ferramentas Favoritas (origem Engenheiro) — reduz a categoria do item escolhido (exceto armas)', () => {
  it('getCatalogCategory reduz mesmo sem unidade escolhida, só com a origem', () => {
    const pesada = getEquipmentById('protecao-pesada')! // Cat II
    const semOrigem = makeDraft({ favoriteEquipment: 'protecao-pesada' })
    expect(getCatalogCategory(semOrigem, pesada)).toBe(2) // sem a origem, marcar não faz nada

    const comOrigem = makeDraft({ origin: 'engineer', favoriteEquipment: 'protecao-pesada' })
    expect(getCatalogCategory(comOrigem, pesada)).toBe(1) // II − I
  })

  it('nunca vale pra armas', () => {
    const revolver = getEquipmentById('revolver')!
    const draft = makeDraft({ origin: 'engineer', favoriteEquipment: 'revolver' })
    expect(getCatalogCategory(draft, revolver)).toBe(revolver.category)
  })

  it('um Recruta (sem Cat II) só consegue requisitar a proteção pesada depois de marcá-la como favorita', () => {
    const base = { patente: 'recruta' as const, equipmentChoices: ['protecao-pesada'] }
    // Sem a origem: Cat II não cabe no Recruta (limite 0 pra Cat II).
    expect(isEquipmentStepComplete(makeDraft(base))).toBe(false)
    // Engenheiro reduz pra Cat I, que cabe no limite de 2 do Recruta.
    expect(isEquipmentStepComplete(makeDraft({ ...base, origin: 'engineer', favoriteEquipment: 'protecao-pesada' }))).toBe(true)
    // Marcar outro item como favorito não ajuda a proteção pesada.
    expect(isEquipmentStepComplete(makeDraft({ ...base, origin: 'engineer', favoriteEquipment: 'utensilio' }))).toBe(false)
  })

  it('getDraftInstanceCategory reflete a redução na unidade já escolhida', () => {
    const draft = makeDraft({ origin: 'engineer', equipmentChoices: ['protecao-pesada'], favoriteEquipment: 'protecao-pesada' })
    expect(getDraftInstanceCategory(draft, 'protecao-pesada')).toBe(1) // II − I
  })
})

describe('componentes ritualísticos (F22) — aviso de rituais sem componentes', () => {
  it('ocultista com ritual de Energia sem os componentes → avisa; com eles → não', () => {
    const base = {
      class: 'occultist' as const,
      nex: 5,
      ritualChoices: ['eletrocussao', 'cicatrizacao', 'decadencia'], // Energia, Morte, Morte
    }
    expect(getMissingRitualComponentElements(makeDraft(base))).toEqual(
      expect.arrayContaining(['energy', 'death']),
    )
    const equipado = makeDraft({
      ...base,
      equipmentChoices: ['componentes-ritualisticos-energia', 'componentes-ritualisticos-morte'],
    })
    expect(getMissingRitualComponentElements(equipado)).toEqual([])
  })

  it('ritual multi-elemento conta pelo elemento escolhido ao aprender (chave = índice do slot)', () => {
    const draft = makeDraft({
      class: 'occultist',
      nex: 5,
      ritualChoices: ['amaldicoar-arma', 'cicatrizacao', 'decadencia'],
      ritualElementChoices: { 0: 'blood' },
      equipmentChoices: ['componentes-ritualisticos-morte'],
    })
    expect(getMissingRitualComponentElements(draft)).toEqual(['blood'])
  })

  it('Amaldiçoar Arma em 2 slots com elementos diferentes conta os dois elementos', () => {
    const draft = makeDraft({
      class: 'occultist',
      nex: 5,
      ritualChoices: ['amaldicoar-arma', 'amaldicoar-arma', 'decadencia'],
      ritualElementChoices: { 0: 'blood', 1: 'knowledge' },
    })
    expect(getMissingRitualComponentElements(draft)).toEqual(
      expect.arrayContaining(['blood', 'knowledge', 'death']),
    )
  })

  it('não-ocultista sem rituais não gera aviso', () => {
    expect(getMissingRitualComponentElements(makeDraft({ class: 'combatant' }))).toEqual([])
  })

  it('não-ocultista com ritual via Aprender Ritual também precisa de componentes', () => {
    const draft = makeDraft({
      class: 'combatant',
      nex: 15,
      powerChoices: ['transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' } },
    })
    expect(getMissingRitualComponentElements(draft)).toEqual(['blood'])
    const equipado = makeDraft({ ...draft, equipmentChoices: ['componentes-ritualisticos-sangue'] })
    expect(getMissingRitualComponentElements(equipado)).toEqual([])
  })

  it('Aprender Ritual multi-elemento conta pelo elemento da fonte (não pela chave granted:)', () => {
    const draft = makeDraft({
      class: 'combatant',
      nex: 15,
      powerChoices: ['transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'learn-ritual', ritualId: 'amaldicoar-arma', ritualElement: 'blood' },
      },
    })
    expect(getMissingRitualComponentElements(draft)).toEqual(['blood'])
  })

  it('afinidade ATIVA dispensa componentes do próprio elemento (p. 116)', () => {
    const base = {
      class: 'occultist' as const,
      nex: 60,
      ritualChoices: ['eletrocussao'], // Energia
      powerChoices: ['skill-training', 'skill-training', 'skill-training', 'transcend'] as (string | null)[],
      powerParams: { 'slot-0': ['fighting', 'aim'], 'slot-1': ['stealth', 'crime'], 'slot-2': ['perception', 'tactics'] },
      paranormalPowerChoices: { 'slot-3': { powerId: 'fortunate' as const } },
      affinityElement: 'energy' as const,
    }
    // Transcender em NEX 60 (pós-50) ativa a afinidade em Energia → componentes dispensados.
    expect(getMissingRitualComponentElements(makeDraft(base))).toEqual([])
    // Sem o transcender pós-50 a afinidade fica inativa → aviso volta.
    const inactive = makeDraft({ ...base, powerChoices: ['transcend', 'skill-training', 'skill-training', 'skill-training'], powerParams: { 'slot-1': ['fighting', 'aim'], 'slot-2': ['stealth', 'crime'], 'slot-3': ['perception', 'tactics'] }, paranormalPowerChoices: { 'slot-0': { powerId: 'fortunate' } } })
    expect(getMissingRitualComponentElements(inactive)).toEqual(['energy'])
  })

  it('componentes ritualísticos são Categoria 0 e ocupam 1 espaço (Tabela 3.10)', () => {
    for (const el of ['conhecimento', 'energia', 'morte', 'sangue']) {
      const item = getEquipmentById(`componentes-ritualisticos-${el}`)!
      expect(item.category).toBe(0)
      expect(item.spaces).toBe(1)
      expect(item.paranormal).toBe(true)
    }
  })
})

describe('hasProtectionProficiency', () => {
  const leve = getEquipmentById('protecao-leve')!
  const pesada = getEquipmentById('protecao-pesada')!
  const escudo = getEquipmentById('escudo')!

  it('as 3 classes têm proteção leve; nenhuma tem pesada de saída', () => {
    for (const cls of ['combatant', 'specialist'] as const) {
      expect(hasProtectionProficiency(makeDraft({ class: cls }), leve)).toBe(true)
      expect(hasProtectionProficiency(makeDraft({ class: cls }), pesada)).toBe(false)
    }
    // Ocultista não tem proficiência com proteção alguma.
    expect(hasProtectionProficiency(makeDraft({ class: 'occultist' }), leve)).toBe(false)
  })

  it('o poder Proteção Pesada concede a categoria pesada', () => {
    const draft = makeDraft({ class: 'combatant', nex: 30, powerChoices: ['heavy-armor-proficiency'] })
    expect(hasProtectionProficiency(draft, pesada)).toBe(true)
  })

  it('o Escudo conta como proteção pesada para fins de proficiência', () => {
    expect(hasProtectionProficiency(makeDraft({ class: 'combatant' }), escudo)).toBe(false)
    const comPoder = makeDraft({ class: 'combatant', nex: 30, powerChoices: ['heavy-armor-proficiency'] })
    expect(hasProtectionProficiency(comPoder, escudo)).toBe(true)
  })

  it('itens gerais não exigem proficiência', () => {
    expect(hasItemProficiency(makeDraft({ class: 'occultist' }), getEquipmentById('corda')!)).toBe(true)
  })
})

describe('Acessórios: escolha de perícia e não-acúmulo (p. 63)', () => {
  it('Utensílio e Vestimenta abrem um slot de perícia cada; outros itens não', () => {
    const draft = makeDraft({ equipmentChoices: ['utensilio', 'vestimenta', 'corda', 'kit-pericia'] })
    expect(getAccessorySkillSlots(draft).map(s => s.uid)).toEqual(['utensilio', 'vestimenta'])
    expect(getAccessorySkillSlots(draft).every(s => s.value === 2)).toBe(true)
  })

  it('Luta e Pontaria não são opções', () => {
    expect(getAccessorySkillOptions()).not.toContain('fighting')
    expect(getAccessorySkillOptions()).not.toContain('aim')
    expect(getAccessorySkillOptions()).toContain('diplomacy')
  })

  it('Aprimorado sobe o bônus do item para +5', () => {
    const draft = makeDraft({
      equipmentChoices: ['utensilio'],
      equipmentModifications: { utensilio: ['aprimorado'] },
    })
    expect(getAccessorySkillSlots(draft)[0].value).toBe(5)
  })

  it('Função Adicional abre um segundo slot de +2', () => {
    const draft = makeDraft({
      equipmentChoices: ['utensilio'],
      equipmentModifications: { utensilio: ['funcao-adicional'] },
    })
    const slots = getAccessorySkillSlots(draft)
    expect(slots).toHaveLength(2)
    expect(slots[1].index).toBe(1)
    expect(slots[1].value).toBe(2)
  })

  it('a etapa fica incompleta enquanto a perícia do acessório não é escolhida', () => {
    const semEscolha = makeDraft({ class: 'combatant', equipmentChoices: ['utensilio'] })
    expect(areAccessorySkillChoicesComplete(semEscolha)).toBe(false)
    expect(isEquipmentStepComplete(semEscolha)).toBe(false)

    const comEscolha = makeDraft({
      class: 'combatant',
      equipmentChoices: ['utensilio'],
      accessorySkillChoices: { utensilio: ['diplomacy'] },
    })
    expect(areAccessorySkillChoicesComplete(comEscolha)).toBe(true)
    expect(isEquipmentStepComplete(comEscolha)).toBe(true)
  })

  it('dois itens na mesma perícia são PERMITIDOS, mas contam como conflito de não-acúmulo', () => {
    const draft = makeDraft({
      class: 'combatant',
      // Aprimorado sobe o Utensílio pra Cat II — precisa de uma Patente com vaga nessa categoria.
      patente: 'agente-especial',
      equipmentChoices: ['utensilio', 'vestimenta'],
      equipmentModifications: { utensilio: ['aprimorado'] }, // +5
      accessorySkillChoices: { utensilio: ['diplomacy'], vestimenta: ['diplomacy'] },
    })
    // O não-acúmulo NÃO bloqueia a ficha: o agente pode carregar os dois itens.
    expect(isEquipmentStepComplete(draft)).toBe(true)
    expect(getNonCumulativeSkillConflicts(draft)).toEqual([
      { skillId: 'diplomacy', sources: ['Utensílio', 'Vestimenta'], applied: 5 },
    ])
  })

  it('perícias diferentes não geram conflito', () => {
    const draft = makeDraft({
      equipmentChoices: ['utensilio', 'vestimenta'],
      accessorySkillChoices: { utensilio: ['diplomacy'], vestimenta: ['athletics'] },
    })
    expect(getNonCumulativeSkillConflicts(draft)).toEqual([])
  })

  it('Aprimorado pode ser aplicado 2x com Função Adicional, e o 2º sobe o slot adicional pra +5', () => {
    const item = getEquipmentById('utensilio')!
    // Sem Função Adicional, o Aprimorado não repete.
    expect(canApplyModification(item, ['aprimorado'], 'aprimorado')).toBe(false)
    // Com Função Adicional, repete uma vez só.
    expect(canApplyModification(item, ['aprimorado', 'funcao-adicional'], 'aprimorado')).toBe(true)
    expect(canApplyModification(item, ['aprimorado', 'aprimorado', 'funcao-adicional'], 'aprimorado')).toBe(false)

    const draft = makeDraft({
      patente: 'oficial-operacoes',
      equipmentChoices: ['utensilio'],
      equipmentModifications: { utensilio: ['aprimorado', 'funcao-adicional', 'aprimorado'] },
    })
    expect(getAccessorySkillSlots(draft).map(s => s.value)).toEqual([5, 5])
  })

  it('2º Aprimorado órfão (sem Função Adicional) é ignorado em tudo, inclusive na categoria', () => {
    const draft = makeDraft({
      patente: 'oficial-operacoes',
      equipmentChoices: ['utensilio'],
      equipmentModifications: { utensilio: ['aprimorado', 'aprimorado'] },
    })
    // Só um Aprimorado vale: +5 num slot, e categoria I + 1 modificação = II (não III).
    expect(getAccessorySkillSlots(draft).map(s => s.value)).toEqual([5])
    expect(getDraftInstanceCategory(draft, 'utensilio')).toBe(2)
  })

  it('cada aplicação do Aprimorado cobra categoria (Utensílio I + 3 mods = IV)', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['utensilio'],
      equipmentModifications: { utensilio: ['aprimorado', 'funcao-adicional', 'aprimorado'] },
    })
    expect(getDraftInstanceCategory(draft, 'utensilio')).toBe(4)
  })

  it('só duas vestimentas fornecem bônus ao mesmo tempo; as demais ficam inativas', () => {
    const draft = makeDraft({
      patente: 'oficial-operacoes',
      equipmentChoices: ['vestimenta', 'vestimenta#2', 'vestimenta#3'],
      accessorySkillChoices: {
        vestimenta: ['diplomacy'],
        'vestimenta#2': ['athletics'],
        'vestimenta#3': ['crime'],
      },
    })
    const worn = getWornVestimentas(draft)
    expect(worn.active).toHaveLength(2)
    expect(worn.inactive).toEqual(['vestimenta#3'])
    // A 3ª não entra no total da ficha.
    expect(getAccessorySkillBonuses(draft).map(b => b.skillId)).toEqual(['diplomacy', 'athletics'])
  })

  it('valem as vestimentas de MAIOR bônus (a Aprimorada entra na frente)', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['vestimenta', 'vestimenta#2', 'vestimenta#3'],
      equipmentModifications: { 'vestimenta#3': ['aprimorado'] }, // +5
      accessorySkillChoices: {
        vestimenta: ['diplomacy'],
        'vestimenta#2': ['athletics'],
        'vestimenta#3': ['crime'],
      },
    })
    const worn = getWornVestimentas(draft)
    expect(worn.active).toContain('vestimenta#3')
    expect(worn.inactive).toEqual(['vestimenta#2']) // empate em +2 resolve pela ordem
  })

  it('o limite de vestimentas não afeta utensílios', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['utensilio', 'utensilio#2', 'utensilio#3'],
      accessorySkillChoices: {
        utensilio: ['diplomacy'],
        'utensilio#2': ['athletics'],
        'utensilio#3': ['crime'],
      },
    })
    expect(getWornVestimentas(draft).inactive).toEqual([])
    expect(getAccessorySkillBonuses(draft)).toHaveLength(3)
  })

  it('vestimenta inativa não bloqueia a ficha, e a linha do item avisa', () => {
    const draft = makeDraft({
      class: 'combatant',
      patente: 'oficial-operacoes',
      equipmentChoices: ['vestimenta', 'vestimenta#2', 'vestimenta#3'],
      accessorySkillChoices: {
        vestimenta: ['diplomacy'],
        'vestimenta#2': ['athletics'],
        'vestimenta#3': ['crime'],
      },
    })
    expect(isEquipmentStepComplete(draft)).toBe(true)
    expect(formatAccessorySkills(draft, 'vestimenta#3')).toBe('+2 Crime (inativo — só duas vestimentas por vez)')
    expect(formatAccessorySkills(draft, 'vestimenta')).toBe('+2 Diplomacia')
  })

  it('formatAccessorySkills descreve os bônus da unidade', () => {
    const draft = makeDraft({
      equipmentChoices: ['utensilio'],
      equipmentModifications: { utensilio: ['aprimorado', 'funcao-adicional'] },
      accessorySkillChoices: { utensilio: ['diplomacy', 'technology'] },
    })
    expect(formatAccessorySkills(draft, 'utensilio')).toBe('+5 Diplomacia, +2 Tecnologia')
    expect(formatAccessorySkills(draft, 'corda')).toBe('')
  })
})

describe('Kits de perícia', () => {
  it('as opções são só as 4 perícias que exigem kit no livro', () => {
    expect(getKitSkillOptions().sort()).toEqual(['crime', 'deception', 'medicine', 'technology'])
  })

  it('cada Kit de Perícia requisitado abre um slot', () => {
    const draft = makeDraft({ equipmentChoices: ['kit-pericia', 'kit-pericia#2', 'corda'] })
    expect(getKitSlots(draft).map(s => s.uid)).toEqual(['kit-pericia', 'kit-pericia#2'])
    expect(getKitSlots(draft).every(s => s.kind === 'kit')).toBe(true)
  })

  it('acessório com Instrumental também vira kit, com escolha própria', () => {
    const draft = makeDraft({
      patente: 'agente-especial',
      equipmentChoices: ['utensilio'],
      equipmentModifications: { utensilio: ['instrumental'] },
      // A perícia do kit é independente da que o utensílio bonifica (exemplo do livro:
      // "smartphone hacker" dá +2 em Atualidades e funciona como kit de eletrônica).
      accessorySkillChoices: { utensilio: ['current-affairs'] },
      kitSkillChoices: { utensilio: 'technology' },
    })
    const slots = getKitSlots(draft)
    expect(slots).toHaveLength(1)
    expect(slots[0].kind).toBe('instrumental')
    expect(getKitSkills(draft)).toEqual([{ skillId: 'technology', source: 'Utensílio' }])
    // O bônus de perícia do acessório segue sendo o dele, não o do kit.
    expect(getAccessorySkillBonuses(draft).map(b => b.skillId)).toEqual(['current-affairs'])
  })

  it('a etapa fica incompleta enquanto o kit não tem perícia definida', () => {
    const semEscolha = makeDraft({ class: 'combatant', equipmentChoices: ['kit-pericia'] })
    expect(areKitChoicesComplete(semEscolha)).toBe(false)
    expect(isEquipmentStepComplete(semEscolha)).toBe(false)

    const comEscolha = makeDraft({
      class: 'combatant',
      equipmentChoices: ['kit-pericia'],
      kitSkillChoices: { 'kit-pericia': 'medicine' },
    })
    expect(areKitChoicesComplete(comEscolha)).toBe(true)
    expect(isEquipmentStepComplete(comEscolha)).toBe(true)
  })

  it('hasKitForSkill e getSkillsMissingKit refletem o loadout', () => {
    const draft = makeDraft({
      equipmentChoices: ['kit-pericia'],
      kitSkillChoices: { 'kit-pericia': 'medicine' },
    })
    expect(hasKitForSkill(draft, 'medicine')).toBe(true)
    expect(hasKitForSkill(draft, 'crime')).toBe(false)
    expect(getSkillsMissingKit(draft).sort()).toEqual(['crime', 'deception', 'technology'])
  })

  it('o kit NÃO concede bônus de perícia — só registra a ferramenta', () => {
    const draft = makeDraft({
      equipmentChoices: ['kit-pericia'],
      kitSkillChoices: { 'kit-pericia': 'medicine' },
    })
    expect(getAccessorySkillBonuses(draft)).toEqual([])
    expect(getSkillBonusTotal(draft, 'medicine')).toBe(0)
  })

  it('estar sem kit não aplica penalidade nem invalida a ficha', () => {
    const draft = makeDraft({ class: 'combatant', equipmentChoices: ['corda'] })
    expect(getSkillsMissingKit(draft)).toHaveLength(4)
    expect(getSkillBonusTotal(draft, 'medicine')).toBe(0)
    expect(isEquipmentStepComplete(draft)).toBe(true)
  })

  it('formatKitSkill descreve o kit da unidade', () => {
    const draft = makeDraft({
      equipmentChoices: ['kit-pericia'],
      kitSkillChoices: { 'kit-pericia': 'crime' },
    })
    expect(formatKitSkill(draft, 'kit-pericia')).toBe('kit de ladrão')
    expect(formatKitSkill(draft, 'corda')).toBe('')
  })
})

describe('getLoadPenaltySkillBonuses (Proteção Pesada)', () => {
  it('sem proteção pesada equipada, nenhuma penalidade', () => {
    expect(getLoadPenaltySkillBonuses(makeDraft({ equipmentChoices: ['protecao-leve'] }))).toEqual([])
  })

  it('com proteção pesada, −5 em todas as perícias com penalidade de carga', () => {
    const penalties = getLoadPenaltySkillBonuses(makeDraft({ equipmentChoices: ['protecao-pesada'] }))
    expect(penalties.length).toBe(SKILLS.filter(s => s.loadPenalty).length)
    expect(penalties.every(p => p.value === -5 && p.source === 'Proteção Pesada')).toBe(true)
    // Crime tem penalidade de carga; Ocultismo não.
    expect(penalties.map(p => p.skillId)).toContain('crime')
    expect(penalties.map(p => p.skillId)).not.toContain('occultism')
  })

  it('vale também para uma segunda unidade da proteção pesada (uid com sufixo)', () => {
    expect(getLoadPenaltySkillBonuses(makeDraft({ equipmentChoices: ['protecao-leve', 'protecao-pesada#2'] })).length)
      .toBeGreaterThan(0)
  })
})
