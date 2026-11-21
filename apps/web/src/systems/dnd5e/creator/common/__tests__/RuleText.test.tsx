import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RuleText } from '../RuleText'

afterEach(cleanup)

const ENHANCE_ABILITY = [
  '## Descrição',
  '',
  'Escolha um dos efeitos a seguir.',
  '',
  '**Agilidade do Gato.** O alvo tem vantagem em testes de Destreza.',
  '- **Rodada 2.** Chuva ácida cai da nuvem.',
].join('\n')

describe('RuleText', () => {
  it('desenha **trecho** como <strong>, em parágrafo e em item de lista', () => {
    const { container } = render(<RuleText text={ENHANCE_ABILITY} />)
    const strong = [...container.querySelectorAll('strong')].map(s => s.textContent)
    expect(strong).toEqual(['Agilidade do Gato.', 'Rodada 2.'])
    expect(container.textContent).not.toContain('**')
    expect(container.textContent).toContain('Agilidade do Gato. O alvo tem vantagem')
  })

  it('título de seção também aceita negrito', () => {
    const { container } = render(<RuleText text="## **Opções**" />)
    expect(container.querySelector('strong')?.textContent).toBe('Opções')
  })

  it('na prévia recolhida remove os ** sem negrito', () => {
    const { container } = render(<RuleText text={ENHANCE_ABILITY} clamp />)
    expect(container.querySelector('strong')).toBeNull()
    expect(container.textContent).toBe(
      'Escolha um dos efeitos a seguir. Agilidade do Gato. O alvo tem vantagem em testes de Destreza. • Rodada 2. Chuva ácida cai da nuvem.',
    )
  })
})
