/** Baixa `data` como um arquivo JSON legível (o mesmo jeito do exportar de cada ficha). */
export function downloadJsonFile(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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
