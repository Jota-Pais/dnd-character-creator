import type { SheetAction } from '@rpg/rules/systems/dnd5e/types/actions'
import type { ActiveToggle, PlaySheet, PlayState } from '@rpg/rules/systems/dnd5e/types/playState'
import type { SheetToggle } from '@rpg/rules/systems/dnd5e/types/session'
import { getSpell } from '@rpg/rules/systems/dnd5e/utils/spellUtils'

/** As ações que ligam e desligam o efeito (a Fúria: entrar e encerrar), pelo que elas causam. */
export function togglingActions(sheet: PlaySheet, id: string): { on?: SheetAction; off?: SheetAction } {
  const causes = (kind: 'toggleOn' | 'toggleOff') =>
    sheet.actions.find(a => a.outcomes.some(o => o.kind === kind && o.toggle === id))
  return { on: causes('toggleOn'), off: causes('toggleOff') }
}

/**
 * Os efeitos que a seção Efeitos ativos mostra: os que uma ação da ficha liga (a Fúria) e os que
 * estão ligados. O do catálogo sem ação (a magia recebida) só aparece ligado; desligado, ele é
 * marcado pelo "Recebeu uma magia?".
 */
export function getShownToggles(state: PlayState, sheet: PlaySheet): SheetToggle[] {
  return sheet.toggles.filter(t => togglingActions(sheet, t.id).on || state.activeEffects.some(a => a.id === t.id))
}

/** As magias do catálogo que se marcam como recebidas (`getCatalogToggles`), na ordem dele. */
export function getReceivableToggles(sheet: PlaySheet): SheetToggle[] {
  return sheet.toggles.filter(t => t.spellId !== undefined)
}

/** "1º nível · Concentração, até 1 minuto": o nível e a duração da magia, de `spells.json`. */
export function describeSpellBrief(toggle: SheetToggle): string {
  const spell = toggle.spellId ? getSpell(toggle.spellId) : undefined
  if (!spell) return ''
  const duration = spell.duration.charAt(0).toUpperCase() + spell.duration.slice(1)
  const concentration = spell.concentration && !/concentra/i.test(spell.duration) ? 'Concentração, ' : ''
  return `${spell.level}º nível · ${concentration}${concentration ? spell.duration : duration}`
}

/**
 * Quando a magia recebida acaba, em linhas para o cartão dela: quem mantém a concentração (você,
 * e ela acaba junto; ou quem conjurou, e o jogador marca o fim), o início do seu próximo turno (o
 * app não conta turnos) e o que vem ao acabar (a letargia da Velocidade).
 */
export function describeReceivedEnd(toggle: SheetToggle, active: ActiveToggle | undefined): string[] {
  const lines: string[] = []
  if (toggle.spellId) lines.push(`Duração: ${describeSpellBrief(toggle).replace(/^\d+º nível · /, '').toLowerCase()}.`)
  if (active?.sustainedByConcentration) lines.push('Mantida pela sua concentração: acaba junto com ela.')
  else if (toggle.concentration) lines.push('Quem conjurou mantém a concentração: quando ela acabar, toque em “Já acabou”.')
  if (toggle.endsOn.includes('startOfYourTurn')) lines.push('Acaba no início do seu próximo turno: toque em “Já acabou”.')
  if (toggle.onEnd) lines.push(`Ao acabar: ${toggle.onEnd.notice}.`)
  return lines
}
