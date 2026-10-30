/**
 * Ações declaradas nos dados: o que o personagem faz no turno e o que isso custa e causa — entrar
 * em fúria é uma ação bônus que gasta um uso da Fúria e liga o efeito "em fúria" (p. 48). Ficam em
 * `effects.actions` da característica dona, e o custo de ligar um efeito mora SÓ aqui: a declaração
 * do efeito (`ToggleDeclaration`) não o repete.
 *
 * Nasce mínimo (Fase 2, onda `efeitos-ativos`): custo em recurso e o liga/desliga. O resto do bloco
 * de ação — gatilho, espaço de magia, rolagem, dano, reação — chega com o turno.
 */

/** Quando se usa no turno (p. 189-190): ação, ação bônus, reação, livre, movimento ou especial. */
export type ActionTiming = 'action' | 'bonusAction' | 'reaction' | 'free' | 'movement' | 'special'

/** O que a ação gasta: usos de um recurso da MESMA característica (`effects.resources`). */
export type ActionCost = { kind: 'resource'; resource: string; amount: number }

/** O que a ação causa: liga ou desliga um efeito declarado (`ToggleDeclaration.id`). */
export type ActionOutcome =
  | { kind: 'toggleOn'; toggle: string }
  | { kind: 'toggleOff'; toggle: string }

export type ActionDeclaration = {
  /** Único entre as ações da ficha ('rage-enter'). */
  id: string
  /** Como a tela chama o botão: "Entrar em fúria". */
  name: string
  timing: ActionTiming
  cost?: ActionCost[]
  outcomes: ActionOutcome[]
  /** Só se usa com este efeito ligado: encerrar a fúria pede estar em fúria. */
  requiresToggle?: string
  page: number
}
