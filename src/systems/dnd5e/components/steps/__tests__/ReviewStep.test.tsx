import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReviewStep } from '../ReviewStep'
import { PrintableSheet } from '../../PrintableSheet'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

afterEach(() => cleanup())

// Segredos Mágicos são magias de bardo (p. 54-55): a Revisão mostra junto das magias do bardo,
// como a ficha imprimível — e não nas Escolhas de Progressão com o texto cru da lista de opções.
const loreBard10: CharacterDraft = {
  ...structuredClone(EMPTY_DRAFT),
  name: 'Lira',
  race: 'human', class: 'bard', level: 10,
  abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 16 },
  classChoices: {
    ...structuredClone(EMPTY_DRAFT.classChoices),
    subclass: 'college-of-lore',
    progressionChoices: {
      'lore-magical-secrets-6': ['fireball', 'counterspell'],
      'bard-magical-secrets-10': ['revivify', 'haste'],
    },
  },
}

describe('Segredos Mágicos na Revisão e no PDF', () => {
  it.each([
    ['Revisão', () => render(<ReviewStep />)],
    ['ficha imprimível', () => render(<PrintableSheet />)],
  ])('%s: na seção de magias do bardo, sem o texto cru da lista', (_, renderIt) => {
    useCharacterStore.setState({ draft: structuredClone(loreBard10) })
    const { container } = renderIt()
    const text = container.textContent ?? ''
    expect(text).toContain('Segredos Mágicos')
    expect(text).toContain('Bola de Fogo (3')
    expect(text).not.toContain('sorcerer, wizard')
  })
})
