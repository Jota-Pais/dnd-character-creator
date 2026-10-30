import { create } from 'zustand'
import { watchTrips, type Trip } from '../native/backgroundTrips'
import { hasOpenLayer } from '../navigation/back'
import { useAppStore } from '../stores/appStore'

/**
 * O service worker do app instalável (docs/app-instalavel.md). O SW, gerado pelo vite-plugin-pwa
 * no build (`/sw.js`), guarda o build inteiro: sem rede, o app abre a última versão guardada.
 *
 * Versão nova (cada publicação na Vercel): o navegador acha o `sw.js` novo ao abrir o app, ou o
 * `checkForUpdateOnReturn` ao voltar para ele, e o SW novo baixa tudo e fica ESPERANDO. Ele só
 * assume quando nenhuma página usa mais o velho — a próxima abertura do app. Recarregar para usá-la
 * antes, só na galeria, onde não há ficha nem jogo aberto: pelo toque no aviso (`useAppUpdateStore`,
 * `applyUpdate`) e, só no APK do Android (docs/app-android.md), sozinho na volta do segundo plano
 * (`applyUpdateOnReturn`), porque lá a próxima abertura quase não acontece: abrir pelo ícone traz de
 * volta a página que o Android guardou. No criador e no jogo, nada recarrega a página, nunca. No
 * navegador e no iPhone, só o toque.
 */

/** Há versão nova baixada, esperando a próxima abertura (ou, no APK, a volta à galeria). */
export const useAppUpdateStore = create<{ updateReady: boolean }>(() => ({ updateReady: false }))

/** O que este arquivo usa do registro e do `navigator.serviceWorker` (os testes os simulam). */
export type SwRegistration = Pick<ServiceWorkerRegistration, 'waiting' | 'installing' | 'update' | 'addEventListener'>
export type SwContainer = Pick<ServiceWorkerContainer, 'controller' | 'addEventListener'> & {
  register: (url: string, options?: RegistrationOptions) => Promise<SwRegistration>
}
export type VisibilityDoc = Pick<Document, 'visibilityState' | 'addEventListener'>

export const SW_URL = '/sw.js'

/** A mensagem que o SW do Workbox entende para assumir sem esperar (só pelo `applyUpdateNow`). */
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
 * Aplica a versão que espera, pelo toque no aviso da galeria (ou, no APK, na volta à galeria): o
 * SW novo assume e a página recarrega quando ele está no controle. Sem versão esperando, não faz
 * nada (false).
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
 *
 * No APK (`alsoOnLeave`), a ida ao segundo plano também procura, no mesmo limite de uma vez por
 * hora. O download que começa na saída tem o tempo fora para terminar, e a versão entra sozinha já
 * na volta (`applyUpdateOnReturn`). Procurando só na volta, o download termina com o app de novo na
 * frente, tarde para ela, e a versão esperaria a volta seguinte. Se o Android congelar o app parado
 * antes do fim, o download continua na volta, como antes. No navegador e no iPhone, só a volta.
 */
export function checkForUpdateOnReturn(
  reg: SwRegistration,
  doc: VisibilityDoc,
  now: () => number = Date.now,
  alsoOnLeave: boolean = false,
): void {
  let lastCheck = now()
  doc.addEventListener('visibilitychange', () => {
    const watched = doc.visibilityState === 'visible' || (alsoOnLeave && doc.visibilityState === 'hidden')
    if (!watched || now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
    lastCheck = now()
    // Sem rede, a procura falha: tenta de novo na volta seguinte.
    reg.update().catch(() => {})
  })
}

/**
 * Quanto tempo fora, no mínimo, para a volta aplicar a versão nova sozinha: a volta que conta é a de
 * quem foi fazer outra coisa. Uma olhada rápida em outro app não pisca a tela, e uma ida do próprio
 * app que escapasse da marca (core/native/backgroundTrips.ts) só recarregaria passado esse tempo.
 */
export const AUTO_APPLY_MIN_AWAY_MS = 60 * 1000

/**
 * A galeria parada: é a tela aberta (os sistemas não têm galeria na tela; o "Meus personagens" deles
 * volta a esta, `activeSystemId` nulo) e nada está aberto nela. O menu "Novo personagem" e o
 * "Excluir?" registram o voltar do Android enquanto abertos (core/navigation/back.ts), e a galeria
 * sem nada aberto não registra nenhum.
 */
function isGalleryAtRest(): boolean {
  return useAppStore.getState().activeSystemId === null && !hasOpenLayer()
}

/**
 * Se a volta ao app aplica a versão que espera: só na galeria parada, depois de pelo menos
 * `AUTO_APPLY_MIN_AWAY_MS` fora, e nunca na volta de uma ida do próprio app (o seletor do Importar,
 * o "Salvar como", a impressão: core/native/backgroundTrips.ts), que recarregando perderia o
 * arquivo escolhido ou a cópia gravada.
 */
function shouldApplyOnReturn(trip: Trip, atRest: boolean): boolean {
  return atRest && !trip.own && trip.awayMs >= AUTO_APPLY_MIN_AWAY_MS
}

export type ApplyOnReturnOptions = {
  now?: () => number
  reload?: () => void
}

/**
 * Só no APK: na volta do segundo plano, com versão esperando e `shouldApplyOnReturn`, aplica pelo
 * caminho do "Atualizar agora" (`applyUpdateNow`): o SW novo assume e a página recarrega na galeria.
 * Ali, tudo o que importa já está gravado (as fichas, os avisos dispensados); só a busca digitada e o
 * agrupar/ordenar, que valem para a tela aberta, voltam ao começo. No criador e no jogo, nunca: a
 * versão espera a volta seguinte que dê na galeria.
 */
export function applyUpdateOnReturn(
  reg: SwRegistration,
  container: SwContainer,
  doc: VisibilityDoc,
  { now = Date.now, reload = () => window.location.reload() }: ApplyOnReturnOptions = {},
): void {
  watchTrips(doc, trip => {
    if (!useAppUpdateStore.getState().updateReady || !shouldApplyOnReturn(trip, isGalleryAtRest())) return
    // Sem versão esperando (outra aba já aplicou), o aviso sai, como no toque.
    if (!applyUpdateNow(reg, container, reload)) useAppUpdateStore.setState({ updateReady: false })
  }, now)
}

export type StartOptions = {
  /** Só o build de produção tem `sw.js`; no `npm run dev`, um SW guardaria o código velho. */
  isProd: boolean
  /** `navigator.serviceWorker`; ausente em contexto inseguro (http pelo IP da rede) e em navegador antigo. */
  container: SwContainer | undefined
  /** O registro espera a página carregar: a primeira abertura não divide a rede com o SW baixando o build. */
  whenLoaded: Promise<unknown>
  doc: VisibilityDoc
  /** No APK do Android: a ida ao segundo plano também procura, e a volta à galeria aplica sozinha. */
  native?: boolean
}

let registration: SwRegistration | null = null
let activeContainer: SwContainer | null = null

/** Registra o SW e passa a vigiar a versão nova. Devolve o registro, ou null quando não registra. */
export async function startServiceWorker({ isProd, container, whenLoaded, doc, native = false }: StartOptions): Promise<SwRegistration | null> {
  if (!isProd || !container) return null
  await whenLoaded
  try {
    const reg = await container.register(SW_URL, { scope: '/' })
    registration = reg
    activeContainer = container
    watchForUpdate(reg, container, () => useAppUpdateStore.setState({ updateReady: true }))
    checkForUpdateOnReturn(reg, doc, Date.now, native)
    if (native) applyUpdateOnReturn(reg, container, doc)
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
