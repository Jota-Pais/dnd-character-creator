import { create } from 'zustand'
import type { SyncStatus } from '../../core/sync/engine'

/**
 * A sincronização, para as telas: em que pé está. Quem escreve aqui é o motor, pelo `start.ts`; as
 * telas só leem (a linha de conta e os avisos da galeria). As cópias de conflito que ela cria ficam
 * no aparelho (`unseenConflictCopies`, em `core/utils/deviceStorage.ts`), para o aviso não se perder
 * ao recarregar a página.
 */
export type SyncState = {
  status: SyncStatus
}

export const IDLE_STATUS: SyncStatus = { phase: 'idle', pending: 0, refused: 0, outdated: 0, lastSyncedAt: null }

export const useSyncStore = create<SyncState>(() => ({ status: IDLE_STATUS }))
