import { describe, it, expect } from 'vitest'
import {
  getSkillsBySource,
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
  hasWeaponProficiency,
  getExpertiseSkills,
  getExpertiseTools,
  getClassSlotProficiencies,
  getSkillChecks,
  getPassiveScore,
  getChosenExoticLanguages,
  getLanguageLabels,
  EXOTIC_LANGUAGE_NOTE,
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

  // p. 163: multiclassar concede só o subconjunto da Tabela de Proficiências de Multiclasse.
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

  // p. 163: multiclassar NUNCA concede proficiência em teste de resistência.
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
