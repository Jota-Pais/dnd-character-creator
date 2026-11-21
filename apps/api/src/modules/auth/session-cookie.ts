import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'

/** O nome do cookie de sessão. Uma fonte só, para a rota e a autenticação não divergirem. */
export const SESSION_COOKIE = 'forja_session'

/**
 * Quanto dura uma sessão sem uso. O app é para ficar conectado no aparelho (ele abre sem rede e
 * sincroniza quando dá), então a sessão é longa e se renova com o uso: só vence para quem passa
 * meses sem abrir o app com internet.
 */
export const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000

/** Renova a validade no máximo uma vez por dia: não precisa gravar no banco a cada pedido. */
export const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000

/** O token que vai no cookie: 32 bytes aleatórios. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/** O que o banco guarda do token: quem ler a tabela de sessões não consegue se passar por ninguém. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type SessionCookie = {
  read(req: Request): string | undefined
  set(res: Response, token: string, expiresAt: Date): void
  clear(res: Response): void
}

/**
 * O cookie de sessão: `HttpOnly` (o JavaScript da página nunca o lê), `SameSite=Lax` (outra página
 * não o manda em pedido que grava) e `Secure` em produção (só por https; em desenvolvimento o site
 * abre por http, inclusive pelo IP da rede, e com `Secure` o navegador não guardaria o cookie).
 */
export function createSessionCookie(options: { secure: boolean }): SessionCookie {
  const base = { httpOnly: true, secure: options.secure, sameSite: 'lax', path: '/' } as const
  return {
    read(req) {
      const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE]
      return typeof value === 'string' && value !== '' ? value : undefined
    },
    set(res, token, expiresAt) {
      res.cookie(SESSION_COOKIE, token, { ...base, expires: expiresAt })
    },
    clear(res) {
      res.clearCookie(SESSION_COOKIE, base)
    },
  }
}
