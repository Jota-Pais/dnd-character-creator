import type { CharacterDraft } from '../types/character'
import type { AttackScope } from '../types/effects'
import type { Weapon } from '../types/equipment'
import { getClass } from './classUtils'
import { getBackground, resolveBackgroundItems } from './backgroundUtils'
import { getActivePurchases, getWeaponById } from './equipmentUtils'
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
 * Itens que o personagem carrega, com a quantidade — do equipamento inicial da classe (itens fixos
 * e opções escolhidas, inclusive as de um filtro, uma unidade por escolha), das compras do método
 * riqueza e do antecedente. Pode repetir id (duas fontes da mesma arma).
 */
function getCarriedItems(draft: CharacterDraft): { id: string; quantity: number }[] {
  const items: { id: string; quantity: number }[] = []
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const eq = draft.equipment

  if (eq.method === 'standard' && cls) {
    for (const item of cls.startingEquipment.fixed) items.push({ id: item.id, quantity: item.quantity })
    cls.startingEquipment.choices.forEach((choice, i) => {
      const res = eq.classResolutions[i]
      if (!res || res.optionIndex < 0) return
      const option = choice.options[res.optionIndex]
      if (!option) return
      let pickIdx = 0
      for (const item of option) {
        if (item.kind === 'specific') {
          items.push({ id: item.id, quantity: item.quantity })
        } else if (item.kind === 'weapon-filter' || item.kind === 'tool-filter' || item.kind === 'focus-group') {
          for (const id of res.pickedIds.slice(pickIdx, pickIdx + item.picks)) items.push({ id, quantity: 1 })
          pickIdx += item.picks
        }
      }
    })
  }
  for (const p of getActivePurchases(eq)) items.push({ id: p.itemId, quantity: p.quantity })
  if (bg) {
    for (const item of resolveBackgroundItems(bg, draft.backgroundChoices)) {
      if (item.id) items.push({ id: item.id, quantity: item.quantity })
    }
  }
  return items
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
 * A linha está no alcance do efeito (a margem de crítico do Campeão)? A arma responde pelo escopo
 * das armas (`isWeaponInScope`); o golpe desarmado, que não é arma, pelo dele
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
