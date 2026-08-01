import type { DamageSpec, RolledDie } from '../dice/dice'

/**
 * Modelo do modo de jogo (ficha viva), agnóstico de sistema.
 *
 * Princípio central: **a ficha é imutável durante o jogo**. Nada aqui escreve no draft. O estado
 * de sessão é uma camada por cima — jogar nunca danifica um personagem, e dá pra zerar a sessão
 * sem perder nada da ficha.
 */

/** Uma trilha de recurso consumível na sessão: PV, PE e Sanidade no Ordem; PV no D&D. */
export type ResourceTrack = {
  id: string
  /** Nome por extenso, para leitor de tela e tooltip. */
  label: string
  /** Sigla exibida na barra: "PV", "PE", "SAN". */
  short: string
  current: number
  max: number
  /** Tom semântico; a UI mapeia para cor. */
  tone: 'vitality' | 'effort' | 'sanity'
  /**
   * Limiar destacado na barra. No Ordem, **machucado** abaixo de metade dos PV — sem penalidade
   * própria, mas é pré-requisito de habilidades, então o jogador precisa ver.
   */
  threshold?: { at: number; label: string }
}

/** O que muda durante a sessão. Tudo que não estiver aqui vem da ficha, calculado. */
export type PlayRuntime = {
  /** Valor atual por trilha, por id. Chave ausente significa cheia. */
  resources: Record<string, number>
  /** Ids das condições ativas (ver docs/ordem-paranormal/regras-condicoes.md). */
  conditions: string[]
  /** Consumíveis gastos: munição por id, usos por habilidade. */
  spent: Record<string, number>
  notes: string
  /** Turnos iniciados na cena atual. */
  turn: number
  /** Número da cena. Só serve pra saber se um uso "por cena" foi nesta ou numa anterior. */
  scene: number
  /**
   * Turnos iniciados **morrendo** na cena atual, não precisando ser consecutivos. O contador é
   * da cena: cena nova zera. Quantos matam é regra do sistema (ver `getDyingState`).
   */
  dyingTurns: number
  /**
   * Estabilizado por Medicina (DT 20): continua em 0 PV, mas não morre mais. Curar PV **não**
   * estabiliza — remove a inconsciência e só (Cap. 4, p. 87).
   */
  stabilized: boolean
  dead: boolean
}

export const EMPTY_RUNTIME: PlayRuntime = {
  resources: {},
  conditions: [],
  spent: {},
  notes: '',
  turn: 0,
  scene: 1,
  dyingTurns: 0,
  stabilized: false,
  dead: false,
}

/** Estado de morte iminente, resolvido pelo sistema. */
export type DyingState = {
  dying: boolean
  /** Turnos já iniciados morrendo nesta cena. */
  turnsStarted: number
  /** Em quantos turnos iniciados o personagem morre. */
  limit: number
  dead: boolean
  /** DT do teste que estabiliza, e a perícia. */
  stabilizeCheck: { skillId: string; skillName: string; dt: number }
}

/** Qualidade do descanso, na escala do livro. */
export type RestQuality = 'poor' | 'normal' | 'comfortable' | 'luxurious'

export type RestOption = {
  id: string
  label: string
  /** O que recupera, por trilha, já com o multiplicador de qualidade aplicado. */
  recovery: { resourceId: string; amount: number }[]
  hint?: string
}

export type LogKind = 'roll' | 'damage' | 'heal' | 'rest' | 'note'

/** Uma linha do histórico. É o que substitui o rascunho no papel. */
export type LogEntry = {
  id: string
  at: number
  kind: LogKind
  title: string
  /** Linha de apoio: a fórmula, o motivo, o alvo. */
  detail?: string
  total?: number
  dice?: RolledDie[]
}

export type PlaySession = {
  systemId: string
  characterId: string
  /** Nome no momento em que a sessão começou — a ficha pode ser renomeada ou excluída depois. */
  characterName: string
  runtime: PlayRuntime
  log: LogEntry[]
  startedAt: number
  updatedAt: number
}

export function sessionKey(systemId: string, characterId: string): string {
  return `${systemId}:${characterId}`
}

/** Valor fixo da ficha exibido na mesa (Defesa, Deslocamento). Não é consumível. */
export type PlayStat = { label: string; value: string; hint?: string }

// ─────────────────────────────────────────────────────────────────────────────
// Ações jogáveis
// ─────────────────────────────────────────────────────────────────────────────

/** O teste principal de uma ação, pronto para o motor de dados. */
export type PlayRollSpec = {
  dice: number
  mode: 'best' | 'worst'
  bonus: number
  /** Como o pool aparece na UI: "3d20 +5", "4d20 pior". */
  label: string
}

export type PlayDamage = {
  spec: DamageSpec
  /** O dano como a ficha escreve: "1d12 balístico". */
  label: string
  /** Resultado a partir do qual o ataque é crítico. */
  threatMargin: number
  critMultiplier: number
}

/**
 * Um botão que a mesa aperta. O adaptador entrega tudo resolvido — inclusive **por que** está
 * bloqueado, porque esconder a opção deixa o jogador sem saber que ela existe.
 */
export type PlayAction = {
  id: string
  name: string
  /**
   * Ausente quando quem rola não é o personagem — num ritual, o teste é do alvo contra a DT.
   * A ação existe do mesmo jeito: ela consome recurso e entra no histórico.
   */
  roll?: PlayRollSpec
  /** Mostrado no lugar do pool quando não há teste próprio: "DT 14". */
  rollLabel?: string
  damage?: PlayDamage
  /** Linha de apoio: alcance, crítico, elemento. */
  detail?: string
  /** Avisos de regra que dependem da situação (arma sem apoio, sem proficiência). */
  notes?: string[]
  /** Recurso consumido ao usar. */
  cost?: { resourceId: string; amount: number; label: string }
  /**
   * Uso limitado por frequência. A UI grava `at` em `runtime.spent[key]` ao usar; o adaptador
   * compara com a cena/turno atual pra saber se ainda está disponível.
   */
  usage?: { key: string; at: number }
  /** Motivo de não poder usar agora. Ausente = liberada. */
  blocked?: string
}

export type PlayActionGroup = {
  id: string
  label: string
  hint?: string
  actions: PlayAction[]
}

/**
 * O que cada sistema precisa fornecer para ser jogável. Cresce a cada fase — hoje cobre carregar
 * a ficha, derivar as trilhas de recurso e os números fixos de consulta.
 */
export interface PlayAdapter {
  /** Resolve a ficha salva. `null` se ela sumiu (excluída no meio da sessão). */
  loadCharacter(characterId: string): { draft: unknown; name: string } | null
  /**
   * Trilhas de recurso: o máximo é derivado da ficha, o atual vem do runtime (ou é o máximo,
   * quando a trilha ainda não foi tocada).
   */
  getResources(draft: unknown, runtime: PlayRuntime): ResourceTrack[]
  /** Números que a mesa consulta o tempo todo mas não consome. */
  getStats(draft: unknown, runtime: PlayRuntime): PlayStat[]
  /** Uma linha curta de identificação: "Combatente · NEX 35% · Militar". */
  describeCharacter(draft: unknown): string
  /** Tudo que dá pra fazer, agrupado. Recebe o runtime porque disponibilidade depende dele. */
  getActions(draft: unknown, runtime: PlayRuntime): PlayActionGroup[]
  /**
   * Condições ativas: as marcadas pelo jogador mais as **derivadas do estado** (Machucado e
   * Morrendo saem dos PV, não da escolha). É esta lista que a UI mostra.
   */
  getConditions(draft: unknown, runtime: PlayRuntime): string[]
  /** Catálogo de condições do sistema, para a UI nomear, descrever e oferecer. */
  getConditionCatalog(): PlayCondition[]
  /** Ao receber uma condição de novo, qual resulta (agravamento). Identidade quando não escala. */
  escalateCondition(id: string, active: string[]): string
  /** Onde o personagem está na contagem regressiva pra morte. */
  getDyingState(draft: unknown, runtime: PlayRuntime): DyingState
  /** Opções de descanso e o quanto cada uma recupera, na qualidade escolhida. */
  getRestOptions(draft: unknown, quality: RestQuality): RestOption[]
}

export type PlayCondition = {
  id: string
  name: string
  description: string
  /** Ligada pelo motor a partir do estado; o jogador não escolhe nem remove. */
  derived?: boolean
  /**
   * Id da condição que resulta de receber esta de novo. Presente só nas que agravam — é o que
   * permite a UI continuar oferecendo uma condição já ativa, para o agravamento ser alcançável.
   */
  escalatesTo?: string
}

/** Lê o atual de uma trilha, tratando "nunca tocada" como cheia. */
export function currentOf(runtime: PlayRuntime, id: string, max: number): number {
  const value = runtime.resources[id]
  return value === undefined ? max : Math.max(0, Math.min(max, value))
}
