import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { ClassStep } from '../ClassStep'
import { useCharacterStore } from '../../../stores/characterStore'
import { EMPTY_DRAFT, type CharacterDraft } from '../../../types/character'

// Decisão de 2026-10-26: a perícia de classe que outra fonte já dá (o antecedente trocado depois)
// não some ao abrir a etapa Classe — fica marcada, com o aviso, até o jogador trocar (p. 125).

function fighter(background: string): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    race: 'human',
    class: 'fighter',
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['athletics', 'perception'], fightingStyle: 'defense' },
    background,
  }
}

const skills = () => useCharacterStore.getState().draft.classChoices.skills

afterEach(() => cleanup())

describe('ClassStep: perícia repetida por outra fonte', () => {
  it('Guerreiro que trocou o Acólito pelo Marinheiro: as perícias ficam, com o aviso', () => {
    useCharacterStore.setState({ draft: fighter('sailor') })
    const { container, getByRole } = render(<ClassStep />)
    expect(skills()).toEqual(['athletics', 'perception'])
    expect(container.textContent).toContain('⚠ Atletismo já vem do antecedente Marinheiro — troque por outra perícia')
    expect(container.textContent).toContain('⚠ Percepção já vem do antecedente Marinheiro — troque por outra perícia')
    expect((getByRole('button', { name: '⚠ Percepção' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('o chip repetido desmarca e depois trava, como qualquer perícia que já se tem', () => {
    useCharacterStore.setState({ draft: fighter('sailor') })
    const { getByRole, container } = render(<ClassStep />)
    fireEvent.click(getByRole('button', { name: '⚠ Atletismo' }))
    expect(skills()).toEqual(['perception'])
    expect((getByRole('button', { name: '✓ Atletismo' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(getByRole('button', { name: 'Acrobacia' }))
    expect(skills()).toEqual(['perception', 'acrobatics'])
    expect(container.textContent).not.toContain('Atletismo já vem')
  })

  // Especialização vale para qualquer perícia que o personagem tenha (p. 91): desmarcar a perícia
  // repetida na lista da classe não a tira, porque o antecedente continua dando a proficiência.
  it('Ladino: desmarcar a perícia repetida mantém a Especialização nela; sem outra fonte, ela sai', () => {
    const rogue = (background: string): CharacterDraft => ({
      ...structuredClone(EMPTY_DRAFT),
      race: 'human',
      class: 'rogue',
      classChoices: {
        ...structuredClone(EMPTY_DRAFT.classChoices),
        skills: ['athletics', 'stealth', 'acrobatics', 'deception'],
        expertiseItems: ['athletics', 'stealth'],
      },
      background,
    })
    const expertise = () => useCharacterStore.getState().draft.classChoices.expertiseItems

    useCharacterStore.setState({ draft: rogue('sailor') })
    const sailor = render(<ClassStep />)
    fireEvent.click(sailor.getByRole('button', { name: '⚠ Atletismo' }))
    expect(skills()).toEqual(['stealth', 'acrobatics', 'deception'])
    expect(expertise()).toEqual(['athletics', 'stealth'])
    cleanup()

    useCharacterStore.setState({ draft: rogue('acolyte') })
    const acolyte = render(<ClassStep />)
    // O primeiro chip é o da lista de perícias; o segundo, o do seletor de Especialização.
    fireEvent.click(acolyte.getAllByRole('button', { name: 'Atletismo' })[0])
    expect(skills()).toEqual(['stealth', 'acrobatics', 'deception'])
    expect(expertise()).toEqual(['stealth'])
  })

  it('sem repetição, nada a avisar', () => {
    useCharacterStore.setState({ draft: fighter('acolyte') })
    const { container } = render(<ClassStep />)
    expect(container.textContent).not.toContain('já vem')
  })
})

describe('ClassStep: card de proficiências da classe', () => {
  it('ferramenta fixa da classe sai com o nome da tabela, não com o id', () => {
    useCharacterStore.setState({ draft: { ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'druid' } })
    const { container } = render(<ClassStep />)
    expect(container.textContent).toContain('Kit de Herbalismo')
    expect(container.textContent).not.toContain('herbalism-kit')
  })
})

// Decisão de 2026-10-26: slot de progressão de 1 escolha não cumulativo é rádio — clicar noutra
// opção troca direto, sem desmarcar antes. O de N escolhas mantém o limite.

function withClass(classId: string, level: number, subclass: string | null, progressionChoices: Record<string, string[]> = {}): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    race: 'human',
    class: classId,
    level,
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass, progressionChoices },
  }
}

const picks = (slotId: string) => useCharacterStore.getState().draft.classChoices.progressionChoices[slotId]

/** O card de opção de progressão com aquele nome (o nome também aparece em textos de característica). */
function optionCard(getAllByText: (text: string) => HTMLElement[], name: string): HTMLButtonElement {
  const card = getAllByText(name)
    .map(el => el.closest('button'))
    .find(button => button?.hasAttribute('aria-pressed'))
  if (!card) throw new Error(`card ${name} não encontrado`)
  return card
}

describe('ClassStep: slot de 1 escolha troca direto', () => {
  it('Dádiva do Pacto: outro pacto troca o marcado, sem travar os outros cards', () => {
    useCharacterStore.setState({ draft: withClass('warlock', 3, 'the-fiend', { 'warlock-pact-boon-3': ['pact-of-the-blade'] }) })
    const { getAllByText } = render(<ClassStep />)
    expect(optionCard(getAllByText, 'Pacto da Corrente').disabled).toBe(false)
    expect(optionCard(getAllByText, 'Pacto do Tomo').disabled).toBe(false)

    fireEvent.click(optionCard(getAllByText, 'Pacto da Corrente'))
    expect(picks('warlock-pact-boon-3')).toEqual(['pact-of-the-chain'])
    expect(optionCard(getAllByText, 'Pacto da Corrente').getAttribute('aria-pressed')).toBe('true')
    expect(optionCard(getAllByText, 'Pacto da Lâmina').getAttribute('aria-pressed')).toBe('false')

    // Clicar no marcado ainda desmarca.
    fireEvent.click(optionCard(getAllByText, 'Pacto da Corrente'))
    expect(picks('warlock-pact-boon-3')).toEqual([])
  })

  it('Ancestral Dracônico e Totem Espiritual também trocam direto', () => {
    useCharacterStore.setState({ draft: withClass('sorcerer', 1, 'draconic-bloodline', { 'draconic-ancestor-1': ['red'] }) })
    const sorcerer = render(<ClassStep />)
    fireEvent.click(optionCard(sorcerer.getAllByText, 'Azul'))
    expect(picks('draconic-ancestor-1')).toEqual(['blue'])
    sorcerer.unmount()

    useCharacterStore.setState({ draft: withClass('barbarian', 3, 'totem-warrior', { 'totem-warrior-totem-3': ['bear'] }) })
    const barbarian = render(<ClassStep />)
    fireEvent.click(optionCard(barbarian.getAllByText, 'Lobo'))
    expect(picks('totem-warrior-totem-3')).toEqual(['wolf'])
  })

  it('a invocação do 5º nível (cumulativa, de 1) também troca direto', () => {
    useCharacterStore.setState({
      draft: withClass('warlock', 5, 'the-fiend', {
        'warlock-invocations-2': ['explosao-agonizante', 'armadura-de-sombras'],
        'warlock-invocations-5': ['idioma-bestial'],
      }),
    })
    const { getAllByText } = render(<ClassStep />)
    const cards = (name: string) => getAllByText(name)
      .map(el => el.closest('button'))
      .filter((b): b is HTMLButtonElement => !!b?.hasAttribute('aria-pressed'))
    // O card aparece nos dois slots; o do 5º é o último. O do 2º já marcado fica travado no 5º.
    const fifth = (name: string) => cards(name).at(-1)!
    expect(fifth('Explosão Agonizante').disabled).toBe(true)
    fireEvent.click(fifth('Visão Diabólica'))
    expect(picks('warlock-invocations-5')).toEqual(['visao-diabolica'])
    expect(picks('warlock-invocations-2')).toEqual(['explosao-agonizante', 'armadura-de-sombras'])
  })

  it('perícia, ferramenta e escolha de subclasse de 1 trocam direto', () => {
    const extras = () => useCharacterStore.getState().draft.classChoices.subclassExtras

    useCharacterStore.setState({
      draft: { ...withClass('monk', 1, null), classChoices: { ...withClass('monk', 1, null).classChoices, tools: ['carpenters-tools'] } },
    })
    const monk = render(<ClassStep />)
    fireEvent.click(monk.getByRole('button', { name: 'Ferramentas de Cartógrafo' }))
    expect(useCharacterStore.getState().draft.classChoices.tools).toEqual(['cartographers-tools'])
    monk.unmount()

    useCharacterStore.setState({ draft: withClass('fighter', 3, 'battle-master') })
    useCharacterStore.getState().updateClassChoices({ subclassExtras: { tools: ['carpenters-tools'] } })
    const fighter = render(<ClassStep />)
    fireEvent.click(fighter.getByRole('button', { name: 'Ferramentas de Cartógrafo' }))
    expect(extras().tools).toEqual(['cartographers-tools'])
    fighter.unmount()

    useCharacterStore.setState({ draft: withClass('cleric', 1, 'nature-domain') })
    useCharacterStore.getState().updateClassChoices({ subclassExtras: { skills: ['nature'] } })
    const cleric = render(<ClassStep />)
    fireEvent.click(cleric.getByRole('button', { name: 'Sobrevivência' }))
    expect(extras().skills).toEqual(['survival'])
  })

  it('slot de N escolhas mantém o limite: cheio, a opção nova trava e o clique não muda nada', () => {
    useCharacterStore.setState({
      draft: withClass('warlock', 3, 'the-fiend', { 'warlock-invocations-2': ['explosao-agonizante', 'armadura-de-sombras'] }),
    })
    const { getAllByText } = render(<ClassStep />)
    const third = optionCard(getAllByText, 'Idioma Bestial')
    expect(third.disabled).toBe(true)
    fireEvent.click(third)
    expect(picks('warlock-invocations-2')).toEqual(['explosao-agonizante', 'armadura-de-sombras'])
  })
})
