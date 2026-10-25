import type { AsiChoice, CharacterDraft, ClassChoiceSelections, ClassEntry, WizardStep } from '../types/character'
import { STEP_LABELS } from '../types/character'
import type { GameClass, ToolChoiceSource } from '../types/class'
import type { AbilityScore } from '../types/race'
import type { BackgroundChoice } from '../types/background'
import { getRace, getSubrace, getAllChoices } from './raceUtils'
import {
  getClass,
  getClassFightingStyleOptions,
  getExpertiseCount,
  isActiveCaster,
  FIGHTING_STYLES,
  SUBCLASS_LABEL,
} from './classUtils'
import {
  getBackground,
  getBackgroundItemChoices,
  getChosenBackgroundItem,
  TOOL_CHOICE_LABEL,
} from './backgroundUtils'
import {
  ABILITY_LABELS,
  ALL_ABILITY_SCORES,
  CUSTOM_MAX,
  CUSTOM_MIN,
  POINT_BUY_TOTAL,
  STANDARD_ARRAY,
  getRemainingPoints,
} from './abilityScoreUtils'
import { getAsiSlotCount, getReachedAsiLevels, isAsiChoiceComplete, getRacialBonuses, getAsiBonuses, getFinalAbilityScores } from './asiUtils'
import { getFeat } from './featUtils'
import { getFeatChoiceSlots, getRepeatedFightingStyles, type FeatChoiceSlot } from './sheetEffects'
import { getProgressionSlotsUpToLevel } from './progressionChoiceUtils'
import { describeRequiredPick, getUnmetPickRequirements } from './progressionOptions'
import {
  getEntrySpellcasting,
  getKnownColumnSecrets,
  getCantripColumn,
  getSecretSpellIssues,
  getSpell,
  type SecretSpellIssue,
  getSpellsKnownCount,
  getSchoolRestrictionStatus,
  getWizardSpellbookSize,
  getCasterEntries,
  getSpellStepOverflows,
} from './spellUtils'
import { describeEquipmentOption, isChoiceResolved } from './equipmentUtils'
import {
  getPrimaryLevel,
  allClassEntries,
  getAdditionalLevelsUsed,
  isMulticlassed,
  meetsMulticlassPrereq,
  describeMulticlassPrereq,
} from './multiclassUtils'
import { isStepComplete, getMissingSteps } from './draftValidation'

/**
 * O que falta, em português, para cada etapa pendente — o aviso da Revisão e o rodapé de cada
 * etapa. Cada motivo espelha uma verificação de `isStepComplete` (e dos isXStepComplete que ela
 * chama), na mesma ordem: a Revisão nunca bloqueia sem dizer por quê, nem lista o que não bloqueia.
 * Ao mudar uma regra de validação, mude o motivo aqui junto (o teste de cobertura cobra).
 */

/** Uma etapa pendente e os motivos concretos. */
export type PendingStep = { step: WizardStep; reasons: string[] }

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function ordinal(n: number): string {
  return `${n}º`
}

/** Escolhas de um talento que ainda faltam (Perito, Poliglota, Mestre de Armas). */
function featChoiceReasons(slot: FeatChoiceSlot, where: string): string[] {
  const { choices, selections, feat } = slot
  const out: string[] = []
  if (choices.skillOrToolChoice) {
    const missing = choices.skillOrToolChoice.count - (selections.skills?.length ?? 0) - (selections.tools?.length ?? 0)
    if (missing > 0) out.push(`${where}, talento ${feat.name}: escolha mais ${plural(missing, 'perícia ou ferramenta', 'perícias ou ferramentas')}`)
  }
  if (choices.languageChoice) {
    const missing = choices.languageChoice.count - (selections.languages?.length ?? 0)
    if (missing > 0) out.push(`${where}, talento ${feat.name}: escolha mais ${plural(missing, 'idioma', 'idiomas')}`)
  }
  if (choices.weaponChoice) {
    const missing = choices.weaponChoice.count - (selections.weapons?.length ?? 0)
    if (missing > 0) out.push(`${where}, talento ${feat.name}: escolha mais ${plural(missing, 'arma', 'armas')}`)
  }
  return out
}

function featChoicesReasons(draft: CharacterDraft, featIds: string[], where: string): string[] {
  return getFeatChoiceSlots(draft)
    .filter(slot => featIds.includes(slot.feat.id))
    .flatMap(slot => featChoiceReasons(slot, where))
}

// ── Raça ────────────────────────────────────────────────────────────────────────

function raceReasons(draft: CharacterDraft): string[] {
  const race = draft.race ? (getRace(draft.race) ?? null) : null
  if (!race) return ['Escolha uma raça']
  const subrace = draft.subrace ? (getSubrace(race, draft.subrace) ?? null) : null
  if (race.subraces.length > 0 && !subrace) return [`Escolha a sub-raça de ${race.name}`]

  const name = subrace?.name ?? race.name
  const choices = draft.raceChoices
  const out: string[] = []
  for (const choice of getAllChoices(race, subrace)) {
    switch (choice.kind) {
      case 'ability': {
        const missing = choice.count - (choices.abilityBonuses?.length ?? 0)
        if (missing > 0) out.push(`${name}: escolha mais ${plural(missing, 'atributo', 'atributos')} para o bônus racial de +${choice.value}`)
        break
      }
      case 'skill': {
        const missing = choice.count - (choices.skills?.length ?? 0)
        if (missing > 0) out.push(`${name}: escolha mais ${plural(missing, 'perícia', 'perícias')}`)
        break
      }
      case 'language': {
        const missing = choice.count - (choices.languages?.length ?? 0)
        if (missing > 0) out.push(`${name}: escolha mais ${plural(missing, 'idioma', 'idiomas')}`)
        break
      }
      case 'tool': {
        const missing = choice.count - (choices.tools?.length ?? 0)
        if (missing > 0) out.push(`${name}: escolha mais ${plural(missing, 'ferramenta', 'ferramentas')}`)
        break
      }
      case 'cantrip':
        if (!choices.cantrip) out.push(`${name}: escolha o truque racial`)
        break
      case 'feat': {
        if (!choices.feat) {
          out.push(`${name}: escolha o talento racial`)
          break
        }
        const feat = getFeat(choices.feat)
        const options = feat?.abilityIncrease
        if (options && options.length > 0 && (!choices.featAbility || !options.includes(choices.featAbility))) {
          out.push(`${name}, talento ${feat?.name ?? choices.feat}: escolha o atributo que ganha +1`)
        }
        break
      }
    }
  }
  if (choices.feat) out.push(...featChoicesReasons(draft, [choices.feat], name))
  return out
}

// ── Classe ──────────────────────────────────────────────────────────────────────

const TOOL_SOURCE_WORDS: Record<ToolChoiceSource, [string, string]> = {
  'musical-instrument': ['instrumento musical', 'instrumentos musicais'],
  artisan: ['ferramenta de artesão', 'ferramentas de artesão'],
  'any-tool': ['ferramenta ou instrumento', 'ferramentas ou instrumentos'],
}

/** "Estilo de Luta do Paladino" / "Arquétipo Marcial do Guerreiro": artigo pelo gênero da palavra. */
function subclassLabel(cls: GameClass): string {
  const label = SUBCLASS_LABEL[cls.id] ?? 'subclasse'
  const feminine = /^(Tradição|Origem|subclasse)/.test(label)
  return `${feminine ? 'a' : 'o'} ${label}`
}

/** Motivos de uma classe da ficha no nível que tem nela — espelha isClassStepComplete. */
function classEntryReasons(cls: GameClass, choices: ClassChoiceSelections, level: number, multiclass: boolean): string[] {
  const out: string[] = []

  const skillCount = multiclass ? (cls.multiclassProficiencies.skills?.count ?? 0) : cls.skillChoices.count
  const skillDiff = skillCount - choices.skills.length
  if (skillDiff > 0) out.push(`${cls.name}: escolha mais ${plural(skillDiff, 'perícia', 'perícias')} da classe`)
  if (skillDiff < 0) {
    out.push(`${cls.name}: ${plural(-skillDiff, 'perícia marcada', 'perícias marcadas')} a mais — a classe dá ${skillCount}${multiclass ? ' na multiclasse' : ''}; desmarque o excesso`)
  }

  if (!multiclass) {
    const toolChoices = cls.toolProficiencies.choices
    const required = toolChoices.reduce((sum, c) => sum + c.count, 0)
    const missing = required - choices.tools.length
    if (missing > 0) {
      const [one, many] = toolChoices.length === 1 ? TOOL_SOURCE_WORDS[toolChoices[0].from] : ['ferramenta', 'ferramentas']
      out.push(`${cls.name}: escolha mais ${plural(missing, one, many)}`)
    }
  }

  const fightingStyles = getClassFightingStyleOptions(cls, level)
  if (fightingStyles.length > 0 && !fightingStyles.some(s => s.id === choices.fightingStyle)) {
    out.push(`Escolha o Estilo de Luta do ${cls.name} (ganho no ${ordinal(cls.fightingStyleGrant?.level ?? 1)} nível)`)
  }

  if (cls.subclassLevel <= level) {
    const subclass = choices.subclass ? cls.subclasses.find(s => s.id === choices.subclass) : undefined
    if (!choices.subclass) {
      out.push(`Escolha ${subclassLabel(cls)} do ${cls.name} (ganho no ${ordinal(cls.subclassLevel)} nível)`)
    } else if (subclass?.extras) {
      const { extras } = subclass
      const where = `${cls.name} (${subclass.name})`
      const skillsNeeded = (extras.expertiseSkills?.count ?? 0) + (extras.skillChoice?.count ?? 0)
      const skillsMissing = skillsNeeded - (choices.subclassExtras.skills ?? []).length
      if (skillsNeeded > 0 && skillsMissing > 0) out.push(`${where}: escolha mais ${plural(skillsMissing, 'perícia', 'perícias')}`)
      const langMissing = (extras.languages?.count ?? 0) - (choices.subclassExtras.languages ?? []).length
      if (extras.languages && langMissing > 0) out.push(`${where}: escolha mais ${plural(langMissing, 'idioma', 'idiomas')}`)
      const toolMissing = (extras.toolChoice?.count ?? 0) - (choices.subclassExtras.tools ?? []).length
      if (extras.toolChoice && toolMissing > 0) {
        const [one, many] = TOOL_SOURCE_WORDS[extras.toolChoice.from]
        out.push(`${where}: escolha mais ${plural(toolMissing, one, many)}`)
      }
      if (extras.cantripChoice && !choices.subclassExtras.cantrip) out.push(`${where}: escolha o truque`)
    }
  }

  const expertiseMissing = getExpertiseCount(cls, level) - choices.expertiseItems.length
  if (expertiseMissing > 0) {
    const feature = cls.id === 'bard' ? 'Aptidão' : 'Especialização'
    out.push(`${cls.name}: escolha mais ${plural(expertiseMissing, 'perícia', 'perícias')} para a ${feature} (bônus dobrado)`)
  }

  for (const slot of getProgressionSlotsUpToLevel(cls.id, choices.subclass, level, choices.progressionChoices)) {
    const picked = (choices.progressionChoices[slot.id] ?? []).length
    if (picked < slot.count) {
      out.push(`${cls.name}: escolha mais ${slot.count - picked} em ${slot.label} (ganho no ${ordinal(slot.level)} nível)`)
    } else if (picked > slot.count) {
      out.push(`${cls.name}: ${picked - slot.count} a mais em ${slot.label} (${ordinal(slot.level)} nível) — o máximo ali é ${slot.count}; desmarque o excesso`)
    }
  }

  for (const issue of getSecretSpellIssues(cls.id, choices.subclass, level, choices.progressionChoices)) {
    out.push(describeSecretSpellIssue(cls.name, issue))
  }

  for (const { slot, option, required } of getUnmetPickRequirements(cls.id, choices.subclass, level, choices.progressionChoices)) {
    out.push(`${cls.name}: ${option.name} ${describeRequiredPick(required)} — troque em ${slot.label}${required.slotLabel ? ` ou escolha ${required.name} em ${required.slotLabel}` : ''}`)
  }

  return out
}

/** O motivo de um problema nos Segredos Mágicos (getSecretSpellIssues), com o que trocar. */
function describeSecretSpellIssue(className: string, issue: SecretSpellIssue): string {
  if (issue.kind === 'above-level') {
    const name = getSpell(issue.spellId)?.name ?? issue.spellId
    if (issue.maxLevel === 0) return `${className}: ${name} (${ordinal(issue.spellLevel)}) não é truque — em ${issue.slotLabel} só entram truques; troque`
    return `${className}: ${name} (${ordinal(issue.spellLevel)}) passa do ${ordinal(issue.maxLevel)} nível que você conjura — troque em ${issue.slotLabel}`
  }
  const names = issue.cantrips.map(id => getSpell(id)?.name ?? id).join(', ')
  return `${className}: ${issue.cantrips.length} Segredos Mágicos são truques (${names}), mas a coluna Truques Conhecidos `
    + `tem ${issue.max} — troque ${countWordMasc(issue.excess)} por magia de 1º nível ou mais em Segredos Mágicos`
}

function countWordMasc(n: number): string {
  return n === 1 ? 'um' : String(n)
}

function classReasons(draft: CharacterDraft): string[] {
  const cls = draft.class ? (getClass(draft.class) ?? null) : null
  if (!cls) return ['Escolha uma classe']
  const out = classEntryReasons(cls, draft.classChoices, getPrimaryLevel(draft), false)
  if (getAdditionalLevelsUsed(draft) > draft.level - 1) {
    out.push(`As classes adicionais somam mais níveis do que o personagem tem (${draft.level}) — reduza algum`)
  }
  for (const entry of draft.additionalClasses) {
    const ec = getClass(entry.classId)
    if (!ec) out.push(`Classe adicional desconhecida (${entry.classId}): remova-a`)
    else out.push(...classEntryReasons(ec, entry.classChoices, entry.level, true))
  }
  for (const id of getRepeatedFightingStyles(draft)) {
    const name = FIGHTING_STYLES.find(s => s.id === id)?.name ?? id
    out.push(`Estilo de Luta ${name} escolhido duas vezes — o mesmo estilo não vale duas vezes (p. 85); troque um deles`)
  }
  return out
}

// ── Atributos ─────────────────────────────────────────────────────────────────

function abilityReasons(draft: CharacterDraft): string[] {
  const method = draft.abilityMethod
  if (!method) return ['Escolha um método para gerar os atributos']
  const empty = ALL_ABILITY_SCORES.filter(a => draft.abilityScores[a] === null)
  if (empty.length > 0) return [`Falta valor em ${empty.map(a => ABILITY_LABELS[a].long).join(', ')}`]
  const scores = draft.abilityScores as Record<AbilityScore, number>
  const nums = ALL_ABILITY_SCORES.map(a => scores[a])

  if (method === 'standard-array') {
    const sorted = [...nums].sort((a, b) => b - a)
    return sorted.every((v, i) => v === STANDARD_ARRAY[i])
      ? []
      : [`Use cada valor do arranjo padrão (${STANDARD_ARRAY.join(', ')}) uma vez`]
  }
  if (method === 'point-buy') {
    const out: string[] = []
    if (!nums.every(s => s >= 8 && s <= 15)) out.push('Na compra de pontos, cada atributo fica entre 8 e 15')
    const remaining = getRemainingPoints(scores)
    if (remaining > 0) out.push(`Ainda sobram ${plural(remaining, 'ponto', 'pontos')} da compra (são ${POINT_BUY_TOTAL})`)
    if (remaining < 0) out.push(`A compra passou ${plural(-remaining, 'ponto', 'pontos')} do limite de ${POINT_BUY_TOTAL}`)
    return out
  }
  if (method === 'roll') {
    if (draft.rolledValues.length !== 6) return ['Role os seis valores dos atributos']
    const rolled = [...draft.rolledValues].sort((a, b) => a - b)
    const assigned = [...nums].sort((a, b) => a - b)
    return rolled.every((v, i) => v === assigned[i]) ? [] : ['Atribua cada valor rolado a um atributo']
  }
  if (method === 'custom') {
    return nums.every(s => s >= CUSTOM_MIN && s <= CUSTOM_MAX)
      ? []
      : [`No modo livre, cada atributo fica entre ${CUSTOM_MIN} e ${CUSTOM_MAX}`]
  }
  return []
}

// ── Aprimoramentos ──────────────────────────────────────────────────────────────

function improvementReasons(draft: CharacterDraft): string[] {
  const out: string[] = []
  const entries = allClassEntries(draft)
  const reached: (AsiChoice | undefined)[] = []
  for (const entry of entries) {
    const className = entries.length > 1 ? ` (${getClass(entry.classId)?.name ?? entry.classId})` : ''
    const levels = getReachedAsiLevels(entry.classId, entry.level)
    const slots = getAsiSlotCount(entry.classId, entry.level)
    for (let i = 0; i < slots; i++) {
      const choice = entry.asiChoices[i]
      const where = `Incremento do ${ordinal(levels[i] ?? i + 1)} nível${className}`
      if (choice && isAsiChoiceComplete(choice)) {
        reached.push(choice)
        continue
      }
      if (!choice || (choice.kind === 'feat' && !choice.featId)) {
        out.push(`${where}: escolha +2 em atributos ou um talento`)
      } else if (choice.kind === 'feat') {
        out.push(`${where}: escolha o atributo que ganha +1 do talento ${getFeat(choice.featId)?.name ?? choice.featId}`)
      } else {
        out.push(`${where}: distribua os 2 pontos de atributo`)
      }
      reached.push(choice)
    }
  }

  const featIds = reached
    .filter(c => c?.kind === 'feat')
    .map(c => (c as { featId: string }).featId)
  out.push(...featChoicesReasons(draft, featIds, 'Aprimoramentos'))

  const complete = reached.filter((c): c is AsiChoice => !!c && isAsiChoiceComplete(c))
  const racial = getRacialBonuses(draft)
  const asi = getAsiBonuses(complete)
  for (const ab of ALL_ABILITY_SCORES) {
    const baseWithRacial = (draft.abilityScores[ab] ?? 10) + racial[ab]
    const total = baseWithRacial + asi[ab]
    if (total > Math.max(20, baseWithRacial)) {
      out.push(`${ABILITY_LABELS[ab].long} passaria de 20 (${total}) — os incrementos não passam do teto; redistribua`)
    }
  }
  return out
}

// ── Magias ──────────────────────────────────────────────────────────────────────

function spellEntryReasons(entry: ClassEntry): string[] {
  const cls = getClass(entry.classId) ?? null
  const subclassId = entry.classChoices.subclass
  const casting = getEntrySpellcasting(cls, subclassId)
  if (!cls || !casting || !isActiveCaster(cls, entry.level, subclassId)) return []

  const sc = casting.spellcasting
  const choices = entry.spellChoices
  const secrets = getKnownColumnSecrets(cls.id, subclassId, entry.level, entry.classChoices.progressionChoices)
  const listName = casting.spellList !== cls.id ? ` de ${(getClass(casting.spellList)?.name ?? casting.spellList).toLowerCase()}` : ''
  const asks: string[] = []
  const out: string[] = []

  const cantrips = getCantripColumn(casting, entry.level, choices, secrets)
  const cantripsMissing = cantrips.total - cantrips.chosen - cantrips.fromSecrets
  if (cantrips.total > 0 && cantripsMissing > 0) asks.push(plural(cantripsMissing, 'truque', 'truques'))

  if (sc.type === 'known') {
    const needed = getSpellsKnownCount(casting.casterId, entry.level) || sc.spellsAtLevel1
    const fromSecrets = secrets.spells.filter(id => !choices.spells.includes(id)).length
    const missing = needed - choices.spells.length - fromSecrets
    if (needed > 0 && missing > 0) asks.push(`${plural(missing, 'magia', 'magias')}${listName}`)
  }

  if (sc.type === 'hybrid') {
    const missing = getWizardSpellbookSize(entry.level) - choices.spells.length
    if (missing > 0) asks.push(`${plural(missing, 'magia', 'magias')} para o grimório`)
  }

  if (sc.type === 'prepared' && choices.spells.length < 1) asks.push('ao menos 1 magia para preparar')

  if (asks.length > 0) out.push(`${casting.label}: escolha ${asks.join(' e ')}`)

  const school = getSchoolRestrictionStatus(sc, entry.level, choices.spells)
  if (school && school.freeUsed > school.freeSlots) {
    const excess = school.freeUsed - school.freeSlots
    out.push(
      `${casting.label}: ${plural(school.freeUsed, 'magia', 'magias')} fora de ${school.schools.join(' e ')}, `
      + `mas só ${school.freeSlots} ${school.freeSlots === 1 ? 'pode' : 'podem'} ser de outra escola — troque ${excess}`,
    )
  }
  return out
}

function spellReasons(draft: CharacterDraft): string[] {
  const overflows = getSpellStepOverflows(getCasterEntries(draft), getFinalAbilityScores(draft))
  return [...allClassEntries(draft).flatMap(spellEntryReasons), ...overflows.map(o => o.text)]
}

// ── Antecedente ─────────────────────────────────────────────────────────────────

function backgroundReasons(draft: CharacterDraft): string[] {
  const background = draft.background ? (getBackground(draft.background) ?? null) : null
  if (!background) return ['Escolha um antecedente']
  const choices = draft.backgroundChoices
  const out: string[] = []

  const toolChoices = background.choices.filter(
    (c): c is Extract<BackgroundChoice, { kind: 'tool-choice' }> => c.kind === 'tool-choice',
  )
  const toolsMissing = toolChoices.reduce((sum, c) => sum + c.count, 0) - (choices.tools?.length ?? 0)
  if (toolsMissing > 0) {
    const what = toolChoices.length === 1 ? (TOOL_CHOICE_LABEL[toolChoices[0].from] ?? 'Ferramenta') : 'Ferramenta'
    out.push(`${background.name}: escolha ${toolsMissing === 1 ? 'a' : toolsMissing} proficiência em ${what}`)
  }

  const languagesMissing = background.choices
    .filter((c): c is Extract<BackgroundChoice, { kind: 'language-choice' }> => c.kind === 'language-choice')
    .reduce((sum, c) => sum + c.count, 0) - (choices.languages?.length ?? 0)
  if (languagesMissing > 0) out.push(`${background.name}: escolha mais ${plural(languagesMissing, 'idioma', 'idiomas')}`)

  for (const item of getBackgroundItemChoices(background)) {
    if (getChosenBackgroundItem(item, choices) === null) {
      out.push(`Equipamento do ${background.name}: escolha ${item.label}`)
    }
  }
  return out
}

// ── Equipamento ─────────────────────────────────────────────────────────────────

function equipmentReasons(draft: CharacterDraft): string[] {
  const { equipment } = draft
  if (!equipment.method) return ['Escolha como se equipar: o equipamento da classe ou o ouro inicial']
  if (equipment.method === 'wealth') return equipment.rolledGold === null ? ['Role o ouro inicial'] : []
  const cls = draft.class ? getClass(draft.class) : undefined
  if (!cls) return ['Escolha uma classe — o equipamento inicial vem dela']
  return cls.startingEquipment.choices.flatMap((choice, idx) => {
    const resolution = equipment.classResolutions[idx]
    if (isChoiceResolved(choice, resolution)) return []
    const option = resolution && resolution.optionIndex >= 0 ? choice.options[resolution.optionIndex] : undefined
    if (!option) {
      return [`Equipamento inicial: escolha entre ${choice.options.map(describeEquipmentOption).join(' ou ')}`]
    }
    return [`Equipamento inicial: complete "${describeEquipmentOption(option)}"`]
  })
}

// ── Revisão (pré-requisito de multiclasse) ───────────────────────────────────────

function reviewReasons(draft: CharacterDraft): string[] {
  if (!isMulticlassed(draft)) return []
  const scores = getFinalAbilityScores(draft)
  return allClassEntries(draft).flatMap(entry => {
    const cls = getClass(entry.classId)
    if (!cls) return [`Classe desconhecida (${entry.classId}): remova-a`]
    return meetsMulticlassPrereq(cls, scores)
      ? []
      : [`${cls.name} exige ${describeMulticlassPrereq(cls)} para multiclassar (p. 163) — ajuste os atributos ou as classes`]
  })
}

// ── API ─────────────────────────────────────────────────────────────────────────

/**
 * Os motivos crus de uma etapa, sem a rede de segurança. Exportado para o teste de cobertura:
 * deve ser vazio exatamente quando `isStepComplete` aprova.
 */
export function collectStepReasons(draft: CharacterDraft, step: WizardStep): string[] {
  switch (step) {
    case 'name': return draft.name.trim().length > 0 ? [] : ['Dê um nome ao personagem']
    case 'race': return raceReasons(draft)
    case 'class': return classReasons(draft)
    case 'abilities': return abilityReasons(draft)
    case 'improvements': return improvementReasons(draft)
    case 'spells': return spellReasons(draft)
    case 'background': return backgroundReasons(draft)
    case 'equipment': return equipmentReasons(draft)
    case 'review': return reviewReasons(draft)
  }
}

/**
 * O que falta na etapa, em frases prontas. `isStepComplete` continua sendo o portão: etapa
 * completa nunca tem motivo, e etapa reprovada sempre tem ao menos um (se algum dia uma regra
 * nova faltar aqui, cai no genérico em vez de bloquear calado).
 */
export function getStepPendingReasons(draft: CharacterDraft, step: WizardStep): string[] {
  if (isStepComplete(draft, step)) return []
  const reasons = collectStepReasons(draft, step)
  return reasons.length > 0 ? reasons : [`Revise a etapa ${STEP_LABELS[step]}`]
}

/** Etapas pendentes (as de getMissingSteps, na ordem do wizard), cada uma com os motivos. */
export function getPendingSteps(draft: CharacterDraft): PendingStep[] {
  return getMissingSteps(draft).map(step => ({ step, reasons: getStepPendingReasons(draft, step) }))
}

/** O aviso curto do rodapé de uma etapa: o primeiro motivo, e quantos mais há. */
export function formatPendingHint(reasons: string[]): string | undefined {
  if (reasons.length === 0) return undefined
  if (reasons.length === 1) return reasons[0]
  const more = reasons.length - 1
  return `${reasons[0]} (e mais ${more} ${more === 1 ? 'pendência' : 'pendências'})`
}
