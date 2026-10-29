import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemWeapon } from '../../types/equipment'
import type { OrdemRitual } from '../../types/ritual'
import {
  CURSES,
  getCurse,
  curseAppliesTo,
  canApplyCurse,
  getCurseCategoryDelta,
  getSheetAttributes,
  getCurseDefenseBonus,
  getCursedDerivedStats,
  areOpposingElements,
  formatCurseElement,
  formatCurseChoiceDetail,
  getRitualDt,
  getRitualPeLimit,
  canPatenteUseCursedItems,
  getCursesBlockedByPatente,
  formatCursePriceAttributes,
  getUnitCursePrice,
  formatUnitCursePrice,
  getCursePriceNote,
  getCurseResistances,
} from '../curseUtils'
import {
  getEquipmentById, getEffectiveCategory, isEquipmentStepComplete, areCursesValid, getDraftInstanceCategory,
  instanceItemId, newInstanceUid, getInstanceLabel, getModifiedSpaces,
} from '../equipmentUtils'
import { getOrdemWeaponAttack } from '../ordemWeaponUtils'
import { getOrdemClass } from '../classUtils'
import { getEffectivePeLimit } from '../characterUtils'
import { getPeLimit } from '../progressionUtils'

function makeDraft(over: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, attributes: { ...EMPTY_DRAFT.attributes }, ...over }
}

const revolver = getEquipmentById('revolver')!       // arma de fogo, Cat I
const faca = getEquipmentById('faca')!               // arma corpo a corpo, Cat 0
const protecaoLeve = getEquipmentById('protecao-leve')!
const utensilio = getEquipmentById('utensilio')!
const kitPericia = getEquipmentById('kit-pericia')!

describe('dados das maldições', () => {
  it('tem as 34 maldições do livro (12 de armas, 10 de proteções, 12 de acessórios)', () => {
    expect(CURSES).toHaveLength(34)
    expect(CURSES.filter(c => c.target.startsWith('weapon'))).toHaveLength(12)
    expect(CURSES.filter(c => c.target === 'protection-any')).toHaveLength(10)
    expect(CURSES.filter(c => c.target === 'accessory-wear')).toHaveLength(12)
  })
})

describe('curseAppliesTo', () => {
  it('maldição de arma não aplica em proteção nem acessório', () => {
    const senciente = getCurse('senciente')!
    expect(curseAppliesTo(senciente, revolver)).toBe(true)
    expect(curseAppliesTo(senciente, protecaoLeve)).toBe(false)
    expect(curseAppliesTo(senciente, utensilio)).toBe(false)
  })

  it('Empuxo só aplica em arma corpo a corpo', () => {
    const empuxo = getCurse('empuxo')!
    expect(curseAppliesTo(empuxo, faca)).toBe(true)
    expect(curseAppliesTo(empuxo, revolver)).toBe(false)
  })

  it('maldição de acessório vale pra utensílio/vestimenta, mas não pra kit (livro: "utensílios e vestuários")', () => {
    const carisma = getCurse('carisma')!
    expect(curseAppliesTo(carisma, utensilio)).toBe(true)
    expect(curseAppliesTo(carisma, getEquipmentById('vestimenta')!)).toBe(true)
    expect(curseAppliesTo(carisma, kitPericia)).toBe(false)
  })
})

describe('canApplyCurse — regras da pág. 144', () => {
  it('maldições iguais não se acumulam no mesmo item', () => {
    expect(canApplyCurse(revolver, ['senciente'], 'senciente')).toBe(false)
  })

  it('elementos opressores não coexistem: Ritualística (Conhecimento) × Energética (Energia)', () => {
    expect(areOpposingElements('knowledge', 'energy')).toBe(true)
    expect(canApplyCurse(revolver, ['ritualistica'], 'energetica')).toBe(false)
    expect(canApplyCurse(revolver, ['energetica'], 'ritualistica')).toBe(false)
  })

  it('elementos não opressores coexistem: Ritualística (Conhecimento) + Consumidora (Morte)', () => {
    expect(areOpposingElements('knowledge', 'death')).toBe(false)
    expect(canApplyCurse(revolver, ['ritualistica'], 'consumidora')).toBe(true)
  })

  it('Proteção Elemental usa o elemento escolhido na checagem de oposição', () => {
    // Sangue oprime Conhecimento: Proteção Elemental (Sangue) bloqueia Carisma (Conhecimento).
    const choices = { 'utensilio:protecao-elemental': 'blood' }
    expect(canApplyCurse(utensilio, ['protecao-elemental'], 'carisma', choices)).toBe(false)
    // Com Medo escolhido não há oposição.
    const fearChoice = { 'utensilio:protecao-elemental': 'fear' }
    expect(canApplyCurse(utensilio, ['protecao-elemental'], 'carisma', fearChoice)).toBe(true)
  })
})

describe('categoria efetiva com maldições', () => {
  it('a 1ª maldição sobe a categoria em II, as seguintes em I', () => {
    expect(getCurseCategoryDelta(0)).toBe(0)
    expect(getCurseCategoryDelta(1)).toBe(2)
    expect(getCurseCategoryDelta(2)).toBe(3)
    // Revólver (Cat I) senciente → Cat III; com 2ª maldição → Cat IV.
    expect(getEffectiveCategory(revolver, 0, 1)).toBe(3)
    expect(getEffectiveCategory(revolver, 0, 2)).toBe(4)
  })

  it('modificações e maldições acumulam os ajustes de categoria (teto IV)', () => {
    expect(getEffectiveCategory(revolver, 1, 1)).toBe(4) // I + 1 mod + (1ª maldição +II)
    expect(getEffectiveCategory(revolver, 3, 2)).toBe(4) // passa do teto → IV
  })
})

describe('bônus das maldições na ficha', () => {
  const combatant = getOrdemClass('combatant')!

  it('Disposição (+1 Vigor) aumenta o PV retroativamente, como qualquer Vigor', () => {
    const base = makeDraft({ nex: 20, equipmentChoices: ['utensilio'] })
    const cursed = makeDraft({ nex: 20, equipmentChoices: ['utensilio'], equipmentCurses: { utensilio: ['disposicao'] } })
    // NEX 20% = 4 degraus (desde o 0%). Vigor 1→2: 20+2 + 4×(4+2) = 46 (vs 41 sem a maldição).
    expect(getCursedDerivedStats(base, combatant).hp).toBe(41)
    expect(getCursedDerivedStats(cursed, combatant).hp).toBe(46)
  })

  it('Carisma (+1 Presença) NÃO fornece PE adicionais, mas aparece no atributo da ficha', () => {
    const base = makeDraft({ equipmentChoices: ['utensilio'] })
    const cursed = makeDraft({ equipmentChoices: ['utensilio'], equipmentCurses: { utensilio: ['carisma'] } })
    expect(getSheetAttributes(cursed).presence).toBe(2)
    expect(getCursedDerivedStats(cursed, combatant).pe).toBe(getCursedDerivedStats(base, combatant).pe)
  })

  it('Vitalidade soma +15 PV e Esforço Adicional soma +5 PE (fixos)', () => {
    const base = makeDraft({ equipmentChoices: ['utensilio', 'vestimenta'] })
    const cursed = makeDraft({
      equipmentChoices: ['utensilio', 'vestimenta'],
      equipmentCurses: { utensilio: ['vitalidade'], vestimenta: ['esforco-adicional'] },
    })
    expect(getCursedDerivedStats(cursed, combatant).hp).toBe(getCursedDerivedStats(base, combatant).hp + 15)
    expect(getCursedDerivedStats(cursed, combatant).pe).toBe(getCursedDerivedStats(base, combatant).pe + 5)
  })

  it('bônus de Defesa: Defesa (+5), Cinética/Letárgica/Repulsora (+2) somam na Defesa', () => {
    const cursed = makeDraft({
      equipmentChoices: ['utensilio', 'protecao-leve'],
      equipmentCurses: { utensilio: ['defesa'], 'protecao-leve': ['cinetica'] },
    })
    expect(getCurseDefenseBonus(cursed)).toBe(7)
    // 10 + Agi 1 + 5 (bônus da proteção, passado pelo chamador) + 7 (maldições) = 23
    expect(getCursedDerivedStats(cursed, combatant, 5).defense).toBe(23)
  })

  it('a mesma maldição em dois itens não acumula o bônus (pág. 144)', () => {
    const cursed = makeDraft({
      equipmentChoices: ['utensilio', 'vestimenta'],
      equipmentCurses: { utensilio: ['carisma'], vestimenta: ['carisma'] },
    })
    expect(getSheetAttributes(cursed).presence).toBe(2) // +1, não +2
  })

  it('maldição de item NÃO equipado não conta', () => {
    const cursed = makeDraft({ equipmentChoices: [], equipmentCurses: { utensilio: ['defesa'] } })
    expect(getCurseDefenseBonus(cursed)).toBe(0)
  })
})

describe('maldições de arma nos ataques', () => {
  const AGI3_FOR2 = makeDraft({ attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 } })

  it('Lancinante adiciona +1d8 Sangue ao dano', () => {
    // A faca é ágil (p. 59): com Agi 3 > For 2, o atributo do dano é a Agilidade.
    const a = getOrdemWeaponAttack(faca as OrdemWeapon, AGI3_FOR2, [], ['lancinante'])
    expect(a.damage).toBe('1d4+3 corte +1d8 Sangue')
  })

  it('Predadora duplica a margem de ameaça (fuzil de caça 19 → 17, exemplo do livro) e sobe o alcance', () => {
    const fuzil = getEquipmentById('fuzil-de-caca') as OrdemWeapon // crít 19/x3, alcance Médio
    const a = getOrdemWeaponAttack(fuzil, AGI3_FOR2, [], ['predadora'])
    expect(a.critical).toBe('17/x3')
    expect(a.range).toBe('Longo')
  })

  it('Destreza (+1 Agilidade de acessório amaldiçoado) entra nos d20 de Pontaria', () => {
    const cursed = makeDraft({
      attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      equipmentChoices: ['utensilio'],
      equipmentCurses: { utensilio: ['destreza'] },
    })
    const a = getOrdemWeaponAttack(getEquipmentById('pistola') as OrdemWeapon, cursed, [])
    expect(a.rollDice).toBe(4)
  })
})

describe('validação de equipamento com maldições', () => {
  it('revólver senciente vira Cat III: bloqueado pra Recruta, liberado pra Agente Especial', () => {
    const base = {
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['senciente'] },
    }
    expect(getDraftInstanceCategory(makeDraft(base), 'revolver')).toBe(3)
    expect(isEquipmentStepComplete(makeDraft({ ...base, patente: 'recruta' }))).toBe(false)
    expect(isEquipmentStepComplete(makeDraft({ ...base, patente: 'agente-especial' }))).toBe(true)
  })

  it('maldições de elementos opressores no mesmo item invalidam o passo', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['ritualistica', 'energetica'] },
    })
    expect(areCursesValid(draft)).toBe(false)
    expect(isEquipmentStepComplete(draft)).toBe(false)
  })

  it('maldição com escolha pendente (Antielemento sem elemento) invalida; escolhida, valida', () => {
    const semEscolha = makeDraft({
      patente: 'agente-especial',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['antielemento'] },
    })
    expect(areCursesValid(semEscolha)).toBe(false)
    const comEscolha = makeDraft({
      patente: 'agente-especial',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['antielemento'] },
      equipmentCurseChoices: { 'revolver:antielemento': 'energy' },
    })
    expect(areCursesValid(comEscolha)).toBe(true)
    expect(isEquipmentStepComplete(comEscolha)).toBe(true)
  })
})

describe('unidades de equipamento — 2 revólveres com características diferentes', () => {
  it('uids: 1ª unidade usa o id do item, duplicatas ganham sufixo', () => {
    expect(newInstanceUid(['revolver'], 'revolver')).toBe('revolver#2')
    expect(newInstanceUid(['revolver', 'revolver#2'], 'revolver')).toBe('revolver#3')
    expect(newInstanceUid([], 'revolver')).toBe('revolver')
    expect(instanceItemId('revolver#2')).toBe('revolver')
    expect(instanceItemId('revolver')).toBe('revolver')
  })

  it('cada unidade tem maldições próprias e vira um ataque próprio na ficha', () => {
    const draft = makeDraft({
      patente: 'oficial-operacoes',
      equipmentChoices: ['revolver', 'revolver#2'],
      equipmentCurses: { revolver: ['senciente'], 'revolver#2': ['lancinante'] },
    })
    // Rótulos numerados quando há duplicatas.
    expect(getInstanceLabel(draft, 'revolver')).toBe('Revólver #1')
    expect(getInstanceLabel(draft, 'revolver#2')).toBe('Revólver #2')
    // Categorias por unidade: cada uma Cat I +II (1ª maldição) = III.
    expect(getDraftInstanceCategory(draft, 'revolver')).toBe(3)
    expect(getDraftInstanceCategory(draft, 'revolver#2')).toBe(3)
    // Ataques distintos: só a unidade Lancinante tem o dano extra.
    const a1 = getOrdemWeaponAttack(revolver as OrdemWeapon, draft, [], draft.equipmentCurses['revolver'])
    const a2 = getOrdemWeaponAttack(revolver as OrdemWeapon, draft, [], draft.equipmentCurses['revolver#2'])
    expect(a1.damage).not.toContain('+1d8 Sangue')
    expect(a2.damage).toContain('+1d8 Sangue')
    // Espaços contam por unidade (2 revólveres = 2 espaços).
    expect(getModifiedSpaces(draft)).toBe(2)
  })

  it('limite da Patente conta por unidade: 2× Cat III exige Oficial de Operações', () => {
    const dois = {
      equipmentChoices: ['revolver', 'revolver#2'],
      equipmentCurses: { revolver: ['senciente'], 'revolver#2': ['lancinante'] },
    }
    // Agente Especial: limite 1 de Cat III → inválido; Oficial de Operações: limite 2 → válido.
    expect(isEquipmentStepComplete(makeDraft({ ...dois, patente: 'agente-especial' }))).toBe(false)
    expect(isEquipmentStepComplete(makeDraft({ ...dois, patente: 'oficial-operacoes' }))).toBe(true)
  })

  it('escolhas de elemento são por unidade (dois Antielemento com elementos diferentes)', () => {
    const draft = makeDraft({
      patente: 'oficial-operacoes',
      equipmentChoices: ['revolver', 'revolver#2'],
      equipmentCurses: { revolver: ['antielemento'], 'revolver#2': ['antielemento'] },
      equipmentCurseChoices: { 'revolver:antielemento': 'energy', 'revolver#2:antielemento': 'death' },
    })
    expect(areCursesValid(draft)).toBe(true)
    // O elemento da maldição Antielemento é fixo (Conhecimento); o escolhido é o elemento-ALVO, por unidade.
    const antielemento = getCurse('antielemento')!
    expect(formatCurseElement(antielemento, 'revolver', draft.equipmentCurseChoices)).toBe('Conhecimento')
    expect(formatCurseChoiceDetail(antielemento, 'revolver', draft.equipmentCurseChoices)).toBe('elemento-alvo: Energia')
    expect(formatCurseChoiceDetail(antielemento, 'revolver#2', draft.equipmentCurseChoices)).toBe('elemento-alvo: Morte')
  })
})

describe('getRitualDt', () => {
  const armaduraDeSangue = { id: 'armadura-de-sangue', circle: 1, elements: ['blood'], range: 'pessoal', target: 'você' } as OrdemRitual

  it('base: 10 + limite de PE por rodada + Presença, sem bônus', () => {
    const draft = makeDraft({ nex: 25, attributes: { agility: 1, strength: 1, intellect: 1, presence: 4, vigor: 1 } })
    expect(getRitualDt(draft, armaduraDeSangue)).toEqual({ dt: 10 + getPeLimit(25) + 4, notes: [] })
  })

  it('Rituais Eficientes (Graduado NEX 65%) soma +5 em qualquer ritual', () => {
    const draft = makeDraft({
      class: 'occultist', trilha: 'scholar', nex: 65,
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 1 },
    })
    expect(getRitualDt(draft, armaduraDeSangue)).toEqual({ dt: 10 + getPeLimit(65) + 2 + 5, notes: ['Rituais Eficientes +5'] })
  })

  it('Especialista em Elemento soma +2 só no elemento escolhido', () => {
    const sangue = makeDraft({
      nex: 5,
      powerChoices: ['element-specialist'],
      powerParams: { 'slot-0': ['blood'] },
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 1 },
    })
    expect(getRitualDt(sangue, armaduraDeSangue)).toEqual({ dt: 10 + getPeLimit(5) + 2 + 2, notes: ['Especialista em Elemento +2'] })

    const medo = makeDraft({
      nex: 5,
      powerChoices: ['element-specialist'],
      powerParams: { 'slot-0': ['fear'] },
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 1 },
    })
    expect(getRitualDt(medo, armaduraDeSangue)).toEqual({ dt: 10 + getPeLimit(5) + 2, notes: [] })
  })
})

describe('getRitualPeLimit', () => {
  it('sem Presença Poderosa, é igual ao limite geral de PE por turno', () => {
    const draft = makeDraft({ nex: 40, attributes: { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 1 } })
    expect(getRitualPeLimit(draft)).toBe(getEffectivePeLimit(draft))
  })

  it('Presença Poderosa (Intuitivo NEX 40%) soma Presença só pra conjurar rituais', () => {
    const draft = makeDraft({
      class: 'occultist', trilha: 'intuitive', nex: 40,
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 1 },
    })
    expect(getRitualPeLimit(draft)).toBe(getEffectivePeLimit(draft) + 3)
  })
})

// ── 5ª rodada da auditoria ─────────────────────────────────────────────────────

describe('Patente exigida pra itens amaldiçoados (pág. 144)', () => {
  it('libera só Agente Especial, Oficial de Operações e Agente de Elite', () => {
    expect(canPatenteUseCursedItems('recruta')).toBe(false)
    expect(canPatenteUseCursedItems('operador')).toBe(false)
    expect(canPatenteUseCursedItems('agente-especial')).toBe(true)
    expect(canPatenteUseCursedItems('oficial-operacoes')).toBe(true)
    expect(canPatenteUseCursedItems('agente-elite')).toBe(true)
  })

  it('é restrição SEPARADA das vagas: o escudo Cat 0 amaldiçoado cabe na vaga Cat II do Operador, mas o livro proíbe', () => {
    const base = {
      equipmentChoices: ['escudo'],
      equipmentCurses: { escudo: ['cinetica'] },
    }
    // Cat 0 + 1ª maldição (+II) = Cat II, e o Operador TEM uma vaga de Cat II.
    expect(getDraftInstanceCategory(makeDraft(base), 'escudo')).toBe(2)
    const operador = makeDraft({ ...base, patente: 'operador' })
    expect(getCursesBlockedByPatente(operador)).toEqual(['escudo'])
    expect(areCursesValid(operador)).toBe(false)
    expect(isEquipmentStepComplete(operador)).toBe(false)
    // Mesma ficha, Patente que o livro libera: passa.
    const especial = makeDraft({ ...base, patente: 'agente-especial' })
    expect(getCursesBlockedByPatente(especial)).toEqual([])
    expect(isEquipmentStepComplete(especial)).toBe(true)
  })

  it('sem maldição, Patente baixa não é bloqueada', () => {
    const draft = makeDraft({ patente: 'recruta', equipmentChoices: ['faca'] })
    expect(getCursesBlockedByPatente(draft)).toEqual([])
    expect(isEquipmentStepComplete(draft)).toBe(true)
  })
})

describe('o preço da maldição (pág. 145)', () => {
  it('mapeia cada elemento ao atributo que o livro cobra', () => {
    expect(formatCursePriceAttributes('knowledge')).toBe('Intelecto')
    expect(formatCursePriceAttributes('energy')).toBe('Agilidade')
    expect(formatCursePriceAttributes('death')).toBe('Presença')
    expect(formatCursePriceAttributes('blood')).toBe('Força ou Vigor')
  })

  it('uma maldição de Conhecimento cobra 2 SAN por falha em teste de Intelecto', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['senciente'] },
    })
    expect(getUnitCursePrice(draft, 'revolver')).toEqual([
      { element: 'knowledge', sanity: 2, attributes: 'Intelecto' },
    ])
    expect(formatUnitCursePrice(draft, 'revolver')).toBe('−2 SAN a cada falha em teste de Intelecto')
  })

  it('é CUMULATIVO: duas maldições do mesmo elemento no item cobram 4 SAN', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['revolver'],
      equipmentCurses: { revolver: ['senciente', 'ritualistica'] },
    })
    expect(getUnitCursePrice(draft, 'revolver')).toEqual([
      { element: 'knowledge', sanity: 4, attributes: 'Intelecto' },
    ])
  })

  it('elementos diferentes no mesmo item cobram em atributos diferentes', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['revolver'],
      // Conhecimento + Sangue não são opressores entre si (o ciclo é Sangue→Conhecimento... ),
      // então precisam coexistir num item só se `canApplyCurse` permitir; aqui só medimos o preço.
      equipmentCurses: { revolver: ['senciente', 'lancinante'] },
    })
    const price = getUnitCursePrice(draft, 'revolver')
    expect(price.map(p => p.element).sort()).toEqual(['blood', 'knowledge'])
    expect(price.every(p => p.sanity === 2)).toBe(true)
  })

  it('Proteção Elemental sem elemento escolhido não tem preço definido', () => {
    const curse = getCurse('protecao-elemental')!
    expect(getCursePriceNote(curse, 'utensilio', {})).toBeNull()
    expect(getCursePriceNote(curse, 'utensilio', { 'utensilio:protecao-elemental': 'death' }))
      .toBe('−2 SAN a cada falha em teste de Presença')
  })

  it('Medo não tem preço (a p. 145 define só os quatro elementos)', () => {
    const curse = getCurse('protecao-elemental')!
    expect(getCursePriceNote(curse, 'utensilio', { 'utensilio:protecao-elemental': 'fear' })).toBeNull()
  })
})

describe('resistências concedidas por maldições', () => {
  it('Profética dá resistência 10 ao Conhecimento; Escudo Mental, 10 mental', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['protecao-leve', 'utensilio'],
      equipmentCurses: { 'protecao-leve': ['profetica'], utensilio: ['escudo-mental'] },
    })
    expect(getCurseResistances(draft)).toEqual([
      { label: 'Conhecimento', value: 10, source: 'maldição Profética' },
      { label: 'mental', value: 10, source: 'maldição Escudo Mental' },
    ])
  })

  it('a mesma maldição em dois itens vale uma vez (bônus não acumulam, pág. 144)', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['utensilio', 'vestimenta'],
      equipmentCurses: { utensilio: ['escudo-mental'], vestimenta: ['escudo-mental'] },
    })
    expect(getCurseResistances(draft)).toHaveLength(1)
  })

  it('Proteção Elemental de elementos diferentes são bônus distintos', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: ['utensilio', 'vestimenta'],
      equipmentCurses: { utensilio: ['protecao-elemental'], vestimenta: ['protecao-elemental'] },
      equipmentCurseChoices: {
        'utensilio:protecao-elemental': 'blood',
        'vestimenta:protecao-elemental': 'fear',
      },
    })
    // Inclui o Medo: o livro dá resistência "contra um elemento", sem excluí-lo.
    expect(getCurseResistances(draft)).toEqual([
      { label: 'Sangue', value: 10, source: 'maldição Proteção Elemental' },
      { label: 'Medo', value: 10, source: 'maldição Proteção Elemental' },
    ])
  })

  it('maldição em item NÃO requisitado não concede resistência', () => {
    const draft = makeDraft({
      patente: 'agente-elite',
      equipmentChoices: [],
      equipmentCurses: { 'protecao-leve': ['profetica'] },
    })
    expect(getCurseResistances(draft)).toEqual([])
  })
})
