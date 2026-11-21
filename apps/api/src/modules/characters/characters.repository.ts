import type { SystemId } from '@rpg/contracts'

/**
 * O acesso ao banco das fichas e dos estados de jogo, atrás de uma interface (ver
 * `auth.repository.ts`). O servidor não olha dentro do draft nem do estado: são objetos JSON.
 */

export type JsonObject = Record<string, unknown>

export type CharacterRecord = {
  id: string
  system: SystemId
  /** O nome da personagem, tirado do draft: coluna própria só para o dono navegar pelo banco. */
  name: string
  step: string
  draft: JsonObject
  schema: number
  clientUpdatedAt: Date
  /** Do documento: sobe a cada gravação aceita. */
  revision: number
  /** Da conta: o número de ordem desta gravação entre todas as da conta. */
  changeSeq: bigint
  deletedAt: Date | null
}

export type PlayStateRecord = {
  characterId: string
  state: JsonObject
  schema: number
  clientUpdatedAt: Date
  revision: number
  changeSeq: bigint
}

/** O que uma gravação enxerga e faz, com a conta travada (ver `CharactersRepository.write`). */
export interface AccountWrite {
  /** O próximo número de mudança da conta: cada documento gravado leva o seu. */
  nextChangeSeq(): Promise<bigint>
  findCharacter(id: string): Promise<CharacterRecord | null>
  saveCharacter(record: CharacterRecord): Promise<void>
  findPlayState(characterId: string): Promise<PlayStateRecord | null>
  savePlayState(record: PlayStateRecord): Promise<void>
}

export interface CharactersRepository {
  /**
   * Roda `work` numa transação com a conta travada: duas gravações da mesma conta nunca se cruzam.
   * É o que faz a conferência de revisão valer (ler a revisão e gravar a seguinte são um passo só)
   * e o que põe os `changeSeq` na ordem em que as gravações foram confirmadas. Se `work` falha,
   * nada do que ele gravou fica.
   */
  write<T>(userId: string, work: (account: AccountWrite) => Promise<T>): Promise<T>

  /** O último número de mudança confirmado da conta: até ele, tudo já pode ser lido. */
  findChangeHead(userId: string): Promise<bigint>

  /** As fichas (com as lápides) de `changeSeq` em (after, upTo], em ordem, no máximo `limit`. */
  findCharacterChanges(userId: string, range: ChangeRange): Promise<CharacterRecord[]>

  /** Os estados de jogo de fichas que existem, de `changeSeq` em (after, upTo], em ordem. */
  findPlayStateChanges(userId: string, range: ChangeRange): Promise<PlayStateRecord[]>
}

export type ChangeRange = { after: bigint; upTo: bigint; limit: number }
