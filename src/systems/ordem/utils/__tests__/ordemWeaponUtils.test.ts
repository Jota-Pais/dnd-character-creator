import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemWeapon } from '../../types/equipment'
import { getEquipmentById, EQUIPMENTS, hasWeaponProficiency } from '../equipmentUtils'
import {
  getOrdemWeaponAttack, getWeaponSkillName, formatWeaponSummary, isMelee, getUnarmedAttack,
  getWeaponAmmoVariants, getSheetWeaponAttacks,
} from '../ordemWeaponUtils'

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

  it('Ferramenta de Trabalho (origem Operário): +1 ataque/dano/margem de ameaça só na arma escolhida', () => {
    const comFerramenta = makeDraft({ attributes: AGI3_FOR2.attributes, origin: 'laborer', workToolWeapon: 'faca' })
    const a = getOrdemWeaponAttack(faca, comFerramenta, [])
    expect(a.attackBonus).toBe(1) // destreinado (0) + Ferramenta +1
    expect(a.damage).toBe('1d4+3 corte') // Força 2 + Ferramenta 1
    expect(a.critical).toBe('18') // margem 19 → 18
    // Outra arma (não a escolhida) não ganha nada.
    const outraArma = getOrdemWeaponAttack(pistola, comFerramenta, [])
    expect(outraArma.attackBonus).toBe(0)
    expect(outraArma.damage).toBe('1d12 balístico')
  })
})

describe('getUnarmedAttack (Artista Marcial)', () => {
  it('sem o poder, retorna o ataque desarmado básico (1d3 não letal)', () => {
    const attack = getUnarmedAttack(AGI3_FOR2)
    expect(attack).not.toBeNull()
    expect(attack?.damage).toContain('1d3+2 I (não letal)')
  })

  it('com o poder: 1d6 até NEX 34%, 1d8 em NEX 35%+, 1d10 em NEX 70%+', () => {
    const base = { attributes: AGI3_FOR2.attributes, powerChoices: ['martial-artist'] }
    expect(getUnarmedAttack(makeDraft({ ...base, nex: 10 }))?.damage).toBe('1d6+2 impacto')
    expect(getUnarmedAttack(makeDraft({ ...base, nex: 35 }))?.damage).toBe('1d8+2 impacto')
    expect(getUnarmedAttack(makeDraft({ ...base, nex: 70 }))?.damage).toBe('1d10+2 impacto')
  })

  it('usa Luta (rola Força), soma Força no dano, e herda Golpe Pesado (+1 dado, "conta como arma")', () => {
    const draft = makeDraft({ attributes: AGI3_FOR2.attributes, powerChoices: ['martial-artist', 'heavy-blow'], nex: 10 })
    const a = getUnarmedAttack(draft)!
    expect(a.name).toBe('Desarmado')
    expect(a.skill).toBe('Luta')
    expect(a.rollDice).toBe(2) // Força
    expect(a.damage).toBe('2d6+2 impacto') // 1d6 + Golpe Pesado (+1 dado) + Força 2
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

describe('Mira de Elite (Atirador de Elite NEX 10%)', () => {
  const fuzilAssalto = getEquipmentById('fuzil-assalto') as OrdemWeapon // balas longas, 2d10
  const espingarda = getEquipmentById('espingarda') as OrdemWeapon      // cartuchos, 4d6
  const atirador = (over: Partial<OrdemCharacterDraft> = {}) => makeDraft({
    class: 'specialist',
    trilha: 'elite-marksman',
    nex: 10,
    attributes: { agility: 2, strength: 1, intellect: 3, presence: 1, vigor: 1 },
    ...over,
  })

  it('soma o Intelecto no dano das armas de balas longas', () => {
    expect(getOrdemWeaponAttack(fuzilAssalto, atirador(), []).damage).toBe('2d10+3 balístico')
  })

  it('não afeta arma de outra munição', () => {
    expect(getOrdemWeaponAttack(espingarda, atirador(), []).damage).toBe('4d6 balístico')
  })

  it('não vale antes do NEX 10% nem em outra trilha', () => {
    expect(getOrdemWeaponAttack(fuzilAssalto, atirador({ nex: 5 }), []).damage).toBe('2d10 balístico')
    expect(getOrdemWeaponAttack(fuzilAssalto, atirador({ trilha: 'infiltrator' }), []).damage).toBe('2d10 balístico')
  })

  it('concede proficiência com as armas de balas longas (fuzil de assalto é tática)', () => {
    expect(hasWeaponProficiency(atirador(), fuzilAssalto)).toBe(true)
    // Metralhadora é pesada e também usa balas longas.
    expect(hasWeaponProficiency(atirador(), getEquipmentById('metralhadora') as OrdemWeapon)).toBe(true)
    // Espingarda é tática de cartuchos: Especialista sem o poder segue sem proficiência.
    expect(hasWeaponProficiency(atirador(), espingarda)).toBe(false)
  })
})

describe('munição: variantes e linhas de ataque', () => {
  const atirador = (over: Partial<OrdemCharacterDraft> = {}) => makeDraft({
    attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 },
    ...over,
  })

  it('toda arma de disparo/fogo do catálogo declara a munição que consome; nenhuma corpo a corpo declara', () => {
    for (const item of EQUIPMENTS) {
      if (item.type !== 'weapon') continue
      const ranged = item.weaponCategory === 'disparo' || item.weaponCategory === 'fogo'
      expect(Boolean(item.ammo), `${item.id}`).toBe(ranged)
    }
  })

  it('sem munição no loadout, a arma rende uma linha só, sem rótulo', () => {
    const draft = atirador({ equipmentChoices: ['pistola'] })
    expect(getWeaponAmmoVariants(draft, pistola)).toEqual([])
    const attacks = getSheetWeaponAttacks(draft)
    expect(attacks.map(a => a.name)).toEqual(['Pistola', 'Desarmado'])
  })

  it('munição comum rende uma linha com o nome da munição', () => {
    const draft = atirador({ equipmentChoices: ['pistola', 'municao-balas-curtas'] })
    expect(getSheetWeaponAttacks(draft).map(a => a.name)).toEqual(['Pistola (Balas Curtas)', 'Desarmado'])
  })

  it('munição comum + munição modificada rendem DUAS linhas, a comum primeiro', () => {
    const draft = atirador({
      equipmentChoices: ['pistola', 'municao-balas-curtas', 'municao-balas-curtas#2'],
      equipmentModifications: { 'municao-balas-curtas#2': ['dum-dum'] },
    })
    const attacks = getSheetWeaponAttacks(draft)
    expect(attacks.map(a => a.name)).toEqual([
      'Pistola (Balas Curtas)',
      'Pistola (Balas Curtas — Dum dum)',
      'Desarmado',
    ])
    // Dum dum: +2 no multiplicador de crítico (pistola é 18/x2 → 18/x4).
    expect(attacks[0].critical).toBe('18')
    expect(attacks[1].critical).toBe('18/x4')
  })

  it('respeita o tipo de munição: Dum dum em balas curtas não afeta a espingarda (cartuchos)', () => {
    const espingarda = getEquipmentById('espingarda') as OrdemWeapon
    const draft = atirador({
      equipmentChoices: ['espingarda', 'municao-cartuchos', 'municao-balas-curtas'],
      equipmentModifications: { 'municao-balas-curtas': ['dum-dum'] },
    })
    expect(getWeaponAmmoVariants(draft, espingarda).map(v => v.label)).toEqual(['Cartuchos'])
    const attacks = getSheetWeaponAttacks(draft)
    expect(attacks.map(a => a.name)).toEqual(['Espingarda (Cartuchos)', 'Desarmado'])
    expect(attacks[0].critical).toBe('x3') // sem o +2 do Dum dum
  })

  it('munição Explosiva soma +2d6 no dano da arma compatível', () => {
    const draft = atirador({
      equipmentChoices: ['fuzil-assalto', 'municao-balas-longas'],
      equipmentModifications: { 'municao-balas-longas': ['explosiva'] },
    })
    const attack = getSheetWeaponAttacks(draft)[0]
    expect(attack.name).toBe('Fuzil de Assalto (Balas Longas — Explosiva)')
    expect(attack.damage).toBe('2d10 balístico +2d6')
  })

  it('unidades de munição com os MESMOS mods viram uma variante só', () => {
    const draft = atirador({
      equipmentChoices: ['pistola', 'municao-balas-curtas', 'municao-balas-curtas#2'],
      equipmentModifications: {
        'municao-balas-curtas': ['dum-dum'],
        'municao-balas-curtas#2': ['dum-dum'],
      },
    })
    expect(getSheetWeaponAttacks(draft).map(a => a.name)).toEqual([
      'Pistola (Balas Curtas — Dum dum)',
      'Desarmado',
    ])
  })

  it('duas unidades da MESMA arma cruzam com as variantes de munição (2 armas × 2 munições = 4 linhas)', () => {
    const draft = atirador({
      equipmentChoices: ['pistola', 'pistola#2', 'municao-balas-curtas', 'municao-balas-curtas#2'],
      equipmentModifications: { 'municao-balas-curtas#2': ['dum-dum'] },
    })
    expect(getSheetWeaponAttacks(draft).map(a => a.name)).toEqual([
      'Pistola #1 (Balas Curtas)',
      'Pistola #1 (Balas Curtas — Dum dum)',
      'Pistola #2 (Balas Curtas)',
      'Pistola #2 (Balas Curtas — Dum dum)',
      'Desarmado',
    ])
  })

  it('arma corpo a corpo ignora munição no loadout', () => {
    const draft = atirador({
      equipmentChoices: ['faca', 'municao-balas-curtas'],
      equipmentModifications: { 'municao-balas-curtas': ['dum-dum'] },
    })
    expect(getWeaponAmmoVariants(draft, faca)).toEqual([])
    expect(getSheetWeaponAttacks(draft).map(a => a.name)).toEqual(['Faca', 'Desarmado'])
  })
})
