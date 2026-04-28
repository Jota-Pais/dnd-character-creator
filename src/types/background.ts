export type BackgroundToolChoice = {
  kind: 'tool-choice'
  count: number
  from: 'artisan' | 'musical' | 'gaming'
}

export type BackgroundLanguageChoice = {
  kind: 'language-choice'
  count: number
}

export type BackgroundChoice = BackgroundToolChoice | BackgroundLanguageChoice

export type BackgroundChoiceSelections = {
  languages?: string[]
  tools?: string[]
}

export type Background = {
  id: string
  name: string
  description: string
  skillProficiencies: string[]
  toolProficiencies: string[]
  choices: BackgroundChoice[]
  feature: {
    name: string
    description: string
  }
  variant: string | null
}
