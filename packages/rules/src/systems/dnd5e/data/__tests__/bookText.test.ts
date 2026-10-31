import { describe, it, expect } from 'vitest'
import { CLASSES } from '../../utils/classUtils'
import { stripInlineBold } from '../../utils/ruleText'
import { getSheetAttacks } from '../../utils/attackUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import weaponsData from '../weapons.json'
import spellsData from '../spells.json'
import spellMechanicsData from '../spell-mechanics.json'
import progressionFeatures from '../class-progression-features.json'
import invocationsData from '../eldritch-invocations.json'
import racesData from '../races.json'
import activeEffectsData from '../active-effects.json'
import combatActionsData from '../combat-actions.json'

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
  // Inglês: "it must be no larger than a 5-foot cube" (Ilusão Menor, pág. 250, linhas 24028-24030;
  // decisão de 2026-10-31). O pt-BR diz "1,5 metro cúbico", menos de um vigésimo do cubo de 1,5 m; o
  // próprio livro traduz a medida assim no Druidismo ("deve caber num cubo de 1,5 metro", pág. 242).
  it('a imagem da Ilusão Menor cabe num cubo de 1,5 metro (pt-BR: "1,5 metro cúbico")', () => {
    const spell = (spellsData as { id: string; description: string }[]).find(s => s.id === 'minor-illusion')
    expect(spell?.description).toContain('ela não pode ser maior que um cubo de 1,5 metro.')
    expect(spell?.description).not.toContain('metro cúbico')
  })
  it('Correntes de Cárceri exige o Pacto da Corrente — o pt-BR diz "característica Corrente de Cárceri", que não existe', () => {
    const invocation = (invocationsData as { id: string; prerequisite?: string }[]).find(i => i.id === 'correntes-de-carceri')
    expect(invocation?.prerequisite).toContain('Pacto da Corrente')
    expect(invocation?.prerequisite).not.toContain('Corrente de Cárceri')
  })
  // A frase da p. 197 não está nos dados: a decisão fica presa pelo comportamento.
  it('golpe desarmado é ataque corpo a corpo com arma sem ser arma: o Dano de Fúria vale nele (o pt-BR o opõe ao "ataque corpo-a-corpo armado")', () => {
    const barbarian: CharacterDraft = { ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'barbarian', level: 1 }
    const scores = { STR: 16, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
    const unarmed = getSheetAttacks(barbarian, scores).find(a => a.key === 'unarmed')
    expect(unarmed?.weapon).toBeNull()
    expect(unarmed?.notes).toContain('+2 de dano em fúria, sem armadura pesada (Dano de Fúria)')
  })
  // Inglês: "you have advantage on Dexterity saving throws" (Dodge, p. 194). O pt-BR diz "vantagem em
  // testes de Destreza", que são testes de habilidade (decisão de 2026-10-30). Presos a declaração do
  // efeito e o resumo da ação em combate (`combat-actions.json`), que o "?" da aba Ações mostra.
  it('Esquivar dá vantagem nos TR de Destreza, não nos testes (pt-BR: "vantagem em testes de Destreza")', () => {
    const dodge = (activeEffectsData as { id: string; effects?: { kind: string; rolls?: string[]; abilities?: string[] }[] }[])
      .find(t => t.id === 'action:dodge')
    const modes = dodge?.effects?.filter(e => e.kind === 'rollMode')
    expect(modes).toEqual([{ kind: 'rollMode', rolls: ['save'], abilities: ['DEX'], mode: 'advantage', scope: 'sheet' }])
    const summary = (combatActionsData as { id: string; summary?: string }[]).find(a => a.id === 'dodge')?.summary
    expect(summary).toContain('vantagem nos testes de resistência de Destreza')
    expect(summary).not.toContain('vantagem em testes de Destreza')
  })
  // Inglês: "that creature must succeed on a Dexterity saving throw to avoid the spell" (Luz, pág.
  // 255, linhas 24563-24565; decisão de 2026-10-31). O pt-BR diz "num teste de Destreza", que é teste
  // de habilidade: é o TR de Destreza contra a CD da magia, e o dano estruturado o declara, com a
  // condição do livro na nota (só no objeto segurado ou vestido por uma criatura hostil).
  it('Luz pede TR de Destreza para evitar a magia (pt-BR: "num teste de Destreza")', () => {
    const light = (spellsData as { id: string; description: string }[]).find(s => s.id === 'light')
    expect(light?.description).toContain('a criatura deve ser bem sucedida num teste de resistência de Destreza para evitar a magia')
    expect(light?.description).not.toContain('num teste de Destreza')
    const mechanics = (spellMechanicsData as { id: string; status: string; resolution: unknown }[]).find(m => m.id === 'light')
    expect(mechanics).toMatchObject({
      status: 'reviewed',
      resolution: { kind: 'save', ability: 'DEX', onSuccess: 'other', note: expect.stringContaining('objeto segurado ou vestido por uma criatura hostil') },
    })
  })
  // Inglês: "clean or soil an object no larger than 1 cubic foot" e "chill, warm, or flavor up to 1
  // cubic foot of nonliving material" (Prestidigitação, pág. 271, linhas 26200-26203; decisão de
  // 2026-10-31). O pt-BR traduz o pé cúbico por "1 metro cúbico", que é uns 35 pés cúbicos.
  it('Prestidigitação alcança o que cabe num cubo de 30 centímetros (pt-BR: "1 metro cúbico")', () => {
    const spell = (spellsData as { id: string; description: string }[]).find(s => s.id === 'prestidigitation')
    expect(spell?.description).toContain('limpa ou suja um objeto que caiba num cubo de 30 centímetros.')
    expect(spell?.description).toContain('melhora o sabor da matéria inorgânica que caiba num cubo de 30 centímetros, por 1 hora.')
    expect(spell?.description).not.toContain('metro cúbico')
  })
  // Inglês: "When you score a critical hit with a melee weapon attack". O pt-BR ("com uma arma
  // corpo-a-corpo") deixaria de fora o golpe desarmado com dado, onde o traço vale (decisão 21).
  it('Ataques Selvagens valem no ATAQUE corpo a corpo com arma (pt-BR: "com uma arma corpo-a-corpo")', () => {
    const halfOrc = (racesData as { id: string; traits: { name: string; description: string }[] }[]).find(r => r.id === 'half-orc')
    const text = halfOrc?.traits.find(t => t.name === 'Ataques Selvagens')?.description
    expect(text).toContain('Em um acerto crítico com um ataque corpo-a-corpo com arma')
    expect(text).not.toMatch(/crítico com (?:uma )?arma corpo-a-corpo/)
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

  it('Colheita Sinistra triplica o nível da MAGIA na necromancia (pt-BR: "o triplo do seu nível")', () => {
    const [text] = featureText('Colheita Sinistra')
    expect(text).toContain('ou ao triplo se a magia for de necromancia')
  })

  it('Pedra de Transmutador troca de benefício com magia de TRANSMUTAÇÃO (pt-BR: "de conjuração")', () => {
    const [text] = featureText('Pedra de Transmutador')
    expect(text).toContain('Ao conjurar uma magia de transmutação de 1° nível ou superior')
  })

  // Inglês: "Whenever you hit a creature with a melee weapon". "Ataque corpo-a-corpo" alcançaria o
  // golpe desarmado, que é ataque corpo a corpo com arma sem ser arma (decisão de 2026-10-29).
  it('Destruição Divina Aprimorada exige ARMA corpo a corpo (pt-BR: "com um ataque corpo-a-corpo")', () => {
    const [text] = featureText('Destruição Divina Aprimorada')
    expect(text).toContain('Sempre que você atingir uma criatura com uma arma corpo-a-corpo')
    expect(text).not.toMatch(/ataques? corpo-a-corpo/)
  })

  // Inglês: "if your turn ends and you haven't attacked a hostile creature since your last turn or
  // taken damage since then" — só termina sem ataque E sem dano. O pt-BR ("não tiver atacado [...] ou
  // não tiver sofrido dano") se lê como "falta qualquer um dos dois" (decisão de 2026-10-30).
  it('a Fúria só termina antes sem ataque E sem dano (pt-BR: "não tiver atacado [...] ou não tiver sofrido dano")', () => {
    const [text] = featureText('Fúria')
    expect(text).toContain('sem que você tenha atacado uma criatura hostil nem sofrido dano desde o seu último turno')
    expect(text).not.toContain('ou não tiver sofrido dano')
    const rage = groups.classes.barbarian.find(f => f.name === 'Fúria') as Feature & { effects?: { toggle?: { earlyEndReminder?: string } } }
    expect(rage.effects?.toggle?.earlyEndReminder)
      .toBe('A fúria acaba no fim do seu turno se, desde o seu último turno, você não atacou nenhuma criatura hostil nem sofreu dano (pág. 48).')
  })

  it.each([
    ['cleric', 'as magias de clérigo com o descritor ritual que tiver preparadas'],
    ['druid', 'as magias de druida preparadas que tenham o descritor ritual'],
  ])('ritual do %s vale para as magias preparadas (pt-BR: "que você conheça")', (classId, expected) => {
    const casting = groups.classes[classId].find(f => f.name === 'Conjuração')
    expect(casting?.description).toContain(expected)
  })
})

/**
 * Erros de ortografia e concordância que vieram do livro ou da digitalização e foram corrigidos
 * (decisão do usuário, 2026-10-26: não mudam regra). A digitalização em docs/ foi corrigida junto
 * quando os dados saem dela (spells.json ← docs/magias), mas copiar o trecho do extract de novo os
 * traria de volta: cada forma errada fica presa aqui.
 */
describe('ortografia corrigida não volta', () => {
  const WRONG = [
    /\bespirito\b/, /\bimpõem desvantagem/, /amigos tem vantagem/, /pequenos explosões/,
    /\bpratica extensiva/, /que contem duas/, /mudanças não podem exceder/, /força magica/,
    /criaturas tem desvantagem/, /limos tem desvantagem/, /de um magia/, /circunstancia\b/,
    /influencia um criatura/, /\bdozes\b/, /\bficara cego/, /\bnevoa\b/, /\bobvio\b/, /\bpressagio\b/,
    /\bsolid[oa]\b/, /\bcubico\b/, /\bai[,.]? (?:então|pela)/,
    // "especifica" sem acento também é verbo ("você especifica um local"): só a forma adjetiva.
    /\bespecific(?:o|as)\b/, /(?:criatura|área|espécie|quão) especifica\b/,
    /\bmantem\b/, /\b\w+a-l[oa]s?\b/, /\bcompreende-lo\b/,
    // Livro de Segredos Antigos (invocação do bruxo, p. 61): eram duas magias no singular.
    /A magia aparece no livro e não conta/, /tenha aprendido elas/, /encontrar tais magias, você pode adicioná-la/,
  ]
  const lines = Object.entries(DATA).flatMap(([path, mod]) => collectLines(path.replace('../', ''), mod.default))

  it.each(WRONG.map(re => [re.source, re] as const))('%s', (_source, re) => {
    const found = lines.filter(l => re.test(l.line))
    expect(found.map(l => `${l.file} (${l.key}): ${l.line.slice(0, 100)}`)).toEqual([])
  })
})
