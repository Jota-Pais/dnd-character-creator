import type { FeatSelections } from '../types/character'
import type { DamageTypeId } from '../types/damage'
import type { Feat } from '../types/feat'
import featsData from '../data/feats.json'

export const FEATS: Feat[] = featsData as Feat[]

const BY_ID = new Map(FEATS.map(f => [f.id, f]))

export function getFeat(id: string): Feat | undefined {
  return BY_ID.get(id)
}

/** Talentos em ordem alfabética (pt-BR) para exibição. */
export function getAllFeats(): Feat[] {
  return FEATS
}

/**
 * O tipo de dano escolhido no talento (Adepto Elemental, p. 167: `choices.damageTypeChoice`), só
 * entre os que ele oferece — o de uma ficha editada à mão fora da lista não vale. null sem escolha.
 */
export function getFeatDamageType(feat: Feat, selections: FeatSelections | undefined): DamageTypeId | null {
  const choice = feat.effects?.choices?.damageTypeChoice
  const picked = selections?.damageType
  return choice && picked && choice.from.includes(picked) ? picked : null
}

/** Um talento é "meio-talento" (concede +1 num atributo)? */
export function isHalfFeat(id: string): boolean {
  return (getFeat(id)?.abilityIncrease?.length ?? 0) > 0
}
