import { describe, it, expect } from 'vitest'
import type { ChangesResponse } from '@rpg/contracts'
import { createTestClock } from '../../../testing/test-app'
import { createMemoryCharactersRepository } from '../../characters/characters.repository.memory'
import { createCharactersService } from '../../characters/characters.service'
import { createSyncService } from '../sync.service'

const ANA = 'conta-da-ana'
const BIA = 'conta-da-bia'
const T0 = Date.UTC(2026, 10, 21, 12, 0, 0)

function setup(pageSize?: number) {
  const clock = createTestClock()
  const repository = createMemoryCharactersRepository()
  const characters = createCharactersService({ repository, clock: clock.now })
  const sync = createSyncService({ repository, pageSize })
  const put = (user: string, id: string, level: number, baseRevision = 0) =>
    characters.putCharacter(user, id, { system: 'dnd5e', step: 'name', draft: { name: id, level }, schema: 1, clientUpdatedAt: T0 + level, baseRevision })
  const play = (user: string, id: string, damageTaken: number, baseRevision = 0) =>
    characters.putPlayState(user, id, { state: { damageTaken }, schema: 1, clientUpdatedAt: T0 + damageTaken, baseRevision })
  return { characters, sync, put, play }
}

/** Lê página a página até acabar, como o aparelho faz. */
async function readAll(sync: ReturnType<typeof setup>['sync'], user: string, since?: string) {
  const pages: ChangesResponse[] = []
  let cursor = since
  for (let i = 0; i < 100; i++) {
    const page = await sync.listChanges(user, cursor)
    pages.push(page)
    cursor = page.cursor
    if (!page.hasMore) break
  }
  return {
    pages,
    cursor: cursor as string,
    characters: pages.flatMap(p => p.characters),
    playStates: pages.flatMap(p => p.playStates),
  }
}

describe('ler as mudanças da conta', () => {
  it('sem cursor, traz tudo; com o cursor devolvido, só o que mudou depois', async () => {
    const { sync, put, play } = setup()
    await put(ANA, 'a', 1)
    await put(ANA, 'b', 1)
    await play(ANA, 'a', 3)

    const first = await sync.listChanges(ANA, undefined)
    expect(first.hasMore).toBe(false)
    expect(first.cursor).toBe('3')
    expect(first.characters.map(c => c.id)).toEqual(['a', 'b'])
    expect(first.playStates).toEqual([{ characterId: 'a', state: { damageTaken: 3 }, schema: 1, clientUpdatedAt: T0 + 3, revision: 1 }])

    expect(await sync.listChanges(ANA, first.cursor)).toEqual({ cursor: '3', hasMore: false, characters: [], playStates: [] })

    await put(ANA, 'b', 2, 1)
    const second = await sync.listChanges(ANA, first.cursor)
    expect(second.cursor).toBe('4')
    expect(second.characters).toEqual([{
      id: 'b', system: 'dnd5e', step: 'name', draft: { name: 'b', level: 2 }, schema: 1,
      clientUpdatedAt: T0 + 2, revision: 2, deletedAt: null,
    }])
    expect(second.playStates).toEqual([])
  })

  it('a exclusão chega como lápide, sem o draft, e leva junto o estado de jogo', async () => {
    const { characters, sync, put, play } = setup()
    await put(ANA, 'a', 1)
    await play(ANA, 'a', 3)
    const { cursor } = await sync.listChanges(ANA, undefined)

    await characters.deleteCharacter(ANA, 'a', 1)
    const changes = await sync.listChanges(ANA, cursor)
    expect(changes.characters).toEqual([expect.objectContaining({ id: 'a', revision: 2, draft: null, deletedAt: expect.any(Number) })])
    expect(changes.playStates).toEqual([])

    // O aparelho novo recebe a lápide (precisa dela se tiver a ficha de antes), mas não o estado.
    const full = await sync.listChanges(ANA, undefined)
    expect(full.characters).toHaveLength(1)
    expect(full.playStates).toEqual([])
  })

  it('a ficha ressuscitada volta com o estado de jogo', async () => {
    const { characters, sync, put, play } = setup()
    await put(ANA, 'a', 1)
    await play(ANA, 'a', 3)
    await characters.deleteCharacter(ANA, 'a', 1)
    const { cursor } = await sync.listChanges(ANA, undefined)

    await put(ANA, 'a', 5, 2)
    const changes = await sync.listChanges(ANA, cursor)
    expect(changes.characters).toEqual([expect.objectContaining({ id: 'a', revision: 3, deletedAt: null })])
    expect(changes.playStates).toEqual([expect.objectContaining({ characterId: 'a', state: { damageTaken: 3 } })])
  })

  it('uma conta nunca vê as mudanças de outra', async () => {
    const { sync, put } = setup()
    await put(ANA, 'a', 1)
    await put(BIA, 'b', 1)
    expect((await sync.listChanges(ANA, undefined)).characters.map(c => c.id)).toEqual(['a'])
    expect((await sync.listChanges(BIA, undefined)).characters.map(c => c.id)).toEqual(['b'])
    expect(await sync.listChanges('conta-sem-nada', undefined)).toEqual({ cursor: '0', hasMore: false, characters: [], playStates: [] })
  })

  it('cursor à frente do que a conta tem recomeça do fim dela', async () => {
    const { sync, put } = setup()
    await put(ANA, 'a', 1)
    expect(await sync.listChanges(ANA, '999')).toEqual({ cursor: '1', hasMore: false, characters: [], playStates: [] })
  })
})

describe('paginação', () => {
  it('lendo página a página, cada mudança chega uma vez só e nenhuma fica para trás', async () => {
    const { sync, put, play } = setup(3)
    // Fichas e estados de jogo intercalados, para as duas listas estourarem em pontos diferentes.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    for (const id of ids) {
      await put(ANA, id, 1)
      await play(ANA, id, 1)
      await play(ANA, id, 2, 1)
    }

    const read = await readAll(sync, ANA)
    expect(read.pages.length).toBeGreaterThan(2)
    expect(read.characters.map(c => c.id)).toEqual(ids)
    expect(read.playStates.map(p => p.characterId)).toEqual(ids)
    expect(read.playStates.every(p => p.revision === 2)).toBe(true)
    for (const page of read.pages) {
      expect(page.characters.length).toBeLessThanOrEqual(3)
      expect(page.playStates.length).toBeLessThanOrEqual(3)
    }
    expect(read.cursor).toBe(String(ids.length * 3))

    // Nada de novo depois do fim.
    expect((await readAll(sync, ANA, read.cursor)).characters).toEqual([])
  })

  it('o que é gravado no meio da leitura chega na leitura seguinte', async () => {
    const { sync, put } = setup(2)
    for (const id of ['a', 'b', 'c', 'd', 'e']) await put(ANA, id, 1)

    const first = await sync.listChanges(ANA, undefined)
    expect(first.hasMore).toBe(true)
    await put(ANA, 'a', 2, 1)

    const rest = await readAll(sync, ANA, first.cursor)
    const seen = [...first.characters, ...rest.characters]
    expect(seen.map(c => `${c.id}@${c.revision}`)).toEqual(['a@1', 'b@1', 'c@1', 'd@1', 'e@1', 'a@2'])
  })
})
