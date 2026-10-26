import type { AbilityScore } from './race'
import type { ClassChoiceSelections } from './class'
import type { BackgroundChoiceSelections } from './background'
import { type EquipmentDraft, EMPTY_EQUIPMENT_DRAFT } from './equipment'
import { type SpellChoices, EMPTY_SPELL_CHOICES } from './spell'
export type { ClassChoiceSelections, BackgroundChoiceSelections, EquipmentDraft, SpellChoices }

export type WizardStep = 'name' | 'race' | 'class' | 'spells' | 'abilities' | 'improvements' | 'background' | 'equipment' | 'review'

export type AbilityMethod = 'standard-array' | 'point-buy' | 'roll' | 'custom'

export type BaseAbilityScores = Record<AbilityScore, number | null>

/**
 * Escolha de um espaço de Incremento no Valor de Habilidade (ASI):
 * aumentar um atributo em +2 ou dois atributos em +1 cada, ou pegar um talento.
 */
export type AsiChoice =
  | { kind: 'asi'; abilities: AbilityScore[] }
  | { kind: 'feat'; featId: string; abilities?: AbilityScore[] }

export const WIZARD_STEPS: WizardStep[] = [
  'name',
  'race',
  'class',
  'abilities',
  'improvements',
  'spells',
  'background',
  'equipment',
  'review',
]

export const STEP_LABELS: Record<WizardStep, string> = {
  name: 'Nome',
  race: 'Raça',
  class: 'Classe',
  spells: 'Magias',
  abilities: 'Atributos',
  improvements: 'Aprimoramentos',
  background: 'Antecedente',
  equipment: 'Equipamento',
  review: 'Revisão',
}

export type RaceChoiceSelections = {
  abilityBonuses?: AbilityScore[]
  skills?: string[]
  languages?: string[]
  tools?: string[]
  cantrip?: string
  feat?: string
  /** Atributo do +1 quando o talento racial (Humano Variante) é um meio-talento. */
  featAbility?: AbilityScore
}

/**
 * O que o jogador escolheu dentro de um talento que abre escolhas (Perito, Poliglota, Mestre de
 * Armas, Adepto Marcial). Indexado por id do talento no draft: o livro não deixa pegar o mesmo
 * talento duas vezes, então uma entrada por talento basta — e evita espalhar seleção por
 * AsiChoice e raça.
 */
export type FeatSelections = {
  skills?: string[]
  tools?: string[]
  languages?: string[]
  weapons?: string[]
  /** Manobras do Mestre de Batalha aprendidas pelo talento (Adepto Marcial, p. 167). */
  maneuvers?: string[]
}

export type HpMethod = 'average' | 'roll'

/**
 * Uma classe adicional na multiclasse (além da primária). A classe primária continua nos
 * campos de topo do draft (`class`, `classChoices`, `spellChoices`, `asiChoices`, `hpRolls`);
 * estas são as classes "secundárias". `level` é o nível NESTA classe (não o total).
 * `hpRolls` são as rolagens de PV dos níveis desta classe (método 'roll'); como nenhum nível
 * de classe secundária usa o dado máximo, o índice i corresponde ao i-ésimo nível dela.
 */
export type ClassEntry = {
  classId: string
  level: number
  classChoices: ClassChoiceSelections
  spellChoices: SpellChoices
  asiChoices: AsiChoice[]
  hpRolls: number[]
}

export type CharacterDraft = {
  name: string
  /** Nível de personagem TOTAL (orçamento). O nível da classe primária = level − Σ additionalClasses. */
  level: number
  race: string | null
  subrace: string | null
  raceChoices: RaceChoiceSelections
  class: string | null
  classChoices: ClassChoiceSelections
  spellChoices: SpellChoices
  /** Classes além da primária (vazio = personagem de classe única). */
  additionalClasses: ClassEntry[]
  /** Portão de UX do passo Nome (Fase 3). A mecânica deriva de additionalClasses.length. */
  multiclass: boolean
  abilityMethod: AbilityMethod | null
  abilityScores: BaseAbilityScores
  rolledValues: number[]
  asiChoices: AsiChoice[]
  /** Escolhas feitas dentro de talentos que abrem escolhas, por id do talento. */
  featSelections: Record<string, FeatSelections>
  background: string | null
  backgroundChoices: BackgroundChoiceSelections
  equipment: EquipmentDraft
  hpMethod: HpMethod
  hpRolls: number[]
}

export const EMPTY_DRAFT: CharacterDraft = {
  name: '',
  level: 1,
  race: null,
  subrace: null,
  raceChoices: {},
  class: null,
  classChoices: {
    skills: [],
    subclass: null,
    fightingStyle: null,
    expertiseItems: [],
    tools: [],
    subclassExtras: {},
    progressionChoices: {},
  },
  spellChoices: { ...EMPTY_SPELL_CHOICES },
  additionalClasses: [],
  multiclass: false,
  abilityMethod: null,
  abilityScores: { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null },
  rolledValues: [],
  asiChoices: [],
  featSelections: {},
  background: null,
  backgroundChoices: {},
  equipment: EMPTY_EQUIPMENT_DRAFT,
  hpMethod: 'average',
  hpRolls: [],
}
