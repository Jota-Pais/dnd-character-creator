import { describe, it, expect } from 'vitest'
import {
  getMaxRitualCircle,
  getRitualSlotsCount,
  getRitualSlotNex,
  getAvailableRituals,
  isRitualStepComplete,
  ritualNeedsElementChoice,
  formatRitualElementLabel,
  getRitualById,
  RITUALS,
} from '../ritualUtils'

const VALID_ELEMENTS = ['blood', 'death', 'energy', 'knowledge', 'fear']

describe('rituals.json — integridade dos dados extraídos do livro', () => {
  it('tem os 81 rituais do livro', () => {
    expect(RITUALS.length).toBe(81)
  })

  it('todo ritual tem campos válidos e não vazios', () => {
    for (const r of RITUALS) {
      expect(r.id, r.name).toBeTruthy()
      expect(r.name.trim(), r.id).toBe(r.name)
      expect(r.circle, r.name).toBeGreaterThanOrEqual(1)
      expect(r.circle, r.name).toBeLessThanOrEqual(4)
      expect(r.elements.length, r.name).toBeGreaterThan(0)
      expect(r.elements.every(e => VALID_ELEMENTS.includes(e)), r.name).toBe(true)
      expect(r.description.length, r.name).toBeGreaterThan(20)
      expect(r.execution, r.name).toBeTruthy()
    }
  })

  it('não tem ids duplicados', () => {
    const ids = RITUALS.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('Amaldiçoar Arma é multi-elemento (Conhecimento/Energia/Morte/Sangue)', () => {
    const r = RITUALS.find(x => x.id === 'amaldicoar-arma')
    expect(r?.elements.sort()).toEqual(['blood', 'death', 'energy', 'knowledge'])
  })
})

describe('ritualUtils', () => {
  it('getMaxRitualCircle correctly maps NEX to max circle', () => {
    expect(getMaxRitualCircle(5)).toBe(1)
    expect(getMaxRitualCircle(24)).toBe(1)
    expect(getMaxRitualCircle(25)).toBe(2)
    expect(getMaxRitualCircle(54)).toBe(2)
    expect(getMaxRitualCircle(55)).toBe(3)
    expect(getMaxRitualCircle(84)).toBe(3)
    expect(getMaxRitualCircle(85)).toBe(4)
    expect(getMaxRitualCircle(99)).toBe(4)
  })

  it('getRitualSlotsCount correctly calculates total slots based on NEX', () => {
    expect(getRitualSlotsCount(5)).toBe(3)
    expect(getRitualSlotsCount(10)).toBe(4)
    expect(getRitualSlotsCount(50)).toBe(12)
    expect(getRitualSlotsCount(99)).toBe(22)
  })

  it('getRitualSlotNex mapeia slot → NEX ganho (último slot é 99%, não 100%)', () => {
    // 3 slots iniciais são de NEX 5%
    expect(getRitualSlotNex(0)).toBe(5)
    expect(getRitualSlotNex(2)).toBe(5)
    // slots seguintes seguem os degraus de NEX
    expect(getRitualSlotNex(3)).toBe(10)
    expect(getRitualSlotNex(4)).toBe(15)
    // regressão: o último slot (i=21 em NEX 99%) era rotulado como 100% pela fórmula linear
    expect(getRitualSlotNex(getRitualSlotsCount(99) - 1)).toBe(99)
  })

  it('getAvailableRituals returns only rituals up to max circle', () => {
    const all = getAvailableRituals(4)
    expect(all.length).toBeGreaterThan(0)
    
    const circle1 = getAvailableRituals(1)
    expect(circle1.every(r => r.circle <= 1)).toBe(true)
    
    const circle2 = getAvailableRituals(2)
    expect(circle2.every(r => r.circle <= 2)).toBe(true)
    expect(circle2.length).toBeGreaterThan(circle1.length)
  })

  it('isRitualStepComplete returns true for non-occultists', () => {
    expect(isRitualStepComplete(5, 'combatant', [])).toBe(true)
    expect(isRitualStepComplete(5, null, [])).toBe(true)
  })

  it('isRitualStepComplete checks slots for occultist', () => {
    // ids fictícios distintos: a função só exige que os slots estejam preenchidos e sem repetição
    expect(isRitualStepComplete(5, 'occultist', ['r1', 'r2', 'r3'])).toBe(true)
    expect(isRitualStepComplete(5, 'occultist', ['r1', 'r2', null])).toBe(false)

    expect(isRitualStepComplete(10, 'occultist', ['r1', 'r2', 'r3', 'r4'])).toBe(true)
    expect(isRitualStepComplete(10, 'occultist', ['r1', 'r2', 'r3'])).toBe(false)
  })

  it('isRitualStepComplete rejeita rituais repetidos (não se conhece o mesmo ritual 2×)', () => {
    expect(isRitualStepComplete(5, 'occultist', ['r1', 'r1', 'r3'])).toBe(false)
    expect(isRitualStepComplete(10, 'occultist', ['r1', 'r2', 'r3', 'r1'])).toBe(false)
    // slots além do necessário (ex.: NEX foi reduzido) são ignorados na validação
    expect(isRitualStepComplete(5, 'occultist', ['r1', 'r2', 'r3', 'r3'])).toBe(true)
  })
})

describe('escolha de elemento em rituais multi-elemento (F9 — Amaldiçoar Arma)', () => {
  const amaldicoar = getRitualById('amaldicoar-arma')!
  const singleElement = RITUALS.find(r => r.elements.length === 1)!

  it('ritualNeedsElementChoice: só rituais com mais de um elemento exigem escolha', () => {
    expect(ritualNeedsElementChoice(amaldicoar)).toBe(true)
    expect(ritualNeedsElementChoice(singleElement)).toBe(false)
  })

  it('isRitualStepComplete exige o elemento escolhido para Amaldiçoar Arma', () => {
    const choices = ['amaldicoar-arma', 'r2', 'r3'] // 3 slots (NEX 5%), amaldicoar-arma no slot 0
    // sem elemento escolhido → incompleto
    expect(isRitualStepComplete(5, 'occultist', choices)).toBe(false)
    expect(isRitualStepComplete(5, 'occultist', choices, {})).toBe(false)
    // com elemento escolhido (chave = índice do slot, não o id do ritual) → completo
    expect(isRitualStepComplete(5, 'occultist', choices, { 0: 'blood' })).toBe(true)
  })

  it('formatRitualElementLabel: multi-elemento mostra só o escolhido; sem escolha, mostra todos', () => {
    // com escolha → só o elemento escolhido
    expect(formatRitualElementLabel(amaldicoar, 'blood')).toBe('Sangue')
    // sem escolha → todos os 4 elementos (independente da ordem no dado)
    const allLabel = formatRitualElementLabel(amaldicoar)
    expect(allLabel.split('/').sort()).toEqual(['Conhecimento', 'Energia', 'Morte', 'Sangue'])
    // ritual de elemento único → sempre o próprio elemento (a escolha não se aplica)
    const soloLabel = formatRitualElementLabel(singleElement)
    expect(soloLabel.includes('/')).toBe(false)
  })

  it('isRitualStepComplete permite Amaldiçoar Arma em 2 slots, uma por elemento (FAQ oficial)', () => {
    const choices = ['amaldicoar-arma', 'amaldicoar-arma', 'r3'] // 2 instâncias + 1 ritual comum
    // elementos diferentes nas 2 instâncias → completo
    expect(isRitualStepComplete(5, 'occultist', choices, { 0: 'blood', 1: 'death' })).toBe(true)
    // mesmo elemento nas 2 instâncias → duplicata real, incompleto
    expect(isRitualStepComplete(5, 'occultist', choices, { 0: 'blood', 1: 'blood' })).toBe(false)
    // uma das instâncias sem elemento escolhido → incompleto
    expect(isRitualStepComplete(5, 'occultist', choices, { 0: 'blood' })).toBe(false)
  })

  it('isRitualStepComplete ainda rejeita repetição de ritual de elemento único', () => {
    // singleElement não é multi-elemento: repetir o mesmo id continua proibido.
    const choices = [singleElement.id, singleElement.id, 'r3']
    expect(isRitualStepComplete(5, 'occultist', choices)).toBe(false)
  })
})
