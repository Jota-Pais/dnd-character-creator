import type { AbilityScore } from './race'
import type { ClassStartingEquipment } from './equipment'
import type { FeatureEffects } from './effects'
import type { SpellClass, SpellSchool } from './spell'

export type SpellcastingType = 'known' | 'prepared' | 'hybrid'

export type ClassSpellcasting = {
  ability: AbilityScore
  cantripsKnown: number
  type: SpellcastingType
  spellsAtLevel1: number
  preparedFormula: string | null
  /** Conjura magias de ritual (bardo, clérigo, druida, mago — cada um com a sua regra de quais). */
  ritualCasting: boolean
  /** Foco de conjuração da classe; `null` quando o livro não dá um (patrulheiro do PHB 2014). */
  focus: string | null
  castingStartsAtLevel: number
  /**
   * Lista de magias de onde se escolhe. Omitida = a lista da própria classe; o Cavaleiro Arcano e o
   * Trapaceiro Arcano conjuram da lista de mago (p. 86 e 93).
   */
  spellList?: SpellClass
  /** Escolas a que as magias de 1° nível ou superior se restringem (Cavaleiro e Trapaceiro Arcano). */
  schoolRestriction?: SpellSchoolRestriction
  /**
   * Truques que a característica já dá, sem escolha (Trapaceiro Arcano: mãos mágicas, p. 93). Contam
   * no total de truques conhecidos da tabela, mas não são gravados no draft: vêm sempre dos dados.
   */
  requiredCantrips?: string[]
}

/**
 * Restrição de escola das magias conhecidas de 1° nível ou superior. `freeChoices` são as levas que
 * podem vir de qualquer escola, pelo nível NA classe: no Cavaleiro e no Trapaceiro Arcano, uma das
 * três iniciais (3° nível) e as aprendidas no 8°, 14° e 20° nível (p. 86 e 93). Truques não têm
 * restrição de escola.
 */
export type SpellSchoolRestriction = {
  schools: SpellSchool[]
  freeChoices: { level: number; count: number }[]
}

export type SubclassExtraChoices = {
  /**
   * Perícias que passam a ter bônus de proficiência DOBRADO (Domínio do Conhecimento). Não exige
   * proficiência prévia, então o picker não esconde as que o personagem já tem — ao contrário de
   * `skillChoice`, dobrar uma perícia que você já usa é justamente o ponto.
   */
  expertiseSkills: { count: number; from: string[] } | null
  /** Perícias GANHAS pela subclasse. `from: ['any']` abre a lista inteira (Colégio do Conhecimento). */
  skillChoice: { count: number; from: string[] } | null
  languages: { count: number } | null
  cantripChoice: string | null
  /** Ferramenta à escolha (Mestre de Batalha, "Estudioso da Guerra": uma de artesão). */
  toolChoice: { count: number; from: ToolChoiceSource } | null
  grantedLanguages: string[]
  grantedArmorProficiencies: string[]
  grantedWeaponProficiencies: string[]
  /** Ferramentas concedidas de cara (Assassino: kit de disfarce e kit de venenos). */
  grantedTools: string[]
}

export type ClassFeature = { name: string; description: string }

/**
 * Feature ganha em um nível específico (progressão 1–20). `effects` é o que a ficha aplica sozinha
 * (Versatilidade, Especialização) — o mesmo formato dos talentos, agregado em `sheetEffects`.
 * O texto mora só em `class-progression-features.json`: a etapa Classe, a Revisão e a ficha leem
 * todos dali, para o card nunca divergir do que vai impresso.
 */
export type LevelFeature = ClassFeature & {
  level: number
  effects?: FeatureEffects
  /**
   * A ficha mostra, ao lado do texto, a opção escolhida num slot de progressão da mesma classe
   * (`slot`, em progression-choices.json): o Ancestral Dracônico mostra o dragão; a Afinidade
   * Elemental (`as: 'damageType'`) mostra o tipo de dano dele (p. 80).
   */
  showsPick?: { slot: string; as?: 'damageType' }
}

export type ClassSubclass = {
  id: string
  name: string
  description: string
  /** Só Cavaleiro Arcano / Trapaceiro Arcano conjuram (third-caster); as demais subclasses omitem. */
  casterProgression?: CasterProgression
  /**
   * Conjuração que a subclasse dá a uma classe que não conjura (Cavaleiro Arcano, Trapaceiro
   * Arcano). As tabelas de truques e magias conhecidas ficam em progression.json pelo id da subclasse.
   */
  spellcasting?: ClassSpellcasting
  extras: SubclassExtraChoices | null
}

/** Recorte do catálogo de ferramentas de onde uma escolha pode tirar opções. */
export type ToolChoiceSource = 'musical-instrument' | 'artisan' | 'any-tool'

export type ClassToolProficiencies = {
  granted: string[]
  choices: { count: number; from: ToolChoiceSource }[]
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

/**
 * Especialização (ladino p. 91) e Aptidão (bardo p. 54): proficiências com o bônus DOBRADO,
 * ganhas em levas — o ladino escolhe duas no 1º nível e mais duas no 6º; o bardo, duas no 3º e
 * mais duas no 10º. Cada leva conta pelo nível NA classe, então vale igual na multiclasse.
 */
export type ClassExpertise = {
  grants: { level: number; count: number }[]
  /** Ladino: "ou uma perícia e ferramentas de ladrão". A Aptidão do bardo é só de perícias. */
  includesThievesTools: boolean
}

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
  subclassLevel: number
  subclasses: ClassSubclass[]
  /** Estilo de Luta da classe; `null` para quem não tem. */
  fightingStyleGrant: ClassFightingStyleGrant | null
  expertise: ClassExpertise | null
  startingEquipment: ClassStartingEquipment
}

/**
 * Quando a classe dá Estilo de Luta e de que lista: guerreiro no 1º nível, os seis (p. 85);
 * paladino no 2º, quatro (p. 110); patrulheiro no 2º, quatro (p. 117). O nível é NA classe — na
 * multiclasse vale o de cada classe. Abaixo dele a escolha fica no draft mas não conta na ficha.
 */
export type ClassFightingStyleGrant = {
  level: number
  /** Ids de `FIGHTING_STYLES` (classUtils) que a classe oferece. */
  styles: string[]
}

export type SubclassChoiceSelections = {
  skills?: string[]
  languages?: string[]
  cantrip?: string
  tools?: string[]
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
