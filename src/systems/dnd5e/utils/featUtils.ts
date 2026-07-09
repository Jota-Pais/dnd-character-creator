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

/** Um talento é "meio-talento" (concede +1 num atributo)? */
export function isHalfFeat(id: string): boolean {
  return (getFeat(id)?.abilityIncrease?.length ?? 0) > 0
}
