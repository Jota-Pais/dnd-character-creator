import type { AttributeId } from './attribute'

export type Skill = {
  id: string
  name: string
  attribute: AttributeId
  trainedOnly: boolean
  loadPenalty: boolean
  /**
   * Kit de perícia que esta perícia exige (p. 40). Ausente = a perícia não usa kit.
   *
   * O livro nomeia quatro: kit de ladrão (Crime), de disfarces (Enganação), de medicina (Medicina)
   * e de eletrônica (Tecnologia). A ficha registra qual kit o agente carrega, mas NÃO aplica o −5
   * de estar sem ele: quem decide se aquele teste específico exigia o kit é o mestre (o livro
   * amarra a exigência a USOS da perícia, não à perícia inteira, exceto em Medicina).
   */
  kit?: {
    /** Nome do kit no livro (ex.: "ladrão", "medicina"). */
    name: string
    /** Em que usos o kit é exigido, pra ficha explicar o escopo. */
    scope: string
  }
}
