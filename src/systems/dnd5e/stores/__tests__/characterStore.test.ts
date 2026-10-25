import { describe, it, expect, beforeEach } from 'vitest'
import { useCharacterStore } from '../characterStore'
import { EMPTY_DRAFT } from '../../types/character'
import { loadLibrary } from '../../utils/storage'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { useAppStore } from '../../../../core/stores/appStore'
import { usePlayStore } from '../playStore'
import { createPlayState, setInspiration } from '../../utils/playState'
import { loadPlayState, savePlayState } from '../../utils/playStorage'

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.getState().newCharacter()
})

describe('nextStep (navegação livre)', () => {
  it('avança mesmo com o passo atual incompleto (o gate é só na Revisão)', () => {
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('race')
  })

  it('não passa do último passo', () => {
    useCharacterStore.getState().goToStep('review')
    useCharacterStore.getState().nextStep()
    expect(useCharacterStore.getState().currentStep).toBe('review')
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

  it('ficha em branco: alcança qualquer etapa, mesmo com tudo incompleto', () => {
    useCharacterStore.getState().goToStep('equipment')
    expect(useCharacterStore.getState().currentStep).toBe('equipment')
    useCharacterStore.getState().goToStep('review')
    expect(useCharacterStore.getState().currentStep).toBe('review')
    useCharacterStore.getState().goToStep('background')
    expect(useCharacterStore.getState().currentStep).toBe('background')
  })

  it('ignora etapa inexistente', () => {
    useCharacterStore.getState().goToStep('spells')
    // @ts-expect-error — passo inválido vindo de fora (ex.: ficha salva de uma versão antiga)
    useCharacterStore.getState().goToStep('nao-existe')
    expect(useCharacterStore.getState().currentStep).toBe('spells')
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

describe('troca de subclasse x magias escolhidas', () => {
  it('sair do Cavaleiro Arcano zera as magias do guerreiro; trocar a escola do mago não', () => {
    const store = useCharacterStore.getState()
    store.setClass('fighter')
    store.setLevel(3)
    useCharacterStore.getState().updateClassChoices({ subclass: 'eldritch-knight' })
    useCharacterStore.getState().updateSpellChoices({ cantrips: ['fire-bolt'], spells: ['shield'] })
    useCharacterStore.getState().updateClassChoices({ skills: ['athletics'] })
    expect(useCharacterStore.getState().draft.spellChoices.spells).toEqual(['shield'])
    useCharacterStore.getState().updateClassChoices({ subclass: 'champion' })
    expect(useCharacterStore.getState().draft.spellChoices).toEqual({ cantrips: [], spells: [] })

    useCharacterStore.getState().setClass('wizard')
    useCharacterStore.getState().updateClassChoices({ subclass: 'evocation' })
    useCharacterStore.getState().updateSpellChoices({ spells: ['shield'] })
    useCharacterStore.getState().updateClassChoices({ subclass: 'abjuration' })
    expect(useCharacterStore.getState().draft.spellChoices.spells).toEqual(['shield'])
  })

  it('vale também para a classe adicional da multiclasse', () => {
    useCharacterStore.getState().setClass('wizard')
    useCharacterStore.getState().setLevel(5)
    useCharacterStore.getState().addClass('rogue')
    useCharacterStore.getState().setAdditionalClassLevel('rogue', 3)
    useCharacterStore.getState().updateAdditionalClassChoices('rogue', { subclass: 'arcane-trickster' })
    useCharacterStore.getState().updateAdditionalSpellChoices('rogue', { spells: ['sleep'] })
    useCharacterStore.getState().updateAdditionalClassChoices('rogue', { subclass: 'thief' })
    expect(useCharacterStore.getState().draft.additionalClasses[0].spellChoices.spells).toEqual([])
  })
})

describe('modo de jogo', () => {
  function savedKrusk(): string {
    useCharacterStore.getState().importDraft(structuredClone(COMPLETE_DRAFT))
    const id = useCharacterStore.getState().currentId!
    useCharacterStore.getState().goToGallery()
    return id
  }

  it('playCharacter abre a ficha salva no modo de jogo', () => {
    const id = savedKrusk()
    useCharacterStore.getState().playCharacter(id)
    const s = useCharacterStore.getState()
    expect(s.view).toBe('play')
    expect(s.currentId).toBe(id)
    expect(s.draft.name).toBe('Krusk')
    expect(usePlayStore.getState()).toMatchObject({ characterId: id, characterName: 'Krusk' })
    expect(usePlayStore.getState().state?.characterId).toBe(id)
  })

  it('playCharacter com id desconhecido não faz nada', () => {
    useCharacterStore.getState().playCharacter('nao-existe')
    expect(useCharacterStore.getState().view).toBe('wizard')
    expect(usePlayStore.getState().characterId).not.toBe('nao-existe')
  })

  it('exitPlay fecha o jogo e volta para a galeria global sem regravar a ficha', () => {
    const id = savedKrusk()
    const before = localStorage.getItem('dnd-character-library')
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run(st => setInspiration(st, true))
    useAppStore.getState().setActiveSystem('dnd5e')
    useCharacterStore.getState().exitPlay()
    expect(useCharacterStore.getState().view).toBe('gallery')
    expect(useAppStore.getState().activeSystemId).toBeNull()
    expect(usePlayStore.getState().state).toBeNull()
    expect(localStorage.getItem('dnd-character-library')).toBe(before)
    expect(loadPlayState(id)?.inspiration).toBe(true)
  })

  it('excluir a ficha apaga também o estado de jogo dela', () => {
    const id = savedKrusk()
    useCharacterStore.getState().playCharacter(id)
    usePlayStore.getState().run(st => setInspiration(st, true))
    savePlayState(createPlayState('outra'))
    expect(loadPlayState(id)).not.toBeNull()
    useCharacterStore.getState().deleteCharacter(id)
    expect(loadPlayState(id)).toBeNull()
    expect(loadPlayState('outra')).not.toBeNull()
    expect(usePlayStore.getState().characterId).toBeNull()
  })
})
