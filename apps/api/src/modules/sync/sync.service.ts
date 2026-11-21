import { CHANGES_PAGE_SIZE, type ChangesResponse } from '@rpg/contracts'
import { toRemoteCharacter, toRemotePlayState } from '../characters/characters.mapper'
import type { CharactersRepository } from '../characters/characters.repository'

/**
 * A leitura das mudanças da conta: o que os outros aparelhos gravaram desde o cursor.
 *
 * O cursor é o número de mudança (`changeSeq`) até onde o aparelho já leu. A resposta nunca pula
 * uma gravação: primeiro se lê o último número confirmado da conta (a cabeça) e só então os
 * documentos até ele. Uma gravação que termine no meio da leitura tem número maior que a cabeça,
 * fica fora das duas listas e do cursor devolvido, e vem inteira na leitura seguinte.
 */
export type SyncService = {
  /** `since` ausente é a leitura completa (o aparelho novo, ou o que perdeu o que tinha). */
  listChanges(userId: string, since: string | undefined): Promise<ChangesResponse>
}

export function createSyncService(deps: { repository: CharactersRepository; pageSize?: number }): SyncService {
  const { repository, pageSize = CHANGES_PAGE_SIZE } = deps

  return {
    async listChanges(userId, since) {
      const after = BigInt(since ?? '0')
      const head = await repository.findChangeHead(userId)
      // Cursor à frente da cabeça (a conta foi restaurada de uma cópia mais antiga do banco): o
      // aparelho recomeça dela, e a varredura dele reenvia o que tiver de mais novo.
      if (after >= head) return { cursor: String(head), hasMore: false, characters: [], playStates: [] }

      // Um a mais que a página, para saber se sobrou.
      const range = { after, upTo: head, limit: pageSize + 1 }
      const [characters, playStates] = await Promise.all([
        repository.findCharacterChanges(userId, range),
        repository.findPlayStateChanges(userId, range),
      ])

      // Com página cheia, o cursor para no último documento que coube na lista que estourou (no
      // menor deles, se as duas estouraram), e a outra lista é cortada ali: assim nenhum documento
      // abaixo do cursor fica para trás.
      const cuts: bigint[] = []
      if (characters.length > pageSize) cuts.push(characters[pageSize - 1]!.changeSeq)
      if (playStates.length > pageSize) cuts.push(playStates[pageSize - 1]!.changeSeq)
      const cursor = cuts.length > 0 ? cuts.reduce((a, b) => (a < b ? a : b)) : head

      return {
        cursor: String(cursor),
        hasMore: cuts.length > 0,
        characters: characters.filter(c => c.changeSeq <= cursor).map(toRemoteCharacter),
        playStates: playStates.filter(p => p.changeSeq <= cursor).map(toRemotePlayState),
      }
    },
  }
}
