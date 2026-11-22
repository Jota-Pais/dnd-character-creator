import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { PutCharacterRequest } from '@rpg/contracts'
import { createPrismaAuthRepository } from '../modules/auth/auth.repository.prisma'
import { createAuthService } from '../modules/auth/auth.service'
import { createLoginThrottle } from '../modules/auth/login-throttle'
import { SESSION_RENEW_AFTER_MS, SESSION_TTL_MS } from '../modules/auth/session-cookie'
import { createPrismaCharactersRepository } from '../modules/characters/characters.repository.prisma'
import { createCharactersService } from '../modules/characters/characters.service'
import { createSyncService } from '../modules/sync/sync.service'
import { AppError } from '../shared/errors'
import { createTestClock } from '../testing/test-app'
import { createTestDatabase, type TestDatabase } from '../testing/test-database'

/**
 * Os repositórios do Prisma contra um Postgres de verdade (o PGlite, dentro do processo, com a
 * migration de prisma/migrations aplicada). As regras já estão provadas nos testes de serviço sobre
 * os repositórios em memória; aqui se prova que o SQL de produção faz o mesmo: a unicidade do
 * e-mail, a trava e o contador da conta, a ida e a volta do JSONB e do BIGINT, a transação que
 * desfaz tudo, os filtros da leitura de mudanças.
 */
const DEVICE = { userAgent: 'vitest' }
const T0 = Date.UTC(2026, 10, 21, 12, 0, 0)

let db: TestDatabase

beforeAll(async () => {
  db = await createTestDatabase()
}, 60_000)

beforeEach(() => db.reset())

afterAll(() => db.close())

function setup(pageSize?: number) {
  const clock = createTestClock()
  const authRepository = createPrismaAuthRepository(db.prisma)
  const charactersRepository = createPrismaCharactersRepository(db.prisma)
  return {
    clock,
    authRepository,
    charactersRepository,
    auth: createAuthService({ repository: authRepository, throttle: createLoginThrottle(clock.now), clock: clock.now, passwordCost: 4 }),
    characters: createCharactersService({ repository: charactersRepository, clock: clock.now }),
    sync: createSyncService({ repository: charactersRepository, pageSize }),
  }
}

const sheet = (over: Partial<PutCharacterRequest> = {}): PutCharacterRequest => ({
  system: 'dnd5e',
  step: 'name',
  draft: { name: 'Krusk', level: 3, classChoices: { skills: ['athletics'], nested: { b: 2, a: 1 } } },
  schema: 1,
  clientUpdatedAt: T0,
  baseRevision: 0,
  ...over,
})

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(AppError)
  return (error as AppError).code
}

describe('conta, no Postgres', () => {
  it('o ciclo inteiro: criar, entrar, renovar, sair, redefinir a senha', async () => {
    const { auth, clock } = setup()
    const created = await auth.register({ email: 'ana@ficha.dev', password: 'dado-de-vinte' }, DEVICE)
    expect(created.user.id).toMatch(/^[0-9a-f-]{36}$/)

    const phone = await auth.login({ email: 'ana@ficha.dev', password: 'dado-de-vinte' }, { userAgent: 'celular' })
    expect((await auth.authenticate(phone.token))?.user).toEqual(created.user)
    expect(await codeOf(auth.login({ email: 'ana@ficha.dev', password: 'senha-errada' }, DEVICE))).toBe('INVALID_CREDENTIALS')

    clock.advance(SESSION_RENEW_AFTER_MS)
    const renewed = await auth.authenticate(phone.token)
    expect(renewed?.renewedUntil?.getTime()).toBe(clock.now().getTime() + SESSION_TTL_MS)

    await auth.logout(phone.token)
    expect(await auth.authenticate(phone.token)).toBeNull()
    expect(await auth.authenticate(created.token)).not.toBeNull()

    expect(await auth.resetPassword('ana@ficha.dev', 'senha-nova-da-ana')).toBe(true)
    expect(await auth.authenticate(created.token)).toBeNull()
    expect((await auth.login({ email: 'ana@ficha.dev', password: 'senha-nova-da-ana' }, DEVICE)).user).toEqual(created.user)
  })

  it('o e-mail é único no banco', async () => {
    const { auth } = setup()
    await auth.register({ email: 'ana@ficha.dev', password: 'dado-de-vinte' }, DEVICE)
    expect(await codeOf(auth.register({ email: 'ana@ficha.dev', password: 'outra-senha-aqui' }, DEVICE))).toBe('EMAIL_TAKEN')
  })

  it('a faxina apaga só as sessões vencidas', async () => {
    const { auth, clock } = setup()
    const old = await auth.register({ email: 'ana@ficha.dev', password: 'dado-de-vinte' }, DEVICE)
    clock.advance(SESSION_TTL_MS - 1000)
    const fresh = await auth.login({ email: 'ana@ficha.dev', password: 'dado-de-vinte' }, DEVICE)
    clock.advance(1000)
    expect(await auth.sweepExpiredSessions()).toBe(1)
    expect(await auth.authenticate(old.token)).toBeNull()
    expect(await auth.authenticate(fresh.token)).not.toBeNull()
  })

  it('a listagem do dono conta as fichas vivas e diz o último uso', async () => {
    const { auth, authRepository, characters, clock } = setup()
    const ana = await auth.register({ email: 'ana@ficha.dev', password: 'dado-de-vinte' }, DEVICE)
    clock.advance(60_000)
    await auth.register({ email: 'bia@ficha.dev', password: 'dado-de-vinte' }, DEVICE)
    await characters.putCharacter(ana.user.id, 'k1', sheet())
    await characters.putCharacter(ana.user.id, 'k2', sheet())
    await characters.deleteCharacter(ana.user.id, 'k2', 1)

    const users = await authRepository.listUsers()
    expect(users.map(u => [u.email, u.characters])).toEqual([['ana@ficha.dev', 1], ['bia@ficha.dev', 0]])
    expect(users[0]?.lastSeenAt).toBeInstanceOf(Date)
  })
})

describe('fichas, no Postgres', () => {
  async function account() {
    const services = setup()
    const { user } = await services.auth.register({ email: 'ana@ficha.dev', password: 'dado-de-vinte' }, DEVICE)
    return { ...services, ana: user.id }
  }

  it('grava, sobe a revisão, detecta o conflito e reconhece o pedido repetido', async () => {
    const { ana, characters, charactersRepository } = await account()
    expect(await characters.putCharacter(ana, 'k1', sheet())).toEqual({ revision: 1 })

    // O JSONB não guarda a ordem das chaves: o pedido repetido, com outra ordem, é o mesmo.
    const reordered = sheet({ draft: { classChoices: { nested: { a: 1, b: 2 }, skills: ['athletics'] }, level: 3, name: 'Krusk' } })
    expect(await characters.putCharacter(ana, 'k1', reordered)).toEqual({ revision: 1 })
    expect(await charactersRepository.findChangeHead(ana)).toBe(1n)

    expect(await characters.putCharacter(ana, 'k1', sheet({ draft: { name: 'Krusk', level: 4 }, clientUpdatedAt: T0 + 1000, baseRevision: 1 }))).toEqual({ revision: 2 })
    expect(await codeOf(characters.putCharacter(ana, 'k1', sheet({ draft: { name: 'Krusk', level: 9 }, baseRevision: 1 })))).toBe('CONFLICT')

    const row = await db.prisma.character.findUniqueOrThrow({ where: { userId_id: { userId: ana, id: 'k1' } } })
    expect(row).toMatchObject({ name: 'Krusk', system: 'dnd5e', step: 'name', revision: 2, changeSeq: 2n, draft: { name: 'Krusk', level: 4 }, deletedAt: null })
    expect(row.clientUpdatedAt.getTime()).toBe(T0 + 1000)
  })

  it('apaga com lápide, ressuscita, e o estado de jogo acompanha', async () => {
    const { ana, characters, sync } = await account()
    await characters.putCharacter(ana, 'k1', sheet())
    expect(await characters.putPlayState(ana, 'k1', { state: { damageTaken: 4, rolls: [{ id: 'r1', total: 17 }] }, schema: 1, clientUpdatedAt: T0, baseRevision: 0 })).toEqual({ revision: 1 })
    expect(await codeOf(characters.putPlayState(ana, 'nao-existe', { state: {}, schema: 1, clientUpdatedAt: T0, baseRevision: 0 }))).toBe('CHARACTER_NOT_FOUND')

    await characters.deleteCharacter(ana, 'k1', 1)
    const deleted = await sync.listChanges(ana, undefined)
    expect(deleted.characters).toEqual([expect.objectContaining({ id: 'k1', revision: 2, draft: null, deletedAt: expect.any(Number) })])
    expect(deleted.playStates).toEqual([])
    // O banco do dono continua com o draft da ficha apagada.
    expect((await db.prisma.character.findUniqueOrThrow({ where: { userId_id: { userId: ana, id: 'k1' } } })).draft).toMatchObject({ name: 'Krusk' })

    expect(await characters.putCharacter(ana, 'k1', sheet({ draft: { name: 'Krusk', level: 5 }, baseRevision: 2 }))).toEqual({ revision: 3 })
    const back = await sync.listChanges(ana, deleted.cursor)
    expect(back.characters).toEqual([expect.objectContaining({ id: 'k1', revision: 3, deletedAt: null, draft: { name: 'Krusk', level: 5 } })])
    expect(back.playStates).toEqual([{ characterId: 'k1', state: { damageTaken: 4, rolls: [{ id: 'r1', total: 17 }] }, schema: 1, clientUpdatedAt: T0, revision: 1 }])
  })

  it('a gravação que falha no meio não deixa nada, nem o número de mudança', async () => {
    const { ana, charactersRepository } = await account()
    await expect(charactersRepository.write(ana, async write => {
      await write.saveCharacter({
        id: 'k1', system: 'dnd5e', name: 'x', step: 'name', draft: {}, schema: 1,
        clientUpdatedAt: new Date(T0), revision: 1, changeSeq: await write.nextChangeSeq(), deletedAt: null,
      })
      throw new Error('queda no meio')
    })).rejects.toThrow('queda no meio')
    expect(await db.prisma.character.count()).toBe(0)
    expect(await charactersRepository.findChangeHead(ana)).toBe(0n)
  })

  it('duas gravações da mesma base: uma entra, a outra é conflito', async () => {
    const { ana, characters } = await account()
    await characters.putCharacter(ana, 'k1', sheet())
    const results = await Promise.allSettled([
      characters.putCharacter(ana, 'k1', sheet({ draft: { name: 'A' }, baseRevision: 1 })),
      characters.putCharacter(ana, 'k1', sheet({ draft: { name: 'B' }, baseRevision: 1 })),
    ])
    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect((await db.prisma.character.findUniqueOrThrow({ where: { userId_id: { userId: ana, id: 'k1' } } })).revision).toBe(2)
  })

  it('a leitura das mudanças pagina sem pular nada e não mistura contas', async () => {
    const { ana, auth, characters, sync } = await account()
    const bia = (await auth.register({ email: 'bia@ficha.dev', password: 'dado-de-vinte' }, DEVICE)).user.id
    const ids = ['a', 'b', 'c', 'd', 'e']
    for (const id of ids) {
      await characters.putCharacter(ana, id, sheet({ draft: { name: id } }))
      await characters.putPlayState(ana, id, { state: { damageTaken: 1 }, schema: 1, clientUpdatedAt: T0, baseRevision: 0 })
    }
    await characters.putCharacter(bia, 'a', sheet({ draft: { name: 'da Bia' } }))

    const paged = setup(2).sync
    const seen: string[] = []
    const played: string[] = []
    let cursor: string | undefined
    for (let page = 0; page < 20; page++) {
      const changes = await paged.listChanges(ana, cursor)
      seen.push(...changes.characters.map(c => c.id))
      played.push(...changes.playStates.map(p => p.characterId))
      cursor = changes.cursor
      if (!changes.hasMore) break
    }
    expect(seen).toEqual(ids)
    expect(played).toEqual(ids)
    expect(cursor).toBe('10')

    expect((await sync.listChanges(bia, undefined)).characters).toEqual([expect.objectContaining({ id: 'a', draft: { name: 'da Bia' } })])
    expect(await sync.listChanges(ana, '10')).toEqual({ cursor: '10', hasMore: false, characters: [], playStates: [] })
  })
})
