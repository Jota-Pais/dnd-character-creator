import { describe, it, expect } from 'vitest'
import type { DamageDefenses } from '../../types/effects'
import type { ConditionId } from '../../types/condition'
import { isDamageTypeId } from '../../utils/damageTypes'
import { CONDITIONS } from '../../utils/sheetEffects'
import { getProgressionOptions } from '../../utils/progressionOptions'
import progressionFeatures from '../class-progression-features.json'
import progressionChoices from '../progression-choices.json'
import featsData from '../feats.json'
import racesData from '../races.json'

/** Tudo que pode declarar defesa, com onde está: traços, features de classe e subclasse, talentos e opções. */
type Entry = { where: string; name: string; text: string; defenses?: DamageDefenses }
type Described = { name: string; description?: string; effects?: { damageDefenses?: DamageDefenses } }

const toEntry = (where: string) => (x: Described): Entry =>
  ({ where, name: x.name, text: x.description ?? '', defenses: x.effects?.damageDefenses })

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
 * O texto fala de defesa contra dano ou de imunidade. As formas do livro e dos dados: "resistência a
 * dano de fogo", "resistência contra o dano causado por magias" (Resistência à Magia, p. 98).
 */
const MENTIONS_DEFENSE = /resist[êe]ncia (?:a|ao|à|contra) (?:o |todo |todos os tipos de |esse tipo de |o tipo de )?dano|imunes? a/i

/**
 * O texto fala de defesa, mas a defesa não é da ficha a toda hora: fica com o motivo. Quando a onda
 * que a liga chegar, ela sai daqui (e o teste cobra a declaração).
 */
const EXCEPTIONS: Record<string, string> = {
  'classe barbarian: Fúria': 'só em fúria: efeito ligado (onda efeitos-ativos)',
  'subclasse totem-warrior: Totem Espiritual': 'o Urso resiste só em fúria: efeito ligado (onda efeitos-ativos)',
  'opção totem-spirits: Urso': 'resiste só em fúria: efeito ligado (onda efeitos-ativos)',
  'opção totem-attunements: Urso': '"imune a esse efeito" é o inimigo',
  'classe monk: Corpo Vazio': 'só durante o efeito da ação (onda de ações)',
  'subclasse draconic-bloodline: Afinidade Elemental': 'gasta 1 ponto de feitiçaria para resistir por 1 hora: ação (onda de ações)',
  'classe paladin: Saúde Divina': 'imune a doenças: o app não modela doença',
  'subclasse circle-of-the-land: Santuário Natural': 'a imunidade é da criatura que ataca',
  'subclasse oath-of-vengeance: Canalizar Divindade': '"imunes a amedrontado" são os alvos',
  'talento: Adepto Elemental': 'fala das magias que você conjura, não de uma defesa sua',
}

describe('defesas contra dano nos dados (p. 199)', () => {
  it('lê os traços, as features, os talentos e as opções', () => {
    expect(ENTRIES.some(e => e.name === 'Resistência Infernal')).toBe(true)
    expect(ENTRIES.some(e => e.name === 'Avatar da Batalha')).toBe(true)
    expect(ENTRIES.some(e => e.name === 'Maestria em Armadura Pesada')).toBe(true)
    expect(ENTRIES.some(e => e.where === 'opção hunter-superior-defense')).toBe(true)
  })

  it('a procura reconhece as formas do texto: a Resistência à Magia passava em silêncio', () => {
    const magic = ENTRIES.find(e => e.where === 'subclasse abjuration' && e.name === 'Resistência à Magia')
    expect(MENTIONS_DEFENSE.test(magic?.text ?? '')).toBe(true)
    expect(magic?.defenses).toEqual({ resistances: 'all', condition: 'de magia' })
  })

  it('todo id de tipo de dano existe em damage-types.json, e toda condição em conditions.json', () => {
    const conditions = new Set<ConditionId>(CONDITIONS.map(c => c.id))
    for (const { where, name, defenses: d } of ENTRIES) {
      if (!d) continue
      const label = `${where}: ${name}`
      const set = d.resistances
      const listed = [
        ...(Array.isArray(set) ? set : set && set !== 'all' ? set.allExcept : []),
        ...(d.immunities ?? []), ...(d.vulnerabilities ?? []), ...(d.reduction?.types ?? []),
      ]
      for (const id of listed) expect(isDamageTypeId(id), `${label}: ${id}`).toBe(true)
      for (const id of d.conditionImmunities ?? []) expect(conditions.has(id), `${label}: ${id}`).toBe(true)
    }
  })

  it('toda característica que fala de resistência a dano ou de imunidade declara a defesa, ou está nas exceções com o motivo', () => {
    const forgotten = ENTRIES
      .filter(e => MENTIONS_DEFENSE.test(e.text) && !e.defenses && !EXCEPTIONS[`${e.where}: ${e.name}`])
      .map(e => `${e.where}: ${e.name}`)
    expect(forgotten).toEqual([])
  })

  it('as exceções existem e continuam sem a declaração', () => {
    for (const key of Object.keys(EXCEPTIONS)) {
      const entry = ENTRIES.find(e => `${e.where}: ${e.name}` === key)
      expect(entry, key).toBeDefined()
      expect(entry?.defenses, key).toBeUndefined()
      expect(MENTIONS_DEFENSE.test(entry?.text ?? ''), key).toBe(true)
    }
  })
})
