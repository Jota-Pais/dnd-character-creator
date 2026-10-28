import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { openDraft, resetPlay } from './openPlay'

// Os dados do app saem sempre na face escolhida pelo teste (o d20 natural do crítico).
const dice = vi.hoisted(() => ({ face: 10 }))
vi.mock('../../../../../core/dice/rng', async importOriginal => {
  const mod = await importOriginal<typeof import('../../../../../core/dice/rng')>()
  return { ...mod, cryptoRoller: (sides: number) => Math.min(dice.face, sides) }
})

beforeEach(() => {
  resetPlay()
  dice.face = 10
})
afterEach(() => cleanup())

/** Krusk com um Machado Grande: FOR +3, proficiência +2, 1d12 + 3 cortante. */
function openWithGreataxe() {
  const draft = structuredClone(COMPLETE_DRAFT)
  draft.equipment.purchasedItems = [{ itemId: 'greataxe', quantity: 1, source: 'purchased' }]
  openDraft(draft)
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Ataques' }))
}

describe('AttacksTab', () => {
  it('uma linha por ataque, com o bônus e o dano tocáveis', () => {
    openWithGreataxe()
    expect(screen.getByText('Machado Grande')).toBeInTheDocument()
    expect(screen.getByText('Golpe desarmado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Machado Grande — dano: 1d12 \+ 3 cortante$/ }))
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d12 + 3 cortante')
  })

  it('a folha do ataque leva ao dano e ao dano do crítico, que pode voltar ao normal', () => {
    openWithGreataxe()
    fireEvent.click(screen.getByRole('button', { name: /^Machado Grande — ataque: 1d20 \+ 5$/ }))
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d20 + 5')
    fireEvent.click(screen.getByRole('button', { name: 'Dano do crítico' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Machado Grande — dano')
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('2d12 + 3 cortante')
    // Meio-orc: os Ataques Selvagens só como nota do crítico.
    expect(screen.getByTestId('crit-note')).toHaveTextContent('Ataques Selvagens: no acerto crítico com esta arma corpo a corpo, role mais 1d12 (o dado da arma neste ataque)')
    fireEvent.click(screen.getByRole('button', { name: 'Não foi crítico' }))
    expect(screen.getByTestId('recipe-formula')).toHaveTextContent('1d12 + 3 cortante')
    expect(screen.queryByTestId('crit-note')).toBeNull()
  })

  it('Dano de Fúria: nota no cartão do machado e na receita do dano, fora da fórmula; nada no golpe desarmado', () => {
    openWithGreataxe()
    const rage = '• +2 de dano em fúria, sem armadura pesada (Dano de Fúria)'
    const axeCard = screen.getByRole('heading', { name: 'Machado Grande' }).closest('li')!
    expect(within(axeCard).getByText(rage)).toBeInTheDocument()
    const unarmedCard = screen.getByRole('heading', { name: 'Golpe desarmado' }).closest('li')!
    expect(within(unarmedCard).queryByText(/Dano de Fúria/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Machado Grande — dano: 1d12 \+ 3 cortante$/ }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByTestId('recipe-formula')).toHaveTextContent('1d12 + 3 cortante')
    expect(within(sheet).getByText(rage)).toBeInTheDocument()
  })

  it('o rodapé lê a margem de crítico: 20 natural sem o Campeão', () => {
    openWithGreataxe()
    expect(screen.getByText(/20 natural: crítico, os dados de dano dobram\./)).toBeInTheDocument()
  })

  it('com os dados do app, 20 natural no ataque abre o dano já dobrado', () => {
    usePlayStore.getState().setAppDice(true)
    openWithGreataxe()
    fireEvent.click(screen.getByRole('button', { name: /^Machado Grande — ataque/ }))
    dice.face = 20
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(screen.getByText('20 natural!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Dano do crítico: 2d12 \+ 3 cortante$/ }))
    dice.face = 5
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    // 2 × 5 + 3.
    expect(screen.getByTestId('roll-total')).toHaveTextContent('13')
    const rolls = usePlayStore.getState().state!.rolls
    expect(rolls.map(r => r.label)).toEqual(['Machado Grande — ataque', 'Machado Grande — dano (crítico)'])
  })

  it('com os dados do app, 1 natural no ataque erra automaticamente e não oferece o dano', () => {
    usePlayStore.getState().setAppDice(true)
    openWithGreataxe()
    fireEvent.click(screen.getByRole('button', { name: /^Machado Grande — ataque/ }))
    expect(screen.getByText('Acertou? Role o dano')).toBeInTheDocument()
    dice.face = 1
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(screen.getByText('1 natural: erra automaticamente (pág. 196).')).toBeInTheDocument()
    expect(screen.queryByText('Acertou? Role o dano')).toBeNull()
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /^Dano/ })).toBeNull()
    // Rolar de novo (outra jogada) traz o dano de volta.
    dice.face = 12
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(screen.getByText('Acertou? Role o dano')).toBeInTheDocument()
  })
})
