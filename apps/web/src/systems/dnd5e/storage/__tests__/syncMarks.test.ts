import { describe, it, expect, beforeEach } from 'vitest'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { EMPTY_DRAFT } from '@rpg/rules/systems/dnd5e/types/character'
import { createPlayState } from '@rpg/rules/systems/dnd5e/utils/playState'
import { characterKey, loadSyncMeta, playKey, updateSyncMeta } from '../../../../core/sync/syncStorage'
import {
  SYSTEM_ID, clearLibrary, deleteCharacterEntry, loadLibrary, putSyncedCharacter, readSyncedCharacter,
  removeSyncedCharacter, saveCharacterEntry, saveSession, type SavedCharacter,
} from '../storage'
import {
  PLAY_OPEN_KEY, PLAY_PREFERENCES_KEY, clearPlayStorage, deletePlayState, listPlayStateIds, loadPlayState,
  putSyncedPlayState, removeSyncedPlayState, saveOpenPlayId, savePlayPreferences, savePlayState,
} from '../playStorage'

/**
 * O que as camadas de storage do D&D escrevem no diário da sincronização (`core/sync/syncStorage`):
 * a marca nasce dentro da gravação, e nenhum store ou componente precisa lembrar de chamá-la.
 */
const KEY = characterKey(SYSTEM_ID, 'k1')
const PLAY = playKey('k1')

const sheet = (over: Partial<SavedCharacter> = {}): SavedCharacter => ({
  id: 'k1', updatedAt: 1000, step: 'name', draft: structuredClone(COMPLETE_DRAFT), ...over,
})

/** O documento no diário passa a estar em dia, na revisão dada (como depois de um envio aceito). */
const synced = (key: string, revision: number) => updateSyncMeta(meta => { meta.docs[key] = { revision, dirty: false } })

beforeEach(() => localStorage.clear())

describe('gravar a ficha', () => {
  it('ficha nova fica marcada para subir, na revisão 0', () => {
    saveCharacterEntry(sheet())
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 0, dirty: true })
  })

  it('draft diferente do salvo marca; a revisão conhecida fica', () => {
    saveCharacterEntry(sheet())
    synced(KEY, 3)
    saveCharacterEntry(sheet({ draft: { ...structuredClone(COMPLETE_DRAFT), name: 'Outro nome' } }))
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 3, dirty: true })
  })

  it('regravar o mesmo draft (navegar entre as etapas, abrir e voltar) não marca nada', () => {
    saveCharacterEntry(sheet())
    synced(KEY, 3)
    saveCharacterEntry(sheet({ step: 'review', updatedAt: 9999 }))
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 3, dirty: false })
    // A etapa e a data foram gravadas no aparelho: viajam na próxima alteração de verdade.
    expect(loadLibrary()[0]).toMatchObject({ step: 'review', updatedAt: 9999 })
  })

  it('a ordem das chaves do draft não conta como mudança', () => {
    saveCharacterEntry(sheet())
    synced(KEY, 1)
    const reordered = Object.fromEntries(Object.entries(structuredClone(COMPLETE_DRAFT)).reverse()) as typeof COMPLETE_DRAFT
    saveCharacterEntry(sheet({ draft: reordered }))
    expect(loadSyncMeta().docs[KEY].dirty).toBe(false)
  })

  it('a sessão antiga migrada para a biblioteca não é marcada: sem entrada, conta como a enviar', () => {
    saveSession({ ...structuredClone(EMPTY_DRAFT), name: 'De antes' }, 'race')
    const [migrated] = loadLibrary()
    expect(migrated.draft.name).toBe('De antes')
    expect(loadSyncMeta().docs).toEqual({})
  })
})

describe('apagar a ficha', () => {
  it('a que o servidor tem vira lápide a enviar', () => {
    saveCharacterEntry(sheet())
    synced(KEY, 4)
    deleteCharacterEntry('k1')
    expect(loadLibrary()).toEqual([])
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 4, dirty: true, deleted: true })
  })

  it('a que nunca subiu só some do diário', () => {
    saveCharacterEntry(sheet())
    deleteCharacterEntry('k1')
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('apagar um id que não está na biblioteca não cria lápide', () => {
    synced(KEY, 4)
    deleteCharacterEntry('k1')
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 4, dirty: false })
  })
})

describe('o que vem do servidor não marca nada', () => {
  it('gravar e tirar a ficha sincronizada deixam o diário como estava', () => {
    putSyncedCharacter(sheet())
    expect(loadLibrary()).toHaveLength(1)
    expect(loadSyncMeta().docs).toEqual({})

    synced(KEY, 2)
    putSyncedCharacter(sheet({ draft: { ...structuredClone(COMPLETE_DRAFT), name: 'Do servidor' }, updatedAt: 5000 }))
    expect(loadLibrary()[0]).toMatchObject({ updatedAt: 5000, draft: { name: 'Do servidor' } })
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 2, dirty: false })

    removeSyncedCharacter('k1')
    expect(loadLibrary()).toEqual([])
    expect(loadSyncMeta().docs[KEY]).toEqual({ revision: 2, dirty: false })
  })

  it('a ficha remota entra como a do aparelho: com os padrões, sem perder nada do conteúdo', () => {
    const remote = { ...structuredClone(COMPLETE_DRAFT), campoDeUmAppMaisNovo: { x: 1 } }
    const read = readSyncedCharacter({ id: 'k1', step: 'review', draft: remote, updatedAt: 7 })
    expect(read).toMatchObject({ id: 'k1', step: 'review', updatedAt: 7 })
    expect(read?.draft).toEqual(remote)

    // Draft de antes de um campo existir ganha o padrão, como ao ler do aparelho.
    const old = readSyncedCharacter({ id: 'k1', step: 'name', draft: { name: 'Antiga' }, updatedAt: 7 })
    expect(old?.draft.classChoices.progressionChoices).toEqual({})
    expect(old?.draft.level).toBe(1)
  })

  it('etapa desconhecida vira a primeira; o que não parece ficha é recusado', () => {
    expect(readSyncedCharacter({ id: 'k1', step: 'etapa-nova', draft: { name: 'x' }, updatedAt: 1 })?.step).toBe('name')
    for (const draft of [null, 'texto', ['lista'], { level: 3 }, { name: 42 }]) {
      expect(readSyncedCharacter({ id: 'k1', step: 'name', draft, updatedAt: 1 })).toBeNull()
    }
  })

  it('limpar a biblioteca apaga as fichas do aparelho e a sessão antiga', () => {
    saveCharacterEntry(sheet())
    saveSession(structuredClone(EMPTY_DRAFT), 'name')
    clearLibrary()
    expect(loadLibrary()).toEqual([])
  })
})

describe('gravar o estado de jogo', () => {
  it('a ação do jogador marca o estado para subir', () => {
    savePlayState({ ...createPlayState('k1'), damageTaken: 4 }, 100)
    expect(loadSyncMeta().docs[PLAY]).toEqual({ revision: 0, dirty: true })

    synced(PLAY, 6)
    savePlayState({ ...createPlayState('k1'), damageTaken: 5 }, 200)
    expect(loadSyncMeta().docs[PLAY]).toEqual({ revision: 6, dirty: true })
  })

  it('o que o app acerta ao abrir o jogo não marca', () => {
    savePlayState({ ...createPlayState('k1'), damageTaken: 4 }, 100)
    synced(PLAY, 6)
    savePlayState({ ...createPlayState('k1'), damageTaken: 4, note: 'reconciliado' }, 200, { quiet: true })
    expect(loadSyncMeta().docs[PLAY]).toEqual({ revision: 6, dirty: false })
    expect(loadPlayState('k1')?.note).toBe('reconciliado')
  })

  it('o estado que nasce só de abrir o jogo entra em dia: não sobe antes da primeira ação', () => {
    savePlayState(createPlayState('k1'), 100, { quiet: true })
    expect(loadSyncMeta().docs[PLAY]).toEqual({ revision: 0, dirty: false })
    savePlayState({ ...createPlayState('k1'), damageTaken: 1 }, 200)
    expect(loadSyncMeta().docs[PLAY]).toEqual({ revision: 0, dirty: true })
  })

  it('o estado de antes da conta, sem entrada no diário, continua sem ela ao abrir o jogo', () => {
    savePlayState({ ...createPlayState('k1'), damageTaken: 4 }, 100)
    updateSyncMeta(meta => { delete meta.docs[PLAY] })
    savePlayState({ ...createPlayState('k1'), damageTaken: 4 }, 200, { quiet: true })
    // Sem entrada, a varredura da sincronização o trata como a enviar.
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('apagar o estado tira a entrada do diário, sem lápide', () => {
    savePlayState(createPlayState('k1'), 100)
    synced(PLAY, 2)
    deletePlayState('k1')
    expect(loadPlayState('k1')).toBeNull()
    expect(loadSyncMeta().docs).toEqual({})
  })
})

describe('o estado de jogo que vem do servidor', () => {
  it('é gravado com a data que veio, e não marca nada', () => {
    const saved = putSyncedPlayState({ ...createPlayState('k1'), damageTaken: 7, updatedAt: 4242 })
    expect(saved.updatedAt).toBe(4242)
    expect(loadPlayState('k1')).toMatchObject({ damageTaken: 7, updatedAt: 4242 })
    expect(loadSyncMeta().docs).toEqual({})

    removeSyncedPlayState('k1')
    removeSyncedPlayState('nunca-existiu')
    expect(listPlayStateIds()).toEqual([])
    expect(loadSyncMeta().docs).toEqual({})
  })

  it('limpar apaga os estados e a ficha aberta no jogo, e poupa as preferências do aparelho', () => {
    savePlayState(createPlayState('k1'), 100)
    saveOpenPlayId('k1')
    savePlayPreferences({ appDice: true, keepScreenOn: false })
    clearPlayStorage()
    expect(listPlayStateIds()).toEqual([])
    expect(localStorage.getItem(PLAY_OPEN_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(PLAY_PREFERENCES_KEY)!)).toEqual({ appDice: true, keepScreenOn: false })
  })
})
