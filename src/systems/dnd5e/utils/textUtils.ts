/**
 * Concordância de número nos textos da tela: "1 disponível" / "2 disponíveis", sem o "(s)" de
 * formulário. A palavra vai no singular só com exatamente 1.
 */
export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

/** O número com a palavra concordando: "1 Dado de Vida", "3 Dados de Vida". */
export function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${pluralize(n, singular, plural)}`
}
