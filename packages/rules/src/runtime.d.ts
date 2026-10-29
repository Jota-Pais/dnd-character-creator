/**
 * O que o motor usa de fora do ECMAScript: só APIs que o navegador e o Node (17+) têm iguais. O
 * tsconfig do pacote não tem a lib DOM; API nova daqui entra nesta lista só se o Node também a tiver.
 */
declare function structuredClone<T>(value: T): T

// eslint-disable-next-line no-var -- só var vira propriedade de globalThis, e o código lê globalThis.crypto.
declare var crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T
  randomUUID(): string
}
