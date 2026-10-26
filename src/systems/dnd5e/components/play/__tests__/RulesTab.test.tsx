import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { getRuleReference } from '../ruleReference'
import type { CharacterDraft } from '../../../types/character'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

/** Mago 3 (Escola de Evocação) com três truques e seis magias no grimório. */
const WIZARD_3: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT),
  name: 'Elminster',
  race: 'human',
  class: 'wizard',
  level: 3,
  abilityScores: { STR: 8, DEX: 14, CON: 13, INT: 15, WIS: 12, CHA: 10 },
  classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), skills: ['arcana', 'history'], subclass: 'evocation' },
  spellChoices: {
    cantrips: ['fire-bolt', 'mage-hand', 'light'],
    spells: ['magic-missile', 'shield', 'sleep', 'detect-magic', 'misty-step'],
  },
}

function openRules(draft?: CharacterDraft) {
  if (draft) openDraft(draft)
  else openKrusk()
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Regras' }))
  return screen.getByRole('tabpanel')
}

describe('RulesTab', () => {
  it('mago 3 vê Mísseis Mágicos no 1º nível e abre o texto completo', () => {
    const panel = openRules(WIZARD_3)
    const spells = within(panel).getByRole('region', { name: 'Magias' })
    expect(within(spells).getByText('Truques')).toBeInTheDocument()
    expect(within(spells).getByText('2º nível')).toBeInTheDocument()
    const missile = within(spells).getByRole('button', { name: /^Mísseis Mágicos/ })
    missile.focus() // o toque foca o botão no navegador; o fireEvent não
    fireEvent.click(missile)
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()

    const dialog = screen.getByRole('dialog', { name: 'Mísseis Mágicos' })
    expect(dialog).toHaveTextContent('1º nível de evocação')
    expect(dialog).toHaveTextContent('36 metros')
    expect(dialog).toHaveTextContent('V, S')
    expect(dialog).toHaveTextContent('1d4 + 1 de dano de energia')
    expect(dialog).toHaveTextContent('Em níveis superiores')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(missile).toHaveFocus()
  })

  it('concentração e ritual aparecem ao lado do nome e na duração', () => {
    const panel = openRules(WIZARD_3)
    expect(within(panel).getByRole('button', { name: /^Detectar Magia.*concentração · ritual/ })).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: /^Detectar Magia/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('(ritual)')
    expect(dialog).toHaveTextContent('Concentração, até 10 minutos')
  })

  it('o mago também vê as características da classe e da subclasse', () => {
    const panel = openRules(WIZARD_3)
    const features = within(panel).getByRole('region', { name: 'Características de classe' })
    expect(within(features).getByRole('button', { name: /^Recuperação Arcana/ })).toBeInTheDocument()
  })

  it('bárbaro vê a Fúria; meio-orc vê Ataques Selvagens; sem magias', () => {
    const panel = openRules()
    expect(within(panel).queryByRole('region', { name: 'Magias' })).not.toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: /^Fúria/ }))
    expect(screen.getByRole('dialog', { name: 'Fúria' })).toHaveTextContent('Bárbaro · 1º nível')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    const traits = within(panel).getByRole('region', { name: 'Traços raciais' })
    fireEvent.click(within(traits).getByRole('button', { name: /^Ataques Selvagens/ }))
    expect(screen.getByRole('dialog', { name: 'Ataques Selvagens' })).toHaveTextContent('acerto crítico')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    // A Visão no Escuro fica no alcance da raça (`darkvision`), fora de `traits`: aparece mesmo assim.
    fireEvent.click(within(traits).getByRole('button', { name: /^Visão no Escuro.*18 m/ }))
    expect(screen.getByRole('dialog', { name: 'Visão no Escuro' }))
      .toHaveTextContent('Você enxerga na penumbra a até 18 m como se fosse luz plena')
  })
})

describe('getRuleReference', () => {
  it('talentos dos Incrementos e o Estilo de Luta, com a origem', () => {
    const fighter: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      class: 'fighter',
      level: 4,
      classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), fightingStyle: 'defense' },
      asiChoices: [{ kind: 'feat', featId: 'alerta' }],
    }
    const sections = getRuleReference(fighter)
    expect(sections.map(s => s.id)).toEqual(['class', 'race', 'feats'])
    const feats = sections.find(s => s.id === 'feats')!.blocks[0].groups[0].entries
    expect(feats.map(f => [f.name, f.meta])).toEqual([['Alerta', 'Incremento nv 4']])
    const classGroups = sections.find(s => s.id === 'class')!.blocks[0].groups
    expect(classGroups.find(g => g.title === 'Estilo de Luta')?.entries[0].name).toBe('Defesa')
  })

  it('Visão no Escuro: primeira dos traços, com o alcance da sub-raça; sem ela, não aparece', () => {
    const raceEntries = (draft: CharacterDraft) =>
      getRuleReference(draft).find(s => s.id === 'race')!.blocks[0].groups[0].entries
    const drow: CharacterDraft = { ...structuredClone(COMPLETE_DRAFT), race: 'elf', subrace: 'drow' }
    const [first] = raceEntries(drow)
    expect(first.name).toBe('Visão no Escuro')
    expect(first.meta).toBe('36 m')
    expect(first.detail).toMatchObject({ kind: 'text', kicker: 'Traço · Elfo Negro (Drow)', text: expect.stringContaining('até 36 m') })

    const human: CharacterDraft = { ...structuredClone(COMPLETE_DRAFT), race: 'human', subrace: null }
    expect(raceEntries(human).map(e => e.name)).not.toContain('Visão no Escuro')
  })

  it('truques da raça e magias inatas saem em "Outras magias", com o jeito de usar', () => {
    const tiefling: CharacterDraft = { ...structuredClone(COMPLETE_DRAFT), race: 'tiefling', level: 3 }
    const spells = getRuleReference(tiefling).find(s => s.id === 'spells')!
    expect(spells.blocks).toHaveLength(1)
    expect(spells.blocks[0].label).toBe('Outras magias')
    const entries = spells.blocks[0].groups.flatMap(g => g.entries)
    expect(entries.map(e => e.meta)).toEqual([
      expect.stringContaining('truque, à vontade'),
      expect.stringContaining('1 uso por descanso longo, como magia de 2º nível'),
    ])
  })
})
