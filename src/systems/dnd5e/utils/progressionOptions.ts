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
import spells from '../data/spells.json'
import type { Spell } from '../types/spell'
import type { FeatureEffects } from '../types/effects'
import type { ClassEntry } from '../types/character'
import { FIGHTING_STYLES } from './classUtils'
import {
  getProgressionSlotsUpToLevel, isSpellChoiceSlot, SPELL_OPTIONS_LIST_ID, type ProgressionSlot,
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

/** Uma opção escolhida num slot de progressão, com o texto que vai pra mesa. */
export type ProgressionPick = { id: string; name: string; text: string }

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
    .map(entry => ({
      entry,
      slots: getProgressionSlotsUpToLevel(entry.classId, entry.classChoices.subclass, entry.level)
        .filter(slot => !isSpellChoiceSlot(slot))
        .map(slot => {
          const options = getProgressionOptions(slot.optionsListId)
          const picks = (entry.classChoices.progressionChoices[slot.id] ?? []).flatMap(id => {
            const opt = options.find(o => o.id === id)
            return opt ? [{ id: opt.id, name: opt.name, text: describeProgressionPick(opt, entry.level) }] : []
          })
          return { slot, picks }
        })
        .filter(s => s.picks.length > 0),
    }))
    .filter(b => b.slots.length > 0)
}
