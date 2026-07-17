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

describe('useOrdemStore — powerParams órfãos ao trocar o poder', () => {
  beforeEach(() => {
    useOrdemStore.getState().newCharacter()
  })

  it('trocar o poder do slot descarta os parâmetros da instância antiga', () => {
    const store = useOrdemStore.getState()
    store.setPowerChoice(0, 'skill-training')
    store.updateDraft({ powerParams: { 'slot-0': ['fighting', 'aim'] } })

    store.setPowerChoice(0, 'element-specialist')
    expect(useOrdemStore.getState().draft.powerParams['slot-0']).toBeUndefined()
  })

  it('re-selecionar o mesmo poder do slot preserva os parâmetros', () => {
    const store = useOrdemStore.getState()
    store.setPowerChoice(0, 'skill-training')
    store.updateDraft({ powerParams: { 'slot-0': ['fighting', 'aim'] } })

    store.setPowerChoice(0, 'skill-training')
    expect(useOrdemStore.getState().draft.powerParams['slot-0']).toEqual(['fighting', 'aim'])
  })

  it('só limpa os parâmetros do próprio slot', () => {
    const store = useOrdemStore.getState()
    store.setPowerChoice(0, 'skill-training')
    store.setPowerChoice(1, 'element-specialist')
    store.updateDraft({ powerParams: { 'slot-0': ['fighting', 'aim'], 'slot-1': ['blood'] } })

    store.setPowerChoice(0, 'transcend')
    expect(useOrdemStore.getState().draft.powerParams).toEqual({ 'slot-1': ['blood'] })
  })

  it('trocar o poder da Versatilidade descarta os parâmetros da instância versatility', () => {
    const store = useOrdemStore.getState()
    store.setVersatilityChoice({ kind: 'power', powerId: 'skill-training' })
    store.updateDraft({ powerParams: { versatility: ['fighting', 'aim'] } })

    store.setVersatilityChoice({ kind: 'power', powerId: 'element-specialist' })
    expect(useOrdemStore.getState().draft.powerParams['versatility']).toBeUndefined()

    store.updateDraft({ powerParams: { versatility: ['blood'] } })
    store.setVersatilityChoice({ kind: 'trilha', trilhaId: 'conduit' })
    expect(useOrdemStore.getState().draft.powerParams['versatility']).toBeUndefined()
  })
})
