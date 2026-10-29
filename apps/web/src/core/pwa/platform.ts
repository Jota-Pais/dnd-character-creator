/**
 * Onde o app está rodando, para os avisos do app instalável (docs/app-instalavel.md): no iPhone (que
 * só instala pelo "Adicionar à Tela de Início") e se foi aberto pela tela de início.
 */

/** O que estas funções leem do `navigator` (os testes passam um de mentira). */
export type NavigatorLike = {
  userAgent: string
  maxTouchPoints?: number
  /** Só no iOS: true quando aberto pela tela de início. */
  standalone?: boolean
}

export type WindowLike = {
  navigator: NavigatorLike
  matchMedia?: (query: string) => { matches: boolean }
}

/**
 * iPhone, iPod ou iPad, em qualquer navegador (todos usam o WebKit no iOS). O iPad, desde o iPadOS
 * 13, se apresenta como Mac; o que o separa do Mac de verdade é a tela de toque.
 */
export function isIos(nav: NavigatorLike): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true
  return /Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1
}

/**
 * Aberto como app instalado (tela cheia, sem a barra do navegador): o modo standalone do manifesto,
 * no Android e no Chrome, ou o `navigator.standalone` do iPhone.
 */
export function isInstalled(win: WindowLike): boolean {
  if (win.navigator.standalone === true) return true
  return win.matchMedia?.('(display-mode: standalone)').matches === true
}

/** A dica "Adicionar à Tela de Início" da galeria: no iPhone, fora do app instalado, até ser dispensada. */
export function shouldShowInstallHint(win: WindowLike, dismissedAt: number | null): boolean {
  return dismissedAt === null && isIos(win.navigator) && !isInstalled(win)
}
