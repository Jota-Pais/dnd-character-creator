import { describe, it, expect } from 'vitest'
import { parseInlineBold, stripInlineBold } from '../ruleText'

describe('parseInlineBold', () => {
  it('linha sem marcação vira um trecho comum', () => {
    expect(parseInlineBold('O alvo tem vantagem.')).toEqual([{ text: 'O alvo tem vantagem.', bold: false }])
  })

  it('abre a opção da magia em negrito (Aprimorar Habilidade)', () => {
    expect(parseInlineBold('**Agilidade do Gato.** O alvo tem vantagem em testes de Destreza.')).toEqual([
      { text: 'Agilidade do Gato.', bold: true },
      { text: ' O alvo tem vantagem em testes de Destreza.', bold: false },
    ])
  })

  it('aceita vários pares e texto antes do primeiro (Spray Prismático numerado)', () => {
    expect(parseInlineBold('1. **Vermelho.** fogo e **2.** mais')).toEqual([
      { text: '1. ', bold: false },
      { text: 'Vermelho.', bold: true },
      { text: ' fogo e ', bold: false },
      { text: '2.', bold: true },
      { text: ' mais', bold: false },
    ])
  })

  it('linha inteira em negrito (subtítulo de tabela)', () => {
    expect(parseInlineBold('**ESTATÍSTICAS DE OBJETO ANIMADO**')).toEqual([
      { text: 'ESTATÍSTICAS DE OBJETO ANIMADO', bold: true },
    ])
  })

  it('** sem par fica literal', () => {
    expect(parseInlineBold('texto **solto')).toEqual([{ text: 'texto **solto', bold: false }])
  })
})

describe('stripInlineBold', () => {
  it('remove os pares e mantém o texto', () => {
    expect(stripInlineBold('**Força do Touro.** carga dobrada; **Vigor do Urso.** 2d6')).toBe(
      'Força do Touro. carga dobrada; Vigor do Urso. 2d6',
    )
  })

  it('não mexe em ** sem par', () => {
    expect(stripInlineBold('a ** b')).toBe('a ** b')
  })
})
