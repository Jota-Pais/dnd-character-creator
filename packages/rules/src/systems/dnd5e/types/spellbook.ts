/**
 * O grimório do jogo (Fase 2, onda `grimorio`): as magias que o personagem conjura, por conjuração,
 * com o que cada uma pede para sair — o espaço do pool, o de Pacto, o uso do talento, nada (o
 * truque) — e se vai como ritual. Montado da ficha uma vez (`getPlaySpellbook`, `utils/spellbook.ts`)
 * e levado no `PlaySheet`: a aba Magia lista daqui, e o `castSpell` confere e gasta pelo mesmo.
 */

/**
 * Como a magia está no grimório: o truque (sem espaço, sem preparar, pág. 203), a preparada do
 * clérigo, do druida e do paladino, a conhecida do bardo, do bruxo, do feiticeiro e do patrulheiro,
 * a do grimório do mago (pág. 96) e a de uso por descanso longo (a magia de 1º nível do Iniciado em
 * Magia, a inata de 1º nível ou mais da raça). As sempre preparadas (domínio, juramento, terreno)
 * chegam com a onda `magias-concedidas`.
 */
export type SpellbookStatus = 'cantrip' | 'prepared' | 'known' | 'inSpellbook' | 'perRest'

/**
 * Como se paga a magia: um espaço do pool combinado, um de Magia de Pacto, o uso de um recurso (o
 * do Iniciado em Magia), nada como ritual (pág. 204) ou nada (o truque, a inata).
 */
export type SpellPayment = 'slot' | 'pact' | 'resource' | 'ritual' | 'free'

/** Uma magia do grimório, numa conjuração. O texto e os números saem de `spells.json` pelo id. */
export type SpellbookEntry = {
  spellId: string
  status: SpellbookStatus
  /**
   * De onde ela veio quando não foi escolhida na etapa Magias: o slot de progressão (Segredos
   * Mágicos, Pacto da Corrente) ou a fonte de fora da classe ("da raça", "de Domínio da Natureza").
   */
  origin: string | null
  /**
   * Os níveis do pool combinado que servem: os que a ficha tem, do nível dela para cima (pág. 201;
   * na multiclasse, também os acima do que a classe conhece, pág. 166). Vazio no truque.
   */
  slotLevels: number[]
  /** O nível dos espaços de Magia de Pacto, quando servem (o da magia ou acima); null sem eles. */
  pactLevel: number | null
  /** O recurso que a conjura (o uso da magia do Iniciado em Magia, pág. 170). */
  resourceId?: string
  /** Sai sem gastar nada: o truque (pág. 203) e a inata (a de uso por descanso, até o contador). */
  free: boolean
  /**
   * O nível em que a fonte a conjura, quando ela fixa um: a do talento no menor nível possível (pág.
   * 170), a inata "como uma magia de 2° nível" (pág. 43). Ausente, o espaço escolhido decide.
   */
  castLevel?: number
  /** Conjura como ritual, pela regra da característica de quem a dá (`canCastAsRitual`). */
  ritual: boolean
  /** O que a mesa precisa saber ao conjurá-la e o app ainda não conta (o uso da inata). */
  note?: string
}

/**
 * O tempo de conjuração no turno (pág. 204): uma ação, uma ação bônus, uma reação ou mais que isso
 * (minutos, horas e o ritual, fora do checklist). `castingTimeKind` (spellUtils) o lê de `spells.json`.
 */
export type CastingTimeKind = 'action' | 'bonusAction' | 'reaction' | 'longer'

/** A regra de ritual da Conjuração de uma classe (págs. 53, 65, 73 e 96): de quais magias. */
export type RitualRule = 'spellbook' | 'prepared' | 'known'

/**
 * As magias de uma conjuração: a de uma classe, a de um talento (Iniciado em Magia) ou as de fora
 * delas (o truque da raça, o da subclasse e as inatas), sem CD nem ataque no app.
 */
export type SpellbookList = {
  /**
   * 'class:<classe>' e 'feat:<talento>', a mesma chave da conjuração no guia de rolagens
   * (`RollGuide.spellcasting`), de onde vêm a CD e o ataque; 'other' para as de fora delas.
   */
  key: string
  kind: 'class' | 'feat' | 'other'
  /** "Mago", "Guerreiro (Cavaleiro Arcano)", "Iniciado em Magia (Clérigo)", "Outras magias". */
  label: string
  /** Com quais magias a classe conjura rituais; null sem a característica (o bruxo, o talento). */
  ritualRule: RitualRule | null
  /** O que vale para a lista inteira e o app ainda não sabe (o mago: quais estão preparadas hoje). */
  note?: string
  spells: SpellbookEntry[]
}
