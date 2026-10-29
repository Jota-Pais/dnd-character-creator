export type OrdemPatenteId =
  | 'recruta'
  | 'operador'
  | 'agente-especial'
  | 'oficial-operacoes'
  | 'agente-elite'

export type OrdemPatente = {
  id: OrdemPatenteId
  name: string
  /** Pontos de Prestígio necessários (referência; não usados na criação). */
  pp: number
  /** Limite de crédito (Baixo/Médio/Alto/Ilimitado) — informativo, não mecanizado. */
  credit: string
  /** Limite de itens por categoria: índice 0 = Categoria I, 1 = II, 2 = III, 3 = IV. Categoria 0 é ilimitada. */
  categoryLimits: [number, number, number, number]
}
