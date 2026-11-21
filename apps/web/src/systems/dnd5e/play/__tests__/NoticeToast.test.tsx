import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { PlayScreen } from '../PlayScreen'
import { useCharacterStore } from '../../stores/characterStore'
import { usePlayStore } from '../../stores/playStore'
import type { SheetSnapshot } from '@rpg/rules/systems/dnd5e/types/playState'
import { loadPlayState, savePlayState } from '../../storage/playStorage'
import { createPlayState, grantTempHp, performAction, setExhaustion, stabilize, startConcentration } from '@rpg/rules/systems/dnd5e/utils/playState'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { openDraft, openKrusk, resetPlay } from './openPlay'

beforeEach(resetPlay)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function damage(value: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Dano' }))
  fireEvent.change(screen.getByLabelText('Quanto de dano'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
}

describe('desfazer e avisos', () => {
  it('aplicar dano atualiza o PV e o desfazer do cabeçalho volta', () => {
    openKrusk()
    render(<PlayScreen />)
    const undo = screen.getByRole('button', { name: 'Desfazer a última mudança' })
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    damage('5')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('9')
    expect(undo).toHaveAttribute('aria-disabled', 'false')
    // O desfazer que esvazia a pilha apaga o botão, e o foco fica nele.
    undo.focus()
    fireEvent.click(undo)
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
    expect(undo).not.toBeDisabled()
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    expect(undo).toHaveFocus()
    // Apagado, não faz nada.
    fireEvent.click(undo)
    expect(screen.getByTestId('hp-current')).toHaveTextContent('14')
  })

  it('os avisos da ação aparecem com "Desfazer", que volta o estado', () => {
    openKrusk()
    usePlayStore.getState().run(st => grantTempHp(st, 3))
    render(<PlayScreen />)
    damage('5')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Os PV temporários absorveram 3.')
    expect(screen.getByTestId('hp-current')).toHaveTextContent('12')
    fireEvent.click(within(toast).getByRole('button', { name: '↶ Desfazer' }))
    expect(usePlayStore.getState().state).toMatchObject({ tempHp: 3, damageTaken: 0 })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('o aviso sai numa região viva que já existia, vazia, antes dele', () => {
    openKrusk()
    usePlayStore.getState().run(st => grantTempHp(st, 3))
    render(<PlayScreen />)
    const live = screen.getByRole('status')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toBeEmptyDOMElement()
    damage('5')
    expect(live).toHaveTextContent('Os PV temporários absorveram 3.')
  })

  it('o aviso da abertura do jogo também espera a região viva existir vazia', async () => {
    const id = openKrusk()
    useCharacterStore.getState().exitPlay()
    // O dano salvo passou do máximo da ficha: a abertura reconcilia e avisa.
    savePlayState({ ...createPlayState(id), damageTaken: 20 })
    useCharacterStore.getState().playCharacter(id)
    render(<PlayScreen />)
    const live = screen.getByRole('status')
    expect(live).toBeEmptyDOMElement()
    await waitFor(() => expect(live).toHaveTextContent('A ficha mudou'))
  })

  it('recusa aparece em destaque e sem "Desfazer" (não mudou nada)', () => {
    openKrusk()
    render(<PlayScreen />)
    damage('2')
    act(() => { usePlayStore.getState().run(st => stabilize(st)) })
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Não foi feito: Só quem está morrendo pode ser estabilizado.')
    expect(within(toast).queryByRole('button', { name: '↶ Desfazer' })).toBeNull()
    fireEvent.click(within(toast).getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('meio-orc cai a 0 PV: "Usar Resistência Implacável" desfaz e reaplica o dano terminando em 1 PV', () => {
    openKrusk()
    render(<PlayScreen />)
    damage('20')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Resistência Implacável: em vez de cair a 0 PV, você pode ficar com 1 PV')
    expect(usePlayStore.getState().state?.lifeState).toBe('dying')
    fireEvent.click(within(toast).getByRole('button', { name: 'Usar Resistência Implacável (fica com 1 PV)' }))
    const st = usePlayStore.getState().state!
    expect(st.lifeState).toBe('conscious')
    expect(st.conditions).not.toContain('prone')
    expect(st.resourcesSpent['relentless-endurance']).toBe(1)
    expect(screen.getByTestId('hp-current')).toHaveTextContent('1')
    // Gasto o uso, a próxima queda não oferece de novo.
    damage('5')
    expect(usePlayStore.getState().state?.lifeState).toBe('dying')
    expect(screen.queryByRole('button', { name: /Usar Resistência Implacável/ })).toBeNull()
  })

  // Fúria Implacável (pág. 49): quem passa no TR não caiu, então a fúria continua.
  it('bárbaro 11 cai a 0 PV em fúria: a CD, o que rolar e o "Passei", que volta a 1 PV ainda em fúria', () => {
    openDraft({ ...structuredClone(COMPLETE_DRAFT), level: 11 })
    usePlayStore.getState().run((st, sh) => performAction(st, sh, 'rage-enter', { now: 1 }))
    render(<PlayScreen />)
    damage(screen.getByTestId('hp-current').textContent ?? '')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Fúria Implacável: você caiu a 0 PV em fúria. Faça um teste de resistência de Constituição CD 10')
    // CON 14 (+2) e a proficiência do bárbaro 11 (+4) no TR de Constituição.
    expect(toast).toHaveTextContent('Role 1d20 + 6: precisa de 10 ou mais.')
    fireEvent.click(within(toast).getByRole('button', { name: 'Ver o que rolar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Fúria Implacável — TR de Constituição')
    expect(screen.getByRole('dialog')).toHaveTextContent('CD 10')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    const pass = within(screen.getByRole('status')).getByRole('button', { name: 'Passei: fico com 1 PV' })
    pass.focus()
    fireEvent.click(pass)
    const st = usePlayStore.getState().state!
    expect(st.lifeState).toBe('conscious')
    expect(st.activeEffects.map(a => a.id)).toEqual(['rage'])
    expect(st.restCounters).toEqual({ 'relentless-rage': 1 })
    expect(screen.getByTestId('hp-current')).toHaveTextContent('1')
    // O botão some com a ação: o foco vai ao "Desfazer" do aviso novo, que desfaz tudo de uma vez.
    expect(within(screen.getByRole('status')).getByRole('button', { name: '↶ Desfazer' })).toHaveFocus()
    // A próxima queda pede CD 15.
    damage('1')
    expect(screen.getByRole('status')).toHaveTextContent('Constituição CD 15')
  })

  // A falha também é uso (decisão de 2026-10-30): o "Falhei" soma o uso sem mudar o PV, no mesmo
  // passo do desfazer do dano.
  it('o "Falhei" da Fúria Implacável conta o uso, fica a 0 PV e mantém a Resistência Implacável; o "Desfazer" volta tudo', () => {
    openDraft({ ...structuredClone(COMPLETE_DRAFT), level: 11 })
    usePlayStore.getState().run((st, sh) => performAction(st, sh, 'rage-enter', { now: 1 }))
    render(<PlayScreen />)
    const undoDepth = usePlayStore.getState().undoStack.length
    damage(screen.getByTestId('hp-current').textContent ?? '')
    const fail = within(screen.getByRole('status')).getByRole('button', { name: 'Falhei' })
    fail.focus()
    fireEvent.click(fail)
    const st = usePlayStore.getState().state!
    expect(st.lifeState).toBe('dying')
    expect(st.activeEffects).toEqual([])
    expect(st.restCounters).toEqual({ 'relentless-rage': 1 })
    expect(screen.getByTestId('hp-current')).toHaveTextContent('0')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('A falha também conta como uso: a próxima CD é 15 (pág. 49).')
    // O teste não volta; a Resistência Implacável, sim. O botão sumiu: o foco vai ao "Desfazer".
    expect(within(toast).queryByRole('button', { name: 'Falhei' })).toBeNull()
    expect(within(toast).getByRole('button', { name: /Usar Resistência Implacável/ })).toBeInTheDocument()
    expect(within(toast).getByRole('button', { name: '↶ Desfazer' })).toHaveFocus()
    // Um passo só: o dano e a falha saem juntos.
    expect(usePlayStore.getState().undoStack).toHaveLength(undoDepth + 1)
    fireEvent.click(within(toast).getByRole('button', { name: '↶ Desfazer' }))
    expect(usePlayStore.getState().state).toMatchObject({ lifeState: 'conscious', restCounters: {}, damageTaken: 0 })
    expect(usePlayStore.getState().state!.activeEffects.map(a => a.id)).toEqual(['rage'])
  })

  // Quem passa não caiu: o teste é feito ainda em fúria, antes da exaustão que o Frenesi dá na queda.
  it('Furioso 11 com exaustão 2 cai em Frenesi: a receita do TR sai de antes da queda, sem a desvantagem da exaustão 3', () => {
    const berserker = { ...structuredClone(COMPLETE_DRAFT), level: 11, race: 'human', classChoices: { ...COMPLETE_DRAFT.classChoices, subclass: 'berserker' } }
    openDraft(berserker)
    usePlayStore.getState().run((st, sh) => setExhaustion(st, sh, 2))
    usePlayStore.getState().run((st, sh) => performAction(st, sh, 'rage-enter', { option: 'frenzy', now: 1 }))
    render(<PlayScreen />)
    damage(screen.getByTestId('hp-current').textContent ?? '')
    // A queda encerrou a fúria, e o Frenesi subiu a exaustão.
    expect(usePlayStore.getState().state!.exhaustionLevel).toBe(3)
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Role 1d20 + 6: precisa de 10 ou mais.')
    expect(toast).not.toHaveTextContent('desvantagem')
    fireEvent.click(within(toast).getByRole('button', { name: 'Ver o que rolar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Fúria Implacável — TR de Constituição')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Exaustão 3')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    // Quem passa fica com 1 PV, em fúria e na exaustão 2: a mesma de onde a receita saiu.
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Passei: fico com 1 PV' }))
    expect(usePlayStore.getState().state).toMatchObject({ exhaustionLevel: 2, lifeState: 'conscious' })
  })

  it('dano com concentração mostra a CD e o que rolar, e "Falhei: encerrar" encerra', () => {
    openKrusk()
    usePlayStore.getState().run((st, sh) => startConcentration(st, sh, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    expect(screen.getByText(/Concentrado: Bênção/)).toBeInTheDocument()
    damage('10')
    const toast = screen.getByRole('status')
    // Bárbaro tem proficiência em TR de CON: +2 (CON 14) +2 (proficiência).
    expect(toast).toHaveTextContent('CD 10')
    expect(toast).toHaveTextContent('Role 1d20 + 4: precisa de 10 ou mais.')
    fireEvent.click(within(toast).getByRole('button', { name: 'Ver o que rolar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('CD 10')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Falhei: encerrar' }))
    expect(usePlayStore.getState().state?.concentration).toBeNull()
  })

  it('rolar o TR de concentração pelo app não apaga o aviso nem o "Desfazer" do dano', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    usePlayStore.getState().run((st, sh) => startConcentration(st, sh, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    damage('10')
    const undoBefore = usePlayStore.getState().undoStack.length
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Ver o que rolar' }))
    forceD20(15)
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Passou (CD 10).')
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Falhei: encerrar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('CD 10')
    expect(within(toast).getByRole('button', { name: 'Falhei: encerrar' })).toBeInTheDocument()
    expect(usePlayStore.getState().state?.rolls).toHaveLength(1)
    expect(usePlayStore.getState().undoStack).toHaveLength(undoBefore)
    // O "Desfazer" do aviso ainda desfaz o dano, e o histórico fica.
    fireEvent.click(within(toast).getByRole('button', { name: '↶ Desfazer' }))
    expect(usePlayStore.getState().state?.damageTaken).toBe(0)
    expect(usePlayStore.getState().state?.rolls).toHaveLength(1)
  })

  it('TR de concentração rolado abaixo da CD oferece "Falhei: encerrar" na própria folha', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    usePlayStore.getState().run((st, sh) => startConcentration(st, sh, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    damage('10')
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Ver o que rolar' }))
    forceD20(2)
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Não passou (CD 10).')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Falhei: encerrar' }))
    expect(usePlayStore.getState().state?.concentration).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('A concentração em Bênção terminou')
  })

  it('curado a 0 PV e ainda Caído: o aviso traz o "Levantar"', () => {
    openKrusk()
    render(<PlayScreen />)
    damage('14')
    // Sem usar a Resistência Implacável: fica a 0 PV e Caído.
    expect(usePlayStore.getState().state?.conditions).toContain('prone')
    fireEvent.click(screen.getByRole('button', { name: 'Cura' }))
    fireEvent.change(screen.getByLabelText('Quanto de cura'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Continua Caído até se levantar.')
    fireEvent.click(within(toast).getByRole('button', { name: 'Levantar' }))
    expect(usePlayStore.getState().state?.conditions).not.toContain('prone')
    expect(screen.getByRole('status')).toHaveTextContent('Levantar-se custa metade do deslocamento')
  })

  it('muitos avisos rolam dentro do cartão, sem passar da metade da tela', () => {
    openKrusk()
    render(<PlayScreen />)
    damage('20')
    const list = screen.getByRole('status').querySelector('ul')
    expect(list).toHaveClass('max-h-[min(50vh,calc(100vh_-_24rem))]', 'overflow-y-auto')
    // O aviso que pede escolha (Resistência Implacável) vem primeiro, fora da parte que rola.
    expect(list?.querySelector('li')).toHaveTextContent('Resistência Implacável')
  })

  // Conferido no Edge: a 360 x 780, com as duas ofertas, o "Passei" ia de 690 a 735 e a lista
  // terminava em 694. Presa ao pé da lista, a escolha fica à vista. Presa, ela não sobe acima do topo
  // do próprio aviso: a 360 x 640 sobram 55 px para a da Fúria Implacável, e com a receita e o "Ver o
  // que rolar" dentro (128 px) o "Passei" e o "Falhei" ficavam escondidos também a 375 x 667. A barra
  // dela é só o par, numa linha (51 px).
  it('meio-orc bárbaro 11 cai em fúria: a escolha das duas ofertas fica presa ao pé da lista; a da Fúria Implacável é só o par de botões, numa linha', () => {
    openDraft({ ...structuredClone(COMPLETE_DRAFT), level: 11 })
    usePlayStore.getState().run((st, sh) => performAction(st, sh, 'rage-enter', { now: 1 }))
    render(<PlayScreen />)
    damage(screen.getByTestId('hp-current').textContent ?? '')
    const toast = screen.getByRole('status')
    const bar = (name: string | RegExp) => within(toast).getByRole('button', { name }).closest<HTMLElement>('.sticky.bottom-0')
    for (const name of [/Usar Resistência Implacável/, 'Passei: fico com 1 PV', 'Falhei']) {
      expect(bar(name)?.parentElement?.tagName, String(name)).toBe('LI')
    }
    // A receita e o "Ver o que rolar" ficam antes da barra, no mesmo aviso, fora dela.
    const pair = bar('Passei: fico com 1 PV')!
    expect(bar('Falhei')).toBe(pair)
    expect(bar('Ver o que rolar')).toBeNull()
    expect(pair).not.toHaveTextContent('Role 1d20')
    expect(pair.parentElement).toHaveTextContent('Role 1d20 + 6: precisa de 10 ou mais.')
    expect(within(pair).getAllByRole('button')).toHaveLength(2)
    // O par não desce para a linha de baixo.
    const row = within(toast).getByRole('button', { name: 'Passei: fico com 1 PV' }).parentElement
    expect(row).toHaveClass('flex')
    expect(row).not.toHaveClass('flex-wrap')
  })
})

// O botão do aviso some com a própria ação: o foco vai ao "Desfazer" do aviso que ficou ou, com o
// aviso fechado, à aba aberta — nunca ao body.
describe('foco nos botões do aviso', () => {
  it('"Falhei: encerrar" passa o foco ao "Desfazer" do aviso, que fecha o aviso e o passa à aba aberta', () => {
    openKrusk()
    usePlayStore.getState().run((st, sh) => startConcentration(st, sh, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    damage('3')
    const end = within(screen.getByRole('status')).getByRole('button', { name: 'Falhei: encerrar' })
    end.focus()
    fireEvent.click(end)
    expect(usePlayStore.getState().state?.concentration).toBeNull()
    const undo = within(screen.getByRole('status')).getByRole('button', { name: '↶ Desfazer' })
    expect(undo).toHaveFocus()

    fireEvent.click(undo)
    expect(usePlayStore.getState().state?.concentration?.label).toBe('Bênção')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('tab', { name: 'Estado' })).toHaveFocus()
  })

  it('"Falhei: encerrar" da folha leva o "Ver o que rolar" que a abriu: o foco vai ao "Desfazer" do aviso novo', () => {
    openKrusk()
    usePlayStore.getState().setAppDice(true)
    usePlayStore.getState().run((st, sh) => startConcentration(st, sh, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    damage('10')
    const opener = within(screen.getByRole('status')).getByRole('button', { name: 'Ver o que rolar' })
    opener.focus()
    fireEvent.click(opener)
    forceD20(2)
    fireEvent.click(screen.getByRole('button', { name: 'Rolar' }))
    const end = within(screen.getByRole('dialog')).getByRole('button', { name: 'Falhei: encerrar' })
    end.focus()
    fireEvent.click(end)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).not.toBeInTheDocument()
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('A concentração em Bênção terminou')
    expect(within(toast).getByRole('button', { name: '↶ Desfazer' })).toHaveFocus()
  })

  it('a folha fechada sem quem a abriu e sem aviso passa o foco à aba aberta', () => {
    openKrusk()
    usePlayStore.getState().run((st, sh) => startConcentration(st, sh, { label: 'Bênção' }, 0))
    render(<PlayScreen />)
    damage('3')
    const opener = within(screen.getByRole('status')).getByRole('button', { name: 'Ver o que rolar' })
    opener.focus()
    fireEvent.click(opener)
    // O aviso sai por fora com a folha aberta (o "OK" dele, atrás do fundo escuro).
    act(() => usePlayStore.getState().dismissNotices())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))
    expect(screen.getByRole('tab', { name: 'Testes' })).toHaveFocus()
  })

  it('"Levantar" passa o foco ao "Desfazer"; o "OK" fecha o aviso e o passa à aba aberta', () => {
    openKrusk()
    render(<PlayScreen />)
    damage('14')
    fireEvent.click(screen.getByRole('button', { name: 'Cura' }))
    fireEvent.change(screen.getByLabelText('Quanto de cura'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Levantar' }))
    expect(within(screen.getByRole('status')).getByRole('button', { name: '↶ Desfazer' })).toHaveFocus()

    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('tab', { name: 'Testes' })).toHaveFocus()
  })
})

describe('aviso de correção da ficha (decisão 10.2.23)', () => {
  /** Joga a ficha, sai e volta com o retrato da última sessão alterado por `patch`. */
  function reopenWithSnapshot(id: string, patch: Partial<SheetSnapshot>) {
    useCharacterStore.getState().exitPlay()
    const stored = loadPlayState(id)!
    savePlayState({ ...stored, sheetSnapshot: { ...stored.sheetSnapshot!, ...patch } })
    useCharacterStore.getState().playCharacter(id)
  }

  it('a correção do app aparece ao abrir o jogo, numa região viva que já existia vazia, e uma vez só', async () => {
    const id = openKrusk()
    reopenWithSnapshot(id, { maxHp: 12 })
    render(<PlayScreen />)
    const live = screen.getByRole('status')
    expect(live).toBeEmptyDOMElement()
    await waitFor(() => expect(live).toHaveTextContent('O app corrigiu sua ficha: PV máximo 12 → 14.'))
    // Não há o que desfazer: só o "OK".
    expect(within(live).queryByRole('button', { name: '↶ Desfazer' })).toBeNull()
    fireEvent.click(within(live).getByRole('button', { name: 'OK' }))
    expect(live).toBeEmptyDOMElement()

    cleanup()
    useCharacterStore.getState().exitPlay()
    useCharacterStore.getState().playCharacter(id)
    expect(usePlayStore.getState().notices).toEqual([])
    expect(usePlayStore.getState().sheetCorrection).toBeNull()
  })

  it('a correção do app fica na tela depois da primeira ação, e o "Desfazer" é só da ação', async () => {
    const id = openKrusk()
    reopenWithSnapshot(id, { maxHp: 12 })
    render(<PlayScreen />)
    const live = screen.getByRole('status')
    await waitFor(() => expect(live).toHaveTextContent('O app corrigiu sua ficha: PV máximo 12 → 14.'))
    fireEvent.click(screen.getByRole('button', { name: /Sem inspiração/ }))
    expect(live).toHaveTextContent('O app corrigiu sua ficha: PV máximo 12 → 14.')
    expect(within(live).queryByRole('button', { name: '↶ Desfazer' })).toBeNull()
    // Com o aviso da ação, o "Desfazer" volta, e desfazer a ação deixa a correção.
    usePlayStore.getState().run(st => grantTempHp(st, 3))
    damage('5')
    expect(live).toHaveTextContent('Os PV temporários absorveram 3.')
    fireEvent.click(within(live).getByRole('button', { name: '↶ Desfazer' }))
    expect(live).toHaveTextContent('O app corrigiu sua ficha: PV máximo 12 → 14.')
    expect(live).not.toHaveTextContent('Os PV temporários absorveram 3.')
    fireEvent.click(within(live).getByRole('button', { name: 'OK' }))
    expect(live).toBeEmptyDOMElement()
  })

  it('a ficha mudada no criador desde a última sessão não avisa', () => {
    const id = openKrusk()
    reopenWithSnapshot(id, { maxHp: 12, sheetUpdatedAt: 0, draftFingerprint: 'antes' })
    expect(usePlayStore.getState().notices).toEqual([])
  })
})

/** Faz o próximo d20 dos dados do app (Web Crypto) sair com a face dada. */
function forceD20(face: number) {
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
    (array as unknown as Uint32Array)[0] = Math.floor(((face - 0.5) / 20) * 2 ** 32)
    return array
  })
}
