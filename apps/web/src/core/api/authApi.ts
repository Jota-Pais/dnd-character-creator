import type { AuthResponse, LoginRequest, RegisterRequest, SessionResponse } from '@rpg/contracts'
import type { ApiClient, ApiResult } from './client'

/**
 * As rotas de conta (`/api/auth`), uma função por rota. O token da sessão nunca passa por aqui: vai
 * e volta num cookie `HttpOnly`, que o JavaScript não lê.
 */

/**
 * Entrar e criar conta esperam mais que o resto: no plano gratuito da Render, a API dorme sem uso, e
 * o primeiro pedido depois disso pode levar até um minuto.
 */
const AUTH_TIMEOUT_MS = 70_000

export const register = (api: ApiClient, data: RegisterRequest): Promise<ApiResult<AuthResponse>> =>
  api.request('POST', '/api/auth/register', { body: data, timeoutMs: AUTH_TIMEOUT_MS })

export const login = (api: ApiClient, data: LoginRequest): Promise<ApiResult<AuthResponse>> =>
  api.request('POST', '/api/auth/login', { body: data, timeoutMs: AUTH_TIMEOUT_MS })

export const logout = (api: ApiClient): Promise<ApiResult<void>> => api.request('POST', '/api/auth/logout')

/** Quem o cookie deste navegador diz que está conectado; `user: null` é ninguém (não é erro). */
export const getSession = (api: ApiClient): Promise<ApiResult<SessionResponse>> => api.request('GET', '/api/auth/session')
