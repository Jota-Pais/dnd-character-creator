import { describe, it, expect } from 'vitest'
import {
  getSkillsBySource,
  getExcludedSkills,
  getExcludedTools,
  getExcludedSkillsForClassSlot,
  getExcludedToolsForClassSlot,
  getAllGrantedSkills,
  getAllGrantedTools,
  getAllGrantedLanguages,
} from '../proficiencyUtils'
import { EMPTY_CLASS_CHOICES } from '../../types/class'
import { getRaceGrantedSkills, getRaceGrantedTools, getRace, getSubrace } from '../raceUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

describe('getRaceGrantedSkills / getRaceGrantedTools (raceUtils)', () => {
  it('elfo concede Percepção', () => {
    const elf = getRace('elf')!
    expect(getRaceGrantedSkills(elf, null)).toContain('perception')
  })
  it('meio-orc concede Intimidação', () => {
    const halfOrc = getRace('half-orc')!
    expect(getRaceGrantedSkills(halfOrc, null)).toContain('intimidation')
  })
  it('gnomo das rochas concede ferramentas de funileiro', () => {
    const gnome = getRace('gnome')!
    const rockGnome = getSubrace(gnome, 'rock-gnome')!
    expect(getRaceGrantedTools(gnome, rockGnome)).toContain('tinkers-tools')
  })
  it('raça sem proficiência fixa retorna vazio', () => {
    const human = getRace('human')!
    expect(getRaceGrantedSkills(human, null)).toEqual([])
  })
})

describe('getSkillsBySource', () => {
  it('agrega perícias fixas da raça + escolhas de classe + fixas do antecedente', () => {
    const d = draft({
      race: 'elf', // Percepção fixa
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'history'] },
      background: 'sage', // arcana, history (fixas)
    })
    const by = getSkillsBySource(d)
    expect(by.race).toContain('perception')
    expect(by.class).toEqual(expect.arrayContaining(['athletics', 'history']))
    expect(by.background).toEqual(expect.arrayContaining(['arcana', 'history']))
  })

  it('inclui perícias escolhidas da raça (meio-elfo) e da subclasse', () => {
    const d = draft({
      race: 'half-elf',
      raceChoices: { skills: ['stealth', 'deception'] },
      class: 'cleric',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['insight'], subclassExtras: { skills: ['arcana'] } },
    })
    const by = getSkillsBySource(d)
    expect(by.race).toEqual(expect.arrayContaining(['stealth', 'deception']))
    expect(by.class).toEqual(expect.arrayContaining(['insight', 'arcana']))
  })
})

describe('getExcludedSkills', () => {
  it('exclui do picker de classe as perícias já vindas de raça e antecedente', () => {
    const d = draft({
      race: 'elf', // perception
      class: 'ranger',
      background: 'sailor', // athletics, perception
    })
    const excluded = getExcludedSkills(d, 'class')
    expect(excluded).toContain('perception') // da raça e do antecedente
    expect(excluded).toContain('athletics') // do antecedente
  })

  it('não exclui as próprias perícias da fonte consultada', () => {
    const d = draft({
      race: 'elf',
      class: 'ranger',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['survival'] },
    })
    // ao consultar exclusões PARA a classe, a própria escolha de classe não entra
    expect(getExcludedSkills(d, 'class')).not.toContain('survival')
    // mas para a raça, a escolha de classe entra
    expect(getExcludedSkills(d, 'race')).toContain('survival')
  })
})

describe('getExcludedTools', () => {
  it('exclui ferramenta fixa da raça do picker de antecedente', () => {
    const d = draft({
      race: 'gnome',
      subrace: 'rock-gnome', // tinkers-tools
      background: 'folk-hero', // escolhe ferramenta de artesão
    })
    expect(getExcludedTools(d, 'background')).toContain('tinkers-tools')
  })
})

/**
 * Regra do livro: ao receber uma proficiência que já se possui, escolhe-se outra. Dentro da
 * própria classe isso vale entre a lista base e os extras da subclasse — e, na multiclasse,
 * entre as classes.
 */
describe('getExcludedSkillsForClassSlot', () => {
  it('a lista da classe não repete as três perícias do Colégio do Conhecimento', () => {
    const d = draft({
      class: 'bard',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        subclass: 'college-of-lore',
        subclassExtras: { skills: ['arcana', 'history', 'religion'] },
      },
    })
    const excluded = getExcludedSkillsForClassSlot(d, { classId: 'bard', part: 'base' })
    expect(excluded).toEqual(expect.arrayContaining(['arcana', 'history', 'religion']))
  })

  it('o colégio não repete o que a lista da classe já pegou', () => {
    const d = draft({
      class: 'bard',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        skills: ['deception', 'performance', 'persuasion'],
        subclass: 'college-of-lore',
      },
    })
    const excluded = getExcludedSkillsForClassSlot(d, { classId: 'bard', part: 'subclass' })
    expect(excluded).toEqual(expect.arrayContaining(['deception', 'performance', 'persuasion']))
  })

  it('nenhum slot exclui as próprias escolhas (senão não dava pra desmarcar)', () => {
    const d = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['deception'] },
    })
    expect(getExcludedSkillsForClassSlot(d, { classId: 'bard', part: 'base' })).not.toContain('deception')
  })

  it('na multiclasse, a segunda classe não repete a perícia da primeira', () => {
    const d = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['stealth'] },
      additionalClasses: [{
        classId: 'rogue',
        level: 1,
        classChoices: { ...EMPTY_CLASS_CHOICES },
        spellChoices: { cantrips: [], spells: [] },
        asiChoices: [],
        hpRolls: [],
      }],
    })
    expect(getExcludedSkillsForClassSlot(d, { classId: 'rogue', part: 'base' })).toContain('stealth')
  })
})

describe('getExcludedToolsForClassSlot', () => {
  it('a ferramenta do Estudioso da Guerra não repete a do antecedente', () => {
    const d = draft({
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'battle-master' },
      background: 'guild-artisan', // ferramenta de artesão à escolha
      backgroundChoices: { tools: ['smiths-tools'] },
    })
    expect(getExcludedToolsForClassSlot(d, { classId: 'fighter', part: 'subclass' })).toContain('smiths-tools')
  })

  it('as ferramentas concedidas pelo Assassino saem do picker do antecedente', () => {
    const d = draft({
      class: 'rogue',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'assassin' },
      background: 'charlatan',
    })
    expect(getExcludedTools(d, 'background')).toEqual(
      expect.arrayContaining(['disguise-kit', 'poisoners-kit']),
    )
  })
})

describe('getAllGrantedLanguages', () => {
  it('inclui o idioma fixo da subclasse (Dracônico da Linhagem Dracônica)', () => {
    const d = draft({
      class: 'sorcerer',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'draconic-bloodline' },
    })
    expect(getAllGrantedLanguages(d)).toContain('draconic')
  })

  it('inclui os idiomas escolhidos no Domínio do Conhecimento', () => {
    const d = draft({
      class: 'cleric',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        subclass: 'knowledge-domain',
        subclassExtras: { languages: ['elvish', 'dwarvish'] },
      },
    })
    expect(getAllGrantedLanguages(d)).toEqual(expect.arrayContaining(['elvish', 'dwarvish']))
  })
})

describe('getAllGrantedSkills / getAllGrantedTools', () => {
  it('inclui as perícias das classes adicionais da multiclasse', () => {
    const d = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['performance'] },
      additionalClasses: [{
        classId: 'rogue',
        level: 1,
        classChoices: { ...EMPTY_CLASS_CHOICES, skills: ['stealth'] },
        spellChoices: { cantrips: [], spells: [] },
        asiChoices: [],
        hpRolls: [],
      }],
    })
    expect(getAllGrantedSkills(d)).toEqual(expect.arrayContaining(['performance', 'stealth']))
  })

  it('une todas as fontes sem duplicar', () => {
    const d = draft({
      race: 'elf', // perception
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['perception', 'athletics'] },
      background: 'sailor', // athletics, perception
    })
    const all = getAllGrantedSkills(d)
    expect(all).toContain('perception')
    expect(all).toContain('athletics')
    // sem duplicatas
    expect(all.length).toBe(new Set(all).size)
  })

  it('inclui ferramenta fixa racial e ferramenta escolhida do antecedente', () => {
    const d = draft({
      race: 'gnome',
      subrace: 'rock-gnome',
      background: 'entertainer',
      backgroundChoices: { tools: ['lute'] },
    })
    const all = getAllGrantedTools(d)
    expect(all).toContain('tinkers-tools')
    expect(all).toContain('lute')
  })
})
