import { create } from 'zustand'

/**
 * O service worker do app instalável (docs/app-instalavel.md). O SW, gerado pelo vite-plugin-pwa
 * no build (`/sw.js`), guarda o build inteiro: sem rede, o app abre a última versão guardada.
 *
 * Versão nova (cada publicação na Vercel): o navegador acha o `sw.js` novo ao abrir o app, ou o
 * `checkForUpdateOnReturn` ao voltar para ele, e o SW novo baixa tudo e fica ESPERANDO. Ele só
 * assume quando nenhuma página usa mais o velho — a próxima abertura do app. Nada aqui recarrega a
 * página sozinho: no meio do jogo, nunca. A galeria mostra o aviso (`useAppUpdateStore`) e aplica
 * na hora só pelo toque (`applyUpdate`), porque ali não há jogo aberto.
 */

/** Há versão nova baixada, esperando a próxima abertura. */
export const useAppUpdateStore = create<{ updateReady: boolean }>(() => ({ updateReady: false }))

/** O que este arquivo usa do registro e do `navigator.serviceWorker` (os testes os simulam). */
export type SwRegistration = Pick<ServiceWorkerRegistration, 'waiting' | 'installing' | 'update' | 'addEventListener'>
export type SwContainer = Pick<ServiceWorkerContainer, 'controller' | 'addEventListener'> & {
  register: (url: string, options?: RegistrationOptions) => Promise<SwRegistration>
}

export const SW_URL = '/sw.js'

/** A mensagem que o SW do Workbox entende para assumir sem esperar (só pelo `applyUpdate`). */
export const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' } as const

/**
 * Chama `onReady` quando há versão nova esperando: a que já estava esperando ao abrir (baixada na
 * abertura anterior, com o app ainda vivo em outra aba) e a que termina de baixar agora. A primeira
 * instalação não é versão nova: sem SW no controle da página, não há versão velha a trocar.
 */
export function watchForUpdate(reg: SwRegistration, container: SwContainer, onReady: () => void): void {
  const check = () => {
    if (reg.waiting && container.controller) onReady()
  }
  check()
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') check()
    })
  })
}

/**
 * Aplica a versão que espera, pelo toque no aviso da galeria: o SW novo assume e a página recarrega
 * quando ele está no controle. Sem versão esperando, não faz nada (false).
 */
export function applyUpdateNow(reg: SwRegistration, container: SwContainer, reload: () => void): boolean {
  const waiting = reg.waiting
  if (!waiting) return false
  container.addEventListener('controllerchange', () => reload(), { once: true })
  waiting.postMessage(SKIP_WAITING_MESSAGE)
  return true
}

/** De quanto em quanto tempo, no máximo, a volta ao app procura versão nova. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * O app que fica vivo em segundo plano (o celular volta a ele sem abrir de novo) não navega, e o
 * navegador só procura `sw.js` novo ao navegar. A volta ao app procura, no máximo uma vez por
 * `UPDATE_CHECK_INTERVAL_MS`; achando, o SW novo baixa e espera, como na abertura.
 */
export function checkForUpdateOnReturn(
  reg: SwRegistration,
  doc: Pick<Document, 'visibilityState' | 'addEventListener'>,
  now: () => number = Date.now,
): void {
  let lastCheck = now()
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible' || now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
    lastCheck = now()
    // Sem rede, a procura falha: tenta de novo na volta seguinte.
    reg.update().catch(() => {})
  })
}

export type StartOptions = {
  /** Só o build de produção tem `sw.js`; no `npm run dev`, um SW guardaria o código velho. */
  isProd: boolean
  /** `navigator.serviceWorker`; ausente em contexto inseguro (http pelo IP da rede) e em navegador antigo. */
  container: SwContainer | undefined
  /** O registro espera a página carregar: a primeira abertura não divide a rede com o SW baixando o build. */
  whenLoaded: Promise<unknown>
  doc: Pick<Document, 'visibilityState' | 'addEventListener'>
}

let registration: SwRegistration | null = null
let activeContainer: SwContainer | null = null

/** Registra o SW e passa a vigiar a versão nova. Devolve o registro, ou null quando não registra. */
export async function startServiceWorker({ isProd, container, whenLoaded, doc }: StartOptions): Promise<SwRegistration | null> {
  if (!isProd || !container) return null
  await whenLoaded
  try {
    const reg = await container.register(SW_URL, { scope: '/' })
    registration = reg
    activeContainer = container
    watchForUpdate(reg, container, () => useAppUpdateStore.setState({ updateReady: true }))
    checkForUpdateOnReturn(reg, doc)
    return reg
  } catch {
    // Sem SW (navegação privada que o recusa, armazenamento cheio): o app funciona com rede.
    return null
  }
}

/** O toque "Atualizar agora" da galeria. */
export function applyUpdate(reload: () => void = () => window.location.reload()): boolean {
  if (!registration || !activeContainer) return false
  return applyUpdateNow(registration, activeContainer, reload)
}
