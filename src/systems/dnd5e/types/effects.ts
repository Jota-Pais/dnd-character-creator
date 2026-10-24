import type { ArmorProficiency } from './class'
import type { AbilityScore } from './race'

/**
 * Efeitos mecânicos estruturados de uma característica — hoje só talentos, amanhã também traços
 * raciais e features de classe. Espelha `src/systems/ordem/types/effects.ts`.
 *
 * Só entra aqui o que é PERMANENTE e automático: o que o jogador ativa em jogo ("gaste um ponto
 * de sorte para...") fica só na descrição, porque a ficha não tem como aplicar sozinha. A exceção
 * são os `resources`: a ficha não os gasta, mas conta quantos usos há e quando voltam.
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
  /**
   * Recursos que a característica dá: usos que se gastam e voltam no descanso (Fúria, Surto de
   * Ação), poços (Chi, Cura pelas Mãos) e dados que crescem com o nível (Ataque Furtivo). A ficha
   * não gasta nada — só mostra quanto se tem e quando volta, pra marcar a lápis na mesa.
   */
  resources?: ResourceEffect[]
}

// ── Recursos de classe ─────────────────────────────────────────────────────────

/**
 * Degrau de uma tabela por nível NA CLASSE dona da característica: vale `value` a partir do
 * nível `from`, até o próximo degrau. É o jeito do livro ("duas vezes a partir do 17º nível").
 */
export type LevelStep<T = number> = { from: number; value: T }

/**
 * Quantidade derivada do nível na classe e dos atributos: a SOMA das parcelas presentes, depois
 * o mínimo. Cobre todas as contas do PHB:
 * - tabela da classe (Fúrias, Dados de Superioridade) → `byLevel`;
 * - múltiplo do nível (Chi = nível, Cura pelas Mãos = 5 × nível) → `perClassLevel`;
 * - metade do nível (Recuperação Arcana, arredondada pra cima) → `halfClassLevel`;
 * - modificador de atributo (Inspiração de Bardo, mínimo 1) → `ability` + `min`;
 * - constante (Sentido Divino = 1 + CAR) → `plus`.
 */
export type ResourceFormula = {
  byLevel?: LevelStep[]
  perClassLevel?: number
  halfClassLevel?: 'up' | 'down'
  ability?: AbilityScore
  plus?: number
  /** Piso do total. Só quando o livro diz ("no mínimo uma vez"). */
  min?: number
}

/** Número fixo ou fórmula. */
export type ResourceQuantity = number | ResourceFormula

/**
 * Quando os usos voltam. `short` = ao terminar um descanso curto OU longo (o longo também
 * recupera); `long` = só no descanso longo; `day` = uma vez por dia (Recuperação Arcana).
 */
export type ResourceRecharge = 'short' | 'long' | 'day'

/** Unidade do que se gasta: usos (○ ○ ○), pontos (Chi), PV (Cura pelas Mãos) ou dados (Superioridade). */
export type ResourceUnit = 'uses' | 'points' | 'hp' | 'dice'

/**
 * Grandeza que NÃO se gasta, mas a ficha precisa mostrar: bônus de dano (Fúria), deslocamento
 * extra em pés (Movimento sem Armadura), PV curados por uso (Integridade Corporal), níveis de
 * espaço recuperados (Recuperação Arcana).
 */
export type ResourceAmountUnit = 'bonus' | 'feet' | 'hp' | 'slotLevels'

export type ResourceEffect = {
  /**
   * Identificador estável. Duas classes que dão o MESMO recurso usam o mesmo id e a ficha não
   * soma os usos — vale o maior (Canalizar Divindade de clérigo e paladino, p. 166).
   */
  id: string
  name: string
  /** Dado do recurso: `count`d`size` + `bonus` (Ataque Furtivo 3d6; Retomar o Fôlego 1d10 + nível). */
  die?: { size: ResourceQuantity; count?: ResourceQuantity; bonus?: ResourceQuantity }
  /** Quantos usos (ou o tamanho do poço). Sem `uses`, o recurso é só o dado/grandeza. */
  uses?: ResourceQuantity
  /** Unidade dos usos; padrão `uses`. */
  unit?: ResourceUnit
  amount?: { value: ResourceQuantity; unit: ResourceAmountUnit }
  /** Recarga, fixa ou em degraus (Inspiração de Bardo: longo; curto ou longo a partir do 5º). */
  recharge?: ResourceRecharge | LevelStep<ResourceRecharge>[]
  /** A partir deste nível na classe os usos são ilimitados (Fúria no 20º, Arquidruida). */
  unlimitedFrom?: number
  /** Ressalva curta do livro que muda o uso na mesa (ex.: "nenhum espaço de 6º nível ou superior"). */
  note?: string
}
