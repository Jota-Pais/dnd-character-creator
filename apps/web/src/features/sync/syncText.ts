import type { SyncStatus } from '../../core/sync/engine'

/**
 * A sincronização em uma frase, para a linha de conta da galeria. O que o jogador precisa saber é
 * se o que ele fez já está no servidor (e portanto nos outros aparelhos) ou se ainda mora só aqui.
 * As fichas estão sempre no aparelho: nenhuma destas frases quer dizer que algo se perdeu.
 */
export function describeSync(status: SyncStatus, session: 'unknown' | 'valid' | 'expired'): string {
  const n = status.pending
  const kept = n === 1 ? '1 alteração guardada neste aparelho' : `${n} alterações guardadas neste aparelho`

  if (session === 'expired' || status.phase === 'expired') return n > 0 ? `Sessão expirada: ${kept}` : 'Sessão expirada'
  if (status.phase === 'mismatch') return 'Sincronização parada'
  if (status.phase === 'syncing') return 'Sincronizando…'
  // O servidor ainda não confirmou a sessão desta abertura (o app abriu sem rede), ou o último
  // ciclo não conseguiu falar com ele.
  if (status.phase === 'offline' || session === 'unknown') return n > 0 ? `Sem conexão: ${kept}` : 'Sem conexão: as fichas estão neste aparelho'
  if (n > 0) return n === 1 ? '1 alteração a enviar' : `${n} alterações a enviar`
  return status.lastSyncedAt === null ? 'Conectado' : 'Em dia'
}

/** A sincronização está em dia: tudo o que há neste aparelho está no servidor. */
export function isSynced(status: SyncStatus, session: 'unknown' | 'valid' | 'expired'): boolean {
  return session === 'valid' && status.phase === 'idle' && status.pending === 0 && status.refused === 0
    && status.outdated === 0 && status.lastSyncedAt !== null
}
