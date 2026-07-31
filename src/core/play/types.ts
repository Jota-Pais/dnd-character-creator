import type { RolledDie } from '../dice/dice'

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
}

export const EMPTY_RUNTIME: PlayRuntime = {
  resources: {},
  conditions: [],
  spent: {},
  notes: '',
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
  getStats(draft: unknown): PlayStat[]
  /** Uma linha curta de identificação: "Combatente · NEX 35% · Militar". */
  describeCharacter(draft: unknown): string
}

/** Lê o atual de uma trilha, tratando "nunca tocada" como cheia. */
export function currentOf(runtime: PlayRuntime, id: string, max: number): number {
  const value = runtime.resources[id]
  return value === undefined ? max : Math.max(0, Math.min(max, value))
}
