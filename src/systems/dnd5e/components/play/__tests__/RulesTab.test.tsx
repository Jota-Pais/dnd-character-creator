import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { getRuleReference } from '../ruleReference'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'
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

/** Bruxo 3 (Corruptor) com a Dádiva do Pacto dada (e o que mais vier nas escolhas de progressão). */
function warlock3(progressionChoices: Record<string, string[]>): CharacterDraft {
  return {
    ...structuredClone(COMPLETE_DRAFT),
    name: 'Morgana',
    class: 'warlock',
    level: 3,
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      skills: ['arcana', 'deception'],
      subclass: 'fiend',
      progressionChoices: { 'warlock-invocations-2': ['armadura-de-sombras', 'visao-diabolica'], ...progressionChoices },
    },
    spellChoices: { cantrips: ['eldritch-blast', 'chill-touch'], spells: [] },
  }
}

const WARLOCK_TOME = warlock3({
  'warlock-pact-boon-3': ['pact-of-the-tome'],
  'warlock-pact-tome-cantrips-3': ['guidance', 'fire-bolt', 'sacred-flame'],
})

const MAGIC_INITIATE = 'iniciado-em-magia'
const CLERIC_PICKS = { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] }

/** Guerreiro 4 (meio-orc), sem conjuração de classe, com Iniciado em Magia de clérigo no 4º nível. */
const FIGHTER_INITIATE: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT),
  name: 'Brom',
  class: 'fighter',
  level: 4,
  classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), fightingStyle: 'defense' },
  asiChoices: [{ kind: 'feat', featId: MAGIC_INITIATE }],
  featSelections: { [MAGIC_INITIATE]: CLERIC_PICKS },
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

  it('bruxo do Tomo: os truques do Livro das Sombras dizem de onde vêm, como na Revisão', () => {
    const panel = openRules(WARLOCK_TOME)
    const spells = within(panel).getByRole('region', { name: 'Magias' })
    expect(within(spells).getByRole('button', { name: /^Orientação.*Truques do Livro das Sombras/ })).toBeInTheDocument()
    expect(spells).not.toHaveTextContent('Segredo Mágico')
    fireEvent.click(within(spells).getByRole('button', { name: /^Chama Sagrada/ }))
    expect(screen.getByRole('dialog', { name: 'Chama Sagrada' })).toHaveTextContent('Truque de evocação · Truques do Livro das Sombras')
  })

  it('guerreiro com Iniciado em Magia: o bloco do talento, com os truques e a magia de 1º com o uso escrito', () => {
    const spells = within(openRules(FIGHTER_INITIATE)).getByRole('region', { name: 'Magias' })
    expect(within(spells).getByText('Iniciado em Magia (Clérigo)')).toBeInTheDocument()
    expect(within(spells).getByRole('heading', { name: 'Truques' })).toBeInTheDocument()
    expect(within(spells).getByRole('heading', { name: '1º nível — 1×/descanso longo, no menor nível possível' })).toBeInTheDocument()
    expect(within(spells).getByRole('button', { name: /^Chama Sagrada/ })).toBeInTheDocument()
    expect(within(spells).getByRole('button', { name: /^Orientação/ })).toBeInTheDocument()

    fireEvent.click(within(spells).getByRole('button', { name: /^Curar Ferimentos/ }))
    expect(screen.getByRole('dialog', { name: 'Curar Ferimentos' })).toHaveTextContent(
      '1º nível de evocação · Iniciado em Magia (Clérigo) · 1×/descanso longo, no menor nível possível',
    )
  })

  it('feiticeiro dracônico 6: a escolha sai com o rótulo da Revisão ("Tipo de dano" na Afinidade Elemental)', () => {
    const sorcerer: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      name: 'Vex',
      class: 'sorcerer',
      level: 6,
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        skills: ['arcana', 'persuasion'],
        subclass: 'draconic-bloodline',
        progressionChoices: { 'draconic-ancestor-1': ['blue'] },
      },
    }
    const features = within(openRules(sorcerer)).getByRole('region', { name: 'Características de classe' })

    fireEvent.click(within(features).getByRole('button', { name: /^Afinidade Elemental/ }))
    const affinity = screen.getByRole('dialog', { name: 'Afinidade Elemental' })
    expect(affinity).toHaveTextContent('Tipo de dano: elétrico (ancestral Azul)')
    expect(affinity).not.toHaveTextContent('Escolha:')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    fireEvent.click(within(features).getByRole('button', { name: /^Ancestral Dracônico/ }))
    expect(screen.getByRole('dialog', { name: 'Ancestral Dracônico' })).toHaveTextContent('Escolha: Azul (dano elétrico)')
  })

  it('bruxo 5: as Invocações do 2º e do 5º nível são grupos distintos, com o nível no título', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warlock5 = { ...warlock3({ 'warlock-pact-boon-3': ['pact-of-the-tome'], 'warlock-invocations-5': ['idioma-bestial'] }), level: 5 }
    const features = within(openRules(warlock5)).getByRole('region', { name: 'Características de classe' })
    expect(within(features).getByRole('heading', { name: 'Invocações Místicas (2º nível)' })).toBeInTheDocument()
    expect(within(features).getByRole('heading', { name: 'Invocações Místicas (5º nível)' })).toBeInTheDocument()
    expect(within(features).getByRole('heading', { name: 'Dádiva do Pacto' })).toBeInTheDocument()
    expect(errors.mock.calls.flat().join(' ')).not.toContain('same key')
    errors.mockRestore()
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

  it('Iniciado em Magia: um bloco por talento (getFeatSpellBlocks), depois o da classe, mesmo sendo da mesma lista', () => {
    const cleric: CharacterDraft = {
      ...FIGHTER_INITIATE,
      class: 'cleric',
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['history', 'medicine'], subclass: 'life-domain' },
      spellChoices: { cantrips: ['sacred-flame', 'light', 'thaumaturgy'], spells: [] },
    }
    const blocks = getRuleReference(cleric).find(s => s.id === 'spells')!.blocks
    expect(blocks.map(b => b.label)).toEqual([null, 'Iniciado em Magia (Clérigo)'])
    const [, feat] = blocks
    expect(feat.groups.map(g => [g.title, g.entries.map(e => [e.name, e.meta])])).toEqual([
      ['Truques', [['Chama Sagrada', '1 ação'], ['Orientação', '1 ação · concentração']]],
      ['1º nível — 1×/descanso longo, no menor nível possível', [['Curar Ferimentos', '1 ação']]],
    ])
    // A Chama Sagrada da classe e a do talento: chaves que não colidem.
    const keys = blocks.flatMap(b => b.groups.flatMap(g => g.entries.map(e => e.key)))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual(expect.arrayContaining(['cleric:sacred-flame', `feat:${MAGIC_INITIATE}:sacred-flame`]))
  })

  describe('magias de slot de progressão: a origem é o grupo da Revisão e do PDF (getSecretSpellGroups)', () => {
    const sources = (draft: CharacterDraft) => getRuleReference(draft).find(s => s.id === 'spells')!.blocks
      .flatMap(b => b.groups.flatMap(g => g.entries))
      .map(e => [e.name, e.detail.kind === 'spell' ? e.detail.source : 'não é magia'])

    it('Pacto do Tomo: os truques do Livro das Sombras, ao lado dos truques do bruxo', () => {
      expect(sources(WARLOCK_TOME)).toEqual([
        ['Chama Sagrada', 'Truques do Livro das Sombras'],
        ['Orientação', 'Truques do Livro das Sombras'],
        ['Raio de Fogo', 'Truques do Livro das Sombras'],
        ['Rajada Mística', null],
        ['Toque Arrepiante', null],
      ])
    })

    it('Pacto da Corrente: convocar familiar vem do pacto', () => {
      const chain = getRuleReference(warlock3({ 'warlock-pact-boon-3': ['pact-of-the-chain'] }))
      const familiar = chain.find(s => s.id === 'spells')!.blocks[0].groups
        .flatMap(g => g.entries).find(e => e.key.endsWith(':find-familiar'))
      expect(familiar?.meta).toBe('1 hora · ritual · Pacto da Corrente')
      expect(familiar?.detail).toMatchObject({ kind: 'spell', source: 'Pacto da Corrente' })
    })

    it('bardo 10: os Segredos Mágicos', () => {
      const bard: CharacterDraft = {
        ...structuredClone(COMPLETE_DRAFT),
        class: 'bard',
        level: 10,
        classChoices: {
          ...structuredClone(EMPTY_DRAFT.classChoices),
          skills: ['arcana', 'history', 'insight'],
          progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] },
        },
        spellChoices: { cantrips: ['vicious-mockery'], spells: ['healing-word'] },
      }
      expect(sources(bard)).toEqual(expect.arrayContaining([
        ['Bola de Fogo', 'Segredos Mágicos'],
        ['Contramágica', 'Segredos Mágicos'],
        ['Palavra Curativa', null],
      ]))
    })
  })
})
