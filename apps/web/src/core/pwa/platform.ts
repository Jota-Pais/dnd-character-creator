/**
 * Onde o app está rodando, para os avisos e a instalação do app instalável (docs/app-instalavel.md):
 * no iPhone (que só instala pelo "Adicionar à Tela de Início"), no Android (onde o app é o APK) e se
 * foi aberto pela tela de início.
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
 * Android, em qualquer navegador (e no WebView do APK). O Chrome em modo computador (o padrão nos
 * tablets grandes, e o "Site para computador" do celular) se apresenta como Linux de mesa, sem o
 * "Android"; como no iPad que se diz Mac, o que o separa do Linux de verdade é a tela de toque. O
 * Linux de mesa com tela de toque passa por Android (o Chromebook se diz CrOS, não Linux).
 */
export function isAndroid(nav: NavigatorLike): boolean {
  if (/Android/.test(nav.userAgent)) return true
  return /\bLinux\b/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1
}

/**
 * Aberto como app instalado (tela cheia, sem a barra do navegador): o modo standalone do manifesto,
 * no Android e no Chrome, ou o `navigator.standalone` do iPhone.
 */
export function isInstalled(win: WindowLike): boolean {
  if (win.navigator.standalone === true) return true
  return win.matchMedia?.('(display-mode: standalone)').matches === true
}

/**
 * Onde as fichas moram, nos textos da galeria. No APK do Android e no app instalado, "neste app":
 * o do APK guarda à parte do Chrome, e o do iPhone, à parte do Safari. No navegador, "neste
 * navegador".
 */
export function sheetsPlace(win: WindowLike, native: boolean): 'neste app' | 'neste navegador' {
  return native || isInstalled(win) ? 'neste app' : 'neste navegador'
}

/** A dica "Adicionar à Tela de Início" da galeria: no iPhone, fora do app instalado, até ser dispensada. */
export function shouldShowInstallHint(win: WindowLike, dismissedAt: number | null): boolean {
  return dismissedAt === null && isIos(win.navigator) && !isInstalled(win)
}

/**
 * No Android, o app é o APK (docs/app-android.md). Sozinho, o Chrome ofereceria instalar o site (a
 * barrinha de instalar, pelo `beforeinstallprompt`), e o que ele instala é um segundo "Forja", que
 * guarda as fichas à parte das do APK: a turma se confundiria. Recusar o evento tira a oferta
 * automática, também no Chrome em modo computador do tablet (`isAndroid`). O "Instalar app" do menu
 * do Chrome continua, como escolha de quem o procura: a página não tem como tirá-lo. No computador e
 * no iPhone (que nem tem o evento), nada muda, e o manifesto fica, porque o iPhone precisa dele.
 * Devolve se passou a recusar.
 */
export function refuseAutomaticInstallOffer(win: WindowLike & Pick<Window, 'addEventListener'>, native: boolean): boolean {
  if (native || !isAndroid(win.navigator)) return false
  win.addEventListener('beforeinstallprompt', event => event.preventDefault())
  return true
}
