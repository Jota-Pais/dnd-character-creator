import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { grantTempHp, stabilize, startConcentration } from '../../../utils/playState'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

function damage(value: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
  fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
}

describe('desfazer e avisos', () => {
  it('aplicar dano atualiza o PV e o desfazer do cabeçalho volta', () => {
    openKrusk()
    render(<PlayScreen />)
    const undo = screen.getByRole('button', { name: 'Desfazer a última mudança' })
    expect(undo).toBeDisabled()
    damage('5')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('9')
    fireEvent.click(undo)
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    expect(undo).toBeDisabled()
  })

  it('os avisos da ação aparecem com "Desfazer", que volta o estado', () => {
    openKrusk()
    usePlayStore.getState().run(st => grantTempHp(st, 3))
    render(<PlayScreen />)
    damage('5')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Os PV temporários absorveram 3.')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('12')
    fireEvent.click(within(toast).getByRole('button', { name: '↶ Desfazer' }))
    expect(usePlayStore.getState().state).toMatchObject({ tempHp: 3, damageTaken: 0 })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('recusa aparece em destaque e sem "Desfazer" (não mudou nada)', () => {
    openKrusk()
    render(<PlayScreen />)
    damage('2')
    act(() => { usePlayStore.getState().run(st => stabilize(st)) })
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Não foi feito: Só quem está morrendo pode ser estabilizado.')
    expect(within(toast).queryByRole('button', { name: '↶ Desfazer' })).toBeNull()
    fireEvent.click(within(toast).getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('meio-orc cai a 0 PV: "Usar Resistência Implacável" desfaz e reaplica o dano terminando em 1 PV', () => {
    openKrusk()
    render(<PlayScreen />)
    damage('20')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Resistência Implacável: em vez de cair a 0 PV, você pode ficar com 1 PV')
    expect(usePlayStore.getState().state?.lifeState).toBe('dying')
    fireEvent.click(within(toast).getByRole('button', { name: 'Usar Resistência Implacável (fica com 1 PV)' }))
    const st = usePlayStore.getState().state!
    expect(st.lifeState).toBe('conscious')
    expect(st.conditions).not.toContain('prone')
    expect(st.resourcesSpent['relentless-endurance']).toBe(1)
    expect(screen.getByTestId('hp-current')).toHaveTextContent('1')
    // Gasto o uso, a próxima queda não oferece de novo.
    damage('5')
    expect(usePlayStore.getState().state?.lifeState).toBe('dying')
    expect(screen.queryByRole('button', { name: /Usar Resistência Implacável/ })).toBeNull()
  })

  it('dano com concentração mostra a CD e o que rolar, e "Falhei: encerrar" encerra', () => {
    openKrusk()
    usePlayStore.getState().run(st => startConcentration(st, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    expect(screen.getByText(/Concentrado: Bênção/)).toBeInTheDocument()
    damage('10')
    const toast = screen.getByRole('status')
    // Bárbaro tem proficiência em TR de CON: +2 (CON 14) +2 (proficiência).
    expect(toast).toHaveTextContent('CD 10')
    expect(toast).toHaveTextContent('Role 1d20 + 4: precisa de 10 ou mais.')
    fireEvent.click(within(toast).getByRole('button', { name: 'Ver o que rolar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('CD 10')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Falhei: encerrar' }))
    expect(usePlayStore.getState().state?.concentration).toBeNull()
  })
})
