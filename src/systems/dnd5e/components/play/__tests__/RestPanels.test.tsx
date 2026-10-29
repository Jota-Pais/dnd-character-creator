import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { applyDamage, spendResource } from '../../../utils/playState'
import { EMPTY_DRAFT } from '../../../types/character'
import { COMPLETE_DRAFT } from '../../../../../test/fixtures'
import { liveRegions, openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

const store = () => usePlayStore.getState()
const playState = () => store().state!

/** Krusk (14 PV, CON +2, 1d12) com 8 de dano e uma Fúria gasta, na aba Estado. */
function openHurtKrusk() {
  openKrusk()
  store().run((st, sh) => applyDamage(st, sh, { amount: 8 }))
  store().run((st, sh) => spendResource(st, sh, 'rage'))
  render(<PlayScreen />)
  fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
}

function spendDie(value: string) {
  fireEvent.change(screen.getByLabelText('Quanto tirou no d12'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Gastar d12' }))
}

describe('Descanso curto', () => {
  it('gasta o Dado de Vida num rascunho e só grava ao concluir, num passo só do desfazer', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    spendDie('3')
    expect(screen.getByTestId('short-rest-draft')).toHaveTextContent('d12: 3 + 2 = 5.')
    expect(screen.getByTestId('short-rest-draft')).toHaveTextContent('PV: 6 → 11 de 14')
    // Nada gravado ainda.
    expect(playState().hitDiceSpent).toEqual({})
    expect(screen.getByTestId('hp-current')).toHaveTextContent('6')

    const undoBefore = store().undoStack.length
    fireEvent.click(screen.getByRole('button', { name: 'Concluir descanso curto' }))
    expect(playState().hitDiceSpent).toEqual({ 12: 1 })
    expect(screen.getByTestId('hp-current')).toHaveTextContent('11')
    // A Fúria é de descanso longo: continua gasta.
    expect(playState().resourcesSpent).toEqual({ rage: 1 })
    expect(store().undoStack.length).toBe(undoBefore + 1)
    // O aviso traz o resumo, não a conta de cada dado (que o rascunho já mostrou).
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('1 Dado de Vida: +5 PV (6 → 11).')
    expect(toast).not.toHaveTextContent('d12: 3 + 2 = 5.')

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(playState().hitDiceSpent).toEqual({})
    expect(screen.getByTestId('hp-current')).toHaveTextContent('6')
  })

  it('o leitor de tela ouve a conta do dado gasto e o PV parcial do rascunho', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    const regions = liveRegions()
    spendDie('3')
    expect(regions.some(r => r.textContent === 'd12: 3 + 2 = 5. PV: 6 → 11 de 14.')).toBe(true)
  })

  it('face fora do dado apaga o botão e explica o que digitar', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    const regions = liveRegions()
    fireEvent.change(screen.getByLabelText('Quanto tirou no d12'), { target: { value: '14' } })
    expect(screen.getByRole('button', { name: 'Gastar d12' })).toBeDisabled()
    // O aviso sai numa região viva que já existia antes dele.
    expect(regions.some(r => r.contains(screen.getByText(/Digite só o que saiu no d12 \(1 a 12\)/)))).toBe(true)
  })

  it('"desfazer o último dado" e cancelar descartam o rascunho', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    spendDie('12')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer o último dado' }))
    expect(screen.queryByTestId('short-rest-draft')).toBeNull()
    spendDie('4')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(playState().hitDiceSpent).toEqual({})
    expect(screen.getByTestId('hp-current')).toHaveTextContent('6')
  })

  it('o rascunho sobrevive à troca de aba; cancelar e sair do jogo o descartam', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    spendDie('9')
    fireEvent.click(screen.getByRole('tab', { name: 'Testes' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    expect(screen.getByRole('button', { name: 'Descanso curto' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('short-rest-draft')).toHaveTextContent('d12: 9 + 2 = 11.')
    expect(playState().hitDiceSpent).toEqual({})

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(store().shortRestDraft).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    expect(screen.queryByTestId('short-rest-draft')).toBeNull()

    spendDie('5')
    store().close()
    expect(store()).toMatchObject({ restPanel: null, shortRestDraft: [] })
  })

  it('sem Dados de Vida disponíveis, o campo some', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    spendDie('1')
    expect(screen.queryByLabelText('Quanto tirou no d12')).toBeNull()
  })

  it('Recuperação Arcana com uso: o painel lembra o que dá para recuperar; sem uso, some', () => {
    const wizard = structuredClone(COMPLETE_DRAFT)
    wizard.class = 'wizard'
    wizard.level = 4
    openDraft(wizard)
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    expect(screen.getByTestId('slot-recovery')).toHaveTextContent(
      'Recuperação Arcana: neste descanso curto, você pode recuperar espaços de magia gastos que somem até 2 níveis, nenhum de 6º nível ou superior (pág. 97).',
    )
    act(() => { store().run((st, sh) => spendResource(st, sh, 'arcane-recovery')) })
    expect(screen.queryByTestId('slot-recovery')).toBeNull()
  })

  it('a 0 PV não deixa gastar Dados de Vida', () => {
    openKrusk()
    store().run((st, sh) => applyDamage(st, sh, { amount: 14 }))
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    expect(screen.getByText(/A 0 PV não dá para gastar Dados de Vida/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Quanto tirou no d12')).toBeNull()
    // O resto do descanso vale (decisão de 2026-10-25): concluir não é recusado.
    fireEvent.click(screen.getByRole('button', { name: 'Concluir descanso curto' }))
    expect(store().notices.some(n => n.kind === 'refused')).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent('Descanso curto concluído.')
  })
})

describe('Descanso longo', () => {
  it('mostra a prévia e confirma: PV cheio, Fúria e Dado de Vida de volta', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('button', { name: 'Descanso curto' }))
    spendDie('2')
    fireEvent.click(screen.getByRole('button', { name: 'Concluir descanso curto' }))
    expect(playState().hitDiceSpent).toEqual({ 12: 1 })

    fireEvent.click(screen.getByRole('button', { name: 'Descanso longo' }))
    const preview = screen.getByTestId('long-rest-preview')
    expect(preview).toHaveTextContent('PV 10 → 14 (o máximo)')
    expect(preview).toHaveTextContent('1 Dado de Vida')
    expect(preview).toHaveTextContent('Fúria')
    expect(screen.getByText(/Confirme só o descanso que terminou/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descanso longo' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    expect(playState().hitDiceSpent).toEqual({})
    expect(playState().resourcesSpent).toEqual({})
  })

  it('na multiclasse, a escolha dos tipos se ajusta depois de um desfazer', () => {
    // Bruxo 3 / mago 2 (d8 e d6): o descanso longo devolve até 2 Dados de Vida.
    openDraft({
      ...structuredClone(COMPLETE_DRAFT),
      race: 'human',
      class: 'warlock',
      level: 5,
      additionalClasses: [{
        classId: 'wizard', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
      multiclass: true,
    })
    store().run(st => ({ state: { ...st, hitDiceSpent: { 8: 2 } }, notices: [] }))
    store().run(st => ({ state: { ...st, hitDiceSpent: { 8: 2, 6: 1 } }, notices: [] }))
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descanso longo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Um d8 a menos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Um d6 a mais' }))
    expect(screen.getByText(/Dados de Vida que voltam: 2 de até 2/)).toBeInTheDocument()

    // O desfazer devolve o d6 gasto: a escolha do d6 cai, sem recusa no confirmar.
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(screen.getByText(/Dados de Vida que voltam: 1 de até 2/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Um d6 a mais' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descanso longo' }))
    expect(store().notices.some(n => n.kind === 'refused')).toBe(false)
    expect(playState().hitDiceSpent).toEqual({ 8: 1 })
  })

  it('com exaustão, a caixa "comeu e bebeu" vem marcada e tira 1 nível', () => {
    openHurtKrusk()
    fireEvent.click(screen.getByRole('radio', { name: 'Exaustão 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descanso longo' }))
    const box = screen.getByLabelText(/Comeu e bebeu/)
    expect(box).toBeChecked()
    expect(screen.getByText('Exaustão 2 → 1')).toBeInTheDocument()
    fireEvent.click(box)
    expect(screen.getByText('Exaustão 2 → 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descanso longo' }))
    expect(playState().exhaustionLevel).toBe(2)
  })
})
