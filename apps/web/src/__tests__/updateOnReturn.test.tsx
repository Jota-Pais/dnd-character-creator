import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from '../App'
import {
  applyUpdateOnReturn,
  AUTO_APPLY_MIN_AWAY_MS,
  SKIP_WAITING_MESSAGE,
  useAppUpdateStore,
  type SwContainer,
  type SwRegistration,
} from '../core/pwa/serviceWorker'
import { takeOwnTrip } from '../core/native/backgroundTrips'
import { useAppStore } from '../core/stores/appStore'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../systems/ordem/stores/characterStore'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'

const HOUR = 60 * 60 * 1000

/**
 * O APK com uma versão esperando (o registro de mentira; core/pwa/__tests__/serviceWorker.test.ts
 * tem o navegador simulado inteiro) e a ida ao segundo plano, com o relógio andando.
 */
function waitingVersion() {
  const postMessage = vi.fn()
  const reg = { waiting: { postMessage } } as unknown as SwRegistration
  const container = new EventTarget() as unknown as SwContainer
  useAppUpdateStore.setState({ updateReady: true })
  const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
  doc.visibilityState = 'visible'
  let now = 0
  applyUpdateOnReturn(reg, container, doc, { now: () => now, reload: () => {} })
  const turn = (state: DocumentVisibilityState) => {
    doc.visibilityState = state
    doc.dispatchEvent(new Event('visibilitychange'))
  }
  const away = (ms: number) => {
    turn('hidden')
    now += ms
    turn('visible')
  }
  const applied = () => postMessage.mock.calls.some(([message]) => message === SKIP_WAITING_MESSAGE)
  return { away, applied }
}

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.setState({ library: [] })
  useOrdemStore.setState({ library: [] })
  useAppStore.getState().setActiveSystem(null)
  takeOwnTrip()
})
afterEach(() => cleanup())

describe('a versão nova entra sozinha na volta à galeria (APK), só com ela parada', () => {
  it('com o menu "Novo personagem" aberto, não; fechado, sim', () => {
    render(<App />)
    const { away, applied } = waitingVersion()
    fireEvent.click(screen.getByText('＋ Novo personagem'))
    away(HOUR)
    expect(applied()).toBe(false)

    fireEvent.click(screen.getByText('＋ Novo personagem'))
    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(applied()).toBe(true)
  })

  // A volta do seletor traz o arquivo: recarregar ali perderia a importação.
  it('o "Importar" marca a ida do seletor de arquivo: a volta dela não aplica, a seguinte sim', () => {
    render(<App />)
    const { away, applied } = waitingVersion()
    fireEvent.click(screen.getByText('↑ Importar'))
    away(5 * 60 * 1000)
    expect(applied()).toBe(false)

    away(AUTO_APPLY_MIN_AWAY_MS)
    expect(applied()).toBe(true)
  })

  it('com a ficha aberta no criador, nunca', () => {
    useCharacterStore.getState().restoreCharacters([{ draft: structuredClone(COMPLETE_DRAFT), playState: null }])
    render(<App />)
    const { away, applied } = waitingVersion()
    fireEvent.click(screen.getByText('Abrir'))
    expect(useAppStore.getState().activeSystemId).toBe('dnd5e')
    away(HOUR)
    expect(applied()).toBe(false)
  })
})
