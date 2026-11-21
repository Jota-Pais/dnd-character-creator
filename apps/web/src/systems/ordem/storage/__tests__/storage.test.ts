import { describe, it, expect, beforeEach } from 'vitest'
import { EMPTY_DRAFT, type OrdemCharacterDraft } from '@rpg/rules/systems/ordem/types/character'
import { characterKey, loadSyncMeta, updateSyncMeta } from '../../../../core/sync/syncStorage'
import {
  SYSTEM_ID, clearLibrary, deleteCharacterEntry, loadLibrary, putSyncedCharacter, readSyncedCharacter,
  removeSyncedCharacter, saveCharacterEntry, type SavedCharacter,
} from '../storage'

const KEY = characterKey(SYSTEM_ID, 'o1')

const draft = (over: Partial<OrdemCharacterDraft> = {}): OrdemCharacterDraft => ({ ...structuredClone(EMPTY_DRAFT), name: 'Agente Lia', ...over })

const sheet = (over: Partial<SavedCharacter> = {}): SavedCharacter => ({ id: 'o1', updatedAt: 1000, step: 'name', draft: draft(), ...over })

const synced = (revision: number) => updateSyncMeta(meta => { meta.docs[KEY] = { revision, dirty: false } })

beforeEach(() => localStorage.clear())

describe('a biblioteca do Ordem', () => {
  it('grava, atualiza no lugar e apaga', () => {
    saveCharacterEntry(sheet())
    saveCharacterEntry(sheet({ id: 'o2', draft: draft({ name: 'Agente Rui' }) }))
    expect(saveCharacterEntry(sheet({ draft: draft({ nex: 20 }) })).map(c => c.id)).toEqual(['o1', 'o2'])
    expect(loadLibrary()[0].draft.nex).toBe(20)
    expect(deleteCharacterEntry('o1').map(c => c.id)).toEqual(['o2'])
  })

  it('a chave do sistema na sincronização é a do Ordem', () => {
    expect(KEY).toBe('character:ordem:o1')
  })
})

describe('o diário da sincronização', () => {
  it('ficha nova e draft mudado ficam marcados; regravar o mesmo draft, não', () => {
    saveCharacterEntry(sheet())
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 0, dirty: true })

    synced(2)
    saveCharacterEntry(sheet({ step: 'review', updatedAt: 9999 }))
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 2, dirty: false })

    saveCharacterEntry(sheet({ draft: draft({ nex: 35 }) }))
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 2, dirty: true })
  })

  it('apagar deixa a lápide do que o servidor tem, e só esquece o que nunca subiu', () => {
    saveCharacterEntry(sheet())
    deleteCharacterEntry('o1')
    expect(loadSyncMeta().docs).toEqual({})

    saveCharacterEntry(sheet())
    synced(5)
    deleteCharacterEntry('o1')
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 5, dirty: true, deleted: true })
  })

  it('o que vem do servidor não marca nada', () => {
    putSyncedCharacter(sheet({ updatedAt: 5000 }))
    expect(loadLibrary()[0].updatedAt).toBe(5000)
    removeSyncedCharacter('o1')
    expect(loadLibrary()).toEqual([])
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('a ficha remota entra com os padrões e sem perder conteúdo; o que não parece ficha é recusado', () => {
    const remote = { ...draft({ nex: 50 }), campoDeUmAppMaisNovo: true }
    expect(readSyncedCharacter({ id: 'o1', step: 'review', draft: remote, updatedAt: 7 })).toEqual({ id: 'o1', step: 'review', updatedAt: 7, draft: remote })
    expect(readSyncedCharacter({ id: 'o1', step: 'etapa-nova', draft: { name: 'x' }, updatedAt: 1 })).toMatchObject({ step: 'name', draft: { name: 'x', nex: EMPTY_DRAFT.nex } })
    for (const bad of [null, 'texto', ['lista'], { nex: 5 }]) {
      expect(readSyncedCharacter({ id: 'o1', step: 'name', draft: bad, updatedAt: 1 })).toBeNull()
    }
  })

  it('limpar apaga a biblioteca do aparelho', () => {
    saveCharacterEntry(sheet())
    clearLibrary()
    expect(loadLibrary()).toEqual([])
  })
})
