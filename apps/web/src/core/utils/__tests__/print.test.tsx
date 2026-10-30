import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import App from '../../../App'
import { useAppStore } from '../../stores/appStore'
import { useCharacterStore } from '../../../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../../../systems/ordem/stores/characterStore'
import { printNative } from '../../native/nativeShell'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { EMPTY_DRAFT as ORDEM_EMPTY } from '@rpg/rules/systems/ordem/types/character'

// A impressão da casca do APK, de mentira: no jsdom não há casca.
vi.mock('../../native/nativeShell', () => ({ printNative: vi.fn(async () => {}) }))

beforeEach(() => {
  localStorage.clear()
  useAppStore.getState().setActiveSystem(null)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.mocked(printNative).mockClear()
})

const PRINT = '🖨 Imprimir / Salvar PDF'

function openDndPrint() {
  useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
  useAppStore.getState().setActiveSystem('dnd5e')
  useCharacterStore.getState().goToPrint()
}

describe('"Imprimir / Salvar PDF"', () => {
  it('no navegador, é o window.print()', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    openDndPrint()
    render(<App />)
    fireEvent.click(screen.getByText(PRINT))
    expect(print).toHaveBeenCalledTimes(1)
    expect(printNative).not.toHaveBeenCalled()
  })

  // O WebView do Android não implementa o window.print(): o toque não abria nada.
  it('no APK, é a impressão do Android, com o nome da ficha', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    openDndPrint()
    render(<App />)
    fireEvent.click(screen.getByText(PRINT))
    expect(printNative).toHaveBeenCalledWith('Krusk — D&D 5e')
    expect(print).not.toHaveBeenCalled()
  })

  it('no APK, a do Ordem também', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    useOrdemStore.getState().importDraft({ ...structuredClone(ORDEM_EMPTY), name: 'Bianca' })
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.getState().goToPrint()
    render(<App />)
    fireEvent.click(screen.getByText(PRINT))
    expect(printNative).toHaveBeenCalledWith('Bianca — Ordem Paranormal')
    expect(print).not.toHaveBeenCalled()
  })
})
