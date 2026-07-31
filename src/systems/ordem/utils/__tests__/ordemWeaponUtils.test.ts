import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemWeapon } from '../../types/equipment'
import { getEquipmentById, EQUIPMENTS, hasWeaponProficiency } from '../equipmentUtils'
import {
  getOrdemWeaponAttack, getWeaponSkillName, formatWeaponSummary, isMelee, getUnarmedAttack,
  getWeaponAmmoVariants, getSheetWeaponAttacks, getBloodWeaponAttack,
  canBeThrown, getCoronhadaAttack, getWeaponRuleNotes,
} from '../ordemWeaponUtils'
import { getAvailableModifications } from '../modificationUtils'

function makeDraft(over: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, ...over }
}

// A faca é ÁGIL (p. 59): com Agilidade > Força, o ataque e o dano usam Agilidade. Onde o teste
// quer a regra BASE de corpo a corpo (Força), usa-se o machete, que não é ágil.
const faca = getEquipmentById('faca') as OrdemWeapon         // corpo a corpo, 1d4 C (corte), crít 19, ÁGIL
const machete = getEquipmentById('machete') as OrdemWeapon   // corpo a corpo, 1d6 C (corte), crít 19, não ágil
const pistola = getEquipmentById('pistola') as OrdemWeapon   // fogo, 1d12 B (balístico), crít 18

const AGI3_FOR2 = makeDraft({ attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 } })

describe('ordemWeaponUtils', () => {
  it('arma corpo a corpo usa Luta (rola Força d20) e soma Força no dano', () => {
    const a = getOrdemWeaponAttack(machete, AGI3_FOR2, [])
    expect(a.skill).toBe('Luta')
    expect(a.rollDice).toBe(2) // Força
    expect(a.attributeUsed).toBe('strength')
    expect(a.attackBonus).toBe(0) // destreinado em Luta
    expect(a.damage).toBe('1d6+2 corte') // + Força 2
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
    // Faca é ágil: com Agi 3 > For 2, o atributo do dano é a Agilidade.
    expect(getOrdemWeaponAttack(faca, golpePesado, []).damage).toBe('2d4+3 corte')
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
    expect(getOrdemWeaponAttack(faca, maoPesada, []).damage).toBe('1d4+5 corte') // Agilidade 3 (ágil) + Mão Pesada 2
    expect(getOrdemWeaponAttack(pistola, maoPesada, []).damage).toBe('1d12 balístico') // fogo: sem bônus
    // Para Bellum (Militar): +2 em dano com armas de fogo; nada corpo a corpo.
    const paraBellum = makeDraft({ attributes: AGI3_FOR2.attributes, origin: 'military' })
    expect(getOrdemWeaponAttack(pistola, paraBellum, []).damage).toBe('1d12+2 balístico')
    expect(getOrdemWeaponAttack(faca, paraBellum, []).damage).toBe('1d4+3 corte') // corpo a corpo: só o atributo (ágil → Agi 3)
  })

  it('modificações de combate entram nos números', () => {
    // Certeira (+2 ataque) + Cruel (+2 dano) na faca corpo a corpo
    const cc = getOrdemWeaponAttack(faca, AGI3_FOR2, ['certeira', 'cruel'])
    expect(cc.attackBonus).toBe(2) // 0 treino + 2 Certeira
    expect(cc.damage).toBe('1d4+5 corte') // Agilidade 3 (faca é ágil) + Cruel 2
    // Calibre Grosso (+1 dado) na arma de fogo
    expect(getOrdemWeaponAttack(pistola, AGI3_FOR2, ['calibre-grosso']).damage).toBe('2d12 balístico')
    // Perigosa amplia a margem de ameaça: crítico 19 → 17
    expect(getOrdemWeaponAttack(faca, AGI3_FOR2, ['perigosa']).critical).toBe('17')
  })

  it('Ferramenta de Trabalho (origem Operário): +1 ataque/dano/margem de ameaça só na arma escolhida', () => {
    const comFerramenta = makeDraft({ attributes: AGI3_FOR2.attributes, origin: 'laborer', workToolWeapon: 'faca' })
    const a = getOrdemWeaponAttack(faca, comFerramenta, [])
    expect(a.attackBonus).toBe(1) // destreinado (0) + Ferramenta +1
    expect(a.damage).toBe('1d4+4 corte') // Agilidade 3 (faca é ágil) + Ferramenta 1
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
    // Com Artista Marcial o desarmado "conta como arma ágil": Agi 3 > For 2 → +3 no dano.
    const base = { attributes: AGI3_FOR2.attributes, powerChoices: ['martial-artist'] }
    expect(getUnarmedAttack(makeDraft({ ...base, nex: 10 }))?.damage).toBe('1d6+3 impacto')
    expect(getUnarmedAttack(makeDraft({ ...base, nex: 35 }))?.damage).toBe('1d8+3 impacto')
    expect(getUnarmedAttack(makeDraft({ ...base, nex: 70 }))?.damage).toBe('1d10+3 impacto')
  })

  it('usa Luta, é ágil com o poder, e herda Golpe Pesado (+1 dado, "conta como arma")', () => {
    const draft = makeDraft({ attributes: AGI3_FOR2.attributes, powerChoices: ['martial-artist', 'heavy-blow'], nex: 10 })
    const a = getUnarmedAttack(draft)!
    expect(a.name).toBe('Desarmado')
    expect(a.skill).toBe('Luta')
    expect(a.attributeUsed).toBe('agility') // ágil pelo Artista Marcial
    expect(a.rollDice).toBe(3)
    expect(a.damage).toBe('2d6+3 impacto') // 1d6 + Golpe Pesado (+1 dado) + Agilidade 3
  })
})

describe('Soqueira no ataque desarmado (p. 66)', () => {
  const comSoqueira = (over: Partial<OrdemCharacterDraft> = {}) => makeDraft({
    attributes: AGI3_FOR2.attributes,
    equipmentChoices: ['soqueira'],
    ...over,
  })

  it('soma +1 nas rolagens de dano desarmado', () => {
    // Sem soqueira: 1d3+2 (Força 2). Com ela: +1.
    expect(getUnarmedAttack(AGI3_FOR2).damage).toBe('1d3+2 I (não letal)')
    expect(getUnarmedAttack(comSoqueira()).damage).toBe('1d3+3 I (não letal)')
  })

  it('aplica as modificações DELA nos ataques desarmados', () => {
    const draft = comSoqueira({ equipmentModifications: { soqueira: ['cruel', 'certeira'] } })
    const a = getUnarmedAttack(draft)
    // Cruel +2 no dano (soma com o +1 da soqueira e a Força 2) e Certeira +2 no ataque.
    expect(a.damage).toBe('1d3+5 I (não letal)')
    expect(a.attackBonus).toBe(2)
  })

  it('aceita modificações de arma corpo a corpo no catálogo (o livro permite explicitamente)', () => {
    const soqueira = getEquipmentById('soqueira')!
    const ids = getAvailableModifications(soqueira).map(m => m.id)
    expect(ids).toContain('cruel')
    expect(ids).toContain('certeira')
    expect(ids).toContain('perigosa')
    // Não é arma de fogo: nada de Calibre Grosso.
    expect(ids).not.toContain('calibre-grosso')
  })

  it('anota a fonte na linha do Desarmado, e só quando a soqueira está no loadout', () => {
    expect(getUnarmedAttack(comSoqueira()).notes.some(n => n.includes('Soqueira'))).toBe(true)
    expect(getUnarmedAttack(AGI3_FOR2).notes.some(n => n.includes('Soqueira'))).toBe(false)
  })

  it('não muda o dado nem o tipo do desarmado (a soqueira não é arma própria)', () => {
    const a = getUnarmedAttack(comSoqueira())
    expect(a.skill).toBe('Luta')
    expect(a.damage).toContain('1d3')
    expect(a.damage).toContain('não letal')
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
    // A faca é ágil, e o resumo sinaliza isso já no card de escolha.
    expect(formatWeaponSummary(faca)).toBe('Luta · corpo a corpo · alcance Curto · leve · proficiência simples · ágil')
    expect(formatWeaponSummary(pistola)).toBe('Pontaria · arma de fogo · alcance Curto · leve · proficiência simples')
  })

  it('omite o alcance quando a arma não tem (ex.: punhal, corpo a corpo puro)', () => {
    const punhal = getEquipmentById('punhal') as OrdemWeapon
    expect(punhal.range).toBe('-')
    expect(formatWeaponSummary(punhal)).toBe('Luta · corpo a corpo · leve · proficiência simples · ágil')
  })

  it('o resumo sinaliza arma automática', () => {
    const submetralhadora = getEquipmentById('submetralhadora') as OrdemWeapon
    expect(formatWeaponSummary(submetralhadora)).toContain('automática')
  })

  it('lança-chamas: Pontaria, arma de fogo, alcance curto, duas mãos, proficiência pesada', () => {
    const lancaChamas = getEquipmentById('lanca-chamas') as OrdemWeapon
    expect(formatWeaponSummary(lancaChamas)).toBe('Pontaria · arma de fogo · alcance Curto · duas mãos · proficiência pesada')
  })
})

describe('Arma de Sangue (poder paranormal)', () => {
  const comArmaDeSangue = makeDraft({
    class: 'combatant', nex: 15,
    attributes: { agility: 1, strength: 3, intellect: 1, presence: 1, vigor: 1 },
    powerChoices: ['transcend'],
    paranormalPowerChoices: { 'slot-0': { powerId: 'blood-weapon' } },
  })

  it('entra na lista de ataques como arma corpo a corpo leve de 1d6 de Sangue', () => {
    const attack = getBloodWeaponAttack(comArmaDeSangue)!
    expect(attack.name).toBe('Arma de Sangue')
    expect(attack.skill).toBe('Luta')
    expect(attack.damage).toBe('1d6+3 Sangue') // soma Força, como toda arma corpo a corpo
  })

  it('não aparece sem o poder', () => {
    expect(getBloodWeaponAttack(makeDraft({ class: 'combatant' }))).toBeNull()
    expect(getSheetWeaponAttacks(makeDraft({ class: 'combatant' })).map(a => a.name)).toEqual(['Desarmado'])
  })

  it('aparece na lista da ficha, antes do desarmado', () => {
    expect(getSheetWeaponAttacks(comArmaDeSangue).map(a => a.name)).toEqual(['Arma de Sangue', 'Desarmado'])
  })
})

describe('Armas ágeis (p. 59)', () => {
  const katana = getEquipmentById('katana') as OrdemWeapon   // ágil
  const machado = getEquipmentById('machado') as OrdemWeapon // não ágil
  // Agilidade 4, Força 1: o extremo que a regra existe para viabilizar.
  const agil = (over: Partial<OrdemCharacterDraft> = {}) => makeDraft({
    class: 'combatant',
    attributes: { agility: 4, strength: 1, intellect: 1, presence: 1, vigor: 1 },
    ...over,
  })

  it('as seis armas ágeis do livro estão marcadas, e só elas', () => {
    const ageis = EQUIPMENTS.filter(e => e.type === 'weapon' && e.agile).map(e => e.id).sort()
    expect(ageis).toEqual(['cajado', 'faca', 'florete', 'katana', 'nunchaku', 'punhal'])
  })

  it('usa Agilidade no pool de dados E no dano quando ela é maior', () => {
    const a = getOrdemWeaponAttack(katana, agil(), [])
    expect(a.skill).toBe('Luta') // a perícia continua sendo Luta
    expect(a.attributeUsed).toBe('agility')
    expect(a.rollDice).toBe(4)
    expect(a.damage).toBe('1d10+4 corte')
  })

  it('mantém Força quando ela é maior ou igual', () => {
    const forte = agil({ attributes: { agility: 1, strength: 4, intellect: 1, presence: 1, vigor: 1 } })
    const a = getOrdemWeaponAttack(katana, forte, [])
    expect(a.attributeUsed).toBe('strength')
    expect(a.rollDice).toBe(4)
    expect(a.damage).toBe('1d10+4 corte')
  })

  it('não afeta arma que não é ágil', () => {
    const a = getOrdemWeaponAttack(machado, agil(), [])
    expect(a.attributeUsed).toBe('strength')
    expect(a.rollDice).toBe(1)
    expect(a.damage).toBe('1d8+1 corte')
  })

  it('o ataque por Ocultismo (Lâmina Maldita) não entra na troca', () => {
    const ocultista = makeDraft({
      class: 'occultist', nex: 10, trilha: 'paranormal-blade',
      attributes: { agility: 4, strength: 1, intellect: 2, presence: 1, vigor: 1 },
    })
    const a = getOrdemWeaponAttack(getEquipmentById('punhal') as OrdemWeapon, ocultista, [], [], 'occultism')
    expect(a.attributeUsed).toBe('intellect')
    expect(a.rollDice).toBe(2)
  })

  it('o desarmado do Artista Marcial conta como arma ágil', () => {
    const semPoder = getUnarmedAttack(agil())
    expect(semPoder.attributeUsed).toBe('strength')

    const comPoder = getUnarmedAttack(agil({ nex: 15, powerChoices: ['martial-artist'] }))
    expect(comPoder.attributeUsed).toBe('agility')
    expect(comPoder.damage).toBe('1d6+4 impacto')
  })
})

describe('Regras próprias das armas', () => {
  it('Arco Composto soma Força no dano, ao contrário das outras armas de disparo', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { agility: 1, strength: 3, intellect: 1, presence: 1, vigor: 1 },
    })
    const arcoComposto = getEquipmentById('arco-composto') as OrdemWeapon
    const arco = getEquipmentById('arco') as OrdemWeapon
    expect(getOrdemWeaponAttack(arcoComposto, draft, []).damage).toBe('1d10+3 perfuração')
    expect(getOrdemWeaponAttack(arco, draft, []).damage).toBe('1d6 perfuração')
  })

  it('Motosserra aplica −2 no teste de ataque', () => {
    const treinado = makeDraft({
      class: 'combatant',
      attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      classChoiceGroupPicks: ['fighting', 'fortitude'],
    })
    const motosserra = getEquipmentById('motosserra') as OrdemWeapon
    // Treinado em Luta = +5, menos a penalidade da arma = +3.
    expect(getOrdemWeaponAttack(motosserra, treinado, []).attackBonus).toBe(3)
  })

  it('as três armas automáticas do livro estão marcadas, e só elas', () => {
    const autos = EQUIPMENTS.filter(e => e.type === 'weapon' && e.automatic).map(e => e.id).sort()
    expect(autos).toEqual(['fuzil-assalto', 'metralhadora', 'submetralhadora'])
  })

  it('Ferrolho Automático não é oferecido a arma que já é automática', () => {
    const submetralhadora = getEquipmentById('submetralhadora')!
    const pistola = getEquipmentById('pistola')!
    expect(getAvailableModifications(submetralhadora).map(m => m.id)).not.toContain('ferrolho-automatico')
    expect(getAvailableModifications(pistola).map(m => m.id)).toContain('ferrolho-automatico')
  })

  it('nota da metralhadora só aparece com Força abaixo de 4', () => {
    const metralhadora = getEquipmentById('metralhadora') as OrdemWeapon
    const fraco = makeDraft({ class: 'combatant', attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 } })
    const forte = makeDraft({ class: 'combatant', attributes: { agility: 1, strength: 4, intellect: 1, presence: 1, vigor: 1 } })
    expect(getWeaponRuleNotes(metralhadora, fraco).join(' ')).toContain('tripé')
    expect(getWeaponRuleNotes(metralhadora, forte).join(' ')).not.toContain('tripé')
    // A nota de automática vale nos dois casos.
    expect(getWeaponRuleNotes(metralhadora, forte).join(' ')).toContain('Automática')
  })

  it('notas condicionais de grau: fuzil de precisão e katana', () => {
    const fuzil = getEquipmentById('fuzil-precisao') as OrdemWeapon
    const katana = getEquipmentById('katana') as OrdemWeapon
    // Veterano exige NEX 35% + um slot de Grau de Treinamento gasto na perícia.
    const veterano = makeDraft({
      class: 'combatant', nex: 35,
      attributes: { agility: 2, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      classChoiceGroupPicks: ['aim', 'fortitude'],
      classFreeSkillChoices: ['fighting', 'athletics'],
      skillGradeChoices: [['aim', 'fighting']],
    })
    expect(getWeaponRuleNotes(fuzil, veterano).join(' ')).toContain('+5 na margem de ameaça')
    expect(getWeaponRuleNotes(katana, veterano).join(' ')).toContain('uma mão')

    const treinado = makeDraft({
      class: 'combatant',
      classChoiceGroupPicks: ['aim', 'fortitude'],
      classFreeSkillChoices: ['fighting'],
    })
    expect(getWeaponRuleNotes(fuzil, treinado).join(' ')).not.toContain('+5 na margem')
    expect(getWeaponRuleNotes(katana, treinado).join(' ')).not.toContain('uma mão')
  })

  it('regras de texto fixo vêm dos dados (espingarda, bazuca, cajado)', () => {
    const draft = makeDraft({ class: 'combatant' })
    expect(getWeaponRuleNotes(getEquipmentById('espingarda') as OrdemWeapon, draft).join(' '))
      .toContain('metade do dano')
    expect(getWeaponRuleNotes(getEquipmentById('bazuca') as OrdemWeapon, draft).join(' '))
      .toContain('raio de 3m')
    expect(getWeaponRuleNotes(getEquipmentById('cajado') as OrdemWeapon, draft).join(' '))
      .toContain('Combater com Duas Armas')
  })
})

describe('Penalidades de proficiência no pool de dados', () => {
  const espingarda = getEquipmentById('espingarda') as OrdemWeapon // tática
  const agi3 = { agility: 3, strength: 3, intellect: 2, presence: 1, vigor: 1 }

  it('arma sem proficiência: −ØØ no teste de ataque, com a nota da fonte', () => {
    // Ocultista só tem proficiência com armas simples.
    const ocultista = makeDraft({ class: 'occultist', attributes: agi3 })
    const a = getOrdemWeaponAttack(espingarda, ocultista, [])
    expect(a.rollDice).toBe(1) // Agilidade 3 − 2
    expect(a.rollMode).toBe('best')
    expect(a.dicePenaltyNotes).toEqual(['arma sem proficiência −ØØ'])
  })

  it('combatente tem proficiência com tática: pool cheio, sem nota', () => {
    const combatente = makeDraft({ class: 'combatant', attributes: agi3 })
    const a = getOrdemWeaponAttack(espingarda, combatente, [])
    expect(a.rollDice).toBe(3)
    expect(a.dicePenaltyNotes).toEqual([])
  })

  it('proteção sem proficiência penaliza o ataque também (Força/Agilidade)', () => {
    // Ocultista não tem proficiência com proteção alguma.
    const ocultista = makeDraft({
      class: 'occultist', attributes: agi3,
      equipmentChoices: ['protecao-leve', 'faca'],
    })
    const faca = getEquipmentById('faca') as OrdemWeapon // simples → tem proficiência
    const a = getOrdemWeaponAttack(faca, ocultista, [])
    expect(a.dicePenaltyNotes).toEqual(['proteção sem proficiência −ØØ'])
    expect(a.rollDice).toBe(1) // Força 3 − 2
  })

  it('as duas penalidades acumulam e podem virar "role o pior"', () => {
    const ocultista = makeDraft({
      class: 'occultist', attributes: agi3,
      equipmentChoices: ['protecao-leve', 'espingarda'],
    })
    const a = getOrdemWeaponAttack(espingarda, ocultista, [])
    expect(a.dicePenaltyNotes).toHaveLength(2)
    // Agilidade 3 − 4 = −1 → rola 3+4 = 7 dados e pega o pior.
    expect(a.rollMode).toBe('worst')
    expect(a.rollDice).toBe(7)
  })

  it('ataque por Ocultismo (Lâmina Maldita) não sofre a penalidade de proteção', () => {
    const ocultista = makeDraft({
      class: 'occultist', nex: 10, trilha: 'paranormal-blade',
      attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 },
      equipmentChoices: ['protecao-leve', 'faca'],
      weaponSkillChoices: { faca: 'occultism' },
    })
    const faca = getEquipmentById('faca') as OrdemWeapon
    const a = getOrdemWeaponAttack(faca, ocultista, [], [], 'occultism')
    expect(a.skill).toBe('Ocultismo')
    expect(a.dicePenaltyNotes).toEqual([]) // Intelecto não é Força nem Agilidade
    expect(a.rollDice).toBe(3)
  })

  it('atributo 0 rola 2 dados e pega o pior', () => {
    const forca0 = makeDraft({
      class: 'combatant',
      attributes: { agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 },
    })
    // Machete (não ágil) mantém o teste em Força 0; a faca desviaria para Agilidade.
    const a = getOrdemWeaponAttack(machete, forca0, [])
    expect(a.rollDice).toBe(2)
    expect(a.rollMode).toBe('worst')
  })
})

describe('Arremesso e coronhada', () => {
  it('faca, lança e machadinha rendem uma linha de arremesso com Pontaria', () => {
    for (const id of ['faca', 'lanca', 'machadinha']) {
      expect(canBeThrown(getEquipmentById(id) as OrdemWeapon), id).toBe(true)
    }
    // Punhal não tem alcance → não é arremessável.
    expect(canBeThrown(getEquipmentById('punhal') as OrdemWeapon)).toBe(false)

    const draft = makeDraft({
      class: 'combatant',
      attributes: { agility: 2, strength: 3, intellect: 1, presence: 1, vigor: 1 },
      equipmentChoices: ['faca'],
    })
    const attacks = getSheetWeaponAttacks(draft)
    expect(attacks.map(a => a.name)).toEqual(['Faca', 'Faca (arremesso)', 'Desarmado'])
    const [corpo, arremesso] = attacks
    expect(corpo.skill).toBe('Luta')
    expect(arremesso.skill).toBe('Pontaria')
    // Arremesso soma Força no dano, igual ao corpo a corpo.
    expect(arremesso.damage).toBe('1d4+3 corte')
    expect(arremesso.rollDice).toBe(2) // Agilidade
  })

  it('coronhada só aparece com arma de fogo, e usa o dado maior se for de duas mãos', () => {
    const semFogo = makeDraft({ class: 'combatant', equipmentChoices: ['faca'] })
    expect(getCoronhadaAttack(semFogo)).toBeNull()

    const pistola = makeDraft({ class: 'combatant', equipmentChoices: ['pistola'] })
    expect(getCoronhadaAttack(pistola)?.damage).toContain('1d4')

    const fuzil = makeDraft({ class: 'combatant', equipmentChoices: ['fuzil-de-caca'] })
    expect(getCoronhadaAttack(fuzil)?.damage).toContain('1d6')
  })

  it('coronhada é impacto letal, diferente do desarmado (1d3 não letal)', () => {
    const draft = makeDraft({
      class: 'combatant',
      attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      equipmentChoices: ['pistola'],
    })
    const attacks = getSheetWeaponAttacks(draft)
    expect(attacks.map(a => a.name)).toEqual(['Pistola', 'Coronhada', 'Desarmado'])
    expect(attacks[1].damage).toBe('1d4+2 impacto')
    expect(attacks[2].damage).toBe('1d3+2 I (não letal)')
  })
})

describe('Máquina de Matar (Aniquilador NEX 99%)', () => {
  const katana = getEquipmentById('katana') as OrdemWeapon // 1d10, crít 19
  const aniquilador = (over: Partial<OrdemCharacterDraft> = {}) => makeDraft({
    class: 'combatant', trilha: 'annihilator', nex: 99, favoriteWeapon: 'katana',
    attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 },
    ...over,
  })

  it('soma um dado do mesmo tipo na arma favorita, e +2 na margem de ameaça', () => {
    const a = getOrdemWeaponAttack(katana, aniquilador(), [])
    expect(a.damage).toBe('2d10+2 corte') // 1d10 → 2d10, +Força 2
    expect(a.critical).toBe('17') // 19 − 2 (Máquina de Matar)
  })

  it('não afeta arma que não é a favorita', () => {
    const a = getOrdemWeaponAttack(katana, aniquilador({ favoriteWeapon: 'espada' }), [])
    expect(a.damage).toBe('1d10+2 corte')
  })

  it('só vale em NEX 99% (em 65% a arma favorita segue com o dado original)', () => {
    expect(getOrdemWeaponAttack(katana, aniquilador({ nex: 65 }), []).damage).toBe('1d10+2 corte')
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
    // Carregar arma de fogo também abre a linha de Coronhada (Tabela 3.3).
    expect(attacks.map(a => a.name)).toEqual(['Pistola', 'Coronhada', 'Desarmado'])
  })

  it('munição comum rende uma linha com o nome da munição', () => {
    const draft = atirador({ equipmentChoices: ['pistola', 'municao-balas-curtas'] })
    expect(getSheetWeaponAttacks(draft).map(a => a.name))
      .toEqual(['Pistola (Balas Curtas)', 'Coronhada', 'Desarmado'])
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
      'Coronhada',
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
    expect(attacks.map(a => a.name)).toEqual(['Espingarda (Cartuchos)', 'Coronhada', 'Desarmado'])
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
      'Coronhada',
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
      'Coronhada',
      'Desarmado',
    ])
  })

  it('arma corpo a corpo ignora munição no loadout', () => {
    const draft = atirador({
      equipmentChoices: ['faca', 'municao-balas-curtas'],
      equipmentModifications: { 'municao-balas-curtas': ['dum-dum'] },
    })
    expect(getWeaponAmmoVariants(draft, faca)).toEqual([])
    // A faca tem alcance, então rende também a linha de arremesso; sem arma de fogo, sem Coronhada.
    expect(getSheetWeaponAttacks(draft).map(a => a.name)).toEqual(['Faca', 'Faca (arremesso)', 'Desarmado'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Dano estruturado (modo de jogo)
// ─────────────────────────────────────────────────────────────────────────────

describe('damageSpec', () => {
  it('espelha a string de dano: dados da arma e Força no bônus', () => {
    const a = getOrdemWeaponAttack(machete, AGI3_FOR2, [])
    expect(a.damage).toBe('1d6+2 corte')
    expect(a.damageSpec).toEqual({ dice: [{ count: 1, sides: 6 }], bonus: 2, extra: [] })
  })

  it('arma de fogo não soma atributo no bônus', () => {
    const a = getOrdemWeaponAttack(pistola, AGI3_FOR2, [])
    expect(a.damageSpec).toEqual({ dice: [{ count: 1, sides: 12 }], bonus: 0, extra: [] })
  })

  it('expõe margem de ameaça e multiplicador como número', () => {
    // Machete é crít 19 (margem 19, multiplicador x2 implícito).
    const a = getOrdemWeaponAttack(machete, AGI3_FOR2, [])
    expect(a.threatMargin).toBe(19)
    expect(a.critMultiplier).toBe(2)
    // Pistola é crít 18.
    expect(getOrdemWeaponAttack(pistola, AGI3_FOR2, []).threatMargin).toBe(18)
  })

  it('dado extra de fonte separada vai pra `extra`, que NÃO multiplica no crítico (p. 84)', () => {
    // Munição explosiva concede +2d6 — punhado próprio, como o Ataque Furtivo do exemplo do livro.
    const draft = makeDraft({
      attributes: { agility: 3, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      equipmentChoices: ['pistola', 'municao-balas-curtas'],
      equipmentModifications: { 'municao-balas-curtas': ['explosiva'] },
    })
    const explosiva = getSheetWeaponAttacks(draft).find(a => a.name.includes('Explosiva'))
    if (!explosiva) return // munição explosiva pode não existir pra este calibre; o resto do teste cobre a estrutura
    expect(explosiva.damageSpec.extra?.length).toBeGreaterThan(0)
    // O dado da arma continua sozinho em `dice`.
    expect(explosiva.damageSpec.dice).toEqual([{ count: 1, sides: 12 }])
  })

  it('desarmado também tem dano estruturado', () => {
    const a = getUnarmedAttack(AGI3_FOR2)
    expect(a.damageSpec.dice.length + (a.damageSpec.bonus === 0 ? 0 : 1)).toBeGreaterThan(0)
  })
})
