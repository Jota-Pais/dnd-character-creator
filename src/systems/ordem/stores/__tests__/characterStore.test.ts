import { describe, it, expect, beforeEach } from 'vitest'
import { useOrdemStore } from '../characterStore'
import { useAppStore } from '../../../../core/stores/appStore'

describe('useOrdemStore — sair para a galeria global', () => {
  it('reset() volta para a galeria global unificada (activeSystemId = null)', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.getState().reset()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })

  it('goToGallery() volta para a galeria global unificada (activeSystemId = null)', () => {
    useAppStore.getState().setActiveSystem('ordem')
    useOrdemStore.getState().goToGallery()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })
})

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

  it('trocar de classe limpa poderes paranormais de slots/Versatilidade, mas preserva o da origem e a afinidade', () => {
    const store = useOrdemStore.getState()
    store.setClass('occultist')
    store.setParanormalPowerChoice('slot-0', 'iron-blood')
    store.setParanormalPowerChoice('versatility', 'fortunate')
    store.setParanormalPowerChoice('origin', 'sensitive')
    store.setAffinityElement('death')

    store.setClass('combatant')
    const draft = useOrdemStore.getState().draft
    expect(draft.paranormalPowerChoices).toEqual({ origin: { powerId: 'sensitive' } })
    expect(draft.affinityElement).toBe('death')
  })
})

describe('useOrdemStore — escolhas de poder paranormal', () => {
  beforeEach(() => {
    useOrdemStore.getState().newCharacter()
  })

  it('trocar o poder da instância zera as sub-escolhas', () => {
    const store = useOrdemStore.getState()
    store.setParanormalPowerChoice('slot-0', 'resist-element')
    store.setParanormalSubChoice('slot-0', { element: 'blood' })
    expect(useOrdemStore.getState().draft.paranormalPowerChoices['slot-0']).toEqual({
      powerId: 'resist-element',
      element: 'blood',
    })

    store.setParanormalPowerChoice('slot-0', 'learn-ritual')
    expect(useOrdemStore.getState().draft.paranormalPowerChoices['slot-0']).toEqual({ powerId: 'learn-ritual' })
  })

  it('setParanormalPowerChoice(null) remove a entrada da fonte', () => {
    const store = useOrdemStore.getState()
    store.setParanormalPowerChoice('slot-1', 'fortunate')
    store.setParanormalPowerChoice('slot-1', null)
    expect(useOrdemStore.getState().draft.paranormalPowerChoices['slot-1']).toBeUndefined()
  })

  it('setParanormalSubChoice numa fonte sem escolha é no-op', () => {
    useOrdemStore.getState().setParanormalSubChoice('slot-3', { element: 'death' })
    expect(useOrdemStore.getState().draft.paranormalPowerChoices['slot-3']).toBeUndefined()
  })
})
