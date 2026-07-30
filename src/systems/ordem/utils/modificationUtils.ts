import modificationsJson from '../data/modifications.json'
import type { OrdemModification } from '../types/modification'
import type { OrdemEquipment } from '../types/equipment'

export const MODIFICATIONS = modificationsJson as OrdemModification[]

export function getModification(id: string): OrdemModification | undefined {
  return MODIFICATIONS.find(m => m.id === id)
}

/** Uma modificação pode ser aplicada a este item? (Tabelas 3.5/3.7/3.9). */
export function modAppliesTo(mod: OrdemModification, item: OrdemEquipment): boolean {
  switch (mod.target) {
    case 'weapon-any':
      return item.type === 'weapon'
    case 'weapon-melee-ranged':
      // A Soqueira não é arma de inventário, mas "pode receber modificações de armas corpo a corpo
      // e aplica os efeitos de suas modificações em seus ataques desarmados" (p. 66) — ver
      // `getUnarmedAttack`, que repassa essas modificações para a linha do Desarmado.
      if (item.id === 'soqueira') return true
      return item.type === 'weapon' && ['corpo_a_corpo', 'arremesso', 'disparo'].includes(item.weaponCategory)
    case 'weapon-firearm':
      if (item.type !== 'weapon' || item.weaponCategory !== 'fogo') return false
      // Ferrolho Automático não se aplica a arma que já é automática (p. 59).
      return !(mod.excludesAutomatic && item.automatic)
    case 'ammunition':
      return item.id.startsWith('municao-')
    case 'protection-any':
      return item.type === 'protection'
    case 'protection-heavy':
      return item.type === 'protection' && item.id === 'protecao-pesada'
    case 'protection-light':
      return item.type === 'protection' && item.id === 'protecao-leve'
    case 'accessory':
      return item.type === 'accessory'
  }
}

/** Item pode receber modificações? (armas, munições, proteções e acessórios). */
export function isModifiable(item: OrdemEquipment): boolean {
  return MODIFICATIONS.some(m => modAppliesTo(m, item))
}

/** Modificações disponíveis para um item (todas as que se aplicam a ele). */
export function getAvailableModifications(item: OrdemEquipment): OrdemModification[] {
  return MODIFICATIONS.filter(m => modAppliesTo(m, item))
}

/**
 * Quantas vezes esta modificação pode ser aplicada na mesma peça. Uma, em regra; duas no caso do
 * Aprimorado quando a peça também tem Função Adicional (a 2ª aplicação vale para essa função).
 */
export function getModificationLimit(mod: OrdemModification, applied: string[]): number {
  return mod.repeatableWith && applied.includes(mod.repeatableWith) ? 2 : 1
}

export function countApplied(applied: string[], modId: string): number {
  return applied.filter(id => id === modId).length
}

/**
 * Modificações que de fato valem na peça: descarta aplicações além do limite — ex.: um segundo
 * Aprimorado que perdeu a Função Adicional depois de aplicado deixa de contar (não concede o +5
 * nem cobra categoria). Assim um estado inconsistente (save antigo, JSON importado) se resolve
 * sozinho em todos os cálculos, em vez de precisar de limpeza na UI.
 */
export function getEffectiveModIds(applied: string[]): string[] {
  const used = new Map<string, number>()
  const out: string[] = []
  for (const id of applied) {
    const mod = getModification(id)
    if (!mod) continue
    const count = used.get(id) ?? 0
    if (count >= getModificationLimit(mod, applied)) continue
    used.set(id, count + 1)
    out.push(id)
  }
  return out
}

/** Uma modificação pode ser adicionada agora? (aplica-se ao item, dentro do limite, e não conflita). */
export function canApplyModification(item: OrdemEquipment, applied: string[], modId: string): boolean {
  const mod = getModification(modId)
  if (!mod || !modAppliesTo(mod, item)) return false
  // Iguais não acumulam, exceto o Aprimorado com Função Adicional (ver `getModificationLimit`).
  if (countApplied(applied, modId) >= getModificationLimit(mod, applied)) return false
  // conflitos mútuos (ex.: Reforçada × Discreta)
  for (const otherId of applied) {
    const other = getModification(otherId)
    if (mod.excludes?.includes(otherId) || other?.excludes?.includes(modId)) return false
  }
  return true
}
