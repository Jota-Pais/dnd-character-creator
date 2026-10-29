import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ensurePersistentStorage, shouldRequestPersist, type PersistDeps } from '../persistentStorage'
import type { PersistAnswer } from '../../utils/deviceStorage'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'

function fakeStorage({ persisted = false, grant = true } = {}) {
  return {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => grant),
  }
}

function deps(over: Partial<PersistDeps> & { saved?: PersistAnswer | null } = {}) {
  let saved: PersistAnswer | null = over.saved ?? null
  const save = vi.fn((a: PersistAnswer) => { saved = a })
  return {
    deps: { storage: fakeStorage(), installed: false, load: () => saved, save, ...over } as PersistDeps,
    save,
    saved: () => saved,
  }
}

describe('ensurePersistentStorage', () => {
  it('a primeira vez pede e grava a resposta', async () => {
    const storage = fakeStorage({ grant: true })
    const d = deps({ storage })
    expect(await ensurePersistentStorage(d.deps)).toBe('granted')
    expect(storage.persist).toHaveBeenCalledTimes(1)
    expect(d.saved()).toEqual({ granted: true, installed: false })
  })

  it('já persistente, não pede de novo', async () => {
    const storage = fakeStorage({ persisted: true })
    expect(await ensurePersistentStorage(deps({ storage }).deps)).toBe('granted')
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('recusado: grava a recusa e não lança', async () => {
    const d = deps({ storage: fakeStorage({ grant: false }) })
    expect(await ensurePersistentStorage(d.deps)).toBe('denied')
    expect(d.saved()).toEqual({ granted: false, installed: false })
  })

  it('recusado antes, sem instalar: não pergunta de novo (no Firefox, seria a pergunta outra vez)', async () => {
    const storage = fakeStorage()
    const d = deps({ storage, saved: { granted: false, installed: false } })
    expect(await ensurePersistentStorage(d.deps)).toBe('already-asked')
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('recusado antes de instalar, agora instalado: pede de novo', async () => {
    const storage = fakeStorage({ grant: true })
    const d = deps({ storage, installed: true, saved: { granted: false, installed: false } })
    expect(await ensurePersistentStorage(d.deps)).toBe('granted')
    expect(d.saved()).toEqual({ granted: true, installed: true })
  })

  it('sem a API (navegador antigo, http pelo IP da rede) ou com erro dela, nada acontece', async () => {
    expect(await ensurePersistentStorage(deps({ storage: undefined }).deps)).toBe('unsupported')
    const broken = { persisted: vi.fn(async () => { throw new Error('x') }), persist: vi.fn() }
    expect(await ensurePersistentStorage(deps({ storage: broken }).deps)).toBe('unsupported')
  })

  it('shouldRequestPersist: só a primeira vez ou a recusa de antes da instalação', () => {
    expect(shouldRequestPersist(null, false)).toBe(true)
    expect(shouldRequestPersist({ granted: true, installed: false }, true)).toBe(false)
    expect(shouldRequestPersist({ granted: false, installed: true }, true)).toBe(false)
    expect(shouldRequestPersist({ granted: false, installed: false }, true)).toBe(true)
  })
})

describe('requestPersistentStorage: a primeira gravação de ficha da sessão', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'storage')
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'storage', original)
    else delete (navigator as { storage?: unknown }).storage
  })

  it('gravar ficha pede uma vez por sessão, e a resposta fica no aparelho', async () => {
    const storage = fakeStorage({ grant: false })
    Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })
    // Módulos novos: o "já pediu nesta sessão" começa zerado.
    const { saveCharacterEntry, newId } = await import('../../../systems/dnd5e/utils/storage')
    const { loadDeviceState } = await import('../../utils/deviceStorage')

    expect(storage.persist).not.toHaveBeenCalled()
    saveCharacterEntry({ id: newId(), updatedAt: 1, step: 'review', draft: structuredClone(COMPLETE_DRAFT) })
    saveCharacterEntry({ id: newId(), updatedAt: 2, step: 'review', draft: structuredClone(COMPLETE_DRAFT) })
    await vi.waitFor(() => expect(loadDeviceState().persist).toEqual({ granted: false, installed: false }))
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('o estado de jogo gravado também pede (quem só joga fichas de antes)', async () => {
    const storage = fakeStorage()
    Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })
    const { savePlayState } = await import('../../../systems/dnd5e/utils/playStorage')
    const { createPlayState } = await import('@rpg/rules/systems/dnd5e/utils/playState')
    savePlayState(createPlayState('char-1', 1))
    await vi.waitFor(() => expect(storage.persist).toHaveBeenCalledTimes(1))
  })
})
