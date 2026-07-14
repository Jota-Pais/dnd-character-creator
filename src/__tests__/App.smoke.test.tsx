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
    expect(screen.getByText('MEUS PERSONAGENS')).toBeInTheDocument()
  })

  it('lista uma ficha D&D salva e a abre no sistema certo ao clicar', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))

    render(<App />)
    expect(screen.getByText('Krusk')).toBeInTheDocument()
    expect(screen.getByText('DUNGEONS & DRAGONS 5E')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Abrir'))
    expect(useAppStore.getState().activeSystemId).toBe('dnd5e')
    expect(useCharacterStore.getState().view).toBe('wizard')
  })

  it('cria um novo personagem D&D pelo seletor de sistema', () => {
    render(<App />)
    fireEvent.click(screen.getByText('＋ Novo personagem')) // abre o seletor
    fireEvent.click(screen.getByText('🐉 D&D 5e'))
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
    // Amaldiçoar Arma exibe só o elemento escolhido (Sangue), não os 4 (F9) — e o custo em PE (F24)
    expect(screen.getByText(/\(Sangue, 1º Círculo — custo \d+ PE/)).toBeInTheDocument()
    expect(screen.getByText(/Equipamento \(/)).toBeInTheDocument()
  })

  it('renderiza a ficha imprimível do agente sem quebrar (formato oficial em 2 páginas)', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedOrdemAgent(), view: 'print' })
    render(<App />)
    expect(screen.getByText('Bianca')).toBeInTheDocument()
    // Página 1: perícias completas + ataques; página 2: habilidades & rituais + inventário + descrição.
    expect(screen.getByText('Perícias')).toBeInTheDocument()
    expect(screen.getByText('Ataques')).toBeInTheDocument() // seção de ataques por arma (R1)
    expect(screen.getByText('Habilidades / Poderes')).toBeInTheDocument()
    expect(screen.getByText('Rituais')).toBeInTheDocument() // seção própria, separada das habilidades
    expect(screen.getByText('Inventário')).toBeInTheDocument()
    // "Faca" aparece na seção Ataques e na de Inventário
    expect(screen.getAllByText('Faca').length).toBeGreaterThan(0)
    expect(screen.getByText(/Imprimir \/ Salvar PDF/)).toBeInTheDocument()
  })

  // Rituais aprendidos por feature de trilha (ex.: Conduíte NEX 99% → Canalizar o Medo) vão direto
  // pra ficha, mesmo sem o jogador escolher no passo Rituais.
  function seedConduitAt99() {
    return {
      ...ORDEM_EMPTY,
      name: 'Vidente',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 1, vigor: 1 },
      origin: 'academic',
      class: 'occultist' as const,
      nex: 99,
      trilha: 'conduit',
      ritualChoices: [],
    }
  }

  it('Revisão do Conduíte NEX 99%: Canalizar o Medo aparece como concedido pela trilha', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedConduitAt99(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    expect(screen.getByText(/Rituais Conhecidos/)).toBeInTheDocument()
    expect(screen.getByText('Canalizar o Medo')).toBeInTheDocument()
    expect(screen.getByText(/concedido pela Trilha Conduíte/)).toBeInTheDocument()
  })

  it('Ficha imprimível do Conduíte NEX 99%: Canalizar o Medo consta na seção Rituais', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedConduitAt99(), view: 'print' })
    render(<App />)
    expect(screen.getByText('Rituais')).toBeInTheDocument()
    expect(screen.getByText('Canalizar o Medo')).toBeInTheDocument()
  })

  // Rituais Eficientes (Graduado NEX 65%) soma +5 na DT de todos os rituais (Fase 2).
  function seedScholarAt65() {
    return {
      ...ORDEM_EMPTY,
      name: 'Erudita',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 1 },
      origin: 'academic',
      class: 'occultist' as const,
      nex: 65,
      trilha: 'scholar',
      ritualChoices: ['armadura-de-sangue'],
    }
  }

  it('Revisão do Graduado NEX 65%: DT do ritual soma +5 (Rituais Eficientes)', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedScholarAt65(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    // Base: 10 + limite de PE (NEX 65% → 13) + Presença 3 = 26; +5 (Rituais Eficientes) = 31.
    expect(screen.getByText(/DT 31 \(Rituais Eficientes \+5\)/)).toBeInTheDocument()
  })

  it('Ficha imprimível do Graduado NEX 65%: DT Base fica em 26 e o ritual mostra 31 com a nota', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedScholarAt65(), view: 'print' })
    render(<App />)
    expect(screen.getByText(/DT Base: 26/)).toBeInTheDocument()
    expect(screen.getByText(/DT 31 \(Rituais Eficientes \+5\)/)).toBeInTheDocument()
  })

  // Presença Poderosa (Intuitivo NEX 40%) soma Presença ao limite de PE só pra conjurar rituais (Fase 2).
  function seedIntuitiveAt40() {
    return {
      ...ORDEM_EMPTY,
      name: 'Vidente Firme',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 4, vigor: 1 },
      origin: 'academic',
      class: 'occultist' as const,
      nex: 40,
      trilha: 'intuitive',
      ritualChoices: ['armadura-de-sangue'],
    }
  }

  it('Revisão do Intuitivo NEX 40%: mostra o limite de PE extra pra conjurar rituais', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedIntuitiveAt40(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    expect(screen.getByText(/ao conjurar rituais — Presença Poderosa/)).toBeInTheDocument()
  })

  it('Ficha imprimível do Intuitivo NEX 40%: mostra o badge de Limite PE p/ Ritual', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedIntuitiveAt40(), view: 'print' })
    render(<App />)
    // Limite base (NEX 40% → 8) + Presença 4 (Presença Poderosa) = 12.
    expect(screen.getByText(/Limite PE p\/ Ritual: 12/)).toBeInTheDocument()
  })

  // Resistências (Fase 3): Mente Sã + Inabalável (Intuitivo NEX 65%) junto com Eu Já Sabia
  // (Teórico da Conspiração), pra ver as 3 linhas e o aviso de fontes de resistência diferentes.
  function seedIntuitiveAt65WithConspiracyOrigin() {
    return {
      ...ORDEM_EMPTY,
      name: 'Cética',
      attributes: { agility: 1, strength: 1, intellect: 5, presence: 1, vigor: 1 },
      origin: 'conspiracy-theorist',
      class: 'occultist' as const,
      nex: 65,
      trilha: 'intuitive',
      ritualChoices: [],
    }
  }

  it('Revisão: mostra Mente Sã, Inabalável e Eu Já Sabia, com o aviso de fontes diferentes', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedIntuitiveAt65WithConspiracyOrigin(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    expect(screen.getByText('Resistências')).toBeInTheDocument()
    expect(screen.getByText(/Teste de resistência paranormal: \+5/)).toBeInTheDocument()
    expect(screen.getByText(/Resistência a dano mental\/paranormal: 10/)).toBeInTheDocument()
    expect(screen.getByText(/Resistência a dano mental: 5/)).toBeInTheDocument()
    expect(screen.getByText(/o livro não diz se acumulam/)).toBeInTheDocument()
  })

  it('Ficha imprimível: mostra a seção Resistências com as 3 linhas', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedIntuitiveAt65WithConspiracyOrigin(), view: 'print' })
    render(<App />)
    expect(screen.getByText('Resistências')).toBeInTheDocument()
    expect(screen.getByText(/Resistência a dano mental\/paranormal: 10/)).toBeInTheDocument()
    expect(screen.getByText(/Resistência a dano mental: 5/)).toBeInTheDocument()
  })

  // Inventário Otimizado (Técnico NEX 10%) soma Intelecto à Força pro cálculo de carga (Fase 4).
  // A seção "Equipamento" só renderiza com pelo menos 1 item — por isso a faca.
  function seedTechnicianAt10() {
    return {
      ...ORDEM_EMPTY,
      name: 'Faz-Tudo',
      attributes: { agility: 1, strength: 1, intellect: 3, presence: 1, vigor: 1 },
      origin: 'academic',
      class: 'specialist' as const,
      nex: 10,
      trilha: 'technician',
      equipmentChoices: ['faca'],
    }
  }

  it('Revisão do Técnico NEX 10%: carga soma Intelecto à Força ((1+3)×5 = 20 espaços)', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedTechnicianAt10(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    // Faca ocupa 1 espaço; capacidade (1 Força + 3 Intelecto) × 5 = 20.
    expect(screen.getByText(/Equipamento \(1\/20 espaços\)/)).toBeInTheDocument()
  })

  // Ferramenta de Trabalho (origem Operário) soma +1 ataque/dano/margem de ameaça na arma escolhida (Fase 5).
  function seedLaborerWithWorkTool() {
    return {
      ...ORDEM_EMPTY,
      name: 'Pedreiro',
      attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      origin: 'laborer',
      class: 'combatant' as const,
      nex: 5,
      workToolWeapon: 'machadinha',
      equipmentChoices: ['machadinha'],
    }
  }

  it('Revisão: Ferramenta de Trabalho soma +1 no dano e amplia a margem de ameaça da machadinha', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedLaborerWithWorkTool(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    // Dano: Força 2 + Ferramenta 1 = +3. Margem de ameaça: x3 (19-20) → 19/x3 (18-20).
    expect(screen.getByText(/1d6\+3 corte/)).toBeInTheDocument()
    expect(screen.getByText(/Crít\. 19\/x3/)).toBeInTheDocument()
  })

  // Artista Marcial: ataque desarmado aparece em Ataques mesmo sem nenhum item equipado (Fase 5).
  function seedMartialArtistAt35() {
    return {
      ...ORDEM_EMPTY,
      name: 'Monge',
      attributes: { agility: 1, strength: 2, intellect: 1, presence: 1, vigor: 1 },
      origin: 'academic',
      class: 'combatant' as const,
      nex: 35,
      powerChoices: ['martial-artist'],
    }
  }

  it('Revisão: Artista Marcial mostra o ataque Desarmado (1d8 em NEX 35%+, com Força)', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedMartialArtistAt35(), view: 'wizard', currentStep: 'review' })
    render(<App />)
    expect(screen.getByText('Desarmado')).toBeInTheDocument()
    expect(screen.getByText(/1d8\+2 impacto/)).toBeInTheDocument()
  })

  it('Ficha imprimível: Artista Marcial mostra o ataque Desarmado', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.setState({ draft: seedMartialArtistAt35(), view: 'print' })
    render(<App />)
    expect(screen.getByText('Desarmado')).toBeInTheDocument()
    expect(screen.getByText(/1d8\+2 impacto/)).toBeInTheDocument()
  })
})
