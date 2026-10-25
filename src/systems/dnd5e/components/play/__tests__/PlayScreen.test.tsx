import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { useAppStore } from '../../../../../core/stores/appStore'
import { useCharacterStore } from '../../../stores/characterStore'
import { usePlayStore } from '../../../stores/playStore'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'

/** Salva a ficha completa (Krusk, meio-orc bárbaro 1) e abre no modo de jogo. */
function openKrusk(): string {
  useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
  const id = useCharacterStore.getState().currentId!
  useCharacterStore.getState().playCharacter(id)
  useAppStore.getState().setActiveSystem('dnd5e')
  return id
}

beforeEach(() => {
  localStorage.clear()
  usePlayStore.getState().close()
})
afterEach(() => cleanup())

describe('PlayScreen — casca', () => {
  it('mostra o nome, a linha de raça e classe e as abas', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.getByRole('heading', { name: 'Krusk' })).toBeInTheDocument()
    expect(screen.getByText(/Meio-Orc · Bárbaro · nível 1/i)).toBeInTheDocument()
    for (const label of ['Testes', 'Ataques', 'Magia e recursos', 'Estado', 'Notas']) {
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
