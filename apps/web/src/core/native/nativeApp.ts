import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { handleBack } from '../navigation/back'

/**
 * O APK do Android (apps/mobile; docs/app-android.md) abre este mesmo site publicado, e o
 * Capacitor dele põe a ponte nativa na página antes do nosso código. No navegador, e no iPhone
 * (que usa o site instalado), não há ponte: nada daqui roda, e os plugins nem são chamados.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** O que este arquivo usa do plugin App (os testes passam um de mentira). */
export type NativeAppPlugin = Pick<typeof App, 'addListener' | 'minimizeApp'>

/**
 * O comportamento de app do APK, ligado uma vez ao abrir. O voltar do Android fecha a folha aberta
 * e volta a tela (`handleBack`); na galeria, sem para onde voltar, minimiza o app, como o botão de
 * início: nada se perde, e ele reabre onde estava.
 */
export async function startNativeApp(app: NativeAppPlugin = App, native: boolean = isNativeApp()): Promise<void> {
  if (!native) return
  // Com um ouvinte, o Capacitor deixa o voltar todo com a página (sem ele, voltaria no histórico
  // do WebView, que o app não usa, e fecharia a tela).
  await app.addListener('backButton', () => {
    if (!handleBack()) void app.minimizeApp()
  })
}
