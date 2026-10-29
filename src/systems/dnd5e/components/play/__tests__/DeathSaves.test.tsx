import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage, stabilize } from '../../../utils/playState'
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
    fireEvent.change(screen.getByLabelText(/d20 que você tirou/), { target: { value: '21' } })
    expect(screen.getByRole('button', { name: 'Registrar' })).toBeDisabled()
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

/** Faz o próximo d20 dos dados do app (Web Crypto) sair com a face dada. */
function forceD20(face: number) {
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
    (array as unknown as Uint32Array)[0] = Math.floor(((face - 0.5) / 20) * 2 ** 32)
    return array
  })
}
