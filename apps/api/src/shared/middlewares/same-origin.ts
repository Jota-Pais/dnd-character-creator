import type { RequestHandler } from 'express'
import { forbiddenOrigin } from '../errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Pedido que grava só vale vindo do site. A sessão vai num cookie, e o navegador o manda junto com
 * qualquer pedido para a API, também o que outra página dispara; o `SameSite=Lax` do cookie já
 * barra isso, e esta conferência do `Origin` é a segunda trava.
 *
 * `allowed` são as origens do site (`APP_ORIGIN`). Sem lista (desenvolvimento), vale a origem que
 * bate com o `Host` do pedido: o proxy do Vite repassa o host da página, seja `localhost` ou o IP da
 * rede. Pedido sem `Origin` não veio de um navegador (um script, o curl) e passa: sem navegador não
 * há cookie de ninguém para abusar.
 */
export function sameOrigin(allowed: readonly string[] | undefined): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next()
      return
    }
    const origin = req.get('origin')
    if (origin === undefined) {
      next()
      return
    }
    const ok = allowed && allowed.length > 0 ? allowed.includes(origin) : hostOf(origin) === req.get('host')
    next(ok ? undefined : forbiddenOrigin())
  }
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host
  } catch {
    return null
  }
}
