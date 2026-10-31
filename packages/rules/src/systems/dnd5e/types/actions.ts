/**
 * Ações declaradas nos dados: o que o personagem faz no turno e o que isso custa e causa — entrar
 * em fúria é uma ação bônus que gasta um uso da Fúria e liga o efeito "em fúria" (p. 48). Ficam em
 * `effects.actions` de quem as dá (característica de classe, talento, traço racial, opção escolhida
 * em slot de progressão) e, as que todo personagem tem (Atacar, Esquivar), em
 * `data/combat-actions.json`. O custo de ligar um efeito mora SÓ aqui: a declaração do efeito
 * (`ToggleDeclaration`) não o repete.
 *
 * O bloco tem o que o turno usa (Fase 2, onda `turno`): o momento, o gatilho da reação, o custo em
 * recurso, o que a ação causa, o que ela exige e para onde ela leva. Espaço de magia, item,
 * rolagem com CD, dano e reação sobre o dano chegam com as ondas das ações que os usam.
 */

/** Quando se usa no turno (p. 191-192): ação, ação bônus, reação, livre, movimento ou especial. */
export type ActionTiming = 'action' | 'bonusAction' | 'reaction' | 'free' | 'movement' | 'special'

/** Os grupos da aba Ações: Ação, Ação Bônus, Reação e Outras (livre, movimento, especial). */
export type ActionGroup = 'action' | 'bonusAction' | 'reaction' | 'other'

/** O que a ação gasta: usos de um recurso da MESMA característica (`effects.resources`). */
export type ActionCost = { kind: 'resource'; resource: string; amount: number }

/**
 * O que a ação causa: liga ou desliga um efeito declarado (`ToggleDeclaration.id`), dá mais uma ação
 * neste turno (o Surto de Ação, p. 85), soma o deslocamento outra vez (a Disparada, p. 194), conta
 * como ataque seu (o fim prematuro da Fúria pergunta por ele: Atacar e a outra mão no seu turno; o
 * de oportunidade, que é reação, depois dele) ou levanta quem está Caído (`standUp`, p. 192).
 */
export type ActionOutcome =
  | { kind: 'toggleOn'; toggle: string }
  | { kind: 'toggleOff'; toggle: string }
  | { kind: 'extraAction' }
  | { kind: 'dash' }
  | { kind: 'attack' }
  | { kind: 'standUp' }

/**
 * O que a ação exige da ficha ou do estado, para aparecer: duas armas leves corpo a corpo
 * carregadas (Combater com Duas Armas, p. 197), ser capaz de conjurar magias (Conjurar uma Magia,
 * `canCastSpells`) ou estar Caído (Levantar-se, p. 192).
 */
export type ActionRequirement = 'twoLightMeleeWeapons' | 'spellcaster' | 'prone'

export type ActionDeclaration = {
  /** Único entre as ações da ficha ('rage-enter'). */
  id: string
  /** Como a tela chama a ação: "Entrar em fúria", "Esquivar". */
  name: string
  timing: ActionTiming
  /** O que dispara a reação ("um inimigo que você possa ver sai do seu alcance"). */
  trigger?: string
  cost?: ActionCost[]
  /** Ausente: a ação só marca o momento do turno (Desengajar). */
  outcomes?: ActionOutcome[]
  /** Só se usa com este efeito ligado: encerrar a fúria pede estar em fúria. */
  requiresToggle?: string
  /** Só aparece quando a ficha ou o estado a cumprem. */
  requires?: ActionRequirement
  /** No máximo uma vez por turno (o Surto de Ação no 17º nível, p. 85): a segunda só avisa. */
  oncePerTurn?: true
  /**
   * Faz-se dentro da ação de Atacar, no lugar de um dos ataques (o agarrão e o encontrão, p.
   * 197-198): não tem "Usar" próprio, quem marca o turno é o Atacar.
   */
  partOf?: 'attack'
  /**
   * Para onde a ação leva: uma jogada do guia (`RollGuideEntry.id`: 'skill:stealth') ou uma parte
   * da tela ('attacks': os ataques; 'spellbook': a aba Magia).
   */
  links?: string[]
  /**
   * O resumo da ação, só quando ela não é a característica inteira (as ações em combate do livro);
   * sem ele, o "?" abre o texto de quem a dá.
   */
  summary?: string
  page: number
  /** As linhas do extrato do livro (as ações em combate), para conferir a declaração com o texto. */
  bookLines?: [number, number]
}

/**
 * Uma ação da ficha (`getSheetActions`), com quem a dá (o nome da característica) e o texto que o
 * "?" abre: o resumo da ação ou, sem ele, o de quem a dá. `standard`: uma das ações em combate que
 * todo personagem tem (`data/combat-actions.json`).
 */
export type SheetAction = ActionDeclaration & { source: string; description: string; standard?: true }
