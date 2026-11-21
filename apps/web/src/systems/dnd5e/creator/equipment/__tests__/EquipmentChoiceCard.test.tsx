import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { EquipmentChoiceCard } from '../EquipmentChoiceCard'
import { getClass } from '@rpg/rules/systems/dnd5e/utils/classUtils'

afterEach(cleanup)

// Escolha C do bardo: (a) alaúde ou (b) qualquer instrumento musical (p. 53).
const instrumentChoice = getClass('bard')!.startingEquipment.choices[2]

describe('EquipmentChoiceCard — instrumentos do bardo', () => {
  it('alaúde sem proficiência ganha a nota da p. 156, com o foco da p. 53', () => {
    const { getByText } = render(
      <EquipmentChoiceCard
        choiceIndex={2} choice={instrumentChoice} resolution={undefined} onResolve={() => {}}
        proficientToolIds={['flute', 'lyre', 'drum']} instrumentFocus
      />,
    )
    expect(getByText(/Alaúde: sem proficiência — pode usar, mas não soma o bônus de proficiência nos testes com ele; continua servindo de foco de conjuração/)).not.toBeNull()
  })

  it('quem domina o alaúde não vê a nota', () => {
    const { queryByText } = render(
      <EquipmentChoiceCard
        choiceIndex={2} choice={instrumentChoice} resolution={undefined} onResolve={() => {}}
        proficientToolIds={['lute', 'lyre', 'drum']} instrumentFocus
      />,
    )
    expect(queryByText(/sem proficiência/)).toBeNull()
  })

  it('no seletor, os instrumentos dominados vêm primeiro com selo, e nada é pré-selecionado', () => {
    const onResolve = vi.fn()
    const { getAllByRole } = render(
      <EquipmentChoiceCard
        choiceIndex={2} choice={instrumentChoice} resolution={{ optionIndex: 1, pickedIds: [] }} onResolve={onResolve}
        proficientToolIds={['flute', 'lyre', 'drum']} instrumentFocus
      />,
    )
    // Os 2 primeiros botões são as opções (a)/(b); depois vem a grade de instrumentos.
    const grid = getAllByRole('button').slice(2)
    const firstThree = grid.slice(0, 3).map(b => b.textContent)
    expect(firstThree).toEqual([
      'Flauta✓ você é proficiente', 'Lira✓ você é proficiente', 'Tambor✓ você é proficiente',
    ])
    expect(grid.slice(3).some(b => b.textContent?.includes('proficiente'))).toBe(false)
    expect(onResolve).not.toHaveBeenCalled()
  })
})
