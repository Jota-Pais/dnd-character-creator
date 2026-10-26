import type { CharacterDraft } from '../types/character'
import { getProficiencyBonus, calculateModifier } from './abilityScoreUtils'
import type { FinalScores } from './classResourceUtils'
import { getProgressionSlotsUpToLevel } from './progressionChoiceUtils'
import { getProgressionOptions, type ProgressionOption } from './progressionOptions'
import { allClassEntries } from './multiclassUtils'

/**
 * Manobras do Mestre de Batalha (p. 87-88) — a lista do arquétipo, que o talento Adepto Marcial
 * (p. 167) também usa. Quem as conhece pelo talento fica em `sheetEffects` (getFeatManeuvers),
 * junto das outras escolhas de talento.
 */
export const MANEUVER_LIST_ID = 'battle-master-maneuvers'

export function getManeuverOptions(): ProgressionOption[] {
  return getProgressionOptions(MANEUVER_LIST_ID)
}

export function getManeuver(id: string): ProgressionOption | undefined {
  return getManeuverOptions().find(m => m.id === id)
}

/** "Aparar" — o nome da manobra, ou o próprio id quando desconhecido. */
export function getManeuverName(id: string): string {
  return getManeuver(id)?.name ?? id
}

/**
 * As manobras que o personagem conhece pelo Mestre de Batalha: os slots de manobra que o nível na
 * classe liberou, de cada classe da multiclasse. Escolha guardada de outra subclasse (o slot não
 * existe mais) não conta.
 */
export function getClassManeuvers(draft: CharacterDraft): string[] {
  const ids = allClassEntries(draft).flatMap(entry => {
    const { classId, level, classChoices: { subclass, progressionChoices } } = entry
    return getProgressionSlotsUpToLevel(classId, subclass, level, progressionChoices)
      .filter(slot => slot.optionsListId === MANEUVER_LIST_ID)
      .flatMap(slot => progressionChoices[slot.id] ?? [])
  })
  return [...new Set(ids)]
}

/**
 * CD das manobras: 8 + bônus de proficiência + modificador de Força ou Destreza, à escolha do
 * jogador (Mestre de Batalha, p. 87; Adepto Marcial, p. 167). A escolha é na mesa, então a ficha
 * dá os dois valores. Recebe os atributos FINAIS, como a CA e os recursos.
 */
export type ManeuverSaveDc = { strength: number; dexterity: number }

export function getManeuverSaveDc(level: number, scores: FinalScores): ManeuverSaveDc {
  const base = 8 + getProficiencyBonus(level)
  return {
    strength: base + calculateModifier(scores.STR),
    dexterity: base + calculateModifier(scores.DEX),
  }
}

/** "CD das manobras: 13 (Força) ou 14 (Destreza), à sua escolha" — a linha da Revisão e do PDF. */
export function formatManeuverSaveDc(dc: ManeuverSaveDc): string {
  if (dc.strength === dc.dexterity) return `CD das manobras: ${dc.strength} (Força ou Destreza)`
  return `CD das manobras: ${dc.strength} (Força) ou ${dc.dexterity} (Destreza), à sua escolha`
}

/**
 * O aviso da manobra do talento que o Mestre de Batalha já ensina (ficha antiga ou subclasse
 * trocada) — a Revisão e o PDF mostram ao lado dela; a etapa do talento fica pendente.
 */
export const REPEATED_FEAT_MANEUVER_NOTE = '⚠ já conhecida pelo Mestre de Batalha: troque por outra manobra no talento'
