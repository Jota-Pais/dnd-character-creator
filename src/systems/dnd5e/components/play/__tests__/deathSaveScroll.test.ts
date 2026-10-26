import { describe, it, expect } from 'vitest'
import { getDeathSaveScrollDelta, TOAST_GAP } from '../deathSaveScroll'

describe('getDeathSaveScrollDelta', () => {
  it('sem aviso no pé: só centraliza o cartão', () => {
    const delta = getDeathSaveScrollDelta({
      panel: { top: 900, bottom: 1200 }, form: { top: 1080, bottom: 1120 }, viewportHeight: 800, bottomInset: 0,
    })
    expect(delta).toBe(650) // centro do cartão (1050) no centro da tela (400)
  })

  it('o aviso cobriria o d20 no centro: rola até o formulário terminar acima dele', () => {
    // Krusk a 390×800: aviso de 400 px (topo em y 400); centralizado, o d20 ficaria em y 421–466.
    const panel = { top: 900, bottom: 1200 }
    const form = { top: 1071, bottom: 1116 }
    const delta = getDeathSaveScrollDelta({ panel, form, viewportHeight: 800, bottomInset: 400 })
    expect(form.bottom - delta).toBe(800 - 400 - TOAST_GAP)
    expect(delta).toBeGreaterThan(650)
  })

  it('o d20 já fica acima do aviso no centro: não rola a mais', () => {
    const delta = getDeathSaveScrollDelta({
      panel: { top: 900, bottom: 1100 }, form: { top: 960, bottom: 1000 }, viewportHeight: 800, bottomInset: 300,
    })
    expect(delta).toBe(600)
  })
})
