import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { useAppStore } from '../../../../../core/stores/appStore'
import { useCharacterStore } from '../../../stores/characterStore'
import { usePlayStore } from '../../../stores/playStore'
import { formatPlaySubtitle } from '../usePlayView'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

describe('PlayScreen — casca', () => {
  it('mostra o nome, a linha de raça e classe e as abas', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.getByRole('heading', { name: 'Krusk' })).toBeInTheDocument()
    expect(screen.getByText(/Meio-Orc · Bárbaro · nível 1/i)).toBeInTheDocument()
    for (const label of ['Testes', 'Ataques', 'Magia', 'Regras', 'Estado', 'Notas']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('tab', { name: 'Notas' }))
    expect(screen.getByRole('tab', { name: 'Notas' })).toHaveAttribute('aria-selected', 'true')
  })

  it('a linha de classe traz o detalhe da subclasse, como o cabeçalho da Revisão', () => {
    const sorcerer: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      class: 'sorcerer',
      level: 6,
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        subclass: 'draconic-bloodline',
        progressionChoices: { 'draconic-ancestor-1': ['blue'] },
      },
    }
    expect(formatPlaySubtitle(sorcerer)).toBe('Meio-Orc · Feiticeiro (Linhagem Dracônica, ancestral Azul) · nível 6')
    expect(formatPlaySubtitle({ ...sorcerer, classChoices: { ...sorcerer.classChoices, progressionChoices: {} } }))
      .toBe('Meio-Orc · Feiticeiro (Linhagem Dracônica) · nível 6')
  })

  it('"← Personagens" sai do modo de jogo para a galeria', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByText('← Personagens'))
    expect(useCharacterStore.getState().view).toBe('gallery')
    expect(usePlayStore.getState().state).toBeNull()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })

  it('a engrenagem mostra o "Usar os dados do app", desligado por padrão', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.queryByLabelText(/Usar os dados do app/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Configurações do modo de jogo' }))
    const toggle = screen.getByLabelText(/Usar os dados do app/)
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(usePlayStore.getState().prefs.appDice).toBe(true)
  })
})

/**
 * Um dedo arrastado de `from` até `from + (dx, dy)` sobre `el`: toque, um movimento no meio do
 * caminho (é nele que o gesto escolhe o eixo) e soltar.
 */
function swipe(el: Element, dx: number, dy = 0, from = { x: 200, y: 400 }) {
  fireEvent.touchStart(el, { touches: [{ clientX: from.x, clientY: from.y }] })
  fireEvent.touchMove(el, { touches: [{ clientX: from.x + dx / 2, clientY: from.y + dy / 2 }] })
  fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: from.x + dx, clientY: from.y + dy }] })
}

const selectedTab = () => screen.getByRole('tab', { selected: true })

describe('PlayScreen — deslizar entre as abas', () => {
  it('para a esquerda vai à aba seguinte e para a direita volta, com o foco na aba aberta', () => {
    openKrusk()
    render(<PlayScreen />)
    swipe(screen.getByText('Atributos'), -120)
    expect(selectedTab()).toHaveTextContent('Ataques')
    expect(screen.getByRole('tab', { name: 'Ataques' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'play-tab-attacks')

    swipe(screen.getByRole('tabpanel'), 120)
    expect(selectedTab()).toHaveTextContent('Testes')
    expect(screen.getByRole('tab', { name: 'Testes' })).toHaveFocus()
  })

  it('começar num botão da aba também vale, e o toque não abre a receita', () => {
    openKrusk()
    render(<PlayScreen />)
    swipe(screen.getByRole('button', { name: /^Atletismo/ }), -120)
    expect(selectedTab()).toHaveTextContent('Ataques')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('nas pontas não dá a volta', () => {
    openKrusk()
    render(<PlayScreen />)
    swipe(screen.getByRole('tabpanel'), 120)
    expect(selectedTab()).toHaveTextContent('Testes')
    fireEvent.click(screen.getByRole('tab', { name: 'Notas' }))
    swipe(screen.getByRole('tabpanel'), -120)
    expect(selectedTab()).toHaveTextContent('Notas')
  })

  it('curto demais, inclinado demais ou começado na vertical (rolagem) não troca', () => {
    openKrusk()
    render(<PlayScreen />)
    const panel = screen.getByRole('tabpanel')
    swipe(panel, -40)
    swipe(panel, -120, 90)
    // Começa descendo (a página rola) e só depois vai de lado: continua sendo rolagem.
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 400 }] })
    fireEvent.touchMove(panel, { touches: [{ clientX: 198, clientY: 380 }] })
    fireEvent.touchMove(panel, { touches: [{ clientX: 60, clientY: 375 }] })
    fireEvent.touchEnd(panel, { touches: [], changedTouches: [{ clientX: 40, clientY: 375 }] })
    expect(selectedTab()).toHaveTextContent('Testes')
  })

  it('dois dedos (pinça) e toque cancelado não trocam', () => {
    openKrusk()
    render(<PlayScreen />)
    const panel = screen.getByRole('tabpanel')
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 400 }, { clientX: 260, clientY: 420 }] })
    fireEvent.touchEnd(panel, { touches: [], changedTouches: [{ clientX: 60, clientY: 400 }] })
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 400 }] })
    fireEvent.touchMove(panel, { touches: [{ clientX: 150, clientY: 400 }, { clientX: 300, clientY: 400 }] })
    fireEvent.touchEnd(panel, { touches: [], changedTouches: [{ clientX: 60, clientY: 400 }] })
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 400 }] })
    fireEvent.touchCancel(panel, { touches: [] })
    fireEvent.touchEnd(panel, { touches: [], changedTouches: [{ clientX: 60, clientY: 400 }] })
    expect(selectedTab()).toHaveTextContent('Testes')
  })

  it('começar num campo de texto ou na nota da sessão não troca de aba', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    swipe(screen.getByRole('textbox', { name: 'Magia em que vai se concentrar' }), -120)
    expect(selectedTab()).toHaveTextContent('Estado')
    fireEvent.click(screen.getByRole('tab', { name: 'Notas' }))
    swipe(screen.getByRole('textbox', { name: 'Anotações da sessão' }), 120)
    expect(selectedTab()).toHaveTextContent('Notas')
  })

  it('com a regra aberta na aba Regras, deslizar na folha não troca de aba', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Regras' }))
    fireEvent.click(screen.getByRole('button', { name: /^Fúria/ }))
    swipe(within(screen.getByRole('dialog')).getByTestId('rule-sheet'), -120)
    expect(selectedTab()).toHaveTextContent('Regras')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // O fundo escuro em volta da folha também é dela.
    swipe(screen.getByRole('dialog').parentElement!, -120)
    expect(selectedTab()).toHaveTextContent('Regras')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fora da área de conteúdo (os vitais) o gesto não troca de aba', () => {
    openKrusk()
    render(<PlayScreen />)
    swipe(screen.getByTestId('vitals-hp'), -120)
    expect(selectedTab()).toHaveTextContent('Testes')
  })

  it('na tela inteira o arrasto de lado nunca é "voltar página"', () => {
    openKrusk()
    const { unmount } = render(<PlayScreen />)
    // Quem rola (chips, lista do aviso) recomeça o touch-action: a página fica sem overscroll de lado.
    expect(document.documentElement).toHaveClass('overscroll-x-none')
    // touch-action se combina com o dos ancestrais: basta a raiz da tela declarar.
    const panY = (el: Element) => el.closest('.touch-pan-y.touch-pinch-zoom') !== null
    expect(panY(screen.getByRole('button', { name: '← Personagens' }))).toBe(true)
    expect(panY(screen.getByTestId('vitals-hp'))).toBe(true)
    expect(panY(screen.getByTestId('vitals-chips'))).toBe(true)
    expect(panY(screen.getByRole('group', { name: 'Pontos de vida' }))).toBe(true)
    expect(panY(screen.getByRole('status'))).toBe(true)
    expect(panY(screen.getByRole('tabpanel'))).toBe(true)
    // Fora do jogo (galeria, wizard), a página volta ao normal.
    unmount()
    expect(document.documentElement).not.toHaveClass('overscroll-x-none')
  })
})

describe('PlayScreen — o foco não fica atrás dos vitais fixos', () => {
  afterEach(() => vi.restoreAllMocks())

  it('o scroll-padding do <html> é a altura dos vitais, com a folga; fora do jogo, sai', () => {
    // Layout falso (o jsdom não tem): os vitais fixos medem 180 px.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const height = this.classList.contains('sticky') ? 180 : 0
      return { top: 0, bottom: height, height, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    openKrusk()
    const { unmount } = render(<PlayScreen />)
    expect(document.documentElement.style.scrollPaddingTop).toBe('188px')
    unmount()
    expect(document.documentElement.style.scrollPaddingTop).toBe('')
  })
})

describe('PlayScreen — teclado na barra de abas', () => {
  const tab = (name: string) => screen.getByRole('tab', { name })

  it('só a aba aberta entra no Tab', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(tab('Testes')).toHaveAttribute('tabindex', '0')
    for (const name of ['Ataques', 'Magia', 'Regras', 'Estado', 'Notas']) expect(tab(name)).toHaveAttribute('tabindex', '-1')
    fireEvent.click(tab('Regras'))
    expect(tab('Regras')).toHaveAttribute('tabindex', '0')
    expect(tab('Testes')).toHaveAttribute('tabindex', '-1')
  })

  it('as setas abrem a aba vizinha com o foco nela, dando a volta nas pontas', () => {
    openKrusk()
    render(<PlayScreen />)
    tab('Testes').focus()
    fireEvent.keyDown(tab('Testes'), { key: 'ArrowRight' })
    expect(selectedTab()).toHaveTextContent('Ataques')
    expect(tab('Ataques')).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'play-tab-attacks')

    fireEvent.keyDown(tab('Ataques'), { key: 'ArrowLeft' })
    fireEvent.keyDown(tab('Testes'), { key: 'ArrowLeft' })
    expect(selectedTab()).toHaveTextContent('Notas')
    expect(tab('Notas')).toHaveFocus()
    fireEvent.keyDown(tab('Notas'), { key: 'ArrowRight' })
    expect(selectedTab()).toHaveTextContent('Testes')
    expect(tab('Testes')).toHaveFocus()
  })

  it('Home e End vão à primeira e à última aba; outras teclas não trocam', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(tab('Magia'))
    fireEvent.keyDown(tab('Magia'), { key: 'End' })
    expect(selectedTab()).toHaveTextContent('Notas')
    expect(tab('Notas')).toHaveFocus()
    fireEvent.keyDown(tab('Notas'), { key: 'Home' })
    expect(selectedTab()).toHaveTextContent('Testes')
    expect(tab('Testes')).toHaveFocus()
    // Para cima e para baixo são da rolagem da página, não da barra (que é horizontal).
    fireEvent.keyDown(tab('Testes'), { key: 'ArrowDown' })
    fireEvent.keyDown(tab('Testes'), { key: 'a' })
    expect(selectedTab()).toHaveTextContent('Testes')
  })
})

describe('PlayScreen — vitais e receita', () => {
  it('mostra PV, CA, deslocamento e Percepção passiva da ficha', () => {
    openKrusk()
    render(<PlayScreen />)
    // Bárbaro 1 (d12) com CON 14: 12 + 2 = 14 PV.
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    expect(screen.getByTestId('vitals-hp')).toHaveTextContent('/ 14')
    expect(screen.getByText('CA')).toBeInTheDocument()
    expect(screen.getByText('9 m')).toBeInTheDocument()
  })

  it('inspiração liga e desliga pelo estado de jogo', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Sem inspiração/ }))
    expect(usePlayStore.getState().state?.inspiration).toBe(true)
    expect(screen.getByRole('button', { name: /Inspirado/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a iniciativa abre a receita; sem os dados do app, não há "Rolar"', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciativa \+2/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d20 + 2')
    expect(screen.getByText('De onde vem')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rolar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a folha recebe o foco, prende o Tab e devolve o foco a quem a abriu', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    render(<PlayScreen />)
    const opener = screen.getByRole('button', { name: /Iniciativa/ })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Fechar' })
    const rollButton = within(dialog).getByRole('button', { name: 'Rolar' })
    expect(close).toHaveFocus()

    // Shift+Tab no primeiro vai ao último; Tab no último volta ao primeiro.
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(rollButton).toHaveFocus()
    fireEvent.keyDown(rollButton, { key: 'Tab' })
    expect(close).toHaveFocus()

    fireEvent.click(close)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('com os dados do app, "Rolar" mostra o total e grava no histórico', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciativa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const rolls = usePlayStore.getState().state!.rolls
    expect(rolls).toHaveLength(1)
    expect(rolls[0].label).toBe('Iniciativa')
    expect(screen.getByTestId('roll-total')).toHaveTextContent(String(rolls[0].total))
  })
})
