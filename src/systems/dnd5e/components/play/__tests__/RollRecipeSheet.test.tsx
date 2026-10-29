import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { addCondition, setInspiration } from '../../../utils/playState'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => {
  cleanup()
  // O clipboard de mentira de cada teste: o jsdom não tem um.
  Reflect.deleteProperty(navigator, 'clipboard')
})

function openAthletics() {
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('button', { name: /^Atletismo: 1d20 \+ 5/ }))
}

describe('RollRecipeSheet — usar a Inspiração', () => {
  it('sem Inspiração, não há o botão', () => {
    openKrusk()
    openAthletics()
    expect(screen.queryByRole('button', { name: /Usar inspiração/ })).toBeNull()
  })

  it('gastar dá vantagem na folha, apaga a estrela e pode ser devolvido', () => {
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    expect(usePlayStore.getState().state!.inspiration).toBe(false)
    expect(screen.getByText(/Com vantagem: role dois d20 e fique com o maior\./)).toBeInTheDocument()
    expect(screen.getByText('• Inspiração gasta: role com vantagem (pág. 127).')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Usar inspiração/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Devolver a inspiração' }))
    expect(usePlayStore.getState().state!.inspiration).toBe(true)
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
    expect(screen.getByRole('button', { name: /Usar inspiração/ })).toBeInTheDocument()
  })

  it('com desvantagem, gastar anula e a folha diz que é um d20 só', () => {
    openKrusk()
    usePlayStore.getState().run(st => addCondition(st, 'poisoned'))
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    expect(screen.getByText(/Com desvantagem/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    expect(screen.queryByText(/Com desvantagem/)).toBeNull()
    expect(screen.getByText(/se anulam: role um d20 só/)).toBeInTheDocument()
  })

  it('com os dados do app, o "Rolar" depois do gasto rola dois d20', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const record = usePlayStore.getState().state!.rolls.at(-1)!
    expect(record.terms.flatMap(t => t.dice)).toHaveLength(2)
  })

  it('depois de outra ação, o "devolver" some (o desfazer geral continua valendo)', () => {
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Devolver a inspiração' }))
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    act(() => { usePlayStore.getState().run(st => addCondition(st, 'prone')) })
    expect(screen.queryByRole('button', { name: 'Devolver a inspiração' })).toBeNull()
  })
})

describe('RollRecipeSheet — Normal / Vantagem / Desvantagem da mesa', () => {
  const tableButton = (name: string) =>
    within(screen.getByRole('group', { name: 'Vantagem ou desvantagem da mesa' })).getByRole('button', { name })

  it('abre em Normal; Vantagem muda o modo e o motivo, não o número', () => {
    openKrusk()
    openAthletics()
    expect(tableButton('Normal')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
    fireEvent.click(tableButton('Vantagem'))
    expect(tableButton('Vantagem')).toHaveAttribute('aria-pressed', 'true')
    expect(tableButton('Normal')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/Com vantagem: role dois d20 e fique com o maior\./)).toHaveTextContent('(Circunstância da mesa)')
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d20 + 5')
    fireEvent.click(tableButton('Normal'))
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
  })

  it('com Envenenado, a vantagem da mesa anula a desvantagem (pág. 175)', () => {
    openKrusk()
    usePlayStore.getState().run(st => addCondition(st, 'poisoned'))
    openAthletics()
    expect(screen.getByText(/Com desvantagem/)).toBeInTheDocument()
    fireEvent.click(tableButton('Vantagem'))
    expect(screen.queryByText(/Com desvantagem/)).toBeNull()
    expect(screen.getByText(/Vantagem \(Circunstância da mesa\) e desvantagem \(Envenenado\) se anulam: role um d20 só\./)).toBeInTheDocument()
    expect(screen.getByText('• Vantagem da mesa: anula a desvantagem: role um d20 só (pág. 175).')).toBeInTheDocument()
  })

  it('com os dados do app, "Rolar" usa o modo que resultou; trocar a escolha tira o resultado antigo', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    openAthletics()
    fireEvent.click(tableButton('Desvantagem'))
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const record = usePlayStore.getState().state!.rolls.at(-1)!
    expect(record.notation).toBe('2d20kl1+5')
    expect(record.terms.flatMap(t => t.dice)).toHaveLength(2)
    expect(screen.getByTestId('roll-total')).toBeInTheDocument()
    fireEvent.click(tableButton('Normal'))
    expect(screen.queryByTestId('roll-total')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(usePlayStore.getState().state!.rolls.at(-1)!.notation).toBe('1d20+5')
  })

  it('a escolha vale só para a folha aberta: reabrir volta ao Normal, e o estado de jogo não muda', () => {
    openKrusk()
    openAthletics()
    const before = usePlayStore.getState().state
    fireEvent.click(tableButton('Vantagem'))
    expect(usePlayStore.getState().state).toBe(before)
    expect(usePlayStore.getState().undoStack).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: /^Atletismo: 1d20 \+ 5/ }))
    expect(tableButton('Normal')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/Com vantagem/)).toBeNull()
  })

  it('jogada que não é d20 (dano) não tem o seletor', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Ataques' }))
    fireEvent.click(screen.getAllByRole('button', { name: /— dano:/ })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Vantagem ou desvantagem da mesa' })).toBeNull()
  })
})

describe('RollRecipeSheet — resultado dos dados do app', () => {
  it('o resultado nasce dentro de uma região viva que já existia antes de rolar', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    openAthletics()
    const live = screen.getByRole('dialog').querySelector('[aria-live="polite"]')!
    expect(live).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(live).toContainElement(screen.getByTestId('roll-total'))
  })

  it('"Copiar resultado" leva o rótulo, a fórmula com o modo da mesa e as faces', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    openAthletics()
    fireEvent.click(within(screen.getByRole('group', { name: 'Vantagem ou desvantagem da mesa' })).getByRole('button', { name: 'Vantagem' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const record = usePlayStore.getState().state!.rolls.at(-1)!
    const [a, b] = record.terms[0].dice
    const faces = [a, b].map(d => (d.kept ? String(d.value) : `${d.value} descartado`)).join(', ')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar resultado' }))
    expect(writeText).toHaveBeenCalledWith(`Atletismo: ${record.total} (1d20 + 5, com vantagem; dados: ${faces})`)
    expect(await screen.findByText('Copiado.')).toBeInTheDocument()
  })
})

describe('RollRecipeSheet — o resultado à vista', () => {
  const scrollIntoView = vi.fn()
  beforeEach(() => {
    scrollIntoView.mockClear()
    Element.prototype.scrollIntoView = scrollIntoView
  })
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    Reflect.deleteProperty(window, 'matchMedia')
  })

  it('cada rolagem leva a folha até o fim dela (o resultado e o dano), e abrir não rola', () => {
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Ataques' }))
    fireEvent.click(screen.getByRole('button', { name: /^Golpe desarmado — ataque:/ }))
    expect(scrollIntoView).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
    // A folha rola até o último elemento dela: depois do resultado e do dano (quando não errou).
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('dialog').lastElementChild)

    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('com prefers-reduced-motion, a folha pula sem animar', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
    })
    usePlayStore.getState().setAppDice(true)
    openKrusk()
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
  })
})
