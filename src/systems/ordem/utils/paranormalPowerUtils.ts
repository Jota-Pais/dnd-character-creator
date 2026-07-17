import type { OrdemCharacterDraft, ParanormalPowerChoice, ParanormalSourceKey } from '../types/character'
import type { ParanormalPower } from '../types/paranormalPower'
import type { ClassPower } from '../types/power'
import type { OrdemClass } from '../types/class'
import type { OrdemElement, OrdemRitual, ParanormalElement } from '../types/ritual'
import { PARANORMAL_ELEMENTS } from '../types/ritual'
import paranormalPowersData from '../data/paranormal-powers.json'
import { CLASS_POWERS, getPower } from './powerUtils'
import { ELEMENT_NAMES, getRitualById, getSlotRitualElement, getGrantedRitualElement } from './ritualUtils'
import { POWER_SLOT_NEX, VERSATILITY_NEX, getNexIndex, hasVersatility } from './progressionUtils'
import {
  POWER_PARAM_SPECS,
  getEffectiveAttributes,
  getOriginEffects,
  getOwnChosenElementForPower,
  getRequiredPowerSlots,
  getTrainedSkills,
  getTrilhaGrantedRituals,
  hasOwnClassPower,
} from './characterUtils'
import { formatUnmetPrereqs, getUnmetPrereqs, type PrereqContext } from './prereqUtils'

export const PARANORMAL_POWERS: ParanormalPower[] = paranormalPowersData as ParanormalPower[]

export function getParanormalPower(id: string): ParanormalPower | undefined {
  return PARANORMAL_POWERS.find(p => p.id === id)
}

export function isParanormalElement(value: unknown): value is ParanormalElement {
  return typeof value === 'string' && (PARANORMAL_ELEMENTS as string[]).includes(value)
}

export function isParanormalSourceKey(value: string): value is ParanormalSourceKey {
  return value === 'origin' || value === 'versatility' || /^slot-\d+$/.test(value)
}

/** Elemento opressor de cada elemento (p. 120): Sangue>Conhecimento>Energia>Morte>Sangue. */
export const OPPRESSOR_OF: Record<ParanormalElement, ParanormalElement> = {
  knowledge: 'blood',
  energy: 'knowledge',
  death: 'energy',
  blood: 'death',
}

// ── Fontes de transcender (instâncias) e cronologia ─────────────────────────────

/**
 * Ordem CRONOLÓGICA de aquisição das fontes: o poder da origem existe desde a criação (NEX 5%),
 * os slots de poder de classe são ganhos em NEX 15/30/45/60/75/90 e a Versatilidade em NEX 50%.
 * É essa ordem que dá sentido ao pré-requisito "Elemento N" ("você JÁ precisa ter outros N
 * poderes daquele elemento", p. 116) num builder estático.
 */
export const PARANORMAL_SOURCE_ORDER: ParanormalSourceKey[] = [
  'origin', 'slot-0', 'slot-1', 'slot-2', 'versatility', 'slot-3', 'slot-4', 'slot-5',
]

/** NEX em que a fonte foi adquirida (origin → 5, slot-i → POWER_SLOT_NEX[i], versatility → 50). */
export function getSourceAcquisitionNex(key: ParanormalSourceKey): number {
  if (key === 'origin') return 5
  if (key === 'versatility') return VERSATILITY_NEX
  const index = parseInt(key.slice('slot-'.length), 10)
  return POWER_SLOT_NEX[index] ?? 99
}

export function getSourceOrder(key: ParanormalSourceKey): number {
  return PARANORMAL_SOURCE_ORDER.indexOf(key)
}

/** Rótulo pt-BR da fonte para a UI e a ficha. */
export function getSourceLabel(key: ParanormalSourceKey): string {
  if (key === 'origin') return 'Traços do Outro Lado (origem)'
  if (key === 'versatility') return 'Transcender — Versatilidade (NEX 50%)'
  return `Transcender — poder de NEX ${getSourceAcquisitionNex(key)}%`
}

/**
 * Fontes ATIVAS de poder paranormal no draft atual, em ordem cronológica: a origem (se concede
 * poder paranormal), cada slot de poder alcançado cujo poder escolhido é Transcender, e a
 * Versatilidade quando escolheu Transcender. Entradas de `paranormalPowerChoices` cujas fontes
 * não estão ativas ficam dormentes (não listadas, não exigidas, não aplicadas).
 */
export function getActiveParanormalSources(draft: OrdemCharacterDraft): ParanormalSourceKey[] {
  const requiredSlots = getRequiredPowerSlots(draft.nex)
  return PARANORMAL_SOURCE_ORDER.filter(key => {
    if (key === 'origin') return Boolean(getOriginEffects(draft).grantsParanormalPower)
    if (key === 'versatility') {
      return hasVersatility(draft.nex)
        && draft.versatilityChoice?.kind === 'power'
        && draft.versatilityChoice.powerId === 'transcend'
    }
    const index = parseInt(key.slice('slot-'.length), 10)
    return index < requiredSlots && draft.powerChoices[index] === 'transcend'
  })
}

// ── Afinidade Elemental ─────────────────────────────────────────────────────────

export type AffinityState = {
  /** Elemento de conexão escolhido em NEX 50% (inerte/null abaixo de 50%). */
  element: ParanormalElement | null
  /** 1ª fonte ativa com aquisição em NEX ≥ 50 — o transcender que transforma conexão em afinidade. */
  triggerKey: ParanormalSourceKey | null
  active: boolean
}

/**
 * Afinidade numa ficha estática (regra do projeto, confirmada 2026-07-17): ativa se o elemento
 * foi escolhido (NEX ≥ 50) E existe pelo menos um transcender adquirido em NEX ≥ 50
 * ('versatility' ou 'slot-3..5'). Fontes de aquisição < 50 (origem, slots de NEX 15/30/45)
 * nunca disparam — "na primeira vez que transcender após [NEX 50%]" (p. 116).
 */
export function getAffinityState(draft: OrdemCharacterDraft): AffinityState {
  const element = draft.nex >= VERSATILITY_NEX ? draft.affinityElement : null
  const triggerKey = getActiveParanormalSources(draft)
    .find(key => getSourceAcquisitionNex(key) >= VERSATILITY_NEX) ?? null
  return { element, triggerKey, active: Boolean(element && triggerKey) }
}

// ── Resolução de instâncias (fonte de verdade do motor) ─────────────────────────

export type ParanormalInstance = {
  key: ParanormalSourceKey
  acquisitionNex: number
  choice: ParanormalPowerChoice | null
  power: ParanormalPower | null
  /** Elemento efetivo: fixo do poder, ou resolvido pela sub-escolha ("conta como poder do elemento..."). */
  element: OrdemElement | null
  /** 2ª ocorrência do mesmo poder → cópia de afinidade (recebe a linha "Afinidade", p. 116). */
  isAffinityCopy: boolean
  /** Sub-escolhas todas preenchidas (sem julgar regras). */
  complete: boolean
  /** Completa E sem violação de regra — só instâncias válidas alimentam contagens e efeitos. */
  valid: boolean
  /** Motivos legíveis (pt-BR) das violações; vazio quando só falta preencher escolha. */
  problems: string[]
}

/** Elemento efetivo de um poder para uma escolha (null enquanto a sub-escolha não resolve). */
export function resolveInstanceElement(power: ParanormalPower, choice: ParanormalPowerChoice): OrdemElement | null {
  if (power.element) return power.element
  if (power.elementFrom === 'element-param') return choice.element ?? null
  if (power.elementFrom === 'ritual-param') {
    if (!choice.ritualId) return null
    const ritual = getRitualById(choice.ritualId)
    if (!ritual) return null
    return ritual.elements.length > 1 ? choice.ritualElement ?? null : ritual.elements[0]
  }
  return null
}

function ritualInstanceKey(ritualId: string, element: OrdemElement | undefined): string {
  return element ? `${ritualId}::${element}` : ritualId
}

/** Instâncias ritual+elemento já ocupadas fora do motor: escolhas do Ocultista + concedidos por trilha. */
function getOccupiedRitualInstanceKeys(draft: OrdemCharacterDraft): Set<string> {
  const keys = new Set<string>()
  draft.ritualChoices.forEach((id, slotIndex) => {
    if (!id) return
    const ritual = getRitualById(id)
    if (!ritual) return
    keys.add(ritualInstanceKey(id, getSlotRitualElement(ritual, slotIndex, draft.ritualElementChoices)))
  })
  for (const granted of getTrilhaGrantedRituals(draft)) {
    keys.add(ritualInstanceKey(granted.ritual.id, getGrantedRitualElement(granted.ritual, draft.ritualElementChoices)))
  }
  return keys
}

/** Círculo máximo do Aprender Ritual pelo NEX DE AQUISIÇÃO da instância (p. 114): ≥75% → 3º, ≥45% → 2º, senão 1º. */
export function getLearnRitualMaxCircle(acquisitionNex: number): 1 | 2 | 3 {
  if (acquisitionNex >= 75) return 3
  if (acquisitionNex >= 45) return 2
  return 1
}

/**
 * Resolve TODAS as instâncias em passo único cronológico. A contagem de elementos ("Morte 2"),
 * a detecção de 2ª cópia, o limite do Aprender Ritual (= Intelecto, p. 119) e os poderes de
 * classe concedidos por Expansão acumulam apenas de instâncias VÁLIDAS anteriores — remover um
 * poder no meio invalida em cascata os que dependiam dele, com motivo legível.
 *
 * Nota de regra: uma 2ª cópia válida também conta na contagem do elemento (cada transcender
 * concedeu um poder daquele elemento).
 */
export function getParanormalInstances(draft: OrdemCharacterDraft): ParanormalInstance[] {
  const affinity = getAffinityState(draft)
  const attributes = getEffectiveAttributes(draft)
  const trainedSkills = getTrainedSkills(draft)
  const occupiedRituals = getOccupiedRitualInstanceKeys(draft)

  const elementCounts: Partial<Record<ParanormalElement, number>> = {}
  const copiesByKey = new Map<string, number>()
  const grantedClassPowers: { powerId: string; params: string[] }[] = []
  const learnedRitualKeys = new Set<string>()
  let learnRitualCount = 0

  const hasClassPowerSoFar = (powerId: string): boolean =>
    hasOwnClassPower(draft, powerId) || grantedClassPowers.some(g => g.powerId === powerId)
  const getClassPowerElementSoFar = (powerId: string): OrdemElement | null =>
    getOwnChosenElementForPower(draft, powerId)
    ?? (grantedClassPowers.find(g => g.powerId === powerId && g.params.length > 0)?.params[0] as OrdemElement | undefined)
    ?? null

  const result: ParanormalInstance[] = []

  for (const key of getActiveParanormalSources(draft)) {
    const acquisitionNex = getSourceAcquisitionNex(key)
    const choice = draft.paranormalPowerChoices[key] ?? null
    const instance: ParanormalInstance = {
      key, acquisitionNex, choice, power: null, element: null,
      isAffinityCopy: false, complete: false, valid: false, problems: [],
    }
    result.push(instance)
    if (!choice) continue

    const power = getParanormalPower(choice.powerId) ?? null
    instance.power = power
    if (!power) {
      instance.problems.push('Poder paranormal desconhecido')
      continue
    }

    instance.element = resolveInstanceElement(power, choice)
    let complete = true
    const problems: string[] = []

    // Sub-escolha exigida pelo poder.
    if (power.choice?.kind === 'element' && !choice.element) complete = false
    let ritualKey: string | null = null
    if (power.choice?.kind === 'ritual') {
      if (!choice.ritualId) complete = false
      else {
        const ritual = getRitualById(choice.ritualId)
        if (!ritual) problems.push('Ritual desconhecido')
        else {
          const isMulti = ritual.elements.length > 1
          if (isMulti && !choice.ritualElement) complete = false
          if (isMulti && choice.ritualElement && !ritual.elements.includes(choice.ritualElement)) {
            problems.push('Elemento indisponível para este ritual')
          }
          const maxCircle = getLearnRitualMaxCircle(acquisitionNex)
          if (ritual.circle > maxCircle) {
            problems.push(`Ritual de ${ritual.circle}º círculo — nesta escolha (NEX ${acquisitionNex}%) o máximo é o ${maxCircle}º`)
          }
          const element = isMulti ? choice.ritualElement : ritual.elements[0]
          if (element) {
            ritualKey = ritualInstanceKey(ritual.id, element)
            if (occupiedRituals.has(ritualKey) || learnedRitualKeys.has(ritualKey)) {
              problems.push('Ritual já conhecido por outra fonte')
            }
          }
        }
      }
    }
    let expansionTarget: ClassPower | null = null
    if (power.choice?.kind === 'class-power') {
      if (!choice.classPowerId) complete = false
      else {
        expansionTarget = getPower(choice.classPowerId) ?? null
        if (!expansionTarget) problems.push('Poder de classe desconhecido')
        else {
          if (draft.class && expansionTarget.classIds.includes(draft.class)) {
            problems.push('Expansão de Conhecimento só aprende poderes que NÃO pertençam à sua classe')
          }
          if (grantedClassPowers.some(g => g.powerId === expansionTarget!.id)) {
            problems.push('Poder de classe já aprendido por outra Expansão')
          }
          const spec = POWER_PARAM_SPECS[expansionTarget.id]
          const params = (choice.classPowerParams ?? []).filter(Boolean)
          if (spec && params.length !== spec.count) complete = false
          const targetCtx: PrereqContext = {
            attributes, acquisitionNex, trainedSkills,
            hasClassPower: hasClassPowerSoFar,
            getClassPowerElement: getClassPowerElementSoFar,
            elementCounts,
            chosenElement: (params[0] as OrdemElement | undefined) ?? null,
          }
          const unmetTarget = getUnmetPrereqs(expansionTarget.prereqs, targetCtx)
          if (unmetTarget.length > 0) {
            problems.push(...formatUnmetPrereqs(unmetTarget, targetCtx).map(r => `${expansionTarget!.name}: ${r}`))
          }
        }
      }
    }

    // Pré-requisitos do próprio poder paranormal (contagem = instâncias válidas ANTERIORES).
    const ctx: PrereqContext = {
      attributes, acquisitionNex, trainedSkills,
      hasClassPower: hasClassPowerSoFar,
      getClassPowerElement: getClassPowerElementSoFar,
      elementCounts,
      chosenElement: choice.element ?? null,
    }
    const unmet = getUnmetPrereqs(power.prereqs, ctx)
    problems.push(...formatUnmetPrereqs(unmet, ctx))

    // Repetição / 2ª cópia por afinidade. Resistir a Elemento é único POR ELEMENTO escolhido.
    let uniquenessKey: string | null = null
    if (!power.repeatable) {
      uniquenessKey = power.id === 'resist-element'
        ? (choice.element ? `resist-element::${choice.element}` : null)
        : power.id
      const prior = uniquenessKey ? copiesByKey.get(uniquenessKey) ?? 0 : 0
      if (prior >= 1) {
        instance.isAffinityCopy = true
        if (prior >= 2) problems.push('Este poder já foi escolhido duas vezes')
        if (!affinity.active) {
          problems.push('Escolher um poder pela 2ª vez exige afinidade ativa (elemento escolhido + transcender a partir de NEX 50%)')
        } else {
          if (!isParanormalElement(instance.element) || instance.element !== affinity.element) {
            problems.push(`A 2ª escolha só vale para poderes de ${ELEMENT_NAMES[affinity.element!]}, seu elemento de afinidade`)
          }
          if (affinity.triggerKey && getSourceOrder(key) <= getSourceOrder(affinity.triggerKey)) {
            problems.push('A 2ª escolha precisa vir depois do transcender que ativou a afinidade')
          }
        }
      }
    }

    // Limite do Aprender Ritual: no máximo Intelecto rituais por esta via (excedentes, em ordem).
    if (power.id === 'learn-ritual') {
      learnRitualCount += 1
      if (learnRitualCount > attributes.intellect) {
        problems.push(`Limite de rituais aprendidos por este poder é igual ao seu Intelecto (${attributes.intellect})`)
      }
    }

    instance.complete = complete
    instance.problems = problems
    instance.valid = complete && problems.length === 0

    if (instance.valid) {
      if (isParanormalElement(instance.element)) {
        elementCounts[instance.element] = (elementCounts[instance.element] ?? 0) + 1
      }
      if (uniquenessKey) copiesByKey.set(uniquenessKey, (copiesByKey.get(uniquenessKey) ?? 0) + 1)
      if (ritualKey) learnedRitualKeys.add(ritualKey)
      if (power.choice?.kind === 'class-power' && choice.classPowerId) {
        grantedClassPowers.push({ powerId: choice.classPowerId, params: (choice.classPowerParams ?? []).filter(Boolean) })
      }
    }
  }

  return result
}

/**
 * Gate do passo Poderes Paranormais: toda fonte ativa com escolha completa e válida, e o
 * elemento de afinidade escolhido quando NEX ≥ 50% (escolha canônica do NEX 50, exigida
 * incondicionalmente — como a Versatilidade).
 */
export function areParanormalChoicesComplete(draft: OrdemCharacterDraft): boolean {
  if (draft.nex >= VERSATILITY_NEX && !draft.affinityElement) return false
  return getParanormalInstances(draft).every(instance => instance.valid)
}

// ── Disponibilidade para a UI (com motivo de bloqueio) ──────────────────────────

export type ParanormalPowerOption = {
  power: ParanormalPower
  available: boolean
  reasons: string[]
  /** Escolher este poder aqui seria a 2ª cópia (linha "Afinidade"). */
  isSecondPick: boolean
}

/**
 * Poderes elegíveis para a fonte `key`, com motivos de bloqueio para a UI (a opção nunca é
 * escondida — desabilita com o porquê). A escolha atual da própria fonte não conta contra si.
 * Resistir a Elemento e Aprender Ritual são sempre listados como disponíveis no nível do
 * catálogo — suas restrições dependem da sub-escolha e são validadas na instância.
 */
export function getAvailableParanormalPowers(draft: OrdemCharacterDraft, key: ParanormalSourceKey): ParanormalPowerOption[] {
  const instances = getParanormalInstances(draft)
  const index = instances.findIndex(i => i.key === key)
  const before = index === -1 ? instances : instances.slice(0, index)
  const others = instances.filter(i => i.key !== key && i.choice)

  const affinity = getAffinityState(draft)
  const attributes = getEffectiveAttributes(draft)
  const trainedSkills = getTrainedSkills(draft)
  const acquisitionNex = getSourceAcquisitionNex(key)

  const elementCounts: Partial<Record<ParanormalElement, number>> = {}
  for (const inst of before) {
    if (inst.valid && isParanormalElement(inst.element)) {
      elementCounts[inst.element] = (elementCounts[inst.element] ?? 0) + 1
    }
  }
  const grantedSoFar = before
    .filter(i => i.valid && i.power?.choice?.kind === 'class-power' && i.choice?.classPowerId)
    .map(i => ({ powerId: i.choice!.classPowerId!, params: (i.choice!.classPowerParams ?? []).filter(Boolean) }))

  const ctx: PrereqContext = {
    attributes, acquisitionNex, trainedSkills,
    hasClassPower: id => hasOwnClassPower(draft, id) || grantedSoFar.some(g => g.powerId === id),
    getClassPowerElement: id =>
      getOwnChosenElementForPower(draft, id)
      ?? (grantedSoFar.find(g => g.powerId === id && g.params.length > 0)?.params[0] as OrdemElement | undefined)
      ?? null,
    elementCounts,
  }

  return PARANORMAL_POWERS.map(power => {
    const reasons = formatUnmetPrereqs(getUnmetPrereqs(power.prereqs, ctx), ctx)
    let isSecondPick = false

    if (power.id === 'learn-ritual') {
      const otherLearns = others.filter(i => i.choice?.powerId === 'learn-ritual').length
      if (otherLearns >= attributes.intellect) {
        reasons.push(`Limite de rituais aprendidos por este poder é igual ao seu Intelecto (${attributes.intellect})`)
      }
    } else if (power.id !== 'resist-element') {
      const occurrences = others.filter(i => i.choice?.powerId === power.id).length
      if (occurrences >= 1) {
        isSecondPick = true
        if (occurrences >= 2) reasons.push('Este poder já foi escolhido duas vezes')
        if (!affinity.active) reasons.push('Escolher pela 2ª vez exige afinidade ativa')
        else if (power.element !== affinity.element) {
          reasons.push(`A 2ª escolha só vale para poderes de ${ELEMENT_NAMES[affinity.element!]}, seu elemento de afinidade`)
        } else if (affinity.triggerKey && getSourceOrder(key) <= getSourceOrder(affinity.triggerKey)) {
          reasons.push('A 2ª escolha precisa vir depois do transcender que ativou a afinidade')
        }
      }
    }

    return { power, available: reasons.length === 0, reasons, isSecondPick }
  })
}

export type ExpansionPowerOption = {
  power: ClassPower
  available: boolean
  reasons: string[]
}

/**
 * Alvos elegíveis da Expansão de Conhecimento na fonte `key`: poderes de classe que NÃO
 * pertencem à classe do agente (Transcender/Treinamento em Perícia são das 3, então nunca
 * aparecem), não aprendidos por outra Expansão, com os pré-requisitos DELES validados.
 */
export function getAvailableExpansionPowers(draft: OrdemCharacterDraft, key: ParanormalSourceKey): ExpansionPowerOption[] {
  if (!draft.class) return []
  const cls = draft.class
  const instances = getParanormalInstances(draft)
  const index = instances.findIndex(i => i.key === key)
  const before = index === -1 ? instances : instances.slice(0, index)
  const acquisitionNex = getSourceAcquisitionNex(key)
  const attributes = getEffectiveAttributes(draft)
  const trainedSkills = getTrainedSkills(draft)

  const elementCounts: Partial<Record<ParanormalElement, number>> = {}
  for (const inst of before) {
    if (inst.valid && isParanormalElement(inst.element)) {
      elementCounts[inst.element] = (elementCounts[inst.element] ?? 0) + 1
    }
  }
  const grantedSoFar = before
    .filter(i => i.valid && i.power?.choice?.kind === 'class-power' && i.choice?.classPowerId)
    .map(i => ({ powerId: i.choice!.classPowerId!, params: (i.choice!.classPowerParams ?? []).filter(Boolean) }))
  const grantedElsewhere = instances
    .filter(i => i.key !== key && i.choice?.powerId === 'knowledge-expansion' && i.choice.classPowerId)
    .map(i => i.choice!.classPowerId!)

  return CLASS_POWERS
    .filter(power => !power.classIds.includes(cls))
    .map(power => {
      const ctx: PrereqContext = {
        attributes, acquisitionNex, trainedSkills,
        hasClassPower: id => hasOwnClassPower(draft, id) || grantedSoFar.some(g => g.powerId === id),
        getClassPowerElement: id =>
          getOwnChosenElementForPower(draft, id)
          ?? (grantedSoFar.find(g => g.powerId === id && g.params.length > 0)?.params[0] as OrdemElement | undefined)
          ?? null,
        elementCounts,
        // O elemento do próprio alvo (ex.: Mestre em Elemento) ainda não foi escolhido no catálogo;
        // o pré-requisito sameElementParam é re-validado na instância após a sub-escolha.
        chosenElement: getOwnChosenElementForPower(draft, 'element-specialist'),
      }
      const reasons = formatUnmetPrereqs(getUnmetPrereqs(power.prereqs, ctx), ctx)
      if (grantedElsewhere.includes(power.id)) reasons.push('Já aprendido por outra Expansão de Conhecimento')
      return { power, available: reasons.length === 0, reasons }
    })
}

// ── Efeitos agregados (aplicados na ficha) ──────────────────────────────────────

export type AggregatedParanormalEffects = {
  defenseBonus: number
  resistanceTestsBonus: number
  /** Já multiplicado pelos degraus de NEX (retroativo, ex.: Sangue de Ferro NEX 50% → +20 PV). */
  hpBonus: number
  peBonus: number
  peLimitBonus: number
  threatMarginBonus: number
  critMultiplierBonus: number
  skillBonus: Record<string, number>
  elementResistances: Partial<Record<ParanormalElement, number>>
}

/**
 * Soma os efeitos passivos de todas as instâncias VÁLIDAS. A 1ª cópia aplica `effects`; a 2ª
 * cópia (afinidade) aplica só o DELTA `affinityEffects` — os dados já guardam deltas aditivos.
 */
export function getParanormalEffects(draft: OrdemCharacterDraft): AggregatedParanormalEffects {
  const out: AggregatedParanormalEffects = {
    defenseBonus: 0, resistanceTestsBonus: 0, hpBonus: 0, peBonus: 0, peLimitBonus: 0,
    threatMarginBonus: 0, critMultiplierBonus: 0, skillBonus: {}, elementResistances: {},
  }
  const nexSteps = getNexIndex(draft.nex)
  for (const instance of getParanormalInstances(draft)) {
    if (!instance.valid || !instance.power) continue
    const effects = instance.isAffinityCopy ? instance.power.affinityEffects : instance.power.effects
    if (!effects) continue
    out.defenseBonus += effects.defenseBonus ?? 0
    out.resistanceTestsBonus += effects.resistanceTestsBonus ?? 0
    out.hpBonus += (effects.hpPerNexStep ?? 0) * nexSteps
    out.peBonus += (effects.pePerNexStep ?? 0) * nexSteps
    out.peLimitBonus += effects.peLimitBonus ?? 0
    out.threatMarginBonus += effects.threatMarginBonus ?? 0
    out.critMultiplierBonus += effects.critMultiplierBonus ?? 0
    for (const [skillId, bonus] of Object.entries(effects.skillBonus ?? {})) {
      out.skillBonus[skillId] = (out.skillBonus[skillId] ?? 0) + bonus
    }
    if (effects.chosenElementResistance && isParanormalElement(instance.element)) {
      out.elementResistances[instance.element] =
        (out.elementResistances[instance.element] ?? 0) + effects.chosenElementResistance
    }
  }
  return out
}

// ── Rituais aprendidos via Aprender Ritual ──────────────────────────────────────

export type ParanormalLearnedRitual = {
  ritual: OrdemRitual
  /** Elemento da instância (multi-elemento usa o escolhido; único usa o do ritual). */
  element: OrdemElement
  source: string
}

/** Rituais das instâncias VÁLIDAS de Aprender Ritual (não contam no limite do Ocultista, p. 119). */
export function getParanormalLearnedRituals(draft: OrdemCharacterDraft): ParanormalLearnedRitual[] {
  const result: ParanormalLearnedRitual[] = []
  for (const instance of getParanormalInstances(draft)) {
    if (!instance.valid || instance.power?.id !== 'learn-ritual' || !instance.choice?.ritualId) continue
    const ritual = getRitualById(instance.choice.ritualId)
    if (!ritual) continue
    const element = ritual.elements.length > 1 ? instance.choice.ritualElement : ritual.elements[0]
    if (!element) continue
    result.push({ ritual, element, source: getSourceLabel(instance.key) })
  }
  return result
}

// ── Expansão de Conhecimento: poderes de classe concedidos ──────────────────────

export type ExpansionGrantedPower = { powerId: string; params: string[] }

/** Poderes de classe aprendidos por instâncias VÁLIDAS de Expansão de Conhecimento. */
export function getExpansionGrantedClassPowers(draft: OrdemCharacterDraft): ExpansionGrantedPower[] {
  const result: ExpansionGrantedPower[] = []
  for (const instance of getParanormalInstances(draft)) {
    if (!instance.valid || instance.power?.id !== 'knowledge-expansion' || !instance.choice?.classPowerId) continue
    result.push({
      powerId: instance.choice.classPowerId,
      params: (instance.choice.classPowerParams ?? []).filter(Boolean),
    })
  }
  return result
}

// ── Sanidade: custo do Transcender e do Cultista Arrependido ────────────────────

/**
 * Nº de transcends ATIVOS que custam Sanidade: slots com Transcender + Versatilidade→Transcender.
 * A origem NÃO conta (o custo dela é a metade da SAN inicial, não a perda do ganho de um NEX).
 * Conta mesmo com a escolha do poder ainda pendente — pegar Transcender já compromete o custo.
 */
export function getTranscendCount(draft: OrdemCharacterDraft): number {
  return getActiveParanormalSources(draft).filter(key => key !== 'origin').length
}

export type SanityBreakdown = {
  transcendCount: number
  /** Sanidade não recebida pelos transcends (n × ganho de SAN por NEX da classe). */
  transcendPenalty: number
  /** Metade da SAN inicial (NEX 0%) perdida pela origem Cultista Arrependido; 0 sem a origem. */
  cultistPenalty: number
  total: number
}

/**
 * Penalidade total de Sanidade. Transcender: cada um suprime o ganho de exatamente 1 degrau de
 * NEX (degraus distintos por construção), e como `perNex` é flat por classe a penalidade é
 * n × perNex. Cultista (regra do projeto, 2026-07-17): metade APENAS da SAN inicial —
 * ocultista NEX 5%: 20+5 → 10+5 = 15. O chamador clampa a SAN final em ≥ 0.
 */
export function getSanityBreakdown(draft: OrdemCharacterDraft, cls: OrdemClass): SanityBreakdown {
  const transcendCount = getTranscendCount(draft)
  const transcendPenalty = transcendCount * cls.sanity.perNex
  const cultistPenalty = getOriginEffects(draft).halvesStartingSanity
    ? cls.sanity.initialFlat - Math.floor(cls.sanity.initialFlat / 2)
    : 0
  return { transcendCount, transcendPenalty, cultistPenalty, total: transcendPenalty + cultistPenalty }
}

export function getParanormalSanityPenalty(draft: OrdemCharacterDraft, cls: OrdemClass): number {
  return getSanityBreakdown(draft, cls).total
}
