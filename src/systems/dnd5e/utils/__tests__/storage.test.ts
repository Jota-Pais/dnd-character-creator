import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveSession, loadSession, clearSession, importCharacter, SESSION_VERSION,
  loadLibrary, saveCharacterEntry, deleteCharacterEntry, newId, type SavedCharacter,
  buildCharacterFile, parseCharacterFile, exportCharacter, CHARACTER_FILE_FORMAT, CHARACTER_FILE_VERSION,
} from '../storage'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import { PLAY_STATE_VERSION } from '../../types/playState'
import { sanitizeImportedDraft } from '../draftValidation'
import { createPlayState } from '../playState'
import { savePlayState } from '../playStorage'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'

const SESSION_KEY = 'dnd-character-session'

function entry(name: string): SavedCharacter {
  const draft: CharacterDraft = { ...structuredClone(EMPTY_DRAFT), name }
  return { id: newId(), updatedAt: 1000, step: 'name', draft }
}

beforeEach(() => {
  localStorage.clear()
})

describe('saveSession / loadSession', () => {
  it('roundtrip preserva draft e step', () => {
    const draft = { ...structuredClone(EMPTY_DRAFT), name: 'Krusk', level: 5 }
    saveSession(draft, 'class')
    const session = loadSession()
    expect(session?.draft).toEqual(draft)
    expect(session?.step).toBe('class')
    expect(session?.version).toBe(SESSION_VERSION)
  })

  it('retorna null quando não há sessão salva', () => {
    expect(loadSession()).toBeNull()
  })

  it('descarta sessão de versão antiga e limpa a chave', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ version: SESSION_VERSION - 1, draft: { name: 'Velho' }, step: 'race' }),
    )
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('descarta JSON corrompido e limpa a chave', () => {
    localStorage.setItem(SESSION_KEY, '{isso não é json')
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('preenche campos ausentes do draft com os padrões', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ version: SESSION_VERSION, draft: { name: 'Parcial' } }),
    )
    const session = loadSession()
    expect(session?.draft.name).toBe('Parcial')
    expect(session?.draft.level).toBe(1)
    expect(session?.draft.hpMethod).toBe('average')
    expect(session?.draft.hpRolls).toEqual([])
    expect(session?.draft.spellChoices).toEqual({ cantrips: [], spells: [] })
    expect(session?.step).toBe('name')
  })
})

describe('clearSession', () => {
  it('remove a sessão salva', () => {
    saveSession(structuredClone(EMPTY_DRAFT), 'race')
    clearSession()
    expect(loadSession()).toBeNull()
  })
})

describe('biblioteca', () => {
  it('começa vazia', () => {
    expect(loadLibrary()).toEqual([])
  })

  it('salva (upsert) e carrega fichas', () => {
    const a = entry('Krusk')
    saveCharacterEntry(a)
    saveCharacterEntry(entry('Conan'))
    expect(loadLibrary().length).toBe(2)
    // upsert: salvar com o mesmo id atualiza, não duplica
    saveCharacterEntry({ ...a, draft: { ...a.draft, name: 'Krusk, o Forte' } })
    const lib = loadLibrary()
    expect(lib.length).toBe(2)
    expect(lib.find(c => c.id === a.id)?.draft.name).toBe('Krusk, o Forte')
  })

  it('exclui uma ficha por id', () => {
    const a = entry('Krusk')
    saveCharacterEntry(a)
    saveCharacterEntry(entry('Conan'))
    const remaining = deleteCharacterEntry(a.id)
    expect(remaining.some(c => c.id === a.id)).toBe(false)
    expect(loadLibrary().length).toBe(1)
  })

  it('preenche campos ausentes do draft ao carregar', () => {
    localStorage.setItem(
      'dnd-character-library',
      JSON.stringify({ version: 1, characters: [{ id: 'x', updatedAt: 1, step: 'race', draft: { name: 'Parcial' } }] }),
    )
    const lib = loadLibrary()
    expect(lib[0].draft.asiChoices).toEqual([])
    expect(lib[0].draft.level).toBe(1)
  })

  it('migra a sessão única legada para a biblioteca', () => {
    saveSession({ ...structuredClone(EMPTY_DRAFT), name: 'Legado' }, 'class')
    const lib = loadLibrary()
    expect(lib.length).toBe(1)
    expect(lib[0].draft.name).toBe('Legado')
    expect(lib[0].step).toBe('class')
    // a sessão antiga foi removida após migrar
    expect(loadSession()).toBeNull()
  })
})

describe('importCharacter', () => {
  function makeFile(content: string): File {
    return new File([content], 'ficha.json', { type: 'application/json' })
  }

  it('aceita um arquivo de ficha válida e devolve o draft sanitizado', async () => {
    const imported = await importCharacter(
      makeFile(JSON.stringify({ name: 'Krusk', abilityScores: { STR: 15 } })),
    )
    const draft = imported?.draft
    expect(draft?.name).toBe('Krusk')
    expect(draft?.abilityScores.STR).toBe(15)
    // estruturas aninhadas obrigatórias existem mesmo sem constar no arquivo
    expect(draft?.classChoices.subclassExtras).toEqual({})
    expect(draft?.equipment.method).toBeNull()
    expect(draft?.hpRolls).toEqual([])
    // arquivo antigo (o draft solto): sem estado de jogo
    expect(imported?.playState).toBeNull()
  })

  it('lê o arquivo atual, com o estado de jogo', async () => {
    const file = buildCharacterFile(structuredClone(COMPLETE_DRAFT), { ...createPlayState('c1'), damageTaken: 3 })
    const imported = await importCharacter(makeFile(JSON.stringify(file)))
    expect(imported?.draft.name).toBe('Krusk')
    expect(imported?.playState?.damageTaken).toBe(3)
  })

  it('rejeita JSON sintaticamente inválido', async () => {
    expect(await importCharacter(makeFile('{isso não é json'))).toBeNull()
  })

  it('rejeita JSON que não é uma ficha', async () => {
    expect(await importCharacter(makeFile(JSON.stringify([1, 2, 3])))).toBeNull()
    expect(await importCharacter(makeFile(JSON.stringify({ foo: 'bar' })))).toBeNull()
  })
})

describe('arquivo de ficha com o estado de jogo (decisão 10.2.3)', () => {
  it('o envelope leva a ficha, o estado de jogo e as versões', () => {
    const state = { ...createPlayState('c1', 5), damageTaken: 4, inspiration: true }
    const file = buildCharacterFile(structuredClone(COMPLETE_DRAFT), state)
    expect(file).toMatchObject({ format: CHARACTER_FILE_FORMAT, version: CHARACTER_FILE_VERSION, playState: state })
    expect(file.playState?.version).toBe(PLAY_STATE_VERSION)
    // ida e volta pelo texto: a mesma ficha, o mesmo estado (o id da ficha de origem não vale aqui)
    const back = parseCharacterFile(JSON.parse(JSON.stringify(file)))
    expect(back?.draft).toEqual(sanitizeImportedDraft(COMPLETE_DRAFT))
    expect(back?.playState).toEqual({ ...state, characterId: '' })
  })

  it('ficha que nunca jogou vai sem estado de jogo', () => {
    const back = parseCharacterFile(JSON.parse(JSON.stringify(buildCharacterFile(structuredClone(COMPLETE_DRAFT), null))))
    expect(back?.draft.name).toBe('Krusk')
    expect(back?.playState).toBeNull()
  })

  it('o estado de jogo passa pelo sanitizador; estragado, não recusa a ficha', () => {
    const file = {
      ...buildCharacterFile(structuredClone(COMPLETE_DRAFT), null),
      playState: { damageTaken: -5, tempHp: 2.7, conditions: ['poisoned', 'inventada'], rolls: 'x' },
    }
    const back = parseCharacterFile(file)
    expect(back?.playState).toMatchObject({ damageTaken: 0, tempHp: 2, conditions: ['poisoned'], rolls: [] })
    expect(parseCharacterFile({ ...file, playState: 'lixo' })?.playState).toBeNull()
  })

  it('envelope sem ficha válida é recusado', () => {
    expect(parseCharacterFile({ format: CHARACTER_FILE_FORMAT, version: 2, draft: { foo: 1 }, playState: null })).toBeNull()
    expect(parseCharacterFile({ format: CHARACTER_FILE_FORMAT, version: 2 })).toBeNull()
  })

  it('exportar leva o estado de jogo salvo da ficha', async () => {
    savePlayState({ ...createPlayState('c1'), damageTaken: 6, note: 'Pistas' })
    const blobs: Blob[] = []
    const url = URL as unknown as Record<'createObjectURL' | 'revokeObjectURL', unknown>
    const original = { create: url.createObjectURL, revoke: url.revokeObjectURL }
    url.createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return 'blob:ficha' })
    url.revokeObjectURL = vi.fn()
    // O clique do download navegaria (o jsdom não navega e reclama).
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      exportCharacter(structuredClone(COMPLETE_DRAFT), 'c1')
      exportCharacter(structuredClone(COMPLETE_DRAFT), null)
      expect(click).toHaveBeenCalledTimes(2)
    } finally {
      url.createObjectURL = original.create
      url.revokeObjectURL = original.revoke
      click.mockRestore()
    }
    const [withState, fresh] = await Promise.all(blobs.map(readBlob))
    expect(JSON.parse(withState).playState).toMatchObject({ damageTaken: 6, note: 'Pistas' })
    expect(JSON.parse(fresh).playState).toBeNull()
  })
})

function readBlob(blob: Blob): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsText(blob)
  })
}
