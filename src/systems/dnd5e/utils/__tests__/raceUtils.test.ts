import { describe, it, expect } from 'vitest'
import { DRAGON_ANCESTORS } from '../dragonAncestors'
import {
  getRace,
  getSubrace,
  getEffectiveSpeed,
  getEffectiveDarkvision,
  getEffectiveAbilityBonuses,
  getAvailableInnateSpells,
  getEffectiveInnateSpells,
  isRaceStepComplete,
  getEffectiveTraits,
  getAllChoices,
  describeRaceChoice,
  getEffectiveTraitsWithChoices,
  describeInnateSpellUsage,
  RACES,
  TOOL_NAMES,
} from '../raceUtils'
import { getToolName } from '../backgroundUtils'
import toolsData from '../../data/tools.json'
import type { RaceChoiceSelections } from '../../types/character'
import type { RaceChoice } from '../../types/race'

describe('TOOL_NAMES', () => {
  it('ferramentas do gnomo das rochas têm o nome da tabela de equipamento (p. 156) em todo lugar', () => {
    expect(TOOL_NAMES['tinkers-tools']).toBe('Ferramentas de Funileiro')
    expect(getToolName('tinkers-tools')).toBe('Ferramentas de Funileiro')
  })

  it('é o nome de tools.json para toda ferramenta (não uma cópia à mão)', () => {
    for (const t of toolsData) expect(TOOL_NAMES[t.id]).toBe(getToolName(t.id))
  })
})

const dwarf = getRace('dwarf')!
const hillDwarf = getSubrace(dwarf, 'hill-dwarf')!
const mountainDwarf = getSubrace(dwarf, 'mountain-dwarf')!

const elf = getRace('elf')!
const woodElf = getSubrace(elf, 'wood-elf')!
const drow = getSubrace(elf, 'drow')!
const highElf = getSubrace(elf, 'high-elf')!

const human = getRace('human')!
const variantHuman = getSubrace(human, 'variant-human')!

const halfOrc = getRace('half-orc')!
const halfElf = getRace('half-elf')!
const tiefling = getRace('tiefling')!

describe('getRace', () => {
  it('retorna a raça correta pelo id', () => expect(dwarf.name).toBe('Anão'))
  it('retorna undefined para id inexistente', () => expect(getRace('unicorn')).toBeUndefined())
})

describe('getEffectiveSpeed', () => {
  it('retorna a velocidade base da raça quando não há sobrescrita', () =>
    expect(getEffectiveSpeed(dwarf, hillDwarf)).toBe(25))

  it('retorna 35 para Elfo da Floresta (sobrescreve os 30 do elfo)', () =>
    expect(getEffectiveSpeed(elf, woodElf)).toBe(35))

  it('retorna a velocidade base quando subrace é null', () =>
    expect(getEffectiveSpeed(elf, null)).toBe(30))
})

describe('getEffectiveDarkvision', () => {
  it('retorna 60 para elfo sem sobrescrita de subraça', () =>
    expect(getEffectiveDarkvision(elf, woodElf)).toBe(60))

  it('retorna 120 para Drow (sobrescreve os 60 do elfo)', () =>
    expect(getEffectiveDarkvision(elf, drow)).toBe(120))

  it('retorna 0 para humano sem visão no escuro', () =>
    expect(getEffectiveDarkvision(human, null)).toBe(0))
})

describe('magias inatas (Magia Drow / Legado Infernal)', () => {
  it('drow conhece globos de luz no nível 1', () => {
    const ids = getAvailableInnateSpells(elf, drow, 1).map(s => s.spellId)
    expect(ids).toEqual(['dancing-lights'])
  })
  it('drow ganha fogo das fadas no nível 3 e escuridão no 5', () => {
    expect(getAvailableInnateSpells(elf, drow, 3).map(s => s.spellId)).toEqual(['dancing-lights', 'faerie-fire'])
    expect(getAvailableInnateSpells(elf, drow, 5).map(s => s.spellId)).toEqual(['dancing-lights', 'faerie-fire', 'darkness'])
  })
  it('tiefling conhece taumaturgia no nível 1, todas com CAR', () => {
    const all = getEffectiveInnateSpells(tiefling, null)
    expect(all.map(s => s.spellId)).toEqual(['thaumaturgy', 'hellish-rebuke', 'darkness'])
    expect(all.every(s => s.ability === 'CHA')).toBe(true)
  })
  it('elfo comum (sem sub-raça inata) e alto elfo não têm magias inatas', () => {
    expect(getEffectiveInnateSpells(elf, woodElf)).toEqual([])
    expect(getEffectiveInnateSpells(elf, highElf)).toEqual([])
  })
  it('raça sem magia inata retorna vazio', () => {
    expect(getAvailableInnateSpells(human, variantHuman, 20)).toEqual([])
  })
})

describe('describeInnateSpellUsage', () => {
  const tieflingSpell = (id: string) => getEffectiveInnateSpells(tiefling, null).find(s => s.spellId === id)!

  it('truque é à vontade, sem círculo', () => {
    expect(describeInnateSpellUsage(tieflingSpell('thaumaturgy'), 0)).toEqual({ limited: false, text: 'truque, à vontade' })
  })
  it('magia de nível: uma vez por descanso longo (Magia Drow, p. 24)', () => {
    const faerieFire = getEffectiveInnateSpells(elf, drow).find(s => s.spellId === 'faerie-fire')!
    expect(describeInnateSpellUsage(faerieFire, 1)).toEqual({ limited: true, text: '1 uso por descanso longo' })
  })
  it('repreensão infernal do tiefling é conjurada como magia de 2º nível (p. 43)', () => {
    expect(describeInnateSpellUsage(tieflingSpell('hellish-rebuke'), 1).text)
      .toBe('1 uso por descanso longo, como magia de 2º nível')
    expect(describeInnateSpellUsage(tieflingSpell('darkness'), 2).text).toBe('1 uso por descanso longo')
  })
})

describe('getEffectiveAbilityBonuses', () => {
  it('mescla bônus da raça e subraça', () => {
    const bonuses = getEffectiveAbilityBonuses(dwarf, hillDwarf, {})
    expect(bonuses).toContainEqual({ ability: 'CON', value: 2 })
    expect(bonuses).toContainEqual({ ability: 'WIS', value: 1 })
  })

  it('inclui bônus de atributo escolhido pelo usuário', () => {
    const bonuses = getEffectiveAbilityBonuses(halfElf, null, {
      abilityBonuses: ['STR', 'DEX'],
    })
    expect(bonuses).toContainEqual({ ability: 'CHA', value: 2 })
    expect(bonuses).toContainEqual({ ability: 'STR', value: 1 })
    expect(bonuses).toContainEqual({ ability: 'DEX', value: 1 })
  })

  it('substitui bônus do humano base quando Variante está ativo', () => {
    const bonuses = getEffectiveAbilityBonuses(human, variantHuman, {
      abilityBonuses: ['STR', 'INT'],
    })
    const abilities = bonuses.map(b => b.ability)
    expect(abilities).not.toContain('DEX')
    expect(abilities).not.toContain('WIS')
    expect(bonuses).toContainEqual({ ability: 'STR', value: 1 })
    expect(bonuses).toContainEqual({ ability: 'INT', value: 1 })
  })

  it('inclui bônus fixos de STR e CON para anão da montanha', () => {
    const bonuses = getEffectiveAbilityBonuses(dwarf, mountainDwarf, {})
    expect(bonuses).toContainEqual({ ability: 'CON', value: 2 })
    expect(bonuses).toContainEqual({ ability: 'STR', value: 2 })
  })
})

describe('isRaceStepComplete', () => {
  it('retorna false quando nenhuma raça está selecionada', () =>
    expect(isRaceStepComplete(null, null, {})).toBe(false))

  it('retorna false quando raça tem subraças e nenhuma foi escolhida', () =>
    expect(isRaceStepComplete(dwarf, null, {})).toBe(false))

  it('retorna false quando a escolha de ferramenta do anão não foi feita', () =>
    expect(isRaceStepComplete(dwarf, hillDwarf, {})).toBe(false))

  it('retorna true quando anão da colina completo com escolha de ferramenta', () =>
    expect(isRaceStepComplete(dwarf, hillDwarf, { tools: ['smiths-tools'] })).toBe(true))

  it('retorna true para meio-orc sem subraças e sem choices', () =>
    expect(isRaceStepComplete(halfOrc, null, {})).toBe(true))

  it('retorna false quando meio-elfo não fez as escolhas de atributo', () =>
    expect(isRaceStepComplete(halfElf, null, {})).toBe(false))

  it('retorna false quando meio-elfo fez escolha parcial de atributo', () =>
    expect(isRaceStepComplete(halfElf, null, { abilityBonuses: ['STR'] })).toBe(false))

  it('retorna true quando meio-elfo completou todas as escolhas', () =>
    expect(
      isRaceStepComplete(halfElf, null, {
        abilityBonuses: ['STR', 'DEX'],
        skills: ['athletics', 'perception'],
        languages: ['goblin'],
      }),
    ).toBe(true))

  it('humano variante exige o talento escolhido', () => {
    const base: RaceChoiceSelections = { abilityBonuses: ['STR', 'DEX'], skills: ['athletics'], languages: ['elvish'] }
    expect(isRaceStepComplete(human, variantHuman, base)).toBe(false) // falta o talento
    expect(isRaceStepComplete(human, variantHuman, { ...base, feat: 'alerta' })).toBe(true)
  })

  it('humano variante com meio-talento exige o atributo do +1', () => {
    const base: RaceChoiceSelections = { abilityBonuses: ['STR', 'DEX'], skills: ['athletics'], languages: ['elvish'], feat: 'atleta' }
    expect(isRaceStepComplete(human, variantHuman, base)).toBe(false) // meio-talento sem +1
    expect(isRaceStepComplete(human, variantHuman, { ...base, featAbility: 'STR' })).toBe(true)
    expect(isRaceStepComplete(human, variantHuman, { ...base, featAbility: 'CON' })).toBe(false) // CON não é opção do Atleta
  })

  // p. 31: os traços alternativos substituem o Aumento no Valor de Habilidade e as Perícias — os
  // Idiomas (Comum + um à escolha) continuam.
  it('humano variante continua escolhendo o idioma adicional', () => {
    const complete: RaceChoiceSelections = {
      abilityBonuses: ['STR', 'DEX'], skills: ['athletics'], feat: 'alerta', languages: ['elvish'],
    }
    expect(isRaceStepComplete(human, variantHuman, complete)).toBe(true)
    expect(isRaceStepComplete(human, variantHuman, { ...complete, languages: [] })).toBe(false)
  })
})

describe('getEffectiveTraits', () => {
  it('soma os traços da raça e da sub-raça', () => {
    const names = getEffectiveTraits(dwarf, hillDwarf).map(t => t.name)
    expect(names).toEqual([...dwarf.traits, ...hillDwarf.traits].map(t => t.name))
  })

  // p. 31: os traços alternativos (Aumento no Valor de Habilidade, Perícia, Talento) substituem o
  // Aumento no Valor de Habilidade e as Perícias do humano; os Idiomas continuam.
  it('humano variante tem os três traços alternativos do livro + Idiomas, sem a Versatilidade', () => {
    const traits = getEffectiveTraits(human, variantHuman)
    expect(traits.map(t => t.name)).toEqual(['Aumento no Valor de Habilidade', 'Perícia', 'Talento', 'Idiomas'])
    expect(traits.map(t => t.choice)).toEqual(['ability', 'skill', 'feat', 'language'])
  })
})

describe('integridade dos dados: escolha da raça ↔ traço', () => {
  // A raça sozinha (ex.: humano comum) e cada sub-raça dela.
  const combos = RACES.flatMap(race => [
    { race, subrace: null, label: race.id },
    ...race.subraces.map(subrace => ({ race, subrace, label: `${race.id}/${subrace.id}` })),
  ])

  it.each(combos)('$label: cada escolha tem exatamente um traço efetivo que a abre', ({ race, subrace }) => {
    const traits = getEffectiveTraits(race, subrace)
    for (const choice of getAllChoices(race, subrace)) {
      expect(traits.filter(t => t.choice === choice.kind), choice.kind).toHaveLength(1)
    }
  })

  it.each(combos)('$label: todo traço com choice aponta para uma escolha que existe', ({ race, subrace }) => {
    const kinds = getAllChoices(race, subrace).map(c => c.kind)
    for (const t of getEffectiveTraits(race, subrace).filter(t => t.choice)) {
      expect(kinds, t.name).toContain(t.choice)
    }
  })

  // As seleções do draft são um campo por tipo (raceChoices.languages etc.): duas escolhas do mesmo
  // tipo na mesma combinação dividiriam o mesmo campo.
  it.each(combos)('$label: no máximo uma escolha por tipo', ({ race, subrace }) => {
    const kinds = getAllChoices(race, subrace).map(c => c.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
  })

  // Revisão, PDF e etapa Raça listam os traços efetivos lado a lado: dois com o mesmo nome (a Arma
  // de Sopro do draconato e a da sub-raça) apareciam como dois cabeçalhos iguais.
  it.each(combos)('$label: nenhum traço efetivo repete o nome de outro', ({ race, subrace }) => {
    const names = getEffectiveTraits(race, subrace).map(t => t.name)
    expect(new Set(names).size, names.join(', ')).toBe(names.length)
  })
})

describe('draconato: área da Arma de Sopro por ancestral (tabela Ancestral Dracônico, p. 34)', () => {
  const dragonborn = getRace('dragonborn')!
  const area = (id: string) =>
    getEffectiveTraits(dragonborn, getSubrace(dragonborn, id)!).find(t => t.name === 'Área do Sopro')?.description

  it('cone de 4,5 m: vermelho e ouro com Destreza; verde, branco e prata com Constituição', () => {
    for (const id of ['red-dragonborn', 'gold-dragonborn']) {
      expect(area(id), id).toBe('Cone de 4,5 m. Teste de resistência de Destreza.')
    }
    for (const id of ['green-dragonborn', 'white-dragonborn', 'silver-dragonborn']) {
      expect(area(id), id).toBe('Cone de 4,5 m. Teste de resistência de Constituição.')
    }
  })

  it('linha de 1,5 m por 9 m com Destreza: azul, negro, bronze, cobre e latão', () => {
    for (const id of ['blue-dragonborn', 'black-dragonborn', 'bronze-dragonborn', 'copper-dragonborn', 'brass-dragonborn']) {
      expect(area(id), id).toBe('Linha de 1,5 m por 9 m. Teste de resistência de Destreza.')
    }
  })

  it('tipo de dano de cada sub-raça vem da tabela (uma sub-raça por dragão, traços na ordem de antes)', () => {
    const damage = (id: string) =>
      getEffectiveTraits(dragonborn, getSubrace(dragonborn, id)!).find(t => t.name === 'Tipo de Dano')?.description
    expect(Object.fromEntries(dragonborn.subraces.map(s => [s.id, damage(s.id)]))).toEqual({
      'red-dragonborn': 'Fogo.', 'gold-dragonborn': 'Fogo.', 'brass-dragonborn': 'Fogo.',
      'blue-dragonborn': 'Elétrico.', 'bronze-dragonborn': 'Elétrico.',
      'green-dragonborn': 'Veneno.',
      'white-dragonborn': 'Frio.', 'silver-dragonborn': 'Frio.',
      'black-dragonborn': 'Ácido.', 'copper-dragonborn': 'Ácido.',
    })
    expect(new Set(dragonborn.subraces.map(s => s.dragonAncestor)).size).toBe(DRAGON_ANCESTORS.length)
    expect(getSubrace(dragonborn, 'red-dragonborn')!.traits.map(t => t.name)).toEqual(['Tipo de Dano', 'Área do Sopro'])
  })
})

describe('tabela Ancestral Dracônico (pp. 34 e 80)', () => {
  it('dez dragões, com o tipo de dano do livro', () => {
    expect(DRAGON_ANCESTORS.map(a => `${a.name}: ${a.damageType}`)).toEqual([
      'Azul: Elétrico', 'Branco: Frio', 'Bronze: Elétrico', 'Cobre: Ácido', 'Latão: Fogo',
      'Negro: Ácido', 'Ouro: Fogo', 'Prata: Frio', 'Verde: Veneno', 'Vermelho: Fogo',
    ])
  })
})

describe('describeRaceChoice', () => {
  const choiceOf = (kind: RaceChoice['kind'], r = human, s: typeof variantHuman | null = variantHuman) =>
    getAllChoices(r, s).find(c => c.kind === kind)!

  it('atributos: "+1 CAR, +1 SAB"', () =>
    expect(describeRaceChoice(choiceOf('ability'), { abilityBonuses: ['CHA', 'WIS'] })).toBe('+1 CAR, +1 SAB'))

  it('perícia e idioma pelo nome em português', () => {
    expect(describeRaceChoice(choiceOf('skill'), { skills: ['persuasion'] })).toBe('Persuasão')
    expect(describeRaceChoice(choiceOf('language'), { languages: ['draconic'] })).toBe('Dracônico')
  })

  it('perícias do meio-elfo: as duas, na ordem escolhida', () =>
    expect(describeRaceChoice(choiceOf('skill', halfElf, null), { skills: ['stealth', 'insight'] })).toBe('Furtividade, Intuição'))

  it('não passa do count da escolha', () =>
    expect(describeRaceChoice(choiceOf('skill'), { skills: ['persuasion', 'stealth'] })).toBe('Persuasão'))

  it('talento comum só com o nome; meio-talento com o +1 escolhido', () => {
    expect(describeRaceChoice(choiceOf('feat'), { feat: 'alerta' })).toBe('Alerta')
    expect(describeRaceChoice(choiceOf('feat'), { feat: 'ator', featAbility: 'CHA' })).toBe('Ator (+1 CAR)')
  })

  it('meio-talento com atributo fora das opções do talento não mostra o +1', () =>
    expect(describeRaceChoice(choiceOf('feat'), { feat: 'ator', featAbility: 'STR' })).toBe('Ator'))

  it('ferramenta do anão e truque do alto elfo', () => {
    expect(describeRaceChoice(choiceOf('tool', dwarf, hillDwarf), { tools: ['brewers-tools'] })).toBe('Suprimentos de Cervejeiro')
    expect(describeRaceChoice(choiceOf('cantrip', elf, highElf), { cantrip: 'minor-illusion' })).toBe('Ilusão Menor')
  })

  it('null quando nada foi escolhido', () => {
    expect(describeRaceChoice(choiceOf('ability'), {})).toBeNull()
    expect(describeRaceChoice(choiceOf('feat'), {})).toBeNull()
    expect(describeRaceChoice(choiceOf('feat'), { feat: 'nao-existe' })).toBeNull()
    expect(describeRaceChoice(choiceOf('cantrip', elf, highElf), {})).toBeNull()
  })
})

describe('getEffectiveTraitsWithChoices', () => {
  it('bardo Humano Variante: cada traço com escolha mostra o que foi escolhido', () => {
    const view = getEffectiveTraitsWithChoices(human, variantHuman, {
      abilityBonuses: ['CHA', 'WIS'], skills: ['persuasion'], languages: ['draconic'],
      feat: 'ator', featAbility: 'CHA',
    })
    expect(view.map(v => [v.trait.name, v.chosen])).toEqual([
      ['Aumento no Valor de Habilidade', '+1 CAR, +1 SAB'],
      ['Perícia', 'Persuasão'],
      ['Talento', 'Ator (+1 CAR)'],
      ['Idiomas', 'Dracônico'],
    ])
  })

  it('traço sem escolha fica com chosen null (Resiliência Anã)', () => {
    const view = getEffectiveTraitsWithChoices(dwarf, hillDwarf, { tools: ['smiths-tools'] })
    expect(view.find(v => v.trait.name === 'Resiliência Anã')?.chosen).toBeNull()
    expect(view.find(v => v.trait.name === 'Proficiência com Ferramentas')?.chosen).toBe('Ferramentas de Ferreiro')
  })

  it('humano comum mostra o idioma adicional escolhido', () => {
    const view = getEffectiveTraitsWithChoices(human, null, { languages: ['elvish'] })
    expect(view.find(v => v.trait.name === 'Idiomas')?.chosen).toBe('Élfico')
  })
})
