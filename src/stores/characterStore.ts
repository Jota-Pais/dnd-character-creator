import { create } from 'zustand'
import type { WizardStep, CharacterDraft, RaceChoiceSelections, ClassChoiceSelections } from '../types/character'
import { WIZARD_STEPS, EMPTY_DRAFT } from '../types/character'
import { saveCharacter, loadCharacter, clearCharacter } from '../utils/storage'

type CharacterStore = {
  currentStep: WizardStep
  draft: CharacterDraft

  setName: (name: string) => void
  setRace: (raceId: string) => void
  setSubrace: (subraceId: string) => void
  updateRaceChoices: (choices: Partial<RaceChoiceSelections>) => void
  setClass: (classId: string) => void
  updateClassChoices: (choices: Partial<ClassChoiceSelections>) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
  saveToStorage: () => void
  loadFromStorage: () => void
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  currentStep: 'name',
  draft: { ...EMPTY_DRAFT },

  setName: (name) => set(state => ({ draft: { ...state.draft, name } })),

  setRace: (raceId) =>
    set(state => ({
      draft: { ...state.draft, race: raceId, subrace: null, raceChoices: {} },
    })),

  setSubrace: (subraceId) =>
    set(state => ({
      draft: { ...state.draft, subrace: subraceId, raceChoices: {} },
    })),

  updateRaceChoices: (choices) =>
    set(state => ({
      draft: {
        ...state.draft,
        raceChoices: { ...state.draft.raceChoices, ...choices },
      },
    })),

  setClass: (classId) =>
    set(state => ({
      draft: {
        ...state.draft,
        class: classId,
        classChoices: { ...EMPTY_DRAFT.classChoices },
      },
    })),

  updateClassChoices: (choices) =>
    set(state => ({
      draft: {
        ...state.draft,
        classChoices: { ...state.draft.classChoices, ...choices },
      },
    })),

  nextStep: () => {
    const { currentStep, draft } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    if (idx < WIZARD_STEPS.length - 1) {
      const next = WIZARD_STEPS[idx + 1]
      saveCharacter(draft)
      set({ currentStep: next })
    }
  },

  prevStep: () => {
    const { currentStep } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    if (idx > 0) set({ currentStep: WIZARD_STEPS[idx - 1] })
  },

  reset: () => {
    clearCharacter()
    set({ currentStep: 'name', draft: { ...EMPTY_DRAFT } })
  },

  saveToStorage: () => saveCharacter(get().draft),

  loadFromStorage: () => {
    const saved = loadCharacter()
    if (saved) set({ draft: saved })
  },
}))
