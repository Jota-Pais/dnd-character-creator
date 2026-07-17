import { describe, it, expect } from 'vitest'
import { meetsPrereq, getUnmetPrereqs, formatUnmetPrereq, type PrereqContext } from '../prereqUtils'
import type { OrdemPowerPrereq } from '../../types/prereq'

function makeCtx(overrides: Partial<PrereqContext> = {}): PrereqContext {
  return {
    attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
    acquisitionNex: 15,
    trainedSkills: [],
    hasClassPower: () => false,
    getClassPowerElement: () => null,
    elementCounts: {},
    ...overrides,
  }
}

describe('meetsPrereq', () => {
  it('attribute: compara com o atributo efetivo', () => {
    const prereq: OrdemPowerPrereq = { kind: 'attribute', attribute: 'strength', min: 2 }
    expect(meetsPrereq(prereq, makeCtx())).toBe(false)
    expect(meetsPrereq(prereq, makeCtx({ attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 } }))).toBe(true)
  })

  it('nex: compara com o NEX de AQUISIÇÃO da instância, não o NEX final', () => {
    const prereq: OrdemPowerPrereq = { kind: 'nex', min: 30 }
    expect(meetsPrereq(prereq, makeCtx({ acquisitionNex: 15 }))).toBe(false)
    expect(meetsPrereq(prereq, makeCtx({ acquisitionNex: 30 }))).toBe(true)
  })

  it('trainedSkill: anyOf é um OU ("treinado em Luta ou Pontaria")', () => {
    const prereq: OrdemPowerPrereq = { kind: 'trainedSkill', anyOf: ['fighting', 'aim'] }
    expect(meetsPrereq(prereq, makeCtx({ trainedSkills: ['aim'] }))).toBe(true)
    expect(meetsPrereq(prereq, makeCtx({ trainedSkills: ['stealth'] }))).toBe(false)
  })

  it('duas entradas trainedSkill são um E ("Percepção e Tática")', () => {
    const prereqs: OrdemPowerPrereq[] = [
      { kind: 'trainedSkill', anyOf: ['perception'] },
      { kind: 'trainedSkill', anyOf: ['tactics'] },
    ]
    expect(getUnmetPrereqs(prereqs, makeCtx({ trainedSkills: ['perception'] }))).toHaveLength(1)
    expect(getUnmetPrereqs(prereqs, makeCtx({ trainedSkills: ['perception', 'tactics'] }))).toHaveLength(0)
  })

  it('classPower: exige possuir o poder', () => {
    const prereq: OrdemPowerPrereq = { kind: 'classPower', powerId: 'heavy-armor-proficiency' }
    expect(meetsPrereq(prereq, makeCtx())).toBe(false)
    expect(meetsPrereq(prereq, makeCtx({ hasClassPower: id => id === 'heavy-armor-proficiency' }))).toBe(true)
  })

  it('classPower com sameElementParam: os elementos precisam coincidir (Mestre em Elemento)', () => {
    const prereq: OrdemPowerPrereq = { kind: 'classPower', powerId: 'element-specialist', sameElementParam: true }
    const base = { hasClassPower: (id: string) => id === 'element-specialist' }
    expect(meetsPrereq(prereq, makeCtx({ ...base, getClassPowerElement: () => 'blood', chosenElement: 'blood' }))).toBe(true)
    expect(meetsPrereq(prereq, makeCtx({ ...base, getClassPowerElement: () => 'blood', chosenElement: 'death' }))).toBe(false)
    expect(meetsPrereq(prereq, makeCtx({ ...base, getClassPowerElement: () => null, chosenElement: 'blood' }))).toBe(false)
  })

  it('elementCount: exige N poderes do elemento ANTES da instância', () => {
    const prereq: OrdemPowerPrereq = { kind: 'elementCount', element: 'death', count: 2 }
    expect(meetsPrereq(prereq, makeCtx({ elementCounts: { death: 1 } }))).toBe(false)
    expect(meetsPrereq(prereq, makeCtx({ elementCounts: { death: 2 } }))).toBe(true)
  })
})

describe('formatUnmetPrereq — mensagens pt-BR', () => {
  it('gera motivo legível para cada kind', () => {
    const ctx = makeCtx({ elementCounts: { death: 1 } })
    expect(formatUnmetPrereq({ kind: 'attribute', attribute: 'strength', min: 2 }, ctx)).toBe('Requer Força 2 (você tem 1)')
    expect(formatUnmetPrereq({ kind: 'nex', min: 30 }, ctx)).toBe('Requer NEX 30% (esta escolha é feita em NEX 15%)')
    expect(formatUnmetPrereq({ kind: 'trainedSkill', anyOf: ['fighting', 'aim'] }, ctx)).toBe('Requer treino em Luta ou Pontaria')
    expect(formatUnmetPrereq({ kind: 'classPower', powerId: 'heavy-armor-proficiency' }, ctx)).toBe('Requer o poder Proteção Pesada')
    expect(formatUnmetPrereq({ kind: 'classPower', powerId: 'element-specialist', sameElementParam: true }, ctx)).toBe('Requer Especialista em Elemento no mesmo elemento')
    expect(formatUnmetPrereq({ kind: 'elementCount', element: 'death', count: 2 }, ctx)).toBe('Requer Morte 2 (você tem 1 poder(es) de Morte antes deste)')
  })
})
