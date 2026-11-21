import type { RemoteCharacter, RemotePlayState } from '@rpg/contracts'
import type { CharacterRecord, PlayStateRecord } from './characters.repository'

/** A ficha como a API a devolve. A apagada vai sem o draft: o aparelho só precisa saber que saiu. */
export function toRemoteCharacter(record: CharacterRecord): RemoteCharacter {
  return {
    id: record.id,
    system: record.system,
    step: record.step,
    draft: record.deletedAt ? null : record.draft,
    schema: record.schema,
    clientUpdatedAt: record.clientUpdatedAt.getTime(),
    revision: record.revision,
    deletedAt: record.deletedAt?.getTime() ?? null,
  }
}

export function toRemotePlayState(record: PlayStateRecord): RemotePlayState {
  return {
    characterId: record.characterId,
    state: record.state,
    schema: record.schema,
    clientUpdatedAt: record.clientUpdatedAt.getTime(),
    revision: record.revision,
  }
}
