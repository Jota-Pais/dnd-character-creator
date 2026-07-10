import { describe, it, expect } from 'vitest'
import {
  MODIFICATIONS, getModification, modAppliesTo, isModifiable, getAvailableModifications, canApplyModification,
} from '../modificationUtils'
import { getEquipmentById } from '../equipmentUtils'

const pistola = getEquipmentById('pistola')!        // arma de fogo (Cat I)
const faca = getEquipmentById('faca')!               // arma corpo a corpo
const pesada = getEquipmentById('protecao-pesada')!  // proteção pesada
const leve = getEquipmentById('protecao-leve')!      // proteção leve
const kit = getEquipmentById('kit-pericia')!         // acessório

describe('modificationUtils', () => {
  it('todas as modificações têm campos válidos', () => {
    for (const m of MODIFICATIONS) {
      expect(m.id, m.name).toBeTruthy()
      expect(m.effect.length, m.id).toBeGreaterThan(5)
      expect(m.target, m.id).toBeTruthy()
    }
  })

  it('modAppliesTo respeita o tipo de item', () => {
    // mod de fogo só em arma de fogo
    expect(modAppliesTo(getModification('mira-laser')!, pistola)).toBe(true)
    expect(modAppliesTo(getModification('mira-laser')!, faca)).toBe(false)
    // mod corpo a corpo/disparo não em arma de fogo
    expect(modAppliesTo(getModification('cruel')!, faca)).toBe(true)
    expect(modAppliesTo(getModification('cruel')!, pistola)).toBe(false)
    // Tática aplica a qualquer arma
    expect(modAppliesTo(getModification('tatica')!, pistola)).toBe(true)
    expect(modAppliesTo(getModification('tatica')!, faca)).toBe(true)
    // proteção pesada só em pesada; leve só em leve; reforçada em qualquer proteção
    expect(modAppliesTo(getModification('blindada')!, pesada)).toBe(true)
    expect(modAppliesTo(getModification('blindada')!, leve)).toBe(false)
    expect(modAppliesTo(getModification('discreta-protecao')!, leve)).toBe(true)
    expect(modAppliesTo(getModification('reforcada')!, pesada)).toBe(true)
    expect(modAppliesTo(getModification('reforcada')!, leve)).toBe(true)
    // acessório
    expect(modAppliesTo(getModification('aprimorado')!, kit)).toBe(true)
    expect(modAppliesTo(getModification('aprimorado')!, faca)).toBe(false)
  })

  it('isModifiable / getAvailableModifications', () => {
    expect(isModifiable(pistola)).toBe(true)
    expect(isModifiable(getEquipmentById('binoculos')!)).toBe(false) // item geral não-modificável
    // uma arma de fogo tem mais mods disponíveis do que uma corpo a corpo (tabela maior)
    expect(getAvailableModifications(pistola).length).toBeGreaterThan(getAvailableModifications(faca).length)
  })

  it('canApplyModification: não repete e respeita conflitos', () => {
    // não repete a mesma modificação
    expect(canApplyModification(pistola, ['mira-laser'], 'mira-laser')).toBe(false)
    // Reforçada × Discreta (proteção) se excluem
    expect(canApplyModification(leve, [], 'discreta-protecao')).toBe(true)
    expect(canApplyModification(leve, ['reforcada'], 'discreta-protecao')).toBe(false)
    expect(canApplyModification(leve, ['discreta-protecao'], 'reforcada')).toBe(false)
    // mod que não se aplica ao item
    expect(canApplyModification(faca, [], 'mira-laser')).toBe(false)
  })
})
