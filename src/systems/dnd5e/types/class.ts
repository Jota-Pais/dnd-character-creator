import type { AbilityScore } from './race'
import type { ClassStartingEquipment } from './equipment'

export type SpellcastingType = 'known' | 'prepared' | 'hybrid'

export type ClassSpellcasting = {
  ability: AbilityScore
  cantripsKnown: number
  type: SpellcastingType
  spellsAtLevel1: number
  preparedFormula: string | null
  ritualCasting: boolean
  focus: string
  castingStartsAtLevel: number
}

export type SubclassExtraChoices = {
  expertiseSkills: { count: number; from: string[] } | null
  skillChoice: { count: number; from: string[] } | null
  languages: { count: number } | null
  cantripChoice: string | null
  grantedLanguages: string[]
  grantedArmorProficiencies: string[]
  grantedWeaponProficiencies: string[]
}

export type ClassFeature = { name: string; description: string }

/** Feature ganha em um nível específico (progressão 1–20). */
export type LevelFeature = ClassFeature & { level: number }

export type ClassSubclass = {
  id: string
  name: string
  description: string
  features: ClassFeature[]
  /** Features da subclasse por nível (2–20). Preenchido na fase 3 do roadmap. */
  featuresByLevel?: LevelFeature[]
  /** Só Cavaleiro Arcano / Trapaceiro Arcano conjuram (third-caster); as demais subclasses omitem. */
  casterProgression?: CasterProgression
  extras: SubclassExtraChoices | null
}

export type ClassToolProficiencies = {
  granted: string[]
  choices: { count: number; from: 'musical-instrument' | 'artisan' | 'any-tool' }[]
}

/** Categorias de proficiência de armadura (PHB). */
export type ArmorProficiency = 'light' | 'medium' | 'heavy' | 'shields'

/**
 * Progressão de conjuração da classe para o cálculo de multiclasse (livro pág. 166-167):
 * full = níveis contam inteiros; half = metade (⌊÷2⌋); third = um terço (⌊÷3⌋, só via
 * subclasse Cavaleiro Arcano/Trapaceiro Arcano); pact = Magia de Pacto (pool separado);
 * none = não conjura.
 */
export type CasterProgression = 'full' | 'half' | 'third' | 'pact' | 'none'

/** Pré-requisito de atributo para multiclassar (livro pág. 166; mínimo sempre 13). */
export type MulticlassPrereq = { mode: 'all' | 'any'; abilities: AbilityScore[] }

/** Proficiências ganhas ao multiclassar NESTA classe (livro pág. 166 — subconjunto das iniciais). */
export type MulticlassProficiencies = {
  armor: ArmorProficiency[]
  weapons: string[]
  tools: string[]
  skills: { count: number; from: 'any' | 'class-list' } | null
  instruments: number
}

export type GameClass = {
  id: string
  name: string
  description: string
  primaryAbility: AbilityScore[]
  hitDie: number
  savingThrows: AbilityScore[]
  skillChoices: { count: number; from: string[] }
  toolProficiencies: ClassToolProficiencies
  /** Proficiências de armadura da classe (concedidas por completo só à 1ª classe na multiclasse). */
  armorProficiencies: ArmorProficiency[]
  /** Proficiências de arma: tokens 'simple'/'martial' e/ou armas específicas. */
  weaponProficiencies: string[]
  /** Progressão de conjuração p/ multiclasse; a subclasse pode elevar p/ 'third'. */
  casterProgression: CasterProgression
  multiclassPrereq: MulticlassPrereq
  multiclassProficiencies: MulticlassProficiencies
  isCaster: boolean
  spellcasting: ClassSpellcasting | null
  features: ClassFeature[]
  /** Features da classe por nível (1–20). Preenchido na fase 3 do roadmap. */
  featuresByLevel?: LevelFeature[]
  subclassLevel: number
  subclasses: ClassSubclass[]
  hasFightingStyle: boolean
  hasExpertise: boolean
  startingEquipment: ClassStartingEquipment
}

export type SubclassChoiceSelections = {
  skills?: string[]
  languages?: string[]
  cantrip?: string
}

export type ClassChoiceSelections = {
  skills: string[]
  subclass: string | null
  fightingStyle: string | null
  expertiseItems: string[]
  tools: string[]
  subclassExtras: SubclassChoiceSelections
  progressionChoices: Record<string, string[]>
}

export const EMPTY_CLASS_CHOICES: ClassChoiceSelections = {
  skills: [],
  subclass: null,
  fightingStyle: null,
  expertiseItems: [],
  tools: [],
  subclassExtras: {},
  progressionChoices: {},
}
