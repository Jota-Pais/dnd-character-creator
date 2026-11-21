import type { Prisma } from '@prisma/client'
import { SYSTEM_IDS, type SystemId } from '@rpg/contracts'
import type { PrismaClient } from '../../shared/prisma'
import type {
  AccountWrite,
  CharacterRecord,
  CharactersRepository,
  JsonObject,
  PlayStateRecord,
} from './characters.repository'

const CHARACTER_FIELDS = {
  id: true,
  system: true,
  name: true,
  step: true,
  draft: true,
  schema: true,
  clientUpdatedAt: true,
  revision: true,
  changeSeq: true,
  deletedAt: true,
} as const

const PLAY_STATE_FIELDS = {
  characterId: true,
  state: true,
  schema: true,
  clientUpdatedAt: true,
  revision: true,
  changeSeq: true,
} as const

type CharacterRow = Prisma.CharacterGetPayload<{ select: typeof CHARACTER_FIELDS }>
type PlayStateRow = Prisma.PlayStateGetPayload<{ select: typeof PLAY_STATE_FIELDS }>

/** A coluna é texto livre; o que entra nela passou pelo contrato, que só aceita os dois sistemas. */
const toSystem = (value: string): SystemId =>
  (SYSTEM_IDS as readonly string[]).includes(value) ? (value as SystemId) : 'dnd5e'

/** O JSONB volta como `JsonValue`; aqui só se grava objeto. */
const toObject = (value: Prisma.JsonValue): JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}

const toCharacter = (row: CharacterRow): CharacterRecord => ({
  ...row,
  system: toSystem(row.system),
  draft: toObject(row.draft),
})

const toPlayState = (row: PlayStateRow): PlayStateRecord => ({ ...row, state: toObject(row.state) })

/** O repositório de fichas sobre o Prisma: o de produção. */
export function createPrismaCharactersRepository(prisma: PrismaClient): CharactersRepository {
  return {
    write(userId, work) {
      return prisma.$transaction(async tx => {
        // A trava da conta: a linha do usuário fica presa até a transação terminar, e a gravação
        // seguinte da mesma conta espera aqui.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`

        const account: AccountWrite = {
          async nextChangeSeq() {
            const rows = await tx.$queryRaw<{ change_counter: bigint }[]>`
              UPDATE users SET change_counter = change_counter + 1 WHERE id = ${userId}::uuid RETURNING change_counter`
            const row = rows[0]
            if (!row) throw new Error(`Conta ${userId} não encontrada ao numerar a mudança.`)
            return row.change_counter
          },

          async findCharacter(id) {
            const row = await tx.character.findUnique({ where: { userId_id: { userId, id } }, select: CHARACTER_FIELDS })
            return row ? toCharacter(row) : null
          },

          async saveCharacter(record) {
            const data = { ...record, draft: record.draft as Prisma.InputJsonObject }
            await tx.character.upsert({
              where: { userId_id: { userId, id: record.id } },
              create: { userId, ...data },
              update: data,
            })
          },

          async findPlayState(characterId) {
            const row = await tx.playState.findUnique({
              where: { userId_characterId: { userId, characterId } },
              select: PLAY_STATE_FIELDS,
            })
            return row ? toPlayState(row) : null
          },

          async savePlayState(record) {
            const data = { ...record, state: record.state as Prisma.InputJsonObject }
            await tx.playState.upsert({
              where: { userId_characterId: { userId, characterId: record.characterId } },
              create: { userId, ...data },
              update: data,
            })
          },
        }

        return work(account)
      })
    },

    async findChangeHead(userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { changeCounter: true } })
      return user?.changeCounter ?? 0n
    },

    async findCharacterChanges(userId, { after, upTo, limit }) {
      const rows = await prisma.character.findMany({
        where: { userId, changeSeq: { gt: after, lte: upTo } },
        orderBy: { changeSeq: 'asc' },
        take: limit,
        select: CHARACTER_FIELDS,
      })
      return rows.map(toCharacter)
    },

    async findPlayStateChanges(userId, { after, upTo, limit }) {
      const rows = await prisma.playState.findMany({
        where: { userId, changeSeq: { gt: after, lte: upTo }, character: { deletedAt: null } },
        orderBy: { changeSeq: 'asc' },
        take: limit,
        select: PLAY_STATE_FIELDS,
      })
      return rows.map(toPlayState)
    },
  }
}
