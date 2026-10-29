import { describe, it, expect } from 'vitest'
import { jsonFingerprint } from '../../../../core/utils/canonicalJson'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { SheetSnapshot } from '../../types/playState'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getFinalAbilityScores } from '../asiUtils'
import { buildPlaySheet } from '../playSheet'
import { createPlayState, sanitizePlayState } from '../playState'
import { getRollGuide } from '../rollGuide'
import { getSheetArmorClass } from '../sheetEffects'
import { describeSheetChanges, syncSheetSnapshot, takeSheetSnapshot } from '../sheetSnapshot'

/** Personagem de 5º nível, mago 3 / clérigo 2: duas conjurações, espaços até o 3º nível. */
const caster: CharacterDraft = {
  ...structuredClone(EMPTY_DRAFT),
  name: 'Elminster',
  class: 'wizard',
  level: 5,
  abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 16, WIS: 14, CHA: 10 },
  multiclass: true,
  additionalClasses: [{
    classId: 'cleric', level: 2, classChoices: structuredClone(EMPTY_DRAFT.classChoices),
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  }],
}

const SLOTS = [2, 0, 0, 0, 0, 0, 0, 0, 0]

function snapshot(patch: Partial<SheetSnapshot> = {}): SheetSnapshot {
  return {
    sheetUpdatedAt: 10,
    draftFingerprint: 'abc',
    maxHp: 12,
    armorClass: 15,
    spellcasting: [{ key: 'class:wizard', label: 'Mago', saveDc: 13, attackBonus: 5 }],
    spellSlots: [...SLOTS],
    pactSlots: null,
    ...patch,
  }
}

describe('takeSheetSnapshot', () => {
  it('os números saem das mesmas fontes que o jogo mostra', () => {
    const sheet = buildPlaySheet(caster)
    const guide = getRollGuide(caster, createPlayState('x'))
    const shot = takeSheetSnapshot(caster, sheet, 42)
    expect(shot).toEqual({
      sheetUpdatedAt: 42,
      draftFingerprint: jsonFingerprint(caster),
      maxHp: sheet.maxHp,
      armorClass: getSheetArmorClass(caster, getFinalAbilityScores(caster)).value,
      spellcasting: guide.spellcasting.map(sc => ({ key: sc.key, label: sc.label, saveDc: sc.saveDc, attackBonus: sc.attack.modifier })),
      spellSlots: sheet.spellSlots,
      pactSlots: null,
    })
    expect(shot.spellcasting.map(sc => [sc.key, sc.saveDc, sc.attackBonus])).toEqual([['class:wizard', 14, 6], ['class:cleric', 13, 5]])
    expect(shot.spellSlots.slice(0, 4)).toEqual([4, 3, 2, 0])
  })

  it('é da ficha, não da sessão: o estado de jogo não entra', () => {
    const sheet = buildPlaySheet(COMPLETE_DRAFT)
    expect(takeSheetSnapshot(COMPLETE_DRAFT, sheet, 1)).toMatchObject({ maxHp: 14, spellcasting: [], spellSlots: Array(9).fill(0) })
  })

  it('volta inteiro do armazenamento; torto, some', () => {
    const shot = takeSheetSnapshot(caster, buildPlaySheet(caster), 42)
    const stored = JSON.parse(JSON.stringify({ ...createPlayState('c1'), sheetSnapshot: shot }))
    expect(sanitizePlayState(stored, 'c1').sheetSnapshot).toEqual(shot)
    expect(sanitizePlayState({ ...stored, sheetSnapshot: { ...shot, spellSlots: [1, 2] } }, 'c1').sheetSnapshot).toBeUndefined()
    expect(sanitizePlayState({ ...stored, sheetSnapshot: { ...shot, maxHp: '14' } }, 'c1').sheetSnapshot).toBeUndefined()
  })
})

describe('describeSheetChanges', () => {
  it('uma parte por número que mudou, na ordem da ficha', () => {
    const after = snapshot({ maxHp: 14, armorClass: 16, spellSlots: [3, 2, 0, 0, 0, 0, 0, 0, 0] })
    expect(describeSheetChanges(snapshot(), after)).toEqual([
      'PV máximo 12 → 14', 'CA 15 → 16', 'espaços de 1º nível 2 → 3', 'espaços de 2º nível 0 → 2',
    ])
    expect(describeSheetChanges(snapshot(), snapshot({ sheetUpdatedAt: 99, draftFingerprint: 'x' }))).toEqual([])
  })

  it('a conjuração: sem nome se há uma só, com o nome se há mais; a que surgiu sai com "—"', () => {
    expect(describeSheetChanges(snapshot(), snapshot({
      spellcasting: [{ key: 'class:wizard', label: 'Mago', saveDc: 14, attackBonus: 6 }],
    }))).toEqual(['CD de magia 13 → 14', 'ataque de magia +5 → +6'])
    // O Cavaleiro Arcano que não conjurava por um erro do app.
    expect(describeSheetChanges(snapshot({ spellcasting: [] }), snapshot({
      spellcasting: [{ key: 'class:fighter', label: 'Guerreiro (Cavaleiro Arcano)', saveDc: 11, attackBonus: 3 }],
    }))).toEqual(['CD de magia — → 11', 'ataque de magia — → +3'])
    expect(describeSheetChanges(snapshot(), snapshot({
      spellcasting: [
        { key: 'class:wizard', label: 'Mago', saveDc: 13, attackBonus: 5 },
        { key: 'feat:magic-initiate', label: 'Iniciado em Magia (Clérigo)', saveDc: 12, attackBonus: 4 },
      ],
    }))).toEqual(['CD de magia de Iniciado em Magia (Clérigo) — → 12', 'ataque de magia de Iniciado em Magia (Clérigo) — → +4'])
  })

  it('os espaços de Pacto, quantos e de que nível', () => {
    expect(describeSheetChanges(snapshot({ pactSlots: { slots: 1, slotLevel: 1 } }), snapshot({ pactSlots: { slots: 2, slotLevel: 1 } })))
      .toEqual(['espaços de Pacto 1 de 1º nível → 2 de 1º nível'])
  })
})

describe('syncSheetSnapshot', () => {
  const state = (shot?: SheetSnapshot) => ({ ...createPlayState('c1'), ...(shot ? { sheetSnapshot: shot } : {}) })
  const corrected = snapshot({ maxHp: 14 })

  it('sem retrato anterior, só guarda (não há com o que comparar)', () => {
    const result = syncSheetSnapshot(state(), corrected)
    expect(result.state.sheetSnapshot).toEqual(corrected)
    expect(result.notices).toEqual([])
  })

  it('retrato igual devolve o mesmo estado', () => {
    const before = state(snapshot())
    expect(syncSheetSnapshot(before, snapshot()).state).toBe(before)
  })

  it('a mesma ficha (mesma gravação ou mesmo draft) com números novos: avisa a correção', () => {
    const text = 'O app corrigiu sua ficha: PV máximo 12 → 14.'
    // A mesma gravação: o draft carregado pode ter ganhado campo novo numa atualização do app.
    expect(syncSheetSnapshot(state(snapshot()), { ...corrected, draftFingerprint: 'novo' }).notices)
      .toEqual([{ kind: 'sheetCorrected', text }])
    // O mesmo draft regravado (aberto no criador sem mudar nada).
    expect(syncSheetSnapshot(state(snapshot()), { ...corrected, sheetUpdatedAt: 20 }).notices)
      .toEqual([{ kind: 'sheetCorrected', text }])
  })

  it('a ficha mudada pelo criador: guarda o retrato novo, sem aviso', () => {
    const changed = { ...corrected, sheetUpdatedAt: 20, draftFingerprint: 'novo' }
    const result = syncSheetSnapshot(state(snapshot()), changed)
    expect(result.state.sheetSnapshot).toEqual(changed)
    expect(result.notices).toEqual([])
  })

  it('a mesma ficha regravada, sem número diferente: guarda a data nova, sem aviso', () => {
    const result = syncSheetSnapshot(state(snapshot()), snapshot({ sheetUpdatedAt: 20 }))
    expect(result.state.sheetSnapshot?.sheetUpdatedAt).toBe(20)
    expect(result.notices).toEqual([])
  })
})
