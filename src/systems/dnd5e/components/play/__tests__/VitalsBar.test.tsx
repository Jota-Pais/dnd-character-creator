import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage, applyHealing, completeLongRest, grantTempHp } from '../../../utils/playState'
import { EMPTY_DRAFT } from '../../../types/character'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { HP_FLASH_MS } from '../hpVitals'
import { liveRegions, openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const damage = (amount: number) =>
  act(() => { usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount })) })

describe('VitalsBar — leitor de tela', () => {
  const heard = (text: string) => liveRegions().some(r => r.textContent === text)

  it('anuncia o PV quando ele muda, venha de onde vier; abrir a ficha não anuncia', () => {
    openKrusk()
    render(<PlayScreen />)
    expect(liveRegions().some(r => r.textContent?.includes('PV 14 de 14'))).toBe(false)
    damage(5)
    expect(heard('PV 9 de 14')).toBe(true)
    act(() => { usePlayStore.getState().run(st => grantTempHp(st, 4)) })
    expect(heard('PV 9 de 14, mais 4 temporários')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(heard('PV 9 de 14')).toBe(true)
  })
})

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

describe('VitalsBar — retorno do dano e da cura', () => {
  afterEach(() => { vi.useRealTimers() })

  const flash = () => screen.getByTestId('hp-current').getAttribute('data-flash')

  it('abrir a ficha não pisca; o dano pisca vermelho e a cura verde, por instantes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    openKrusk()
    render(<PlayScreen />)
    expect(flash()).toBeNull()

    damage(5)
    expect(flash()).toBe('damage')
    expect(screen.getByTestId('hp-current')).toHaveClass('text-red-400')
    act(() => { vi.advanceTimersByTime(HP_FLASH_MS) })
    expect(flash()).toBeNull()

    act(() => { usePlayStore.getState().run((st, sh) => applyHealing(st, sh, 3)) })
    expect(flash()).toBe('heal')
    expect(screen.getByTestId('hp-current')).toHaveClass('text-emerald-300')
    act(() => { vi.advanceTimersByTime(HP_FLASH_MS) })
    expect(flash()).toBeNull()
  })

  it('o pulso só vem com motion-safe: com prefers-reduced-motion, fica só a cor', () => {
    openKrusk()
    render(<PlayScreen />)
    damage(2)
    const number = screen.getByTestId('hp-current')
    expect(number.className).toContain('motion-safe:animate-hp-flash')
    expect(number.className).not.toMatch(/(^|\s)animate-hp-flash/)
  })

  it('os temporários que absorvem o golpe piscam vermelho; ganhá-los não pisca', () => {
    openKrusk()
    render(<PlayScreen />)
    act(() => { usePlayStore.getState().run(st => grantTempHp(st, 5)) })
    expect(flash()).toBeNull()
    damage(3)
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    expect(flash()).toBe('damage')
  })

  it('o descanso longo com PV cheio e temporários não pisca; o dano seguinte, sim', () => {
    openKrusk()
    render(<PlayScreen />)
    act(() => { usePlayStore.getState().run(st => grantTempHp(st, 5)) })
    act(() => { usePlayStore.getState().run((st, sh) => completeLongRest(st, sh, { now: 1 })) })
    expect(screen.getByTestId('vitals-hp')).not.toHaveTextContent('temp.')
    expect(flash()).toBeNull()
    // Um descanso que não mexeu no PV (nada a zerar) também é visto: o golpe depois dele pisca.
    act(() => { usePlayStore.getState().run((st, sh) => completeLongRest(st, sh, { now: 2 })) })
    damage(3)
    expect(flash()).toBe('damage')
  })
})
