import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import App from '../App'
import { useAppStore } from '../core/stores/appStore'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../systems/ordem/stores/characterStore'
import { useAppUpdateStore } from '../core/pwa/serviceWorker'
import { useDeviceStore } from '../core/stores/deviceStore'
import { DEFAULT_DEVICE_STATE, loadDeviceState } from '../core/utils/deviceStorage'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const INSTALL_HINT = /Adicionar à Tela de Início/
const BACKUP_REMINDER = /Guarde uma cópia em arquivo/
const BACKUP_REMINDER_AGAIN = /Sua última cópia das fichas é de \d\d\/\d\d\/\d{4}\. Guarde uma nova\./

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
  useDeviceStore.setState(DEFAULT_DEVICE_STATE)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
