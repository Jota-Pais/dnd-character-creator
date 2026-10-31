import { describe, it, expect, vi } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { ClassChoiceSelections } from '../../types/class'
import type { PlayState } from '../../types/playState'
import type { SpellMechanics } from '../../types/spellMechanics'
import * as guideEntries from '../guideEntries'
import { createPlayState } from '../playState'
import * as rollGuide from '../rollGuide'
import { getRollGuide } from '../rollGuide'
import { findSpellGuideEntry, getCasterSpellGuides, getSpellGuide, spellGuideRolls } from '../spellGuide'
import { scaledDiceCount, scaledFlat } from '../spellMechanics'

/**
 * Entradas de mentira para as magias de 1º nível ou mais, que chegam nos lotes seguintes: só para
 * exercitar a conta do espaço acima, a cura e os PV temporários. Não são dado revisado — os
 * truques, sim, vêm de `data/spell-mechanics.json`.
 */
const FIXTURES = vi.hoisted(() => ({
  'burning-hands': {
    id: 'burning-hands', batch: '1', bookLines: [1, 1], status: 'reviewed',
    resolution: { kind: 'save', ability: 'DEX', onSuccess: 'half' },
    damage: [{ count: 3, sides: 6, type: 'fire', perSlotAbove: { count: 1 } }],
  },
  'cure-wounds': {
    id: 'cure-wounds', batch: '1', bookLines: [1, 1], status: 'reviewed',
    resolution: { kind: 'none' },
    heal: { count: 1, sides: 8, bonus: 'spellcastingModifier', perSlotAbove: { count: 1 } },
  },
  'false-life': {
    id: 'false-life', batch: '1', bookLines: [1, 1], status: 'reviewed',
    resolution: { kind: 'none' },
    tempHp: { count: 1, sides: 4, flat: 4, perSlotAbove: { flat: 5 } },
  },
  'spiritual-weapon': {
    id: 'spiritual-weapon', batch: '2', bookLines: [1, 1], status: 'reviewed',
    resolution: { kind: 'attack', range: 'melee' },
    damage: [{ count: 1, sides: 8, bonus: 'spellcastingModifier', type: 'force', perSlotAbove: { count: 1, every: 2 } }],
  },
  thunderwave: {
    id: 'thunderwave', batch: '1', bookLines: [1, 1], status: 'reviewed',
    resolution: { kind: 'save', ability: 'CON', onSuccess: 'half' },
    damage: [{ count: 2, sides: 8, type: 'thunder', perSlotAbove: { count: 1 } }],
  },
  'hellish-rebuke': {
    id: 'hellish-rebuke', batch: '1', bookLines: [1, 1], status: 'reviewed',
    resolution: { kind: 'save', ability: 'DEX', onSuccess: 'half' },
    damage: [{ count: 2, sides: 10, type: 'fire', perSlotAbove: { count: 1 } }],
  },
}) as Record<string, SpellMechanics>)

vi.mock('../spellMechanics', async importOriginal => {
  const actual = await importOriginal<typeof import('../spellMechanics')>()
  return { ...actual, getSpellMechanics: (id: string) => FIXTURES[id] ?? actual.getSpellMechanics(id) }
})

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

const choices = (c: Partial<ClassChoiceSelections>): ClassChoiceSelections =>
  ({ ...structuredClone(EMPTY_DRAFT.classChoices), ...c })

/** FOR +3, DES +2, CON +2, INT +3, SAB +3, CAR +3. */
const SCORES = { STR: 16, DEX: 14, CON: 14, INT: 16, WIS: 16, CHA: 16 }

const caster = (classId: string, level: number, cantrips: string[], spells: string[] = []) => draft({
  class: classId, level, abilityScores: SCORES, classChoices: choices({}),
  spellChoices: { cantrips, spells },
})

function play(patch: Partial<PlayState> = {}): PlayState {
  return { ...createPlayState('c1'), ...patch }
}

describe('guia da magia: os truques do lote T', () => {
  // Decisão de 2026-10-29 (regras-conjuracao.md, seção 2): o truque cresce pelo nível de PERSONAGEM.
  it('Raio de Fogo para guerreiro 4 / mago 1: 2d10, e o crítico 4d10', () => {
    const d = draft({
      class: 'fighter', level: 5, abilityScores: SCORES, classChoices: choices({}),
      additionalClasses: [{
        classId: 'wizard', level: 1, classChoices: choices({}),
        spellChoices: { cantrips: ['fire-bolt'], spells: [] }, asiChoices: [], hpRolls: [],
      }],
    })
    const guide = getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'fire-bolt' })!
    expect(guide.damage).toHaveLength(1)
    expect(guide.damage[0]).toMatchObject({
      label: 'Raio de Fogo — dano', formula: '2d10 fogo', notation: '2d10', crit: { formula: '4d10 fogo', notation: '4d10' },
    })
    expect(guide.damage[0].notes).toContain('Truque: o dano cresce com o nível de personagem — 2d10 no 5º, 3d10 no 11º e 4d10 no 17º.')
    // O ataque é o da conjuração do mago: proficiência do nível de personagem 5 (+3) + INT +3.
    expect(guide.attack).toMatchObject({ label: 'Raio de Fogo — ataque', formula: '1d20 + 6', attackRoll: true })
    expect(guide.attack!.notes[0]).toBe('Ataque à distância com magia.')
    expect(guide.attack!.notes.some(n => n.startsWith('20 natural: acerta e é crítico'))).toBe(true)
    expect(guide.save).toBeUndefined()
  })

  it('o mago 4 ainda está no primeiro degrau, e o 11º e o 17º sobem o dado', () => {
    const at = (level: number) => getSpellGuide(caster('wizard', level, ['fire-bolt']), play(), { casterKey: 'class:wizard', spellId: 'fire-bolt' })!
    expect(at(4).damage[0].formula).toBe('1d10 fogo')
    expect(at(11).damage[0].formula).toBe('3d10 fogo')
    expect(at(17).damage[0].formula).toBe('4d10 fogo')
  })

  it('Chama Sagrada: o TR de Destreza do alvo com a CD do clérigo, sem jogada de ataque nem crítico', () => {
    const guide = getSpellGuide(caster('cleric', 1, ['sacred-flame']), play(), { casterKey: 'class:cleric', spellId: 'sacred-flame' })!
    // CD 8 + proficiência 2 + SAB 3. A cobertura que não vale é o condicional do TR, em linha própria.
    const cover = 'O alvo não recebe qualquer benefício de cobertura contra esse teste de resistência.'
    expect(guide.save).toEqual({ ability: 'DEX', dc: 13, onSuccess: 'none', text: 'TR de Destreza do alvo (CD 13): no sucesso, nenhum dano.', note: cover })
    expect(guide.attack).toBeUndefined()
    expect(guide.damage[0]).toMatchObject({ formula: '1d8 radiante' })
    expect(guide.damage[0].crit).toBeUndefined()
    expect(guide.damage[0].notes.slice(0, 2)).toEqual(['TR de Destreza do alvo (CD 13): no sucesso, nenhum dano.', cover])
  })

  it('Toque Chocante: a vantagem contra armadura de metal é nota do ataque, e o modo fica com a mesa', () => {
    const guide = getSpellGuide(caster('wizard', 1, ['shocking-grasp']), play(), { casterKey: 'class:wizard', spellId: 'shocking-grasp' })!
    expect(guide.attack!.notes.slice(0, 2)).toEqual([
      'Ataque corpo a corpo com magia.',
      'Você tem vantagem na jogada de ataque se o alvo estiver vestindo qualquer armadura de metal.',
    ])
    expect(guide.attack!.mode).toBe('normal')
    expect(guide.damage[0].formula).toBe('1d8 elétrico')
  })

  it('Rajada Mística no 5º nível de personagem: 2 feixes, um ataque para cada, 1d10 de energia em cada um', () => {
    const at = (level: number) => getSpellGuide(caster('warlock', level, ['eldritch-blast']), play(), { casterKey: 'class:warlock', spellId: 'eldritch-blast' })!
    const guide = at(5)
    expect(guide.instances).toEqual({ count: 2, noun: 'feixe', text: '2 feixes' })
    expect(guide.attack!.notes).toContain('2 feixes: uma jogada de ataque para cada um.')
    expect(guide.damage[0]).toMatchObject({ label: 'Rajada Mística — dano de cada feixe', formula: '1d10 energia', crit: { formula: '2d10 energia' } })
    expect(guide.damage[0].notes).toContain('2 feixes no seu nível: cada feixe que acerta causa este dano.')
    expect(guide.damage[0].notes).toContain('A quantidade de feixes cresce com o nível de personagem — 2 no 5º, 3 no 11º e 4 no 17º.')
    expect(at(4).instances?.text).toBe('1 feixe')
    expect(at(11).instances?.text).toBe('3 feixes')
    expect(at(17).instances?.text).toBe('4 feixes')
  })

  it('Espirro Ácido: até 2 alvos, o dano jogado uma vez para todos', () => {
    const guide = getSpellGuide(caster('wizard', 1, ['acid-splash']), play(), { casterKey: 'class:wizard', spellId: 'acid-splash' })!
    expect(guide.targets).toEqual({ count: 2, text: 'Até 2 alvos.' })
    expect(guide.damage[0].formula).toBe('1d6 ácido')
    expect(guide.damage[0].notes).toContain('Até 2 alvos. Jogue o dano uma única vez para todos (pág. 198).')
  })

  it('a magia só no texto (a Luz), a sem número (Mãos Mágicas: sem jogada) e a que não tem mecânica ainda', () => {
    const d = caster('wizard', 1, ['light', 'mage-hand'], ['magic-missile'])
    expect(getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'light' })).toBeNull()
    expect(spellGuideRolls(getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'mage-hand' })!)).toEqual([])
    expect(getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'magic-missile' })).toBeNull()
    expect(getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'nao-existe' })).toBeNull()
  })

  it('fora da conjuração (o truque do Alto Elfo): o dano, sem o ataque, com a nota', () => {
    const d = draft({
      class: 'fighter', level: 1, race: 'elf', subrace: 'high-elf', raceChoices: { cantrip: 'fire-bolt' },
      abilityScores: SCORES, classChoices: choices({}),
    })
    const guide = getSpellGuide(d, play(), { casterKey: null, spellId: 'fire-bolt' })!
    expect(guide.caster).toBeNull()
    expect(guide.attack).toBeUndefined()
    expect(guide.damage[0].formula).toBe('1d10 fogo')
    expect(guide.notes).toEqual(['Sem o ataque e a CD: a ficha ainda não os calcula para as magias de fora da conjuração de uma classe ou de um talento.'])
  })
})

/**
 * Os bônus da ficha no dano dos truques. Até a onda `magias-modificadores`, que os põe na fórmula
 * com a parcela nomeada, o guia os diz numa nota com o valor: a receita não passa por completa sem
 * eles. O Truque Potente já muda o texto do TR.
 */
describe('guia da magia: os bônus da ficha no dano dos truques', () => {
  const sub = (classId: string, level: number, subclass: string, cantrips: string[], progressionChoices: Record<string, string[]> = {}) => draft({
    class: classId, level, abilityScores: SCORES, classChoices: choices({ subclass, progressionChoices }),
    spellChoices: { cantrips, spells: [] },
  })
  const spellOf = (d: CharacterDraft, casterKey: string, spellId: string) => getSpellGuide(d, play(), { casterKey, spellId })!

  it('Explosão Agonizante (pág. 61): o bruxo 5 com CAR 16 lê o +3 de cada feixe, que a fórmula ainda não soma', () => {
    const blast = (choices: Record<string, string[]>) => spellOf(sub('warlock', 5, 'fiend', ['eldritch-blast'], choices), 'class:warlock', 'eldritch-blast')
    const guide = blast({ 'warlock-invocations-2': ['explosao-agonizante', 'visao-diabolica'] })
    const note = 'Explosão Agonizante: some +3 (Carisma) ao dano de cada feixe que acerta; a fórmula ainda não o inclui.'
    expect(guide.damage[0].formula).toBe('1d10 energia')
    expect(guide.damage[0].notes).toContain(note)
    // Na magia também: a aba Magia mostra a nota embaixo das jogadas, sem abrir a receita.
    expect(guide.notes).toEqual([note])
    expect(blast({ 'warlock-invocations-2': ['visao-diabolica'] }).notes).toEqual([])
  })

  it('Truque Potente (pág. 99): o mago evocador 6 dá metade do dano no sucesso do TR dos truques; o 5, ainda não', () => {
    const splash = (level: number) => spellOf(sub('wizard', level, 'evocation', ['acid-splash']), 'class:wizard', 'acid-splash')
    const text = 'TR de Destreza do alvo (CD 14): no sucesso, metade do dano (Truque Potente).'
    expect(splash(6).save).toMatchObject({ onSuccess: 'half', text })
    expect(splash(6).damage[0].notes[0]).toBe(text)
    expect(splash(5).save).toMatchObject({ onSuccess: 'none', text: 'TR de Destreza do alvo (CD 14): no sucesso, nenhum dano.' })
  })

  it('Evocação Potencializada (pág. 100): o evocador 10 lê o +INT nas magias de evocação de mago, não no Espirro Ácido', () => {
    const d = sub('wizard', 10, 'evocation', ['fire-bolt', 'acid-splash'])
    const bolt = spellOf(d, 'class:wizard', 'fire-bolt')
    expect(bolt.damage[0].formula).toBe('2d10 fogo')
    expect(bolt.notes).toEqual(['Evocação Potencializada (magias de evocação de mago): some +3 (Inteligência) ao dano; a fórmula ainda não o inclui.'])
    // O Espirro Ácido é de conjuração.
    expect(spellOf(d, 'class:wizard', 'acid-splash').notes).toEqual([])
  })

  it('Conjuração Poderosa (págs. 67 e 69): o clérigo da Luz 8 lê o +SAB nos truques de clérigo; o 7, ainda não', () => {
    const flame = (level: number) => spellOf(sub('cleric', level, 'light-domain', ['sacred-flame']), 'class:cleric', 'sacred-flame')
    expect(flame(8).damage[0].formula).toBe('2d8 radiante')
    expect(flame(8).notes).toEqual(['Conjuração Poderosa (truques de clérigo): some +3 (Sabedoria) ao dano; a fórmula ainda não o inclui.'])
    expect(flame(7).notes).toEqual([])
  })

  it('Afinidade Elemental (pág. 80): o feiticeiro dracônico 6 de ancestral Vermelho lê o +CAR no dano de fogo, não no de frio', () => {
    const d = sub('sorcerer', 6, 'draconic-bloodline', ['fire-bolt', 'ray-of-frost'], { 'draconic-ancestor-1': ['red'] })
    expect(spellOf(d, 'class:sorcerer', 'fire-bolt').notes)
      .toEqual(['Afinidade Elemental (dano de fogo do seu ancestral): some +3 (Carisma) ao dano; a fórmula ainda não o inclui.'])
    expect(spellOf(d, 'class:sorcerer', 'ray-of-frost').notes).toEqual([])
    // Sem o ancestral escolhido (a etapa Classe fica pendente), sem nota.
    expect(spellOf(sub('sorcerer', 6, 'draconic-bloodline', ['fire-bolt']), 'class:sorcerer', 'fire-bolt').notes).toEqual([])
  })
})

describe('guia da magia: o ataque é o da conjuração', () => {
  it('o mesmo número, modo, notação e "de onde vem" do ataque de magia do guia de rolagens', () => {
    const d = caster('wizard', 3, ['fire-bolt'])
    const state = play({ conditions: ['poisoned'], inspiration: true })
    const sc = getRollGuide(d, state).spellcasting[0].attack
    const attack = getSpellGuide(d, state, { casterKey: 'class:wizard', spellId: 'fire-bolt' })!.attack!
    const same = { id: sc.id, label: sc.label, notes: sc.notes }
    expect({ ...attack, ...same }).toEqual(sc)
    expect(attack.mode).toBe('disadvantage')
    // As notas da conjuração (o crítico, a Inspiração) vêm depois das da magia.
    expect(attack.notes.slice(1)).toEqual(sc.notes)
  })

  it('o modificador da cura é o da conjuração do guia de rolagens, o da CD e do ataque (uma conta só)', () => {
    const d = caster('cleric', 3, [], ['cure-wounds'])
    const rg = getRollGuide(d, play())
    expect(rg.spellcasting[0].abilityModifier).toBe(3)
    expect(rg.spellcasting[0].saveDcBreakdown).toContainEqual({ label: 'Sabedoria', value: 3 })
    // Se a conjuração do guia de rolagens mudar o modificador, a cura muda junto: ela não o recalcula.
    const changed = { ...rg, spellcasting: [{ ...rg.spellcasting[0], abilityModifier: 5 }] }
    const cure = getSpellGuide(d, play(), { casterKey: 'class:cleric', spellId: 'cure-wounds' }, changed)!.heal!
    expect(cure).toMatchObject({ formula: '1d8 + 5', breakdown: [{ label: 'Sabedoria', value: 5 }] })
  })

  it('o guia de rolagens monta pelas mesmas funções (a extração não copiou nada)', () => {
    expect(rollGuide.formatGuideFormula).toBe(guideEntries.formatGuideFormula)
    expect(rollGuide.formatGuideNotation).toBe(guideEntries.formatGuideNotation)
    const hitDie = getRollGuide(caster('wizard', 1, []), play()).hitDice[0]
    expect(hitDie).toEqual(guideEntries.healEntry({
      id: 'hit-die:6', label: 'Dado de Vida (d6)', ability: 'CON', dice: '1d6', modifier: 2,
      breakdown: [{ label: 'Constituição', value: 2 }], notes: [],
    }))
  })
})

describe('guia da magia: a folha aberta acompanha o estado', () => {
  it('o id remonta a jogada com o estado de agora, e o ataque leva ao dano', () => {
    const d = caster('wizard', 1, ['fire-bolt'])
    const attackId = getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'fire-bolt' })!.attack!.id
    expect(attackId).toBe('spell:fire-bolt:0:attack@class:wizard')
    const found = findSpellGuideEntry(d, play({ conditions: ['poisoned'] }), attackId)!
    expect(found.entry.mode).toBe('disadvantage')
    expect(found.guide.damage.map(e => e.id)).toEqual(['spell:fire-bolt:0:damage:0@class:wizard'])
    expect(findSpellGuideEntry(d, play(), 'spell-attack:wizard')).toBeNull()
    expect(findSpellGuideEntry(d, play(), 'spell:fire-bolt:0:damage:0@')!.entry.formula).toBe('1d10 fogo')
  })
})

describe('guia da magia: as magias de cada conjuração', () => {
  it('só as revisadas com algo a rolar, por nível e nome, uma lista por conjuração', () => {
    const d = caster('wizard', 1, ['ray-of-frost', 'light', 'mage-hand', 'fire-bolt'])
    const lists = getCasterSpellGuides(d, play())
    expect(lists.map(l => l.casterKey)).toEqual(['class:wizard'])
    expect(lists[0].guides.map(g => g.name)).toEqual(['Raio de Fogo', 'Raio de Gelo'])
  })

  it('o talento (Iniciado em Magia) tem a lista dele, com a CD do atributo da classe escolhida', () => {
    const d = draft({
      class: 'fighter', level: 4, abilityScores: SCORES, classChoices: choices({}),
      asiChoices: [{ kind: 'feat', featId: 'iniciado-em-magia' }],
      featSelections: { 'iniciado-em-magia': { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['bless'] } },
    })
    const lists = getCasterSpellGuides(d, play())
    const feat = lists.find(l => l.casterKey === 'feat:iniciado-em-magia')!
    expect(feat.guides.map(g => g.name)).toEqual(['Chama Sagrada'])
    expect(feat.guides[0].save?.dc).toBe(13)
  })
})

describe('guia da magia: o que cresce com o espaço', () => {
  it('a base mais o que cada nível acima soma, e o "a cada dois níveis"', () => {
    expect(scaledDiceCount({ count: 8, perSlotAbove: { count: 1 } }, { characterLevel: 5, slotsAbove: 2 })).toBe(10)
    expect(scaledDiceCount({ count: 1, perSlotAbove: { count: 1, every: 2 } }, { characterLevel: 5, slotsAbove: 1 })).toBe(1)
    expect(scaledDiceCount({ count: 1, perSlotAbove: { count: 1, every: 2 } }, { characterLevel: 5, slotsAbove: 2 })).toBe(2)
    expect(scaledFlat({ flat: 5, perSlotAbove: { flat: 5 } }, { characterLevel: 5, slotsAbove: 1 })).toBe(10)
    expect(scaledDiceCount({ count: 1, byCharacterLevel: [{ from: 1, value: 1 }, { from: 5, value: 2 }] }, { characterLevel: 7, slotsAbove: 0 })).toBe(2)
  })

  it('metade no sucesso do TR e o ganho do nível maior ("No 3º nível: 5d6 (+2d6)")', () => {
    const d = caster('wizard', 5, [], ['burning-hands'])
    const guide = getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'burning-hands', castLevel: 3 })!
    expect(guide.castLevel).toBe(3)
    expect(guide.damage[0].formula).toBe('5d6 fogo')
    expect(guide.save?.text).toBe('TR de Destreza do alvo (CD 14): no sucesso, metade do dano.')
    expect(guide.upcastGain).toBe('No 3º nível: 5d6 (+2d6)')
    expect(getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'burning-hands' })!.upcastGain).toBeUndefined()
    // Abaixo do nível da magia não existe: fica o da própria magia.
    expect(getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'burning-hands', castLevel: 0 })!.castLevel).toBe(1)
  })

  it('a cura com o modificador de conjuração e os PV temporários de valor fixo que crescem', () => {
    const d = caster('cleric', 3, [], ['cure-wounds', 'false-life'])
    const cure = getSpellGuide(d, play(), { casterKey: 'class:cleric', spellId: 'cure-wounds', castLevel: 2 })!
    expect(cure.heal).toMatchObject({ kind: 'heal', formula: '2d8 + 3', breakdown: [{ label: 'Sabedoria', value: 3 }] })
    const life = getSpellGuide(d, play(), { casterKey: 'class:cleric', spellId: 'false-life', castLevel: 2 })!
    expect(life.tempHp).toMatchObject({ formula: '1d4 + 9', breakdown: [{ label: 'Vitalidade Falsa', value: 9 }] })
    expect(life.upcastGain).toBe('No 2º nível: +9 (+5)')
  })

  it('o ataque corpo a corpo com o modificador no dano e o dado a cada dois níveis', () => {
    const d = caster('cleric', 5, [], ['spiritual-weapon'])
    const guide = getSpellGuide(d, play(), { casterKey: 'class:cleric', spellId: 'spiritual-weapon', castLevel: 4 })!
    expect(guide.attack!.notes[0]).toBe('Ataque corpo a corpo com magia.')
    expect(guide.damage[0]).toMatchObject({ formula: '2d8 + 3 energia', crit: { formula: '4d8 + 3 energia' } })
    expect(guide.upcastGain).toBe('No 4º nível: 2d8 (+1d8)')
  })
})

/**
 * Sem o espaço escolhido (a tela ainda não escolhe; o Conjurar da onda `grimorio` escolherá), a
 * magia sai no espaço que a fonte tem para ela: o de Pacto do bruxo, o nível fixo da inata.
 */
describe('guia da magia: o espaço que a fonte tem', () => {
  it('o bruxo conjura no espaço de Pacto: a onda trovejante do bruxo 5 sai como magia de 3º nível (pág. 58)', () => {
    const guide = getSpellGuide(caster('warlock', 5, [], ['thunderwave']), play(), { casterKey: 'class:warlock', spellId: 'thunderwave' })!
    expect(guide.castLevel).toBe(3)
    expect(guide.damage[0]).toMatchObject({ id: 'spell:thunderwave:3:damage:0@class:warlock', formula: '4d8 trovejante' })
    expect(guide.upcastGain).toBe('No 3º nível: 4d8 (+2d8)')
    expect(guide.notes).toEqual([])
  })

  it('com Conjuração e Magia de Pacto, o espaço mais baixo, e o de Pacto numa nota (pág. 166)', () => {
    // Bruxo 5 / mago 1: dois espaços de 1º do mago e dois de 3º do Pacto, que servem às magias das duas.
    const d = draft({
      class: 'warlock', level: 6, abilityScores: SCORES, classChoices: choices({}), spellChoices: { cantrips: [], spells: ['thunderwave'] },
      additionalClasses: [{
        classId: 'wizard', level: 1, classChoices: choices({}),
        spellChoices: { cantrips: [], spells: ['burning-hands'] }, asiChoices: [], hpRolls: [],
      }],
    })
    const wave = getSpellGuide(d, play(), { casterKey: 'class:warlock', spellId: 'thunderwave' })!
    expect(wave.castLevel).toBe(1)
    expect(wave.damage[0].formula).toBe('2d8 trovejante')
    expect(wave.notes).toEqual(['Com um espaço de Magia de Pacto, ela sai no 3º nível: 4d8 (+2d8).'])
    expect(getSpellGuide(d, play(), { casterKey: 'class:wizard', spellId: 'burning-hands' })!.notes)
      .toEqual(['Com um espaço de Magia de Pacto, ela sai no 3º nível: 5d6 (+2d6).'])
    // O espaço escolhido vale sobre o padrão.
    const chosen = getSpellGuide(d, play(), { casterKey: 'class:warlock', spellId: 'thunderwave', castLevel: 3 })!
    expect(chosen.damage[0].formula).toBe('4d8 trovejante')
    expect(chosen.notes).toEqual([])
  })

  it('a inata no nível que o traço fixa: a repreensão infernal do tiefling, como magia de 2º nível (pág. 43)', () => {
    const d = draft({ class: 'barbarian', level: 3, race: 'tiefling', abilityScores: SCORES, classChoices: choices({}) })
    expect(getSpellGuide(d, play(), { casterKey: null, spellId: 'hellish-rebuke', castLevel: 2 })!.damage[0].formula).toBe('3d10 fogo')
    // Fora da conjuração de uma classe, sem o nível passado, fica o da magia.
    expect(getSpellGuide(d, play(), { casterKey: null, spellId: 'hellish-rebuke' })!.castLevel).toBe(1)
  })

  it('o talento conjura no nível da magia, mesmo com espaços mais altos na ficha', () => {
    const d = draft({
      class: 'warlock', level: 5, abilityScores: SCORES, classChoices: choices({}),
      asiChoices: [{ kind: 'feat', featId: 'iniciado-em-magia' }],
      featSelections: { 'iniciado-em-magia': { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] } },
    })
    expect(getSpellGuide(d, play(), { casterKey: 'feat:iniciado-em-magia', spellId: 'cure-wounds' })!.castLevel).toBe(1)
  })
})
