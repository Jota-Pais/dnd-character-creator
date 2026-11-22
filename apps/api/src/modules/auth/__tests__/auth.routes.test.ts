import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../../../testing/test-app'
import { SESSION_COOKIE, SESSION_RENEW_AFTER_MS, SESSION_TTL_MS } from '../session-cookie'

const ANA = { email: 'ana@ficha.dev', password: 'dado-de-vinte' }

/** O Set-Cookie da sessão numa resposta, ou undefined. */
function sessionCookie(response: request.Response): string | undefined {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined
  return cookies?.find(cookie => cookie.startsWith(`${SESSION_COOKIE}=`))
}

describe('POST /api/auth/register', () => {
  it('cria a conta e conecta: o token só sai no cookie, HttpOnly e SameSite=Lax', async () => {
    const { app } = createTestApp()
    const response = await request(app).post('/api/auth/register').send(ANA)

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ user: { id: expect.any(String), email: 'ana@ficha.dev' } })
    const cookie = sessionCookie(response)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//i)
    expect(cookie).not.toMatch(/Secure/i)
    const token = /=([^;]+)/.exec(cookie ?? '')?.[1]
    expect(token).toBeTruthy()
    expect(JSON.stringify(response.body)).not.toContain(token)
  })

  it('em produção o cookie é Secure', async () => {
    const { app } = createTestApp({ secureCookies: true })
    const response = await request(app).post('/api/auth/register').send(ANA)
    expect(sessionCookie(response)).toMatch(/Secure/i)
  })

  it('guarda o e-mail em minúsculas e sem espaço em volta', async () => {
    const { app } = createTestApp()
    const response = await request(app).post('/api/auth/register').send({ email: '  Ana@Ficha.DEV ', password: ANA.password })
    expect(response.body.user.email).toBe('ana@ficha.dev')
    const again = await request(app).post('/api/auth/register').send({ email: 'ANA@ficha.dev', password: ANA.password })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('EMAIL_TAKEN')
    expect(again.body.error.fields.email).toBeTruthy()
  })

  it('diz o que há de errado em cada campo, em português', async () => {
    const { app } = createTestApp()
    const response = await request(app).post('/api/auth/register').send({ email: 'sem-arroba', password: 'curta' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION')
    expect(response.body.error.fields).toEqual({
      email: 'E-mail inválido.',
      password: 'A senha precisa de pelo menos 8 caracteres.',
    })

    const empty = await request(app).post('/api/auth/register').send({})
    expect(empty.body.error.fields).toEqual({ email: 'Informe o e-mail.', password: 'Informe a senha.' })
    expect(sessionCookie(empty)).toBeUndefined()
  })
})

describe('entrar, consultar a sessão e sair', () => {
  it('a sessão responde 200 também para quem não entrou', async () => {
    const response = await request(createTestApp().app).get('/api/auth/session')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ user: null })
  })

  it('o ciclo inteiro: criar conta, a sessão vale, sair, entrar de novo', async () => {
    const { app } = createTestApp()
    const browser = request.agent(app)

    const created = await browser.post('/api/auth/register').send(ANA)
    expect((await browser.get('/api/auth/session')).body).toEqual({ user: created.body.user })

    const out = await browser.post('/api/auth/logout')
    expect(out.status).toBe(204)
    expect(sessionCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970/i)
    expect((await browser.get('/api/auth/session')).body).toEqual({ user: null })

    const back = await browser.post('/api/auth/login').send(ANA)
    expect(back.status).toBe(200)
    expect(back.body).toEqual({ user: created.body.user })
    expect((await browser.get('/api/auth/session')).body).toEqual({ user: created.body.user })
  })

  it('senha errada é 401, sem cookie e sem dizer se a conta existe', async () => {
    const { app } = createTestApp()
    await request(app).post('/api/auth/register').send(ANA)
    const wrong = await request(app).post('/api/auth/login').send({ ...ANA, password: 'senha-errada' })
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ninguem@ficha.dev', password: 'senha-errada' })
    expect(wrong.status).toBe(401)
    expect(wrong.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' } })
    expect(unknown.body).toEqual(wrong.body)
    expect(sessionCookie(wrong)).toBeUndefined()
  })

  it('tentativas demais viram 429 com o tempo de espera', async () => {
    const { app } = createTestApp()
    await request(app).post('/api/auth/register').send(ANA)
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ ...ANA, password: 'senha-errada' })
    const blocked = await request(app).post('/api/auth/login').send(ANA)
    expect(blocked.status).toBe(429)
    expect(blocked.body.error).toEqual({ code: 'RATE_LIMITED', message: 'Muitas tentativas. Espere 15 minutos e tente de novo.' })
  })

  it('o cookie é reenviado quando a sessão se renova, e sai quando ela já não vale', async () => {
    const { app, clock } = createTestApp()
    const browser = request.agent(app)
    await browser.post('/api/auth/register').send(ANA)

    expect(sessionCookie(await browser.get('/api/auth/session'))).toBeUndefined()
    clock.advance(SESSION_RENEW_AFTER_MS)
    expect(sessionCookie(await browser.get('/api/auth/session'))).toMatch(/HttpOnly/i)

    clock.advance(SESSION_TTL_MS)
    const expired = await browser.get('/api/auth/session')
    expect(expired.body).toEqual({ user: null })
    expect(sessionCookie(expired)).toMatch(/Expires=Thu, 01 Jan 1970/i)
  })

  it('cookie com token inventado não conecta ninguém', async () => {
    const { app } = createTestApp()
    const response = await request(app).get('/api/auth/session').set('Cookie', `${SESSION_COOKIE}=token-inventado`)
    expect(response.body).toEqual({ user: null })
  })
})
