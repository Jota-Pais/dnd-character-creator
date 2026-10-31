import type { CharacterDraft } from '../types/character'
import type { ActionDeclaration, ActionGroup, ActionTiming, SheetAction } from '../types/actions'
import combatActionsData from '../data/combat-actions.json'
import { getTwoWeaponFighting } from './attackUtils'
import { getFeat } from './featUtils'
import { getManeuver } from './maneuverUtils'
import {
  canCastSpells, getFeatSelectionsByFeat, getOwnedClassFeatures, getOwnedFeats, getOwnedProgressionOptions, getOwnedRacialTraits,
} from './sheetEffects'

/**
 * As ações da ficha: o que o personagem pode fazer no turno, com o custo e o que causam. Lista
 * montada uma vez só, aqui — a aba Ações e as operações de jogo (`performAction`) leem a mesma,
 * pelo `PlaySheet.actions`; nenhuma ação é montada em componente.
 */

/**
 * As ações em combate que todo personagem tem (págs. 192-197, `docs/regras-acoes-em-combate.md`):
 * Atacar, Conjurar uma Magia, Disparada, Desengajar, Esquivar, Ajudar, Esconder, Preparar, Procurar,
 * Usar um Objeto, o agarrão e o encontrão (dentro de Atacar), o ataque de oportunidade, o ataque com
 * a outra mão, Levantar-se e Interagir com um objeto. Dados, com o resumo do livro: não há a
 * característica que dá o texto.
 */
export const COMBAT_ACTIONS = combatActionsData as ActionDeclaration[]

/**
 * As partes da tela para onde uma ação leva (`ActionDeclaration.links`), além das jogadas do guia:
 * os ataques (na própria aba Ações), a aba Magia e a Bolsa da aba Estado (Usar um Objeto: a poção, o
 * ácido, o kit; onda `inventario`).
 */
export const ACTION_DESTINATIONS = ['attacks', 'spellbook', 'bag'] as const

/** A origem das ações em combate, onde a tela diria quem dá a ação. */
const COMBAT_ACTIONS_SOURCE = 'Ações em combate'

/**
 * A ação que a ficha cumpre (o ataque com a outra mão só com o par de armas do combate com duas
 * armas carregado — as leves corpo a corpo, ou as de uma mão com o Ambidestro —,
 * `getTwoWeaponFighting`, a mesma pergunta da nota da linha de ataque; Conjurar uma Magia só para
 * quem conjura). O que depende do estado (estar Caído, em fúria) fica para o jogo.
 */
function sheetMeets(draft: CharacterDraft, action: ActionDeclaration): boolean {
  if (action.requires === 'twoWeaponFighting') return getTwoWeaponFighting(draft).carriesTwo
  if (action.requires === 'spellcaster') return canCastSpells(draft)
  return true
}

/**
 * As ações da ficha: Atacar, a mais comum; depois as das características, que são do personagem; e
 * as outras ações em combate que a ficha cumpre (`COMBAT_ACTIONS`). Na aba, cada grupo segue esta
 * ordem: a Fúria vem antes do ataque com a outra mão. Cada uma com quem a dá e o texto do "?" (o
 * resumo da ação ou, sem ele, o de quem a dá):
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
  const [attack, ...standard] = COMBAT_ACTIONS
    .filter(action => sheetMeets(draft, action))
    .map(action => ({ ...action, source: COMBAT_ACTIONS_SOURCE, description: action.summary ?? '', standard: true as const }))
  const out: SheetAction[] = [attack]
  const add = (declarations: readonly ActionDeclaration[] | undefined, source: string, description: string) => {
    for (const action of declarations ?? []) {
      if (!out.some(o => o.id === action.id) && !standard.some(o => o.id === action.id) && sheetMeets(draft, action)) {
        out.push({ ...action, source, description: action.summary ?? description })
      }
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
  return [...out, ...standard]
}

/** O grupo da aba Ações de cada momento: livre, movimento e especial ficam em Outras. */
export function getActionGroup(timing: ActionTiming): ActionGroup {
  return timing === 'action' || timing === 'bonusAction' || timing === 'reaction' ? timing : 'other'
}

/**
 * A ação tem o "Usar": marca uma casa do turno (ação, ação bônus, reação, movimento), gasta ou causa
 * algo. O agarrão e o encontrão, feitos dentro de Atacar, a interação livre, que não custa nada, e
 * Conjurar uma Magia, feita pelo Conjurar do grimório (`via`), não têm.
 */
export function hasUse(action: ActionDeclaration): boolean {
  if (action.partOf || action.via) return false
  const marksTurn = action.timing === 'action' || action.timing === 'bonusAction' || action.timing === 'reaction' || action.timing === 'movement'
  return marksTurn || (action.cost?.length ?? 0) > 0 || (action.outcomes?.length ?? 0) > 0
}

/** Os grupos na ordem do turno: Ação, Ação Bônus, Reação e Outras. */
export const ACTION_GROUPS: readonly ActionGroup[] = ['action', 'bonusAction', 'reaction', 'other']

/** As ações separadas por grupo, na ordem em que vieram. Todo grupo existe, mesmo vazio. */
export function groupActionsByTiming<T extends { timing: ActionTiming }>(actions: readonly T[]): Record<ActionGroup, T[]> {
  const groups: Record<ActionGroup, T[]> = { action: [], bonusAction: [], reaction: [], other: [] }
  for (const action of actions) groups[getActionGroup(action.timing)].push(action)
  return groups
}
