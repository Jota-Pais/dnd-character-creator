import type { ArmorClassResult } from '../../utils/armorClassUtils'
import { formatArmorClassBreakdown } from '../../utils/armorClassUtils'
import type { PassiveGuide, SpellcastingGuide } from '../../utils/rollGuide'
import type { SheetConditionalAc } from '../../utils/sheetEffects'

/**
 * "De onde vem este número" para o que não se rola: CA, CD de magia, Percepção passiva. As
 * parcelas vêm prontas da fonte única de cada número (`getSheetArmorClass`, o guia de rolagens):
 * aqui só se monta o que a folha mostra, sem refazer conta.
 */
export type NumberSource = {
  /** Título da folha: "Classe de Armadura", "CD de magia — Mago". */
  title: string
  value: number
  /** A primeira parcela é o ponto de partida (10, 8, a armadura); as demais somam. */
  items: { label: string; value: number }[]
  /** A conta aberta numa linha, quando a ficha tem uma ("14 (Brunea) + 2 (DES)"). */
  formula?: string
  /** O que o número é, em uma frase para quem está começando. */
  hint?: string
  /** Linhas condicionais: fora do número. */
  notes: string[]
}

/**
 * A CA da ficha (`getSheetArmorClass`), com os bônus condicionais como linha — somar o +1 do
 * Ambidestro mentiria para quem não está com duas armas (o mesmo texto da Revisão).
 */
export function armorClassSource(ac: ArmorClassResult, conditional: SheetConditionalAc[]): NumberSource {
  return {
    title: 'Classe de Armadura',
    value: ac.value,
    items: ac.components,
    formula: formatArmorClassBreakdown(ac),
    hint: 'O ataque contra você acerta se o total for igual ou maior que a sua CA.',
    notes: [
      ...conditional.map(b => `+${b.value} de CA ${b.condition} (${b.source}).`),
      ...(ac.stealthDisadvantage ? ['A armadura vestida dá desvantagem em Furtividade.'] : []),
    ],
  }
}

/** A CD de magia de uma classe conjuradora: 8 + proficiência + atributo de conjuração. */
export function spellSaveDcSource(sc: SpellcastingGuide): NumberSource {
  return {
    title: `CD de magia — ${sc.label}`,
    value: sc.saveDc,
    items: sc.saveDcBreakdown,
    hint: 'O que os alvos das suas magias precisam tirar no teste de resistência.',
    notes: [],
  }
}

/** A Percepção passiva do guia: a da ficha, com o ±5 da vantagem ou desvantagem em vigor. */
export function passiveSource(passive: PassiveGuide): NumberSource {
  return {
    title: passive.label,
    value: passive.value,
    items: passive.breakdown,
    hint: 'O valor que o Mestre usa quando você não rola — por exemplo, para notar um monstro escondido (pág. 177).',
    notes: passive.notes,
  }
}
