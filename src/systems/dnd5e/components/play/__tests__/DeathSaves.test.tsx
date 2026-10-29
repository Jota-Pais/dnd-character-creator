import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { TOAST_GAP } from '../deathSaveScroll'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage, stabilize, startConcentration } from '../../../utils/playState'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { liveRegions, openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Krusk cai a 0 PV, morrendo. */
function dropToZero() {
  usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: 14 }))
}

function registerNatural(value: string) {
  fireEvent.change(screen.getByLabelText(/d20 que você tirou/), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
}

describe('DeathSaves', () => {
  it('consciente não mostra os testes contra a morte', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.queryByText(/testes contra a morte/)).toBeNull()
  })

  it('a 0 PV: registra sucesso e fracasso pelo d20 natural', () => {
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    expect(screen.getByText(/Morrendo: testes contra a morte/)).toBeInTheDocument()
    registerNatural('12')
    expect(screen.getByRole('img', { name: 'Sucessos: 1 de 3' })).toBeInTheDocument()
    registerNatural('1')
    expect(screen.getByRole('img', { name: 'Fracassos: 2 de 3' })).toBeInTheDocument()
  })

  it('valor fora de 1–20 não registra', () => {
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    expect(screen.queryByText(/Digite o d20 que saiu/)).toBeNull()
    const regions = liveRegions()
    const field = screen.getByLabelText(/d20 que você tirou/)
    fireEvent.change(field, { target: { value: '21' } })
    const register = screen.getByRole('button', { name: 'Registrar' })
    expect(register).toHaveAttribute('aria-disabled', 'true')
    // Apagado, o envio não faz nada: nem a validação do navegador, que levaria o foco ao campo.
    const invalid = vi.fn()
    field.addEventListener('invalid', invalid)
    fireEvent.click(register)
    expect(invalid).not.toHaveBeenCalled()
    expect(usePlayStore.getState().state?.deathSaves).toEqual({ successes: 0, failures: 0 })
    // O botão apagado diz por quê, numa região viva que já existia antes do aviso.
    const hint = screen.getByText('Digite o d20 que saiu (1 a 20); o app soma o resto.')
    expect(regions.some(r => r.contains(hint))).toBe(true)
  })

  it('"Estabilizar" para os testes contra a morte', () => {
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Estabilizar' }))
    expect(usePlayStore.getState().state?.lifeState).toBe('stable')
    expect(screen.getByText('Estável, com 0 PV')).toBeInTheDocument()
  })

  it('estável: ensina o 1 PV depois de 1d4 horas e o registra com um toque', () => {
    openKrusk()
    dropToZero()
    usePlayStore.getState().run(st => stabilize(st))
    render(<PlayScreen />)
    expect(screen.getByText('Se ninguém te curar, recupera 1 PV depois de 1d4 horas (pág. 200).')).toBeInTheDocument()
    // Dados do app desligados: nada de rolar.
    expect(screen.queryByRole('button', { name: 'rolar 1d4' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Passou o tempo: recuperei 1 PV' }))
    expect(usePlayStore.getState().state?.lifeState).toBe('conscious')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('1')
  })

  it('estável, com os dados do app: rola o 1d4 de horas para o histórico', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    dropToZero()
    usePlayStore.getState().run(st => stabilize(st))
    render(<PlayScreen />)
    const regions = liveRegions()
    fireEvent.click(screen.getByRole('button', { name: 'rolar 1d4' }))
    expect(regions.some(r => r.contains(screen.getByText(/^Recupera 1 PV em [1-4] horas?\.$/)))).toBe(true)
    const st = usePlayStore.getState().state!
    expect(st.rolls.at(-1)?.label).toBe('Estável: horas até recuperar 1 PV')
    expect(st.lifeState).toBe('stable')
  })
  it('três fracassos: morto, e "Fui revivido" volta com 1 PV', () => {
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    registerNatural('1')
    registerNatural('5')
    expect(usePlayStore.getState().state?.lifeState).toBe('dead')
    expect(screen.queryByRole('button', { name: 'Dano' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fui revivido' }))
    expect(usePlayStore.getState().state?.lifeState).toBe('conscious')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('1')
  })

  it('com os dados do app, "rolar" preenche o d20 e o teste vai para o histórico', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    dropToZero()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'rolar' }))
    const input = screen.getByLabelText(/d20 que você tirou/) as HTMLInputElement
    expect(Number(input.value)).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    const st = usePlayStore.getState().state!
    expect(st.rolls).toHaveLength(1)
    expect(st.rolls[0].label).toBe('Teste contra a morte')
  })

  it('Sortudo: a nota aparece e, com 1 natural dos dados do app, oferece jogar de novo antes de registrar', () => {
    const halfling = structuredClone(COMPLETE_DRAFT)
    halfling.race = 'halfling'
    halfling.subrace = 'lightfoot-halfling'
    openDraft(halfling)
    usePlayStore.getState().setAppDice(true)
    usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: sh.maxHp }))
    render(<PlayScreen />)
    expect(screen.getByText(/Sortudo: tirou 1 natural no d20\?/)).toBeInTheDocument()

    forceD20(1)
    fireEvent.click(screen.getByRole('button', { name: 'rolar' }))
    forceD20(15)
    fireEvent.click(screen.getByRole('button', { name: 'Rolar de novo (Sortudo)' }))
    expect((screen.getByLabelText(/d20 que você tirou/) as HTMLInputElement).value).toBe('15')
    // O novo resultado vale: sem terceira chance.
    expect(screen.queryByRole('button', { name: 'Rolar de novo (Sortudo)' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    const st = usePlayStore.getState().state!
    expect(st.deathSaves).toEqual({ successes: 1, failures: 0 })
    expect(st.rolls.map(r => r.label)).toEqual(['Teste contra a morte', 'Teste contra a morte — de novo (Sortudo)'])
  })

  it('sem Sortudo, o 1 natural dos dados do app não oferece jogar de novo', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    dropToZero()
    render(<PlayScreen />)
    forceD20(1)
    fireEvent.click(screen.getByRole('button', { name: 'rolar' }))
    expect(screen.queryByRole('button', { name: /Rolar de novo/ })).toBeNull()
  })
})

// Controle que some (ou se desabilita) com a própria ação não larga o foco no body: estável e morto
// trocam o painel (o foco vai ao título dele), e acordar o tira da tela (o foco vai ao painel de PV).
describe('DeathSaves — o foco depois de cada botão', () => {
  function registerFocused(value: string) {
    fireEvent.change(screen.getByLabelText(/d20 que você tirou/), { target: { value } })
    const register = screen.getByRole('button', { name: 'Registrar' })
    register.focus()
    fireEvent.click(register)
    return register
  }

  it('"Registrar" ainda morrendo: o campo esvazia e o foco fica no botão, apagado', () => {
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    const register = registerFocused('12')
    expect(usePlayStore.getState().state?.deathSaves.successes).toBe(1)
    expect(register).not.toBeDisabled()
    expect(register).toHaveAttribute('aria-disabled', 'true')
    expect(register).toHaveFocus()
  })

  it('o 3º sucesso e o "Estabilizar" levam ao título "Estável"; o 3º fracasso, ao "Morto"', () => {
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    registerFocused('12')
    registerFocused('12')
    registerFocused('12')
    expect(usePlayStore.getState().state?.lifeState).toBe('stable')
    const stable = screen.getByText('Estável, com 0 PV')
    expect(stable).toHaveAttribute('tabindex', '-1')
    expect(stable).toHaveFocus()

    cleanup()
    resetPlay()
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    const stabilizeButton = screen.getByRole('button', { name: 'Estabilizar' })
    stabilizeButton.focus()
    fireEvent.click(stabilizeButton)
    expect(screen.getByText('Estável, com 0 PV')).toHaveFocus()

    cleanup()
    resetPlay()
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    registerFocused('1')
    registerFocused('5')
    expect(usePlayStore.getState().state?.lifeState).toBe('dead')
    // O título do painel, não o "Morto" dos vitais.
    expect(screen.getByText('Morto', { selector: 'p' })).toHaveFocus()
  })

  it('o 20 natural, "recuperei 1 PV" e "Fui revivido" tiram os testes da tela: o foco vai ao painel de PV', () => {
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    registerFocused('20')
    expect(usePlayStore.getState().state?.lifeState).toBe('conscious')
    expect(screen.getByRole('button', { name: 'Dano' })).toHaveFocus()

    cleanup()
    resetPlay()
    openKrusk()
    dropToZero()
    usePlayStore.getState().run(st => stabilize(st))
    render(<PlayScreen />)
    const regain = screen.getByRole('button', { name: 'Passou o tempo: recuperei 1 PV' })
    regain.focus()
    fireEvent.click(regain)
    expect(screen.getByRole('button', { name: 'Dano' })).toHaveFocus()

    cleanup()
    resetPlay()
    openKrusk()
    dropToZero()
    render(<PlayScreen />)
    registerFocused('1')
    registerFocused('5')
    const revive = screen.getByRole('button', { name: 'Fui revivido' })
    revive.focus()
    fireEvent.click(revive)
    expect(usePlayStore.getState().state?.lifeState).toBe('conscious')
    expect(screen.getByRole('button', { name: 'Dano' })).toHaveFocus()
  })

  it('"Rolar de novo (Sortudo)" some, e o foco vai ao "Registrar"', () => {
    const halfling = structuredClone(COMPLETE_DRAFT)
    halfling.race = 'halfling'
    halfling.subrace = 'lightfoot-halfling'
    openDraft(halfling)
    usePlayStore.getState().setAppDice(true)
    usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: sh.maxHp }))
    render(<PlayScreen />)
    forceD20(1)
    fireEvent.click(screen.getByRole('button', { name: 'rolar' }))
    forceD20(15)
    const luck = screen.getByRole('button', { name: 'Rolar de novo (Sortudo)' })
    luck.focus()
    fireEvent.click(luck)
    expect(screen.queryByRole('button', { name: 'Rolar de novo (Sortudo)' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar' })).toHaveFocus()
  })
})

describe('DeathSaves — a queda rola o d20 para cima do aviso', () => {
  // Layout falso (o jsdom não tem): o aviso do pé cresce 150 px por linha; o cartão do teste e o
  // formulário do d20 ficam em posições fixas, numa tela de 768 px.
  const PANEL = { top: 900, height: 300 }
  const FORM = { top: 1080, height: 40 }
  const LINE_HEIGHT = 150
  const rect = ({ top, height }: { top: number; height: number }) =>
    ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
  const toastHeight = () => document.querySelectorAll('[role=status] li').length * LINE_HEIGHT
  let frames: FrameRequestCallback[] = []
  const scrollBy = () => vi.mocked(window.scrollBy)

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.firstElementChild?.getAttribute('role') === 'status') {
        return rect({ top: window.innerHeight - toastHeight(), height: toastHeight() })
      }
      if (this.firstElementChild?.textContent === 'Morrendo: testes contra a morte') return rect(PANEL)
      if (this.tagName === 'FORM' && this.querySelector('[aria-label^="d20"]')) return rect(FORM)
      return rect({ top: 0, height: 0 })
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  function hit(amount: number) {
    fireEvent.change(screen.getByRole('textbox', { name: /Dano ou cura/ }), { target: { value: `-${amount}` } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  }

  it('o aviso já aberto (teste de concentração) cresce na queda: rola com a altura nova', () => {
    openKrusk()
    usePlayStore.getState().run(st => startConcentration(st, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    hit(3)
    expect(screen.getByRole('status')).toHaveTextContent(/precisa de 10 ou mais/)
    const before = toastHeight()

    // Krusk tinha 11 PV: cai a 0, e o aviso ganha a queda e a Resistência Implacável.
    hit(11)
    expect(usePlayStore.getState().state?.lifeState).toBe('dying')
    const inset = toastHeight()
    expect(inset).toBeGreaterThan(before)
    act(() => frames.splice(0).forEach(frame => frame(0)))

    expect(scrollBy()).toHaveBeenCalledTimes(1)
    const { top } = scrollBy().mock.calls[0][0] as ScrollToOptions
    // O "Registrar" termina acima do aviso, com a folga.
    expect(FORM.top + FORM.height - top!).toBe(window.innerHeight - inset - TOAST_GAP)
  })

  it('anima a rolagem; com prefers-reduced-motion, pula sem animar', () => {
    openKrusk()
    render(<PlayScreen />)
    hit(14)
    act(() => frames.splice(0).forEach(frame => frame(0)))
    expect(scrollBy()).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'smooth' }))

    cleanup()
    resetPlay()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
    openKrusk()
    render(<PlayScreen />)
    hit(14)
    act(() => frames.splice(0).forEach(frame => frame(0)))
    expect(scrollBy()).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })
})

/** Faz o próximo d20 dos dados do app (Web Crypto) sair com a face dada. */
function forceD20(face: number) {
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
    (array as unknown as Uint32Array)[0] = Math.floor(((face - 0.5) / 20) * 2 ** 32)
    return array
  })
}
