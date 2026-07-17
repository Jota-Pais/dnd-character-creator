import type { ParanormalElement } from './ritual'
import type { OrdemPowerPrereq } from './prereq'

/**
 * Efeitos mecânicos estruturados de um poder paranormal que a ficha aplica automaticamente
 * (mesma filosofia de `TrilhaFeatureEffects`/`OriginPowerEffects`). Só efeitos PERMANENTES/flat
 * entram aqui; poderes ativados em jogo (ex.: "gaste 3 PE para...") ficam só na `description`.
 */
export type ParanormalPowerEffects = {
  /** Bônus fixo em Defesa (ex.: Precognição +2). */
  defenseBonus?: number
  /** Bônus em TODOS os testes de resistência (ex.: Precognição +2) — nota na ficha. */
  resistanceTestsBonus?: number
  /** PV extra por degrau de NEX, retroativo (ex.: Sangue de Ferro +2). */
  hpPerNexStep?: number
  /** PE extra por degrau de NEX, retroativo (ex.: Potencial Aprimorado +1). */
  pePerNexStep?: number
  /** Aumento do limite de gasto de PE por turno, em cenas de ação (ex.: Encarar a Morte +1). */
  peLimitBonus?: number
  /** Bônus na margem de ameaça dos ataques (ex.: Golpe de Sorte +1). */
  threatMarginBonus?: number
  /** Bônus no multiplicador de crítico dos ataques (Golpe de Sorte com afinidade). */
  critMultiplierBonus?: number
  /** Bônus fixo em perícias, por id (ex.: Sensitivo +5 em diplomacy/intimidation/insight). */
  skillBonus?: Record<string, number>
  /** Resistência a dano do elemento ESCOLHIDO no param (só Resistir a Elemento: 10). */
  chosenElementResistance?: number
}

/** Sub-escolha que o poder exige ao ser adquirido (ver `ParanormalPowerChoice` no draft). */
export type ParanormalChoiceSpec =
  | { kind: 'ritual' } // Aprender Ritual → escolher o ritual (e o elemento, se multi-elemento)
  | { kind: 'element' } // Resistir a Elemento → escolher o elemento
  | { kind: 'class-power' } // Expansão de Conhecimento → poder de classe de OUTRA classe

export type ParanormalPower = {
  id: string
  name: string
  /** Elemento fixo do poder; null nos 2 gerais (resolvido pela sub-escolha via `elementFrom`). */
  element: ParanormalElement | null
  /** Como resolver o elemento efetivo quando `element === null` ("conta como poder do elemento..."). */
  elementFrom?: 'element-param' | 'ritual-param'
  description: string
  /**
   * Texto literal da linha "Afinidade:" (p. 114–117) — recebido só ao escolher o poder uma
   * SEGUNDA vez, tendo afinidade com o elemento dele. Null quando o poder não tem a linha
   * (só Aprender Ritual).
   */
  affinityDescription: string | null
  /** Texto de exibição do pré-requisito, como no livro (ex.: "Morte 2"). */
  prerequisite: string | null
  /** Pré-requisitos estruturados, validados pelo motor (`prereqUtils`). */
  prereqs?: OrdemPowerPrereq[]
  /** Só Aprender Ritual (repetição ilimitada, sujeita ao limite de rituais = Intelecto). */
  repeatable?: boolean
  choice?: ParanormalChoiceSpec
  effects?: ParanormalPowerEffects
  /** DELTAS aditivos sobre `effects` quando a 2ª cópia (afinidade) existe — nunca valor total. */
  affinityEffects?: ParanormalPowerEffects
}
