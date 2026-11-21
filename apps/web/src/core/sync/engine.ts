import type {
  ChangesResponse,
  PutCharacterRequest,
  PutPlayStateRequest,
  RemoteCharacter,
  RemotePlayState,
  WriteResponse,
} from '@rpg/contracts'
import { isRetryable, type ApiError, type ApiResult } from '../api/client'
import { decideRemote, type RemoteVersion } from './reconcile'
import { characterKey, parseDocKey, playKey, type DocKey, type DocMeta, type SyncMeta } from './syncStorage'

/**
 * O motor da sincronização: um ciclo envia ao servidor o que mudou no aparelho e, com a galeria na
 * tela, traz o que mudou nos outros aparelhos da conta. Não conhece sistema de RPG, tela, relógio
 * nem rede: tudo entra pelas portas abaixo, e os testes rodam o motor contra um servidor e um
 * aparelho de mentira.
 *
 * As garantias (o porquê de cada uma está onde ela é cumprida):
 *  - nada do aparelho é apagado ou trocado sem que a versão trocada exista em outro lugar;
 *  - nada é escrito por cima de um documento aberto na tela: o que vem do servidor só é aplicado
 *    com a galeria na tela;
 *  - a exclusão só sobe quando o jogador apagou (a lápide do diário), nunca por ausência;
 *  - um documento só fica "em dia" com a resposta do servidor.
 */

/** Um documento do aparelho, como o motor o envia. O conteúdo é opaco para ele. */
export type LocalDoc =
  | { kind: 'character'; key: DocKey; system: string; id: string; step: string; draft: Record<string, unknown>; schema: number; updatedAt: number }
  | { kind: 'play'; key: DocKey; characterId: string; state: Record<string, unknown>; schema: number; updatedAt: number }

/** Um documento como o servidor o devolve. */
export type RemoteDoc =
  | { kind: 'character'; key: DocKey; doc: RemoteCharacter }
  | { kind: 'play'; key: DocKey; doc: RemotePlayState }

/** O aparelho: quem sabe ler e gravar os documentos (o adaptador de `features/sync`). */
export interface SyncLocalPort {
  /** As chaves dos documentos que o aparelho guarda (o estado de jogo só de ficha que existe). */
  keys(): DocKey[]
  read(key: DocKey): LocalDoc | null
  /** Grava o que veio do servidor, sem marcar no diário. `false` se não parece um documento. */
  applyRemote(remote: RemoteDoc): boolean
  /** Tira o documento do aparelho, sem lápide (a ficha leva o estado de jogo). */
  remove(key: DocKey): void
  /** Guarda como ficha nova a versão que perdeu um conflito, marcada para subir. */
  saveConflictCopy(loser: LocalDoc | RemoteDoc, now: number): void
  sameContent(local: LocalDoc, remote: RemoteDoc): boolean
  /** Este app entende a forma (`schema`) do documento remoto. */
  supports(remote: RemoteDoc): boolean
}

/** A API de sincronização (`core/api/syncApi.ts`, já com o cliente). */
export interface SyncApiPort {
  getChanges(since: string | null): Promise<ApiResult<ChangesResponse>>
  putCharacter(id: string, body: PutCharacterRequest, options?: { keepalive?: boolean }): Promise<ApiResult<WriteResponse>>
  deleteCharacter(id: string, baseRevision: number, options?: { keepalive?: boolean }): Promise<ApiResult<void>>
  putPlayState(characterId: string, body: PutPlayStateRequest, options?: { keepalive?: boolean }): Promise<ApiResult<WriteResponse>>
}

/** O diário (`syncStorage.ts`): ler, e mudar num passo só. */
export interface SyncMetaPort {
  load(): SyncMeta
  update(change: (meta: SyncMeta) => boolean | void): SyncMeta
}

/** O app em volta do motor. */
export interface SyncHost {
  /** A conta conectada; `null` se ninguém. */
  accountId(): string | null
  /** A galeria está na tela: nenhum documento aberto no criador nem no jogo. */
  isAtRest(): boolean
  /** Grava agora o que a tela ainda não gravou (o salvamento automático, a nota em edição). */
  flushPendingEdits(): void
  /** O motor mudou as bibliotecas do aparelho: as telas releem. */
  onRemoteApplied(): void
  now(): number
}

export type SyncPhase =
  /** Parado, sem nada em curso. */
  | 'idle'
  | 'syncing'
  /** O último ciclo não conseguiu falar com o servidor: tenta de novo depois. */
  | 'offline'
  /** A sessão expirou: o uso do aparelho continua, e a sincronização espera entrar de novo. */
  | 'expired'
  /** Os dados do aparelho são de outra conta: o motor não mexe em nada. */
  | 'mismatch'

export type SyncStatus = {
  phase: SyncPhase
  /** Documentos com alteração guardada só neste aparelho. */
  pending: number
  /** Documentos que o servidor recusou (grandes demais, inválidos). */
  refused: number
  /** Documentos que o servidor tem numa forma mais nova que a deste app. */
  outdated: number
  /** Quando o último ciclo terminou em dia com o servidor. */
  lastSyncedAt: number | null
}

/** Como um ciclo terminou: em dia, para tentar de novo depois, ou parado até alguém agir. */
export type CycleOutcome = 'synced' | 'retry' | 'stopped'

export type SyncEngineDeps = {
  api: SyncApiPort
  local: SyncLocalPort
  meta: SyncMetaPort
  host: SyncHost
  onStatus?: (status: SyncStatus) => void
  /** Quantas cópias de conflito o ciclo criou (a galeria avisa). */
  onConflictCopies?: (count: number) => void
}

export type SyncEngine = {
  /** Um ciclo. Com um em curso, devolve o mesmo. */
  sync(): Promise<CycleOutcome>
  /**
   * A página está sendo escondida ou fechada: manda agora o que mudou, sem esperar resposta. É
   * melhor esforço; o que não chegar sobe no próximo ciclo.
   */
  flushOnHide(): void
  /** O app foi atualizado: os documentos que ele não entendia merecem outra tentativa. */
  retryOutdated(): void
  status(): SyncStatus
}

/** Páginas de `/api/sync/changes` por ciclo: o bastante para a leitura completa de qualquer conta. */
const MAX_PAGES = 50

/**
 * O corpo máximo de um pedido que sobrevive à página (`keepalive`): o navegador recusa acima de
 * ~64 KB somados. Documento maior espera o próximo ciclo.
 */
export const KEEPALIVE_MAX_BYTES = 48_000

type Stop = { stop: 'retry' | 'expired' | 'mismatch' }

const versionOf = (remote: RemoteDoc): RemoteVersion =>
  remote.kind === 'character'
    ? { revision: remote.doc.revision, deleted: remote.doc.deletedAt !== null, clientUpdatedAt: remote.doc.clientUpdatedAt }
    : { revision: remote.doc.revision, deleted: false, clientUpdatedAt: remote.doc.clientUpdatedAt }

/** Uma alteração local espera a resposta do servidor: nem recusada, nem de forma desconhecida. */
const isPending = (doc: DocMeta) => doc.dirty && !doc.refused && !doc.outdated

export function createSyncEngine({ api, local, meta, host, onStatus, onConflictCopies }: SyncEngineDeps): SyncEngine {
  let phase: SyncPhase = 'idle'
  let lastSyncedAt: number | null = null
  let running: Promise<CycleOutcome> | null = null

  function status(): SyncStatus {
    const docs = Object.values(meta.load().docs)
    return {
      phase,
      pending: docs.filter(isPending).length,
      refused: docs.filter(doc => doc.refused).length,
      outdated: docs.filter(doc => doc.outdated).length,
      lastSyncedAt,
    }
  }

  function setPhase(next: SyncPhase): void {
    phase = next
    onStatus?.(status())
  }

  const setDoc = (key: DocKey, doc: DocMeta) => meta.update(m => { m.docs[key] = doc })

  /** O diário esquece o documento (e, se for ficha, o estado de jogo dela). */
  function forget(key: DocKey): void {
    const parsed = parseDocKey(key)
    meta.update(m => {
      delete m.docs[key]
      if (parsed?.kind === 'character') delete m.docs[playKey(parsed.id)]
    })
  }

  /**
   * Põe o diário de acordo com o que o aparelho guarda. Documento sem entrada (as fichas de antes
   * da conta, o diário perdido) passa a contar como a enviar. Entrada sem documento, que não seja
   * uma lápide, é uma biblioteca que se perdeu: o diário a esquece e a leitura recomeça do zero,
   * para o servidor devolver o que sumiu. Nunca vira ordem de apagar.
   */
  function sweep(): void {
    const keys = new Set(local.keys())
    meta.update(m => {
      let changed = false
      for (const key of keys) {
        if (m.docs[key]) continue
        m.docs[key] = { revision: 0, dirty: true }
        changed = true
      }
      for (const [key, doc] of Object.entries(m.docs)) {
        if (keys.has(key) || doc.deleted || doc.outdated) continue
        delete m.docs[key]
        if (doc.revision > 0) m.cursor = null
        changed = true
      }
      return changed
    })
  }

  /** Com a galeria na tela, o que esperava por ela deixa de esperar: o envio resolve na hora. */
  function unblock(): void {
    meta.update(m => {
      let changed = false
      for (const doc of Object.values(m.docs)) {
        if (!doc.blocked) continue
        delete doc.blocked
        changed = true
      }
      return changed
    })
  }

  /**
   * Faz com o documento o que `decideRemote` manda para a versão do servidor. Devolve quantas
   * cópias de conflito criou e se mexeu nas bibliotecas do aparelho.
   */
  function reconcile(remote: RemoteDoc, atRest: boolean): { copies: number; touched: boolean } {
    const known = meta.load().docs[remote.key]
    const doc = local.read(remote.key)
    const version = versionOf(remote)
    const action = decideRemote({
      meta: known,
      local: doc,
      remote: version,
      sameContent: doc !== null && !version.deleted && local.sameContent(doc, remote),
      atRest,
      supported: local.supports(remote),
    })

    switch (action) {
      case 'ignore':
        return { copies: 0, touched: false }

      case 'outdated':
        setDoc(remote.key, { revision: known?.revision ?? 0, dirty: known?.dirty ?? doc !== null, outdated: true })
        return { copies: 0, touched: false }

      case 'apply':
        if (local.applyRemote(remote)) {
          setDoc(remote.key, { revision: version.revision, dirty: false })
          return { copies: 0, touched: true }
        }
        // O que veio não parece um documento: nada do aparelho é trocado. Se há um aqui, ele passa
        // a partir desta revisão (e, alterado, sobe por cima).
        if (doc) setDoc(remote.key, { revision: version.revision, dirty: known?.dirty ?? true })
        return { copies: 0, touched: false }

      case 'remove':
        local.remove(remote.key)
        forget(remote.key)
        return { copies: 0, touched: true }

      case 'forget':
        forget(remote.key)
        return { copies: 0, touched: false }

      case 'adopt':
        setDoc(remote.key, { revision: version.revision, dirty: false })
        return { copies: 0, touched: false }

      case 'keepLocal': {
        // A versão do servidor vai ser coberta pela do aparelho: antes, vira cópia.
        if (!version.deleted) local.saveConflictCopy(remote, host.now())
        setDoc(remote.key, { revision: version.revision, dirty: true })
        return { copies: version.deleted ? 0 : 1, touched: !version.deleted }
      }

      case 'takeRemote': {
        if (!doc) return { copies: 0, touched: false }
        // A versão do aparelho vai ser coberta pela do servidor: antes, vira cópia.
        local.saveConflictCopy(doc, host.now())
        if (local.applyRemote(remote)) setDoc(remote.key, { revision: version.revision, dirty: false })
        else setDoc(remote.key, { revision: version.revision, dirty: true })
        return { copies: 1, touched: true }
      }

      case 'wait':
        setDoc(remote.key, { revision: known?.revision ?? 0, dirty: true, blocked: true })
        return { copies: 0, touched: false }
    }
  }

  /** Traduz a recusa do servidor: o que para o ciclo, e o que é só deste documento. */
  function stopFor(error: ApiError): Stop | null {
    if (error.kind === 'unauthorized') return { stop: 'expired' }
    if (error.kind === 'http' && error.code === 'ACCOUNT_MISMATCH') return { stop: 'mismatch' }
    if (isRetryable(error)) return { stop: 'retry' }
    return null
  }

  /** Lê as mudanças da conta desde o cursor e as aplica. Só com a galeria na tela. */
  async function pull(counters: { copies: number; touched: boolean }): Promise<Stop | null> {
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await api.getChanges(meta.load().cursor)
      if (!result.ok) return stopFor(result.error) ?? { stop: 'retry' }
      // O jogador abriu uma ficha enquanto a resposta vinha: ela é descartada, e o cursor não
      // anda. A próxima leitura na galeria a traz de novo.
      if (!host.isAtRest()) return null

      const remotes: RemoteDoc[] = [
        // As fichas antes dos estados de jogo: o estado só entra com a ficha dele no aparelho.
        ...result.data.characters.map((doc): RemoteDoc => ({ kind: 'character', key: characterKey(doc.system, doc.id), doc })),
        ...result.data.playStates.map((doc): RemoteDoc => ({ kind: 'play', key: playKey(doc.characterId), doc })),
      ]
      for (const remote of remotes) {
        const done = reconcile(remote, true)
        counters.copies += done.copies
        counters.touched ||= done.touched
      }
      // O cursor só anda depois de tudo aplicado, no mesmo passo: se a página cair antes, a
      // próxima leitura repete a página, e repetir é inofensivo.
      meta.update(m => { m.cursor = result.data.cursor })
      if (!result.data.hasMore) return null
    }
    return null
  }

  /** O documento remoto dentro da resposta de um 409, ou null se ela não trouxe um. */
  function remoteFromConflict(key: DocKey, current: unknown): RemoteDoc | null {
    if (typeof current !== 'object' || current === null) return null
    const parsed = parseDocKey(key)
    if (parsed?.kind === 'character') return { kind: 'character', key, doc: current as RemoteCharacter }
    if (parsed?.kind === 'play') return { kind: 'play', key, doc: current as RemotePlayState }
    return null
  }

  /**
   * Envia um documento com alteração. Devolve o que para o ciclo, ou null. `keepalive` é o envio de
   * saída: sem segunda tentativa, e só se o corpo couber.
   */
  async function pushDoc(key: DocKey, counters: { copies: number; touched: boolean }, options: { keepalive?: boolean; retried?: boolean } = {}): Promise<Stop | null> {
    const known = meta.load().docs[key]
    if (!known || !isPending(known) || known.blocked) return null
    const parsed = parseDocKey(key)
    if (!parsed) return null

    // A lápide: só ficha tem.
    if (known.deleted) {
      if (parsed.kind !== 'character') return null
      const result = await api.deleteCharacter(parsed.id, known.revision, { keepalive: options.keepalive })
      if (result.ok) {
        forget(key)
        return null
      }
      return afterRefusal(key, result.error, counters, options)
    }

    const doc = local.read(key)
    if (!doc) return null
    const body = doc.kind === 'character'
      ? { system: doc.system as PutCharacterRequest['system'], step: doc.step, draft: doc.draft, schema: doc.schema, clientUpdatedAt: doc.updatedAt, baseRevision: known.revision }
      : { state: doc.state, schema: doc.schema, clientUpdatedAt: doc.updatedAt, baseRevision: known.revision }
    if (options.keepalive && JSON.stringify(body).length > KEEPALIVE_MAX_BYTES) return null

    const result = doc.kind === 'character'
      ? await api.putCharacter(doc.id, body as PutCharacterRequest, { keepalive: options.keepalive })
      : await api.putPlayState(doc.characterId, body as PutPlayStateRequest, { keepalive: options.keepalive })

    if (result.ok) {
      const revision = result.data.revision
      // O documento pode ter mudado, ou sido apagado, enquanto o pedido ia: o servidor tem o que
      // foi enviado, não o de agora.
      const now = local.read(key)
      meta.update(m => {
        const current = m.docs[key]
        if (current?.deleted) {
          current.revision = revision
        } else if (!now) {
          // Apagado antes de a resposta chegar, quando ainda não tinha subido: a exclusão não
          // deixou lápide, mas agora o servidor tem a ficha. A lápide nasce aqui.
          if (doc.kind === 'character') m.docs[key] = { revision, dirty: true, deleted: true }
          else delete m.docs[key]
        } else {
          m.docs[key] = { revision, dirty: now.updatedAt !== doc.updatedAt }
        }
      })
      return null
    }
    return afterRefusal(key, result.error, counters, options)
  }

  async function afterRefusal(key: DocKey, error: ApiError, counters: { copies: number; touched: boolean }, options: { keepalive?: boolean; retried?: boolean }): Promise<Stop | null> {
    if (error.kind === 'conflict') {
      // No envio de saída a página está fechando: o conflito fica para o próximo ciclo, que o
      // resolve com calma (e avisa as telas do que mudou).
      if (options.keepalive) return null
      const remote = remoteFromConflict(key, error.current)
      if (!remote) return null
      const done = reconcile(remote, host.isAtRest())
      counters.copies += done.copies
      counters.touched ||= done.touched
      // A versão do aparelho ficou (agora partindo da revisão do servidor): sobe já.
      const after = meta.load().docs[key]
      if (after && isPending(after) && !after.blocked && !options.retried && !options.keepalive) {
        return pushDoc(key, counters, { retried: true })
      }
      return null
    }

    const stop = stopFor(error)
    if (stop) return stop
    // O estado de jogo de uma ficha que o servidor ainda não tem: espera a ficha subir.
    if (error.kind === 'http' && error.code === 'CHARACTER_NOT_FOUND') return null
    // Recusa que repetir não resolve (grande demais, inválido): fica marcado até mudar de novo.
    meta.update(m => {
      const current = m.docs[key]
      if (current) current.refused = true
    })
    return null
  }

  /** As alterações a enviar, na ordem: fichas, estados de jogo (precisam da ficha lá), exclusões. */
  function pendingKeys(): DocKey[] {
    const rank = (key: DocKey, doc: DocMeta) => (doc.deleted ? 2 : key.startsWith('play:') ? 1 : 0)
    return Object.entries(meta.load().docs)
      .filter(([, doc]) => isPending(doc) && !doc.blocked)
      .sort(([a, x], [b, y]) => rank(a, x) - rank(b, y))
      .map(([key]) => key)
  }

  async function cycle(): Promise<CycleOutcome> {
    const accountId = host.accountId()
    if (accountId === null) {
      setPhase('idle')
      return 'stopped'
    }
    // Os dados do aparelho são de outra conta (ou de ninguém): quem resolve é a entrada na conta.
    // O motor não envia as fichas de um para o outro.
    if (meta.load().owner?.id !== accountId) {
      setPhase('mismatch')
      return 'stopped'
    }

    host.flushPendingEdits()
    sweep()
    const atRest = host.isAtRest()
    if (atRest) unblock()
    setPhase('syncing')

    const counters = { copies: 0, touched: false }
    let stop: Stop | null = atRest ? await pull(counters) : null
    if (!stop) {
      for (const key of pendingKeys()) {
        stop = await pushDoc(key, counters)
        if (stop) break
      }
    }

    if (counters.touched) host.onRemoteApplied()
    if (counters.copies > 0) onConflictCopies?.(counters.copies)

    if (!stop) {
      lastSyncedAt = host.now()
      setPhase('idle')
      return 'synced'
    }
    if (stop.stop === 'retry') {
      setPhase('offline')
      return 'retry'
    }
    setPhase(stop.stop)
    return 'stopped'
  }

  return {
    sync() {
      running ??= cycle()
        .catch((error: unknown): CycleOutcome => {
          // Um defeito no meio do ciclo (ou o aparelho sem espaço para gravar) não derruba a
          // sincronização: o que ficou por fazer continua marcado, e o próximo ciclo tenta de novo.
          console.error('[sync] o ciclo falhou:', error)
          setPhase('offline')
          return 'retry'
        })
        .finally(() => { running = null })
      return running
    },

    flushOnHide() {
      if (host.accountId() === null || meta.load().owner?.id !== host.accountId()) return
      host.flushPendingEdits()
      sweep()
      const counters = { copies: 0, touched: false }
      // Todos de uma vez, sem esperar: a página pode não existir mais quando a resposta chegar.
      for (const key of pendingKeys()) void pushDoc(key, counters, { keepalive: true })
    },

    retryOutdated() {
      meta.update(m => {
        const outdated = Object.values(m.docs).filter(doc => doc.outdated)
        if (outdated.length === 0) return false
        for (const doc of outdated) delete doc.outdated
        // O que o app não entendia já ficou para trás do cursor: a leitura completa o traz de novo.
        m.cursor = null
      })
    },

    status,
  }
}
