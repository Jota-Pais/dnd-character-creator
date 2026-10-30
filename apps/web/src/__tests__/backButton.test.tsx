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

  it('no criador do D&D, volta uma etapa e, da primeira, à galeria', () => {
    useCharacterStore.getState().newCharacter()
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().goToStep('class')
    render(<App />)
    pressBack()
    expect(useCharacterStore.getState().currentStep).toBe('race')
    pressBack()
    expect(useCharacterStore.getState().currentStep).toBe('name')
    pressBack()
    expect(useAppStore.getState().activeSystemId).toBeNull()
    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()
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

  it('no criador do Ordem, volta uma etapa e, da primeira, à galeria', () => {
    useOrdemStore.getState().newCharacter()
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.getState().goToStep('origin')
    render(<App />)
    pressBack()
    expect(useOrdemStore.getState().currentStep).toBe('attributes')
    pressBack()
    expect(useOrdemStore.getState().currentStep).toBe('name')
    pressBack()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })
})
