import { describe, it, expect } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { ACCOUNT_HEADER, type User } from '@rpg/contracts'
import { createTestApp } from '../../../testing/test-app'

const T0 = Date.UTC(2026, 10, 21, 12, 0, 0)
const SHEET = { system: 'dnd5e', step: 'name', draft: { name: 'Krusk', level: 3 }, schema: 1, clientUpdatedAt: T0, baseRevision: 0 }

/** Um navegador com conta: o agente guarda o cookie, e `as` põe o cabeçalho da conta. */
async function signUp(app: Express, email = 'ana@ficha.dev') {
  const browser = request.agent(app)
  const response = await browser.post('/api/auth/register').send({ email, password: 'dado-de-vinte' })
  const user = response.body.user as User
  return { browser, user, account: { [ACCOUNT_HEADER]: user.id } }
}

describe('as rotas de ficha exigem a conta', () => {
  it('sem sessão é 401, nas fichas e na sincronização', async () => {
    const { app } = createTestApp()
    for (const response of [
      await request(app).put('/api/characters/k1').send(SHEET),
      await request(app).delete('/api/characters/k1?baseRevision=1'),
      await request(app).put('/api/characters/k1/play-state').send({}),
      await request(app).get('/api/sync/changes'),
    ]) {
      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    }
  })

  it('com sessão mas sem o cabeçalho da conta, ou com o de outra conta, é 403', async () => {
    const { app, repositories } = createTestApp()
    const ana = await signUp(app)
    const bia = await signUp(app, 'bia@ficha.dev')

    const missing = await ana.browser.put('/api/characters/k1').send(SHEET)
    expect(missing.status).toBe(403)
    expect(missing.body.error.code).toBe('ACCOUNT_MISMATCH')

    // A aba ainda tem as fichas da Bia, mas o cookie já é o da Ana.
    const stale = await ana.browser.put('/api/characters/k1').set(bia.account).send(SHEET)
    expect(stale.status).toBe(403)
    expect(repositories.characters.characters(ana.user.id)).toEqual([])
    expect(repositories.characters.characters(bia.user.id)).toEqual([])
  })
})

describe('o ciclo de uma ficha pela API', () => {
  it('cria, lê em outro aparelho, edita, conflita, apaga', async () => {
    const { app } = createTestApp()
    const computer = await signUp(app)
    // O celular: outro navegador, a mesma conta.
    const phone = request.agent(app)
    await phone.post('/api/auth/login').send({ email: 'ana@ficha.dev', password: 'dado-de-vinte' })

    const created = await computer.browser.put('/api/characters/k1').set(computer.account).send(SHEET)
    expect(created.status).toBe(200)
    expect(created.body).toEqual({ revision: 1 })

    const onPhone = await phone.get('/api/sync/changes').set(computer.account)
    expect(onPhone.status).toBe(200)
    expect(onPhone.body).toEqual({
      cursor: '1',
      hasMore: false,
      characters: [{ id: 'k1', system: 'dnd5e', step: 'name', draft: { name: 'Krusk', level: 3 }, schema: 1, clientUpdatedAt: T0, revision: 1, deletedAt: null }],
      playStates: [],
    })

    // O celular edita partindo da revisão 1.
    const edited = await phone.put('/api/characters/k1').set(computer.account)
      .send({ ...SHEET, draft: { name: 'Krusk', level: 4 }, clientUpdatedAt: T0 + 1000, baseRevision: 1 })
    expect(edited.body).toEqual({ revision: 2 })

    // O computador, que ainda está na 1, tenta gravar: 409 com a versão do servidor ao lado do erro.
    const conflicted = await computer.browser.put('/api/characters/k1').set(computer.account)
      .send({ ...SHEET, draft: { name: 'Krusk', level: 9 }, clientUpdatedAt: T0 + 2000, baseRevision: 1 })
    expect(conflicted.status).toBe(409)
    expect(conflicted.body.error).toEqual({ code: 'CONFLICT', message: 'Esta ficha mudou em outro aparelho.' })
    expect(conflicted.body.current).toMatchObject({ id: 'k1', revision: 2, draft: { name: 'Krusk', level: 4 } })

    // O estado de jogo vai na rota dele.
    const played = await phone.put('/api/characters/k1/play-state').set(computer.account)
      .send({ state: { damageTaken: 5 }, schema: 1, clientUpdatedAt: T0 + 3000, baseRevision: 0 })
    expect(played.body).toEqual({ revision: 1 })

    const afterPlay = await computer.browser.get('/api/sync/changes?since=1').set(computer.account)
    expect(afterPlay.body.cursor).toBe('3')
    expect(afterPlay.body.characters.map((c: { revision: number }) => c.revision)).toEqual([2])
    expect(afterPlay.body.playStates).toEqual([{ characterId: 'k1', state: { damageTaken: 5 }, schema: 1, clientUpdatedAt: T0 + 3000, revision: 1 }])

    // Apagar partindo da revisão antiga é conflito; da atual, 204.
    expect((await computer.browser.delete('/api/characters/k1?baseRevision=1').set(computer.account)).status).toBe(409)
    const removed = await computer.browser.delete('/api/characters/k1?baseRevision=2').set(computer.account)
    expect(removed.status).toBe(204)

    const afterDelete = await phone.get('/api/sync/changes?since=3').set(computer.account)
    expect(afterDelete.body.characters).toEqual([expect.objectContaining({ id: 'k1', revision: 3, draft: null, deletedAt: expect.any(Number) })])
  })

  it('o estado de jogo de ficha que o servidor não tem é 404', async () => {
    const { app } = createTestApp()
    const ana = await signUp(app)
    const response = await ana.browser.put('/api/characters/k1/play-state').set(ana.account)
      .send({ state: {}, schema: 1, clientUpdatedAt: T0, baseRevision: 0 })
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('CHARACTER_NOT_FOUND')
  })
})

describe('entrada inválida', () => {
  it('diz o campo errado, e nada é gravado', async () => {
    const { app, repositories } = createTestApp()
    const ana = await signUp(app)

    const response = await ana.browser.put('/api/characters/k1').set(ana.account)
      .send({ system: 'gurps', step: 'name', draft: ['lista'], schema: 0, clientUpdatedAt: -1 })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION')
    expect(Object.keys(response.body.error.fields).sort()).toEqual(['baseRevision', 'clientUpdatedAt', 'draft', 'schema', 'system'])
    expect(response.body.error.fields.system).toBe('Sistema desconhecido.')
    expect(repositories.characters.characters(ana.user.id)).toEqual([])
  })

  it('recusa id de ficha estranho, apagar sem a revisão e cursor que não é número', async () => {
    const { app } = createTestApp()
    const ana = await signUp(app)

    const badId = await ana.browser.put(`/api/characters/${encodeURIComponent('a b/c')}`).set(ana.account).send(SHEET)
    expect(badId.status).toBe(400)
    expect(badId.body.error.fields['(body)']).toBe('Id de ficha inválido.')

    const noRevision = await ana.browser.delete('/api/characters/k1').set(ana.account)
    expect(noRevision.status).toBe(400)
    expect(noRevision.body.error.fields.baseRevision).toBeTruthy()

    const badCursor = await ana.browser.get('/api/sync/changes?since=abc').set(ana.account)
    expect(badCursor.status).toBe(400)
    expect(badCursor.body.error.fields.since).toBe('Cursor inválido.')
  })

  it('aceita os ids que o app gera: o UUID e o formato antigo', async () => {
    const { app } = createTestApp()
    const ana = await signUp(app)
    for (const id of ['3f2b8c1e-9d4a-4f6b-8a1c-2e5d7f9b0c3a', 'char-1732190400000-123456789']) {
      const response = await ana.browser.put(`/api/characters/${id}`).set(ana.account).send(SHEET)
      expect(response.body).toEqual({ revision: 1 })
    }
  })
})
