import { describe, it, expect } from 'vitest'
import {
  deriveStats,
  getOriginSkills,
  getTrainedSkills,
  getAvailableChoiceGroupOptions,
  getAvailableFreeSkillOptions,
  getRequiredFreeSkillCount,
  getFixedSkillOverlapWithOrigin,
  getRitualCost,
  hasFavoredRitualPower,
  hasLaminaMaldita,
  getFavoriteWeaponReduction,
  getFavoriteEquipmentReduction,
  arePowerParamsComplete,
  getEffectiveAttributes,
  getSkillGrade,
  getAvailablePowerOptions,
  getAvailableTrilhaOptions,
  getAvailableVersatilityTrilhaOptions,
  getGrantedRituals,
  getOriginDefenseBonus,
  getOriginHpBonus,
  getOriginSanityBonus,
  getOriginPeBonus,
  getEffectivePeLimit,
  getRitualDtBonusFromTrilha,
  hasRitualPeLimitBonusFromPresence,
  getParanormalResistanceBonus,
  getMentalParanormalDamageResistance,
  getOriginMentalDamageResistance,
  getConditionalDamageResistances,
  hasCarryCapacityIntellectBonus,
  getWorkToolBonus,
} from '../characterUtils'
import { getCursedDerivedStats } from '../curseUtils'
import { getOrdemClass } from '../classUtils'
import { SKILLS } from '../skillUtils'
import { EMPTY_DRAFT } from '../../types/character'
import type { OrdemCharacterDraft } from '../../types/character'
import type { OrdemRitual } from '../../types/ritual'

function makeDraft(overrides: Partial<OrdemCharacterDraft>): OrdemCharacterDraft {
  return { ...EMPTY_DRAFT, attributes: { ...EMPTY_DRAFT.attributes }, ...overrides }
}

describe('deriveStats', () => {
  // Ruling do usuário (2026-07-12): os valores "iniciais" valem no NEX 0%, e 0→5% já é um novo
  // nível de exposição — ocultista NEX 5% com Vig 1 tem 16 PV (12+1 + 2+1).
  it('NEX 0%: valores iniciais puros (combatente: 20+Vig, 2+Pre, SAN 12)', () => {
    const combatant = getOrdemClass('combatant')!
    const stats = deriveStats(combatant, { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 3 }, 0)
    expect(stats).toEqual({ hp: 23, pe: 4, sanity: 12, defense: 11 })
  })

  it('ocultista em NEX 5% (1 degrau): 12+Vig + (2+Vig) de PV — Vig 1 dá 16 PV', () => {
    const occultist = getOrdemClass('occultist')!
    const stats = deriveStats(occultist, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 5)
    expect(stats.hp).toBe(16)
    const stats2 = deriveStats(occultist, { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 0 }, 5)
    expect(stats2).toEqual({ hp: 14, pe: 14, sanity: 25, defense: 11 })
  })

  it('especialista em NEX 5%: 16+Vig + (3+Vig)', () => {
    const specialist = getOrdemClass('specialist')!
    const stats = deriveStats(specialist, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 5)
    expect(stats).toEqual({ hp: 21, pe: 8, sanity: 20, defense: 11 })
  })

  it('combatente em NEX 10% (2 degraus desde o 0%)', () => {
    const combatant = getOrdemClass('combatant')!
    const stats = deriveStats(combatant, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 10)
    // NEX0%: 20+1=21 PV, 2+1=3 PE, 12 SAN. +2 degraus: +4+1=5 PV, +2+1=3 PE, +3 SAN cada.
    expect(stats).toEqual({ hp: 31, pe: 9, sanity: 18, defense: 11 })
  })

  it('ocultista em NEX 99% (20 degraus desde o 0%)', () => {
    const occultist = getOrdemClass('occultist')!
    const stats = deriveStats(occultist, { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 99)
    expect(stats).toEqual({ hp: 13 + 20 * 3, pe: 5 + 20 * 5, sanity: 20 + 20 * 5, defense: 11 })
  })

  it('Defesa = 10 + Agilidade + bônus de proteção (livro pág. 43)', () => {
    const combatant = getOrdemClass('combatant')!
    // Agilidade 3, sem proteção → 13
    expect(deriveStats(combatant, { agility: 3, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 5).defense).toBe(13)
    // Agilidade 2 + proteção +2 → 14
    expect(deriveStats(combatant, { agility: 2, strength: 1, intellect: 1, presence: 1, vigor: 1 }, 5, 2).defense).toBe(14)
  })
})

describe('getOriginSkills', () => {
  it('retorna as 2 perícias fixas de uma origem normal', () => {
    const draft = makeDraft({ origin: 'academic' })
    expect(getOriginSkills(draft)).toEqual(['science', 'investigation'])
  })

  it('amnésico usa as escolhas do jogador no lugar do mestre', () => {
    const draft = makeDraft({ origin: 'amnesiac', originGmSkillChoices: ['stealth', 'perception'] })
    expect(getOriginSkills(draft)).toEqual(['stealth', 'perception'])
  })

  it('sem origem escolhida retorna vazio', () => {
    expect(getOriginSkills(makeDraft({}))).toEqual([])
  })
})

describe('getTrainedSkills', () => {
  it('junta perícias de origem, fixas de classe, grupos de escolha e escolhas livres, sem duplicar', () => {
    const draft = makeDraft({
      origin: 'academic', // science, investigation
      class: 'occultist', // fixed: occultism, willpower
      classChoiceGroupPicks: [],
      classFreeSkillChoices: ['medicine', 'technology'],
    })
    expect(getTrainedSkills(draft).sort()).toEqual(
      ['science', 'investigation', 'occultism', 'willpower', 'medicine', 'technology'].sort(),
    )
  })

  it('dedup: se a mesma perícia aparecer em origem e escolha livre, conta uma vez só', () => {
    const draft = makeDraft({
      origin: 'academic', // science, investigation
      class: 'occultist',
      classFreeSkillChoices: ['science', 'medicine'],
    })
    const skills = getTrainedSkills(draft)
    expect(skills.filter(s => s === 'science')).toHaveLength(1)
  })
})

describe('getAvailableChoiceGroupOptions — regra do livro: perícia já recebida pela origem exclui a opção', () => {
  it('combatente com origem Militar (Pontaria, Tática) não pode escolher Pontaria de novo no grupo Luta/Pontaria', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ origin: 'military', class: 'combatant' }) // military: aim, tactics
    const options = getAvailableChoiceGroupOptions(draft, combatant, 0) // grupo: fighting | aim
    expect(options).toEqual(['fighting'])
  })

  it('sem conflito com a origem, as duas opções do grupo continuam disponíveis', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ origin: 'academic', class: 'combatant' }) // academic: science, investigation
    const options = getAvailableChoiceGroupOptions(draft, combatant, 0)
    expect(options.sort()).toEqual(['aim', 'fighting'].sort())
  })
})

describe('getAvailableFreeSkillOptions', () => {
  it('exclui perícias já garantidas por origem, fixas de classe e grupos de escolha já feitos', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({
      origin: 'academic', // science, investigation
      class: 'occultist', // fixed: occultism, willpower
    })
    const allIds = SKILLS.map(s => s.id)
    const available = getAvailableFreeSkillOptions(draft, occultist, allIds)
    expect(available).not.toContain('science')
    expect(available).not.toContain('investigation')
    expect(available).not.toContain('occultism')
    expect(available).not.toContain('willpower')
    expect(available).toContain('medicine')
  })
})

describe('getRequiredFreeSkillCount', () => {
  it('combatente: 1 + Intelecto', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 2, presence: 1, vigor: 1 } })
    expect(getRequiredFreeSkillCount(draft, combatant)).toBe(3)
  })

  it('especialista: 7 + Intelecto', () => {
    const specialist = getOrdemClass('specialist')!
    const draft = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 0, presence: 1, vigor: 1 } })
    expect(getRequiredFreeSkillCount(draft, specialist)).toBe(7)
  })

  it('ocultista: 3 + Intelecto', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 } })
    expect(getRequiredFreeSkillCount(draft, occultist)).toBe(6)
  })

  // F20: "Se receber uma perícia que já havia recebido pela origem, escolha outra" (pág. 25).
  it('perícia FIXA da classe repetida da origem vira +1 escolha livre (Vítima dá Vontade; Ocultista tem Vontade fixa)', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({
      origin: 'victim', // reflexes + willpower
      attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 },
    })
    expect(getFixedSkillOverlapWithOrigin(draft, occultist)).toEqual(['willpower'])
    expect(getRequiredFreeSkillCount(draft, occultist)).toBe(7) // 3 + Int 3 + 1 da repetida
    // A perícia continua treinada uma vez só (não acumula).
    const trained = getTrainedSkills(draft)
    expect(trained.filter(s => s === 'willpower')).toHaveLength(1)
  })

  it('origem sem colisão com as fixas não altera a contagem', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({
      origin: 'academic', // science + investigation
      attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 },
    })
    expect(getFixedSkillOverlapWithOrigin(draft, occultist)).toEqual([])
    expect(getRequiredFreeSkillCount(draft, occultist)).toBe(6)
  })
})

describe('personalização da ficha (F24) — Ritual Predileto e Lâmina Maldita', () => {
  const amaldicoarArma = { id: 'amaldicoar-arma', circle: 1 } as OrdemRitual
  const outroRitual = { id: 'eletrocussao', circle: 1 } as OrdemRitual
  const ritual3 = { id: 'qualquer', circle: 3 } as OrdemRitual

  it('custo base segue a Tabela 5.2 (1º = 1 PE, 3º = 6 PE)', () => {
    expect(getRitualCost(makeDraft({}), outroRitual)).toEqual({ cost: 1, notes: [] })
    expect(getRitualCost(makeDraft({}), ritual3)).toEqual({ cost: 6, notes: [] })
  })

  it('Ritual Predileto reduz −1 PE só no ritual escolhido, e só com o poder', () => {
    const comPoder = makeDraft({ powerChoices: ['favored-ritual'], favoriteRitual: 'qualquer' })
    expect(getRitualCost(comPoder, ritual3).cost).toBe(5)
    expect(getRitualCost(comPoder, outroRitual).cost).toBe(1) // não é o predileto
    // Escolha marcada sem o poder não reduz nada.
    const semPoder = makeDraft({ favoriteRitual: 'qualquer' })
    expect(getRitualCost(semPoder, ritual3).cost).toBe(6)
  })

  it('poder concedido pela Versatilidade também conta', () => {
    const draft = makeDraft({ versatilityChoice: { kind: 'power', powerId: 'favored-ritual' }, favoriteRitual: 'qualquer' })
    expect(hasFavoredRitualPower(draft)).toBe(true)
    expect(getRitualCost(draft, ritual3).cost).toBe(5)
  })

  it('Lâmina Maldita: Amaldiçoar Arma custa −1 PE; acumulando com predileto chega a 0 (piso)', () => {
    const lamina = makeDraft({ trilha: 'paranormal-blade', nex: 10 })
    expect(hasLaminaMaldita(lamina)).toBe(true)
    expect(getRitualCost(lamina, amaldicoarArma).cost).toBe(0) // 1 − 1
    const dupla = makeDraft({
      trilha: 'paranormal-blade', nex: 10,
      powerChoices: ['favored-ritual'], favoriteRitual: 'amaldicoar-arma',
    })
    expect(getRitualCost(dupla, amaldicoarArma)).toEqual({ cost: 0, notes: ['predileto −1', 'Lâmina Maldita −1'] })
    // Outra trilha não reduz.
    expect(getRitualCost(makeDraft({ trilha: 'graduado', nex: 10 }), amaldicoarArma).cost).toBe(1)
  })
})

describe('getFavoriteWeaponReduction (trilha Aniquilador — A Favorita)', () => {
  it('escala com o NEX: 0 antes de 10%, I/II/III/IV em NEX 10/40/65/99', () => {
    expect(getFavoriteWeaponReduction(makeDraft({ trilha: 'annihilator', nex: 5 }))).toBe(0)
    expect(getFavoriteWeaponReduction(makeDraft({ trilha: 'annihilator', nex: 10 }))).toBe(1)
    expect(getFavoriteWeaponReduction(makeDraft({ trilha: 'annihilator', nex: 40 }))).toBe(2)
    expect(getFavoriteWeaponReduction(makeDraft({ trilha: 'annihilator', nex: 65 }))).toBe(3)
    expect(getFavoriteWeaponReduction(makeDraft({ trilha: 'annihilator', nex: 99 }))).toBe(4)
  })

  it('outra trilha não reduz nada', () => {
    expect(getFavoriteWeaponReduction(makeDraft({ trilha: 'graduado', nex: 99 }))).toBe(0)
    expect(getFavoriteWeaponReduction(makeDraft({ trilha: null, nex: 99 }))).toBe(0)
  })

  it('Versatilidade pra Aniquilador só concede "A Favorita" (redução fixa em I, não escala)', () => {
    const draft = makeDraft({
      trilha: 'graduado', nex: 99,
      versatilityChoice: { kind: 'trilha', trilhaId: 'annihilator' },
    })
    expect(getFavoriteWeaponReduction(draft)).toBe(1)
  })
})

describe('getFavoriteEquipmentReduction (origem Engenheiro — Ferramentas Favoritas)', () => {
  it('I fixo pra quem tem a origem, independente do NEX', () => {
    expect(getFavoriteEquipmentReduction(makeDraft({ origin: 'engineer', nex: 5 }))).toBe(1)
    expect(getFavoriteEquipmentReduction(makeDraft({ origin: 'engineer', nex: 99 }))).toBe(1)
  })

  it('outra origem não reduz nada', () => {
    expect(getFavoriteEquipmentReduction(makeDraft({ origin: 'drifter', nex: 99 }))).toBe(0)
    expect(getFavoriteEquipmentReduction(makeDraft({ origin: null, nex: 99 }))).toBe(0)
  })
})

describe('poderes com escolha embutida (F27)', () => {
  it('Treinamento em Perícia: destreinada vira treinada; já treinada sobe de grau (NEX 35%+)', () => {
    const draft = makeDraft({
      class: 'occultist', // Ocultismo/Vontade fixas
      nex: 35,
      powerChoices: ['skill-training'],
      powerParams: { 'slot-0': ['stealth', 'occultism'] },
    })
    expect(getTrainedSkills(draft)).toContain('stealth')
    expect(getSkillGrade(draft, 'stealth')).toBe('treinado')
    expect(getSkillGrade(draft, 'occultism')).toBe('veterano') // já era treinada pela classe
  })

  it('validação: poder com parâmetro pendente bloqueia; preenchido libera', () => {
    const pendente = makeDraft({ powerChoices: ['skill-training'] })
    expect(arePowerParamsComplete(pendente)).toBe(false)
    expect(arePowerParamsComplete(makeDraft({
      powerChoices: ['skill-training'],
      powerParams: { 'slot-0': ['stealth', 'perception'] },
    }))).toBe(true)
    // Poder sem parâmetro não exige nada.
    expect(arePowerParamsComplete(makeDraft({ powerChoices: ['potent-ritual'] }))).toBe(true)
  })

  it('Mestre em Elemento: −1 PE nos rituais do elemento escolhido', () => {
    const draft = makeDraft({
      powerChoices: ['element-master'],
      powerParams: { 'slot-0': ['energy'] },
    })
    const ritualEnergia = { id: 'eletrocussao', circle: 1, elements: ['energy'] } as OrdemRitual
    const ritualMorte = { id: 'decadencia', circle: 1, elements: ['death'] } as OrdemRitual
    expect(getRitualCost(draft, ritualEnergia)).toEqual({ cost: 0, notes: ['Mestre em Elemento −1'] })
    expect(getRitualCost(draft, ritualMorte).cost).toBe(1)
  })

  it('Tatuagem Ritualística: −1 PE só em ritual de alcance pessoal que mira "você"', () => {
    const comTatuagem = makeDraft({ powerChoices: ['ritualistic-tattoo'] })
    const armaduraDeSangue = { id: 'armadura-de-sangue', circle: 1, elements: ['blood'], range: 'pessoal', target: 'você' } as OrdemRitual
    // Pessoal mas área centrada em você (não "você" como alvo) — não conta, mesmo com alcance pessoal.
    const deteccaoDeAmeacas = { id: 'deteccao-de-ameacas', circle: 2, elements: ['knowledge'], range: 'pessoal', target: 'esfera de 18m de raio' } as OrdemRitual
    expect(getRitualCost(comTatuagem, armaduraDeSangue)).toEqual({ cost: 0, notes: ['Tatuagem Ritualística −1'] })
    expect(getRitualCost(comTatuagem, deteccaoDeAmeacas)).toEqual({ cost: 3, notes: [] })
    // Sem o poder, nenhuma redução.
    const semPoder = makeDraft({})
    expect(getRitualCost(semPoder, armaduraDeSangue).cost).toBe(1)
  })
})

describe('getRitualDtBonusFromTrilha / hasRitualPeLimitBonusFromPresence', () => {
  it('Rituais Eficientes (Graduado NEX 65%) soma +5 na DT de todos os rituais', () => {
    expect(getRitualDtBonusFromTrilha(makeDraft({ class: 'occultist', trilha: 'scholar', nex: 65 }))).toBe(5)
    expect(getRitualDtBonusFromTrilha(makeDraft({ class: 'occultist', trilha: 'scholar', nex: 60 }))).toBe(0)
    expect(getRitualDtBonusFromTrilha(makeDraft({ class: 'occultist', trilha: 'conduit', nex: 99 }))).toBe(0)
  })

  it('Presença Poderosa (Intuitivo NEX 40%) soma Presença ao limite de PE só pra rituais', () => {
    expect(hasRitualPeLimitBonusFromPresence(makeDraft({ class: 'occultist', trilha: 'intuitive', nex: 40 }))).toBe(true)
    expect(hasRitualPeLimitBonusFromPresence(makeDraft({ class: 'occultist', trilha: 'intuitive', nex: 10 }))).toBe(false)
    expect(hasRitualPeLimitBonusFromPresence(makeDraft({ class: 'occultist', trilha: 'conduit', nex: 99 }))).toBe(false)
  })
})

describe('Resistências (Grupo D): Mente Sã, Inabalável, Eu Já Sabia', () => {
  it('Mente Sã (Intuitivo NEX 10%) soma +5 em testes de resistência paranormal', () => {
    expect(getParanormalResistanceBonus(makeDraft({ class: 'occultist', trilha: 'intuitive', nex: 10 }))).toBe(5)
    expect(getParanormalResistanceBonus(makeDraft({ class: 'occultist', trilha: 'intuitive', nex: 5 }))).toBe(0)
    expect(getParanormalResistanceBonus(makeDraft({ class: 'occultist', trilha: 'conduit', nex: 99 }))).toBe(0)
  })

  it('Inabalável (Intuitivo NEX 65%) dá resistência a dano mental e paranormal 10', () => {
    expect(getMentalParanormalDamageResistance(makeDraft({ class: 'occultist', trilha: 'intuitive', nex: 65 }))).toBe(10)
    expect(getMentalParanormalDamageResistance(makeDraft({ class: 'occultist', trilha: 'intuitive', nex: 60 }))).toBe(0)
  })

  it('Eu Já Sabia (Teórico da Conspiração) dá resistência a dano mental igual ao Intelecto recebido', () => {
    expect(getOriginMentalDamageResistance(makeDraft({ origin: 'conspiracy-theorist' }), 4)).toBe(4)
    expect(getOriginMentalDamageResistance(makeDraft({ origin: 'conspiracy-theorist' }), 0)).toBe(0)
    expect(getOriginMentalDamageResistance(makeDraft({ origin: 'academic' }), 4)).toBe(0)
  })

  it('Inabalável e Eu Já Sabia são independentes (fontes diferentes, mesma NEX/origem não interfere)', () => {
    const draft = makeDraft({ class: 'occultist', trilha: 'intuitive', nex: 65, origin: 'conspiracy-theorist' })
    expect(getMentalParanormalDamageResistance(draft)).toBe(10)
    expect(getOriginMentalDamageResistance(draft, 3)).toBe(3)
  })

  it('Casca Grossa (Tropa de Choque NEX 10%): RD igual ao Vigor, condicional a "ao bloquear"', () => {
    const draft = makeDraft({ class: 'combatant', trilha: 'shock-trooper', nex: 10, attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 3 } })
    expect(getConditionalDamageResistances(draft)).toEqual([{ name: 'Casca Grossa', value: 'vigor', condition: 'ao bloquear' }])
    expect(getConditionalDamageResistances(makeDraft({ class: 'combatant', trilha: 'shock-trooper', nex: 5 }))).toEqual([])
  })

  it('Inquebrável (Tropa de Choque NEX 99%): RD 5 fixa, condicional a "enquanto estiver machucado"', () => {
    const draft = makeDraft({ class: 'combatant', trilha: 'shock-trooper', nex: 99 })
    expect(getConditionalDamageResistances(draft)).toContainEqual({ name: 'Inquebrável', value: 5, condition: 'enquanto estiver machucado' })
  })
})

describe('hasCarryCapacityIntellectBonus (Inventário Otimizado, Técnico NEX 10%)', () => {
  it('só vale a partir do NEX 10% da trilha Técnico', () => {
    expect(hasCarryCapacityIntellectBonus(makeDraft({ class: 'specialist', trilha: 'technician', nex: 10 }))).toBe(true)
    expect(hasCarryCapacityIntellectBonus(makeDraft({ class: 'specialist', trilha: 'technician', nex: 5 }))).toBe(false)
    expect(hasCarryCapacityIntellectBonus(makeDraft({ class: 'specialist', trilha: 'field-medic', nex: 99 }))).toBe(false)
  })
})

describe('getWorkToolBonus (Ferramenta de Trabalho, origem Operário)', () => {
  it('Operário dá +1; outras origens não dão nada', () => {
    expect(getWorkToolBonus(makeDraft({ origin: 'laborer' }))).toBe(1)
    expect(getWorkToolBonus(makeDraft({ origin: 'academic' }))).toBe(0)
    expect(getWorkToolBonus(makeDraft({ origin: null }))).toBe(0)
  })
})

describe('getEffectiveAttributes', () => {
  it('sem aumentos, devolve os atributos base', () => {
    const draft = makeDraft({ attributes: { agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 } })
    expect(getEffectiveAttributes(draft)).toEqual({ agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 })
  })

  it('aplica os aumentos de atributo escolhidos', () => {
    const draft = makeDraft({
      attributes: { agility: 2, strength: 0, intellect: 3, presence: 3, vigor: 1 },
      attributeIncreaseChoices: ['strength', 'strength', 'vigor'],
    })
    expect(getEffectiveAttributes(draft)).toEqual({ agility: 2, strength: 2, intellect: 3, presence: 3, vigor: 2 })
  })

  it('nunca ultrapassa o teto 5', () => {
    const draft = makeDraft({
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
      attributeIncreaseChoices: ['vigor', 'vigor', 'vigor', 'vigor', 'vigor', 'vigor'],
    })
    expect(getEffectiveAttributes(draft).vigor).toBe(5)
  })

  // F16: aumentar Vigor/Presença via Aumento de Atributo recalcula PV/PE retroativamente,
  // como se o valor novo valesse desde o NEX 5% (PV/PE máximos são derivados, pág. 36).
  it('F16: +1 Vigor (Aumento de Atributo) aumenta o PV retroativamente em todos os degraus de NEX', () => {
    const combatant = getOrdemClass('combatant')!
    const base = makeDraft({ attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 } })
    const increased = makeDraft({
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
      attributeIncreaseChoices: ['vigor'],
    })
    // NEX 20% = 4 degraus desde o 0%. Vigor 1→2: +1 no inicial e +1 por degrau = +5 PV.
    const hpBefore = deriveStats(combatant, getEffectiveAttributes(base), 20).hp
    const hpAfter = deriveStats(combatant, getEffectiveAttributes(increased), 20).hp
    expect(hpBefore).toBe(20 + 1 + 4 * (4 + 1)) // 41
    expect(hpAfter).toBe(20 + 2 + 4 * (4 + 2)) // 46
    expect(hpAfter - hpBefore).toBe(1 + 4)
  })

  it('F16: +1 Presença (Aumento de Atributo) aumenta o PE retroativamente em todos os degraus de NEX', () => {
    const occultist = getOrdemClass('occultist')!
    const increased = makeDraft({
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 2, vigor: 0 },
      attributeIncreaseChoices: ['presence'],
    })
    // NEX 50% = 10 degraus desde o 0%. Presença efetiva 3: PE = 4+3 + 10×(4+3).
    expect(deriveStats(occultist, getEffectiveAttributes(increased), 50).pe).toBe(4 + 3 + 10 * (4 + 3))
  })
})

describe('getSkillGrade', () => {
  it('perícia não treinada é destreinado', () => {
    const draft = makeDraft({ origin: 'academic' }) // science, investigation
    expect(getSkillGrade(draft, 'occultism')).toBe('destreinado')
  })

  it('perícia treinada (origem/classe) começa em treinado', () => {
    const draft = makeDraft({ origin: 'academic' })
    expect(getSkillGrade(draft, 'science')).toBe('treinado')
  })

  it('cada escolha de Grau de Treinamento sobe um grau (treinado → veterano → expert)', () => {
    const draft = makeDraft({ origin: 'academic', skillGradeChoices: [['science']] })
    expect(getSkillGrade(draft, 'science')).toBe('veterano')

    const draft2 = makeDraft({ origin: 'academic', skillGradeChoices: [['science'], ['science']] })
    expect(getSkillGrade(draft2, 'science')).toBe('expert')
  })

  it('não passa de expert mesmo com escolhas demais', () => {
    const draft = makeDraft({ origin: 'academic', skillGradeChoices: [['science'], ['science'], ['science']] })
    expect(getSkillGrade(draft, 'science')).toBe('expert')
  })
})

describe('getAvailablePowerOptions', () => {
  it('exclui poderes já escolhidos que não são repetíveis', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', powerChoices: ['heavy-weapons'] })
    const options = getAvailablePowerOptions(draft, combatant)
    expect(options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
  })

  it('mantém poderes repetíveis (Transcender, Treinamento em Perícia) mesmo já escolhidos', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', powerChoices: ['transcend'] })
    const options = getAvailablePowerOptions(draft, combatant)
    expect(options.find(p => p.id === 'transcend')).toBeDefined()
  })

  it('só lista poderes da classe (Ocultista não vê poderes de Combatente)', () => {
    const occultist = getOrdemClass('occultist')!
    const draft = makeDraft({ class: 'occultist' })
    const options = getAvailablePowerOptions(draft, occultist)
    expect(options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
    expect(options.find(p => p.id === 'create-seal')).toBeDefined()
  })

  it('com slotIndex, isenta a própria escolha do slot da exclusão (senão o slot nunca aparece marcado)', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({
      class: 'combatant',
      attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      powerChoices: ['heavy-weapons', 'heavy-blow'],
    })

    // Slot 0 (escolheu heavy-weapons): a própria escolha continua na lista dele.
    const slot0Options = getAvailablePowerOptions(draft, combatant, 0)
    expect(slot0Options.find(p => p.id === 'heavy-weapons')).toBeDefined()
    // ...mas o que o slot 1 escolheu não aparece pro slot 0.
    expect(slot0Options.find(p => p.id === 'heavy-blow')).toBeUndefined()

    // Slot 1 (escolheu heavy-blow): idem, ao contrário.
    const slot1Options = getAvailablePowerOptions(draft, combatant, 1)
    expect(slot1Options.find(p => p.id === 'heavy-blow')).toBeDefined()
    expect(slot1Options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
  })

  it('sem slotIndex (uso da Versatilidade), exclui qualquer poder já escolhido em algum slot regular', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', powerChoices: ['heavy-weapons'] })
    const options = getAvailablePowerOptions(draft, combatant)
    expect(options.find(p => p.id === 'heavy-weapons')).toBeUndefined()
  })

  it('filtra pré-requisitos de atributo, NEX, perícia e poder anterior no instante da aquisição', () => {
    const combatant = getOrdemClass('combatant')!
    const initial = makeDraft({ class: 'combatant', nex: 15 })
    const initialOptions = getAvailablePowerOptions(initial, combatant, 0)
    expect(initialOptions.find(p => p.id === 'heavy-weapons')).toBeUndefined()
    expect(initialOptions.find(p => p.id === 'heavy-armor-proficiency')).toBeUndefined()
    expect(initialOptions.find(p => p.id === 'sure-shot')).toBeUndefined()

    const at30 = makeDraft({
      class: 'combatant', nex: 30,
      attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      classChoiceGroupPicks: ['fighting', 'fortitude'],
      powerChoices: ['heavy-weapons'],
    })
    expect(getAvailablePowerOptions(at30, combatant, 1).find(p => p.id === 'heavy-armor-proficiency')).toBeDefined()

    const at45 = makeDraft({
      ...at30,
      nex: 45,
      powerChoices: ['heavy-weapons', 'heavy-armor-proficiency'],
    })
    expect(getAvailablePowerOptions(at45, combatant, 2).find(p => p.id === 'war-tank')).toBeDefined()
  })
})

describe('getAvailableTrilhaOptions / getAvailableVersatilityTrilhaOptions', () => {
  it('lista as 5 trilhas da classe', () => {
    const combatant = getOrdemClass('combatant')!
    expect(getAvailableTrilhaOptions(makeDraft({ class: 'combatant' }), combatant)).toHaveLength(5)
  })

  it('exige Medicina treinada para escolher Médico de Campo', () => {
    const specialist = getOrdemClass('specialist')!
    const withoutMedicine = makeDraft({ class: 'specialist' })
    expect(getAvailableTrilhaOptions(withoutMedicine, specialist).find(t => t.id === 'field-medic')).toBeUndefined()

    const withMedicine = makeDraft({ class: 'specialist', classFreeSkillChoices: ['medicine'] })
    expect(getAvailableTrilhaOptions(withMedicine, specialist).find(t => t.id === 'field-medic')).toBeDefined()
  })

  it('versatilidade exclui a trilha já escolhida', () => {
    const combatant = getOrdemClass('combatant')!
    const draft = makeDraft({ class: 'combatant', trilha: 'annihilator' })
    const options = getAvailableVersatilityTrilhaOptions(draft, combatant)
    expect(options).toHaveLength(4)
    expect(options.find(t => t.id === 'annihilator')).toBeUndefined()
  })
})

describe('getGrantedRituals — rituais aprendidos por feature de trilha', () => {
  it('Conduíte NEX 99% concede Canalizar o Medo, com a fonte da trilha', () => {
    const draft = makeDraft({ class: 'occultist', trilha: 'conduit', nex: 99 })
    const granted = getGrantedRituals(draft)
    expect(granted).toHaveLength(1)
    expect(granted[0].ritual.id).toBe('canalizar-o-medo')
    expect(granted[0].source).toBe('Trilha Conduíte')
  })

  it('não concede nada antes de alcançar o NEX da feature (Conduíte em NEX 95%)', () => {
    const draft = makeDraft({ class: 'occultist', trilha: 'conduit', nex: 95 })
    expect(getGrantedRituals(draft)).toHaveLength(0)
  })

  it('sem trilha (ou não-ocultista) não há rituais concedidos', () => {
    expect(getGrantedRituals(makeDraft({ class: 'occultist', trilha: null, nex: 99 }))).toHaveLength(0)
    expect(getGrantedRituals(makeDraft({ class: 'combatant', trilha: 'annihilator', nex: 99 }))).toHaveLength(0)
  })

  it('Lâmina Paranormal concede Amaldiçoar Arma já no NEX 10% e soma Lâmina do Medo no NEX 99%', () => {
    const nex10 = getGrantedRituals(makeDraft({ class: 'occultist', trilha: 'paranormal-blade', nex: 10 }))
    expect(nex10.map(g => g.ritual.id)).toEqual(['amaldicoar-arma'])

    const nex99 = getGrantedRituals(makeDraft({ class: 'occultist', trilha: 'paranormal-blade', nex: 99 }))
    expect(nex99.map(g => g.ritual.id).sort()).toEqual(['amaldicoar-arma', 'lamina-do-medo'])
  })

  it('não duplica um ritual que o jogador já escolheu manualmente', () => {
    const draft = makeDraft({ class: 'occultist', trilha: 'conduit', nex: 99, ritualChoices: ['canalizar-o-medo'] })
    expect(getGrantedRituals(draft)).toHaveLength(0)
  })

  it('Versatilidade concede o ritual da 1ª feature da outra trilha (Lâmina Maldita → Amaldiçoar Arma)', () => {
    const draft = makeDraft({
      class: 'occultist',
      trilha: 'conduit',
      nex: 50,
      versatilityChoice: { kind: 'trilha', trilhaId: 'paranormal-blade' },
    })
    const granted = getGrantedRituals(draft)
    expect(granted.map(g => g.ritual.id)).toEqual(['amaldicoar-arma'])
    expect(granted[0].source).toBe('Versatilidade')
  })
})

describe('efeitos do poder de origem (Grupo A) — stats base', () => {
  it('getOriginDefenseBonus: Patrulha (Policial) +2; origem ativa/sem efeito = 0', () => {
    expect(getOriginDefenseBonus(makeDraft({ origin: 'police-officer' }))).toBe(2)
    expect(getOriginDefenseBonus(makeDraft({ origin: 'academic' }))).toBe(0)
    expect(getOriginDefenseBonus(makeDraft({ origin: null }))).toBe(0)
  })

  it('getOriginHpBonus: Calejado (Desgarrado) soma 1 PV por degrau de NEX', () => {
    expect(getOriginHpBonus(makeDraft({ origin: 'drifter', nex: 5 }))).toBe(1)
    expect(getOriginHpBonus(makeDraft({ origin: 'drifter', nex: 50 }))).toBe(10)
    expect(getOriginHpBonus(makeDraft({ origin: 'drifter', nex: 99 }))).toBe(20)
    expect(getOriginHpBonus(makeDraft({ origin: 'academic', nex: 99 }))).toBe(0)
  })

  it('getOriginSanityBonus: Cicatrizes (Vítima) soma 1 Sanidade por degrau de NEX', () => {
    expect(getOriginSanityBonus(makeDraft({ origin: 'victim', nex: 99 }))).toBe(20)
    expect(getOriginSanityBonus(makeDraft({ origin: 'victim', nex: 10 }))).toBe(2)
  })

  it('getOriginPeBonus: Dedicação (Universitário) = +1 fixo e +1 por degrau ímpar {15,25,...,95}', () => {
    expect(getOriginPeBonus(makeDraft({ origin: 'college-student', nex: 10 }))).toBe(1) // só o fixo (15% ainda não)
    expect(getOriginPeBonus(makeDraft({ origin: 'college-student', nex: 15 }))).toBe(2) // fixo + 15%
    expect(getOriginPeBonus(makeDraft({ origin: 'college-student', nex: 25 }))).toBe(3) // fixo + 15,25
    expect(getOriginPeBonus(makeDraft({ origin: 'college-student', nex: 99 }))).toBe(10) // fixo + 9 degraus ímpares
  })

  it('getEffectivePeLimit: Dedicação soma +1 ao limite de PE por turno', () => {
    expect(getEffectivePeLimit(makeDraft({ origin: 'college-student', nex: 10 }))).toBe(3) // base 2 + 1
    expect(getEffectivePeLimit(makeDraft({ origin: 'academic', nex: 10 }))).toBe(2) // base, sem bônus
  })

  it('getCursedDerivedStats aplica os bônus de origem sobre a fórmula da classe', () => {
    const cls = getOrdemClass('combatant')!
    const attrs = { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 }
    const base = makeDraft({ origin: 'academic', nex: 99, attributes: attrs })
    const police = makeDraft({ origin: 'police-officer', nex: 99, attributes: attrs })
    const drifter = makeDraft({ origin: 'drifter', nex: 99, attributes: attrs })
    const victim = makeDraft({ origin: 'victim', nex: 99, attributes: attrs })
    const student = makeDraft({ origin: 'college-student', nex: 99, attributes: attrs })
    expect(getCursedDerivedStats(police, cls).defense - getCursedDerivedStats(base, cls).defense).toBe(2)
    expect(getCursedDerivedStats(drifter, cls).hp - getCursedDerivedStats(base, cls).hp).toBe(20)
    expect(getCursedDerivedStats(victim, cls).sanity - getCursedDerivedStats(base, cls).sanity).toBe(20)
    expect(getCursedDerivedStats(student, cls).pe - getCursedDerivedStats(base, cls).pe).toBe(10)
  })
})
