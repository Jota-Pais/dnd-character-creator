import type { ChangesResponse, PutCharacterRequest, PutPlayStateRequest, WriteResponse } from '@rpg/contracts'
import type { ApiClient, ApiResult } from './client'

/**
 * As rotas de ficha e de sincronização, uma função por rota. Todas levam o cabeçalho da conta dona
 * dos dados do aparelho (`account: true`): o servidor recusa se não for a da sessão.
 */

export type WriteOptions = {
  /** O envio do `pagehide`: o pedido segue mesmo com a página fechando. */
  keepalive?: boolean
}

/** O que mudou na conta desde o cursor; sem cursor, tudo. */
export const getChanges = (api: ApiClient, since: string | null): Promise<ApiResult<ChangesResponse>> =>
  api.request('GET', since === null ? '/api/sync/changes' : `/api/sync/changes?since=${encodeURIComponent(since)}`, { account: true })

export const putCharacter = (
  api: ApiClient,
  id: string,
  body: PutCharacterRequest,
  options: WriteOptions = {},
): Promise<ApiResult<WriteResponse>> =>
  api.request('PUT', `/api/characters/${encodeURIComponent(id)}`, { body, account: true, keepalive: options.keepalive })

export const deleteCharacter = (
  api: ApiClient,
  id: string,
  baseRevision: number,
  options: WriteOptions = {},
): Promise<ApiResult<void>> =>
  api.request('DELETE', `/api/characters/${encodeURIComponent(id)}?baseRevision=${baseRevision}`, { account: true, keepalive: options.keepalive })

export const putPlayState = (
  api: ApiClient,
  characterId: string,
  body: PutPlayStateRequest,
  options: WriteOptions = {},
): Promise<ApiResult<WriteResponse>> =>
  api.request('PUT', `/api/characters/${encodeURIComponent(characterId)}/play-state`, { body, account: true, keepalive: options.keepalive })
