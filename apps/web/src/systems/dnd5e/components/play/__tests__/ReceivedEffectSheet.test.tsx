import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { addCondition } from '@rpg/rules/systems/dnd5e/utils/playState'
import { EMPTY_DRAFT, type CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { liveRegions, openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

function openSheet() {
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
  const opener = screen.getByRole('button', { name: 'Recebeu uma magia?' })
  opener.focus() // o toque foca o botão no navegador; o fireEvent não
  fireEvent.click(opener)
  return screen.getByRole('dialog')
}

const section = () => screen.getByRole('heading', { name: 'Efeitos ativos' }).closest('section')!

/** Clérigo 1 que conhece o Escudo da Fé (concentração): a folha pergunta quem conjurou. */
const cleric: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT), race: 'human', class: 'cleric', level: 1,
  classChoices: structuredClone(EMPTY_DRAFT.classChoices),
  spellChoices: { cantrips: [], spells: ['shield-of-faith'] },
}

/** Paladino 2 que conhece o Auxílio Divino (Pessoal, concentração): é sempre dele. */
const paladin: CharacterDraft = {
  ...structuredClone(COMPLETE_DRAFT), race: 'human', class: 'paladin', level: 2,
  classChoices: structuredClone(EMPTY_DRAFT.classChoices),
  spellChoices: { cantrips: [], spells: ['divine-favor'] },
}

describe('ReceivedEffectSheet — "Recebeu uma magia?"', () => {
  it('lista o catálogo, busca sem acento, e a de alcance Pessoal só aparece para quem a conhece', () => {
    openKrusk()
    const sheet = openSheet()
    const names = () => within(sheet).getAllByRole('button').map(b => b.textContent).filter(t => t !== '✕')
    expect(names()).toEqual([
      'Bênção1º nível · Concentração, até 1 minuto',
      'Perdição1º nível · Concentração, até 1 minuto',
      'Armadura Arcana1º nível · 8 horas',
      'Escudo da Fé1º nível · Concentração, até 10 minutos',
      'Velocidade3º nível · Concentração, até 1 minuto',
      'Passos Longos1º nível · 1 hora',
      'Pele de Árvore2º nível · Concentração, até 1 hora',
    ])
    const regions = liveRegions()
    fireEvent.change(within(sheet).getByRole('searchbox', { name: 'Buscar a magia pelo nome' }), { target: { value: 'bencao' } })
    expect(names()).toEqual(['Bênção1º nível · Concentração, até 1 minuto'])
    fireEvent.change(within(sheet).getByRole('searchbox'), { target: { value: 'bola de fogo' } })
    const none = within(sheet).getByText('Nenhuma magia do catálogo com esse nome.')
    expect(regions.some(r => r.contains(none))).toBe(true)
  })

  it('o toque na magia já a marca: dois toques, e o foco volta ao "Recebeu uma magia?"; o chip e o número mudam', () => {
    openKrusk()
    const sheet = openSheet()
    // Krusk não conhece a Bênção: foi outra pessoa, que mantém a concentração. Não há o que perguntar.
    fireEvent.click(within(sheet).getByRole('button', { name: /^Bênção/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Recebeu uma magia?' })).toHaveFocus()
    expect(playState().activeEffects).toEqual([{ id: 'spell:bless', startedAt: expect.any(Number) }])
    expect(playState().concentration).toBeNull()
    expect(screen.getByTestId('vitals-toggle-spell:bless')).toHaveTextContent('Sob a Bênção')
    expect(within(section()).getByTestId('toggle-spell:bless')).toHaveTextContent('+1d4 nas jogadas de ataque e testes de resistência')
    expect(within(section()).getByTestId('toggle-spell:bless')).toHaveTextContent('Quem conjurou mantém a concentração')
    // Já ligada, a magia fica na lista sem botão.
    fireEvent.click(screen.getByRole('button', { name: 'Recebeu uma magia?' }))
    expect(within(screen.getByRole('dialog')).getByText('Bênção · já está em você')).toBeInTheDocument()
  })

  it('a que pede escolha abre o detalhe, com o foco no título; "Outra magia" volta à magia de antes', () => {
    openDraft(cleric)
    const sheet = openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: /^Escudo da Fé/ }))
    expect(within(sheet).getByRole('heading', { name: 'Escudo da Fé' })).toHaveFocus()
    expect(sheet).toHaveTextContent('+2 na CA (Escudo da Fé)')
    expect(within(sheet).getByRole('radio', { name: 'Outra pessoa conjurou em mim' })).toBeChecked()
    expect(sheet).toHaveTextContent('Quem conjurou é quem mantém a concentração')
    expect(playState().activeEffects).toEqual([])
    fireEvent.click(within(sheet).getByRole('button', { name: '← Outra magia' }))
    expect(within(sheet).getByRole('button', { name: /^Escudo da Fé/ })).toHaveFocus()
  })

  it('quem conhece a magia escolhe "Eu conjurei em mim": começa a concentração; recusada, a folha diz por quê e o foco fica', () => {
    openDraft(cleric)
    let sheet = openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: /^Escudo da Fé/ }))
    expect(within(sheet).getByRole('radio', { name: 'Outra pessoa conjurou em mim' })).toBeChecked()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Eu conjurei em mim' }))
    expect(sheet).toHaveTextContent('Começa a sua concentração em Escudo da Fé')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Marcar em mim' }))
    expect(playState().concentration?.label).toBe('Escudo da Fé')
    expect(playState().activeEffects[0].sustainedByConcentration).toBe(true)
    cleanup()
    resetPlay()

    // Atordoado, não se concentra: a recusa fica na folha, por cima do aviso do pé.
    openDraft(cleric)
    usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'stunned'))
    sheet = openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: /^Escudo da Fé/ }))
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Eu conjurei em mim' }))
    const regions = liveRegions()
    const mark = within(sheet).getByRole('button', { name: 'Marcar em mim' })
    mark.focus()
    fireEvent.click(mark)
    const refusal = within(screen.getByRole('dialog')).getByText(/^Não é possível se concentrar/)
    expect(regions.some(r => r.contains(refusal))).toBe(true)
    expect(mark).toHaveFocus()
    expect(playState().activeEffects).toEqual([])
  })

  it('o paladino que conhece o Auxílio Divino o marca no toque, sem a pergunta: é sempre dele', () => {
    openDraft(paladin)
    const sheet = openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: /^Auxílio Divino/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(playState().activeEffects).toEqual([{ id: 'spell:divine-favor', startedAt: expect.any(Number), sustainedByConcentration: true }])
    expect(playState().concentration?.label).toBe('Auxílio Divino')
    expect(within(section()).getByTestId('toggle-spell:divine-favor')).toHaveTextContent('Mantida pela sua concentração')
  })

  it('o toque recusado (Atordoado não se concentra) diz por quê na região viva da lista, e o foco fica na magia', () => {
    openDraft(paladin)
    usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'stunned'))
    const sheet = openSheet()
    const regions = liveRegions()
    const favor = within(sheet).getByRole('button', { name: /^Auxílio Divino/ })
    favor.focus()
    fireEvent.click(favor)
    const refusal = within(screen.getByRole('dialog')).getByText(/^Não é possível se concentrar/)
    expect(regions.some(r => r.contains(refusal))).toBe(true)
    expect(favor).toHaveFocus()
    expect(playState().activeEffects).toEqual([])
    // Buscar outra apaga a recusa.
    fireEvent.change(within(sheet).getByRole('searchbox'), { target: { value: 'auxilio' } })
    expect(within(sheet).queryByText(/^Não é possível se concentrar/)).toBeNull()
  })
})
