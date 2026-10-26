import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { useAppStore } from '../../../../../core/stores/appStore'
import { useCharacterStore } from '../../../stores/characterStore'
import { usePlayStore } from '../../../stores/playStore'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

describe('PlayScreen — casca', () => {
  it('mostra o nome, a linha de raça e classe e as abas', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.getByRole('heading', { name: 'Krusk' })).toBeInTheDocument()
    expect(screen.getByText(/Meio-Orc · Bárbaro · nível 1/i)).toBeInTheDocument()
    for (const label of ['Testes', 'Ataques', 'Magia', 'Regras', 'Estado', 'Notas']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('tab', { name: 'Notas' }))
    expect(screen.getByRole('tab', { name: 'Notas' })).toHaveAttribute('aria-selected', 'true')
  })

  it('"← Personagens" sai do modo de jogo para a galeria', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByText('← Personagens'))
    expect(useCharacterStore.getState().view).toBe('gallery')
    expect(usePlayStore.getState().state).toBeNull()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })

  it('a engrenagem mostra o "Usar os dados do app", desligado por padrão', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.queryByLabelText(/Usar os dados do app/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Configurações do modo de jogo' }))
    const toggle = screen.getByLabelText(/Usar os dados do app/)
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(usePlayStore.getState().prefs.appDice).toBe(true)
  })
})

describe('PlayScreen — vitais e receita', () => {
  it('mostra PV, CA, deslocamento e Percepção passiva da ficha', () => {
    openKrusk()
    render(<PlayScreen />)
    // Bárbaro 1 (d12) com CON 14: 12 + 2 = 14 PV.
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    expect(screen.getByTestId('vitals-hp')).toHaveTextContent('/ 14')
    expect(screen.getByText('CA')).toBeInTheDocument()
    expect(screen.getByText('9 m')).toBeInTheDocument()
  })

  it('inspiração liga e desliga pelo estado de jogo', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Sem inspiração/ }))
    expect(usePlayStore.getState().state?.inspiration).toBe(true)
    expect(screen.getByRole('button', { name: /Inspirado/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a iniciativa abre a receita; sem os dados do app, não há "Rolar"', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciativa \+2/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d20 + 2')
    expect(screen.getByText('De onde vem')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rolar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a folha recebe o foco, prende o Tab e devolve o foco a quem a abriu', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    render(<PlayScreen />)
    const opener = screen.getByRole('button', { name: /Iniciativa/ })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Fechar' })
    const rollButton = within(dialog).getByRole('button', { name: 'Rolar' })
    expect(close).toHaveFocus()

    // Shift+Tab no primeiro vai ao último; Tab no último volta ao primeiro.
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(rollButton).toHaveFocus()
    fireEvent.keyDown(rollButton, { key: 'Tab' })
    expect(close).toHaveFocus()

    fireEvent.click(close)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('com os dados do app, "Rolar" mostra o total e grava no histórico', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciativa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const rolls = usePlayStore.getState().state!.rolls
    expect(rolls).toHaveLength(1)
    expect(rolls[0].label).toBe('Iniciativa')
    expect(screen.getByTestId('roll-total')).toHaveTextContent(String(rolls[0].total))
  })
})
