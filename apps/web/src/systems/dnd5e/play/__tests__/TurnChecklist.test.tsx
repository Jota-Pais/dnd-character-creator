import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../stores/playStore'
import { activateToggle } from '@rpg/rules/systems/dnd5e/utils/playState'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { liveRegions, openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

function openActions() {
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Ações' }))
}

const checklist = () => screen.getByRole('group', { name: 'Neste turno' })
const box = (name: RegExp) => within(checklist()).getByRole('button', { name })

describe('TurnChecklist — as quatro casas e o Novo turno', () => {
  it('as casas, livres, com o deslocamento do turno; o toque marca e desmarca, com o foco nele', () => {
    openKrusk()
    openActions()
    expect(within(checklist()).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
      'Ação: livre', 'Ação bônus: livre', 'Movimento: 9 m', 'Reação: livre',
    ])
    const movement = box(/^Movimento/)
    expect(movement).toHaveAttribute('aria-pressed', 'false')
    movement.focus()
    fireEvent.click(movement)
    expect(playState().turn.movement).toBe(true)
    expect(movement).toHaveAttribute('aria-pressed', 'true')
    expect(movement).toHaveTextContent('Movimento✓ 9 m')
    expect(movement).toHaveFocus()
    fireEvent.click(movement)
    expect(playState().turn.movement).toBe(false)
  })

  it('o Usar marca a casa sozinho; a Disparada soma o deslocamento', () => {
    openKrusk()
    openActions()
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Disparada' }))
    expect(box(/^Ação:/)).toHaveAttribute('aria-pressed', 'true')
    expect(box(/^Ação:/)).toHaveTextContent('usada')
    expect(box(/^Movimento/)).toHaveTextContent('18 m')
    expect(box(/^Movimento/)).toHaveAccessibleName('Movimento: 18 m, com Disparada')
  })

  it('o Surto de Ação mostra a ação a mais na casa da ação, até ela ser usada', () => {
    openDraft({ ...structuredClone(COMPLETE_DRAFT), class: 'fighter', level: 2 })
    openActions()
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Surto de Ação' }))
    expect(box(/^Ação:/)).toHaveTextContent('livre +1')
    expect(box(/^Ação:/)).toHaveAccessibleName('Ação: livre, mais 1 ação neste turno')
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Desengajar' }))
    expect(box(/^Ação:/)).toHaveTextContent('usada +1')
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Esconder' }))
    expect(box(/^Ação:/)).toHaveAccessibleName('Ação: usada')
  })

  it('sob a Velocidade, a casa da ação mostra a ação a mais, e Atacar e Disparada no mesmo turno não avisam', () => {
    openKrusk()
    openActions()
    act(() => { usePlayStore.getState().run((st, sh) => activateToggle(st, sh, 'spell:haste', { now: 1 })) })
    expect(box(/^Ação:/)).toHaveAccessibleName('Ação: livre, mais 1 ação neste turno')
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Atacar' }))
    expect(box(/^Ação:/)).toHaveTextContent('usada +1')
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Disparada' }))
    expect(screen.queryByRole('status')).not.toHaveTextContent('já usou')
    expect(box(/^Ação:/)).toHaveAccessibleName('Ação: usada')
  })

  it('Novo turno limpa as casas e anuncia no aviso do pé; o Escudo da Fé fica, o Esquivar acaba', () => {
    openKrusk()
    openActions()
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Esquivar' }))
    fireEvent.click(box(/^Reação/))
    act(() => { usePlayStore.getState().run((st, sh) => activateToggle(st, sh, 'spell:shield-of-faith', { now: 1 })) })
    const regions = liveRegions()
    const next = screen.getByRole('button', { name: 'Novo turno' })
    next.focus()
    fireEvent.click(next)
    expect(playState().turn).toMatchObject({ action: false, reaction: false })
    expect(playState().activeEffects.map(a => a.id)).toEqual(['spell:shield-of-faith'])
    for (const b of within(checklist()).getAllByRole('button')) expect(b).toHaveAttribute('aria-pressed', 'false')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Novo turno: a ação, a ação bônus, o movimento e a reação estão de volta.')
    expect(status).toHaveTextContent('Esquivar: terminou no início do seu turno (pág. 194).')
    // O aviso sai numa região viva que já existia antes dele.
    expect(regions).toContain(status.closest('[aria-live]'))
    expect(next).toHaveFocus()
    // O desfazer volta o turno de antes.
    fireEvent.click(within(status).getByRole('button', { name: /Desfazer/ }))
    expect(playState().turn).toMatchObject({ action: true, reaction: true })
  })
})
