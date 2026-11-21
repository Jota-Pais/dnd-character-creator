import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within } from '@testing-library/react'
import { ImprovementsStep } from '../ImprovementsStep'
import { useCharacterStore } from '../../../stores/characterStore'
import type { AsiChoice, CharacterDraft } from '@rpg/rules/systems/dnd5e/types/character'
import { COMPLETE_DRAFT } from '@rpg/rules/test/fixtures'

// "Você só pode escolher um talento uma vez, a não ser que a descrição do talento diga o contrário"
// (p. 167). A ficha guarda cada talento uma vez só: o mesmo talento num segundo Incremento sumia em
// silêncio. O espaço repetido fica pendente e diz o motivo acima do catálogo, numa região viva
// montada vazia — no celular, o rodapé da etapa não mostra a pendência.

const ALERT: AsiChoice = { kind: 'feat', featId: 'alerta' }
const WHY = '⚠ Alerta já está na ficha — cada talento só se escolhe uma vez (p. 167); troque por outro'

/** Krusk, bárbaro 8: Incrementos no 4º e no 8º nível. */
function barbarian8(asiChoices: AsiChoice[]): CharacterDraft {
  return { ...structuredClone(COMPLETE_DRAFT), level: 8, asiChoices }
}

afterEach(() => cleanup())

describe('ImprovementsStep: o mesmo talento em dois espaços', () => {
  it('o segundo espaço fica pendente e avisa na região viva; o primeiro fica com o talento', () => {
    useCharacterStore.setState({ draft: barbarian8([ALERT, { kind: 'feat', featId: 'sortudo' }]) })
    const { container, getAllByText, queryByText } = render(<ImprovementsStep />)
    const regions = [...container.querySelectorAll('[aria-live="polite"]')]
    // Montadas vazias antes do aviso: uma por espaço.
    expect(regions.map(r => r.textContent)).toEqual(['', ''])
    expect(queryByText('pendente')).toBeNull()

    // O segundo espaço troca o Sortudo pelo Alerta, que o primeiro já tem.
    const slots = getAllByText(/^Incremento — Nível/).map(t => t.closest('.rounded-xl') as HTMLElement)
    fireEvent.click(within(slots[1]).getByRole('button', { name: /^Alerta/ }))
    expect(regions.map(r => r.textContent)).toEqual(['', WHY])
    expect(within(slots[0]).queryByText('pendente')).toBeNull()
    expect(within(slots[1]).getByText('pendente')).toBeInTheDocument()
  })
})
