import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { addCondition, startConcentration } from '@rpg/rules/systems/dnd5e/utils/playState'
import type { CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { liveRegions, openDraft, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const playState = () => usePlayStore.getState().state!

/** Krusk (meio-orc bárbaro) no nível dado, com um Machado Grande, um caminho e a raça trocada. */
function krusk(level = 1, patch: Partial<CharacterDraft> = {}, subclass: string | null = null): CharacterDraft {
  const d = structuredClone(COMPLETE_DRAFT)
  d.equipment.purchasedItems = [{ itemId: 'greataxe', quantity: 1, source: 'purchased' }]
  return { ...d, level, ...patch, classChoices: { ...d.classChoices, subclass } }
}

function openStatus(draft: CharacterDraft = krusk()) {
  openDraft(draft)
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
}

const section = () => screen.getByRole('heading', { name: 'Efeitos ativos' }).closest('section')!

describe('ActiveEffectsSection — ligar a Fúria é um toque', () => {
  it('mostra a ação com o momento, o custo e o saldo; quem não tem o que ligar só tem o "Recebeu uma magia?"', () => {
    openStatus()
    expect(within(section()).getByRole('button', { name: 'Entrar em fúria' })).toBeInTheDocument()
    expect(section()).toHaveTextContent('ação bônus · gasta 1 Fúria — restam 2')
    cleanup()
    resetPlay()
    openStatus({ ...krusk(), class: 'fighter' })
    expect(within(section()).queryByRole('button', { name: 'Entrar em fúria' })).toBeNull()
    expect(within(section()).getByRole('button', { name: 'Recebeu uma magia?' })).toBeInTheDocument()
    // As magias do catálogo, desligadas, não ganham cartão.
    expect(within(section()).queryByTestId('toggle-spell:bless')).toBeNull()
  })

  it('ligar mostra o que está fazendo, o chip nos vitais e o dano novo na aba Ataques; o foco vai ao "Encerrar"', () => {
    openStatus()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em fúria' }))
    expect(playState().activeEffects.map(a => a.id)).toEqual(['rage'])
    expect(playState().resourcesSpent).toEqual({ rage: 1 })
    const end = within(section()).getByRole('button', { name: 'Encerrar a fúria' })
    expect(end).toHaveFocus()
    expect(within(section()).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      'Vantagem em testes e testes de resistência de Força (Fúria)',
      '+2 de dano nos ataques com arma corpo a corpo usando Força (Dano de Fúria)',
      'Resistência a concussão, cortante e perfurante (Fúria)',
    ])
    expect(section()).toHaveTextContent('A fúria acaba no fim do seu turno se, desde o seu último turno, você não atacou nenhuma criatura hostil nem sofreu dano (pág. 48).')
    expect(screen.getByTestId('vitals-toggle-rage')).toHaveTextContent('Em fúria')
    // O ganho de usos sai no número, anunciado.
    expect(liveRegions().some(r => r.textContent === 'Ligado: Em fúria. Fúria — resta 1')).toBe(true)

    fireEvent.click(screen.getByRole('tab', { name: 'Ataques' }))
    expect(screen.getByRole('button', { name: /^Machado Grande — dano: 1d12 \+ 5 cortante$/ })).toBeInTheDocument()
  })

  it('encerrar leva o foco ao título da seção, e a aba Ataques volta ao dano de antes', () => {
    openStatus()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em fúria' }))
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar a fúria' }))
    expect(playState().activeEffects).toEqual([])
    expect(screen.getByRole('heading', { name: 'Efeitos ativos' })).toHaveFocus()
    expect(screen.queryByTestId('vitals-toggle-rage')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Ataques' }))
    expect(screen.getByRole('button', { name: /^Machado Grande — dano: 1d12 \+ 3 cortante$/ })).toBeInTheDocument()
  })

  it('recusa sem uso: o aviso diz por quê, nada muda e o foco fica', () => {
    openStatus()
    // Os 2 usos do bárbaro 1, gastos.
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar em fúria' }))
      fireEvent.click(screen.getByRole('button', { name: 'Encerrar a fúria' }))
    }
    const enter = screen.getByRole('button', { name: 'Entrar em fúria' })
    expect(section()).toHaveTextContent('gasta 1 Fúria — restam 0')
    enter.focus()
    fireEvent.click(enter)
    expect(playState().activeEffects).toEqual([])
    expect(screen.getByRole('status')).toHaveTextContent('Entrar em fúria: sem usos de Fúria: eles voltam num descanso longo.')
    expect(enter).toHaveFocus()
  })

  it('a região viva já existe vazia antes de ligar', () => {
    openStatus()
    expect(liveRegions().some(r => r.textContent === '')).toBe(true)
    expect(liveRegions().some(r => r.textContent?.startsWith('Ligado'))).toBe(false)
  })

  it('o Frenesi é a opção ao entrar; ao encerrar, +1 de exaustão, e um desfazer volta tudo junto', () => {
    openStatus(krusk(3, { race: 'tiefling' }, 'berserker'))
    usePlayStore.getState().run((st, sh) => startConcentration(st, sh, { label: 'Escuridão' }, 0))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Frenesi (ao terminar, +1 nível de exaustão)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em fúria' }))
    expect(playState().activeEffects).toEqual([expect.objectContaining({ id: 'rage', option: 'frenzy' })])
    expect(playState().concentration).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('A concentração em Escuridão terminou: entrar em fúria (pág. 48).')
    expect(screen.getByTestId('vitals-toggle-rage')).toHaveTextContent('Em fúria · Frenesi')

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar a fúria' }))
    expect(playState().exhaustionLevel).toBe(1)
    expect(screen.getByRole('status')).toHaveTextContent('Frenesi: ao terminar, você sofre um nível de exaustão (0 → 1, pág. 292).')

    // Desfazer o encerrar volta a fúria e tira a exaustão; desfazer o entrar volta o uso e a concentração.
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(playState().exhaustionLevel).toBe(0)
    expect(playState().activeEffects.map(a => a.id)).toEqual(['rage'])
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(playState().activeEffects).toEqual([])
    expect(playState().resourcesSpent).toEqual({})
    expect(playState().concentration?.label).toBe('Escuridão')
  })

  // A fúria acaba sozinha (o minuto, o turno sem ataque nem dano, pág. 48): isso não é a ação bônus
  // do "Encerrar", que quem não pode agir não tem.
  it('o "Já acabou" desliga sem ação, mesmo Atordoado, com a exaustão do Frenesi; o foco vai ao título', () => {
    openStatus(krusk(3, {}, 'berserker'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Frenesi (ao terminar, +1 nível de exaustão)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em fúria' }))
    usePlayStore.getState().run((st, sh) => addCondition(st, sh, 'stunned'))
    const end = screen.getByRole('button', { name: 'Encerrar a fúria' })
    end.focus()
    fireEvent.click(end)
    expect(playState().activeEffects.map(a => a.id)).toEqual(['rage'])
    expect(screen.getByRole('status')).toHaveTextContent('sem ações nem reações (pág. 292)')
    expect(end).toHaveFocus()

    expect(section()).toHaveTextContent('Já acabousem gastar ação')
    fireEvent.click(within(section()).getByRole('button', { name: 'Já acabou' }))
    expect(playState().activeEffects).toEqual([])
    expect(playState().exhaustionLevel).toBe(1)
    expect(screen.getByRole('status')).toHaveTextContent('Frenesi: ao terminar, você sofre um nível de exaustão (0 → 1, pág. 292).')
    expect(screen.getByRole('heading', { name: 'Efeitos ativos' })).toHaveFocus()
    expect(screen.queryByTestId('vitals-toggle-rage')).toBeNull()
  })

  it('de Placas: liga, gasta o uso e diz que não há benefícios', () => {
    const d = krusk()
    d.equipment.purchasedItems.push({ itemId: 'plate', quantity: 1, source: 'purchased' })
    openStatus(d)
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em fúria' }))
    expect(playState().resourcesSpent).toEqual({ rage: 1 })
    expect(section()).toHaveTextContent('Sem os benefícios: você está de Placas (pág. 48).')
    expect(screen.getByRole('status')).toHaveTextContent('Fúria sem os benefícios: você está de Placas (pág. 48).')
    expect(screen.getByTestId('vitals-toggle-rage')).toHaveTextContent('Em fúria (sem benefícios)')
  })
})

describe('VitalsBar — o chip do efeito ligado', () => {
  it('o toque leva à seção Efeitos ativos da aba Estado, com o foco no título', () => {
    openDraft(krusk())
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em fúria' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Ataques' }))
    fireEvent.click(screen.getByRole('button', { name: 'Em fúria: ver os efeitos ativos' }))
    expect(screen.getByRole('tab', { name: 'Estado' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Efeitos ativos' })).toHaveFocus()
  })
})
