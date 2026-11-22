import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import App from '../../../app/App'
import { handleBack, hasOpenLayer } from '../../../core/navigation/back'
import { useAppStore } from '../../../core/stores/appStore'
import { useDeviceStore } from '../../../core/stores/deviceStore'
import type { SyncStatus } from '../../../core/sync/engine'
import { DEFAULT_DEVICE_STATE, loadDeviceState } from '../../../core/utils/deviceStorage'
import { AccountBar } from '../../auth/AccountBar'
import { useAuthStore } from '../../auth/authStore'
import type { SignOutResult } from '../../auth/session'
import { IDLE_STATUS, useSyncStore } from '../../sync/syncStore'
import { describeSync, isSynced } from '../../sync/syncText'
import { useCharacterStore } from '../../../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../../../systems/ordem/stores/characterStore'
import { TEST_USER } from '../../../test/setup'

/**
 * A conta na galeria: a linha de conta (quem está conectado, o estado da sincronização, o "Sair") e
 * os avisos que pedem ação do jogador.
 */
const status = (over: Partial<SyncStatus> = {}): SyncStatus => ({ ...IDLE_STATUS, ...over })
const BACKUP_REMINDER = /Guarde uma cópia em arquivo/

function withSheet() {
  useCharacterStore.getState().restoreCharacters([{ draft: structuredClone(COMPLETE_DRAFT), playState: null }])
}

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.setState({ library: [] })
  useOrdemStore.setState({ library: [] })
  useAppStore.getState().setActiveSystem(null)
  useDeviceStore.setState(DEFAULT_DEVICE_STATE)
  useSyncStore.setState({ status: IDLE_STATUS })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('a sincronização em uma frase', () => {
  it('diz se o que o jogador fez já está no servidor ou ainda mora só no aparelho', () => {
    expect(describeSync(status(), 'valid')).toBe('Conectado')
    expect(describeSync(status({ lastSyncedAt: 1 }), 'valid')).toBe('Em dia')
    expect(describeSync(status({ phase: 'syncing', pending: 2 }), 'valid')).toBe('Sincronizando…')
    expect(describeSync(status({ pending: 1 }), 'valid')).toBe('1 alteração a enviar')
    expect(describeSync(status({ pending: 3 }), 'valid')).toBe('3 alterações a enviar')
  })

  it('sem conseguir falar com o servidor, diz que as fichas estão no aparelho', () => {
    expect(describeSync(status({ phase: 'offline' }), 'valid')).toBe('Sem conexão: as fichas estão neste aparelho')
    expect(describeSync(status({ phase: 'offline', pending: 1 }), 'valid')).toBe('Sem conexão: 1 alteração guardada neste aparelho')
    expect(describeSync(status({ phase: 'offline', pending: 4 }), 'valid')).toBe('Sem conexão: 4 alterações guardadas neste aparelho')
    // O app abriu sem rede: o servidor ainda não confirmou a sessão desta abertura.
    expect(describeSync(status(), 'unknown')).toBe('Sem conexão: as fichas estão neste aparelho')
  })

  it('a sessão expirada vem antes de tudo, com o que ficou guardado', () => {
    expect(describeSync(status({ phase: 'offline' }), 'expired')).toBe('Sessão expirada')
    expect(describeSync(status({ phase: 'expired', pending: 2 }), 'valid')).toBe('Sessão expirada: 2 alterações guardadas neste aparelho')
    expect(describeSync(status({ phase: 'mismatch' }), 'valid')).toBe('Sincronização parada')
  })

  it('"em dia" é só com a sessão confirmada, um ciclo terminado e nada por enviar, recusado ou desconhecido', () => {
    expect(isSynced(status({ lastSyncedAt: 1 }), 'valid')).toBe(true)
    expect(isSynced(status(), 'valid')).toBe(false)
    expect(isSynced(status({ lastSyncedAt: 1 }), 'unknown')).toBe(false)
    expect(isSynced(status({ lastSyncedAt: 1, pending: 1 }), 'valid')).toBe(false)
    expect(isSynced(status({ lastSyncedAt: 1, refused: 1 }), 'valid')).toBe(false)
    expect(isSynced(status({ lastSyncedAt: 1, outdated: 1 }), 'valid')).toBe(false)
    expect(isSynced(status({ lastSyncedAt: 1, phase: 'offline' }), 'valid')).toBe(false)
  })
})

describe('a linha de conta', () => {
  it('a galeria mostra quem está conectado e o estado da sincronização, sem falar a cada ciclo', () => {
    render(<App />)
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument()
    const state = screen.getByRole('button', { name: 'Conectado' })
    expect(state.closest('[aria-live]')).toBeNull()

    act(() => { useSyncStore.setState({ status: status({ phase: 'offline', pending: 2 }) }) })
    expect(screen.getByRole('button', { name: 'Sem conexão: 2 alterações guardadas neste aparelho' })).toBeInTheDocument()
    // A galeria continua com uma região de status só (a do resultado de restaurar a cópia).
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('o toque no estado pede a sincronização agora', async () => {
    const user = userEvent.setup()
    const onSync = vi.fn()
    render(<AccountBar session={{ signOut: vi.fn() }} onSync={onSync} />)
    await user.click(screen.getByRole('button', { name: 'Conectado' }))
    expect(onSync).toHaveBeenCalledTimes(1)
  })

  it('sem ninguém conectado, não aparece', () => {
    useAuthStore.setState({ user: null, session: 'unknown' })
    const { container } = render(<AccountBar session={{ signOut: vi.fn() }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('sair', () => {
  const signOutWith = (...results: SignOutResult[]) => ({
    signOut: vi.fn<(options?: { keepUnsent?: boolean }) => Promise<SignOutResult>>(async () => results.shift() ?? { ok: true }),
  })

  it('com tudo enviado, sai direto', async () => {
    const user = userEvent.setup()
    const session = signOutWith({ ok: true })
    render(<AccountBar session={session} />)
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(session.signOut).toHaveBeenCalledWith({ keepUnsent: false })
    expect(screen.queryByText(/ainda não/)).toBeNull()
  })

  it('com alteração que não subiu, pergunta antes, numa região que já existia, e o foco fica no "Sair"', async () => {
    const user = userEvent.setup()
    const session = signOutWith({ ok: false, unsent: 2 }, { ok: true })
    render(<AccountBar session={session} />)
    const region = document.querySelector('[aria-live="polite"]') as HTMLElement
    expect(region).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(within(region).getByText(/2 alterações ainda não foram enviadas\. Elas ficam guardadas neste aparelho e sobem quando você entrar de novo com esta conta\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toHaveFocus()
    expect(hasOpenLayer()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Sair mesmo assim' }))
    expect(session.signOut).toHaveBeenLastCalledWith({ keepUnsent: true })
  })

  it('uma alteração só: o texto no singular', async () => {
    const user = userEvent.setup()
    render(<AccountBar session={signOutWith({ ok: false, unsent: 1 })} />)
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(screen.getByText(/1 alteração ainda não foi enviada\. Ela fica guardada neste aparelho e sobe quando você entrar de novo com esta conta\./)).toBeInTheDocument()
  })

  it('"Cancelar" e o voltar do Android fecham a pergunta, sem sair', async () => {
    const user = userEvent.setup()
    const session = signOutWith({ ok: false, unsent: 2 }, { ok: false, unsent: 2 })
    render(<AccountBar session={session} />)
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/ainda não foram enviadas/)).toBeNull()
    expect(hasOpenLayer()).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    act(() => { handleBack() })
    expect(screen.queryByText(/ainda não foram enviadas/)).toBeNull()
    expect(session.signOut).toHaveBeenCalledTimes(2)
  })

  it('enquanto sai, o botão fica apagado sem sair do Tab e não dispara de novo', async () => {
    const user = userEvent.setup()
    let finish: (result: SignOutResult) => void = () => {}
    const session = { signOut: vi.fn(() => new Promise<SignOutResult>(resolve => { finish = resolve })) }
    render(<AccountBar session={session} />)
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    const leaving = screen.getByRole('button', { name: 'Saindo…' })
    expect(leaving).toHaveAttribute('aria-disabled', 'true')
    expect(leaving).not.toBeDisabled()
    await user.click(leaving)
    expect(session.signOut).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true }) })
  })
})

describe('os avisos da conta na galeria', () => {
  it('a sessão expirada pede para entrar de novo, e a folha vem com o e-mail travado', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByText(/Sua sessão expirou/)).toBeNull()

    act(() => { useAuthStore.setState({ session: 'expired' }) })
    const notice = screen.getByText(/Sua sessão expirou\. As fichas continuam neste aparelho; entre de novo para voltar a sincronizar\./)
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Sessão expirada' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Entrar de novo' }))
    const sheet = screen.getByRole('dialog', { name: 'Entrar de novo' })
    expect(within(sheet).getByLabelText('E-mail')).toHaveValue(TEST_USER.email)
    expect(within(sheet).getByLabelText('E-mail')).toHaveAttribute('readonly')

    await user.click(within(sheet).getByRole('button', { name: 'Agora não' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // A galeria continua ali: a sessão expirada não tira ninguém das fichas.
    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()
  })

  it('a cópia de conflito é avisada (também depois de recarregar a página), e o "Entendi" a dá por vista', async () => {
    const user = userEvent.setup()
    render(<App />)
    act(() => { useDeviceStore.getState().update({ unseenConflictCopies: 1 }) })
    expect(screen.getByText(/Uma ficha mudou em dois aparelhos ao mesmo tempo\. A versão que não ficou virou uma cópia, com “conflito” no nome/)).toBeInTheDocument()

    // O botão do próprio aviso: a região viva é a dos avisos da galeria, que já existia.
    const notice = screen.getByText(/Uma ficha mudou em dois aparelhos/)
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull()
    await user.click(within(notice.parentElement!).getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByText(/em dois aparelhos/)).toBeNull()
    expect(loadDeviceState().unseenConflictCopies).toBe(0)

    act(() => { useDeviceStore.getState().update({ unseenConflictCopies: 3 }) })
    expect(screen.getByText(/Algumas fichas mudaram em dois aparelhos/)).toBeInTheDocument()
  })

  it('a ficha que o servidor recusou e a que pede um app mais novo viram aviso', () => {
    render(<App />)
    act(() => { useSyncStore.setState({ status: status({ refused: 1, outdated: 2 }) }) })
    expect(screen.getByText(/Uma ficha não pôde ser enviada ao servidor: ela continua só neste aparelho\. Guarde uma cópia em arquivo\./)).toBeInTheDocument()
    expect(screen.getByText(/Algumas fichas foram alteradas numa versão mais nova do app\. Atualize o app neste aparelho para vê-las e voltar a sincronizá-las\./)).toBeInTheDocument()
  })
})

describe('o lembrete de cópia de segurança, com a conta', () => {
  it('com a sincronização em dia não aparece: as fichas já estão guardadas fora do aparelho', () => {
    withSheet()
    useSyncStore.setState({ status: status({ lastSyncedAt: Date.now() }) })
    render(<App />)
    expect(screen.queryByText(BACKUP_REMINDER)).toBeNull()
  })

  it('volta quando há alteração que não subiu, ou sem conexão', () => {
    withSheet()
    useSyncStore.setState({ status: status({ lastSyncedAt: Date.now(), phase: 'offline', pending: 1 }) })
    render(<App />)
    expect(screen.getByText(BACKUP_REMINDER)).toBeInTheDocument()
  })
})
