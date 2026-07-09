import progressionData from '../data/progression.json'

/**
 * Recursos de classe não-mágicos derivados por nível (PHB 2014): fúrias, ki,
 * ataque furtivo, inspiração de bardo, pontos de feitiçaria, invocações,
 * canalizar divindade, forma selvagem. Fonte: progression.json (tabelas do livro).
 */
const RESOURCES = progressionData.classResources as Record<string, Record<string, number[]>>

function valueAtLevel(table: number[] | undefined, level: number): number | undefined {
  if (!table) return undefined
  return table[Math.max(1, Math.min(20, level)) - 1]
}

export type ClassResource = {
  key: string
  label: string
  value: string
}

/** Rótulos e formatação de cada recurso, por classe. */
type ResourceSpec = {
  field: string
  label: string
  format?: (v: number) => string
}

const dieFmt = (v: number) => `d${v}`
const feetToMeters = (ft: number) => {
  const m = ft * 0.3
  return Number.isInteger(m) ? `+${m} m` : `+${m.toFixed(1).replace('.', ',')} m`
}
const ragesFmt = (v: number) => (v < 0 ? 'Ilimitadas' : String(v))

const SPECS: Record<string, ResourceSpec[]> = {
  barbarian: [
    { field: 'rages', label: 'Fúrias', format: ragesFmt },
    { field: 'rageDamage', label: 'Dano de Fúria', format: v => `+${v}` },
  ],
  monk: [
    { field: 'kiPoints', label: 'Pontos de Chi' },
    { field: 'martialArtsDie', label: 'Artes Marciais', format: dieFmt },
    { field: 'unarmoredMovementFt', label: 'Movimento sem Armadura', format: feetToMeters },
  ],
  rogue: [
    { field: 'sneakAttackDice', label: 'Ataque Furtivo', format: v => `${v}d6` },
  ],
  bard: [
    { field: 'bardicInspirationDie', label: 'Inspiração de Bardo', format: dieFmt },
  ],
  sorcerer: [
    { field: 'sorceryPoints', label: 'Pontos de Feitiçaria' },
  ],
  warlock: [
    { field: 'invocationsKnown', label: 'Invocações Místicas' },
  ],
  cleric: [
    { field: 'channelDivinityUses', label: 'Canalizar Divindade (usos)' },
  ],
  paladin: [
    { field: 'channelDivinityUses', label: 'Canalizar Divindade (usos)' },
  ],
  druid: [
    { field: 'wildShapeUses', label: 'Forma Selvagem (usos)' },
  ],
}

/** Valor bruto de um recurso específico no nível dado (ou undefined se não existe). */
export function getClassResourceValue(classId: string, field: string, level: number): number | undefined {
  return valueAtLevel(RESOURCES[classId]?.[field], level)
}

/**
 * Lista os recursos de classe disponíveis no nível dado, já formatados para exibição.
 * Recursos com valor 0 (ainda não desbloqueados) são omitidos.
 */
export function getClassResources(classId: string, level: number): ClassResource[] {
  const specs = SPECS[classId]
  if (!specs) return []
  const result: ClassResource[] = []
  for (const spec of specs) {
    const raw = getClassResourceValue(classId, spec.field, level)
    if (raw === undefined || raw === 0) continue
    result.push({
      key: spec.field,
      label: spec.label,
      value: spec.format ? spec.format(raw) : String(raw),
    })
  }
  return result
}
