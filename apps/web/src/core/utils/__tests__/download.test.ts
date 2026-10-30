import { describe, it, expect, vi, afterEach } from 'vitest'
import { BLOB_URL_LIFETIME_MS, downloadJsonFile } from '../download'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('downloadJsonFile', () => {
  it('baixa pelo link e só solta o arquivo depois que o navegador teve tempo de lê-lo', () => {
    vi.useFakeTimers()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fichas')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clicked: HTMLAnchorElement[] = []
    // O clique do download navegaria (o jsdom não navega e reclama).
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })

    downloadJsonFile('fichas.json', { a: 1 })

    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('fichas.json')
    expect(clicked[0].href).toBe('blob:fichas')
    expect(document.body.contains(clicked[0])).toBe(false)
    // O Safari do iPhone lê o arquivo depois que o clique volta: soltá-lo na hora falha o download.
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(BLOB_URL_LIFETIME_MS)
    expect(revoke).toHaveBeenCalledWith('blob:fichas')
  })
})
