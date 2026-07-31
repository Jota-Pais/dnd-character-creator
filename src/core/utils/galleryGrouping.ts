import type { GalleryFacets } from '../types/system'

/** Critério de agrupamento dentro da seção de um sistema. 'system' = sem subdivisão. */
export type GroupBy = 'system' | 'level' | 'class' | 'origin' | 'status'

/** Ordenação das fichas dentro de cada grupo. */
export type SortBy = 'recent' | 'name' | 'level'

/** O que a galeria precisa saber de uma ficha para agrupar, ordenar e buscar. */
export type GalleryEntry = {
  name: string
  updatedAt: number
  facets: GalleryFacets
}

/** Um grupo exibido na galeria. `title` null = grupo único, renderizado sem subcabeçalho. */
export type GalleryGroup<T> = {
  key: string
  title: string | null
  items: T[]
}

export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'level', label: 'NEX / Nível' },
  { value: 'class', label: 'Classe' },
  { value: 'origin', label: 'Origem / Raça' },
  { value: 'status', label: 'Estado da ficha' },
]

export const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'recent', label: 'Editadas recentemente' },
  { value: 'name', label: 'Nome (A–Z)' },
  { value: 'level', label: 'NEX / Nível (maior primeiro)' },
]

/** Sem acento e sem caixa: faz "Antonio" achar "Antônio". */
function normalize(text: string): string {
  // \u0300-\u036f: as marcas de combinação que o NFD separa das letras.
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Filtra por trecho do nome (a busca da galeria). Consulta vazia devolve tudo. */
export function filterByName<T>(items: T[], query: string, read: (item: T) => GalleryEntry): T[] {
  const needle = normalize(query.trim())
  if (!needle) return items
  return items.filter(item => normalize(read(item).name).includes(needle))
}

/** Chave, título e posição do grupo de uma ficha. `order` ordena os grupos entre si. */
function groupOf(entry: GalleryEntry, groupBy: GroupBy): { key: string; title: string; order: number } {
  const { facets } = entry
  switch (groupBy) {
    case 'level':
      return {
        key: `level:${facets.levelSort}`,
        title: `${facets.levelLabel} ${facets.levelValue}`,
        // Negativo para o mais poderoso vir primeiro.
        order: -facets.levelSort,
      }
    case 'class':
      return facets.classValue
        ? { key: `class:${facets.classValue}`, title: facets.classValue, order: 0 }
        : { key: 'class:none', title: 'Classe não escolhida', order: 1 }
    case 'origin':
      return facets.originValue
        ? { key: `origin:${facets.originValue}`, title: facets.originValue, order: 0 }
        : { key: 'origin:none', title: `${facets.originLabel} não escolhida`, order: 1 }
    case 'status':
      // Fichas com pendência primeiro: são as que o jogador está no meio de fazer.
      return facets.missingCount > 0
        ? { key: 'status:pending', title: 'Com pendências', order: 0 }
        : { key: 'status:ready', title: 'Prontas', order: 1 }
    case 'system':
      return { key: 'all', title: '', order: 0 }
  }
}

function compareEntries(a: GalleryEntry, b: GalleryEntry, sortBy: SortBy): number {
  switch (sortBy) {
    case 'name':
      return a.name.localeCompare(b.name, 'pt-BR')
    case 'level':
      return b.facets.levelSort - a.facets.levelSort || a.name.localeCompare(b.name, 'pt-BR')
    case 'recent':
      return b.updatedAt - a.updatedAt
  }
}

/**
 * Agrupa e ordena as fichas de uma seção. Com groupBy 'system' devolve um grupo único sem
 * título (a seção do sistema já é o cabeçalho) — é o comportamento padrão da galeria.
 */
export function groupGalleryCharacters<T>(
  items: T[],
  read: (item: T) => GalleryEntry,
  groupBy: GroupBy,
  sortBy: SortBy,
): GalleryGroup<T>[] {
  const buckets = new Map<string, { title: string; order: number; items: T[] }>()

  for (const item of items) {
    const { key, title, order } = groupOf(read(item), groupBy)
    const bucket = buckets.get(key)
    if (bucket) bucket.items.push(item)
    else buckets.set(key, { title, order, items: [item] })
  }

  return [...buckets.entries()]
    .sort(([, a], [, b]) => a.order - b.order || a.title.localeCompare(b.title, 'pt-BR'))
    .map(([key, bucket]) => ({
      key,
      title: groupBy === 'system' ? null : bucket.title,
      items: [...bucket.items].sort((a, b) => compareEntries(read(a), read(b), sortBy)),
    }))
}
