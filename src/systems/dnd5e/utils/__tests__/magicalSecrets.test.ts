import { describe, it, expect } from 'vitest'
import {
  getCasterEntries,
  getCantripColumn,
  getSpellColumn,
  describeSecretsInColumn,
  getSpellChoiceOverflow,
  getSpellChoiceOverflows,
  getCantripChoiceOverflow,
  getMaxSpellLevel,
  getSpell,
  getSecretCantripRoom,
  getSecretSpellIssues,
  getSpellsByClass,
  getSecretSpellGroups,
  formatSecretSpellName,
  getCasterColumnHeadings,
} from '../spellUtils'
import { collectStepReasons } from '../pendingReasons'
import { getBaseClassFeaturesUpToLevel } from '../classUtils'
import { isStepComplete } from '../draftValidation'
import { getSecretSpellOptions } from '../progressionOptions'
import { getFinalAbilityScores } from '../asiUtils'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'

// Segredos Mágicos do bardo (p. 54) "já estão incluídos no número da coluna Magias Conhecidas":
// ocupam vaga em vez de somar por cima. Decisão do usuário: Segredo truque ocupa vaga de Truques
// Conhecidos. Os Adicionais do Colégio do Conhecimento (p. 55) continuam por cima.

const BARD_CANTRIPS = ['friends', 'true-strike', 'mending', 'dancing-lights']
const BARD_SPELLS = [
  'calm-emotions', 'animal-friendship', 'plant-growth', 'planar-binding', 'animate-objects',
  'enhance-ability', 'knock', 'magic-mouth', 'enthrall', 'blindness-deafness',
  'teleportation-circle', 'clairvoyance', 'comprehend-languages', 'compulsion',
]

type BardOpts = {
  subclass: string
  cantrips: string[]
  spells: string[]
  progressionChoices: Record<string, string[]>
}

/** Escolhas da etapa Classe do bardo completas (perícias, instrumentos, Aptidão), exceto os Segredos. */
function bardClassChoices(subclass: string, progressionChoices: Record<string, string[]>) {
  return {
    ...structuredClone(EMPTY_DRAFT.classChoices),
    skills: ['acrobatics', 'deception', 'performance'],
    tools: ['lute', 'flute', 'pan-flute'],
    expertiseItems: ['acrobatics', 'deception', 'performance', 'persuasion'],
    subclass,
    subclassExtras: subclass === 'college-of-lore' ? { skills: ['arcana', 'history', 'nature'] } : {},
    progressionChoices,
  }
}

function bardAt(level: number, opts: BardOpts): CharacterDraft {
  return {
    ...structuredClone(EMPTY_DRAFT),
    class: 'bard',
    level,
    abilityScores: { STR: 10, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 16 },
    classChoices: bardClassChoices(opts.subclass, opts.progressionChoices),
    spellChoices: { cantrips: opts.cantrips, spells: opts.spells },
  }
}

function bard10(opts: BardOpts): CharacterDraft {
  return bardAt(10, opts)
}

function columns(draft: CharacterDraft) {
  const [caster] = getCasterEntries(draft)
  const scores = getFinalAbilityScores(draft)
  return {
    caster,
    scores,
    cantrips: getCantripColumn(caster.casting, caster.entry.level, caster.entry.spellChoices, caster.knownSecrets),
    spells: getSpellColumn(caster.casting, caster.entry.level, scores, caster.entry.spellChoices, caster.knownSecrets),
  }
}

describe('Segredos Mágicos ocupam vaga das conhecidas (p. 54)', () => {
  it('bardo Bravura 10: 12 escolhidas + 2 Segredos = 14, a etapa fecha e não há excesso', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 12),
      progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] },
    })
    const { caster, scores, spells, cantrips } = columns(draft)
    expect(caster.knownSecrets).toEqual({ cantrips: [], spells: ['fireball', 'counterspell'] })
    expect(spells).toEqual({ total: 14, chosen: 12, fromSecrets: 2, toChoose: 12 })
    expect(describeSecretsInColumn(spells)).toBe('12 + 2 de Segredos Mágicos = 14')
    expect(cantrips.toChoose).toBe(4)
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(getSpellChoiceOverflows(caster, scores)).toEqual([])
  })

  it('bardo Bravura 10 com só 11 escolhidas: falta uma', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 11),
      progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] },
    })
    expect(isStepComplete(draft, 'spells')).toBe(false)
  })

  it('bardo 10 com um Segredo truque e um magia: cada um desconta da sua coluna', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS.slice(0, 3),
      spells: BARD_SPELLS.slice(0, 13),
      progressionChoices: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] },
    })
    const { caster, scores, cantrips, spells } = columns(draft)
    expect(caster.knownSecrets).toEqual({ cantrips: ['fire-bolt'], spells: ['fireball'] })
    expect(cantrips).toEqual({ total: 4, chosen: 3, fromSecrets: 1, toChoose: 3 })
    expect(spells).toEqual({ total: 14, chosen: 13, fromSecrets: 1, toChoose: 13 })
    expect(describeSecretsInColumn(cantrips)).toBe('3 + 1 de Segredos Mágicos = 4')
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(getSpellChoiceOverflows(caster, scores)).toEqual([])

    // Um truque a menos ou uma magia a menos: a etapa não fecha.
    expect(isStepComplete({ ...draft, spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 2), spells: BARD_SPELLS.slice(0, 13) } }, 'spells')).toBe(false)
    expect(isStepComplete({ ...draft, spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 3), spells: BARD_SPELLS.slice(0, 12) } }, 'spells')).toBe(false)
  })

  it('Conhecimento 10: 12 + 2 Segredos, e os 2 Adicionais do 6° vêm por cima (p. 55)', () => {
    const draft = bard10({
      subclass: 'college-of-lore',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 12),
      progressionChoices: {
        'lore-magical-secrets-6': ['revivify', 'haste'],
        'bard-magical-secrets-10': ['fireball', 'counterspell'],
      },
    })
    const { caster, scores, spells } = columns(draft)
    expect(caster.bonusSpells).toEqual(['revivify', 'haste', 'fireball', 'counterspell'])
    expect(caster.knownSecrets.spells).toEqual(['fireball', 'counterspell'])
    expect(spells).toEqual({ total: 14, chosen: 12, fromSecrets: 2, toChoose: 12 })
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(getSpellChoiceOverflows(caster, scores)).toEqual([])
  })

  it('bardo 10 salvo com 14 + 2 (o número antigo): aviso de excesso dizendo o que desmarcar, nada apagado', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS,
      progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] },
    })
    const { caster, scores } = columns(draft)
    const overflow = getSpellChoiceOverflow(caster, scores)
    expect(caster.spells).toHaveLength(14)
    expect(overflow).toMatchObject({ label: 'Bardo', chosen: 16, max: 14, excess: 2, fromSecrets: 2 })
    expect(overflow?.text).toContain('14 magias conhecidas escolhidas + 2 de Segredos Mágicos = 16')
    expect(overflow?.text).toContain('desmarque 2 das 14 escolhidas na etapa Magias')
    expect(overflow?.text).toContain('(fica 12 + 2 = 14)')
  })

  it('Segredo truque em ficha antiga com os 4 truques: aviso na coluna de truques', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 13),
      progressionChoices: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] },
    })
    const { caster } = columns(draft)
    const overflow = getCantripChoiceOverflow(caster)
    expect(overflow).toMatchObject({ chosen: 5, max: 4, excess: 1, fromSecrets: 1 })
    expect(overflow?.text).toContain('desmarque um dos 4 escolhidos na etapa Magias')
  })

  it('Segredo que repete uma magia já escolhida não ocupa duas vagas', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 13),
      progressionChoices: { 'bard-magical-secrets-10': [BARD_SPELLS[0], 'fireball'] },
    })
    const { spells } = columns(draft)
    expect(spells).toEqual({ total: 14, chosen: 13, fromSecrets: 1, toChoose: 13 })
    expect(isStepComplete(draft, 'spells')).toBe(true)
  })
})

describe('seletor de Segredos Mágicos: nível que o bardo conjura, ou truque (pp. 54-55)', () => {
  it('bardo 10 conjura até o 5°: oferece truques e até 5°, nada de 6° em diante', () => {
    expect(getMaxSpellLevel('bard', 10)).toBe(5)
    const options = getSecretSpellOptions(5)
    const levels = new Set(options.map(o => getSpell(o.id)!.level))
    expect(levels.has(0)).toBe(true)
    expect(levels.has(5)).toBe(true)
    expect([...levels].some(l => l > 5)).toBe(false)
  })

  it('escolha antiga acima do limite fica na lista, sinalizada, para dar pra desmarcar', () => {
    const options = getSecretSpellOptions(3, ['wish'])
    const wish = options.find(o => o.id === 'wish')
    expect(wish?.description).toContain('acima do 3º nível')
    expect(options.some(o => o.id === 'meteor-swarm')).toBe(false)
  })
})

describe('Segredos truque não passam da coluna Truques Conhecidos', () => {
  const SIX_CANTRIPS = ['shillelagh', 'sacred-flame', 'fire-bolt', 'ray-of-frost', 'eldritch-blast', 'guidance']
  const sixCantripSecrets = {
    'bard-magical-secrets-10': SIX_CANTRIPS.slice(0, 2),
    'bard-magical-secrets-14': SIX_CANTRIPS.slice(2, 4),
    'bard-magical-secrets-18': SIX_CANTRIPS.slice(4, 6),
  }

  it('bardo 18 com os 6 Segredos truque: a etapa Classe reprova e diz o que trocar', () => {
    const draft = bardAt(18, { subclass: 'college-of-valor', cantrips: [], spells: [], progressionChoices: sixCantripSecrets })
    expect(getSecretCantripRoom('bard', 'college-of-valor', 18, sixCantripSecrets)).toEqual({ max: 4, used: SIX_CANTRIPS })
    expect(getSecretSpellIssues('bard', 'college-of-valor', 18, sixCantripSecrets))
      .toEqual([{ kind: 'too-many-cantrips', cantrips: SIX_CANTRIPS, max: 4, excess: 2 }])
    expect(isStepComplete(draft, 'class')).toBe(false)
    const reasons = collectStepReasons(draft, 'class')
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toContain('Bardo: 6 Segredos Mágicos são truques (Bordão Místico, Chama Sagrada, ')
    expect(reasons[0]).toContain('a coluna Truques Conhecidos tem 4 — troque 2 por magia de 1º nível ou mais em Segredos Mágicos')
  })

  it('o aviso de excesso manda trocar o Segredo na etapa Classe, nunca "desmarque N dos 0"', () => {
    const draft = bardAt(18, { subclass: 'college-of-valor', cantrips: [], spells: [], progressionChoices: sixCantripSecrets })
    const overflow = getCantripChoiceOverflow(columns(draft).caster)
    expect(overflow?.text).toBe(
      'Bardo: 6 Segredos Mágicos são truques, mas a coluna Truques Conhecidos tem 4. '
      + 'Na etapa Classe, troque 2 desses Segredos por magia de 1º nível ou mais.',
    )
    expect(overflow?.text).not.toContain('desmarque')

    // Com truques escolhidos na etapa Magias, eles também sobram.
    const withChosen = { ...draft, spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 2), spells: [] } }
    expect(getCantripChoiceOverflow(columns(withChosen).caster)?.text)
      .toContain('Depois, desmarque os 2 escolhidos na etapa Magias')
  })

  it('com 4 Segredos truque (a coluna cheia) a etapa Classe fecha; o 5º reprova', () => {
    const four = {
      'bard-magical-secrets-10': SIX_CANTRIPS.slice(0, 2),
      'bard-magical-secrets-14': SIX_CANTRIPS.slice(2, 4),
      'bard-magical-secrets-18': ['fireball', 'counterspell'],
    }
    const ok = bardAt(18, { subclass: 'college-of-valor', cantrips: [], spells: [], progressionChoices: four })
    expect(getSecretCantripRoom('bard', 'college-of-valor', 18, four).used).toHaveLength(4)
    expect(isStepComplete(ok, 'class')).toBe(true)
    expect(collectStepReasons(ok, 'class')).toEqual([])

    const five = { ...four, 'bard-magical-secrets-18': ['eldritch-blast', 'counterspell'] }
    expect(isStepComplete({ ...ok, classChoices: bardClassChoices('college-of-valor', five) }, 'class')).toBe(false)
  })

  it('bardo 18 como classe adicional (guerreiro 2 / bardo 18) também é conferido, no nível de bardo', () => {
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'fighter',
      level: 20,
      abilityScores: { STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 16 },
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['athletics', 'perception'], fightingStyle: 'defense' },
      additionalClasses: [{
        classId: 'bard',
        level: 18,
        classChoices: { ...bardClassChoices('college-of-valor', sixCantripSecrets), skills: ['performance'], tools: [] },
        spellChoices: { cantrips: [], spells: [] },
        asiChoices: [],
        hpRolls: [],
      }],
      multiclass: true,
    }
    expect(isStepComplete(draft, 'class')).toBe(false)
    expect(collectStepReasons(draft, 'class')[0]).toContain('Bardo: 6 Segredos Mágicos são truques')

    const fixed = structuredClone(draft)
    fixed.additionalClasses[0].classChoices.progressionChoices['bard-magical-secrets-18'] = ['fireball', 'counterspell']
    expect(isStepComplete(fixed, 'class')).toBe(true)
    expect(collectStepReasons(fixed, 'class')).toEqual([])
  })
})

describe('Segredo acima do nível que o bardo conjura reprova a etapa Classe (pp. 54-55)', () => {
  it('bardo 10 com Desejo e Chuva de Meteoros (9º) num limite de 5º: pendência com o que trocar', () => {
    const progressionChoices = { 'bard-magical-secrets-10': ['wish', 'meteor-swarm'] }
    const draft = bard10({ subclass: 'college-of-valor', cantrips: BARD_CANTRIPS, spells: BARD_SPELLS.slice(0, 12), progressionChoices })
    expect(getSecretSpellIssues('bard', 'college-of-valor', 10, progressionChoices)).toEqual([
      { kind: 'above-level', slotLabel: 'Segredos Mágicos', spellId: 'wish', spellLevel: 9, maxLevel: 5 },
      { kind: 'above-level', slotLabel: 'Segredos Mágicos', spellId: 'meteor-swarm', spellLevel: 9, maxLevel: 5 },
    ])
    expect(isStepComplete(draft, 'class')).toBe(false)
    expect(collectStepReasons(draft, 'class')).toEqual([
      'Bardo: Desejo (9º) passa do 5º nível que você conjura — troque em Segredos Mágicos',
      'Bardo: Chuva de Meteoros (9º) passa do 5º nível que você conjura — troque em Segredos Mágicos',
    ])

    const ok = bard10({ subclass: 'college-of-valor', cantrips: BARD_CANTRIPS, spells: BARD_SPELLS.slice(0, 12), progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'cone-of-cold'] } })
    expect(isStepComplete(ok, 'class')).toBe(true)
    expect(collectStepReasons(ok, 'class')).toEqual([])
  })

  it('vale para os Adicionais do Conhecimento 6 (limite 3º)', () => {
    const progressionChoices = { 'lore-magical-secrets-6': ['revivify', 'cone-of-cold'] }
    const draft = bardAt(6, { subclass: 'college-of-lore', cantrips: [], spells: [], progressionChoices })
    expect(isStepComplete(draft, 'class')).toBe(false)
    expect(collectStepReasons(draft, 'class')).toEqual([
      'Bardo: Cone de Frio (5º) passa do 3º nível que você conjura — troque em Segredos Mágicos Adicionais',
    ])
    expect(isStepComplete(bardAt(6, { subclass: 'college-of-lore', cantrips: [], spells: [], progressionChoices: { 'lore-magical-secrets-6': ['revivify', 'haste'] } }), 'class')).toBe(true)
  })

  it('bardo como classe adicional: o limite é o do nível de bardo, não o do personagem', () => {
    // Guerreiro 10 / bardo 10 (Conhecimento): o bardo conjura até o 5º pela tabela dele.
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'fighter',
      level: 20,
      abilityScores: { STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 16 },
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['athletics', 'perception'], fightingStyle: 'defense', subclass: 'champion', progressionChoices: { 'champion-fighting-style-10': ['archery'] } },
      additionalClasses: [{
        classId: 'bard',
        level: 10,
        classChoices: {
          ...bardClassChoices('college-of-lore', { 'lore-magical-secrets-6': ['revivify', 'haste'], 'bard-magical-secrets-10': ['fireball', 'wish'] }),
          skills: ['performance'],
          tools: [],
        },
        spellChoices: { cantrips: [], spells: [] },
        asiChoices: [],
        hpRolls: [],
      }],
      multiclass: true,
    }
    expect(collectStepReasons(draft, 'class')).toEqual([
      'Bardo: Desejo (9º) passa do 5º nível que você conjura — troque em Segredos Mágicos',
    ])
    expect(isStepComplete(draft, 'class')).toBe(false)
  })
})

describe('Segredos nos níveis 14 e 18 e na multiclasse', () => {
  // Magias de bardo de 1º a 5º, fora as usadas como Segredo abaixo.
  const POOL = getSpellsByClass('bard')
    .filter(s => s.level >= 1 && s.level <= 5 && !['fireball', 'counterspell', 'cone-of-cold', 'haste', 'revivify'].includes(s.id))
    .map(s => s.id)

  it('bardo 14: 4 Segredos (truque + 3 magias) — 3 + 1 truques, 15 + 3 = 18 magias', () => {
    const progressionChoices = {
      'bard-magical-secrets-10': ['fire-bolt', 'fireball'],
      'bard-magical-secrets-14': ['counterspell', 'cone-of-cold'],
    }
    const draft = bardAt(14, { subclass: 'college-of-valor', cantrips: BARD_CANTRIPS.slice(0, 3), spells: POOL.slice(0, 15), progressionChoices })
    const { caster, scores, cantrips, spells } = columns(draft)
    expect(caster.knownSecrets).toEqual({ cantrips: ['fire-bolt'], spells: ['fireball', 'counterspell', 'cone-of-cold'] })
    expect(cantrips).toEqual({ total: 4, chosen: 3, fromSecrets: 1, toChoose: 3 })
    expect(spells).toEqual({ total: 18, chosen: 15, fromSecrets: 3, toChoose: 15 })
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(isStepComplete(draft, 'class')).toBe(true)
    expect(getSpellChoiceOverflows(caster, scores)).toEqual([])
    expect(isStepComplete({ ...draft, spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 3), spells: POOL.slice(0, 14) } }, 'spells')).toBe(false)
  })

  it('bardo 18: 6 Segredos de magia — 16 + 6 = 22', () => {
    const progressionChoices = {
      'bard-magical-secrets-10': ['fireball', 'counterspell'],
      'bard-magical-secrets-14': ['cone-of-cold', 'haste'],
      'bard-magical-secrets-18': ['revivify', 'wish'],
    }
    const draft = bardAt(18, { subclass: 'college-of-valor', cantrips: BARD_CANTRIPS, spells: POOL.slice(0, 16), progressionChoices })
    const { caster, spells } = columns(draft)
    expect(caster.knownSecrets.spells).toHaveLength(6)
    expect(spells).toEqual({ total: 22, chosen: 16, fromSecrets: 6, toChoose: 16 })
    expect(describeSecretsInColumn(spells)).toBe('16 + 6 de Segredos Mágicos = 22')
    expect(isStepComplete(draft, 'spells')).toBe(true)
    expect(isStepComplete(draft, 'class')).toBe(true)
    expect(isStepComplete({ ...draft, spellChoices: { cantrips: BARD_CANTRIPS, spells: POOL.slice(0, 15) } }, 'spells')).toBe(false)
  })

  it('guerreiro 5 / bardo do Conhecimento 10 (adicional): colunas no nível de bardo, Adicionais por cima', () => {
    const draft: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'fighter',
      level: 15,
      abilityScores: { STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 16 },
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['athletics', 'perception'], fightingStyle: 'defense', subclass: 'champion' },
      additionalClasses: [{
        classId: 'bard',
        level: 10,
        classChoices: {
          ...bardClassChoices('college-of-lore', { 'lore-magical-secrets-6': ['revivify', 'haste'], 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] }),
          skills: ['performance'],
          tools: [],
        },
        spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 3), spells: POOL.slice(0, 13) },
        asiChoices: [],
        hpRolls: [],
      }],
      multiclass: true,
    }
    const bard = getCasterEntries(draft).find(c => c.entry.classId === 'bard')!
    expect(bard.knownSecrets).toEqual({ cantrips: ['fire-bolt'], spells: ['fireball'] })
    expect(bard.bonusSpells).toEqual(['revivify', 'haste', 'fire-bolt', 'fireball'])
    expect(getCantripColumn(bard.casting, bard.entry.level, bard.entry.spellChoices, bard.knownSecrets))
      .toEqual({ total: 4, chosen: 3, fromSecrets: 1, toChoose: 3 })
    expect(getSpellColumn(bard.casting, bard.entry.level, getFinalAbilityScores(draft), bard.entry.spellChoices, bard.knownSecrets))
      .toEqual({ total: 14, chosen: 13, fromSecrets: 1, toChoose: 13 })
    expect(isStepComplete(draft, 'spells')).toBe(true)
    const short = structuredClone(draft)
    short.additionalClasses[0].spellChoices.spells = POOL.slice(0, 12)
    expect(isStepComplete(short, 'spells')).toBe(false)
  })

  it('bardo 14 primário / mago 2: o bardo usa o nível dele (getPrimaryLevel), 15 + 3 = 18', () => {
    const progressionChoices = {
      'bard-magical-secrets-10': ['fireball', 'counterspell'],
      'bard-magical-secrets-14': ['cone-of-cold', 'fire-bolt'],
    }
    const draft: CharacterDraft = {
      ...bardAt(16, { subclass: 'college-of-valor', cantrips: BARD_CANTRIPS.slice(0, 3), spells: POOL.slice(0, 15), progressionChoices }),
      abilityScores: { STR: 10, DEX: 14, CON: 12, INT: 14, WIS: 10, CHA: 16 },
      additionalClasses: [{
        classId: 'wizard',
        level: 2,
        classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'evocation' },
        spellChoices: { cantrips: ['light', 'mage-hand', 'prestidigitation'], spells: ['magic-missile', 'shield', 'sleep', 'mage-armor', 'burning-hands', 'detect-magic', 'find-familiar', 'identify'] },
        asiChoices: [],
        hpRolls: [],
      }],
      multiclass: true,
    }
    const bard = getCasterEntries(draft).find(c => c.entry.classId === 'bard')!
    expect(bard.entry.level).toBe(14)
    expect(bard.knownSecrets).toEqual({ cantrips: ['fire-bolt'], spells: ['fireball', 'counterspell', 'cone-of-cold'] })
    expect(getSpellColumn(bard.casting, 14, getFinalAbilityScores(draft), bard.entry.spellChoices, bard.knownSecrets))
      .toEqual({ total: 18, chosen: 15, fromSecrets: 3, toChoose: 15 })
    expect(isStepComplete(draft, 'spells')).toBe(true)
    const short = { ...draft, spellChoices: { cantrips: BARD_CANTRIPS.slice(0, 3), spells: POOL.slice(0, 14) } }
    expect(isStepComplete(short, 'spells')).toBe(false)
  })
})

describe('getSecretSpellGroups: Segredos que ocupam vaga × Adicionais por cima', () => {
  it('Conhecimento 10: Segredos do 10º contam nas conhecidas; Adicionais do 6º vêm por cima', () => {
    const draft = bard10({
      subclass: 'college-of-lore',
      cantrips: BARD_CANTRIPS,
      spells: BARD_SPELLS.slice(0, 12),
      progressionChoices: {
        'lore-magical-secrets-6': ['revivify', 'haste'],
        'bard-magical-secrets-10': ['fire-bolt', 'fireball'],
      },
    })
    const groups = getSecretSpellGroups(columns(draft).caster)
    expect(groups.map(g => [g.kind, g.title, g.spells.map(formatSecretSpellName)])).toEqual([
      ['in-columns', 'Segredos Mágicos (contam nas conhecidas)', ['Raio de Fogo (truque)', 'Bola de Fogo (3º)']],
      ['additional', 'Segredos Mágicos Adicionais (por cima das conhecidas)', ['Revivificar (3º)', 'Velocidade (3º)']],
    ])
  })

  it('bardo Bravura sem Adicionais: um grupo só; sem Segredo, nenhum', () => {
    const valor = bard10({ subclass: 'college-of-valor', cantrips: BARD_CANTRIPS, spells: [], progressionChoices: { 'bard-magical-secrets-10': ['fireball', 'counterspell'] } })
    expect(getSecretSpellGroups(columns(valor).caster).map(g => g.kind)).toEqual(['in-columns'])
    const none = bardAt(5, { subclass: 'college-of-valor', cantrips: [], spells: [], progressionChoices: {} })
    expect(getSecretSpellGroups(columns(none).caster)).toEqual([])
  })
})

describe('títulos das colunas com o total (Revisão e PDF)', () => {
  it('bardo Bravura 10 com Segredo truque e magia: 3 + 1 = 4 truques, 13 + 1 = 14 conhecidas', () => {
    const draft = bard10({
      subclass: 'college-of-valor',
      cantrips: BARD_CANTRIPS.slice(0, 3),
      spells: BARD_SPELLS.slice(0, 13),
      progressionChoices: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] },
    })
    const { caster, scores } = columns(draft)
    expect(getCasterColumnHeadings(caster, scores)).toEqual({
      cantrips: 'Truques (3 + 1 de Segredos Mágicos = 4)',
      spells: 'Conhecidas (13 + 1 de Segredos Mágicos = 14)',
      hasCantrips: true,
      hasSpells: true,
    })
  })

  it('sem Segredo, só a contagem; preparado diz Preparadas', () => {
    const draft = bardAt(5, { subclass: 'college-of-valor', cantrips: BARD_CANTRIPS.slice(0, 3), spells: BARD_SPELLS.slice(0, 8), progressionChoices: {} })
    const { caster, scores } = columns(draft)
    expect(getCasterColumnHeadings(caster, scores)).toMatchObject({ cantrips: 'Truques (3)', spells: 'Conhecidas (8)' })

    const cleric: CharacterDraft = {
      ...structuredClone(EMPTY_DRAFT),
      class: 'cleric', level: 1,
      abilityScores: { STR: 10, DEX: 10, CON: 12, INT: 10, WIS: 16, CHA: 10 },
      classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'life' },
      spellChoices: { cantrips: ['guidance'], spells: ['bless', 'cure-wounds'] },
    }
    const c = columns(cleric)
    expect(getCasterColumnHeadings(c.caster, c.scores)).toMatchObject({ cantrips: 'Truques (1)', spells: 'Preparadas (2)' })
  })

  it('todos os truques vindo de Segredos: a seção de truques aparece mesmo sem escolhido', () => {
    const four = {
      'bard-magical-secrets-10': ['fire-bolt', 'shillelagh'],
      'bard-magical-secrets-14': ['sacred-flame', 'ray-of-frost'],
    }
    const { caster, scores } = columns(bardAt(14, { subclass: 'college-of-valor', cantrips: [], spells: [], progressionChoices: four }))
    expect(getCasterColumnHeadings(caster, scores)).toMatchObject({ cantrips: 'Truques (0 + 4 de Segredos Mágicos = 4)', hasCantrips: true, hasSpells: false })
  })

  it('o texto de Segredos Mágicos diz que o truque ocupa vaga de Truques Conhecidos', () => {
    const feature = getBaseClassFeaturesUpToLevel('bard', 10).find(f => f.name === 'Segredos Mágicos')
    expect(feature?.description).toContain('um truque escolhido ocupa vaga de Truques Conhecidos')
  })
})
