import type {
  PlayAction, PlayActionGroup, PlayAdapter, PlayRuntime, PlayStat, ResourceTrack,
} from '../../../core/play/types'
import { currentOf } from '../../../core/play/types'
import type { OrdemCharacterDraft } from '../types/character'
import { loadLibrary } from '../utils/storage'
import { getOrdemClass } from '../utils/classUtils'
import { getOrigin } from '../utils/originUtils'
import type { OrdemElement, OrdemRitual } from '../types/ritual'
import { getCursedDerivedStats, getRitualDt, getRitualPeLimit } from '../utils/curseUtils'
import {
  getEffectivePeLimit, getGrantedRituals, getRitualCost, getTrainedSkills,
} from '../utils/characterUtils'
import {
  formatRitualElementLabel, getGrantedRitualElement, getRitualById, getRitualSlotsCount,
  getSlotRitualElement,
} from '../utils/ritualUtils'
import { getSheetWeaponAttacks } from '../utils/ordemWeaponUtils'
import {
  getConditionalSkillBonuses, getSkillBonusTotal, getSkillDicePool, resolveDtInText,
} from '../utils/sheetEffects'
import { SKILLS, formatSkillWithAttribute } from '../utils/skillUtils'
import { formatDicePool } from '../utils/attributeUtils'
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

  getStats(draftRaw): PlayStat[] {
    const draft = draftRaw as OrdemCharacterDraft
    const cls = draft.class ? getOrdemClass(draft.class) : undefined
    if (!cls) return []
    const stats = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft))
    const load = getLoadState(draft)

    const out: PlayStat[] = [
      { label: 'Defesa', value: `${stats.defense}` },
      {
        label: 'Limite de PE',
        value: `${getEffectivePeLimit(draft)}`,
        hint: 'Máximo de PE que dá pra gastar por turno',
      },
    ]
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

    const maxPe = getCursedDerivedStats(draft, cls, getModifiedDefenseBonus(draft)).pe
    const currentPe = currentOf(runtime, 'pe', maxPe)

    return [
      { id: 'attacks', label: 'Ataques', actions: buildAttacks(draft) },
      {
        id: 'rituals',
        label: 'Rituais',
        hint: `Conjurar desconta o PE automaticamente. Limite de ${getRitualPeLimit(draft)} PE por turno para rituais — mas o livro garante ao menos uma habilidade no custo mínimo por turno, então ele não bloqueia nada aqui (p. 21).`,
        actions: buildRituals(draft, currentPe),
      },
      {
        id: 'skills',
        label: 'Perícias',
        hint: 'Bônus condicional (só em certas situações) fica de fora do número e aparece na nota.',
        actions: buildSkills(draft),
      },
    ].filter(group => group.actions.length > 0)
  },
}

/**
 * Rituais conhecidos: os slots do Ocultista mais os concedidos por trilha, Aprender Ritual e
 * slots bônus. O custo sai de `getRitualCost`, que já aplica predileto, Mestre em Elemento,
 * Lâmina Maldita e Tatuagem Ritualística.
 */
function buildRituals(draft: OrdemCharacterDraft, currentPe: number): PlayAction[] {
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

  return [...fromSlots, ...granted].map(({ ritual, element, source }, i) => {
    const { cost, notes: costNotes } = getRitualCost(draft, ritual, element)
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

/** Ataques da ficha, já roláveis: pool, bônus, dano estruturado e margem de ameaça. */
function buildAttacks(draft: OrdemCharacterDraft): PlayAction[] {
  return getSheetWeaponAttacks(draft).map((attack, i) => ({
    id: `attack:${i}:${attack.name}`,
    name: attack.name,
    roll: {
      dice: attack.rollDice,
      mode: attack.rollMode,
      bonus: attack.attackBonus,
      label: formatPoolLabel({ dice: attack.rollDice, mode: attack.rollMode }, attack.attackBonus),
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
    notes: [...attack.dicePenaltyNotes, ...attack.notes],
  }))
}

/**
 * Todas as perícias roláveis. As "somente treinada" só entram se o personagem for treinado —
 * o livro não permite testá-las destreinado, então oferecer o botão seria mentir.
 */
function buildSkills(draft: OrdemCharacterDraft): PlayAction[] {
  const trained = new Set(getTrainedSkills(draft))
  const conditional = getConditionalSkillBonuses(draft)

  return SKILLS
    .filter(skill => !skill.trainedOnly || trained.has(skill.id))
    .map(skill => {
      const pool = getSkillDicePool(draft, skill.id)
      const bonus = getSkillBonusTotal(draft, skill.id)
      return {
        id: `skill:${skill.id}`,
        name: formatSkillWithAttribute(skill.id),
        roll: { dice: pool.dice, mode: pool.mode, bonus, label: formatPoolLabel(pool, bonus) },
        // Condicional NÃO entra no número: vale só em certas situações, e embutir enganaria o
        // teste. Vira nota, pro jogador somar quando a condição valer.
        notes: conditional
          .filter(b => b.skillIds.includes(skill.id))
          .map(b => `+${b.value} ${b.condition} (${b.source})`),
      }
    })
}

/** A ficha usa travessão/hífen pra "sem alcance" (corpo a corpo). */
function isRealRange(range: string): boolean {
  const trimmed = range.trim()
  return trimmed.length > 0 && !/^[–—-]$/.test(trimmed)
}

function formatPoolLabel(pool: { dice: number; mode: 'best' | 'worst' }, bonus: number): string {
  const base = formatDicePool(pool)
  if (bonus === 0) return base
  return `${base} ${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}`
}

export type { PlayRuntime }
