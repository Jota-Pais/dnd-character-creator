import dragonAncestorsData from '../data/dragon-ancestors.json'
import type { DamageTypeId } from '../types/damage'

/**
 * Uma linha da tabela Ancestral Dracônico. O livro a imprime duas vezes — no draconato (p. 34,
 * com a arma de sopro) e no feiticeiro da Linhagem Dracônica (p. 80, só o tipo de dano) — e aqui
 * ela existe uma vez só: a sub-raça do draconato aponta para a linha (`dragonAncestor`) e o
 * Ancestral Dracônico do feiticeiro é escolha de progressão sobre ela. As duas escolhas são
 * independentes: um draconato vermelho pode ser feiticeiro de ancestral azul.
 */
export type DragonAncestor = {
  id: string
  /** O dragão, como na tabela: "Vermelho", "Latão". */
  name: string
  /**
   * O tipo de dano associado. O nome ("Fogo", "Elétrico") e o dano por extenso ("dano de fogo",
   * "dano elétrico") saem de `damage-types.json` (`getDamageType`), sem cópia aqui.
   */
  damageType: DamageTypeId
  /** Área e teste da arma de sopro do draconato (p. 34). */
  breath: string
}

export const DRAGON_ANCESTORS: readonly DragonAncestor[] = dragonAncestorsData as DragonAncestor[]

export function getDragonAncestor(id: string): DragonAncestor | undefined {
  return DRAGON_ANCESTORS.find(a => a.id === id)
}
