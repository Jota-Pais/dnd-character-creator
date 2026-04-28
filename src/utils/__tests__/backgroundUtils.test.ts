import { describe, it, expect } from 'vitest'
import {
  getBackground,
  getToolsByCategory,
  getToolName,
  getSkillName,
  isBackgroundStepComplete,
  BACKGROUNDS,
} from '../backgroundUtils'
import type { Background } from '../../types/background'
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
    const musical = getToolsByCategory('musical')
    expect(musical.length).toBeGreaterThan(0)
    expect(musical.every(t => t.category === 'musical')).toBe(true)
  })

  it('retorna ferramentas de artesão', () => {
    const artisan = getToolsByCategory('artisan')
    expect(artisan.length).toBeGreaterThan(0)
    expect(artisan.every(t => t.category === 'artisan')).toBe(true)
  })

  it('retorna conjuntos de jogos', () => {
    const gaming = getToolsByCategory('gaming')
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

  describe('antecedente sem escolhas (Charlatão)', () => {
    const charlatan = getBackground('charlatan') as Background

    it('completo ao selecionar o antecedente', () => {
      expect(isBackgroundStepComplete(charlatan, {})).toBe(true)
    })
  })

  describe('antecedente com escolha de idioma (Acólito — 2 idiomas)', () => {
    const acolyte = getBackground('acolyte') as Background

    it('incompleto sem idiomas escolhidos', () => {
      expect(isBackgroundStepComplete(acolyte, {})).toBe(false)
    })

    it('incompleto com apenas 1 idioma', () => {
      expect(isBackgroundStepComplete(acolyte, { languages: ['elvish'] })).toBe(false)
    })

    it('completo com 2 idiomas', () => {
      expect(isBackgroundStepComplete(acolyte, { languages: ['elvish', 'dwarvish'] })).toBe(true)
    })
  })

  describe('antecedente com escolha de ferramenta (Soldado — 1 gaming)', () => {
    const soldier = getBackground('soldier') as Background

    it('incompleto sem ferramenta escolhida', () => {
      expect(isBackgroundStepComplete(soldier, {})).toBe(false)
    })

    it('completo com ferramenta escolhida', () => {
      expect(isBackgroundStepComplete(soldier, { tools: ['dice-set'] })).toBe(true)
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
