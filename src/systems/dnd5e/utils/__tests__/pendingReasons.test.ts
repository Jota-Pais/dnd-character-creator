import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, WIZARD_STEPS, type CharacterDraft, type ClassEntry } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { isStepComplete, sanitizeImportedDraft } from '../draftValidation'
import { collectStepReasons, getStepPendingReasons, getPendingSteps, formatPendingHint } from '../pendingReasons'
import { CLASSES } from '../classUtils'
import { RACES } from '../raceUtils'
import { BACKGROUNDS } from '../backgroundUtils'
import { getSpellsByClass } from '../spellUtils'

function draft(over: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(COMPLETE_DRAFT), ...over }
}

function entry(over: Partial<ClassEntry> & { classId: string }): ClassEntry {
  return {
    level: 1,
    classChoices: structuredClone(EMPTY_DRAFT.classChoices),
    spellChoices: { cantrips: [], spells: [] },
    asiChoices: [],
    hpRolls: [],
    ...over,
  }
}

/** Monge 2 / Druida 1 com a ferramenta do monge escolhida (p. 164: o druida adicional não dá ferramenta). */
function monkDruidDraft(tools: string[], background: string): CharacterDraft {
  return draft({
    class: 'monk', level: 3, background,
    abilityScores: { STR: 8, DEX: 15, CON: 13, INT: 10, WIS: 14, CHA: 12 },
    classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'stealth'], tools },
    additionalClasses: [entry({ classId: 'druid' })],
    multiclass: true,
  })
}

/** Humano Variante com Perito (ferramentas à escolha) e o druida como classe adicional. */
function peritoDruidDraft(tools: string[]): CharacterDraft {
  return draft({
    race: 'human', subrace: 'variant-human', level: 2,
    abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 10, WIS: 13, CHA: 8 },
    raceChoices: { abilityBonuses: ['STR', 'WIS'], skills: ['insight'], languages: ['elvish'], feat: 'perito' },
    featSelections: { perito: { skills: ['nature', 'stealth'], tools } },
    additionalClasses: [entry({ classId: 'druid' })],
    multiclass: true,
  })
}

const paladin2: CharacterDraft = draft({
  class: 'paladin', level: 2,
  classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['insight', 'religion'] },
  spellChoices: { cantrips: [], spells: ['bless'] },
})

describe('getStepPendingReasons — casos das fichas antigas', () => {
  it('paladino 2 sem Estilo de Luta: diz qual classe e o nível', () => {
    expect(getStepPendingReasons(paladin2, 'class')).toEqual([
      'Escolha o Estilo de Luta do Paladino (ganho no 2º nível)',
    ])
    const ok = { ...paladin2, classChoices: { ...paladin2.classChoices, fightingStyle: 'defense' } }
    expect(getStepPendingReasons(ok, 'class')).toEqual([])
  })

  it('patrulheiro 2 como classe da multiclasse sem Estilo de Luta', () => {
    const d = draft({
      class: 'barbarian', level: 3,
      abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 13, CHA: 8 },
      additionalClasses: [entry({ classId: 'ranger', level: 2, classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['stealth'] } })],
      multiclass: true,
    })
    expect(getStepPendingReasons(d, 'class')).toEqual([
      'Escolha o Estilo de Luta do Patrulheiro (ganho no 2º nível)',
    ])
  })

  it('Acólito, Charlatão e Soldado sem o item a escolher', () => {
    expect(getStepPendingReasons(draft({ background: 'acolyte', backgroundChoices: { languages: ['elvish', 'dwarvish'] } }), 'background'))
      .toEqual([
        'Equipamento do Acólito: escolha Símbolo Sagrado',
        'Equipamento do Acólito: escolha Livro de Preces ou Conta de Orações',
      ])
    expect(getStepPendingReasons(draft({ background: 'charlatan' }), 'background'))
      .toEqual(['Equipamento do Charlatão: escolha Ferramentas de Trapaça'])
    expect(getStepPendingReasons(draft({ background: 'soldier', backgroundChoices: { tools: ['dice-set'] } }), 'background'))
      .toEqual(['Equipamento do Soldado: escolha Dados de Osso ou Baralho'])
    expect(getStepPendingReasons(draft({
      background: 'soldier', backgroundChoices: { tools: ['dice-set'], items: { 'gaming-set': 'bone-dice' } },
    }), 'background')).toEqual([])
  })

  it('Cavaleiro Arcano e Trapaceiro Arcano sem truques e magias', () => {
    const ek = draft({
      class: 'fighter', level: 3,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'], fightingStyle: 'defense', subclass: 'eldritch-knight' },
    })
    expect(getStepPendingReasons(ek, 'spells')).toEqual(['Guerreiro (Cavaleiro Arcano): escolha 2 truques e 3 magias de mago'])
    const partial = { ...ek, spellChoices: { cantrips: ['fire-bolt', 'light'], spells: ['shield', 'magic-missile'] } }
    expect(getStepPendingReasons(partial, 'spells')).toEqual(['Guerreiro (Cavaleiro Arcano): escolha 1 magia de mago'])

    // Trapaceiro: mãos mágicas vem de graça, faltam 2 truques escolhidos.
    const at = draft({
      class: 'rogue', level: 3,
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'arcane-trickster' },
    })
    expect(getStepPendingReasons(at, 'spells')).toEqual(['Ladino (Trapaceiro Arcano): escolha 2 truques e 3 magias de mago'])
  })
})

describe('getStepPendingReasons — demais regras', () => {
  it('etapas em branco dizem o primeiro passo', () => {
    const empty = structuredClone(EMPTY_DRAFT)
    expect(getStepPendingReasons(empty, 'name')).toEqual(['Dê um nome ao personagem'])
    expect(getStepPendingReasons(empty, 'race')).toEqual(['Escolha uma raça'])
    expect(getStepPendingReasons(empty, 'class')).toEqual(['Escolha uma classe'])
    expect(getStepPendingReasons(empty, 'abilities')).toEqual(['Escolha um método para gerar os atributos'])
    expect(getStepPendingReasons(empty, 'background')).toEqual(['Escolha um antecedente'])
    expect(getStepPendingReasons(empty, 'equipment')).toEqual(['Escolha como se equipar: o equipamento da classe ou o ouro inicial'])
  })

  it('sub-raça e escolhas raciais', () => {
    expect(getStepPendingReasons(draft({ race: 'elf' }), 'race')).toEqual(['Escolha a sub-raça de Elfo'])
    expect(getStepPendingReasons(draft({ race: 'human', subrace: 'variant-human' }), 'race')).toEqual(expect.arrayContaining([
      'Humano (Variante): escolha o talento racial',
    ]))
    const perito = draft({
      race: 'human', subrace: 'variant-human',
      raceChoices: { abilityBonuses: ['STR', 'CON'], skills: ['insight'], languages: ['elvish'], feat: 'perito' },
      featSelections: { perito: { skills: ['stealth'] } },
    })
    expect(getStepPendingReasons(perito, 'race')).toEqual(['Humano (Variante), talento Perito: escolha mais 2 perícias ou ferramentas'])
  })

  it('perícias da classe: falta e excesso', () => {
    const falta = draft({ classChoices: { ...COMPLETE_DRAFT.classChoices, skills: ['animal-handling'] } })
    expect(getStepPendingReasons(falta, 'class')).toEqual(['Bárbaro: escolha mais 1 perícia da classe'])
    const excesso = draft({ classChoices: { ...COMPLETE_DRAFT.classChoices, skills: ['animal-handling', 'nature', 'survival'] } })
    expect(getStepPendingReasons(excesso, 'class')[0]).toMatch(/^Bárbaro: 1 perícia marcada a mais/)
  })

  it('subclasse e escolhas de progressão', () => {
    const b3 = draft({ level: 3 })
    expect(getStepPendingReasons(b3, 'class')).toEqual(['Escolha o Caminho Primordial do Bárbaro (ganho no 3º nível)'])
    const w = draft({
      class: 'wizard', level: 2,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['arcana', 'history'] },
    })
    expect(getStepPendingReasons(w, 'class')).toEqual(['Escolha a Tradição Arcana do Mago (ganho no 2º nível)'])
    const warlock = draft({
      class: 'warlock', level: 2,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['arcana', 'deception'], subclass: 'fiend' },
    })
    expect(getStepPendingReasons(warlock, 'class')).toEqual(['Bruxo: escolha mais 2 em Invocações Místicas (ganho no 2º nível)'])
  })

  it('Estilo de Luta repetido entre classes', () => {
    const d = draft({
      class: 'fighter', level: 3,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'], fightingStyle: 'defense' },
      additionalClasses: [entry({ classId: 'paladin', level: 2, classChoices: { ...EMPTY_DRAFT.classChoices, fightingStyle: 'defense' } })],
      multiclass: true,
    })
    expect(getStepPendingReasons(d, 'class')).toEqual([
      'Estilo de Luta Defesa escolhido duas vezes — o mesmo estilo não vale duas vezes (p. 85); troque um deles',
    ])
  })

  it('perícia repetida pelo antecedente trocado depois: a etapa Classe diz o que trocar', () => {
    // Guerreiro com Atletismo e Percepção que troca o Acólito pelo Marinheiro (p. 125).
    const fighter = draft({
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'], fightingStyle: 'defense' },
    })
    expect(isStepComplete({ ...fighter, background: 'acolyte' }, 'class')).toBe(true)
    expect(isStepComplete(fighter, 'class')).toBe(false)
    expect(getStepPendingReasons(fighter, 'class')).toEqual([
      'Guerreiro: Atletismo já vem do antecedente Marinheiro — troque por outra perícia',
      'Guerreiro: Percepção já vem do antecedente Marinheiro — troque por outra perícia',
    ])
    // Meio-Orc (Intimidação fixa) com Intimidação escolhida no bárbaro.
    const halfOrc = draft({ classChoices: { ...COMPLETE_DRAFT.classChoices, skills: ['intimidation', 'survival'] } })
    expect(getStepPendingReasons(halfOrc, 'class')).toEqual(['Bárbaro: Intimidação já vem da raça Meio-Orc — troque por outra perícia'])
  })

  it('perícia repetida na subclasse e na classe da multiclasse: diz qual delas troca', () => {
    const lore = draft({
      class: 'bard', level: 3,
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        skills: ['acrobatics', 'deception', 'performance'], tools: ['lute', 'flute', 'drum'],
        expertiseItems: ['acrobatics', 'deception'],
        subclass: 'college-of-lore', subclassExtras: { skills: ['deception', 'arcana', 'history'] },
      },
    })
    expect(getStepPendingReasons(lore, 'class')).toEqual([
      'Bardo (Colégio do Conhecimento): Enganação já vem da classe Bardo — troque por outra perícia',
    ])
    const ranger = draft({
      class: 'barbarian', level: 3,
      abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 13, CHA: 8 },
      additionalClasses: [entry({ classId: 'ranger', level: 2, classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['survival'], fightingStyle: 'archery' } })],
      multiclass: true,
    })
    expect(getStepPendingReasons(ranger, 'class')).toEqual(['Patrulheiro: Sobrevivência já vem da classe Bárbaro — troque por outra perícia'])
  })

  it('druida como classe adicional não dá Kit de Herbalismo: a ferramenta do monge ou do Perito não repete', () => {
    // Proficiências de Multiclasse (p. 164): o druida adicional não dá ferramenta.
    const monkDruid = monkDruidDraft(['herbalism-kit'], 'sailor')
    expect(getStepPendingReasons(monkDruid, 'class')).toEqual([])
    expect(isStepComplete(monkDruid, 'class')).toBe(true)
    // Com o Eremita, o Kit de Herbalismo vem mesmo de outra fonte.
    expect(getStepPendingReasons(monkDruidDraft(['herbalism-kit'], 'hermit'), 'class'))
      .toEqual(['Monge: Kit de Herbalismo já vem do antecedente Eremita — troque por outra ferramenta'])
    const perito = peritoDruidDraft(['herbalism-kit'])
    expect(getStepPendingReasons(perito, 'race')).toEqual([])
    expect(isStepComplete(perito, 'race')).toBe(true)
  })

  it('raça, antecedente e talento: a mesma regra, cada um na sua etapa', () => {
    const halfElf = draft({
      race: 'half-elf',
      raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight', 'stealth'], languages: ['dwarvish'] },
      background: 'acolyte',
    })
    expect(getStepPendingReasons(halfElf, 'race')).toEqual(['Meio-Elfo: Intuição já vem do antecedente Acólito — troque por outra perícia'])

    const entertainer = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['arcana', 'history', 'insight'], tools: ['lute', 'flute', 'drum'], expertiseItems: [] },
      background: 'entertainer', backgroundChoices: { tools: ['lute'] },
    })
    expect(getStepPendingReasons(entertainer, 'background')).toContain('Artista: Alaúde já vem da classe Bardo — troque por outro instrumento')
    expect(isStepComplete(entertainer, 'class')).toBe(true)

    const perito = draft({ level: 4, asiChoices: [{ kind: 'feat', featId: 'perito' }], featSelections: { perito: { skills: ['athletics', 'stealth', 'arcana'] } } })
    expect(getStepPendingReasons(perito, 'improvements')).toEqual([
      'Aprimoramentos, talento Perito: Atletismo já vem do antecedente Marinheiro — troque por outra perícia ou ferramenta',
    ])
  })

  it('ficha antiga com a perícia repetida carrega com a escolha no lugar e fica pendente', () => {
    const old = sanitizeImportedDraft(JSON.parse(JSON.stringify(draft({
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'], fightingStyle: 'defense' },
    }))))!
    expect(old.classChoices.skills).toEqual(['athletics', 'perception'])
    expect(getPendingSteps(old).map(p => p.step)).toEqual(['class'])
    expect(getStepPendingReasons(old, 'class')[0]).toBe('Guerreiro: Atletismo já vem do antecedente Marinheiro — troque por outra perícia')
  })

  it('atributos: compra de pontos com sobra', () => {
    const d = draft({ abilityMethod: 'point-buy', abilityScores: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 } })
    expect(getStepPendingReasons(d, 'abilities')).toEqual(['Ainda sobram 27 pontos da compra (são 27)'])
  })

  it('aprimoramentos: espaço vazio e meio-talento sem atributo', () => {
    const d = draft({ level: 4 })
    expect(getStepPendingReasons(d, 'improvements')).toEqual(['Incremento do 4º nível: escolha +2 em atributos ou um talento'])
    const feat = draft({ level: 4, asiChoices: [{ kind: 'feat', featId: 'atleta' }] })
    expect(getStepPendingReasons(feat, 'improvements')).toEqual(['Incremento do 4º nível: escolha o atributo que ganha +1 do talento Atleta'])
  })

  it('equipamento: ouro sem rolar e escolhas da classe', () => {
    expect(getStepPendingReasons(draft({ equipment: { method: 'wealth', classResolutions: [], rolledGold: null, purchasedItems: [] } }), 'equipment'))
      .toEqual(['Role o ouro inicial'])
    const std = getStepPendingReasons(draft({ equipment: { method: 'standard', classResolutions: [], rolledGold: null, purchasedItems: [] } }), 'equipment')
    expect(std.length).toBeGreaterThan(0)
    expect(std[0]).toMatch(/^Equipamento inicial: escolha entre /)
  })

  it('pré-requisito de multiclasse (Revisão)', () => {
    const d = draft({
      class: 'wizard', level: 3,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['arcana', 'history'], subclass: 'evocation' },
      abilityScores: { STR: 8, DEX: 12, CON: 10, INT: 15, WIS: 10, CHA: 10 },
      additionalClasses: [entry({ classId: 'fighter', level: 1, classChoices: { ...EMPTY_DRAFT.classChoices, fightingStyle: 'defense' } })],
      multiclass: true,
    })
    expect(getStepPendingReasons(d, 'review')).toEqual([
      'Guerreiro exige FOR 13 ou DES 13 para multiclassar (p. 163) — ajuste os atributos ou as classes',
    ])
  })

  it('etapa completa nunca tem motivo; getPendingSteps segue getMissingSteps', () => {
    for (const step of WIZARD_STEPS) expect(getStepPendingReasons(COMPLETE_DRAFT, step)).toEqual([])
    expect(getPendingSteps(COMPLETE_DRAFT)).toEqual([])
    expect(getPendingSteps(paladin2).map(p => p.step)).toEqual(['class'])
  })

  it('formatPendingHint: primeiro motivo e quantos mais', () => {
    expect(formatPendingHint([])).toBeUndefined()
    expect(formatPendingHint(['a'])).toBe('a')
    expect(formatPendingHint(['a', 'b'])).toBe('a (e mais 1 pendência)')
    expect(formatPendingHint(['a', 'b', 'c'])).toBe('a (e mais 2 pendências)')
  })
})

// ── Cobertura: os motivos espelham isStepComplete ────────────────────────────────

/** Um leque de fichas — completas, em branco e meio preenchidas em cada classe/raça/antecedente. */
function corpus(): CharacterDraft[] {
  const out: CharacterDraft[] = [structuredClone(EMPTY_DRAFT), structuredClone(COMPLETE_DRAFT), paladin2]
  for (const cls of CLASSES) {
    for (const level of [1, 2, 3, 4, 6, 8, 10, 14, 20]) {
      const base = draft({ class: cls.id, level, classChoices: structuredClone(EMPTY_DRAFT.classChoices) })
      out.push(base)
      const sub = cls.subclasses[0]
      out.push(draft({
        class: cls.id, level,
        classChoices: { ...EMPTY_DRAFT.classChoices, skills: cls.skillChoices.from.slice(0, cls.skillChoices.count), subclass: sub?.id ?? null },
        equipment: { method: 'standard', classResolutions: [], rolledGold: null, purchasedItems: [] },
      }))
      for (const s of cls.subclasses) {
        out.push(draft({ class: cls.id, level, classChoices: { ...EMPTY_DRAFT.classChoices, subclass: s.id } }))
      }
    }
    // Como classe adicional, com pré-requisito reprovado (atributos baixos) e aprovado.
    out.push(draft({
      class: 'fighter', level: 5,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'], fightingStyle: 'defense', subclass: 'champion' },
      abilityScores: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
      abilityMethod: 'custom',
      additionalClasses: [entry({ classId: cls.id, level: 2 })],
      multiclass: true,
    }))
  }
  for (const race of RACES) {
    out.push(draft({ race: race.id, subrace: null, raceChoices: {} }))
    for (const sub of race.subraces) out.push(draft({ race: race.id, subrace: sub.id, raceChoices: {} }))
  }
  for (const feat of ['perito', 'poliglota', 'mestre-de-armas', 'atleta', 'resiliente', 'adepto-marcial', 'iniciado-em-magia']) {
    out.push(draft({ race: 'human', subrace: 'variant-human', raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight'], feat } }))
    out.push(draft({ level: 4, asiChoices: [{ kind: 'feat', featId: feat }] }))
    out.push(draft({ level: 4, asiChoices: [{ kind: 'feat', featId: feat, abilities: ['STR'] }] }))
  }
  for (const bg of BACKGROUNDS) out.push(draft({ background: bg.id, backgroundChoices: {} }))
  out.push(
    draft({ abilityMethod: 'standard-array', abilityScores: { STR: 15, DEX: 15, CON: 13, INT: 12, WIS: 10, CHA: 8 } }),
    draft({ abilityMethod: 'point-buy', abilityScores: { STR: 15, DEX: 15, CON: 15, INT: 15, WIS: 15, CHA: 15 } }),
    draft({ abilityMethod: 'point-buy', abilityScores: { STR: 15, DEX: 15, CON: 15, INT: 8, WIS: 8, CHA: 8 } }),
    draft({ abilityMethod: 'roll', rolledValues: [10, 11, 12] }),
    draft({ abilityMethod: 'roll', rolledValues: [10, 11, 12, 13, 14, 15] }),
    draft({ abilityMethod: 'custom', abilityScores: { STR: 20, DEX: 15, CON: 13, INT: 12, WIS: 10, CHA: 8 } }),
    draft({ abilityScores: { STR: 15, DEX: null, CON: 13, INT: 12, WIS: 10, CHA: 8 } }),
    draft({ level: 4, asiChoices: [{ kind: 'asi', abilities: ['STR'] }] }),
    draft({ level: 8, abilityMethod: 'custom', abilityScores: { STR: 18, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }, asiChoices: [{ kind: 'asi', abilities: ['STR', 'STR'] }, { kind: 'asi', abilities: ['STR', 'STR'] }] }),
    draft({ level: 4, additionalClasses: [entry({ classId: 'fighter', level: 4 })], multiclass: true }),
    draft({ equipment: { method: 'wealth', classResolutions: [], rolledGold: null, purchasedItems: [] } }),
    draft({ class: null, equipment: { method: 'standard', classResolutions: [], rolledGold: null, purchasedItems: [] } }),
    draft({ class: 'fighter', equipment: { method: 'standard', classResolutions: [{ optionIndex: 0, pickedIds: [] }, { optionIndex: 1, pickedIds: ['longsword'] }], rolledGold: null, purchasedItems: [] } }),
    draft({
      class: 'fighter', level: 8,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'], fightingStyle: 'defense', subclass: 'eldritch-knight' },
      spellChoices: { cantrips: ['fire-bolt', 'light'], spells: ['magic-missile', 'sleep', 'charm-person', 'fog-cloud', 'shield', 'burning-hands'] },
    }),
  )
  out.push(...bardSecretsDrafts(), ...pactBoonDrafts(), ...draconicAncestorDrafts(), ...totemWarriorDrafts(), ...martialAdeptDrafts(), ...magicInitiateDrafts())
  out.push(...repeatedProficiencyDrafts())
  return out
}

/**
 * Perícia e ferramenta repetidas entre fontes (p. 125), com e sem a repetição: na lista da classe
 * (pelo antecedente e pela raça), na subclasse, na classe da multiclasse, na raça, no antecedente e
 * no talento (pelo espaço de ASI e pelo Humano Variante). O Domínio do Conhecimento repete sem
 * pendência.
 */
function repeatedProficiencyDrafts(): CharacterDraft[] {
  const fighter = (skills: string[], background: string) => draft({
    class: 'fighter', background,
    classChoices: { ...EMPTY_DRAFT.classChoices, skills, fightingStyle: 'defense' },
  })
  const bard = (subclassSkills: string[], bgTools: string[]) => draft({
    class: 'bard', level: 3, background: 'entertainer', backgroundChoices: { tools: bgTools },
    classChoices: {
      ...EMPTY_DRAFT.classChoices,
      skills: ['acrobatics', 'deception', 'insight'], tools: ['lute', 'flute', 'drum'], expertiseItems: ['deception', 'insight'],
      subclass: 'college-of-lore', subclassExtras: { skills: subclassSkills },
    },
  })
  const halfElf = (skills: string[]) => draft({
    race: 'half-elf', background: 'acolyte',
    raceChoices: { abilityBonuses: ['STR', 'DEX'], skills, languages: ['dwarvish'] },
  })
  const peritoAsi = (skills: string[]) => draft({ level: 4, asiChoices: [{ kind: 'feat', featId: 'perito' }], featSelections: { perito: { skills } } })
  const peritoRace = (skills: string[]) => draft({
    race: 'human', subrace: 'variant-human',
    raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight'], languages: ['elvish'], feat: 'perito' },
    featSelections: { perito: { skills } },
  })
  const dwarf = (tools: string[]) => draft({
    race: 'dwarf', subrace: 'hill-dwarf', raceChoices: { tools: ['smiths-tools'] },
    class: 'fighter', level: 3,
    classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'], fightingStyle: 'defense', subclass: 'battle-master', subclassExtras: { tools } },
  })
  const ranger = (skills: string[]) => draft({
    class: 'barbarian', level: 3,
    abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 13, CHA: 8 },
    additionalClasses: [entry({ classId: 'ranger', level: 2, classChoices: { ...EMPTY_DRAFT.classChoices, skills, fightingStyle: 'archery' } })],
    multiclass: true,
  })
  return [
    fighter(['athletics', 'perception'], 'sailor'),
    fighter(['athletics', 'perception'], 'acolyte'),
    fighter(['intimidation', 'history'], 'acolyte'),
    draft({ classChoices: { ...COMPLETE_DRAFT.classChoices, skills: ['intimidation', 'survival'] } }),
    bard(['deception', 'arcana', 'history'], ['viol']),
    bard(['arcana', 'history', 'nature'], ['lute']),
    bard(['arcana', 'history', 'nature'], ['viol']),
    draft({
      class: 'cleric', background: 'sage',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['insight', 'medicine'], subclass: 'knowledge-domain', subclassExtras: { skills: ['arcana', 'history'], languages: ['elvish', 'dwarvish'] } },
    }),
    halfElf(['insight', 'stealth']),
    halfElf(['arcana', 'stealth']),
    peritoAsi(['athletics', 'stealth', 'arcana']),
    peritoAsi(['nature', 'stealth', 'arcana']),
    peritoRace(['insight', 'stealth', 'arcana']),
    peritoRace(['nature', 'stealth', 'arcana']),
    dwarf(['smiths-tools']),
    dwarf(['masons-tools']),
    ranger(['survival']),
    ranger(['stealth']),
    // Druida como classe adicional: não dá ferramenta (p. 164), então o Kit de Herbalismo do monge
    // ou do Perito só repete quando outra fonte o dá de fato (Eremita).
    monkDruidDraft(['herbalism-kit'], 'sailor'),
    monkDruidDraft(['herbalism-kit'], 'hermit'),
    peritoDruidDraft(['herbalism-kit']),
    peritoDruidDraft(['navigators-tools']),
  ]
}

describe('motivos × isStepComplete — perícia e ferramenta repetidas', () => {
  const drafts = repeatedProficiencyDrafts()

  it('o leque tem as etapas donas da escolha aprovadas e reprovadas', () => {
    for (const step of ['race', 'class', 'improvements', 'background'] as const) {
      expect(drafts.some(d => isStepComplete(d, step)), step).toBe(true)
      expect(drafts.some(d => !isStepComplete(d, step)), step).toBe(true)
    }
  })
})

/**
 * Adepto Marcial (p. 167) sem, com uma, com duas manobras e com uma que o Mestre de Batalha já
 * ensina — pelo espaço de ASI e pelo Humano Variante, com e sem o arquétipo.
 */
function martialAdeptDrafts(): CharacterDraft[] {
  const out: CharacterDraft[] = []
  const picks: (string[] | undefined)[] = [undefined, ['aparar'], ['aparar', 'ataque-de-precisao'], ['ataque-de-precisao', 'contra-atacar']]
  const fighter = (subclass: string) => ({
    class: 'fighter', level: 4,
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      skills: ['acrobatics', 'history'], fightingStyle: 'defense', subclass,
      progressionChoices: { 'battle-master-maneuvers-3': ['aparar', 'derrubar', 'inspirar'] },
    },
  })
  for (const maneuvers of picks) {
    const featSelections: CharacterDraft['featSelections'] = maneuvers ? { 'adepto-marcial': { maneuvers } } : {}
    out.push(draft({ level: 4, asiChoices: [{ kind: 'feat', featId: 'adepto-marcial' }], featSelections }))
    for (const subclass of ['battle-master', 'champion']) {
      out.push(draft({ ...fighter(subclass), asiChoices: [{ kind: 'feat', featId: 'adepto-marcial' }], featSelections }))
      out.push(draft({
        ...fighter(subclass),
        race: 'human', subrace: 'variant-human',
        raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight'], feat: 'adepto-marcial' },
        featSelections,
      }))
    }
  }
  return out
}

describe('motivos × isStepComplete — Adepto Marcial', () => {
  const drafts = martialAdeptDrafts()

  it('o leque tem etapa Aprimoramentos e Raça aprovadas e reprovadas', () => {
    for (const step of ['improvements', 'race'] as const) {
      expect(drafts.some(d => isStepComplete(d, step)), step).toBe(true)
      expect(drafts.some(d => !isStepComplete(d, step)), step).toBe(true)
    }
  })
})

/**
 * Iniciado em Magia (p. 170) sem classe, com classe fora do talento, com escolhas faltando, com
 * magia de outra lista e completo — pelo espaço de ASI e pelo Humano Variante, num bárbaro e num
 * mago (truque repetido com o da classe: aviso, não pendência).
 */
function magicInitiateDrafts(): CharacterDraft[] {
  const out: CharacterDraft[] = []
  const picks: (CharacterDraft['featSelections'][string] | undefined)[] = [
    undefined,
    { spellClass: 'paladin', spells: ['cure-wounds'] },
    { spellClass: 'wizard' },
    { spellClass: 'wizard', cantrips: ['fire-bolt'] },
    { spellClass: 'wizard', cantrips: ['fire-bolt', 'light'], spells: ['cure-wounds'] },
    { spellClass: 'wizard', cantrips: ['fire-bolt', 'light'], spells: ['sleep'] },
    { spellClass: 'cleric', cantrips: ['sacred-flame', 'guidance'], spells: ['cure-wounds'] },
  ]
  const wizard = {
    class: 'wizard',
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['arcana', 'history'] },
    spellChoices: { cantrips: ['fire-bolt', 'light', 'mage-hand'], spells: ['sleep', 'shield'] },
  }
  for (const selections of picks) {
    const featSelections: CharacterDraft['featSelections'] = selections ? { 'iniciado-em-magia': selections } : {}
    for (const cls of [{}, wizard]) {
      out.push(draft({ ...cls, level: 4, asiChoices: [{ kind: 'feat', featId: 'iniciado-em-magia' }], featSelections }))
      out.push(draft({
        ...cls,
        race: 'human', subrace: 'variant-human',
        raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight'], feat: 'iniciado-em-magia' },
        featSelections,
      }))
    }
  }
  return out
}

describe('motivos × isStepComplete — Iniciado em Magia', () => {
  const drafts = magicInitiateDrafts()

  it('o leque tem etapa Aprimoramentos e Raça aprovadas e reprovadas', () => {
    for (const step of ['improvements', 'race'] as const) {
      expect(drafts.some(d => isStepComplete(d, step)), step).toBe(true)
      expect(drafts.some(d => !isStepComplete(d, step)), step).toBe(true)
    }
  })
})

/**
 * Feiticeiros da Linhagem Dracônica sem e com o Ancestral Dracônico (p. 80), e com a escolha
 * guardada de quando eram dracônicos mas hoje na Magia Selvagem — na classe primária e como
 * classe da multiclasse.
 */
function draconicAncestorDrafts(): CharacterDraft[] {
  const out: CharacterDraft[] = []
  const variants: [string, Record<string, string[]>][] = [
    ['draconic-bloodline', {}],
    ['draconic-bloodline', { 'draconic-ancestor-1': ['red'] }],
    ['wild-magic', { 'draconic-ancestor-1': ['red'] }],
  ]
  for (const level of [1, 6]) {
    for (const [subclass, progressionChoices] of variants) {
      const classChoices = { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['arcana', 'persuasion'], subclass, progressionChoices }
      out.push(draft({ class: 'sorcerer', level, classChoices }))
      out.push(draft({
        level: level + 1,
        abilityMethod: 'custom',
        abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 13 },
        additionalClasses: [entry({ classId: 'sorcerer', level, classChoices: { ...classChoices, skills: [] } })],
        multiclass: true,
      }))
    }
  }
  return out
}

describe('motivos × isStepComplete — Ancestral Dracônico', () => {
  const sorcerers = draconicAncestorDrafts()

  it('o leque de feiticeiros tem etapa Classe aprovada e reprovada', () => {
    expect(sorcerers.some(d => isStepComplete(d, 'class'))).toBe(true)
    expect(sorcerers.some(d => !isStepComplete(d, 'class'))).toBe(true)
  })
})

/**
 * Guerreiros Totêmicos (p. 50) com nenhuma, uma, duas e as três escolhas de animal — Totem
 * Espiritual (3º), Aspecto da Besta (6º), Sintonia Totêmica (14º) — nos níveis em que cada uma é
 * liberada, na classe primária e como classe da multiclasse.
 */
function totemWarriorDrafts(): CharacterDraft[] {
  const variants: Record<string, string[]>[] = [
    {},
    { 'totem-warrior-totem-3': ['bear'] },
    { 'totem-warrior-totem-3': ['bear'], 'totem-warrior-aspect-6': ['eagle'] },
    { 'totem-warrior-totem-3': ['bear'], 'totem-warrior-aspect-6': ['eagle'], 'totem-warrior-attunement-14': ['wolf'] },
    { 'totem-warrior-totem-3': ['bear', 'wolf'] },
  ]
  const out: CharacterDraft[] = []
  for (const level of [3, 6, 14]) {
    for (const progressionChoices of variants) {
      const classChoices = { ...structuredClone(COMPLETE_DRAFT.classChoices), subclass: 'totem-warrior', progressionChoices }
      out.push(draft({ class: 'barbarian', level, classChoices }))
      out.push(draft({
        class: 'fighter', level: level + 1,
        classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'], fightingStyle: 'defense', subclass: 'champion' },
        abilityMethod: 'custom',
        abilityScores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
        additionalClasses: [entry({ classId: 'barbarian', level, classChoices: { ...classChoices, skills: [] } })],
        multiclass: true,
      }))
    }
  }
  return out
}

describe('motivos × isStepComplete — Guerreiro Totêmico', () => {
  const barbarians = totemWarriorDrafts()

  it('o leque de bárbaros tem etapa Classe aprovada e reprovada', () => {
    expect(barbarians.some(d => isStepComplete(d, 'class'))).toBe(true)
    expect(barbarians.some(d => !isStepComplete(d, 'class'))).toBe(true)
  })

  it('ficha antiga com o totem único: vira o Totem Espiritual e as outras escolhas ficam pendentes', () => {
    // Antes havia um slot só ("Espírito Totêmico", mesmo id) e o texto subia de degrau com o nível.
    const old = sanitizeImportedDraft(JSON.parse(JSON.stringify(draft({
      class: 'barbarian', level: 14,
      classChoices: { ...COMPLETE_DRAFT.classChoices, subclass: 'totem-warrior', progressionChoices: { 'totem-warrior-totem-3': ['bear'] } },
    }))))!
    expect(old.classChoices.progressionChoices).toEqual({ 'totem-warrior-totem-3': ['bear'] })
    expect(isStepComplete(old, 'class')).toBe(false)
    expect(getStepPendingReasons(old, 'class')).toEqual([
      'Bárbaro: escolha mais 1 em Aspecto da Besta (ganho no 6º nível)',
      'Bárbaro: escolha mais 1 em Sintonia Totêmica (ganho no 14º nível)',
    ])
    expect(isStepComplete({ ...old, level: 3 }, 'class')).toBe(true)
  })
})

/**
 * Bruxos com e sem Dádiva do Pacto (p. 58-59): sem pacto, cada pacto, Tomo com os truques
 * faltando/completos/com magia de 1º nível, invocação com e sem o pacto que ela exige — na classe
 * primária e como classe da multiclasse.
 */
function pactBoonDrafts(): CharacterDraft[] {
  const base = { 'warlock-invocations-2': ['armadura-de-sombras', 'visao-diabolica'] }
  const variants: Record<string, string[]>[] = [
    base,
    { ...base, 'warlock-pact-boon-3': ['pact-of-the-blade'] },
    { ...base, 'warlock-pact-boon-3': ['pact-of-the-chain'], 'warlock-pact-tome-cantrips-3': ['guidance'] },
    { ...base, 'warlock-pact-boon-3': ['pact-of-the-tome'] },
    { ...base, 'warlock-pact-boon-3': ['pact-of-the-tome'], 'warlock-pact-tome-cantrips-3': ['guidance', 'fire-bolt', 'sacred-flame'] },
    { ...base, 'warlock-pact-boon-3': ['pact-of-the-tome'], 'warlock-pact-tome-cantrips-3': ['guidance', 'fire-bolt', 'shield'] },
    { ...base, 'warlock-pact-boon-3': ['pact-of-the-blade'], 'warlock-invocations-5': ['lamina-sedenta'] },
    { ...base, 'warlock-pact-boon-3': ['pact-of-the-chain'], 'warlock-invocations-5': ['lamina-sedenta'] },
    { 'warlock-invocations-2': ['voz-do-mestre-das-correntes', 'livro-de-segredos-antigos'] },
  ]
  const out: CharacterDraft[] = []
  for (const level of [2, 3, 5]) {
    for (const progressionChoices of variants) {
      const classChoices = { ...structuredClone(EMPTY_DRAFT.classChoices), skills: ['arcana', 'deception'], subclass: 'fiend', progressionChoices }
      out.push(draft({ class: 'warlock', level, classChoices }))
      out.push(draft({
        level: level + 1,
        additionalClasses: [entry({ classId: 'warlock', level, classChoices })],
        multiclass: true,
      }))
    }
  }
  return out
}

describe('motivos × isStepComplete — Dádiva do Pacto', () => {
  const warlocks = pactBoonDrafts()

  it('o leque de bruxos tem etapa Classe aprovada e reprovada', () => {
    expect(warlocks.some(d => isStepComplete(d, 'class'))).toBe(true)
    expect(warlocks.some(d => !isStepComplete(d, 'class'))).toBe(true)
  })
})

/**
 * Bardos 10/14/18 com Segredos Mágicos (magia e truque, ocupando vaga das colunas) e as escolhas
 * da etapa Magias faltando, exatas e sobrando — exercita os ramos de Segredos dos motivos. Mais
 * Segredos truque além da coluna e acima do nível conjurável, que reprovam a etapa Classe.
 */
function bardSecretsDrafts(): CharacterDraft[] {
  const SECRETS = ['fire-bolt', 'fireball', 'counterspell', 'cone-of-cold', 'haste', 'revivify']
  const cantripPool = getSpellsByClass('bard').filter(s => s.level === 0).map(s => s.id)
  const spellPool = getSpellsByClass('bard').filter(s => s.level >= 1 && s.level <= 5 && !SECRETS.includes(s.id)).map(s => s.id)
  const known: Record<number, number> = { 10: 14, 14: 18, 18: 22 }
  const slotsByLevel: Record<number, Record<string, string[]>> = {
    10: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'] },
    14: { 'bard-magical-secrets-10': ['fire-bolt', 'fireball'], 'bard-magical-secrets-14': ['counterspell', 'cone-of-cold'] },
    18: {
      'bard-magical-secrets-10': ['fire-bolt', 'fireball'],
      'bard-magical-secrets-14': ['counterspell', 'cone-of-cold'],
      'bard-magical-secrets-18': ['haste', 'revivify'],
    },
  }
  const classChoices = (progressionChoices: Record<string, string[]>) => ({
    ...structuredClone(EMPTY_DRAFT.classChoices),
    skills: ['acrobatics', 'deception', 'performance'],
    tools: ['lute', 'flute', 'pan-flute'],
    expertiseItems: ['acrobatics', 'deception', 'performance', 'persuasion'],
    subclass: 'college-of-valor',
    progressionChoices,
  })
  const out: CharacterDraft[] = []
  for (const level of [10, 14, 18]) {
    const progressionChoices = slotsByLevel[level]
    const spellSecrets = Object.values(progressionChoices).flat().filter(id => id !== 'fire-bolt').length
    const spellsExact = known[level] - spellSecrets
    for (const cantrips of [2, 3, 4]) {
      for (const spells of [spellsExact - 1, spellsExact, spellsExact + 2]) {
        out.push(draft({
          class: 'bard', level,
          classChoices: classChoices(progressionChoices),
          spellChoices: { cantrips: cantripPool.slice(0, cantrips), spells: spellPool.slice(0, spells) },
        }))
      }
    }
  }
  const tooManyCantrips = {
    'bard-magical-secrets-10': ['fire-bolt', 'shillelagh'],
    'bard-magical-secrets-14': ['sacred-flame', 'ray-of-frost'],
    'bard-magical-secrets-18': ['eldritch-blast', 'guidance'],
  }
  out.push(
    draft({ class: 'bard', level: 18, classChoices: classChoices(tooManyCantrips), spellChoices: { cantrips: [], spells: spellPool.slice(0, 22) } }),
    draft({ class: 'bard', level: 10, classChoices: classChoices({ 'bard-magical-secrets-10': ['wish', 'fireball'] }), spellChoices: { cantrips: cantripPool.slice(0, 4), spells: spellPool.slice(0, 13) } }),
  )
  return out
}

describe('motivos × isStepComplete (cobertura)', () => {
  const drafts = corpus()

  it('o corpus tem fichas reprovadas e aprovadas em todas as etapas', () => {
    for (const step of WIZARD_STEPS) {
      expect(drafts.some(d => isStepComplete(d, step)), step).toBe(true)
      expect(drafts.some(d => !isStepComplete(d, step)), step).toBe(true)
    }
  })

  it('todo draft que isStepComplete reprova tem ao menos um motivo concreto — e o aprovado, nenhum', () => {
    for (const [i, d] of drafts.entries()) {
      for (const step of WIZARD_STEPS) {
        const reasons = collectStepReasons(d, step)
        const complete = isStepComplete(d, step)
        expect(reasons.length === 0, `draft #${i} (${d.class ?? '-'} ${d.level}) etapa ${step}: ${reasons.join(' | ')}`).toBe(complete)
      }
    }
  })
})

describe('motivos × isStepComplete — bardos com Segredos Mágicos', () => {
  const bards = bardSecretsDrafts()

  it('o leque de bardos tem etapa Magias aprovada e reprovada, e etapa Classe reprovada pelos Segredos', () => {
    expect(bards.some(d => isStepComplete(d, 'spells'))).toBe(true)
    expect(bards.some(d => !isStepComplete(d, 'spells'))).toBe(true)
    expect(bards.some(d => isStepComplete(d, 'class'))).toBe(true)
    expect(bards.filter(d => !isStepComplete(d, 'class'))).toHaveLength(2)
  })

  it('bardo 14 com Segredo truque e magias: falta dita já descontando os Segredos', () => {
    const short = bards.find(d => d.level === 14 && d.spellChoices.cantrips.length === 2 && d.spellChoices.spells.length === 14)!
    expect(getStepPendingReasons(short, 'spells')).toEqual(['Bardo: escolha 1 truque e 1 magia'])
  })
})
