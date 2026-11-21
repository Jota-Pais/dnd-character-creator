import { describe, it, expect } from 'vitest'
import type { PutCharacterRequest, PutPlayStateRequest, RemoteCharacter, RemotePlayState } from '@rpg/contracts'
import { AppError } from '../../../shared/errors'
import { createTestClock, only } from '../../../testing/test-app'
import { createMemoryCharactersRepository } from '../characters.repository.memory'
import { createCharactersService } from '../characters.service'

const ANA = 'conta-da-ana'
const BIA = 'conta-da-bia'
const T0 = Date.UTC(2026, 10, 21, 12, 0, 0)

function setup() {
  const clock = createTestClock()
  const repository = createMemoryCharactersRepository()
  const service = createCharactersService({ repository, clock: clock.now })
  return { clock, repository, service }
}

const sheet = (over: Partial<PutCharacterRequest> = {}): PutCharacterRequest => ({
  system: 'dnd5e',
  step: 'name',
  draft: { name: 'Krusk', level: 3 },
  schema: 1,
  clientUpdatedAt: T0,
  baseRevision: 0,
  ...over,
})

const play = (over: Partial<PutPlayStateRequest> = {}): PutPlayStateRequest => ({
  state: { damageTaken: 4 },
  schema: 1,
  clientUpdatedAt: T0,
  baseRevision: 0,
  ...over,
})

/** O erro de regra que a promessa rejeita. */
async function errorOf(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(AppError)
  return error as AppError
}

describe('gravar ficha', () => {
  it('cria com a revisão 1 e tira o nome do draft para a coluna do dono', async () => {
    const { repository, service } = setup()
    expect(await service.putCharacter(ANA, 'k1', sheet({ draft: { name: '  Krusk  ', level: 3 } }))).toEqual({ revision: 1 })

    const stored = only(repository.characters(ANA))
    expect(stored).toMatchObject({ id: 'k1', system: 'dnd5e', name: 'Krusk', step: 'name', revision: 1, changeSeq: 1n, deletedAt: null })
    expect(stored.draft).toEqual({ name: '  Krusk  ', level: 3 })
    expect(stored.clientUpdatedAt.getTime()).toBe(T0)
  })

  it('draft sem nome (ou com nome que não é texto) fica com a coluna vazia', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet({ draft: { level: 1 } }))
    await service.putCharacter(ANA, 'k2', sheet({ draft: { name: 42 } }))
    expect(repository.characters(ANA).map(c => c.name)).toEqual(['', ''])
  })

  it('a gravação que parte da revisão do servidor entra, e a revisão sobe', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    const next = sheet({ draft: { name: 'Krusk', level: 4 }, clientUpdatedAt: T0 + 1000, baseRevision: 1 })
    expect(await service.putCharacter(ANA, 'k1', next)).toEqual({ revision: 2 })
    expect(only(repository.characters(ANA))).toMatchObject({ revision: 2, changeSeq: 2n, draft: { name: 'Krusk', level: 4 } })
  })

  it('a que parte de uma revisão antiga é conflito, e a resposta traz a versão do servidor', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    await service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'Krusk', level: 4 }, clientUpdatedAt: T0 + 1000, baseRevision: 1 }))

    const error = await errorOf(service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'Krusk', level: 9 }, clientUpdatedAt: T0 + 2000, baseRevision: 1 })))
    expect(error.code).toBe('CONFLICT')
    expect(error.status).toBe(409)
    const current = error.extras?.current as RemoteCharacter
    expect(current).toEqual({
      id: 'k1', system: 'dnd5e', step: 'name', draft: { name: 'Krusk', level: 4 }, schema: 1,
      clientUpdatedAt: T0 + 1000, revision: 2, deletedAt: null,
    })
    // Nada foi gravado: o servidor não escolhe um lado.
    expect(only(repository.characters(ANA)).revision).toBe(2)
  })

  it('criar uma ficha cujo id o servidor já tem, com outro conteúdo, é conflito', async () => {
    const { service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    const error = await errorOf(service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'Outra' } })))
    expect(error.code).toBe('CONFLICT')
  })

  it('repetir o mesmo pedido responde a revisão atual, sem gravar de novo', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    // O aparelho não recebeu a resposta e repete, ainda com a base 0; a ordem das chaves muda.
    expect(await service.putCharacter(ANA, 'k1', sheet({ draft: { level: 3, name: 'Krusk' } }))).toEqual({ revision: 1 })
    expect(only(repository.characters(ANA)).changeSeq).toBe(1n)
    expect(await repository.findChangeHead(ANA)).toBe(1n)
  })

  it('mudar só a etapa já é outra gravação', async () => {
    const { service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    expect(await service.putCharacter(ANA, 'k1', sheet({ step: 'race', baseRevision: 1 }))).toEqual({ revision: 2 })
  })

  it('a ficha não troca de sistema', async () => {
    const { service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    const error = await errorOf(service.putCharacter(ANA, 'k1', sheet({ system: 'ordem', baseRevision: 1 })))
    expect(error.code).toBe('VALIDATION')
    expect(error.fields).toEqual({ system: 'Esta ficha é de outro sistema.' })
  })

  it('sem ficha no servidor, a gravação é a criação, qualquer que seja a base', async () => {
    const { service } = setup()
    expect(await service.putCharacter(ANA, 'k1', sheet({ baseRevision: 7 }))).toEqual({ revision: 1 })
  })

  it('o mesmo id em duas contas são duas fichas', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    expect(await service.putCharacter(BIA, 'k1', sheet({ draft: { name: 'Lia' } }))).toEqual({ revision: 1 })
    expect(only(repository.characters(ANA)).name).toBe('Krusk')
    expect(only(repository.characters(BIA)).name).toBe('Lia')
  })

  it('duas gravações da mesma base ao mesmo tempo: uma entra, a outra é conflito', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    const results = await Promise.allSettled([
      service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'A' }, baseRevision: 1 })),
      service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'B' }, baseRevision: 1 })),
    ])
    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(only(repository.characters(ANA)).revision).toBe(2)
  })
})

describe('apagar ficha', () => {
  it('vira lápide: a revisão sobe, o draft fica no banco, e some das fichas vivas', async () => {
    const { clock, repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    await service.deleteCharacter(ANA, 'k1', 1)

    const stored = only(repository.characters(ANA))
    expect(stored).toMatchObject({ revision: 2, changeSeq: 2n, draft: { name: 'Krusk', level: 3 } })
    expect(stored.deletedAt).toEqual(clock.now())
  })

  it('apagar de novo, ou apagar o que o servidor nunca teve, não é erro nem gravação', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    await service.deleteCharacter(ANA, 'k1', 1)
    await service.deleteCharacter(ANA, 'k1', 1)
    await service.deleteCharacter(ANA, 'nunca-existiu', 0)
    expect(await repository.findChangeHead(ANA)).toBe(2n)
  })

  it('a edição ganha da exclusão: apagar partindo de revisão antiga é conflito, com a ficha nova', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    await service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'Krusk', level: 4 }, baseRevision: 1 }))

    const error = await errorOf(service.deleteCharacter(ANA, 'k1', 1))
    expect(error.code).toBe('CONFLICT')
    expect((error.extras?.current as RemoteCharacter).draft).toEqual({ name: 'Krusk', level: 4 })
    expect(only(repository.characters(ANA)).deletedAt).toBeNull()
  })

  it('gravar sobre a lápide partindo da revisão dela ressuscita a ficha', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    await service.deleteCharacter(ANA, 'k1', 1)
    expect(await service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'Krusk', level: 5 }, baseRevision: 2 }))).toEqual({ revision: 3 })
    expect(only(repository.characters(ANA))).toMatchObject({ revision: 3, deletedAt: null, draft: { name: 'Krusk', level: 5 } })
  })

  it('gravar sobre a lápide sem conhecê-la é conflito, e a versão do servidor vem sem o draft', async () => {
    const { service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    await service.deleteCharacter(ANA, 'k1', 1)

    // O mesmo conteúdo de antes: a lápide não conta como "já está gravado".
    const error = await errorOf(service.putCharacter(ANA, 'k1', sheet({ baseRevision: 1 })))
    expect(error.code).toBe('CONFLICT')
    const current = error.extras?.current as RemoteCharacter
    expect(current.revision).toBe(2)
    expect(current.deletedAt).toEqual(expect.any(Number))
    expect(current.draft).toBeNull()
  })
})

describe('estado de jogo', () => {
  it('só existe para ficha que o servidor tem e não foi apagada', async () => {
    const { service } = setup()
    expect((await errorOf(service.putPlayState(ANA, 'k1', play()))).code).toBe('CHARACTER_NOT_FOUND')

    await service.putCharacter(ANA, 'k1', sheet())
    await service.deleteCharacter(ANA, 'k1', 1)
    expect((await errorOf(service.putPlayState(ANA, 'k1', play()))).code).toBe('CHARACTER_NOT_FOUND')

    // A ficha de outra conta não conta.
    await service.putCharacter(BIA, 'k2', sheet())
    expect((await errorOf(service.putPlayState(ANA, 'k2', play()))).code).toBe('CHARACTER_NOT_FOUND')
  })

  it('tem a revisão dele, separada da ficha, com as mesmas regras', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    expect(await service.putPlayState(ANA, 'k1', play())).toEqual({ revision: 1 })
    expect(await service.putPlayState(ANA, 'k1', play({ state: { damageTaken: 9 }, clientUpdatedAt: T0 + 500, baseRevision: 1 }))).toEqual({ revision: 2 })
    // Repetir o pedido não grava de novo.
    expect(await service.putPlayState(ANA, 'k1', play({ state: { damageTaken: 9 }, clientUpdatedAt: T0 + 500, baseRevision: 1 }))).toEqual({ revision: 2 })

    const error = await errorOf(service.putPlayState(ANA, 'k1', play({ state: { damageTaken: 1 }, clientUpdatedAt: T0 + 900, baseRevision: 1 })))
    expect(error.code).toBe('CONFLICT')
    expect(error.extras?.current as RemotePlayState).toEqual({
      characterId: 'k1', state: { damageTaken: 9 }, schema: 1, clientUpdatedAt: T0 + 500, revision: 2,
    })

    // Jogar não mexe na ficha.
    expect(only(repository.characters(ANA)).revision).toBe(1)
    expect(only(repository.playStates(ANA))).toMatchObject({ revision: 2, changeSeq: 3n })
  })

  it('ressuscitar a ficha devolve o estado de jogo aos aparelhos, com número de mudança novo', async () => {
    const { repository, service } = setup()
    await service.putCharacter(ANA, 'k1', sheet())
    await service.putPlayState(ANA, 'k1', play())
    await service.deleteCharacter(ANA, 'k1', 1)
    const before = only(repository.playStates(ANA))

    await service.putCharacter(ANA, 'k1', sheet({ draft: { name: 'Krusk', level: 5 }, baseRevision: 2 }))
    const after = only(repository.playStates(ANA))
    expect(after.revision).toBe(before.revision)
    expect(after.state).toEqual(before.state)
    expect(after.changeSeq).toBeGreaterThan(before.changeSeq)
  })
})

describe('o repositório em memória imita o banco', () => {
  it('a gravação que falha no meio não deixa nada', async () => {
    const { repository } = setup()
    await expect(repository.write(ANA, async account => {
      await account.saveCharacter({
        id: 'k1', system: 'dnd5e', name: 'x', step: 'name', draft: {}, schema: 1,
        clientUpdatedAt: new Date(T0), revision: 1, changeSeq: await account.nextChangeSeq(), deletedAt: null,
      })
      throw new Error('queda no meio')
    })).rejects.toThrow('queda no meio')
    expect(repository.characters(ANA)).toEqual([])
    expect(await repository.findChangeHead(ANA)).toBe(0n)
    // E a conta segue gravando depois da falha.
    await repository.write(ANA, async account => { await account.nextChangeSeq() })
    expect(await repository.findChangeHead(ANA)).toBe(1n)
  })
})
