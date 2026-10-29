import type { CharacterDraft } from '../types/character'
import type { AttackScope } from '../types/effects'
import type { Weapon } from '../types/equipment'
import { getWeaponById } from './equipmentUtils'
import { getStartingInventory } from './sheetModel'
import { calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { hasWeaponProficiency } from './proficiencyUtils'
import {
  getWeaponAttackEffects, getMartialArts, getUnarmedDamageDie, getAttacksPerAction, getLoadingOverrides,
} from './sheetEffects'
import type { FinalScores } from './classResourceUtils'
import {
  getUnarmedStrike, getWeaponAttack, hasProperty, isUnarmedStrikeInScope, isWeaponInScope, type WeaponAttack,
} from './weaponFormat'

/**
 * Itens que o personagem carrega, com a quantidade: o inventário inicial (`getStartingInventory`,
 * o mesmo da Revisão e da ficha imprimível) sem o item do antecedente ainda a escolher. Pode
 * repetir id (duas fontes da mesma arma).
 */
function getCarriedItems(draft: CharacterDraft): { id: string; quantity: number }[] {
  return getStartingInventory(draft).flatMap(item => (item.id ? [{ id: item.id, quantity: item.quantity }] : []))
}

/** Armas que o personagem carrega (`getCarriedItems`), sem repetir. */
export function getEquippedWeapons(draft: CharacterDraft): Weapon[] {
  return [...new Set(getCarriedItems(draft).map(item => item.id))]
    .map(getWeaponById)
    .filter((w): w is Weapon => w !== undefined)
}

/**
 * Se o personagem carrega ao menos duas armas leves corpo a corpo (contando a quantidade: duas
 * adagas valem) — o que combater com duas armas pede (p. 196). Sem isso, a nota do ataque da
 * outra mão não tem o que dizer.
 */
export function carriesTwoLightMeleeWeapons(draft: CharacterDraft): boolean {
  let count = 0
  for (const { id, quantity } of getCarriedItems(draft)) {
    const weapon = getWeaponById(id)
    if (weapon && isWeaponInScope(weapon, 'melee-light')) count += quantity
  }
  return count >= 2
}

/** A arma de uma linha de ataque, para as regras que dependem dela (crítico, Pesada). */
export type SheetAttackWeapon = { id: string; melee: boolean; heavy: boolean }

/**
 * Uma linha da tabela de ataques, com a chave estável pra lista e a arma — `null` no golpe
 * desarmado, que não é arma (p. 196).
 */
export type SheetAttack = WeaponAttack & { key: string; weapon: SheetAttackWeapon | null }

/**
 * A linha está no alcance do efeito (a margem do Campeão, o Crítico Brutal)? A arma responde pelo
 * escopo das armas (`isWeaponInScope`); o golpe desarmado, que não é arma, pelo dele
 * (`isUnarmedStrikeInScope`).
 */
export function isSheetAttackInScope(attack: SheetAttack, scope: AttackScope): boolean {
  if (attack.weapon === null) return isUnarmedStrikeInScope(scope)
  const weapon = getWeaponById(attack.weapon.id)
  return weapon !== undefined && isWeaponInScope(weapon, scope)
}

/**
 * A tabela de ataques da ficha — a Revisão e o PDF chamam só isto: uma linha por arma carregada e,
 * no fim, o golpe desarmado, que todo personagem tem (p. 196) e é o ataque principal do monge.
 *
 * Cada linha já vem com o que as características fazem nela (`getWeaponAttackEffects`): Arquearia
 * no número; Duelismo, Armas Grandes, o ataque da outra mão e o Dano de Fúria como nota — este nas
 * armas corpo a corpo e no golpe desarmado, que não é arma mas é ataque corpo a corpo com arma
 * (p. 196, pelo inglês; decisão do dono de 2026-10-29). Artes Marciais entra no número das armas
 * de monge e do golpe desarmado quando o equipamento deixa (sem armadura nem escudo); quando não
 * deixa, a linha do golpe desarmado diz o que a impede. O "2×" do Ataque Extra vem em cada linha
 * (`attacksPerAction`): arma de recarga fica em 1 (p. 149), salvo Especialista em Besta.
 */
export function getSheetAttacks(draft: CharacterDraft, finalScores: FinalScores): SheetAttack[] {
  const base = {
    strMod: calculateModifier(finalScores.STR),
    dexMod: calculateModifier(finalScores.DEX),
    proficiencyBonus: getProficiencyBonus(draft.level ?? 1),
    effects: getWeaponAttackEffects(draft, finalScores),
    attacksPerAction: getAttacksPerAction(draft),
    loadingOverrides: getLoadingOverrides(draft),
    twoLightMeleeWeapons: carriesTwoLightMeleeWeapons(draft),
  }
  const ma = getMartialArts(draft, finalScores)
  const martialArts = ma?.active ? { source: ma.source, die: ma.die, condition: ma.condition } : undefined

  const weapons = getEquippedWeapons(draft).map((weapon): SheetAttack => ({
    key: weapon.id,
    ...getWeaponAttack(weapon, { ...base, martialArts, proficient: hasWeaponProficiency(draft, weapon) }),
    weapon: { id: weapon.id, melee: weapon.weaponType === 'melee', heavy: hasProperty(weapon, 'heavy') },
  }))

  const unarmed = getUnarmedStrike({ ...base, martialArts, unarmedDie: getUnarmedDamageDie(draft) ?? undefined })
  if (ma && !ma.active) {
    unarmed.notes.push(
      `${ma.source} (d${ma.die}, Destreza) fora deste número e das armas de monge: você está de ${ma.blockedBy}`,
    )
  }
  return [...weapons, { key: 'unarmed', ...unarmed, weapon: null }]
}
