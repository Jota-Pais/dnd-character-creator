import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
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

describe('RollRecipeSheet — Normal / Vantagem / Desvantagem da mesa', () => {
  const tableButton = (name: string) =>
    within(screen.getByRole('group', { name: 'Vantagem ou desvantagem da mesa' })).getByRole('button', { name })

  it('abre em Normal; Vantagem muda o modo e o motivo, não o número', () => {
    openKrusk()
    openAthletics()
    expect(tableButton('Normal')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
    fireEvent.click(tableButton('Vantagem'))
    expect(tableButton('Vantagem')).toHaveAttribute('aria-pressed', 'true')
    expect(tableButton('Normal')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/Com vantagem: role dois d20 e fique com o maior\./)).toHaveTextContent('(Circunstância da mesa)')
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d20 + 5')
    fireEvent.click(tableButton('Normal'))
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
  })

  it('com Envenenado, a vantagem da mesa anula a desvantagem (pág. 175)', () => {
    openKrusk()
    usePlayStore.getState().run(st => addCondition(st, 'poisoned'))
    openAthletics()
    expect(screen.getByText(/Com desvantagem/)).toBeInTheDocument()
    fireEvent.click(tableButton('Vantagem'))
    expect(screen.queryByText(/Com desvantagem/)).toBeNull()
    expect(screen.getByText(/Vantagem \(Circunstância da mesa\) e desvantagem \(Envenenado\) se anulam: role um d20 só\./)).toBeInTheDocument()
    expect(screen.getByText('• Vantagem da mesa: anula a desvantagem: role um d20 só (pág. 175).')).toBeInTheDocument()
  })

  it('com os dados do app, "Rolar" usa o modo que resultou; trocar a escolha tira o resultado antigo', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    openAthletics()
    fireEvent.click(tableButton('Desvantagem'))
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const record = usePlayStore.getState().state!.rolls.at(-1)!
    expect(record.notation).toBe('2d20kl1+5')
    expect(record.terms.flatMap(t => t.dice)).toHaveLength(2)
    expect(screen.getByTestId('roll-total')).toBeInTheDocument()
    fireEvent.click(tableButton('Normal'))
    expect(screen.queryByTestId('roll-total')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(usePlayStore.getState().state!.rolls.at(-1)!.notation).toBe('1d20+5')
  })

  it('a escolha vale só para a folha aberta: reabrir volta ao Normal, e o estado de jogo não muda', () => {
    openKrusk()
    openAthletics()
    const before = usePlayStore.getState().state
    fireEvent.click(tableButton('Vantagem'))
    expect(usePlayStore.getState().state).toBe(before)
    expect(usePlayStore.getState().undoStack).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: /^Atletismo: 1d20 \+ 5/ }))
    expect(tableButton('Normal')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
  })

  it('jogada que não é d20 (dano) não tem o seletor', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Ataques' }))
    fireEvent.click(screen.getAllByRole('button', { name: /— dano:/ })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Vantagem ou desvantagem da mesa' })).toBeNull()
  })
})
