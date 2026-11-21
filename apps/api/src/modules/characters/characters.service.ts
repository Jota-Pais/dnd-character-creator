import type { PutCharacterRequest, PutPlayStateRequest, WriteResponse } from '@rpg/contracts'
import { canonicalJson } from '@rpg/rules/core/utils/canonicalJson'
import { characterNotFound, conflict, invalidField } from '../../shared/errors'
import { toRemoteCharacter, toRemotePlayState } from './characters.mapper'
import type { CharacterRecord, CharactersRepository, JsonObject, PlayStateRecord } from './characters.repository'

/**
 * As gravações de ficha e de estado de jogo. A regra é a mesma para os dois documentos:
 *
 * - o aparelho grava dizendo de qual revisão partiu (`baseRevision`). Se o servidor está nela, a
 *   gravação entra e a revisão sobe; se está à frente, 409 com a versão do servidor, e quem decide
 *   é o aparelho (o servidor nunca escolhe um lado nem junta duas versões);
 * - gravar de novo exatamente o que já está gravado responde 200 com a revisão atual, qualquer que
 *   seja a base: o aparelho que não recebeu a resposta (a página fechou no meio) repete o pedido
 *   sem virar conflito consigo mesmo;
 * - o servidor não entende o conteúdo. Só tira o nome do draft, para a coluna que o dono lê.
 */
export type CharactersService = {
  putCharacter(userId: string, id: string, body: PutCharacterRequest): Promise<WriteResponse>
  /** Apaga a ficha (lápide). Apagar o que não existe, ou o que já foi apagado, não é erro. */
  deleteCharacter(userId: string, id: string, baseRevision: number): Promise<void>
  putPlayState(userId: string, characterId: string, body: PutPlayStateRequest): Promise<WriteResponse>
}

const NAME_MAX_LENGTH = 200

/** O nome da personagem: os dois sistemas guardam `name` no topo do draft. */
function nameOf(draft: JsonObject): string {
  return typeof draft.name === 'string' ? draft.name.trim().slice(0, NAME_MAX_LENGTH) : ''
}

const sameCharacter = (stored: CharacterRecord, body: PutCharacterRequest) =>
  stored.deletedAt === null
  && stored.step === body.step
  && stored.schema === body.schema
  && stored.clientUpdatedAt.getTime() === body.clientUpdatedAt
  && canonicalJson(stored.draft) === canonicalJson(body.draft)

const samePlayState = (stored: PlayStateRecord, body: PutPlayStateRequest) =>
  stored.schema === body.schema
  && stored.clientUpdatedAt.getTime() === body.clientUpdatedAt
  && canonicalJson(stored.state) === canonicalJson(body.state)

export function createCharactersService(deps: { repository: CharactersRepository; clock: () => Date }): CharactersService {
  const { repository, clock } = deps

  return {
    putCharacter(userId, id, body) {
      return repository.write(userId, async account => {
        const stored = await account.findCharacter(id)
        if (stored && stored.system !== body.system) {
          throw invalidField('system', 'Esta ficha é de outro sistema.')
        }
        if (stored && sameCharacter(stored, body)) return { revision: stored.revision }
        if (stored && stored.revision !== body.baseRevision) throw conflict(toRemoteCharacter(stored))

        // Sem ficha no servidor, a gravação é a criação, seja qual for a base que o aparelho dizia
        // conhecer: não há outra versão com que conflitar.
        const revision = (stored?.revision ?? 0) + 1
        await account.saveCharacter({
          id,
          system: body.system,
          name: nameOf(body.draft),
          step: body.step,
          draft: body.draft,
          schema: body.schema,
          clientUpdatedAt: new Date(body.clientUpdatedAt),
          revision,
          changeSeq: await account.nextChangeSeq(),
          deletedAt: null,
        })

        // A edição ganhou de uma exclusão: a ficha volta. O estado de jogo dela, que tinha sumido
        // das respostas com a lápide, ganha um número de mudança novo para voltar aos aparelhos.
        if (stored?.deletedAt) {
          const playState = await account.findPlayState(id)
          if (playState) await account.savePlayState({ ...playState, changeSeq: await account.nextChangeSeq() })
        }
        return { revision }
      })
    },

    deleteCharacter(userId, id, baseRevision) {
      return repository.write(userId, async account => {
        const stored = await account.findCharacter(id)
        if (!stored || stored.deletedAt) return
        // A ficha mudou em outro aparelho depois da revisão que este conhecia: a edição ganha da
        // exclusão, e o aparelho que quis apagar recebe a versão nova.
        if (stored.revision !== baseRevision) throw conflict(toRemoteCharacter(stored))
        await account.saveCharacter({
          ...stored,
          revision: stored.revision + 1,
          changeSeq: await account.nextChangeSeq(),
          deletedAt: clock(),
        })
      })
    },

    putPlayState(userId, characterId, body) {
      return repository.write(userId, async account => {
        const character = await account.findCharacter(characterId)
        if (!character || character.deletedAt) throw characterNotFound()

        const stored = await account.findPlayState(characterId)
        if (stored && samePlayState(stored, body)) return { revision: stored.revision }
        if (stored && stored.revision !== body.baseRevision) throw conflict(toRemotePlayState(stored))

        const revision = (stored?.revision ?? 0) + 1
        await account.savePlayState({
          characterId,
          state: body.state,
          schema: body.schema,
          clientUpdatedAt: new Date(body.clientUpdatedAt),
          revision,
          changeSeq: await account.nextChangeSeq(),
        })
        return { revision }
      })
    },
  }
}
