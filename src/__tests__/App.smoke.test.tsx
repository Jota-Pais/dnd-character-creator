import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from '../App'
import { useAppStore } from '../core/stores/appStore'
import { useCharacterStore } from '../systems/dnd5e/stores/characterStore'
import { useOrdemStore } from '../systems/ordem/stores/characterStore'
import { EMPTY_DRAFT as ORDEM_EMPTY } from '../systems/ordem/types/character'
import { RITUALS } from '../systems/ordem/utils/ritualUtils'
import { COMPLETE_DRAFT } from '../test/fixtures'

// Teste de fumaça: renderiza o App real e exercita galeria global <-> wizard <-> revisão <-> impressão.
// Pega erros de renderização (hooks, acessos indefinidos) que build/tsc não pegam.

beforeEach(() => {
  localStorage.clear()
  useAppStore.getState().setActiveSystem(null) // volta pra galeria global entre testes
})
afterEach(() => {
  cleanup()
})

describe('App (smoke) — galeria global', () => {
  it('abre no multiverso (galeria global) por padrão', () => {
    render(<App />)
    expect(screen.getByText('Multiverso de Agentes e Aventureiros')).toBeInTheDocument()
    expect(screen.getByText('Meus Personagens')).toBeInTheDocument()
  })

  it('lista uma ficha D&D salva e a abre no sistema certo ao clicar', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))

    render(<App />)
    const nome = screen.getByText('Krusk')
    expect(nome).toBeInTheDocument()

    fireEvent.click(nome)
    expect(useAppStore.getState().activeSystemId).toBe('dnd5e')
    expect(useCharacterStore.getState().view).toBe('wizard')
  })

  it('cria um novo personagem D&D pelo seletor de sistema', () => {
    render(<App />)
    fireEvent.click(screen.getByText('＋ Novo personagem')) // abre o seletor
    fireEvent.click(screen.getByText('🎲 D&D 5e'))
    expect(useAppStore.getState().activeSystemId).toBe('dnd5e')
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().draft.name).toBe('')
  })
})

describe('App (smoke) — D&D 5e', () => {
  it('renderiza o wizard (NameStep) de um personagem novo', () => {
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().newCharacter()
    render(<App />)
    expect(screen.getByText('Criador de Personagem')).toBeInTheDocument()
    expect(screen.getByText(/Como és conhecido/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Thalindra/)).toBeInTheDocument()
  })

  it('renderiza a Revisão de uma ficha completa sem quebrar', () => {
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    expect(useCharacterStore.getState().currentStep).toBe('review')
    render(<App />)
    expect(screen.getByText('Percep. Passiva')).toBeInTheDocument()
    expect(screen.getAllByText(/Concluir/).length).toBeGreaterThan(0)
  })

  it('renderiza a ficha imprimível sem quebrar', () => {
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToPrint()
    render(<App />)
    expect(screen.getByText('Krusk')).toBeInTheDocument()
    expect(screen.getByText('Testes de Resistência')).toBeInTheDocument()
    expect(screen.getByText(/Imprimir \/ Salvar PDF/)).toBeInTheDocument()
  })
})

describe('App (smoke) — Ordem Paranormal', () => {
  // Agente ocultista com rituais e equipamento, para exercitar as seções da Fase 13-15.
  function seedOrdemAgent() {
    return {
      ...ORDEM_EMPTY,
      name: 'Bianca',
      concept: 'Ocultista curiosa',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
      origin: 'academic',
      class: 'occultist' as const,
      nex: 5,
      ritualChoices: [RITUALS[0].id, RITUALS[1].id, RITUALS[2].id],
      // RITUALS[2] = amaldicoar-arma (multi-elemento): exige escolha de elemento (F9).
      ritualElementChoices: { [RITUALS[2].id]: 'blood' as const },
      equipmentChoices: ['faca'],
    }
  }

  it('renderiza a Revisão do agente com rituais e equipamento sem quebrar', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedOrdemAgent(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0) // cabeçalho + título da revisão
    expect(screen.getByText('Defesa')).toBeInTheDocument() // Defesa = 10 + Agilidade (+ proteção)
    expect(screen.getByText(/Rituais Conhecidos/)).toBeInTheDocument()
    expect(screen.getByText(RITUALS[0].name)).toBeInTheDocument()
    // Amaldiçoar Arma exibe só o elemento escolhido (Sangue), não os 4 (F9)
    expect(screen.getByText(/\(Sangue, 1º Círculo\)/)).toBeInTheDocument()
    expect(screen.getByText(/Equipamento \(/)).toBeInTheDocument()
  })

  it('renderiza a ficha imprimível do agente sem quebrar', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedOrdemAgent(), view: 'print' })
    render(<App />)
    expect(screen.getByText('Bianca')).toBeInTheDocument()
    expect(screen.getByText('Rituais Conhecidos')).toBeInTheDocument()
    expect(screen.getByText('Faca')).toBeInTheDocument()
    expect(screen.getByText(/Imprimir \/ Salvar PDF/)).toBeInTheDocument()
  })
})
