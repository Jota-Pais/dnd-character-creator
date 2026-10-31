import { describe, it, expect } from 'vitest'
import type { DamageTypeId } from '../../types/damage'
import type { LevelStep } from '../../types/effects'
import type { Spell } from '../../types/spell'
import type { SpellAmountPart, SpellMechanics, SpellMechanicsBatch } from '../../types/spellMechanics'
import { ABILITY_LABELS } from '../../utils/abilityScoreUtils'
import { ACTIVE_EFFECT_CATALOG } from '../../utils/activeEffects'
import { getDamageLabel, getDamageTypeName } from '../../utils/damageTypes'
import { SPELL_BATCH_LEVELS, SPELL_MECHANICS, getSpellBatch } from '../../utils/spellMechanics'
import spellsData from '../spells.json'

/**
 * O dano estruturado de magia contra o texto da magia (Fase 2, onda `magias-base`; o processo em
 * `docs/magias/mecanica-magias.md`). O extrato do livro fica fora do git (cache local), então o CI
 * confere com o texto do `spells.json`, que é o do livro digitalizado: um erro de digitação no
 * dado, no tipo ou no atributo do TR deixa de casar com o texto e falha aqui. A revisão contra o
 * extrato (as `bookLines`) é a do `scripts/draft-spell-mechanics.mjs --check`.
 */

const SPELLS = new Map((spellsData as Spell[]).map(s => [s.id, s]))

/**
 * Os lotes fechados: toda magia dos níveis deles tem entrada, revisada ou só no texto com o motivo.
 * O lote entra aqui no commit que o fecha.
 */
const CLOSED_BATCHES: SpellMechanicsBatch[] = ['T']

/**
 * O dano por extenso que o texto da magia usa no lugar do de `damage-types.json`, só redação: o
 * livro escreve "dano ácido" na pág. 198 e no Espirro Ácido, e o app fica com "dano de ácido", a
 * forma que ele mais usa (CLAUDE.md, "Tipos de dano").
 */
const LABEL_VARIANTS: Partial<Record<DamageTypeId, string[]>> = { acid: ['dano ácido'] }

const NUMBER_WORDS: Record<number, string[]> = {
  1: ['um', 'uma'], 2: ['dois', 'duas'], 3: ['três'], 4: ['quatro'], 5: ['cinco'], 6: ['seis'],
}

/**
 * As frases que dizem como a magia resolve. A conferência vale nos dois sentidos: a resolução
 * declarada precisa estar no texto, e a frase no texto precisa da resolução que ela diz — sem isso,
 * 'none' no lugar de 'half', ou o ataque e o TR omitidos, passariam.
 */
const SAVE_IN_TEXT = /teste de resistência de (Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/
const ATTACK_IN_TEXT = /ataque (corpo-a-corpo|à distância) com magia/
const HALF_IN_TEXT = /metade (desse|do) dano/

/**
 * As magias cujo texto tem a frase do TR, do ataque, da metade ou da CD sem que ela seja a
 * resolução da magia (o Raio Adoecente: o TR de Constituição vem depois do acerto, e a resolução é
 * o ataque), com o motivo. O lote T não tem nenhuma; cada lote acrescenta as suas.
 */
const RESOLUTION_EXCEPTIONS: Record<string, string> = {}

/** O texto de uma linha só, sem o "## " dos títulos que a digitalização deixou no meio do parágrafo. */
const flat = (text: string) => text.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ')

/** O parágrafo "Em níveis superiores", quando a magia o tem. */
function higherLevels(spell: Spell): string | null {
  const at = spell.description.search(/^## Em níveis superiores/im)
  return at < 0 ? null : flat(spell.description.slice(at).replace(/^## Em níveis superiores/i, ''))
}

/** O texto diz os degraus 5º, 11º e 17º com os dados de cada um ("5° nível (2d10)"). */
function stepsInText(text: string, steps: LevelStep[], sides: number): boolean {
  return [5, 11, 17].every(level => {
    const value = steps.find(s => s.from === level)?.value
    return value !== undefined && text.includes(`${level}° nível (${value}d${sides})`)
  })
}

const isCantripSteps = (steps: LevelStep[] | undefined) =>
  !!steps && steps.map(s => s.from).join() === '1,5,11,17'

/** A quantia (cura, PV temporários, PV máximo) bate com o texto: o dado literal e o modificador. */
function amountProblems(label: string, part: SpellAmountPart, text: string): string[] {
  const problems: string[] = []
  if (part.count !== undefined && part.sides !== undefined && !text.includes(`${part.count}d${part.sides}`)) {
    problems.push(`${label}: "${part.count}d${part.sides}" não está no texto`)
  }
  if (part.bonus === 'spellcastingModifier' && !text.includes('modificador de habilidade de conjuração')) {
    problems.push(`${label}: o modificador de conjuração não está no texto`)
  }
  return problems
}

/**
 * O que o texto diz da resolução e a entrada revisada não declara: o TR, a metade no sucesso dele,
 * o ataque e a CD da magia. Fora as exceções com motivo (`RESOLUTION_EXCEPTIONS`).
 */
function resolutionInTextProblems(entry: SpellMechanics, text: string): string[] {
  const { resolution } = entry
  const problems: string[] = []
  const save = SAVE_IN_TEXT.exec(text)
  if (save && resolution.kind !== 'save') problems.push(`o texto diz "${save[0]}", e a resolução não é o TR`)
  if (save && HALF_IN_TEXT.test(text) && !(resolution.kind === 'save' && resolution.onSuccess === 'half')) {
    problems.push('o texto dá metade do dano no TR, e a resolução não dá metade no sucesso')
  }
  const attack = ATTACK_IN_TEXT.exec(text)
  if (attack && resolution.kind !== 'attack') problems.push(`o texto diz "${attack[0]}", e a resolução não é a jogada de ataque`)
  if (text.includes('CD da magia') && resolution.kind !== 'save') {
    problems.push('o texto fala da CD da magia, e a resolução não é o TR: o número fica de fora')
  }
  return problems
}

/**
 * O que a entrada declara e o texto da magia não diz, e o que o texto diz da resolução e a entrada
 * não declara. Vazio quando bate: o teste de cada entrada cobra isso, e os testes logo abaixo provam
 * que um erro de digitação aparece.
 */
function problemsOf(entry: SpellMechanics, exceptions: Record<string, string> = RESOLUTION_EXCEPTIONS): string[] {
  const spell = SPELLS.get(entry.id)
  if (!spell) return [`${entry.id}: não existe em spells.json`]
  const text = flat(spell.description)
  const problems: string[] = []
  if (getSpellBatch(spell.level) !== entry.batch) problems.push(`lote ${entry.batch}, mas a magia é de nível ${spell.level}`)
  const [from, to] = entry.bookLines
  if (!(from > 0 && to >= from)) problems.push(`bookLines inválidas: ${entry.bookLines.join('-')}`)

  if (entry.status === 'textOnly') {
    if (!entry.reason?.trim()) problems.push('textOnly sem motivo')
    // Só no texto: o guia não mostra meia receita.
    for (const key of ['damage', 'heal', 'tempHp', 'maxHpIncrease', 'instances', 'targetEffect'] as const) {
      if (entry[key] !== undefined) problems.push(`textOnly com ${key}: a receita sairia pela metade`)
    }
    return problems
  }
  if (entry.reason !== undefined) problems.push('revisada com motivo: o motivo é só do textOnly')

  const { resolution } = entry
  if (resolution.kind === 'save') {
    const save = `teste de resistência de ${ABILITY_LABELS[resolution.ability].long}`
    if (!text.includes(save)) problems.push(`"${save}" não está no texto`)
    if (resolution.onSuccess === 'half' && !/metade (desse|do) dano/.test(text)) problems.push('metade no sucesso, mas o texto não fala de metade')
  }
  if (resolution.kind === 'attack') {
    const attack = `ataque ${resolution.range === 'melee' ? 'corpo-a-corpo' : 'à distância'} com magia`
    if (!text.includes(attack)) problems.push(`"${attack}" não está no texto`)
  }
  if (!(entry.id in exceptions)) problems.push(...resolutionInTextProblems(entry, text))
  // O condicional da jogada é a frase do livro, como está no texto.
  if ((resolution.kind === 'attack' || resolution.kind === 'save') && resolution.note !== undefined && !text.includes(resolution.note)) {
    problems.push(`a nota da jogada "${resolution.note}" não está no texto`)
  }

  for (const [i, part] of (entry.damage ?? []).entries()) {
    const dice = `${part.count}d${part.sides}`
    const withBonus = typeof part.bonus === 'number' ? `${dice} + ${part.bonus}` : dice
    if (!text.includes(withBonus)) problems.push(`dano ${i + 1}: "${withBonus}" não está no texto`)
    if (part.bonus === 'spellcastingModifier' && !text.includes('modificador de habilidade de conjuração')) {
      problems.push(`dano ${i + 1}: o modificador de conjuração não está no texto`)
    }
    if (typeof part.type === 'string') {
      const labels = [getDamageLabel(part.type), ...(LABEL_VARIANTS[part.type] ?? [])]
      if (!labels.some(l => text.includes(l))) problems.push(`dano ${i + 1}: "${labels[0]}" não está no texto`)
    } else {
      for (const t of part.type.choose) {
        if (!text.includes(getDamageTypeName(t))) problems.push(`dano ${i + 1}: o tipo "${getDamageTypeName(t)}" da escolha não está no texto`)
      }
    }
    if (part.when !== undefined && !text.includes(part.when)) problems.push(`dano ${i + 1}: "${part.when}" não está no texto`)
    if (part.byCharacterLevel && !stepsInText(text, part.byCharacterLevel, part.sides)) {
      problems.push(`dano ${i + 1}: os degraus de nível de personagem não batem com o texto`)
    }
    if (part.byCharacterLevel && part.byCharacterLevel[0]?.value !== part.count) problems.push(`dano ${i + 1}: o 1º degrau não é a base`)
  }
  if (entry.heal) problems.push(...amountProblems('cura', entry.heal, text))
  if (entry.tempHp) problems.push(...amountProblems('PV temporários', entry.tempHp, text))
  if (entry.maxHpIncrease) problems.push(...amountProblems('PV máximo', entry.maxHpIncrease, text))

  if (entry.instances) {
    if (!text.includes(entry.instances.noun)) problems.push(`"${entry.instances.noun}" não está no texto`)
    const steps = entry.instances.byCharacterLevel
    const said = (level: number) => {
      const value = steps?.find(s => s.from === level)?.value ?? 0
      return (NUMBER_WORDS[value] ?? []).some(w => new RegExp(`${w} ${entry.instances?.noun}s? no ${level}° nível`).test(text))
    }
    if (steps && ![5, 11, 17].every(said)) problems.push('as instâncias por nível de personagem não batem com o texto')
  }
  if (entry.targets && !(NUMBER_WORDS[entry.targets.count] ?? []).some(w => new RegExp(`\\b${w}\\b`).test(text))) {
    problems.push(`${entry.targets.count} alvos, mas o número não está no texto`)
  }
  if (entry.area && !text.includes(entry.area.text)) problems.push(`a área "${entry.area.text}" não está no texto`)
  if (entry.targetEffect && !ACTIVE_EFFECT_CATALOG.some(t => t.id === entry.targetEffect)) {
    problems.push(`o efeito "${entry.targetEffect}" não está no catálogo (active-effects.json)`)
  }

  // "Em níveis superiores" fala de dano, cura ou PV ⇔ alguma parte cresce com o espaço.
  const higher = higherLevels(spell)
  const higherHp = higher !== null && /\bdano\b|\bcura\b|pontos de vida/.test(higher)
  const parts = [...(entry.damage ?? []), entry.heal, entry.tempHp, entry.maxHpIncrease]
  const scales = parts.some(p => p?.perSlotAbove !== undefined)
  if (higherHp && !scales) problems.push('"Em níveis superiores" fala de dano, cura ou PV, e nenhuma parte tem perSlotAbove')
  if (!higherHp && scales) problems.push('perSlotAbove sem "Em níveis superiores" que fale de dano, cura ou PV')

  // Truque de dano escala pelo nível de PERSONAGEM nos degraus 1/5/11/17: no dado ou nas instâncias.
  if (spell.level === 0 && entry.damage?.length) {
    const byDice = entry.damage.every(p => isCantripSteps(p.byCharacterLevel))
    const byInstances = isCantripSteps(entry.instances?.byCharacterLevel)
    if (!byDice && !byInstances) problems.push('truque de dano sem os degraus 1/5/11/17 de nível de personagem')
  }
  return problems
}

describe('dano estruturado de magia: as entradas', () => {
  it('os ids são únicos', () => {
    const ids = SPELL_MECHANICS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(SPELL_MECHANICS.map(m => [m.id, m] as const))('%s bate com o texto da magia', (_id, entry) => {
    expect(problemsOf(entry)).toEqual([])
  })

  it.each(CLOSED_BATCHES)('o lote %s fechado cobre 100% dos níveis dele', batch => {
    const levels = SPELL_BATCH_LEVELS[batch]
    const missing = [...SPELLS.values()]
      .filter(s => levels.includes(s.level) && !SPELL_MECHANICS.some(m => m.id === s.id))
      .map(s => s.name)
    expect(missing).toEqual([])
  })
})

/**
 * O lote T revisado (docs/magias/mecanica-magias.md, seção 3.1): os onze truques de dano com a
 * receita, e os que ficam só no texto, cada um pelo seu motivo — mudar a lista é decisão, não
 * acidente.
 */
describe('dano estruturado de magia: o lote T', () => {
  const batch = SPELL_MECHANICS.filter(m => m.batch === 'T')
  const ids = (pick: (m: SpellMechanics) => boolean) => batch.filter(pick).map(m => m.id).sort()

  it('os truques de dano', () => {
    expect(ids(m => (m.damage?.length ?? 0) > 0)).toEqual([
      'acid-splash', 'chill-touch', 'eldritch-blast', 'fire-bolt', 'poison-spray', 'produce-flame',
      'ray-of-frost', 'sacred-flame', 'shocking-grasp', 'thorn-whip', 'vicious-mockery',
    ])
  })

  it('os que ficam só no texto, a Ilusão Menor pelo teste contra a CD', () => {
    expect(ids(m => m.status === 'textOnly')).toEqual([
      'blade-ward', 'friends', 'guidance', 'minor-illusion', 'resistance', 'shillelagh', 'true-strike',
    ])
    expect(batch.find(m => m.id === 'minor-illusion')?.reason).toMatch(/contra a CD da magia/)
  })

  // A divergência pt-BR × inglês decidida pelo inglês (2026-10-31): o TR de Destreza da criatura
  // hostil que segura o objeto, contra a CD da magia; o sucesso evita a magia, sem dano nenhum.
  it('a Luz, revisada: o TR de Destreza, e o sucesso faz o que o texto diz', () => {
    expect(batch.find(m => m.id === 'light')).toMatchObject({ status: 'reviewed', resolution: { kind: 'save', ability: 'DEX', onSuccess: 'other' } })
  })

  it('o condicional da jogada vira nota: a vantagem do Toque Chocante e a cobertura da Chama Sagrada', () => {
    expect(batch.filter(m => 'note' in m.resolution).map(m => [m.id, m.resolution])).toEqual([
      ['sacred-flame', expect.objectContaining({ note: 'O alvo não recebe qualquer benefício de cobertura contra esse teste de resistência.' })],
      ['shocking-grasp', expect.objectContaining({ note: 'Você tem vantagem na jogada de ataque se o alvo estiver vestindo qualquer armadura de metal.' })],
    ])
  })

  it('a Rajada Mística escala nos feixes, e o dano de cada um fica em 1d10', () => {
    const blast = batch.find(m => m.id === 'eldritch-blast')
    expect(blast?.instances).toMatchObject({ noun: 'feixe', byCharacterLevel: [{ from: 1, value: 1 }, { from: 5, value: 2 }, { from: 11, value: 3 }, { from: 17, value: 4 }] })
    expect(blast?.damage).toEqual([{ count: 1, sides: 10, type: 'force' }])
  })
})

/**
 * A guarda funciona: uma entrada certa passa, e cada erro de digitação falha. A do Raio de Fogo
 * (pág. 274, linhas 26573-26586) é o exemplo; os lotes têm as suas no JSON.
 */
describe('dano estruturado de magia: a guarda contra erro de digitação', () => {
  const FIRE_BOLT: SpellMechanics = {
    id: 'fire-bolt',
    batch: 'T',
    bookLines: [26573, 26586],
    status: 'reviewed',
    resolution: { kind: 'attack', range: 'ranged' },
    damage: [{
      count: 1, sides: 10, type: 'fire',
      byCharacterLevel: [{ from: 1, value: 1 }, { from: 5, value: 2 }, { from: 11, value: 3 }, { from: 17, value: 4 }],
    }],
  }
  const damage = FIRE_BOLT.damage![0]

  it('a entrada certa passa', () => {
    expect(problemsOf(FIRE_BOLT)).toEqual([])
  })

  it('o dado, o tipo, o degrau e o ataque errados falham', () => {
    expect(problemsOf({ ...FIRE_BOLT, damage: [{ ...damage, sides: 8 }] }).join()).toMatch(/"1d8" não está no texto/)
    expect(problemsOf({ ...FIRE_BOLT, damage: [{ ...damage, type: 'cold' }] }).join()).toMatch(/"dano de frio" não está no texto/)
    expect(problemsOf({
      ...FIRE_BOLT,
      damage: [{ ...damage, byCharacterLevel: [{ from: 1, value: 1 }, { from: 5, value: 2 }, { from: 11, value: 4 }, { from: 17, value: 4 }] }],
    }).join()).toMatch(/degraus de nível de personagem não batem/)
    expect(problemsOf({ ...FIRE_BOLT, resolution: { kind: 'attack', range: 'melee' } }).join()).toMatch(/corpo-a-corpo com magia/)
    expect(problemsOf({ ...FIRE_BOLT, resolution: { kind: 'attack', range: 'ranged', note: 'Você tem vantagem se o alvo for inflamável.' } }))
      .toEqual(['a nota da jogada "Você tem vantagem se o alvo for inflamável." não está no texto'])
  })

  it('o atributo do TR e a metade no sucesso precisam estar no texto', () => {
    const problems = problemsOf({ ...FIRE_BOLT, resolution: { kind: 'save', ability: 'WIS', onSuccess: 'half' } })
    expect(problems).toContain('"teste de resistência de Sabedoria" não está no texto')
    expect(problems).toContain('metade no sucesso, mas o texto não fala de metade')
  })

  it('o truque de dano sem os degraus de personagem, o lote errado e o efeito fora do catálogo falham', () => {
    expect(problemsOf({ ...FIRE_BOLT, damage: [{ count: 1, sides: 10, type: 'fire' }] }))
      .toContain('truque de dano sem os degraus 1/5/11/17 de nível de personagem')
    expect(problemsOf({ ...FIRE_BOLT, batch: '1' })).toContain('lote 1, mas a magia é de nível 0')
    expect(problemsOf({ ...FIRE_BOLT, targetEffect: 'spell:fire-bolt' }).join()).toMatch(/não está no catálogo/)
  })

  it('perSlotAbove só com "Em níveis superiores" que fale de dano, cura ou PV', () => {
    expect(problemsOf({ ...FIRE_BOLT, damage: [{ ...damage, perSlotAbove: { count: 1 } }] }))
      .toContain('perSlotAbove sem "Em níveis superiores" que fale de dano, cura ou PV')
    // Mãos Flamejantes (pág. 256, linhas 24719-24739): o parágrafo fala de dano, e a entrada sem perSlotAbove falha.
    const burningHands: SpellMechanics = {
      id: 'burning-hands', batch: '1', bookLines: [24719, 24739], status: 'reviewed',
      resolution: { kind: 'save', ability: 'DEX', onSuccess: 'half' },
      damage: [{ count: 3, sides: 6, type: 'fire' }],
    }
    expect(problemsOf(burningHands)).toContain('"Em níveis superiores" fala de dano, cura ou PV, e nenhuma parte tem perSlotAbove')
    expect(problemsOf({ ...burningHands, damage: [{ count: 3, sides: 6, type: 'fire', perSlotAbove: { count: 1 } }] })).toEqual([])
  })

  it('nos dois sentidos: "nenhum dano" no lugar da metade, o TR e o ataque omitidos falham', () => {
    // Mãos Flamejantes (pág. 256, linhas 24719-24739): "metade desse dano se obtiver sucesso".
    const burningHands: SpellMechanics = {
      id: 'burning-hands', batch: '1', bookLines: [24719, 24739], status: 'reviewed',
      resolution: { kind: 'save', ability: 'DEX', onSuccess: 'half' },
      damage: [{ count: 3, sides: 6, type: 'fire', perSlotAbove: { count: 1 } }],
    }
    expect(problemsOf(burningHands)).toEqual([])
    expect(problemsOf({ ...burningHands, resolution: { kind: 'save', ability: 'DEX', onSuccess: 'none' } }))
      .toEqual(['o texto dá metade do dano no TR, e a resolução não dá metade no sucesso'])
    expect(problemsOf({ ...burningHands, resolution: { kind: 'none' } })).toEqual([
      'o texto diz "teste de resistência de Destreza", e a resolução não é o TR',
      'o texto dá metade do dano no TR, e a resolução não dá metade no sucesso',
    ])
    // O Raio de Fogo sem o ataque: a receita perderia o ataque e o crítico.
    for (const resolution of [{ kind: 'none' }, { kind: 'auto' }] as const) {
      expect(problemsOf({ ...FIRE_BOLT, resolution }))
        .toEqual(['o texto diz "ataque à distância com magia", e a resolução não é a jogada de ataque'])
    }
  })

  it('a CD da magia numa entrada revisada sem o TR falha (a Ilusão Menor)', () => {
    const minorIllusion: SpellMechanics = {
      id: 'minor-illusion', batch: 'T', bookLines: [24011, 24039], status: 'reviewed', resolution: { kind: 'none' },
    }
    expect(problemsOf(minorIllusion)).toEqual(['o texto fala da CD da magia, e a resolução não é o TR: o número fica de fora'])
  })

  it('a exceção com motivo cala as conferências da resolução no texto (o Raio Adoecente)', () => {
    // Raio Adoecente (pág. 273, linhas 26518-26533): o TR de Constituição vem depois do acerto.
    const rayOfSickness: SpellMechanics = {
      id: 'ray-of-sickness', batch: '1', bookLines: [26518, 26533], status: 'reviewed',
      resolution: { kind: 'attack', range: 'ranged' },
      damage: [{ count: 2, sides: 8, type: 'poison', perSlotAbove: { count: 1 } }],
    }
    expect(problemsOf(rayOfSickness)).toEqual(['o texto diz "teste de resistência de Constituição", e a resolução não é o TR'])
    expect(problemsOf(rayOfSickness, { 'ray-of-sickness': 'o TR vem depois do acerto e só decide o envenenado' })).toEqual([])
  })

  it('o textOnly pede motivo e não leva receita pela metade', () => {
    expect(problemsOf({ ...FIRE_BOLT, status: 'textOnly', damage: undefined })).toEqual(['textOnly sem motivo'])
    expect(problemsOf({ ...FIRE_BOLT, status: 'textOnly', reason: 'Depende do Mestre.' }))
      .toEqual(['textOnly com damage: a receita sairia pela metade'])
  })
})
