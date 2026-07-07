import { describe, it, expect, beforeEach } from 'vitest'
import { saveSession, loadSession, clearSession, importCharacter, SESSION_VERSION } from '../storage'
import { EMPTY_DRAFT } from '../../types/character'

const SESSION_KEY = 'dnd-character-session'

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

describe('importCharacter', () => {
  function makeFile(content: string): File {
    return new File([content], 'ficha.json', { type: 'application/json' })
  }

  it('aceita um arquivo de ficha válida e devolve o draft sanitizado', async () => {
    const draft = await importCharacter(
      makeFile(JSON.stringify({ name: 'Krusk', abilityScores: { STR: 15 } })),
    )
    expect(draft?.name).toBe('Krusk')
    expect(draft?.abilityScores.STR).toBe(15)
    // estruturas aninhadas obrigatórias existem mesmo sem constar no arquivo
    expect(draft?.classChoices.subclassExtras).toEqual({})
    expect(draft?.equipment.method).toBeNull()
    expect(draft?.hpRolls).toEqual([])
  })

  it('rejeita JSON sintaticamente inválido', async () => {
    expect(await importCharacter(makeFile('{isso não é json'))).toBeNull()
  })

  it('rejeita JSON que não é uma ficha', async () => {
    expect(await importCharacter(makeFile(JSON.stringify([1, 2, 3])))).toBeNull()
    expect(await importCharacter(makeFile(JSON.stringify({ foo: 'bar' })))).toBeNull()
  })
})
