import { create } from 'zustand'
import type { SyncStatus } from '../../core/sync/engine'

/**
 * A sincronização, para as telas: em que pé está, e o que o jogador precisa saber dela. Quem escreve
 * aqui é o motor, pelo `start.ts`; as telas só leem (a linha de conta e os avisos da galeria).
 */
export type SyncState = {
  status: SyncStatus
  /**
   * Cópias de conflito criadas que a galeria ainda não mostrou: a mesma ficha (ou o mesmo jogo)
   * mudou em dois aparelhos, e a versão que perdeu virou uma ficha à parte. Zera no "Entendi".
   */
  conflictCopies: number
}

export const IDLE_STATUS: SyncStatus = { phase: 'idle', pending: 0, refused: 0, outdated: 0, lastSyncedAt: null }

export const useSyncStore = create<SyncState>(() => ({ status: IDLE_STATUS, conflictCopies: 0 }))
