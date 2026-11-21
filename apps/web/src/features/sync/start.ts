import { deleteCharacter, getChanges, putCharacter, putPlayState } from '../../core/api/syncApi'
import { createSyncEngine, type CycleOutcome, type SyncEngine } from '../../core/sync/engine'
import { createSyncScheduler, type SyncScheduler } from '../../core/sync/scheduler'
import { loadSyncMeta, onLocalChange, updateSyncMeta } from '../../core/sync/syncStorage'
import { useAppStore } from '../../core/stores/appStore'
import { ACCOUNT_KEY } from '../auth/accountStorage'
import { api } from '../auth/api'
import { useAuthStore } from '../auth/authStore'
import { flushLocalEdits, reloadLibraries, syncLocal } from './syncLocal'
import { IDLE_STATUS, useSyncStore } from './syncStore'

/**
 * Liga o motor da sincronização ao app de verdade: a API, as camadas de storage, o relógio e os
 * avisos do navegador (a rede voltou, a página foi escondida, a galeria abriu). É o único lugar que
 * toca `window` e `document` por causa da sincronização; o motor e o agendador não sabem deles.
 */

/** Só uma aba da mesma origem roda um ciclo por vez (Web Locks; sem a API, a aba roda sozinha). */
const SYNC_LOCK = 'forja-sync'

/** Voltando à vista, só roda um ciclo se o último tem mais que isto. */
const STALE_AFTER_MS = 30_000

type Runtime = { engine: SyncEngine; scheduler: SyncScheduler; detach: () => void }

let runtime: Runtime | null = null

const isAtRest = () => useAppStore.getState().activeSystemId === null
const isVisible = () => document.visibilityState !== 'hidden'

function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? (locks.request(SYNC_LOCK, work) as Promise<T>) : work()
}

function create(): Runtime {
  const engine = createSyncEngine({
    api: {
      getChanges: since => getChanges(api, since),
      putCharacter: (id, body, options) => putCharacter(api, id, body, options),
      deleteCharacter: (id, baseRevision, options) => deleteCharacter(api, id, baseRevision, options),
      putPlayState: (characterId, body, options) => putPlayState(api, characterId, body, options),
    },
    local: syncLocal,
    meta: { load: loadSyncMeta, update: updateSyncMeta },
    host: {
      accountId: () => useAuthStore.getState().user?.id ?? null,
      isAtRest,
      flushPendingEdits: flushLocalEdits,
      onRemoteApplied: reloadLibraries,
      now: () => Date.now(),
    },
    onStatus: status => useSyncStore.setState({ status }),
    onConflictCopies: count => useSyncStore.setState(state => ({ conflictCopies: state.conflictCopies + count })),
  })

  const scheduler = createSyncScheduler({
    run: () => exclusive(() => engine.sync()),
    // Sem a informação, vale tentar: quem decide é a resposta do servidor.
    isOnline: () => navigator.onLine !== false,
    timers: {
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: handle => window.clearTimeout(handle as number),
      now: () => Date.now(),
    },
  })

  const stopListening = onLocalChange(key => scheduler.notifyLocalChange(key))

  const onOnline = () => scheduler.notifyOnline()

  const onVisibility = () => {
    if (!isVisible()) {
      // Trocar de app no celular pode ser a última coisa que a página faz: manda o que mudou.
      engine.flushOnHide()
      scheduler.setPolling(false)
      return
    }
    scheduler.setPolling(isAtRest())
    const last = engine.status().lastSyncedAt
    if (last === null || Date.now() - last > STALE_AFTER_MS) scheduler.requestNow()
  }

  const onPageHide = () => engine.flushOnHide()

  // Outra aba do mesmo navegador: se ela trocou de conta, esta recarrega (para nunca mostrar as
  // fichas de uma conta com a sessão de outra); se gravou fichas, a galeria daqui as relê.
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCOUNT_KEY) window.location.reload()
    else if (event.key !== null && /^(dnd|ordem)-/.test(event.key) && isAtRest()) reloadLibraries()
  }

  // Voltar à galeria é quando se lê o que mudou nos outros aparelhos (e se resolve o que esperava).
  const stopWatchingScreen = useAppStore.subscribe((state, previous) => {
    if (state.activeSystemId === previous.activeSystemId) return
    const atRest = state.activeSystemId === null
    scheduler.setPolling(atRest && isVisible())
    if (atRest) scheduler.requestNow()
  })

  window.addEventListener('online', onOnline)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    engine,
    scheduler,
    detach() {
      stopListening()
      stopWatchingScreen()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}

/**
 * Liga a sincronização (ou, já ligada, pede um ciclo agora): entrou na conta, a sessão foi
 * confirmada, entrou de novo depois de expirar.
 */
export function startSync(): void {
  if (!runtime) {
    runtime = create()
    // O app pode ter sido atualizado desde a última abertura: o que ele não entendia merece outra
    // tentativa.
    runtime.engine.retryOutdated()
    runtime.scheduler.setPolling(isAtRest() && isVisible())
  }
  runtime.scheduler.requestNow()
}

/** Desliga a sincronização (saiu da conta). O que estava por enviar continua marcado no diário. */
export function stopSync(): void {
  runtime?.scheduler.stop()
  runtime?.detach()
  runtime = null
  useSyncStore.setState({ status: IDLE_STATUS, conflictCopies: 0 })
}

/** Um ciclo agora, esperando o resultado (o "Sair" tenta mandar antes o que falta). */
export function syncNow(): Promise<CycleOutcome> {
  return runtime ? exclusive(() => (runtime as Runtime).engine.sync()) : Promise.resolve('stopped')
}

/** O jogador pediu para sincronizar agora (o toque no estado da sincronização). */
export function requestSync(): void {
  runtime?.scheduler.notifyOnline()
}

/**
 * Quantos documentos deste aparelho têm alteração que o servidor ainda não tem: os que esperam o
 * envio e os que ele recusou. É o que se perderia ao limpar o aparelho.
 */
export function countUnsentChanges(): number {
  const docs = loadSyncMeta().docs
  // O documento que o diário ainda nem conhece (nenhum ciclo rodou desde que ele existe) também
  // não está no servidor.
  const unknown = syncLocal.keys().filter(key => !docs[key]).length
  return unknown + Object.values(docs).filter(doc => doc.dirty).length
}
