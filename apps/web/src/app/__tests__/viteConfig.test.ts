import { describe, it, expect } from 'vitest'
import viteConfig from '../../../vite.config.ts?raw'
import vercelConfigRaw from '../../../../../vercel.json?raw'

/**
 * A API mora em /api, na mesma origem do site, e o service worker guarda o site para abrir sem rede.
 * As duas coisas só convivem se o service worker nunca responder por /api: uma resposta guardada de
 * /api seria uma ficha velha, ou a sessão de outra pessoa. Este teste prende, na configuração, os
 * pontos que garantem isso, e o repasse de /api da Vercel para a API na Render.
 */

/** A configuração sem as linhas de comentário, que explicam o que ela NÃO tem. */
const code = viteConfig.replace(/^\s*\/\/.*$/gm, '')

describe('vite.config.ts', () => {
  it('a navegação para /api não cai no index.html guardado', () => {
    expect(code).toContain('navigateFallbackDenylist: [/^\\/api\\//]')
  })

  it('o service worker não guarda nada em tempo de execução: só o build', () => {
    expect(code).not.toContain('runtimeCaching')
  })

  it('em desenvolvimento, /api vai para a API pelo proxy, sem trocar o Host', () => {
    expect(code).toMatch(/proxy:\s*\{\s*'\/api':/)
    expect(code).not.toContain('changeOrigin')
  })
})

interface VercelConfig {
  rewrites?: { source: string; destination: string }[]
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

const vercelConfig = JSON.parse(vercelConfigRaw) as VercelConfig

describe('vercel.json', () => {
  // Em produção, /api chega à API por um rewrite da Vercel: o cookie de sessão fica da origem do
  // site, e não há CORS. O endereço é o do serviço na Render (o `name` do render.yaml).
  it('repassa /api inteiro para a API na Render, pelo mesmo caminho', () => {
    expect(vercelConfig.rewrites).toEqual([
      { source: '/api/:path*', destination: 'https://criador-de-ficha-api.onrender.com/api/:path*' },
    ])
  })

  // A API já responde com `Cache-Control: no-store`; este cabeçalho é a segunda trava, para a Vercel
  // nunca guardar a resposta do rewrite (a ficha ou a sessão de outra pessoa).
  it('a Vercel não guarda a resposta do rewrite', () => {
    const apiHeaders = vercelConfig.headers?.find(rule => rule.source === '/api/:path*')?.headers
    expect(apiHeaders).toContainEqual({ key: 'x-vercel-enable-rewrite-caching', value: '0' })
  })
})
