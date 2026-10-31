import type { ActiveEffect, EquipmentRequirement, ToggleEnd, ToggleOption, ZeroHpSave } from './effects'
import type { ArmorCategory } from './equipment'

/**
 * A sessão de jogo como as funções da ficha a enxergam: os efeitos ligados agora, já resolvidos.
 * Mora à parte de `types/playState.ts` porque `sheetEffects` a recebe, e o estado de jogo importa
 * de `sheetEffects` (as defesas do `PlaySheet`): assim não há ciclo.
 *
 * Duas portas, sem conta paralela: quem já recebe o estado de jogo deriva a sessão dele
 * (`getSheetSession`: o guia de rolagens, o da concentração); as funções só de ficha recebem a
 * sessão como parâmetro opcional, `NO_SESSION` por padrão — a Revisão e o PDF não passam nada e
 * continuam com a nota.
 *
 * A sessão leva também a armadura vestida (`worn`): trocada pela tela do jogo, ela muda a CA, o
 * deslocamento, as Artes Marciais, os benefícios da Fúria e os avisos de proficiência, pelas mesmas
 * funções da ficha.
 */

/** A armadura de corpo e o escudo, pelos ids do catálogo (`armors.json`): os do criador ou os vestidos no jogo. */
export type ArmorSetup = { bodyArmorId: string | null; shield: boolean }

/**
 * A armadura vestida pela tela do jogo (`PlayState.wornArmor`), quando difere da do criador, com a
 * base: a armadura e o escudo equipados no criador quando a troca foi feita. Com a base diferente
 * da de agora, o jogador mudou o equipamento no criador, e o criador manda.
 */
export type WornArmor = ArmorSetup & { basis: ArmorSetup }

/** Uma armadura ou escudo que o personagem carrega (o inventário da ficha), com a proficiência nela. */
export type CarriedArmor = { id: string; name: string; category: ArmorCategory; proficient: boolean }

/** Um efeito com quem o dá: a própria Fúria, ou quem a modifica ("Fúria Inconsciente", "Totem Espiritual — Urso"). */
export type SourcedActiveEffect = { source: string; effect: ActiveEffect }

/** Uma escolha de ligar com quem a dá (o Frenesi, do Caminho do Furioso). */
export type SheetToggleOption = ToggleOption & { source: string }

/**
 * Um efeito que se liga em jogo: o da ficha (`getSheetToggles`: a declaração da característica dona
 * com o que as outras acrescentam, `toggleModifiers`, já fundido, e a restrição de conjuração da
 * mesma situação como efeito de estado) ou o do catálogo (`getCatalogToggles`: a magia ou a ação
 * recebida).
 */
export type SheetToggle = {
  id: string
  label: string
  /** A característica que o declara ("Fúria"), a magia ("Bênção") ou a ação ("Esquivar"). */
  source: string
  page: number
  /** A magia do efeito do catálogo (`spells.json`): a duração e a concentração vêm dela. */
  spellId?: string
  /** A magia pede concentração de quem a conjura (`spells.json`). */
  concentration?: true
  /** Alcance Pessoal: só quem a conhece a tem, e ela é sempre conjurada por você (o Auxílio Divino). */
  selfOnly?: true
  /** A ficha conhece a magia (`getKnownSpells`): pode tê-la conjurado em si mesma. */
  known?: true
  /** O que vem quando ele acaba e o app não aplica (a letargia da Velocidade). */
  onEnd?: { notice: string }
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

export type SheetSession = {
  readonly active: readonly ResolvedToggle[]
  /** A armadura vestida agora; ausente, a equipada no criador. */
  readonly worn?: ArmorSetup
}

/** Sem estado de jogo: a ficha como a Revisão e o PDF a mostram. */
export const NO_SESSION: SheetSession = Object.freeze({ active: Object.freeze([]) })
