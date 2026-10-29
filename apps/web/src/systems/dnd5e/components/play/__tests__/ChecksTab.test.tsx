import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { addCondition } from '@rpg/rules/systems/dnd5e/utils/playState'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

describe('ChecksTab', () => {
  it('mostra atributos, TR e perícias com o número da ficha; tocar abre a receita', () => {
    openKrusk()
    render(<PlayScreen />)
    // Meio-orc: FOR 15 + 2 = 17 (+3); Atletismo com proficiência: +5.
    const athletics = screen.getByRole('button', { name: /^Atletismo: 1d20 \+ 5$/ })
    fireEvent.click(athletics)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d20 + 5')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.getByRole('button', { name: /^Teste de Força: 1d20 \+ 3$/ })).toBeInTheDocument()
    // Bárbaro: TR de FOR e CON com proficiência.
    expect(screen.getByRole('button', { name: /^TR de Constituição: 1d20 \+ 4$/ })).toBeInTheDocument()
    expect(screen.queryByText('Lembretes')).toBeNull()
  })

  it('condição ativa: o modo entra no número e a linha condicional vira lembrete', () => {
    openKrusk()
    usePlayStore.getState().run(st => addCondition(st, 'poisoned'))
    usePlayStore.getState().run(st => addCondition(st, 'frightened'))
    render(<PlayScreen />)
    expect(screen.getByRole('button', { name: /^Furtividade: 1d20 \+ 2, com desvantagem \(Envenenado\)$/ })).toBeInTheDocument()
    expect(screen.getByText('Lembretes')).toBeInTheDocument()
    expect(screen.getByText(/fonte do seu medo/)).toBeInTheDocument()
  })

  it('paralisado: falha automática no TR de Destreza', () => {
    openKrusk()
    usePlayStore.getState().run(st => addCondition(st, 'paralyzed'))
    render(<PlayScreen />)
    expect(screen.getByRole('button', { name: /^TR de Destreza: .*falha automática/ })).toBeInTheDocument()
  })
})
