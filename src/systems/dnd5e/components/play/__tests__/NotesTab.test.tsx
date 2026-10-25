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
})
