import type { ArmorProficiency } from './class'

/**
 * Efeitos mecânicos estruturados de uma característica — hoje só talentos, amanhã também traços
 * raciais e features de classe. Espelha `src/systems/ordem/types/effects.ts`.
 *
 * Só entra aqui o que é PERMANENTE e automático: o que o jogador ativa em jogo ("gaste um ponto
 * de sorte para...") fica só na descrição, porque a ficha não tem como aplicar sozinha.
 *
 * Regra de ouro, a mesma do Ordem: efeito INCONDICIONAL entra no número da ficha; efeito
 * CONDICIONAL vira linha própria com a condição — somar o +1 do Ambidestro na CA seria mentir,
 * já que ele só vale empunhando duas armas.
 */

/** Bônus de CA que só vale numa situação (ex.: Ambidestro, "empunhando duas armas"). */
export type ConditionalAcBonus = {
  value: number
  /** Condição do livro, em português, exibida junto do número. */
  condition: string
}

/**
 * Escolhas que o talento ABRE e que o jogador ainda precisa fazer. Viram slot na etapa dona do
 * talento (Raça, no Humano Variante; Aprimoramentos, nos espaços de ASI) — nunca um catálogo
 * aninhado dentro do card, que já é uma escolha.
 */
export type FeatureChoices = {
  /** Perito: "qualquer combinação de três perícias ou ferramentas" — os dois tipos no mesmo bolo. */
  skillOrToolChoice?: { count: number }
  /** Poliglota: três idiomas. */
  languageChoice?: { count: number }
  /** Mestre de Armas: quatro armas simples ou marciais. */
  weaponChoice?: { count: number }
  /**
   * Resiliente: proficiência no teste de resistência do atributo escolhido. Não é escolha nova —
   * reaproveita o atributo que já recebe o +1 do talento (`abilityIncrease`).
   */
  savingThrowFromAbilityChoice?: boolean
}

export type FeatureEffects = {
  /** Escolhas pendentes que o talento cria. */
  choices?: FeatureChoices
  /** Bônus fixo em iniciativa (Alerta: +5). */
  initiativeBonus?: number
  /** Bônus de deslocamento, em PÉS, a unidade em que a raça guarda (Mobilidade: +10 pés = +3 m). */
  speedBonus?: number
  /**
   * PV extras por nível de personagem (Robusto: +2). O livro soma 2 × nível ao adquirir e mais 2
   * a cada nível seguinte — o efeito acumulado é sempre 2 × nível, então basta o valor por nível.
   */
  hpPerLevel?: number
  /** Bônus nos valores PASSIVOS destas perícias (Observador: +5 em Percepção e Investigação). */
  passiveScoreBonus?: { skills: string[]; value: number }
  /** Bônus de CA condicionais — nunca somados no total da ficha. */
  conditionalAcBonus?: ConditionalAcBonus[]
  /** Proficiências de armadura concedidas (Proteção Leve / Moderada / Pesada). */
  grantedArmorProficiencies?: ArmorProficiency[]
  /**
   * Versatilidade (bardo 2): metade do bônus de proficiência, arredondada para baixo, em todo
   * TESTE DE HABILIDADE que ainda não tenha o bônus — perícia sem proficiência, iniciativa, teste
   * de atributo puro. Não vale para resistência nem ataque.
   */
  halfProficiencyOnChecks?: boolean
}
