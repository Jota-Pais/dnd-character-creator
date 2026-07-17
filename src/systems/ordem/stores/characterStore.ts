import { create } from 'zustand'
import type { OrdemAttributes, OrdemCharacterDraft, ParanormalPowerChoice, ParanormalSourceKey, WizardStep } from '../types/character'
import type { ParanormalElement } from '../types/ritual'
import { WIZARD_STEPS, EMPTY_DRAFT } from '../types/character'
import { loadLibrary, saveCharacterEntry, deleteCharacterEntry, newId, type SavedCharacter } from '../utils/storage'
import { getFirstIncompleteStep, isStepComplete } from '../utils/draftValidation'
import { useAppStore } from '../../../core/stores/appStore'

const initialLibrary = loadLibrary()

export type AppView = 'gallery' | 'wizard' | 'print'

type CharacterStore = {
  view: AppView
  library: SavedCharacter[]
  currentId: string | null
  currentStep: WizardStep
  draft: OrdemCharacterDraft

  newCharacter: () => void
  openCharacter: (id: string) => void
  duplicateCharacter: (id: string) => void
  deleteCharacter: (id: string) => void
  goToGallery: () => void
  goToPrint: () => void
  exitPrint: () => void

  setName: (name: string) => void
  setNex: (nex: number) => void
  setAttribute: (attribute: keyof OrdemAttributes, value: number) => void
  setOrigin: (originId: string) => void
  setOriginGmSkillChoices: (skillIds: string[]) => void
  setClass: (classId: OrdemCharacterDraft['class']) => void
  setChoiceGroupPick: (groupIndex: number, skillId: string) => void
  setFreeSkillChoices: (skillIds: string[]) => void
  setTrilha: (trilhaId: string) => void
  setPowerChoice: (slotIndex: number, powerId: string) => void
  setAttributeIncreaseChoice: (slotIndex: number, attribute: keyof OrdemAttributes) => void
  setSkillGradeChoice: (slotIndex: number, skillIds: string[]) => void
  setVersatilityChoice: (choice: OrdemCharacterDraft['versatilityChoice']) => void
  setParanormalPowerChoice: (sourceKey: ParanormalSourceKey, powerId: string | null) => void
  setParanormalSubChoice: (sourceKey: ParanormalSourceKey, sub: Partial<Omit<ParanormalPowerChoice, 'powerId'>>) => void
  setAffinityElement: (element: ParanormalElement | null) => void
  updateDraft: (partial: Partial<OrdemCharacterDraft>) => void

  nextStep: () => void
  prevStep: () => void
  goToStep: (step: WizardStep) => void
  reset: () => void
  importDraft: (draft: OrdemCharacterDraft) => void
}

function persistCurrent(currentId: string | null, draft: OrdemCharacterDraft, step: WizardStep): { id: string; library: SavedCharacter[] } {
  const id = currentId ?? newId()
  const library = saveCharacterEntry({ id, updatedAt: Date.now(), step, draft })
  return { id, library }
}

export const useOrdemStore = create<CharacterStore>((set, get) => ({
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

  goToGallery: () => {
    set(state => {
      if (state.draft.name.trim()) {
        const { library } = persistCurrent(state.currentId, state.draft, state.currentStep)
        return { view: 'gallery', library }
      }
      return { view: 'gallery' }
    })
    // Sai para a galeria GLOBAL unificada (os dois sistemas juntos), não a galeria interna.
    useAppStore.getState().setActiveSystem(null)
  },

  goToPrint: () => set({ view: 'print' }),
  exitPrint: () => set({ view: 'wizard' }),

  setName: (name) => set(state => ({ draft: { ...state.draft, name } })),

  setNex: (nex) => set(state => ({ draft: { ...state.draft, nex } })),

  setAttribute: (attribute, value) =>
    set(state => ({
      draft: { ...state.draft, attributes: { ...state.draft.attributes, [attribute]: value } },
    })),

  setOrigin: (originId) =>
    set(state => ({
      draft: { ...state.draft, origin: originId, originGmSkillChoices: [] },
    })),

  setOriginGmSkillChoices: (skillIds) =>
    set(state => ({ draft: { ...state.draft, originGmSkillChoices: skillIds } })),

  setClass: (classId) =>
    set(state => ({
      draft: {
        ...state.draft,
        class: classId,
        classChoiceGroupPicks: [],
        classFreeSkillChoices: [],
        trilha: null,
        powerChoices: [],
        attributeIncreaseChoices: [],
        skillGradeChoices: [],
        versatilityChoice: null,
        // Rituais são exclusivos do Ocultista — trocar de classe descarta escolhas
        // anteriores para não vazar rituais numa ficha de não-conjurador.
        ritualChoices: [],
        ritualElementChoices: {},
        // Poderes paranormais de slots/Versatilidade pertencem à classe descartada; o da
        // origem (Traços do Outro Lado) sobrevive. `affinityElement` depende só de NEX.
        paranormalPowerChoices: state.draft.paranormalPowerChoices.origin
          ? { origin: state.draft.paranormalPowerChoices.origin }
          : {},
      },
    })),

  setChoiceGroupPick: (groupIndex, skillId) =>
    set(state => {
      const picks = [...state.draft.classChoiceGroupPicks]
      picks[groupIndex] = skillId
      return { draft: { ...state.draft, classChoiceGroupPicks: picks } }
    }),

  setFreeSkillChoices: (skillIds) =>
    set(state => ({ draft: { ...state.draft, classFreeSkillChoices: skillIds } })),

  setTrilha: (trilhaId) =>
    set(state => ({ draft: { ...state.draft, trilha: trilhaId } })),

  setPowerChoice: (slotIndex, powerId) =>
    set(state => {
      const choices = [...state.draft.powerChoices]
      const changed = choices[slotIndex] !== powerId
      choices[slotIndex] = powerId
      if (!changed) return { draft: { ...state.draft, powerChoices: choices } }
      // Trocar o poder do slot descarta os parâmetros da instância antiga — senão um
      // skill-training→element-specialist herda 2 perícias num spec de 1 elemento e
      // arePowerParamsComplete nunca valida o passo.
      const powerParams = { ...state.draft.powerParams }
      delete powerParams[`slot-${slotIndex}`]
      return { draft: { ...state.draft, powerChoices: choices, powerParams } }
    }),

  setAttributeIncreaseChoice: (slotIndex, attribute) =>
    set(state => {
      const choices = [...state.draft.attributeIncreaseChoices]
      choices[slotIndex] = attribute
      return { draft: { ...state.draft, attributeIncreaseChoices: choices } }
    }),

  setSkillGradeChoice: (slotIndex, skillIds) =>
    set(state => {
      const choices = [...state.draft.skillGradeChoices]
      choices[slotIndex] = skillIds
      return { draft: { ...state.draft, skillGradeChoices: choices } }
    }),

  setVersatilityChoice: (choice) =>
    set(state => {
      const prev = state.draft.versatilityChoice
      const samePower = prev?.kind === 'power' && choice?.kind === 'power' && prev.powerId === choice.powerId
      if (samePower) return { draft: { ...state.draft, versatilityChoice: choice } }
      // Mesma limpeza do setPowerChoice, para a instância 'versatility'.
      const powerParams = { ...state.draft.powerParams }
      delete powerParams['versatility']
      return { draft: { ...state.draft, versatilityChoice: choice, powerParams } }
    }),

  // Trocar o poder da instância zera as sub-escolhas (sub-escolha de outro poder nunca
  // sobrevive à troca); null remove a entrada da fonte.
  setParanormalPowerChoice: (sourceKey, powerId) =>
    set(state => {
      const choices = { ...state.draft.paranormalPowerChoices }
      if (powerId === null) delete choices[sourceKey]
      else choices[sourceKey] = { powerId }
      return { draft: { ...state.draft, paranormalPowerChoices: choices } }
    }),

  setParanormalSubChoice: (sourceKey, sub) =>
    set(state => {
      const current = state.draft.paranormalPowerChoices[sourceKey]
      if (!current) return {}
      return {
        draft: {
          ...state.draft,
          paranormalPowerChoices: { ...state.draft.paranormalPowerChoices, [sourceKey]: { ...current, ...sub } },
        },
      }
    }),

  setAffinityElement: (element) =>
    set(state => ({ draft: { ...state.draft, affinityElement: element } })),

  updateDraft: (partial) =>
    set(state => ({ draft: { ...state.draft, ...partial } })),

  nextStep: () => {
    const { currentStep, draft, currentId } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
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

  // Navegação livre pelo stepper: pra trás sempre; pra frente, só até o 1º passo incompleto
  // (o mesmo alcance de apertar "próximo" repetidamente — nunca pula validação).
  goToStep: (step) => {
    const { currentStep, draft, currentId } = get()
    const targetIdx = WIZARD_STEPS.indexOf(step)
    if (targetIdx < 0 || step === currentStep) return
    const firstIncomplete = WIZARD_STEPS.findIndex(s => !isStepComplete(draft, s))
    const maxIdx = firstIncomplete === -1 ? WIZARD_STEPS.length - 1 : firstIncomplete
    if (targetIdx > maxIdx) return
    const { id, library } = persistCurrent(currentId, draft, step)
    set({ currentStep: step, currentId: id, library })
  },

  reset: () => {
    const { currentId, draft, currentStep } = get()
    const library = draft.name.trim()
      ? persistCurrent(currentId, draft, currentStep).library
      : get().library
    set({ view: 'gallery', library, currentId: null })
    useAppStore.getState().setActiveSystem(null)
  },

  importDraft: (draft) => {
    const step = getFirstIncompleteStep(draft)
    const { id, library } = persistCurrent(newId(), draft, step)
    set({ view: 'wizard', draft, currentStep: step, currentId: id, library })
  },
}))
