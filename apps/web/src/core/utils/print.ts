import { isNativeApp } from '../native/nativeApp'
import { printNative } from '../native/nativeShell'

/**
 * O "Imprimir / Salvar PDF" da tela de impressão. No APK do Android, o WebView não implementa o
 * window.print(): a impressão é a do Android, pela casca (core/native/nativeShell.ts). O título da
 * página (o nome da ficha, posto pela tela de impressão) vira o nome do PDF.
 */
export function printPage(name: string = document.title, native: boolean = isNativeApp()): void {
  if (native) void printNative(name)
  else window.print()
}
