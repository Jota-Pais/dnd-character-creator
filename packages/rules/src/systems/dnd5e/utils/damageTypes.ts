import damageTypesData from '../data/damage-types.json'
import type { DamageTypeId, DamageTypeInfo } from '../types/damage'

/**
 * Os 13 tipos de dano, na ordem do livro em português (p. 198). Fonte única do nome e do dano por
 * extenso: a arma ("1d8 perfurante"), o ancestral dracônico ("Tipo de Dano: Fogo"), as condições
 * ("imune a dano de veneno") e as defesas do personagem leem daqui.
 */
export const DAMAGE_TYPES: readonly DamageTypeInfo[] = damageTypesData as DamageTypeInfo[]

const BY_ID = new Map(DAMAGE_TYPES.map(t => [t.id, t]))

/** A linha do tipo; os ids são fechados (`DamageTypeId`), então sempre existe. */
export function getDamageType(id: DamageTypeId): DamageTypeInfo {
  const type = BY_ID.get(id)
  if (!type) throw new Error(`Tipo de dano desconhecido: ${id}`)
  return type
}

/** O dano por extenso: "dano de fogo", "dano elétrico". */
export function getDamageLabel(id: DamageTypeId): string {
  return getDamageType(id).damageLabel
}

/** O tipo em minúsculas, como entra depois do número ("1d8 perfurante") ou numa lista ("fogo"). */
export function getDamageTypeName(id: DamageTypeId): string {
  return getDamageType(id).name.toLowerCase()
}

/** Confere um id que veio de fora (estado salvo, arquivo importado). */
export function isDamageTypeId(x: unknown): x is DamageTypeId {
  return typeof x === 'string' && BY_ID.has(x as DamageTypeId)
}
