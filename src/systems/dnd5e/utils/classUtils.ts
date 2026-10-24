import type { GameClass, ClassSubclass, ClassChoiceSelections, ClassSpellcasting, LevelFeature } from '../types/class'
import type { FeatureEffects } from '../types/effects'
import { SKILLS } from './raceUtils'
import classesData from '../data/classes.json'
import progressionFeatures from '../data/class-progression-features.json'
import { isProgressionChoicesComplete } from './progressionChoiceUtils'

const CLASS_FEATURES_BY_LEVEL = progressionFeatures.classes as Record<string, LevelFeature[]>
const SUBCLASS_FEATURES_BY_LEVEL = progressionFeatures.subclasses as Record<string, LevelFeature[]>

/** A classe (ou subclasse, com `subclass: true`) tem tabela de features por nível? */
export function hasFeaturesByLevel(id: string, subclass = false): boolean {
  return Array.isArray((subclass ? SUBCLASS_FEATURES_BY_LEVEL : CLASS_FEATURES_BY_LEVEL)[id])
}

export const CLASSES: GameClass[] = classesData as GameClass[]

/** Papéis de combate, para o iniciante escolher pelo que quer fazer (não pelo jargão). */
export type RoleId = 'tank' | 'damage' | 'ranged' | 'caster' | 'support' | 'stealth'

export const ROLES: Record<RoleId, { label: string; emoji: string }> = {
  tank:    { label: 'Tanque',    emoji: '🛡️' },
  damage:  { label: 'Dano',      emoji: '⚔️' },
  ranged:  { label: 'Distância', emoji: '🏹' },
  caster:  { label: 'Mágico',    emoji: '✨' },
  support: { label: 'Suporte',   emoji: '🎭' },
  stealth: { label: 'Furtivo',   emoji: '🗡️' },
}

export type ClassPresentation = {
  emoji: string
  accent: string
  roles: RoleId[]
  beginnerFriendly?: boolean
  beginnerNote?: string
}

export const CLASS_PRESENTATION: Record<string, ClassPresentation> = {
  barbarian: { emoji: '🪓', accent: '#c0392b', roles: ['tank', 'damage'], beginnerFriendly: true, beginnerNote: 'Simples e durável: corre pra briga, aguenta dano e bate forte.' },
  bard:      { emoji: '🎶', accent: '#8e44ad', roles: ['support', 'caster'] },
  warlock:   { emoji: '🌑', accent: '#7d3c98', roles: ['caster'] },
  cleric:    { emoji: '⚜️', accent: '#b7770d', roles: ['support', 'caster'] },
  druid:     { emoji: '🌿', accent: '#1e8449', roles: ['caster', 'support'] },
  sorcerer:  { emoji: '✨', accent: '#2874a6', roles: ['caster'] },
  fighter:   { emoji: '🛡️', accent: '#2e86c1', roles: ['damage', 'tank'], beginnerFriendly: true, beginnerNote: 'O mais direto: ataca bem e aguenta porrada, sem magias para gerenciar.' },
  rogue:     { emoji: '🗡️', accent: '#717d7e', roles: ['stealth', 'damage'], beginnerFriendly: true, beginnerNote: 'Furtivo e certeiro; gira em torno de uma mecânica só (ataque furtivo).' },
  wizard:    { emoji: '📖', accent: '#1f618d', roles: ['caster'] },
  monk:      { emoji: '👊', accent: '#d35400', roles: ['damage'] },
  paladin:   { emoji: '🌟', accent: '#d4ac0d', roles: ['tank', 'support'], beginnerFriendly: true, beginnerNote: 'Resistente e versátil; no nível 1 é puro combate, sem magias.' },
  ranger:    { emoji: '🏹', accent: '#196f3d', roles: ['ranged', 'damage'] },
}

/**
 * Estilos de Luta (o texto do guerreiro, p. 85). Paladino e patrulheiro escolhem quatro deles
 * (p. 110 e 117) — quais, e em que nível, está em `fightingStyleGrant` (classes.json).
 * O que cada um faz na linha de ataque vem declarado em `effects.weaponAttacks`, agregado por
 * `getWeaponAttackEffects` (sheetEffects): Arquearia entra no número; Duelismo, Armas Grandes e Duas
 * Armas dependem de como a arma é empunhada e viram nota na arma. Defesa fica na CA.
 */
export const FIGHTING_STYLES: { id: string; name: string; description: string; effects?: FeatureEffects }[] = [
  {
    id: 'archery',
    name: 'Arquearia',
    description: '+2 nas jogadas de ataque com armas de ataque à distância.',
    effects: { weaponAttacks: [{ weapons: 'ranged', attackBonus: 2 }] },
  },
  {
    id: 'defense',
    name: 'Defesa',
    description: 'Enquanto vestindo armadura, ganhe +1 na CA.',
  },
  {
    id: 'dueling',
    name: 'Duelismo',
    description: 'Empunhando uma arma corpo a corpo numa mão e nenhuma outra arma, receba +2 de bônus de dano com ela.',
    effects: { weaponAttacks: [{ weapons: 'melee-one-handed', note: '+2 de dano empunhando-a numa mão, sem outra arma' }] },
  },
  {
    id: 'great-weapon-fighting',
    name: 'Combate com Armas Grandes',
    description: 'Ao rolar 1 ou 2 num dado de dano de um ataque com arma corpo a corpo empunhada com as duas mãos (a arma precisa ter a propriedade duas mãos ou versátil), role de novo e use o novo resultado, mesmo que seja 1 ou 2.',
    effects: { weaponAttacks: [{ weapons: 'melee-two-handed', note: 'rerrola 1 e 2 nos dados de dano empunhando-a com as duas mãos' }] },
  },
  {
    id: 'protection',
    name: 'Proteção',
    description: 'Quando uma criatura atacar um aliado a 1,5 m, use sua reação para impor desvantagem. Requer escudo.',
  },
  {
    id: 'two-weapon-fighting',
    name: 'Combate com Duas Armas',
    description: 'Adicione seu modificador de habilidade ao dano da segunda arma no combate com duas armas.',
    effects: { weaponAttacks: [{ weapons: 'melee-light', offHandAddsModifier: true }] },
  },
]

/**
 * Os Estilos de Luta que a classe deixa escolher com `level` níveis NELA — vazio para quem não
 * tem e abaixo do nível em que ela o dá (paladino e patrulheiro, 2º). Fonte única do seletor da
 * etapa Classe, da validação e da ficha: estilo salvo fora desta lista não conta.
 */
export function getClassFightingStyleOptions(cls: GameClass, level: number): typeof FIGHTING_STYLES {
  const grant = cls.fightingStyleGrant
  if (!grant || level < grant.level) return []
  return FIGHTING_STYLES.filter(s => grant.styles.includes(s.id))
}

/** Nome da categoria de subclasse por classe, conforme o PHB (para o rótulo do seletor). */
export const SUBCLASS_LABEL: Record<string, string> = {
  barbarian: 'Caminho Primordial',
  bard: 'Colégio de Bardo',
  cleric: 'Domínio Divino',
  druid: 'Círculo Druídico',
  fighter: 'Arquétipo Marcial',
  monk: 'Tradição Monástica',
  paladin: 'Juramento Sagrado',
  ranger: 'Conclave do Patrulheiro',
  rogue: 'Arquétipo Ladino',
  sorcerer: 'Origem de Feitiçaria',
  warlock: 'Patrono Transcendental',
  wizard: 'Tradição Arcana',
}

export function getClass(id: string): GameClass | undefined {
  return CLASSES.find(c => c.id === id)
}

export function getSubclass(cls: GameClass, subclassId: string): ClassSubclass | undefined {
  return cls.subclasses.find(s => s.id === subclassId)
}

/** Features da classe base até o nível dado, na tabela de `class-progression-features.json`. */
export function getBaseClassFeaturesUpToLevel(classId: string, level: number): LevelFeature[] {
  return (CLASS_FEATURES_BY_LEVEL[classId] ?? []).filter(f => f.level <= level)
}

/**
 * Features da subclasse até o nível dado. Com `cls.subclassLevel` vira o que a subclasse dá ao ser
 * escolhida — o que o card da etapa Classe mostra para comparar as opções.
 */
export function getSubclassFeaturesUpToLevel(subclassId: string, level: number): LevelFeature[] {
  return (SUBCLASS_FEATURES_BY_LEVEL[subclassId] ?? []).filter(f => f.level <= level)
}

/**
 * Features de classe + subclasse disponíveis até o nível dado, ordenadas por nível. A tabela por
 * nível é a única fonte do texto: classes.json não guarda mais cópia (as duas já divergiam).
 */
export function getClassFeaturesUpToLevel(
  cls: GameClass,
  subclass: ClassSubclass | null | undefined,
  level: number,
): LevelFeature[] {
  return [
    ...getBaseClassFeaturesUpToLevel(cls.id, level),
    ...(subclass ? getSubclassFeaturesUpToLevel(subclass.id, level) : []),
  ].sort((a, b) => a.level - b.level)
}

/**
 * De onde vem a conjuração de uma classe da ficha: da própria classe ou, quando a classe não
 * conjura, da subclasse que dá conjuração (Cavaleiro Arcano, p. 86; Trapaceiro Arcano, p. 93).
 * `id` é quem conjura (classe ou subclasse): é a chave das tabelas de truques e magias conhecidas
 * em progression.json. null quando nada ali conjura.
 */
export function getSpellcastingSource(
  cls: GameClass,
  subclassId?: string | null,
): { id: string; spellcasting: ClassSpellcasting; subclass: ClassSubclass | null } | null {
  if (cls.spellcasting) return { id: cls.id, spellcasting: cls.spellcasting, subclass: null }
  const subclass = subclassId ? getSubclass(cls, subclassId) : undefined
  if (subclass?.spellcasting) return { id: subclass.id, spellcasting: subclass.spellcasting, subclass }
  return null
}

/** Trocar a subclasse de `from` para `to` muda quem conjura? (aí as magias escolhidas deixam de valer) */
export function subclassChangesSpellcasting(
  cls: GameClass,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  return getSpellcastingSource(cls, from)?.spellcasting !== getSpellcastingSource(cls, to)?.spellcasting
}

/** A classe já conjura no nível que tem NELA? A subclasse conta (Cavaleiro/Trapaceiro Arcano, do 3°). */
export function isActiveCaster(cls: GameClass, level = 1, subclassId?: string | null): boolean {
  const source = getSpellcastingSource(cls, subclassId)
  return !!source && level >= source.spellcasting.castingStartsAtLevel
}

export function getHpAtLevel1(cls: GameClass, conModifier: number): number {
  return cls.hitDie + conModifier
}

/** Average HP gain per level above 1 (floor(hitDie/2) + 1). */
export function getAverageHpPerLevel(cls: GameClass): number {
  return Math.floor(cls.hitDie / 2) + 1
}

/** Total HP using average rolls for all levels above 1. */
export function getAverageHpAtLevel(cls: GameClass, conModifier: number, level: number): number {
  const level1Hp = getHpAtLevel1(cls, conModifier)
  if (level <= 1) return level1Hp
  return level1Hp + (getAverageHpPerLevel(cls) + conModifier) * (level - 1)
}

/** Total HP using manual rolls for levels 2+. hpRolls[i] is the die roll for level i+2. */
export function getRolledHpAtLevel(
  cls: GameClass,
  conModifier: number,
  level: number,
  hpRolls: number[],
): number {
  const level1Hp = getHpAtLevel1(cls, conModifier)
  if (level <= 1) return level1Hp
  let total = level1Hp
  for (let lvl = 2; lvl <= level; lvl++) {
    const roll = hpRolls[lvl - 2]
    const gain = roll !== undefined ? roll : getAverageHpPerLevel(cls)
    total += gain + conModifier
  }
  return total
}

export function getHpFormula(cls: GameClass): string {
  return `d${cls.hitDie} + mod. de CON`
}

/** Resolve a lista `from` de uma escolha de perícia; o token 'any' abre as 18 perícias do livro. */
export function resolveSkillOptions(from: string[]): { id: string; name: string }[] {
  const allowed = from.includes('any') ? SKILLS : SKILLS.filter(s => from.includes(s.id))
  return allowed.map(s => ({ id: s.id, name: s.name }))
}

export function getSkillOptions(cls: GameClass): { id: string; name: string }[] {
  return resolveSkillOptions(cls.skillChoices.from)
}

/**
 * Quantos itens de Especialização a classe já concedeu no nível que o personagem tem NELA — a
 * soma das levas até ali (ladino 6: 2 + 2). Zero para quem não tem a característica.
 */
export function getExpertiseCount(cls: GameClass, level: number): number {
  return (cls.expertise?.grants ?? [])
    .filter(grant => grant.level <= level)
    .reduce((sum, grant) => sum + grant.count, 0)
}

/**
 * Itens elegíveis para Especialização (ladino p. 91, bardo p. 54): "duas das SUAS proficiências
 * em perícia" — qualquer uma, venha de onde vier. Antes só listava as perícias marcadas na lista
 * da classe, o que deixava de fora as do antecedente, da raça e as três do Colégio do
 * Conhecimento. As Ferramentas de Ladrão entram só na do ladino (`includesThievesTools`) e só para
 * quem é proficiente nelas: a Aptidão do bardo é de perícias, mesmo que ele saiba usá-las.
 *
 * `alreadyDoubled`: o que outra fonte já dobra (outra classe, Domínio do Conhecimento). O bônus
 * só se multiplica uma vez, então oferecer de novo seria deixar o jogador jogar a escolha fora.
 */
export function getExpertiseOptions(
  grantedSkills: string[],
  grantedTools: string[],
  includesThievesTools: boolean,
  alreadyDoubled: string[] = [],
): { id: string; name: string }[] {
  const fromSkills = SKILLS
    .filter(s => grantedSkills.includes(s.id) && !alreadyDoubled.includes(s.id))
    .map(s => ({ id: s.id, name: s.name }))
  return includesThievesTools && grantedTools.includes('thieves-tools')
    ? [...fromSkills, { id: 'thieves-tools', name: 'Ferramentas de Ladrão' }]
    : fromSkills
}

export function isClassStepComplete(
  cls: GameClass | null,
  choices: ClassChoiceSelections,
  currentLevel = 1,
  multiclass = false,
): boolean {
  if (!cls) return false

  // Ao multiclassar, a classe concede só o subconjunto de perícias da Tabela de Proficiências
  // de Multiclasse (0, ou 1 para bardo/ladino/patrulheiro) — não a lista completa da 1ª classe.
  const skillCount = multiclass ? (cls.multiclassProficiencies.skills?.count ?? 0) : cls.skillChoices.count
  if (choices.skills.length !== skillCount) return false

  // Escolhas de ferramenta/instrumento só valem para a 1ª classe; as adicionais recebem as
  // proficiências de multiclasse já concedidas (sem seletor nesta fase).
  const requiredTools = multiclass ? 0 : cls.toolProficiencies.choices.reduce((sum, c) => sum + c.count, 0)
  if (choices.tools.length < requiredTools) return false

  // Estilo de Luta só a partir do nível em que a classe o dá (paladino e patrulheiro, 2º).
  const fightingStyles = getClassFightingStyleOptions(cls, currentLevel)
  if (fightingStyles.length > 0 && !fightingStyles.some(s => s.id === choices.fightingStyle)) return false

  if (cls.subclassLevel <= currentLevel) {
    if (!choices.subclass) return false
    const subclass = cls.subclasses.find(s => s.id === choices.subclass)
    if (subclass?.extras) {
      const { extras } = subclass
      const skillsNeeded = (extras.expertiseSkills?.count ?? 0) + (extras.skillChoice?.count ?? 0)
      if (skillsNeeded > 0 && (choices.subclassExtras.skills ?? []).length < skillsNeeded) return false
      if (extras.languages && (choices.subclassExtras.languages ?? []).length < extras.languages.count) return false
      if (extras.toolChoice && (choices.subclassExtras.tools ?? []).length < extras.toolChoice.count) return false
      if (extras.cantripChoice && !choices.subclassExtras.cantrip) return false
    }
  }

  // Escolhas a mais (o nível baixou depois) não travam: o painel corta o excesso.
  if (choices.expertiseItems.length < getExpertiseCount(cls, currentLevel)) return false

  if (!isProgressionChoicesComplete(cls.id, choices.subclass, choices, currentLevel)) return false

  return true
}
