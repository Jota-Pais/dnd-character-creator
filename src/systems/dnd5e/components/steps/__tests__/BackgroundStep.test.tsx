import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BackgroundStep } from '../BackgroundStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

// O item do antecedente sem a proficiência (p. 156) só aparecia na Revisão e no PDF, embora a
// escolha que causa isso seja feita aqui.

function soldier(gamingSet: string): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    class: 'fighter',
    background: 'soldier',
    backgroundChoices: { tools: [gamingSet], items: { 'gaming-set': 'bone-dice' } },
  }
}

afterEach(() => cleanup())

describe('BackgroundStep: ferramenta do antecedente sem proficiência', () => {
  it('Soldado com proficiência em Baralho e os Dados de Osso: avisa, como na Revisão', () => {
    useCharacterStore.setState({ draft: soldier('playing-card-set') })
    const { container } = render(<BackgroundStep />)
    expect(container.textContent).toContain('Sem proficiência: Dados de Osso (Conjunto de Dados)')
  })

  it('com proficiência em Conjunto de Dados, nada a avisar', () => {
    useCharacterStore.setState({ draft: soldier('dice-set') })
    const { container } = render(<BackgroundStep />)
    expect(container.textContent).not.toContain('Sem proficiência')
  })
})
