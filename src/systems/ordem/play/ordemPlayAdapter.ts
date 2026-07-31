import type { PlayAdapter, PlayRuntime, PlayStat, ResourceTrack } from '../../../core/play/types'
import { currentOf } from '../../../core/play/types'
import type { OrdemCharacterDraft } from '../types/character'
import { loadLibrary } from '../utils/storage'
import { getOrdemClass } from '../utils/classUtils'
import { getOrigin } from '../utils/originUtils'
import { getCursedDerivedStats } from '../utils/curseUtils'
import { getEffectivePeLimit } from '../utils/characterUtils'
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
}

export type { PlayRuntime }
