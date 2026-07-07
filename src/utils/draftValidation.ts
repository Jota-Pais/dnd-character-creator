import type {
  CharacterDraft,
  WizardStep,
  AbilityMethod,
  BaseAbilityScores,
  RaceChoiceSelections,
  ClassChoiceSelections,
  SpellChoices,
  EquipmentDraft,
  BackgroundChoiceSelections,
} from '../types/character'
import { WIZARD_STEPS } from '../types/character'
import type { GameClass, SubclassChoiceSelections } from '../types/class'
import type { ChoiceResolution, InventoryItem } from '../types/equipment'
import type { AbilityScore } from '../types/race'
import { getRace, getSubrace, isRaceStepComplete } from './raceUtils'
import { getClass, getSubclass, isClassStepComplete } from './classUtils'
import { getBackground, isBackgroundStepComplete } from './backgroundUtils'
import { isAbilitiesStepComplete } from './abilityScoreUtils'
import { getSpell, isSpellStepComplete } from './spellUtils'
import { isEquipmentStepComplete } from './equipmentUtils'

const ABILITY_KEYS: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const ABILITY_METHODS: string[] = ['standard-array', 'point-buy', 'roll']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toIntInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  return value < min || value > max ? null : value
}

function emptyClassChoices(): ClassChoiceSelections {
  return {
    skills: [],
    subclass: null,
    fightingStyle: null,
    expertiseItems: [],
    tools: [],
    subclassExtras: {},
  }
}

function emptyEquipment(): EquipmentDraft {
  return { method: null, classResolutions: [], rolledGold: null, purchasedItems: [] }
}

function sanitizeRaceChoices(raw: unknown): RaceChoiceSelections {
  if (!isRecord(raw)) return {}
  const choices: RaceChoiceSelections = {}
  const abilityBonuses = toStringArray(raw.abilityBonuses).filter((a): a is AbilityScore =>
    (ABILITY_KEYS as string[]).includes(a),
  )
  if (abilityBonuses.length > 0) choices.abilityBonuses = abilityBonuses
  const skills = toStringArray(raw.skills)
  if (skills.length > 0) choices.skills = skills
  const languages = toStringArray(raw.languages)
  if (languages.length > 0) choices.languages = languages
  const tools = toStringArray(raw.tools)
  if (tools.length > 0) choices.tools = tools
  if (typeof raw.cantrip === 'string') choices.cantrip = raw.cantrip
  if (typeof raw.feat === 'string') choices.feat = raw.feat
  return choices
}

function sanitizeClassChoices(raw: unknown, cls: GameClass | null): ClassChoiceSelections {
  if (!isRecord(raw) || !cls) return emptyClassChoices()

  const extrasRaw = isRecord(raw.subclassExtras) ? raw.subclassExtras : {}
  const subclassExtras: SubclassChoiceSelections = {}
  const extraSkills = toStringArray(extrasRaw.skills)
  if (extraSkills.length > 0) subclassExtras.skills = extraSkills
  const extraLanguages = toStringArray(extrasRaw.languages)
  if (extraLanguages.length > 0) subclassExtras.languages = extraLanguages
  if (typeof extrasRaw.cantrip === 'string') subclassExtras.cantrip = extrasRaw.cantrip

  const subclassId = typeof raw.subclass === 'string' ? raw.subclass : null

  return {
    skills: toStringArray(raw.skills),
    subclass: subclassId !== null && getSubclass(cls, subclassId) ? subclassId : null,
    fightingStyle: typeof raw.fightingStyle === 'string' ? raw.fightingStyle : null,
    expertiseItems: toStringArray(raw.expertiseItems),
    tools: toStringArray(raw.tools),
    subclassExtras,
  }
}

function sanitizeSpellChoices(raw: unknown): SpellChoices {
  if (!isRecord(raw)) return { cantrips: [], spells: [] }
  return {
    cantrips: toStringArray(raw.cantrips).filter(id => getSpell(id) !== undefined),
    spells: toStringArray(raw.spells).filter(id => getSpell(id) !== undefined),
  }
}

function sanitizeBackgroundChoices(raw: unknown): BackgroundChoiceSelections {
  if (!isRecord(raw)) return {}
  const choices: BackgroundChoiceSelections = {}
  const languages = toStringArray(raw.languages)
  if (languages.length > 0) choices.languages = languages
  const tools = toStringArray(raw.tools)
  if (tools.length > 0) choices.tools = tools
  return choices
}

function sanitizeEquipment(raw: unknown): EquipmentDraft {
  if (!isRecord(raw)) return emptyEquipment()

  const method = raw.method === 'standard' || raw.method === 'wealth' ? raw.method : null

  const resolutionsRaw: unknown[] = Array.isArray(raw.classResolutions) ? raw.classResolutions : []
  const classResolutions: ChoiceResolution[] = resolutionsRaw.map(entry => {
    if (!isRecord(entry)) return { optionIndex: -1, pickedIds: [] }
    return {
      optionIndex: toIntInRange(entry.optionIndex, -1, 999) ?? -1,
      pickedIds: toStringArray(entry.pickedIds),
    }
  })

  const rolledGold =
    typeof raw.rolledGold === 'number' && Number.isFinite(raw.rolledGold) && raw.rolledGold >= 0
      ? raw.rolledGold
      : null

  const itemsRaw: unknown[] = Array.isArray(raw.purchasedItems) ? raw.purchasedItems : []
  const purchasedItems: InventoryItem[] = itemsRaw.flatMap(entry => {
    if (!isRecord(entry) || typeof entry.itemId !== 'string') return []
    const source =
      entry.source === 'class' || entry.source === 'background' || entry.source === 'purchased'
        ? entry.source
        : 'purchased'
    return [{ itemId: entry.itemId, quantity: toIntInRange(entry.quantity, 1, 9999) ?? 1, source }]
  })

  return { method, classResolutions, rolledGold, purchasedItems }
}

/**
 * Reconstrói um CharacterDraft seguro a partir de um JSON externo (import de ficha).
 * Campos ausentes ou com tipo errado caem nos padrões do draft vazio; referências a
 * raça/classe/antecedente/sub-raça/magias que não existem nos dados são descartadas.
 * Retorna null apenas se o objeto não se parece minimamente com uma ficha exportada.
 */
export function sanitizeImportedDraft(raw: unknown): CharacterDraft | null {
  if (!isRecord(raw)) return null
  if (typeof raw.name !== 'string' || !isRecord(raw.abilityScores)) return null

  const level =
    typeof raw.level === 'number' && Number.isInteger(raw.level)
      ? Math.max(1, Math.min(20, raw.level))
      : 1

  const race = typeof raw.race === 'string' ? (getRace(raw.race) ?? null) : null
  const subrace =
    race && typeof raw.subrace === 'string' ? (getSubrace(race, raw.subrace) ?? null) : null
  const cls = typeof raw.class === 'string' ? (getClass(raw.class) ?? null) : null
  const background =
    typeof raw.background === 'string' ? (getBackground(raw.background) ?? null) : null

  const scoresRaw = raw.abilityScores
  const abilityScores = {} as BaseAbilityScores
  for (const key of ABILITY_KEYS) {
    abilityScores[key] = toIntInRange(scoresRaw[key], 1, 30)
  }

  const abilityMethod =
    typeof raw.abilityMethod === 'string' && ABILITY_METHODS.includes(raw.abilityMethod)
      ? (raw.abilityMethod as AbilityMethod)
      : null

  const rolledValues = Array.isArray(raw.rolledValues)
    ? raw.rolledValues
        .filter((v): v is number => toIntInRange(v, 3, 18) !== null)
        .slice(0, 6)
    : []

  // hpRolls é posicional (índice = nível do personagem - 2); entradas inválidas viram
  // buracos, que o cálculo de PV já preenche com a média do dado de vida
  const hitDie = cls?.hitDie ?? 12
  const hpRolls: number[] = []
  const hpRollsRaw: unknown[] = Array.isArray(raw.hpRolls) ? raw.hpRolls : []
  hpRollsRaw.slice(0, Math.max(0, level - 1)).forEach((value, index) => {
    const roll = toIntInRange(value, 1, hitDie)
    if (roll !== null) hpRolls[index] = roll
  })

  return {
    name: raw.name.slice(0, 60),
    level,
    race: race?.id ?? null,
    subrace: subrace?.id ?? null,
    raceChoices: race ? sanitizeRaceChoices(raw.raceChoices) : {},
    class: cls?.id ?? null,
    classChoices: sanitizeClassChoices(raw.classChoices, cls),
    spellChoices: cls ? sanitizeSpellChoices(raw.spellChoices) : { cantrips: [], spells: [] },
    abilityMethod,
    abilityScores,
    rolledValues,
    background: background?.id ?? null,
    backgroundChoices: background ? sanitizeBackgroundChoices(raw.backgroundChoices) : {},
    equipment: cls ? sanitizeEquipment(raw.equipment) : emptyEquipment(),
    hpMethod: raw.hpMethod === 'roll' ? 'roll' : 'average',
    hpRolls,
  }
}

/**
 * Percorre os passos do wizard na ordem e devolve o primeiro que ainda não está
 * completo — usado para levar uma ficha importada ao ponto certo do fluxo em vez
 * de assumir que ela está pronta para a Revisão.
 */
export function getFirstIncompleteStep(draft: CharacterDraft): WizardStep {
  const race = draft.race ? (getRace(draft.race) ?? null) : null
  const subrace = race && draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  const cls = draft.class ? (getClass(draft.class) ?? null) : null
  const background = draft.background ? (getBackground(draft.background) ?? null) : null

  const complete: Record<WizardStep, boolean> = {
    name: draft.name.trim().length > 0,
    race: isRaceStepComplete(race, subrace, draft.raceChoices),
    // Subclasse validada como nível 1 até o seletor por nível existir (fase 2 do roadmap)
    class: isClassStepComplete(cls, draft.classChoices),
    abilities: isAbilitiesStepComplete(draft.abilityMethod, draft.abilityScores, draft.rolledValues),
    spells: isSpellStepComplete(cls, draft.spellChoices, draft.level),
    background: isBackgroundStepComplete(background, draft.backgroundChoices),
    equipment: isEquipmentStepComplete(draft.equipment, cls?.startingEquipment),
    review: true,
  }

  for (const step of WIZARD_STEPS) {
    if (!complete[step]) return step
  }
  return 'review'
}
