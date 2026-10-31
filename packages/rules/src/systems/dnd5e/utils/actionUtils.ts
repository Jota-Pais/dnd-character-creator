import type { CharacterDraft } from '../types/character'
import type { ActionDeclaration, ActionGroup, ActionTiming, SheetAction } from '../types/actions'
import { getFeat } from './featUtils'
import { getManeuver } from './maneuverUtils'
import {
  getFeatSelectionsByFeat, getOwnedClassFeatures, getOwnedFeats, getOwnedProgressionOptions, getOwnedRacialTraits,
} from './sheetEffects'

/**
 * As ações da ficha: o que o personagem pode fazer no turno, com o custo e o que causam. Lista
 * montada uma vez só, aqui — a aba Ações e as operações de jogo (`performAction`) leem a mesma,
 * pelo `PlaySheet.actions`; nenhuma ação é montada em componente.
 */

/**
 * As ações das características, cada uma com quem a dá e o texto do "?" (o resumo da ação ou, sem
 * ele, o de quem a dá):
 * - das features de classe e subclasse, no nível NA classe dona (Guerreiro 1 / Mago 4 não tem o
 *   Surto de Ação do guerreiro 2);
 * - dos talentos e dos traços raciais, no nível de personagem;
 * - das opções escolhidas em slot de progressão (manobras, invocações, disciplinas) — a que perdeu
 *   o pré-requisito de opção não vale, como nos outros efeitos (`getOwnedProgressionOptions`) —, e
 *   das manobras do talento (Adepto Marcial).
 *
 * O mesmo id vale uma vez: a mesma característica de duas classes não dá a ação duas vezes.
 */
export function getSheetActions(draft: CharacterDraft): SheetAction[] {
  const out: SheetAction[] = []
  const add = (declarations: readonly ActionDeclaration[] | undefined, source: string, description: string) => {
    for (const action of declarations ?? []) {
      if (!out.some(o => o.id === action.id)) out.push({ ...action, source, description: action.summary ?? description })
    }
  }
  for (const feature of getOwnedClassFeatures(draft)) add(feature.effects?.actions, feature.name, feature.description)
  for (const feat of getOwnedFeats(draft)) add(feat.effects?.actions, feat.name, feat.description)
  for (const trait of getOwnedRacialTraits(draft)?.traits ?? []) add(trait.effects?.actions, trait.name, trait.description)
  for (const { slot, option } of getOwnedProgressionOptions(draft)) {
    add(option.effects?.actions, `${slot.label} — ${option.name}`, option.description ?? '')
  }
  for (const { featId, ids } of getFeatSelectionsByFeat(draft, 'maneuvers')) {
    const feat = getFeat(featId)
    for (const id of ids) {
      const maneuver = getManeuver(id)
      if (maneuver) add(maneuver.effects?.actions, `${feat?.name ?? featId} — ${maneuver.name}`, maneuver.description ?? '')
    }
  }
  return out
}

/** O grupo da aba Ações de cada momento: livre, movimento e especial ficam em Outras. */
export function getActionGroup(timing: ActionTiming): ActionGroup {
  return timing === 'action' || timing === 'bonusAction' || timing === 'reaction' ? timing : 'other'
}

/** Os grupos na ordem do turno: Ação, Ação Bônus, Reação e Outras. */
export const ACTION_GROUPS: readonly ActionGroup[] = ['action', 'bonusAction', 'reaction', 'other']

/** As ações separadas por grupo, na ordem em que vieram. Todo grupo existe, mesmo vazio. */
export function groupActionsByTiming<T extends { timing: ActionTiming }>(actions: readonly T[]): Record<ActionGroup, T[]> {
  const groups: Record<ActionGroup, T[]> = { action: [], bonusAction: [], reaction: [], other: [] }
  for (const action of actions) groups[getActionGroup(action.timing)].push(action)
  return groups
}
