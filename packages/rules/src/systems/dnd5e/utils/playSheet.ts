import type { CharacterDraft } from '../types/character'
import type { PlaySheet } from '../types/playState'
import type { AbilityScore } from '../types/race'
import type { SheetSession, WornArmor } from '../types/session'
import { ALL_ABILITY_SCORES, calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { getFinalAbilityScores } from './asiUtils'
import { getHitDicePool } from './multiclassUtils'
import { getSavingThrowChecks, getUnproficientArmor } from './proficiencyUtils'
import { getSessionToggles } from './activeEffects'
import { getSheetActions } from './actionUtils'
import { getPlaySpellbook } from './spellbook'
import {
  getDamageDefenses, getDropToOneHp, getHpMaxReductionImmunity, getInitiativeBonusTotal, getOwnedFeats,
  getSheetResources, getSheetSpeed, getTotalHp,
} from './sheetEffects'
import { getCombinedSpellSlots, getPactSlots } from './spellUtils'
import { getCarriedArmor, getEquippedArmorSetup, resolveWornArmor } from './wornArmor'

const byAbility = <T>(make: (ability: AbilityScore) => T): Record<AbilityScore, T> =>
  Object.fromEntries(ALL_ABILITY_SCORES.map(a => [a, make(a)])) as Record<AbilityScore, T>

/**
 * Os números da ficha que o jogo usa, tirados do draft com as mesmas funções da Revisão e da ficha
 * imprimível — nenhuma conta é refeita aqui. O resultado é cópia: mexer nele não alcança o draft
 * nem os dados do app (as tabelas de espaços vêm por referência de `progression.json`).
 *
 * `worn` é a armadura vestida pela tela do jogo (`PlayState.wornArmor`): conferida com a base e com
 * o que o personagem carrega (`resolveWornArmor`), ela entra no deslocamento, nas defesas, nos
 * benefícios dos efeitos (a Fúria) e na proficiência, pelas mesmas funções, com a sessão. O playStore
 * remonta o sheet quando ela muda (operação, desfazer, reconciliação).
 */
export function buildPlaySheet(draft: CharacterDraft, worn?: WornArmor): PlaySheet {
  const abilityScores = getFinalAbilityScores(draft)
  const abilityModifiers = byAbility(a => calculateModifier(abilityScores[a]))
  const proficiencyBonus = getProficiencyBonus(draft.level ?? 1)
  const saveChecks = getSavingThrowChecks(draft, abilityScores)
  const pact = getPactSlots(draft)
  const hpMaxImmunity = getHpMaxReductionImmunity(draft)
  const dropToOneHp = getDropToOneHp(draft)
  const equippedArmor = getEquippedArmorSetup(draft)
  const carriedArmor = getCarriedArmor(draft)
  const wornArmor = resolveWornArmor(equippedArmor, carriedArmor, worn)
  // Só a armadura: os efeitos ligados são do estado, e as operações os resolvem contra `toggles`.
  const session: SheetSession = { active: [], worn: wornArmor }

  return {
    maxHp: draft.class ? Math.max(0, getTotalHp(draft, abilityModifiers.CON)) : 0,
    abilityScores: { ...abilityScores },
    abilityModifiers,
    conModifier: abilityModifiers.CON,
    proficiencyBonus,
    // A fonte única do número de cada resistência (a mesma da Revisão, do PDF e do guia de rolagens).
    savingThrows: byAbility(a => ({ bonus: saveChecks[a].bonus, proficient: saveChecks[a].proficient })),
    initiativeBonus: abilityModifiers.DEX + getInitiativeBonusTotal(draft),
    speed: getSheetSpeed(draft, abilityScores, session) ?? 0,
    hitDice: getHitDicePool(draft).map(p => ({ ...p })),
    spellSlots: [...getCombinedSpellSlots(draft)],
    pactSlots: pact ? { slots: pact.slots, slotLevel: pact.slotLevel } : null,
    resources: structuredClone(getSheetResources(draft, abilityScores)),
    featIds: getOwnedFeats(draft).map(f => f.id),
    ...(hpMaxImmunity ? { hpMaxReductionImmunity: hpMaxImmunity } : {}),
    ...(dropToOneHp ? { dropToOneHp } : {}),
    defenses: structuredClone(getDamageDefenses(draft, session)),
    toggles: structuredClone(getSessionToggles(draft, session)),
    actions: structuredClone(getSheetActions(draft)),
    spellbook: getPlaySpellbook(draft),
    unproficientArmor: getUnproficientArmor(draft, session).map(a => a.name),
    equippedArmor,
    wornArmor,
    carriedArmor,
  }
}
