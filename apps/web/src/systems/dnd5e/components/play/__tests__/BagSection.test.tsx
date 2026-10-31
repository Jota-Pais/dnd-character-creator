import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage } from '@rpg/rules/systems/dnd5e/utils/playState'
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { liveRegions, openDraft, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

/** Krusk como guerreiro 6, com o que ele compra (método riqueza): arco curto, flechas e poções. */
function archer(...items: string[]): CharacterDraft {
  const d = structuredClone(COMPLETE_DRAFT)
  d.equipment.purchasedItems = items.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const }))
  return { ...d, race: 'human', class: 'fighter', level: 6, abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 } }
}

function open(draft: CharacterDraft, tab: 'Estado' | 'Ações') {
  openDraft(draft)
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: tab }))
}

const bag = () => screen.getByRole('heading', { name: 'Bolsa' }).closest('section')!

describe('BagSection — a bolsa da sessão na aba Estado', () => {
  it('a Poção de Cura: o Usar abre a receita, a cura em você pede o número, e a peça sai da bolsa', () => {
    open(archer('potion-of-healing'), 'Estado')
    act(() => { usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: 10 })) })
    const row = within(bag()).getByTestId('bag-potion-of-healing')
    expect(row).toHaveTextContent('Poção de Cura ×1')

    fireEvent.click(within(row).getByRole('button', { name: 'Usar' }))
    expect(within(row).getByRole('button', { name: /Poção de Cura — cura/ })).toBeInTheDocument()
    const self = within(row).getByRole('button', { name: 'Usar em mim' })
    expect(self).toBeDisabled()
    fireEvent.change(within(row).getByLabelText('Quanto curou'), { target: { value: '7' } })
    fireEvent.click(self)

    expect(playState().damageTaken).toBe(3)
    expect(within(bag()).getByTestId('bag-potion-of-healing')).toHaveTextContent('Poção de Cura ×0')
    // A última peça foi usada: o Usar some, e o foco vai ao +1 do item.
    expect(within(bag()).queryByRole('button', { name: 'Usar' })).toBeNull()
    expect(within(bag()).getByRole('button', { name: 'Pôr 1 de Poção de Cura' })).toHaveFocus()

    // O desfazer volta a poção e o PV.
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(playState().damageTaken).toBe(10)
    expect(within(bag()).getByTestId('bag-potion-of-healing')).toHaveTextContent('Poção de Cura ×1')
  })

  it('moedas: gastar 15 de uma vez; abaixo de 0, recusa e o número digitado fica', () => {
    open(archer(), 'Estado')
    const before = within(bag()).getByTestId('bag-coins').textContent
    const form = within(bag()).getByRole('form', { name: 'Moedas' })
    fireEvent.change(within(form).getByLabelText('Tipo de moeda'), { target: { value: 'cp' } })
    fireEvent.change(within(form).getByLabelText('Quantas moedas'), { target: { value: '999999' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Gastar' }))
    expect(within(bag()).getByTestId('bag-coins').textContent).toBe(before)
    expect(within(form).getByLabelText('Quantas moedas')).toHaveValue(999999)

    fireEvent.change(within(form).getByLabelText('Quantas moedas'), { target: { value: '15' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Receber' }))
    expect(playState().inventory.coinDelta.cp).toBe(15)
    expect(within(form).getByLabelText('Quantas moedas')).toHaveValue(null)
  })

  it('item do livro e item de texto livre entram na bolsa; o peso aparece contra a capacidade', () => {
    open(archer(), 'Estado')
    fireEvent.change(within(bag()).getByLabelText('Item do livro'), { target: { value: 'potion-of-healing' } })
    fireEvent.click(within(bag()).getAllByRole('button', { name: 'Pôr na bolsa' })[0])
    expect(within(bag()).getByTestId('bag-potion-of-healing')).toHaveTextContent('Poção de Cura ×1')

    fireEvent.change(within(bag()).getByLabelText('Outro item, sem regra'), { target: { value: 'Mapa da cripta' } })
    fireEvent.click(within(bag()).getAllByRole('button', { name: 'Pôr na bolsa' })[1])
    expect(bag()).toHaveTextContent('Mapa da cripta ×1')
    expect(liveRegions().some(r => r.textContent?.includes('Mapa da cripta: ×1.'))).toBe(true)

    // Força 16 (humano): 7,5 × 16 = 120 kg.
    expect(within(bag()).getByTestId('bag-weight')).toHaveTextContent('de 120 kg (7,5 × Força 16)')
  })
})

describe('A munição no cartão da arma, na aba Ações', () => {
  it('−1 gasta a flecha e conta o ataque; "Recuperar metade" devolve a metade e leva o foco ao −1', () => {
    open(archer('shortbow', 'arrows'), 'Ações')
    const ammo = () => screen.getByTestId('ammo-shortbow')
    expect(ammo()).toHaveTextContent('Flechas: 20')
    const minus = within(ammo()).getByRole('button', { name: 'Gastar 1 de Flechas' })
    for (let i = 0; i < 5; i++) fireEvent.click(minus)
    expect(ammo()).toHaveTextContent('Flechas: 15')
    expect(playState().turn.attacked).toBe(true)

    fireEvent.click(within(ammo()).getByRole('button', { name: 'Recuperar metade (2)' }))
    expect(ammo()).toHaveTextContent('Flechas: 17')
    expect(within(ammo()).queryByRole('button', { name: /Recuperar metade/ })).toBeNull()
    expect(within(ammo()).getByRole('button', { name: 'Gastar 1 de Flechas' })).toHaveFocus()
  })

  it('o Usar um Objeto leva à Bolsa, com o foco no título', () => {
    open(archer('potion-of-healing'), 'Ações')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a Bolsa' }))
    expect(screen.getByRole('heading', { name: 'Bolsa' })).toHaveFocus()
  })
})
