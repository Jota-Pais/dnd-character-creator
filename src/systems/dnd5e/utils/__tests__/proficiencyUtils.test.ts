import { describe, it, expect } from 'vitest'
import {
  getSkillsBySource,
  getToolsBySource,
  getExcludedSkills,
  getExcludedTools,
  getExcludedSkillsForClassSlot,
  getExcludedToolsForClassSlot,
  getAllGrantedSkills,
  getAllGrantedTools,
  getAllGrantedLanguages,
  getExcludedLanguages,
  getArmorProficiencies,
  getWeaponProficiencies,
  getWeaponProficiencyLabels,
  getSavingThrowProficiencies,
  getSavingThrowChecks,
  hasWeaponProficiency,
  getExpertiseSkills,
  getExpertiseTools,
  getClassSlotProficiencies,
  getExcludedLanguagesForClassSlot,
  getSkillChecks,
  getPassiveScore,
  getChosenExoticLanguages,
  getLanguageLabels,
  EXOTIC_LANGUAGE_NOTE,
  getUnproficientTools,
  getBackgroundUnproficientTools,
  getUnproficientArmor,
  hasInstrumentSpellcastingFocus,
  formatUnproficientTool,
  describeToolWithoutProficiency,
  getRepeatedProficiencies,
  getClassRepeatedProficiencies,
  getRaceRepeatedProficiencies,
  getBackgroundRepeatedProficiencies,
  getFeatRepeatedProficiencies,
  formatRepeatedProficiency,
  getRepeatedProficiencyNotes,
  getRepetitionsCausedBy,
  formatRepetitionCaused,
  getOwnerStep,
  getBackgroundFixedOverlaps,
  getBackgroundSubstitutes,
} from '../proficiencyUtils'
import { getWeaponById } from '../equipmentUtils'
import { EMPTY_CLASS_CHOICES } from '../../types/class'
import {
  getRaceGrantedSkills, getRaceGrantedTools, getRace, getSubrace, RACES, LANGUAGES, isExoticLanguage,
} from '../raceUtils'
import { CLASSES } from '../classUtils'
import { EMPTY_DRAFT, type CharacterDraft, type ClassEntry } from '../../types/character'

function draft(overrides: Partial<CharacterDraft>): CharacterDraft {
  return { ...structuredClone(EMPTY_DRAFT), ...overrides }
}

describe('getRaceGrantedSkills / getRaceGrantedTools (raceUtils)', () => {
  it('elfo concede Percepção', () => {
    const elf = getRace('elf')!
    expect(getRaceGrantedSkills(elf, null)).toContain('perception')
  })
  it('meio-orc concede Intimidação', () => {
    const halfOrc = getRace('half-orc')!
    expect(getRaceGrantedSkills(halfOrc, null)).toContain('intimidation')
  })
  it('gnomo das rochas concede ferramentas de funileiro', () => {
    const gnome = getRace('gnome')!
    const rockGnome = getSubrace(gnome, 'rock-gnome')!
    expect(getRaceGrantedTools(gnome, rockGnome)).toContain('tinkers-tools')
  })
  it('raça sem proficiência fixa retorna vazio', () => {
    const human = getRace('human')!
    expect(getRaceGrantedSkills(human, null)).toEqual([])
  })
})

describe('getSkillsBySource', () => {
  it('agrega perícias fixas da raça + escolhas de classe + fixas do antecedente', () => {
    const d = draft({
      race: 'elf', // Percepção fixa
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'history'] },
      background: 'sage', // arcana, history (fixas)
    })
    const by = getSkillsBySource(d)
    expect(by.race).toContain('perception')
    expect(by.class).toEqual(expect.arrayContaining(['athletics', 'history']))
    expect(by.background).toEqual(expect.arrayContaining(['arcana', 'history']))
  })

  it('inclui perícias escolhidas da raça (meio-elfo) e da subclasse', () => {
    const d = draft({
      race: 'half-elf',
      raceChoices: { skills: ['stealth', 'deception'] },
      class: 'cleric',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['insight'], subclassExtras: { skills: ['arcana'] } },
    })
    const by = getSkillsBySource(d)
    expect(by.race).toEqual(expect.arrayContaining(['stealth', 'deception']))
    expect(by.class).toEqual(expect.arrayContaining(['insight', 'arcana']))
  })
})

describe('getExcludedSkills', () => {
  it('exclui do picker de classe as perícias já vindas de raça e antecedente', () => {
    const d = draft({
      race: 'elf', // perception
      class: 'ranger',
      background: 'sailor', // athletics, perception
    })
    const excluded = getExcludedSkills(d, 'class')
    expect(excluded).toContain('perception') // da raça e do antecedente
    expect(excluded).toContain('athletics') // do antecedente
  })

  it('não exclui as próprias perícias da fonte consultada', () => {
    const d = draft({
      race: 'elf',
      class: 'ranger',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['survival'] },
    })
    // ao consultar exclusões PARA a classe, a própria escolha de classe não entra
    expect(getExcludedSkills(d, 'class')).not.toContain('survival')
    // mas para a raça, a escolha de classe entra
    expect(getExcludedSkills(d, 'race')).toContain('survival')
  })
})

describe('getExcludedTools', () => {
  it('exclui ferramenta fixa da raça do picker de antecedente', () => {
    const d = draft({
      race: 'gnome',
      subrace: 'rock-gnome', // tinkers-tools
      background: 'folk-hero', // escolhe ferramenta de artesão
    })
    expect(getExcludedTools(d, 'background')).toContain('tinkers-tools')
  })
})

/**
 * Regra do livro: ao receber uma proficiência que já se possui, escolhe-se outra. Dentro da
 * própria classe isso vale entre a lista base e os extras da subclasse — e, na multiclasse,
 * entre as classes.
 */
describe('getExcludedSkillsForClassSlot', () => {
  it('a lista da classe não repete as três perícias do Colégio do Conhecimento', () => {
    const d = draft({
      class: 'bard',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        subclass: 'college-of-lore',
        subclassExtras: { skills: ['arcana', 'history', 'religion'] },
      },
    })
    const excluded = getExcludedSkillsForClassSlot(d, { classId: 'bard', part: 'base' })
    expect(excluded).toEqual(expect.arrayContaining(['arcana', 'history', 'religion']))
  })

  it('o colégio não repete o que a lista da classe já pegou', () => {
    const d = draft({
      class: 'bard',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        skills: ['deception', 'performance', 'persuasion'],
        subclass: 'college-of-lore',
      },
    })
    const excluded = getExcludedSkillsForClassSlot(d, { classId: 'bard', part: 'subclass' })
    expect(excluded).toEqual(expect.arrayContaining(['deception', 'performance', 'persuasion']))
  })

  it('nenhum slot exclui as próprias escolhas (senão não dava pra desmarcar)', () => {
    const d = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['deception'] },
    })
    expect(getExcludedSkillsForClassSlot(d, { classId: 'bard', part: 'base' })).not.toContain('deception')
  })

  it('na multiclasse, a segunda classe não repete a perícia da primeira', () => {
    const d = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['stealth'] },
      additionalClasses: [{
        classId: 'rogue',
        level: 1,
        classChoices: { ...EMPTY_CLASS_CHOICES },
        spellChoices: { cantrips: [], spells: [] },
        asiChoices: [],
        hpRolls: [],
      }],
    })
    expect(getExcludedSkillsForClassSlot(d, { classId: 'rogue', part: 'base' })).toContain('stealth')
  })
})

describe('getExcludedToolsForClassSlot', () => {
  it('a ferramenta do Estudioso da Guerra não repete a do antecedente', () => {
    const d = draft({
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'battle-master' },
      background: 'guild-artisan', // ferramenta de artesão à escolha
      backgroundChoices: { tools: ['smiths-tools'] },
    })
    expect(getExcludedToolsForClassSlot(d, { classId: 'fighter', part: 'subclass' })).toContain('smiths-tools')
  })

  it('as ferramentas concedidas pelo Assassino saem do picker do antecedente', () => {
    const d = draft({
      class: 'rogue',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'assassin' },
      background: 'charlatan',
    })
    expect(getExcludedTools(d, 'background')).toEqual(
      expect.arrayContaining(['disguise-kit', 'poisoners-kit']),
    )
  })
})

describe('proficiência de armadura, arma e resistência', () => {
  it('a classe inicial concede a lista cheia de armadura', () => {
    const d = draft({ class: 'fighter' })
    expect(getArmorProficiencies(d)).toEqual(
      expect.arrayContaining(['light', 'medium', 'heavy', 'shields']),
    )
  })

  // p. 166: multiclassar concede só o subconjunto da Tabela de Proficiências de Multiclasse.
  it('a classe adicional concede só o subconjunto de multiclasse', () => {
    const d = draft({
      class: 'wizard', // nenhuma armadura
      additionalClasses: [{
        classId: 'fighter', level: 1, classChoices: { ...EMPTY_CLASS_CHOICES },
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
    })
    const profs = getArmorProficiencies(d)
    expect(profs).toEqual(expect.arrayContaining(['light', 'medium', 'shields']))
    expect(profs).not.toContain('heavy') // guerreiro só dá pesada como classe INICIAL
  })

  it('a sub-raça concede armadura (anão da montanha: leve e média)', () => {
    const d = draft({ race: 'dwarf', subrace: 'mountain-dwarf' })
    expect(getArmorProficiencies(d)).toEqual(expect.arrayContaining(['light', 'medium']))
  })

  it('a subclasse concede armadura e armas (Colégio da Bravura)', () => {
    const d = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'college-of-valor' },
    })
    expect(getArmorProficiencies(d)).toEqual(expect.arrayContaining(['medium', 'shields']))
    expect(getWeaponProficiencies(d)).toContain('martial')
  })

  it('proficiência de arma vale por categoria ou por concessão específica', () => {
    const dwarfWizard = draft({ race: 'dwarf', class: 'wizard' })
    // Machado de batalha é marcial: o mago não teria, mas o anão ganha essa arma nominalmente.
    expect(hasWeaponProficiency(dwarfWizard, getWeaponById('battleaxe')!)).toBe(true)
    expect(hasWeaponProficiency(dwarfWizard, getWeaponById('greatsword')!)).toBe(false)
    expect(hasWeaponProficiency(dwarfWizard, getWeaponById('quarterstaff')!)).toBe(true) // simples
  })

  it('feiticeiro não é proficiente com toda arma simples que o equipamento deixa escolher', () => {
    // O equipamento dá "qualquer arma simples" (p. 78), mas a proficiência é só adagas, dardos,
    // fundas, bordões e bestas leves: a maça escolhida ataca sem o bônus (p. 148).
    const sorcerer = draft({ race: 'human', class: 'sorcerer' })
    expect(hasWeaponProficiency(sorcerer, getWeaponById('dagger')!)).toBe(true)
    expect(hasWeaponProficiency(sorcerer, getWeaponById('mace')!)).toBe(false)
  })

  // p. 166: multiclassar NUNCA concede proficiência em teste de resistência.
  it('só a classe inicial concede resistências', () => {
    const d = draft({
      class: 'wizard', // INT, SAB
      additionalClasses: [{
        classId: 'fighter', level: 1, classChoices: { ...EMPTY_CLASS_CHOICES },
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
    })
    expect(getSavingThrowProficiencies(d)).toEqual(['INT', 'WIS'])
  })

  it('rótulo de arma não repete a arma cuja categoria já entrou', () => {
    // Guerreiro anão: tem todas as marciais, então "Machado de Batalha" seria ruído.
    const labels = getWeaponProficiencyLabels(draft({ race: 'dwarf', class: 'fighter' }))
    expect(labels).toEqual(['Armas Simples', 'Armas Marciais'])
  })
})

describe('getAllGrantedLanguages', () => {
  it('inclui o idioma fixo da subclasse (Dracônico da Linhagem Dracônica)', () => {
    const d = draft({
      class: 'sorcerer',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'draconic-bloodline' },
    })
    expect(getAllGrantedLanguages(d)).toContain('draconic')
  })

  it('inclui os idiomas escolhidos no Domínio do Conhecimento', () => {
    const d = draft({
      class: 'cleric',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        subclass: 'knowledge-domain',
        subclassExtras: { languages: ['elvish', 'dwarvish'] },
      },
    })
    expect(getAllGrantedLanguages(d)).toEqual(expect.arrayContaining(['elvish', 'dwarvish']))
  })

  it('idioma fixo de raça e de subclasse é id do catálogo, o mesmo que os seletores guardam', () => {
    const ids = new Set<string>(LANGUAGES.map(l => l.id))
    const granted = [
      ...RACES.flatMap(r => r.grantedLanguages),
      ...CLASSES.flatMap(c => c.subclasses.flatMap(s => s.extras?.grantedLanguages ?? [])),
    ]
    expect(granted.filter(id => !ids.has(id))).toEqual([])
  })

  it('humano não escolhe Comum de novo: nem no idioma extra da raça, nem no antecedente', () => {
    const d = draft({ race: 'human', subrace: 'variant-human' })
    expect(getAllGrantedLanguages(d)).toEqual(['common'])
    expect(getExcludedLanguages(d, 'background')).toContain('common')
  })
})

describe('getExcludedLanguagesForClassSlot — idiomas do Domínio do Conhecimento (p. 125)', () => {
  const knowledge = (languages: string[]) => ({
    ...EMPTY_DRAFT.classChoices,
    subclass: 'knowledge-domain',
    subclassExtras: { languages },
  })

  it('clérigo humano: Comum e o idioma extra da raça ficam de fora; os do próprio slot, não', () => {
    const d = draft({
      race: 'human', raceChoices: { languages: ['elvish'] },
      class: 'cleric', classChoices: knowledge(['dwarvish']),
    })
    const excluded = getExcludedLanguagesForClassSlot(d, 'cleric')
    expect(excluded).toEqual(expect.arrayContaining(['common', 'elvish']))
    expect(excluded).not.toContain('dwarvish')
    expect(getClassSlotProficiencies(d, 'cleric').excludedSubclassLanguages).toEqual(excluded)
  })

  it('idiomas do antecedente e do Poliglota também ficam de fora', () => {
    const d = draft({
      race: 'human', subrace: 'variant-human',
      raceChoices: { feat: 'poliglota' },
      featSelections: { poliglota: { languages: ['sylvan', 'goblin', 'halfling'] } },
      background: 'acolyte',
      backgroundChoices: { languages: ['celestial', 'giant'] },
      class: 'cleric', classChoices: knowledge([]),
    })
    expect(getExcludedLanguagesForClassSlot(d, 'cleric')).toEqual(
      expect.arrayContaining(['common', 'sylvan', 'goblin', 'halfling', 'celestial', 'giant']),
    )
  })

  it('multiclasse com feiticeiro dracônico: o Dracônico da outra classe fica de fora', () => {
    const d = draft({
      race: 'human',
      class: 'cleric', classChoices: knowledge(['orc']),
      additionalClasses: [{
        classId: 'sorcerer',
        level: 1,
        classChoices: { ...EMPTY_CLASS_CHOICES, subclass: 'draconic-bloodline' },
        spellChoices: { cantrips: [], spells: [] },
        asiChoices: [],
        hpRolls: [],
      }],
    })
    const excluded = getExcludedLanguagesForClassSlot(d, 'cleric')
    expect(excluded).toContain('draconic')
    expect(excluded).not.toContain('orc')
  })
})

describe('idiomas exóticos (p. 125)', () => {
  it('catálogo separa as tabelas Idiomas Padrão e Idiomas Exóticos com os nomes do livro', () => {
    expect(LANGUAGES.filter(l => !l.exotic).map(l => l.name)).toEqual([
      'Comum', 'Anão', 'Élfico', 'Gigante', 'Gnômico', 'Goblin', 'Halfling', 'Orc',
    ])
    expect(LANGUAGES.filter(l => l.exotic).map(l => l.name)).toEqual([
      'Abissal', 'Celestial', 'Dialeto Subterrâneo', 'Dracônico', 'Infernal', 'Primordial',
      'Silvestre', 'Subcomum',
    ])
    expect(isExoticLanguage('draconic')).toBe(true)
    expect(isExoticLanguage('elvish')).toBe(false)
    expect(isExoticLanguage('nao-existe')).toBe(false)
  })

  it('humano que escolhe Dracônico na raça: exótico escolhido', () => {
    const d = draft({ race: 'human', subrace: 'variant-human', raceChoices: { languages: ['draconic'] } })
    expect(getChosenExoticLanguages(d)).toEqual(['draconic'])
  })

  it('Dracônico fixo do draconato e Infernal do tiferino não contam: o livro já dá', () => {
    expect(getChosenExoticLanguages(draft({ race: 'dragonborn', subrace: 'red-dragonborn' }))).toEqual([])
    expect(getChosenExoticLanguages(draft({ race: 'tiefling' }))).toEqual([])
  })

  it('Dracônico fixo da Linhagem Dracônica não conta', () => {
    const d = draft({
      race: 'human',
      class: 'sorcerer',
      classChoices: { ...EMPTY_DRAFT.classChoices, subclass: 'draconic-bloodline' },
    })
    expect(getAllGrantedLanguages(d)).toContain('draconic')
    expect(getChosenExoticLanguages(d)).toEqual([])
  })

  it('idioma padrão escolhido no antecedente não conta', () => {
    const d = draft({ race: 'human', background: 'acolyte', backgroundChoices: { languages: ['elvish', 'dwarvish'] } })
    expect(getChosenExoticLanguages(d)).toEqual([])
  })

  it('pega exóticos do antecedente, do Domínio do Conhecimento e do Poliglota', () => {
    const d = draft({
      race: 'human',
      subrace: 'variant-human',
      raceChoices: { feat: 'poliglota' },
      featSelections: { poliglota: { languages: ['sylvan', 'elvish', 'deep-speech'] } },
      background: 'acolyte',
      backgroundChoices: { languages: ['celestial', 'giant'] },
      class: 'cleric',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        subclass: 'knowledge-domain',
        subclassExtras: { languages: ['abyssal', 'orc'] },
      },
    })
    expect(getChosenExoticLanguages(d).sort()).toEqual(['abyssal', 'celestial', 'deep-speech', 'sylvan'])
  })

  it('ficha marca o exótico escolhido com "*" e liga a nota; o fixo sai sem marca', () => {
    const humano = getLanguageLabels(draft({
      race: 'human', subrace: 'variant-human', raceChoices: { languages: ['draconic'] },
    }))
    expect(humano.labels).toEqual(['Comum', 'Dracônico*'])
    expect(humano.hasExoticNote).toBe(true)
    expect(EXOTIC_LANGUAGE_NOTE).toBe('* idioma exótico: requer permissão do Mestre (p. 125)')

    const draconato = getLanguageLabels(draft({ race: 'dragonborn', subrace: 'red-dragonborn' }))
    expect(draconato.labels).toEqual(['Comum', 'Dracônico'])
    expect(draconato.hasExoticNote).toBe(false)
  })
})

describe('getAllGrantedSkills / getAllGrantedTools', () => {
  it('inclui as perícias das classes adicionais da multiclasse', () => {
    const d = draft({
      class: 'bard',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['performance'] },
      additionalClasses: [{
        classId: 'rogue',
        level: 1,
        classChoices: { ...EMPTY_CLASS_CHOICES, skills: ['stealth'] },
        spellChoices: { cantrips: [], spells: [] },
        asiChoices: [],
        hpRolls: [],
      }],
    })
    expect(getAllGrantedSkills(d)).toEqual(expect.arrayContaining(['performance', 'stealth']))
  })

  it('une todas as fontes sem duplicar', () => {
    const d = draft({
      race: 'elf', // perception
      class: 'fighter',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['perception', 'athletics'] },
      background: 'sailor', // athletics, perception
    })
    const all = getAllGrantedSkills(d)
    expect(all).toContain('perception')
    expect(all).toContain('athletics')
    // sem duplicatas
    expect(all.length).toBe(new Set(all).size)
  })

  it('inclui ferramenta fixa racial e ferramenta escolhida do antecedente', () => {
    const d = draft({
      race: 'gnome',
      subrace: 'rock-gnome',
      background: 'entertainer',
      backgroundChoices: { tools: ['lute'] },
    })
    const all = getAllGrantedTools(d)
    expect(all).toContain('tinkers-tools')
    expect(all).toContain('lute')
  })

  // Proficiências de Multiclasse (p. 164): a classe adicional dá só o subconjunto da tabela — o
  // druida, nenhuma ferramenta; o ladino, as ferramentas de ladrão.
  function extraClass(classId: string, level = 1): ClassEntry {
    return {
      classId, level,
      classChoices: { ...EMPTY_CLASS_CHOICES },
      spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
    }
  }

  it('o druida como classe adicional não dá Kit de Herbalismo; como classe inicial, dá', () => {
    expect(getAllGrantedTools(draft({ class: 'druid' }))).toEqual(['herbalism-kit'])
    const monkDruid = draft({
      class: 'monk', level: 3,
      classChoices: { ...EMPTY_CLASS_CHOICES, skills: ['acrobatics', 'stealth'], tools: ['herbalism-kit'] },
      additionalClasses: [extraClass('druid')],
      multiclass: true,
    })
    expect(getAllGrantedTools(monkDruid)).toEqual(['herbalism-kit'])
    expect(getToolsBySource(monkDruid).class).toEqual(['herbalism-kit'])
    expect(getClassRepeatedProficiencies(monkDruid)).toEqual([])
    expect(getExcludedToolsForClassSlot(monkDruid, { classId: 'monk', part: 'base' })).not.toContain('herbalism-kit')
    expect(getAllGrantedTools(draft({ class: 'fighter', level: 2, additionalClasses: [extraClass('druid')], multiclass: true })))
      .toEqual([])
  })

  it('o ladino como classe adicional continua dando as ferramentas de ladrão', () => {
    const d = draft({ class: 'fighter', level: 2, additionalClasses: [extraClass('rogue')], multiclass: true })
    expect(getAllGrantedTools(d)).toEqual(['thieves-tools'])
  })
})

// Especialização (ladino p. 91, bardo p. 54) e Bênçãos do Conhecimento (p. 66).
describe('getExpertiseSkills / getExpertiseTools', () => {
  function entry(over: Partial<ClassEntry> & { classId: string; level: number }): ClassEntry {
    return {
      classChoices: { ...EMPTY_DRAFT.classChoices },
      spellChoices: { cantrips: [], spells: [] },
      asiChoices: [],
      hpRolls: [],
      ...over,
    }
  }

  // O bad wolf do playtest: Humano Variante, Bardo 4 do Colégio do Conhecimento, Charlatão.
  const loreBard = (expertiseItems: string[], level = 4) => draft({
    level,
    race: 'human',
    subrace: 'variant-human',
    raceChoices: { skills: ['perception'] },
    class: 'bard',
    classChoices: {
      ...EMPTY_CLASS_CHOICES,
      skills: ['intimidation', 'performance', 'persuasion'],
      subclass: 'college-of-lore',
      subclassExtras: { skills: ['history', 'insight', 'investigation'] },
      expertiseItems,
    },
    background: 'charlatan',
  })

  it('bardo do 4º nível dobra as duas perícias escolhidas', () => {
    expect(getExpertiseSkills(loreBard(['deception', 'persuasion']))).toEqual(['deception', 'persuasion'])
  })

  it('escolhas além do que o nível libera não contam (valem as primeiras)', () => {
    const d = loreBard(['deception', 'persuasion', 'history', 'insight'], 9)
    expect(getExpertiseSkills(d)).toEqual(['deception', 'persuasion'])
  })

  it('perícia que o personagem não tem não vira especialização', () => {
    expect(getExpertiseSkills(loreBard(['deception', 'stealth']))).toEqual(['deception'])
  })

  it('ladino adicional da multiclasse também dobra (antes só a classe inicial contava)', () => {
    const d = draft({
      level: 3,
      multiclass: true,
      class: 'fighter',
      classChoices: { ...EMPTY_CLASS_CHOICES, skills: ['athletics', 'perception'], fightingStyle: 'defense' },
      additionalClasses: [entry({
        classId: 'rogue',
        level: 1,
        classChoices: { ...EMPTY_CLASS_CHOICES, skills: ['stealth'], expertiseItems: ['stealth', 'thieves-tools'] },
      })],
    })
    expect(getExpertiseSkills(d)).toEqual(['stealth'])
    expect(getExpertiseTools(d)).toEqual(['thieves-tools'])
  })

  it('Domínio do Conhecimento dobra as duas perícias das Bênçãos', () => {
    const d = draft({
      class: 'cleric',
      classChoices: {
        ...EMPTY_CLASS_CHOICES,
        skills: ['insight', 'medicine'],
        subclass: 'knowledge-domain',
        subclassExtras: { skills: ['arcana', 'religion'], languages: ['elvish', 'dwarvish'] },
      },
    })
    expect(getExpertiseSkills(d)).toEqual(['arcana', 'religion'])
  })

  it('o seletor de uma classe não oferece o que outra fonte já dobra', () => {
    const d = draft({
      level: 4,
      multiclass: true,
      class: 'cleric',
      classChoices: {
        ...EMPTY_CLASS_CHOICES,
        skills: ['insight', 'medicine'],
        subclass: 'knowledge-domain',
        subclassExtras: { skills: ['arcana', 'religion'] },
      },
      additionalClasses: [entry({
        classId: 'rogue',
        level: 1,
        classChoices: { ...EMPTY_CLASS_CHOICES, skills: ['stealth'], expertiseItems: ['stealth', 'arcana'] },
      })],
    })
    expect(getClassSlotProficiencies(d, 'rogue').excludedExpertise).toEqual(['arcana', 'religion'])
    // Do ponto de vista do clérigo, a do ladino é que é "de fora".
    expect(getClassSlotProficiencies(d, 'cleric').excludedExpertise).toEqual(
      expect.arrayContaining(['stealth', 'arcana', 'religion']),
    )
  })
})

// O número de cada perícia: modificador + a parcela do bônus de proficiência que cabe.
describe('getSkillChecks / getPassiveScore', () => {
  // bad wolf do playtest, com os atributos finais da ficha impressa.
  const scores = { STR: 8, DEX: 12, CON: 10, INT: 12, WIS: 16, CHA: 18 }
  const badWolf = (expertiseItems: string[], level = 4) => draft({
    level,
    race: 'human',
    subrace: 'variant-human',
    raceChoices: { skills: ['perception'] },
    class: 'bard',
    classChoices: {
      ...EMPTY_CLASS_CHOICES,
      skills: ['intimidation', 'performance', 'persuasion'],
      subclass: 'college-of-lore',
      subclassExtras: { skills: ['history', 'insight', 'investigation'] },
      expertiseItems,
    },
    background: 'charlatan',
  })

  it('Aptidão dobra o bônus: Enganação e Persuasão vão de +6 para +8', () => {
    const checks = getSkillChecks(badWolf(['deception', 'persuasion']), scores)
    expect(checks.deception).toEqual({ ability: 'CHA', proficiency: 'expertise', bonus: 8 })
    expect(checks.persuasion.bonus).toBe(8)
    expect(checks.performance).toEqual({ ability: 'CHA', proficiency: 'proficient', bonus: 6 })
  })

  it('Versatilidade soma metade nas perícias sem proficiência', () => {
    const checks = getSkillChecks(badWolf(['deception', 'persuasion']), scores)
    expect(checks.acrobatics).toEqual({ ability: 'DEX', proficiency: 'none', bonus: 2 }) // +1 +1
    expect(checks.athletics.bonus).toBe(0) // −1 +1
    expect(checks.medicine.bonus).toBe(4) // +3 +1
  })

  it('sem Versatilidade, perícia sem proficiência é só o modificador', () => {
    const fighter = draft({ level: 4, class: 'fighter' })
    expect(getSkillChecks(fighter, scores).acrobatics.bonus).toBe(1)
  })

  it('percepção passiva leva tudo que entra no teste, inclusive a Aptidão', () => {
    const plain = badWolf(['deception', 'persuasion'])
    expect(getPassiveScore(plain, 'perception', getSkillChecks(plain, scores))).toBe(15)
    const expert = badWolf(['deception', 'perception'])
    expect(getPassiveScore(expert, 'perception', getSkillChecks(expert, scores))).toBe(17)
  })

  it('passiva sem proficiência leva a Versatilidade e o Observador soma por cima', () => {
    const d = draft({ level: 4, class: 'bard', raceChoices: { feat: 'observador' } })
    expect(getPassiveScore(d, 'investigation', getSkillChecks(d, scores))).toBe(10 + 1 + 1 + 5)
  })
})

describe('getUnproficientTools — ferramenta carregada sem proficiência (p. 156)', () => {
  // Escolhas do bardo: A rapieira, B pacote de diplomata, C alaúde (opção 1) ou instrumento à escolha.
  const bard = (instruments: string[], choiceC: { optionIndex: number; pickedIds: string[] }, over: Partial<CharacterDraft> = {}) => draft({
    class: 'bard',
    classChoices: { ...EMPTY_CLASS_CHOICES, tools: instruments },
    background: 'charlatan',
    equipment: {
      method: 'standard',
      classResolutions: [{ optionIndex: 0, pickedIds: [] }, { optionIndex: 0, pickedIds: [] }, choiceC],
      rolledGold: null,
      purchasedItems: [],
    },
    ...over,
  })

  it('bardo com Flauta, Lira e Tambor que leva o alaúde: aviso, e o alaúde segue foco (p. 53)', () => {
    const result = getUnproficientTools(bard(['flute', 'lyre', 'drum'], { optionIndex: 0, pickedIds: [] }))
    expect(result.map(u => u.tool.id)).toEqual(['lute'])
    expect(result[0].spellcastingFocus).toBe(true)
    expect(formatUnproficientTool(result[0])).toBe(
      'Sem proficiência: Alaúde — pode usar, mas não soma o bônus de proficiência nos testes com ele; continua servindo de foco de conjuração',
    )
  })

  it('bardo que domina o alaúde não recebe aviso', () => {
    expect(getUnproficientTools(bard(['lute', 'lyre', 'drum'], { optionIndex: 0, pickedIds: [] }))).toEqual([])
  })

  it('instrumento escolhido no tool-filter entre os dominados não gera aviso; fora deles, gera', () => {
    expect(getUnproficientTools(bard(['flute', 'lyre', 'drum'], { optionIndex: 1, pickedIds: ['lyre'] }))).toEqual([])
    expect(getUnproficientTools(bard(['flute', 'lyre', 'drum'], { optionIndex: 1, pickedIds: ['viol'] })).map(u => u.tool.id))
      .toEqual(['viol'])
  })

  it('conteúdo do pacote conta: kit de disfarce do Pacote de Artista sem proficiência avisa, sem foco', () => {
    const d = bard(['flute', 'lyre', 'drum'], { optionIndex: 1, pickedIds: ['lyre'] }, { background: 'sage' })
    d.equipment.classResolutions[1] = { optionIndex: 1, pickedIds: [] } // Pacote de Artista
    const result = getUnproficientTools(d)
    expect(result.map(u => u.tool.id)).toEqual(['disguise-kit'])
    expect(result[0].spellcastingFocus).toBe(false)
    // Charlatão domina o kit de disfarce: some o aviso.
    d.background = 'charlatan'
    expect(getUnproficientTools(d)).toEqual([])
  })

  it('compras do método riqueza: guerreiro com alaúde e ferramentas de ladrão, sem foco', () => {
    const d = draft({
      class: 'fighter',
      equipment: {
        method: 'wealth',
        classResolutions: [],
        rolledGold: 100,
        purchasedItems: [
          { itemId: 'lute', quantity: 1, source: 'purchased' },
          { itemId: 'thieves-tools', quantity: 1, source: 'purchased' },
          { itemId: 'hempen-rope', quantity: 1, source: 'purchased' },
        ],
      },
    })
    const result = getUnproficientTools(d)
    expect(result.map(u => u.tool.id)).toEqual(['lute', 'thieves-tools'])
    expect(result.every(u => !u.spellcastingFocus)).toBe(true)
  })

  it('compras que sobraram de outro método não avisam (nem ferramenta, nem armadura)', () => {
    const d = draft({
      class: 'monk',
      equipment: {
        method: 'standard',
        classResolutions: [],
        rolledGold: 100,
        purchasedItems: [
          { itemId: 'chain-mail', quantity: 1, source: 'purchased' },
          { itemId: 'smiths-tools', quantity: 1, source: 'purchased' },
        ],
      },
    })
    expect(getUnproficientTools(d)).toEqual([])
    expect(getUnproficientArmor(d)).toEqual([])
    d.equipment.method = 'wealth'
    expect(getUnproficientTools(d).map(u => u.tool.id)).toEqual(['smiths-tools'])
    expect(getUnproficientArmor(d).length).toBeGreaterThan(0)
  })

  it('item do antecedente: baralho do Soldado com proficiência em dados avisa; com baralho, não', () => {
    const soldier = (gamingSet: string) => draft({
      class: 'fighter',
      background: 'soldier',
      backgroundChoices: { tools: [gamingSet], items: { 'gaming-set': 'playing-card-set' } },
    })
    expect(getUnproficientTools(soldier('dice-set')).map(u => u.tool.id)).toEqual(['playing-card-set'])
    expect(getUnproficientTools(soldier('playing-card-set'))).toEqual([])
  })

  it('dados de osso do Soldado valem como conjunto de dados (p. 142): com Baralho avisa; com dados, não', () => {
    const soldier = (gamingSet: string) => draft({
      class: 'fighter',
      background: 'soldier',
      backgroundChoices: { tools: [gamingSet], items: { 'gaming-set': 'bone-dice' } },
    })
    const result = getUnproficientTools(soldier('playing-card-set'))
    expect(result.map(u => [u.itemId, u.tool.id])).toEqual([['bone-dice', 'dice-set']])
    expect(formatUnproficientTool(result[0])).toBe(
      'Sem proficiência: Dados de Osso (Conjunto de Dados) — pode usar, mas não soma o bônus de proficiência nos testes com ele',
    )
    expect(getUnproficientTools(soldier('dice-set'))).toEqual([])
  })

  it('getBackgroundUnproficientTools: só o que vem do antecedente, para o aviso da etapa Antecedente', () => {
    const d = draft({
      class: 'monk',
      background: 'soldier',
      backgroundChoices: { tools: ['playing-card-set'], items: { 'gaming-set': 'bone-dice' } },
      equipment: {
        method: 'wealth',
        classResolutions: [],
        rolledGold: 100,
        purchasedItems: [{ itemId: 'smiths-tools', quantity: 1, source: 'purchased' }],
      },
    })
    expect(getUnproficientTools(d).map(u => u.itemId)).toEqual(['smiths-tools', 'bone-dice'])
    expect(getBackgroundUnproficientTools(d).map(u => u.itemId)).toEqual(['bone-dice'])
  })

  it('ferramenta do antecedente que é a própria proficiência (Artista) não avisa', () => {
    const d = draft({ background: 'entertainer', backgroundChoices: { tools: ['lute'] } })
    expect(getUnproficientTools(d)).toEqual([])
  })

  it('sem equipamento escolhido, nada a avisar', () => {
    expect(getUnproficientTools(draft({ class: 'bard' }))).toEqual([])
  })
})

describe('hasInstrumentSpellcastingFocus (p. 53)', () => {
  it('bardo conjura com instrumento; guerreiro não', () => {
    expect(hasInstrumentSpellcastingFocus(draft({ class: 'bard' }))).toBe(true)
    expect(hasInstrumentSpellcastingFocus(draft({ class: 'fighter' }))).toBe(false)
  })

  it('bardo como classe secundária da multiclasse também conta', () => {
    const d = draft({
      level: 2,
      multiclass: true,
      class: 'fighter',
      additionalClasses: [{
        classId: 'bard', level: 1, classChoices: { ...EMPTY_CLASS_CHOICES },
        spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
      }],
    })
    expect(hasInstrumentSpellcastingFocus(d)).toBe(true)
  })
})

describe('describeToolWithoutProficiency', () => {
  it('só acrescenta o foco quando ele se aplica', () => {
    expect(describeToolWithoutProficiency(false)).toBe('pode usar, mas não soma o bônus de proficiência nos testes com ele')
    expect(describeToolWithoutProficiency(true)).toMatch(/; continua servindo de foco de conjuração$/)
  })
})

describe('getSavingThrowProficiencies / getSavingThrowChecks', () => {
  const scores = { STR: 10, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 8 }
  const extra = (classId: string, level: number): ClassEntry => ({
    classId, level, classChoices: { ...EMPTY_CLASS_CHOICES },
    spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
  })
  const single = (classId: string, level: number, overrides: Partial<CharacterDraft> = {}) =>
    draft({ class: classId, level, ...overrides })
  const multi = (primary: string, primaryLevel: number, other: string, otherLevel: number) => draft({
    level: primaryLevel + otherLevel, multiclass: true, class: primary,
    additionalClasses: [extra(other, otherLevel)],
  })

  // p. 172: Resiliente dá proficiência na resistência do atributo escolhido — pela raça...
  it('mago com Resiliente (CON) pelo Humano Variante marca INT, SAB e CON', () => {
    const d = single('wizard', 1, {
      race: 'human', subrace: 'variant-human', raceChoices: { feat: 'resiliente', featAbility: 'CON' },
    })
    expect(getSavingThrowProficiencies(d)).toEqual(['CON', 'INT', 'WIS'])
    const checks = getSavingThrowChecks(d, scores)
    expect(checks.CON).toEqual({ proficient: true, bonus: 3 }) // +1 CON +2 proficiência
    expect(checks.STR).toEqual({ proficient: false, bonus: 0 })
    expect(checks.INT.bonus).toBe(5)
  })

  // ...ou por um espaço de ASI.
  it('Resiliente num espaço de ASI também conta', () => {
    const d = single('wizard', 4, { asiChoices: [{ kind: 'feat', featId: 'resiliente', abilities: ['DEX'] }] })
    expect(getSavingThrowProficiencies(d)).toEqual(['DEX', 'INT', 'WIS'])
  })

  it('Resiliente num atributo que a classe já tem não duplica', () => {
    const d = single('wizard', 1, { raceChoices: { feat: 'resiliente', featAbility: 'WIS' } })
    expect(getSavingThrowProficiencies(d)).toEqual(['INT', 'WIS'])
  })

  // p. 105: Alma de Diamante (monge 14) — proficiência em todos os testes de resistência.
  it('monge 14 é proficiente nas seis; monge 13, só em FOR e DES', () => {
    expect(getSavingThrowProficiencies(single('monk', 13))).toEqual(['STR', 'DEX'])
    expect(getSavingThrowProficiencies(single('monk', 14))).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'])
    const checks = getSavingThrowChecks(single('monk', 14), scores)
    expect(checks.CHA).toEqual({ proficient: true, bonus: 4 }) // -1 CAR +5 proficiência
  })

  // p. 91: Mente Escorregadia (ladino 15) — proficiência em resistência de Sabedoria.
  it('ladino 15 ganha SAB; ladino 14, não', () => {
    expect(getSavingThrowProficiencies(single('rogue', 14))).toEqual(['DEX', 'INT'])
    expect(getSavingThrowProficiencies(single('rogue', 15))).toEqual(['DEX', 'INT', 'WIS'])
  })

  // p. 166 corta só as proficiências INICIAIS da classe adicional, não as características por nível.
  it('guerreiro 1 / ladino 15 ganha SAB pela Mente Escorregadia, sem DES e INT do ladino', () => {
    expect(getSavingThrowProficiencies(multi('fighter', 1, 'rogue', 15))).toEqual(['STR', 'CON', 'WIS'])
  })

  it('a característica conta o nível NA classe: guerreiro 6 / ladino 14 não tem SAB', () => {
    expect(getSavingThrowProficiencies(multi('fighter', 6, 'rogue', 14))).toEqual(['STR', 'CON'])
  })

  it('Alma de Diamante como segunda classe também dá as seis', () => {
    expect(getSavingThrowProficiencies(multi('wizard', 1, 'monk', 14))).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'])
  })

  it('a Versatilidade do bardo não entra na resistência', () => {
    const checks = getSavingThrowChecks(single('bard', 2), scores)
    expect(checks.STR).toEqual({ proficient: false, bonus: 0 })
    expect(checks.CHA).toEqual({ proficient: true, bonus: 1 })
  })
})

// p. 125: quem ganharia a mesma proficiência de duas fontes escolhe outra. Os seletores escondem o
// que já se tem, mas a outra fonte pode chegar depois (antecedente ou raça trocados, ficha antiga):
// a escolha fica no draft e vira pendência da etapa dona dela.
describe('proficiência repetida (p. 125)', () => {
  const fighter = (background: string): CharacterDraft => draft({
    race: 'human',
    class: 'fighter',
    classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'] },
    background,
  })

  function extra(classId: string, choices: Partial<CharacterDraft['classChoices']>): ClassEntry {
    return {
      classId, level: 1,
      classChoices: { ...EMPTY_DRAFT.classChoices, ...choices },
      spellChoices: { cantrips: [], spells: [] }, asiChoices: [], hpRolls: [],
    }
  }

  it('Guerreiro com Atletismo e Percepção: com o Acólito, nada; trocado pelo Marinheiro, as duas repetem', () => {
    expect(getRepeatedProficiencies(fighter('acolyte'))).toEqual([])
    const sailor = fighter('sailor')
    const repeated = getClassRepeatedProficiencies(sailor)
    expect(repeated.map(r => r.id)).toEqual(['athletics', 'perception'])
    expect(repeated[0].owner).toEqual({ kind: 'class', slot: { classId: 'fighter', part: 'base' } })
    expect(formatRepeatedProficiency(repeated[0])).toBe('Atletismo já vem do antecedente Marinheiro — troque por outra perícia')
    // A escolha não some: o personagem continua proficiente (uma vez só).
    expect(getAllGrantedSkills(sailor).filter(id => id === 'athletics')).toEqual(['athletics'])
  })

  it('Meio-Orc com Intimidação escolhida na classe: a fixa da raça tem a palavra final', () => {
    const d = draft({
      race: 'half-orc', class: 'barbarian', background: 'sailor',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['intimidation', 'survival'] },
    })
    expect(getClassRepeatedProficiencies(d).map(formatRepeatedProficiency))
      .toEqual(['Intimidação já vem da raça Meio-Orc — troque por outra perícia'])
  })

  it('multiclasse: troca a classe adicional, não a inicial', () => {
    const d = draft({
      class: 'barbarian', level: 3,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['animal-handling', 'survival'] },
      additionalClasses: [extra('ranger', { skills: ['survival'] })],
      multiclass: true,
    })
    expect(getClassRepeatedProficiencies(d, 'barbarian')).toEqual([])
    expect(getClassRepeatedProficiencies(d, 'ranger').map(formatRepeatedProficiency))
      .toEqual(['Sobrevivência já vem da classe Bárbaro — troque por outra perícia'])
  })

  it('Colégio do Conhecimento: perícia do colégio que repete a da lista do bardo troca no colégio', () => {
    const d = draft({
      class: 'bard', level: 3,
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        skills: ['acrobatics', 'deception', 'performance'],
        subclass: 'college-of-lore',
        subclassExtras: { skills: ['deception', 'arcana', 'history'] },
      },
    })
    const [r] = getClassRepeatedProficiencies(d)
    expect(r.owner).toEqual({ kind: 'class', slot: { classId: 'bard', part: 'subclass' } })
    expect(formatRepeatedProficiency(r)).toBe('Enganação já vem da classe Bardo — troque por outra perícia')
  })

  it('Domínio do Conhecimento dobra o que já se tem: repetir é o ponto, não pendência', () => {
    const d = draft({
      class: 'cleric', background: 'sage',
      classChoices: {
        ...EMPTY_DRAFT.classChoices,
        skills: ['insight', 'medicine'],
        subclass: 'knowledge-domain',
        subclassExtras: { skills: ['arcana', 'history'] },
      },
    })
    expect(getRepeatedProficiencies(d)).toEqual([])
  })

  it('ferramenta: o instrumento do Artista que o bardo já toca troca no antecedente', () => {
    const d = draft({
      class: 'bard', background: 'entertainer',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['arcana', 'history', 'insight'], tools: ['lute', 'flute', 'drum'] },
      backgroundChoices: { tools: ['lute'] },
    })
    expect(getClassRepeatedProficiencies(d)).toEqual([])
    expect(getBackgroundRepeatedProficiencies(d).map(formatRepeatedProficiency))
      .toEqual(['Alaúde já vem da classe Bardo — troque por outro instrumento'])
  })

  it('ferramenta do Mestre de Batalha que o anão já escolheu troca na subclasse', () => {
    const d = draft({
      race: 'dwarf', subrace: 'hill-dwarf', raceChoices: { tools: ['smiths-tools'] },
      class: 'fighter', level: 3,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'], subclass: 'battle-master', subclassExtras: { tools: ['smiths-tools'] } },
    })
    expect(getRaceRepeatedProficiencies(d)).toEqual([])
    expect(getClassRepeatedProficiencies(d).map(formatRepeatedProficiency))
      .toEqual(['Ferramentas de Ferreiro já vêm da raça Anão da Colina — troque por outra ferramenta'])
  })

  // Decisão de 2026-10-28: a etapa da fonte (antecedente, raça) avisa da repetição que causou na
  // escolha de outra etapa, com o caminho até lá. A pendência continua na etapa da escolha.
  it('o antecedente sabe o que repetiu na classe, e em qual etapa trocar', () => {
    const sailor = fighter('sailor')
    const caused = getRepetitionsCausedBy(sailor, { kind: 'background' })
    expect(caused.map(r => r.id)).toEqual(['athletics', 'perception'])
    expect(formatRepetitionCaused(sailor, caused[0]))
      .toBe('Atletismo, que o antecedente também dá, já está entre as escolhas da classe Guerreiro — troque lá por outra perícia')
    expect(getOwnerStep(sailor, caused[0].owner)).toBe('class')
    // Quem escolheu não "causou": a classe não avisa de si mesma.
    expect(getRepetitionsCausedBy(sailor, { kind: 'class', slot: { classId: 'fighter', part: 'base' } })).toEqual([])
  })

  it('a raça também: Intimidação fixa do Meio-Orc repete a escolhida no bárbaro', () => {
    const d = draft({
      race: 'half-orc', class: 'barbarian', background: 'sailor',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['intimidation', 'survival'] },
    })
    expect(getRepetitionsCausedBy(d, { kind: 'race' }).map(r => formatRepetitionCaused(d, r)))
      .toEqual(['Intimidação, que a raça também dá, já está entre as escolhas da classe Bárbaro — troque lá por outra perícia'])
    expect(getRepetitionsCausedBy(d, { kind: 'background' })).toEqual([])
  })

  it('talento do Humano Variante fica na etapa Raça; o de Aprimoramentos, lá', () => {
    const d = draft({ raceChoices: { feat: 'perito' } })
    expect(getOwnerStep(d, { kind: 'feat', featId: 'perito' })).toBe('race')
    expect(getOwnerStep(d, { kind: 'feat', featId: 'poliglota' })).toBe('improvements')
  })

  // Decisão de 2026-10-28: o idioma escolhido que outra fonte passou a dar segue a mesma regra —
  // fica no draft, com o aviso, e a etapa dona dele fica pendente (antes era apagado em silêncio).
  it('idioma do antecedente que a raça trocada passou a dar troca no antecedente', () => {
    const d = draft({ race: 'elf', subrace: 'high-elf', background: 'acolyte', backgroundChoices: { languages: ['elvish', 'dwarvish'] } })
    const repeated = getBackgroundRepeatedProficiencies(d)
    expect(repeated.map(r => [r.kind, r.id])).toEqual([['language', 'elvish']])
    expect(formatRepeatedProficiency(repeated[0])).toBe('Élfico já vem da raça Alto Elfo — troque por outro idioma')
    expect(getAllGrantedLanguages(d).filter(id => id === 'elvish')).toEqual(['elvish'])
  })

  it('idioma escolhido na raça que a subclasse dá fixo troca na raça; fixo × fixo não pendura', () => {
    const sorcerer = (over: Partial<CharacterDraft>) => draft({
      class: 'sorcerer', level: 1,
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['arcana', 'insight'], subclass: 'draconic-bloodline' },
      ...over,
    })
    expect(getRaceRepeatedProficiencies(sorcerer({ race: 'human', raceChoices: { languages: ['draconic'] } })).map(formatRepeatedProficiency))
      .toEqual(['Dracônico já vem da classe Feiticeiro (Linhagem Dracônica) — troque por outro idioma'])
    // Draconato (Dracônico fixo) com a Linhagem Dracônica (Dracônico fixo): nada a trocar.
    expect(getRepeatedProficiencies(sorcerer({ race: 'dragonborn', subrace: null }))
      .filter(r => r.kind === 'language')).toEqual([])
  })

  it('idioma do Poliglota repetido troca no talento', () => {
    const d = draft({
      race: 'human', subrace: 'variant-human',
      raceChoices: { abilityBonuses: ['STR', 'DEX'], skills: ['insight'], languages: ['elvish'], feat: 'poliglota' },
      featSelections: { poliglota: { languages: ['elvish', 'dwarvish', 'giant'] } },
    })
    expect(getFeatRepeatedProficiencies(d, ['poliglota']).map(formatRepeatedProficiency))
      .toEqual(['Élfico já vem da raça Humano (Variante) — troque por outro idioma'])
  })

  it('a escolha da raça repete a fixa do antecedente: troca na raça', () => {
    const d = draft({ race: 'half-elf', raceChoices: { skills: ['insight', 'stealth'] }, background: 'acolyte' })
    expect(getRaceRepeatedProficiencies(d).map(formatRepeatedProficiency))
      .toEqual(['Intuição já vem do antecedente Acólito — troque por outra perícia'])
  })

  it('Perito: a perícia do talento que o antecedente já dá troca no talento', () => {
    const d = draft({
      class: 'fighter', level: 4, background: 'sailor',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['acrobatics', 'history'] },
      asiChoices: [{ kind: 'feat', featId: 'perito' }],
      featSelections: { perito: { skills: ['athletics', 'stealth'], tools: ['lute'] } },
    })
    expect(getFeatRepeatedProficiencies(d, ['perito']).map(formatRepeatedProficiency))
      .toEqual(['Atletismo já vem do antecedente Marinheiro — troque por outra perícia ou ferramenta'])
    expect(getFeatRepeatedProficiencies(d, ['outro'])).toEqual([])
  })

  it('getRepeatedProficiencyNotes: o aviso por id, só do seletor pedido', () => {
    const d = fighter('sailor')
    const notes = {
      athletics: 'Atletismo já vem do antecedente Marinheiro — troque por outra perícia',
      perception: 'Percepção já vem do antecedente Marinheiro — troque por outra perícia',
    }
    expect(getRepeatedProficiencyNotes(d, { kind: 'class', slot: { classId: 'fighter', part: 'base' } })).toEqual(notes)
    expect(getRepeatedProficiencyNotes(d, { kind: 'class', slot: { classId: 'fighter', part: 'subclass' } })).toEqual({})
    expect(getRepeatedProficiencyNotes(d, { kind: 'background' })).toEqual({})
    expect(getClassSlotProficiencies(d, 'fighter')).toMatchObject({ repeatedBase: notes, repeatedSubclass: {} })
  })
})

// p. 125: "se um personagem fosse obter a mesma proficiência de duas fontes diferentes, ele pode
// escolher uma proficiência diferente do mesmo tipo". Fixo × fixo não tem escolha a trocar: o
// antecedente abre uma substituta opcional (decisão de 2026-10-28).
describe('fixo × fixo: a substituta do antecedente (p. 125)', () => {
  const halfOrcSoldier = (over: Partial<CharacterDraft> = {}): CharacterDraft => draft({
    race: 'half-orc', class: 'barbarian', background: 'soldier',
    classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['animal-handling', 'survival'] },
    ...over,
  })

  it('Meio-Orc e Soldado com Intimidação: uma perícia substituta, com a fonte', () => {
    expect(getBackgroundFixedOverlaps(halfOrcSoldier())).toEqual({
      skills: [{ id: 'intimidation', source: 'da raça Meio-Orc' }],
      tools: [],
    })
    expect(getRepeatedProficiencies(halfOrcSoldier())).toEqual([])
  })

  it('a substituta escolhida vira proficiência do antecedente', () => {
    const d = halfOrcSoldier({ backgroundChoices: { substituteSkills: ['persuasion'] } })
    expect(getBackgroundSubstitutes(d)).toEqual({ skills: ['persuasion'], tools: [] })
    expect(getAllGrantedSkills(d)).toContain('persuasion')
    expect(getSkillsBySource(d).background).toEqual(['athletics', 'intimidation', 'persuasion'])
  })

  it('sem a repetição (outra raça), a substituta fica guardada mas não vale', () => {
    const d = halfOrcSoldier({ race: 'human', backgroundChoices: { substituteSkills: ['persuasion'] } })
    expect(getBackgroundFixedOverlaps(d).skills).toEqual([])
    expect(getBackgroundSubstitutes(d).skills).toEqual([])
    expect(getAllGrantedSkills(d)).not.toContain('persuasion')
    expect(d.backgroundChoices.substituteSkills).toEqual(['persuasion'])
  })

  it('ferramenta: o druida e o Eremita com o Kit de Herbalismo', () => {
    const d = draft({ class: 'druid', background: 'hermit' })
    expect(getBackgroundFixedOverlaps(d).tools).toEqual([{ id: 'herbalism-kit', source: 'da classe Druida' }])
    const chosen = { ...d, backgroundChoices: { substituteTools: ['smiths-tools'] } }
    expect(getAllGrantedTools(chosen)).toContain('smiths-tools')
  })

  it('escolhida em vez de fixa não é fixo × fixo: segue a regra da repetida', () => {
    // Atletismo escolhido no guerreiro + Soldado: troca na classe, não abre substituta.
    const d = draft({
      race: 'human', class: 'fighter', background: 'soldier',
      classChoices: { ...EMPTY_DRAFT.classChoices, skills: ['athletics', 'perception'] },
    })
    expect(getBackgroundFixedOverlaps(d).skills).toEqual([])
    expect(getClassRepeatedProficiencies(d).map(r => r.id)).toEqual(['athletics'])
  })
})
