import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CustomPanel } from '../CustomPanel'
import type { AbilityScore } from '../../../types/race'

const scores = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
const noBonus = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } as Record<AbilityScore, number>

afterEach(cleanup)

describe('CustomPanel', () => {
  it('renderiza um input por atributo (6) sem quebrar', () => {
    render(<CustomPanel scores={scores} racialBonuses={noBonus} onScoreChange={vi.fn()} />)
    expect(screen.getByText(/Digite o valor de cada atributo/)).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(6)
  })

  it('comita o valor limitado a 18 ao sair do campo', () => {
    const onScoreChange = vi.fn()
    render(<CustomPanel scores={scores} racialBonuses={noBonus} onScoreChange={onScoreChange} />)
    const first = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(first, { target: { value: '25' } })
    fireEvent.blur(first)
    expect(onScoreChange).toHaveBeenCalledWith('STR', 18) // limitado ao máximo
  })

  it('o botão + respeita o teto 18', () => {
    const onScoreChange = vi.fn()
    render(<CustomPanel scores={{ ...scores, STR: 18 }} racialBonuses={noBonus} onScoreChange={onScoreChange} />)
    const plus = screen.getAllByText('+')[0]
    fireEvent.click(plus)
    expect(onScoreChange).not.toHaveBeenCalled() // já está em 18, não sobe
  })
})
