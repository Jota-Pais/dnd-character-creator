/**
 * O diário da sincronização: o que este aparelho sabe sobre cada documento que ele guarda (as
 * fichas e os estados de jogo) em relação ao servidor. Mora na chave `app-sync`, ao lado das
 * bibliotecas, e é a camada que as outras camadas de storage chamam ao gravar: componentes e stores
 * não tocam nela.
 *
 * Por documento, guarda a revisão do servidor que o aparelho conhece e se há alteração local ainda
 * não enviada. Guarda também o cursor da leitura (até onde o aparelho já leu as mudanças da conta)
 * e a conta dona dos dados deste aparelho.
 *
 * O núcleo não conhece os sistemas: a chave de um documento é texto (`character:<sistema>:<id>`,
 * `play:<id da ficha>`), e quem sabe ler e gravar o documento é o adaptador de `features/sync`.
 */

export const SYNC_KEY = 'app-sync'
export const SYNC_META_VERSION = 1

/** `character:<sistema>:<id>` ou `play:<id da ficha>`. */
export type DocKey = string

export const characterKey = (system: string, id: string): DocKey => `character:${system}:${id}`
export const playKey = (characterId: string): DocKey => `play:${characterId}`

export type ParsedDocKey =
  | { kind: 'character'; system: string; id: string }
  | { kind: 'play'; characterId: string }

/** Lê uma chave de documento; null se não for uma. O id pode ter ":" (só o primeiro separa). */
export function parseDocKey(key: DocKey): ParsedDocKey | null {
  if (key.startsWith('play:') && key.length > 5) return { kind: 'play', characterId: key.slice(5) }
  const match = /^character:([^:]+):(.+)$/.exec(key)
  return match ? { kind: 'character', system: match[1], id: match[2] } : null
}

export type DocMeta = {
  /** A revisão do servidor que este aparelho conhece; 0 se o documento nunca subiu. */
  revision: number
  /** Há alteração local que o servidor ainda não tem. */
  dirty: boolean
  /** A ficha foi apagada aqui e a exclusão ainda não subiu (a lápide pendente). */
  deleted?: true
  /**
   * O servidor tem uma versão mais nova que ganha da local, mas o documento estava aberto: nada é
   * escrito por cima do que está na tela, e a troca espera a volta à galeria.
   */
  blocked?: true
  /** O servidor recusou este documento (grande demais, inválido): não se repete até ele mudar. */
  refused?: true
  /** O servidor tem este documento numa forma mais nova que a deste app: nem aplica, nem envia. */
  outdated?: true
}

/** A conta dona dos dados deste aparelho. */
export type SyncOwner = { id: string; email: string }

export type SyncMeta = {
  version: number
  /** `null`: as fichas do aparelho ainda não são de conta nenhuma (são de antes do login). */
  owner: SyncOwner | null
  /** Até onde este aparelho já leu as mudanças da conta; `null` pede a leitura completa. */
  cursor: string | null
  docs: Record<DocKey, DocMeta>
}

export const emptySyncMeta = (): SyncMeta => ({ version: SYNC_META_VERSION, owner: null, cursor: null, docs: {} })

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function toDocMeta(raw: unknown): DocMeta | null {
  if (!isRecord(raw)) return null
  const revision = typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : null
  if (revision === null) return null
  return {
    revision,
    dirty: raw.dirty === true,
    ...(raw.deleted === true ? { deleted: true as const } : {}),
    ...(raw.blocked === true ? { blocked: true as const } : {}),
    ...(raw.refused === true ? { refused: true as const } : {}),
    ...(raw.outdated === true ? { outdated: true as const } : {}),
  }
}

function toSyncMeta(raw: unknown): SyncMeta {
  if (!isRecord(raw) || raw.version !== SYNC_META_VERSION) return emptySyncMeta()
  const owner = isRecord(raw.owner) && typeof raw.owner.id === 'string' && raw.owner.id !== '' && typeof raw.owner.email === 'string'
    ? { id: raw.owner.id, email: raw.owner.email }
    : null
  const docs: Record<DocKey, DocMeta> = {}
  if (isRecord(raw.docs)) {
    for (const [key, value] of Object.entries(raw.docs)) {
      const meta = parseDocKey(key) ? toDocMeta(value) : null
      if (meta) docs[key] = meta
    }
  }
  return { version: SYNC_META_VERSION, owner, cursor: typeof raw.cursor === 'string' && /^\d+$/.test(raw.cursor) ? raw.cursor : null, docs }
}

/**
 * O diário salvo. JSON quebrado, versão diferente ou localStorage fora caem no diário vazio: sem
 * diário, todo documento do aparelho conta como ainda não enviado e a leitura recomeça do zero, o
 * que só custa conferir tudo de novo com o servidor. Nada se perde.
 */
export function loadSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(SYNC_KEY)
    return raw ? toSyncMeta(JSON.parse(raw)) : emptySyncMeta()
  } catch {
    return emptySyncMeta()
  }
}

function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(SYNC_KEY, JSON.stringify(meta))
}

/**
 * Lê, muda e grava o diário num passo só (o JavaScript da página não é interrompido no meio).
 * `change` mexe no diário que recebe; se devolver `false`, nada é gravado.
 */
export function updateSyncMeta(change: (meta: SyncMeta) => boolean | void): SyncMeta {
  const meta = loadSyncMeta()
  if (change(meta) !== false) saveSyncMeta(meta)
  return meta
}

/** Apaga o diário (ao sair da conta, com as fichas). */
export function clearSyncMeta(): void {
  localStorage.removeItem(SYNC_KEY)
}

// ── O que as camadas de storage chamam ao gravar ─────────────────────────────

type LocalChangeListener = (key: DocKey) => void
const listeners = new Set<LocalChangeListener>()

/** Avisa a cada alteração local de documento (quem ouve é o motor, para agendar o envio). */
export function onLocalChange(listener: LocalChangeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = (key: DocKey) => {
  for (const listener of listeners) listener(key)
}

/**
 * O jogador mudou o documento: ele passa a ter alteração a enviar. Chamada ANTES de o documento ser
 * gravado: se a página cair entre as duas gravações, sobra um envio a mais, nunca uma alteração
 * esquecida. Só grava o diário quando o documento estava em dia (no jogo, que grava a cada toque, é
 * uma gravação do diário por envio, e não por toque).
 */
export function markDocChanged(key: DocKey): void {
  updateSyncMeta(meta => {
    const doc = meta.docs[key]
    if (doc && doc.dirty && !doc.deleted && !doc.refused) return false
    meta.docs[key] = {
      revision: doc?.revision ?? 0,
      dirty: true,
      ...(doc?.blocked ? { blocked: true as const } : {}),
      ...(doc?.outdated ? { outdated: true as const } : {}),
    }
  })
  notify(key)
}

/**
 * O jogador apagou o documento. Se o servidor o tem, fica a lápide pendente, para a exclusão subir;
 * se nunca subiu, o diário só o esquece. A exclusão só nasce aqui, da ação de apagar: documento que
 * some do aparelho por outro motivo (a biblioteca corrompida) nunca vira ordem de apagar no servidor.
 */
export function markDocDeleted(key: DocKey): void {
  updateSyncMeta(meta => {
    const doc = meta.docs[key]
    if (!doc) return false
    if (doc.revision > 0) meta.docs[key] = { revision: doc.revision, dirty: true, deleted: true }
    else delete meta.docs[key]
  })
  notify(key)
}

/** O diário esquece o documento, sem lápide (o estado de jogo, que some com a ficha). */
export function forgetDoc(key: DocKey): void {
  updateSyncMeta(meta => {
    if (!(key in meta.docs)) return false
    delete meta.docs[key]
  })
}
