import battleMasterManeuvers from '../data/battle-master-maneuvers.json'
import eldritchInvocations from '../data/eldritch-invocations.json'
import metamagicOptions from '../data/metamagic-options.json'
import fourElementsDisciplines from '../data/four-elements-disciplines.json'
import totemWarriorTotems from '../data/totem-warrior-totems.json'
import landCircleTerrains from '../data/land-circle-terrains.json'
import huntersPrey from '../data/hunters-prey.json'
import hunterDefensiveTactics from '../data/hunter-defensive-tactics.json'
import hunterMultiattack from '../data/hunter-multiattack.json'
import hunterSuperiorDefense from '../data/hunter-superior-defense.json'
import pactBoons from '../data/pact-boons.json'
import spells from '../data/spells.json'
import type { Spell } from '../types/spell'
import type { FeatureEffects } from '../types/effects'
import type { ClassEntry } from '../types/character'
import type { LevelFeature } from '../types/class'
import { FIGHTING_STYLES } from './classUtils'
import { DRAGON_ANCESTORS } from './dragonAncestors'
import {
  getActivePicks, getProgressionSlots, getProgressionSlotsUpToLevel, isSpellChoiceSlot, SPELL_OPTIONS_LIST_ID,
  type ProgressionSlot,
} from './progressionChoiceUtils'

export type ProgressionOption = {
  id: string
  name: string
  description?: string
  prerequisite?: string
  /**
   * Efeitos declarados da opção escolhida (ex.: Lâmina Sedenta). Os níveis dos degraus são os da
   * classe em que a escolha foi feita. Agregados em `sheetEffects`.
   */
  effects?: FeatureEffects
  /**
   * Opção de outro slot da mesma classe que esta exige: a invocação Lâmina Sedenta exige o Pacto
   * da Lâmina (p. 61). Sem ela, a opção não se escolhe; escolhida antes, fica pendente e não vale
   * na ficha (getUnmetPickRequirements).
   */
  requiresPick?: string
  /**
   * Magias que a opção ensina sem escolha e fora do número de conhecidas (Pacto da Corrente:
   * convocar familiar, p. 58). Derivadas, nunca gravadas no draft (getGrantedSpellGroups).
   */
  grantsSpells?: string[]
  /** Tipo de dano da opção (Ancestral Dracônico: "Fogo"), que a Afinidade Elemental mostra (p. 80). */
  damageType?: string
}

export function getProgressionOptions(optionsListId: string): ProgressionOption[] {
  switch (optionsListId) {
    case 'battle-master-maneuvers': return battleMasterManeuvers as ProgressionOption[]
    case 'eldritch-invocations': return eldritchInvocations as ProgressionOption[]
    case 'metamagic-options': return metamagicOptions as ProgressionOption[]
    case 'four-elements-disciplines': return fourElementsDisciplines as ProgressionOption[]
    case 'totem-spirits': return totemOptions('tier3')
    case 'totem-aspects': return totemOptions('tier6')
    case 'totem-attunements': return totemOptions('tier14')
    case 'land-circle-terrains': return landCircleTerrains as ProgressionOption[]
    case 'hunters-prey': return huntersPrey as ProgressionOption[]
    case 'hunter-defensive-tactics': return hunterDefensiveTactics as ProgressionOption[]
    case 'hunter-multiattack': return hunterMultiattack as ProgressionOption[]
    case 'hunter-superior-defense': return hunterSuperiorDefense as ProgressionOption[]
    case 'pact-boons': return pactBoons as ProgressionOption[]
    case 'FIGHTING_STYLES': return FIGHTING_STYLES as ProgressionOption[]
    case 'dragon-ancestors':
      // A tabela Ancestral Dracônico (p. 80) é a mesma das sub-raças do draconato (p. 34).
      return DRAGON_ANCESTORS.map(a => ({
        id: a.id,
        name: a.name,
        description: `Tipo de dano: ${a.damageType.toLowerCase()}.`,
        damageType: a.damageType,
      }))
    case SPELL_OPTIONS_LIST_ID:
      // Todas as magias do jogo; o seletor corta pelo nível com getSecretSpellOptions.
      return (spells as Spell[]).map(spellOption)
    default: return []
  }
}

/** Um animal do Guerreiro Totêmico com o benefício de cada característica (p. 50). */
type TotemAnimal = { id: string; name: string; tier3: string; tier6: string; tier14: string }

/**
 * Os animais do Guerreiro Totêmico numa das três escolhas: Totem Espiritual (3º, `tier3`),
 * Aspecto da Besta (6º, `tier6`) e Sintonia Totêmica (14º, `tier14`). São escolhas independentes
 * — "o mesmo animal ou um diferente" (p. 50) —, cada uma com o benefício do animal nela.
 */
function totemOptions(tier: 'tier3' | 'tier6' | 'tier14'): ProgressionOption[] {
  return (totemWarriorTotems as TotemAnimal[]).map(a => ({ id: a.id, name: a.name, description: a[tier] }))
}

function spellOption(s: Spell): ProgressionOption {
  return {
    id: s.id,
    name: s.name,
    description: `${s.level === 0 ? 'Truque' : `${s.level}º nível`} (${s.school}) - ${s.classes.join(', ')}`,
  }
}

/**
 * Opções de um slot de Segredos Mágicos: magia de qualquer classe "de um nível que você possa
 * conjurar, como mostrado na tabela O Bardo, ou um truque" (pp. 54-55) — `maxSpellLevel` é o da
 * tabela do bardo no nível que tem na classe. As já escolhidas (`keep`) ficam mesmo acima do
 * limite (ficha antiga), para que dê para desmarcar.
 */
export function getSecretSpellOptions(maxSpellLevel: number, keep: string[] = []): ProgressionOption[] {
  return (spells as Spell[])
    .filter(s => s.level <= maxSpellLevel || keep.includes(s.id))
    .map(s => {
      const opt = spellOption(s)
      return s.level > maxSpellLevel
        ? { ...opt, description: `acima do ${maxSpellLevel}º nível, que é o seu limite — desmarque · ${opt.description}` }
        : opt
    })
}

// ── Pré-requisito de opção (pacto das invocações) ───────────────────────────

/** A opção que outra exige e onde ela se escolhe: "Pacto da Lâmina", em "Dádiva do Pacto" (3º nível). */
export type RequiredPick = { id: string; name: string; slotLabel: string; slotLevel: number }

/**
 * O que `option` exige e a classe ainda não tem escolhido num slot liberado — null quando não
 * exige nada ou já está cumprido. A opção exigida se procura nos slots da classe em qualquer nível:
 * um bruxo 2 que marca Voz do Mestre das Correntes fica sabendo que o pacto vem no 3º.
 */
export function getUnmetRequirement(
  classId: string,
  subclassId: string | null,
  activePicks: Set<string>,
  option: ProgressionOption,
): RequiredPick | null {
  const required = option.requiresPick
  if (!required || activePicks.has(required)) return null
  for (const slot of getProgressionSlots(classId, subclassId)) {
    const found = getProgressionOptions(slot.optionsListId).find(o => o.id === required)
    if (found) return { id: found.id, name: found.name, slotLabel: slot.label, slotLevel: slot.level }
  }
  return { id: required, name: required, slotLabel: '', slotLevel: 0 }
}

/** Uma opção escolhida cujo pré-requisito de opção não está cumprido. */
export type UnmetPickRequirement = { slot: ProgressionSlot; option: ProgressionOption; required: RequiredPick }

/**
 * As opções escolhidas (nos slots que o nível na classe liberou) que perderam o pré-requisito:
 * Lâmina Sedenta sem o Pacto da Lâmina, Livro de Segredos Antigos depois de trocar o Tomo pela
 * Corrente. A etapa Classe reprova (draftValidation) e diz o motivo (pendingReasons); a ficha não
 * aplica o efeito delas (sheetEffects) e as mostra com o aviso.
 */
export function getUnmetPickRequirements(
  classId: string,
  subclassId: string | null,
  level: number,
  progressionChoices: Record<string, string[]>,
): UnmetPickRequirement[] {
  const activePicks = getActivePicks(classId, subclassId, level, progressionChoices)
  return getProgressionSlotsUpToLevel(classId, subclassId, level, progressionChoices).flatMap(slot => {
    const options = getProgressionOptions(slot.optionsListId)
    return (progressionChoices[slot.id] ?? []).flatMap(id => {
      const option = options.find(o => o.id === id)
      const required = option ? getUnmetRequirement(classId, subclassId, activePicks, option) : null
      return option && required ? [{ slot, option, required }] : []
    })
  })
}

/** Magias que opções escolhidas ensinam, agrupadas pela opção ("Pacto da Corrente"). */
export type GrantedSpellGroup = { label: string; spellIds: string[] }

/**
 * As magias que as opções escolhidas pela classe ensinam (`grantsSpells`), nos slots que o nível
 * nela liberou e só com o pré-requisito cumprido. Entram como magias da classe, por cima das
 * conhecidas (bonusSpells de getCasterEntries).
 */
export function getGrantedSpellGroups(entry: ClassEntry): GrantedSpellGroup[] {
  const { classId, level, classChoices: { subclass, progressionChoices } } = entry
  const activePicks = getActivePicks(classId, subclass, level, progressionChoices)
  return getProgressionSlotsUpToLevel(classId, subclass, level, progressionChoices).flatMap(slot => {
    const options = getProgressionOptions(slot.optionsListId)
    return (progressionChoices[slot.id] ?? []).flatMap(id => {
      const option = options.find(o => o.id === id)
      if (!option?.grantsSpells?.length || getUnmetRequirement(classId, subclass, activePicks, option)) return []
      return [{ label: option.name, spellIds: option.grantsSpells }]
    })
  })
}

/** "requer o Pacto da Lâmina (Dádiva do Pacto, 3º nível)" — o mesmo texto na etapa, na Revisão e no PDF. */
export function describeRequiredPick(required: RequiredPick): string {
  return required.slotLabel
    ? `requer ${required.name} (${required.slotLabel}, ${required.slotLevel}º nível)`
    : `requer ${required.name}`
}

/** O aviso da opção escolhida sem o pré-requisito, na Revisão e no PDF. */
export function formatUnmetPick(required: RequiredPick): string {
  return `⚠ Sem o pré-requisito: ${describeRequiredPick(required)}. Não vale até ser cumprido.`
}

/**
 * Uma opção escolhida num slot de progressão, com o texto que vai pra mesa. `unmet` é o
 * pré-requisito que falta (a ficha avisa e não aplica o efeito).
 */
export type ProgressionPick = { id: string; name: string; text: string; unmet?: RequiredPick }

/** Escolhas de uma classe da ficha, slot a slot (só os slots com algo escolhido). */
export type ProgressionChoiceBlock = {
  entry: ClassEntry
  slots: { slot: ProgressionSlot; picks: ProgressionPick[] }[]
}

/** Texto da opção que vai pra mesa. */
function describeProgressionPick(opt: ProgressionOption): string {
  return opt.description ?? opt.prerequisite ?? ''
}

/**
 * As "Escolhas de Progressão" da Revisão e da ficha imprimível: manobras, invocações, metamagia,
 * disciplinas, totem, terreno, presa — cada classe da multiclasse no nível que tem nela. Os slots
 * de Segredos Mágicos ficam de fora: são magias e saem junto das magias do bardo
 * (`bonusSpells` de getCasterEntries). Os que qualificam a subclasse (`subclassDetail`: o
 * Ancestral Dracônico) também: saem com a subclasse e nas características (getSubclassDetails,
 * describeFeaturePick).
 */
export function getProgressionChoiceBlocks(entries: ClassEntry[]): ProgressionChoiceBlock[] {
  return entries
    .map(entry => {
      const { classId, level, classChoices: { subclass, progressionChoices } } = entry
      const activePicks = getActivePicks(classId, subclass, level, progressionChoices)
      return {
        entry,
        slots: getProgressionSlotsUpToLevel(classId, subclass, level, progressionChoices)
          .filter(slot => !isSpellChoiceSlot(slot) && !slot.subclassDetail)
          .map(slot => {
            const options = getProgressionOptions(slot.optionsListId)
            const picks = (progressionChoices[slot.id] ?? []).flatMap((id): ProgressionPick[] => {
              const opt = options.find(o => o.id === id)
              if (!opt) return []
              const unmet = getUnmetRequirement(classId, subclass, activePicks, opt)
              return [{ id: opt.id, name: opt.name, text: describeProgressionPick(opt), ...(unmet ? { unmet } : {}) }]
            })
            return { slot, picks }
          })
          .filter(s => s.picks.length > 0),
      }
    })
    .filter(b => b.slots.length > 0)
}

// ── Escolha que a ficha mostra fora das Escolhas de Progressão ──────────────

/** A opção escolhida num slot que o nível na classe já liberou; null sem escolha (ou id desconhecido). */
function getPickedOption(entry: ClassEntry, slotId: string): ProgressionOption | null {
  const { classId, level, classChoices: { subclass, progressionChoices } } = entry
  const slot = getProgressionSlotsUpToLevel(classId, subclass, level, progressionChoices).find(s => s.id === slotId)
  const picked = slot ? progressionChoices[slot.id]?.[0] : undefined
  if (!slot || !picked) return null
  return getProgressionOptions(slot.optionsListId).find(o => o.id === picked) ?? null
}

/** "Vermelho (dano de fogo)" — a opção com o tipo de dano, quando tem. */
function describeShortPick(option: ProgressionOption): string {
  return option.damageType ? `${option.name} (dano de ${option.damageType.toLowerCase()})` : option.name
}

/**
 * O que a característica mostra da escolha que ela usa (`showsPick`), com o rótulo da linha:
 * Ancestral Dracônico → "Escolha: Vermelho (dano de fogo)"; Afinidade Elemental → "Tipo de dano:
 * fogo (ancestral Vermelho)". null sem `showsPick` ou com o slot vazio (a etapa Classe fica
 * pendente). A Revisão e o PDF leem daqui, via getSheetClassFeatures.
 */
export function describeFeaturePick(entry: ClassEntry, feature: LevelFeature): { label: string; text: string } | null {
  if (!feature.showsPick) return null
  const option = getPickedOption(entry, feature.showsPick.slot)
  if (!option) return null
  if (feature.showsPick.as === 'damageType' && option.damageType) {
    return { label: 'Tipo de dano', text: `${option.damageType.toLowerCase()} (ancestral ${option.name})` }
  }
  return { label: 'Escolha', text: describeShortPick(option) }
}

/**
 * O que acompanha o nome da subclasse no cabeçalho da ficha (slots com `subclassDetail`):
 * ["ancestral Vermelho"] na Linhagem Dracônica. Vazio sem escolha.
 */
export function getSubclassDetails(entry: ClassEntry): string[] {
  const { classId, level, classChoices: { subclass, progressionChoices } } = entry
  return getProgressionSlotsUpToLevel(classId, subclass, level, progressionChoices)
    .filter(slot => slot.subclassDetail)
    .flatMap(slot => {
      const option = getPickedOption(entry, slot.id)
      return option ? [`${slot.subclassDetail} ${option.name}`] : []
    })
}
