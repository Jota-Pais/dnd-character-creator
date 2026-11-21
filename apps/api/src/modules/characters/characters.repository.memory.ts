import type {
  AccountWrite,
  ChangeRange,
  CharacterRecord,
  CharactersRepository,
  PlayStateRecord,
} from './characters.repository'

/** O que uma conta guarda. */
type Account = {
  changeCounter: bigint
  characters: Map<string, CharacterRecord>
  playStates: Map<string, PlayStateRecord>
}

/**
 * O repositório de fichas em memória: o dos testes (ver `auth.repository.memory.ts`). Imita o que o
 * banco garante: uma gravação por vez em cada conta, tudo ou nada, e cópia do que se guarda (quem
 * mexe no objeto depois de gravar não muda o que ficou).
 */
export type MemoryCharactersRepository = CharactersRepository & {
  /** Para o teste olhar o que ficou guardado. */
  characters(userId: string): CharacterRecord[]
  playStates(userId: string): PlayStateRecord[]
}

const emptyAccount = (): Account => ({ changeCounter: 0n, characters: new Map(), playStates: new Map() })

const copyAccount = (account: Account): Account => ({
  changeCounter: account.changeCounter,
  characters: new Map(account.characters),
  playStates: new Map(account.playStates),
})

const inRange = ({ after, upTo }: ChangeRange) => (record: { changeSeq: bigint }) =>
  record.changeSeq > after && record.changeSeq <= upTo

const bySeq = (a: { changeSeq: bigint }, b: { changeSeq: bigint }) => (a.changeSeq < b.changeSeq ? -1 : 1)

export function createMemoryCharactersRepository(): MemoryCharactersRepository {
  const accounts = new Map<string, Account>()
  const queues = new Map<string, Promise<unknown>>()
  const accountOf = (userId: string) => accounts.get(userId) ?? emptyAccount()

  return {
    characters: userId => [...accountOf(userId).characters.values()].map(r => structuredClone(r)),
    playStates: userId => [...accountOf(userId).playStates.values()].map(r => structuredClone(r)),

    write(userId, work) {
      // A fila da conta faz o papel da trava da linha no banco.
      const previous = queues.get(userId) ?? Promise.resolve()
      const run = previous.then(async () => {
        // A gravação mexe numa cópia, que só vira a conta se `work` terminar bem.
        const draft = copyAccount(accountOf(userId))
        const account: AccountWrite = {
          async nextChangeSeq() {
            draft.changeCounter += 1n
            return draft.changeCounter
          },
          async findCharacter(id) {
            const record = draft.characters.get(id)
            return record ? structuredClone(record) : null
          },
          async saveCharacter(record) {
            draft.characters.set(record.id, structuredClone(record))
          },
          async findPlayState(characterId) {
            const record = draft.playStates.get(characterId)
            return record ? structuredClone(record) : null
          },
          async savePlayState(record) {
            draft.playStates.set(record.characterId, structuredClone(record))
          },
        }
        const result = await work(account)
        accounts.set(userId, draft)
        return result
      })
      queues.set(userId, run.catch(() => undefined))
      return run
    },

    async findChangeHead(userId) {
      return accountOf(userId).changeCounter
    },

    async findCharacterChanges(userId, range) {
      return [...accountOf(userId).characters.values()]
        .filter(inRange(range))
        .sort(bySeq)
        .slice(0, range.limit)
        .map(record => structuredClone(record))
    },

    async findPlayStateChanges(userId, range) {
      const account = accountOf(userId)
      return [...account.playStates.values()]
        .filter(inRange(range))
        .filter(record => account.characters.get(record.characterId)?.deletedAt === null)
        .sort(bySeq)
        .slice(0, range.limit)
        .map(record => structuredClone(record))
    },
  }
}
