import type { OrdemClassId } from './class'
import type { OrdemRitualCircle } from './ritual'

/**
 * Efeitos mecânicos estruturados de uma feature de trilha que a ficha aplica automaticamente.
 * Só os efeitos PERMANENTES/flat entram aqui; features ativadas em jogo (ex.: "gaste +2 PE para
 * dobrar a área") ficam só na `description`. Ver os getters em `characterUtils`/`curseUtils`.
 */
export type TrilhaFeatureEffects = {
  /**
   * PV extra por degrau de NEX alcançado, retroativo (ex.: Casca Grossa +1 por 5% de NEX) —
   * mesma convenção de `hpPerNexStep` da origem e dos poderes paranormais: conta todos os
   * degraus alcançados, não só os posteriores à aquisição da feature.
   */
  hpPerNexStep?: number
  /** DT para resistir a TODOS os rituais do conjurador (ex.: Rituais Eficientes +5). */
  allRitualDtBonus?: number
  /** Soma a Presença ao limite de PE por turno, mas só para conjurar rituais (Presença Poderosa). */
  ritualPeLimitBonusFromPresence?: boolean
  /** Bônus em testes de resistência contra efeitos paranormais (ex.: Mente Sã +5). */
  paranormalResistanceBonus?: number
  /** Resistência a dano mental E paranormal, valor fixo (ex.: Inabalável 10). */
  mentalAndParanormalDamageResistance?: number
  /** Soma Intelecto à Força para o cálculo de capacidade de carga (Inventário Otimizado). */
  carryCapacityAddsIntellect?: boolean
  /**
   * Slots de ritual BÔNUS que o jogador escolhe (Saber Ampliado e Grimório Ritualístico, trilha
   * Graduado). Não contam no limite de rituais conhecidos — são slots próprios na etapa Rituais,
   * ao lado dos do Aprender Ritual (ver `getBonusRitualSlots`).
   */
  grantsRitualSlots?: {
    /** Quantos slots ao adquirir a feature: número fixo, ou 'intellect' (= Intelecto do agente). */
    baseCount: number | 'intellect'
    /** Círculos aceitos nos slots base (ex.: [1] no Saber Ampliado, [1, 2] no Grimório). */
    baseCircles: OrdemRitualCircle[]
    /**
     * "Toda vez que ganha acesso a um novo círculo, aprende um ritual adicional daquele círculo":
     * +1 slot por círculo liberado DEPOIS da aquisição da feature, travado naquele círculo.
     */
    perNewCircle?: boolean
  }
  /**
   * Exceção à regra "só permanente": resistência a dano condicional, mas relevante o bastante
   * pra listar na seção Resistências com a condição explícita (ex.: Casca Grossa — RD = Vigor
   * "ao bloquear", Inquebrável — RD fixa "enquanto machucado"). Nunca somada a um total; cada
   * uma aparece como uma linha própria com sua condição.
   */
  conditionalDamageResistance?: {
    /** Valor fixo, OU 'vigor' pra usar o atributo Vigor do personagem como valor. */
    value: number | 'vigor'
    /** Descrição curta da condição de gatilho (ex.: "ao bloquear", "enquanto estiver machucado"). */
    condition: string
  }
}

export type TrilhaFeature = {
  nex: number
  name: string
  description: string
  /**
   * Id de um ritual que esta feature ensina ("Você aprende o ritual X"). Concedido
   * automaticamente ao alcançar o NEX da feature; NÃO conta no limite de rituais conhecidos.
   * Ver `getGrantedRituals`.
   */
  grantsRitual?: string
  /** Efeitos aplicados automaticamente na ficha (ausente = feature só descritiva/ativada em jogo). */
  effects?: TrilhaFeatureEffects
}

export type Trilha = {
  id: string
  name: string
  classId: OrdemClassId
  description: string
  requirement: string | null
  /** Perícia que precisa estar treinada para escolher a trilha, quando houver. */
  requiredTrainedSkill?: string
  features: TrilhaFeature[]
}
