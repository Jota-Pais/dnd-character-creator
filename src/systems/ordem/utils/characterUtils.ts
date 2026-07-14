import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemClass } from '../types/class'
import type { Trilha, TrilhaFeature } from '../types/trilha'
import type { OrdemRitual, OrdemElement } from '../types/ritual'
import { getOrigin } from './originUtils'
import { getOrdemClass, getFreeSkillChoiceCount } from './classUtils'
import { getTrilhasByClass, getTrilha } from './trilhaUtils'
import { getPowersByClass } from './powerUtils'
import { RITUAL_COST, getRitualById } from './ritualUtils'
import { getNexIndex, getReachedPowerSlots, getReachedAttributeIncreaseSlots, getReachedSkillGradeSlots, ATTRIBUTE_INCREASE_CAP, TRILHA_FEATURE_NEX } from './progressionUtils'

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
  // Treinamento em Perícia (poder): cada perícia escolhida vira treinada (F27).
  const powerPicks = getPowerSkillPicks(draft)
  const origin = getOriginSkills(draft)
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return dedupe([...origin, ...powerPicks])

  const groupPicks = draft.classChoiceGroupPicks.filter((s): s is string => Boolean(s))
  return dedupe([...origin, ...cls.skills.fixed, ...groupPicks, ...draft.classFreeSkillChoices, ...powerPicks])
}

/** Perícias treinadas SEM os picks do poder Treinamento em Perícia (base pra saber o que é upgrade). */
function getTrainedSkillsWithoutPowerPicks(draft: OrdemCharacterDraft): string[] {
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
  // Treinamento em Perícia numa perícia JÁ treinada (fora do próprio poder) sobe o grau
  // (NEX 35%+ → veterano, 70%+ → expert); a 1ª escolha numa destreinada só treina.
  const baseTrained = getTrainedSkillsWithoutPowerPicks(draft).includes(skillId)
  const powerPicks = getPowerSkillPicks(draft).filter(id => id === skillId)
  const powerUpgrades = baseTrained ? powerPicks.length : Math.max(0, powerPicks.length - 1)
  const upgrades = draft.skillGradeChoices.flat().filter(id => id === skillId).length + powerUpgrades
  const index = Math.min(GRADES.length - 1, baseIndex + upgrades)
  return GRADES[index]
}

// ── Poderes com escolha embutida (F27) ─────────────────────────────────────────

/** Poderes que exigem parâmetros: quantos e de que tipo. */
export const POWER_PARAM_SPECS: Record<string, { kind: 'skills' | 'element'; count: number }> = {
  'skill-training': { kind: 'skills', count: 2 },
  'element-specialist': { kind: 'element', count: 1 },
  'element-master': { kind: 'element', count: 1 },
}

/** Instâncias de poderes escolhidos que exigem parâmetro (slots regulares + Versatilidade). */
export function getPowerParamSlots(draft: OrdemCharacterDraft): { key: string; powerId: string }[] {
  const slots: { key: string; powerId: string }[] = []
  draft.powerChoices.forEach((id, i) => {
    if (id && POWER_PARAM_SPECS[id]) slots.push({ key: `slot-${i}`, powerId: id })
  })
  if (draft.versatilityChoice?.kind === 'power' && POWER_PARAM_SPECS[draft.versatilityChoice.powerId]) {
    slots.push({ key: 'versatility', powerId: draft.versatilityChoice.powerId })
  }
  return slots
}

/** Perícias escolhidas em todas as instâncias de Treinamento em Perícia. */
export function getPowerSkillPicks(draft: OrdemCharacterDraft): string[] {
  return getPowerParamSlots(draft)
    .filter(s => s.powerId === 'skill-training')
    .flatMap(s => draft.powerParams[s.key] ?? [])
    .filter(Boolean)
}

/** Elemento escolhido pra um poder de elemento (primeira instância preenchida). */
export function getChosenElementForPower(draft: OrdemCharacterDraft, powerId: string): OrdemElement | null {
  const slot = getPowerParamSlots(draft).find(s => s.powerId === powerId && (draft.powerParams[s.key] ?? []).length > 0)
  return slot ? ((draft.powerParams[slot.key][0] as OrdemElement) ?? null) : null
}

/** Todas as instâncias de poderes com parâmetro estão preenchidas? (valida o passo Progressão) */
export function arePowerParamsComplete(draft: OrdemCharacterDraft): boolean {
  return getPowerParamSlots(draft).every(s => {
    const spec = POWER_PARAM_SPECS[s.powerId]
    const values = (draft.powerParams[s.key] ?? []).filter(Boolean)
    return values.length === spec.count
  })
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
 * Redução de categoria da Arma Favorita (trilha Aniquilador): 0 antes de NEX 10%, e I/II/III/IV
 * em NEX 10/40/65/99 (A Favorita, Técnica Secreta, Técnica Sublime, Máquina de Matar). A
 * Versatilidade (NEX 50%) só concede o 1º poder de outra trilha — se for Aniquilador, isso é
 * só "A Favorita", então a redução fica fixa em I, sem escalar com o NEX de quem versatilizou.
 */
export function getFavoriteWeaponReduction(draft: OrdemCharacterDraft): number {
  if (draft.trilha === 'annihilator') {
    if (draft.nex >= 99) return 4
    if (draft.nex >= 65) return 3
    if (draft.nex >= 40) return 2
    if (draft.nex >= 10) return 1
    return 0
  }
  if (draft.versatilityChoice?.kind === 'trilha' && draft.versatilityChoice.trilhaId === 'annihilator') return 1
  return 0
}

/**
 * Redução de categoria das Ferramentas Favoritas (origem Engenheiro): I fixo, sem escalar —
 * ao contrário da Arma Favorita, é um poder de origem, ativo desde a criação da ficha.
 */
export function getFavoriteEquipmentReduction(draft: OrdemCharacterDraft): number {
  return draft.origin === 'engineer' ? 1 : 0
}

/**
 * Perícia de ataque alternativa VÁLIDA de uma arma: o teste é fixo pela arma (Luta corpo a
 * corpo / Pontaria à distância); a única exceção do livro é usar Ocultismo com a arma
 * amaldiçoada via Lâmina Maldita. Escolhas fora disso são ignoradas.
 */
export function getWeaponSkillOverride(draft: OrdemCharacterDraft, uid: string): 'occultism' | undefined {
  return draft.weaponSkillChoices[uid] === 'occultism' && hasLaminaMaldita(draft) ? 'occultism' : undefined
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
  // Mestre em Elemento: −1 PE nos rituais do elemento escolhido (multi-elemento usa o escolhido ao aprender).
  const masterElement = getChosenElementForPower(draft, 'element-master')
  if (masterElement) {
    const ritualElement = ritual.elements.length > 1 ? draft.ritualElementChoices[ritual.id] : ritual.elements[0]
    if (ritualElement === masterElement) {
      cost -= 1
      notes.push('Mestre em Elemento −1')
    }
  }
  return { cost: Math.max(0, cost), notes }
}

// ── Rituais concedidos por trilha ───────────────────────────────────────────────

export type GrantedRitual = {
  ritual: OrdemRitual
  /** Rótulo da fonte que ensinou o ritual (ex.: "Trilha Conduíte" ou "Versatilidade"). */
  source: string
}

/**
 * Rituais que o personagem aprende automaticamente por features de trilha ("Você aprende o
 * ritual X"), derivados do NEX + trilha escolhida — e da Versatilidade (NEX 50%), quando ela
 * concede a 1ª feature de outra trilha (ex.: Lâmina Maldita → Amaldiçoar Arma). São bônus:
 * NÃO contam no limite de rituais conhecidos. A lista é deduplicada por id e omite os rituais
 * que o jogador já escolheu manualmente em `ritualChoices` (para não listar o mesmo duas vezes).
 */
export function getGrantedRituals(draft: OrdemCharacterDraft): GrantedRitual[] {
  const result: GrantedRitual[] = []
  const seen = new Set<string>()

  const collect = (features: TrilhaFeature[], source: string) => {
    for (const feature of features) {
      const ritualId = feature.grantsRitual
      if (!ritualId || seen.has(ritualId)) continue
      const ritual = getRitualById(ritualId)
      if (!ritual) continue
      seen.add(ritualId)
      result.push({ ritual, source })
    }
  }

  // Trilha do personagem: features cujo NEX já foi alcançado.
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  if (trilha) {
    collect(trilha.features.filter(f => f.nex <= draft.nex), `Trilha ${trilha.name}`)
  }

  // Versatilidade: concede apenas a 1ª feature (NEX 10%) de uma trilha diferente da sua.
  if (draft.versatilityChoice?.kind === 'trilha') {
    const versTrilha = getTrilha(draft.versatilityChoice.trilhaId)
    if (versTrilha) {
      collect(versTrilha.features.filter(f => f.nex <= TRILHA_FEATURE_NEX[0]), 'Versatilidade')
    }
  }

  const chosen = new Set(draft.ritualChoices.filter((id): id is string => Boolean(id)))
  return result.filter(g => !chosen.has(g.ritual.id))
}
