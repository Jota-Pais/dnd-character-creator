import { create } from 'zustand'
import type { WizardStep, CharacterDraft, RaceChoiceSelections, ClassChoiceSelections, AbilityMethod, BackgroundChoiceSelections, EquipmentDraft, SpellChoices, HpMethod, AsiChoice } from '../types/character'
import type { AbilityScore } from '../types/race'
import type { ChoiceResolution } from '../types/equipment'
import { WIZARD_STEPS, EMPTY_DRAFT } from '../types/character'
import { getClass } from '../utils/classUtils'
import { EMPTY_EQUIPMENT_DRAFT } from '../types/equipment'
import { EMPTY_SPELL_CHOICES } from '../types/spell'
import { loadLibrary, saveCharacterEntry, deleteCharacterEntry, newId, type SavedCharacter } from '../utils/storage'
import { getFirstIncompleteStep, isStepComplete } from '../utils/draftValidation'

const initialLibrary = loadLibrary()

export type AppView = 'gallery' | 'wizard' | 'print'

type CharacterStore = {
  view: AppView
  library: SavedCharacter[]
  currentId: string | null
  currentStep: WizardStep
  draft: CharacterDraft

  // biblioteca
  newCharacter: () => void
  openCharacter: (id: string) => void
  duplicateCharacter: (id: string) => void
  deleteCharacter: (id: string) => void
  goToGallery: () => void
  goToPrint: () => void
  exitPrint: () => void

  setName: (name: string) => void
  setLevel: (level: number) => void
  setHpMethod: (method: HpMethod) => void
  rollHpForLevel: (charLevel: number) => void
  setHpRoll: (charLevel: number, value: number) => void
  setRace: (raceId: string) => void
  setSubrace: (subraceId: string) => void
  updateRaceChoices: (choices: Partial<RaceChoiceSelections>) => void
  setClass: (classId: string) => void
  updateClassChoices: (choices: Partial<ClassChoiceSelections>) => void
  updateSpellChoices: (choices: Partial<SpellChoices>) => void
  setAbilityMethod: (method: AbilityMethod) => void
  setAbilityScore: (ability: AbilityScore, score: number | null) => void
  setRolledValues: (values: number[]) => void
  setAsiChoice: (index: number, choice: AsiChoice | null) => void
  setBackground: (backgroundId: string) => void
  updateBackgroundChoices: (choices: Partial<BackgroundChoiceSelections>) => void
  setEquipmentMethod: (method: EquipmentDraft['method']) => void
  resolveEquipmentChoice: (choiceIndex: number, resolution: ChoiceResolution) => void
  setRolledGold: (gold: number | null) => void
  addPurchasedItem: (itemId: string) => void
  removePurchasedItem: (itemId: string) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
  importDraft: (draft: CharacterDraft) => void
}

/** Persiste a ficha atual na biblioteca e devolve a lista atualizada. */
function persistCurrent(currentId: string | null, draft: CharacterDraft, step: WizardStep): { id: string; library: SavedCharacter[] } {
  const id = currentId ?? newId()
  const library = saveCharacterEntry({ id, updatedAt: Date.now(), step, draft })
  return { id, library }
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  view: initialLibrary.length > 0 ? 'gallery' : 'wizard',
  library: initialLibrary,
  currentId: initialLibrary.length > 0 ? null : newId(),
  currentStep: 'name',
  draft: { ...EMPTY_DRAFT },

  newCharacter: () =>
    set({ view: 'wizard', currentId: newId(), currentStep: 'name', draft: { ...EMPTY_DRAFT } }),

  openCharacter: (id) =>
    set(state => {
      const char = state.library.find(c => c.id === id)
      if (!char) return {}
      return { view: 'wizard', currentId: id, currentStep: char.step, draft: char.draft }
    }),

  duplicateCharacter: (id) =>
    set(state => {
      const char = state.library.find(c => c.id === id)
      if (!char) return {}
      const copy = structuredClone(char.draft)
      copy.name = `${copy.name} (cópia)`.trim()
      const library = saveCharacterEntry({ id: newId(), updatedAt: Date.now(), step: char.step, draft: copy })
      return { library }
    }),

  deleteCharacter: (id) =>
    set(state => {
      const library = deleteCharacterEntry(id)
      return { library, currentId: state.currentId === id ? null : state.currentId }
    }),

  goToGallery: () =>
    set(state => {
      // salva a ficha atual antes de sair (se tem nome, vale a pena guardar)
      if (state.draft.name.trim()) {
        const { library } = persistCurrent(state.currentId, state.draft, state.currentStep)
        return { view: 'gallery', library }
      }
      return { view: 'gallery' }
    }),

  goToPrint: () => set({ view: 'print' }),
  exitPrint: () => set({ view: 'wizard' }),

  setName: (name) => set(state => ({ draft: { ...state.draft, name } })),

  setLevel: (level) =>
    set(state => ({
      draft: {
        ...state.draft,
        level: Math.max(1, Math.min(20, level)),
        hpRolls: [],
        spellChoices: { ...EMPTY_SPELL_CHOICES },
        asiChoices: [],
      },
    })),

  setHpMethod: (method) =>
    set(state => ({ draft: { ...state.draft, hpMethod: method, hpRolls: [] } })),

  rollHpForLevel: (charLevel) =>
    set(state => {
      const cls = state.draft.class ? getClass(state.draft.class) : undefined
      const hitDie = cls?.hitDie ?? 8
      const roll = Math.floor(Math.random() * hitDie) + 1
      const rolls = [...state.draft.hpRolls]
      rolls[charLevel - 2] = roll
      return { draft: { ...state.draft, hpRolls: rolls } }
    }),

  setHpRoll: (charLevel, value) =>
    set(state => {
      const rolls = [...state.draft.hpRolls]
      rolls[charLevel - 2] = value
      return { draft: { ...state.draft, hpRolls: rolls } }
    }),

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
        asiChoices: [],
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

  setAsiChoice: (index, choice) =>
    set(state => {
      const asiChoices = [...(state.draft.asiChoices ?? [])]
      if (choice === null) {
        asiChoices.splice(index, 1)
      } else {
        asiChoices[index] = choice
      }
      return { draft: { ...state.draft, asiChoices } }
    }),

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

  addPurchasedItem: (itemId) =>
    set(state => {
      const items = [...state.draft.equipment.purchasedItems]
      const existing = items.find(i => i.itemId === itemId)
      if (existing) {
        existing.quantity += 1
      } else {
        items.push({ itemId, quantity: 1, source: 'purchased' })
      }
      return { draft: { ...state.draft, equipment: { ...state.draft.equipment, purchasedItems: items } } }
    }),

  removePurchasedItem: (itemId) =>
    set(state => {
      const items = state.draft.equipment.purchasedItems
        .map(i => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter(i => i.quantity > 0)
      return { draft: { ...state.draft, equipment: { ...state.draft.equipment, purchasedItems: items } } }
    }),

  nextStep: () => {
    const { currentStep, draft, currentId } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    // Defesa em profundidade: além do botão desabilitado na UI, o store não
    // avança enquanto o passo atual estiver incompleto
    if (!isStepComplete(draft, currentStep)) return
    if (idx < WIZARD_STEPS.length - 1) {
      const next = WIZARD_STEPS[idx + 1]
      const { id, library } = persistCurrent(currentId, draft, next)
      set({ currentStep: next, currentId: id, library })
    }
  },

  prevStep: () => {
    const { currentStep, draft, currentId } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    if (idx > 0) {
      const prev = WIZARD_STEPS[idx - 1]
      const { id, library } = persistCurrent(currentId, draft, prev)
      set({ currentStep: prev, currentId: id, library })
    }
  },

  // "Recomeçar" na Revisão: mantém a ficha salva e volta para a galeria
  reset: () => {
    const { currentId, draft, currentStep } = get()
    const library = draft.name.trim()
      ? persistCurrent(currentId, draft, currentStep).library
      : get().library
    set({ view: 'gallery', library, currentId: null })
  },

  importDraft: (draft) => {
    // Ficha importada vira uma nova ficha da biblioteca, retomada no 1º passo pendente
    const step = getFirstIncompleteStep(draft)
    const { id, library } = persistCurrent(newId(), draft, step)
    set({ view: 'wizard', draft, currentStep: step, currentId: id, library })
  },
}))
