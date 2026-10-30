import { isNativeApp } from '../native/nativeApp'
import { saveTextFileNative } from '../native/nativeShell'
import { markOwnTrip } from '../native/backgroundTrips'

/**
 * Quanto o endereço do arquivo baixado vive depois do clique. O Safari do iPhone lê o arquivo depois
 * que o clique volta, e soltar o endereço na hora é a causa conhecida do download que falha lá
 * ("WebKitBlobResource error 1"). Um minuto sobra para um JSON de fichas.
 */
export const BLOB_URL_LIFETIME_MS = 60_000

/**
 * Guarda `data` como um arquivo JSON legível: o exportar de cada ficha e o de todas. No navegador,
 * o download (`downloadJsonFile`), que sai na hora e conta como salvo: a página não sabe se a
 * pessoa o guardou. No APK do Android, onde o WebView ignora esse download, o "Salvar como" da casca
 * (core/native/nativeShell.ts), e `onSaved` só roda se o arquivo foi gravado.
 */
export function saveJsonFile(fileName: string, data: unknown, onSaved?: () => void, native: boolean = isNativeApp()): void {
  if (!native) {
    downloadJsonFile(fileName, data)
    onSaved?.()
    return
  }
  void saveTextFileNative(fileName, 'application/json', JSON.stringify(data, null, 2)).then(saved => {
    if (saved) onSaved?.()
  })
}

/** Baixa `data` como um arquivo JSON legível, pelo link de download do navegador. */
export function downloadJsonFile(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_LIFETIME_MS)
}

/**
 * Abre o seletor de arquivo de um `<input type="file">` (os "Importar"). No APK, o seletor é uma
 * tela do Android por cima do app: a ida ao segundo plano é do próprio app (`markOwnTrip`), e a
 * volta com o arquivo não aplica a versão nova no meio da importação.
 */
export function pickFile(input: HTMLInputElement | null): void {
  if (!input) return
  markOwnTrip()
  input.click()
}

/** O JSON de um arquivo escolhido pelo jogador; undefined se não é JSON (ou não deu para ler). */
export function readJsonFile(file: Blob): Promise<unknown> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        resolve(JSON.parse(e.target?.result as string))
      } catch {
        resolve(undefined)
      }
    }
    reader.onerror = () => resolve(undefined)
    reader.readAsText(file)
  })
}
