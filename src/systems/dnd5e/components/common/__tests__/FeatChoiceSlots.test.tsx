import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { FeatChoiceSlots } from '../FeatChoiceSlots'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

afterEach(cleanup)

const FEAT = 'iniciado-em-magia'

/** Guerreiro 4 com o Iniciado em Magia no espaço de ASI. */
const fighter: CharacterDraft = {
  ...structuredClone(EMPTY_DRAFT),
  class: 'fighter', level: 4,
  asiChoices: [{ kind: 'feat', featId: FEAT }],
}

function selections() {
  return useCharacterStore.getState().draft.featSelections[FEAT]
}

describe('FeatChoiceSlots — Iniciado em Magia', () => {
  it('classe → truques → magia; trocar a classe limpa o que era da lista antiga', () => {
    useCharacterStore.setState({ draft: structuredClone(fighter) })
    const { getByText, queryByText } = render(<FeatChoiceSlots accent="#fff" featIds={[FEAT]} />)

    // Antes da classe, só a classe aparece (com o atributo de conjuração).
    expect(queryByText(/^Truques/)).toBeNull()
    fireEvent.click(getByText('Mago · INT'))
    expect(selections()).toMatchObject({ spellClass: 'wizard', cantrips: [], spells: [] })

    fireEvent.click(getByText('Raio de Fogo'))
    fireEvent.click(getByText('Luz'))
    fireEvent.click(getByText('Sono'))
    expect(selections()).toMatchObject({ cantrips: ['fire-bolt', 'light'], spells: ['sleep'] })
    expect(getByText('Truques (2/2)')).not.toBeNull()
    expect(getByText('Magia de 1º nível (1/1)')).not.toBeNull()

    // Cheio: o terceiro truque não entra.
    fireEvent.click(getByText('Mãos Mágicas'))
    expect(selections()?.cantrips).toEqual(['fire-bolt', 'light'])

    // A magia de 1º é escolha de 1: outra troca direto, sem desmarcar antes (decisão de 2026-10-26).
    expect((getByText('Mísseis Mágicos').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByText('Mísseis Mágicos'))
    expect(selections()?.spells).toEqual(['magic-missile'])
    expect(selections()?.cantrips).toEqual(['fire-bolt', 'light'])

    fireEvent.click(getByText('Clérigo · SAB'))
    expect(selections()).toMatchObject({ spellClass: 'cleric', cantrips: [], spells: [] })
    expect(queryByText('Raio de Fogo')).toBeNull()
    expect(getByText('Chama Sagrada')).not.toBeNull()
  })
})

describe('FeatChoiceSlots — Perito com perícia que outra fonte já dá (p. 125)', () => {
  it('a perícia repetida fica marcada, com o aviso, e desmarca para trocar', () => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(EMPTY_DRAFT),
        class: 'fighter', level: 4, background: 'sailor',
        asiChoices: [{ kind: 'feat', featId: 'perito' }],
        featSelections: { perito: { skills: ['athletics', 'stealth', 'arcana'] } },
      },
    })
    const { container, getByRole } = render(<FeatChoiceSlots accent="#fff" featIds={['perito']} />)
    expect(container.textContent).toContain('⚠ Atletismo já vem do antecedente Marinheiro — troque por outra perícia ou ferramenta')
    fireEvent.click(getByRole('button', { name: '⚠ Atletismo' }))
    expect(useCharacterStore.getState().draft.featSelections.perito?.skills).toEqual(['stealth', 'arcana'])
    expect(container.textContent).not.toContain('Atletismo já vem')
  })
})
