import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

/** Bruxo 3 / mago 2: pool de mago (3 espaços de 1º) e Pacto à parte (2 de 2º). */
const WARLOCK_WIZARD: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT),
  name: 'Morgana',
  race: 'human',
  class: 'warlock',
  level: 5,
  abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 15, WIS: 10, CHA: 15 },
  additionalClasses: [{
    classId: 'wizard', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  }],
  multiclass: true,
}

function openMagic(draft: CharacterDraft) {
  openDraft(draft)
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Magia' }))
}

describe('MagicTab', () => {
  it('gastar um espaço de magia com um toque, e o desfazer devolve', () => {
    openMagic(WARLOCK_WIZARD)
    const group = screen.getByRole('group', { name: 'Espaço de 1º nível: 3 de 3' })
    fireEvent.click(within(group).getAllByRole('button', { name: 'Gastar: Espaço de 1º nível' })[0])
    expect(usePlayStore.getState().state!.spellSlotsSpent[0]).toBe(1)
    expect(screen.getByRole('group', { name: 'Espaço de 1º nível: 2 de 3' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(usePlayStore.getState().state!.spellSlotsSpent[0]).toBe(0)
    expect(screen.getByRole('group', { name: 'Espaço de 1º nível: 3 de 3' })).toBeInTheDocument()
  })

  it('Magia de Pacto fica à parte; tocar numa bolinha vazia recupera', () => {
    openMagic(WARLOCK_WIZARD)
    expect(screen.getByText('Magia de Pacto')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Gastar: Espaço de Pacto (2º nível)' })[0])
    expect(usePlayStore.getState().state!.pactSlotsSpent).toBe(1)
    expect(usePlayStore.getState().state!.spellSlotsSpent[0]).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar: Espaço de Pacto (2º nível)' }))
    expect(usePlayStore.getState().state!.pactSlotsSpent).toBe(0)
  })

  it('CD e ataque de magia por classe conjuradora; o ataque abre a receita', () => {
    openMagic(WARLOCK_WIZARD)
    expect(screen.getAllByText('CD de magia')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: /^Ataque de magia — / })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('bárbaro: Fúria com usos e a recarga escrita; Dados de Vida disponíveis', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Magia' }))
    expect(screen.getByRole('group', { name: 'Fúria: 2 de 2' })).toBeInTheDocument()
    expect(screen.getAllByText('Recupera em descanso longo.').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Gastar: Fúria' })[0])
    expect(screen.getByRole('group', { name: 'Fúria: 1 de 2' })).toBeInTheDocument()
    expect(screen.getByTestId('hit-dice-d12')).toHaveTextContent('d12: 1 de 1 disponíveis')
  })
})
