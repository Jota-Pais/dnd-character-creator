import type { BackgroundEquipment } from './equipment'

export type BackgroundToolChoice = {
  kind: 'tool-choice'
  count: number
  from: 'artisan' | 'musical-instrument' | 'gaming-set'
}

export type BackgroundLanguageChoice = {
  kind: 'language-choice'
  count: number
}

export type BackgroundChoice = BackgroundToolChoice | BackgroundLanguageChoice

export type BackgroundChoiceSelections = {
  languages?: string[]
  tools?: string[]
  /** Item escolhido em cada `item-choice` do equipamento do antecedente: key → id do item. */
  items?: Record<string, string>
}

/**
 * Tabela de detalhe do antecedente (Tramoia do charlatão, Especialidade do soldado…, cap. 4).
 * O dado é o tamanho da lista (d6, d8, d10, d20). É interpretação: a ficha só imprime a linha
 * pra preencher a lápis com as opções do livro — não entra no draft nem em validação.
 */
export type BackgroundDetailTable = {
  label: string
  options: string[]
  /** Instrução própria quando o livro foge do "escolha ou role" (ex.: Artista escolhe 1 a 3). */
  note?: string
}

export type Background = {
  id: string
  name: string
  description: string
  skillProficiencies: string[]
  toolProficiencies: string[]
  choices: BackgroundChoice[]
  feature: {
    name: string
    description: string
  }
  variant: string | null
  detailTable?: BackgroundDetailTable
  equipment: BackgroundEquipment
}
