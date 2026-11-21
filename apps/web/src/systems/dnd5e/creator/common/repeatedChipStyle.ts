/**
 * Chip marcado com perícia ou ferramenta que outra fonte já dá (p. 125): segue marcado, em
 * vermelho e com "⚠", para o jogador desmarcar e trocar. O texto vai em RepeatedProficiencyNotes.
 * Para os chips que desenham a borda com `border` (classe, talento).
 */
export const REPEATED_CHIP_STYLE = {
  backgroundColor: 'rgba(192, 57, 43, 0.2)',
  color: '#e74c3c',
  border: '1px solid #c0392b',
} as const

/** O mesmo, para as opções que desenham a borda com `borderColor` (raça, antecedente). */
export const REPEATED_OPTION_STYLE = {
  backgroundColor: 'rgba(192, 57, 43, 0.2)',
  color: '#e74c3c',
  borderColor: '#c0392b',
} as const
