import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { loadPlayState } from '../../../utils/playStorage'
import type { CharacterDraft } from '../../../types/character'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

function openStatus() {
  openKrusk()
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
}

describe('StatusTab — condições', () => {
  it('liga uma condição, grava a nota de duração e desliga levando a nota junto', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Envenenado' }))
    expect(playState().conditions).toEqual(['poisoned'])
    expect(screen.getByRole('switch', { name: 'Envenenado' })).toHaveAttribute('aria-checked', 'true')

    const note = screen.getByLabelText('Duração de Envenenado (opcional)')
    fireEvent.change(note, { target: { value: 'até o fim do próximo turno do mago' } })
    // Digitar não grava: só ao sair do campo (cada letra não vira um passo do desfazer).
    expect(playState().conditionNotes).toBeUndefined()
    fireEvent.blur(note)
    expect(playState().conditionNotes).toEqual({ poisoned: 'até o fim do próximo turno do mago' })
    // A nota aparece também no chip dos vitais.
    expect(screen.getByText(/· até o fim do próximo turno do mago/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'Envenenado' }))
    expect(playState().conditions).toEqual([])
    expect(playState().conditionNotes).toBeUndefined()
  })

  it('a nota de duração sem Enter nem blur grava ao trocar de aba e ao sair do jogo', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Envenenado' }))
    fireEvent.change(screen.getByLabelText('Duração de Envenenado (opcional)'), { target: { value: '1 hora' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Notas' }))
    expect(playState().conditionNotes).toEqual({ poisoned: '1 hora' })

    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    fireEvent.change(screen.getByLabelText('Duração de Envenenado (opcional)'), { target: { value: '2 horas' } })
    const id = usePlayStore.getState().characterId!
    fireEvent.click(screen.getByText('← Personagens'))
    expect(loadPlayState(id)?.conditionNotes).toEqual({ poisoned: '2 horas' })
  })

  it('desligar a condição com a nota pendente não grava nem recusa nada', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Envenenado' }))
    fireEvent.change(screen.getByLabelText('Duração de Envenenado (opcional)'), { target: { value: '1 hora' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Envenenado' }))
    expect(playState().conditions).toEqual([])
    expect(playState().conditionNotes).toBeUndefined()
    expect(usePlayStore.getState().notices.some(n => n.kind === 'refused')).toBe(false)
  })

  it('o desfazer volta a nota anterior no campo', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Amedrontado' }))
    const note = screen.getByLabelText('Duração de Amedrontado (opcional)')
    fireEvent.change(note, { target: { value: '1 minuto' } })
    fireEvent.blur(note)
    expect(note).toHaveValue('1 minuto')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(screen.getByLabelText('Duração de Amedrontado (opcional)')).toHaveValue('')
  })

  it('condição derivada aparece "por causa de" sem toggle próprio', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Paralisado' }))
    const row = screen.getByTestId('condition-incapacitated')
    expect(within(row).queryByRole('switch')).toBeNull()
    expect(within(row).getByText('por causa de Paralisado')).toBeInTheDocument()
  })

  it('a regra abre a um toque', () => {
    openStatus()
    const rule = screen.getByRole('button', { name: 'Regra de Agarrado' })
    expect(rule).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(rule)
    expect(screen.getByText(/O deslocamento de uma criatura agarrada se torna 0/)).toBeInTheDocument()
  })

  it('Caído tem o "Levantar"', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Caído' }))
    fireEvent.click(screen.getByRole('button', { name: 'Levantar' }))
    expect(playState().conditions).toEqual([])
  })

  it('o "Levantar" some com o Caído, e o foco vai ao switch dele', () => {
    openStatus()
    const prone = screen.getByRole('switch', { name: 'Caído' })
    fireEvent.click(prone)
    const stand = screen.getByRole('button', { name: 'Levantar' })
    stand.focus()
    fireEvent.click(stand)
    expect(screen.queryByRole('button', { name: 'Levantar' })).toBeNull()
    expect(prone).toHaveFocus()
  })

  it('desligada a condição que outra também dá, o switch some, e o foco vai ao "regra" da linha', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Incapacitado' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Paralisado' }))
    const incapacitated = screen.getByRole('switch', { name: 'Incapacitado' })
    incapacitated.focus()
    fireEvent.click(incapacitated)
    // Continua valendo, por causa do Paralisado, sem switch próprio.
    expect(playState().conditions).toEqual(['paralyzed'])
    expect(within(screen.getByTestId('condition-incapacitated')).queryByRole('switch')).toBeNull()
    expect(screen.getByRole('button', { name: 'Regra de Incapacitado' })).toHaveFocus()
  })
})

describe('StatusTab — exaustão e concentração', () => {
  it('exaustão mostra o texto cumulativo do nível', () => {
    openStatus()
    fireEvent.click(screen.getByRole('radio', { name: 'Exaustão 2' }))
    expect(playState().exhaustionLevel).toBe(2)
    const effects = screen.getByTestId('exhaustion-effects')
    expect(effects).toHaveTextContent('Desvantagem em testes de habilidade')
    expect(effects).toHaveTextContent('Deslocamento reduzido à metade')
  })

  it('exaustão 6: morto com 0 PV, e o desfazer devolve os PV de antes', () => {
    openStatus()
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    fireEvent.click(screen.getByRole('radio', { name: 'Exaustão 6 (morte)' }))
    expect(playState().lifeState).toBe('dead')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('0')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(playState().lifeState).toBe('conscious')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
  })

  it('teclado na exaustão: só o nível marcado entra no Tab, e as setas sobem e descem marcando', () => {
    openStatus()
    const radio = (n: number) => screen.getByRole('radio', { name: n === 6 ? 'Exaustão 6 (morte)' : `Exaustão ${n}` })
    expect(radio(0)).toHaveAttribute('tabindex', '0')
    for (const n of [1, 2, 3, 4, 5, 6]) expect(radio(n)).toHaveAttribute('tabindex', '-1')

    radio(0).focus()
    fireEvent.keyDown(radio(0), { key: 'ArrowRight' })
    expect(playState().exhaustionLevel).toBe(1)
    expect(radio(1)).toHaveAttribute('aria-checked', 'true')
    expect(radio(1)).toHaveAttribute('tabindex', '0')
    expect(radio(1)).toHaveFocus()
    fireEvent.keyDown(radio(1), { key: 'ArrowDown' })
    expect(playState().exhaustionLevel).toBe(2)
    expect(radio(2)).toHaveFocus()
    fireEvent.keyDown(radio(2), { key: 'ArrowUp' })
    fireEvent.keyDown(radio(1), { key: 'ArrowLeft' })
    expect(playState().exhaustionLevel).toBe(0)
    expect(radio(0)).toHaveFocus()

    // Cada seta é um passo do desfazer, como o toque.
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(playState().exhaustionLevel).toBe(1)
  })

  it('teclado na exaustão: as setas não dão a volta (do 0 não se vai à morte)', () => {
    openStatus()
    const none = screen.getByRole('radio', { name: 'Exaustão 0' })
    none.focus()
    fireEvent.keyDown(none, { key: 'ArrowLeft' })
    fireEvent.keyDown(none, { key: 'ArrowUp' })
    expect(playState().exhaustionLevel).toBe(0)
    expect(playState().lifeState).toBe('conscious')
    expect(none).toHaveFocus()

    fireEvent.click(screen.getByRole('radio', { name: 'Exaustão 6 (morte)' }))
    const death = screen.getByRole('radio', { name: 'Exaustão 6 (morte)' })
    fireEvent.keyDown(death, { key: 'ArrowRight' })
    expect(playState().exhaustionLevel).toBe(6)
  })

  it('teclado na exaustão: a seta segurada (repetição do sistema) não sobe nível', () => {
    openStatus()
    const none = screen.getByRole('radio', { name: 'Exaustão 0' })
    none.focus()
    fireEvent.keyDown(none, { key: 'ArrowRight' })
    expect(playState().exhaustionLevel).toBe(1)
    const one = screen.getByRole('radio', { name: 'Exaustão 1' })
    for (let i = 0; i < 5; i++) fireEvent.keyDown(document.activeElement ?? one, { key: 'ArrowRight', repeat: true })
    expect(playState().exhaustionLevel).toBe(1)
    expect(one).toHaveFocus()
  })

  it('concentração começa com nome livre e encerra', () => {
    openStatus()
    fireEvent.change(screen.getByLabelText('Magia em que vai se concentrar'), { target: { value: 'Bênção' } })
    fireEvent.click(screen.getByRole('button', { name: 'Concentrar' }))
    expect(playState().concentration?.label).toBe('Bênção')
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar concentração' }))
    expect(playState().concentration).toBeNull()
  })

  it('teclado na concentração: o foco vai ao "Encerrar" que aparece e, ao encerrar, ao título da seção', () => {
    openStatus()
    const title = screen.getByRole('heading', { name: 'Concentração' })
    // Fora do Tab: o título só recebe o foco quando o controle da seção some.
    expect(title).toHaveAttribute('tabindex', '-1')

    const field = screen.getByLabelText('Magia em que vai se concentrar')
    field.focus()
    fireEvent.change(field, { target: { value: 'Bênção' } })
    fireEvent.submit(field.closest('form')!) // o Enter no campo
    expect(playState().concentration?.label).toBe('Bênção')
    expect(screen.getByRole('button', { name: 'Encerrar concentração' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar concentração' }))
    expect(playState().concentration).toBeNull()
    expect(title).toHaveFocus()
  })

  it('teclado na concentração: recusada, o foco fica no campo', () => {
    openStatus()
    fireEvent.click(screen.getByRole('switch', { name: 'Incapacitado' }))
    const field = screen.getByLabelText('Magia em que vai se concentrar')
    field.focus()
    fireEvent.change(field, { target: { value: 'Bênção' } })
    fireEvent.submit(field.closest('form')!)
    expect(playState().concentration).toBeNull()
    expect(field).toHaveFocus()
  })
})

describe('StatusTab — em fúria não se concentra (p. 48)', () => {
  const RAGE = 'Fúria: em fúria, você não pode conjurar magias nem se concentrar nelas (pág. 48); entrar em fúria encerra a concentração.'
  /** Krusk tiefling bárbaro 3: conjura só a magia inata da raça (Taumaturgia, Repreensão Infernal). */
  const TIEFLING_BARBARIAN: CharacterDraft = { ...structuredClone(COMPLETE_DRAFT), race: 'tiefling', level: 3 }
  const concentration = () => screen.getByText('Concentração').closest('section')!

  it('na seção Concentração, antes e durante; o TR depois do dano também lembra', () => {
    openDraft(TIEFLING_BARBARIAN)
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    expect(within(concentration()).getByText(RAGE)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Magia em que vai se concentrar'), { target: { value: 'Escuridão' } })
    fireEvent.click(screen.getByRole('button', { name: 'Concentrar' }))
    expect(within(concentration()).getByText(RAGE)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Ver o que rolar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(RAGE)
  })

  it('o Guerreiro Totêmico, que conjura Sentido Bestial pelo Conselheiro Espiritual (p. 50), vê a linha', () => {
    const totem = structuredClone(COMPLETE_DRAFT)
    openDraft({
      ...totem, level: 3,
      classChoices: {
        ...totem.classChoices, subclass: 'totem-warrior',
        progressionChoices: { 'totem-warrior-totem-3': ['bear'] },
      },
    })
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    expect(within(concentration()).getByText(RAGE)).toBeInTheDocument()
  })

  it('o bárbaro que não conjura nada não vê a linha', () => {
    openStatus()
    expect(concentration()).not.toHaveTextContent('em fúria')
  })
})
