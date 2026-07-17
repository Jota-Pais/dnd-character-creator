import { describe, it, expect } from 'vitest'
import type { OrdemCharacterDraft } from '../../types/character'
import { EMPTY_DRAFT } from '../../types/character'
import {
  getActiveParanormalSources,
  getSourceAcquisitionNex,
  getAffinityState,
  getParanormalInstances,
  getAvailableParanormalPowers,
  getAvailableExpansionPowers,
  getExpansionGrantedClassPowers,
  getParanormalLearnedRituals,
  getParanormalEffects,
  getLearnRitualMaxCircle,
  getTranscendCount,
  getSanityBreakdown,
  areParanormalChoicesComplete,
  OPPRESSOR_OF,
} from '../paranormalPowerUtils'
import { getCursedDerivedStats } from '../curseUtils'
import { getUnarmedAttack } from '../ordemWeaponUtils'
import { deriveStats, getEffectivePeLimit, getChosenElementForPower, getGrantedRituals, hasClassPower } from '../characterUtils'
import { getOrdemClass } from '../classUtils'

function makeDraft(overrides: Partial<OrdemCharacterDraft> = {}): OrdemCharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

/** Ocultista NEX 99 com Transcender em todos os slots + Versatilidade — base p/ cenários densos. */
function fullTranscendDraft(overrides: Partial<OrdemCharacterDraft> = {}): OrdemCharacterDraft {
  return makeDraft({
    class: 'occultist',
    nex: 99,
    powerChoices: ['transcend', 'transcend', 'transcend', 'transcend', 'transcend', 'transcend'],
    versatilityChoice: { kind: 'power', powerId: 'transcend' },
    ...overrides,
  })
}

describe('fontes de transcender e cronologia', () => {
  it('draft vazio não tem fontes', () => {
    expect(getActiveParanormalSources(makeDraft())).toEqual([])
  })

  it('origem Cultista Arrependido ativa a fonte origin', () => {
    expect(getActiveParanormalSources(makeDraft({ origin: 'repentant-cultist' }))).toEqual(['origin'])
  })

  it('só slots alcançados com Transcender escolhido são fontes', () => {
    const draft = makeDraft({
      class: 'combatant',
      nex: 45,
      powerChoices: ['transcend', 'skill-training', 'transcend'],
    })
    expect(getActiveParanormalSources(draft)).toEqual(['slot-0', 'slot-2'])
  })

  it('baixar o NEX desativa fontes além dos slots alcançados (padrão slice)', () => {
    const draft = makeDraft({ class: 'combatant', nex: 15, powerChoices: ['transcend', 'transcend'] })
    expect(getActiveParanormalSources(draft)).toEqual(['slot-0'])
  })

  it('Versatilidade→Transcender entra na ordem cronológica (após slot-2, antes de slot-3)', () => {
    const draft = fullTranscendDraft({ origin: 'repentant-cultist' })
    expect(getActiveParanormalSources(draft)).toEqual([
      'origin', 'slot-0', 'slot-1', 'slot-2', 'versatility', 'slot-3', 'slot-4', 'slot-5',
    ])
  })

  it('NEX de aquisição por fonte: origem 5, slots 15..90, versatilidade 50', () => {
    expect(getSourceAcquisitionNex('origin')).toBe(5)
    expect(getSourceAcquisitionNex('slot-0')).toBe(15)
    expect(getSourceAcquisitionNex('slot-2')).toBe(45)
    expect(getSourceAcquisitionNex('versatility')).toBe(50)
    expect(getSourceAcquisitionNex('slot-5')).toBe(90)
  })
})

describe('afinidade elemental', () => {
  it('inativa sem elemento escolhido, mesmo com transcender pós-50', () => {
    const draft = fullTranscendDraft()
    expect(getAffinityState(draft)).toEqual({ element: null, triggerKey: 'versatility', active: false })
  })

  it('elemento escolhido é inerte abaixo de NEX 50%', () => {
    const draft = makeDraft({ class: 'combatant', nex: 45, affinityElement: 'death', powerChoices: ['transcend'] })
    expect(getAffinityState(draft).active).toBe(false)
    expect(getAffinityState(draft).element).toBeNull()
  })

  it('inativa com elemento escolhido mas só transcends pré-50 (origem/slots 15-45)', () => {
    const draft = makeDraft({
      class: 'combatant',
      nex: 60,
      origin: 'repentant-cultist',
      affinityElement: 'death',
      powerChoices: ['transcend', 'transcend', 'transcend', 'skill-training'],
    })
    expect(getAffinityState(draft)).toEqual({ element: 'death', triggerKey: null, active: false })
  })

  it('ativa com elemento + transcender em NEX ≥ 50 (gatilho = 1ª fonte pós-50)', () => {
    const draft = makeDraft({
      class: 'combatant',
      nex: 50,
      affinityElement: 'death',
      versatilityChoice: { kind: 'power', powerId: 'transcend' },
    })
    expect(getAffinityState(draft)).toEqual({ element: 'death', triggerKey: 'versatility', active: true })
  })

  it('OPPRESSOR_OF fecha o ciclo Sangue>Conhecimento>Energia>Morte>Sangue', () => {
    expect(OPPRESSOR_OF).toEqual({ knowledge: 'blood', energy: 'knowledge', death: 'energy', blood: 'death' })
  })
})

describe('getParanormalInstances — validação cronológica', () => {
  it('fonte sem escolha fica incompleta e inválida, sem problemas listados', () => {
    const draft = makeDraft({ class: 'combatant', nex: 15, powerChoices: ['transcend'] })
    const [instance] = getParanormalInstances(draft)
    expect(instance.key).toBe('slot-0')
    expect(instance.complete).toBe(false)
    expect(instance.valid).toBe(false)
    expect(instance.problems).toEqual([])
  })

  it('powerId desconhecido invalida com motivo, sem crash', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 15, powerChoices: ['transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'poder-fantasma' } },
    })
    const [instance] = getParanormalInstances(draft)
    expect(instance.valid).toBe(false)
    expect(instance.problems).toContain('Poder paranormal desconhecido')
  })

  it('pré-requisito "Elemento N" conta só instâncias VÁLIDAS anteriores (cascata)', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30, powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'face-death' },
        'slot-1': { powerId: 'escape-death' }, // Morte 1 — atendido pelo face-death do slot-0
      },
    })
    const [first, second] = getParanormalInstances(draft)
    expect(first.valid).toBe(true)
    expect(second.valid).toBe(true)

    // Troca o slot-0 para um poder de Conhecimento: o escape-death (Morte 1) invalida em cascata.
    const changed = makeDraft({
      ...draft,
      paranormalPowerChoices: { 'slot-0': { powerId: 'sensitive' }, 'slot-1': { powerId: 'escape-death' } },
    })
    const [, cascaded] = getParanormalInstances(changed)
    expect(cascaded.valid).toBe(false)
    expect(cascaded.problems.some(p => p.includes('Morte 1'))).toBe(true)
  })

  it('a ordem importa: um poder posterior não satisfaz pré-requisito de um anterior', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30, powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'escape-death' }, // Morte 1 — mas ainda não há poder de Morte antes
        'slot-1': { powerId: 'face-death' },
      },
    })
    const [first, second] = getParanormalInstances(draft)
    expect(first.valid).toBe(false)
    expect(second.valid).toBe(true)
  })

  it('Surto Temporal (Morte 2) exige dois poderes de Morte anteriores', () => {
    const draft = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'face-death' },
        'slot-1': { powerId: 'repurposed-potential' },
        'slot-2': { powerId: 'temporal-surge' },
      },
    })
    const instances = getParanormalInstances(draft)
    expect(instances.find(i => i.key === 'slot-2')?.valid).toBe(true)
  })

  it('"conta como poder do elemento": Resistir a Elemento alimenta a contagem do elemento escolhido', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30, powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'resist-element', element: 'death' },
        'slot-1': { powerId: 'escape-death' },
      },
    })
    const [, second] = getParanormalInstances(draft)
    expect(second.valid).toBe(true)
  })

  it('2ª cópia sem afinidade ativa é inválida', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30, powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'face-death' },
        'slot-1': { powerId: 'face-death' },
      },
    })
    const [, copy] = getParanormalInstances(draft)
    expect(copy.isAffinityCopy).toBe(true)
    expect(copy.valid).toBe(false)
    expect(copy.problems.some(p => p.includes('afinidade'))).toBe(true)
  })

  it('2ª cópia válida: elemento da afinidade, depois do gatilho', () => {
    const draft = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'face-death' },
        'slot-3': { powerId: 'face-death' }, // depois do gatilho (versatility)
      },
    })
    const copy = getParanormalInstances(draft).find(i => i.key === 'slot-3')!
    expect(copy.isAffinityCopy).toBe(true)
    expect(copy.valid).toBe(true)
  })

  it('2ª cópia antes/no gatilho da afinidade é inválida', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 60, affinityElement: 'death',
      powerChoices: ['transcend', 'transcend', 'skill-training', 'transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'face-death' },
        'slot-1': { powerId: 'face-death' }, // gatilho é slot-3 (única fonte ≥ 50) — slot-1 vem antes
      },
    })
    const copy = getParanormalInstances(draft).find(i => i.key === 'slot-1')!
    expect(copy.valid).toBe(false)
    expect(copy.problems.some(p => p.includes('depois do transcender'))).toBe(true)
  })

  it('2ª cópia de elemento diferente do da afinidade é inválida', () => {
    const draft = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'fortunate' },
        'slot-3': { powerId: 'fortunate' }, // Energia ≠ Morte
      },
    })
    const copy = getParanormalInstances(draft).find(i => i.key === 'slot-3')!
    expect(copy.valid).toBe(false)
  })

  it('3ª cópia é sempre inválida', () => {
    const draft = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'face-death' },
        'slot-3': { powerId: 'face-death' },
        'slot-4': { powerId: 'face-death' },
      },
    })
    const third = getParanormalInstances(draft).find(i => i.key === 'slot-4')!
    expect(third.valid).toBe(false)
    expect(third.problems.some(p => p.includes('duas vezes'))).toBe(true)
  })

  it('se a 1ª cópia é removida, a ocorrência restante vira 1ª automaticamente', () => {
    const draft = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: { 'slot-3': { powerId: 'face-death' } },
    })
    const only = getParanormalInstances(draft).find(i => i.key === 'slot-3')!
    expect(only.isAffinityCopy).toBe(false)
    expect(only.valid).toBe(true)
  })

  it('Resistir a Elemento em elementos DIFERENTES são instâncias independentes', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30, powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'resist-element', element: 'death' },
        'slot-1': { powerId: 'resist-element', element: 'blood' },
      },
    })
    const [first, second] = getParanormalInstances(draft)
    expect(first.valid).toBe(true)
    expect(second.valid).toBe(true)
    expect(second.isAffinityCopy).toBe(false)
  })
})

describe('Aprender Ritual', () => {
  it('círculo máximo pelo NEX de aquisição: 1º; 2º a partir de 45%; 3º a partir de 75%', () => {
    expect(getLearnRitualMaxCircle(15)).toBe(1)
    expect(getLearnRitualMaxCircle(45)).toBe(2)
    expect(getLearnRitualMaxCircle(50)).toBe(2)
    expect(getLearnRitualMaxCircle(75)).toBe(3)
  })

  it('ritual acima do círculo permitido na aquisição invalida (mesmo com NEX final alto)', () => {
    const draft = fullTranscendDraft({
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'aprimorar-fisico' } }, // 2º círculo em NEX 15%
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-0')!
    expect(instance.valid).toBe(false)
    expect(instance.problems.some(p => p.includes('círculo'))).toBe(true)
  })

  it('círculo válido na aquisição correta; elemento vem do ritual (conta como poder do elemento)', () => {
    const draft = fullTranscendDraft({
      paranormalPowerChoices: { 'slot-2': { powerId: 'learn-ritual', ritualId: 'aprimorar-fisico' } }, // 2º círculo em NEX 45%
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-2')!
    expect(instance.valid).toBe(true)
    expect(instance.element).toBe('blood')
    expect(getParanormalLearnedRituals(draft)).toEqual([
      expect.objectContaining({ element: 'blood', source: 'Transcender — poder de NEX 45%' }),
    ])
  })

  it('ritual multi-elemento exige a escolha do elemento', () => {
    const incomplete = fullTranscendDraft({
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'amaldicoar-arma' } },
    })
    expect(getParanormalInstances(incomplete).find(i => i.key === 'slot-0')!.complete).toBe(false)

    const complete = fullTranscendDraft({
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'amaldicoar-arma', ritualElement: 'energy' } },
    })
    const instance = getParanormalInstances(complete).find(i => i.key === 'slot-0')!
    expect(instance.valid).toBe(true)
    expect(instance.element).toBe('energy')
  })

  it('deduplica contra os rituais escolhidos pelo Ocultista (mesma instância ritual+elemento)', () => {
    const draft = fullTranscendDraft({
      ritualChoices: ['armadura-de-sangue'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' } },
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-0')!
    expect(instance.valid).toBe(false)
    expect(instance.problems.some(p => p.includes('já conhecido'))).toBe(true)
  })

  it('duas instâncias de Aprender Ritual não podem aprender a mesma instância ritual+elemento', () => {
    const draft = fullTranscendDraft({
      paranormalPowerChoices: {
        'slot-0': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' },
        'slot-1': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' },
      },
    })
    const [, second] = getParanormalInstances(draft)
    expect(second.valid).toBe(false)
  })

  it('limite = Intelecto efetivo: excedentes invalidam em ordem', () => {
    const draft = fullTranscendDraft({
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 3 },
      paranormalPowerChoices: {
        'slot-0': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' },
        'slot-1': { powerId: 'learn-ritual', ritualId: 'cicatrizacao' },
      },
    })
    const [first, second] = getParanormalInstances(draft)
    expect(first.valid).toBe(true)
    expect(second.valid).toBe(false)
    expect(second.problems.some(p => p.includes('Intelecto'))).toBe(true)
  })

  it('escolha de ritual DORMENTE (slot além do NEX) não bloqueia o Aprender Ritual', () => {
    const draft = makeDraft({
      class: 'occultist',
      nex: 15, // 5 slots de ritual abertos — o índice 5 é dormente
      powerChoices: ['transcend'],
      ritualChoices: [null, null, null, null, null, 'armadura-de-sangue'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' } },
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-0')!
    expect(instance.valid).toBe(true)
  })

  it('instância INVÁLIDA de Aprender Ritual não consome o limite de Intelecto', () => {
    const draft = fullTranscendDraft({
      // Intelecto 1 (atributos default). slot-0: 2º círculo em NEX 15% → inválida por círculo;
      // slot-1: 1º círculo válida — não pode ser barrada pela vaga "roubada".
      paranormalPowerChoices: {
        'slot-0': { powerId: 'learn-ritual', ritualId: 'aprimorar-fisico' },
        'slot-1': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' },
      },
    })
    const [first, second] = getParanormalInstances(draft)
    expect(first.valid).toBe(false)
    expect(second.valid).toBe(true)
  })

  it('rituais aprendidos aparecem em getGrantedRituals com a fonte e o elemento', () => {
    const draft = fullTranscendDraft({
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' } },
    })
    const granted = getGrantedRituals(draft)
    expect(granted).toEqual([
      expect.objectContaining({ source: 'Transcender — poder de NEX 15%', element: 'blood' }),
    ])
  })
})

describe('Expansão de Conhecimento', () => {
  const withKnowledgeBase = {
    'slot-0': { powerId: 'sensitive' }, // Conhecimento 1 para a Expansão
  }

  it('aprende um poder de OUTRA classe e o integra à maquinaria da ficha', () => {
    const draft = fullTranscendDraft({
      class: 'combatant',
      paranormalPowerChoices: {
        ...withKnowledgeBase,
        'slot-1': { powerId: 'knowledge-expansion', classPowerId: 'element-specialist', classPowerParams: ['blood'] },
      },
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-1')!
    expect(instance.valid).toBe(true)
    expect(instance.element).toBe('knowledge')
    expect(getExpansionGrantedClassPowers(draft)).toEqual([{ powerId: 'element-specialist', params: ['blood'] }])
    expect(hasClassPower(draft, 'element-specialist')).toBe(true)
    expect(getChosenElementForPower(draft, 'element-specialist')).toBe('blood')
  })

  it('poder da própria classe é inválido', () => {
    const draft = fullTranscendDraft({
      class: 'combatant',
      paranormalPowerChoices: {
        ...withKnowledgeBase,
        'slot-1': { powerId: 'knowledge-expansion', classPowerId: 'heavy-blow' }, // poder de combatente
      },
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-1')!
    expect(instance.valid).toBe(false)
  })

  it('valida os pré-requisitos do poder-alvo (ex.: Ritual Potente exige Intelecto 2)', () => {
    const draft = fullTranscendDraft({
      class: 'combatant',
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 3 },
      paranormalPowerChoices: {
        ...withKnowledgeBase,
        'slot-1': { powerId: 'knowledge-expansion', classPowerId: 'potent-ritual' },
      },
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-1')!
    expect(instance.valid).toBe(false)
    expect(instance.problems.some(p => p.includes('Ritual Potente') && p.includes('Intelecto 2'))).toBe(true)
  })

  it('sub-escolha do poder-alvo pendente deixa a instância incompleta', () => {
    const draft = fullTranscendDraft({
      class: 'combatant',
      paranormalPowerChoices: {
        ...withKnowledgeBase,
        'slot-1': { powerId: 'knowledge-expansion', classPowerId: 'element-specialist' }, // falta o elemento
      },
    })
    const instance = getParanormalInstances(draft).find(i => i.key === 'slot-1')!
    expect(instance.complete).toBe(false)
  })

  it('Mestre em Elemento fica disponível quando o Especialista veio de Expansão anterior', () => {
    const draft = fullTranscendDraft({
      class: 'combatant',
      paranormalPowerChoices: {
        ...withKnowledgeBase,
        'slot-1': { powerId: 'knowledge-expansion', classPowerId: 'element-specialist', classPowerParams: ['blood'] },
      },
    })
    const master = getAvailableExpansionPowers(draft, 'slot-3').find(o => o.power.id === 'element-master')!
    expect(master.available).toBe(true)
  })

  it('getAvailableExpansionPowers exclui poderes da própria classe (e os compartilhados pelas 3)', () => {
    const draft = fullTranscendDraft({ class: 'combatant', paranormalPowerChoices: withKnowledgeBase })
    const options = getAvailableExpansionPowers(draft, 'slot-1')
    const ids = options.map(o => o.power.id)
    expect(ids).not.toContain('heavy-blow')
    expect(ids).not.toContain('transcend')
    expect(ids).not.toContain('skill-training')
    expect(ids).toContain('element-specialist')
    expect(ids).toContain('nerd')
  })
})

describe('efeitos agregados na ficha', () => {
  it('Sangue de Ferro em NEX 50% dá +20 PV (retroativo, exemplo do livro)', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 50,
      powerChoices: ['transcend', 'skill-training', 'skill-training'],
      versatilityChoice: { kind: 'power', powerId: 'skill-training' },
      affinityElement: 'blood',
      paranormalPowerChoices: { 'slot-0': { powerId: 'iron-blood' } },
    })
    expect(getParanormalEffects(draft).hpBonus).toBe(20)
    const cls = getOrdemClass('combatant')!
    const base = deriveStats(cls, draft.attributes, draft.nex)
    const withPowers = getCursedDerivedStats(draft, cls)
    expect(withPowers.hp - base.hp).toBe(20)
  })

  it('Potencial Aprimorado em NEX 30% dá +6 PE (exemplo do livro); afinidade dobra por diante', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30,
      powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'improved-potential' } },
    })
    expect(getParanormalEffects(draft).peBonus).toBe(6)

    const withAffinity = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'improved-potential' },
        'slot-3': { powerId: 'improved-potential' },
      },
    })
    // NEX 99 = 20 degraus: 20 (base) + 20 (delta da afinidade) = 40.
    expect(getParanormalEffects(withAffinity).peBonus).toBe(40)
  })

  it('Resistir a Elemento: 10, e 20 com a 2ª escolha por afinidade', () => {
    const first = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: { 'slot-0': { powerId: 'resist-element', element: 'death' } },
    })
    expect(getParanormalEffects(first).elementResistances).toEqual({ death: 10 })

    const both = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'resist-element', element: 'death' },
        'slot-3': { powerId: 'resist-element', element: 'death' },
      },
    })
    expect(getParanormalEffects(both).elementResistances).toEqual({ death: 20 })
  })

  it('Encarar a Morte sobe o limite de PE: +1, e +3 no total com afinidade', () => {
    const draft = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: { 'slot-0': { powerId: 'face-death' } },
    })
    // NEX 99 → limite base 20 (+1 do poder).
    expect(getEffectivePeLimit(draft)).toBe(21)

    const withAffinity = fullTranscendDraft({
      affinityElement: 'death',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'face-death' },
        'slot-3': { powerId: 'face-death' },
      },
    })
    expect(getEffectivePeLimit(withAffinity)).toBe(23)
  })

  it('Precognição soma +2 na Defesa derivada', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30,
      powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: {
        'slot-0': { powerId: 'sensitive' },
        'slot-1': { powerId: 'precognition' },
      },
    })
    const cls = getOrdemClass('combatant')!
    const base = deriveStats(cls, draft.attributes, draft.nex)
    expect(getCursedDerivedStats(draft, cls).defense - base.defense).toBe(2)
  })

  it('Sensitivo dá +5 em Diplomacia/Intimidação/Intuição (skillBonus)', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 15, powerChoices: ['transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'sensitive' } },
    })
    expect(getParanormalEffects(draft).skillBonus).toEqual({ diplomacy: 5, intimidation: 5, insight: 5 })
  })

  it('Golpe de Sorte: +1 margem de ameaça; +1 multiplicador com afinidade (todos os ataques)', () => {
    const first = fullTranscendDraft({
      affinityElement: 'energy',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'fortunate' },
        'slot-1': { powerId: 'lucky-strike' },
      },
    })
    expect(getUnarmedAttack(first).critical).toBe('19')

    const withAffinity = fullTranscendDraft({
      affinityElement: 'energy',
      paranormalPowerChoices: {
        'slot-0': { powerId: 'fortunate' },
        'slot-1': { powerId: 'lucky-strike' },
        'slot-3': { powerId: 'lucky-strike' },
      },
    })
    expect(getUnarmedAttack(withAffinity).critical).toBe('19/x3')
  })

  it('instância inválida não agrega efeito', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 15, powerChoices: ['transcend'],
      // Precognição exige Conhecimento 1 — inválida como 1ª escolha.
      paranormalPowerChoices: { 'slot-0': { powerId: 'precognition' } },
    })
    expect(getParanormalEffects(draft).defenseBonus).toBe(0)
  })
})

describe('sanidade — Transcender e Cultista Arrependido', () => {
  it('conta transcends de slots e Versatilidade; origem não conta; escolha pendente conta', () => {
    const draft = fullTranscendDraft({ origin: 'repentant-cultist' })
    expect(getTranscendCount(draft)).toBe(7) // 6 slots + versatilidade
  })

  it('cada transcender suprime o ganho de SAN de um NEX (n × perNex da classe)', () => {
    const draft = makeDraft({
      class: 'occultist', nex: 30,
      powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'sensitive' }, 'slot-1': { powerId: 'fortunate' } },
    })
    const cls = getOrdemClass('occultist')!
    const breakdown = getSanityBreakdown(draft, cls)
    expect(breakdown).toEqual({ transcendCount: 2, transcendPenalty: 10, cultistPenalty: 0, total: 10 })
    const base = deriveStats(cls, draft.attributes, draft.nex)
    expect(getCursedDerivedStats(draft, cls).sanity).toBe(base.sanity - 10)
  })

  it('Cultista: metade APENAS da SAN inicial — ocultista NEX 5% fica com 10 + 5 = 15', () => {
    const draft = makeDraft({ class: 'occultist', nex: 5, origin: 'repentant-cultist' })
    const cls = getOrdemClass('occultist')!
    expect(getSanityBreakdown(draft, cls).cultistPenalty).toBe(10)
    expect(getCursedDerivedStats(draft, cls).sanity).toBe(15)
  })

  it('cultista + transcends acumulam; SAN clampada em ≥ 0', () => {
    const draft = makeDraft({
      class: 'occultist', nex: 15, origin: 'repentant-cultist',
      powerChoices: ['transcend'],
    })
    const cls = getOrdemClass('occultist')!
    // NEX 15: 20 + 3×5 = 35; cultista −10; 1 transcend −5 → 20.
    expect(getCursedDerivedStats(draft, cls).sanity).toBe(20)
    expect(getCursedDerivedStats(draft, cls).sanity).toBeGreaterThanOrEqual(0)
  })
})

describe('disponibilidade para a UI', () => {
  it('poder com pré-requisito não atendido vem bloqueado com motivo', () => {
    const draft = makeDraft({ class: 'combatant', nex: 15, powerChoices: ['transcend'] })
    const surge = getAvailableParanormalPowers(draft, 'slot-0').find(o => o.power.id === 'temporal-surge')!
    expect(surge.available).toBe(false)
    expect(surge.reasons.some(r => r.includes('Morte 2'))).toBe(true)
  })

  it('não-repetível escolhido noutra fonte vira "2ª escolha" e exige afinidade', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30, powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'fortunate' } },
    })
    const fortunate = getAvailableParanormalPowers(draft, 'slot-1').find(o => o.power.id === 'fortunate')!
    expect(fortunate.isSecondPick).toBe(true)
    expect(fortunate.available).toBe(false)

    const sensitive = getAvailableParanormalPowers(draft, 'slot-1').find(o => o.power.id === 'sensitive')!
    expect(sensitive.available).toBe(true)
  })

  it('2ª escolha liberada com afinidade ativa no elemento certo, após o gatilho', () => {
    const draft = fullTranscendDraft({
      affinityElement: 'energy',
      paranormalPowerChoices: { 'slot-0': { powerId: 'fortunate' } },
    })
    const atSlot3 = getAvailableParanormalPowers(draft, 'slot-3').find(o => o.power.id === 'fortunate')!
    expect(atSlot3.isSecondPick).toBe(true)
    expect(atSlot3.available).toBe(true)

    const atSlot1 = getAvailableParanormalPowers(draft, 'slot-1').find(o => o.power.id === 'fortunate')!
    expect(atSlot1.available).toBe(false) // antes do gatilho (versatility)
  })

  it('a escolha atual da própria fonte não bloqueia a si mesma', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 15, powerChoices: ['transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'fortunate' } },
    })
    const fortunate = getAvailableParanormalPowers(draft, 'slot-0').find(o => o.power.id === 'fortunate')!
    expect(fortunate.available).toBe(true)
    expect(fortunate.isSecondPick).toBe(false)
  })

  it('Aprender Ritual bloqueia quando as outras fontes já atingiram o limite de Intelecto', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 30,
      attributes: { agility: 1, strength: 1, intellect: 1, presence: 3, vigor: 3 },
      powerChoices: ['transcend', 'transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'learn-ritual', ritualId: 'armadura-de-sangue' } },
    })
    const learn = getAvailableParanormalPowers(draft, 'slot-1').find(o => o.power.id === 'learn-ritual')!
    expect(learn.available).toBe(false)
    expect(learn.reasons.some(r => r.includes('Intelecto'))).toBe(true)
  })
})

describe('areParanormalChoicesComplete (gate do passo)', () => {
  it('sem fontes ativas: completo (e afinidade só é exigida a partir de NEX 50%)', () => {
    expect(areParanormalChoicesComplete(makeDraft())).toBe(true)
    expect(areParanormalChoicesComplete(makeDraft({ nex: 50 }))).toBe(false) // falta o elemento de afinidade
    expect(areParanormalChoicesComplete(makeDraft({ nex: 50, affinityElement: 'death' }))).toBe(true)
  })

  it('fonte ativa sem escolha (ou inválida) bloqueia; caminho feliz passa', () => {
    const pending = makeDraft({ class: 'combatant', nex: 15, powerChoices: ['transcend'] })
    expect(areParanormalChoicesComplete(pending)).toBe(false)

    const done = makeDraft({
      class: 'combatant', nex: 15, powerChoices: ['transcend'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'fortunate' } },
    })
    expect(areParanormalChoicesComplete(done)).toBe(true)
  })

  it('escolha dormente de fonte inativa não bloqueia nem valida nada', () => {
    const draft = makeDraft({
      class: 'combatant', nex: 15, powerChoices: ['skill-training'],
      paranormalPowerChoices: { 'slot-0': { powerId: 'poder-fantasma' } }, // dormente: slot-0 não é transcend
    })
    expect(areParanormalChoicesComplete(draft)).toBe(true)
    expect(getParanormalInstances(draft)).toEqual([])
  })
})
