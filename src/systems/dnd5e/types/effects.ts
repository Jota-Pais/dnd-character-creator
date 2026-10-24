import type { ArmorProficiency } from './class'
import type { AbilityScore } from './race'

/**
 * Efeitos mecânicos estruturados de uma característica — talentos, features de classe e (por ora só
 * `resources` e `hpPerLevel`) traços raciais. Espelha `src/systems/ordem/types/effects.ts`.
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
 * Ataques por ação que só valem numa situação. `byLevel` segue o nível NA classe dona (é assim que
 * o pré-requisito "5° nível" da Lâmina Sedenta entra na conta: antes dele, nada).
 */
export type ConditionalAttacks = {
  byLevel: LevelStep[]
  /** Condição do livro, em português, exibida junto do número. */
  condition: string
}

/**
 * Fórmula alternativa de CA para quem não veste armadura: `base` + os modificadores de `abilities`.
 * Não se soma às outras — "se você tem vários recursos que o concedem diferentes formas de
 * calcular a CA, você escolhe qual usar" (p. 14); a ficha mostra a maior.
 *
 * O escudo segue a regra geral ("empunhar um escudo aumenta sua CA em 2", p. 146) e soma por cima,
 * a menos que a característica o proíba (`noShield`, a Defesa sem Armadura do monge, p. 104).
 */
export type UnarmoredAcFormula = {
  /**
   * Identifica a característica. Duas classes que dão a MESMA (mesmo id) não a dão duas vezes:
   * "se você já tiver a característica Defesa sem Armadura, você não pode ganhá-la de outra
   * classe" (p. 166) — fica a da classe que a deu primeiro.
   */
  id: string
  base: number
  abilities: AbilityScore[]
  /** A característica só vale sem escudo (monge). */
  noShield?: boolean
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
   * PV extras por nível de personagem (Robusto: +2; Tenacidade Anã: +1). O livro soma 2 × nível
   * ao adquirir e mais 2 a cada nível seguinte — o efeito acumulado é sempre 2 × nível, então
   * basta o valor por nível. A Tenacidade Anã (p. 20) segue o mesmo raciocínio: +1 já no 1º nível
   * e +1 a cada nível seguinte, ou seja, 1 × nível de personagem.
   */
  hpPerLevel?: number
  /**
   * PV extras por nível NA CLASSE dona da feature — só lido em features de classe e subclasse.
   * Resiliência Dracônica (p. 80): +1 no 1º nível e +1 "sempre que você ganhar um nível na
   * classe", ou seja, 1 × nível de feiticeiro (um guerreiro 3 / feiticeiro 2 ganha só +2).
   */
  hpPerClassLevel?: number
  /** Outra forma de calcular a CA sem armadura (Defesa sem Armadura, Resiliência Dracônica). */
  unarmoredAc?: UnarmoredAcFormula
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
   * Ataque Extra: TOTAL de ataques da ação de Atacar, em degraus por nível NA classe dona da
   * característica (guerreiro: 2 no 5º, 3 no 11º, 4 no 20º — p. 85). Só lido em features de
   * classe e subclasse. Não se soma entre fontes: "se você ganhar a característica Ataque Extra
   * de mais de uma classe, elas não se acumulam" (p. 166) — vale o maior.
   */
  attacksPerAction?: LevelStep[]
  /**
   * Ataques a mais que só valem numa situação (Lâmina Sedenta: dois ataques "com sua arma do
   * pacto", p. 61). Vira linha própria na ficha, nunca o número das armas — a ficha não sabe qual
   * arma é a do pacto. Some quando o personagem já tem Ataque Extra (p. 166).
   */
  conditionalAttacksPerAction?: ConditionalAttacks
  /**
   * Recursos que a característica dá: usos que se gastam e voltam no descanso (Fúria, Surto de
   * Ação), poços (Chi, Cura pelas Mãos) e dados que crescem com o nível (Ataque Furtivo). A ficha
   * não gasta nada — só mostra quanto se tem e quando volta, pra marcar a lápis na mesa.
   */
  resources?: ResourceEffect[]
}

// ── Recursos (de classe, talento ou raça) ──────────────────────────────────────

/**
 * Degrau de uma tabela por nível: vale `value` a partir do nível `from`, até o próximo degrau. É o
 * jeito do livro ("duas vezes a partir do 17º nível"). O nível é o NA CLASSE dona da feature; para
 * traço racial e talento, que não pertencem a classe nenhuma, é o nível de personagem (a Arma de
 * Sopro cresce "no 6° nível", p. 34).
 */
export type LevelStep<T = number> = { from: number; value: T }

/**
 * Quantidade derivada do nível na classe e dos atributos: a SOMA das parcelas presentes, depois
 * o mínimo. Cobre todas as contas do PHB:
 * - tabela da classe (Fúrias, Dados de Superioridade) → `byLevel`;
 * - múltiplo do nível (Chi = nível, Cura pelas Mãos = 5 × nível) → `perClassLevel`;
 * - metade do nível (Recuperação Arcana, arredondada pra cima) → `halfClassLevel`;
 * - modificador de atributo (Inspiração de Bardo, mínimo 1) → `ability` + `min`;
 * - constante (Sentido Divino = 1 + CAR) → `plus`;
 * - bônus de proficiência (CD da Arma de Sopro = 8 + CON + proficiência) → `proficiency`.
 */
export type ResourceFormula = {
  byLevel?: LevelStep[]
  perClassLevel?: number
  halfClassLevel?: 'up' | 'down'
  ability?: AbilityScore
  plus?: number
  /** Soma o bônus de proficiência do personagem (que segue o nível de personagem). */
  proficiency?: boolean
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
 * espaço recuperados (Recuperação Arcana), CD do teste de resistência (Arma de Sopro).
 */
export type ResourceAmountUnit = 'bonus' | 'feet' | 'hp' | 'slotLevels' | 'saveDc'

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
  /**
   * Se o personagem já tem um recurso com este `id` vindo de outra fonte, os usos daqui SOMAM aos
   * dele (e o dado continua o dele); senão, este vale sozinho. É o Adepto Marcial (p. 167): "Se você
   * já tiver dados de superioridade, você ganha um adicional; do contrário, [...] um d6".
   */
  addsToExisting?: boolean
}
