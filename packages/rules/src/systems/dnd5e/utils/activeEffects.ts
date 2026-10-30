import type { CharacterDraft } from '../types/character'
import type { ActiveToggle, PlayState } from '../types/playState'
import type { ResolvedToggle, SheetSession, SheetToggle } from '../types/session'
import { getSheetToggles } from './sheetEffects'

/**
 * Os efeitos ligados do estado de jogo, resolvidos contra a ficha: o que cada um faz AGORA. Uma
 * função só para a tela e para as operações — as operações leem os efeitos do `PlaySheet`
 * (`sheet.toggles`), a tela e o guia de rolagens os da ficha (`getSheetSession`), e os dois são o
 * mesmo `getSheetToggles`.
 */

/**
 * O que vale agora de cada efeito ligado: os efeitos de sempre, os benefícios que o equipamento
 * deixa (a Fúria de Placas liga, mas fica com `blockedBy` e sem eles; o Urso, sem cláusula de
 * armadura, vale assim mesmo) e os da opção escolhida ao ligar (o Frenesi). Efeito que a ficha não
 * tem mais (a característica saiu no criador) fica de fora — a reconciliação o tira do estado.
 */
export function resolveActiveEffects(active: readonly ActiveToggle[], toggles: readonly SheetToggle[]): ResolvedToggle[] {
  return active.flatMap(a => {
    const t = toggles.find(o => o.id === a.id)
    if (!t) return []
    const option = a.option ? t.options.find(o => o.id === a.option) : undefined
    const blocked = t.benefits.find(b => b.blockedBy)
    return [{
      id: t.id, label: t.label, source: t.source, page: t.page,
      effects: [
        ...t.effects,
        ...t.benefits.filter(b => !b.blockedBy).flatMap(b => b.effects),
        ...(option ? (option.effects ?? []).map(effect => ({ source: option.source, effect })) : []),
      ],
      ...(blocked?.blockedBy ? { blockedBy: blocked.blockedBy } : {}),
      ...(option ? { option } : {}),
    }]
  })
}

/**
 * A sessão para as funções da ficha, derivada do estado de jogo — a porta de quem já recebe o
 * estado (o guia de rolagens, o da concentração, a tela). A Revisão e o PDF não a têm.
 */
export function getSheetSession(draft: CharacterDraft, state: PlayState): SheetSession {
  return { active: resolveActiveEffects(state.activeEffects, getSheetToggles(draft)) }
}
