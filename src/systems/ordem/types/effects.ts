/**
 * Efeitos compartilhados pelas 4 famílias de habilidade (origem, classe, trilha e poder
 * paranormal). Ficam aqui, e não em cada `*Effects`, pra não divergirem — o agregador da ficha
 * lê todos pelo mesmo formato (ver `getSheetSkillBonuses`).
 */

/**
 * Bônus fixo em perícias que só vale numa situação específica (ex.: Hacker +5 em Tecnologia
 * "para invadir sistemas"). NÃO entra no total da perícia na ficha — seria errado somar +5 em
 * todo teste de Tecnologia —, aparece como linha própria com a condição.
 *
 * Bônus INCONDICIONAL usa `skillBonus: Record<skillId, valor>`, que soma direto na perícia.
 */
export type ConditionalSkillBonus = {
  /** Ids das perícias que recebem o bônus. */
  skills: string[]
  value: number
  /** Condição do livro, em português, pra exibir junto do número (ex.: "para invadir sistemas"). */
  condition: string
}
