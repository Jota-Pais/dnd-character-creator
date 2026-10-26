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

    fireEvent.click(getByText('Clérigo · SAB'))
    expect(selections()).toMatchObject({ spellClass: 'cleric', cantrips: [], spells: [] })
    expect(queryByText('Raio de Fogo')).toBeNull()
    expect(getByText('Chama Sagrada')).not.toBeNull()
  })
})
