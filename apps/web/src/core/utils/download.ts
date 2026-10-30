/**
 * Quanto o endereço do arquivo baixado vive depois do clique. O Safari do iPhone lê o arquivo depois
 * que o clique volta, e soltar o endereço na hora é a causa conhecida do download que falha lá
 * ("WebKitBlobResource error 1"). Um minuto sobra para um JSON de fichas.
 */
export const BLOB_URL_LIFETIME_MS = 60_000

/** Baixa `data` como um arquivo JSON legível: o exportar de cada ficha e o de todas. */
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
