import { describe, it, expect } from 'vitest'
import { PATENTES, getPatente, getCategoryLimit, isValidPatente } from '../patenteUtils'

describe('patenteUtils', () => {
  it('tem as 5 patentes da Tabela 3.1', () => {
    expect(PATENTES.map(p => p.id)).toEqual([
      'recruta', 'operador', 'agente-especial', 'oficial-operacoes', 'agente-elite',
    ])
  })

  it('getCategoryLimit segue a Tabela 3.1 (Cat 0 ilimitada)', () => {
    const recruta = getPatente('recruta')
    expect(getCategoryLimit(recruta, 0)).toBe(Infinity)
    expect(getCategoryLimit(recruta, 1)).toBe(2)
    expect(getCategoryLimit(recruta, 2)).toBe(0)

    const operador = getPatente('operador')
    expect(getCategoryLimit(operador, 1)).toBe(3)
    expect(getCategoryLimit(operador, 2)).toBe(1)
    expect(getCategoryLimit(operador, 3)).toBe(0)

    const elite = getPatente('agente-elite')
    expect(getCategoryLimit(elite, 1)).toBe(3)
    expect(getCategoryLimit(elite, 2)).toBe(3)
    expect(getCategoryLimit(elite, 3)).toBe(3)
    expect(getCategoryLimit(elite, 4)).toBe(2)
  })

  it('getPatente com id inválido cai em Recruta', () => {
    // @ts-expect-error id inválido de propósito
    expect(getPatente('inexistente').id).toBe('recruta')
  })

  it('isValidPatente valida os ids', () => {
    expect(isValidPatente('operador')).toBe(true)
    expect(isValidPatente('xyz')).toBe(false)
    expect(isValidPatente(42)).toBe(false)
  })
})
