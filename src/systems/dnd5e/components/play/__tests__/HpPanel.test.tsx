import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { usePlayStore } from '../../../stores/playStore'
import { addCondition } from '../../../utils/playState'
import { openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => cleanup())

function act(label: 'Dano' | 'Cura' | 'PV temporários', field: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: label }))
  fireEvent.change(screen.getByLabelText(field), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
}

describe('HpPanel', () => {
  it('dano digitado baixa o PV e limpa o campo e o botão', () => {
    openKrusk()
    render(<PlayScreen />)
    act('Dano', 'Quanto de dano', '5')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('9')
    expect(screen.queryByLabelText('Quanto de dano')).toBeNull()
    expect(screen.getByLabelText(/^Dano ou cura/)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Dano' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('"−7" e "+5" sem escolher o botão: o sinal manda', () => {
    openKrusk()
    render(<PlayScreen />)
    const field = () => screen.getByLabelText(/^(Dano ou cura|Quanto de)/)
    fireEvent.change(field(), { target: { value: '-7' } })
    expect(screen.getByRole('button', { name: 'Dano' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('7')

    fireEvent.change(field(), { target: { value: '+5' } })
    expect(screen.getByRole('button', { name: 'Cura' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('12')

    // O menos tipográfico também vale, e Enter aplica.
    fireEvent.change(field(), { target: { value: '−2' } })
    fireEvent.submit(field())
    expect(screen.getByTestId('hp-current')).toHaveTextContent('10')
  })

  it('o sinal vence o botão escolhido; sem sinal, vale o botão', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('8')

    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '+3' } })
    expect(screen.getByLabelText('Quanto de cura')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('11')
  })

  it('número sem sinal e sem botão não aplica; o botão tocado depois fica com o número', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.change(screen.getByLabelText(/^Dano ou cura/), { target: { value: '4' } })
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
    expect(screen.getByText(/Escolha Dano ou Cura, ou digite com o sinal/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    expect(screen.getByLabelText('Quanto de dano')).toHaveValue('4')
    expect(screen.getByLabelText('Quanto de dano')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('10')
  })

  it('tocar no botão tira o sinal digitado: o número segue o botão', () => {
    openKrusk()
    render(<PlayScreen />)
    act('Dano', 'Quanto de dano', '9')
    fireEvent.change(screen.getByLabelText(/^Dano ou cura/), { target: { value: '-4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cura' }))
    expect(screen.getByLabelText('Quanto de cura')).toHaveValue('4')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('9')
  })

  it('texto que não é número apaga o "Aplicar" e diz o que digitar', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '2,5' } })
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
    expect(screen.getByText('Digite só o número, com − na frente para dano ou + para cura.')).toBeInTheDocument()
  })

  it('resistência marca a metade (para baixo)', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '7' } })
    fireEvent.click(screen.getByLabelText(/resistência/))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('11')
  })

  it('cura não passa do máximo', () => {
    openKrusk()
    render(<PlayScreen />)
    act('Dano', 'Quanto de dano', '6')
    act('Cura', 'Quanto de cura', '20')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
  })

  it('PV temporários: com reserva, pergunta com quais ficar', () => {
    openKrusk()
    render(<PlayScreen />)
    act('PV temporários', 'Quantos PV temporários', '3')
    expect(usePlayStore.getState().state?.tempHp).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'PV temporários' }))
    fireEvent.change(screen.getByLabelText('Quantos PV temporários'), { target: { value: '8' } })
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ficar com 8 (maior)' }))
    expect(usePlayStore.getState().state?.tempHp).toBe(8)
  })

  it('"foi crítico" só aparece a 0 PV', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    expect(screen.queryByLabelText(/acerto crítico/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(usePlayStore.getState().state?.lifeState).toBe('dying')
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText(/acerto crítico/))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(usePlayStore.getState().state?.deathSaves.failures).toBe(2)
  })

  it('nocaute: a caixa só com o personagem consciente, e o golpe que leva a 0 PV deixa estável', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '14' } })
    fireEvent.click(screen.getByLabelText('Fui nocauteado (o atacante escolheu, corpo a corpo, pág. 200)'))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(usePlayStore.getState().state?.lifeState).toBe('stable')
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    expect(screen.queryByLabelText(/Fui nocauteado/)).toBeNull()
  })

  it('nocaute com dano massivo: a morte instantânea vem antes (decisão de 2026-10-25)', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '28' } })
    fireEvent.click(screen.getByLabelText(/Fui nocauteado/))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(usePlayStore.getState().state?.lifeState).toBe('dead')
  })

  it('Petrificado: a caixa do dano de veneno só aparece com ele, e o veneno marcado não tira PV', () => {
    openKrusk()
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    expect(screen.queryByLabelText(/dano de veneno/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    usePlayStore.getState().run(st => addCondition(st, 'petrified'))
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
    fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value: '9' } })
    fireEvent.click(screen.getByLabelText(/É dano de veneno \(Petrificado/))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    // Sem marcar: a resistência do Petrificado, metade.
    act('Dano', 'Quanto de dano', '9')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('10')
  })

  it('± PV máximo: Ajuda +5 sobe o máximo e o atual, "encerrar" volta, e o desfazer devolve', () => {
    openKrusk()
    render(<PlayScreen />)
    // Discreto: o campo só aparece depois do toque.
    expect(screen.queryByLabelText('Quanto muda o PV máximo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '± PV máximo' }))
    fireEvent.change(screen.getByLabelText('Quanto muda o PV máximo'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Aumentar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('19')
    expect(screen.getByTestId('vitals-hp')).toHaveTextContent('/ 19')
    expect(screen.getByText('(máx. +5)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Quanto muda o PV máximo')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'encerrar' }))
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    expect(usePlayStore.getState().state!.maxHpAdjustment).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a última mudança' }))
    expect(usePlayStore.getState().state!.maxHpAdjustment).toBe(5)
    expect(screen.getByTestId('hp-current')).toHaveTextContent('19')
  })
})