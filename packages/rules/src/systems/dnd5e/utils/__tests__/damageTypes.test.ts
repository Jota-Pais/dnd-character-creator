import { describe, it, expect } from 'vitest'
import { DAMAGE_TYPES, getDamageLabel, getDamageType, getDamageTypeName, isDamageTypeId } from '../damageTypes'
import { DAMAGE_TYPE_PT } from '../weaponFormat'

/**
 * A tabela da seção 5 de `docs/regras-dano-e-morte.md` (p. 198): "| Tipo (livro) | Exemplos | `id` |".
 * Os dados e a digitalização não podem divergir.
 */
const DOC = import.meta.glob<string>('../../../../../../../docs/regras-dano-e-morte.md', {
  query: '?raw', import: 'default', eager: true,
})

function docTable(): { name: string; id: string }[] {
  const text = Object.values(DOC)[0] ?? ''
  const section = text.split('## 5. Tipos de dano')[1]?.split('\n## ')[0] ?? ''
  return section
    .split(/\r?\n/)
    .map(line => /^\|\s*([^|]+?)\s*\|[^|]*\|\s*`([a-z]+)`\s*\|$/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => ({ name: m[1], id: m[2] }))
}

describe('tipos de dano (p. 198)', () => {
  it('os 13 da tabela da seção 5, com o mesmo id e o mesmo nome, na ordem do livro', () => {
    const table = docTable()
    expect(table).toHaveLength(13)
    expect(DAMAGE_TYPES.map(t => ({ name: t.name, id: t.id }))).toEqual(table)
  })

  // O dano por extenso da p. 198 (linhas 17773-17805 do extrato): "dano de fogo", mas "dano
  // elétrico". O ácido fica "dano de ácido", a forma que o livro mais usa (7 vezes, como em Amortecer
  // Elementos, p. 69, e nas magias, contra 4 de "dano ácido") e a que o app já mostrava no Ancestral
  // Dracônico; a p. 198 escreve "dano ácido". É só redação: não muda regra.
  it('o dano por extenso de cada tipo', () => {
    expect(Object.fromEntries(DAMAGE_TYPES.map(t => [t.id, getDamageLabel(t.id)]))).toEqual({
      acid: 'dano de ácido',
      bludgeoning: 'dano de concussão',
      slashing: 'dano cortante',
      lightning: 'dano elétrico',
      force: 'dano de energia',
      fire: 'dano de fogo',
      cold: 'dano de frio',
      necrotic: 'dano necrótico',
      piercing: 'dano perfurante',
      psychic: 'dano psíquico',
      radiant: 'dano radiante',
      thunder: 'dano trovejante',
      poison: 'dano de veneno',
    })
  })

  it('o nome em minúsculas é o das armas ("1d8 perfurante")', () => {
    expect(getDamageTypeName('lightning')).toBe('elétrico')
    expect(DAMAGE_TYPE_PT.bludgeoning).toBe('concussão')
    expect(DAMAGE_TYPE_PT.piercing).toBe('perfurante')
    expect(DAMAGE_TYPE_PT.slashing).toBe('cortante')
    expect(Object.keys(DAMAGE_TYPE_PT)).toHaveLength(13)
  })

  it('confere id que vem de fora', () => {
    expect(isDamageTypeId('fire')).toBe(true)
    expect(isDamageTypeId('Fogo')).toBe(false)
    expect(isDamageTypeId(undefined)).toBe(false)
    expect(getDamageType('fire').name).toBe('Fogo')
  })
})

/**
 * O rótulo mora só em `damage-types.json`. Montar "dano de ${tipo}" no código daria "dano de
 * elétrico" num tipo adjetivo; e outro JSON com `damageLabel` seria uma segunda fonte.
 */
const CODE = import.meta.glob<string>(
  [
    '../../**/*.{ts,tsx}', '!../../**/__tests__/**',
    '../../../../../../../apps/web/src/systems/dnd5e/**/*.{ts,tsx}', '!../../../../../../../apps/web/src/systems/dnd5e/**/__tests__/**',
  ],
  { query: '?raw', import: 'default', eager: true },
)
const DATA = import.meta.glob<string>('../../data/*.json', { query: '?raw', import: 'default', eager: true })

/** O código sem os comentários: eles podem citar a regra ("nunca montar ..."). */
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

describe('fonte única do rótulo do tipo de dano', () => {
  it('o código lido cobre o motor e o site do D&D', () => {
    const paths = Object.keys(CODE)
    expect(paths).toContain('../damageTypes.ts')
    expect(paths.some(p => p.includes('/apps/web/src/systems/dnd5e/play/'))).toBe(true)
  })

  it('nenhum código monta "dano de ${...}"', () => {
    const offenders = Object.entries(CODE)
      .filter(([, text]) => /dano de \$\{/.test(withoutComments(text)))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('só damage-types.json guarda damageLabel', () => {
    const files = Object.entries(DATA)
      .filter(([, text]) => text.includes('"damageLabel"'))
      .map(([path]) => path)
    expect(files).toEqual(['../../data/damage-types.json'])
  })
})
