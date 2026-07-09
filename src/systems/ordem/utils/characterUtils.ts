import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemClass } from '../types/class'
import type { Trilha } from '../types/trilha'
import { getOrigin } from './originUtils'
import { getOrdemClass, getFreeSkillChoiceCount } from './classUtils'
import { getTrilhasByClass } from './trilhaUtils'
import { getPowersByClass } from './powerUtils'
import { getNexIndex, getReachedPowerSlots, getReachedAttributeIncreaseSlots, getReachedSkillGradeSlots, ATTRIBUTE_INCREASE_CAP } from './progressionUtils'

export type DerivedStats = {
  hp: number
  pe: number
  sanity: number
}

/** PV/PE/Sanidade no NEX do personagem — cresce a cada degrau alcançado desde NEX 5% (Tabelas 1.3/1.4/1.5). */
export function deriveStats(cls: OrdemClass, attributes: OrdemCharacterDraft['attributes'], nex: number): DerivedStats {
  const tiersBeyondFirst = Math.max(0, getNexIndex(nex))
  return {
    hp: cls.hp.initialFlat + attributes.vigor + tiersBeyondFirst * (cls.hp.perNexFlat + attributes.vigor),
    pe: cls.pe.initialFlat + attributes.presence + tiersBeyondFirst * (cls.pe.perNexFlat + attributes.presence),
    sanity: cls.sanity.initialFlat + tiersBeyondFirst * cls.sanity.perNex,
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

// ── Progressão por NEX (trilha, poderes, aumento de atributo, grau de treinamento, versatilidade) ──

/** Atributos base + os aumentos de Aumento de Atributo já escolhidos (teto 5 por atributo). */
export function getEffectiveAttributes(draft: OrdemCharacterDraft): OrdemCharacterDraft['attributes'] {
  const effective = { ...draft.attributes }
  for (const attr of draft.attributeIncreaseChoices) {
    if (attr) effective[attr] = Math.min(ATTRIBUTE_INCREASE_CAP, effective[attr] + 1)
  }
  return effective
}

export function getRequiredPowerSlots(nex: number): number {
  return getReachedPowerSlots(nex).length
}

export function getRequiredAttributeIncreaseSlots(nex: number): number {
  return getReachedAttributeIncreaseSlots(nex).length
}

export function getRequiredSkillGradeSlots(nex: number): number {
  return getReachedSkillGradeSlots(nex).length
}

/**
 * Poderes de classe disponíveis para um slot: da lista da classe, excluindo os já escolhidos em
 * OUTROS slots (a menos que repetíveis). Passar `slotIndex` isenta a própria escolha do slot da
 * exclusão, senão o poder some da lista assim que é escolhido e o slot nunca aparece marcado.
 * Sem `slotIndex` (ex.: Versatilidade, que guarda a escolha fora de `powerChoices`), exclui
 * qualquer poder já escolhido em algum slot regular.
 */
export function getAvailablePowerOptions(draft: OrdemCharacterDraft, cls: OrdemClass, slotIndex?: number) {
  const chosenElsewhere = draft.powerChoices.filter((p, i): p is string => Boolean(p) && i !== slotIndex)
  return getPowersByClass(cls.id).filter(power => power.repeatable || !chosenElsewhere.includes(power.id))
}

/** Trilhas disponíveis pra escolher em NEX 10% (todas as 5 da classe). */
export function getAvailableTrilhaOptions(cls: OrdemClass): Trilha[] {
  return getTrilhasByClass(cls.id)
}

/** Trilhas alternativas pra Versatilidade (NEX 50%) — qualquer trilha da classe que não seja a escolhida. */
export function getAvailableVersatilityTrilhaOptions(draft: OrdemCharacterDraft, cls: OrdemClass): Trilha[] {
  return getTrilhasByClass(cls.id).filter(t => t.id !== draft.trilha)
}

/** Perícias elegíveis pra um slot de Grau de Treinamento: qualquer perícia treinada que ainda não virou expert. */
export function getEligibleSkillGradeOptions(draft: OrdemCharacterDraft): string[] {
  return getTrainedSkills(draft).filter(id => getSkillGrade(draft, id) !== 'expert')
}

export type SkillGrade = 'destreinado' | 'treinado' | 'veterano' | 'expert'
const GRADES: SkillGrade[] = ['destreinado', 'treinado', 'veterano', 'expert']

/** Grau efetivo de uma perícia: treinado se estiver entre as treinadas, +1 grau por vez que aparecer nas escolhas de Grau de Treinamento. */
export function getSkillGrade(draft: OrdemCharacterDraft, skillId: string): SkillGrade {
  const baseIndex = getTrainedSkills(draft).includes(skillId) ? 1 : 0
  const upgrades = draft.skillGradeChoices.flat().filter(id => id === skillId).length
  const index = Math.min(GRADES.length - 1, baseIndex + upgrades)
  return GRADES[index]
}
