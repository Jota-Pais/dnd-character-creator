import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { loadPlayState } from '../../../utils/playStorage'
import { openKrusk, resetPlay } from './openPlay'

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

  it('concentração começa com nome livre e encerra', () => {
    openStatus()
    fireEvent.change(screen.getByLabelText('Magia em que vai se concentrar'), { target: { value: 'Bênção' } })
    fireEvent.click(screen.getByRole('button', { name: 'Concentrar' }))
    expect(playState().concentration?.label).toBe('Bênção')
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar concentração' }))
    expect(playState().concentration).toBeNull()
  })
})
