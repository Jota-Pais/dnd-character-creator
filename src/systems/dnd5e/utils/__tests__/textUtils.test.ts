import { describe, it, expect } from 'vitest'
import { countLabel, pluralize } from '../textUtils'

describe('textUtils', () => {
  it('singular só com exatamente 1', () => {
    expect(pluralize(1, 'disponível', 'disponíveis')).toBe('disponível')
    expect(pluralize(0, 'disponível', 'disponíveis')).toBe('disponíveis')
    expect(pluralize(2, 'disponível', 'disponíveis')).toBe('disponíveis')
  })

  it('número com a palavra concordando', () => {
    expect(countLabel(1, 'Dado de Vida', 'Dados de Vida')).toBe('1 Dado de Vida')
    expect(countLabel(3, 'espaço de Pacto', 'espaços de Pacto')).toBe('3 espaços de Pacto')
  })
})
