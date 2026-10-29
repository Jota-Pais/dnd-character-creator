import type { OrdemCharacterDraft } from '../types/character'
import type { OrdemClass } from '../types/class'
import type { Trilha, TrilhaFeature } from '../types/trilha'
import type { OrdemRitual, OrdemElement, OrdemRitualCircle } from '../types/ritual'
import type { OriginPowerEffects } from '../types/origin'
import { getOrigin } from './originUtils'
import { getOrdemClass, getFreeSkillChoiceCount } from './classUtils'
import { getTrilhasByClass, getTrilha } from './trilhaUtils'
import { getPowersByClass } from './powerUtils'
import { getSkillName } from './skillUtils'
import { RITUAL_COST, getRitualById, RITUAL_CIRCLE_NEX, bonusRitualElementKey } from './ritualUtils'
import { getNexIndex, getReachedPowerSlots, getReachedAttributeIncreaseSlots, getReachedSkillGradeSlots, ATTRIBUTE_INCREASE_CAP, POWER_SLOT_NEX, TRILHA_FEATURE_NEX, VERSATILITY_NEX, NEX_STEPS, getPeLimit, hasVersatility } from './progressionUtils'
import { getExpansionGrantedClassPowers, getParanormalEffects, getParanormalLearnedRituals } from './paranormalPowerUtils'
import { getUnmetPrereqs, formatUnmetPrereqs, type PrereqContext } from './prereqUtils'
import type { ClassPower } from '../types/power'

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

// ── Perito (habilidade do Especialista) ────────────────────────────────────────

/** Perícias que o Perito nunca pode escolher (ressalva da habilidade). */
const EXPERT_FORBIDDEN_SKILLS = ['fighting', 'aim']

/** Quantas perícias o Perito escolhe. */
export const EXPERT_SKILL_COUNT = 2

/** O agente tem a habilidade Perito? (só o Especialista, desde a criação) */
export function hasExpertAbility(draft: OrdemCharacterDraft): boolean {
  return draft.class === 'specialist'
}

/**
 * Dado extra e custo do Perito no NEX atual: 2 PE/+1d6 até NEX 20%, 3 PE/+1d8 em 25%,
 * 4 PE/+1d10 em 55% e 5 PE/+1d12 em 85% (habilidade Eclético e Perito, Tabela 1.4).
 */
export function getExpertDie(nex: number): { pe: number; die: string } {
  if (nex >= 85) return { pe: 5, die: '1d12' }
  if (nex >= 55) return { pe: 4, die: '1d10' }
  if (nex >= 25) return { pe: 3, die: '1d8' }
  return { pe: 2, die: '1d6' }
}

/** Perícias elegíveis pro Perito: as treinadas, menos Luta e Pontaria. */
export function getExpertSkillOptions(draft: OrdemCharacterDraft): string[] {
  return getTrainedSkills(draft).filter(id => !EXPERT_FORBIDDEN_SKILLS.includes(id))
}

/** As perícias do Perito que continuam válidas (ainda treinadas e permitidas). */
export function getExpertSkills(draft: OrdemCharacterDraft): string[] {
  if (!hasExpertAbility(draft)) return []
  const eligible = getExpertSkillOptions(draft)
  return draft.expertSkillChoices.filter(id => eligible.includes(id))
}

/**
 * As 2 perícias do Perito estão escolhidas e válidas? Trocar as perícias treinadas pode
 * invalidar uma escolha antiga (ela deixa de ser treinada) — por isso valida contra as opções.
 */
export function isExpertChoiceComplete(draft: OrdemCharacterDraft): boolean {
  if (!hasExpertAbility(draft)) return true
  // Com menos perícias treinadas elegíveis que o exigido (ficha em construção), não travar.
  const available = getExpertSkillOptions(draft).length
  const required = Math.min(EXPERT_SKILL_COUNT, available)
  return getExpertSkills(draft).length === required
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

/** Um poder do catálogo da classe: se dá pra escolher agora e, se não dá, por quê. */
export type ClassPowerOption = {
  power: ClassPower
  available: boolean
  /** Motivos legíveis do bloqueio (vazio quando disponível). */
  reasons: string[]
}

/**
 * Todo poder da classe avaliado para UM ponto de escolha (um slot, ou a Versatilidade quando
 * `slotIndex` é undefined), com o motivo do bloqueio quando houver. A UI nunca esconde poder:
 * mostra o motivo e desabilita.
 *
 * Pré-requisitos valem no NEX em que a escolha é feita — poder posterior não supre pré-requisito
 * anterior. Poder não-repetível já escolhido em outro slot também bloqueia (com motivo próprio).
 */
export function getClassPowerOptions(
  draft: OrdemCharacterDraft,
  cls: OrdemClass,
  slotIndex?: number,
): ClassPowerOption[] {
  const prereqContext = getClassPowerPrereqContext(draft, getPowerAcquisitionNex(slotIndex))
  const chosenElsewhere = draft.powerChoices.filter((p, i): p is string => Boolean(p) && i !== slotIndex)

  return getPowersByClass(cls.id).map(power => {
    if (!power.repeatable && chosenElsewhere.includes(power.id)) {
      return { power, available: false, reasons: ['Já escolhido em outro poder (não é repetível)'] }
    }
    const unmet = getUnmetPrereqs(power.prereqs, prereqContext)
    return unmet.length === 0
      ? { power, available: true, reasons: [] }
      : { power, available: false, reasons: formatUnmetPrereqs(unmet, prereqContext) }
  })
}

/**
 * Poderes de classe disponíveis para uma escolha, respeitando pré-requisitos no NEX em que ela
 * foi adquirida. Poderes posteriores não podem suprir um pré-requisito anterior.
 */
export function getAvailablePowerOptions(draft: OrdemCharacterDraft, cls: OrdemClass, slotIndex?: number) {
  return getClassPowerOptions(draft, cls, slotIndex).filter(o => o.available).map(o => o.power)
}

/** Um poder no catálogo da etapa Progressão, já resolvido contra os slots do NEX atual. */
export type ClassPowerCatalogEntry = {
  power: ClassPower
  /** Slots que já têm este poder (repetível pode ocupar mais de um). */
  chosenSlots: number[]
  /** Primeiro slot livre que aceita o poder; null = não cabe em nenhum. */
  targetSlot: number | null
  /** Por que não cabe em slot nenhum (vazio quando cabe, ou quando já está escolhido). */
  reasons: string[]
}

/**
 * Catálogo completo dos poderes da classe para a etapa Progressão: em vez de o jogador escolher
 * slot por slot, ele escolhe do catálogo e o poder entra no primeiro slot que o aceita.
 *
 * O slot continua importando porque cada um é adquirido num NEX diferente (POWER_SLOT_NEX), e o
 * pré-requisito é medido nesse NEX. Quando nenhum slot livre aceita, o motivo vem do slot mais
 * favorável (o livre de maior NEX) — é onde o poder teria a melhor chance.
 */
export function getClassPowerCatalog(
  draft: OrdemCharacterDraft,
  cls: OrdemClass,
  slotCount: number,
): ClassPowerCatalogEntry[] {
  const slots = Array.from({ length: slotCount }, (_, i) => draft.powerChoices[i] ?? null)
  const freeSlots = slots.flatMap((id, i) => (id ? [] : [i]))

  const contexts = new Map<number, PrereqContext>()
  const contextFor = (slot: number): PrereqContext => {
    const cached = contexts.get(slot)
    if (cached) return cached
    const ctx = getClassPowerPrereqContext(draft, getPowerAcquisitionNex(slot))
    contexts.set(slot, ctx)
    return ctx
  }

  return getPowersByClass(cls.id).map(power => {
    const chosenSlots = slots.flatMap((id, i) => (id === power.id ? [i] : []))
    // Não-repetível já escolhido: o card aparece como escolhido, sem motivo de bloqueio.
    if (!power.repeatable && chosenSlots.length > 0) {
      return { power, chosenSlots, targetSlot: null, reasons: [] }
    }
    const targetSlot = freeSlots.find(slot => getUnmetPrereqs(power.prereqs, contextFor(slot)).length === 0) ?? null
    if (targetSlot !== null) return { power, chosenSlots, targetSlot, reasons: [] }
    if (freeSlots.length === 0) {
      return {
        power,
        chosenSlots,
        targetSlot: null,
        reasons: ['Você já escolheu todos os poderes do seu NEX — solte um para trocar'],
      }
    }
    const bestSlot = freeSlots[freeSlots.length - 1]
    const ctx = contextFor(bestSlot)
    return { power, chosenSlots, targetSlot: null, reasons: formatUnmetPrereqs(getUnmetPrereqs(power.prereqs, ctx), ctx) }
  })
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

/** Uma trilha da classe com o motivo do bloqueio, quando o requisito de perícia não é atendido. */
export type TrilhaOption = {
  trilha: Trilha
  available: boolean
  reasons: string[]
}

/**
 * Todas as trilhas da classe, com o motivo do bloqueio — a UI mostra a trilha indisponível em vez
 * de escondê-la (o jogador precisa saber que ela existe e o que treinar pra alcançá-la).
 */
export function getTrilhaOptions(draft: OrdemCharacterDraft, cls: OrdemClass): TrilhaOption[] {
  return getTrilhasByClass(cls.id).map(trilha => {
    if (isTrilhaChoiceValid(draft, cls, trilha.id)) return { trilha, available: true, reasons: [] }
    const skill = trilha.requiredTrainedSkill
    return {
      trilha,
      available: false,
      reasons: [skill ? `Requer treino em ${getSkillName(skill)}` : 'Requisito não atendido'],
    }
  })
}

/** Trilhas disponíveis pra escolher em NEX 10%, já filtradas pelos pré-requisitos. */
export function getAvailableTrilhaOptions(draft: OrdemCharacterDraft, cls: OrdemClass): Trilha[] {
  return getTrilhasByClass(cls.id).filter(trilha => isTrilhaChoiceValid(draft, cls, trilha.id))
}

/** Trilhas alternativas pra Versatilidade (NEX 50%) — as da classe, menos a que já foi escolhida. */
export function getVersatilityTrilhaOptions(draft: OrdemCharacterDraft, cls: OrdemClass): TrilhaOption[] {
  return getTrilhaOptions(draft, cls).filter(option => option.trilha.id !== draft.trilha)
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

/** Bônus fixo por grau de treinamento (livro, Cap. 2). */
export const GRADE_BONUS: Record<SkillGrade, number> = {
  destreinado: 0,
  treinado: 5,
  veterano: 10,
  expert: 15,
}

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
 * O agente alcançou a feature de uma trilha específica? Vale pela trilha própria (NEX alcançado)
 * ou pela Versatilidade (NEX 50%), que concede só a 1ª feature (NEX 10%) de outra trilha.
 */
export function hasTrilhaFeature(draft: OrdemCharacterDraft, trilhaId: string, nex: number): boolean {
  if (draft.trilha === trilhaId && draft.nex >= nex) return true
  return nex === TRILHA_FEATURE_NEX[0]
    && draft.versatilityChoice?.kind === 'trilha'
    && draft.versatilityChoice.trilhaId === trilhaId
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
export function getReachedTrilhaFeaturesWithSource(draft: OrdemCharacterDraft): ReachedTrilhaFeature[] {
  const result: ReachedTrilhaFeature[] = []
  const trilha = draft.trilha ? getTrilha(draft.trilha) : undefined
  if (trilha) {
    for (const feature of trilha.features.filter(f => f.nex <= draft.nex)) {
      result.push({ feature, source: `Trilha ${trilha.name}`, trilhaId: trilha.id, acquisitionNex: feature.nex })
    }
  }
  if (draft.versatilityChoice?.kind === 'trilha') {
    const versTrilha = getTrilha(draft.versatilityChoice.trilhaId)
    if (versTrilha) {
      for (const feature of versTrilha.features.filter(f => f.nex <= TRILHA_FEATURE_NEX[0])) {
        // A Versatilidade concede a feature no NEX 50%, não no NEX 10% dela — o que importa para
        // "a cada NOVO círculo" (Saber Ampliado) é quando o agente de fato recebeu a feature.
        result.push({ feature, source: 'Versatilidade', trilhaId: versTrilha.id, acquisitionNex: VERSATILITY_NEX })
      }
    }
  }
  return result
}

export type ReachedTrilhaFeature = {
  feature: TrilhaFeature
  /** Rótulo da fonte, pra exibição (ex.: "Trilha Graduado", "Versatilidade"). */
  source: string
  trilhaId: string
  /** NEX em que o agente recebeu esta feature (o da feature, ou 50% se veio da Versatilidade). */
  acquisitionNex: number
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
 * Ocultista — o limite delas é o Intelecto, validado pelo motor) + os slots bônus de trilha
 * (Saber Ampliado / Grimório Ritualístico). Duplicatas ritual+elemento entre as fontes são
 * impedidas pela validação das instâncias, não deduplicadas aqui.
 */
export function getGrantedRituals(draft: OrdemCharacterDraft): GrantedRitual[] {
  const learned = getParanormalLearnedRituals(draft)
    .map(({ ritual, element, source }) => ({ ritual, source, element }))
  const bonus = getBonusRitualSlots(draft).flatMap(slot =>
    slot.ritual ? [{ ritual: slot.ritual, source: slot.sourceLabel, element: slot.element ?? undefined }] : [],
  )
  return [...getTrilhaGrantedRituals(draft), ...learned, ...bonus]
}

// ── Slots de ritual bônus de trilha (Saber Ampliado / Grimório Ritualístico) ────

export type BonusRitualSlot = {
  /** Chave estável do slot em `draft.bonusRitualChoices` (ex.: "scholar-10-circle-2"). */
  key: string
  /** Rótulo da fonte pra ficha e PDF (ex.: "Saber Ampliado (Trilha Graduado)"). */
  sourceLabel: string
  featureName: string
  /** Círculos aceitos neste slot (os base da feature, ou o círculo recém-liberado). */
  circles: OrdemRitualCircle[]
  ritual: OrdemRitual | null
  /** Elemento da instância: o escolhido nos multi-elemento, o único nos demais. */
  element: OrdemElement | null
  /** Ritual escolhido — e o elemento também, quando o ritual é multi-elemento. */
  complete: boolean
}

/**
 * Slots de ritual bônus abertos pelas features de trilha alcançadas (hoje só o Graduado):
 * os `baseCount` slots da aquisição (quantidade fixa, ou igual ao Intelecto no NEX em que a
 * feature foi recebida) + 1 slot por círculo liberado DEPOIS dela, travado naquele círculo.
 * Não contam no limite de rituais conhecidos; o jogador escolhe cada um na etapa Rituais.
 */
export function getBonusRitualSlots(draft: OrdemCharacterDraft): BonusRitualSlot[] {
  const slots: BonusRitualSlot[] = []
  for (const { feature, source, trilhaId, acquisitionNex } of getReachedTrilhaFeaturesWithSource(draft)) {
    const spec = feature.effects?.grantsRitualSlots
    if (!spec) continue
    const sourceLabel = `${feature.name} (${source})`
    const baseCount = spec.baseCount === 'intellect'
      ? getEffectiveAttributesAtNex(draft, acquisitionNex).intellect
      : spec.baseCount
    const prefix = `${trilhaId}-${feature.nex}`
    for (let i = 0; i < baseCount; i++) {
      slots.push(makeBonusSlot(draft, `${prefix}-base-${i}`, sourceLabel, feature.name, spec.baseCircles))
    }
    if (spec.perNewCircle) {
      // "Toda vez que ganha acesso a um novo círculo": só os círculos liberados APÓS a feature.
      for (const circle of RITUAL_CIRCLES) {
        const circleNex = RITUAL_CIRCLE_NEX[circle]
        if (circleNex <= acquisitionNex || circleNex > draft.nex) continue
        slots.push(makeBonusSlot(draft, `${prefix}-circle-${circle}`, sourceLabel, feature.name, [circle]))
      }
    }
  }
  return slots
}

const RITUAL_CIRCLES: OrdemRitualCircle[] = [1, 2, 3, 4]

function makeBonusSlot(
  draft: OrdemCharacterDraft,
  key: string,
  sourceLabel: string,
  featureName: string,
  circles: OrdemRitualCircle[],
): BonusRitualSlot {
  const chosenId = draft.bonusRitualChoices[key]
  const ritual = chosenId ? getRitualById(chosenId) ?? null : null
  // Um ritual fora dos círculos do slot (NEX baixou, trilha trocada) não vale a escolha.
  const valid = ritual && circles.includes(ritual.circle) ? ritual : null
  const element = !valid
    ? null
    : valid.elements.length > 1
      ? draft.ritualElementChoices[bonusRitualElementKey(key)] ?? null
      : valid.elements[0]
  return { key, sourceLabel, featureName, circles, ritual: valid, element, complete: Boolean(valid && element) }
}

/** Todos os slots de ritual bônus abertos estão preenchidos (com elemento, quando exigido)? */
export function areBonusRitualSlotsComplete(draft: OrdemCharacterDraft): boolean {
  return getBonusRitualSlots(draft).every(slot => slot.complete)
}

/**
 * PV extra concedido por features de trilha alcançadas (ex.: Casca Grossa +1 por degrau de NEX).
 * Retroativo em todos os degraus alcançados, como `getOriginHpBonus` e o Sangue de Ferro.
 */
export function getTrilhaHpBonus(draft: OrdemCharacterDraft): number {
  const perStep = getReachedTrilhaFeaturesWithSource(draft)
    .reduce((s, { feature }) => s + (feature.effects?.hpPerNexStep ?? 0), 0)
  return perStep * getNexIndex(draft.nex)
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
