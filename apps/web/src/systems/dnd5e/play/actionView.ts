import type { ActionTiming, SheetAction } from '@rpg/rules/systems/dnd5e/types/actions'
import type { PlaySheet, PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import { getResourceAvailable } from '@rpg/rules/systems/dnd5e/utils/playState'

/**
 * Como a tela escreve as ações: o momento e o custo com o saldo. A aba Ações e a seção Efeitos
 * ativos da aba Estado mostram o mesmo texto.
 */

/** O momento da ação, depois do nome dela ("ação bônus · gasta 1 Fúria — restam 2"). */
export const TIMING_LABEL: Record<ActionTiming, string> = {
  action: 'ação',
  bonusAction: 'ação bônus',
  reaction: 'reação',
  free: 'livre',
  movement: 'movimento',
  special: 'especial',
}

/** O custo e o saldo de quem usa: "gasta 1 Fúria — restam 2"; no 20º nível, "Fúria: usos ilimitados". */
export function describeActionCost(action: SheetAction, state: PlayState, sheet: PlaySheet): string[] {
  return (action.cost ?? []).flatMap(c => {
    const r = sheet.resources.find(x => x.id === c.resource)
    const available = getResourceAvailable(state, sheet, c.resource)
    if (!r || available === null) return []
    if (available === 'unlimited') return [`${r.name}: usos ilimitados`]
    return [`gasta ${c.amount} ${r.name} — ${available === 1 ? 'resta 1' : `restam ${available}`}`]
  })
}
