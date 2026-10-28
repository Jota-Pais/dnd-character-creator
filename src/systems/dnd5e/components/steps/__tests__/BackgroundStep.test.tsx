import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { BackgroundStep } from '../BackgroundStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

// O item do antecedente sem a proficiência (p. 156) só aparecia na Revisão e no PDF, embora a
// escolha que causa isso seja feita aqui.

function soldier(gamingSet: string): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    class: 'fighter',
    background: 'soldier',
    backgroundChoices: { tools: [gamingSet], items: { 'gaming-set': 'bone-dice' } },
  }
}

afterEach(() => cleanup())

describe('BackgroundStep: ferramenta do antecedente sem proficiência', () => {
  it('Soldado com proficiência em Baralho e os Dados de Osso: avisa, como na Revisão', () => {
    useCharacterStore.setState({ draft: soldier('playing-card-set') })
    const { container } = render(<BackgroundStep />)
    expect(container.textContent).toContain('Sem proficiência: Dados de Osso (Conjunto de Dados)')
  })

  it('com proficiência em Conjunto de Dados, nada a avisar', () => {
    useCharacterStore.setState({ draft: soldier('dice-set') })
    const { container } = render(<BackgroundStep />)
    expect(container.textContent).not.toContain('Sem proficiência')
  })
})

// A ferramenta escolhida no antecedente que outra fonte já dá (ficha antiga) não some ao abrir a
// etapa: fica marcada, com o aviso, até o jogador trocar (p. 125).
describe('BackgroundStep: ferramenta repetida por outra fonte', () => {
  const entertainer: CharacterDraft = {
    ...structuredClone(EMPTY_DRAFT),
    class: 'bard',
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['arcana', 'history', 'insight'], tools: ['lute', 'flute', 'drum'] },
    background: 'entertainer',
    backgroundChoices: { tools: ['lute'] },
  }

  it('o Alaúde que o bardo já toca fica marcado, com o aviso; trocar por outro instrumento resolve', () => {
    useCharacterStore.setState({ draft: structuredClone(entertainer) })
    const { container, getByRole } = render(<BackgroundStep />)
    expect(useCharacterStore.getState().draft.backgroundChoices.tools).toEqual(['lute'])
    expect(container.textContent).toContain('⚠ Alaúde já vem da classe Bardo — troque por outro instrumento')
    fireEvent.click(getByRole('button', { name: 'Violino' }))
    expect(useCharacterStore.getState().draft.backgroundChoices.tools).toEqual(['viol'])
    expect(container.textContent).not.toContain('Alaúde já vem')
  })
})

// Decisão de 2026-10-28: o idioma escolhido no antecedente que a raça trocada passou a dar não some
// ao abrir a etapa (antes um filtro o apagava em silêncio) — fica marcado, com o aviso.
describe('BackgroundStep: idioma repetido por outra fonte', () => {
  it('Acólito com Élfico num Alto Elfo: o Élfico fica, com o aviso, e outro idioma troca', () => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(EMPTY_DRAFT),
        race: 'elf', subrace: 'high-elf',
        background: 'acolyte',
        backgroundChoices: { languages: ['elvish', 'dwarvish'] },
      },
    })
    const { container, getByRole } = render(<BackgroundStep />)
    const languages = () => useCharacterStore.getState().draft.backgroundChoices.languages
    expect(languages()).toEqual(['elvish', 'dwarvish'])
    expect(container.textContent).toContain('⚠ Élfico já vem da raça Alto Elfo — troque por outro idioma')

    // Escolha de 2 cheia: desmarca o repetido e marca outro.
    fireEvent.click(getByRole('button', { name: '⚠ Élfico' }))
    fireEvent.click(getByRole('button', { name: 'Gigante' }))
    expect(languages()).toEqual(['dwarvish', 'giant'])
    expect(container.textContent).not.toContain('Élfico já vem')
  })
})

// Decisão de 2026-10-28: trocar o antecedente que repete uma perícia escolhida na classe avisa já
// aqui, com o atalho para ir trocar lá (a pendência continua na etapa Classe).
describe('BackgroundStep: repetição causada em outra etapa', () => {
  it('Marinheiro com Atletismo e Percepção escolhidas no guerreiro: avisa e leva à Classe', () => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(EMPTY_DRAFT),
        race: 'human',
        class: 'fighter',
        classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['athletics', 'perception'], fightingStyle: 'defense' },
        background: 'sailor',
      },
      currentStep: 'background',
    })
    const { container, getAllByRole } = render(<BackgroundStep />)
    expect(container.textContent).toContain(
      '⚠ Atletismo, que o antecedente também dá, já está entre as escolhas da classe Guerreiro — troque lá por outra perícia',
    )
    fireEvent.click(getAllByRole('button', { name: 'Trocar em Classe →' })[0])
    expect(useCharacterStore.getState().currentStep).toBe('class')
  })
})

// p. 125: Meio-Orc e Soldado dão Intimidação fixa. Sem escolha a trocar, o antecedente abre a
// substituta opcional (decisão de 2026-10-28).
describe('BackgroundStep: substituta do fixo × fixo', () => {
  it('mostra de onde vem a repetida e deixa escolher outra perícia, sem pendurar a etapa', () => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(EMPTY_DRAFT),
        race: 'half-orc',
        class: 'barbarian',
        classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['animal-handling', 'survival'] },
        background: 'soldier',
        backgroundChoices: { tools: ['dice-set'], items: { 'gaming-set': 'bone-dice' } },
      },
    })
    const { container, getByRole } = render(<BackgroundStep />)
    expect(container.textContent).toContain('Proficiência repetida')
    expect(container.textContent).toContain('Intimidação vem também da raça Meio-Orc.')
    expect(container.textContent).not.toContain('⚠ Soldado')
    // O que o personagem já tem vem com ✓ e travado.
    expect((getByRole('button', { name: '✓ Atletismo' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(getByRole('button', { name: 'Persuasão' }))
    expect(useCharacterStore.getState().draft.backgroundChoices.substituteSkills).toEqual(['persuasion'])
    // Escolha de 1: outra troca direto.
    fireEvent.click(getByRole('button', { name: 'Enganação' }))
    expect(useCharacterStore.getState().draft.backgroundChoices.substituteSkills).toEqual(['deception'])
  })

  it('sem fixo × fixo, a seção não aparece', () => {
    useCharacterStore.setState({ draft: { ...structuredClone(EMPTY_DRAFT), race: 'human', background: 'soldier' } })
    const { container } = render(<BackgroundStep />)
    expect(container.textContent).not.toContain('Proficiência repetida')
  })
})
