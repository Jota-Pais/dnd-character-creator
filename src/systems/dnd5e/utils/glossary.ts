// Glossário de jargão de D&D em linguagem simples, para iniciantes.
// Cada definição tem no máximo uma frase — exibida sob demanda via <InfoTooltip />.

export type GlossaryEntry = {
  term: string
  definition: string
}

export const GLOSSARY = {
  truque: {
    term: 'Truque',
    definition: 'Magia simples que você pode lançar quantas vezes quiser, sem gastar nada.',
  },
  'espaco-de-magia': {
    term: 'Espaço de magia',
    definition: "Um 'uso' que você gasta para lançar uma magia; recarrega quando você descansa.",
  },
  'cd-de-magia': {
    term: 'CD de magia',
    definition: 'Dificuldade da sua magia: o alvo precisa tirar esse número ou mais para resistir.',
  },
  'bonus-ataque-magia': {
    term: 'Bônus de ataque de magia',
    definition: 'O número que você soma na rolagem para acertar com magias de ataque.',
  },
  'bonus-proficiencia': {
    term: 'Bônus de proficiência',
    definition: 'Bônus que você soma em tudo que é treinado; aumenta conforme você sobe de nível.',
  },
  proficiencia: {
    term: 'Proficiência',
    definition: 'Ser treinado em algo — você soma seu bônus de proficiência quando usa.',
  },
  especializacao: {
    term: 'Especialização (expertise)',
    definition: 'Dobra seu bônus de proficiência na perícia escolhida — você é especialista nela.',
  },
  'estilo-de-luta': {
    term: 'Estilo de luta',
    definition: 'Um talento de combate que reforça o seu jeito de lutar.',
  },
  vantagem: {
    term: 'Vantagem',
    definition: 'Role dois d20 e use o maior resultado (desvantagem é o contrário: use o menor).',
  },
  ca: {
    term: 'Classe de Armadura (CA)',
    definition: 'O quão difícil é te acertar; o ataque precisa igualar ou superar esse número.',
  },
} as const satisfies Record<string, GlossaryEntry>

export type TermId = keyof typeof GLOSSARY

export const GLOSSARY_TERMS = Object.keys(GLOSSARY) as TermId[]
