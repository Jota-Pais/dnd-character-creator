import { registerPlugin } from '@capacitor/core'
import { markOwnTrip, takeOwnTrip } from './backgroundTrips'

/**
 * A casca do APK (NativeShellPlugin.java; docs/app-android.md): o que o WebView do Android não faz
 * sozinho. Os métodos existem a partir do versionCode 2; o APK mais velho responde "não
 * implementado", e a pessoa ouve que precisa do APK novo.
 *
 * Os dois abrem uma tela do Android por cima do app: a ida ao segundo plano é do próprio app
 * (`markOwnTrip`), e a volta dela não aplica a versão nova. Recusado (APK velho, erro), a marca
 * sai: sem a tela aberta, a ida não houve (e com ela aberta, a marca já se gastou na ida).
 */
export interface NativeShellPlugin {
  /** O "Salvar como" do Android: grava o texto onde a pessoa escolher. `saved` false: cancelou. */
  saveFile(options: { fileName: string; mimeType: string; text: string }): Promise<{ saved: boolean }>
  /** A impressão do Android da página aberta (com o "Salvar como PDF"). */
  print(options: { name: string }): Promise<void>
}

const NativeShell = registerPlugin<NativeShellPlugin>('NativeShell')

/** O APK velho, sem o método: o Capacitor recusa com o código UNIMPLEMENTED. */
function isUnimplemented(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'UNIMPLEMENTED'
}

/** O que a casca diz quando o APK é velho demais para o que a pessoa pediu. */
export const NEEDS_NEW_APK = 'O app precisa da versão nova para isso: peça o APK no grupo.'

/** O alerta do Android (o WebView mostra o window.alert numa caixa do sistema). */
function warn(message: string): void {
  window.alert(message)
}

/**
 * Salva um arquivo de texto pelo "Salvar como" do Android. True só quando o arquivo foi gravado:
 * cancelado, APK velho ou erro, false (os dois últimos com o aviso).
 */
export async function saveTextFileNative(fileName: string, mimeType: string, text: string, shell: NativeShellPlugin = NativeShell): Promise<boolean> {
  markOwnTrip()
  try {
    const { saved } = await shell.saveFile({ fileName, mimeType, text })
    return saved
  } catch (error) {
    takeOwnTrip()
    warn(isUnimplemented(error) ? NEEDS_NEW_APK : 'Não deu para salvar o arquivo. Tente de novo.')
    return false
  }
}

/** Abre a impressão do Android da página aberta; APK velho ou erro, com o aviso. */
export async function printNative(name: string, shell: NativeShellPlugin = NativeShell): Promise<void> {
  markOwnTrip()
  try {
    await shell.print({ name })
  } catch (error) {
    takeOwnTrip()
    warn(isUnimplemented(error) ? NEEDS_NEW_APK : 'Não deu para abrir a impressão. Tente de novo.')
  }
}
