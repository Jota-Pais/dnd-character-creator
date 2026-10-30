import { describe, it, expect } from 'vitest'
import type { ActiveEffect, DamageDefenses, FeatureEffects } from '../../types/effects'
import type { ConditionId } from '../../types/condition'
import { DAMAGE_TYPES, isDamageTypeId } from '../../utils/damageTypes'
import { CONDITIONS } from '../../utils/sheetEffects'
import { getProgressionOptions } from '../../utils/progressionOptions'
import progressionFeatures from '../class-progression-features.json'
import progressionChoices from '../progression-choices.json'
import featsData from '../feats.json'
import racesData from '../races.json'

/**
 * Tudo que pode declarar defesa, com onde está: traços, features de classe e subclasse, talentos e
 * opções. `toggled`: as defesas que valem só com um efeito ligado (a Fúria, o Urso, a Fúria
 * Inconsciente), declaradas no efeito ou no que o modifica.
 */
type Entry = { where: string; name: string; text: string; defenses?: DamageDefenses; toggled: ActiveEffect[] }
type Described = { name: string; description?: string; effects?: FeatureEffects }

/** As defesas de efeito ligado: as de dano e as de condição, onde quer que estejam na declaração. */
function toggledDefenses(effects: FeatureEffects | undefined): ActiveEffect[] {
  const groups = [effects?.toggle, ...(effects?.toggleModifiers ?? [])].flatMap(t => (t
    ? [t.effects ?? [], t.benefits?.effects ?? [], ...('options' in t ? (t.options ?? []).map(o => o.effects ?? []) : [])]
    : []))
  return groups.flat().filter(e => e.kind === 'damageDefenses' || e.kind === 'conditionImmunity')
}

const toEntry = (where: string) => (x: Described): Entry =>
  ({ where, name: x.name, text: x.description ?? '', defenses: x.effects?.damageDefenses, toggled: toggledDefenses(x.effects) })

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

/** Os nomes dos tipos, para o texto que os lista sem dizer "dano" (Pedra de Transmutador, p. 101). */
const DAMAGE_TYPE_NAMES = DAMAGE_TYPES.map(t => t.name.toLowerCase()).join('|')

/**
 * As condições pelo radical, que pega o gênero e o número: "enfeitiçad" casa "enfeitiçado" e
 * "enfeitiçadas".
 */
const CONDITION_STEMS = CONDITIONS.map(c => c.name.toLowerCase().slice(0, -1)).join('|')

/**
 * O texto fala de defesa contra dano ou de imunidade. As formas do livro e dos dados: "resistência a
 * dano de fogo", "resistência contra o dano causado por magias" (Resistência à Magia, p. 98),
 * "resistência a ácido, frio, fogo…" (Pedra de Transmutador), "imune a venenos" e "você não pode ser
 * enfeitiçado" (Defesa Sedutora, p. 60).
 */
const MENTIONS_DEFENSE = new RegExp(
  'resist[êe]ncia (?:a|ao|à|contra) (?:o |todo |todos os tipos de |esse tipo de |o tipo de )?dano'
  + `|resist[êe]ncia a (?:${DAMAGE_TYPE_NAMES})\\b`
  + '|imunes? a'
  + `|n[ãa]o podem? ser (?:${CONDITION_STEMS})`,
  'i',
)

/**
 * O texto fala de defesa, mas a defesa não é da ficha a toda hora: fica com o motivo. Quando a onda
 * que a liga chegar, ela sai daqui (e o teste cobra a declaração).
 */
const EXCEPTIONS: Record<string, string> = {
  'subclasse totem-warrior: Totem Espiritual': 'o texto resume os três animais: a resistência do Urso está na opção (totem-spirits: Urso), como efeito ligado',
  'opção totem-attunements: Urso': '"imune a esse efeito" é o inimigo',
  'classe monk: Corpo Vazio': 'só durante o efeito da ação (onda de ações)',
  'subclasse draconic-bloodline: Afinidade Elemental': 'gasta 1 ponto de feitiçaria para resistir por 1 hora: ação (onda de ações)',
  'classe paladin: Saúde Divina': 'imune a doenças: o app não modela doença',
  'subclasse circle-of-the-land: Santuário Natural': 'a imunidade é da criatura que ataca',
  'subclasse oath-of-vengeance: Canalizar Divindade': '"imunes a amedrontado" são os alvos',
  'talento: Adepto Elemental': 'fala das magias que você conjura, não de uma defesa sua',
  'subclasse light-domain: Truque Adicional e Labareda Protetora': 'a imunidade é do atacante que não pode ser cegado',
  'subclasse enchantment: Encanto Instintivo': 'a imunidade é do atacante que não pode ser enfeitiçado',
  'classe paladin: Aura de Coragem': 'só enquanto você estiver consciente, e vale para os aliados: levada ao dono',
  'subclasse oath-of-devotion: Aura de Devoção': 'só enquanto você estiver consciente, e vale para os aliados: levada ao dono',
  'subclasse transmutation: Pedra de Transmutador':
    'a resistência é de quem está com a pedra (você ou outra criatura), ao tipo escolhido ao criá-la: escolha de sessão fora do desenho (levada ao dono)',
}

describe('defesas contra dano nos dados (p. 199)', () => {
  it('lê os traços, as features, os talentos e as opções', () => {
    expect(ENTRIES.some(e => e.name === 'Resistência Infernal')).toBe(true)
    expect(ENTRIES.some(e => e.name === 'Avatar da Batalha')).toBe(true)
    expect(ENTRIES.some(e => e.name === 'Maestria em Armadura Pesada')).toBe(true)
    expect(ENTRIES.some(e => e.where === 'opção hunter-superior-defense')).toBe(true)
  })

  it('as defesas de efeito ligado contam como declaradas: a Fúria, o Urso e a Fúria Inconsciente', () => {
    const toggled = (where: string, name: string) => ENTRIES.find(e => e.where === where && e.name === name)?.toggled
    expect(toggled('classe barbarian', 'Fúria')).toEqual([
      { kind: 'damageDefenses', defenses: { resistances: ['bludgeoning', 'piercing', 'slashing'] }, scope: 'sheet' },
    ])
    expect(toggled('opção totem-spirits', 'Urso')).toEqual([
      { kind: 'damageDefenses', defenses: { resistances: { allExcept: ['psychic'] } }, scope: 'sheet' },
    ])
    expect(toggled('subclasse berserker', 'Fúria Inconsciente')).toEqual([
      { kind: 'conditionImmunity', conditions: ['charmed', 'frightened'], scope: 'gameState' },
    ])
  })

  it('a procura reconhece as formas do texto: a Resistência à Magia passava em silêncio', () => {
    const magic = ENTRIES.find(e => e.where === 'subclasse abjuration' && e.name === 'Resistência à Magia')
    expect(MENTIONS_DEFENSE.test(magic?.text ?? '')).toBe(true)
    expect(magic?.defenses).toEqual({ resistances: 'all', condition: 'de magia' })
  })

  it('a procura reconhece a lista de tipos sem a palavra "dano": a Pedra de Transmutador fica nas exceções', () => {
    const stone = ENTRIES.find(e => e.where === 'subclasse transmutation' && e.name === 'Pedra de Transmutador')
    expect(MENTIONS_DEFENSE.test(stone?.text ?? '')).toBe(true)
    expect(EXCEPTIONS['subclasse transmutation: Pedra de Transmutador']).toBeDefined()
  })

  it('a procura reconhece a imunidade a condição escrita como "não pode ser enfeitiçado"', () => {
    const seductive = ENTRIES.find(e => e.where === 'subclasse the-archfey' && e.name === 'Defesa Sedutora')
    expect(MENTIONS_DEFENSE.test(seductive?.text ?? '')).toBe(true)
    expect(seductive?.defenses).toEqual({ conditionImmunities: ['charmed'] })
    expect(MENTIONS_DEFENSE.test('Você e as criaturas amigáveis não podem ser amedrontados.')).toBe(true)
    // "Não pode ser surpreendido" (Alerta) não é condição.
    expect(MENTIONS_DEFENSE.test('Você não pode ser surpreendido enquanto estiver consciente.')).toBe(false)
  })

  it('todo id de tipo de dano existe em damage-types.json, e toda condição em conditions.json', () => {
    const conditions = new Set<ConditionId>(CONDITIONS.map(c => c.id))
    const declared = ENTRIES.flatMap(e => [
      ...(e.defenses ? [{ ...e, d: e.defenses }] : []),
      ...e.toggled.flatMap(t => (t.kind === 'damageDefenses' ? [{ ...e, d: t.defenses }] : [])),
    ])
    for (const { where, name, toggled } of ENTRIES) {
      for (const t of toggled) {
        if (t.kind !== 'conditionImmunity') continue
        for (const id of t.conditions) expect(conditions.has(id), `${where}: ${name}: ${id}`).toBe(true)
      }
    }
    for (const { where, name, d } of declared) {
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
      .filter(e => MENTIONS_DEFENSE.test(e.text) && !e.defenses && e.toggled.length === 0 && !EXCEPTIONS[`${e.where}: ${e.name}`])
      .map(e => `${e.where}: ${e.name}`)
    expect(forgotten).toEqual([])
  })

  it('as exceções existem e continuam sem a declaração', () => {
    for (const key of Object.keys(EXCEPTIONS)) {
      const entry = ENTRIES.find(e => `${e.where}: ${e.name}` === key)
      expect(entry, key).toBeDefined()
      expect(entry?.defenses, key).toBeUndefined()
      expect(entry?.toggled, key).toEqual([])
      expect(MENTIONS_DEFENSE.test(entry?.text ?? ''), key).toBe(true)
    }
  })
})
