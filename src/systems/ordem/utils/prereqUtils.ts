import type { OrdemPowerPrereq } from '../types/prereq'
import type { OrdemAttributes } from '../types/character'
import type { OrdemElement, ParanormalElement } from '../types/ritual'
import { getAttribute } from './attributeUtils'
import { getSkillName } from './skillUtils'
import { getPower } from './powerUtils'
import { ELEMENT_NAMES } from './ritualUtils'

/**
 * Contexto de validação de UMA instância de poder (de classe ou paranormal). As convenções de
 * cada campo estão documentadas em `OrdemPowerPrereq` (types/prereq.ts): atributos EFETIVOS,
 * NEX de AQUISIÇÃO da instância e contagem de elementos das instâncias ANTERIORES.
 */
export type PrereqContext = {
  attributes: OrdemAttributes
  acquisitionNex: number
  trainedSkills: string[]
  hasClassPower: (powerId: string) => boolean
  /** Elemento escolhido para um poder de classe que o personagem já tem (Especialista em Elemento). */
  getClassPowerElement: (powerId: string) => OrdemElement | null
  elementCounts: Partial<Record<ParanormalElement, number>>
  /** Elemento escolhido no próprio poder sendo validado (p/ `sameElementParam` do Mestre em Elemento). */
  chosenElement?: OrdemElement | null
}

export function meetsPrereq(prereq: OrdemPowerPrereq, ctx: PrereqContext): boolean {
  switch (prereq.kind) {
    case 'attribute':
      return ctx.attributes[prereq.attribute] >= prereq.min
    case 'nex':
      return ctx.acquisitionNex >= prereq.min
    case 'trainedSkill':
      return prereq.anyOf.some(id => ctx.trainedSkills.includes(id))
    case 'classPower': {
      if (!ctx.hasClassPower(prereq.powerId)) return false
      if (!prereq.sameElementParam) return true
      const ownedElement = ctx.getClassPowerElement(prereq.powerId)
      return ownedElement !== null && ownedElement === (ctx.chosenElement ?? null)
    }
    case 'elementCount':
      return (ctx.elementCounts[prereq.element] ?? 0) >= prereq.count
  }
}

/** Pré-requisitos NÃO atendidos (lista vazia = tudo ok; `prereqs` ausente = sem pré-requisito). */
export function getUnmetPrereqs(prereqs: OrdemPowerPrereq[] | undefined, ctx: PrereqContext): OrdemPowerPrereq[] {
  return (prereqs ?? []).filter(p => !meetsPrereq(p, ctx))
}

/** Motivo legível (pt-BR) de um pré-requisito não atendido, para tooltips/banners da UI. */
export function formatUnmetPrereq(prereq: OrdemPowerPrereq, ctx: PrereqContext): string {
  switch (prereq.kind) {
    case 'attribute':
      return `Requer ${getAttribute(prereq.attribute)?.name ?? prereq.attribute} ${prereq.min} (você tem ${ctx.attributes[prereq.attribute]})`
    case 'nex':
      return `Requer NEX ${prereq.min}% (esta escolha é feita em NEX ${ctx.acquisitionNex}%)`
    case 'trainedSkill':
      return `Requer treino em ${prereq.anyOf.map(getSkillName).join(' ou ')}`
    case 'classPower': {
      const name = getPower(prereq.powerId)?.name ?? prereq.powerId
      return prereq.sameElementParam ? `Requer ${name} no mesmo elemento` : `Requer o poder ${name}`
    }
    case 'elementCount':
      return `Requer ${ELEMENT_NAMES[prereq.element]} ${prereq.count} (você tem ${ctx.elementCounts[prereq.element] ?? 0} poder(es) de ${ELEMENT_NAMES[prereq.element]} antes deste)`
  }
}

export function formatUnmetPrereqs(prereqs: OrdemPowerPrereq[], ctx: PrereqContext): string[] {
  return prereqs.map(p => formatUnmetPrereq(p, ctx))
}
