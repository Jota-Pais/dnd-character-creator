import { describeRollGuide, type RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'

/**
 * O nome acessível de um número tocável: "Atletismo: 1d20 + 5, com desvantagem (Envenenado)".
 * Os marcadores visuais (▲ ▼ ✕) ficam de fora; a frase de `describeRollGuide` já diz tudo.
 */
export function rollButtonLabel(entry: RollGuideEntry): string {
  return `${entry.label}: ${describeRollGuide(entry)}`
}

/** "1º", "2º"… para os níveis de espaço de magia. */
export function ordinal(n: number): string {
  return `${n}º`
}
