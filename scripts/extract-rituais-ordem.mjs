// Extrai os rituais COMPLETOS do Ordem Paranormal (Cap. 5, "Lista de Rituais") a partir
// do extrato de texto do livro, com stat block, descrição fiel e elemento(s)/círculo corretos.
// Fonte: docs/_book-extracts/ordem-paranormal.txt (marcadores "===== PAGINA N =====").
// Substitui a versão antiga, que parseava só a lista-resumo (descrições de uma linha).
import fs from 'fs'
import path from 'path'

const EXTRACT = path.join(process.cwd(), 'docs/_book-extracts/ordem-paranormal.txt')
const OUT_JSON = path.join(process.cwd(), 'src/systems/ordem/data/rituals.json')
const OUT_DOC = path.join(process.cwd(), 'docs/ordem-paranormal/regras-rituais.md')

const raw = fs.readFileSync(EXTRACT, 'utf-8').split('\n')

const ELEM = { SANGUE: 'blood', MORTE: 'death', ENERGIA: 'energy', CONHECIMENTO: 'knowledge', MEDO: 'fear' }
const ELEM_PT = { blood: 'Sangue', death: 'Morte', energy: 'Energia', knowledge: 'Conhecimento', fear: 'Medo' }
const anchorRe = /^(?:SANGUE|MORTE|ENERGIA|CONHECIMENTO|MEDO) [1-4](?: (?:SANGUE|MORTE|ENERGIA|CONHECIMENTO|MEDO) [1-4])*$/
const isAnchor = (l) => anchorRe.test(l.trim())

const startIdx = raw.findIndex((l, i) => i > 8000 && l.trim() === 'Alterar Destino')
const endIdx = raw.findIndex((l, i) => i > startIdx && /^=====\s*PAGINA 146/.test(l.trim()))
if (startIdx < 0 || endIdx < 0) throw new Error(`limites não encontrados: start=${startIdx} end=${endIdx}`)

const noise = (l) => {
  const t = l.trim()
  return t === '' || /^=====\s*PAGINA/.test(t) || /^Miguel Machado Gomes/.test(t) || /^\d{1,3}$/.test(t)
}
const lines = raw.slice(startIdx, endIdx).filter((l) => !noise(l)).map((l) => l.trim())

const anchors = []
lines.forEach((l, i) => { if (isAnchor(l)) anchors.push(i) })

// O extrato do PDF às vezes insere espaços dentro de palavras ("Dura ção", "Vonta de").
// Casamos o rótulo antes dos ":" ignorando espaços internos. Os campos de alvo aparecem
// com nomes variados (Alvo/Alvos/Área/Efeito/"Alvo ou Área") — todos viram `target`.
const LABEL_MAP = {
  execução: 'execution',
  alcance: 'range',
  alvo: 'target', alvos: 'target', área: 'target', efeito: 'target', alvoouárea: 'target',
  duração: 'duration',
  resistência: 'resistance',
}
function matchStat(line) {
  const ci = line.indexOf(':')
  if (ci < 0 || ci > 20) return null
  const key = line.slice(0, ci).replace(/\s+/g, '').toLowerCase()
  if (LABEL_MAP[key]) return { field: LABEL_MAP[key], value: line.slice(ci + 1).trim() }
  return null
}

// "TecerIlusão" → "Tecer Ilusão" (o extrato às vezes cola palavras no nome).
const fixName = (s) => s.replace(/([a-zà-ú])([A-ZÀ-Ú])/g, '$1 $2')

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// O extrato do PDF insere espaços dentro de algumas palavras. Correções seguras
// (splits inequívocos, sem colisão com texto legítimo) observadas nos rituais.
const ARTIFACTS = [
  ['Vonta de', 'Vontade'],
  ['pes soal', 'pessoal'],
  ['dif ícil', 'difícil'],
  ['superf ície', 'superfície'],
  ['benef ício', 'benefício'],
  ['f ísic', 'físic'],
]
function cleanArtifacts(s) {
  for (const [a, b] of ARTIFACTS) s = s.split(a).join(b)
  return s
}

function dehyphenateJoin(arr) {
  let out = ''
  for (const line of arr) {
    if (out === '') { out = line; continue }
    if (/[a-zà-ú]-$/.test(out)) out = out.slice(0, -1) + line
    else out += ' ' + line
  }
  return out.replace(/\s+/g, ' ').trim()
}

const rituals = []
for (let a = 0; a < anchors.length; a++) {
  const anchorIdx = anchors[a]
  const name = fixName(cleanArtifacts(lines[anchorIdx - 1]))
  const tokens = lines[anchorIdx].split(/\s+/)
  const elements = []
  let circle = null
  for (let t = 0; t < tokens.length; t += 2) {
    if (ELEM[tokens[t]]) { elements.push(ELEM[tokens[t]]); circle = parseInt(tokens[t + 1], 10) }
  }

  const bodyEnd = a + 1 < anchors.length ? anchors[a + 1] - 1 : lines.length
  const body = lines.slice(anchorIdx + 1, bodyEnd)

  const stat = {}
  let di = 0
  let last = null
  while (di < body.length) {
    const m = matchStat(body[di])
    if (m) { last = m.field; stat[last] = m.value; di++ }
    else if (last && last !== 'duration' && last !== 'resistance') { stat[last] += ' ' + body[di]; di++ }
    else break
  }
  const description = cleanArtifacts(dehyphenateJoin(body.slice(di)))

  rituals.push({
    id: slug(name),
    name,
    circle,
    elements,
    execution: cleanArtifacts(stat.execution || ''),
    range: cleanArtifacts(stat.range || ''),
    target: cleanArtifacts(stat.target || ''),
    duration: cleanArtifacts(stat.duration || ''),
    resistance: cleanArtifacts(stat.resistance || ''),
    description,
  })
}

// ids únicos (não deve haver colisão; falha ruidosamente se houver)
const seen = new Set()
for (const r of rituals) {
  if (seen.has(r.id)) throw new Error(`id de ritual duplicado: ${r.id}`)
  seen.add(r.id)
}

fs.writeFileSync(OUT_JSON, JSON.stringify(rituals, null, 2), 'utf-8')

// docs/regras-rituais.md — referência humana curada (fonte documental do pipeline)
const byCircle = [1, 2, 3, 4]
let md = '# Rituais — Ordem Paranormal (Cap. 5)\n\n'
md += '> Digitalizado do livro (extrato de texto). Rituais organizados por círculo (1º–4º) e elemento.\n'
md += '> Ocultista "Escolhido pelo Outro Lado": 3 rituais de 1º círculo iniciais + 1 a cada NEX; círculos liberados em NEX 5/25/55/85%.\n\n'
for (const c of byCircle) {
  const rs = rituals.filter((r) => r.circle === c).sort((a, b) => a.name.localeCompare(b.name))
  md += `## ${c}º Círculo (${rs.length})\n\n`
  for (const r of rs) {
    md += `### ${r.name}\n`
    md += `**Elemento:** ${r.elements.map((e) => ELEM_PT[e]).join(' / ')} · **Círculo:** ${r.circle}\n\n`
    md += `- Execução: ${r.execution} · Alcance: ${r.range} · Alvo/Área: ${r.target} · Duração: ${r.duration}`
    if (r.resistance) md += ` · Resistência: ${r.resistance}`
    md += `\n\n${r.description}\n\n`
  }
}
fs.writeFileSync(OUT_DOC, md, 'utf-8')

// diagnóstico
const byC = {}
rituals.forEach((r) => { byC[r.circle] = (byC[r.circle] || 0) + 1 })
const missing = rituals.filter((r) => !r.execution || !r.duration || !r.description || !r.circle || r.elements.length === 0)
console.log(`Extraídos ${rituals.length} rituais. Por círculo: ${JSON.stringify(byC)}`)
console.log(`Multi-elemento: ${rituals.filter((r) => r.elements.length > 1).map((r) => r.name).join(', ') || '(nenhum)'}`)
console.log(`Campos faltando (${missing.length}): ${missing.map((r) => r.name + ' [' + [!r.execution && 'exec', !r.duration && 'dur', !r.description && 'desc', !r.circle && 'circ', !r.elements.length && 'elem'].filter(Boolean).join(',') + ']').join(' | ') || '(nenhum)'}`)
