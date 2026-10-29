import { describe, it, expect } from 'vitest'
import { EMPTY_DRAFT, type CharacterDraft, type ClassEntry } from '../../types/character'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getProgressionSlotsUpToLevel } from '../progressionChoiceUtils'
import { getProgressionChoiceBlocks, getProgressionOptions, getUnmetPickRequirements } from '../progressionOptions'
import { isStepComplete, sanitizeImportedDraft } from '../draftValidation'
import { getStepPendingReasons } from '../pendingReasons'
import { getCasterEntries, getRepeatedSpells, getSecretSpellGroups, formatSecretGroupSpellName } from '../spellUtils'
import { allClassEntries } from '../multiclassUtils'

// Dádiva do Pacto (bruxo 3, p. 58-59) e as invocações que exigem um pacto (p. 61-62).

const PACT = 'warlock-pact-boon-3'
const TOME = 'warlock-pact-tome-cantrips-3'

function warlock(level: number, progressionChoices: Record<string, string[]>): CharacterDraft {
  return {
    ...structuredClone(COMPLETE_DRAFT),
    class: 'warlock',
    level,
    classChoices: {
      ...structuredClone(EMPTY_DRAFT.classChoices),
      skills: ['arcana', 'deception'],
      subclass: 'fiend',
      progressionChoices,
    },
    spellChoices: { cantrips: ['eldritch-blast', 'chill-touch'], spells: [] },
  }
}

function warlockEntry(level: number, progressionChoices: Record<string, string[]>): ClassEntry {
  return {
    classId: 'warlock',
    level,
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'fiend', progressionChoices },
    spellChoices: { cantrips: [], spells: [] },
    asiChoices: [],
    hpRolls: [],
  }
}

const INVOCATIONS_2 = { 'warlock-invocations-2': ['armadura-de-sombras', 'visao-diabolica'] }

describe('slots da Dádiva do Pacto', () => {
  it('o pacto chega no 3º nível de bruxo', () => {
    expect(getProgressionSlotsUpToLevel('warlock', 'fiend', 2).map(s => s.id)).not.toContain(PACT)
    expect(getProgressionSlotsUpToLevel('warlock', 'fiend', 3).map(s => s.id)).toContain(PACT)
  })

  it('as três opções são Corrente, Lâmina e Tomo', () => {
    expect(getProgressionOptions('pact-boons').map(o => o.name)).toEqual(['Pacto da Corrente', 'Pacto da Lâmina', 'Pacto do Tomo'])
  })

  it('os truques do Livro das Sombras só existem com o Pacto do Tomo', () => {
    const ids = (choices: Record<string, string[]>) => getProgressionSlotsUpToLevel('warlock', 'fiend', 3, choices).map(s => s.id)
    expect(ids({})).not.toContain(TOME)
    expect(ids({ [PACT]: ['pact-of-the-blade'] })).not.toContain(TOME)
    expect(ids({ [PACT]: ['pact-of-the-tome'] })).toContain(TOME)
    // Pacto gravado numa ficha que baixou para o 2º nível não abre o slot.
    expect(getProgressionSlotsUpToLevel('warlock', 'fiend', 2, { [PACT]: ['pact-of-the-tome'] }).map(s => s.id)).not.toContain(TOME)
  })
})

describe('etapa Classe', () => {
  it('bruxo 3 sem pacto (ficha antiga) fica pendente com motivo', () => {
    const d = warlock(3, INVOCATIONS_2)
    expect(isStepComplete(d, 'class')).toBe(false)
    expect(getStepPendingReasons(d, 'class')).toEqual(['Bruxo: escolha mais 1 em Dádiva do Pacto (ganho no 3º nível)'])
  })

  it('com o Pacto da Lâmina, completa', () => {
    const d = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-blade'] })
    expect(isStepComplete(d, 'class')).toBe(true)
    expect(getStepPendingReasons(d, 'class')).toEqual([])
  })

  it('Pacto do Tomo pede os três truques', () => {
    const tome = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-tome'] })
    expect(isStepComplete(tome, 'class')).toBe(false)
    expect(getStepPendingReasons(tome, 'class')).toEqual(['Bruxo: escolha mais 3 em Truques do Livro das Sombras (ganho no 3º nível)'])
    const done = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-tome'], [TOME]: ['guidance', 'fire-bolt', 'sacred-flame'] })
    expect(isStepComplete(done, 'class')).toBe(true)
  })

  it('magia de 1º nível ou mais no Livro das Sombras (ficha importada) reprova com motivo', () => {
    const d = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-tome'], [TOME]: ['guidance', 'fire-bolt', 'shield'] })
    expect(isStepComplete(d, 'class')).toBe(false)
    expect(getStepPendingReasons(d, 'class')).toEqual([
      'Bruxo: Escudo Arcano (1º) não é truque — em Truques do Livro das Sombras só entram truques; troque',
    ])
  })

  it('trocar o Tomo por outro pacto esquece os truques (o slot some), sem apagar a escolha', () => {
    const d = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-chain'], [TOME]: ['guidance'] })
    expect(isStepComplete(d, 'class')).toBe(true)
    expect(getCasterEntries(d)[0].bonusSpells).not.toContain('guidance')
    expect(d.classChoices.progressionChoices[TOME]).toEqual(['guidance'])
  })
})

describe('invocações que exigem um pacto', () => {
  it('declaram o pacto nos dados, conforme o livro', () => {
    const required = Object.fromEntries(
      getProgressionOptions('eldritch-invocations').filter(o => o.requiresPick).map(o => [o.id, o.requiresPick]),
    )
    expect(required).toEqual({
      'correntes-de-carceri': 'pact-of-the-chain',
      'lamina-sedenta': 'pact-of-the-blade',
      'livro-de-segredos-antigos': 'pact-of-the-tome',
      'sorvedor-de-vida': 'pact-of-the-blade',
      'voz-do-mestre-das-correntes': 'pact-of-the-chain',
    })
  })

  it('Lâmina Sedenta sem o Pacto da Lâmina fica pendente, com o que trocar', () => {
    const choices = {
      ...INVOCATIONS_2,
      [PACT]: ['pact-of-the-tome'],
      [TOME]: ['guidance', 'fire-bolt', 'sacred-flame'],
      'warlock-invocations-5': ['lamina-sedenta'],
    }
    expect(getUnmetPickRequirements('warlock', 'fiend', 5, choices).map(u => [u.option.id, u.required.id])).toEqual([
      ['lamina-sedenta', 'pact-of-the-blade'],
    ])
    const d = warlock(5, choices)
    expect(isStepComplete(d, 'class')).toBe(false)
    expect(getStepPendingReasons(d, 'class')).toEqual([
      'Bruxo: Lâmina Sedenta requer Pacto da Lâmina (Dádiva do Pacto, 3º nível) — troque em Invocações Místicas ou escolha Pacto da Lâmina em Dádiva do Pacto',
    ])
    const fixed = warlock(5, { ...choices, [PACT]: ['pact-of-the-blade'] })
    expect(getUnmetPickRequirements('warlock', 'fiend', 5, fixed.classChoices.progressionChoices)).toEqual([])
    expect(isStepComplete(fixed, 'class')).toBe(true)
  })

  it('bruxo 2 com Voz do Mestre das Correntes: o pacto ainda não chegou', () => {
    const d = warlock(2, { 'warlock-invocations-2': ['voz-do-mestre-das-correntes', 'visao-diabolica'] })
    expect(isStepComplete(d, 'class')).toBe(false)
    expect(getStepPendingReasons(d, 'class')[0]).toMatch(/^Bruxo: Voz do Mestre das Correntes requer Pacto da Corrente \(Dádiva do Pacto, 3º nível\)/)
  })

  it('bruxo como classe da multiclasse: pacto e pré-requisito pelo nível NA classe', () => {
    const d: CharacterDraft = {
      ...structuredClone(COMPLETE_DRAFT),
      level: 4,
      multiclass: true,
      additionalClasses: [warlockEntry(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-blade'] })],
    }
    const [, entry] = allClassEntries(d)
    expect(getProgressionSlotsUpToLevel('warlock', 'fiend', entry.level, entry.classChoices.progressionChoices).map(s => s.id)).toContain(PACT)
    const noPact = { ...d, additionalClasses: [warlockEntry(3, INVOCATIONS_2)] }
    expect(getStepPendingReasons(noPact, 'class')).toContain('Bruxo: escolha mais 1 em Dádiva do Pacto (ganho no 3º nível)')
  })
})

describe('ficha: Revisão e PDF', () => {
  it('o pacto sai nas Escolhas de Progressão, com o texto', () => {
    const [block] = getProgressionChoiceBlocks(allClassEntries(warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-chain'] })))
    const pact = block.slots.find(s => s.slot.id === PACT)
    expect(pact?.picks.map(p => p.name)).toEqual(['Pacto da Corrente'])
    expect(pact?.picks[0].text).toMatch(/^Você aprende a magia convocar familiar/)
    expect(pact?.picks[0].unmet).toBeUndefined()
  })

  it('a invocação sem o pacto sai com o aviso', () => {
    const [block] = getProgressionChoiceBlocks(allClassEntries(warlock(5, {
      ...INVOCATIONS_2, [PACT]: ['pact-of-the-chain'], 'warlock-invocations-5': ['lamina-sedenta'],
    })))
    const pick = block.slots.flatMap(s => s.picks).find(p => p.id === 'lamina-sedenta')
    expect(pick?.unmet?.name).toBe('Pacto da Lâmina')
  })

  it('os truques do Livro das Sombras entram como magias do bruxo, por cima dos truques conhecidos', () => {
    const d = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-tome'], [TOME]: ['guidance', 'fire-bolt', 'sacred-flame'] })
    const [caster] = getCasterEntries(d)
    expect(caster.bonusSpells).toEqual(['guidance', 'fire-bolt', 'sacred-flame'])
    expect(caster.knownSecrets).toEqual({ cantrips: [], spells: [] })
    expect(getSecretSpellGroups(caster).map(g => [g.kind, g.title, g.spells.map(s => s.id)])).toEqual([
      ['additional', 'Truques do Livro das Sombras (por cima dos truques conhecidos)', ['guidance', 'fire-bolt', 'sacred-flame']],
    ])
    // O título já diz que são truques: cada item sai só com o nome, sem "(truque)".
    const [tome] = getSecretSpellGroups(caster)
    expect(tome.spells.map(s => formatSecretGroupSpellName(tome, s))).toEqual(['Orientação', 'Raio de Fogo', 'Chama Sagrada'])
  })

  it('truque do Livro igual a um truque do bruxo vira aviso de magia repetida', () => {
    const d = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-tome'], [TOME]: ['eldritch-blast', 'fire-bolt', 'sacred-flame'] })
    const repeated = getRepeatedSpells(d)
    expect(repeated.map(r => [r.spellId, r.sources.map(s => s.label)])).toEqual([
      ['eldritch-blast', ['Bruxo', 'Bruxo — Truques do Livro das Sombras']],
    ])
  })
})

describe('Pacto da Corrente: convocar familiar (p. 58)', () => {
  it('entra como magia do bruxo, por cima das conhecidas, sem ser gravada no draft', () => {
    const d = warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-chain'] })
    const [caster] = getCasterEntries(d)
    expect(caster.bonusSpells).toEqual(['find-familiar'])
    expect(caster.spells).toEqual([])
    expect(getSecretSpellGroups(caster).map(g => [g.title, g.spells.map(s => s.id)])).toEqual([
      ['Pacto da Corrente (por cima das conhecidas)', ['find-familiar']],
    ])
  })

  it('outro pacto, ou bruxo abaixo do 3º nível, não tem', () => {
    expect(getCasterEntries(warlock(3, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-blade'] }))[0].bonusSpells).toEqual([])
    expect(getCasterEntries(warlock(2, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-chain'] }))[0].bonusSpells).toEqual([])
  })

  it('convocar familiar também escolhida como magia de mago vira aviso de repetida', () => {
    const d: CharacterDraft = {
      ...warlock(5, { ...INVOCATIONS_2, [PACT]: ['pact-of-the-chain'] }),
      multiclass: true,
      additionalClasses: [{
        classId: 'wizard', level: 1,
        classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices) },
        spellChoices: { cantrips: [], spells: ['find-familiar'] },
        asiChoices: [], hpRolls: [],
      }],
    }
    expect(getRepeatedSpells(d).map(r => [r.spellId, r.sources.map(s => s.label)])).toEqual([
      ['find-familiar', ['Bruxo — Pacto da Corrente', 'Mago']],
    ])
  })
})

describe('ficha antiga', () => {
  it('bruxo 3 importado sem pacto carrega e fica pendente na etapa Classe', () => {
    const raw = JSON.parse(JSON.stringify(warlock(3, INVOCATIONS_2)))
    const loaded = sanitizeImportedDraft(raw)
    expect(loaded).not.toBeNull()
    expect(loaded!.classChoices.progressionChoices).toEqual(INVOCATIONS_2)
    expect(isStepComplete(loaded!, 'class')).toBe(false)
  })
})
