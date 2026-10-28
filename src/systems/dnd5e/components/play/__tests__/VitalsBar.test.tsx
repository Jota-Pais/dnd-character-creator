import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage, grantTempHp } from '../../../utils/playState'
import { EMPTY_DRAFT } from '../../../types/character'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const damage = (amount: number) =>
  act(() => { usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount })) })

describe('VitalsBar — barra de PV', () => {
  it('a barra acompanha o PV atual sobre o máximo e muda de cor por faixa', () => {
    openKrusk()
    render(<PlayScreen />)
    const bar = () => screen.getByTestId('hp-bar')
    expect(bar()).toHaveStyle({ width: '100%' })
    expect(bar()).toHaveAttribute('data-band', 'healthy')

    damage(7) // 7 de 14: metade
    expect(bar()).toHaveStyle({ width: '50%' })
    expect(bar()).toHaveAttribute('data-band', 'wounded')
    expect(screen.queryByText('PV baixo')).toBeNull()

    damage(4) // 3 de 14: até 1/4
    expect(bar()).toHaveAttribute('data-band', 'low')
    expect(screen.getByTestId('vitals-hp')).toHaveTextContent('PV baixo')
  })

  it('a 0 PV o "PV baixo" some: quem assume são os testes contra a morte', () => {
    openKrusk()
    render(<PlayScreen />)
    damage(14)
    expect(screen.getByTestId('hp-bar')).toHaveAttribute('data-band', 'zero')
    expect(screen.queryByText('PV baixo')).toBeNull()
    expect(screen.getByTestId('vitals-hp')).toHaveTextContent('Morrendo')
  })

  it('os PV temporários ficam à parte: não enchem a barra', () => {
    openKrusk()
    render(<PlayScreen />)
    damage(7)
    act(() => { usePlayStore.getState().run(st => grantTempHp(st, 5)) })
    expect(screen.getByTestId('hp-bar')).toHaveStyle({ width: '50%' })
    expect(screen.getByTestId('vitals-hp')).toHaveTextContent('+5 temp.')
  })
})

describe('VitalsBar — Dados de Vida e Descanso', () => {
  const restButton = () => screen.getByRole('button', { name: /^Descanso\. Dados de Vida disponíveis/ })

  it('o bloco fixo mostra os Dados de Vida que restam', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.getByTestId('vitals-hit-dice-d12')).toHaveTextContent('1d12')
    expect(restButton()).toHaveAccessibleName('Descanso. Dados de Vida disponíveis: 1 de 1 d12. Abre os descansos curto e longo')
    act(() => { usePlayStore.getState().run(st => ({ state: { ...st, hitDiceSpent: { 12: 1 } }, notices: [] })) })
    expect(screen.getByTestId('vitals-hit-dice-d12')).toHaveTextContent('0d12')
  })

  it('na multiclasse, um tipo por linha', () => {
    // Bruxo 3 / mago 2: 3d8 e 2d6.
    openDraft({
      ...structuredClone(COMPLETE_DRAFT),
      race: 'human',
      class: 'warlock',
      level: 5,
      additionalClasses: [{
        classId: 'wizard', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
      multiclass: true,
    })
    usePlayStore.getState().run(st => ({ state: { ...st, hitDiceSpent: { 8: 1 } }, notices: [] }))
    render(<PlayScreen />)
    expect(screen.getByTestId('vitals-hit-dice-d8')).toHaveTextContent('2d8')
    expect(screen.getByTestId('vitals-hit-dice-d6')).toHaveTextContent('2d6')
    expect(restButton()).toHaveAccessibleName(/2 de 3 d8 e 2 de 2 d6/)
  })

  it('"Descanso" abre a aba Estado com o foco nos descansos', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(screen.getByRole('tab', { name: 'Testes' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(restButton())
    expect(screen.getByRole('tab', { name: 'Estado' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Descanso curto' })).toHaveFocus()
  })
})
