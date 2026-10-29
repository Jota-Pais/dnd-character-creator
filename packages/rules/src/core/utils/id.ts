import { cryptoRng, type Rng } from '../dice/rng'

/**
 * Id único para o que o app guarda (fichas, rolagens). Usa `crypto.randomUUID`; fora de contexto
 * seguro (o app aberto pelo IP da rede, em http) ele não existe, e o id sai do momento e da fonte
 * comum de aleatoriedade (`cryptoRng`), com o prefixo dizendo o que é: "char-…", "roll-…".
 */
export function createId(prefix: string, rng: Rng = cryptoRng): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  return `${prefix}-${Date.now()}-${Math.floor(rng() * 1e9)}`
}
