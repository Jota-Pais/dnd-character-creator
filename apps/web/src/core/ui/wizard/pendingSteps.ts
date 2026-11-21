/**
 * "Falta 1 etapa" / "Faltam 3 etapas" — texto do gate final, usado no painel de pendências
 * da Revisão e no aviso do rodapé. Igual nos dois sistemas.
 */
export function formatMissingCount(count: number): string {
  return count === 1 ? 'Falta 1 etapa' : `Faltam ${count} etapas`
}
