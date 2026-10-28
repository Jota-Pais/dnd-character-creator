import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { RaceStep } from '../RaceStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

// Mesmo padrão da etapa Classe: a perícia escolhida na raça que o antecedente trocado depois já dá
// não some ao abrir a etapa — fica marcada, com o aviso, até o jogador trocar (p. 125).

function halfElf(background: string): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    race: 'half-elf',
    raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight', 'stealth'], languages: ['dwarvish'] },
    background,
  }
}

const skills = () => useCharacterStore.getState().draft.raceChoices.skills

afterEach(() => cleanup())

describe('RaceStep: perícia repetida por outra fonte', () => {
  it('Meio-Elfo com Intuição que passou a Acólito: a escolha fica, com o aviso, e desmarca', () => {
    useCharacterStore.setState({ draft: halfElf('acolyte') })
    const { container, getByRole } = render(<RaceStep />)
    expect(skills()).toEqual(['insight', 'stealth'])
    expect(container.textContent).toContain('⚠ Intuição já vem do antecedente Acólito — troque por outra perícia')
    fireEvent.click(getByRole('button', { name: '⚠ Intuição' }))
    expect(skills()).toEqual(['stealth'])
    expect((getByRole('button', { name: '✓ Intuição' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sem repetição, nada a avisar', () => {
    useCharacterStore.setState({ draft: halfElf('sailor') })
    const { container } = render(<RaceStep />)
    expect(container.textContent).not.toContain('já vem')
  })
})
