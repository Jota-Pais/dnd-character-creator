import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { completeLongRest } from '../../../utils/playState'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
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

  describe('guerreiro com Iniciado em Magia (sem conjuração de classe)', () => {
    it('a CD e o ataque do talento na Conjuração, tocáveis como os da classe', () => {
      openMagic(FIGHTER_INITIATE)
      expect(screen.queryByText('Sem magias nem recursos com usos nesta ficha.')).not.toBeInTheDocument()
      expect(screen.getByText('Conjuração')).toBeInTheDocument()
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
      const casting = screen.getByText('Conjuração').closest('section')!
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
