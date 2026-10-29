/** JSON com as chaves em ordem: dois valores iguais dão o mesmo texto, qualquer que seja a ordem. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v)
}

/**
 * Impressão digital curta de um valor (FNV-1a de 32 bits sobre o `canonicalJson`, em hexadecimal):
 * para saber se ele mudou sem guardar a cópia inteira. Não é criptográfica.
 */
export function jsonFingerprint(value: unknown): string {
  const text = canonicalJson(value) ?? ''
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
