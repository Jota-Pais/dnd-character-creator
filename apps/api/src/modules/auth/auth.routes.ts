import { Router, type Request } from 'express'
import { loginSchema, registerSchema, type AuthResponse, type SessionResponse } from '@rpg/contracts'
import type { AuthService } from './auth.service'
import type { SessionCookie } from './session-cookie'

const deviceOf = (req: Request) => ({ userAgent: req.get('user-agent') ?? null })

/**
 * As rotas de conta, sob /api/auth. Todas públicas: criar conta, entrar e sair não exigem sessão, e
 * a consulta de sessão responde 200 também para quem não entrou. O token da sessão só sai no
 * cookie, nunca no corpo da resposta.
 */
export function authRoutes(service: AuthService, cookie: SessionCookie): Router {
  const router = Router()

  router.post('/register', async (req, res) => {
    const data = registerSchema.parse(req.body)
    const session = await service.register(data, deviceOf(req))
    cookie.set(res, session.token, session.expiresAt)
    const body: AuthResponse = { user: session.user }
    res.status(201).json(body)
  })

  router.post('/login', async (req, res) => {
    const data = loginSchema.parse(req.body)
    const session = await service.login(data, deviceOf(req))
    cookie.set(res, session.token, session.expiresAt)
    const body: AuthResponse = { user: session.user }
    res.json(body)
  })

  router.post('/logout', async (req, res) => {
    await service.logout(cookie.read(req))
    cookie.clear(res)
    res.status(204).end()
  })

  router.get('/session', (req, res) => {
    const body: SessionResponse = { user: req.auth?.user ?? null }
    res.json(body)
  })

  return router
}
