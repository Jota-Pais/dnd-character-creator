import { describe, it, expect, beforeEach } from 'vitest'
import type { RemoteCharacter, RemotePlayState } from '@rpg/contracts'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { EMPTY_DRAFT as ORDEM_EMPTY } from '@rpg/rules/systems/ordem/types/character'
import { createPlayState } from '@rpg/rules/systems/dnd5e/utils/playState'
import { createSyncEngine, type RemoteDoc } from '../../../core/sync/engine'
import { createFakeServer } from '../../../core/sync/__tests__/fakes'
import {
  SYNC_KEY, characterKey, loadSyncMeta, playKey, updateSyncMeta,
} from '../../../core/sync/syncStorage'
import { DEVICE_KEY } from '../../../core/utils/deviceStorage'
import { loadLibrary as loadDnd, saveCharacterEntry as saveDnd } from '../../../systems/dnd5e/storage/storage'
import {
  PLAY_PREFERENCES_KEY, loadOpenPlayId, loadPlayState, saveOpenPlayId, savePlayPreferences, savePlayState,
} from '../../../systems/dnd5e/storage/playStorage'
import { useCharacterStore } from '../../../systems/dnd5e/stores/characterStore'
import { loadLibrary as loadOrdem, saveCharacterEntry as saveOrdem } from '../../../systems/ordem/storage/storage'
import { useOrdemStore } from '../../../systems/ordem/stores/characterStore'
import { countLocalSheets, formatConflictMoment, reloadLibraries, syncLocal, wipeLocalSheets } from '../syncLocal'

const K1 = characterKey('dnd5e', 'k1')
const O1 = characterKey('ordem', 'o1')
const P1 = playKey('k1')
const NOW = new Date(2026, 10, 21, 14, 32).getTime()
const USER = { id: 'conta-da-ana', email: 'ana@forja.dev' }

const krusk = (over: Record<string, unknown> = {}) => ({ ...structuredClone(COMPLETE_DRAFT), ...over })
const agent = (over: Record<string, unknown> = {}) => ({ ...structuredClone(ORDEM_EMPTY), name: 'Agente Lia', ...over })

const remoteSheet = (over: Partial<RemoteCharacter> = {}): RemoteDoc => {
  const doc: RemoteCharacter = {
    id: 'k1', system: 'dnd5e', step: 'review', draft: krusk() as unknown as Record<string, unknown>, schema: 1,
    clientUpdatedAt: 5000, revision: 2, deletedAt: null, ...over,
  }
  return { kind: 'character', key: characterKey(doc.system, doc.id), doc }
}

const remotePlay = (over: Partial<RemotePlayState> = {}): RemoteDoc => {
  const doc: RemotePlayState = {
    characterId: 'k1', state: { ...createPlayState('k1'), damageTaken: 7 } as unknown as Record<string, unknown>, schema: 1,
    clientUpdatedAt: 6000, revision: 3, ...over,
  }
  return { kind: 'play', key: playKey(doc.characterId), doc }
}

/** Uma ficha de cada sistema e um estado de jogo, como o jogador os gravaria. */
function seed() {
  saveDnd({ id: 'k1', updatedAt: 1000, step: 'review', draft: krusk() })
  saveOrdem({ id: 'o1', updatedAt: 1100, step: 'name', draft: agent() })
  savePlayState({ ...createPlayState('k1'), damageTaken: 4 }, 1200)
}

beforeEach(() => {
  useCharacterStore.getState().newCharacter()
  localStorage.clear()
  useCharacterStore.setState({ library: [] })
  useOrdemStore.setState({ library: [] })
})

describe('os documentos do aparelho', () => {
  it('lista as fichas dos dois sistemas e o estado de jogo das que existem', () => {
    seed()
    savePlayState(createPlayState('ficha-que-nao-existe'), 1300)
    expect(syncLocal.keys().sort()).toEqual([K1, O1, P1].sort())
    expect(countLocalSheets()).toBe(2)
  })

  it('lê a ficha com o sistema, a etapa, a data e a forma do sistema dela', () => {
    seed()
    expect(syncLocal.read(K1)).toMatchObject({ kind: 'character', system: 'dnd5e', id: 'k1', step: 'review', schema: 1, updatedAt: 1000, draft: { name: 'Krusk' } })
    expect(syncLocal.read(O1)).toMatchObject({ kind: 'character', system: 'ordem', id: 'o1', updatedAt: 1100, draft: { name: 'Agente Lia' } })
    expect(syncLocal.read(P1)).toMatchObject({ kind: 'play', characterId: 'k1', schema: 1, updatedAt: 1200, state: { damageTaken: 4 } })
    expect(syncLocal.read(characterKey('dnd5e', 'nao-existe'))).toBeNull()
    expect(syncLocal.read(characterKey('sistema-novo', 'x'))).toBeNull()
    expect(syncLocal.read('chave-estranha')).toBeNull()
  })
})

describe('gravar o que vem do servidor', () => {
  it('a ficha entra na biblioteca do sistema dela, com a data de quem a gravou, sem marcar o diário', () => {
    expect(syncLocal.applyRemote(remoteSheet({ draft: krusk({ name: 'Do servidor' }) as unknown as Record<string, unknown> }))).toBe(true)
    expect(loadDnd()).toMatchObject([{ id: 'k1', step: 'review', updatedAt: 5000, draft: { name: 'Do servidor' } }])

    expect(syncLocal.applyRemote(remoteSheet({ id: 'o1', system: 'ordem', step: 'name', draft: agent({ nex: 35 }) as unknown as Record<string, unknown> }))).toBe(true)
    expect(loadOrdem()).toMatchObject([{ id: 'o1', draft: { nex: 35 } }])
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('o estado de jogo só entra com a ficha no aparelho, e guarda a data que veio', () => {
    expect(syncLocal.applyRemote(remotePlay())).toBe(false)
    expect(loadPlayState('k1')).toBeNull()

    seed()
    updateSyncMeta(meta => { meta.docs = {} })
    expect(syncLocal.applyRemote(remotePlay())).toBe(true)
    expect(loadPlayState('k1')).toMatchObject({ damageTaken: 7, updatedAt: 6000, characterId: 'k1' })
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('o que não parece ficha, ou é de um sistema que este app não conhece, é recusado sem tocar em nada', () => {
    seed()
    expect(syncLocal.applyRemote(remoteSheet({ draft: { level: 3 } }))).toBe(false)
    expect(syncLocal.applyRemote(remoteSheet({ system: 'sistema-novo' as 'dnd5e' }))).toBe(false)
    expect(loadDnd()[0].draft.name).toBe('Krusk')
  })

  it('só aceita a forma que este app entende', () => {
    expect(syncLocal.supports(remoteSheet())).toBe(true)
    expect(syncLocal.supports(remoteSheet({ schema: 2 }))).toBe(false)
    expect(syncLocal.supports(remotePlay({ schema: 2 }))).toBe(false)
    expect(syncLocal.supports(remoteSheet({ system: 'sistema-novo' as 'dnd5e' }))).toBe(false)
  })

  it('tirar a ficha leva o estado de jogo e a marca do jogo aberto, sem lápide', () => {
    seed()
    saveOpenPlayId('k1')
    updateSyncMeta(meta => { meta.docs = {} })
    syncLocal.remove(K1)
    expect(loadDnd()).toEqual([])
    expect(loadPlayState('k1')).toBeNull()
    expect(loadOpenPlayId()).toBeNull()
    expect(loadOrdem()).toHaveLength(1)
    expect(loadSyncMeta().docs).toEqual({})
  })
})

describe('comparar o conteúdo', () => {
  it('a ficha: o draft, depois dos padrões; a etapa e a data não contam', () => {
    seed()
    const local = syncLocal.read(K1)!
    expect(syncLocal.sameContent(local, remoteSheet({ step: 'name', clientUpdatedAt: 9 }))).toBe(true)
    expect(syncLocal.sameContent(local, remoteSheet({ draft: krusk({ level: 9 }) as unknown as Record<string, unknown> }))).toBe(false)
    // O servidor guarda o draft sem um campo que a leitura preenche com o padrão: é o mesmo.
    const { hpRolls: _hpRolls, ...older } = krusk() as Record<string, unknown>
    void _hpRolls
    expect(syncLocal.sameContent(local, remoteSheet({ draft: { ...older, hpRolls: (krusk() as Record<string, unknown>).hpRolls } }))).toBe(true)
  })

  it('o estado de jogo: sem a data e sem o retrato dos números da ficha', () => {
    seed()
    const local = syncLocal.read(P1)!
    const same = { ...createPlayState('k1'), damageTaken: 4, updatedAt: 777 } as unknown as Record<string, unknown>
    expect(syncLocal.sameContent(local, remotePlay({ state: same }))).toBe(true)
    expect(syncLocal.sameContent(local, remotePlay({ state: { ...same, damageTaken: 5 } }))).toBe(false)
  })
})

describe('a cópia de conflito', () => {
  it('a hora vai no nome, no horário do aparelho', () => {
    expect(formatConflictMoment(NOW)).toBe('21/11 14:32')
  })

  it('a ficha que perdeu vira uma ficha nova, marcada para subir', () => {
    seed()
    updateSyncMeta(meta => { meta.docs = {} })
    syncLocal.saveConflictCopy(syncLocal.read(K1)!, NOW)

    const copy = loadDnd().find(sheet => sheet.id !== 'k1')!
    expect(copy.draft.name).toBe('Krusk (conflito 21/11 14:32)')
    expect(copy.draft.class).toBe(COMPLETE_DRAFT.class)
    expect(loadSyncMeta().docs[characterKey('dnd5e', copy.id)]).toEqual({ revision: 0, dirty: true })
  })

  it('a versão do servidor que perdeu também vira cópia, no sistema dela', () => {
    syncLocal.saveConflictCopy(remoteSheet({ id: 'o1', system: 'ordem', step: 'name', draft: agent({ nex: 50 }) as unknown as Record<string, unknown> }), NOW)
    expect(loadOrdem()).toMatchObject([{ draft: { name: 'Agente Lia (conflito 21/11 14:32)', nex: 50 } }])
    expect(loadOrdem()[0].id).not.toBe('o1')
  })

  it('o estado de jogo que perdeu vira uma cópia da ficha com ele dentro', () => {
    seed()
    syncLocal.saveConflictCopy(remotePlay(), NOW)

    const copy = loadDnd().find(sheet => sheet.id !== 'k1')!
    expect(copy.draft.name).toBe('Krusk (jogo em conflito 21/11 14:32)')
    expect(loadPlayState(copy.id)).toMatchObject({ characterId: copy.id, damageTaken: 7 })
    // O da ficha original não mudou.
    expect(loadPlayState('k1')?.damageTaken).toBe(4)
    expect(loadSyncMeta().docs[playKey(copy.id)]).toEqual({ revision: 0, dirty: true })
  })

  it('o que não parece ficha não tem o que copiar', () => {
    syncLocal.saveConflictCopy(remoteSheet({ draft: { level: 3 } }), NOW)
    syncLocal.saveConflictCopy(remotePlay(), NOW)
    expect(loadDnd()).toEqual([])
  })
})

describe('sair da conta e reler as bibliotecas', () => {
  it('limpar apaga as fichas, os estados de jogo e o diário, e poupa o que é do aparelho', () => {
    seed()
    saveOpenPlayId('k1')
    savePlayPreferences({ appDice: true, keepScreenOn: false })
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ lastBackupAt: 5 }))

    wipeLocalSheets()
    expect(syncLocal.keys()).toEqual([])
    expect(loadOpenPlayId()).toBeNull()
    expect(localStorage.getItem(SYNC_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(PLAY_PREFERENCES_KEY)!)).toEqual({ appDice: true, keepScreenOn: false })
    expect(localStorage.getItem(DEVICE_KEY)).not.toBeNull()
  })

  it('reler põe nos dois stores o que a sincronização gravou', () => {
    syncLocal.applyRemote(remoteSheet())
    syncLocal.applyRemote(remoteSheet({ id: 'o1', system: 'ordem', step: 'name', draft: agent() as unknown as Record<string, unknown> }))
    expect(useCharacterStore.getState().library).toEqual([])
    reloadLibraries()
    expect(useCharacterStore.getState().library.map(c => c.id)).toEqual(['k1'])
    expect(useOrdemStore.getState().library.map(c => c.id)).toEqual(['o1'])
  })
})

describe('o motor sobre o aparelho de verdade', () => {
  /** O motor com o adaptador e o diário reais, contra o servidor de mentira. */
  function engineFor(server: ReturnType<typeof createFakeServer>, clock: { now: number }) {
    updateSyncMeta(meta => { meta.owner = USER })
    return createSyncEngine({
      api: server.api,
      local: syncLocal,
      meta: { load: loadSyncMeta, update: updateSyncMeta },
      host: { accountId: () => USER.id, isAtRest: () => true, flushPendingEdits: () => {}, onRemoteApplied: reloadLibraries, now: () => clock.now },
    })
  }

  it('as fichas de antes da conta sobem inteiras, e o servidor devolve exatamente o que subiu', async () => {
    seed()
    // Como num aparelho de antes da conta: há fichas, e o diário nunca ouviu falar delas.
    localStorage.removeItem(SYNC_KEY)
    const server = createFakeServer()
    const before = { dnd: loadDnd(), ordem: loadOrdem(), play: loadPlayState('k1') }

    expect(await engineFor(server, { now: NOW }).sync()).toBe('synced')
    expect(Object.keys(server.alive()).sort()).toEqual([K1, O1, P1].sort())
    expect(server.alive()[K1]).toEqual(before.dnd[0].draft)
    expect(server.characters().find(c => c.id === 'k1')).toMatchObject({ system: 'dnd5e', step: 'review', schema: 1, clientUpdatedAt: 1000 })

    // Outro aparelho da mesma conta: começa vazio e recebe tudo.
    localStorage.clear()
    useCharacterStore.setState({ library: [] })
    expect(await engineFor(server, { now: NOW }).sync()).toBe('synced')
    expect(loadDnd()).toEqual(before.dnd)
    expect(loadOrdem()).toEqual(before.ordem)
    expect(loadPlayState('k1')).toEqual(before.play)
    // As telas foram avisadas.
    expect(useCharacterStore.getState().library).toEqual(before.dnd)
    expect(Object.values(loadSyncMeta().docs).every(doc => !doc.dirty)).toBe(true)
  })

  it('a alteração feita em outro aparelho chega sem conflito, e a exclusão também', async () => {
    seed()
    const server = createFakeServer()
    const engine = engineFor(server, { now: NOW })
    await engine.sync()

    // Outro aparelho altera a ficha do D&D e apaga a do Ordem.
    await server.api.putCharacter('k1', { system: 'dnd5e', step: 'review', draft: krusk({ name: 'Krusk, o Velho' }) as unknown as Record<string, unknown>, schema: 1, clientUpdatedAt: 9000, baseRevision: 1 })
    await server.api.deleteCharacter('o1', 1)

    await engine.sync()
    expect(loadDnd()[0]).toMatchObject({ updatedAt: 9000, draft: { name: 'Krusk, o Velho' } })
    expect(loadOrdem()).toEqual([])
    expect(loadPlayState('k1')?.damageTaken).toBe(4)
  })
})
