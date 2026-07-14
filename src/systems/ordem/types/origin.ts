/**
 * Efeitos mecânicos estruturados de um poder de origem que a ficha aplica automaticamente.
 * Só os efeitos PERMANENTES/flat entram aqui; poderes ativados em jogo (ex.: "gaste 2 PE para
 * +5") ficam só na `description`. Ver os getters em `characterUtils` (`getOrigin*Bonus`).
 */
export type OriginPowerEffects = {
  /** Bônus fixo em Defesa (ex.: Patrulha +2). */
  defenseBonus?: number
  /** PV extra por degrau de NEX alcançado (ex.: Calejado +1 por 5% de NEX). */
  hpPerNexStep?: number
  /** Sanidade extra por degrau de NEX (ex.: Cicatrizes Psicológicas +1 por 5% de NEX). */
  sanityPerNexStep?: number
  /** PE extra fixo (ex.: Dedicação +1). */
  peFlat?: number
  /** PE extra por degrau ímpar de NEX {15,25,...,95} (ex.: Dedicação +1). */
  pePerOddNexStep?: number
  /** Aumento do limite de PE por turno (ex.: Dedicação +1). */
  peLimitBonus?: number
  /** Bônus em rolagens de dano corpo a corpo (ex.: Mão Pesada +2). */
  meleeDamageBonus?: number
  /** Bônus em rolagens de dano com armas de fogo (ex.: Para Bellum +2). */
  firearmDamageBonus?: number
  /** Resistência a dano mental igual ao Intelecto (ex.: Eu Já Sabia). */
  mentalDamageResistanceEqualsIntellect?: boolean
}

export type Origin = {
  id: string
  name: string
  description: string
  skillProficiencies: string[]
  power: {
    name: string
    description: string
    /** Efeitos aplicados automaticamente na ficha (ausente = poder só descritivo/ativado em jogo). */
    effects?: OriginPowerEffects
  }
  rollRange: [number, number]
}
