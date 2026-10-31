import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { addCondition } from '@rpg/rules/systems/dnd5e/utils/playState'
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { liveRegions, openDraft, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

/** Krusk (meio-orc bárbaro) com as armas dadas, numa classe e nível. */
function krusk(itemIds: string[] = ['greataxe'], patch: Partial<CharacterDraft> = {}): CharacterDraft {
  const d = structuredClone(COMPLETE_DRAFT)
  d.equipment.purchasedItems = itemIds.map(itemId => ({ itemId, quantity: 1, source: 'purchased' as const }))
  return { ...d, ...patch }
}

function openActions(draft: CharacterDraft = krusk()) {
  openDraft(draft)
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Ações' }))
}

const group = (name: RegExp) => screen.getByRole('heading', { level: 2, name }).closest('section')!
const item = (id: string) => screen.getByTestId(`action-${id}`)

describe('ActionsTab — o que fazer em cada momento do turno', () => {
  it('os grupos Ação, Ação bônus, Reação e Outras, com Atacar trazendo as linhas de ataque', () => {
    openActions()
    const action = group(/^Ação · livre/)
    expect(within(item('attack')).getByRole('heading', { name: 'Machado Grande' })).toBeInTheDocument()
    expect(within(action).getByRole('button', { name: /^Machado Grande — dano: 1d12 \+ 3 cortante$/ })).toBeInTheDocument()
    // O agarrão e o encontrão ficam dentro de Atacar, sem "Usar" próprio.
    expect(within(item('attack')).getByRole('heading', { name: 'Agarrar' })).toBeInTheDocument()
    expect(within(item('grapple')).queryByRole('button', { name: /^Usar/ })).toBeNull()
    expect(within(group(/^Ação bônus/)).getByRole('button', { name: 'Usar: Entrar em fúria' })).toBeInTheDocument()
    expect(item('rage-enter')).toHaveTextContent('gasta 1 Fúria — restam 2')
    expect(item('opportunity-attack')).toHaveTextContent('Quando um inimigo que você possa ver sai do seu alcance.')
    expect(within(group(/^Outras/)).getByRole('heading', { name: 'Interagir com um objeto' })).toBeInTheDocument()
    expect(within(item('interact')).queryByRole('button', { name: /^Usar/ })).toBeNull()
    // Sem duas armas leves, sem o ataque com a outra mão; o bárbaro não conjura.
    expect(screen.queryByTestId('action-two-weapon-fighting')).toBeNull()
    expect(screen.queryByTestId('action-cast-a-spell')).toBeNull()
  })

  it('Usar gasta e marca a casa; o "Entrar em fúria" some e o foco vai ao título do grupo', () => {
    openActions()
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Entrar em fúria' }))
    expect(playState().resourcesSpent).toEqual({ rage: 1 })
    expect(playState().activeEffects.map(a => a.id)).toEqual(['rage'])
    expect(playState().turn.bonusAction).toBe(true)
    const title = screen.getByRole('heading', { level: 2, name: /^Ação bônus · usada neste turno/ })
    expect(title).toHaveFocus()
    expect(within(group(/^Ação bônus/)).getByRole('button', { name: 'Usar: Encerrar a fúria' })).toBeInTheDocument()
    // O saldo e a casa marcada saem no número, anunciados.
    expect(liveRegions().some(r => r.textContent?.includes('ação bônus usada') && r.textContent.includes('Fúria — resta 1'))).toBe(true)
  })

  it('o Usar que fica (Desengajar) marca a ação e mantém o foco; a segunda ação só avisa', () => {
    openActions()
    const disengage = screen.getByRole('button', { name: 'Usar: Desengajar' })
    disengage.focus()
    fireEvent.click(disengage)
    expect(playState().turn.action).toBe(true)
    expect(disengage).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: /^Ação · usada neste turno/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Esconder' }))
    expect(screen.getByRole('status')).toHaveTextContent('Esconder: você já usou a ação deste turno (pág. 191).')
  })

  it('recusa sem uso: o aviso diz por quê, nada muda e o foco fica', () => {
    openActions()
    act(() => { usePlayStore.getState().run(st => ({ state: { ...st, resourcesSpent: { rage: 2 } }, notices: [] })) })
    const enter = screen.getByRole('button', { name: 'Usar: Entrar em fúria' })
    enter.focus()
    fireEvent.click(enter)
    expect(playState().activeEffects).toEqual([])
    expect(playState().turn.bonusAction).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent('Entrar em fúria: sem usos de Fúria: eles voltam num descanso longo.')
    expect(enter).toHaveFocus()
  })

  it('o "?" abre o texto da ação, com a página; o da característica é o dela', () => {
    openActions()
    const help = within(item('dodge')).getByRole('button', { name: 'O que é: Esquivar' })
    expect(help).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(help)
    expect(help).toHaveAttribute('aria-expanded', 'true')
    expect(item('dodge')).toHaveTextContent('vantagem nos testes de resistência de Destreza')
    expect(item('dodge')).toHaveTextContent('(pág. 194)')
    fireEvent.click(within(item('rage-enter')).getByRole('button', { name: 'O que é: Entrar em fúria' }))
    expect(item('rage-enter')).toHaveTextContent('No seu turno, como ação bônus, entre em fúria por 1 minuto.')
  })

  it('Esconder leva à receita da Furtividade', () => {
    openActions()
    fireEvent.click(within(item('hide')).getByRole('button', { name: /^Furtividade:/ }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Furtividade')
  })

  it('Levantar-se só Caído; usado, some, o movimento mostra o que sobra e o foco vai ao título de Outras', () => {
    openActions()
    expect(screen.queryByTestId('action-stand-up')).toBeNull()
    act(() => { usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'prone')) })
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Levantar-se' }))
    expect(playState().conditions).toEqual([])
    // Custa metade dos 9 m: a casa não fica marcada e mostra os 4,5 m que restam.
    const movement = within(screen.getByRole('group', { name: 'Neste turno' })).getByRole('button', { name: /^Movimento/ })
    expect(movement).toHaveAttribute('aria-pressed', 'false')
    expect(movement).toHaveAccessibleName('Movimento: 4,5 m')
    expect(screen.queryByTestId('action-stand-up')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: /^Outras/ })).toHaveFocus()
  })

  it('com duas armas leves, o ataque com a outra mão aparece na ação bônus', () => {
    openActions(krusk(['handaxe', 'shortsword']))
    expect(within(group(/^Ação bônus/)).getByRole('button', { name: 'Usar: Atacar com a outra mão' })).toBeInTheDocument()
  })

  it('sem nenhuma ação bônus listada, o grupo diz quando se tem uma; quem conjura vê Conjurar uma Magia, que leva à aba Magia', () => {
    openActions(krusk(['dagger'], { class: 'wizard' }))
    expect(group(/^Ação bônus/)).toHaveTextContent('Nenhuma ação bônus listada para a sua ficha.')
    fireEvent.click(within(item('cast-a-spell')).getByRole('button', { name: 'Abrir a aba Magia' }))
    expect(screen.getByRole('tab', { name: 'Magia' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Magia' })).toHaveFocus()
  })

  it('o Frenesi se escolhe ao entrar em fúria pela aba também', () => {
    openActions(krusk(['greataxe'], { level: 3, classChoices: { ...structuredClone(COMPLETE_DRAFT.classChoices), subclass: 'berserker' } }))
    fireEvent.click(within(item('rage-enter')).getByRole('checkbox', { name: 'Frenesi (ao terminar, +1 nível de exaustão)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Usar: Entrar em fúria' }))
    expect(playState().activeEffects).toEqual([expect.objectContaining({ id: 'rage', option: 'frenzy' })])
  })
})
