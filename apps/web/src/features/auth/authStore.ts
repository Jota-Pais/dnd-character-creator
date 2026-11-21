import { create } from 'zustand'
import { loadAccount, type AccountUser } from './accountStorage'

/**
 * Como está a sessão de quem está conectado:
 *  - `unknown`: o app ainda não conseguiu perguntar ao servidor (abriu sem rede). O uso segue;
 *  - `valid`: o servidor confirmou a sessão;
 *  - `expired`: o servidor disse que ela não vale mais. O uso do aparelho continua (as fichas estão
 *    nele), a sincronização para, e a galeria pede para entrar de novo.
 */
export type SessionState = 'unknown' | 'valid' | 'expired'

export type AuthState = {
  /** Quem está conectado neste aparelho; `null` fecha o portão (a tela de entrar). */
  user: AccountUser | null
  session: SessionState
}

/**
 * Quem está conectado, para as telas. Começa pelo que o aparelho lembra (`accountStorage`), sem
 * esperar a rede: é o que deixa o app abrir sem internet para quem já entrou aqui. Quem muda este
 * estado são os fluxos de `session.ts`.
 */
export const useAuthStore = create<AuthState>(() => ({
  user: loadAccount().user,
  session: 'unknown',
}))
