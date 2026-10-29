import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { ProgressionOptionCard } from '../ProgressionOptionCard'
import { getProgressionOptions } from '@rpg/rules/systems/dnd5e/utils/progressionOptions'

afterEach(cleanup)

// Lâmina Sedenta exige o Pacto da Lâmina (p. 61).
const thirstingBlade = getProgressionOptions('eldritch-invocations').find(o => o.id === 'lamina-sedenta')!
const REQUIREMENT = 'requer Pacto da Lâmina (Dádiva do Pacto, 3º nível)'

describe('ProgressionOptionCard — pré-requisito de pacto', () => {
  it('sem o pacto, a invocação não se marca e diz o que falta', () => {
    const onToggle = vi.fn()
    const { getByRole, getByText } = render(
      <ProgressionOptionCard
        option={thirstingBlade} accent="#c9a" picked={false} pickedEarlier={false} slotFull={false}
        unmetRequirement={REQUIREMENT} onToggle={onToggle}
      />,
    )
    expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    expect(getByText(`Indisponível: ${REQUIREMENT}.`)).not.toBeNull()
    fireEvent.click(getByRole('button'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('já marcada (pacto trocado), avisa e deixa desmarcar', () => {
    const onToggle = vi.fn()
    const { getByRole, getByText } = render(
      <ProgressionOptionCard
        option={thirstingBlade} accent="#c9a" picked pickedEarlier={false} slotFull
        unmetRequirement={REQUIREMENT} onToggle={onToggle}
      />,
    )
    expect(getByText(/^⚠ Sem o pré-requisito: requer Pacto da Lâmina/)).not.toBeNull()
    fireEvent.click(getByRole('button'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('slot de 1 escolha (rádio, nunca cheio): a opção sem o pré-requisito continua travada', () => {
    const onToggle = vi.fn()
    const { getByRole } = render(
      <ProgressionOptionCard
        option={thirstingBlade} accent="#c9a" picked={false} pickedEarlier={false} slotFull={false}
        unmetRequirement={REQUIREMENT} onToggle={onToggle}
      />,
    )
    fireEvent.click(getByRole('button'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('com o pacto, nada de aviso', () => {
    const { queryByText } = render(
      <ProgressionOptionCard
        option={thirstingBlade} accent="#c9a" picked={false} pickedEarlier={false} slotFull={false} onToggle={() => {}}
      />,
    )
    expect(queryByText(/Indisponível|Sem o pré-requisito/)).toBeNull()
  })
})
