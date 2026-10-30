import type { SheetAction } from '@rpg/rules/systems/dnd5e/types/actions'
import type { PlaySheet, PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import type { SheetToggle } from '@rpg/rules/systems/dnd5e/types/session'

/** As ações que ligam e desligam o efeito (a Fúria: entrar e encerrar), pelo que elas causam. */
export function togglingActions(sheet: PlaySheet, id: string): { on?: SheetAction; off?: SheetAction } {
  const causes = (kind: 'toggleOn' | 'toggleOff') =>
    sheet.actions.find(a => a.outcomes.some(o => o.kind === kind && o.toggle === id))
  return { on: causes('toggleOn'), off: causes('toggleOff') }
}

/**
 * Os efeitos que a seção Efeitos ativos mostra: os que uma ação da ficha liga (a Fúria) e os que
 * estão ligados. O do catálogo sem ação (a magia recebida) só aparece ligado.
 */
export function getShownToggles(state: PlayState, sheet: PlaySheet): SheetToggle[] {
  return sheet.toggles.filter(t => togglingActions(sheet, t.id).on || state.activeEffects.some(a => a.id === t.id))
}
