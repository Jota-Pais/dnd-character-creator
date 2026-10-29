import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { WealthRoller } from '../EquipmentStep'
import { sequenceRoller } from '../../../../../core/dice'

afterEach(() => cleanup())

describe('WealthRoller: ouro inicial rolado pelo motor de dados', () => {
  function renderRoller(faces: number[]) {
    const onChange = vi.fn()
    render(
      <WealthRoller
        wealthDice="5d4"
        wealthMultiplier={10}
        wealthUnit="po"
        storedGold={null}
        accent="#c0961a"
        onChange={onChange}
        roller={sequenceRoller(faces)}
      />,
    )
    return onChange
  }

  it('"Rolar Todos" sorteia os cinco d4 e grava a soma × 10', () => {
    const onChange = renderRoller([1, 2, 3, 4, 4])
    fireEvent.click(screen.getByText('🎲 Rolar Todos'))
    expect(onChange).toHaveBeenLastCalledWith(140)
    expect(screen.getByText('140 po')).toBeInTheDocument()
  })

  it('o 🎲 de um dado sorteia só aquele dado', () => {
    const onChange = renderRoller([1, 1, 1, 1, 1, 4])
    fireEvent.click(screen.getByText('🎲 Rolar Todos'))
    expect(onChange).toHaveBeenLastCalledWith(50)
    fireEvent.click(screen.getAllByTitle('Rolar este dado')[2])
    expect(onChange).toHaveBeenLastCalledWith(80)
  })
})
