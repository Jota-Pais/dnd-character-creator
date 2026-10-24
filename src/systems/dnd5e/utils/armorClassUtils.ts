import type { Armor } from '../types/equipment'
import type { AbilityScore } from '../types/race'
import type { UnarmoredAcFormula } from '../types/effects'
import { ABILITY_LABELS } from './abilityScoreUtils'

/** Fórmula de CA sem armadura com o nome de quem a deu ("Resiliência Dracônica"). */
export type UnarmoredAcOption = UnarmoredAcFormula & { source: string }

export type AcComponent = { label: string; value: number }

export type ArmorClassResult = {
  value: number
  components: AcComponent[]
  stealthDisadvantage: boolean
}

export type ArmorClassParams = {
  /** Modificadores finais dos atributos. */
  mods: Record<AbilityScore, number>
  bodyArmor?: Armor
  hasShield?: boolean
  /** Fórmulas alternativas de CA sem armadura que o personagem tem (de características). */
  unarmoredAc?: UnarmoredAcOption[]
  hasDefenseFightingStyle?: boolean
}

/** O cálculo padrão de quem não veste armadura: 10 + DES (p. 14). */
const DEFAULT_UNARMORED: UnarmoredAcFormula = { id: 'default', base: 10, abilities: ['DEX'] }

function unarmoredComponents(
  formula: UnarmoredAcFormula,
  label: string,
  mods: Record<AbilityScore, number>,
): AcComponent[] {
  return [
    { label, value: formula.base },
    ...formula.abilities.map(ab => ({ label: ABILITY_LABELS[ab].short, value: mods[ab] })),
  ]
}

const sum = (components: AcComponent[]) => components.reduce((s, c) => s + c.value, 0)

/**
 * Calcula a Classe de Armadura pelo PHB 2014.
 *
 * - Com armadura: base da armadura + DES (leve: total; média: teto +2; pesada: 0);
 *   Estilo de Luta Defesa soma +1 (só vale vestindo armadura). As fórmulas sem armadura não valem.
 * - Sem armadura: 10 + DES ou uma das fórmulas alternativas (Defesa sem Armadura, Resiliência
 *   Dracônica). Elas não se somam — "você escolhe qual usar" (p. 14) —, então a ficha mostra a
 *   maior. A que proíbe escudo (monge) sai da disputa quando há escudo.
 * - Escudo soma +2 sobre qualquer base (p. 146).
 */
export function calculateArmorClass(params: ArmorClassParams): ArmorClassResult {
  const {
    mods,
    bodyArmor,
    hasShield = false,
    unarmoredAc = [],
    hasDefenseFightingStyle = false,
  } = params

  let components: AcComponent[] = []
  let stealthDisadvantage = false

  if (bodyArmor) {
    const dexMod = mods.DEX
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
  } else {
    // As das características primeiro: no empate, a ficha mostra a característica.
    const candidates = [
      ...unarmoredAc
        .filter(f => !(hasShield && f.noShield))
        .map(f => unarmoredComponents(f, f.source, mods)),
      unarmoredComponents(DEFAULT_UNARMORED, 'Base', mods),
    ]
    components = candidates.reduce((best, c) => (sum(c) > sum(best) ? c : best))
  }

  if (hasShield) components.push({ label: 'Escudo', value: 2 })

  return { value: sum(components), components, stealthDisadvantage }
}

/**
 * A conta da CA aberta, em texto de ficha: "13 (Resiliência Dracônica) + 2 (DES) + 2 (Escudo)".
 * Na mesa se troca de armadura e se larga o escudo; sem as parcelas o jogador teria que abrir o
 * app pra saber o que recalcular.
 */
export function formatArmorClassBreakdown(result: ArmorClassResult): string {
  return result.components
    .map((c, i) => {
      if (i === 0) return c.label === 'Base' ? `${c.value}` : `${c.value} (${c.label})`
      return `${c.value >= 0 ? '+' : '−'} ${Math.abs(c.value)} (${c.label})`
    })
    .join(' ')
}
