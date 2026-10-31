#!/usr/bin/env node
// Proposta automática do dano estruturado de magia (Fase 2, onda `magias-base`; o processo está em
// docs/magias/mecanica-magias.md). Lê spells.json e o extrato do livro e propõe, para um lote, um
// rascunho por magia: cada campo com a evidência que casou, onde ela está (no texto do app e no
// livro) e a confiança. É só proposta: NUNCA escreve no código. O rascunho vai ao scratch (a pasta
// temporária do sistema, ou --out fora de packages/ e apps/), e um campo só chega a
// packages/rules/src/systems/dnd5e/data/spell-mechanics.json depois da revisão contra o extrato.
//
// Uso (da raiz):
//   node scripts/draft-spell-mechanics.mjs --batch T            rascunho do lote T (os truques)
//   node scripts/draft-spell-mechanics.mjs --batch 1 --out x    lote 1, gravado em x
//   node scripts/draft-spell-mechanics.mjs --check              confere as bookLines revisadas
//
// O extrato (docs/_book-extracts/dnd-phb.txt) é cache local, fora do git: o script roda só onde ele
// existe, e os testes do CI conferem os dados contra o texto de spells.json, nunca contra o extrato.
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, relative, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(root, 'packages/rules/src/systems/dnd5e/data')
const EXTRACT = join(root, 'docs/_book-extracts/dnd-phb.txt')

/** Os lotes do desenho e os níveis de magia de cada um. */
const BATCHES = { T: [0], 1: [1], 2: [2], 3: [3], '4-5': [4, 5], '6-9': [6, 7, 8, 9] }

const ABILITIES = {
  Força: 'STR', Destreza: 'DEX', Constituição: 'CON', Inteligência: 'INT', Sabedoria: 'WIS', Carisma: 'CHA',
}
const NUMBERS = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, quatro: 4, cinco: 5, seis: 6 }
const NOUNS = { feixes: 'feixe', raios: 'raio', dardos: 'dardo' }

function parseArgs(argv) {
  const args = { batch: 'T', out: null, check: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--batch') args.batch = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
    else if (argv[i] === '--check') args.check = true
    else throw new Error(`argumento desconhecido: ${argv[i]}`)
  }
  if (!(args.batch in BATCHES)) throw new Error(`lote desconhecido: ${args.batch} (use ${Object.keys(BATCHES).join(', ')})`)
  return args
}

/** O rascunho nunca cai no código: packages/ e apps/ são recusados. */
function outPath(batch, out) {
  const path = resolve(out ?? join(tmpdir(), `spell-mechanics-draft-${batch}.json`))
  const rel = relative(root, path)
  const inCode = !rel.startsWith('..') && ['packages', 'apps'].includes(rel.split(sep)[0])
  if (inCode) throw new Error(`o rascunho não vai ao código (${rel}): use o scratch`)
  return path
}

const readJson = file => JSON.parse(readFileSync(join(DATA, file), 'utf-8'))

// ── O extrato ────────────────────────────────────────────────────────────────

const PAGE_MARKER = /^===== PAGINA (\d+) =====$/
/** A linha que diz o tipo, logo abaixo do nome: "Truque de evocação", "3° nível de evocação (ritual)". */
const KIND_LINE = /^(Truque de [a-zçãéêíóú]+|\d° nível de [a-zçãéêíóú]+)/

/**
 * Os cabeçalhos de magia do capítulo 11: o nome em maiúsculas numa linha (às vezes em duas) e o tipo
 * logo embaixo. Cada um com a linha (1-based) e a página impressa — o número da linha seguinte ao
 * marcador `PAGINA`, que já é a impressa (marcador + 1 até a 188, + 2 a partir da 189).
 */
function indexHeadings(lines) {
  const headings = []
  let page = null
  for (let i = 0; i < lines.length; i++) {
    if (PAGE_MARKER.test(lines[i])) {
      const printed = Number(lines[i + 1])
      if (Number.isInteger(printed)) page = printed
      continue
    }
    if (!KIND_LINE.test(lines[i + 1] ?? '')) continue
    const name = lines[i].trim()
    if (!name || name !== name.toLocaleUpperCase('pt-BR') || !/\p{Lu}/u.test(name)) continue
    // Nome em duas linhas: a de cima também é toda maiúscula e não é o fim de outro bloco.
    const above = lines[i - 1]?.trim() ?? ''
    const twoLines = above && above === above.toLocaleUpperCase('pt-BR') && /\p{Lu}{3}/u.test(above) && !/[.:)]$/.test(above)
    headings.push({ line: twoLines ? i : i + 1, name: twoLines ? `${above} ${name}` : name, page })
  }
  return headings
}

// Sem espaço nenhum: a letra capitular do PDF solta a inicial do resto ("E SPIRRO Á CIDO").
const normalizeName = s => s.toLocaleUpperCase('pt-BR').replace(/[’']/g, "'").replace(/\s+/g, '')

/**
 * O texto corrido do bloco, sem os marcadores de página. O hífen no fim da linha pode ser da palavra
 * partida ("magi-\na") ou da palavra composta ("corpo-a-\ncorpo"): as duas leituras vão juntas, e a
 * evidência casa com qualquer uma.
 */
function blockText(lines, from, to) {
  const out = []
  for (let i = from - 1; i < to; i++) {
    if (PAGE_MARKER.test(lines[i])) { i++; continue }
    out.push(lines[i])
  }
  const joined = out.join('\n')
  const flat = s => s.replace(/\s*\n\s*/g, ' ')
  return `${flat(joined.replace(/-\n(?=\p{Ll})/gu, ''))}\n${flat(joined.replace(/-\n/g, '-'))}`
}

/** O bloco de cada magia no extrato: do cabeçalho à linha antes do cabeçalho seguinte. */
function locate(spell, headings, lines) {
  const at = headings.findIndex(h => normalizeName(h.name) === normalizeName(spell.name))
  if (at < 0) return null
  const start = headings[at].line
  let end = (headings[at + 1]?.line ?? lines.length + 1) - 1
  while (end > start && (!lines[end - 1].trim() || PAGE_MARKER.test(lines[end - 1]) || /^\d+$/.test(lines[end - 1].trim()))) end--
  return { bookLines: [start, end], page: headings[at].page, text: blockText(lines, start, end) }
}

// ── Evidências ───────────────────────────────────────────────────────────────

const plain = text => text.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ')

/**
 * Um campo proposto: o valor, o trecho que casou (no texto do app, ou no livro quando só ele tem) e
 * a confiança — alta quando os dois textos trazem o mesmo trecho, média quando só um, baixa quando
 * o valor é inferido sem trecho próprio (o "nenhum dano" no sucesso do TR, que o livro não escreve).
 */
function field(value, appMatch, bookMatch, note) {
  const evidence = appMatch ?? bookMatch ?? null
  const confidence = appMatch && bookMatch ? 'alta' : evidence ? 'média' : 'baixa'
  return { value, evidence, inApp: !!appMatch, inBook: !!bookMatch, confidence, ...(note ? { note } : {}) }
}

function matchBoth(re, app, book) {
  return { app: re.exec(app), book: book ? re.exec(book) : null }
}

/** O tipo de dano pelo rótulo de damage-types.json ("dano de fogo", "dano elétrico") ou pelo nome. */
function damageTypeOf(phrase, damageTypes) {
  const p = phrase.toLocaleLowerCase('pt-BR')
  const byLabel = damageTypes.find(t => p.startsWith(t.damageLabel))
  if (byLabel) return { id: byLabel.id, how: `rótulo "${byLabel.damageLabel}"` }
  const byName = damageTypes.find(t => new RegExp(`^dano (de )?${t.name.toLocaleLowerCase('pt-BR')}\\b`, 'u').test(p))
  return byName ? { id: byName.id, how: `nome "${byName.name.toLocaleLowerCase('pt-BR')}" (rótulo diferente: "${p.split(' ').slice(0, 3).join(' ')}")` } : null
}

const DAMAGE = /(\d+)d(\d+)(?:\s*\+\s*(\d+))? de (dano (?:de )?[\p{L}]+)/gu
const ATTACK = /ataque (corpo-a-corpo|à distância) com magia/
const SAVE = /teste de resistência de (Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/
const HALF = /metade (desse|do) dano/
const CANTRIP_STEPS = /5° nível \((\d+)d(\d+)\),? 11° nível \((\d+)d\d+\) e 17° nível \((\d+)d\d+\)/
const INSTANCES = /(dois|duas|três|quatro) (feixes|raios|dardos) no 5° nível, (dois|duas|três|quatro) (?:feixes |raios |dardos )?no 11° nível e (dois|duas|três|quatro) (?:feixes |raios |dardos )?no 17° nível/
const HIGHER = /Em níveis superiores[.:]?\s*(.*)$/im
const TEMP_HP = /(\d+d\d+|\d+) pontos de vida temporários/
const HEAL = /recupera[^.]*?pontos de vida[^.]*?(\d+)d(\d+)( \+ seu modificador de habilidade de conjuração)?/
const AREA = /(esfera|cubo|cone|linha|cilindro)(?: de| com)? (\d+(?:,\d+)?) metros?(?: de raio)?/

function propose(spell, book, damageTypes) {
  const app = plain(spell.description)
  const bookText = book?.text ?? ''
  const fields = {}

  const attack = matchBoth(ATTACK, app, bookText)
  const save = matchBoth(SAVE, app, bookText)
  if (attack.app || attack.book) {
    const m = attack.app ?? attack.book
    fields.resolution = field({ kind: 'attack', range: m[1] === 'corpo-a-corpo' ? 'melee' : 'ranged' }, attack.app?.[0], attack.book?.[0])
  } else if (save.app || save.book) {
    const m = save.app ?? save.book
    const half = matchBoth(HALF, app, bookText)
    const onSuccess = half.app || half.book ? 'half' : 'none'
    fields.resolution = field({ kind: 'save', ability: ABILITIES[m[1]], onSuccess }, save.app?.[0], save.book?.[0],
      onSuccess === 'half' ? `sucesso: "${(half.app ?? half.book)[0]}"` : 'sucesso: nenhum dano — inferido, o texto não fala de metade')
  } else {
    fields.resolution = field({ kind: 'none' }, null, null, 'sem ataque nem TR no texto')
  }

  const damages = [...app.matchAll(DAMAGE)]
  const bookDamages = [...bookText.matchAll(DAMAGE)]
  if (damages.length > 0) {
    fields.damage = damages.map(m => {
      const type = damageTypeOf(m[4], damageTypes)
      const inBook = bookDamages.find(b => b[1] === m[1] && b[2] === m[2])
      return field(
        { count: Number(m[1]), sides: Number(m[2]), ...(m[3] ? { bonus: Number(m[3]) } : {}), type: type?.id ?? null },
        m[0], inBook?.[0], type ? `tipo pelo ${type.how}` : 'tipo não reconhecido',
      )
    })
  }

  if (spell.level === 0) {
    const steps = matchBoth(CANTRIP_STEPS, app, bookText)
    const m = steps.app ?? steps.book
    if (m) {
      fields.byCharacterLevel = field(
        [{ from: 1, value: 1 }, { from: 5, value: Number(m[1]) }, { from: 11, value: Number(m[3]) }, { from: 17, value: Number(m[4]) }],
        steps.app?.[0], steps.book?.[0], 'degraus de nível de PERSONAGEM (regras-conjuracao.md, seção 2)',
      )
    }
    const inst = matchBoth(INSTANCES, app, bookText)
    const n = inst.app ?? inst.book
    if (n) {
      fields.instances = field(
        { count: 1, noun: NOUNS[n[2]], byCharacterLevel: [{ from: 1, value: 1 }, { from: 5, value: NUMBERS[n[1]] }, { from: 11, value: NUMBERS[n[3]] }, { from: 17, value: NUMBERS[n[4]] }] },
        inst.app?.[0], inst.book?.[0],
      )
    }
  }

  // "Em Níveis Superiores": o parágrafo inteiro vai como evidência; o revisor lê o que aumenta.
  const higherApp = spell.description.split(/\n## /).find(p => /^Em níveis superiores/i.test(p))
  const higherBook = HIGHER.exec(bookText)
  if (higherApp || higherBook) {
    const text = higherApp ? plain(higherApp.replace(/^Em níveis superiores\s*/i, '')) : higherBook[1]
    const dice = /(\d+)d(\d+)/.exec(text)
    fields.perSlotAbove = field(dice ? { count: Number(dice[1]), sides: Number(dice[2]) } : null, higherApp ? text : null, higherBook?.[0],
      dice ? 'o dado que aumenta por nível acima; o revisor confere se é dano, cura ou outra coisa' : 'sem dado: alvos, duração ou outra coisa')
  }

  const temp = matchBoth(TEMP_HP, app, bookText)
  if (temp.app || temp.book) fields.tempHp = field((temp.app ?? temp.book)[1], temp.app?.[0], temp.book?.[0])
  const heal = matchBoth(HEAL, app, bookText)
  if (heal.app || heal.book) {
    const m = heal.app ?? heal.book
    fields.heal = field({ count: Number(m[1]), sides: Number(m[2]), ...(m[3] ? { bonus: 'spellcastingModifier' } : {}) }, heal.app?.[0], heal.book?.[0])
  }
  const area = matchBoth(AREA, app, bookText)
  if (area.app || area.book) fields.area = field((area.app ?? area.book)[0], area.app?.[0], area.book?.[0])

  return fields
}

// ── Saídas ───────────────────────────────────────────────────────────────────

function draft(batch, out) {
  const path = outPath(batch, out)
  if (!existsSync(EXTRACT)) throw new Error(`extrato não encontrado: ${relative(root, EXTRACT)} (cache local, fora do git)`)
  const lines = readFileSync(EXTRACT, 'utf-8').split(/\r?\n/)
  const headings = indexHeadings(lines)
  const spells = readJson('spells.json').filter(s => BATCHES[batch].includes(s.level))
  const damageTypes = readJson('damage-types.json')

  const drafts = spells.map(spell => {
    const book = locate(spell, headings, lines)
    return {
      id: spell.id,
      name: spell.name,
      level: spell.level,
      batch,
      bookLines: book?.bookLines ?? null,
      page: book?.page ?? null,
      ...(book ? {} : { problem: 'não achei o cabeçalho no extrato: procure à mão' }),
      fields: propose(spell, book, damageTypes),
    }
  })

  writeFileSync(path, `${JSON.stringify(drafts, null, 2)}\n`, 'utf-8')
  const count = c => drafts.flatMap(d => Object.values(d.fields).flat()).filter(f => f.confidence === c).length
  console.log(`Lote ${batch}: ${drafts.length} magias → ${path}`)
  console.log(`  campos com confiança alta: ${count('alta')}, média: ${count('média')}, baixa: ${count('baixa')}`)
  for (const d of drafts.filter(d => d.problem)) console.log(`  ! ${d.name}: ${d.problem}`)
  console.log('Proposta, não dado: revise cada campo contra o extrato antes de levá-lo a spell-mechanics.json.')
}

/** Confere as bookLines das entradas revisadas: começam no cabeçalho da magia e não passam do bloco. */
function check() {
  if (!existsSync(EXTRACT)) throw new Error(`extrato não encontrado: ${relative(root, EXTRACT)} (cache local, fora do git)`)
  const lines = readFileSync(EXTRACT, 'utf-8').split(/\r?\n/)
  const headings = indexHeadings(lines)
  const spells = new Map(readJson('spells.json').map(s => [s.id, s]))
  const entries = readJson('spell-mechanics.json')
  const problems = []
  for (const entry of entries) {
    const spell = spells.get(entry.id)
    const book = spell ? locate(spell, headings, lines) : null
    if (!book) { problems.push(`${entry.id}: sem bloco no extrato`); continue }
    const [from, to] = entry.bookLines
    if (from !== book.bookLines[0]) problems.push(`${entry.id}: começa em ${from}, o cabeçalho está em ${book.bookLines[0]}`)
    if (to < from || to > book.bookLines[1]) problems.push(`${entry.id}: termina em ${to}, o bloco vai de ${book.bookLines[0]} a ${book.bookLines[1]}`)
  }
  console.log(`${entries.length} entradas conferidas; ${problems.length} problema(s).`)
  for (const p of problems) console.log(`  ! ${p}`)
  if (problems.length > 0) process.exitCode = 1
}

const args = parseArgs(process.argv.slice(2))
if (args.check) check()
else draft(args.batch, args.out)
