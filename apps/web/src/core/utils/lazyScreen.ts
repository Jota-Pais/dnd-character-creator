import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Tela que desce sob demanda (docs/app-instalavel.md, seção 5): o Ordem Paranormal e a ficha
 * imprimível ficam fora do JS da primeira abertura, em pedaços próprios do build (`import()`), e a
 * galeria aparece antes. Quem mostra a tela a põe dentro de um `Suspense`, que segura a vez enquanto
 * o pedaço desce.
 *
 * Todo pedaço desce sozinho na abertura (`preloadAfterOpening`, no `main.tsx`), e não só no
 * primeiro toque: a página fica com o código inteiro da versão dela antes de qualquer
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

/** O que a abertura do app oferece para saber quando ela terminou (os testes simulam). */
export type Opening = {
  /** A página veio do SW (`navigator.serviceWorker.controller`): as aberturas depois da primeira visita. */
  fromServiceWorker: boolean
  /** O `document`: se a página está escondida. */
  doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  /** O `load` da página. */
  whenLoaded: Promise<unknown>
  /** O `#root`: com conteúdo, a primeira tela está no ar. */
  root: Pick<Node, 'hasChildNodes'>
  /** As fontes da página (`document.fonts`). */
  fonts: Pick<FontFaceSet, 'ready'>
  /** Espera o próximo quadro desenhado. */
  nextPaint?: () => Promise<void>
}

/**
 * Na primeira visita, desce os pedaços quando a abertura termina: a página carregada, a primeira tela
 * desenhada e as fontes dela na mão. O navegador só pede as fontes ao desenhar a primeira tela, e no
 * celular lento o React a desenha depois do `load`: descendo no `load`, os pedaços disputavam a rede
 * com as fontes, e no 4G lento elas chegavam 0,4 s depois (medido em 2026-10-31, docs/app-instalavel.md).
 *
 * Aberta pelo SW (as aberturas seguintes), desce na hora, antes de a galeria aparecer: os pedaços
 * saem do cache dele, e não há rede a disputar. Esperando a abertura, eles chegavam uns 0,3 s depois
 * da galeria, e o toque nesse meio (o "Abrir" de um agente do Ordem) via o "Carregando…" por 0,3 s,
 * o tempo que o React segura o `fallback` que entrou.
 *
 * Escondida (aberta em segundo plano, como no Ctrl+clique, ou deixada no meio da abertura), também
 * desce na hora: não há tela sendo desenhada a proteger, e o navegador não desenha quadro em página
 * escondida (o `requestAnimationFrame` para). Esperando, ela ficaria sem os pedaços até voltar à
 * vista, e o "Atualizar agora" de outra aba, nesse meio, trocaria a versão sem eles.
 */
export async function preloadAfterOpening({ fromServiceWorker, doc, ...opening }: Opening): Promise<unknown> {
  if (!fromServiceWorker) {
    const hidden = whenHidden(doc)
    // Se a página se esconde antes, a espera da abertura fica parada no quadro e só termina quando
    // ela volta à vista, sem efeito: cada pedaço desce uma vez só.
    await Promise.race([openingDone(opening), hidden.promise])
    hidden.stop()
  }
  return preloadLazyScreens()
}

/** A página carregada, a primeira tela desenhada e as fontes dela na mão. */
async function openingDone({ whenLoaded, root, fonts, nextPaint = afterNextPaint }: Omit<Opening, 'fromServiceWorker' | 'doc'>): Promise<void> {
  await whenLoaded
  while (!root.hasChildNodes()) await nextPaint()
  // O quadro seguinte ao da primeira tela: é nele que o navegador pede as fontes que ela usa.
  await nextPaint()
  await fonts.ready
}

/** Cumpre quando a página fica escondida, ou na hora se ela já está; `stop` larga o evento. */
function whenHidden(doc: Opening['doc']): { promise: Promise<void>; stop: () => void } {
  let onChange!: () => void
  const promise = new Promise<void>(resolve => {
    onChange = () => {
      if (doc.visibilityState === 'hidden') resolve()
    }
  })
  onChange()
  doc.addEventListener('visibilitychange', onChange)
  return { promise, stop: () => doc.removeEventListener('visibilitychange', onChange) }
}

/** Depois do próximo quadro: o `requestAnimationFrame` roda antes do desenho, e o `setTimeout`, depois. */
function afterNextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
}

/** Um `then` que responde na hora, no mesmo render (ver o comentário do arquivo). */
function settled<T>(value: T): Promise<T> {
  const thenable = {
    then: <R>(onFulfilled?: (value: T) => R) => Promise.resolve(onFulfilled ? onFulfilled(value) : value),
  }
  return thenable as unknown as Promise<T>
}
