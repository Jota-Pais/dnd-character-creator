import type { CharacterDraft } from '../types/character'
import type { ArmorSetup, CarriedArmor, WornArmor } from '../types/session'
import { getArmorById } from './equipmentUtils'
import { hasArmorProficiency } from './proficiencyUtils'
import { getSessionArmor } from './sheetEffects'
import { getStartingInventory } from './sheetModel'

/**
 * A armadura vestida no jogo (Fase 2, onda `armadura`): o jogador veste e tira armadura e escudo pela
 * tela do jogo, e o draft nunca muda. A troca mora no estado de jogo como sobreposição com base
 * (`PlayState.wornArmor`): ausente, vale a armadura equipada no criador; presente, ela guarda também
 * a base — o que o criador tinha equipado quando a troca foi feita. Mudou o equipamento no criador,
 * a base não bate, e o criador manda. Uma conta só (`resolveWornArmor`) para a ficha do jogo
 * (`buildPlaySheet`), a sessão das funções da ficha (`getSheetSession`) e as operações.
 */

/** A armadura de corpo e o escudo equipados no criador (`getEquippedArmor`), pelos ids. */
export function getEquippedArmorSetup(draft: CharacterDraft): ArmorSetup {
  const { bodyArmor, hasShield } = getSessionArmor(draft)
  return { bodyArmorId: bodyArmor?.id ?? null, shield: hasShield }
}

/**
 * As armaduras e escudos que o personagem carrega: os do inventário da ficha (`getStartingInventory`,
 * o mesmo das linhas de ataque e do PDF), cada um uma vez, na ordem dele, com a proficiência. É o que
 * se pode vestir no jogo: armadura nova entra pelo criador (decisão de 2026-10-30).
 */
export function getCarriedArmor(draft: CharacterDraft): CarriedArmor[] {
  const out: CarriedArmor[] = []
  for (const item of getStartingInventory(draft)) {
    const armor = item.id ? getArmorById(item.id) : undefined
    if (!armor || out.some(a => a.id === armor.id)) continue
    out.push({ id: armor.id, name: armor.name, category: armor.category, proficient: hasArmorProficiency(draft, armor) })
  }
  return out
}

export function sameArmorSetup(a: ArmorSetup, b: ArmorSetup): boolean {
  return a.bodyArmorId === b.bodyArmorId && a.shield === b.shield
}

/**
 * A armadura vestida agora. Sem a troca do jogo, a do criador. Com ela: base diferente do equipado
 * no criador, o criador mudou o equipamento e manda (a troca cai); base igual, vale a troca, menos o
 * que deixou de ser carregado (a armadura comprada que saiu da ficha não fica vestida).
 */
export function resolveWornArmor(equipped: ArmorSetup, carried: readonly CarriedArmor[], worn?: WornArmor): ArmorSetup {
  if (!worn || !sameArmorSetup(worn.basis, equipped)) return { ...equipped }
  const bodyCarried = carried.some(a => a.id === worn.bodyArmorId && a.category !== 'shield')
  return {
    bodyArmorId: worn.bodyArmorId && bodyCarried ? worn.bodyArmorId : null,
    shield: worn.shield && carried.some(a => a.category === 'shield'),
  }
}

/** A armadura vestida que a ficha do criador tem agora (`resolveWornArmor` sobre ela). */
export function getDraftWornArmor(draft: CharacterDraft, worn?: WornArmor): ArmorSetup {
  return resolveWornArmor(getEquippedArmorSetup(draft), getCarriedArmor(draft), worn)
}
