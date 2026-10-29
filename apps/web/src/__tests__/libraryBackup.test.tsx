import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import App from '../App'
import { useAppStore } from '../core/stores/appStore'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../systems/ordem/stores/characterStore'
import {
  BACKUP_FILE_FORMAT,
  buildBackupFile,
  exportAllCharacters,
  formatRestoreResult,
  isBackupFile,
  parseBackupFile,
  planRestore,
  type BackupFile,
} from '../libraryBackup'
import { buildCharacterFile, CHARACTER_FILE_FORMAT, CHARACTER_FILE_VERSION, loadLibrary as loadDnd, type SavedCharacter as DndSaved } from '../systems/dnd5e/utils/storage'
import { loadLibrary as loadOrdem, type SavedCharacter as OrdemSaved } from '../systems/ordem/utils/storage'
import { loadPlayState, savePlayState } from '../systems/dnd5e/utils/playStorage'
import { loadDeviceState } from '../core/utils/deviceStorage'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { EMPTY_DRAFT as ORDEM_EMPTY } from '@rpg/rules/systems/ordem/types/character'
import { applyDamage, createPlayState } from '@rpg/rules/systems/dnd5e/utils/playState'
import { buildPlaySheet } from '@rpg/rules/systems/dnd5e/utils/playSheet'
import type { PlayState } from '@rpg/rules/systems/dnd5e/types/playState'

const AGENT = {
  ...ORDEM_EMPTY,
  name: 'Bianca',
  attributes: { agility: 2, strength: 2, intellect: 2, presence: 2, vigor: 1 },
  origin: 'academic',
  class: 'combatant' as const,
}

const dndChar = (id: string, name = 'Krusk'): DndSaved =>
  ({ id, updatedAt: 1000, step: 'review', draft: { ...structuredClone(COMPLETE_DRAFT), name } })
const ordemChar = (id: string): OrdemSaved => ({ id, updatedAt: 2000, step: 'name', draft: structuredClone(AGENT) })

/** Um estado de jogo com 3 de dano, para a cópia levar alguma coisa jogada. */
function hurt(characterId: string): PlayState {
  return applyDamage(createPlayState(characterId, 500), buildPlaySheet(COMPLETE_DRAFT), { amount: 3 }).state
}

/** A cópia como ela chega do arquivo: o JSON baixado, lido de novo. */
const viaFile = (file: BackupFile): unknown => JSON.parse(JSON.stringify(file))

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.setState({ library: [] })
  useOrdemStore.setState({ library: [] })
  useAppStore.getState().setActiveSystem(null)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('o arquivo da cópia de todas as fichas', () => {
  it('leva as fichas dos dois sistemas, cada uma no formato do exportar dela, com o estado de jogo', () => {
    const state = hurt('char-a')
    const file = buildBackupFile([dndChar('char-a')], [ordemChar('ag-1')], id => (id === 'char-a' ? state : null), 123)
    expect(file.format).toBe(BACKUP_FILE_FORMAT)
    expect(file.exportedAt).toBe(123)
    expect(file.characters).toHaveLength(2)
    const [dnd, ordem] = file.characters
    // O mesmo envelope do arquivo de uma ficha do D&D (draft + estado lado a lado).
    expect(dnd).toEqual({ system: 'dnd5e', file: buildCharacterFile(dndChar('char-a').draft, state) })
    expect(dnd.system === 'dnd5e' && dnd.file.format).toBe(CHARACTER_FILE_FORMAT)
    expect(dnd.system === 'dnd5e' && dnd.file.version).toBe(CHARACTER_FILE_VERSION)
    expect(ordem).toEqual({ system: 'ordem', file: AGENT })
  })

  it('lida de volta pelo mesmo caminho do importar de uma ficha', () => {
    const state = hurt('char-a')
    const raw = viaFile(buildBackupFile([dndChar('char-a')], [ordemChar('ag-1')], () => state, 1))
    expect(isBackupFile(raw)).toBe(true)
    const contents = parseBackupFile(raw)!
    expect(contents.invalid).toBe(0)
    expect(contents.dnd5e).toHaveLength(1)
    expect(contents.dnd5e[0].draft.name).toBe('Krusk')
    // O estado vem sem o id da ficha de lá: quem grava usa o da ficha nova.
    expect(contents.dnd5e[0].playState?.characterId).toBe('')
    expect(contents.dnd5e[0].playState?.damageTaken).toBe(state.damageTaken)
    expect(contents.ordem.map(d => d.name)).toEqual(['Bianca'])
  })

  it('entrada que não parece ficha é contada e ignorada; o arquivo de uma ficha não é cópia', () => {
    const raw = { format: BACKUP_FILE_FORMAT, version: 1, exportedAt: 1, characters: [{ system: 'dnd5e', file: { lixo: true } }, 'x', { system: 'pathfinder', file: {} }] }
    expect(parseBackupFile(raw)).toEqual({ dnd5e: [], ordem: [], invalid: 3 })
    const single = viaFile(buildCharacterFile(COMPLETE_DRAFT, null) as unknown as BackupFile)
    expect(isBackupFile(single)).toBe(false)
    expect(parseBackupFile(single)).toBeNull()
    expect(parseBackupFile({ format: BACKUP_FILE_FORMAT })).toBeNull()
  })
})

describe('planRestore: o que entra de uma cópia', () => {
  it('a ficha igual à daqui (ficha e estado de jogo) fica de fora; qualquer diferença entra como nova', () => {
    const state = hurt('char-a')
    const raw = viaFile(buildBackupFile([dndChar('char-a'), dndChar('char-b', 'Bruna')], [ordemChar('ag-1')], id => (id === 'char-a' ? state : null), 1))
    const contents = parseBackupFile(raw)!

    // Aqui: a Krusk igual (com o mesmo estado), a Bruna jogada depois da cópia, a Bianca igual.
    const here = {
      dnd5e: [dndChar('local-a'), dndChar('local-b', 'Bruna')],
      ordem: [ordemChar('local-ag')],
      playStateOf: (id: string) => (id === 'local-a' ? { ...state, characterId: 'local-a' } : id === 'local-b' ? hurt('local-b') : null),
    }
    const plan = planRestore(contents, here)
    expect(plan.dnd5e.map(c => c.draft.name)).toEqual(['Bruna'])
    expect(plan.ordem).toEqual([])
    expect(plan.alreadyHere).toBe(2)
  })

  it('o que a galeria diz', () => {
    const base = { dnd5e: [], ordem: [], invalid: 0, alreadyHere: 0 }
    const one = parseBackupFile(viaFile(buildBackupFile([dndChar('a')], [], () => null, 1)))!.dnd5e
    expect(formatRestoreResult({ ...base, dnd5e: one })).toBe('Cópia restaurada: 1 ficha entrou na galeria.')
    expect(formatRestoreResult({ ...base, dnd5e: [...one, ...one], ordem: [AGENT], alreadyHere: 2, invalid: 1 }))
      .toBe('Cópia restaurada: 3 fichas entraram na galeria. 2 fichas iguais às daqui ficaram de fora. Um item não parecia ficha e foi ignorado.')
    expect(formatRestoreResult({ ...base, alreadyHere: 4 })).toBe('Todas as fichas da cópia já estão aqui.')
    expect(formatRestoreResult(base)).toBe('A cópia não tem fichas.')
  })
})

describe('exportar todas', () => {
  it('baixa um arquivo com as fichas e os estados deste navegador e anota a data da cópia', async () => {
    useCharacterStore.getState().restoreCharacters([{ draft: structuredClone(COMPLETE_DRAFT), playState: hurt('') }])
    useOrdemStore.getState().restoreCharacters([structuredClone(AGENT)])
    let blob: Blob | null = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b as Blob; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('forja-de-herois-fichas-2026-10-29.json')
    })

    exportAllCharacters(new Date(2026, 9, 29, 21, 0).getTime())

    expect(click).toHaveBeenCalledTimes(1)
    const file = JSON.parse(await blob!.text()) as BackupFile
    expect(file.characters.map(c => c.system)).toEqual(['dnd5e', 'ordem'])
    const dnd = file.characters[0]
    expect(dnd.system === 'dnd5e' && dnd.file.playState?.characterId).toBe(loadDnd()[0].id)
    expect(loadDeviceState().lastBackupAt).toBe(new Date(2026, 9, 29, 21, 0).getTime())
  })
})

describe('na galeria', () => {
  function chooseFile(content: unknown) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([JSON.stringify(content)], 'copia.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
  }

  it('"Exportar todas" só aparece com ficha salva', () => {
    const { unmount } = render(<App />)
    expect(screen.queryByText('↓ Exportar todas')).toBeNull()
    unmount()
    useCharacterStore.getState().restoreCharacters([{ draft: structuredClone(COMPLETE_DRAFT), playState: null }])
    render(<App />)
    expect(screen.getByText('↓ Exportar todas')).toBeInTheDocument()
  })

  it('importar a cópia põe as fichas na galeria, com o estado de jogo, sem sair dela; de novo, nada dobra', async () => {
    const state = hurt('char-a')
    const backup = buildBackupFile([dndChar('char-a')], [ordemChar('ag-1')], () => state, 1)
    render(<App />)
    // Montada vazia, antes do texto.
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    chooseFile(backup)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cópia restaurada: 2 fichas entraram na galeria.'))
    expect(screen.getByText('Krusk')).toBeInTheDocument()
    expect(screen.getByText('Bianca')).toBeInTheDocument()
    expect(useAppStore.getState().activeSystemId).toBeNull()
    const [krusk] = loadDnd()
    expect(loadPlayState(krusk.id)?.damageTaken).toBe(state.damageTaken)
    expect(loadOrdem()).toHaveLength(1)

    chooseFile(backup)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Todas as fichas da cópia já estão aqui.'))
    expect(loadDnd()).toHaveLength(1)
    expect(loadOrdem()).toHaveLength(1)
  })

  it('o arquivo de uma ficha continua abrindo a ficha no criador', async () => {
    savePlayState(hurt('nada'))
    render(<App />)
    chooseFile(buildCharacterFile(COMPLETE_DRAFT, null))
    await waitFor(() => expect(useAppStore.getState().activeSystemId).toBe('dnd5e'))
    expect(useCharacterStore.getState().view).toBe('wizard')
  })
})
