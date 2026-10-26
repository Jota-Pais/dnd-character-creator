import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { addCondition, setInspiration } from '../../../utils/playState'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

function openAthletics() {
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('button', { name: /^Atletismo: 1d20 \+ 5/ }))
}

describe('RollRecipeSheet — usar a Inspiração', () => {
  it('sem Inspiração, não há o botão', () => {
    openKrusk()
    openAthletics()
    expect(screen.queryByRole('button', { name: /Usar inspiração/ })).toBeNull()
  })

  it('gastar dá vantagem na folha, apaga a estrela e pode ser devolvido', () => {
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    expect(usePlayStore.getState().state!.inspiration).toBe(false)
    expect(screen.getByText(/Com vantagem: role dois d20 e fique com o maior\./)).toBeInTheDocument()
    expect(screen.getByText('• Inspiração gasta: role com vantagem (pág. 127).')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Usar inspiração/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Devolver a inspiração' }))
    expect(usePlayStore.getState().state!.inspiration).toBe(true)
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
    expect(screen.getByRole('button', { name: /Usar inspiração/ })).toBeInTheDocument()
  })

  it('com desvantagem, gastar anula e a folha diz que é um d20 só', () => {
    openKrusk()
    usePlayStore.getState().run(st => addCondition(st, 'poisoned'))
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    expect(screen.getByText(/Com desvantagem/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    expect(screen.queryByText(/Com desvantagem/)).toBeNull()
    expect(screen.getByText(/se anulam: role um d20 só/)).toBeInTheDocument()
  })

  it('com os dados do app, o "Rolar" depois do gasto rola dois d20', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const record = usePlayStore.getState().state!.rolls.at(-1)!
    expect(record.terms.flatMap(t => t.dice)).toHaveLength(2)
  })

  it('depois de outra ação, o "devolver" some (o desfazer geral continua valendo)', () => {
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Devolver a inspiração' }))
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    act(() => { usePlayStore.getState().run(st => addCondition(st, 'prone')) })
    expect(screen.queryByRole('button', { name: 'Devolver a inspiração' })).toBeNull()
  })
})
