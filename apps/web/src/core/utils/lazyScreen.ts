import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Tela que desce sob demanda (docs/app-instalavel.md, seção 5): o Ordem Paranormal e a ficha
 * imprimível ficam fora do JS da primeira abertura, em pedaços próprios do build (`import()`), e a
 * galeria aparece antes. Quem mostra a tela a põe dentro de um `Suspense`, que segura a vez enquanto
 * o pedaço desce.
 *
 * Todo pedaço desce logo depois da abertura (`preloadLazyScreens`, no `main.tsx`, depois do `load`),
 * e não só no primeiro toque: a página fica com o código inteiro da versão dela antes de qualquer
 * troca de versão. O SW novo que assume com a página aberta (o "Atualizar agora" e, no APK, a volta
 * à galeria: core/pwa/serviceWorker.ts) tira do cache os pedaços da versão velha, e a Vercel só
 * serve os da nova: pedido depois, o pedaço velho não viria nem com rede.
 *
 * Já carregada, a tela monta no mesmo render, sem passar pelo `fallback`: o `lazy` do React chama o
 * `then` do que a fábrica devolve e confere na hora se ele respondeu (`settled`). Com a promessa
 * comum, ele suspenderia uma vez, e o `fallback` piscaria a cada primeira abertura da tela.
 */

type Loader = () => Promise<ComponentType>

const preloads: (() => Promise<ComponentType>)[] = []

export function lazyScreen(load: Loader): LazyExoticComponent<ComponentType> {
  let loaded: ComponentType | null = null
  let loading: Promise<ComponentType> | null = null
  const preload = () => {
    loading ??= load().then(
      component => (loaded = component),
      (error: unknown) => {
        // Sem rede antes de o SW guardar o build: a próxima vez (o toque) tenta de novo.
        loading = null
        throw error
      },
    )
    return loading
  }
  preloads.push(preload)
  return lazy(() => (loaded ? settled({ default: loaded }) : preload().then(component => ({ default: component }))))
}

/** Desce os pedaços de todas as telas sob demanda. Nunca falha: a que não desceu tenta no toque. */
export function preloadLazyScreens(): Promise<unknown> {
  return Promise.allSettled(preloads.map(preload => preload()))
}

/** Um `then` que responde na hora, no mesmo render (ver o comentário do arquivo). */
function settled<T>(value: T): Promise<T> {
  const thenable = {
    then: <R>(onFulfilled?: (value: T) => R) => Promise.resolve(onFulfilled ? onFulfilled(value) : value),
  }
  return thenable as unknown as Promise<T>
}
