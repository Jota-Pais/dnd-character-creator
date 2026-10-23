/**
 * Marcação inline do texto de regra (ver `RuleText`). Hoje só há uma: `**trecho**` = negrito.
 * A digitalização das magias usa `**Nome.**` para abrir cada opção ou subefeito (Aprimorar
 * Habilidade, Comando, Símbolo...), como o livro faz em negrito.
 *
 * Só trata pares na mesma linha: um `**` solto fica literal (e o teste de guarda dos dados,
 * em `data/__tests__/bookText.test.ts`, impede que isso chegue aos JSONs).
 */
export type InlineSegment = { text: string; bold: boolean }

/** Grupo de captura obrigatório: o `split` devolve o conteúdo dos pares nos índices ímpares. */
const BOLD_PAIR = /\*\*(.+?)\*\*/

/** Quebra uma linha em trechos comuns e em negrito, na ordem. Trechos vazios são descartados. */
export function parseInlineBold(line: string): InlineSegment[] {
  return line
    .split(BOLD_PAIR)
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter(segment => segment.text !== '')
}

/** Remove a marcação de negrito, mantendo o texto (prévias em texto corrido). */
export function stripInlineBold(line: string): string {
  return line.replace(new RegExp(BOLD_PAIR.source, 'g'), '$1')
}
