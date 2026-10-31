import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ComponentType } from 'react'
import App from '../App'
import { useAppStore } from '../core/stores/appStore'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../systems/ordem/stores/characterStore'
import { dnd5eSystem } from '../systems/dnd5e'
import { ordemSystem } from '../systems/ordem'
import { lazyScreen } from '../core/utils/lazyScreen'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'
import { EMPTY_DRAFT as ORDEM_EMPTY } from '@rpg/rules/systems/ordem/types/character'

// O test/setup.ts desce as telas sob demanda antes dos testes, e elas montam no mesmo render. Aqui,
// a tela de um sistema troca, só neste arquivo, por uma que ainda não desceu: o toque antes de o
// pedaço descer, na primeira visita, passa pelos Suspense do App e da tela de impressão.

const real = {
  dndSheet: dnd5eSystem.PrintableSheet,
  ordemSheet: ordemSystem.PrintableSheet,
  ordemComponent: ordemSystem.Component,
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.getState().setActiveSystem(null)
})
afterEach(() => {
  cleanup()
  dnd5eSystem.PrintableSheet = real.dndSheet
  ordemSystem.PrintableSheet = real.ordemSheet
  ordemSystem.Component = real.ordemComponent
})

/** Uma tela sob demanda que só desce quando o teste manda (`arrive`). */
function notYetLoaded(text: string) {
  let arrive = () => {}
  const Screen = () => <p>{text}</p>
  const Lazy = lazyScreen(() => new Promise<ComponentType>(resolve => { arrive = () => resolve(Screen) }))
  return { Lazy, arrive: () => arrive() }
}

const PRINT = '🖨 Imprimir / Salvar PDF'

function openOrdemPrint() {
  useOrdemStore.getState().importDraft({ ...structuredClone(ORDEM_EMPTY), name: 'Bianca' })
  useAppStore.getState().setActiveSystem('ordem')
  useOrdemStore.getState().goToPrint()
}

describe('a ficha imprimível ainda descendo', () => {
  // Antes, o "Imprimir" ficava ativo, e a impressão saía só com o "Carregando…".
  it('no D&D, a barra com o "← Voltar" e o "Carregando…" no lugar da ficha; o "Imprimir" só com ela', async () => {
    const sheet = notYetLoaded('A ficha do D&D')
    dnd5eSystem.PrintableSheet = sheet.Lazy
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().goToPrint()
    render(<App />)

    expect(screen.getByText('← Voltar')).toBeInTheDocument()
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByText(PRINT)).toBeNull()

    sheet.arrive()
    expect(await screen.findByText('A ficha do D&D')).toBeInTheDocument()
    expect(screen.getByText(PRINT)).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).toBeNull()
  })

  it('no Ordem, o mesmo', async () => {
    const sheet = notYetLoaded('A ficha do Ordem')
    ordemSystem.PrintableSheet = sheet.Lazy
    openOrdemPrint()
    render(<App />)

    expect(screen.getByText('← Voltar')).toBeInTheDocument()
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByText(PRINT)).toBeNull()

    sheet.arrive()
    expect(await screen.findByText('A ficha do Ordem')).toBeInTheDocument()
    expect(screen.getByText(PRINT)).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).toBeNull()
  })

  it('o "← Voltar" não espera a ficha', () => {
    ordemSystem.PrintableSheet = notYetLoaded('A ficha do Ordem').Lazy
    openOrdemPrint()
    render(<App />)

    fireEvent.click(screen.getByText('← Voltar'))
    expect(useOrdemStore.getState().view).toBe('wizard')
    expect(screen.queryByText('Carregando…')).toBeNull()
  })
})
