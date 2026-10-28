/** O que o campo de PV aplica: dano, cura ou PV temporários. */
export type HpAction = 'damage' | 'heal' | 'temp'

/** O campo de PV lido: o sinal digitado (se houver) e o número (null enquanto não há dígito). */
export type HpEntry = { sign: 'plus' | 'minus' | null; amount: number | null }

/**
 * Sinal opcional e dígitos. O menos vale do teclado ("-"), o tipográfico ("−") e a meia-risca
 * ("–"), que o teclado do celular oferece no lugar do hífen.
 */
const HP_ENTRY = /^\s*([+\-−–]?)\s*(\d*)\s*$/

/** Lê o campo de PV: "−7", "+5", "7", "-" (ainda digitando). Texto que não é isso dá null. */
export function parseHpEntry(text: string): HpEntry | null {
  const match = HP_ENTRY.exec(text)
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
  return text.replace(/^\s*[+\-−–]\s*/, '')
}
