import { describe, it, expect } from 'vitest'
import { isAndroid, isInstalled, isIos, refuseAutomaticInstallOffer, shouldShowInstallHint, type NavigatorLike, type WindowLike } from '../platform'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1',
  // O iPad desde o iPadOS 13: o mesmo texto do Safari do Mac.
  ipadOrMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  // O WebView do APK: o texto do Chrome do Android, com o "wv".
  apkWebView: 'Mozilla/5.0 (Linux; Android 13; Pixel 6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.0.0 Mobile Safari/537.36',
  // O Chrome do Android em modo computador (tablet grande, "Site para computador"): o texto do Linux de mesa.
  linuxDesktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
}

function win(nav: NavigatorLike, standaloneMedia = false): WindowLike {
  return { navigator: nav, matchMedia: q => ({ matches: standaloneMedia && q === '(display-mode: standalone)' }) }
}

describe('isIos', () => {
  it('iPhone em qualquer navegador (todos são WebKit no iOS)', () => {
    expect(isIos({ userAgent: UA.iphoneSafari })).toBe(true)
    expect(isIos({ userAgent: UA.iphoneChrome })).toBe(true)
  })

  it('o iPad que se diz Mac é iOS pela tela de toque; o Mac de verdade, não', () => {
    expect(isIos({ userAgent: UA.ipadOrMac, maxTouchPoints: 5 })).toBe(true)
    expect(isIos({ userAgent: UA.ipadOrMac, maxTouchPoints: 0 })).toBe(false)
  })

  it('Android e Windows não são iOS', () => {
    expect(isIos({ userAgent: UA.android, maxTouchPoints: 5 })).toBe(false)
    expect(isIos({ userAgent: UA.windows })).toBe(false)
  })
})

describe('isInstalled', () => {
  it('aberto pela tela de início: navigator.standalone (iPhone) ou display-mode standalone (Android)', () => {
    expect(isInstalled(win({ userAgent: UA.iphoneSafari, standalone: true }))).toBe(true)
    expect(isInstalled(win({ userAgent: UA.android }, true))).toBe(true)
  })

  it('no navegador, não', () => {
    expect(isInstalled(win({ userAgent: UA.iphoneSafari, standalone: false }))).toBe(false)
    expect(isInstalled(win({ userAgent: UA.android }))).toBe(false)
    expect(isInstalled({ navigator: { userAgent: UA.windows } })).toBe(false)
  })
})

describe('shouldShowInstallHint', () => {
  it('no Safari do iPhone, fora do app instalado, até ser dispensada', () => {
    expect(shouldShowInstallHint(win({ userAgent: UA.iphoneSafari, standalone: false }), null)).toBe(true)
    expect(shouldShowInstallHint(win({ userAgent: UA.iphoneSafari, standalone: false }), 1000)).toBe(false)
  })

  it('instalado, a dica some', () => {
    expect(shouldShowInstallHint(win({ userAgent: UA.iphoneSafari, standalone: true }), null)).toBe(false)
    expect(shouldShowInstallHint(win({ userAgent: UA.iphoneSafari }, true), null)).toBe(false)
  })

  it('fora do iOS não aparece (no Android, o app é o APK)', () => {
    expect(shouldShowInstallHint(win({ userAgent: UA.android }), null)).toBe(false)
    expect(shouldShowInstallHint(win({ userAgent: UA.windows }), null)).toBe(false)
  })
})

describe('isAndroid', () => {
  it('o Chrome do Android e o WebView do APK; o iPhone e o computador, não', () => {
    expect(isAndroid({ userAgent: UA.android })).toBe(true)
    expect(isAndroid({ userAgent: UA.apkWebView })).toBe(true)
    expect(isAndroid({ userAgent: UA.iphoneChrome })).toBe(false)
    expect(isAndroid({ userAgent: UA.windows })).toBe(false)
  })

  it('o Chrome em modo computador do tablet (Linux de mesa) é Android pela tela de toque; o Linux de verdade e o Chromebook, não', () => {
    expect(isAndroid({ userAgent: UA.linuxDesktop, maxTouchPoints: 5 })).toBe(true)
    expect(isAndroid({ userAgent: UA.linuxDesktop, maxTouchPoints: 0 })).toBe(false)
    expect(isAndroid({ userAgent: UA.linuxDesktop })).toBe(false)
    expect(isAndroid({ userAgent: UA.chromebook, maxTouchPoints: 10 })).toBe(false)
    expect(isAndroid({ userAgent: UA.windows, maxTouchPoints: 10 })).toBe(false)
  })
})

// O Chrome instalaria um segundo "Forja", com as fichas à parte das do APK.
describe('refuseAutomaticInstallOffer: a oferta automática do Chrome', () => {
  /** A janela de mentira, e a oferta que o Chrome faria nela: true quando a página a recusou. */
  function page(userAgent: string, maxTouchPoints = 0) {
    return Object.assign(new EventTarget(), { navigator: { userAgent, maxTouchPoints } })
  }
  function chromeOffers(win: EventTarget): boolean {
    const offer = new Event('beforeinstallprompt', { cancelable: true })
    win.dispatchEvent(offer)
    return offer.defaultPrevented
  }

  it('no Android, fora do APK, é recusada (o "Instalar app" do menu do Chrome continua)', () => {
    const win = page(UA.android)
    expect(refuseAutomaticInstallOffer(win, false)).toBe(true)
    expect(chromeOffers(win)).toBe(true)
  })

  it('no tablet Android com o Chrome em modo computador, também', () => {
    const win = page(UA.linuxDesktop, 5)
    expect(refuseAutomaticInstallOffer(win, false)).toBe(true)
    expect(chromeOffers(win)).toBe(true)
  })

  it('no computador, no iPhone e no APK, nada muda', () => {
    for (const [userAgent, native] of [[UA.windows, false], [UA.iphoneSafari, false], [UA.apkWebView, true]] as const) {
      const win = page(userAgent)
      expect(refuseAutomaticInstallOffer(win, native)).toBe(false)
      expect(chromeOffers(win)).toBe(false)
    }
  })
})
