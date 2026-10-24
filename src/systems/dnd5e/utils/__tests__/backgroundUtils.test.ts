import { describe, it, expect } from 'vitest'
import {
  getBackground,
  getToolsByCategory,
  getToolName,
  getSkillName,
  isBackgroundStepComplete,
  BACKGROUNDS,
  resolveBackgroundItems,
  getBackgroundItemChoices,
  sanitizeBackgroundItemSelections,
  getBackgroundDetailPrompt,
  ROLEPLAY_FIELDS,
} from '../backgroundUtils'
import type { Background } from '../../types/background'
import { FOCUS_GROUP_IDS, getItemName } from '../equipmentUtils'
import type { BackgroundChoiceSelections } from '../../types/character'

describe('getBackground', () => {
  it('retorna o antecedente pelo id', () => {
    const bg = getBackground('soldier')
    expect(bg).toBeDefined()
    expect(bg?.name).toBe('Soldado')
  })

  it('retorna undefined para id inexistente', () => {
    expect(getBackground('nonexistent')).toBeUndefined()
  })
})

describe('getToolsByCategory', () => {
  it('retorna instrumentos musicais', () => {
    const musical = getToolsByCategory('musical-instrument')
    expect(musical.length).toBeGreaterThan(0)
    expect(musical.every(t => t.category === 'musical-instrument')).toBe(true)
  })

  it('retorna ferramentas de artesão', () => {
    const artisan = getToolsByCategory('artisan')
    expect(artisan.length).toBeGreaterThan(0)
    expect(artisan.every(t => t.category === 'artisan')).toBe(true)
  })

  it('retorna conjuntos de jogos', () => {
    const gaming = getToolsByCategory('gaming-set')
    expect(gaming).toHaveLength(4)
  })

  it('retorna array vazio para categoria inexistente', () => {
    expect(getToolsByCategory('nonexistent')).toHaveLength(0)
  })
})

describe('getToolName', () => {
  it('retorna nome em português', () => {
    expect(getToolName('disguise-kit')).toBe('Kit de Disfarce')
    expect(getToolName('thieves-tools')).toBe('Ferramentas de Ladrão')
    expect(getToolName('land-vehicles')).toBe('Veículos Terrestres')
  })

  it('retorna o próprio id para ferramenta desconhecida', () => {
    expect(getToolName('unknown-tool')).toBe('unknown-tool')
  })
})

describe('getSkillName', () => {
  it('retorna nome em português', () => {
    expect(getSkillName('athletics')).toBe('Atletismo')
    expect(getSkillName('stealth')).toBe('Furtividade')
    expect(getSkillName('intimidation')).toBe('Intimidação')
  })
})

describe('BACKGROUNDS', () => {
  it('contém 13 antecedentes', () => {
    expect(BACKGROUNDS).toHaveLength(13)
  })

  it('todos têm id, nome e perícias definidos', () => {
    for (const bg of BACKGROUNDS) {
      expect(bg.id).toBeTruthy()
      expect(bg.name).toBeTruthy()
      expect(bg.skillProficiencies).toHaveLength(2)
    }
  })
})

describe('isBackgroundStepComplete', () => {
  it('retorna false sem antecedente selecionado', () => {
    expect(isBackgroundStepComplete(null, {})).toBe(false)
  })

  describe('antecedente com escolha só de item (Charlatão — ferramentas de trapaça, p. 133)', () => {
    const charlatan = getBackground('charlatan') as Background

    it('incompleto sem escolher qual ferramenta de trapaça leva', () => {
      expect(isBackgroundStepComplete(charlatan, {})).toBe(false)
    })

    it('opção que não é da lista não conta', () => {
      expect(isBackgroundStepComplete(charlatan, { items: { 'con-tools': 'bone-dice' } })).toBe(false)
    })

    it('completo com uma das quatro opções', () => {
      expect(isBackgroundStepComplete(charlatan, { items: { 'con-tools': 'con-tools-signet-ring' } })).toBe(true)
    })
  })

  describe('antecedente com escolha de idioma (Acólito — 2 idiomas)', () => {
    const acolyte = getBackground('acolyte') as Background
    const items = { 'holy-symbol': 'emblem', prayers: 'prayer-book' }

    it('incompleto sem idiomas escolhidos', () => {
      expect(isBackgroundStepComplete(acolyte, {})).toBe(false)
    })

    it('incompleto com apenas 1 idioma', () => {
      expect(isBackgroundStepComplete(acolyte, { languages: ['elvish'], items })).toBe(false)
    })

    it('incompleto com 2 idiomas mas sem o símbolo sagrado e o livro/conta (p. 129)', () => {
      expect(isBackgroundStepComplete(acolyte, { languages: ['elvish', 'dwarvish'] })).toBe(false)
      expect(isBackgroundStepComplete(acolyte, {
        languages: ['elvish', 'dwarvish'], items: { 'holy-symbol': 'emblem' },
      })).toBe(false)
    })

    it('completo com 2 idiomas e os itens escolhidos', () => {
      expect(isBackgroundStepComplete(acolyte, { languages: ['elvish', 'dwarvish'], items })).toBe(true)
    })
  })

  describe('antecedente com escolha de ferramenta (Soldado — 1 gaming)', () => {
    const soldier = getBackground('soldier') as Background

    it('incompleto sem ferramenta escolhida', () => {
      expect(isBackgroundStepComplete(soldier, {})).toBe(false)
    })

    it('incompleto com a ferramenta mas sem dados de osso ou baralho (p. 142)', () => {
      expect(isBackgroundStepComplete(soldier, { tools: ['dice-set'] })).toBe(false)
    })

    it('completo com ferramenta e item escolhidos', () => {
      expect(isBackgroundStepComplete(soldier, { tools: ['dice-set'], items: { 'gaming-set': 'playing-card-set' } })).toBe(true)
    })
  })

  describe('antecedente com ferramenta e idioma (Forasteiro)', () => {
    const outlander = getBackground('outlander') as Background

    it('incompleto sem nenhuma escolha', () => {
      expect(isBackgroundStepComplete(outlander, {})).toBe(false)
    })

    it('incompleto com apenas ferramenta', () => {
      expect(isBackgroundStepComplete(outlander, { tools: ['lute'] })).toBe(false)
    })

    it('incompleto com apenas idioma', () => {
      expect(isBackgroundStepComplete(outlander, { languages: ['goblin'] })).toBe(false)
    })

    it('completo com ferramenta e idioma', () => {
      const choices: BackgroundChoiceSelections = { tools: ['lute'], languages: ['goblin'] }
      expect(isBackgroundStepComplete(outlander, choices)).toBe(true)
    })
  })

  describe('antecedente com apenas ferramenta fixa (Marinheiro)', () => {
    const sailor = getBackground('sailor') as Background

    it('completo sem choices (ferramentas são fixas)', () => {
      expect(isBackgroundStepComplete(sailor, {})).toBe(true)
    })
  })
})

describe('resolveBackgroundItems (equipamento do antecedente na ficha, Revisão e Equipamento)', () => {
  it('itens específicos saem com a quantidade (Acólito: 5 varetas de incenso — p. 129)', () => {
    const acolyte = getBackground('acolyte') as Background
    const labels = resolveBackgroundItems(acolyte, {}).map(i => i.label)
    expect(labels).toContain('5× Bastão de Incenso')
    expect(labels).toContain('Vestimentas')
  })

  it('chosen-tool vira a ferramenta escolhida na proficiência (Artista: o instrumento — p. 131)', () => {
    const entertainer = getBackground('entertainer') as Background
    const [tool] = resolveBackgroundItems(entertainer, { tools: ['lute'] })
    expect(tool).toEqual({ id: 'lute', quantity: 1, label: 'Alaúde', pending: false })
  })

  it('chosen-tool sem escolha fica pendente, sem id', () => {
    const guildArtisan = getBackground('guild-artisan') as Background
    const [tool] = resolveBackgroundItems(guildArtisan, {})
    expect(tool.id).toBeNull()
    expect(tool.pending).toBe(true)
  })

  it('Herói do Povo: as ferramentas de artesão escolhidas entram no equipamento (p. 137)', () => {
    const folkHero = getBackground('folk-hero') as Background
    const ids = resolveBackgroundItems(folkHero, { tools: ['smiths-tools'] }).map(i => i.id)
    expect(ids).toContain('smiths-tools')
  })
})

describe('item-choice — um item entre as opções do livro', () => {
  it('Charlatão: as quatro ferramentas de trapaça (p. 133)', () => {
    const charlatan = getBackground('charlatan') as Background
    const [choice] = getBackgroundItemChoices(charlatan)
    expect(choice.key).toBe('con-tools')
    expect(choice.options).toEqual([
      'con-tools-bottles', 'con-tools-weighted-dice', 'con-tools-marked-cards', 'con-tools-signet-ring',
    ])
    const resolved = resolveBackgroundItems(charlatan, { items: { 'con-tools': 'con-tools-marked-cards' } })
    expect(resolved.map(i => i.label)).toContain('Baralho de Cartas Marcadas')
  })

  it('Acólito: símbolo sagrado (amuleto, emblema ou relicário — p. 151) e livro de preces ou conta de orações (p. 129)', () => {
    const acolyte = getBackground('acolyte') as Background
    const choices = getBackgroundItemChoices(acolyte)
    expect(choices.map(c => c.key)).toEqual(['holy-symbol', 'prayers'])
    expect(choices[0].options).toEqual(FOCUS_GROUP_IDS.holy)
    expect(choices[1].options).toEqual(['prayer-book', 'prayer-wheel'])
    const labels = resolveBackgroundItems(acolyte, { items: { 'holy-symbol': 'emblem', prayers: 'prayer-wheel' } })
      .map(i => i.label)
    expect(labels).toEqual(expect.arrayContaining(['Emblema (Símbolo Sagrado)', 'Conta de Orações']))
  })

  it('Soldado: dados de osso ou baralho (p. 142)', () => {
    const soldier = getBackground('soldier') as Background
    const [choice] = getBackgroundItemChoices(soldier)
    expect(choice.options).toEqual(['bone-dice', 'playing-card-set'])
    const resolved = resolveBackgroundItems(soldier, { items: { 'gaming-set': 'playing-card-set' } })
    expect(resolved).toContainEqual({ id: 'playing-card-set', quantity: 1, label: 'Baralho de Cartas', pending: false })
  })

  it('sem escolha (ou com id fora das opções) fica pendente, com o rótulo do slot', () => {
    const soldier = getBackground('soldier') as Background
    for (const choices of [{}, { items: { 'gaming-set': 'con-tools-bottles' } }]) {
      const pending = resolveBackgroundItems(soldier, choices).find(i => i.pending)
      expect(pending).toEqual({ id: null, quantity: 1, label: 'Dados de Osso ou Baralho (a escolher)', pending: true })
    }
  })

  it('todas as opções de todos os antecedentes existem no catálogo', () => {
    for (const bg of BACKGROUNDS) {
      for (const choice of getBackgroundItemChoices(bg)) {
        for (const id of choice.options) expect(getItemName(id), `${bg.id}/${choice.key}/${id}`).not.toBe(id)
      }
    }
  })

  it('sanitizeBackgroundItemSelections mantém só chaves e opções do antecedente', () => {
    const acolyte = getBackground('acolyte') as Background
    expect(sanitizeBackgroundItemSelections(acolyte, {
      'holy-symbol': 'reliquary',   // válido
      prayers: 'con-tools-bottles', // opção de outro antecedente
      'con-tools': 'con-tools-bottles', // chave que o Acólito não tem
      lixo: 42,
    })).toEqual({ 'holy-symbol': 'reliquary' })
  })
})

// Tabelas de detalhe dos antecedentes, PHB p. 130-142.
describe('getBackgroundDetailPrompt', () => {
  it('Charlatão: Tramoia predileta, d6, com as opções do livro em ordem', () => {
    const prompt = getBackgroundDetailPrompt(getBackground('charlatan'))
    expect(prompt?.label).toBe('Tramoia predileta')
    expect(prompt?.instruction).toBe('escolha ou role 1d6')
    expect(prompt?.optionsLine.startsWith('1. Eu trapaceio em jogos de azar. · 2. Eu falsifico')).toBe(true)
    expect(prompt?.optionsLine).toContain('6. Eu convenço as pessoas que tranqueiras inúteis valem seu suado dinheiro.')
  })

  it('o dado é o tamanho da tabela (Artesão de Guilda usa d20)', () => {
    expect(getBackground('guild-artisan')?.detailTable?.options).toHaveLength(20)
    expect(getBackgroundDetailPrompt(getBackground('soldier'))?.instruction).toBe('escolha ou role 1d8')
    expect(getBackgroundDetailPrompt(getBackground('outlander'))?.instruction).toBe('escolha ou role 1d10')
  })

  it('usa a instrução própria do livro quando há uma (Artista escolhe de uma a três)', () => {
    expect(getBackgroundDetailPrompt(getBackground('entertainer'))?.instruction).toBe('escolha de uma a três ou role 1d10')
    expect(getBackgroundDetailPrompt(getBackground('folk-hero'))?.instruction).toBe('escolha aleatoriamente: role 1d10')
  })

  it('exatamente os 9 antecedentes com tabela de detalhe têm uma', () => {
    const withTable = BACKGROUNDS.filter(b => getBackgroundDetailPrompt(b) !== null).map(b => b.id).sort()
    expect(withTable).toEqual([
      'charlatan', 'criminal', 'entertainer', 'folk-hero', 'guild-artisan', 'hermit', 'outlander', 'sage', 'soldier',
    ])
  })

  it('cada tabela tem um tamanho de dado (6, 8, 10 ou 20)', () => {
    for (const b of BACKGROUNDS) {
      if (b.detailTable) expect([6, 8, 10, 20]).toContain(b.detailTable.options.length)
    }
  })

  it('sem antecedente, ou antecedente sem tabela, não há linha', () => {
    expect(getBackgroundDetailPrompt(undefined)).toBeNull()
    expect(getBackgroundDetailPrompt(getBackground('acolyte'))).toBeNull()
  })
})

describe('ROLEPLAY_FIELDS', () => {
  it('Tendência, dois Traços de Personalidade, Ideal, Vínculo e Defeito', () => {
    expect(ROLEPLAY_FIELDS.map(f => `${f.label}×${f.lines}`)).toEqual([
      'Tendência×1', 'Traços de Personalidade×2', 'Ideal×1', 'Vínculo×1', 'Defeito×1',
    ])
  })
})
