#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const CLASS_MAP = {
  'bardo': 'bard',
  'bruxo': 'warlock',
  'clérigo': 'cleric',
  'druida': 'druid',
  'feiticeiro': 'sorcerer',
  'mago': 'wizard',
  'paladino': 'paladin',
  'patrulheiro': 'ranger',
}

function normalizeSchool(school) {
  return school.trim().replace(/^aa/, 'a')
}

function parseClasses(val) {
  return val
    .replace(/^\[/, '').replace(/\]$/, '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(pt => CLASS_MAP[pt] ?? pt)
}

// Parse key: value lines from a frontmatter block string
function parseFrontmatter(block) {
  const result = {}
  for (const line of block.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (!key || !val) continue

    if (key === 'level') result[key] = parseInt(val, 10)
    else if (key === 'ritual' || key === 'concentration') result[key] = val === 'true'
    else if (key === 'classes') result[key] = parseClasses(val)
    else result[key] = val
  }
  if (result.school) result.school = normalizeSchool(result.school)
  return result
}

function extractDescription(content) {
  // Trim at any embedded frontmatter (missing --- separator in source file)
  const embeddedFm = content.search(/\n\nid: [a-z][\w-]+\n/)
  const trimmed = embeddedFm !== -1 ? content.slice(0, embeddedFm) : content

  const descIdx = trimmed.indexOf('## Descrição')
  if (descIdx !== -1) return trimmed.slice(descIdx).trim()

  // Fallback: strip H1 and italic line
  return trimmed
    .split('\n')
    .filter(l => !l.startsWith('# ') && !l.match(/^_Magia de/))
    .join('\n')
    .trim()
}

function main() {
  const raw = readFileSync(resolve(root, 'docs/magias/regras-magias.md'), 'utf-8')
    .replace(/\r\n/g, '\n')

  // Strategy: find all frontmatter blocks by locating lines that start a new spell.
  // A frontmatter block starts with `id: [kebab-case-id]` as the first meaningful line
  // (preceded by --- or blank lines) and contains the required fields.
  //
  // We use a two-pass approach:
  //  1. Split the entire file on `---` separator lines
  //  2. Identify which sections are frontmatter (contain `id: [kebab-id]` + spell fields)
  //  3. Group each frontmatter with the content section that follows it

  const SEP = '\n---\n'
  const sections = raw.split(SEP)

  const spells = []
  const seen = new Set()

  // Identify frontmatter sections: must contain 'id:' and at least 'name:' and 'level:'
  const FM_KEYS = ['id:', 'name:', 'level:', 'school:', 'classes:']
  function isFrontmatter(s) {
    const text = s.trimStart()
    return FM_KEYS.every(k => text.includes(k))
  }

  // Content sections: starts with # heading or ## section
  function isContent(s) {
    const text = s.trimStart()
    return text.startsWith('#') || text.startsWith('## ')
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    if (!isFrontmatter(section)) continue

    const fm = parseFrontmatter(section)
    if (!fm.id || seen.has(fm.id)) continue
    seen.add(fm.id)

    // Look ahead for the next content section (skip empty/separator sections)
    let contentRaw = ''
    for (let j = i + 1; j < Math.min(i + 4, sections.length); j++) {
      if (isContent(sections[j])) {
        contentRaw = sections[j]
        break
      }
    }

    spells.push({
      id: fm.id,
      name: fm.name ?? '',
      level: fm.level ?? 0,
      school: fm.school ?? '',
      classes: fm.classes ?? [],
      castingTime: fm.castingTime ?? '',
      range: fm.range ?? '',
      components: fm.components ?? '',
      duration: fm.duration ?? '',
      ritual: fm.ritual ?? false,
      concentration: fm.concentration ?? false,
      description: extractDescription(contentRaw),
    })
  }

  spells.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  mkdirSync(resolve(root, 'src/data'), { recursive: true })
  writeFileSync(
    resolve(root, 'src/data/spells.json'),
    JSON.stringify(spells, null, 2),
    'utf-8',
  )

  console.log(`✓ ${spells.length} magias exportadas para src/data/spells.json`)
  const byClass = {}
  for (const spell of spells) {
    for (const cls of spell.classes) {
      byClass[cls] = (byClass[cls] ?? 0) + 1
    }
  }
  for (const [cls, count] of Object.entries(byClass).sort()) {
    console.log(`  ${cls}: ${count}`)
  }

  const levels = {}
  for (const spell of spells) {
    levels[spell.level] = (levels[spell.level] ?? 0) + 1
  }
  console.log('Por nível:', levels)
}

main()
