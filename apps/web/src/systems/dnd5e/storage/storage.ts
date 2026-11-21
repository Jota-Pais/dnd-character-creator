import type { CharacterDraft, WizardStep } from '@rpg/rules/systems/dnd5e/types/character'
import { EMPTY_DRAFT, WIZARD_STEPS } from '@rpg/rules/systems/dnd5e/types/character'
import type { PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import { canonicalJson } from '@rpg/rules/core/utils/canonicalJson'
import { createId } from '@rpg/rules/core/utils/id'
import { sanitizeImportedDraft } from '@rpg/rules/systems/dnd5e/utils/draftValidation'
import { sanitizePlayState } from '@rpg/rules/systems/dnd5e/utils/playState'
import { loadPlayState } from './playStorage'
import { requestPersistentStorage } from '../../../core/pwa/persistentStorage'
import { characterKey, markDocChanged, markDocDeleted } from '../../../core/sync/syncStorage'
import { saveJsonFile } from '../../../core/utils/download'

const SESSION_KEY = 'dnd-character-session'
const LIBRARY_KEY = 'dnd-character-library'
// Bump this whenever CharacterDraft schema changes in a breaking way
export const SESSION_VERSION = 4
export const LIBRARY_VERSION = 1

/** O nome do sistema nas chaves da sincronização e no servidor. */
export const SYSTEM_ID = 'dnd5e'

/**
 * O número da forma do draft na sincronização. O aparelho que recebe do servidor uma ficha com
 * número maior que o seu não a aplica nem a regrava, e pede a atualização do app: ele ainda não
 * conhece os campos novos. Sobe quando o draft ganha um campo (o teste de `syncSchema.test.ts`
 * prende a lista de campos a este número, para ninguém esquecer).
 */
export const DRAFT_SYNC_SCHEMA = 1

/** Uma ficha salva na biblioteca (com o passo do wizard em que parou). */
export type SavedCharacter = {
  id: string
  updatedAt: number
  step: WizardStep
  draft: CharacterDraft
}

type Library = { version: number; characters: SavedCharacter[] }

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Preenche campos ausentes de um draft carregado com os padrões (compat de schema). */
function withDraftDefaults(partial: Partial<CharacterDraft> | undefined): CharacterDraft {
  const draft = { ...EMPTY_DRAFT, ...partial } as CharacterDraft
  draft.spellChoices ??= { cantrips: [], spells: [] }
  draft.level ??= 1
  draft.hpMethod ??= 'average'
  draft.hpRolls ??= []
  draft.asiChoices ??= []
  // classChoices é um objeto aninhado: o spread raso acima o substitui inteiro por
  // partial.classChoices, então precisamos re-preencher campos ausentes (ex.:
  // progressionChoices em fichas salvas antes da fase 3.5b) para não quebrar em runtime.
  draft.classChoices = { ...EMPTY_DRAFT.classChoices, ...draft.classChoices }
  return draft
}

// ── Sessão única (legado — mantida só para migrar para a biblioteca) ─────────

type Session = { version: number; draft: CharacterDraft; step: WizardStep }

export function saveSession(draft: CharacterDraft, step: WizardStep): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ version: SESSION_VERSION, draft, step }))
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Partial<Session>
    if (session.version !== SESSION_VERSION) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return { version: SESSION_VERSION, draft: withDraftDefaults(session.draft), step: session.step ?? 'name' }
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

// ── Biblioteca de fichas ─────────────────────────────────────────────────────

function writeLibrary(characters: SavedCharacter[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: LIBRARY_VERSION, characters } satisfies Library))
  // A primeira gravação de ficha da sessão pede ao navegador para não apagar o que o site guarda.
  requestPersistentStorage()
}

/**
 * Carrega a biblioteca. Na primeira execução após a introdução da biblioteca,
 * migra a sessão única antiga (se existir) para uma ficha da biblioteca.
 */
export function loadLibrary(): SavedCharacter[] {
  const raw = localStorage.getItem(LIBRARY_KEY)
  if (!raw) {
    // migração da sessão única legada
    const legacy = loadSession()
    if (legacy) {
      const migrated: SavedCharacter = {
        id: newId(),
        updatedAt: Date.now(),
        step: legacy.step,
        draft: legacy.draft,
      }
      writeLibrary([migrated])
      clearSession()
      return [migrated]
    }
    return []
  }
  try {
    const lib = JSON.parse(raw) as Partial<Library>
    if (lib.version !== LIBRARY_VERSION || !Array.isArray(lib.characters)) {
      localStorage.removeItem(LIBRARY_KEY)
      return []
    }
    return lib.characters
      .filter(c => c && typeof c.id === 'string')
      .map(c => ({
        id: c.id,
        updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
        step: c.step ?? 'name',
        draft: withDraftDefaults(c.draft),
      }))
  } catch {
    localStorage.removeItem(LIBRARY_KEY)
    return []
  }
}

/**
 * Insere ou atualiza uma ficha na biblioteca; devolve a lista atualizada. Ficha nova, ou com o
 * draft diferente do que estava salvo, fica marcada para subir ao servidor (o diário de
 * `core/sync/syncStorage.ts`), aqui dentro: nenhum store ou componente precisa lembrar. Regravar o
 * mesmo draft (navegar entre as etapas, abrir e voltar) não marca nada: a etapa e a data viajam
 * junto na próxima alteração de verdade.
 */
export function saveCharacterEntry(entry: SavedCharacter): SavedCharacter[] {
  const characters = loadLibrary()
  const idx = characters.findIndex(c => c.id === entry.id)
  const previous = idx >= 0 ? characters[idx] : undefined
  // Antes de gravar a ficha: se a página cair entre as duas gravações, sobra um envio a mais.
  if (!previous || canonicalJson(previous.draft) !== canonicalJson(entry.draft)) {
    markDocChanged(characterKey(SYSTEM_ID, entry.id))
  }
  if (idx >= 0) characters[idx] = entry
  else characters.push(entry)
  writeLibrary(characters)
  return characters
}

/**
 * Remove uma ficha da biblioteca; devolve a lista atualizada. É aqui, e só aqui, que nasce a
 * exclusão que sobe ao servidor: ficha que some do aparelho por outro caminho nunca é apagada lá.
 */
export function deleteCharacterEntry(id: string): SavedCharacter[] {
  const all = loadLibrary()
  const characters = all.filter(c => c.id !== id)
  if (characters.length !== all.length) markDocDeleted(characterKey(SYSTEM_ID, id))
  writeLibrary(characters)
  return characters
}

// ── O que só a sincronização usa ─────────────────────────────────────────────
// Gravar e apagar SEM marcar nada no diário: é o que veio do servidor, e marcá-lo o mandaria de
// volta. Só o adaptador de features/sync importa estas funções (um teste prende isso).

/**
 * A ficha que veio do servidor, como a biblioteca a guarda; null se não parece uma ficha (aí ela
 * não é aplicada, e nada do aparelho é sobrescrito). O draft passa pelo mesmo tratamento do que se
 * lê do aparelho (`withDraftDefaults`), e não pelo sanitizador de arquivo importado: quem o gravou
 * foi este mesmo app, em outro aparelho, e a sincronização não pode mudar o conteúdo no caminho.
 */
export function readSyncedCharacter(raw: { id: string; step: string; draft: unknown; updatedAt: number }): SavedCharacter | null {
  if (!isRecord(raw.draft) || typeof raw.draft.name !== 'string') return null
  const step = (WIZARD_STEPS as readonly string[]).includes(raw.step) ? (raw.step as WizardStep) : 'name'
  return { id: raw.id, updatedAt: raw.updatedAt, step, draft: withDraftDefaults(raw.draft as Partial<CharacterDraft>) }
}

/** Grava na biblioteca a ficha que veio do servidor. */
export function putSyncedCharacter(entry: SavedCharacter): void {
  const characters = loadLibrary()
  const idx = characters.findIndex(c => c.id === entry.id)
  if (idx >= 0) characters[idx] = entry
  else characters.push(entry)
  writeLibrary(characters)
}

/** Tira da biblioteca a ficha que foi apagada em outro aparelho. */
export function removeSyncedCharacter(id: string): void {
  const all = loadLibrary()
  const characters = all.filter(c => c.id !== id)
  if (characters.length !== all.length) writeLibrary(characters)
}

/** Apaga a biblioteca deste aparelho (ao sair da conta: as fichas continuam no servidor). */
export function clearLibrary(): void {
  localStorage.removeItem(LIBRARY_KEY)
  localStorage.removeItem(SESSION_KEY)
}

/** Gera um id único para uma ficha (o gerador comum do núcleo). */
export function newId(): string {
  return createId('char')
}

// ── Arquivo exportado ────────────────────────────────────────────────────────

/**
 * O arquivo de ficha exportado (decisão 10.2.3 do modo de jogo: leva o estado de jogo junto). A
 * ficha e o estado ficam lado a lado, como no navegador (cada um na sua chave), e o estado leva a
 * versão dele (`PlayState.version`). A versão 1 era o draft solto, sem envelope e sem estado de
 * jogo: `parseCharacterFile` continua aceitando.
 */
export const CHARACTER_FILE_FORMAT = 'dnd5e-character'
export const CHARACTER_FILE_VERSION = 2

export type CharacterFile = {
  format: typeof CHARACTER_FILE_FORMAT
  version: number
  draft: CharacterDraft
  /** O estado de jogo da ficha; null se ela nunca foi jogada. */
  playState: PlayState | null
}

/**
 * A ficha lida de um arquivo: o draft e o estado de jogo, os dois sanitizados. O `characterId` do
 * estado sai vazio: o id da ficha no outro navegador não vale aqui, e quem grava (`importDraft`)
 * usa o da ficha nova.
 */
export type ImportedCharacter = { draft: CharacterDraft; playState: PlayState | null }

export function buildCharacterFile(draft: CharacterDraft, playState: PlayState | null): CharacterFile {
  return { format: CHARACTER_FILE_FORMAT, version: CHARACTER_FILE_VERSION, draft, playState }
}

/**
 * Lê o JSON de um arquivo de ficha: o envelope atual ou o draft solto dos arquivos antigos (sem
 * estado de jogo). Null se o draft não parece uma ficha; estado de jogo estragado vira o que o
 * sanitizador consegue salvar dele, sem recusar a ficha.
 */
export function parseCharacterFile(raw: unknown): ImportedCharacter | null {
  if (!isRecord(raw) || raw.format !== CHARACTER_FILE_FORMAT) {
    const draft = sanitizeImportedDraft(raw)
    return draft ? { draft, playState: null } : null
  }
  const draft = sanitizeImportedDraft(raw.draft)
  if (!draft) return null
  return { draft, playState: isRecord(raw.playState) ? sanitizePlayState(raw.playState, '') : null }
}

/** Guarda a ficha como JSON (o download; no APK, o "Salvar como"), com o estado de jogo salvo dela (`characterId`; null numa ficha nova). */
export function exportCharacter(character: CharacterDraft, characterId: string | null): void {
  const file = buildCharacterFile(character, characterId ? loadPlayState(characterId) : null)
  saveJsonFile(`${character.name.trim() || 'personagem'}-dnd5e.json`, file)
}

export function importCharacter(file: File): Promise<ImportedCharacter | null> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed: unknown = JSON.parse(e.target?.result as string)
        resolve(parseCharacterFile(parsed))
      } catch {
        resolve(null)
      }
    }
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}
