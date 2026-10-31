import { describe, it, expect } from 'vitest'
import type { ConditionalRollNote, FeatureEffects } from '../../types/effects'
import { getProgressionOptions } from '../../utils/progressionOptions'
import progressionFeatures from '../class-progression-features.json'
import progressionChoices from '../progression-choices.json'
import featsData from '../feats.json'
import racesData from '../races.json'

/**
 * Vantagem em teste de resistência que depende da situação ("contra veneno", "contra magia", "para
 * evitar armadilhas") é nota na receita dos TR do jogo (`conditionalRolls`, a regra de ouro do
 * CLAUDE.md): a ficha não sabe contra o que é o teste, e a mesa marca o modo na folha. Sem a
 * declaração, a vantagem só existia no texto da característica, e o jogo não a lembrava — o defeito
 * da Resiliência dos Robustos (2026-10-31). O mesmo desenho do teste das defesas
 * (`damageDefenses.test.ts`): tudo que pode declarar a nota, com onde está.
 */
type Entry = { where: string; name: string; text: string; notes: ConditionalRollNote[]; toggledAdvantage: boolean }
type Described = { name: string; description?: string; effects?: FeatureEffects }

/** O efeito ligado dá a vantagem nos TR (a Fúria, nos de Força): a vantagem já vale com ele ligado. */
function hasToggledSaveAdvantage(effects: FeatureEffects | undefined): boolean {
  const groups = [effects?.toggle, ...(effects?.toggleModifiers ?? [])].flatMap(t => (t
    ? [t.effects ?? [], t.benefits?.effects ?? [], ...('options' in t ? (t.options ?? []).map(o => o.effects ?? []) : [])]
    : []))
  return groups.flat().some(e => e.kind === 'rollMode' && e.mode === 'advantage' && e.rolls.includes('save'))
}

const toEntry = (where: string) => (x: Described): Entry => ({
  where,
  name: x.name,
  text: x.description ?? '',
  notes: x.effects?.conditionalRolls ?? [],
  toggledAdvantage: hasToggledSaveAdvantage(x.effects),
})

const races = racesData as unknown as (Described & { id: string; traits: Described[]; subraces: (Described & { id: string; traits: Described[] })[] })[]
const features = progressionFeatures as unknown as Record<'classes' | 'subclasses', Record<string, Described[]>>
const optionLists = [...new Set(Object.values(progressionChoices as Record<string, { optionsListId: string }[]>)
  .flat().map(slot => slot.optionsListId))]
  .filter(id => id !== 'spells')

const ENTRIES: Entry[] = [
  ...races.flatMap(r => [
    ...r.traits.map(toEntry(`raça ${r.id}`)),
    ...r.subraces.flatMap(s => s.traits.map(toEntry(`sub-raça ${s.id}`))),
  ]),
  ...Object.entries(features.classes).flatMap(([id, list]) => list.map(toEntry(`classe ${id}`))),
  ...Object.entries(features.subclasses).flatMap(([id, list]) => list.map(toEntry(`subclasse ${id}`))),
  ...(featsData as unknown as Described[]).map(toEntry('talento')),
  ...optionLists.flatMap(id => (getProgressionOptions(id) as Described[]).map(toEntry(`opção ${id}`))),
]

/**
 * O texto fala de vantagem em teste de resistência, na mesma frase. As formas do livro e dos dados:
 * "vantagem em testes de resistência contra veneno", "vantagem nos testes de resistência", "vantagem
 * em todos os testes de resistência de Inteligência…" (Esperteza Gnômica) e "vantagem em
 * resistências de Destreza" (Sentido de Perigo). O `\b` deixa de fora a "desvantagem".
 */
const MENTIONS_SAVE_ADVANTAGE = new RegExp(
  '\\bvantagem\\b[^.;]*?(?:testes? de resistência'
  + '|resistências? de (?:Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma))',
  'i',
)

/** A nota alcança os testes de resistência. */
const notesSaves = (e: Entry) => e.notes.some(n => n.rolls.includes('save'))

/**
 * O texto fala da vantagem, mas ela não é uma nota dos TR da ficha: fica com o motivo. Quando a onda
 * que a liga chegar, ela sai daqui (e o teste cobra a declaração).
 */
const EXCEPTIONS: Record<string, string> = {
  'raça half-elf: Ancestral Feérico':
    'divergência pt-BR × inglês com o dono: "contra encantamento" no pt-BR (pág. 39, linhas 3028-3030), "against being charmed" no inglês',
  'subclasse hunter: Táticas Defensivas': 'o texto resume as três opções: a vantagem está na opção (hunter-defensive-tactics: Vontade de Aço)',
  'classe bard: Canção de Proteção': 'só durante a atuação, que começa com uma ação, e alcança também os aliados (onda de ações)',
  'subclasse oath-of-devotion: Halo Sagrado': 'só durante o Halo Sagrado, que começa com uma ação (onda de ações)',
  'subclasse beast-master: Defesa da Besta': 'a vantagem é do companheiro animal',
  'subclasse wild-magic: Marés de Caos': 'a vantagem é o próprio uso do recurso, que o jogador escolhe gastar na jogada',
  'talento: Conjurador de Guerra':
    'a vantagem é a da concentração: o guia a põe no TR de concentração e a nota no TR de Constituição (hasWarCaster, rollGuide)',
}

describe('a vantagem nos testes de resistência que depende da situação vira nota (conditionalRolls)', () => {
  it('lê os traços, as features, os talentos e as opções', () => {
    expect(ENTRIES.some(e => e.name === 'Resiliência dos Robustos')).toBe(true)
    expect(ENTRIES.some(e => e.where === 'opção hunter-defensive-tactics' && e.name === 'Vontade de Aço')).toBe(true)
    expect(ENTRIES.some(e => e.where === 'talento' && e.name === 'Matador de Conjuradores')).toBe(true)
  })

  it('a procura reconhece as formas do texto e deixa a desvantagem de fora', () => {
    expect(MENTIONS_SAVE_ADVANTAGE.test('Você tem vantagem em resistências de Destreza contra efeitos que possa ver.')).toBe(true)
    expect(MENTIONS_SAVE_ADVANTAGE.test('Vantagem em todos os testes de resistência de Inteligência, Sabedoria e Carisma contra magia.')).toBe(true)
    expect(MENTIONS_SAVE_ADVANTAGE.test('a criatura terá desvantagem no teste de resistência que ela fizer')).toBe(false)
    // Vantagem numa frase, resistência a dano em outra (Resiliência Anã escrita assim não é TR).
    expect(MENTIONS_SAVE_ADVANTAGE.test('Vantagem em ataques. Resistência a dano de fogo.')).toBe(false)
  })

  it('a vantagem do efeito ligado conta como declarada: a Fúria, nos TR de Força', () => {
    const rage = ENTRIES.find(e => e.where === 'classe barbarian' && e.name === 'Fúria')
    expect(MENTIONS_SAVE_ADVANTAGE.test(rage?.text ?? '')).toBe(true)
    expect(rage?.toggledAdvantage).toBe(true)
  })

  // Decisão do dono (2026-10-31): o mesmo defeito da Resiliência dos Robustos, conferido no extrato.
  it.each([
    ['raça elf', 'Ancestral Feérico', 'vantagem se o teste de resistência for contra ficar enfeitiçado (pág. 23).'],
    ['opção hunter-defensive-tactics', 'Vontade de Aço', 'vantagem se o teste de resistência for contra ficar amedrontado (pág. 121).'],
    ['subclasse abjuration', 'Resistência à Magia', 'vantagem se o teste de resistência for contra magia (pág. 98).'],
    ['talento', 'Explorador de Cavernas', 'vantagem se o teste de resistência for para evitar ou resistir a armadilhas (pág. 169).'],
    ['talento', 'Matador de Conjuradores',
      'vantagem se o teste de resistência for contra magia conjurada por uma criatura a até 1,5 m de você (pág. 170).'],
  ])('%s: %s declara a nota nos TR', (where, name, text) => {
    const entry = ENTRIES.find(e => e.where === where && e.name === name)
    expect(entry?.notes).toEqual([{ rolls: ['save'], text }])
  })

  // Os que o teste achou além da lista do dono, com o texto do livro tão claro quanto o dela.
  it('Esperteza Gnômica só nos TR de Inteligência, Sabedoria e Carisma (pág. 37)', () => {
    const gnome = ENTRIES.find(e => e.where === 'raça gnome' && e.name === 'Esperteza Gnômica')
    expect(gnome?.notes).toEqual([
      { rolls: ['save'], abilities: ['INT', 'WIS', 'CHA'], text: 'vantagem se o teste de resistência for contra magia (pág. 37).' },
    ])
  })

  it('toda característica que fala de vantagem em teste de resistência declara a nota, ou está nas exceções com o motivo', () => {
    const forgotten = ENTRIES
      .filter(e => MENTIONS_SAVE_ADVANTAGE.test(e.text) && !notesSaves(e) && !e.toggledAdvantage && !EXCEPTIONS[`${e.where}: ${e.name}`])
      .map(e => `${e.where}: ${e.name}`)
    expect(forgotten).toEqual([])
  })

  it('as exceções existem, falam da vantagem e continuam sem a nota', () => {
    for (const key of Object.keys(EXCEPTIONS)) {
      const entry = ENTRIES.find(e => `${e.where}: ${e.name}` === key)
      expect(entry, key).toBeDefined()
      expect(notesSaves(entry!), key).toBe(false)
      expect(entry?.toggledAdvantage, key).toBe(false)
      expect(MENTIONS_SAVE_ADVANTAGE.test(entry?.text ?? ''), key).toBe(true)
    }
  })
})
