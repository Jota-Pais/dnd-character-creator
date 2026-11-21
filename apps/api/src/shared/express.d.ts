// `req.auth`: quem o pedido é, depois que a autenticação leu o cookie.
import type { User } from '@rpg/contracts'

declare global {
  namespace Express {
    interface Request {
      /**
       * Preenchido pela autenticação (modules/auth/authentication.ts). `undefined` em todo pedido
       * sem cookie de sessão válido: nunca confiar que existe sem passar por `requireAuth`.
       */
      auth?: { user: User; sessionId: string }
    }
  }
}
