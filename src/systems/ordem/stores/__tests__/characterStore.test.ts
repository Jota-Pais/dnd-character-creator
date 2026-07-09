import { describe, it, expect, beforeEach } from 'vitest'
import { useOrdemStore } from '../characterStore'

describe('useOrdemStore — setClass', () => {
  beforeEach(() => {
    useOrdemStore.getState().reset()
  })

  it('trocar de classe descarta escolhas dependentes de classe, incluindo rituais', () => {
    const store = useOrdemStore.getState()

    // Vira Ocultista e escolhe rituais + poderes.
    store.setClass('occultist')
    store.updateDraft({
      ritualChoices: ['amaldicoar-arma', 'luz'],
      powerChoices: ['algum-poder'],
      trilha: 'alguma-trilha',
    })
    expect(useOrdemStore.getState().draft.ritualChoices.length).toBe(2)

    // Troca para Combatente: rituais (e as demais escolhas de classe) devem sumir,
    // para não vazar rituais numa ficha de não-conjurador.
    store.setClass('combatant')
    const draft = useOrdemStore.getState().draft
    expect(draft.ritualChoices).toEqual([])
    expect(draft.powerChoices).toEqual([])
    expect(draft.trilha).toBeNull()
  })
})
