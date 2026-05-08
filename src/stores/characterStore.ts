import { create } from 'zustand'
import type { WizardStep, CharacterDraft, RaceChoiceSelections, ClassChoiceSelections, AbilityMethod, BackgroundChoiceSelections, EquipmentDraft, SpellChoices } from '../types/character'
import type { AbilityScore } from '../types/race'
import type { ChoiceResolution } from '../types/equipment'
import { WIZARD_STEPS, EMPTY_DRAFT } from '../types/character'
import { EMPTY_EQUIPMENT_DRAFT } from '../types/equipment'
import { EMPTY_SPELL_CHOICES } from '../types/spell'
import { saveSession, loadSession, clearSession } from '../utils/storage'

const persisted = loadSession()

type CharacterStore = {
  currentStep: WizardStep
  draft: CharacterDraft

  setName: (name: string) => void
  setRace: (raceId: string) => void
  setSubrace: (subraceId: string) => void
  updateRaceChoices: (choices: Partial<RaceChoiceSelections>) => void
  setClass: (classId: string) => void
  updateClassChoices: (choices: Partial<ClassChoiceSelections>) => void
  updateSpellChoices: (choices: Partial<SpellChoices>) => void
  setAbilityMethod: (method: AbilityMethod) => void
  setAbilityScore: (ability: AbilityScore, score: number | null) => void
  setRolledValues: (values: number[]) => void
  setBackground: (backgroundId: string) => void
  updateBackgroundChoices: (choices: Partial<BackgroundChoiceSelections>) => void
  setEquipmentMethod: (method: EquipmentDraft['method']) => void
  resolveEquipmentChoice: (choiceIndex: number, resolution: ChoiceResolution) => void
  setRolledGold: (gold: number | null) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
  importDraft: (draft: CharacterDraft) => void
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  currentStep: persisted?.step ?? 'name',
  draft: persisted?.draft ?? { ...EMPTY_DRAFT },

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
        spellChoices: { ...EMPTY_SPELL_CHOICES },
        equipment: { ...EMPTY_EQUIPMENT_DRAFT },
      },
    })),

  updateClassChoices: (choices) =>
    set(state => ({
      draft: {
        ...state.draft,
        classChoices: { ...state.draft.classChoices, ...choices },
      },
    })),

  updateSpellChoices: (choices) =>
    set(state => ({
      draft: {
        ...state.draft,
        spellChoices: { ...state.draft.spellChoices, ...choices },
      },
    })),

  setAbilityMethod: (method) =>
    set(state => ({
      draft: {
        ...state.draft,
        abilityMethod: method,
        abilityScores: method === 'point-buy'
          ? { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }
          : { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
        rolledValues: [],
      },
    })),

  setAbilityScore: (ability, score) =>
    set(state => ({
      draft: {
        ...state.draft,
        abilityScores: { ...state.draft.abilityScores, [ability]: score },
      },
    })),

  setRolledValues: (values) =>
    set(state => ({
      draft: {
        ...state.draft,
        rolledValues: values,
        abilityScores: { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
      },
    })),

  setBackground: (backgroundId) =>
    set(state => ({
      draft: { ...state.draft, background: backgroundId, backgroundChoices: {} },
    })),

  updateBackgroundChoices: (choices) =>
    set(state => ({
      draft: {
        ...state.draft,
        backgroundChoices: { ...state.draft.backgroundChoices, ...choices },
      },
    })),

  setEquipmentMethod: (method) =>
    set(state => ({
      draft: {
        ...state.draft,
        equipment: { ...state.draft.equipment, method },
      },
    })),

  resolveEquipmentChoice: (choiceIndex, resolution) =>
    set(state => {
      const resolutions = [...state.draft.equipment.classResolutions]
      resolutions[choiceIndex] = resolution
      return {
        draft: {
          ...state.draft,
          equipment: { ...state.draft.equipment, classResolutions: resolutions },
        },
      }
    }),

  setRolledGold: (gold) =>
    set(state => ({
      draft: {
        ...state.draft,
        equipment: { ...state.draft.equipment, rolledGold: gold },
      },
    })),

  nextStep: () => {
    const { currentStep, draft } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    if (idx < WIZARD_STEPS.length - 1) {
      const next = WIZARD_STEPS[idx + 1]
      saveSession(draft, next)
      set({ currentStep: next })
    }
  },

  prevStep: () => {
    const { currentStep, draft } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    if (idx > 0) {
      const prev = WIZARD_STEPS[idx - 1]
      saveSession(draft, prev)
      set({ currentStep: prev })
    }
  },

  reset: () => {
    clearSession()
    set({ currentStep: 'name', draft: { ...EMPTY_DRAFT } })
  },

  importDraft: (draft) => {
    saveSession(draft, 'review')
    set({ draft, currentStep: 'review' })
  },
}))
