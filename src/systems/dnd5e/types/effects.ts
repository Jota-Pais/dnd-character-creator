import type { ArmorProficiency } from './class'
import type { ConditionId, RollCategory } from './condition'
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

/**
 * Metade do bônus de proficiência nos testes de habilidade sem proficiência. Duas fontes não se
 * somam — é o mesmo bônus de proficiência, que entra uma vez só (p. 175): em cada teste vale a
 * maior, e quem decide é `getHalfProficiencyBonus` (sheetEffects).
 */
export type HalfProficiencyOnChecks = {
  rounding: 'down' | 'up'
  /** Só testes destes atributos; ausente, todo teste de habilidade. */
  abilities?: AbilityScore[]
}

/**
 * Linha condicional numa jogada d20 — a vantagem que depende da situação (Resiliência Anã "contra
 * veneno", Sentido de Perigo "contra efeitos que possa ver") ou o que não cabe num número
 * (Sortudo: rolar de novo o 1 natural). Nunca entra no número nem no modo: vira nota na receita
 * das jogadas que alcança, com o nome de quem a dá.
 */
export type ConditionalRollNote = {
  rolls: RollCategory[]
  /** Só jogadas destes atributos; ausente, de todos. */
  abilities?: AbilityScore[]
  /**
   * Vale também no teste contra a morte, que é um "teste de resistência especial" sem atributo
   * (p. 199). Só quando a característica alcança todo teste de resistência (Sortudo).
   */
  deathSave?: boolean
  /**
   * A característica deixa jogar de novo o 1 natural (Sortudo, p. 28): quando os dados do app tiram
   * 1, a tela oferece a nova rolagem (hoje, no teste contra a morte).
   */
  rerollNaturalOne?: boolean
  /**
   * Condições que tiram o benefício (Sentido de Perigo: cego, surdo ou incapacitado, p. 48). Com
   * uma delas em vigor no modo de jogo, gravada ou derivada, a linha some das receitas.
   */
  unlessConditions?: ConditionId[]
  /** A regra, em português, com a página — exibida depois do nome de quem a dá. */
  text: string
}

/**
 * O que uma característica proíbe na conjuração numa situação que a ficha não conhece — a Fúria
 * (p. 48): "Se você for capaz de conjurar magias, você não poderá conjurá-las ou se concentrar
 * nelas enquanto estiver em fúria" — e entrar em fúria encerra a concentração (decisão de
 * 2026-10-29, que o `text` diz). O modo de jogo não tem o estado "em fúria" (efeitos ativos são
 * da Fase 2): nunca bloqueia nem muda número — vira nota onde se conjura (a CD e o ataque de
 * magia, a concentração, as magias da aba Regras), inclusive nas magias inatas da raça.
 */
export type CastingRestriction = {
  /** A situação, em português, que abre a nota ("em fúria"). */
  when: string
  /** A regra, em português, com a página — exibida depois da situação. */
  text: string
}

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
 * Bônus em todos os testes de resistência que só vale numa situação — a Aura de Proteção do
 * paladino 6 (p. 111): mod. de Carisma, mínimo +1, para você e criaturas amigáveis a até 3 m,
 * enquanto você estiver consciente. Fica FORA do número das resistências (a ficha não sabe se você
 * está consciente nem quem está perto) e vira linha própria com a condição.
 */
export type ConditionalSaveBonus = {
  /** O bônus, com os atributos finais e o nível NA classe dona (`{ ability: 'CHA', min: 1 }`). */
  value: ResourceQuantity
  /**
   * Condição do livro, em português, em degraus pelo nível NA classe dona — o alcance da aura
   * passa de 3 m a 9 m no 18º nível de paladino.
   */
  condition: LevelStep<string>[]
}

/**
 * Condição de equipamento que a ficha confere sozinha, pelo que está equipado — o mesmo critério
 * da CA (`getEquippedArmor`):
 * - `noHeavyArmor`: sem armadura pesada (Movimento Rápido, p. 49);
 * - `noArmorNoShield`: sem armadura nenhuma e sem escudo (Movimento sem Armadura, p. 104).
 */
export type EquipmentRequirement = 'noHeavyArmor' | 'noArmorNoShield'

/**
 * Bônus de deslocamento que vale só com o equipamento certo. Diferente da CA condicional, a ficha
 * SABE o que está equipado: entra no número quando a condição é cumprida, e a condição vira linha
 * própria — somada ou não — pra quem troca de equipamento na mesa.
 */
export type EquipmentSpeedBonus = {
  /**
   * Bônus em PÉS (a unidade da raça), em degraus pelo nível NA classe dona da característica: o
   * monge ganha +10 pés no 2º, +15 no 6º, +20 no 10º, +25 no 14º e +30 no 18º (tabela O Monge,
   * p. 103). Antes do primeiro degrau, nada.
   */
  byLevel: LevelStep[]
  requires: EquipmentRequirement
  /** Condição do livro, em português, exibida junto do número. */
  condition: string
}

/**
 * A que ataques um efeito de ataque se aplica:
 * - `ranged`: arma de ataque à distância (Arquearia, p. 85). Adaga e azagaia arremessadas
 *   continuam armas corpo a corpo e não entram;
 * - `melee-one-handed`: arma corpo a corpo sem a propriedade duas mãos — a versátil entra, pelo
 *   uso numa mão (Duelismo);
 * - `melee-two-handed`: arma corpo a corpo com duas mãos ou versátil (Combate com Armas Grandes);
 * - `melee-light`: arma corpo a corpo leve, a do combate com duas armas (p. 197);
 * - `melee-strength`: ataque com arma corpo a corpo usando Força (Fúria, p. 48). Toda arma corpo a
 *   corpo entra, e o golpe desarmado também: não é arma, mas é ataque corpo a corpo com arma
 *   (p. 197 pelo inglês, "melee weapon attack" — decisão do dono de 2026-10-29). A nota diz o que
 *   a linha não cumpre: a de acuidade ou de Artes Marciais (arma de monge, golpe desarmado) cuja
 *   linha usa Destreza vale atacando com Força; a de arremesso, só sem arremessar — arremessar é
 *   ataque à distância (p. 149 e 197);
 * - `unarmed`: só o golpe desarmado (Golpes de Chi). Ele não é arma (p. 197): os escopos de arma
 *   acima não o alcançam, salvo `melee-strength`, que fala do ataque e não da arma;
 * - `weapon-attack`: todo ataque com arma, "seus ataques com armas" do Crítico Aprimorado e do
 *   Crítico Superior (p. 85-86) — toda arma, corpo a corpo ou à distância, e o golpe desarmado, que
 *   é ataque com arma sem ser arma (decisão 20 de `regras-dano-e-morte.md`, revista em 2026-10-29);
 * - `melee-weapon-attack`: todo ataque corpo a corpo com arma, o crítico do Crítico Brutal e dos
 *   Ataques Selvagens (p. 41 e 49) — toda arma corpo a corpo e o golpe desarmado (decisão 21,
 *   revista em 2026-10-29).
 */
export type AttackScope =
  | 'ranged' | 'melee-one-handed' | 'melee-two-handed' | 'melee-light' | 'melee-strength' | 'unarmed'
  | 'weapon-attack' | 'melee-weapon-attack'

/**
 * Bônus nas jogadas de dano que só vale numa situação, com o valor de um recurso calculado da
 * MESMA característica — o Dano de Fúria (p. 48): +2, +3 no 9º e +4 no 16º nível de bárbaro, em
 * fúria e sem armadura pesada. A ficha não sabe se você está em fúria: é sempre nota na linha de
 * ataque, nunca o número. Um valor só, nos dados: o da caixa de Recursos é o mesmo da nota.
 */
export type ConditionalDamageBonus = {
  /** Id do recurso, declarado na mesma característica, cujo `amount` é o bônus (no nível NA classe dona). */
  resource: string
  /** Condição do livro, em português, exibida depois do bônus ("em fúria, sem armadura pesada"). */
  condition: string
  /** Parte da condição que a ficha confere pelo equipamento: descumprida, a nota diz o que a impede. */
  requires?: EquipmentRequirement
}

/**
 * Efeito de uma característica nas linhas de ataque. A regra de ouro decide o campo:
 * - `attackBonus` vale SEMPRE que se ataca com aquela arma — entra no número (Arquearia +2);
 * - `note` depende da situação (Duelismo: "sem outra arma"; Armas Grandes: "com as duas mãos")
 *   ou não cabe num número (rerrolar) — vira nota na linha da arma, com a condição;
 * - `offHandAddsModifier`: o ataque da outra mão soma o modificador no dano (Combate com Duas
 *   Armas, p. 85), trocando a regra-base da p. 197, que o deixa de fora;
 * - `conditionalDamage`: bônus de dano condicional cujo valor é um recurso (Dano de Fúria) — nota
 *   com o valor do nível, calculado por `getWeaponAttackEffects`.
 */
export type WeaponAttackEffect = {
  weapons: AttackScope
  attackBonus?: number
  note?: string
  offHandAddsModifier?: boolean
  conditionalDamage?: ConditionalDamageBonus
}

/**
 * Armas cuja propriedade recarga a característica ignora (Especialista em Besta: "você ignora a
 * qualidade de recarga de bestas nas quais você é proficiente", p. 169). Sem a recarga, a arma
 * volta a fazer todos os ataques da ação de Atacar (p. 149). `weapons` são ids de weapons.json.
 */
export type LoadingOverride = {
  weapons: string[]
  /** Só vale nas armas com que o personagem é proficiente. */
  requiresProficiency: boolean
}

/**
 * Artes Marciais (monge, p. 104): com golpe desarmado ou arma de monge, e sem armadura nem escudo,
 * pode usar Destreza em vez de Força e rolar o dado de Artes Marciais no lugar do dano normal.
 * Como o Movimento sem Armadura, a ficha confere o equipamento (`requires`) e aplica no número
 * quando a condição é cumprida.
 */
export type MartialArtsEffect = {
  /**
   * Id do recurso, declarado na MESMA característica, que carrega o dado (d4 → d10 pelo nível de
   * monge). Um dado só, nos dados: o da caixa de Recursos é o mesmo da linha de ataque.
   */
  dieResource: string
  requires: EquipmentRequirement
  /** Condição do livro, em português, exibida quando o equipamento a impede. */
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
   * Adepto Marcial: duas manobras da lista do Mestre de Batalha (p. 167). Não oferece a que o
   * personagem já conhece pelo arquétipo — aprender a mesma de novo não daria nada.
   */
  maneuverChoice?: { count: number }
  /**
   * Iniciado em Magia (p. 170): escolhe uma das `classes`, aprende `cantrips` truques e `spells`
   * magias de `spellLevel`º nível da lista dela, e conjura com o atributo de conjuração dela. Três
   * passos no mesmo slot — classe → truques → magia —, gravados em `featSelections` (`spellClass`,
   * `cantrips`, `spells`).
   */
  spellChoice?: { classes: string[]; cantrips: number; spells: number; spellLevel: number }
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
  /**
   * Vantagem nas jogadas de iniciativa, sem condição (Instinto Selvagem, bárbaro 7, p. 49).
   * Incondicional: entra no modo da iniciativa. Lido em features de classe e talentos.
   */
  initiativeAdvantage?: boolean
  /**
   * Linhas condicionais nas jogadas d20 (Sentido de Perigo, e nos traços raciais Resiliência Anã,
   * Bravura e Sortudo). Lidas de features de classe (no nível NA classe dona), talentos e traços.
   */
  conditionalRolls?: ConditionalRollNote[]
  /**
   * Restrição de conjuração numa situação (Fúria). Só lida em features de classe e subclasse, no
   * nível NA classe dona; vale para toda magia da ficha, de qualquer fonte.
   */
  castingRestriction?: CastingRestriction
  /**
   * A característica deixa conjurar magias sem ser fonte de magia da ficha (`getSpellSources`): o
   * Conselheiro Espiritual e o Andarilho Espiritual do Guerreiro Totêmico (p. 50), o Corpo Vazio
   * (p. 105), as Artes Sombrias e as disciplinas elementais que conjuram magia (p. 106) e o
   * Conjurador de Ritual (p. 169). Responde se o personagem "for capaz de conjurar magias" (a
   * Fúria, p. 48; `canCastSpells`). Lido em features de classe e subclasse (no nível NA classe
   * dona), nas opções escolhidas em slot de progressão e nos talentos.
   */
  castsSpells?: boolean
  /** Bônus de deslocamento, em PÉS, a unidade em que a raça guarda (Mobilidade: +10 pés = +3 m). */
  speedBonus?: number
  /**
   * Bônus de deslocamento que depende do equipamento (Movimento Rápido, Movimento sem Armadura).
   * Só lido em features de classe e subclasse, no nível NA classe dona. Características diferentes
   * se somam: o livro só barra o acúmulo da Defesa sem Armadura e do Ataque Extra (p. 166).
   */
  equipmentSpeedBonus?: EquipmentSpeedBonus
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
  /**
   * "Seu máximo de pontos de vida não pode ser reduzido" (Acostumado à Morte-Vida, mago da
   * Necromancia 10, p. 101): a metade da Exaustão 4 não corta o máximo. Só lido em features de
   * classe e subclasse, no nível NA classe dona.
   */
  hpMaxCannotBeReduced?: boolean
  /** Outra forma de calcular a CA sem armadura (Defesa sem Armadura, Resiliência Dracônica). */
  unarmoredAc?: UnarmoredAcFormula
  /** Bônus nos valores PASSIVOS destas perícias (Observador: +5 em Percepção e Investigação). */
  passiveScoreBonus?: { skills: string[]; value: number }
  /** Bônus de CA condicionais — nunca somados no total da ficha. */
  conditionalAcBonus?: ConditionalAcBonus[]
  /** Proficiências de armadura concedidas (Proteção Leve / Moderada / Pesada). */
  grantedArmorProficiencies?: ArmorProficiency[]
  /**
   * Metade do bônus de proficiência em TESTE DE HABILIDADE que ainda não tenha o bônus — perícia
   * sem proficiência, iniciativa, teste de atributo puro ou de ferramenta. Não vale para
   * resistência nem ataque. Versatilidade (bardo 2, p. 54): todo teste, arredondada para baixo;
   * Atletismo Extraordinário (campeão 7, p. 85): só Força, Destreza e Constituição, para cima.
   */
  halfProficiencyOnChecks?: HalfProficiencyOnChecks
  /**
   * Bônus condicional em todos os testes de resistência (Aura de Proteção). Só lido em features
   * de classe e subclasse, no nível NA classe dona; nunca entra no número das resistências.
   */
  conditionalSaveBonus?: ConditionalSaveBonus
  /**
   * Proficiência em testes de resistência dada por característica de classe — Mente Escorregadia
   * (ladino 15, Sabedoria, p. 91) e Alma de Diamante (monge 14, `'all'`, p. 105). Incondicional:
   * entra no número da ficha. Só lido em features de classe e subclasse, e vale pelo nível NA
   * classe dona — a restrição da multiclasse (p. 166) é só sobre as proficiências INICIAIS.
   */
  savingThrowProficiencies?: AbilityScore[] | 'all'
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
   * Efeitos nas linhas de ataque: Estilos de Luta (Arquearia no número; Duelismo, Armas Grandes e
   * Duas Armas como nota), o Dano de Fúria (nota nas armas corpo a corpo e no golpe desarmado) e
   * notas do golpe desarmado (Golpes de Chi). Lidos de features de classe, talentos e do Estilo de
   * Luta escolhido (inclusive o Adicional do campeão).
   */
  weaponAttacks?: WeaponAttackEffect[]
  /**
   * Margem de acerto crítico dos ataques COM ARMA, em degraus pelo nível NA classe dona: Crítico
   * Aprimorado do campeão, 19 a partir do 3º (p. 85); Crítico Superior, 18 a partir do 15º (p. 86).
   * Só lido em features de classe e subclasse. Fontes não somam: vale a menor margem. O alcance é o
   * escopo `weapon-attack` (`getWeaponCritThreshold`): as armas e o golpe desarmado. Incondicional:
   * entra no `critThreshold` do guia.
   */
  weaponCritThreshold?: LevelStep[]
  /**
   * Dados de dano da arma a mais no acerto crítico com arma corpo a corpo: Crítico Brutal do
   * bárbaro, 1/2/3 no 9º/13º/17º pelo nível NA classe (p. 49); Ataques Selvagens do meio-orc, 1
   * (p. 41, nível de personagem). Por ora só NOTA na receita do dano crítico — a fórmula não muda.
   * O alcance é o escopo `melee-weapon-attack` (`getMeleeCritExtraWeaponDice`): as armas corpo a
   * corpo e o golpe desarmado, este só quando tem dado (Artes Marciais, Especialista em Briga) —
   * com o dano fixo não há dado a rolar a mais (decisão 21, revista em 2026-10-29).
   */
  meleeCritExtraWeaponDice?: LevelStep[]
  /** Artes Marciais do monge — só lido em features de classe, no nível NA classe dona. */
  martialArts?: MartialArtsEffect
  /**
   * Dado de dano do golpe desarmado no lugar do 1 fixo (Especialista em Briga: "seus ataques
   * desarmados causam 1d4 de dano", p. 169). Com Artes Marciais, fica o maior dado.
   */
  unarmedDamageDie?: number
  /** Ignora a recarga destas armas (Especialista em Besta, p. 169). Lido em talentos e features. */
  ignoresLoading?: LoadingOverride
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
 * - constante (Sentido Divino = 1 + CAR, mínimo 1) → `plus` + `min`;
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
  /**
   * Piso do total. Quando o livro diz ("no mínimo uma vez") ou por decisão registrada: o Sentido
   * Divino (p. 110) não traz mínimo, mas 0 usos numa característica de 1º nível não faz sentido na
   * mesa — fica 1 (decisão do usuário, 2026-10-25).
   */
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
 * Grandeza que NÃO se gasta, mas a ficha precisa mostrar: bônus de dano (Fúria), PV curados por
 * uso (Integridade Corporal), níveis de espaço recuperados (Recuperação Arcana), CD do teste de
 * resistência (Arma de Sopro). Deslocamento extra não é recurso: entra no número do Deslocamento
 * (`speedBonus`, `equipmentSpeedBonus`).
 */
export type ResourceAmountUnit = 'bonus' | 'hp' | 'slotLevels' | 'saveDc'

/** Espaços de magia recuperados num descanso curto: o nível mais alto e a página da regra. */
export type SlotRecovery = { maxSlotLevel: number; page: number }

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
   * Gastar um uso encerra a concentração, e este é o motivo que o aviso diz: "entrar em fúria
   * (pág. 48)" — em fúria não se concentra (decisão (e) de 2026-10-29). Até o estado "em fúria"
   * chegar com os efeitos ativos da Fase 2, gastar o uso da Fúria é o ato de entrar nela.
   */
  spendEndsConcentration?: string
  /**
   * O recurso recupera espaços de magia gastos num descanso curto (Recuperação Arcana, Recuperação
   * Natural): `amount` em `slotLevels` é a soma dos níveis; nenhum espaço acima de `maxSlotLevel`.
   * O modo de jogo lembra disso no painel do descanso curto — a escolha dos espaços é do jogador.
   */
  slotRecovery?: SlotRecovery
  /**
   * Se o personagem já tem um recurso com este `id` vindo de outra fonte, os usos daqui SOMAM aos
   * dele (e o dado continua o dele); senão, este vale sozinho. É o Adepto Marcial (p. 167): "Se você
   * já tiver dados de superioridade, você ganha um adicional; do contrário, [...] um d6".
   */
  addsToExisting?: boolean
  /**
   * O recurso é o uso de uma magia escolhida no próprio talento (`choices.spellChoice`): com a
   * magia escolhida, o nome do recurso vira o dela (a Magia de 1º nível do Iniciado em Magia,
   * p. 170: "Sono — 1 uso"). Sem escolha, fica o `name` declarado.
   */
  nameFromChosenSpell?: boolean
}
