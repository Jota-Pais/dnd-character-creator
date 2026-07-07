import { describe, it, expect, beforeEach } from 'vitest'
import { useCharacterStore } from '../characterStore'
import { EMPTY_DRAFT } from '../../types/character'
import { loadSession } from '../../utils/storage'
import { COMPLETE_DRAFT } from '../../test/fixtures'

beforeEach(() => {
  useCharacterStore.getState().reset()
  localStorage.clear()
})

describe('nextStep (validação defensiva)', () => {
  it('não avança de "name" com nome vazio', () => {
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('name')
  })

  it('avança quando o passo atual está completo', () => {
    useCharacterStore.getState().setName('Conan')
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('race')
  })
})

describe('importDraft', () => {
  it('leva ficha completa direto à revisão e persiste a sessão', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    expect(useCharacterStore.getState().currentStep).toBe('review')
    expect(useCharacterStore.getState().draft.name).toBe('Krusk')
    expect(loadSession()?.step).toBe('review')
  })

  it('retoma ficha incompleta no primeiro passo pendente', () => {
    useCharacterStore.getState().importDraft({ ...structuredClone(EMPTY_DRAFT), name: 'Conan' })
    expect(useCharacterStore.getState().currentStep).toBe('race')
  })

  it('ficha sem antecedente retoma em background', () => {
    useCharacterStore.getState().importDraft({ ...structuredClone(COMPLETE_DRAFT), background: null })
    expect(useCharacterStore.getState().currentStep).toBe('background')
  })
})
