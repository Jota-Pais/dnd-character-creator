import { describe, it, expect, beforeEach } from 'vitest'
import { useCharacterStore } from '../characterStore'
import { EMPTY_DRAFT } from '../../types/character'
import { loadLibrary } from '../../utils/storage'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { useAppStore } from '../../../../core/stores/appStore'

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.getState().newCharacter()
})

describe('nextStep (validação defensiva)', () => {
  it('não avança de "name" com nome vazio', () => {
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('name')
  })

  it('avança quando o passo atual está completo e persiste na biblioteca', () => {
    useCharacterStore.getState().setName('Conan')
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('race')
    // a ficha foi salva na biblioteca
    expect(useCharacterStore.getState().library.some(c => c.draft.name === 'Conan')).toBe(true)
    expect(loadLibrary().some(c => c.draft.name === 'Conan')).toBe(true)
  })
})

describe('importDraft', () => {
  it('leva ficha completa direto à revisão, no modo wizard, salva na biblioteca', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().currentStep).toBe('review')
    expect(useCharacterStore.getState().draft.name).toBe('Krusk')
    expect(loadLibrary().some(c => c.draft.name === 'Krusk')).toBe(true)
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

describe('biblioteca', () => {
  it('newCharacter começa em branco no wizard', () => {
    useCharacterStore.getState().setName('X')
    useCharacterStore.getState().newCharacter()
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().draft.name).toBe('')
    expect(useCharacterStore.getState().currentStep).toBe('name')
  })

  it('abrir e excluir uma ficha da biblioteca', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().goToGallery()
    expect(useCharacterStore.getState().view).toBe('gallery')
    useCharacterStore.getState().openCharacter(id)
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(useCharacterStore.getState().draft.name).toBe('Krusk')
    useCharacterStore.getState().deleteCharacter(id)
    expect(useCharacterStore.getState().library.some(c => c.id === id)).toBe(false)
  })

  it('duplicar cria uma cópia com sufixo', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().duplicateCharacter(id)
    const copies = useCharacterStore.getState().library.filter(c => c.draft.name.includes('cópia'))
    expect(copies.length).toBe(1)
  })
})

describe('goToStep (navegação livre pelo stepper — F19)', () => {
  it('ficha completa: navega livremente pra qualquer etapa, em qualquer ordem', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToStep('abilities')
    expect(useCharacterStore.getState().currentStep).toBe('abilities')
    useCharacterStore.getState().goToStep('review')
    expect(useCharacterStore.getState().currentStep).toBe('review')
    useCharacterStore.getState().goToStep('name')
    expect(useCharacterStore.getState().currentStep).toBe('name')
  })

  it('não pula validação: com só o nome preenchido, alcança "race" (1º incompleto) mas não além', () => {
    useCharacterStore.getState().setName('Conan')
    useCharacterStore.getState().goToStep('background')
    expect(useCharacterStore.getState().currentStep).toBe('name')
    useCharacterStore.getState().goToStep('race')
    expect(useCharacterStore.getState().currentStep).toBe('race')
  })

  it('navegar persiste a ficha na biblioteca (como próximo/anterior)', () => {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    useCharacterStore.getState().goToStep('class')
    expect(loadLibrary().some(c => c.draft.name === 'Krusk' && c.step === 'class')).toBe(true)
  })
})

describe('sair para a galeria global unificada (F14)', () => {
  it('goToGallery() zera o activeSystemId (volta ao Multiverso, não à galeria mono-sistema)', () => {
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().goToGallery()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })

  it('reset() (Concluir) zera o activeSystemId', () => {
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().setName('Krusk')
    useCharacterStore.getState().reset()
    expect(useAppStore.getState().activeSystemId).toBeNull()
  })
})
