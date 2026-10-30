import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import App from '../App'
import { handleBack } from '../core/navigation/back'
import { useAppStore } from '../core/stores/appStore'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../systems/ordem/stores/characterStore'
import { openKrusk, resetPlay } from '../systems/dnd5e/components/play/__tests__/openPlay'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'

// O voltar do Android no APK (core/native/nativeApp.ts) chama o `handleBack`: aqui, cada tela real.
const pressBack = () => {
  let handled = false
  act(() => { handled = handleBack() })
  return handled
}

beforeEach(() => {
  resetPlay()
  useCharacterStore.setState({ library: [] })
  useOrdemStore.setState({ library: [] })
  useAppStore.getState().setActiveSystem(null)
})
afterEach(() => cleanup())

describe('o voltar do Android em cada tela', () => {
  it('na galeria não há para onde voltar (o APK minimiza); o menu de sistema aberto fecha antes', () => {
    render(<App />)
    expect(pressBack()).toBe(false)

    fireEvent.click(screen.getByText('＋ Novo personagem'))
    expect(screen.getByText('🐉 D&D 5e')).toBeInTheDocument()
    expect(pressBack()).toBe(true)
    expect(screen.queryByText('🐉 D&D 5e')).toBeNull()
    expect(pressBack()).toBe(false)
  })

  it('na galeria, cancela a exclusão pedida', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToGallery()
    render(<App />)
    fireEvent.click(screen.getByTitle('Excluir'))
    expect(screen.getByText('Excluir?')).toBeInTheDocument()
    expect(pressBack()).toBe(true)
    expect(screen.queryByText('Excluir?')).toBeNull()
    expect(useCharacterStore.getState().library).toHaveLength(1)
    expect(pressBack()).toBe(false)
  })

  it('no criador do D&D, refaz o caminho: as etapas percorridas e, da primeira, a galeria', () => {
    useCharacterStore.getState().newCharacter()
    useAppStore.getState().setActiveSystem('dnd5e')
    render(<App />)
    act(() => useCharacterStore.getState().nextStep())
    act(() => useCharacterStore.getState().nextStep())
    expect(useCharacterStore.getState().currentStep).toBe('class')
    pressBack()
    expect(useCharacterStore.getState().currentStep).toBe('race')
    pressBack()
    expect(useCharacterStore.getState().currentStep).toBe('name')
    pressBack()
    expect(useAppStore.getState().activeSystemId).toBeNull()
    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()
  })

  // Quem abriu a ficha pronta só para olhar volta de onde veio, em vez de percorrer as 9 etapas.
  it('a ficha aberta pela galeria na Revisão volta direto à galeria', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToStep('review')
    useCharacterStore.getState().goToGallery()
    render(<App />)
    fireEvent.click(screen.getByText('Abrir'))
    expect(useCharacterStore.getState().currentStep).toBe('review')
    expect(pressBack()).toBe(true)
    expect(useAppStore.getState().activeSystemId).toBeNull()
    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()
  })

  it('a etapa aberta pelo stepper volta à de onde se veio, e o "← Voltar" do rodapé conta como voltar', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().goToStep('review')
    render(<App />)
    act(() => useCharacterStore.getState().goToStep('abilities'))
    act(() => useCharacterStore.getState().nextStep())
    act(() => useCharacterStore.getState().prevStep())
    expect(useCharacterStore.getState().currentStep).toBe('abilities')
    pressBack()
    expect(useCharacterStore.getState().currentStep).toBe('review')
    pressBack()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })

  it('na impressão, volta à ficha', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().goToPrint()
    render(<App />)
    pressBack()
    expect(useCharacterStore.getState().view).toBe('wizard')
  })

  it('no jogo, a folha aberta fecha primeiro; depois, o jogo volta à galeria', () => {
    openKrusk()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Classe de Armadura \d+: de onde vem$/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    expect(pressBack()).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useCharacterStore.getState().view).toBe('play')

    expect(pressBack()).toBe(true)
    expect(useCharacterStore.getState().view).toBe('gallery')
    expect(useAppStore.getState().activeSystemId).toBeNull()
    expect(pressBack()).toBe(false)
  })

  it('no jogo, o painel de descanso e a engrenagem abertos fecham antes de o jogo sair', () => {
    openKrusk()
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Estado' }))
    const shortRest = screen.getByRole('button', { name: 'Descanso curto' })
    fireEvent.click(shortRest)
    expect(shortRest).toHaveAttribute('aria-expanded', 'true')
    expect(pressBack()).toBe(true)
    expect(shortRest).toHaveAttribute('aria-expanded', 'false')
    expect(shortRest).toHaveFocus()
    expect(useCharacterStore.getState().view).toBe('play')

    const gear = screen.getByRole('button', { name: 'Configurações do modo de jogo' })
    fireEvent.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'true')
    screen.getAllByRole('checkbox')[0]?.focus()
    expect(pressBack()).toBe(true)
    expect(gear).toHaveAttribute('aria-expanded', 'false')
    expect(gear).toHaveFocus()
    expect(useCharacterStore.getState().view).toBe('play')

    expect(pressBack()).toBe(true)
    expect(useCharacterStore.getState().view).toBe('gallery')
  })

  it('no criador do Ordem, refaz o caminho: as etapas percorridas e, da primeira, a galeria', () => {
    useOrdemStore.getState().newCharacter()
    useAppStore.getState().setActiveSystem('ordem')
    render(<App />)
    act(() => useOrdemStore.getState().nextStep())
    act(() => useOrdemStore.getState().nextStep())
    expect(useOrdemStore.getState().currentStep).toBe('origin')
    pressBack()
    expect(useOrdemStore.getState().currentStep).toBe('attributes')
    pressBack()
    expect(useOrdemStore.getState().currentStep).toBe('name')
    pressBack()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })
})
