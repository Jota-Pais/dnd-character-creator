import { describe, it, expect } from 'vitest'
import { FEATS, getFeat, getAllFeats, isHalfFeat } from '../featUtils'

describe('feats.json', () => {
  it('tem os 42 talentos do PHB 2014', () => {
    expect(FEATS.length).toBe(42)
  })
  it('nenhum talento tem campos essenciais vazios', () => {
    for (const f of FEATS) {
      expect(f.id).toBeTruthy()
      expect(f.name).toBeTruthy()
      expect(f.description.length).toBeGreaterThan(20)
    }
  })
  it('ids são únicos', () => {
    expect(new Set(FEATS.map(f => f.id)).size).toBe(FEATS.length)
  })
})

describe('getFeat / getAllFeats', () => {
  it('busca por id', () => {
    expect(getFeat('sortudo')?.name).toBe('Sortudo')
    expect(getFeat('inexistente')).toBeUndefined()
  })
  it('getAllFeats vem ordenado alfabeticamente', () => {
    const names = getAllFeats().map(f => f.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })
})

describe('meio-talentos (abilityIncrease)', () => {
  it('há 13 meio-talentos', () => {
    expect(FEATS.filter(f => f.abilityIncrease && f.abilityIncrease.length > 0).length).toBe(13)
  })
  it('Atleta permite +1 em Força ou Destreza', () => {
    expect(getFeat('atleta')?.abilityIncrease).toEqual(['STR', 'DEX'])
  })
  it('Resistente dá +1 em Constituição', () => {
    expect(getFeat('resistente')?.abilityIncrease).toEqual(['CON'])
  })
  it('Resiliente permite escolher qualquer atributo', () => {
    expect(getFeat('resiliente')?.abilityIncrease?.length).toBe(6)
  })
  it('Alerta não é meio-talento', () => {
    expect(isHalfFeat('alerta')).toBe(false)
  })
})
