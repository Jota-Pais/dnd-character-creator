import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { roll, sequenceRoller } from '../../../../../core/dice'
import { applyDamage, recordRoll, startConcentration } from '../../../utils/playState'
import { loadPlayState } from '../../../utils/playStorage'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const playState = () => usePlayStore.getState().state!

function openNotes() {
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Notas' }))
}

describe('NotesTab', () => {
  it('grava a anotação numa pausa da digitação, sem um passo do desfazer por letra', () => {
    vi.useFakeTimers()
    openKrusk()
    openNotes()
    const field = screen.getByLabelText('Anotações da sessão')
    fireEvent.change(field, { target: { value: 'O' } })
    fireEvent.change(field, { target: { value: 'O ferreiro' } })
    expect(playState().note).toBe('')
    expect(field).toHaveValue('O ferreiro')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(playState().note).toBe('O ferreiro')
    expect(usePlayStore.getState().undoStack).toHaveLength(1)
  })

  it('sair do campo grava na hora', () => {
    openKrusk()
    openNotes()
    const field = screen.getByLabelText('Anotações da sessão')
    fireEvent.change(field, { target: { value: 'Dever 10 PO ao taverneiro' } })
    fireEvent.blur(field)
    expect(playState().note).toBe('Dever 10 PO ao taverneiro')
  })

  it('sair do jogo sem tirar o foco do campo grava a nota', () => {
    const id = openKrusk()
    openNotes()
    fireEvent.change(screen.getByLabelText('Anotações da sessão'), { target: { value: 'O ferreiro mentiu' } })
    fireEvent.click(screen.getByText('← Personagens'))
    expect(usePlayStore.getState().state).toBeNull()
    expect(loadPlayState(id)?.note).toBe('O ferreiro mentiu')
  })

  it('a página sumir (trocar de app, fechar a aba) grava a nota na hora', () => {
    openKrusk()
    openNotes()
    const field = screen.getByLabelText('Anotações da sessão')
    fireEvent.change(field, { target: { value: 'Pista: o selo do duque' } })
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    visibility.mockRestore()
    expect(playState().note).toBe('Pista: o selo do duque')

    fireEvent.change(field, { target: { value: 'Pista: o selo do conde' } })
    fireEvent(window, new Event('pagehide'))
    expect(playState().note).toBe('Pista: o selo do conde')
  })

  it('o autosave da nota não apaga o aviso da última ação', () => {
    openKrusk()
    usePlayStore.getState().run(st => startConcentration(st, { label: 'Bênção' }, 0))
    usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: 10 }))
    openNotes()
    const field = screen.getByLabelText('Anotações da sessão')
    fireEvent.change(field, { target: { value: 'Ogro na ponte' } })
    fireEvent.blur(field)
    expect(playState().note).toBe('Ogro na ponte')
    expect(screen.getByRole('status')).toHaveTextContent('CD 10')
  })

  it('histórico só com os dados do app, mais recente primeiro, 20 natural em destaque', () => {
    openKrusk()
    const run = usePlayStore.getState().run
    run(st => recordRoll(st, roll('1d20+5', { label: 'Atletismo', roller: sequenceRoller([20]), at: 1 })))
    run(st => recordRoll(st, roll('1d12+3', { label: 'Machado Grande — dano', roller: sequenceRoller([4]), at: 2 })))
    openNotes()
    expect(screen.queryByText('Rolagens recentes')).toBeNull()
    cleanup()

    usePlayStore.getState().setAppDice(true)
    openNotes()
    const items = within(screen.getByTestId('roll-history')).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Machado Grande — dano')
    expect(items[0]).toHaveTextContent('7')
    expect(items[1]).toHaveTextContent('Atletismo')
    expect(items[1]).toHaveTextContent('20 natural')
    expect(items[1]).toHaveTextContent('25')
  })

  it('vários d20 que valem todos (rolador livre) não viram "20 natural" no histórico', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    usePlayStore.getState().logRoll(roll('3d20', { label: 'Rolagem livre: 3d20', roller: sequenceRoller([20, 5, 7]), at: 1 }))
    openNotes()
    const item = within(screen.getByTestId('roll-history')).getByRole('listitem')
    expect(item).toHaveTextContent('32')
    expect(item).not.toHaveTextContent('20 natural')
  })
})

describe('NotesTab — rolador livre', () => {
  const dieButton = (name: string) => within(screen.getByRole('group', { name: 'Dado' })).getByRole('button', { name })

  it('só com os dados do app', () => {
    openKrusk()
    openNotes()
    expect(screen.queryByText('Rolador livre')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Dado' })).toBeNull()
  })

  it('d4 a d100, quantidade e modificador; rola, mostra o total e grava no histórico fora do desfazer', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    openNotes()
    expect(within(screen.getByRole('group', { name: 'Dado' })).getAllByRole('button').map(b => b.textContent))
      .toEqual(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'])
    // No celular, quatro por linha: sete numa linha dentro do cartão dão 38 px, abaixo dos 45 px de toque.
    expect(screen.getByRole('group', { name: 'Dado' })).toHaveClass('grid-cols-4', 'sm:grid-cols-7')
    expect(dieButton('d20')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(dieButton('d6'))
    expect(dieButton('d6')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    fireEvent.change(screen.getByLabelText('Modificador'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rolar 2d6 + 3' }))

    const record = playState().rolls.at(-1)!
    expect(record.label).toBe('Rolagem livre: 2d6 + 3')
    expect(record.notation).toBe('2d6+3')
    expect(screen.getByTestId('roll-total')).toHaveTextContent(String(record.total))
    expect(within(screen.getByTestId('roll-history')).getAllByRole('listitem')[0]).toHaveTextContent('Rolagem livre: 2d6 + 3')
    expect(usePlayStore.getState().undoStack).toHaveLength(0)
  })

  it('modificador negativo pelo "−", e o campo fora do limite volta ao que foi rolado', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    openNotes()
    fireEvent.click(dieButton('d100'))
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir modificador' }))
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rolar 100d100 - 1' }))
    expect(playState().rolls.at(-1)!.notation).toBe('100d100-1')
    expect(screen.getByLabelText('Quantidade')).toHaveValue('100')
    expect(screen.getByRole('button', { name: 'Diminuir quantidade' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
  })
})
