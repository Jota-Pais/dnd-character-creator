import { describe, it, expect } from 'vitest'
import { jsonFingerprint } from '../../../../core/utils/canonicalJson'
import { EMPTY_DRAFT, type CharacterDraft } from '../../types/character'
import type { SheetSnapshot } from '../../types/playState'
import { COMPLETE_DRAFT } from '../../../../test/fixtures'
import { getFinalAbilityScores } from '../asiUtils'
import type { SheetAttack } from '../attackUtils'
import { getWeaponById } from '../equipmentUtils'
import { buildPlaySheet } from '../playSheet'
import { createPlayState, sanitizePlayState } from '../playState'
import { getRollGuide } from '../rollGuide'
import { getSheetArmorClass } from '../sheetEffects'
import { describeSheetChanges, snapshotAttack, syncSheetSnapshot, takeSheetSnapshot } from '../sheetSnapshot'
import { formatAttackDamage, getWeaponAttack, type AttackContext } from '../weaponFormat'

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
      attacks: [{ key: 'unarmed', label: 'Golpe desarmado', damage: '0 concussão', extraDamage: '' }],
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

// Decisão 10.2.23: a Destruição Divina Aprimorada muda o dano das armas corpo a corpo do paladino
// 11+ na ficha salva, e o aviso de correção o diz. O retrato de antes não tinha os ataques; naquele
// app nenhuma linha tinha dano extra de outro tipo.
describe('aviso de correção: o dano dos ataques', () => {
  const paladin: CharacterDraft = {
    ...structuredClone(EMPTY_DRAFT), race: 'human', class: 'paladin', level: 11,
    abilityScores: { STR: 15, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 14 },
    equipment: {
      ...structuredClone(EMPTY_DRAFT.equipment), method: 'wealth',
      purchasedItems: [{ itemId: 'longsword', quantity: 1, source: 'purchased' }],
    },
  }

  it('o retrato de antes dos ataques (o paladino 11 salvo): avisa o 1d8 radiante a mais', () => {
    const now = takeSheetSnapshot(paladin, buildPlaySheet(paladin), 10)
    const legacy: SheetSnapshot = { ...now }
    delete legacy.attacks
    // Guardado sem os ataques, volta inteiro do armazenamento.
    const stored = JSON.parse(JSON.stringify({ ...createPlayState('c1'), sheetSnapshot: legacy }))
    expect(sanitizePlayState(stored, 'c1').sheetSnapshot).toEqual(legacy)
    expect(syncSheetSnapshot(sanitizePlayState(stored, 'c1'), now).notices).toEqual([{
      kind: 'sheetCorrected',
      text: 'O app corrigiu sua ficha: Espada Longa, dano 1d8+3 cortante (1d10+3 a duas mãos) → 1d8+3 cortante (1d10+3 a duas mãos) + 1d8 radiante.',
    }])
  })

  it('quem não tem dano extra não ganha aviso, e o retrato passa a ter os ataques', () => {
    const now = takeSheetSnapshot(caster, buildPlaySheet(caster), 10)
    const legacy: SheetSnapshot = { ...now }
    delete legacy.attacks
    const result = syncSheetSnapshot({ ...createPlayState('c1'), sheetSnapshot: legacy }, now)
    expect(result.notices).toEqual([])
    expect(result.state.sheetSnapshot?.attacks).toEqual(now.attacks)
  })

  // A Rede acerta sem causar dano (pág. 150): com dano extra, a linha é só ele ("1d4 radiante",
  // `formatAttackDamage`), sem começar pelo dano da arma. Nenhum efeito de ficha alcança a Rede hoje
  // (a Destruição Divina Aprimorada é de arma corpo a corpo); o extra entra aqui pelo efeito na
  // linha, como entraria o de um efeito de ficha com escopo de qualquer arma.
  it('a Rede com dano extra: o retrato guarda as parcelas inteiras, e o aviso escreve o dano como a Revisão', () => {
    const effects: AttackContext['effects'] = [
      { source: 'Teste', value: { weapons: 'weapon-attack', extraDamage: { dice: { count: 1, sides: 4 }, damageType: 'radiant' } } },
    ]
    const net = (extra: Partial<AttackContext>): SheetAttack => ({
      key: 'net',
      weapon: { id: 'net', melee: false, heavy: false, thrown: true },
      ...getWeaponAttack(getWeaponById('net')!, { strMod: 2, dexMod: 1, proficiencyBonus: 2, proficient: true, ...extra }),
    })
    const before = snapshotAttack(net({}))
    const after = snapshotAttack(net({ effects }))
    expect(before).toEqual({ key: 'net', label: 'Rede', damage: '—', extraDamage: '' })
    expect(after).toEqual({ key: 'net', label: 'Rede', damage: '—', extraDamage: ' + 1d4 radiante' })
    expect(formatAttackDamage(net({ effects }))).toBe('1d4 radiante')
    expect(describeSheetChanges(snapshot({ attacks: [before] }), snapshot({ attacks: [after] }))).toEqual(['Rede, dano — → 1d4 radiante'])
  })

  it('o ataque torto no retrato guardado: o retrato some inteiro', () => {
    const shot = takeSheetSnapshot(paladin, buildPlaySheet(paladin), 10)
    const stored = JSON.parse(JSON.stringify({ ...createPlayState('c1'), sheetSnapshot: { ...shot, attacks: [{ key: 'x' }] } }))
    expect(sanitizePlayState(stored, 'c1').sheetSnapshot).toBeUndefined()
  })
})

// Decisão de 2026-10-31: as magias da raça e o truque da subclasse ganham a conjuração deles, com a
// CD e o ataque. O retrato de antes não as tem, e a ficha salva do tiferino ou do Domínio da Natureza
// entra no aviso de correção, como a Destruição Divina Aprimorada (decisão 10.2.23).
describe('aviso de correção: a CD e o ataque das magias de fora da classe', () => {
  const tieflingCleric: CharacterDraft = {
    ...structuredClone(EMPTY_DRAFT), race: 'tiefling', class: 'cleric', level: 1,
    abilityScores: { STR: 10, DEX: 10, CON: 14, INT: 8, WIS: 16, CHA: 14 },
    classChoices: { ...structuredClone(EMPTY_DRAFT.classChoices), subclass: 'nature-domain', subclassExtras: { cantrip: 'shillelagh' } },
    spellChoices: { cantrips: ['sacred-flame', 'guidance', 'light'], spells: [] },
  }

  it('a raça e a subclasse entram no retrato; o de antes, sem elas, avisa com o nome de cada conjuração', () => {
    const now = takeSheetSnapshot(tieflingCleric, buildPlaySheet(tieflingCleric), 10)
    // Carisma 16 (14 + 2 do tiferino): CD 8 + 2 + 3; Sabedoria 16: CD 8 + 2 + 3.
    expect(now.spellcasting).toEqual([
      { key: 'class:cleric', label: 'Clérigo', saveDc: 13, attackBonus: 5 },
      { key: 'race:tiefling', label: 'Tiefling', saveDc: 13, attackBonus: 5 },
      { key: 'subclass:nature-domain', label: 'Domínio da Natureza', saveDc: 13, attackBonus: 5 },
    ])
    const before: SheetSnapshot = { ...now, spellcasting: now.spellcasting.filter(sc => sc.key.startsWith('class:')) }
    expect(syncSheetSnapshot({ ...createPlayState('c1'), sheetSnapshot: before }, now).notices).toEqual([{
      kind: 'sheetCorrected',
      text: 'O app corrigiu sua ficha: CD de magia de Tiefling — → 13; ataque de magia de Tiefling — → +5; '
        + 'CD de magia de Domínio da Natureza — → 13; ataque de magia de Domínio da Natureza — → +5.',
    }])
  })
})

// O Ilusionista Nato do gnomo da floresta (pág. 37, linhas 2854-2856) entrou nos dados como magia
// inata depois: a ficha salva ganha a conjuração da raça, e o retrato de antes avisa, sem o nome
// (a única conjuração da ficha), pelo mesmo precedente.
describe('aviso de correção: a ilusão menor do gnomo da floresta', () => {
  const forestGnomeFighter: CharacterDraft = {
    ...structuredClone(EMPTY_DRAFT), race: 'gnome', subrace: 'forest-gnome', class: 'fighter', level: 1,
    abilityScores: { STR: 15, DEX: 14, CON: 14, INT: 12, WIS: 10, CHA: 8 },
  }

  it('a conjuração da raça entra no retrato, e o de antes, sem ela, avisa', () => {
    const now = takeSheetSnapshot(forestGnomeFighter, buildPlaySheet(forestGnomeFighter), 10)
    // Inteligência 14 (12 + 2 do gnomo): CD 8 + 2 + 2; ataque 2 + 2.
    expect(now.spellcasting).toEqual([{ key: 'race:gnome', label: 'Gnomo da Floresta', saveDc: 12, attackBonus: 4 }])
    const before: SheetSnapshot = { ...now, spellcasting: [] }
    expect(syncSheetSnapshot({ ...createPlayState('c1'), sheetSnapshot: before }, now).notices).toEqual([{
      kind: 'sheetCorrected',
      text: 'O app corrigiu sua ficha: CD de magia — → 12; ataque de magia — → +4.',
    }])
  })
})
