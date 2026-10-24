import type { CharacterDraft } from '../types/character'
import type { Weapon } from '../types/equipment'
import { getClass } from './classUtils'
import { getBackground, resolveBackgroundItems } from './backgroundUtils'
import { getWeaponById } from './equipmentUtils'
import { calculateModifier, getProficiencyBonus } from './abilityScoreUtils'
import { hasWeaponProficiency } from './proficiencyUtils'
import {
  getWeaponAttackEffects, getMartialArts, getUnarmedDamageDie,
} from './sheetEffects'
import type { FinalScores } from './classResourceUtils'
import { getUnarmedStrike, getWeaponAttack, type WeaponAttack } from './weaponFormat'

/**
 * Armas que o personagem carrega — do equipamento inicial da classe (itens fixos e opções
 * escolhidas, inclusive as de um filtro de arma), das compras do método riqueza e do antecedente
 * —, sem repetir.
 */
export function getEquippedWeapons(draft: CharacterDraft): Weapon[] {
  const ids: string[] = []
  const cls = draft.class ? getClass(draft.class) : undefined
  const bg = draft.background ? getBackground(draft.background) : undefined
  const eq = draft.equipment

  if (eq.method === 'standard' && cls) {
    for (const item of cls.startingEquipment.fixed) ids.push(item.id)
    cls.startingEquipment.choices.forEach((choice, i) => {
      const res = eq.classResolutions[i]
      if (!res || res.optionIndex < 0) return
      const option = choice.options[res.optionIndex]
      if (!option) return
      let pickIdx = 0
      for (const item of option) {
        if (item.kind === 'specific') {
          ids.push(item.id)
        } else if (item.kind === 'weapon-filter' || item.kind === 'tool-filter' || item.kind === 'focus-group') {
          ids.push(...res.pickedIds.slice(pickIdx, pickIdx + item.picks))
          pickIdx += item.picks
        }
      }
    })
  }
  if (eq.method === 'wealth') for (const p of eq.purchasedItems) ids.push(p.itemId)
  if (bg) {
    for (const item of resolveBackgroundItems(bg, draft.backgroundChoices)) if (item.id) ids.push(item.id)
  }

  return [...new Set(ids)]
    .map(getWeaponById)
    .filter((w): w is Weapon => w !== undefined)
}

/** Uma linha da tabela de ataques, com a chave estável pra lista. */
export type SheetAttack = WeaponAttack & { key: string }

/**
 * A tabela de ataques da ficha — a Revisão e o PDF chamam só isto: uma linha por arma carregada e,
 * no fim, o golpe desarmado, que todo personagem tem (p. 196) e é o ataque principal do monge.
 *
 * Cada linha já vem com o que as características fazem nela (`getWeaponAttackEffects`): Arquearia
 * no número; Duelismo, Armas Grandes e o ataque da outra mão como nota. Artes Marciais entra no
 * número das armas de monge e do golpe desarmado quando o equipamento deixa (sem armadura nem
 * escudo); quando não deixa, a linha do golpe desarmado diz o que a impede.
 */
export function getSheetAttacks(draft: CharacterDraft, finalScores: FinalScores): SheetAttack[] {
  const base = {
    strMod: calculateModifier(finalScores.STR),
    dexMod: calculateModifier(finalScores.DEX),
    proficiencyBonus: getProficiencyBonus(draft.level ?? 1),
    effects: getWeaponAttackEffects(draft),
  }
  const ma = getMartialArts(draft, finalScores)
  const martialArts = ma?.active ? { source: ma.source, die: ma.die, condition: ma.condition } : undefined

  const weapons = getEquippedWeapons(draft).map(weapon => ({
    key: weapon.id,
    ...getWeaponAttack(weapon, { ...base, martialArts, proficient: hasWeaponProficiency(draft, weapon) }),
  }))

  const unarmed = getUnarmedStrike({ ...base, martialArts, unarmedDie: getUnarmedDamageDie(draft) ?? undefined })
  if (ma && !ma.active) {
    unarmed.notes.push(
      `${ma.source} (d${ma.die}, Destreza) fora deste número e das armas de monge: você está de ${ma.blockedBy}`,
    )
  }
  return [...weapons, { key: 'unarmed', ...unarmed }]
}
