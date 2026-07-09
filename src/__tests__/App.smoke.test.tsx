import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from '../App'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { COMPLETE_DRAFT } from '../test/fixtures'

// Teste de fumaça: renderiza o App real e exercita o fluxo galeria <-> wizard.
// Pega erros de renderização (hooks, acessos indefinidos) que build/tsc não pegam.

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
})

describe('App (smoke)', () => {
  it('renderiza o wizard (NameStep) quando a biblioteca está vazia', () => {
    useCharacterStore.getState().newCharacter()
    render(<App />)
    expect(screen.getByText('Criador de Personagem')).toBeInTheDocument()
    // NameStep: título e campo de nome (com placeholder de exemplos)
    expect(screen.getByText(/Como és conhecido/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Thalindra/)).toBeInTheDocument()
  })

  it('mostra a galeria com a ficha salva e abre no wizard ao clicar', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToGallery()

    render(<App />)
    expect(screen.getByText('Meus Personagens')).toBeInTheDocument()
    const nome = screen.getByText('Krusk')
    expect(nome).toBeInTheDocument()

    fireEvent.click(nome)
    expect(useCharacterStore.getState().view).toBe('wizard')
  })

  it('cria um novo personagem a partir da galeria', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToGallery()
    render(<App />)
    fireEvent.click(screen.getByText('＋ Novo personagem'))
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().draft.name).toBe('')
  })

  it('renderiza a Revisão de uma ficha completa sem quebrar', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    expect(useCharacterStore.getState().currentStep).toBe('review')
    render(<App />)
    // "Percep. Passiva" só existe na Revisão (não é rótulo de passo)
    expect(screen.getByText('Percep. Passiva')).toBeInTheDocument()
    expect(screen.getAllByText(/Concluir/).length).toBeGreaterThan(0)
  })

  it('renderiza a ficha imprimível sem quebrar', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToPrint()
    render(<App />)
    expect(screen.getByText('Krusk')).toBeInTheDocument()
    expect(screen.getByText('Testes de Resistência')).toBeInTheDocument()
    expect(screen.getByText('Perícias')).toBeInTheDocument()
    expect(screen.getByText(/Imprimir \/ Salvar PDF/)).toBeInTheDocument()
  })
})
