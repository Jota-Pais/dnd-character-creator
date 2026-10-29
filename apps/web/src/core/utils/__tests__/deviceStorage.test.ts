import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_DEVICE_STATE, DEVICE_KEY, loadDeviceState, updateDeviceState } from '../deviceStorage'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('deviceStorage', () => {
  it('sem nada salvo, tudo no padrão', () => {
    expect(loadDeviceState()).toEqual(DEFAULT_DEVICE_STATE)
  })

  it('grava campo a campo, sem perder os outros', () => {
    updateDeviceState({ lastBackupAt: 100 })
    updateDeviceState({ persist: { granted: false, installed: true } })
    expect(loadDeviceState()).toEqual({ ...DEFAULT_DEVICE_STATE, lastBackupAt: 100, persist: { granted: false, installed: true } })
  })

  it('JSON quebrado ou campo estranho cai no padrão, campo a campo', () => {
    localStorage.setItem(DEVICE_KEY, '{quebrado')
    expect(loadDeviceState()).toEqual(DEFAULT_DEVICE_STATE)
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ lastBackupAt: 'ontem', backupSnoozedUntil: 50, persist: { granted: 'sim' } }))
    expect(loadDeviceState()).toEqual({ ...DEFAULT_DEVICE_STATE, backupSnoozedUntil: 50 })
  })

  it('localStorage que recusa a escrita (cota, navegação privada) não vira erro', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('cheio', 'QuotaExceededError') })
    expect(() => updateDeviceState({ installHintDismissedAt: 1 })).not.toThrow()
  })
})
