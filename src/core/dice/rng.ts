/**
 * Fonte de aleatoriedade do motor de dados. Devolve um número em [0, 1), no mesmo formato do
 * `Math.random`.
 */
export type Rng = () => number

/**
 * Quem sorteia a face de um dado de `sides` lados. É o ponto de injeção do motor: o padrão usa
 * Web Crypto, e os testes passam uma sequência fixa de faces.
 */
export type DieRoller = (sides: number) => number

const UINT32_RANGE = 2 ** 32

/**
 * Sorteio padrão via `crypto.getRandomValues`, que não é previsível como o `Math.random`. Cai no
 * `Math.random` só se o ambiente não tiver Web Crypto.
 */
export const cryptoRng: Rng = () => {
  const c = globalThis.crypto
  if (!c?.getRandomValues) return Math.random()
  return c.getRandomValues(new Uint32Array(1))[0] / UINT32_RANGE
}

export function assertSides(sides: number): void {
  if (!Number.isInteger(sides) || sides < 1) throw new Error(`Dado inválido: d${sides}`)
}

/** Face de 1 a `sides` a partir de uma fonte em [0, 1). Fonte fora do intervalo é erro. */
export function rollDie(sides: number, rng: Rng = cryptoRng): number {
  assertSides(sides)
  const r = rng()
  if (!(r >= 0 && r < 1)) throw new Error(`Fonte de aleatoriedade fora de [0, 1): ${r}`)
  return Math.floor(r * sides) + 1
}

export const cryptoRoller: DieRoller = sides => rollDie(sides, cryptoRng)

/**
 * Roller determinístico para testes: devolve as faces dadas, em ordem, seja qual for o dado.
 * Erra se as faces acabarem ou se uma não couber no dado pedido.
 */
export function sequenceRoller(faces: number[]): DieRoller {
  let i = 0
  return sides => {
    if (i >= faces.length) throw new Error('sequenceRoller: faces esgotadas')
    const face = faces[i++]
    if (!Number.isInteger(face) || face < 1 || face > sides) {
      throw new Error(`sequenceRoller: face ${face} não existe num d${sides}`)
    }
    return face
  }
}
