import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { addCondition } from '@rpg/rules/systems/dnd5e/utils/playState'
import { getFinalAbilityScores } from '@rpg/rules/systems/dnd5e/utils/asiUtils'
import { formatArmorClassBreakdown } from '@rpg/rules/systems/dnd5e/utils/armorClassUtils'
import { getSheetArmorClass } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const itemLabels = () =>
  within(screen.getByTestId('source-items')).getAllByRole('listitem').map(li => li.firstElementChild?.textContent)

describe('"De onde vem" dos números que não se rolam', () => {
  it('a CA dos vitais abre a conta de getSheetArmorClass', () => {
    openKrusk()
    render(<PlayScreen />)
    const ac = getSheetArmorClass(COMPLETE_DRAFT, getFinalAbilityScores(COMPLETE_DRAFT))
    fireEvent.click(screen.getByRole('button', { name: `Classe de Armadura ${ac.value}: de onde vem` }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Classe de Armadura')
    expect(screen.getByTestId('source-value')).toHaveTextContent(String(ac.value))
    expect(itemLabels()).toEqual([...ac.components.map(c => c.label), 'Total'])
    expect(screen.getByText(formatArmorClassBreakdown(ac))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a Percepção passiva mostra o −5 da desvantagem em vigor', () => {
    openKrusk()
    usePlayStore.getState().run(st => addCondition(st, 'poisoned'))
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^Percepção passiva \d+: de onde vem$/ }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Percepção passiva')
    const labels = itemLabels()
    expect(labels[0]).toBe('Base')
    expect(labels).toContain('Desvantagem (Envenenado)')
  })

  it('a CD de magia abre 8 + proficiência + atributo', () => {
    const wizard: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      race: 'human',
      class: 'wizard',
      level: 1,
      abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 15, WIS: 10, CHA: 10 },
      classChoices: structuredClone(EMPTY_DRAFT.classChoices),
    }
    openDraft(wizard)
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Magia' }))
    // Humano: INT 16 (+3); proficiência +2.
    fireEvent.click(screen.getByRole('button', { name: 'CD de magia 13: de onde vem' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('CD de magia — Mago')
    expect(itemLabels()).toEqual(['Base', 'Proficiência', 'Inteligência', 'Total'])
  })
})
