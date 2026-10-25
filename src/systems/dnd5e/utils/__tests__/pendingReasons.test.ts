import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, WIZARD_STEPS, type CharacterDraft, type ClassEntry } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { isStepComplete } from '../draftValidation'
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

const paladin2: CharacterDraft = draft({
  class: 'paladin', level: 2,
  classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'religion'] },
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
      additionalClasses: [entry({ classId: 'ranger', level: 2, classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['survival'] } })],
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
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'], fightingStyle: 'defense', subclass: 'eldritch-knight' },
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
      raceChoices: { abilityBonuses: ['STR', 'CON'], skills: ['athletics'], languages: ['elvish'], feat: 'perito' },
      featSelections: { perito: { skills: ['stealth'] } },
    })
    expect(getStepPendingReasons(perito, 'race')).toEqual(['Humano (Variante), talento Perito: escolha mais 2 perícias ou ferramentas'])
  })

  it('perícias da classe: falta e excesso', () => {
    const falta = draft({ classChoices: { ...COMPLETE_DRAFT.classChoices, skills: ['athletics'] } })
    expect(getStepPendingReasons(falta, 'class')).toEqual(['Bárbaro: escolha mais 1 perícia da classe'])
    const excesso = draft({ classChoices: { ...COMPLETE_DRAFT.classChoices, skills: ['athletics', 'intimidation', 'survival'] } })
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
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'], fightingStyle: 'defense' },
      additionalClasses: [entry({ classId: 'paladin', level: 2, classChoices: { ...EMPTY_DRAFT.classChoices, fightingStyle: 'defense' } })],
      multiclass: true,
    })
    expect(getStepPendingReasons(d, 'class')).toEqual([
      'Estilo de Luta Defesa escolhido duas vezes — o mesmo estilo não vale duas vezes (p. 85); troque um deles',
    ])
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
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'], fightingStyle: 'defense', subclass: 'champion' },
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
  for (const feat of ['perito', 'poliglota', 'mestre-de-armas', 'atleta', 'resiliente']) {
    out.push(draft({ race: 'human', subrace: 'variant-human', raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['athletics'], feat } }))
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
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'], fightingStyle: 'defense', subclass: 'eldritch-knight' },
      spellChoices: { cantrips: ['fire-bolt', 'light'], spells: ['magic-missile', 'sleep', 'charm-person', 'fog-cloud', 'shield', 'burning-hands'] },
    }),
  )
  out.push(...bardSecretsDrafts(), ...pactBoonDrafts())
  return out
}

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
