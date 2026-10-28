import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage, grantTempHp } from '../../../utils/playState'
import { openKrusk, resetPlay } from './openPlay'

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
