import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import App from '../App'
import { useAppStore } from '../../core/stores/appStore'
import { saveAccount } from '../../features/auth/accountStorage'
import { useAuthStore } from '../../features/auth/authStore'
import { useCharacterStore } from '../../systems/dnd5e/stores/characterStore'
import { TEST_USER } from '../../test/setup'

/**
 * O portão do app: sem conta ninguém usa (decisão do dono de 2026-11-21). O `App` decide pelo que o
 * aparelho lembra, na hora e sem rede; o servidor só confirma depois, em segundo plano.
 */
beforeEach(() => {
  useCharacterStore.getState().newCharacter()
  localStorage.clear()
  useCharacterStore.setState({ library: [], view: 'gallery', currentId: null })
  useAppStore.getState().setActiveSystem(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('o portão', () => {
  it('sem ninguém conectado, o app é a tela de entrar: nem a galeria, nem as fichas do aparelho', () => {
    useCharacterStore.setState({ library: [{ id: 'k1', updatedAt: 1, step: 'review', draft: structuredClone(COMPLETE_DRAFT) }] })
    useAuthStore.setState({ user: null, session: 'unknown' })
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('MEUS PERSONAGENS')).not.toBeInTheDocument()
    expect(screen.queryByText('Krusk')).not.toBeInTheDocument()
  })

  it('com a conta lembrada, abre a galeria sem perguntar nada ao servidor', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    useAuthStore.setState({ user: TEST_USER, session: 'unknown' })
    render(<App />)

    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument()
    // Montar o app não fala com o servidor: quem confere a sessão é o main.tsx, depois da tela.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('a sessão expirada não fecha o portão: as fichas estão no aparelho, e o uso continua', () => {
    useAuthStore.setState({ user: TEST_USER, session: 'expired' })
    render(<App />)
    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()
  })

  it('entrar abre o portão na hora, e sair o fecha', () => {
    useAuthStore.setState({ user: null, session: 'unknown' })
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()

    act(() => { useAuthStore.setState({ user: TEST_USER, session: 'valid' }) })
    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()

    act(() => { useAuthStore.setState({ user: null, session: 'unknown' }) })
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('o que o aparelho lembra é o que o store lê ao carregar', async () => {
    saveAccount({ user: TEST_USER })
    vi.resetModules()
    const { useAuthStore: fresh } = await import('../../features/auth/authStore')
    expect(fresh.getState()).toEqual({ user: TEST_USER, session: 'unknown' })

    localStorage.clear()
    vi.resetModules()
    const { useAuthStore: empty } = await import('../../features/auth/authStore')
    expect(empty.getState().user).toBeNull()
  })
})
