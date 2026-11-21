import type { RequestHandler } from 'express'
import type { AuthService } from './auth.service'
import type { SessionCookie } from './session-cookie'

/**
 * Lê o cookie de sessão e preenche `req.auth`. Nunca recusa por conta própria: sempre chega ao
 * `next()`. Quem recusa é o `requireAuth` de cada rota; sem essa separação, uma rota pública como
 * a de entrar exigiria sessão para existir.
 */
export function authentication(service: AuthService, cookie: SessionCookie): RequestHandler {
  return async (req, res, next) => {
    const token = cookie.read(req)
    if (token === undefined) {
      next()
      return
    }
    const authenticated = await service.authenticate(token)
    if (authenticated) {
      req.auth = { user: authenticated.user, sessionId: authenticated.sessionId }
      // A sessão se renova com o uso: o cookie acompanha a validade nova.
      if (authenticated.renewedUntil) cookie.set(res, token, authenticated.renewedUntil)
    } else {
      // Token que não vale mais (sessão vencida, ou encerrada em outro lugar): o cookie sai.
      cookie.clear(res)
    }
    next()
  }
}
