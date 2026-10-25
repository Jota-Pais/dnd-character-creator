import { describe, it, expect } from 'vitest'
import { CLASSES } from '../../utils/classUtils'
import { stripInlineBold } from '../../utils/ruleText'
import weaponsData from '../weapons.json'
import spellsData from '../spells.json'
import progressionFeatures from '../class-progression-features.json'

/**
 * A digitalização do PHB vem de um PDF que usa Wingdings para os marcadores de lista: o extrator
 * devolve U+F0B7 — área de uso privado do Unicode, que nenhuma fonte do app tem — e o navegador
 * desenhava um quadrado vazio no meio da descrição dos talentos.
 *
 * A convenção do projeto é "- " no início da linha (ver `RuleText`). Este teste guarda os JSONs
 * contra qualquer caractere de uso privado voltando numa próxima digitalização.
 */
const PRIVATE_USE_START = 0xe000
const PRIVATE_USE_END = 0xf8ff

/** Índice do primeiro caractere de uso privado, ou -1. Sem regex: o padrão em si seria invisível. */
function findPrivateUse(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= PRIVATE_USE_START && code <= PRIVATE_USE_END) return i
  }
  return -1
}

const DATA = import.meta.glob('../*.json', { eager: true }) as Record<string, { default: unknown }>

describe('dados do livro', () => {
  const files = Object.keys(DATA)

  it('encontra os JSONs de dados', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s não tem marcador de lista do PDF (caractere de uso privado)', file => {
    const content = JSON.stringify(DATA[file].default)
    const at = findPrivateUse(content)
    const context = at >= 0 ? content.slice(Math.max(0, at - 60), at + 60) : ''
    expect(at, `caractere de uso privado em ${file}: ...${context}...`).toBe(-1)
  })
})

/**
 * Negrito inline (`**Nome.**`): as magias abrem cada opção assim, e o `RuleText` desenha o par
 * como <strong>. Duas guardas:
 *
 * - todo `**` fecha na mesma linha — um solto sairia literal na ficha;
 * - só aparece em campo que passa pelo `RuleText`. Raça, antecedente e características de
 *   classe são impressos como texto cru na ficha e na Revisão: lá o `**` vazaria.
 */
type TextLine = { file: string; key: string; line: string }

/** Linhas de todas as strings do JSON, com a chave do campo que as contém. */
function collectLines(file: string, value: unknown, key = ''): TextLine[] {
  if (typeof value === 'string') return value.split('\n').map(line => ({ file, key, line }))
  if (Array.isArray(value)) return value.flatMap(v => collectLines(file, v, key))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => collectLines(file, v, k))
  }
  return []
}

/** Arquivo → campos renderizados pelo `RuleText` (grimório, etapa de Magias, talentos). */
const RULE_TEXT_FIELDS: Record<string, string[]> = {
  'spells.json': ['description'],
  'feats.json': ['description'],
}

describe('negrito inline nos dados do livro', () => {
  const boldLines = Object.entries(DATA)
    .flatMap(([path, mod]) => collectLines(path.replace('../', ''), mod.default))
    .filter(l => l.line.includes('**'))

  it('a marcação existe nos dados (o teste não está olhando o lugar errado)', () => {
    expect(boldLines.length).toBeGreaterThan(0)
  })

  it('todo ** fecha na mesma linha', () => {
    const unpaired = boldLines.filter(l => stripInlineBold(l.line).includes('**'))
    expect(unpaired.map(l => `${l.file} (${l.key}): ${l.line.slice(0, 80)}`)).toEqual([])
  })

  it('** só aparece em campo desenhado pelo RuleText', () => {
    const raw = boldLines.filter(l => !RULE_TEXT_FIELDS[l.file]?.includes(l.key))
    expect(raw.map(l => `${l.file} (${l.key}): ${l.line.slice(0, 80)}`)).toEqual([])
  })
})

/**
 * As classes listavam armas no plural inglês ("quarterstaffs") enquanto o catálogo usa o id
 * singular ("quarterstaff"): nenhuma proficiência específica casava. Só apareceu quando o motor
 * de proficiência passou a ler esses ids de verdade.
 */
describe('ids de arma das classes', () => {
  const CATALOG_IDS = new Set((weaponsData as { id: string }[]).map(w => w.id))
  const CATEGORY_TOKENS = ['simple', 'martial']

  it.each(CLASSES.map(c => [c.id, c] as const))(
    '%s: proficiências de arma existem no catálogo',
    (_id, cls) => {
      const declared = [...cls.weaponProficiencies, ...cls.multiclassProficiencies.weapons]
      const unknown = declared.filter(w => !CATEGORY_TOKENS.includes(w) && !CATALOG_IDS.has(w))
      expect(unknown, `ids sem correspondência no catálogo: ${unknown.join(', ')}`).toEqual([])
    },
  )
})

/**
 * Erros claros de tradução do PHB pt-BR seguem o inglês (política em CLAUDE.md, "Fontes da
 * Verdade"). A digitalização carrega o texto pt-BR: rodar de novo um parser sobre ela, ou copiar o
 * trecho do extract, traria o erro de volta. Cada caso adotado fica preso aqui.
 */
describe('divergências pt-BR × inglês que seguem o inglês', () => {
  it('Ilusão Menor é S, M — o pt-BR diz V, M, mas a magia não tem componente verbal', () => {
    const spell = (spellsData as { id: string; components: string }[]).find(s => s.id === 'minor-illusion')
    expect(spell?.components).toBe('S, M (um pouco de lã)')
  })
})

describe('características de classe que seguem o inglês', () => {
  type Feature = { name: string; description: string }
  const groups = progressionFeatures as Record<'classes' | 'subclasses', Record<string, Feature[]>>
  const featureText = (name: string) =>
    [...Object.values(groups.classes), ...Object.values(groups.subclasses)]
      .flat()
      .filter(f => f.name === name)
      .map(f => f.description)

  it('Presença Intimidante estende o medo até o FIM do próximo turno (pt-BR: "início")', () => {
    const [text] = featureText('Presença Intimidante')
    expect(text).toContain('estender o efeito até o fim do seu próximo turno')
    expect(text).not.toContain('início')
  })

  it('Golpe de Sorte vale para teste de habilidade, não "um teste qualquer" (resistência fica de fora)', () => {
    const [text] = featureText('Golpe de Sorte')
    expect(text).toContain('se falhar num teste de habilidade, trate a jogada do d20 como 20.')
  })
})
