import type { RollRecord } from '../../../core/dice'
import type { SheetResource } from '../utils/classResourceUtils'
import type { ConditionId, ExhaustionLevel, ImmuneDamageType } from './condition'
import type { AbilityScore } from './race'

/**
 * Estado de jogo do D&D 5e: a ficha viva de UM personagem. Guarda só o GASTO e o estado de sessão;
 * tudo que é máximo vem do `PlaySheet`, derivado da ficha na hora. A ficha (`CharacterDraft`) nunca
 * é reescrita em jogo — as funções de `utils/playState.ts` recebem (estado, PlaySheet) e nunca o
 * draft. Regras em `docs/regras-descanso.md`, `docs/regras-dano-e-morte.md`,
 * `docs/regras-condicoes.md` e `docs/regras-rolagens-e-concentracao.md` (Notas de implementação).
 *
 * JSON puro: sem funções nem classes, para ir direto ao localStorage e ao export.
 */

/** Versão do formato do `PlayState`. Subir quando o formato mudar de um jeito incompatível. */
export const PLAY_STATE_VERSION = 1

/**
 * Teto do histórico de rolagens guardado no estado: as 100 mais recentes. Uma sessão longa de
 * combate passa de 50 rolagens, e 100 registros (cada um com poucos dados) ficam na casa das
 * dezenas de KB — longe do limite do localStorage mesmo com várias fichas.
 */
export const ROLL_HISTORY_LIMIT = 100

/** Teto da nota de duração de uma condição: uma linha curta, não um diário. */
export const CONDITION_NOTE_MAX_LENGTH = 120

/** Tipos de Dado de Vida das classes do PHB 2014 (d6 feiticeiro/mago … d12 bárbaro). */
export const HIT_DIE_SIZES = [6, 8, 10, 12] as const

/** `dying` = 0 PV fazendo testes contra a morte; `stable` = 0 PV sem testar (págs. 199-200). */
export type LifeState = 'conscious' | 'dying' | 'stable' | 'dead'

export type DeathSaveCount = 0 | 1 | 2 | 3

export type DeathSaves = { successes: DeathSaveCount; failures: DeathSaveCount }

/** Magia (ou efeito) em que o personagem se concentra. `spellId` quando vem de `spells.json`. */
export type Concentration = {
  spellId?: string
  label: string
  /** Momento em que começou, em ms desde a época (mesma unidade de `RollRecord.at`). */
  startedAt: number
}

export type PlayState = {
  version: number
  /** Id da ficha na biblioteca (`SavedCharacter.id`). */
  characterId: string
  /** Última gravação, em ms desde a época. Carimbado por `playStorage`. */
  updatedAt: number

  /**
   * PV perdidos, medidos contra o máximo BASE (o da ficha + `maxHpAdjustment`, antes da exaustão):
   * PV atual = max(0, máx. base − damageTaken).
   */
  damageTaken: number
  /**
   * Ajuste temporário do PV máximo, positivo ou negativo: a magia Ajuda (+5 no máximo e no atual,
   * pág. 215). Soma ao máximo da ficha antes do corte da Exaustão 4; zera no descanso longo.
   */
  maxHpAdjustment: number
  /** Reserva à parte; pode passar do máximo e não some ao cair a 0 PV. */
  tempHp: number
  lifeState: LifeState
  deathSaves: DeathSaves

  /** Dados de Vida gastos POR TIPO de dado: `{ 10: 2, 8: 1 }`. */
  hitDiceSpent: Record<number, number>
  /** Espaços do pool combinado gastos por nível (9 posições, índice 0 = 1º nível). */
  spellSlotsSpent: number[]
  /** Espaços de Magia de Pacto gastos (separados do pool; voltam no descanso curto). */
  pactSlotsSpent: number
  /** Usos gastos de cada recurso, pelo `id` estável do `SheetResource`. Ilimitado não entra. */
  resourcesSpent: Record<string, number>

  /**
   * Condições gravadas (manuais, mais o Caído deixado pela queda a 0 PV). O Inconsciente dos 0 PV
   * NÃO entra aqui: é derivado do `lifeState` (`regras-condicoes.md`, 6.4).
   */
  conditions: ConditionId[]
  /**
   * Nota de duração de cada condição gravada, em texto livre ("até o fim do próximo turno do
   * mago"): o app não conta tempo. Só de condição em `conditions`; sai junto com ela.
   */
  conditionNotes?: Partial<Record<ConditionId, string>>
  exhaustionLevel: ExhaustionLevel

  concentration: Concentration | null
  /** Inspiração do PHB 2014: tem ou não tem (pág. 127). */
  inspiration: boolean
  /** Anotação livre do jogador. */
  note: string
  /** Rolagens, da mais antiga para a mais recente, no máximo `ROLL_HISTORY_LIMIT`. */
  rolls: RollRecord[]
  /** Data real do último descanso longo, só para histórico (o app não conta o tempo do jogo). */
  lastLongRestAt?: number
  /**
   * Os números da ficha na última abertura do jogo (`syncSheetSnapshot`): é por ele que o app
   * percebe quando uma correção dele mudou a ficha salva, e avisa (decisão 10.2.23).
   */
  sheetSnapshot?: SheetSnapshot
}

/**
 * Retrato dos números da ficha que mais pesam na mesa (`utils/sheetSnapshot.ts`), com o que diz
 * se a ficha mudou desde então: a data da gravação e a impressão digital do draft.
 */
export type SheetSnapshot = {
  /** `SavedCharacter.updatedAt` da ficha no momento do retrato. */
  sheetUpdatedAt: number
  /** `jsonFingerprint` do draft no momento do retrato. */
  draftFingerprint: string
  maxHp: number
  armorClass: number
  /** A CD e o ataque de cada conjuração, pela chave do guia (`class:<id>`, `feat:<id>`). */
  spellcasting: SheetSnapshotSpellcasting[]
  /** Espaços do pool combinado por nível (9 posições). */
  spellSlots: number[]
  pactSlots: { slots: number; slotLevel: number } | null
}

export type SheetSnapshotSpellcasting = { key: string; label: string; saveDc: number; attackBonus: number }

/**
 * Os números da ficha que o jogo usa, derivados do `CharacterDraft` pelas funções que já existem
 * (`utils/playSheet.ts → buildPlaySheet`). Snapshot puro: o jogo lê daqui e nunca do draft.
 */
export type PlaySheet = {
  /** PV máximo da ficha (`getTotalHp`), sem exaustão. */
  maxHp: number
  abilityScores: Record<AbilityScore, number>
  abilityModifiers: Record<AbilityScore, number>
  conModifier: number
  proficiencyBonus: number
  /** Bônus de cada teste de resistência: modificador + proficiência quando houver. */
  savingThrows: Record<AbilityScore, { bonus: number; proficient: boolean }>
  /** Iniciativa: mod. de Destreza + bônus da ficha (Alerta, Versatilidade). */
  initiativeBonus: number
  /** Deslocamento da ficha em pés, já com os bônus (Mobilidade). */
  speed: number
  /** Poço de Dados de Vida por tipo, do maior pro menor (`getHitDicePool`). */
  hitDice: { die: number; count: number }[]
  /** Pool combinado (`getCombinedSpellSlots`), 9 posições. */
  spellSlots: number[]
  /** Magia de Pacto (`getPactSlots`), ou null sem bruxo. */
  pactSlots: { slots: number; slotLevel: number } | null
  /** Recursos de classe, raça e talento (`getSheetResources`). */
  resources: SheetResource[]
  /** Talentos possuídos, para os avisos do que ainda não está automatizado. */
  featIds: string[]
  /**
   * A característica que impede reduzir o PV máximo (Acostumado à Morte-Vida), pelo nome
   * (`getHpMaxReductionImmunity`). Presente, a Exaustão 4 não corta o máximo.
   */
  hpMaxReductionImmunity?: string
  /**
   * O traço que deixa ficar com 1 PV em vez de cair a 0 (Resistência Implacável do meio-orc,
   * pág. 41): o recurso que ele gasta e o nome (`getDropToOneHp`).
   */
  dropToOneHp?: { resourceId: string; source: string }
}

/** Um evento de dano, como a tela o informa (`applyDamage`). */
export type DamageInput = {
  /** Dano total do evento, já com os modificadores (o app não soma parcelas aqui). */
  amount: number
  /** O personagem tem resistência a este dano (metade, arredondada para baixo). */
  resisted?: boolean
  /** Dano de acerto crítico: a 0 PV conta 2 fracassos. */
  critical?: boolean
  /** O atacante escolheu nocautear (só ataque corpo-a-corpo, pág. 200). */
  knockout?: boolean
  /**
   * O tipo do dano, quando a tela o pergunta: só para as imunidades das condições (Petrificado:
   * veneno vira 0). Sem ele, nenhuma imunidade se aplica.
   */
  damageType?: ImmuneDamageType
}

export type PlayNoticeKind =
  /** A operação não foi feita; `text` diz por quê. O estado volta igual. */
  | 'refused'
  /** O livro não decide o caso: o app não chuta e avisa. */
  | 'unresolvedRule'
  | 'info'
  | 'warning'
  | 'resisted'
  | 'tempHpAbsorbed'
  | 'healed'
  | 'hitDie'
  | 'hpCut'
  | 'concentrationCheck'
  | 'concentrationEnded'
  | 'concentrationReplaced'
  | 'fellUnconscious'
  /**
   * Caiu a 0 PV, mas um traço deixa ficar com 1 PV (Resistência Implacável): o aviso traz o dano
   * (`damage`) para a tela desfazer e reaplicá-lo com `applyDamageDroppingToOneHp`.
   */
  | 'dropToOneHp'
  | 'droppedItems'
  | 'deathSaveSuccess'
  | 'deathSaveFailure'
  | 'stabilized'
  | 'lostStability'
  | 'regainedConsciousness'
  | 'died'
  | 'recovered'
  /** Uma correção do app mudou números da ficha salva desde a última sessão (decisão 10.2.23). */
  | 'sheetCorrected'

/**
 * Aviso para a UI. `dc` acompanha o `concentrationCheck`; `damage`, o `dropToOneHp` (o mesmo dano,
 * para reaplicar terminando em 1 PV).
 */
export type PlayNotice = { kind: PlayNoticeKind; text: string; dc?: number; damage?: DamageInput }

/** O que toda operação de jogo devolve: o estado novo e os avisos. */
export type PlayResult = { state: PlayState; notices: PlayNotice[] }
