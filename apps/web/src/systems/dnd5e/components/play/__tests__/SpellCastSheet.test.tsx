import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage, castSpell, getCurrentHp, performAction } from '@rpg/rules/systems/dnd5e/utils/playState'
import type { SpellMechanics } from '@rpg/rules/systems/dnd5e/types/spellMechanics'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { openDraft, resetPlay } from './openPlay'

/**
 * Uma entrada de mentira para Curar Ferimentos, que chega no lote 1: só para exercitar o "Em você?"
 * com a cura. Não é dado revisado.
 */
const FIXTURES = vi.hoisted(() => ({
  'cure-wounds': {
    id: 'cure-wounds', batch: '1', bookLines: [1, 1], status: 'reviewed',
    resolution: { kind: 'none' },
    heal: { count: 1, sides: 8, bonus: 'spellcastingModifier', perSlotAbove: { count: 1 } },
  },
}) as Record<string, SpellMechanics>)

vi.mock('@rpg/rules/systems/dnd5e/utils/spellMechanics', async importOriginal => {
  const actual = await importOriginal<typeof import('@rpg/rules/systems/dnd5e/utils/spellMechanics')>()
  return { ...actual, getSpellMechanics: (id: string) => FIXTURES[id] ?? actual.getSpellMechanics(id) }
})

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

/** Clérigo 3 (SAB +3): 4 espaços de 1º e 2 de 2º. */
const CLERIC: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT),
  name: 'Ilsa',
  class: 'cleric',
  level: 3,
  abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 16, CHA: 10 },
  spellChoices: { cantrips: ['sacred-flame', 'guidance', 'thaumaturgy'], spells: ['cure-wounds', 'bless', 'healing-word', 'detect-magic'] },
}

/** Krusk bárbaro 2 / mago 1: em fúria não se conjura (pág. 48). */
const BARBARIAN_WIZARD: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT),
  level: 3,
  abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 13, WIS: 10, CHA: 8 },
  additionalClasses: [{
    classId: 'wizard', level: 1, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
    spellChoices: { cantrips: ['fire-bolt', 'light', 'mage-hand'], spells: ['shield', 'magic-missile'] },
    asiChoices: [], hpRolls: [],
  }],
  multiclass: true,
}

function openMagic(draft: CharacterDraft) {
  openDraft(draft)
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Magia' }))
}

/** Toca no "Conjurar" de uma magia do grimório, com o foco nele, e devolve o botão e a folha. */
function openCast(name: string) {
  const button = screen.getByRole('button', { name: `Conjurar: ${name}` })
  button.focus()
  fireEvent.click(button)
  return { button, sheet: screen.getByRole('dialog', { name }) }
}

describe('SpellCastSheet — conjurar pelo grimório', () => {
  it('um clérigo conjura Curar Ferimentos no 2º nível em três toques: a bolinha certa apaga e o foco volta ao item', () => {
    openMagic(CLERIC)
    const { button, sheet } = openCast('Curar Ferimentos')
    // A folha propõe o espaço mais baixo; o 2º nível é um toque.
    expect(within(sheet).getByRole('radio', { name: 'Espaço de 1º nível — restam 4' })).toBeChecked()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Espaço de 2º nível — restam 2' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Conjurar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(playState().spellSlotsSpent.slice(0, 2)).toEqual([0, 1])
    expect(screen.getByRole('group', { name: 'Espaço de 1º nível: 4 de 4' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Espaço de 2º nível: 1 de 2' })).toBeInTheDocument()
    expect(playState().turn.action).toBe(true)
    expect(button).toHaveFocus()
    // O aviso do pé diz o que foi gasto, com o desfazer.
    expect(screen.getByText('Curar Ferimentos, no 2º nível: gastou um espaço de 2º nível.')).toBeInTheDocument()
  })

  it('o ritual só aparece para quem pode: o clérigo com Detectar Magia preparada; o feiticeiro, não', () => {
    openMagic(CLERIC)
    const { sheet } = openCast('Detectar Magia')
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Como ritual (+10 min, sem gastar espaço)' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Conjurar' }))
    expect(playState().spellSlotsSpent.every(n => n === 0)).toBe(true)
    expect(playState().concentration?.spellId).toBe('detect-magic')
    expect(playState().turn.action).toBe(false)
    cleanup()
    resetPlay()
    openMagic({ ...CLERIC, class: 'sorcerer', abilityScores: { ...CLERIC.abilityScores, CHA: 16 }, spellChoices: { cantrips: ['fire-bolt'], spells: ['detect-magic'] } })
    const sorcerer = openCast('Detectar Magia').sheet
    expect(within(sorcerer).queryByRole('radio', { name: /ritual/ })).not.toBeInTheDocument()
  })

  it('os avisos saem numa região viva montada antes deles: a magia de ação bônus no turno (pág. 204)', () => {
    openMagic(CLERIC)
    const { sheet } = openCast('Curar Ferimentos')
    const region = sheet.querySelector('[aria-live]')!
    expect(region).toBeEmptyDOMElement()
    // A Palavra Curativa (ação bônus) conjurada com a folha aberta: o aviso entra na mesma região.
    act(() => { usePlayStore.getState().run((st, sh) => castSpell(st, sh, { casterKey: 'class:cleric', spellId: 'healing-word', castLevel: 1, pay: 'slot', now: 1 })) })
    expect(region).toHaveTextContent('Palavra Curativa é de ação bônus: no turno dela, a única outra magia possível é um truque de 1 ação, antes ou depois dela (pág. 204). Curar Ferimentos não é.')
    // O aviso não impede: Conjurar vale.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Conjurar' }))
    expect(playState().spellSlotsSpent[0]).toBe(2)
  })

  it('recusado (em fúria), a recusa fica na folha e o foco no Conjurar, sem gastar nada', () => {
    openMagic(BARBARIAN_WIZARD)
    const { sheet } = openCast('Mísseis Mágicos')
    act(() => { usePlayStore.getState().run((st, sh) => performAction(st, sh, 'rage-enter', { now: 1 })) })
    const conjure = within(sheet).getByRole('button', { name: 'Conjurar' })
    conjure.focus()
    fireEvent.click(conjure)
    expect(screen.getByRole('dialog', { name: 'Mísseis Mágicos' })).toBeInTheDocument()
    expect(sheet.querySelector('[aria-live]')).toHaveTextContent('Mísseis Mágicos: Em fúria você não pode conjurar magias (pág. 48).')
    expect(conjure).toHaveFocus()
    expect(playState().spellSlotsSpent.every(n => n === 0)).toBe(true)
  })

  it('Em você: a cura que você rolou se aplica no mesmo toque; sem o número, o Conjurar diz o que falta', () => {
    openMagic(CLERIC)
    act(() => { usePlayStore.getState().run((st, sh) => applyDamage(st, sh, { amount: 10 })) })
    const before = getCurrentHp(playState(), usePlayStore.getState().sheet!)
    const { sheet } = openCast('Curar Ferimentos')
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Em você?' }))
    const conjure = within(sheet).getByRole('button', { name: 'Conjurar' })
    expect(conjure).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(conjure)
    expect(sheet.querySelector('[aria-live]')).toHaveTextContent('Digite o que rolou, ou desmarque “Em você?”.')
    expect(playState().spellSlotsSpent[0]).toBe(0)
    fireEvent.change(within(sheet).getByLabelText('Cura que você rolou'), { target: { value: '7' } })
    fireEvent.click(conjure)
    expect(getCurrentHp(playState(), usePlayStore.getState().sheet!)).toBe(before + 7)
    expect(playState().spellSlotsSpent[0]).toBe(1)
  })

  it('a Bênção em você liga o efeito, sustentado pela sua concentração; o ganho do 2º nível vem do texto', () => {
    openMagic(CLERIC)
    const { sheet } = openCast('Bênção')
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Espaço de 2º nível — restam 2' }))
    // Sem o dano estruturado dela ainda (lote 1), o "Em níveis superiores" do texto.
    expect(sheet).toHaveTextContent('Em níveis superiores: Quando você conjurar essa magia usando um espaço de magia de 2° nível ou superior, você pode afetar uma criatura adicional')
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Em você?' }))
    expect(sheet).toHaveTextContent('Fica em você: Sob a Bênção, na seção Efeitos ativos, e acaba junto com a sua concentração.')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Conjurar' }))
    expect(playState().activeEffects).toEqual([expect.objectContaining({ id: 'spell:bless', sustainedByConcentration: true })])
    expect(playState().concentration?.spellId).toBe('bless')
    expect(playState().spellSlotsSpent.slice(0, 2)).toEqual([0, 1])
  })
})
