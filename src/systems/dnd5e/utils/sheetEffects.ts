import type { CharacterDraft } from '../types/character'
import type { Feat } from '../types/feat'
import type { ArmorProficiency } from '../types/class'
import type { ConditionalAcBonus } from '../types/effects'
import { getFeat } from './featUtils'
import { getAllAsiChoices, getTotalHpAverage, getTotalHpRolled } from './multiclassUtils'

/**
 * Agregador dos efeitos que a ficha aplica sozinha, atravessando as fontes de característica
 * (hoje só talentos; raça e classe entram no mesmo formato quando forem estruturadas).
 * Espelha `src/systems/ordem/utils/sheetEffects.ts`.
 *
 * Regra geral: efeito INCONDICIONAL entra no número da ficha; efeito CONDICIONAL vira linha
 * própria com a condição, porque somá-lo seria mentir — o +1 do Ambidestro não vale quando você
 * está de escudo.
 *
 * Fica num módulo próprio, e não em `featUtils`, porque cruza talento com nível e com o draft
 * inteiro; `featUtils` continua sendo só o acesso ao catálogo.
 */

/** Uma linha de efeito na ficha: o valor e de onde ele veio. */
export type SheetEffect<T> = { source: string; value: T }

/**
 * Talentos que o personagem possui, por qualquer via: o do Humano Variante e os escolhidos em
 * cada espaço de ASI (da classe primária e das adicionais). Sem repetir — o livro não deixa pegar
 * o mesmo talento duas vezes, mas a ficha não deve dobrar o bônus se isso escapar.
 */
export function getOwnedFeats(draft: CharacterDraft): Feat[] {
  const ids = [
    ...(draft.raceChoices.feat ? [draft.raceChoices.feat] : []),
    ...getAllAsiChoices(draft)
      .filter(c => c.kind === 'feat')
      .map(c => (c as { featId: string }).featId)
      .filter(Boolean),
  ]
  return [...new Set(ids)]
    .map(getFeat)
    .filter((f): f is Feat => f !== undefined)
}

/** Percorre os talentos possuídos extraindo um efeito, junto com o nome de quem concedeu. */
function collect<T>(draft: CharacterDraft, pick: (feat: Feat) => T | undefined): SheetEffect<T>[] {
  const out: SheetEffect<T>[] = []
  for (const feat of getOwnedFeats(draft)) {
    const value = pick(feat)
    if (value !== undefined) out.push({ source: feat.name, value })
  }
  return out
}

// ── Iniciativa ─────────────────────────────────────────────────────────────────

export function getInitiativeBonuses(draft: CharacterDraft): SheetEffect<number>[] {
  return collect(draft, f => f.effects?.initiativeBonus)
}

/** Soma dos bônus de iniciativa (Alerta +5). Entra direto no número da ficha. */
export function getInitiativeBonusTotal(draft: CharacterDraft): number {
  return getInitiativeBonuses(draft).reduce((sum, e) => sum + e.value, 0)
}

// ── Deslocamento ───────────────────────────────────────────────────────────────

export function getSpeedBonuses(draft: CharacterDraft): SheetEffect<number>[] {
  return collect(draft, f => f.effects?.speedBonus)
}

/** Bônus de deslocamento em PÉS, a unidade da raça (Mobilidade +10 pés). */
export function getSpeedBonusTotal(draft: CharacterDraft): number {
  return getSpeedBonuses(draft).reduce((sum, e) => sum + e.value, 0)
}

// ── Pontos de vida ─────────────────────────────────────────────────────────────

/**
 * PV extras de talento no nível dado (Robusto: 2 × nível). Some ao total de PV, não ao dado de
 * vida — o livro fala em "máximo de pontos de vida", não em rolagem.
 */
export function getFeatHpBonus(draft: CharacterDraft, level: number): number {
  return getOwnedFeats(draft).reduce((sum, f) => sum + (f.effects?.hpPerLevel ?? 0) * level, 0)
}

/**
 * PV totais da ficha: o poço de dados de vida das classes mais os extras de talento. Mora aqui,
 * e não em `multiclassUtils`, porque só este módulo enxerga os talentos — e `multiclassUtils`
 * não pode importá-lo (é ele quem fornece `getAllAsiChoices`).
 */
export function getTotalHp(draft: CharacterDraft, conModifier: number): number {
  const base = draft.hpMethod === 'roll'
    ? getTotalHpRolled(draft, conModifier)
    : getTotalHpAverage(draft, conModifier)
  return base + getFeatHpBonus(draft, draft.level ?? 1)
}

// ── Valores passivos ───────────────────────────────────────────────────────────

/** Bônus no valor PASSIVO de uma perícia (Observador +5 em Percepção e Investigação). */
export function getPassiveScoreBonus(draft: CharacterDraft, skillId: string): number {
  return getOwnedFeats(draft).reduce((sum, f) => {
    const bonus = f.effects?.passiveScoreBonus
    return bonus?.skills.includes(skillId) ? sum + bonus.value : sum
  }, 0)
}

// ── Classe de Armadura condicional ─────────────────────────────────────────────

export type SheetConditionalAc = ConditionalAcBonus & { source: string }

/**
 * Bônus de CA que dependem de uma situação. Ficam FORA do valor de CA — cada um vira uma linha
 * com a condição, do mesmo jeito que o Ordem lista a Defesa condicional.
 */
export function getConditionalAcBonuses(draft: CharacterDraft): SheetConditionalAc[] {
  return getOwnedFeats(draft).flatMap(feat =>
    (feat.effects?.conditionalAcBonus ?? []).map(bonus => ({ ...bonus, source: feat.name })),
  )
}

// ── Proficiências concedidas ───────────────────────────────────────────────────

/** Armaduras liberadas por talento (Proteção Leve / Moderada / Pesada). */
export function getFeatArmorProficiencies(draft: CharacterDraft): ArmorProficiency[] {
  return getOwnedFeats(draft).flatMap(f => f.effects?.grantedArmorProficiencies ?? [])
}
