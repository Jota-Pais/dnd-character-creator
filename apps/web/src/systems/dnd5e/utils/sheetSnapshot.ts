import { canonicalJson, jsonFingerprint } from '../../../core/utils/canonicalJson'
import type { CharacterDraft } from '../types/character'
import type { PlayNotice, PlayResult, PlaySheet, PlayState, SheetSnapshot } from '../types/playState'
import { formatModifier } from './abilityScoreUtils'
import { getFinalAbilityScores } from './asiUtils'
import { createPlayState } from './playState'
import { getRollGuide } from './rollGuide'
import { getSheetArmorClass } from './sheetEffects'

/**
 * Aviso de correção da ficha (decisão 10.2.23): quando uma correção do app muda números de uma
 * ficha já salva — PV máximo, CA, CD e ataque de magia, espaços de magia —, o jogador fica sabendo
 * ao abrir o jogo, em vez de achar o número diferente sem explicação.
 *
 * A cada abertura o jogo tira um retrato desses números (`takeSheetSnapshot`) e o compara com o da
 * abertura anterior, guardado no estado de jogo (`syncSheetSnapshot`). Número diferente com a
 * MESMA ficha só pode ser o app: avisa. Ficha mudada pelo criador: o número mudou porque o jogador
 * mudou a ficha, e o retrato só se atualiza.
 */

/**
 * Os números da ficha como o jogo os mostra, com as mesmas fontes: o PV máximo do `PlaySheet`, a
 * CA de `getSheetArmorClass` (a dos vitais) e a CD e o ataque de cada conjuração do guia de
 * rolagens (a aba Magia). O guia sai de um estado de jogo vazio: o retrato é da ficha, não da
 * sessão (condições e efeitos ligados não entram).
 */
export function takeSheetSnapshot(draft: CharacterDraft, sheet: PlaySheet, sheetUpdatedAt: number): SheetSnapshot {
  const guide = getRollGuide(draft, createPlayState(''))
  return {
    sheetUpdatedAt,
    draftFingerprint: jsonFingerprint(draft),
    maxHp: sheet.maxHp,
    armorClass: getSheetArmorClass(draft, getFinalAbilityScores(draft)).value,
    spellcasting: guide.spellcasting.map(sc => ({
      key: sc.key, label: sc.label, saveDc: sc.saveDc, attackBonus: sc.attack.modifier,
    })),
    spellSlots: [...sheet.spellSlots],
    pactSlots: sheet.pactSlots ? { ...sheet.pactSlots } : null,
  }
}

/**
 * É a mesma ficha dos dois retratos? Basta um dos dois sinais: a gravação não mudou (o draft que
 * o app carrega pode ganhar campo novo numa atualização, sem o jogador mexer) ou o draft é igual
 * (abrir a ficha no criador e voltar regrava a data sem mudar nada).
 */
function isSameSheet(before: SheetSnapshot, after: SheetSnapshot): boolean {
  return before.sheetUpdatedAt === after.sheetUpdatedAt || before.draftFingerprint === after.draftFingerprint
}

const NONE = '—'

/**
 * O que mudou de um retrato para o outro, uma parte por número: "PV máximo 12 → 14", "CA 15 →
 * 16", "espaços de 1º nível 2 → 3". A conjuração leva o nome só quando há mais de uma ("CD de
 * magia de Mago"); a que não existia (ou deixou de existir) aparece com "—".
 */
export function describeSheetChanges(before: SheetSnapshot, after: SheetSnapshot): string[] {
  const parts: string[] = []
  const change = (label: string, from: string, to: string) => {
    if (from !== to) parts.push(`${label} ${from} → ${to}`)
  }
  change('PV máximo', String(before.maxHp), String(after.maxHp))
  change('CA', String(before.armorClass), String(after.armorClass))

  const keys = [...new Set([...after.spellcasting, ...before.spellcasting].map(sc => sc.key))]
  for (const key of keys) {
    const was = before.spellcasting.find(sc => sc.key === key)
    const now = after.spellcasting.find(sc => sc.key === key)
    const of = keys.length > 1 ? ` de ${(now ?? was)?.label ?? key}` : ''
    change(`CD de magia${of}`, was ? String(was.saveDc) : NONE, now ? String(now.saveDc) : NONE)
    change(`ataque de magia${of}`, was ? formatModifier(was.attackBonus) : NONE, now ? formatModifier(now.attackBonus) : NONE)
  }

  after.spellSlots.forEach((slots, i) => change(`espaços de ${i + 1}º nível`, String(before.spellSlots[i] ?? 0), String(slots)))
  const pact = (p: SheetSnapshot['pactSlots']) => (p ? `${p.slots} de ${p.slotLevel}º nível` : NONE)
  change('espaços de Pacto', pact(before.pactSlots), pact(after.pactSlots))
  return parts
}

/**
 * Guarda o retrato novo no estado e, se a ficha é a mesma do retrato anterior e os números
 * mudaram, devolve o aviso `sheetCorrected` ("O app corrigiu sua ficha: PV máximo 12 → 14").
 * Sem retrato anterior (a primeira abertura, ou um estado salvo antes deste aviso existir) não há
 * com o que comparar: só guarda. Retrato igual devolve o MESMO estado.
 */
export function syncSheetSnapshot(state: PlayState, snapshot: SheetSnapshot): PlayResult {
  const before = state.sheetSnapshot
  if (before && canonicalJson(before) === canonicalJson(snapshot)) return { state, notices: [] }
  const next: PlayState = { ...state, sheetSnapshot: snapshot }
  const changes = before && isSameSheet(before, snapshot) ? describeSheetChanges(before, snapshot) : []
  const notices: PlayNotice[] = changes.length > 0
    ? [{ kind: 'sheetCorrected', text: `O app corrigiu sua ficha: ${changes.join('; ')}.` }]
    : []
  return { state: next, notices }
}
