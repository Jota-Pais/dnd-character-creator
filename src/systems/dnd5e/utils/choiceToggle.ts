/**
 * O clique numa opção de uma escolha com limite ("escolha N entre..."), igual em todo seletor da
 * ficha.
 *
 * Escolha de 1 é rádio: clicar noutra opção troca a marcada direto (decisão do usuário,
 * 2026-10-26). Antes era preciso desmarcar primeiro, e o resto da lista ficava desabilitado —
 * parecia travado. Escolha de N mantém o limite: cheia, a opção nova não entra até sair uma.
 *
 * `swap` diz se a escolha é rádio; o padrão é "de 1". Quem tem um motivo para não ser (o slot de
 * progressão cumulativo, `isSingleChoiceSlot`) passa explícito.
 */
export function toggleChoice<T extends string>(
  selected: readonly T[],
  id: T,
  max: number,
  swap: boolean = max === 1,
): T[] | null {
  if (selected.includes(id)) return selected.filter(x => x !== id)
  if (swap) return [id]
  if (selected.length >= max) return null
  return [...selected, id]
}

/**
 * A escolha está cheia para uma opção nova (que fica desabilitada)? Só na de N: na de 1 a opção
 * nova troca a marcada, então nunca trava.
 */
export function isChoiceFull(selectedCount: number, max: number, swap: boolean = max === 1): boolean {
  return !swap && selectedCount >= max
}
