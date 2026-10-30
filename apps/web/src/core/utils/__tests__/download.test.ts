import { describe, it, expect, vi, afterEach } from 'vitest'
import { BLOB_URL_LIFETIME_MS, downloadJsonFile, saveJsonFile } from '../download'
import { saveTextFileNative } from '../../native/nativeShell'

// O "Salvar como" do APK, de mentira: no jsdom não há a casca.
vi.mock('../../native/nativeShell', () => ({ saveTextFileNative: vi.fn() }))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(saveTextFileNative).mockReset()
})

/** O clique do download navegaria (o jsdom não navega e reclama): guarda os links clicados. */
function catchClicks() {
  const clicked: HTMLAnchorElement[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this)
  })
  return clicked
}

describe('downloadJsonFile', () => {
  it('baixa pelo link e só solta o arquivo depois que o navegador teve tempo de lê-lo', () => {
    vi.useFakeTimers()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fichas')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clicked = catchClicks()

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

describe('saveJsonFile', () => {
  it('no navegador, baixa pelo link e conta como salvo na hora', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fichas')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clicked = catchClicks()
    const onSaved = vi.fn()
    saveJsonFile('fichas.json', { a: 1 }, onSaved, false)
    expect(clicked).toHaveLength(1)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(saveTextFileNative).not.toHaveBeenCalled()
  })

  // O WebView do Android ignora o link de download: nem arquivo nem erro.
  it('no APK, vai pelo "Salvar como" da casca, e só conta como salvo com o arquivo gravado', async () => {
    const clicked = catchClicks()
    const onSaved = vi.fn()
    vi.mocked(saveTextFileNative).mockResolvedValueOnce(false)
    saveJsonFile('fichas.json', { a: 1 }, onSaved, true)
    await vi.waitFor(() => expect(saveTextFileNative).toHaveBeenCalledTimes(1))
    expect(saveTextFileNative).toHaveBeenCalledWith('fichas.json', 'application/json', JSON.stringify({ a: 1 }, null, 2))
    await Promise.resolve()
    expect(onSaved).not.toHaveBeenCalled()

    vi.mocked(saveTextFileNative).mockResolvedValueOnce(true)
    saveJsonFile('fichas.json', { a: 1 }, onSaved, true)
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(clicked).toHaveLength(0)
  })
})
