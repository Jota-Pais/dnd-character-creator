import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemClass } from '../types/class'
import { getOrigin } from './originUtils'
import { getOrdemClass, getFreeSkillChoiceCount } from './classUtils'

export type DerivedStats = {
  hp: number
  pe: number
  sanity: number
}

/** PV/PE/Sanidade em NEX 5% (criação de personagem) — progressão por NEX é a Fase 12. */
export function deriveStats(cls: OrdemClass, attributes: OrdemCharacterDraft['attributes']): DerivedStats {
  return {
    hp: cls.hp.initialFlat + attributes.vigor,
    pe: cls.pe.initialFlat + attributes.presence,
    sanity: cls.sanity.initialFlat,
  }
}

/** Perícias treinadas pela origem (fixas, ou as escolhidas no lugar do mestre para o Amnésico). */
export function getOriginSkills(draft: OrdemCharacterDraft): string[] {
  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  if (!origin) return []
  return origin.skillProficiencies.length > 0 ? origin.skillProficiencies : draft.originGmSkillChoices
}

/**
 * Todas as perícias treinadas do personagem (origem + classe), sem duplicatas.
 * Perícias fixas da classe entram sempre; grupos de escolha e escolhas livres só contam se preenchidos.
 */
export function getTrainedSkills(draft: OrdemCharacterDraft): string[] {
  const origin = getOriginSkills(draft)
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return dedupe(origin)

  const groupPicks = draft.classChoiceGroupPicks.filter((s): s is string => Boolean(s))
  return dedupe([...origin, ...cls.skills.fixed, ...groupPicks, ...draft.classFreeSkillChoices])
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)]
}

/**
 * Perícias já "ocupadas" antes de resolver os grupos/escolhas livres da classe — usadas pra excluir
 * opções repetidas (regra do livro: "se receber uma perícia que já havia recebido pela origem, escolha outra").
 */
function getReservedSkills(draft: OrdemCharacterDraft, cls: OrdemClass): string[] {
  return dedupe([...getOriginSkills(draft), ...cls.skills.fixed])
}

/** Opções válidas pra um grupo de escolha da classe (exclui perícias já garantidas por origem/classe fixa). */
export function getAvailableChoiceGroupOptions(draft: OrdemCharacterDraft, cls: OrdemClass, groupIndex: number): string[] {
  const group = cls.skills.choiceGroups[groupIndex]
  if (!group) return []
  const reserved = getReservedSkills(draft, cls)
  return group.from.filter(id => !reserved.includes(id))
}

/** Opções válidas pra escolha livre da classe (todas as perícias, exceto as já garantidas por origem/classe/grupos). */
export function getAvailableFreeSkillOptions(draft: OrdemCharacterDraft, cls: OrdemClass, allSkillIds: string[]): string[] {
  const reserved = dedupe([...getReservedSkills(draft, cls), ...draft.classChoiceGroupPicks.filter((s): s is string => Boolean(s))])
  return allSkillIds.filter(id => !reserved.includes(id))
}

export function getRequiredFreeSkillCount(draft: OrdemCharacterDraft, cls: OrdemClass): number {
  return getFreeSkillChoiceCount(cls, draft.attributes.intellect)
}
