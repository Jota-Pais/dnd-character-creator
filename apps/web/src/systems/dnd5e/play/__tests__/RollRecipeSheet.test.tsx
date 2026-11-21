import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../stores/playStore'
import { activateToggle, addCondition, setInspiration } from '@rpg/rules/systems/dnd5e/utils/playState'
import { getRollGuide } from '@rpg/rules/systems/dnd5e/utils/rollGuide'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { RollRecipeSheet } from '../RollRecipeSheet'
import { openDraft, openKrusk, resetPlay } from './openPlay'

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
    usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'poisoned'))
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

  it('"Usar" e "Devolver" trocam de lugar, e o foco passa de um ao outro', () => {
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    const use = screen.getByRole('button', { name: /Usar inspiração/ })
    use.focus()
    fireEvent.click(use)
    expect(screen.getByRole('button', { name: 'Devolver a inspiração' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Devolver a inspiração' }))
    expect(usePlayStore.getState().state!.inspiration).toBe(true)
    expect(screen.getByRole('button', { name: /Usar inspiração/ })).toHaveFocus()
  })

  it('depois de outra ação, o "devolver" some (o desfazer geral continua valendo)', () => {
    openKrusk()
    usePlayStore.getState().run(st => setInspiration(st, true))
    openAthletics()
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Devolver a inspiração' }))
    fireEvent.click(screen.getByRole('button', { name: /Usar inspiração/ }))
    act(() => { usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'prone')) })
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
    usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'poisoned'))
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
    fireEvent.click(screen.getByRole('tab', { name: 'Ações' }))
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
    fireEvent.click(screen.getByRole('tab', { name: 'Ações' }))
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

describe('RollRecipeSheet — os dados a mais dos efeitos ligados', () => {
  it('a Bênção: a fórmula leva o 1d4, e o "de onde vem" diz de quem é', () => {
    openKrusk()
    usePlayStore.getState().run((st, sh) => activateToggle(st, sh, 'spell:bless', { now: 1 }))
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^TR de Força: 1d20 \+ \d+ \+ 1d4/ }))
    expect(screen.getByTestId('recipe-formula').textContent).toMatch(/^1d20 \+ \d+ \+ 1d4$/)
    const blessRow = screen.getByText('Bênção').closest('li')!
    expect(within(blessRow).getByText('+1d4')).toBeInTheDocument()
  })

  it('no crítico, o dado a mais dobra; desmarcado, volta a 1d4 e o "Rolar" segue a conta', () => {
    usePlayStore.getState().setAppDice(true)
    const paladin: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      race: 'human',
      class: 'paladin',
      level: 2,
      classChoices: structuredClone(EMPTY_DRAFT.classChoices),
      spellChoices: { cantrips: [], spells: ['divine-favor'] },
      equipment: { ...structuredClone(COMPLETE_DRAFT.equipment), purchasedItems: [{ itemId: 'longsword', quantity: 1, source: 'purchased' }] },
    }
    openDraft(paladin)
    usePlayStore.getState().run((st, sh) => activateToggle(st, sh, 'spell:divine-favor', { now: 1 }))
    const damage = getRollGuide(paladin, usePlayStore.getState().state!).attacks[0].damage!
    render(<RollRecipeSheet entry={damage} appDice crit onClose={() => {}} />)
    expect(screen.getByTestId('recipe-formula').textContent).toMatch(/^2d8 \+ \d cortante \+ 2d4 radiante$/)
    expect(within(screen.getByText('Auxílio Divino', { selector: 'li span' }).closest('li')!).getByText('+2d4 radiante')).toBeInTheDocument()
    const box = screen.getByRole('checkbox', { name: 'Dobrar 1d4 radiante (Auxílio Divino)' })
    expect(box).toBeChecked()
    fireEvent.click(box)
    expect(box).not.toBeChecked()
    expect(screen.getByTestId('recipe-formula').textContent).toMatch(/^2d8 \+ \d cortante \+ 1d4 radiante$/)
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const last = usePlayStore.getState().state!.rolls.at(-1)!
    expect(last.terms.map(t => `${t.term.count}d${t.term.sides}`)).toEqual(['2d8', '1d4'])
  })

  // A Rede acerta sem causar dano (pág. 150); com o Auxílio Divino, o acerto causa o 1d4 radiante
  // (decisão de 2026-10-30): sem parcela de modificador, o "de onde vem" diz de quem é o dado.
  it('a Rede com o Auxílio Divino: o dano é o 1d4 radiante, com a origem no "de onde vem", e rola só ele', () => {
    usePlayStore.getState().setAppDice(true)
    const paladin: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      race: 'human',
      class: 'paladin',
      level: 2,
      classChoices: structuredClone(EMPTY_DRAFT.classChoices),
      spellChoices: { cantrips: [], spells: ['divine-favor'] },
      equipment: { ...structuredClone(COMPLETE_DRAFT.equipment), purchasedItems: [{ itemId: 'net', quantity: 1, source: 'purchased' }] },
    }
    openDraft(paladin)
    usePlayStore.getState().run((st, sh) => activateToggle(st, sh, 'spell:divine-favor', { now: 1 }))
    const damage = getRollGuide(paladin, usePlayStore.getState().state!).attacks.find(a => a.key === 'net')!.damage!
    render(<RollRecipeSheet entry={damage} appDice onClose={() => {}} />)
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d4 radiante')
    expect(screen.getByText('De onde vem')).toBeInTheDocument()
    expect(within(screen.getByText('Auxílio Divino', { selector: 'li span' }).closest('li')!).getByText('+1d4 radiante')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const last = usePlayStore.getState().state!.rolls.at(-1)!
    expect(last.terms.map(t => `${t.term.count}d${t.term.sides}`)).toEqual(['1d4'])
  })
})
