import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { loadPlayPreferences } from '../../../utils/playStorage'
import { openKrusk, resetPlay } from './openPlay'

/** A trava que o navegador devolve: solta uma vez, avisando com o evento `release`. */
class FakeSentinel extends EventTarget {
  readonly type = 'screen'
  released = false
  release = vi.fn(async () => {
    if (this.released) return
    this.released = true
    this.dispatchEvent(new Event('release'))
  })
}

/** Põe um `navigator.wakeLock` simulado; `refuse` faz todo pedido ser recusado. */
function installWakeLock({ refuse = false } = {}) {
  const sentinels: FakeSentinel[] = []
  const request = vi.fn(async (): Promise<FakeSentinel> => {
    if (refuse) throw new DOMException('Sem bateria', 'NotAllowedError')
    const sentinel = new FakeSentinel()
    sentinels.push(sentinel)
    return sentinel
  })
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
  return { request, sentinels }
}

/** Esconde ou mostra a página, como a troca de app no celular. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Deixa as promessas do pedido da trava se resolverem. */
const settle = () => act(async () => {})

const openSettings = () => fireEvent.click(screen.getByRole('button', { name: 'Configurações do modo de jogo' }))

beforeEach(resetPlay)
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'wakeLock')
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('tela acesa durante o jogo (decisão 10.2.22)', () => {
  it('ligada por padrão: pede a trava ao abrir o jogo e solta ao sair', async () => {
    const { request, sentinels } = installWakeLock()
    openKrusk()
    const { unmount } = render(<PlayScreen />)
    await settle()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('screen')
    openSettings()
    expect(screen.getByLabelText(/Manter a tela acesa/)).toBeChecked()
    unmount()
    expect(sentinels[0].release).toHaveBeenCalled()
  })

  it('desligar na engrenagem solta a trava e grava a preferência; religar pede de novo', async () => {
    const { request, sentinels } = installWakeLock()
    openKrusk()
    render(<PlayScreen />)
    await settle()
    openSettings()
    fireEvent.click(screen.getByLabelText(/Manter a tela acesa/))
    expect(sentinels[0].released).toBe(true)
    expect(loadPlayPreferences().keepScreenOn).toBe(false)
    expect(usePlayStore.getState().prefs.keepScreenOn).toBe(false)

    fireEvent.click(screen.getByLabelText(/Manter a tela acesa/))
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
    expect(sentinels[1].released).toBe(false)
  })

  it('desligada, não pede a trava', async () => {
    usePlayStore.getState().setKeepScreenOn(false)
    const { request } = installWakeLock()
    openKrusk()
    render(<PlayScreen />)
    await settle()
    expect(request).not.toHaveBeenCalled()
  })

  it('a página escondida perde a trava (o navegador solta); ao voltar, pede de novo', async () => {
    const { request, sentinels } = installWakeLock()
    openKrusk()
    render(<PlayScreen />)
    await settle()
    setVisibility('hidden')
    await act(() => sentinels[0].release())
    await settle()
    expect(request).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
    expect(sentinels[1].released).toBe(false)
    // Voltar à vista com a trava ainda de pé não pede outra.
    setVisibility('visible')
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('pedido recusado (economia de bateria) fica sem trava, sem erro, e tenta de novo ao voltar à vista', async () => {
    const { request } = installWakeLock({ refuse: true })
    openKrusk()
    render(<PlayScreen />)
    await settle()
    expect(request).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: 'Krusk' })).toBeInTheDocument()
  })

  it('navegador sem a API: a opção vira explicação, e nada quebra', async () => {
    openKrusk()
    render(<PlayScreen />)
    await settle()
    openSettings()
    expect(screen.queryByLabelText(/Manter a tela acesa/)).toBeNull()
    expect(screen.getByText(/Este navegador não deixa o app manter a tela acesa/)).toBeInTheDocument()
  })

  it('aberto em http pelo endereço da rede: a explicação culpa o endereço, não o navegador', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    try {
      openKrusk()
      render(<PlayScreen />)
      await settle()
      openSettings()
      expect(screen.queryByLabelText(/Manter a tela acesa/)).toBeNull()
      expect(screen.getByText(/Aberto pelo endereço da rede \(sem https\), o app não consegue manter a tela acesa/))
        .toHaveTextContent(/aumente o tempo de bloqueio da tela/)
      expect(screen.queryByText(/Este navegador não deixa/)).toBeNull()
    } finally {
      Reflect.deleteProperty(window, 'isSecureContext')
    }
  })
})
