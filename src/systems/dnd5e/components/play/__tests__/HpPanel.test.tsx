import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

function act(label: 'Dano' | 'Cura' | 'PV temporários', field: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: label }))
  fireEvent.change(screen.getByLabelText(field), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
}

describe('HpPanel', () => {
  it('dano digitado baixa o PV e fecha o formulário', () => {
    openKrusk()
    render(<PlayScreen />)
    act('Dano', 'Quanto de dano', '5')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('9')
    expect(screen.queryByLabelText('Quanto de dano')).toBeNull()
  })

  it('resistência marca a metade (para baixo)', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '7' } })
    fireEvent.click(screen.getByLabelText(/resistência/))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('11')
  })

  it('cura não passa do máximo', () => {
    openKrusk()
    render(<PlayScreen />)
    act('Dano', 'Quanto de dano', '6')
    act('Cura', 'Quanto de cura', '20')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
  })

  it('PV temporários: com reserva, pergunta com quais ficar', () => {
    openKrusk()
    render(<PlayScreen />)
    act('PV temporários', 'Quantos PV temporários', '3')
    expect(usePlayStore.getState().state?.tempHp).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'PV temporários' }))
    fireEvent.change(screen.getByLabelText('Quantos PV temporários'), { target: { value: '8' } })
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ficar com 8 (maior)' }))
    expect(usePlayStore.getState().state?.tempHp).toBe(8)
  })

  it('"foi crítico" só aparece a 0 PV', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    expect(screen.queryByLabelText(/acerto crítico/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(usePlayStore.getState().state?.lifeState).toBe('dying')
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText(/acerto crítico/))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(usePlayStore.getState().state?.deathSaves.failures).toBe(2)
  })
})
