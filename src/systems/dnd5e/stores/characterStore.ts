import { create } from 'zustand'
import type { WizardStep, CharacterDraft, ClassEntry, RaceChoiceSelections, ClassChoiceSelections, AbilityMethod, BackgroundChoiceSelections, EquipmentDraft, SpellChoices, HpMethod, AsiChoice, FeatSelections } from '../types/character'
import type { AbilityScore } from '../types/race'
import type { ChoiceResolution } from '../types/equipment'
import { WIZARD_STEPS, EMPTY_DRAFT } from '../types/character'
import { getClass, subclassChangesSpellcasting } from '../utils/classUtils'
import { getAdditionalLevelsUsed } from '../utils/multiclassUtils'
import { EMPTY_EQUIPMENT_DRAFT } from '../types/equipment'
import { EMPTY_SPELL_CHOICES } from '../types/spell'
import { loadLibrary, saveCharacterEntry, deleteCharacterEntry, newId, type SavedCharacter } from '../utils/storage'
import { canPlayDraft, getFirstIncompleteStep } from '../utils/draftValidation'
import { useAppStore } from '../../../core/stores/appStore'
import { deletePlayState, loadOpenPlayId, saveOpenPlayId } from '../utils/playStorage'
import { usePlayStore } from './playStore'

const initialLibrary = loadLibrary()

/**
 * A ficha que estava aberta no modo de jogo quando a página recarregou (ou o celular descartou a
 * aba). Se ela não existe mais, ou ganhou etapa pendente (ficha antiga com perícia repetida, ficha
 * alterada em outra aba), a marca é limpa e o app abre normalmente: é a regra do "Jogar" da
 * galeria, que só aparece sem pendência. O estado de jogo dela fica guardado para quando voltar.
 */
function findResumablePlay(): SavedCharacter | undefined {
  const id = loadOpenPlayId()
  if (!id) return undefined
  const char = initialLibrary.find(c => c.id === id)
  if (!char || !canPlayDraft(char.draft)) {
    saveOpenPlayId(null)
    return undefined
  }
  return char
}

const resumedPlay = findResumablePlay()

/**
 * Magias que sobrevivem a uma mudança nas escolhas de classe: trocar para (ou de) uma subclasse que
 * conjura (Cavaleiro Arcano, Trapaceiro Arcano) muda a lista e as tabelas, então as escolhas zeram.
 * Qualquer outra troca (a escola do mago, perícias) preserva as magias.
 */
function spellChoicesAfter(
  classId: string | null,
  current: ClassChoiceSelections,
  patch: Partial<ClassChoiceSelections>,
  spellChoices: SpellChoices,
): SpellChoices {
  const cls = classId ? getClass(classId) : undefined
  if (!cls || patch.subclass === undefined) return spellChoices
  return subclassChangesSpellcasting(cls, current.subclass, patch.subclass)
    ? { ...EMPTY_SPELL_CHOICES }
    : spellChoices
}

/** `play`: o modo de jogo (ficha viva), com o estado em `playStore`. */
export type AppView = 'gallery' | 'wizard' | 'print' | 'play'

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
  /** Abre a ficha salva no modo de jogo. A ficha não muda: o jogo grava só o estado de jogo. */
  playCharacter: (id: string) => void
  /** Sai do modo de jogo para a galeria global, sem regravar a ficha. */
  exitPlay: () => void

  setName: (name: string) => void
  setLevel: (level: number) => void
  setHpMethod: (method: HpMethod) => void
  rollHpForLevel: (charLevel: number) => void
  setHpRoll: (charLevel: number, value: number) => void
  setRace: (raceId: string) => void
  /** null volta à raça sem sub-raça (o Humano Padrão, quando a raça tem `baseOption`). */
  setSubrace: (subraceId: string | null) => void
  updateRaceChoices: (choices: Partial<RaceChoiceSelections>) => void
  setClass: (classId: string) => void
  updateClassChoices: (choices: Partial<ClassChoiceSelections>) => void
  /** Escolhas abertas por um talento (Perito, Poliglota, Mestre de Armas), por id do talento. */
  updateFeatSelections: (featId: string, selections: Partial<FeatSelections>) => void
  updateSpellChoices: (choices: Partial<SpellChoices>) => void
  setMulticlass: (enabled: boolean) => void
  addClass: (classId: string) => void
  removeClass: (classId: string) => void
  setAdditionalClassLevel: (classId: string, level: number) => void
  updateAdditionalClassChoices: (classId: string, choices: Partial<ClassChoiceSelections>) => void
  setAdditionalAsiChoice: (classId: string, index: number, choice: AsiChoice | null) => void
  updateAdditionalSpellChoices: (classId: string, choices: Partial<SpellChoices>) => void
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
  goToStep: (step: WizardStep) => void
  reset: () => void
  importDraft: (draft: CharacterDraft) => void
}

/** JSON com as chaves em ordem: dois drafts iguais dão o mesmo texto, qualquer que seja a ordem. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v)
}

const BLANK_DRAFT = canonicalJson(EMPTY_DRAFT)

/**
 * A ficha tem o que guardar: um nome ou alguma escolha fora da etapa Nome (raça, classe,
 * atributos…). O nível sozinho não conta — é o campo ao lado do nome. Ficha nova sem isso não
 * entra na biblioteca, nem navegando: o wizard percorrido em branco não deixa "(sem nome)" na
 * galeria. A que já está lá é sempre atualizada — apagar o nome não descarta as escolhas.
 */
function hasDraftContent(draft: CharacterDraft): boolean {
  if (draft.name.trim()) return true
  return canonicalJson({ ...draft, name: EMPTY_DRAFT.name, level: EMPTY_DRAFT.level }) !== BLANK_DRAFT
}

/** Gravar a ficha aberta: a que já está na biblioteca, sempre; a nova, só com o que guardar. */
function shouldPersist(state: { currentId: string | null; library: SavedCharacter[]; draft: CharacterDraft }): boolean {
  const inLibrary = state.currentId !== null && state.library.some(c => c.id === state.currentId)
  return inLibrary || hasDraftContent(state.draft)
}

/** Persiste a ficha atual na biblioteca e devolve a lista atualizada. */
function persistCurrent(currentId: string | null, draft: CharacterDraft, step: WizardStep): { id: string; library: SavedCharacter[] } {
  const id = currentId ?? newId()
  const library = saveCharacterEntry({ id, updatedAt: Date.now(), step, draft })
  return { id, library }
}

// ── Salvamento automático ────────────────────────────────────────────────────
// Toda alteração do jogador no draft é gravada sozinha, AUTOSAVE_DELAY_MS depois da última
// (cliques em sequência viram uma gravação só). Navegar entre etapas continua gravando na hora,
// e trocar de ficha (abrir, nova, importar, duplicar, galeria, Concluir, jogar) grava antes o que
// estava pendente — o timer nunca dispara depois da troca, então não escreve na ficha errada. O
// modo de jogo nunca chama setter de draft (o estado de jogo vai pelo playStore/playStorage): no
// jogo não há timer, e o pagehide e o exitPlay não têm o que gravar.

/** Espera, depois da última alteração do draft, até gravar a ficha. */
export const AUTOSAVE_DELAY_MS = 400

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

function cancelAutosave(): void {
  if (autosaveTimer === null) return
  clearTimeout(autosaveTimer)
  autosaveTimer = null
}

/**
 * Grava agora a alteração pendente, se houver, pela regra de existência de `shouldPersist`: a
 * ficha que já está na biblioteca é sempre atualizada; a nova só entra com nome ou alguma escolha.
 */
export function flushAutosave(): void {
  if (autosaveTimer === null) return
  cancelAutosave()
  const state = useCharacterStore.getState()
  if (!shouldPersist(state)) return
  const { currentId, draft, currentStep } = state
  const saved = persistCurrent(currentId, draft, currentStep)
  useCharacterStore.setState({ currentId: saved.id, library: saved.library })
}

function scheduleAutosave(): void {
  cancelAutosave()
  autosaveTimer = setTimeout(flushAutosave, AUTOSAVE_DELAY_MS)
}

/**
 * Alteração do jogador no draft: aplica e, se o draft mudou, agenda o salvamento automático.
 * Todo setter de draft passa por aqui; carregar uma ficha (abrir, nova, importar) não.
 */
function editDraft(update: (state: CharacterStore) => Partial<CharacterStore>): void {
  const before = useCharacterStore.getState().draft
  useCharacterStore.setState(update)
  if (useCharacterStore.getState().draft !== before) scheduleAutosave()
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  view: resumedPlay ? 'play' : initialLibrary.length > 0 ? 'gallery' : 'wizard',
  library: initialLibrary,
  currentId: resumedPlay ? resumedPlay.id : initialLibrary.length > 0 ? null : newId(),
  currentStep: resumedPlay?.step ?? 'name',
  draft: resumedPlay?.draft ?? { ...EMPTY_DRAFT },

  newCharacter: () => {
    flushAutosave()
    set({ view: 'wizard', currentId: newId(), currentStep: 'name', draft: { ...EMPTY_DRAFT } })
  },

  openCharacter: (id) => {
    flushAutosave()
    set(state => {
      const char = state.library.find(c => c.id === id)
      if (!char) return {}
      return { view: 'wizard', currentId: id, currentStep: char.step, draft: char.draft }
    })
  },

  duplicateCharacter: (id) => {
    flushAutosave() // a cópia leva a última alteração, se for da ficha aberta
    set(state => {
      const char = state.library.find(c => c.id === id)
      if (!char) return {}
      const copy = structuredClone(char.draft)
      copy.name = `${copy.name} (cópia)`.trim()
      const library = saveCharacterEntry({ id: newId(), updatedAt: Date.now(), step: char.step, draft: copy })
      return { library }
    })
  },

  deleteCharacter: (id) => {
    // excluir a ficha aberta descarta a gravação pendente — senão o timer a recriaria
    if (get().currentId === id) cancelAutosave()
    // Fecha antes de apagar: o close grava as edições pendentes, que não podem ressuscitar o estado.
    if (usePlayStore.getState().characterId === id) usePlayStore.getState().close()
    // O estado de jogo mora em outra chave: some junto com a ficha (playStorage).
    deletePlayState(id)
    if (loadOpenPlayId() === id) saveOpenPlayId(null)
    set(state => {
      const library = deleteCharacterEntry(id)
      return { library, currentId: state.currentId === id ? null : state.currentId }
    })
  },

  goToGallery: () => {
    flushAutosave()
    set(state => {
      // salva a ficha atual antes de sair (se tem o que guardar)
      if (shouldPersist(state)) {
        const { library } = persistCurrent(state.currentId, state.draft, state.currentStep)
        return { view: 'gallery', library }
      }
      return { view: 'gallery' }
    })
    // Sai para a galeria GLOBAL unificada (os dois sistemas juntos), não a galeria interna
    // deste sistema — senão a lista só mostra os personagens deste sistema até dar refresh.
    useAppStore.getState().setActiveSystem(null)
  },

  goToPrint: () => set({ view: 'print' }),
  exitPrint: () => set({ view: 'wizard' }),

  playCharacter: (id) => {
    flushAutosave() // a alteração pendente da ficha aberta vai para ela, não para a do jogo
    const char = get().library.find(c => c.id === id)
    if (!char) return
    set({ view: 'play', currentId: id, currentStep: char.step, draft: char.draft })
    usePlayStore.getState().open(id, char.draft)
    saveOpenPlayId(id)
  },

  exitPlay: () => {
    // O close grava antes as edições em curso (nota digitada sem sair do campo).
    usePlayStore.getState().close()
    saveOpenPlayId(null)
    // Como o `reset`: a ficha já está salva e o jogo não a altera — nada a regravar.
    set({ view: 'gallery', currentId: null })
    useAppStore.getState().setActiveSystem(null)
  },

  setName: (name) => editDraft(state => ({ draft: { ...state.draft, name } })),

  setLevel: (level) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        level: Math.max(1, Math.min(20, level)),
        hpRolls: [],
        spellChoices: { ...EMPTY_SPELL_CHOICES },
        asiChoices: [],
        // mudar o orçamento de nível refaz a alocação de multiclasse
        additionalClasses: [],
      },
    })),

  setHpMethod: (method) =>
    editDraft(state => ({ draft: { ...state.draft, hpMethod: method, hpRolls: [] } })),

  rollHpForLevel: (charLevel) =>
    editDraft(state => {
      const cls = state.draft.class ? getClass(state.draft.class) : undefined
      const hitDie = cls?.hitDie ?? 8
      const roll = Math.floor(Math.random() * hitDie) + 1
      const rolls = [...state.draft.hpRolls]
      rolls[charLevel - 2] = roll
      return { draft: { ...state.draft, hpRolls: rolls } }
    }),

  setHpRoll: (charLevel, value) =>
    editDraft(state => {
      const rolls = [...state.draft.hpRolls]
      rolls[charLevel - 2] = value
      return { draft: { ...state.draft, hpRolls: rolls } }
    }),

  setRace: (raceId) =>
    editDraft(state => ({
      draft: { ...state.draft, race: raceId, subrace: null, raceChoices: {} },
    })),

  setSubrace: (subraceId) =>
    editDraft(state => (state.draft.subrace === subraceId ? {} : {
      draft: { ...state.draft, subrace: subraceId, raceChoices: {} },
    })),

  updateRaceChoices: (choices) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        raceChoices: { ...state.draft.raceChoices, ...choices },
      },
    })),

  setClass: (classId) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        class: classId,
        classChoices: { ...EMPTY_DRAFT.classChoices },
        spellChoices: { ...EMPTY_SPELL_CHOICES },
        equipment: { ...EMPTY_EQUIPMENT_DRAFT },
        asiChoices: [],
        // trocar a classe primária zera a multiclasse (evita conflito com a nova primária)
        additionalClasses: [],
      },
    })),

  updateClassChoices: (choices) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        classChoices: { ...state.draft.classChoices, ...choices },
        spellChoices: spellChoicesAfter(state.draft.class, state.draft.classChoices, choices, state.draft.spellChoices),
      },
    })),

  updateFeatSelections: (featId, selections) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        featSelections: {
          ...state.draft.featSelections,
          [featId]: { ...state.draft.featSelections[featId], ...selections },
        },
      },
    })),

  updateSpellChoices: (choices) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        spellChoices: { ...state.draft.spellChoices, ...choices },
      },
    })),

  setMulticlass: (enabled) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        multiclass: enabled,
        // desligar volta pra classe única (a primária recupera o orçamento inteiro)
        additionalClasses: enabled ? state.draft.additionalClasses : [],
      },
    })),

  addClass: (classId) =>
    editDraft(state => {
      const { draft } = state
      if (classId === draft.class) return {} // não duplica a primária
      if (draft.additionalClasses.some(c => c.classId === classId)) return {} // já presente
      if (getAdditionalLevelsUsed(draft) >= draft.level - 1) return {} // sem orçamento (primária ≥ 1)
      const newEntry: ClassEntry = {
        classId,
        level: 1,
        classChoices: { ...EMPTY_DRAFT.classChoices },
        spellChoices: { ...EMPTY_SPELL_CHOICES },
        asiChoices: [],
        hpRolls: [],
      }
      return { draft: { ...draft, multiclass: true, additionalClasses: [...draft.additionalClasses, newEntry] } }
    }),

  removeClass: (classId) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        additionalClasses: state.draft.additionalClasses.filter(c => c.classId !== classId),
      },
    })),

  setAdditionalClassLevel: (classId, level) =>
    editDraft(state => {
      const { draft } = state
      const others = draft.additionalClasses
        .filter(c => c.classId !== classId)
        .reduce((sum, c) => sum + c.level, 0)
      const maxForThis = draft.level - 1 - others // mantém a primária com ≥ 1 nível
      const clamped = Math.max(1, Math.min(maxForThis, level))
      return {
        draft: {
          ...draft,
          additionalClasses: draft.additionalClasses.map(c =>
            c.classId === classId
              // mudar o nível reseta o que depende dele (magias/ASI/PV), como no setLevel da primária
              ? { ...c, level: clamped, spellChoices: { ...EMPTY_SPELL_CHOICES }, asiChoices: [], hpRolls: [] }
              : c,
          ),
        },
      }
    }),

  updateAdditionalClassChoices: (classId, choices) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        additionalClasses: state.draft.additionalClasses.map(c =>
          c.classId === classId
            ? {
                ...c,
                classChoices: { ...c.classChoices, ...choices },
                spellChoices: spellChoicesAfter(c.classId, c.classChoices, choices, c.spellChoices),
              }
            : c,
        ),
      },
    })),

  setAdditionalAsiChoice: (classId, index, choice) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        additionalClasses: state.draft.additionalClasses.map(c => {
          if (c.classId !== classId) return c
          const asiChoices = [...c.asiChoices]
          if (choice === null) asiChoices.splice(index, 1)
          else asiChoices[index] = choice
          return { ...c, asiChoices }
        }),
      },
    })),

  updateAdditionalSpellChoices: (classId, choices) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        additionalClasses: state.draft.additionalClasses.map(c =>
          c.classId === classId ? { ...c, spellChoices: { ...c.spellChoices, ...choices } } : c,
        ),
      },
    })),

  setAbilityMethod: (method) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        abilityMethod: method,
        abilityScores: method === 'point-buy'
          ? { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }
          : method === 'custom'
            ? { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
            : { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
        rolledValues: [],
      },
    })),

  setAbilityScore: (ability, score) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        abilityScores: { ...state.draft.abilityScores, [ability]: score },
      },
    })),

  setRolledValues: (values) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        rolledValues: values,
        abilityScores: { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
      },
    })),

  setAsiChoice: (index, choice) =>
    editDraft(state => {
      const asiChoices = [...(state.draft.asiChoices ?? [])]
      if (choice === null) {
        asiChoices.splice(index, 1)
      } else {
        asiChoices[index] = choice
      }
      return { draft: { ...state.draft, asiChoices } }
    }),

  setBackground: (backgroundId) =>
    editDraft(state => ({
      draft: { ...state.draft, background: backgroundId, backgroundChoices: {} },
    })),

  updateBackgroundChoices: (choices) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        backgroundChoices: { ...state.draft.backgroundChoices, ...choices },
      },
    })),

  setEquipmentMethod: (method) =>
    editDraft(state => ({
      draft: {
        ...state.draft,
        equipment: { ...state.draft.equipment, method },
      },
    })),

  resolveEquipmentChoice: (choiceIndex, resolution) =>
    editDraft(state => {
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
    editDraft(state => ({
      draft: {
        ...state.draft,
        equipment: { ...state.draft.equipment, rolledGold: gold },
      },
    })),

  addPurchasedItem: (itemId) =>
    editDraft(state => {
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
    editDraft(state => {
      const items = state.draft.equipment.purchasedItems
        .map(i => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter(i => i.quantity > 0)
      return { draft: { ...state.draft, equipment: { ...state.draft.equipment, purchasedItems: items } } }
    }),

  // Avança mesmo com o passo atual incompleto: a ordem de preenchimento é do jogador, e a
  // cobrança das pendências acontece só no fim (ver getMissingSteps e o gate da Revisão).
  nextStep: () => {
    const { currentStep, draft, currentId } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    if (idx < WIZARD_STEPS.length - 1) {
      const next = WIZARD_STEPS[idx + 1]
      cancelAutosave() // a navegação já grava o draft inteiro
      if (!shouldPersist(get())) return set({ currentStep: next })
      const { id, library } = persistCurrent(currentId, draft, next)
      set({ currentStep: next, currentId: id, library })
    }
  },

  prevStep: () => {
    const { currentStep, draft, currentId } = get()
    const idx = WIZARD_STEPS.indexOf(currentStep)
    if (idx > 0) {
      const prev = WIZARD_STEPS[idx - 1]
      cancelAutosave()
      if (!shouldPersist(get())) return set({ currentStep: prev })
      const { id, library } = persistCurrent(currentId, draft, prev)
      set({ currentStep: prev, currentId: id, library })
    }
  },

  // Navegação livre pelo stepper: qualquer etapa, em qualquer ordem, completa ou não —
  // o jogador escolhe por onde começar; a Revisão é quem cobra o que ficou pendente.
  goToStep: (step) => {
    const { currentStep, draft, currentId } = get()
    const targetIdx = WIZARD_STEPS.indexOf(step)
    if (targetIdx < 0 || step === currentStep) return
    cancelAutosave()
    if (!shouldPersist(get())) return set({ currentStep: step })
    const { id, library } = persistCurrent(currentId, draft, step)
    set({ currentStep: step, currentId: id, library })
  },

  // "Concluir/Recomeçar" na Revisão: mantém a ficha salva e volta para a galeria global
  reset: () => {
    flushAutosave()
    const { currentId, draft, currentStep } = get()
    const library = shouldPersist(get())
      ? persistCurrent(currentId, draft, currentStep).library
      : get().library
    set({ view: 'gallery', library, currentId: null })
    useAppStore.getState().setActiveSystem(null)
  },

  importDraft: (draft) => {
    flushAutosave()
    // Ficha importada vira uma nova ficha da biblioteca, retomada no 1º passo pendente
    const step = getFirstIncompleteStep(draft)
    const { id, library } = persistCurrent(newId(), draft, step)
    set({ view: 'wizard', draft, currentStep: step, currentId: id, library })
  },
}))

// Recarregou no meio do jogo: reabre o modo de jogo da mesma ficha (o estado está salvo; o
// desfazer da sessão anterior não volta) e ativa o sistema, para não cair na galeria global.
if (resumedPlay) {
  usePlayStore.getState().open(resumedPlay.id, resumedPlay.draft)
  useAppStore.getState().setActiveSystem('dnd5e')
}

// Fechar a aba (ou sair dela, no celular) durante a espera não perde o último clique.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAutosave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAutosave()
  })
}
