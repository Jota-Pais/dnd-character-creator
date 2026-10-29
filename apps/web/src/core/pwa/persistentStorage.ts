import { loadDeviceState, updateDeviceState, type PersistAnswer } from '../utils/deviceStorage'
import { isInstalled } from './platform'

/**
 * Armazenamento persistente (docs/app-instalavel.md): sem ele, o navegador pode apagar o que o site
 * guarda para liberar espaço — as fichas junto. O pedido sai no primeiro uso que grava ficha (a
 * camada de storage chama `requestPersistentStorage`), nunca ao abrir: no Chrome e no Safari ele é
 * silencioso (o navegador decide pelo uso do site), no Firefox vira uma pergunta, e ela fica perto
 * do que a motivou.
 *
 * Recusado, não pede de novo a cada sessão (no Firefox, seria a pergunta de novo): só quando o app
 * passa a estar instalado, que é o que muda a resposta do Chrome. A recusa não muda nada no app: as
 * fichas continuam salvas como antes, e o lembrete de cópia da galeria é a rede de segurança.
 */

export type PersistOutcome = 'granted' | 'denied' | 'unsupported' | 'already-asked'

export type PersistDeps = {
  storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined
  installed: boolean
  load: () => PersistAnswer | null
  save: (answer: PersistAnswer) => void
}

/** Pede de novo só a recusa de antes da instalação, agora instalado. */
export function shouldRequestPersist(previous: PersistAnswer | null, installed: boolean): boolean {
  if (!previous) return true
  return !previous.granted && installed && !previous.installed
}

/** Pede o armazenamento persistente, se for o caso; grava a resposta. Nunca lança. */
export async function ensurePersistentStorage({ storage, installed, load, save }: PersistDeps): Promise<PersistOutcome> {
  if (!storage?.persist || !storage.persisted) return 'unsupported'
  try {
    if (await storage.persisted()) return 'granted'
    if (!shouldRequestPersist(load(), installed)) return 'already-asked'
    const granted = await storage.persist()
    save({ granted, installed })
    return granted ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

let requested = false

/**
 * O gancho das camadas de storage: a primeira gravação de ficha da sessão pede (sem esperar), as
 * outras não fazem nada. Sem `navigator.storage` (jsdom, http pelo IP da rede), nada.
 */
export function requestPersistentStorage(): void {
  if (requested || typeof navigator === 'undefined') return
  requested = true
  void ensurePersistentStorage({
    storage: navigator.storage,
    installed: isInstalled(window),
    load: () => loadDeviceState().persist,
    save: answer => updateDeviceState({ persist: answer }),
  })
}
