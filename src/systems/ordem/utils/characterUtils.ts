import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemClass } from '../types/class'
import type { Trilha, TrilhaFeature } from '../types/trilha'
import type { OrdemRitual, OrdemElement } from '../types/ritual'
import type { OriginPowerEffects } from '../types/origin'
import { getOrigin } from './originUtils'
import { getOrdemClass, getFreeSkillChoiceCount } from './classUtils'
import { getTrilhasByClass, getTrilha } from './trilhaUtils'
import { getPowersByClass } from './powerUtils'
import { RITUAL_COST, getRitualById } from './ritualUtils'
import { getNexIndex, getReachedPowerSlots, getReachedAttributeIncreaseSlots, getReachedSkillGradeSlots, ATTRIBUTE_INCREASE_CAP, POWER_SLOT_NEX, TRILHA_FEATURE_NEX, VERSATILITY_NEX, NEX_STEPS, getPeLimit, hasVersatility } from './progressionUtils'
import { getExpansionGrantedClassPowers, getParanormalEffects, getParanormalLearnedRituals } from './paranormalPowerUtils'
import { getUnmetPrereqs, type PrereqContext } from './prereqUtils'

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

/** Atributos efetivos no instante de uma escolha de progressão (sem aumentos de NEX futuros). */
function getEffectiveAttributesAtNex(draft: OrdemCharacterDraft, nex: number): OrdemCharacterDraft['attributes'] {
  const effective = { ...draft.attributes }
  for (let i = 0; i < draft.attributeIncreaseChoices.length; i++) {
    if (getReachedAttributeIncreaseSlots(nex)[i] === undefined) break
    const attr = draft.attributeIncreaseChoices[i]
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

function getPowerAcquisitionNex(slotIndex?: number): number {
  return slotIndex === undefined ? VERSATILITY_NEX : POWER_SLOT_NEX[slotIndex] ?? Infinity
}

/** Poderes de classe já adquiridos antes de um NEX específico, com seus parâmetros. */
function getPriorClassPowerChoices(draft: OrdemCharacterDraft, acquisitionNex: number): { id: string; params: string[] }[] {
  const choices = draft.powerChoices.flatMap((id, index) => {
    if (!id || POWER_SLOT_NEX[index] >= acquisitionNex) return []
    return [{ id, params: (draft.powerParams[`slot-${index}`] ?? []).filter(Boolean) }]
  })
  if (VERSATILITY_NEX < acquisitionNex && draft.versatilityChoice?.kind === 'power') {
    choices.push({
      id: draft.versatilityChoice.powerId,
      params: (draft.powerParams.versatility ?? []).filter(Boolean),
    })
  }
  return choices
}

/** Perícias disponíveis no instante da escolha, incluindo Treinamento em Perícia anterior. */
function getTrainedSkillsAtNex(draft: OrdemCharacterDraft, acquisitionNex: number): string[] {
  const powerPicks = getPriorClassPowerChoices(draft, acquisitionNex)
    .filter(choice => choice.id === 'skill-training')
    .flatMap(choice => choice.params)
  return dedupe([...getTrainedSkillsWithoutPowerPicks(draft), ...powerPicks])
}

function getClassPowerPrereqContext(draft: OrdemCharacterDraft, acquisitionNex: number): PrereqContext {
  const priorPowers = getPriorClassPowerChoices(draft, acquisitionNex)
  return {
    attributes: getEffectiveAttributesAtNex(draft, acquisitionNex),
    acquisitionNex,
    trainedSkills: getTrainedSkillsAtNex(draft, acquisitionNex),
    hasClassPower: powerId => priorPowers.some(choice => choice.id === powerId),
    getClassPowerElement: powerId => {
      const choice = priorPowers.find(entry => entry.id === powerId)
      return (choice?.params[0] as OrdemElement | undefined) ?? null
    },
    elementCounts: {},
  }
}

/**
 * Poderes de classe disponíveis para uma escolha, respeitando pré-requisitos no NEX em que ela
 * foi adquirida. Poderes posteriores não podem suprir um pré-requisito anterior.
 */
export function getAvailablePowerOptions(draft: OrdemCharacterDraft, cls: OrdemClass, slotIndex?: number) {
  const acquisitionNex = getPowerAcquisitionNex(slotIndex)
  const prereqContext = getClassPowerPrereqContext(draft, acquisitionNex)
  // Exclusão de duplicatas: qualquer poder não-repetível já escolhido em OUTRO slot
  const chosenElsewhere = draft.powerChoices.filter((p, i): p is string => Boolean(p) && i !== slotIndex)
  return getPowersByClass(cls.id).filter(power =>
    (power.repeatable || !chosenElsewhere.includes(power.id))
    && getUnmetPrereqs(power.prereqs, prereqContext).length === 0,
  )
}

/** A trilha pertence à classe e seus pré-requisitos de perícia foram atendidos? */
export function isTrilhaChoiceValid(draft: OrdemCharacterDraft, cls: OrdemClass, trilhaId: string): boolean {
  const trilha = getTrilha(trilhaId)
  return Boolean(
    trilha
    && trilha.classId === cls.id
    && (!trilha.requiredTrainedSkill || getTrainedSkills(draft).includes(trilha.requiredTrainedSkill)),
  )
}

/** Trilhas disponíveis pra escolher em NEX 10%, já filtradas pelos pré-requisitos. */
export function getAvailableTrilhaOptions(draft: OrdemCharacterDraft, cls: OrdemClass): Trilha[] {
  return getTrilhasByClass(cls.id).filter(trilha => isTrilhaChoiceValid(draft, cls, trilha.id))
}

/** Trilhas alternativas pra Versatilidade (NEX 50%) — qualquer trilha da classe que não seja a escolhida. */
export function getAvailableVersatilityTrilhaOptions(draft: OrdemCharacterDraft, cls: OrdemClass): Trilha[] {
  return getAvailableTrilhaOptions(draft, cls).filter(t => t.id !== draft.trilha)
}

/** Todas as escolhas de poderes de classe e Versatilidade atendem os requisitos de aquisição. */
export function areClassPowerChoicesValid(draft: OrdemCharacterDraft, cls: OrdemClass): boolean {
  const requiredSlots = getRequiredPowerSlots(draft.nex)
  for (let index = 0; index < requiredSlots; index++) {
    const powerId = draft.powerChoices[index]
    if (!powerId || !getAvailablePowerOptions(draft, cls, index).some(power => power.id === powerId)) return false
  }

  if (hasVersatility(draft.nex) && draft.versatilityChoice?.kind === 'power') {
    // Extraído da closure: dentro do callback o narrowing da união se perde (TS 6).
    const versatilityPowerId = draft.versatilityChoice.powerId
    return getAvailablePowerOptions(draft, cls).some(power => power.id === versatilityPowerId)
  }
  return true
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

/** Elemento escolhido pra um poder de elemento da PRÓPRIA classe (primeira instância preenchida). */
export function getOwnChosenElementForPower(draft: OrdemCharacterDraft, powerId: string): OrdemElement | null {
  const slot = getPowerParamSlots(draft).find(s => s.powerId === powerId && (draft.powerParams[s.key] ?? []).length > 0)
  return slot ? ((draft.powerParams[slot.key][0] as OrdemElement) ?? null) : null
}

/** Elemento escolhido pra um poder de elemento, incluindo os aprendidos via Expansão de Conhecimento. */
export function getChosenElementForPower(draft: OrdemCharacterDraft, powerId: string): OrdemElement | null {
  const own = getOwnChosenElementForPower(draft, powerId)
  if (own) return own
  const granted = getExpansionGrantedClassPowers(draft).find(g => g.powerId === powerId && g.params.length > 0)
  return granted ? (granted.params[0] as OrdemElement) : null
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

/** O agente tem um poder de classe da PRÓPRIA classe (via slots regulares ou Versatilidade)? */
export function hasOwnClassPower(draft: OrdemCharacterDraft, powerId: string): boolean {
  if (draft.powerChoices.includes(powerId)) return true
  return draft.versatilityChoice?.kind === 'power' && draft.versatilityChoice.powerId === powerId
}

/**
 * O agente tem um poder de classe, de qualquer via: slots regulares, Versatilidade ou aprendido
 * de outra classe via Expansão de Conhecimento (poder paranormal)? Usar esta versão nos efeitos
 * da ficha — assim um poder expandido acende a mesma maquinaria (custos de ritual, dano etc.).
 */
export function hasClassPower(draft: OrdemCharacterDraft, powerId: string): boolean {
  if (hasOwnClassPower(draft, powerId)) return true
  return getExpansionGrantedClassPowers(draft).some(g => g.powerId === powerId)
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
 * Ritual Predileto (−1 PE no ritual escolhido), Lâmina Maldita (−1 PE no Amaldiçoar Arma) e
 * Tatuagem Ritualística (−1 PE em ritual de alcance pessoal que mira só você). Acumulam
 * (texto do Ritual Predileto); nunca abaixo de 0.
 *
 * `ritualElement` é o elemento já resolvido da INSTÂNCIA (ver `getSlotRitualElement`/
 * `getGrantedRitualElement`) — necessário pra rituais multi-elemento, que podem ser conhecidos
 * mais de uma vez (uma por elemento). Omitir só é seguro pra rituais de elemento único.
 */
export function getRitualCost(draft: OrdemCharacterDraft, ritual: OrdemRitual, ritualElement?: OrdemElement): { cost: number; notes: string[] } {
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
  // Mestre em Elemento: −1 PE nos rituais do elemento escolhido (multi-elemento usa o elemento da instância).
  const masterElement = getChosenElementForPower(draft, 'element-master')
  if (masterElement) {
    const element = ritualElement ?? (ritual.elements.length > 1 ? undefined : ritual.elements[0])
    if (element === masterElement) {
      cost -= 1
      notes.push('Mestre em Elemento −1')
    }
  }
  // Tatuagem Ritualística: só rituais de alcance PESSOAL que miram "você" (uma minoria dos de
  // alcance pessoal são área centrada em você, ex. Presença do Medo — não contam).
  if (hasClassPower(draft, 'ritualistic-tattoo') && ritual.range === 'pessoal' && ritual.target === 'você') {
    cost -= 1
    notes.push('Tatuagem Ritualística −1')
  }
  return { cost: Math.max(0, cost), notes }
}

// ── Rituais e efeitos concedidos por trilha ─────────────────────────────────────

export type GrantedRitual = {
  ritual: OrdemRitual
  /** Rótulo da fonte que ensinou o ritual (ex.: "Trilha Conduíte" ou "Versatilidade"). */
  source: string
  /**
   * Elemento da instância, quando a fonte já o resolveu (rituais do Aprender Ritual). Concedidos
   * por trilha continuam resolvendo por `ritualElementChoices` (`getGrantedRitualElement`).
   */
  element?: OrdemElement
}

/**
 * Features de trilha já alcançadas: as da trilha do personagem (NEX já alcançado) + a 1ª feature
 * (NEX 10%) de outra trilha, se a Versatilidade (NEX 50%) a concedeu. Base compartilhada por
 * `getGrantedRituals` e pelos getters de efeito de trilha (DT de ritual, limite de PE...).
 */
function getReachedTrilhaFeaturesWithSource(draft: OrdemCharacterDraft): { feature: TrilhaFeature; source: string }[] {
  const result: { feature: TrilhaFeature; source: string }[] = []
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  if (trilha) {
    for (const feature of trilha.features.filter(f => f.nex <= draft.nex)) {
      result.push({ feature, source: `Trilha ${trilha.name}` })
    }
  }
  if (draft.versatilityChoice?.kind === 'trilha') {
    const versTrilha = getTrilha(draft.versatilityChoice.trilhaId)
    if (versTrilha) {
      for (const feature of versTrilha.features.filter(f => f.nex <= TRILHA_FEATURE_NEX[0])) {
        result.push({ feature, source: 'Versatilidade' })
      }
    }
  }
  return result
}

/**
 * Rituais que o personagem aprende automaticamente por features de trilha ("Você aprende o
 * ritual X"), derivados do NEX + trilha escolhida — e da Versatilidade (NEX 50%), quando ela
 * concede a 1ª feature de outra trilha (ex.: Lâmina Maldita → Amaldiçoar Arma). São bônus:
 * NÃO contam no limite de rituais conhecidos. A lista é deduplicada por id e omite os rituais
 * que o jogador já escolheu manualmente em `ritualChoices` (para não listar o mesmo duas vezes).
 */
export function getTrilhaGrantedRituals(draft: OrdemCharacterDraft): GrantedRitual[] {
  const result: GrantedRitual[] = []
  const seen = new Set<string>()
  for (const { feature, source } of getReachedTrilhaFeaturesWithSource(draft)) {
    const ritualId = feature.grantsRitual
    if (!ritualId || seen.has(ritualId)) continue
    const ritual = getRitualById(ritualId)
    if (!ritual) continue
    seen.add(ritualId)
    result.push({ ritual, source })
  }
  const chosen = new Set(draft.ritualChoices.filter((id): id is string => Boolean(id)))
  return result.filter(g => !chosen.has(g.ritual.id))
}

/**
 * TODOS os rituais concedidos fora dos slots do Ocultista: features de trilha + instâncias
 * válidas do poder paranormal Aprender Ritual (que também não contam no limite de escolhas do
 * Ocultista — o limite delas é o Intelecto, validado pelo motor). Duplicatas ritual+elemento
 * entre as fontes são impedidas pela validação das instâncias, não deduplicadas aqui.
 */
export function getGrantedRituals(draft: OrdemCharacterDraft): GrantedRitual[] {
  const learned = getParanormalLearnedRituals(draft)
    .map(({ ritual, element, source }) => ({ ritual, source, element }))
  return [...getTrilhaGrantedRituals(draft), ...learned]
}

/** Soma dos bônus de DT de rituais concedidos por trilha (ex.: Rituais Eficientes +5). */
export function getRitualDtBonusFromTrilha(draft: OrdemCharacterDraft): number {
  return getReachedTrilhaFeaturesWithSource(draft)
    .reduce((s, { feature }) => s + (feature.effects?.allRitualDtBonus ?? 0), 0)
}

/** Tem Presença Poderosa (Intuitivo NEX 40%): soma Presença ao limite de PE, só para rituais? */
export function hasRitualPeLimitBonusFromPresence(draft: OrdemCharacterDraft): boolean {
  return getReachedTrilhaFeaturesWithSource(draft).some(({ feature }) => feature.effects?.ritualPeLimitBonusFromPresence)
}

/** Bônus em testes de resistência contra efeitos paranormais, de features de trilha (ex.: Mente Sã +5). */
export function getParanormalResistanceBonus(draft: OrdemCharacterDraft): number {
  return getReachedTrilhaFeaturesWithSource(draft)
    .reduce((s, { feature }) => s + (feature.effects?.paranormalResistanceBonus ?? 0), 0)
}

/** Resistência a dano mental E paranormal, de features de trilha (ex.: Inabalável 10). */
export function getMentalParanormalDamageResistance(draft: OrdemCharacterDraft): number {
  return getReachedTrilhaFeaturesWithSource(draft)
    .reduce((s, { feature }) => s + (feature.effects?.mentalAndParanormalDamageResistance ?? 0), 0)
}

export type ConditionalDamageResistance = { name: string; value: number | 'vigor'; condition: string }

/**
 * Resistências a dano condicionais de features de trilha (ex.: Casca Grossa "ao bloquear",
 * Inquebrável "enquanto machucado") — nunca somadas num total, cada uma é listada com sua
 * própria condição na seção Resistências.
 */
export function getConditionalDamageResistances(draft: OrdemCharacterDraft): ConditionalDamageResistance[] {
  const result: ConditionalDamageResistance[] = []
  for (const { feature } of getReachedTrilhaFeaturesWithSource(draft)) {
    const cdr = feature.effects?.conditionalDamageResistance
    if (cdr) result.push({ name: feature.name, ...cdr })
  }
  return result
}

/** Tem Inventário Otimizado (Técnico NEX 10%): soma Intelecto à Força pro cálculo de carga? */
export function hasCarryCapacityIntellectBonus(draft: OrdemCharacterDraft): boolean {
  return getReachedTrilhaFeaturesWithSource(draft).some(({ feature }) => feature.effects?.carryCapacityAddsIntellect)
}

// ── Efeitos do poder de origem (aplicados na ficha) ─────────────────────────────

/** Efeitos mecânicos estruturados do poder da origem escolhida (objeto vazio se não houver). */
export function getOriginEffects(draft: OrdemCharacterDraft): OriginPowerEffects {
  const origin = draft.origin ? getOrigin(draft.origin) : undefined
  return origin?.power.effects ?? {}
}

/** Quantos degraus ímpares de NEX {15,25,...,95} já foram alcançados (para Dedicação). */
function oddNexStepsReached(nex: number): number {
  return NEX_STEPS.filter(step => step >= 15 && step <= nex && (step / 5) % 2 === 1).length
}

/** PV extra da origem (ex.: Calejado: +1 por degrau de NEX alcançado). */
export function getOriginHpBonus(draft: OrdemCharacterDraft): number {
  return (getOriginEffects(draft).hpPerNexStep ?? 0) * getNexIndex(draft.nex)
}

/** Sanidade extra da origem (ex.: Cicatrizes Psicológicas: +1 por degrau de NEX). */
export function getOriginSanityBonus(draft: OrdemCharacterDraft): number {
  return (getOriginEffects(draft).sanityPerNexStep ?? 0) * getNexIndex(draft.nex)
}

/** PE extra da origem (ex.: Dedicação: +1 fixo e +1 por degrau ímpar de NEX). */
export function getOriginPeBonus(draft: OrdemCharacterDraft): number {
  const e = getOriginEffects(draft)
  return (e.peFlat ?? 0) + (e.pePerOddNexStep ?? 0) * oddNexStepsReached(draft.nex)
}

/** Defesa extra da origem (ex.: Patrulha +2). */
export function getOriginDefenseBonus(draft: OrdemCharacterDraft): number {
  return getOriginEffects(draft).defenseBonus ?? 0
}

/**
 * Resistência a dano mental do poder de origem (ex.: Eu Já Sabia = Intelecto). Recebe o Intelecto
 * já pronto (em vez de calcular internamente) para o chamador poder passar o valor com maldições,
 * como o resto da ficha faz — mesmo padrão de `deriveStats` recebendo atributos por parâmetro.
 * É uma fonte SEPARADA de "resistência a dano mental" da de Inabalável (trilha). Conforme a
 * regra do capítulo de Combate ("Cura Acelerada, Pontos Temporários e Resistência a Dano acumulam,
 * exceto quando suas fontes não o fazem"), as duas fontes se acumulam na UI (Revisão e PDF)
 * sem emitir aviso de sobreposição, totalizando a resistência a dano mental do personagem.
 */
export function getOriginMentalDamageResistance(draft: OrdemCharacterDraft, intellect: number): number {
  return getOriginEffects(draft).mentalDamageResistanceEqualsIntellect ? intellect : 0
}

/**
 * Limite de PE por turno já com os bônus de origem (ex.: Dedicação +1) e de poderes paranormais
 * (Encarar a Morte +1/+3 — o aumento vale "em cenas de ação", exatamente quando o limite de PE
 * por turno importa, então somar direto é seguro; `getRitualDt` segue usando o limite base).
 */
export function getEffectivePeLimit(draft: OrdemCharacterDraft): number {
  return getPeLimit(draft.nex) + (getOriginEffects(draft).peLimitBonus ?? 0) + getParanormalEffects(draft).peLimitBonus
}

/** Bônus de Ferramenta de Trabalho (origem Operário): +1 em ataque/dano/margem de ameaça — só com a arma escolhida em `draft.workToolWeapon`. */
export function getWorkToolBonus(draft: OrdemCharacterDraft): number {
  return getOriginEffects(draft).workToolBonus ?? 0
}
