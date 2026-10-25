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

describe('Segredos que ocupam vaga e Adicionais (por cima) separados', () => {
  it.each([
    ['Revisão', () => render(<ReviewStep />)],
    ['ficha imprimível', () => render(<PrintableSheet />)],
  ])('%s: cada grupo com as suas magias', (_, renderIt) => {
    useCharacterStore.setState({ draft: structuredClone(loreBard10) })
    const { container } = renderIt()
    const text = container.textContent ?? ''
    // Adicionais do 6º: Bola de Fogo e Contramágica; Segredos do 10º: Revivificar e Velocidade.
    const additional = text.indexOf('Segredos Mágicos Adicionais (por cima das conhecidas)')
    const inColumns = text.indexOf('Segredos Mágicos (contam nas conhecidas)')
    expect(additional).toBeGreaterThan(-1)
    expect(inColumns).toBeGreaterThan(-1)
    const inColumnsText = text.slice(inColumns, additional)
    const additionalText = text.slice(additional, additional + 160)
    expect(inColumnsText).toContain('Revivificar (3º)')
    expect(inColumnsText).toContain('Velocidade (3º)')
    expect(inColumnsText).not.toContain('Bola de Fogo')
    expect(additionalText).toContain('Bola de Fogo (3º)')
    expect(additionalText).toContain('Contramágica (3º)')
  })
})
