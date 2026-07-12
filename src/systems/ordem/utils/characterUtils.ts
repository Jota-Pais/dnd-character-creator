import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemClass } from '../types/class'
import type { Trilha } from '../types/trilha'
import type { OrdemRitual } from '../types/ritual'
import { getOrigin } from './originUtils'
import { getOrdemClass, getFreeSkillChoiceCount } from './classUtils'
import { getTrilhasByClass } from './trilhaUtils'
import { getPowersByClass } from './powerUtils'
import { RITUAL_COST } from './ritualUtils'
import { getNexIndex, getReachedPowerSlots, getReachedAttributeIncreaseSlots, getReachedSkillGradeSlots, ATTRIBUTE_INCREASE_CAP } from './progressionUtils'

export type DerivedStats = {
  hp: number
  pe: number
  sanity: number
  defense: number
}

/**
 * PV/PE/Sanidade no NEX do personagem — cresce a cada degrau alcançado desde NEX 5% (Tabelas 1.3/1.4/1.5).
 * Defesa = 10 + Agilidade + bônus de proteção equipada (livro pág. 43); `protectionBonus` vem da(s)
 * proteção(ões) do loadout (ver `getEquippedDefenseBonus`). `attributes` deve ser o efetivo (com aumentos de NEX).
 */
export function deriveStats(
  cls: OrdemClass,
  attributes: OrdemCharacterDraft['attributes'],
  nex: number,
  protectionBonus = 0,
): DerivedStats {
  const tiersBeyondFirst = Math.max(0, getNexIndex(nex))
  return {
    hp: cls.hp.initialFlat + attributes.vigor + tiersBeyondFirst * (cls.hp.perNexFlat + attributes.vigor),
    pe: cls.pe.initialFlat + attributes.presence + tiersBeyondFirst * (cls.pe.perNexFlat + attributes.presence),
    sanity: cls.sanity.initialFlat + tiersBeyondFirst * cls.sanity.perNex,
    defense: 10 + attributes.agility + protectionBonus,
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
  // "Se receber uma perícia que já havia recebido pela origem, escolha outra" (pág. 25):
  // perícia repetida não acumula — cada FIXA da classe que colide com a origem vira +1 escolha livre.
  const overlap = getFixedSkillOverlapWithOrigin(draft, cls).length
  return getFreeSkillChoiceCount(cls, draft.attributes.intellect) + overlap
}

/** Perícias fixas da classe que a origem já forneceu (cada uma dá direito a "escolher outra"). */
export function getFixedSkillOverlapWithOrigin(draft: OrdemCharacterDraft, cls: OrdemClass): string[] {
  const origin = getOriginSkills(draft)
  return cls.skills.fixed.filter(id => origin.includes(id))
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

// ── Personalização da ficha (F24) ──────────────────────────────────────────────

/** O agente tem um poder de classe (via slots regulares ou Versatilidade)? */
export function hasClassPower(draft: OrdemCharacterDraft, powerId: string): boolean {
  if (draft.powerChoices.includes(powerId)) return true
  return draft.versatilityChoice?.kind === 'power' && draft.versatilityChoice.powerId === powerId
}

/** Tem o poder Ritual Predileto (escolha um ritual conhecido: custo −1 PE)? */
export function hasFavoredRitualPower(draft: OrdemCharacterDraft): boolean {
  return hasClassPower(draft, 'favored-ritual')
}

/**
 * Tem a habilidade Lâmina Maldita (trilha Lâmina Paranormal, NEX 10%)? Também vale quando
 * a Versatilidade concedeu o 1º poder dessa trilha. Efeitos: Amaldiçoar Arma custa −1 PE
 * se já o conhece, e os ataques com a arma amaldiçoada podem usar Ocultismo.
 */
export function hasLaminaMaldita(draft: OrdemCharacterDraft): boolean {
  if (draft.trilha === 'paranormal-blade' && draft.nex >= 10) return true
  return draft.versatilityChoice?.kind === 'trilha' && draft.versatilityChoice.trilhaId === 'paranormal-blade'
}

/**
 * Custo final de conjuração de um ritual conhecido, com as reduções determinísticas:
 * Ritual Predileto (−1 PE no ritual escolhido) e Lâmina Maldita (−1 PE no Amaldiçoar Arma).
 * As reduções se acumulam (texto do Ritual Predileto); nunca abaixo de 0.
 */
export function getRitualCost(draft: OrdemCharacterDraft, ritual: OrdemRitual): { cost: number; notes: string[] } {
  let cost = RITUAL_COST[ritual.circle]
  const notes: string[] = []
  if (hasFavoredRitualPower(draft) && draft.favoriteRitual === ritual.id) {
    cost -= 1
    notes.push('predileto −1')
  }
  if (ritual.id === 'amaldicoar-arma' && hasLaminaMaldita(draft)) {
    cost -= 1
    notes.push('Lâmina Maldita −1')
  }
  return { cost: Math.max(0, cost), notes }
}
