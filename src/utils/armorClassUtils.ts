import type { Armor } from '../types/equipment'

/** Classes com o traço Defesa sem Armadura (fórmula difere entre elas). */
export type UnarmoredDefense = 'barbarian' | 'monk' | null

const UNARMORED_DEFENSE_BY_CLASS: Record<string, Exclude<UnarmoredDefense, null>> = {
  barbarian: 'barbarian',
  monk: 'monk',
}

export function getUnarmoredDefense(classId: string | null | undefined): UnarmoredDefense {
  if (!classId) return null
  return UNARMORED_DEFENSE_BY_CLASS[classId] ?? null
}

export type AcComponent = { label: string; value: number }

export type ArmorClassResult = {
  value: number
  components: AcComponent[]
  stealthDisadvantage: boolean
}

export type ArmorClassParams = {
  dexMod: number
  conMod: number
  wisMod: number
  bodyArmor?: Armor
  hasShield?: boolean
  unarmoredDefense?: UnarmoredDefense
  hasDefenseFightingStyle?: boolean
}

/**
 * Calcula a Classe de Armadura pelo PHB 2014.
 *
 * - Com armadura: base da armadura + DES (leve: total; média: teto +2; pesada: 0);
 *   Estilo de Luta Defesa soma +1 (só vale vestindo armadura).
 * - Sem armadura: Defesa sem Armadura do bárbaro (10 + DES + CON, permite escudo)
 *   ou do monge (10 + DES + SAB, apenas sem escudo); senão 10 + DES.
 * - Escudo soma +2 e empilha com qualquer caso, exceto anula a Defesa sem
 *   Armadura do monge (que exige mãos livres de escudo).
 */
export function calculateArmorClass(params: ArmorClassParams): ArmorClassResult {
  const {
    dexMod,
    conMod,
    wisMod,
    bodyArmor,
    hasShield = false,
    unarmoredDefense = null,
    hasDefenseFightingStyle = false,
  } = params

  const components: AcComponent[] = []
  let stealthDisadvantage = false

  if (bodyArmor) {
    const dexBonus =
      bodyArmor.dexModifier === 'full'
        ? dexMod
        : bodyArmor.dexModifier === 'max-2'
          ? Math.min(dexMod, 2)
          : 0
    components.push({ label: bodyArmor.name, value: bodyArmor.acBase })
    if (dexBonus !== 0) components.push({ label: 'DES', value: dexBonus })
    if (hasDefenseFightingStyle) components.push({ label: 'Estilo Defesa', value: 1 })
    stealthDisadvantage = bodyArmor.stealthDisadvantage
  } else if (unarmoredDefense === 'barbarian') {
    components.push({ label: 'Base', value: 10 })
    components.push({ label: 'DES', value: dexMod })
    components.push({ label: 'CON', value: conMod })
  } else if (unarmoredDefense === 'monk' && !hasShield) {
    components.push({ label: 'Base', value: 10 })
    components.push({ label: 'DES', value: dexMod })
    components.push({ label: 'SAB', value: wisMod })
  } else {
    components.push({ label: 'Base', value: 10 })
    components.push({ label: 'DES', value: dexMod })
  }

  if (hasShield) components.push({ label: 'Escudo', value: 2 })

  const value = components.reduce((sum, c) => sum + c.value, 0)
  return { value, components, stealthDisadvantage }
}
