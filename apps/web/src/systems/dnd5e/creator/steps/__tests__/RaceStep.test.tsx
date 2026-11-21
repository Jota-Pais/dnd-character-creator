import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { RaceStep } from '../RaceStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft, type RaceChoiceSelections } from '@rpg/rules/systems/dnd5e/types/character'

// Mesmo padrão da etapa Classe: a perícia escolhida na raça que o antecedente trocado depois já dá
// não some ao abrir a etapa — fica marcada, com o aviso, até o jogador trocar (p. 125).

function halfElf(background: string): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    race: 'half-elf',
    raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight', 'stealth'], languages: ['dwarvish'] },
    background,
  }
}

const skills = () => useCharacterStore.getState().draft.raceChoices.skills

afterEach(() => cleanup())

describe('RaceStep: perícia repetida por outra fonte', () => {
  it('Meio-Elfo com Intuição que passou a Acólito: a escolha fica, com o aviso, e desmarca', () => {
    useCharacterStore.setState({ draft: halfElf('acolyte') })
    const { container, getByRole } = render(<RaceStep />)
    expect(skills()).toEqual(['insight', 'stealth'])
    expect(container.textContent).toContain('⚠ Intuição já vem do antecedente Acólito — troque por outra perícia')
    fireEvent.click(getByRole('button', { name: '⚠ Intuição' }))
    expect(skills()).toEqual(['stealth'])
    expect((getByRole('button', { name: '✓ Intuição' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sem repetição, nada a avisar', () => {
    useCharacterStore.setState({ draft: halfElf('sailor') })
    const { container } = render(<RaceStep />)
    expect(container.textContent).not.toContain('já vem')
  })
})

// Decisão de 2026-10-26: escolha de 1 é rádio — outra opção troca a marcada direto; a de N para
// no limite.
describe('RaceStep: escolha de 1 troca direto', () => {
  it('Humano Variante: outra perícia e outro idioma trocam os marcados', () => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(EMPTY_DRAFT),
        race: 'human', subrace: 'variant-human',
        raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['stealth'], languages: ['dwarvish'] },
      },
    })
    const { getByRole } = render(<RaceStep />)
    const choices = () => useCharacterStore.getState().draft.raceChoices

    expect((getByRole('button', { name: 'Acrobacia' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByRole('button', { name: 'Acrobacia' }))
    expect(choices().skills).toEqual(['acrobatics'])

    fireEvent.click(getByRole('button', { name: 'Élfico' }))
    expect(choices().languages).toEqual(['elvish'])

    // Os dois atributos (+1 cada) são escolha de 2: cheia, o terceiro trava.
    expect((getByRole('button', { name: 'CON' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

// Gnomo das Rochas (p. 37): a etapa mostra a proficiência que a sub-raça dá com o nome de
// tools.json, e o traço mantém o texto do livro com esse nome entre parênteses.
describe('RaceStep: ferramenta concedida pela raça', () => {
  it('Gnomo das Rochas: Ferramentas de Funileiro nas estatísticas e no traço Engenhoqueiro', () => {
    useCharacterStore.setState({ draft: { ...structuredClone(EMPTY_DRAFT), race: 'gnome', subrace: 'rock-gnome' } })
    const text = render(<RaceStep />).container.textContent ?? ''
    expect(text).toContain('🛠️ FerramentasFerramentas de Funileiro')
    expect(text).toContain('usando ferramentas de engenhoqueiro (Ferramentas de Funileiro).')
  })

  it('sem ferramenta fixa, sem a linha', () => {
    useCharacterStore.setState({ draft: { ...structuredClone(EMPTY_DRAFT), race: 'gnome', subrace: 'forest-gnome' } })
    const text = render(<RaceStep />).container.textContent ?? ''
    expect(text).not.toContain('🛠️ Ferramentas')
  })
})

// p. 31: o Humano Variante é regra opcional. O Humano Padrão é uma opção da etapa, marcada quando
// nenhuma sub-raça está escolhida, e a sub-raça deixa de ser obrigatória.
describe('RaceStep: Humano Padrão ou Variante', () => {
  const draft = () => useCharacterStore.getState().draft

  it('sem sub-raça, o Padrão vem marcado e a seção diz "opcional"', () => {
    useCharacterStore.setState({ draft: { ...structuredClone(EMPTY_DRAFT), race: 'human' } })
    const { container, getByRole } = render(<RaceStep />)
    expect(getByRole('button', { name: /Humano \(Padrão\)/ }).textContent).toContain('✦')
    expect(container.textContent).toContain('opcional')
    expect(container.textContent).not.toContain('obrigatório')
  })

  it('a Variante troca para o Padrão e volta, limpando as escolhas da outra', () => {
    useCharacterStore.setState({
      draft: {
        ...structuredClone(EMPTY_DRAFT),
        race: 'human', subrace: 'variant-human',
        raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['stealth'], languages: ['dwarvish'] },
      },
    })
    const { getByRole } = render(<RaceStep />)
    fireEvent.click(getByRole('button', { name: /Humano \(Padrão\)/ }))
    expect(draft().subrace).toBeNull()
    expect(draft().raceChoices).toEqual({})
    fireEvent.click(getByRole('button', { name: /Humano \(Variante\)/ }))
    expect(draft().subrace).toBe('variant-human')
  })

  it('clicar na sub-raça já marcada não apaga as escolhas dela', () => {
    const raceChoices: RaceChoiceSelections = { abilityBonuses: ['STR', 'DEX'], skills: ['stealth'], languages: ['dwarvish'] }
    useCharacterStore.setState({
      draft: { ...structuredClone(EMPTY_DRAFT), race: 'human', subrace: 'variant-human', raceChoices: structuredClone(raceChoices) },
    })
    const { getByRole } = render(<RaceStep />)
    fireEvent.click(getByRole('button', { name: /Humano \(Variante\)/ }))
    expect(draft().raceChoices).toEqual(raceChoices)
  })

  it('raça com sub-raça obrigatória não ganha a opção sem sub-raça', () => {
    useCharacterStore.setState({ draft: { ...structuredClone(EMPTY_DRAFT), race: 'elf' } })
    const { container, queryByRole } = render(<RaceStep />)
    expect(container.textContent).toContain('obrigatório')
    expect(queryByRole('button', { name: /Padrão/ })).toBeNull()
  })
})
