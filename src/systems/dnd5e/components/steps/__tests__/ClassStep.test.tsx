import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { ClassStep } from '../ClassStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

// Decisão de 2026-10-26: a perícia de classe que outra fonte já dá (o antecedente trocado depois)
// não some ao abrir a etapa Classe — fica marcada, com o aviso, até o jogador trocar (p. 125).

function fighter(background: string): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    race: 'human',
    class: 'fighter',
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['athletics', 'perception'], fightingStyle: 'defense' },
    background,
  }
}

const skills = () => useCharacterStore.getState().draft.classChoices.skills

afterEach(() => cleanup())

describe('ClassStep: perícia repetida por outra fonte', () => {
  it('Guerreiro que trocou o Acólito pelo Marinheiro: as perícias ficam, com o aviso', () => {
    useCharacterStore.setState({ draft: fighter('sailor') })
    const { container, getByRole } = render(<ClassStep />)
    expect(skills()).toEqual(['athletics', 'perception'])
    expect(container.textContent).toContain('⚠ Atletismo já vem do antecedente Marinheiro — troque por outra perícia')
    expect(container.textContent).toContain('⚠ Percepção já vem do antecedente Marinheiro — troque por outra perícia')
    expect((getByRole('button', { name: '⚠ Percepção' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('o chip repetido desmarca e depois trava, como qualquer perícia que já se tem', () => {
    useCharacterStore.setState({ draft: fighter('sailor') })
    const { getByRole, container } = render(<ClassStep />)
    fireEvent.click(getByRole('button', { name: '⚠ Atletismo' }))
    expect(skills()).toEqual(['perception'])
    expect((getByRole('button', { name: '✓ Atletismo' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(getByRole('button', { name: 'Acrobacia' }))
    expect(skills()).toEqual(['perception', 'acrobatics'])
    expect(container.textContent).not.toContain('Atletismo já vem')
  })

  it('sem repetição, nada a avisar', () => {
    useCharacterStore.setState({ draft: fighter('acolyte') })
    const { container } = render(<ClassStep />)
    expect(container.textContent).not.toContain('já vem')
  })
})
