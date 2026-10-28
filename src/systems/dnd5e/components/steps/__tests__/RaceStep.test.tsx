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

// Decisão de 2026-10-26: escolha de 1 é rádio — outra opção troca a marcada direto; a de N para
// no limite.
describe('RaceStep: escolha de 1 troca direto', () => {
  it('Humano Variante: outra perícia e outro idioma trocam os marcados', () => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(EMPTY_DRAFT),
        race: 'human', subrace: 'variant-human',
        raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['stealth'], languages: ['dwarvish'] },
      },
    })
    const { getByRole } = render(<RaceStep />)
    const choices = () => useCharacterStore.getState().draft.raceChoices

    expect((getByRole('button', { name: 'Acrobacia' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByRole('button', { name: 'Acrobacia' }))
    expect(choices().skills).toEqual(['acrobatics'])

    fireEvent.click(getByRole('button', { name: 'Élfico' }))
    expect(choices().languages).toEqual(['elvish'])

    // Os dois atributos (+1 cada) são escolha de 2: cheia, o terceiro trava.
    expect((getByRole('button', { name: 'CON' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
