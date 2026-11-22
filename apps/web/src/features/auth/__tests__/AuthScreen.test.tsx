import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { handleBack, hasOpenLayer } from '../../../core/navigation/back'
import { updateSyncMeta } from '../../../core/sync/syncStorage'
import { saveCharacterEntry } from '../../../systems/dnd5e/storage/storage'
import { AuthScreen } from '../AuthScreen'
import type { SignResult } from '../session'

type Credentials = { email: string; password: string }

/** Os fluxos de conta de mentira: a tela só precisa das três chamadas. */
function fakeSession(result: SignResult | (() => Promise<SignResult>) = { ok: true }) {
  const answer = () => (typeof result === 'function' ? result() : Promise.resolve(result))
  const call = () => vi.fn<(data: Credentials) => Promise<SignResult>>(answer)
  return { signIn: call(), signUp: call(), discardAndSignIn: call() }
}

const email = () => screen.getByLabelText('E-mail') as HTMLInputElement
const password = () => screen.getByLabelText('Senha') as HTMLInputElement
const submit = () => document.querySelector('button[type="submit"]') as HTMLButtonElement

/** As regiões vivas da tela, na ordem do documento, com o texto de agora. */
const liveRegions = () => [...document.querySelectorAll('[aria-live]')].map(region => region.textContent ?? '')

async function fill(user: ReturnType<typeof userEvent.setup>, address: string, secret: string) {
  if (address) await user.type(email(), address)
  if (secret) await user.type(password(), secret)
}

beforeEach(() => localStorage.clear())

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('entrar', () => {
  it('manda o e-mail em minúsculas e sem espaço, com a senha como foi digitada', async () => {
    const user = userEvent.setup()
    const session = fakeSession()
    const onDone = vi.fn()
    render(<AuthScreen session={session} onDone={onDone} />)

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    await fill(user, '  Ana@Ficha.DEV ', ' Dado de Vinte ')
    await user.click(submit())

    expect(session.signIn).toHaveBeenCalledWith({ email: 'ana@ficha.dev', password: ' Dado de Vinte ' })
    expect(session.signUp).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('os campos dizem ao navegador o que são, para ele oferecer a senha salva', () => {
    render(<AuthScreen session={fakeSession()} />)
    expect(email()).toHaveAttribute('type', 'email')
    expect(email()).toHaveAttribute('autocomplete', 'username')
    expect(email()).toHaveAttribute('autocapitalize', 'none')
    expect(password()).toHaveAttribute('type', 'password')
    expect(password()).toHaveAttribute('autocomplete', 'current-password')
  })

  it('"Mostrar" revela a senha, e diz se está ligado', async () => {
    const user = userEvent.setup()
    render(<AuthScreen session={fakeSession()} />)
    const toggle = screen.getByRole('button', { name: 'Mostrar' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(password()).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('não tem "esqueci a senha": diz a quem pedir', () => {
    render(<AuthScreen session={fakeSession()} />)
    expect(screen.getByText(/Esqueceu a senha\? Peça a quem cuida do app/)).toBeInTheDocument()
  })
})

describe('o que falta ou está errado', () => {
  it('as regiões dos avisos existem vazias antes de qualquer aviso', () => {
    render(<AuthScreen session={fakeSession()} />)
    expect(liveRegions()).toEqual(['', '', '', ''])
  })

  it('campos vazios: cada um diz o que falta, sem chamar o servidor, e o foco fica no botão', async () => {
    const user = userEvent.setup()
    const session = fakeSession()
    render(<AuthScreen session={session} />)
    await user.click(submit())

    expect(session.signIn).not.toHaveBeenCalled()
    expect(liveRegions().slice(0, 2)).toEqual(['Informe o e-mail.', 'Informe a senha.'])
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(email().getAttribute('aria-describedby')).toBe(document.querySelectorAll('[aria-live]')[0].id)
    expect(password()).toHaveAttribute('aria-invalid', 'true')
    expect(submit()).toHaveFocus()
  })

  it('e-mail que não parece e-mail é dito antes de ir ao servidor', async () => {
    const user = userEvent.setup()
    const session = fakeSession()
    render(<AuthScreen session={session} />)
    await fill(user, 'sem-arroba', 'qualquer')
    await user.click(submit())
    expect(liveRegions()[0]).toBe('E-mail inválido.')
    expect(session.signIn).not.toHaveBeenCalled()
  })

  it('o formulário não usa a validação do navegador, que roubaria o foco e o aviso', () => {
    render(<AuthScreen session={fakeSession()} />)
    expect(document.querySelector('form')).toHaveAttribute('novalidate')
    expect(email()).not.toBeRequired()
  })

  it('senha errada: a mensagem do servidor na região do formulário, e de novo a cada tentativa', async () => {
    const user = userEvent.setup()
    const session = fakeSession({ ok: false, kind: 'message', message: 'E-mail ou senha incorretos.', offline: false })
    render(<AuthScreen session={session} />)
    await fill(user, 'ana@ficha.dev', 'senha-errada')
    await user.click(submit())

    expect(liveRegions()[2]).toBe('E-mail ou senha incorretos.')
    const first = screen.getByText('E-mail ou senha incorretos.')
    await user.click(submit())
    // Um parágrafo novo com o mesmo texto: o leitor de tela o anuncia outra vez.
    expect(screen.getByText('E-mail ou senha incorretos.')).not.toBe(first)
    expect(submit()).toHaveFocus()
  })

  it('o erro de um campo vindo do servidor vai para o campo', async () => {
    const user = userEvent.setup()
    const session = fakeSession({ ok: false, kind: 'fields', message: 'Já existe uma conta com esse e-mail.', fields: { email: 'Já existe uma conta com esse e-mail. Entre com ela.' } })
    render(<AuthScreen session={session} />)
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await fill(user, 'ana@ficha.dev', 'dado-de-vinte')
    await user.click(submit())
    expect(liveRegions()[0]).toBe('Já existe uma conta com esse e-mail. Entre com ela.')
    expect(liveRegions()[2]).toBe('')
  })
})

describe('criar conta', () => {
  it('troca os textos, pede senha de 8 caracteres e chama o cadastro', async () => {
    const user = userEvent.setup()
    const session = fakeSession()
    render(<AuthScreen session={session} />)
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(password()).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByText(/Pelo menos 8 caracteres/)).toBeInTheDocument()
    expect(screen.queryByText(/Esqueceu a senha/)).not.toBeInTheDocument()

    await fill(user, 'ana@ficha.dev', 'curta')
    await user.click(submit())
    expect(liveRegions()[1]).toBe('A senha precisa de pelo menos 8 caracteres.')
    expect(session.signUp).not.toHaveBeenCalled()

    await user.type(password(), '-mais-longa')
    await user.click(submit())
    expect(session.signUp).toHaveBeenCalledWith({ email: 'ana@ficha.dev', password: 'curta-mais-longa' })
  })

  it('o voltar do Android leva de "Criar conta" a "Entrar"; em "Entrar" não há para onde voltar', async () => {
    const user = userEvent.setup()
    render(<AuthScreen session={fakeSession()} />)
    expect(hasOpenLayer()).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(hasOpenLayer()).toBe(true)
    act(() => { handleBack() })
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(hasOpenLayer()).toBe(false)
  })
})

describe('enquanto espera o servidor', () => {
  it('o botão fica apagado sem sair do Tab, não manda duas vezes, e avisa que o servidor está acordando', async () => {
    vi.useFakeTimers()
    let finish: (result: SignResult) => void = () => {}
    const session = fakeSession(() => new Promise<SignResult>(resolve => { finish = resolve }))
    render(<AuthScreen session={session} />)
    fireEvent.change(email(), { target: { value: 'ana@ficha.dev' } })
    fireEvent.change(password(), { target: { value: 'dado-de-vinte' } })
    fireEvent.submit(document.querySelector('form')!)

    expect(submit()).toHaveAttribute('aria-disabled', 'true')
    expect(submit()).not.toBeDisabled()
    expect(submit()).toHaveTextContent('Aguarde…')
    fireEvent.submit(document.querySelector('form')!)
    expect(session.signIn).toHaveBeenCalledTimes(1)

    expect(liveRegions()[2]).toBe('')
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(liveRegions()[2]).toBe('O servidor está acordando: pode levar até um minuto.')

    await act(async () => { finish({ ok: false, kind: 'message', message: 'Sem conexão.', offline: true }) })
    expect(submit()).toHaveAttribute('aria-disabled', 'false')
    expect(liveRegions()[2]).toBe('Sem conexão.')
  })
})

describe('as fichas que o aparelho já tinha', () => {
  it('sem dono, a tela diz que elas vão para a conta de quem entrar', () => {
    saveCharacterEntry({ id: 'k1', updatedAt: 1, step: 'review', draft: structuredClone(COMPLETE_DRAFT) })
    saveCharacterEntry({ id: 'k2', updatedAt: 2, step: 'review', draft: structuredClone(COMPLETE_DRAFT) })
    render(<AuthScreen session={fakeSession()} />)
    expect(screen.getByText(/As 2 fichas que já estão neste aparelho continuam guardadas e vão para a conta em que você entrar\./)).toBeInTheDocument()
  })

  it('com dono (alguém já entrou aqui), não promete nada', () => {
    saveCharacterEntry({ id: 'k1', updatedAt: 1, step: 'review', draft: structuredClone(COMPLETE_DRAFT) })
    updateSyncMeta(meta => { meta.owner = { id: 'conta-da-bia', email: 'bia@ficha.dev' } })
    render(<AuthScreen session={fakeSession()} />)
    expect(screen.queryByText(/vão para a conta em que você entrar/)).not.toBeInTheDocument()
  })
})

describe('o aparelho guarda alterações de outra conta', () => {
  const other = { owner: { id: 'conta-da-bia', email: 'bia@ficha.dev' }, unsent: 3 }

  async function blocked() {
    const user = userEvent.setup()
    const session = fakeSession({ ok: false, kind: 'otherAccount', other })
    render(<AuthScreen session={session} />)
    await fill(user, 'ana@ficha.dev', 'dado-de-vinte')
    await user.click(submit())
    return { user, session }
  }

  it('diz de quem são e quantas, e oferece as três saídas', async () => {
    await blocked()
    const panel = within(document.querySelectorAll('[aria-live]')[3] as HTMLElement)
    expect(panel.getByText(/Este aparelho guarda 3 alterações de/)).toBeInTheDocument()
    expect(panel.getByText('bia@ficha.dev')).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Entrar como bia@ficha.dev' })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Exportar as fichas deste aparelho' })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Descartar e entrar com outra conta' })).toBeInTheDocument()
  })

  it('"Entrar como" preenche e trava o e-mail da dona, e esvazia a senha', async () => {
    const { user } = await blocked()
    await user.click(screen.getByRole('button', { name: 'Entrar como bia@ficha.dev' }))
    expect(email()).toHaveValue('bia@ficha.dev')
    expect(email()).toHaveAttribute('readonly')
    expect(password()).toHaveValue('')
    expect(screen.queryByText(/Este aparelho guarda/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Usar outro e-mail' }))
    expect(email()).not.toHaveAttribute('readonly')
    expect(email()).toHaveValue('')
  })

  it('descartar pede confirmação antes de apagar', async () => {
    const { user, session } = await blocked()
    await user.click(screen.getByRole('button', { name: 'Descartar e entrar com outra conta' }))
    expect(session.discardAndSignIn).not.toHaveBeenCalled()
    expect(screen.getByText('Apagar as alterações não enviadas?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Descartar e entrar com outra conta' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Descartar e entrar com outra conta' }))
    await user.click(screen.getByRole('button', { name: 'Apagar e entrar' }))
    expect(session.discardAndSignIn).toHaveBeenCalledWith({ email: 'ana@ficha.dev', password: 'dado-de-vinte' })
  })
})

describe('entrar de novo (a sessão expirou)', () => {
  it('é uma folha por cima da galeria, com o e-mail travado e sem criar conta', async () => {
    const user = userEvent.setup()
    const session = fakeSession()
    const onCancel = vi.fn()
    const onDone = vi.fn()
    render(<AuthScreen reauthEmail="ana@ficha.dev" session={session} onCancel={onCancel} onDone={onDone} />)

    expect(screen.getByRole('dialog', { name: 'Entrar de novo' })).toBeInTheDocument()
    expect(screen.getByText(/Sua sessão expirou\. As fichas continuam neste aparelho/)).toBeInTheDocument()
    expect(email()).toHaveValue('ana@ficha.dev')
    expect(email()).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Criar conta' })).not.toBeInTheDocument()

    await user.type(password(), 'dado-de-vinte')
    await user.click(submit())
    expect(session.signIn).toHaveBeenCalledWith({ email: 'ana@ficha.dev', password: 'dado-de-vinte' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('o "Agora não" e o voltar do Android fecham a folha', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AuthScreen reauthEmail="ana@ficha.dev" session={fakeSession()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Agora não' }))
    act(() => { handleBack() })
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
