import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { handleBack, registerBackHandler, useBackHandler, type BackLayer } from '../back'

const removers: (() => void)[] = []
function register(layer: BackLayer, run: () => void) {
  removers.push(registerBackHandler(layer, run))
}

afterEach(() => {
  cleanup()
  removers.splice(0).forEach(remove => remove())
})

describe('o voltar do app', () => {
  it('sem nada registrado, não há para onde voltar', () => {
    expect(handleBack()).toBe(false)
  })

  it('faz só o da camada de cima: a folha fecha antes de a tela voltar', () => {
    const screen = vi.fn()
    const sheet = vi.fn()
    // A folha registrada antes da tela (o efeito do filho roda antes do do pai) continua por cima.
    register('overlay', sheet)
    register('screen', screen)
    expect(handleBack()).toBe(true)
    expect(sheet).toHaveBeenCalledTimes(1)
    expect(screen).not.toHaveBeenCalled()
  })

  it('na mesma camada, o mais recente; cancelado, o de baixo volta a valer', () => {
    const first = vi.fn()
    const second = vi.fn()
    register('screen', first)
    const removeSecond = registerBackHandler('screen', second)
    handleBack()
    expect(second).toHaveBeenCalledTimes(1)
    removeSecond()
    handleBack()
    expect(first).toHaveBeenCalledTimes(1)
  })

  it('o hook registra enquanto montado, com a função do último desenho, e null não registra', () => {
    function Screen({ onBack }: { onBack: (() => void) | null }) {
      useBackHandler(onBack)
      return null
    }
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = render(<Screen onBack={first} />)
    rerender(<Screen onBack={second} />)
    expect(handleBack()).toBe(true)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()

    rerender(<Screen onBack={null} />)
    expect(handleBack()).toBe(false)
    rerender(<Screen onBack={first} />)
    unmount()
    expect(handleBack()).toBe(false)
  })
})
