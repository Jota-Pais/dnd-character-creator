import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@rpg/contracts/constants'
import { useBackHandler } from '../../core/navigation/back'
import { loadSyncMeta } from '../../core/sync/syncStorage'
import { exportAllCharacters } from '../gallery/libraryBackup'
import { countLocalSheets } from '../sync/syncLocal'
import { session as appSession } from './account'
import type { OtherAccount, Session, SignResult } from './session'

/**
 * A tela de entrar e de criar conta: o portão do app (sem conta ninguém usa, decisão do dono de
 * 2026-11-21). E-mail e senha, sem confirmação de e-mail e sem "esqueci a senha": quem esquece pede
 * a quem cuida do app, que define uma nova por comando.
 *
 * Também é a folha de "entrar de novo" da galeria, quando a sessão expira (`reauthEmail`): aí o
 * e-mail vem travado, porque as fichas do aparelho são daquela conta.
 */

type Mode = 'signIn' | 'signUp'
type Errors = { email?: string; password?: string; form?: string }

/** Depois disto sem resposta, a tela diz que o servidor está acordando (o plano gratuito dorme). */
const SLOW_AFTER_MS = 5_000

const COLORS = {
  page: '#0e0c0a', card: '#131110', border: '#3a332b', borderStrong: '#5c5245',
  text: '#ede2d6', title: '#f6ece0', muted: '#a39685', soft: '#cbbfae',
  primaryBg: '#e8d5b7', primaryText: '#1a1510', error: '#fca5a5',
}

export function AuthScreen({ reauthEmail, onCancel, onDone, session = appSession }: {
  /** Entrar de novo na conta deste e-mail (a sessão expirou). Sem ele, é o portão do app. */
  reauthEmail?: string
  onCancel?: () => void
  onDone?: () => void
  /** Os fluxos de conta; os testes passam os deles. */
  session?: Pick<Session, 'signIn' | 'signUp' | 'discardAndSignIn'>
}) {
  const reauth = reauthEmail !== undefined
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState(reauthEmail ?? '')
  const [lockedEmail, setLockedEmail] = useState(reauth)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sending, setSending] = useState(false)
  const [slow, setSlow] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  /** Conta as tentativas: a mesma mensagem, repetida, entra num parágrafo novo e é anunciada de novo. */
  const [attempt, setAttempt] = useState(0)
  const [other, setOther] = useState<OtherAccount | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // As fichas que o aparelho já tinha antes de qualquer conta: passam a ser de quem entrar.
  const [orphanSheets] = useState(() => (loadSyncMeta().owner === null ? countLocalSheets() : 0))
  const slowTimer = useRef<number | null>(null)
  const ids = { email: useId(), password: useId(), emailError: useId(), passwordError: useId(), hint: useId() }

  useEffect(() => () => { if (slowTimer.current !== null) window.clearTimeout(slowTimer.current) }, [])

  // O voltar do Android: de "Criar conta" volta a "Entrar"; a folha de entrar de novo fecha. A tela
  // de entrar em si é raiz, como a galeria: sem nada registrado, o APK minimiza.
  useBackHandler(reauth && onCancel ? onCancel : null, 'overlay')
  useBackHandler(!reauth && mode === 'signUp' ? () => switchMode('signIn') : null, 'screen')

  function switchMode(next: Mode) {
    setMode(next)
    setErrors({})
    setOther(null)
    setConfirmDiscard(false)
  }

  function validate(): Errors | null {
    const found: Errors = {}
    const address = email.trim()
    if (!address) found.email = 'Informe o e-mail.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) found.email = 'E-mail inválido.'
    if (!password) found.password = 'Informe a senha.'
    else if (mode === 'signUp' && password.length < PASSWORD_MIN_LENGTH) found.password = `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
    return found.email || found.password ? found : null
  }

  function show(result: SignResult) {
    if (result.ok) {
      onDone?.()
      return
    }
    setAttempt(n => n + 1)
    if (result.kind === 'otherAccount') {
      setOther(result.other)
      setErrors({})
    } else if (result.kind === 'fields') {
      const { email: emailError, password: passwordError, ...rest } = result.fields
      const leftover = Object.values(rest)[0]
      setErrors({ email: emailError, password: passwordError, form: emailError || passwordError ? undefined : leftover ?? result.message })
    } else {
      setErrors({ form: result.message })
    }
  }

  async function run(action: () => Promise<SignResult>) {
    // O botão apagado deixa o formulário enviar (é `aria-disabled`, não `disabled`): quem segura o
    // segundo envio é esta conferência.
    if (sending) return
    setSending(true)
    setSlow(false)
    slowTimer.current = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    try {
      show(await action())
    } finally {
      if (slowTimer.current !== null) window.clearTimeout(slowTimer.current)
      slowTimer.current = null
      setSending(false)
      setSlow(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (sending) return
    const invalid = validate()
    if (invalid) {
      setErrors(invalid)
      setAttempt(n => n + 1)
      return
    }
    setErrors({})
    setOther(null)
    const data = { email: email.trim().toLowerCase(), password }
    void run(() => (mode === 'signUp' ? session.signUp(data) : session.signIn(data)))
  }

  function discard() {
    const data = { email: email.trim().toLowerCase(), password }
    void run(() => session.discardAndSignIn(data))
  }

  const title = reauth ? 'Entrar de novo' : mode === 'signUp' ? 'Criar conta' : 'Entrar'
  const describedBy = (...list: (string | false)[]) => list.filter(Boolean).join(' ') || undefined

  return (
    <div
      className={reauth ? 'fixed inset-0 z-50 overflow-y-auto px-6 py-10' : 'min-h-screen px-6 py-10'}
      style={{ backgroundColor: COLORS.page, color: COLORS.text }}
      {...(reauth ? { role: 'dialog', 'aria-modal': true, 'aria-label': title } : {})}
    >
      <div className="max-w-sm mx-auto">
        <header className="mb-6 text-center">
          <p className="font-fantasy font-bold text-2xl" style={{ color: COLORS.title, letterSpacing: '.04em' }}>FORJA DE HERÓIS</p>
          <h1 className="font-fantasy text-lg mt-3" style={{ color: COLORS.soft }}>{title}</h1>
          <p className="text-[13px] mt-1 leading-relaxed" style={{ color: COLORS.muted }}>
            {reauth
              ? 'Sua sessão expirou. As fichas continuam neste aparelho; entre de novo para voltar a sincronizar.'
              : mode === 'signUp'
                ? 'Com a conta, suas fichas aparecem em qualquer aparelho em que você entrar.'
                : 'Entre para ver suas fichas em qualquer aparelho.'}
          </p>
        </header>

        {orphanSheets > 0 && !reauth && (
          <p className="mb-4 rounded-lg px-4 py-3 text-[13px] leading-relaxed" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.card, color: COLORS.soft }}>
            {orphanSheets === 1
              ? 'A ficha que já está neste aparelho continua guardada e vai para a conta em que você entrar.'
              : `As ${orphanSheets} fichas que já estão neste aparelho continuam guardadas e vão para a conta em que você entrar.`}
          </p>
        )}

        <form onSubmit={submit} noValidate className="rounded-xl p-5 space-y-4" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.card }}>
          <Field label="E-mail" htmlFor={ids.email} errorId={ids.emailError} error={errors.email} attempt={attempt}>
            <input
              id={ids.email}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              readOnly={lockedEmail}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy(ids.emailError)}
              className="w-full min-h-11 px-3 rounded-lg text-[15px]"
              style={{ border: `1px solid ${errors.email ? COLORS.error : COLORS.border}`, backgroundColor: COLORS.page, color: lockedEmail ? COLORS.muted : COLORS.text }}
            />
          </Field>

          <Field label="Senha" htmlFor={ids.password} errorId={ids.passwordError} error={errors.password} attempt={attempt}>
            <div className="flex gap-2">
              <input
                id={ids.password}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={describedBy(ids.passwordError, mode === 'signUp' && ids.hint)}
                className="flex-1 min-w-0 min-h-11 px-3 rounded-lg text-[15px]"
                style={{ border: `1px solid ${errors.password ? COLORS.error : COLORS.border}`, backgroundColor: COLORS.page, color: COLORS.text }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-pressed={showPassword}
                className="min-h-11 px-3 rounded-lg text-[13px]"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.soft }}
              >
                Mostrar
              </button>
            </div>
            {mode === 'signUp' && (
              <p id={ids.hint} className="text-[12.5px] mt-1.5" style={{ color: COLORS.muted }}>
                Pelo menos {PASSWORD_MIN_LENGTH} caracteres. Guarde-a: o app não tem “esqueci a senha”.
              </p>
            )}
          </Field>

          {/* Montada vazia: inserida já com o texto, a região viva pode não ser anunciada. A mesma
              mensagem numa tentativa nova entra em parágrafo novo, para ser dita de novo. */}
          <div aria-live="polite">
            {errors.form && <p key={attempt} className="text-[13.5px] leading-relaxed" style={{ color: COLORS.error }}>{errors.form}</p>}
            {sending && slow && <p className="text-[13.5px] leading-relaxed" style={{ color: COLORS.soft }}>O servidor está acordando: pode levar até um minuto.</p>}
          </div>

          <button
            type="submit"
            aria-disabled={sending}
            className="w-full min-h-11 rounded-lg font-fantasy font-bold text-[14px] transition-opacity"
            style={{ backgroundColor: COLORS.primaryBg, color: COLORS.primaryText, opacity: sending ? 0.6 : 1 }}
          >
            {sending ? 'Aguarde…' : mode === 'signUp' ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        {/* O aparelho guarda alterações de outra conta que ainda não subiram: entrar por cima as
            apagaria, ou as mandaria para a conta errada. Quem decide é a pessoa. */}
        <div aria-live="polite">
          {other && (
            <div key={attempt} className="mt-4 rounded-xl p-5 space-y-3" style={{ border: `1px solid ${COLORS.borderStrong}`, backgroundColor: COLORS.card }}>
              <p className="text-[13.5px] leading-relaxed" style={{ color: COLORS.soft }}>
                Este aparelho guarda {other.unsent === 1 ? '1 alteração' : `${other.unsent} alterações`} de <strong style={{ color: COLORS.text }}>{other.owner.email}</strong> que
                ainda não foram enviadas. Entrar com outra conta as apagaria.
              </p>
              <div className="flex flex-col gap-2">
                <OptionButton onClick={() => { setEmail(other.owner.email); setLockedEmail(true); setPassword(''); switchMode('signIn') }}>
                  Entrar como {other.owner.email}
                </OptionButton>
                <OptionButton onClick={() => exportAllCharacters()}>Exportar as fichas deste aparelho</OptionButton>
                {confirmDiscard ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px]" style={{ color: COLORS.error }}>Apagar as alterações não enviadas?</span>
                    <OptionButton danger onClick={discard}>Apagar e entrar</OptionButton>
                    <OptionButton onClick={() => setConfirmDiscard(false)}>Cancelar</OptionButton>
                  </div>
                ) : (
                  <OptionButton onClick={() => setConfirmDiscard(true)}>Descartar e entrar com outra conta</OptionButton>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 text-center text-[13px] space-y-3" style={{ color: COLORS.muted }}>
          {!reauth && !lockedEmail && (
            <p>
              {mode === 'signUp' ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
              <button type="button" onClick={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')} className="min-h-10 px-1 underline" style={{ color: COLORS.text }}>
                {mode === 'signUp' ? 'Entrar' : 'Criar conta'}
              </button>
            </p>
          )}
          {lockedEmail && !reauth && (
            <p>
              <button type="button" onClick={() => { setLockedEmail(false); setEmail('') }} className="min-h-10 px-1 underline" style={{ color: COLORS.text }}>
                Usar outro e-mail
              </button>
            </p>
          )}
          {mode === 'signIn' && <p className="leading-relaxed">Esqueceu a senha? Peça a quem cuida do app no seu grupo: ele define uma nova.</p>}
          {reauth && onCancel && (
            <p>
              <button type="button" onClick={onCancel} className="min-h-10 px-3 rounded-lg" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.soft }}>
                Agora não
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, htmlFor, errorId, error, attempt, children }: {
  label: string
  htmlFor: string
  errorId: string
  error?: string
  attempt: number
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] mb-1.5" style={{ color: COLORS.soft }}>{label}</label>
      {children}
      {/* A região do erro existe antes do erro (ver o comentário da região do formulário). */}
      <div id={errorId} aria-live="polite">
        {error && <p key={attempt} className="text-[13px] mt-1.5" style={{ color: COLORS.error }}>{error}</p>}
      </div>
    </div>
  )
}

function OptionButton({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 px-3 rounded-lg text-[13px] text-left"
      style={{ border: `1px solid ${danger ? COLORS.error : COLORS.borderStrong}`, color: danger ? COLORS.error : COLORS.text }}
    >
      {children}
    </button>
  )
}
