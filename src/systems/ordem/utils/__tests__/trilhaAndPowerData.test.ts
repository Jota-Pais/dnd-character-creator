import { describe, it, expect } from 'vitest'
import { TRILHAS, getTrilhasByClass } from '../trilhaUtils'
import { CLASS_POWERS, getPowersByClass } from '../powerUtils'
import { ORDEM_CLASSES } from '../classUtils'
import { TRILHA_FEATURE_NEX } from '../progressionUtils'

describe('TRILHAS — integridade estrutural', () => {
  it('tem 15 trilhas (5 por classe × 3 classes)', () => {
    expect(TRILHAS).toHaveLength(15)
  })

  it('cada classe tem exatamente 5 trilhas', () => {
    for (const cls of ORDEM_CLASSES) {
      expect(getTrilhasByClass(cls.id)).toHaveLength(5)
    }
  })

  it('nenhum id de trilha duplicado', () => {
    const ids = TRILHAS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('toda trilha tem exatamente 4 features, nos NEX 10/40/65/99', () => {
    for (const trilha of TRILHAS) {
      expect(trilha.features.map(f => f.nex)).toEqual(TRILHA_FEATURE_NEX)
    }
  })

  it('toda feature tem nome e descrição não vazios', () => {
    for (const trilha of TRILHAS) {
      for (const f of trilha.features) {
        expect(f.name.length).toBeGreaterThan(0)
        expect(f.description.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('CLASS_POWERS — integridade estrutural', () => {
  it('nenhum id de poder duplicado', () => {
    const ids = CLASS_POWERS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('Combatente tem 19 poderes na lista (16 exclusivos + 3 compartilhados)', () => {
    expect(getPowersByClass('combatant')).toHaveLength(19)
  })

  it('Especialista tem 15 poderes na lista (12 exclusivos + 3 compartilhados)', () => {
    expect(getPowersByClass('specialist')).toHaveLength(15)
  })

  it('Ocultista tem 16 poderes na lista (14 exclusivos + 2 compartilhados)', () => {
    expect(getPowersByClass('occultist')).toHaveLength(16)
  })

  it('Transcender e Treinamento em Perícia são compartilhados pelas 3 classes', () => {
    const transcend = CLASS_POWERS.find(p => p.id === 'transcend')!
    const skillTraining = CLASS_POWERS.find(p => p.id === 'skill-training')!
    expect(transcend.classIds.sort()).toEqual(['combatant', 'occultist', 'specialist'])
    expect(skillTraining.classIds.sort()).toEqual(['combatant', 'occultist', 'specialist'])
    expect(transcend.repeatable).toBe(true)
    expect(skillTraining.repeatable).toBe(true)
  })

  it('Artista Marcial é compartilhado só entre Combatente e Especialista (não Ocultista)', () => {
    const martialArtist = CLASS_POWERS.find(p => p.id === 'martial-artist')!
    expect(martialArtist.classIds.sort()).toEqual(['combatant', 'specialist'])
  })
})

describe('classAbility e skillGradeCount — presentes nas 3 classes', () => {
  it('toda classe tem classAbility com nome e descrição', () => {
    for (const cls of ORDEM_CLASSES) {
      expect(cls.classAbility.name.length).toBeGreaterThan(0)
      expect(cls.classAbility.description.length).toBeGreaterThan(0)
    }
  })

  it('skillGradeCount bate com o livro: Combatente 1, Especialista 5, Ocultista 3', () => {
    expect(ORDEM_CLASSES.find(c => c.id === 'combatant')!.skillGradeCount).toBe(1)
    expect(ORDEM_CLASSES.find(c => c.id === 'specialist')!.skillGradeCount).toBe(5)
    expect(ORDEM_CLASSES.find(c => c.id === 'occultist')!.skillGradeCount).toBe(3)
  })
})
