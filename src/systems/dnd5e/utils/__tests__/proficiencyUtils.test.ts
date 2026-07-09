import { describe, it, expect } from 'vitest'
import {
  getSkillsBySource,
  getExcludedSkills,
  getExcludedTools,
  getAllGrantedSkills,
  getAllGrantedTools,
} from '../proficiencyUtils'
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

describe('getAllGrantedSkills / getAllGrantedTools', () => {
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
