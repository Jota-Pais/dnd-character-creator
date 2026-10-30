import type { DamageTypeId } from '@rpg/rules/systems/dnd5e/types/damage'
import { DAMAGE_TYPES } from '@rpg/rules/systems/dnd5e/utils/damageTypes'
import { damageTypeSetHas, type SheetDamageDefense } from '@rpg/rules/systems/dnd5e/utils/sheetEffects'

/** O que o campo de PV aplica: dano, cura ou PV temporários. */
export type HpAction = 'damage' | 'heal' | 'temp'

/** O campo de PV lido: o sinal digitado (se houver) e o número (null enquanto não há dígito). */
export type HpEntry = { sign: 'plus' | 'minus' | null; amount: number | null }

/**
 * O menos dos campos de número do jogo (PV, rolador livre): vale o do teclado ("-"), o tipográfico
 * ("−") e a meia-risca ("–"), que o teclado do celular oferece no lugar do hífen. Os dois últimos
 * viram o primeiro.
 */
export function normalizeMinus(text: string): string {
  return text.replace(/[−–]/g, '-')
}

/** Sinal opcional e dígitos, com o menos já normalizado. */
const HP_ENTRY = /^\s*([+-]?)\s*(\d*)\s*$/

/** Lê o campo de PV: "−7", "+5", "7", "-" (ainda digitando). Texto que não é isso dá null. */
export function parseHpEntry(text: string): HpEntry | null {
  const match = HP_ENTRY.exec(normalizeMinus(text))
  if (!match) return null
  const [, sign, digits] = match
  return {
    sign: sign === '' ? null : sign === '+' ? 'plus' : 'minus',
    amount: digits === '' ? null : Number(digits),
  }
}

/**
 * A ação que o campo aplica: o sinal manda ("−7" é dano, "+5" é cura), sem escolher o botão antes;
 * sem sinal, vale o botão escolhido (ou nada). Com "PV temporários" escolhido, o "+" só confirma
 * o número: PV temporário é sempre um ganho, e trocar por cura aplicaria outra coisa.
 */
export function resolveHpAction(entry: HpEntry | null, selected: HpAction | null): HpAction | null {
  if (entry?.sign === 'minus') return 'damage'
  if (entry?.sign === 'plus') return selected === 'temp' ? 'temp' : 'heal'
  return selected
}

/** O texto sem o sinal: ao tocar Dano, Cura ou PV temporários, o botão vence o sinal digitado. */
export function stripHpSign(text: string): string {
  return normalizeMinus(text).replace(/^\s*[+-]\s*/, '')
}

// ── O tipo do dano e as defesas (p. 199) ─────────────────────────────────────

/** O tipo escolhido numa parcela: um dos 13, ou "Outro tipo" (um sem defesa a aplicar). */
export type DamageTypeChoice = DamageTypeId | 'other'

/** O tipo que vai ao `applyDamage`: "Outro tipo" e nenhum escolhido não levam tipo. */
export function choiceToDamageType(choice: DamageTypeChoice | null): DamageTypeId | undefined {
  return choice && choice !== 'other' ? choice : undefined
}

/** A defesa vale agora para algum tipo de dano (não impedida pelo equipamento, nem só de condição). */
const usableAgainstDamage = (d: SheetDamageDefense) => !d.blockedBy && d.kind !== 'conditionImmunity'

/**
 * Os tipos que têm defesa a aplicar agora — os chips do painel, na ordem do livro, antes do "Outro
 * tipo". A defesa de todo dano (Petrificado, Aura de Vigilância) não pede o tipo e não vira chip.
 * Vazio: quem não tem defesa por tipo usa o painel como na Fase 1.
 */
export function getDefendedDamageTypes(defenses: readonly SheetDamageDefense[]): DamageTypeId[] {
  const usable = defenses.filter(usableAgainstDamage)
  return DAMAGE_TYPES.map(t => t.id).filter(id => usable.some(d => Array.isArray(d.types) && d.types.includes(id)))
}

/** Uma caixa do painel: a situação (ou a exceção) e quem a declara. */
export type DefenseQuestion = { text: string; sources: string[] }

/**
 * As caixas que o dano pede, desligadas por padrão: a situação das defesas condicionais ("de
 * magia") e as exceções que cancelam uma defesa ("arma mágica ou de prata"). Só as das defesas que
 * alcançam os tipos das parcelas (`undefined` = parcela sem tipo); a de todo dano, sempre.
 */
export function getDefenseQuestions(
  defenses: readonly SheetDamageDefense[],
  types: readonly (DamageTypeId | undefined)[],
): { conditions: DefenseQuestion[]; exceptions: DefenseQuestion[] } {
  const reaching = defenses.filter(d => usableAgainstDamage(d)
    && (d.types === 'all' || types.some(t => t !== undefined && damageTypeSetHas(d.types, t))))
  const collect = (pick: (d: SheetDamageDefense) => string | undefined): DefenseQuestion[] => {
    const out: DefenseQuestion[] = []
    for (const d of reaching) {
      const text = pick(d)
      if (!text) continue
      const known = out.find(q => q.text === text)
      if (!known) out.push({ text, sources: [d.source] })
      else if (!known.sources.includes(d.source)) known.sources.push(d.source)
    }
    return out
  }
  return { conditions: collect(d => d.condition), exceptions: collect(d => d.exceptWhen) }
}

/**
 * As defesas que se aplicam aos tipos escolhidos, para a linha embaixo dos chips: o jogador vê o
 * que o tipo vai fazer antes de aplicar ("Resistência a fogo (Resistência Infernal)").
 */
export function getDefensesForTypes(
  defenses: readonly SheetDamageDefense[],
  types: readonly DamageTypeId[],
): SheetDamageDefense[] {
  return defenses.filter(d => usableAgainstDamage(d) && Array.isArray(d.types) && types.some(t => damageTypeSetHas(d.types, t)))
}
