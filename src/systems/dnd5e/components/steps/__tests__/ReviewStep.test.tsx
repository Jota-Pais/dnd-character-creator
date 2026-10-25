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

describe('títulos das colunas com o total dos Segredos', () => {
  it.each([
    ['Revisão', () => render(<ReviewStep />)],
    ['ficha imprimível', () => render(<PrintableSheet />)],
  ])('%s: truques e conhecidas somam os Segredos que ocupam vaga', (_, renderIt) => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(loreBard10),
        classChoices: {
          ...structuredClone(loreBard10.classChoices),
          subclass: 'college-of-valor',
          progressionChoices: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] },
        },
        spellChoices: { cantrips: ['friends', 'mending', 'true-strike'], spells: ['charm-person', 'sleep'] },
      },
    })
    const text = renderIt().container.textContent ?? ''
    expect(text).toContain('Truques (3 + 1 de Segredos Mágicos = 4)')
    expect(text).toContain('Conhecidas (2 + 1 de Segredos Mágicos = 3)')
  })
})

// Aura de Proteção (p. 111): fora do número das resistências, numa linha com a condição, na
// Revisão e no PDF. Paladino 6 com CAR 16 (+3): Sabedoria 12 segue +1 + proficiência 3 = +4.
describe('Aura de Proteção junto das resistências', () => {
  const paladin6: CharacterDraft = {
    ...structuredClone(EMPTY_DRAFT),
    name: 'Tor',
    race: 'human', class: 'paladin', level: 6,
    abilityScores: { STR: 15, DEX: 10, CON: 13, INT: 8, WIS: 11, CHA: 15 },
  }
  it.each([
    ['Revisão', () => render(<ReviewStep />)],
    ['ficha imprimível', () => render(<PrintableSheet />)],
  ])('%s: linha com a condição', (_, renderIt) => {
    useCharacterStore.setState({ draft: structuredClone(paladin6) })
    const text = renderIt().container.textContent ?? ''
    expect(text).toContain(
      '+3 em todos os testes de resistência (Aura de Proteção: você e criaturas amigáveis a até 3 m, enquanto você estiver consciente; mínimo +1)',
    )
  })
})

describe('Magia repetida entre fontes na Revisão e no PDF', () => {
  const highElfWizard: CharacterDraft = {
    ...structuredClone(EMPTY_DRAFT),
    name: 'Elandor',
    race: 'elf', subrace: 'high-elf', class: 'wizard', level: 1,
    raceChoices: { cantrip: 'fire-bolt' },
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    spellChoices: { cantrips: ['fire-bolt', 'light', 'mage-hand'], spells: ['magic-missile'] },
  }

  it.each([
    ['Revisão', () => render(<ReviewStep />)],
    ['ficha imprimível', () => render(<PrintableSheet />)],
  ])('%s: avisa onde a magia aparece', (_, renderIt) => {
    useCharacterStore.setState({ draft: structuredClone(highElfWizard) })
    const { container } = renderIt()
    expect(container.textContent).toMatch(/Raio de Fogo aparece em Mago e .+ \(raça\)\. Repetir não é proibido/)
  })
})
