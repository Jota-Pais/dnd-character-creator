import type { ActiveEffect, EquipmentRequirement, ToggleEnd, ToggleOption, ZeroHpSave } from './effects'

/**
 * A sessão de jogo como as funções da ficha a enxergam: os efeitos ligados agora, já resolvidos.
 * Mora à parte de `types/playState.ts` porque `sheetEffects` a recebe, e o estado de jogo importa
 * de `sheetEffects` (as defesas do `PlaySheet`): assim não há ciclo.
 *
 * Duas portas, sem conta paralela: quem já recebe o estado de jogo deriva a sessão dele
 * (`getSheetSession`: o guia de rolagens, o da concentração); as funções só de ficha recebem a
 * sessão como parâmetro opcional, `NO_SESSION` por padrão — a Revisão e o PDF não passam nada e
 * continuam com a nota.
 */

/** Um efeito com quem o dá: a própria Fúria, ou quem a modifica ("Fúria Inconsciente", "Totem Espiritual — Urso"). */
export type SourcedActiveEffect = { source: string; effect: ActiveEffect }

/** Uma escolha de ligar com quem a dá (o Frenesi, do Caminho do Furioso). */
export type SheetToggleOption = ToggleOption & { source: string }

/**
 * Um efeito que a ficha pode ligar (`getSheetToggles`): a declaração da característica dona com o
 * que as outras acrescentam (`toggleModifiers`) já fundido, e a restrição de conjuração da mesma
 * situação como efeito de estado.
 */
export type SheetToggle = {
  id: string
  label: string
  /** A característica que o declara ("Fúria"). */
  source: string
  page: number
  /** Valem sempre que ligado. */
  effects: SourcedActiveEffect[]
  /** Valem com o equipamento; `blockedBy` é o que o impede agora (a armadura pesada vestida). */
  benefits: { requires: EquipmentRequirement; effects: SourcedActiveEffect[]; blockedBy?: string }[]
  endsOn: ToggleEnd[]
  /** O lembrete do fim prematuro; ausente quando outra característica o tira (Fúria Persistente). */
  earlyEndReminder?: string
  options: SheetToggleOption[]
  /** O teste para ficar com 1 PV em vez de cair a 0, com quem o dá (a Fúria Implacável). */
  zeroHpSave?: ZeroHpSave & { source: string }
}

/** Um efeito ligado no estado e o que ele faz agora (`resolveActiveEffects`). */
export type ResolvedToggle = {
  id: string
  label: string
  source: string
  page: number
  /** Os efeitos em vigor: os de sempre e os benefícios que o equipamento deixa. */
  effects: SourcedActiveEffect[]
  /** Ligado, mas sem os benefícios: o que os impede agora ("Placas"). */
  blockedBy?: string
  /** A escolha feita ao ligar (o Frenesi). */
  option?: SheetToggleOption
}

export type SheetSession = { readonly active: readonly ResolvedToggle[] }

/** Sem estado de jogo: a ficha como a Revisão e o PDF a mostram. */
export const NO_SESSION: SheetSession = Object.freeze({ active: Object.freeze([]) })
