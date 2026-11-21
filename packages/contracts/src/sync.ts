import { z } from 'zod'
import { SYSTEM_IDS, type SystemId } from './constants'

/**
 * As fichas e os estados de jogo que o servidor guarda para cada conta. O servidor não conhece
 * regra de RPG: o draft e o estado de jogo são JSON que ele guarda e devolve, e quem os entende (e
 * os sanitiza ao carregar) é o cliente.
 *
 * Cada documento tem uma `revision`, que o servidor incrementa a cada gravação aceita. O aparelho
 * grava dizendo de qual revisão partiu (`baseRevision`); se o servidor já está à frente, responde
 * 409 com a versão dele, e o aparelho decide (ver `ConflictBody`, em `errors.ts`).
 */

/** Um objeto JSON qualquer: o servidor não olha dentro. */
const jsonObject = z.record(z.string(), z.unknown(), { error: 'Deve ser um objeto.' })

/**
 * O número da forma do documento, dito pelo cliente que o gravou. Cliente mais velho que recebe um
 * número maior que o seu não aplica nem regrava aquele documento: o sanitizador dele apagaria os
 * campos que ainda não conhece.
 */
const schema = z.number({ error: 'Informe o schema.' }).int().min(1)

/** O momento da última alteração no aparelho, em milissegundos: decide quem ganha um conflito. */
const clientUpdatedAt = z.number({ error: 'Informe clientUpdatedAt.' }).int().nonnegative()

/** A revisão que o aparelho conhecia. 0 é "documento novo": só vale se o servidor não o tem. */
const baseRevision = z.number({ error: 'Informe baseRevision.' }).int().min(0)

/** O id da ficha, gerado pelo cliente (UUID, ou o formato antigo "char-<momento>-<n>"). */
export const characterIdSchema = z.string().regex(/^[\w.:-]{1,120}$/, { error: 'Id de ficha inválido.' })

export const putCharacterSchema = z.object({
  system: z.enum(SYSTEM_IDS, { error: 'Sistema desconhecido.' }),
  /** A etapa do criador em que a ficha parou. */
  step: z.string({ error: 'Informe a etapa.' }).max(60),
  draft: jsonObject,
  schema,
  clientUpdatedAt,
  baseRevision,
})
export type PutCharacterRequest = z.infer<typeof putCharacterSchema>

export const putPlayStateSchema = z.object({
  state: jsonObject,
  schema,
  clientUpdatedAt,
  baseRevision,
})
export type PutPlayStateRequest = z.infer<typeof putPlayStateSchema>

/** `DELETE /api/characters/:id?baseRevision=n`: a query chega como texto. */
export const deleteCharacterQuerySchema = z.object({
  baseRevision: z.coerce.number({ error: 'Informe baseRevision.' }).int().min(0),
})

/** `GET /api/sync/changes?since=<cursor>`: sem cursor, a leitura completa. */
export const changesQuerySchema = z.object({
  since: z.string().regex(/^\d{1,18}$/, { error: 'Cursor inválido.' }).optional(),
})

/** Uma ficha como o servidor a devolve. Apagada (`deletedAt`), vem sem o draft. */
export type RemoteCharacter = {
  id: string
  system: SystemId
  step: string
  draft: Record<string, unknown> | null
  schema: number
  clientUpdatedAt: number
  revision: number
  /** Quando foi apagada, em milissegundos; `null` se existe. */
  deletedAt: number | null
}

/** O estado de jogo de uma ficha. Não tem lápide própria: some com a ficha. */
export type RemotePlayState = {
  characterId: string
  state: Record<string, unknown>
  schema: number
  clientUpdatedAt: number
  revision: number
}

/** Resposta de uma gravação aceita: a revisão nova do documento. */
export type WriteResponse = { revision: number }

/**
 * Resposta de `/api/sync/changes`: o que mudou depois do cursor, e o cursor para a próxima leitura.
 * Com `hasMore`, o cliente lê de novo a partir do cursor devolvido antes de dar a leitura por
 * completa.
 */
export type ChangesResponse = {
  cursor: string
  hasMore: boolean
  characters: RemoteCharacter[]
  playStates: RemotePlayState[]
}
