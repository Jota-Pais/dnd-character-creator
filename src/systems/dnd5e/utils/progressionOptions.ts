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
import { FIGHTING_STYLES } from './classUtils'
import {
  getActivePicks, getProgressionSlots, getProgressionSlotsUpToLevel, isSpellChoiceSlot, SPELL_OPTIONS_LIST_ID,
  type ProgressionSlot,
} from './progressionChoiceUtils'

export type ProgressionOption = {
  id: string
  name: string
  description?: string
  prerequisite?: string
  tier3?: string
  tier6?: string
  tier14?: string
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
}

export function getProgressionOptions(optionsListId: string): ProgressionOption[] {
  switch (optionsListId) {
    case 'battle-master-maneuvers': return battleMasterManeuvers as ProgressionOption[]
    case 'eldritch-invocations': return eldritchInvocations as ProgressionOption[]
    case 'metamagic-options': return metamagicOptions as ProgressionOption[]
    case 'four-elements-disciplines': return fourElementsDisciplines as ProgressionOption[]
    case 'totem-warrior-totems': return totemWarriorTotems as ProgressionOption[]
    case 'land-circle-terrains': return landCircleTerrains as ProgressionOption[]
    case 'hunters-prey': return huntersPrey as ProgressionOption[]
    case 'hunter-defensive-tactics': return hunterDefensiveTactics as ProgressionOption[]
    case 'hunter-multiattack': return hunterMultiattack as ProgressionOption[]
    case 'hunter-superior-defense': return hunterSuperiorDefense as ProgressionOption[]
    case 'pact-boons': return pactBoons as ProgressionOption[]
    case 'FIGHTING_STYLES': return FIGHTING_STYLES as ProgressionOption[]
    case SPELL_OPTIONS_LIST_ID:
      // Todas as magias do jogo; o seletor corta pelo nível com getSecretSpellOptions.
      return (spells as Spell[]).map(spellOption)
    default: return []
  }
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

/** Texto da opção no nível da classe: as escalonadas (táticas do patrulheiro) trazem o degrau alcançado. */
function describeProgressionPick(opt: ProgressionOption, classLevel: number): string {
  return opt.description
    ?? (classLevel >= 14 ? opt.tier14 : classLevel >= 6 ? opt.tier6 : opt.tier3)
    ?? opt.prerequisite
    ?? ''
}

/**
 * As "Escolhas de Progressão" da Revisão e da ficha imprimível: manobras, invocações, metamagia,
 * disciplinas, totem, terreno, presa — cada classe da multiclasse no nível que tem nela. Os slots
 * de Segredos Mágicos ficam de fora: são magias e saem junto das magias do bardo
 * (`bonusSpells` de getCasterEntries).
 */
export function getProgressionChoiceBlocks(entries: ClassEntry[]): ProgressionChoiceBlock[] {
  return entries
    .map(entry => {
      const { classId, level, classChoices: { subclass, progressionChoices } } = entry
      const activePicks = getActivePicks(classId, subclass, level, progressionChoices)
      return {
        entry,
        slots: getProgressionSlotsUpToLevel(classId, subclass, level, progressionChoices)
          .filter(slot => !isSpellChoiceSlot(slot))
          .map(slot => {
            const options = getProgressionOptions(slot.optionsListId)
            const picks = (progressionChoices[slot.id] ?? []).flatMap((id): ProgressionPick[] => {
              const opt = options.find(o => o.id === id)
              if (!opt) return []
              const unmet = getUnmetRequirement(classId, subclass, activePicks, opt)
              return [{ id: opt.id, name: opt.name, text: describeProgressionPick(opt, level), ...(unmet ? { unmet } : {}) }]
            })
            return { slot, picks }
          })
          .filter(s => s.picks.length > 0),
      }
    })
    .filter(b => b.slots.length > 0)
}
