import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SYNC_KEY,
  characterKey,
  clearSyncMeta,
  emptySyncMeta,
  forgetDoc,
  loadSyncMeta,
  markDocChanged,
  markDocDeleted,
  onLocalChange,
  parseDocKey,
  playKey,
  updateSyncMeta,
} from '../syncStorage'

const KRUSK = characterKey('dnd5e', 'k1')

beforeEach(() => localStorage.clear())

describe('a chave de um documento', () => {
  it('diz o tipo, o sistema e o id, e volta inteira', () => {
    expect(parseDocKey(characterKey('ordem', 'abc'))).toEqual({ kind: 'character', system: 'ordem', id: 'abc' })
    expect(parseDocKey(playKey('abc'))).toEqual({ kind: 'play', characterId: 'abc' })
    // O id antigo tem hífens; um id com ":" só se separa no primeiro.
    expect(parseDocKey(characterKey('dnd5e', 'char-17-9:x'))).toEqual({ kind: 'character', system: 'dnd5e', id: 'char-17-9:x' })
  })

  it('texto que não é chave de documento vale null', () => {
    for (const key of ['', 'play:', 'character:dnd5e', 'character::x', 'outra:coisa']) {
      expect(parseDocKey(key), key).toBeNull()
    }
  })
})

describe('o diário salvo', () => {
  it('sem nada gravado é o diário vazio: sem dono, sem cursor, sem documentos', () => {
    expect(loadSyncMeta()).toEqual({ version: 1, owner: null, cursor: null, docs: {} })
    expect(loadSyncMeta()).toEqual(emptySyncMeta())
  })

  it('vai e volta', () => {
    updateSyncMeta(meta => {
      meta.owner = { id: 'u1', email: 'ana@forja.dev' }
      meta.cursor = '42'
      meta.docs[KRUSK] = { revision: 3, dirty: false }
      meta.docs[playKey('k1')] = { revision: 1, dirty: true, blocked: true }
    })
    expect(loadSyncMeta()).toEqual({
      version: 1,
      owner: { id: 'u1', email: 'ana@forja.dev' },
      cursor: '42',
      docs: { [KRUSK]: { revision: 3, dirty: false }, [playKey('k1')]: { revision: 1, dirty: true, blocked: true } },
    })
  })

  it('JSON quebrado ou versão diferente caem no diário vazio, sem erro', () => {
    localStorage.setItem(SYNC_KEY, '{quebrado')
    expect(loadSyncMeta()).toEqual(emptySyncMeta())
    localStorage.setItem(SYNC_KEY, JSON.stringify({ version: 99, owner: { id: 'u1', email: 'a@x' }, cursor: '1', docs: {} }))
    expect(loadSyncMeta()).toEqual(emptySyncMeta())
  })

  it('descarta o que não tem a forma certa, entrada por entrada', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({
      version: 1,
      owner: { id: '', email: 'a@x' },
      cursor: 'abc',
      docs: {
        [KRUSK]: { revision: 2, dirty: 'sim', deleted: true, extra: 1 },
        [playKey('k1')]: { revision: -1, dirty: true },
        'chave-estranha': { revision: 1, dirty: true },
        [characterKey('ordem', 'o1')]: 'texto',
      },
    }))
    expect(loadSyncMeta()).toEqual({ version: 1, owner: null, cursor: null, docs: { [KRUSK]: { revision: 2, dirty: false, deleted: true } } })
  })

  it('a mudança que devolve false não grava', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    updateSyncMeta(() => false)
    expect(spy).not.toHaveBeenCalled()
    updateSyncMeta(meta => { meta.cursor = '1' })
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('limpar apaga a chave', () => {
    updateSyncMeta(meta => { meta.cursor = '1' })
    clearSyncMeta()
    expect(localStorage.getItem(SYNC_KEY)).toBeNull()
  })
})

describe('alteração local', () => {
  it('documento novo entra com a revisão 0 e a enviar', () => {
    markDocChanged(KRUSK)
    expect(loadSyncMeta().docs[KRUSK]).toEqual({ revision: 0, dirty: true })
  })

  it('documento em dia passa a ter alteração a enviar, e a revisão conhecida fica', () => {
    updateSyncMeta(meta => { meta.docs[KRUSK] = { revision: 5, dirty: false } })
    markDocChanged(KRUSK)
    expect(loadSyncMeta().docs[KRUSK]).toEqual({ revision: 5, dirty: true })
  })

  it('só grava o diário na passagem de em dia para a enviar: no jogo, uma gravação por envio', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    markDocChanged(playKey('k1'))
    markDocChanged(playKey('k1'))
    markDocChanged(playKey('k1'))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('avisa quem ouve a cada alteração, mesmo quando o diário já estava marcado', () => {
    const seen: string[] = []
    const stop = onLocalChange(key => seen.push(key))
    markDocChanged(KRUSK)
    markDocChanged(KRUSK)
    markDocDeleted(KRUSK)
    stop()
    markDocChanged(KRUSK)
    expect(seen).toEqual([KRUSK, KRUSK, KRUSK])
  })

  it('mudar de novo tira a recusa do servidor, e mantém a espera pela galeria', () => {
    updateSyncMeta(meta => { meta.docs[KRUSK] = { revision: 2, dirty: true, refused: true, blocked: true } })
    markDocChanged(KRUSK)
    expect(loadSyncMeta().docs[KRUSK]).toEqual({ revision: 2, dirty: true, blocked: true })
  })
})

describe('exclusão local', () => {
  it('o que o servidor tem vira lápide a enviar', () => {
    updateSyncMeta(meta => { meta.docs[KRUSK] = { revision: 4, dirty: false } })
    markDocDeleted(KRUSK)
    expect(loadSyncMeta().docs[KRUSK]).toEqual({ revision: 4, dirty: true, deleted: true })
  })

  it('o que nunca subiu só é esquecido: não há o que apagar no servidor', () => {
    markDocChanged(KRUSK)
    markDocDeleted(KRUSK)
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('apagar o que o diário não conhece não cria lápide', () => {
    markDocDeleted(KRUSK)
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('gravar de novo um documento com lápide pendente desfaz a lápide', () => {
    updateSyncMeta(meta => { meta.docs[KRUSK] = { revision: 4, dirty: true, deleted: true } })
    markDocChanged(KRUSK)
    expect(loadSyncMeta().docs[KRUSK]).toEqual({ revision: 4, dirty: true })
  })

  it('esquecer tira a entrada sem lápide e sem avisar', () => {
    updateSyncMeta(meta => { meta.docs[playKey('k1')] = { revision: 3, dirty: false } })
    const seen: string[] = []
    const stop = onLocalChange(key => seen.push(key))
    forgetDoc(playKey('k1'))
    forgetDoc(playKey('nunca-existiu'))
    stop()
    expect(loadSyncMeta().docs).toEqual({})
    expect(seen).toEqual([])
  })
})
