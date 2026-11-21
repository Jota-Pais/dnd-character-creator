import { describe, it, expect } from 'vitest'
import viteConfig from '../../../vite.config.ts?raw'

/**
 * A API mora em /api, na mesma origem do site, e o service worker guarda o site para abrir sem rede.
 * As duas coisas só convivem se o service worker nunca responder por /api: uma resposta guardada de
 * /api seria uma ficha velha, ou a sessão de outra pessoa. Este teste prende, na configuração, os
 * pontos que garantem isso.
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
