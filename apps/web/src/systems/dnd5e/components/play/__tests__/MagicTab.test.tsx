import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { completeLongRest } from '@rpg/rules/systems/dnd5e/utils/playState'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { liveRegions, openDraft, openKrusk, resetPlay } from './openPlay'

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

const MAGIC_INITIATE = 'iniciado-em-magia'

/**
 * Guerreiro 4 (meio-orc, SAB 10), sem conjuração de classe, com Iniciado em Magia de clérigo no
 * 4º nível: CD 10 e ataque +2 pela Sabedoria; Curar Ferimentos uma vez por descanso longo.
 */
const FIGHTER_INITIATE: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT),
  name: 'Brom',
  class: 'fighter',
  level: 4,
  classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), fightingStyle: 'defense' },
  asiChoices: [{ kind: 'feat', featId: MAGIC_INITIATE }],
  featSelections: { [MAGIC_INITIATE]: { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] } },
}

/** Krusk bárbaro 2 / mago 1: conjura como mago, e a Fúria proíbe conjurar em fúria (p. 48). */
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

const RAGE = 'Fúria: em fúria, você não pode conjurar magias nem se concentrar nelas (pág. 48); entrar em fúria encerra a concentração.'

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

  describe('o que rolar nas magias (onda magias-base)', () => {
    /** A linha de uma magia no grimório: o nome, a pista, o Conjurar e o que rolar. */
    const spellRow = (name: string) => screen.getByText(name, { selector: 'li p' }).closest('li')!

    it('o truque de ataque: o ataque da conjuração abre a receita e leva ao dano, com o crítico', () => {
      openMagic(BARBARIAN_WIZARD)
      const card = spellRow('Raio de Fogo')
      // Só os revisados com algo a rolar: a Luz fica no texto, e as Mãos Mágicas não têm jogada.
      expect(within(spellRow('Luz')).queryByRole('button', { name: /^Luz — / })).not.toBeInTheDocument()
      expect(within(spellRow('Mãos Mágicas')).queryByRole('button', { name: /^Mãos Mágicas — / })).not.toBeInTheDocument()

      // Bárbaro 2 / mago 1: nível de personagem 3, proficiência +2, INT +1.
      fireEvent.click(within(card).getByRole('button', { name: 'Raio de Fogo — ataque: 1d20 + 3' }))
      const attack = screen.getByRole('dialog', { name: 'Raio de Fogo — ataque' })
      expect(attack).toHaveTextContent('Ataque à distância com magia.')
      expect(attack).toHaveTextContent(RAGE)
      fireEvent.click(within(attack).getByRole('button', { name: 'Dano: 1d10 fogo' }))
      const damage = screen.getByRole('dialog', { name: 'Raio de Fogo — dano' })
      expect(within(damage).getByTestId('recipe-formula')).toHaveTextContent('1d10 fogo')
      expect(damage).toHaveTextContent('Acerto crítico: 2d10 fogo')
    })

    it('o truque de TR (Iniciado em Magia): o TR do alvo com a CD do talento, e o dano sem crítico', () => {
      openMagic(FIGHTER_INITIATE)
      const card = spellRow('Chama Sagrada')
      expect(within(spellRow('Orientação')).queryByRole('button', { name: /^Orientação — / })).not.toBeInTheDocument()
      expect(within(card).getByText('TR de Destreza do alvo (CD 10): no sucesso, nenhum dano.')).toBeInTheDocument()
      // O condicional do TR, em linha própria (a regra de ouro).
      expect(within(card).getByText('O alvo não recebe qualquer benefício de cobertura contra esse teste de resistência.')).toBeInTheDocument()
      // Guerreiro 4: nível de personagem 4, ainda no primeiro degrau do truque.
      fireEvent.click(within(card).getByRole('button', { name: 'Chama Sagrada — dano: 1d8 radiante' }))
      const damage = screen.getByRole('dialog', { name: 'Chama Sagrada — dano' })
      expect(damage).not.toHaveTextContent('Acerto crítico')
      expect(damage).toHaveTextContent('Truque: o dano cresce com o nível de personagem — 2d8 no 5º, 3d8 no 11º e 4d8 no 17º.')
    })
  })

  describe('guerreiro com Iniciado em Magia (sem conjuração de classe)', () => {
    it('a CD e o ataque do talento na Conjuração, tocáveis como os da classe', () => {
      openMagic(FIGHTER_INITIATE)
      expect(screen.queryByText('Sem magias nem recursos com usos nesta ficha.')).not.toBeInTheDocument()
      expect(screen.getByText('Grimório')).toBeInTheDocument()
      expect(screen.getByText('Iniciado em Magia (Clérigo)')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'CD de magia 10: de onde vem' }))
      const dc = screen.getByRole('dialog', { name: 'CD de magia — Iniciado em Magia (Clérigo)' })
      expect(within(dc).getByTestId('source-items')).toHaveTextContent('Sabedoria')
      fireEvent.click(within(dc).getByRole('button', { name: 'Fechar' }))

      fireEvent.click(screen.getByRole('button', { name: 'Ataque de magia — Iniciado em Magia (Clérigo): 1d20 + 2' }))
      expect(screen.getByRole('dialog', { name: 'Ataque de magia — Iniciado em Magia (Clérigo)' })).toHaveTextContent('1d20 + 2')
    })

    it('o uso da magia de 1º, com o nome dela, gasta e recupera nos Recursos; o descanso longo devolve', () => {
      openMagic(FIGHTER_INITIATE)
      expect(screen.getByText('Iniciado em Magia (talento)')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Gastar: Curar Ferimentos' }))
      expect(usePlayStore.getState().state!.resourcesSpent['magic-initiate-spell']).toBe(1)
      expect(screen.getByRole('group', { name: 'Curar Ferimentos: 0 de 1' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Recuperar: Curar Ferimentos' }))
      expect(usePlayStore.getState().state!.resourcesSpent['magic-initiate-spell'] ?? 0).toBe(0)

      fireEvent.click(screen.getByRole('button', { name: 'Gastar: Curar Ferimentos' }))
      act(() => { usePlayStore.getState().run((st, sh) => completeLongRest(st, sh)) })
      expect(screen.getByRole('group', { name: 'Curar Ferimentos: 1 de 1' })).toBeInTheDocument()
    })
  })

  describe('em fúria não se conjura (p. 48)', () => {
    it('bárbaro / mago: uma linha na Conjuração, fora da caixa do que está em vigor; o ataque de magia a repete', () => {
      openMagic(BARBARIAN_WIZARD)
      const casting = screen.getByText('Grimório').closest('section')!
      expect(within(casting).getByText(RAGE)).toBeInTheDocument()
      // Uma só vez na aba: a caixa vermelha (guide.notes) não a recebe.
      expect(screen.getAllByText(RAGE)).toHaveLength(1)

      fireEvent.click(screen.getByRole('button', { name: /^Ataque de magia — Mago/ }))
      expect(screen.getByRole('dialog', { name: 'Ataque de magia — Mago' })).toHaveTextContent(RAGE)
    })

    it('sem Fúria, nada novo: bruxo / mago e o guerreiro com Iniciado em Magia', () => {
      openMagic(WARLOCK_WIZARD)
      expect(screen.queryByText(/em fúria/)).not.toBeInTheDocument()
      cleanup()
      resetPlay()
      openMagic(FIGHTER_INITIATE)
      expect(screen.queryByText(/em fúria/)).not.toBeInTheDocument()
    })
  })

  it('bárbaro: Fúria com usos e a recarga escrita', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Magia' }))
    expect(screen.getByRole('group', { name: 'Fúria: 2 de 2' })).toBeInTheDocument()
    expect(screen.getAllByText('Recupera em descanso longo.').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Gastar: Fúria' })[0])
    expect(screen.getByRole('group', { name: 'Fúria: 1 de 2' })).toBeInTheDocument()
  })

  it('poço de PV (Cura pelas Mãos): o "Gastar", o −1 e o +1 que chegam ao limite ficam apagados com o foco neles', () => {
    openMagic({
      ...structuredClone(COMPLETE_DRAFT),
      class: 'paladin',
      classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), skills: ['insight', 'medicine'] },
    })
    const name = 'Cura pelas Mãos'
    const remaining = () => screen.getByTestId(`remaining-${name}`)
    fireEvent.change(screen.getByLabelText(`Quanto gastar: ${name}`), { target: { value: '4' } })
    const spend = screen.getByRole('button', { name: 'Gastar' })
    spend.focus()
    fireEvent.click(spend)
    expect(remaining()).toHaveTextContent('restam 1 de 5 PV')
    expect(spend).toHaveAttribute('aria-disabled', 'true')
    expect(spend).toHaveFocus()

    const lower = screen.getByRole('button', { name: `Gastar 1: ${name}` })
    lower.focus()
    fireEvent.click(lower)
    expect(remaining()).toHaveTextContent('restam 0 de 5 PV')
    expect(lower).toHaveAttribute('aria-disabled', 'true')
    expect(lower).toHaveFocus()
    // Apagado, não faz nada: nem um passo do desfazer, nem um aviso de recusa.
    const steps = usePlayStore.getState().undoStack.length
    fireEvent.click(lower)
    expect(usePlayStore.getState().undoStack).toHaveLength(steps)
    expect(usePlayStore.getState().notices.some(n => n.kind === 'refused')).toBe(false)

    const raise = screen.getByRole('button', { name: `Recuperar 1: ${name}` })
    raise.focus()
    for (let i = 0; i < 5; i++) fireEvent.click(raise)
    expect(remaining()).toHaveTextContent('restam 5 de 5 PV')
    expect(raise).toHaveAttribute('aria-disabled', 'true')
    expect(raise).toHaveFocus()
  })

  it('poço de PV: o "Gastar" apagado pelo 0 não aciona a validação do navegador (que levaria o foco ao campo)', () => {
    openMagic({
      ...structuredClone(COMPLETE_DRAFT),
      class: 'paladin',
      classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), skills: ['insight', 'medicine'] },
    })
    const field = screen.getByLabelText('Quanto gastar: Cura pelas Mãos')
    fireEvent.change(field, { target: { value: '0' } })
    const spend = screen.getByRole('button', { name: 'Gastar' })
    expect(spend).toHaveAttribute('aria-disabled', 'true')
    const invalid = vi.fn()
    field.addEventListener('invalid', invalid)
    fireEvent.click(spend)
    expect(invalid).not.toHaveBeenCalled()
    expect(screen.getByTestId('remaining-Cura pelas Mãos')).toHaveTextContent('restam 5 de 5 PV')
  })

  it('o leitor de tela ouve a contagem quando um uso é gasto (abrir a aba não anuncia)', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Magia' }))
    const regions = liveRegions()
    expect(regions.some(r => r.textContent?.includes('Fúria'))).toBe(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Gastar: Fúria' })[0])
    expect(regions.some(r => r.textContent === 'Fúria: 1 de 2')).toBe(true)
  })
})

describe('MagicTab — o grimório (onda grimorio)', () => {
  /** Mago 3 com um ritual no grimório, uma magia de concentração e a de reação. */
  const WIZARD: CharacterDraft = {
    ...structuredClone(COMPLETE_DRAFT),
    name: 'Elminster',
    class: 'wizard',
    level: 3,
    abilityScores: { STR: 8, DEX: 14, CON: 13, INT: 16, WIS: 12, CHA: 10 },
    spellChoices: { cantrips: ['fire-bolt', 'light'], spells: ['detect-magic', 'shield', 'magic-missile'] },
  }
  const row = (name: string) => screen.getByText(name, { selector: 'li p' }).closest('li')!

  it('as magias por nível, com as marcas, o Conjurar e a nota do que o app ainda não sabe (as preparadas do mago)', () => {
    openMagic(WIZARD)
    const book = screen.getByText('Grimório').closest('section')!
    expect(within(book).getByRole('heading', { name: 'Truques' })).toBeInTheDocument()
    expect(within(book).getByRole('heading', { name: '1º nível' })).toBeInTheDocument()
    expect(row('Detectar Magia')).toHaveTextContent('1 ação · concentração · ritual · no grimório')
    expect(row('Escudo Arcano')).toHaveTextContent('1 reação · no grimório')
    // O truque de dano diz o nível de personagem de que a conta parte (decisão de 2026-10-29).
    expect(row('Raio de Fogo')).toHaveTextContent('1 ação · escala pelo nível de personagem: 3')
    expect(row('Luz')).not.toHaveTextContent('escala')
    expect(within(row('Mísseis Mágicos')).getByRole('button', { name: 'Conjurar: Mísseis Mágicos' })).toBeInTheDocument()
    expect(book).toHaveTextContent('O app ainda não sabe quais magias você preparou hoje: conjure só as preparadas')
    expect(screen.getByText('O Conjurar gasta o espaço sozinho; o toque na bolinha corrige.')).toBeInTheDocument()
  })

  // Decisão de 2026-10-31: a raça é uma conjuração, com o atributo que o traço declara (o tiferino,
  // Carisma, pág. 43).
  it('as da raça (o tiferino): a lista dela com a CD e o ataque de Carisma, e a inata no nível dela', () => {
    openMagic({ ...structuredClone(COMPLETE_DRAFT), race: 'tiefling', level: 3 })
    const book = screen.getByText('Grimório').closest('section')!
    expect(within(book).getByText('Tiefling')).toBeInTheDocument()
    // Carisma 10 (8 + 2 do tiferino): CD 8 + 2 + 0; ataque +2.
    expect(within(book).getByRole('button', { name: 'CD de magia 10: de onde vem' })).toBeInTheDocument()
    expect(within(book).getByRole('button', { name: /^Ataque de magia — Tiefling: 1d20 \+ 2/ })).toBeInTheDocument()
    expect(row('Repreensão Infernal')).toHaveTextContent('1 reação · 1×/descanso longo · da raça')
    fireEvent.click(screen.getByRole('button', { name: 'Conjurar: Repreensão Infernal' }))
    const sheet = screen.getByRole('dialog', { name: 'Repreensão Infernal' })
    expect(sheet).toHaveTextContent('No 2º nível, sem gastar espaço')
    expect(sheet).toHaveTextContent('1 uso por descanso longo, como magia de 2º nível (o app ainda não conta esse uso).')
  })

  it('a mesma magia em duas conjurações (clérigo / mago): o nome de cada Conjurar diz qual, e a folha abre a dela', () => {
    openMagic({
      ...structuredClone(COMPLETE_DRAFT),
      class: 'cleric',
      level: 4,
      abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 14, WIS: 16, CHA: 10 },
      spellChoices: { cantrips: ['sacred-flame', 'guidance', 'thaumaturgy'], spells: ['detect-magic', 'bless'] },
      additionalClasses: [{
        classId: 'wizard', level: 1, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
        spellChoices: { cantrips: ['fire-bolt', 'light', 'mage-hand'], spells: ['detect-magic', 'shield'] },
        asiChoices: [], hpRolls: [],
      }],
      multiclass: true,
    })
    expect(screen.getAllByRole('button', { name: /^Conjurar: Detectar Magia/ }).map(b => b.getAttribute('aria-label'))).toEqual([
      'Conjurar: Detectar Magia — Clérigo',
      'Conjurar: Detectar Magia — Mago',
    ])
    // A que só está numa conjuração fica com o nome curto.
    expect(screen.getByRole('button', { name: 'Conjurar: Bênção' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Conjurar: Detectar Magia — Mago' }))
    expect(screen.getByRole('dialog', { name: 'Detectar Magia' })).toHaveTextContent('· Mago')
  })
})
