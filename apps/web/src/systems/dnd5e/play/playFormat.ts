import type { SpellbookList } from '@rpg/rules/systems/dnd5e/types/spellbook'
import { describeRollGuide, type RollGuideEntry } from '@rpg/rules/systems/dnd5e/utils/rollGuide'

/**
 * O nome acessível de um número tocável: "Atletismo: 1d20 + 5, com desvantagem (Envenenado)".
 * Os marcadores visuais (▲ ▼ ✕) ficam de fora; a frase de `describeRollGuide` já diz tudo.
 */
export function rollButtonLabel(entry: RollGuideEntry): string {
  return `${entry.label}: ${describeRollGuide(entry)}`
}

/**
 * O nome acessível do "Conjurar" de uma magia do grimório (aba Magia e grupos da aba Ações):
 * "Conjurar: Escudo Arcano". A magia repetida entre fontes não bloqueia, e o grimório dá uma entrada
 * por conjuração (o Detectar Magia do clérigo / mago, o Escudo Arcano do mago e do Iniciado em
 * Magia), cada uma com a sua CD, o seu ataque e o seu ritual: nas duas, o nome leva a conjuração —
 * "Conjurar: Escudo Arcano — Iniciado em Magia (Mago)" —, que a tela já mostra ao lado.
 */
export function castButtonLabel(spellbook: readonly SpellbookList[], spellId: string, spellName: string, source: string): string {
  const lists = spellbook.filter(list => list.spells.some(s => s.spellId === spellId)).length
  return lists > 1 ? `Conjurar: ${spellName} — ${source}` : `Conjurar: ${spellName}`
}

/** "1º", "2º"… para os níveis de espaço de magia. */
export function ordinal(n: number): string {
  return `${n}º`
}
