import type { ChangesResponse, RemoteCharacter, RemotePlayState } from '@rpg/contracts'
import { canonicalJson } from '@rpg/rules/core/utils/canonicalJson'
import type { ApiError, ApiResult } from '../../api/client'
import {
  createSyncEngine,
  type LocalDoc,
  type RemoteDoc,
  type SyncApiPort,
  type SyncEngine,
  type SyncHost,
  type SyncLocalPort,
  type SyncMetaPort,
  type SyncStatus,
} from '../engine'
import { characterKey, emptySyncMeta, parseDocKey, playKey, type DocKey, type SyncMeta } from '../syncStorage'

/**
 * Um servidor e aparelhos de mentira para os testes do motor. O servidor segue as regras da API de
 * verdade (`apps/api`, módulos `characters` e `sync`): a revisão por documento, o 409 com a versão
 * dele, o pedido repetido, a lápide, a edição que ressuscita e o cursor das mudanças. O aparelho faz
 * o que as camadas de storage do site fazem: marca no diário o que o jogador muda e apaga.
 */

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const fail = (error: ApiError): ApiResult<never> => ({ ok: false, error })

type StoredCharacter = RemoteCharacter & { seq: number; kept: Record<string, unknown> }
type StoredPlay = RemotePlayState & { seq: number }

export type FakeServer = {
  api: SyncApiPort
  /** Sem rede: todo pedido falha sem resposta. */
  offline: boolean
  /** A sessão expirou: todo pedido responde 401. */
  expired: boolean
  /** A conta do cookie não é a dos dados do aparelho. */
  mismatch: boolean
  /** Recusa por tamanho as fichas com estes ids. */
  tooLarge: Set<string>
  /** Roda uma vez, no meio do próximo pedido (depois de o servidor recebê-lo, antes da resposta). */
  duringNext: (() => void) | null
  /** Todos os pedidos que chegaram, em ordem: `PUT k1`, `DELETE k1`, `PLAY k1`, `GET 3`. */
  log: string[]
  /** Os pedidos feitos com `keepalive`. */
  keepalive: string[]
  pageSize: number
  characters(): RemoteCharacter[]
  playStates(): RemotePlayState[]
  alive(): Record<string, unknown>
}

export function createFakeServer(): FakeServer {
  const characters = new Map<string, StoredCharacter>()
  const plays = new Map<string, StoredPlay>()
  let counter = 0

  /** O documento sem o que é só do servidor (o número de mudança, o draft guardado da apagada). */
  const publicCharacter = (stored: StoredCharacter): RemoteCharacter => ({
    id: stored.id, system: stored.system, step: stored.step, draft: stored.draft, schema: stored.schema,
    clientUpdatedAt: stored.clientUpdatedAt, revision: stored.revision, deletedAt: stored.deletedAt,
  })
  const publicPlay = (stored: StoredPlay): RemotePlayState => ({
    characterId: stored.characterId, state: stored.state, schema: stored.schema,
    clientUpdatedAt: stored.clientUpdatedAt, revision: stored.revision,
  })

  const server: FakeServer = {
    offline: false,
    expired: false,
    mismatch: false,
    tooLarge: new Set(),
    duringNext: null,
    log: [],
    keepalive: [],
    pageSize: 200,
    characters: () => [...characters.values()].map(publicCharacter),
    playStates: () => [...plays.values()].map(publicPlay),
    alive: () => Object.fromEntries([
      ...[...characters.values()].filter(c => c.deletedAt === null).map(c => [characterKey(c.system, c.id), c.draft]),
      ...[...plays.values()].filter(p => characters.get(p.characterId)?.deletedAt === null).map(p => [playKey(p.characterId), p.state]),
    ]),
    api: null as unknown as SyncApiPort,
  }

  /** O que todo pedido passa antes de chegar à regra; devolve a recusa, se houver. */
  async function arrive(entry: string, options?: { keepalive?: boolean }): Promise<ApiError | null> {
    // A rede de verdade nunca responde no mesmo instante.
    await Promise.resolve()
    if (server.offline) return { kind: 'network', message: 'sem rede' }
    server.log.push(entry)
    if (options?.keepalive) server.keepalive.push(entry)
    if (server.expired) return { kind: 'unauthorized', message: 'entre de novo' }
    if (server.mismatch) return { kind: 'http', status: 403, code: 'ACCOUNT_MISMATCH', message: 'outra conta', fields: {} }
    const during = server.duringNext
    server.duringNext = null
    during?.()
    return null
  }

  server.api = {
    async getChanges(since) {
      const refused = await arrive(`GET ${since ?? 'tudo'}`)
      if (refused) return fail(refused)
      const after = Number(since ?? '0')
      const head = counter
      if (after >= head) return ok<ChangesResponse>({ cursor: String(head), hasMore: false, characters: [], playStates: [] })
      const bySeq = (a: { seq: number }, b: { seq: number }) => a.seq - b.seq
      const cs = [...characters.values()].filter(c => c.seq > after && c.seq <= head).sort(bySeq)
      const ps = [...plays.values()].filter(p => p.seq > after && p.seq <= head && characters.get(p.characterId)?.deletedAt === null).sort(bySeq)
      const cuts: number[] = []
      if (cs.length > server.pageSize) cuts.push(cs[server.pageSize - 1].seq)
      if (ps.length > server.pageSize) cuts.push(ps[server.pageSize - 1].seq)
      const cursor = cuts.length > 0 ? Math.min(...cuts) : head
      return ok<ChangesResponse>({
        cursor: String(cursor),
        hasMore: cuts.length > 0,
        characters: cs.filter(c => c.seq <= cursor).map(c => structuredClone(publicCharacter(c))),
        playStates: ps.filter(p => p.seq <= cursor).map(p => structuredClone(publicPlay(p))),
      })
    },

    async putCharacter(id, body, options) {
      const refused = await arrive(`PUT ${id}`, options)
      if (refused) return fail(refused)
      if (server.tooLarge.has(id)) return fail({ kind: 'http', status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'grande demais', fields: {} })
      const stored = characters.get(id)
      const same = stored && stored.deletedAt === null && stored.step === body.step && stored.schema === body.schema
        && stored.clientUpdatedAt === body.clientUpdatedAt && canonicalJson(stored.draft) === canonicalJson(body.draft)
      if (stored && same) return ok({ revision: stored.revision })
      if (stored && stored.revision !== body.baseRevision) return fail({ kind: 'conflict', message: 'mudou', current: structuredClone(publicCharacter(stored)) })
      const revision = (stored?.revision ?? 0) + 1
      const draft = structuredClone(body.draft)
      characters.set(id, {
        id, system: body.system, step: body.step, draft, kept: draft, schema: body.schema,
        clientUpdatedAt: body.clientUpdatedAt, revision, deletedAt: null, seq: ++counter,
      })
      if (stored?.deletedAt) {
        const play = plays.get(id)
        if (play) play.seq = ++counter
      }
      return ok({ revision })
    },

    async deleteCharacter(id, baseRevision, options) {
      const refused = await arrive(`DELETE ${id}`, options)
      if (refused) return fail(refused)
      const stored = characters.get(id)
      if (!stored || stored.deletedAt !== null) return ok(undefined)
      if (stored.revision !== baseRevision) return fail({ kind: 'conflict', message: 'mudou', current: structuredClone(publicCharacter(stored)) })
      characters.set(id, { ...stored, draft: null, revision: stored.revision + 1, deletedAt: 1, seq: ++counter })
      return ok(undefined)
    },

    async putPlayState(characterId, body, options) {
      const refused = await arrive(`PLAY ${characterId}`, options)
      if (refused) return fail(refused)
      const character = characters.get(characterId)
      if (!character || character.deletedAt !== null) {
        return fail({ kind: 'http', status: 404, code: 'CHARACTER_NOT_FOUND', message: 'ficha não encontrada', fields: {} })
      }
      const stored = plays.get(characterId)
      const same = stored && stored.schema === body.schema && stored.clientUpdatedAt === body.clientUpdatedAt
        && canonicalJson(stored.state) === canonicalJson(body.state)
      if (stored && same) return ok({ revision: stored.revision })
      if (stored && stored.revision !== body.baseRevision) return fail({ kind: 'conflict', message: 'mudou', current: structuredClone(publicPlay(stored)) })
      const revision = (stored?.revision ?? 0) + 1
      plays.set(characterId, {
        characterId, state: structuredClone(body.state), schema: body.schema,
        clientUpdatedAt: body.clientUpdatedAt, revision, seq: ++counter,
      })
      return ok({ revision })
    },
  }

  return server
}

export type FakeDevice = {
  engine: SyncEngine
  meta: SyncMeta
  /** A galeria está na tela. */
  atRest: boolean
  /** O relógio deste aparelho (cada um tem o seu, e podem discordar). */
  clock: number
  /** A maior forma de documento que este app entende. */
  schema: number
  /** O jogador grava uma ficha (cria ou altera). */
  save(id: string, draft: Record<string, unknown>, options?: { system?: string; step?: string }): void
  /** O jogador joga: grava o estado de jogo da ficha. */
  play(id: string, state: Record<string, unknown>): void
  /** O jogador apaga a ficha (e o estado de jogo dela). */
  erase(id: string): void
  /** A biblioteca some por um defeito (JSON quebrado): nenhuma exclusão foi pedida. */
  loseLibrary(): void
  /** O conteúdo dos documentos do aparelho, por chave. */
  contents(): Record<string, unknown>
  doc(key: DocKey): LocalDoc | undefined
  statuses: SyncStatus[]
  /** Quantas cópias de conflito cada ciclo avisou. */
  copiesReported: number[]
  /** Quantas vezes o motor mandou as telas relerem as bibliotecas. */
  reloads: number
  /** Quantas vezes o motor pediu para gravar o que a tela ainda não gravou. */
  flushes: number
  /** O que o motor chama antes de cada ciclo: aqui o teste simula o salvamento automático pendente. */
  onFlush: (() => void) | null
}

const USER = { id: 'conta-da-ana', email: 'ana@ficha.dev' }

export function createFakeDevice(server: FakeServer, options: { owner?: { id: string; email: string } | null; account?: string | null } = {}): FakeDevice {
  const docs = new Map<DocKey, LocalDoc>()
  let copies = 0

  const device: FakeDevice = {
    engine: null as unknown as SyncEngine,
    meta: { ...emptySyncMeta(), owner: options.owner === undefined ? USER : options.owner },
    atRest: true,
    clock: 1_000,
    schema: 1,
    statuses: [],
    copiesReported: [],
    reloads: 0,
    flushes: 0,
    onFlush: null,

    save(id, draft, { system = 'dnd5e', step = 'name' } = {}) {
      const key = characterKey(system, id)
      const previous = docs.get(key)
      const changed = !previous || previous.kind !== 'character' || canonicalJson(previous.draft) !== canonicalJson(draft)
      if (changed) markChanged(key)
      docs.set(key, { kind: 'character', key, system, id, step, draft: structuredClone(draft), schema: device.schema, updatedAt: device.clock })
    },

    play(id, state) {
      const key = playKey(id)
      markChanged(key)
      docs.set(key, { kind: 'play', key, characterId: id, state: structuredClone(state), schema: device.schema, updatedAt: device.clock })
    },

    erase(id) {
      const key = [...docs.keys()].find(k => parseDocKey(k)?.kind === 'character' && (parseDocKey(k) as { id: string }).id === id)
      if (!key) return
      // Como `deletePlayState` + `deleteCharacterEntry`: o estado de jogo só some do diário.
      docs.delete(playKey(id))
      delete device.meta.docs[playKey(id)]
      docs.delete(key)
      const known = device.meta.docs[key]
      if (known && known.revision > 0) device.meta.docs[key] = { revision: known.revision, dirty: true, deleted: true }
      else delete device.meta.docs[key]
    },

    loseLibrary() {
      docs.clear()
    },

    contents: () => Object.fromEntries([...docs.values()].map(doc => [doc.key, doc.kind === 'character' ? doc.draft : doc.state])),
    doc: key => docs.get(key),
  }

  function markChanged(key: DocKey): void {
    const known = device.meta.docs[key]
    if (known && known.dirty && !known.deleted && !known.refused) return
    device.meta.docs[key] = {
      revision: known?.revision ?? 0,
      dirty: true,
      ...(known?.blocked ? { blocked: true as const } : {}),
      ...(known?.outdated ? { outdated: true as const } : {}),
    }
  }

  const characterOf = (id: string) => [...docs.values()].find(doc => doc.kind === 'character' && doc.id === id)

  const local: SyncLocalPort = {
    keys: () => [...docs.values()].filter(doc => doc.kind === 'character' || characterOf(doc.characterId)).map(doc => doc.key),

    read: key => {
      const doc = docs.get(key)
      return doc ? structuredClone(doc) : null
    },

    applyRemote(remote) {
      if (remote.kind === 'character') {
        const { doc } = remote
        // O draft que "não parece uma ficha": o adaptador de verdade recusa o que não tem nome.
        if (doc.draft === null || typeof doc.draft.name !== 'string') return false
        docs.set(remote.key, {
          kind: 'character', key: remote.key, system: doc.system, id: doc.id, step: doc.step,
          draft: structuredClone(doc.draft), schema: doc.schema, updatedAt: doc.clientUpdatedAt,
        })
        return true
      }
      if (!characterOf(remote.doc.characterId)) return false
      docs.set(remote.key, {
        kind: 'play', key: remote.key, characterId: remote.doc.characterId, state: structuredClone(remote.doc.state),
        schema: remote.doc.schema, updatedAt: remote.doc.clientUpdatedAt,
      })
      return true
    },

    remove(key) {
      const parsed = parseDocKey(key)
      docs.delete(key)
      if (parsed?.kind === 'character') docs.delete(playKey(parsed.id))
    },

    saveConflictCopy(loser, now) {
      copies += 1
      const id = `copia-${copies}-de-${device.clock}`
      if ('doc' in loser) {
        // A versão do servidor que perdeu.
        if (loser.kind === 'character') {
          device.save(id, { ...loser.doc.draft, name: `${String(loser.doc.draft?.name)} (conflito ${now})` }, { system: loser.doc.system })
        } else {
          const sheet = characterOf(loser.doc.characterId)
          device.save(id, { ...(sheet?.kind === 'character' ? sheet.draft : {}), name: `jogo em conflito ${now}` })
          device.play(id, loser.doc.state)
        }
      } else if (loser.kind === 'character') {
        device.save(id, { ...loser.draft, name: `${String(loser.draft.name)} (conflito ${now})` }, { system: loser.system })
      } else {
        const sheet = characterOf(loser.characterId)
        device.save(id, { ...(sheet?.kind === 'character' ? sheet.draft : {}), name: `jogo em conflito ${now}` })
        device.play(id, loser.state)
      }
    },

    sameContent(doc, remote) {
      if (doc.kind === 'character' && remote.kind === 'character') return canonicalJson(doc.draft) === canonicalJson(remote.doc.draft)
      if (doc.kind === 'play' && remote.kind === 'play') return canonicalJson(doc.state) === canonicalJson(remote.doc.state)
      return false
    },

    supports: (remote: RemoteDoc) => remote.doc.schema <= device.schema,
  }

  const meta: SyncMetaPort = {
    load: () => structuredClone(device.meta),
    update(change) {
      const next = structuredClone(device.meta)
      if (change(next) !== false) device.meta = next
      return next
    },
  }

  const host: SyncHost = {
    accountId: () => (options.account === undefined ? USER.id : options.account),
    isAtRest: () => device.atRest,
    flushPendingEdits() {
      device.flushes += 1
      device.onFlush?.()
    },
    onRemoteApplied() {
      device.reloads += 1
    },
    now: () => device.clock,
  }

  device.engine = createSyncEngine({
    api: server.api,
    local,
    meta,
    host,
    onStatus: status => device.statuses.push(status),
    onConflictCopies: count => device.copiesReported.push(count),
  })
  return device
}

/** As chaves dos documentos com alteração a enviar no diário do aparelho. */
export const pendingOf = (device: FakeDevice) =>
  Object.entries(device.meta.docs).filter(([, doc]) => doc.dirty).map(([key]) => key).sort()
