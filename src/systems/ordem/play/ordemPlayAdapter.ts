import type {
  DyingState, PlayAction, PlayActionGroup, PlayAdapter, PlayCondition, PlayRuntime, PlayStat,
  ResourceTrack, RestOption, RestQuality,
} from '../../../core/play/types'
import { currentOf } from '../../../core/play/types'
import type { OrdemCharacterDraft } from '../types/character'
import { loadLibrary } from '../utils/storage'
import { getOrdemClass } from '../utils/classUtils'
import { getOrigin } from '../utils/originUtils'
import type { OrdemElement, OrdemRitual } from '../types/ritual'
import { getCursedDerivedStats, getRitualDt, getRitualPeLimit } from '../utils/curseUtils'
import {
  getEffectivePeLimit, getExpertDie, getExpertSkills, getGrantedRituals, getRitualCost,
  getSpecialAttackTier, getTrainedSkills,
} from '../utils/characterUtils'
import { getPower } from '../utils/powerUtils'
import { getExpansionGrantedClassPowers } from '../utils/paranormalPowerUtils'
import { getSkillName } from '../utils/skillUtils'
import {
  formatRitualElementLabel, getGrantedRitualElement, getRitualById, getRitualSlotsCount,
  getSlotRitualElement,
} from '../utils/ritualUtils'
import { getSheetWeaponAttacks } from '../utils/ordemWeaponUtils'
import {
  getAttributeDicePenalty, getConditionalSkillBonuses, getSkillBonusTotal, resolveDtInText,
} from '../utils/sheetEffects'
import {
  CONDITIONS, escalateCondition, getBlockingConditions, getConditionDefense,
  getConditionDefenseVs, getConditionDicePenalty, getConditionPeCostDelta,
} from '../utils/conditionUtils'
import { getSheetAttributes } from '../utils/curseUtils'
import { SKILLS, formatSkillWithAttribute } from '../utils/skillUtils'
import { formatDicePool, getDicePool, type DicePool } from '../utils/attributeUtils'
import {
  getLoadState,
  getModifiedDefenseBonus,
  OVERLOAD_DEFENSE_PENALTY,
  OVERLOAD_SPEED_PENALTY_METERS,
} from '../utils/equipmentUtils'

/**
 * Adaptador do Ordem para o modo de jogo.
 *
 * Só **lê** as funções de regra que já existem — as mesmas que a ficha impressa e a Revisão usam,
 * já auditadas contra o livro. Nada aqui recalcula regra por conta própria: se um valor está
 * errado no jogo, está errado na ficha também, e o conserto é num lugar só.
 */
export const ordemPlayAdapter: PlayAdapter = {
  loadCharacter(characterId) {
    const found = loadLibrary().find(c => c.id === characterId)
    if (!found) return null
    return { draft: found.draft, name: found.draft.name?.trim() || '(sem nome)' }
  },

  getResources(draftRaw, runtime): ResourceTrack[] {
    const draft = draftRaw as OrdemCharacterDraft
    const cls = draft.class ? getOrdemClass(draft.class) : undefined
    if (!cls) return []

    // Mesma chamada da ficha impressa (PrintableSheet.tsx): já inclui maldições, origem,
    // poderes paranormais e features de trilha.
    const stats = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft))

    return [
      {
        id: 'hp',
        label: 'Pontos de Vida',
        short: 'PV',
        tone: 'vitality',
        max: stats.hp,
        current: currentOf(runtime, 'hp', stats.hp),
        // "Menos da metade dos PV totais" (p. 311) — comparação estrita, por isso a metade
        // exata (podendo ser fracionária) e não o piso.
        threshold: { at: stats.hp / 2, label: 'Machucado' },
      },
      {
        id: 'pe',
        label: 'Pontos de Esforço',
        short: 'PE',
        tone: 'effort',
        max: stats.pe,
        current: currentOf(runtime, 'pe', stats.pe),
      },
      {
        id: 'sanity',
        label: 'Sanidade',
        short: 'SAN',
        tone: 'sanity',
        max: stats.sanity,
        current: currentOf(runtime, 'sanity', stats.sanity),
      },
    ]
  },

  getStats(draftRaw, runtime): PlayStat[] {
    const draft = draftRaw as OrdemCharacterDraft
    const cls = draft.class ? getOrdemClass(draft.class) : undefined
    if (!cls) return []
    const stats = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft))
    const load = getLoadState(draft)

    // Condições mexem na Defesa (Vulnerável −5, Indefeso −10) e a mesa precisa do número final.
    const conditions = getActiveConditions(draft, runtime)
    const conditionDefense = getConditionDefense(conditions)
    const vs = getConditionDefenseVs(conditions)

    const out: PlayStat[] = [
      {
        label: 'Defesa',
        value: `${stats.defense + conditionDefense}`,
        hint: conditionDefense !== 0 ? `Base ${stats.defense}, ${conditionDefense} por condições` : undefined,
      },
      {
        label: 'Limite de PE',
        value: `${getEffectivePeLimit(draft)}`,
        hint: 'Máximo de PE que dá pra gastar por turno',
      },
    ]
    // Caído dá Defesa diferente por tipo de ataque recebido — não cabe num número só.
    if (vs.melee !== 0 || vs.ranged !== 0) {
      out.push({
        label: 'Defesa (Caído)',
        value: `${stats.defense + conditionDefense + vs.melee} c.a.c. · ${stats.defense + conditionDefense + vs.ranged} à dist.`,
        hint: 'Caído: −5 contra corpo a corpo, +5 contra ataques à distância',
      })
    }

    // A Defesa acima JÁ vem com o −5 (getModifiedDefenseBonus aplica). O aviso existe porque a
    // penalidade de deslocamento não aparece em lugar nenhum e a mesa precisa saber dela.
    if (load.overloaded) {
      out.push({
        label: 'Sobrecarregado',
        value: `−${OVERLOAD_SPEED_PENALTY_METERS} m`,
        hint: `Carga ${load.spaces}/${load.capacity} espaços · o −${OVERLOAD_DEFENSE_PENALTY} de Defesa já está no valor acima`,
      })
    }
    return out
  },

  describeCharacter(draftRaw): string {
    const draft = draftRaw as OrdemCharacterDraft
    const cls = draft.class ? getOrdemClass(draft.class) : undefined
    const origin = draft.origin ? getOrigin(draft.origin) : undefined
    return [cls?.name, `NEX ${draft.nex}%`, origin?.name].filter(Boolean).join(' · ')
  },

  getActions(draftRaw, runtime): PlayActionGroup[] {
    const draft = draftRaw as OrdemCharacterDraft
    if (!draft.class) return []
    const cls = getOrdemClass(draft.class)
    if (!cls) return []

    const stats = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft))
    const currentPe = currentOf(runtime, 'pe', stats.pe)
    const conditions = getActiveConditions(draft, runtime)
    const blockedBy = getBlockingConditions(conditions)
    const blocked = blockedBy.length > 0 ? `${blockedBy.join(' + ')}: não pode agir` : undefined

    const withBlock = (actions: PlayAction[]) =>
      blocked ? actions.map(a => ({ ...a, blocked: a.blocked ?? blocked })) : actions

    return [
      { id: 'attacks', label: 'Ataques', actions: withBlock(buildAttacks(draft, conditions)) },
      {
        id: 'abilities',
        label: 'Habilidades',
        hint: 'Marcadas como "modificador" você aplica na mão — o app cobra o PE e registra, mas o efeito entra na rolagem que você escolher.',
        actions: withBlock(buildAbilities(draft, currentPe, runtime, conditions)),
      },
      {
        id: 'rituals',
        label: 'Rituais',
        hint: `Conjurar desconta o PE automaticamente. Limite de ${getRitualPeLimit(draft)} PE por turno para rituais — mas o livro garante ao menos uma habilidade no custo mínimo por turno, então ele não bloqueia nada aqui (p. 21).`,
        actions: withBlock(buildRituals(draft, currentPe, conditions)),
      },
      {
        id: 'skills',
        label: 'Perícias',
        hint: 'Bônus condicional (só em certas situações) fica de fora do número e aparece na nota.',
        actions: buildSkills(draft, conditions),
      },
    ].filter(group => group.actions.length > 0)
  },

  getConditions(draftRaw, runtime): string[] {
    return getActiveConditions(draftRaw as OrdemCharacterDraft, runtime)
  },

  getConditionCatalog(): PlayCondition[] {
    return CONDITIONS.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      derived: c.derived,
      escalatesTo: c.escalatesTo,
    }))
  },

  escalateCondition,

  /**
   * Leitura adotada: **Capítulo 4, p. 87** (decisão registrada em regras-combate.md). Morre ao
   * iniciar o TERCEIRO turno morrendo na mesma cena, e só sai de morrendo com Medicina DT 20 —
   * curar PV tira a inconsciência, não o sangramento.
   */
  getDyingState(draftRaw, runtime): DyingState {
    const draft = draftRaw as OrdemCharacterDraft
    const cls = draft.class ? getOrdemClass(draft.class) : undefined
    const maxHp = cls ? getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft)).hp : 0
    const hp = currentOf(runtime, 'hp', maxHp)
    return {
      dying: hp === 0 && !runtime.stabilized && !runtime.dead,
      turnsStarted: runtime.dyingTurns,
      limit: DEATH_AT_TURNS,
      dead: runtime.dead,
      stabilizeCheck: { skillId: 'medicine', skillName: 'Medicina', dt: 20 },
    }
  },

  /**
   * Dormir e relaxar (interlúdio, p. 92-93). A recuperação é o **limite de PE** vezes o
   * multiplicador da qualidade; relaxar faz o mesmo pela Sanidade. Arredonda pra baixo, como
   * manda a regra geral de divisões.
   */
  getRestOptions(draftRaw, quality): RestOption[] {
    const draft = draftRaw as OrdemCharacterDraft
    const base = getEffectivePeLimit(draft)
    const amount = Math.floor(base * REST_MULTIPLIER[quality])
    const label = REST_LABEL[quality]

    return [
      {
        id: 'sleep',
        label: 'Dormir',
        recovery: [
          { resourceId: 'hp', amount },
          { resourceId: 'pe', amount },
        ],
        hint: `Limite de PE ${base} × ${label} = ${amount} PV e ${amount} PE. Uma vez por interlúdio.`,
      },
      {
        id: 'relax',
        label: 'Relaxar',
        recovery: [{ resourceId: 'sanity', amount }],
        hint: `${amount} de Sanidade. +1 por cada agente que também relaxar no mesmo interlúdio. Uma vez por interlúdio.`,
      },
    ]
  },
}

/** Cap. 4, p. 87: morre ao INICIAR o terceiro turno morrendo na mesma cena. */
const DEATH_AT_TURNS = 3

const REST_MULTIPLIER: Record<RestQuality, number> = {
  poor: 0.5,
  normal: 1,
  comfortable: 2,
  luxurious: 3,
}

const REST_LABEL: Record<RestQuality, string> = {
  poor: 'precária (½)',
  normal: 'normal (×1)',
  comfortable: 'confortável (×2)',
  luxurious: 'luxuosa (×3)',
}

/**
 * Condições ativas de verdade: as que o jogador marcou mais as **derivadas dos PV**, que o motor
 * liga e desliga sozinho — Machucado abaixo de metade dos PV, Morrendo em 0 (p. 311).
 */
export function getActiveConditions(draft: OrdemCharacterDraft, runtime: PlayRuntime): string[] {
  const cls = draft.class ? getOrdemClass(draft.class) : undefined
  if (!cls) return runtime.conditions
  const maxHp = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft)).hp
  const hp = currentOf(runtime, 'hp', maxHp)

  const derived: string[] = []
  if (hp < maxHp / 2) derived.push('machucado')
  // Estabilizado por Medicina continua em 0 PV, mas fora de morrendo (Cap. 4, p. 87).
  if (hp === 0 && !runtime.stabilized) derived.push('morrendo')
  return [...new Set([...runtime.conditions, ...derived])]
}

/**
 * Rituais conhecidos: os slots do Ocultista mais os concedidos por trilha, Aprender Ritual e
 * slots bônus. O custo sai de `getRitualCost`, que já aplica predileto, Mestre em Elemento,
 * Lâmina Maldita e Tatuagem Ritualística.
 */
function buildRituals(draft: OrdemCharacterDraft, currentPe: number, conditions: string[]): PlayAction[] {
  type Known = { ritual: OrdemRitual; element: OrdemElement | undefined; source: string }

  const slotCount = draft.class === 'occultist' ? getRitualSlotsCount(draft.nex) : 0
  const fromSlots: Known[] = []
  draft.ritualChoices.slice(0, slotCount).forEach((id, slotIndex) => {
    const ritual = id ? getRitualById(id) : undefined
    if (!ritual) return
    fromSlots.push({
      ritual,
      element: getSlotRitualElement(ritual, slotIndex, draft.ritualElementChoices),
      source: '',
    })
  })

  const granted: Known[] = getGrantedRituals(draft).map(g => ({
    ritual: g.ritual,
    element: g.element ?? getGrantedRitualElement(g.ritual, draft.ritualElementChoices),
    source: g.source,
  }))

  // Alquebrado encarece habilidades e rituais em +1 PE (p. 310).
  const peDelta = getConditionPeCostDelta(conditions)

  return [...fromSlots, ...granted].map(({ ritual, element, source }, i) => {
    const base = getRitualCost(draft, ritual, element)
    const cost = base.cost + peDelta
    const costNotes = peDelta > 0 ? [...base.notes, `Alquebrado +${peDelta}`] : base.notes
    const { dt, notes: dtNotes } = getRitualDt(draft, ritual, element)
    // Só a FALTA de PE bloqueia. O limite por turno não: "independentemente do limite, você
    // sempre pode usar pelo menos uma habilidade em seu custo mínimo por turno" (p. 21).
    const missing = cost - currentPe

    return {
      id: `ritual:${i}:${ritual.id}:${element ?? ''}`,
      name: ritual.name,
      // Sem `roll`: quem testa é o alvo, contra a DT. Conjurar gasta PE e registra no histórico.
      rollLabel: `DT ${dt}`,
      cost: { resourceId: 'pe', amount: cost, label: `${cost} PE` },
      blocked: missing > 0 ? `Requer ${cost} PE, você tem ${currentPe}` : undefined,
      detail: [
        `${ritual.circle}º círculo`,
        // Elemento da instância: nos multi-elemento é o escolhido, nos demais o único.
        formatRitualElementLabel(ritual, element),
        ritual.execution,
        ritual.range,
        source || null,
      ].filter(Boolean).join(' · '),
      notes: [
        ...costNotes.map(n => `custo: ${n}`),
        ...dtNotes,
        ritual.resistance && ritual.resistance !== '—' ? `Resistência: ${resolveDtInText(draft, ritual.resistance)}` : null,
      ].filter((n): n is string => Boolean(n)),
    }
  })
}

const ACTION_TYPE_LABEL: Record<string, string> = {
  standard: 'ação padrão',
  movement: 'ação de movimento',
  full: 'ação completa',
  free: 'ação livre',
  reaction: 'reação',
}

/** Chave do uso limitado no `spent`, separada por escopo pra "por cena" e "por rodada" não colidirem. */
function usageKey(id: string, frequency: 'per-scene' | 'per-round'): string {
  return `${frequency}:${id}`
}

/**
 * Habilidades ativáveis: os poderes de classe escolhidos que gastam PE, mais as habilidades da
 * própria classe (Ataque Especial, Eclético, Perito), cujo custo escala com o NEX.
 *
 * O que o app faz e o que não faz: ele **cobra o PE** e **trava a frequência**. Aplicar o efeito
 * de um modificador na rolagem certa continua sendo do jogador — o livro descreve esses efeitos
 * em texto livre, e adivinhar onde eles incidem seria inventar regra.
 */
function buildAbilities(
  draft: OrdemCharacterDraft,
  currentPe: number,
  runtime: PlayRuntime,
  conditions: string[],
): PlayAction[] {
  const peDelta = getConditionPeCostDelta(conditions)
  const out: PlayAction[] = []

  const push = (
    id: string,
    name: string,
    baseCost: number,
    detail: string,
    opts: { frequency?: 'per-scene' | 'per-round'; note?: string } = {},
  ) => {
    const cost = baseCost + peDelta
    let blocked: string | undefined
    let usage: { key: string; at: number } | undefined
    if (opts.frequency) {
      const key = usageKey(id, opts.frequency)
      const now = opts.frequency === 'per-scene' ? runtime.scene : runtime.turn
      usage = { key, at: now }
      if (runtime.spent[key] === now) {
        blocked = opts.frequency === 'per-scene' ? 'Já usado nesta cena' : 'Já usado nesta rodada'
      }
    }
    if (!blocked && cost > currentPe) blocked = `Requer ${cost} PE, você tem ${currentPe}`

    out.push({
      id,
      name,
      cost: { resourceId: 'pe', amount: cost, label: `${cost} PE` },
      usage,
      rollLabel: opts.frequency === 'per-scene' ? '1×/cena' : opts.frequency === 'per-round' ? '1×/rodada' : '',
      detail,
      blocked,
      notes: [
        ...(peDelta > 0 ? [`Alquebrado +${peDelta} PE`] : []),
        ...(opts.note ? [opts.note] : []),
      ],
    })
  }

  // ── Habilidade da própria classe (custo escala com o NEX) ──
  if (draft.class === 'combatant') {
    const tier = getSpecialAttackTier(draft.nex)
    push('ability:special-attack', 'Ataque Especial', tier.pe,
      `+${tier.bonus} no teste de ataque OU na rolagem de dano`,
      { note: 'modificador — escolha onde aplicar antes de rolar' })
  }
  if (draft.class === 'specialist') {
    const expert = getExpertDie(draft.nex)
    push('ability:eclectic', 'Eclético', 2,
      'recebe os benefícios de ser treinado na perícia do teste',
      { note: 'modificador — vale no teste que você fizer em seguida' })
    if (getExpertSkills(draft).length > 0) {
      push('ability:expert', 'Perito', expert.pe,
        `+${expert.die} no teste — ${getExpertSkills(draft).map(getSkillName).join(' ou ')}`,
        { note: 'modificador — some o dado ao resultado' })
    }
  }

  // ── Poderes de classe escolhidos que se ativam ──
  // Mesma resolução da ficha impressa: os ids de `powerChoices`, tirando o Transcender (que não
  // é poder de classe, e sim a porta pros paranormais). Inclui os concedidos por expansão.
  const chosenIds = [
    ...draft.powerChoices.filter((id): id is string => Boolean(id) && id !== 'transcend'),
    ...getExpansionGrantedClassPowers(draft).map(g => g.powerId),
  ]
  for (const id of [...new Set(chosenIds)]) {
    const power = getPower(id)
    const activation = power?.activation
    if (!power || !activation) continue
    const bits = [
      activation.actionType ? ACTION_TYPE_LABEL[activation.actionType] : null,
      activation.kind === 'rider' ? 'modificador' : null,
      activation.kind === 'variable' ? 'custo variável' : null,
    ].filter(Boolean)
    push(`power:${power.id}`, power.name, activation.peCost, bits.join(' · '), {
      frequency: activation.frequency,
      note: activation.kind === 'variable'
        ? 'o custo cresce a cada uso no turno — o app cobra só o primeiro degrau'
        : power.description,
    })
  }

  return out
}

/** Ataques da ficha, já roláveis: pool, bônus, dano estruturado e margem de ameaça. */
function buildAttacks(draft: OrdemCharacterDraft, conditions: string[]): PlayAction[] {
  return getSheetWeaponAttacks(draft).map((attack, i) => {
    // Condições penalizam em DADOS, e a ficha estática não as conhece — por isso o pool é
    // re-derivado das entradas originais em vez de ajustado a partir do resultado.
    const conditionPenalty = getConditionDicePenalty(conditions, {
      kind: 'attack',
      melee: attack.skill === 'Luta',
      attribute: attack.attributeUsed,
    })
    const pool = toRollablePool(getDicePool(attack.attributeValue, attack.dicePenalty + conditionPenalty))

    return {
    id: `attack:${i}:${attack.name}`,
    name: attack.name,
    roll: {
      dice: pool.dice,
      mode: pool.mode,
      bonus: attack.attackBonus,
      label: formatPoolLabel(pool, attack.attackBonus),
    },
    damage: {
      spec: attack.damageSpec,
      label: attack.damage,
      threatMargin: attack.threatMargin,
      critMultiplier: attack.critMultiplier,
    },
    // Arma corpo a corpo vem com o alcance em travessão; virar "· – ·" na linha é só ruído.
    detail: [attack.skill, isRealRange(attack.range) ? attack.range : null, `Crít. ${attack.critical}`]
      .filter(Boolean).join(' · '),
    notes: [
      ...attack.dicePenaltyNotes,
      ...(conditionPenalty > 0 ? [`condições −${'Ø'.repeat(conditionPenalty)}`] : []),
      ...attack.notes,
    ],
    }
  })
}

/**
 * Todas as perícias roláveis. As "somente treinada" só entram se o personagem for treinado —
 * o livro não permite testá-las destreinado, então oferecer o botão seria mentir.
 */
function buildSkills(draft: OrdemCharacterDraft, conditions: string[]): PlayAction[] {
  const trained = new Set(getTrainedSkills(draft))
  const conditional = getConditionalSkillBonuses(draft)
  const attrs = getSheetAttributes(draft)

  return SKILLS
    .filter(skill => !skill.trainedOnly || trained.has(skill.id))
    .map(skill => {
      const conditionPenalty = getConditionDicePenalty(conditions, {
        kind: 'skill',
        skillId: skill.id,
        attribute: skill.attribute,
      })
      // Mesma conta de getSkillDicePool, mais a penalidade das condições.
      const pool = toRollablePool(getDicePool(
        attrs[skill.attribute],
        getAttributeDicePenalty(draft, skill.attribute) + conditionPenalty,
      ))
      const bonus = getSkillBonusTotal(draft, skill.id)
      return {
        id: `skill:${skill.id}`,
        name: formatSkillWithAttribute(skill.id),
        roll: { dice: pool.dice, mode: pool.mode, bonus, label: formatPoolLabel(pool, bonus) },
        notes: [
          ...(conditionPenalty > 0 ? [`condições −${'Ø'.repeat(conditionPenalty)}`] : []),
          // Condicional NÃO entra no número: vale só em certas situações, e embutir enganaria o
          // teste. Vira nota, pro jogador somar quando a condição valer.
          ...conditional
            .filter(b => b.skillIds.includes(skill.id))
            .map(b => `+${b.value} ${b.condition} (${b.source})`),
        ],
      }
    })
}

/** A ficha usa travessão/hífen pra "sem alcance" (corpo a corpo). */
function isRealRange(range: string): boolean {
  const trimmed = range.trim()
  return trimmed.length > 0 && !/^[–—-]$/.test(trimmed)
}

/**
 * A ficha mostra `0` dados quando o atributo é 0 (ver `getDicePool`), mas na mesa o botão precisa
 * rolar alguma coisa quando o jogador aperta — e `rollPool` já tem piso de 1 dado. O modo de jogo
 * então rola 1d20 e **rotula 1d20**: o número exibido nunca mente sobre o que foi rolado.
 */
function toRollablePool(pool: DicePool): DicePool {
  return pool.dice >= 1 ? pool : { dice: 1, mode: pool.mode }
}

function formatPoolLabel(pool: { dice: number; mode: 'best' | 'worst' }, bonus: number): string {
  const base = formatDicePool(pool)
  if (bonus === 0) return base
  return `${base} ${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}`
}

export type { PlayRuntime }
