import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within, waitFor } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { saveTextFileNative } from '../core/native/nativeShell'
import App from '../App'
import { useAppStore } from '../core/stores/appStore'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../systems/ordem/stores/characterStore'
import { useAppUpdateStore } from '../core/pwa/serviceWorker'
import { useNativeVersionStore } from '../core/native/appVersion'
import { startNativeApp } from '../core/native/nativeApp'
import { useDeviceStore } from '../core/stores/deviceStore'
import { DEFAULT_DEVICE_STATE, loadDeviceState } from '../core/utils/deviceStorage'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const INSTALL_HINT = /Adicionar à Tela de Início/
const SHEETS_STAY_IN_BROWSER = /As fichas deste navegador não passam sozinhas para o app/
const BACKUP_REMINDER = /Guarde uma cópia em arquivo/
const BACKUP_REMINDER_AGAIN = /Sua última cópia das fichas é de \d\d\/\d\d\/\d{4}\. Guarde uma nova\./
const APK_OUTDATED = 'Tem uma versão nova do app: peça o APK no grupo.'

// O "Salvar como" da casca do APK, de mentira (no jsdom não há casca); no navegador nunca é chamado.
vi.mock('../core/native/nativeShell', async importOriginal => ({
  ...await importOriginal<typeof import('../core/native/nativeShell')>(),
  saveTextFileNative: vi.fn(),
}))

/** O navegador do teste se passando por outro (o userAgent e o navigator.standalone do iPhone). */
function pretend(props: { userAgent?: string; standalone?: boolean }) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true })
  }
}

function withSheet() {
  useCharacterStore.getState().restoreCharacters([{ draft: structuredClone(COMPLETE_DRAFT), playState: null }])
}

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.setState({ library: [] })
  useOrdemStore.setState({ library: [] })
  useAppStore.getState().setActiveSystem(null)
  useAppUpdateStore.setState({ updateReady: false })
  useNativeVersionStore.setState({ outdated: false })
  useDeviceStore.setState(DEFAULT_DEVICE_STATE)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.mocked(saveTextFileNative).mockReset()
  delete (navigator as { userAgent?: string }).userAgent
  delete (navigator as { standalone?: boolean }).standalone
})

describe('aviso de versão nova', () => {
  it('aparece na galeria aberta quando a versão nova termina de baixar, numa região viva que já existia', () => {
    render(<App />)
    expect(screen.queryByText(/Versão nova do app pronta/)).toBeNull()
    act(() => useAppUpdateStore.setState({ updateReady: true }))
    const notice = screen.getByText(/Versão nova do app pronta/)
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('"Atualizar agora" sem versão esperando (outra aba já aplicou) só fecha o aviso', () => {
    useAppUpdateStore.setState({ updateReady: true })
    render(<App />)
    fireEvent.click(screen.getByText('Atualizar agora'))
    expect(screen.queryByText(/Versão nova do app pronta/)).toBeNull()
  })
})

describe('aviso de APK velho (docs/app-android.md)', () => {
  it('no navegador nunca aparece: nem a conferência roda', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<App />)
    await act(() => startNativeApp())
    expect(screen.queryByText(APK_OUTDATED)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aparece quando a conferência do APK volta da rede com a galeria aberta, numa região viva que já existia', () => {
    render(<App />)
    act(() => useNativeVersionStore.setState({ outdated: true }))
    const notice = screen.getByText(APK_OUTDATED)
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull()
  })
})

// O APK guarda à parte do Chrome, e quem já jogava pelo site abre o app vazio (docs/app-android.md).
describe('no APK do Android', () => {
  const pretendNative = () => vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)

  it('a galeria vazia diz como trazer as fichas do navegador, e os textos falam do app', () => {
    pretendNative()
    render(<App />)
    expect(screen.getByText('Nenhuma ficha salva neste app')).toBeInTheDocument()
    expect(screen.getByText(/Já criou fichas pelo navegador do celular\? Elas ficam lá: no navegador, toque em Exportar todas e, aqui, em Importar\./)).toBeInTheDocument()
  })

  it('com fichas, a dica sai, e o lembrete de cópia diz "neste app"', () => {
    pretendNative()
    withSheet()
    render(<App />)
    expect(screen.getByText('1 ficha salva neste app')).toBeInTheDocument()
    expect(screen.queryByText(/Já criou fichas pelo navegador/)).toBeNull()
    expect(screen.getByText('As fichas ficam só neste app. Guarde uma cópia em arquivo.')).toBeInTheDocument()
  })

  // Abrir pelo ícone traz de volta a tela que o Android guardou, e a versão que espera não entra.
  it('a atualização pronta não promete a próxima abertura nem se chama "versão nova do app", que é o APK', () => {
    pretendNative()
    useAppUpdateStore.setState({ updateReady: true })
    useNativeVersionStore.setState({ outdated: true })
    render(<App />)
    expect(screen.getByText('Atualização pronta: toque em Atualizar agora para usá-la.')).toBeInTheDocument()
    expect(screen.queryByText(/Versão nova do app pronta/)).toBeNull()
    expect(screen.queryByText(/próxima vez que você abrir/)).toBeNull()
    expect(screen.getAllByText(/versão nova do app/i)).toHaveLength(1)
    expect(screen.getByText(APK_OUTDATED)).toBeInTheDocument()
  })

  // O WebView ignora o link de download: o "Exportar todas" vai pelo "Salvar como" da casca, e a
  // cópia só conta (o lembrete some por 14 dias) com o arquivo gravado.
  it('"Exportar todas" vai pelo "Salvar como" do Android; cancelado, o lembrete continua', async () => {
    pretendNative()
    withSheet()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.mocked(saveTextFileNative).mockResolvedValueOnce(false)
    render(<App />)
    fireEvent.click(screen.getByText('Exportar todas'))
    await waitFor(() => expect(saveTextFileNative).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveTextFileNative).mock.calls[0][0]).toMatch(/^forja-de-herois-fichas-\d{4}-\d\d-\d\d\.json$/)
    expect(click).not.toHaveBeenCalled()
    await act(() => Promise.resolve())
    expect(loadDeviceState().lastBackupAt).toBeNull()
    expect(screen.getByText(BACKUP_REMINDER)).toBeInTheDocument()

    vi.mocked(saveTextFileNative).mockResolvedValueOnce(true)
    fireEvent.click(screen.getByText('Exportar todas'))
    await waitFor(() => expect(screen.queryByText(BACKUP_REMINDER)).toBeNull())
    expect(loadDeviceState().lastBackupAt).not.toBeNull()
  })

  it('no navegador, nada muda: "neste navegador" e sem a dica do APK', () => {
    render(<App />)
    expect(screen.getByText('Nenhuma ficha salva neste navegador')).toBeInTheDocument()
    expect(screen.queryByText(/Já criou fichas pelo navegador/)).toBeNull()
  })
})

describe('dica de instalar no iPhone', () => {
  it('no Safari do iPhone aparece, e "Entendi" a dispensa de vez', () => {
    pretend({ userAgent: IPHONE, standalone: false })
    const { unmount } = render(<App />)
    expect(screen.getByText(INSTALL_HINT)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Entendi'))
    expect(screen.queryByText(INSTALL_HINT)).toBeNull()
    expect(loadDeviceState().installHintDismissedAt).not.toBeNull()
    unmount()
    render(<App />)
    expect(screen.queryByText(INSTALL_HINT)).toBeNull()
  })

  it('instalado (aberto pela tela de início), a dica some', () => {
    pretend({ userAgent: IPHONE, standalone: true })
    render(<App />)
    expect(screen.queryByText(INSTALL_HINT)).toBeNull()
  })

  it('fora do iPhone não aparece', () => {
    render(<App />)
    expect(screen.queryByText(INSTALL_HINT)).toBeNull()
  })

  it('com fichas aqui, avisa que elas não vão sozinhas para o app e oferece a cópia', () => {
    pretend({ userAgent: IPHONE, standalone: false })
    withSheet()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    const hint = screen.getByText(INSTALL_HINT)
    expect(hint).toHaveTextContent(SHEETS_STAY_IN_BROWSER)
    fireEvent.click(within(hint.parentElement!).getByText('Exportar todas'))
    expect(click).toHaveBeenCalledTimes(1)
    expect(loadDeviceState().lastBackupAt).not.toBeNull()
    // A cópia não dispensa a dica: falta instalar.
    expect(screen.getByText(INSTALL_HINT)).toBeInTheDocument()
  })

  it('sem ficha, a dica não fala de cópia', () => {
    pretend({ userAgent: IPHONE, standalone: false })
    render(<App />)
    const hint = screen.getByText(INSTALL_HINT)
    expect(hint).not.toHaveTextContent(SHEETS_STAY_IN_BROWSER)
    expect(within(hint.parentElement!).queryByText('Exportar todas')).toBeNull()
  })
})

describe('lembrete de cópia de segurança', () => {
  it('sem ficha não aparece; com ficha e nenhuma cópia, aparece', () => {
    const { unmount } = render(<App />)
    expect(screen.queryByText(BACKUP_REMINDER)).toBeNull()
    unmount()
    withSheet()
    render(<App />)
    expect(screen.getByText(BACKUP_REMINDER)).toBeInTheDocument()
  })

  it('"Exportar todas" do lembrete baixa a cópia, e o lembrete some', () => {
    withSheet()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    fireEvent.click(screen.getByText('Exportar todas'))
    expect(click).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(BACKUP_REMINDER)).toBeNull()
    expect(loadDeviceState().lastBackupAt).not.toBeNull()
  })

  it('com cópia antiga e mudança depois dela, lembra com a data da última cópia', () => {
    const DAY = 24 * 60 * 60 * 1000
    useDeviceStore.getState().update({ lastBackupAt: Date.now() - 20 * DAY })
    withSheet()
    render(<App />)
    expect(screen.getByText(BACKUP_REMINDER_AGAIN)).toBeInTheDocument()
  })

  it('"Agora não" o cala, também depois de reabrir', () => {
    withSheet()
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByText('Agora não'))
    expect(screen.queryByText(BACKUP_REMINDER)).toBeNull()
    unmount()
    render(<App />)
    expect(screen.queryByText(BACKUP_REMINDER)).toBeNull()
  })

  it('no iPhone, com a dica de instalar à vista, o lembrete espera', () => {
    pretend({ userAgent: IPHONE, standalone: false })
    withSheet()
    render(<App />)
    expect(screen.getByText(INSTALL_HINT)).toBeInTheDocument()
    expect(screen.queryByText(BACKUP_REMINDER)).toBeNull()
    fireEvent.click(screen.getByText('Entendi'))
    expect(screen.getByText(BACKUP_REMINDER)).toBeInTheDocument()
  })
})
