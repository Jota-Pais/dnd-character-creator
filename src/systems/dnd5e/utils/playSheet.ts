import type { CharacterDraft } from '../types/character'
import type { PlaySheet } from '../types/playState'
import type { AbilityScore } from '../types/race'
import { ALL_ABILITY_SCORES, calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { getFinalAbilityScores } from './asiUtils'
import { getHitDicePool } from './multiclassUtils'
import { getSavingThrowChecks } from './proficiencyUtils'
import {
  getDropToOneHp, getHpMaxReductionImmunity, getInitiativeBonusTotal, getOwnedFeats, getSheetResources, getSheetSpeed, getTotalHp,
} from './sheetEffects'
import { getCombinedSpellSlots, getPactSlots } from './spellUtils'

const byAbility = <T>(make: (ability: AbilityScore) => T): Record<AbilityScore, T> =>
  Object.fromEntries(ALL_ABILITY_SCORES.map(a => [a, make(a)])) as Record<AbilityScore, T>

/**
 * Os números da ficha que o jogo usa, tirados do draft com as mesmas funções da Revisão e da ficha
 * imprimível — nenhuma conta é refeita aqui. O resultado é cópia: mexer nele não alcança o draft
 * nem os dados do app (as tabelas de espaços vêm por referência de `progression.json`).
 */
export function buildPlaySheet(draft: CharacterDraft): PlaySheet {
  const abilityScores = getFinalAbilityScores(draft)
  const abilityModifiers = byAbility(a => calculateModifier(abilityScores[a]))
  const proficiencyBonus = getProficiencyBonus(draft.level ?? 1)
  const saveChecks = getSavingThrowChecks(draft, abilityScores)
  const pact = getPactSlots(draft)
  const hpMaxImmunity = getHpMaxReductionImmunity(draft)
  const dropToOneHp = getDropToOneHp(draft)

  return {
    maxHp: draft.class ? Math.max(0, getTotalHp(draft, abilityModifiers.CON)) : 0,
    abilityScores: { ...abilityScores },
    abilityModifiers,
    conModifier: abilityModifiers.CON,
    proficiencyBonus,
    // A fonte única do número de cada resistência (a mesma da Revisão, do PDF e do guia de rolagens).
    savingThrows: byAbility(a => ({ bonus: saveChecks[a].bonus, proficient: saveChecks[a].proficient })),
    initiativeBonus: abilityModifiers.DEX + getInitiativeBonusTotal(draft),
    speed: getSheetSpeed(draft, abilityScores) ?? 0,
    hitDice: getHitDicePool(draft).map(p => ({ ...p })),
    spellSlots: [...getCombinedSpellSlots(draft)],
    pactSlots: pact ? { slots: pact.slots, slotLevel: pact.slotLevel } : null,
    resources: structuredClone(getSheetResources(draft, abilityScores)),
    featIds: getOwnedFeats(draft).map(f => f.id),
    ...(hpMaxImmunity ? { hpMaxReductionImmunity: hpMaxImmunity } : {}),
    ...(dropToOneHp ? { dropToOneHp } : {}),
  }
}
