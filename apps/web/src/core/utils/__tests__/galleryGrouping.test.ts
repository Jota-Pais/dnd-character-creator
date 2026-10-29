import { describe, it, expect } from 'vitest'
import { filterByName, groupGalleryCharacters, type GalleryEntry } from '../galleryGrouping'
import type { GalleryFacets } from '../../types/system'

function ordemFacets(overrides: Partial<GalleryFacets> = {}): GalleryFacets {
  return {
    levelLabel: 'NEX',
    levelValue: '5%',
    levelSort: 5,
    classValue: 'Combatente',
    originLabel: 'Origem',
    originValue: 'Acadêmico',
    missingCount: 0,
    ...overrides,
  }
}

function entry(name: string, updatedAt: number, facets: Partial<GalleryFacets> = {}): GalleryEntry {
  return { name, updatedAt, facets: ordemFacets(facets) }
}

const read = (e: GalleryEntry) => e
const titles = <T>(groups: { title: string | null; items: T[] }[]) => groups.map(g => g.title)
const names = (groups: { items: GalleryEntry[] }[]) => groups.map(g => g.items.map(i => i.name))

describe('filterByName', () => {
  const items = [entry('Bianca Alencar', 1), entry('Antônio Vega', 2), entry('Cristina', 3)]

  it('consulta vazia devolve tudo (e a mesma lista, sem cópia)', () => {
    expect(filterByName(items, '   ', read)).toBe(items)
  })

  it('casa trecho no meio do nome, sem ligar pra caixa', () => {
    expect(filterByName(items, 'ALEN', read).map(i => i.name)).toEqual(['Bianca Alencar'])
  })

  it('ignora acento nos dois lados da comparação', () => {
    expect(filterByName(items, 'antonio', read).map(i => i.name)).toEqual(['Antônio Vega'])
    expect(filterByName([entry('Antonio', 1)], 'antônio', read).map(i => i.name)).toEqual(['Antonio'])
  })

  it('sem casar devolve lista vazia', () => {
    expect(filterByName(items, 'zzz', read)).toEqual([])
  })
})

describe('groupGalleryCharacters — agrupamento', () => {
  it("'system' devolve um grupo único sem título (a seção do sistema já é o cabeçalho)", () => {
    const groups = groupGalleryCharacters([entry('A', 1), entry('B', 2)], read, 'system', 'name')
    expect(groups).toHaveLength(1)
    expect(groups[0].title).toBeNull()
    expect(groups[0].items).toHaveLength(2)
  })

  it("'level' usa o rótulo do sistema e põe o mais poderoso primeiro", () => {
    const groups = groupGalleryCharacters([
      entry('Fraca', 1, { levelValue: '5%', levelSort: 5 }),
      entry('Forte', 2, { levelValue: '99%', levelSort: 99 }),
      entry('Média', 3, { levelValue: '50%', levelSort: 50 }),
    ], read, 'level', 'name')
    expect(titles(groups)).toEqual(['NEX 99%', 'NEX 50%', 'NEX 5%'])
  })

  it("'level' respeita o vocabulário do D&D quando as facetas vêm de lá", () => {
    const dnd = { levelLabel: 'Nível', levelValue: '7', levelSort: 7, originLabel: 'Raça' }
    const groups = groupGalleryCharacters([entry('Krusk', 1, dnd)], read, 'level', 'name')
    expect(titles(groups)).toEqual(['Nível 7'])
  })

  it("'class' agrupa por classe e joga a ficha sem classe pro fim", () => {
    const groups = groupGalleryCharacters([
      entry('Sem classe', 1, { classValue: null }),
      entry('Ocultista', 2, { classValue: 'Ocultista' }),
      entry('Combatente', 3, { classValue: 'Combatente' }),
    ], read, 'class', 'name')
    expect(titles(groups)).toEqual(['Combatente', 'Ocultista', 'Classe não escolhida'])
  })

  it("'origin' usa o rótulo do eixo do sistema no grupo vazio", () => {
    const ordem = groupGalleryCharacters([entry('X', 1, { originValue: null })], read, 'origin', 'name')
    expect(titles(ordem)).toEqual(['Origem não escolhida'])

    const dnd = groupGalleryCharacters(
      [entry('Y', 1, { originValue: null, originLabel: 'Raça' })], read, 'origin', 'name',
    )
    expect(titles(dnd)).toEqual(['Raça não escolhida'])
  })

  it("'status' põe as fichas com pendência primeiro", () => {
    const groups = groupGalleryCharacters([
      entry('Pronta', 1, { missingCount: 0 }),
      entry('Meio caminho', 2, { missingCount: 3 }),
      entry('Outra pronta', 3, { missingCount: 0 }),
    ], read, 'status', 'name')
    expect(titles(groups)).toEqual(['Com pendências', 'Prontas'])
    expect(names(groups)).toEqual([['Meio caminho'], ['Outra pronta', 'Pronta']])
  })

  it('grupos de mesma posição saem em ordem alfabética pt-BR', () => {
    const groups = groupGalleryCharacters([
      entry('a', 1, { classValue: 'Ocultista' }),
      entry('b', 2, { classValue: 'Especialista' }),
      entry('c', 3, { classValue: 'Álibi' }),
    ], read, 'class', 'name')
    expect(titles(groups)).toEqual(['Álibi', 'Especialista', 'Ocultista'])
  })

  it('lista vazia não gera grupo nenhum', () => {
    expect(groupGalleryCharacters([], read, 'level', 'recent')).toEqual([])
  })
})

describe('groupGalleryCharacters — ordenação dentro do grupo', () => {
  const items = [
    entry('Cristina', 10, { levelSort: 50 }),
    entry('Bianca', 30, { levelSort: 5 }),
    entry('Antônio', 20, { levelSort: 99 }),
  ]

  it("'recent' põe a editada por último no topo", () => {
    expect(names(groupGalleryCharacters(items, read, 'system', 'recent'))).toEqual([
      ['Bianca', 'Antônio', 'Cristina'],
    ])
  })

  it("'name' ordena A–Z respeitando acento", () => {
    expect(names(groupGalleryCharacters(items, read, 'system', 'name'))).toEqual([
      ['Antônio', 'Bianca', 'Cristina'],
    ])
  })

  it("'level' põe o mais poderoso no topo, com o nome como desempate", () => {
    const empatados = [
      entry('Zeca', 1, { levelSort: 50 }),
      entry('Ana', 2, { levelSort: 50 }),
      entry('Bruno', 3, { levelSort: 99 }),
    ]
    expect(names(groupGalleryCharacters(empatados, read, 'system', 'level'))).toEqual([
      ['Bruno', 'Ana', 'Zeca'],
    ])
  })

  it('não muta a lista recebida', () => {
    const original = [...items]
    groupGalleryCharacters(items, read, 'system', 'name')
    expect(items).toEqual(original)
  })
})
