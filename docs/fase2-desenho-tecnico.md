# Fase 2 do modo de jogo: desenho técnico

Desenho feito em 2026-10-29 sobre a main (depois da Fase 0) e conferido por um crítico contra o código e o extrato do livro. Plano e decisões: `docs/estudo-dnd-beyond-modulo-jogo.md` (seções 9 e 10).

**Mudança de 2026-10-29, depois do desenho:** a onda `pwa` saiu da Fase 2. O app instalável e offline entra antes, junto da separação do projeto e do APK Android.

## Visão geral

Desenho técnico da Fase 2 do modo de jogo do D&D 5e ("o turno completo"), revisado pelo crítico contra a main de 2026-10-29 (HEAD abef657) e contra o extrato do livro.

**A onda "golpe desarmado" saiu.** As decisões a, b, c e e já estão na main, nos commits 29d8624, 7a59398, a7192c7, 34cef9f e abef657. As decisões c e e entraram só como texto. Com elas vieram os escopos `weapon-attack` e `melee-weapon-attack` e a função `isSheetAttackInScope`. Faltam duas coisas, que a Fase 2 faz:
- o dado da Destruição Divina Aprimorada entrar no número (onda efeitos-recebidos);
- ligar a Fúria encerrar a concentração no estado (onda efeitos-ativos).

O desenho parte do princípio de que a Fase 0 está pronta: contrato play, motor com Math.random, inventário e magias conhecidas como funções puras, export com o estado de jogo, aviso de migração, Nova sessão, tela acesa e os docs de ações, conjuração, munição e carga.

## As quatro respostas de desenho

### 1) Como um efeito ativo vira número
A regra é: a condição fica satisfeita pelo estado.

**Onde cada coisa é declarada**
- O condicional continua declarado UMA vez nos dados. Ele só ganha a chave do efeito que o cumpre: `ConditionalDamageBonus.toggle` e `CastingRestriction.toggle` ('rage'). O Dano de Fúria continua saindo do recurso 'rage-damage', sem valor repetido.
- O que ainda não tinha declaração vai no próprio efeito, em `ToggleDeclaration.effects` ou `benefits`: as resistências e a vantagem em Força da Fúria, o +1d4 da Bênção, o +5 do Escudo Arcano e o 13 + DES da Armadura Arcana. O vocabulário é o das condições (scope sheet, gameState ou notice), com poucos tipos novos.
- A declaração não repete texto, duração nem concentração: tudo isso vem da característica dona (description) ou de spells.json (pelo spellId).
- O custo de ligar mora só na ação que liga. A Fúria declara 'rage-enter': ação bônus, 1 uso de 'rage', resultado toggleOn. O efeito recebido de um aliado liga sem custo.

**Onde mora o estado**
- O "ligado" mora em `PlayState.activeEffects`.
- `resolveActiveEffects(active, toggles, worn)` diz o que vale agora, com o bloqueio pela armadura pesada. É uma função só, para a tela e para as operações.

**Duas portas, sem cópia de conta**
- (a) Quem já recebe o estado deriva a sessão com `getSheetSession(draft, state)`, sem parâmetro novo: `getRollGuide` e `getConcentrationGuide`.
- (b) As funções só de ficha recebem o parâmetro opcional `session = NO_SESSION`: getSheetArmorClass, getSheetSpeed, getSpeedBonuses, describeSpeedBonuses, getArmorSpeedPenalty, getMartialArts, getWeaponAttackEffects, getSheetAttacks, getUnproficientArmor e getCastingRestrictions. Revisão e PDF não passam nada e continuam vendo a nota.

**O que as operações puras precisam**
- O deslocamento para Levantar-se e Disparada, as defesas para o dano e as declarações dos efeitos moram no PlaySheet.
- `buildPlaySheet(draft, worn?)`. `getPlaySpeed(state, sheet)` aplica os efeitos ligados e as condições por cima, como já faz com as condições.
- A CA da barra de vitais sai de `getSheetArmorClass` com a sessão.
- Não existe um getPlayNumbers paralelo.

**Como o número aparece**
- Ligado e cumprido, o efeito entra no número com a parcela nomeada.
- A parcela vai num campo estruturado da linha, `WeaponAttack.includedBonuses`, e não numa segunda regex sobre a nota.

### 2) Mudanças feitas pela tela do jogo
Moram no PlayState como sobreposição com base: ausente, vale o da ficha; presente, guarda também a base da ficha em que foi feita. Vale para:
- magias preparadas;
- armadura vestida;
- espaços criados;
- escolhas de sessão;
- deltas de inventário.

Regras:
- O draft nunca é tocado.
- Criador e PDF mostram a ficha até o PDF da Fase 3.
- O desfazer é o do playStore, porque cada mudança é uma PlayOperation.
- Ao abrir depois do criador, `reconcileLoadedPlayState` compara a base com a ficha atual:
  - base diferente: a sobreposição cai e a ficha manda, com aviso;
  - base igual: corta só o que deixou de valer, com aviso.
- Sem a base, uma edição feita no criador ficaria escondida atrás da sobreposição.

### 3) Dano estruturado de magia
- Fica em `data/spell-mechanics.json`, separado de spells.json, porque o parse-spells regenera spells.json a partir de docs/magias.
- Campos de cada magia:
  - resolução: ataque, TR (com atributo e efeito do sucesso) ou automática;
  - partes de dano com tipo ou escolha de tipo;
  - escala por espaço (inclusive "a cada dois níveis") e por nível de PERSONAGEM;
  - instâncias (feixes, raios, dardos);
  - cura, PV temporários, aumento de PV máximo e alvos extras;
  - área;
  - efeito no alvo (id do catálogo);
  - status reviewed ou textOnly, com motivo e linhas do extrato.
- Um script só propõe, com a evidência de cada campo. A revisão confere tudo no extrato.
- Os testes prendem dado, tipo e atributo ao texto e cobram 100% de cada lote.
- O guia da magia aparece como receita de leitura nas abas Regras e Magia desde o primeiro lote. Assim os lotes valem sozinhos e correm em paralelo, sem esperar o grimório.

### 4) Bloco declarativo de ação
Fica em `types/actions.ts`. A `ActionDeclaration` tem:
- momento: ação, bônus, reação, livre, movimento ou especial;
- gatilho;
- custos: recurso, espaço de magia ou item;
- resultados:
  - liga e desliga efeito;
  - cura e PV temporários;
  - ação extra e ganho de recurso;
  - rolagem com CD e dano;
  - reação sobre o dano recebido;
- rider, para somar ao dano de um acerto;
- uma vez por turno;
- requisitos.

Onde é declarada e como funciona:
- Vai em `effects.actions` das características, talentos, traços, opções de progressão e itens. As ações padrão ficam em `data/combat-actions.json`.
- `getSheetActions` agrega, no nível da classe dona.
- `useAction` gasta, aplica e marca `PlayState.turn` num único evento de desfazer.
- O "?" abre a descrição da fonte. A ação só tem resumo próprio quando não é a característica inteira.

## Ordem recomendada
1. defesas
2. PWA (independente, pode correr em paralelo)
3. efeitos ativos
4. efeitos recebidos
5. turno
6. magias-base (só depende de defesas; pode correr junto de 3–5)
7. grimório
8. armadura
9. inventário
10. ações marciais
11. magias concedidas
12. preparar magias
13. Conjuração Flexível
14. ações divinas e arcanas
15. ações de talentos e raças
16. recursos restantes

Os lotes de magia 1, 2, 3, 4–5 e 6–9 são só dados e correm em paralelo a partir da onda 6. Os modificadores de magia vêm depois do lote 1.

Toda onda fecha com o commit docs: do CLAUDE.md (seção "Modo de jogo") e, quando cria regra, com a digitalização em docs/. Comece só com a Fase 0 na main: types/playState.ts, sanitizePlayState, o export/import e a extração do PrintableSheet são arquivos quentes.

## Modelo de dados

// ===== types/damage.ts (novo) — os 13 tipos da p. 198 (regras-dano-e-morte.md §5)
export type DamageTypeId = 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder'
// data/damage-types.json: { id: DamageTypeId; name: string /* 'Fogo' */; damageLabel: string /* 'dano de fogo', 'dano elétrico' */ }[]
// FONTE ÚNICA. Derivam daqui:
//   - DAMAGE_TYPE_PT (weaponFormat);
//   - o DamageType das armas;
//   - ImmuneDamageType (condition.ts), que vira DamageTypeId.
// dragon-ancestors.json troca damageLabel por damageType: DamageTypeId (o rótulo é derivado).
// O damageImmunity de conditions.json perde o damageLabel.

// ===== types/effects.ts — acréscimos (o cabeçalho passa a admitir efeitos ligados e ações, com a regra de ouro)
export type AttackScope = 'ranged' | 'melee-one-handed' | 'melee-two-handed' | 'melee-light' | 'melee-strength' | 'unarmed'
  | 'weapon-attack' | 'melee-weapon-attack'   // JÁ EXISTEM: Campeão, Crítico Brutal; Destruição Divina usa melee-weapon-attack
  | 'melee-weapon'                            // NOVO: arma corpo a corpo, sem golpe desarmado (Destruição Divina Aprimorada, decisão c)
  | 'melee-heavy'                             // NOVO: arma corpo a corpo pesada (Mestre de Armas Grandes)
export type WeaponAttackEffect = /* atuais */ {
  /* weapons, attackBonus, note, offHandAddsModifier, conditionalDamage: os campos de hoje */
  requiresProficiency?: true                  // Mestre de Armas Grandes, Atirador Aguçado
  /** INCONDICIONAL: entra na fórmula. Destruição Divina Aprimorada: 1d8 radiante. */
  extraDamage?: { dice: { count: number; sides: number }; damageType: DamageTypeId }
  /** Opção da folha, nunca estado. */
  powerAttack?: { attack: -5; damage: 10 }
}
export type EquipmentRequirement = 'noHeavyArmor' | 'noArmorNoShield' | 'heavyArmor'   // + heavyArmor: Maestria em Armadura Pesada

export type DamageDefenses = {
  resistances?: DamageTypeId[] | 'all' | { allExcept: DamageTypeId[] }
  immunities?: DamageTypeId[]
  vulnerabilities?: DamageTypeId[]
  conditionImmunities?: ConditionId[]
  /** Redução fixa, aplicada antes da resistência (p. 199). Maestria em Armadura Pesada: 3 de B/P/S. */
  reduction?: { amount: number; types: DamageTypeId[] }
  /** Só vale nesta situação ('de magias', 'de ataques não mágicos'): caixa DESLIGADA no painel de PV. */
  condition?: string
  /** Vale sempre, salvo nesta situação ('arma mágica ou de prata', Resistência Demoníaca): caixa que CANCELA, desligada por padrão. */
  exceptWhen?: string
  requires?: EquipmentRequirement
  fromAncestor?: true                         // o tipo é o do ancestral dracônico
  fromSessionPick?: string                    // o tipo é escolha de sessão: PlayState.sessionPicks[id]
}

/** O que um efeito LIGADO faz: o vocabulário das condições mais estes. */
export type ActiveEffect =
  | (RollModeEffect & { attackScope?: AttackScope })     // Fúria: vantagem em testes e TR de FOR
  | { kind: 'rollDice'; rolls: RollCategory[]; abilities?: AbilityScore[]; dice: { count: number; sides: number }; sign: 1 | -1; deathSave?: boolean; scope: 'sheet' }  // Bênção, Perdição
  | { kind: 'rollBonus'; rolls: RollCategory[]; abilities?: AbilityScore[]; value: number; scope: 'sheet' }
  | { kind: 'acBonus'; value: number; scope: 'sheet' }                  // Escudo Arcano +5, Escudo da Fé +2, Velocidade +2
  | { kind: 'acFormula'; formula: UnarmoredAcFormula; scope: 'sheet' }  // Armadura Arcana: disputa pela maior (p. 14)
  | { kind: 'acMinimum'; value: number; scope: 'sheet' }                // Pele de Árvore: max(CA final, 16)
  | { kind: 'speedBonus'; feet: number; scope: 'sheet' }
  | { kind: 'speedMultiplier'; factor: 2; scope: 'sheet' }
  | { kind: 'flySpeed'; feet: number | 'walking'; scope: 'sheet' }
  | { kind: 'damageDefenses'; defenses: DamageDefenses; scope: 'sheet' }
  | { kind: 'weaponDamage'; weapons: AttackScope; dice: { count: number; sides: number }; damageType: DamageTypeId; scope: 'sheet' }  // Auxílio Divino
  | { kind: 'conditionImmunity'; conditions: ConditionId[]; scope: 'gameState' }  // Fúria Inconsciente
  | StateEffect /* kinds atuais + 'cannotCast' */ | SuspendEffect | AgainstYouEffect | NoticeEffect

export type ToggleEnd = 'unconscious' | 'incapacitated' | 'startOfYourTurn' | 'donArmor' | 'speedZero' | 'concentrationEnds' | 'longRest'
export type ToggleDeclaration = {
  id: string            // 'rage' | 'spell:bless' | 'action:dodge' | 'empty-body' | 'item:antitoxin'
  label: string         // só o rótulo ('Em fúria'); o texto é o da característica ou o de spells.json
  spellId?: string      // texto, duração e concentração vêm de spells.json, sem cópia
  page: number
  effects?: ActiveEffect[]
  benefits?: { requires: EquipmentRequirement; effects: ActiveEffect[] }   // Fúria: só sem armadura pesada (p. 48)
  endsOn?: ToggleEnd[]
  earlyEndReminder?: string    // lembrete do Novo turno (Fúria: sem ataque nem dano, conforme a dúvida de regra)
  options?: { id: string; label: string; onEnd?: { exhaustion: 1 } }[]    // Frenesi
  choice?: { kind: 'damageType' | 'ability'; from?: string[] }
}
export type ToggleModifier = { toggle: string; effects?: ActiveEffect[]; benefits?: ToggleDeclaration['benefits']; options?: ToggleDeclaration['options']; suppressEarlyEnd?: true /* Fúria Persistente */ }
// ConditionalDamageBonus += toggle?: string
// CastingRestriction += toggle?: string; blocks?: ('cast' | 'concentrate')[]
// StateEffect.kind += 'cannotCast'
// FeatureEffects += damageDefenses?, toggle?: ToggleDeclaration, toggleModifiers?, actions?: ActionDeclaration[], grantedSpells?,
//   spellDamageBonus?, spellHealingBonus?, flexibleCasting?, carryingCapacityMultiplier?: 2 /* Aspecto da Besta Urso */,
//   mediumArmorMaxDex?: 3 /* Maestria em Armadura Média */, mediumArmorNoStealthDisadvantage?: true,
//   initiativeRecovery?: { resource: string; amount: number }   /* ao rolar iniciativa SEM uso: Auto Aperfeiçoamento, Inspiração Superior, Implacável */
// ProgressionOption.effects += toggleModifiers, actions, grantedSpells, metamagic, spellDamageBonus (totens, manobras, invocações, disciplinas)
// RacialTraitEffects Pick += 'damageDefenses' | 'actions'
// ResourceEffect += counter?: { resetsOn: 'short' | 'long' }   (Fúria Implacável, Sobrecarga)
//                += shortRestRecovery?: number                (Restauração Mística: 4, com o teto da tabela)
// InnateSpell += uses?: { count: 1; recharge: 'long' }
// GeneralItem += piecesPerUnit?: number ; use?: Omit<ActionDeclaration, 'id'>
// Weapon += ammunition?: string   // id em general-items.json

// ===== types/actions.ts (nasce mínimo em efeitos-ativos e fica completo em turno)
export type ActionTiming = 'action' | 'bonusAction' | 'reaction' | 'free' | 'movement' | 'special'
export type ActionCost =
  | { kind: 'resource'; resource: string; amount: ResourceQuantity | 'choose' }
  | { kind: 'spellSlot'; minLevel: number; maxLevel?: number }
  | { kind: 'item'; item: string; amount: number }
export type ActionSave = { ability: AbilityScore; dc: { resource: string } | 'spell' | 'maneuver' | 'ki' | ResourceQuantity; onSuccess?: 'half' | 'none' }
export type DiceSpec = { count: ResourceQuantity; sides: ResourceQuantity; bonus?: ResourceQuantity } | { resource: string }
/** Reação sobre o dano recebido no painel de PV, aplicada antes da resistência (p. 199). */
export type DamageReaction =
  | { kind: 'halve' }                            // Esquiva Sobrenatural
  | { kind: 'reduce'; dice: DiceSpec }           // Aparar, Defletir Projéteis
  | { kind: 'resist'; types: DamageTypeId[] }    // Amortecer Elementos
export type ActionOutcome =
  | { kind: 'toggleOn'; toggle: string; option?: string } | { kind: 'toggleOff'; toggle: string }
  | { kind: 'heal'; dice: DiceSpec; target: 'self' | 'choose' }
  | { kind: 'tempHp'; amount: ResourceQuantity }
  | { kind: 'extraAction' } | { kind: 'gainResource'; resource: string; amount: number | 'slotLevel' } | { kind: 'createSpellSlot' }
  | { kind: 'roll'; save?: ActionSave; damage?: DiceSpec; damageType?: DamageTypeId | 'fromAncestor' }
  | { kind: 'damageReaction'; reaction: DamageReaction }
export type DamageRider = { scope: AttackScope; dice: DiceSpec; damageType?: DamageTypeId; perSlotAbove?: { count: number; max: number }; save?: ActionSave; extraVs?: { label: string; count: number } }
export type ActionDeclaration = {
  id: string; name: string; timing: ActionTiming; trigger?: string
  cost?: ActionCost[]; outcomes?: ActionOutcome[]; rider?: DamageRider
  oncePerTurn?: true; requiresToggle?: string; requiresOption?: string
  requires?: EquipmentRequirement | 'twoLightMeleeWeapons' | 'prone'
  link?: string        // jogada do guia (skill:stealth) ou destino ('attacks', 'spellbook', 'bag')
  summary?: string     // só quando a ação não é a característica inteira; o '?' abre a description da fonte
  page: number
}
export type SheetAction = ActionDeclaration & { source: string; group: 'action' | 'bonusAction' | 'reaction' | 'other'; resolved: { saveDc?: number; dice?: string; amount?: number } }
// data/combat-actions.json: ActionDeclaration[]
//   Atacar, Conjurar, Disparada, Desengajar, Esquivar, Ajudar, Esconder, Preparar, Procurar, Usar um Objeto,
//   Agarrar, Empurrar, Ataque de Oportunidade, Duas Armas, Levantar-se, Interagir

// ===== types/session.ts (novo; evita ciclo effects ↔ playState)
export type WornArmor = { bodyArmorId: string | null; shield: boolean; basis: string /* armadura+escudo equipados no draft quando a troca foi feita */ }
export type ResolvedToggle = { id: string; source: string; effects: ActiveEffect[]; blockedBy?: string; option?: string; choice?: string }
export type SheetSession = { worn?: WornArmor; active: ResolvedToggle[] }
export const NO_SESSION: SheetSession = { active: [] }
// getSheetToggles(draft, scores): SheetToggle[]
//   (características no nível da classe dona + opções escolhidas, com os modificadores fundidos)
// resolveActiveEffects(active: ActiveToggle[], toggles: SheetToggle[], worn: { bodyArmor?: Armor; hasShield: boolean }): ResolvedToggle[]
//   (uma função para a tela e para as operações)
// getSheetSession(draft, state): SheetSession
//   (usada por getRollGuide, getConcentrationGuide e usePlayView)

// ===== types/playState.ts — acréscimos (todos com default no sanitizePlayState; PLAY_STATE_VERSION não sobe)
export type ActiveToggle = { id: string; startedAt: number; option?: string; choice?: string; sustainedByConcentration?: true }
export type TurnState = {
  action: boolean; bonusAction: boolean; reaction: boolean; movement: boolean; extraActions: number
  spellsCast: { spellId: string; level: number; timing: ActionTiming }[]
  attacked: boolean; tookDamage: boolean; oncePerTurnUsed: string[]
}
export type PreparedOverride = { ids: string[]; basis: string[] /* a lista do draft quando a troca foi feita */ }
export type CoinId = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'
export type SessionInventory = {
  itemDelta: Record<string, number>
  coinDelta: Partial<Record<CoinId, number>>
  ammoSpentSinceRecovery: Record<string, number>
}
PlayState += {
  activeEffects: ActiveToggle[]                        // []
  turn: TurnState                                      // vazio; Nova sessão zera
  preparedSpells?: Record<string, PreparedOverride>    // 'class:cleric'; ausente = o do draft (preparados) ou nenhuma (mago)
  wornArmor?: WornArmor                                // ausente = o equipado no draft
  createdSpellSlots: number[]                          // 9 posições; zera no descanso longo
  inventory: SessionInventory
  sessionPicks: Record<string, string>                 // Resistência Demoníaca → 'fire'
  restCounters: Record<string, number>                 // Fúria Implacável, Sobrecarga, Curandeiro e Líder Inspirador em si
  arcaneWard?: { hp: number }                          // Proteção Arcana: criada ao conjurar abjuração de 1º+; some no descanso longo
  portents?: number[]                                  // Prodígio: os d20 anotados no descanso longo
}
DamageInput += {
  /* damageType vira DamageTypeId */
  parts?: { amount: number; damageType?: DamageTypeId }[]
  conditionalDefenses?: string[]
  exceptions?: string[]
  reaction?: { actionId: string; value?: number }
  ignoreDefenses?: true                                // Sobrecarga
}
PlaySheet += {
  defenses: SheetDamageDefense[]
  toggles: SheetToggle[]
  actions: SheetAction[]
  worn: { bodyArmor: ArmorRef | null; shield: boolean }
  carriedArmor: ArmorRef[]
  flexibleCasting: FlexibleCasting | null
  startingCoins: Record<CoinId, number>
  carryingCapacityKg: number
}
// buildPlaySheet(draft, worn?) monta speed e defesas com a armadura vestida.
//   O playStore remonta o sheet quando state.wornArmor muda (operação, desfazer, reconciliação).
// getPlaySpeed(state, sheet) = sheet.speed + speedBonus ligados → ×2 → condições (zero vence; ignoreBonuses).
//   Usado pela barra de vitais e pelas operações (standUp, Disparada).

// ===== types/spellMechanics.ts (novo) — data/spell-mechanics.json, nunca tocado pelo parse-spells
export type SpellResolution =
  | { kind: 'attack'; range: 'melee' | 'ranged' }                     // crítico dobra os dados (p. 196)
  | { kind: 'save'; ability: AbilityScore; onSuccess: 'half' | 'none' | 'other' }
  | { kind: 'auto' } | { kind: 'none' }
export type LevelScaled = { perSlotAbove?: { count?: number; flat?: number; every?: number }; byCharacterLevel?: LevelStep[] /* truques: 1º/5º/11º/17º de PERSONAGEM */ }
export type SpellInstances = { count: number; noun: 'feixe' | 'raio' | 'dardo' | 'alvo'; perSlotAbove?: number; byCharacterLevel?: LevelStep[] }
export type SpellDamagePart = LevelScaled & { count: number; sides: number; bonus?: number | 'spellcastingModifier'; type: DamageTypeId | { choose: DamageTypeId[] }; when?: string }
export type SpellAmountPart = LevelScaled & { count?: number; sides?: number; flat?: number; bonus?: number | 'spellcastingModifier' }
export type SpellMechanics = {
  id: string
  batch: 'T' | '1' | '2' | '3' | '4-5' | '6-9'
  bookLines: [number, number]
  status: 'reviewed' | 'textOnly'
  reason?: string
  resolution: SpellResolution
  instances?: SpellInstances
  damage?: SpellDamagePart[]
  heal?: SpellAmountPart
  tempHp?: SpellAmountPart                                       // Vitalidade Falsa, Armadura de Agathys
  maxHpIncrease?: SpellAmountPart                                // Ajuda → adjustMaxHp
  targets?: { count: number; perSlotAbove?: number }             // Bênção: +1 alvo por nível
  area?: { shape: 'sphere' | 'cube' | 'cone' | 'line' | 'cylinder' | 'radius'; text: string }
  targetEffect?: string                                          // id em active-effects.json
}
// castingTimeKind(spell): ActionTiming | 'longer' — derivado dos 13 valores de castingTime
// getSpellGuide(draft, state, { casterKey, spellId, castLevel }) devolve:
//   { attack?, saveDc?, damage: RollGuideEntry[], heal?, tempHp?, instances?, upcastGain?: string, notes: string[] }

// ===== magias concedidas, Conjuração Flexível, modificadores
FeatureEffects.grantedSpells?: { byLevel: LevelStep<string[]>[]; mode: 'alwaysPrepared' | 'known' | 'ritualOnly' | 'atWill' | 'perLongRest'; cost?: ActionCost[]; selfOnly?: true; castLevel?: number }
FeatureEffects.flexibleCasting?: { slotCosts: { level: number; cost: number }[]; maxSlotLevel: 5 }   // Fonte de Magia: 2/3/5/6/7
ProgressionOption.effects.metamagic?: { cost: number | 'spellLevel'; minCost?: 1; changesCastingTime?: 'bonusAction' }
FeatureEffects.spellDamageBonus?: {
  match: { schools?: SpellSchool[]; spellClass?: string; ids?: string[]; damageType?: DamageTypeId | 'ancestor'; cantripsOnly?: true }
  value: ResourceQuantity
  per: 'roll' | 'instance'
}
FeatureEffects.spellHealingBonus?: { base: number; perSpellLevel: number }   // Discípulo da Vida

## Ondas

### Tipos de dano e defesas no painel de PV (`defesas`)

- **Tamanho:** M
- **Depende de:** nada

O jogador toca o tipo do dano e a resistência ou imunidade da ficha se aplica sozinha: no tiefling, 13 de fogo viram 6.

A onda também:
- separa um dano de dois tipos em parcelas;
- mostra as defesas na aba Estado;
- cria a fonte única de tipos de dano e de defesas, que a Fúria usa na onda seguinte.

#### 1. Os 13 tipos de dano como fonte única

Arquivos novos:
- types/damage.ts, com DamageTypeId;
- data/damage-types.json, com { id, name, damageLabel }. O damageLabel é o rótulo por extenso da p. 198 ('dano de fogo', 'dano elétrico'), nunca montado no código;
- utils/damageTypes.ts, com DAMAGE_TYPES, getDamageType e getDamageLabel.

Passam a derivar deles:
- DAMAGE_TYPE_PT (weaponFormat);
- o DamageType das armas;
- ImmuneDamageType (condition.ts), que vira DamageTypeId.

Para não duplicar a fonte:
- dragon-ancestors.json troca damageLabel por damageType (id), e dragonAncestors.ts deriva o rótulo;
- o damageImmunity de conditions.json perde o damageLabel.

O trecho 'Tabela Ancestral Dracônico' do CLAUDE.md passa a apontar para damage-types.json.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/damage.ts`, `packages/rules/src/systems/dnd5e/data/damage-types.json`, `packages/rules/src/systems/dnd5e/utils/damageTypes.ts`, `packages/rules/src/systems/dnd5e/utils/weaponFormat.ts`, `packages/rules/src/systems/dnd5e/types/equipment.ts`, `packages/rules/src/systems/dnd5e/types/condition.ts`, `packages/rules/src/systems/dnd5e/data/conditions.json`, `packages/rules/src/systems/dnd5e/data/dragon-ancestors.json`, `packages/rules/src/systems/dnd5e/utils/dragonAncestors.ts`, `packages/rules/src/systems/dnd5e/utils/raceUtils.ts`
- **Testes:** - damageTypes.test.ts: os 13 ids, nomes e rótulos conferidos com a tabela §5 de regras-dano-e-morte.md.
- dragonAncestors.test.ts: todo ancestral tem um damageType válido, e o traço 'Tipo de Dano' sai com o texto de hoje.
- Varredura: falha se o código do dnd5e (packages/rules/src/systems/dnd5e e apps/web/src/systems/dnd5e) montar 'dano de ${'.
- **Aceite:** Nenhum rótulo de tipo de dano existe fora de damage-types.json. A suíte passa sem mudar texto de ficha (etapa Raça, Revisão, PDF).

#### 2. Efeito damageDefenses e getDamageDefenses

DamageDefenses entra em FeatureEffects, e RacialTraitEffects passa a aceitá-lo. Dados, com a linha do extrato:
- Resiliência Anã (1574) e Resiliência dos Robustos (2173): veneno.
- Resistência Infernal (3317): fogo.
- Resistência a Dano do draconato (2652): fromAncestor.
- Acostumado à Morte-Vida (8885): necrótico.
- Escudo de Pensamentos (4894): psíquico.
- Pureza Corporal (9302) e Proteção Natural (6372): imunidade ao dano de veneno e à condição Envenenado (a leitura do Petrificado, item 5 de regras-condicoes.md). A parte de elementais e fadas da Proteção Natural vira nota.
- Aura de Vigilância (10198): condition 'de magias'.
- Avatar da Batalha (5643): B/P/S, condition 'de ataques com armas não mágicas'.
- Maestria em Armadura Pesada (15204-15211): reduction 3 em B/P/S, condition 'de ataques não mágicos', requires heavyArmor.
- Resistência Demoníaca (4821-4827): fromSessionPick e exceptWhen 'arma mágica ou de prata'. Sem escolha, a linha diz 'escolha o tipo ao terminar um descanso'; a escolha chega em recursos-completos.
- Evasão (7885, 9291 e opção do Caçador 15): nota no TR de DES por conditionalRolls, o tipo de efeito que já existe.

Em sheetEffects:
- getDamageDefenses(draft, session?) devolve SheetDamageDefense[]: origem, tipos, kind, condition ou exceptWhen e o bloqueio de equipamento;
- describeDamageDefenses dá o texto.

Defesa condicional nunca entra no automático.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/types/race.ts`, `packages/rules/src/systems/dnd5e/data/races.json`, `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/data/feats.json`, `packages/rules/src/systems/dnd5e/data/hunter-superior-defense.json`, `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`, `packages/rules/src/systems/dnd5e/data/__tests__/damageDefenses.test.ts`
- **Testes:** sheetEffects.test.ts:
- Tiefling: fogo.
- Anão da colina: veneno.
- Draconato azul: elétrico.
- Necromante 10: necrótico.
- Bruxo do Grande Antigo 10: psíquico.
- Monge 10: veneno e a condição Envenenado.
- Paladino dos Anciões 7 e clérigo da Guerra 17: condicionais, fora do automático.
- Maestria em Armadura Pesada: só vale vestindo armadura pesada.
- Bruxo Corruptor 10 sem escolha feita: só a linha.

damageDefenses.test.ts:
- Todo id existe em damage-types.json.
- Toda característica, traço ou talento cujo texto diz 'resistência a dano', 'resistência contra dano' ou 'imune a' tem damageDefenses ou está numa exceção com motivo.
- **Aceite:** getDamageDefenses é a única leitura de defesa da ficha, e nenhuma defesa do livro fica esquecida em silêncio.

#### 3. Pipeline de dano com tipo e parcelas

PlaySheet ganha defenses.

DamageInput:
- damageType passa a ser DamageTypeId;
- parts?: { amount, damageType? }[] separa o dano de dois tipos (o golpe com Auxílio Divino, a coluna de chamas);
- conditionalDefenses guarda as condicionais confirmadas;
- exceptions guarda as exceções marcadas.

O damagePipeline faz, por parcela:
1. Redução fixa (Maestria em Armadura Pesada).
2. Imunidade, da ficha ou de condição: o dano vira 0.
3. Resistência: a da ficha, a do Petrificado, a manual 'resisted' e as condicionais confirmadas contam como uma só (p. 199).
4. Vulnerabilidade: só sem resistência ao mesmo tipo (item 1 de regras-dano-e-morte.md).

Arredonda por tipo e depois soma, pela proposta do item 12 até a decisão. O aviso traz a origem: 'Resistência a fogo (Resistência Infernal): 13 → 6'. Sem tipo informado, nada é automático, como hoje.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/playState.ts`, `packages/rules/src/systems/dnd5e/utils/playSheet.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** playState.test.ts:
- Tiefling, 13 de fogo: 6.
- Anão, 9 de veneno: 4.
- Monge 10, veneno: 0, sem TR de concentração.
- Tiefling, 10 cortante + 7 fogo: 13.
- Resistência + vulnerabilidade ao mesmo tipo: só a metade.
- Condicional sem confirmação: não reduz.
- Maestria em Armadura Pesada, 8 cortante não mágico: 5 de Placas; 8 sem armadura pesada.
- O Petrificado continua zerando veneno.
- O desfazer volta o PV.
- **Aceite:** A tela e os testes leem o mesmo resultado e o mesmo aviso de playState.

#### 4. Painel de PV: o tipo do dano

No HpPanel (modo Dano), a fila de chips de tipo aparece quando o personagem tem alguma defesa: da ficha, de condição ou, a partir da onda seguinte, de efeito ligado. Ela substitui a caixa 'É dano de veneno' do Petrificado.

- Os tipos com defesa vêm primeiro, depois 'Outro tipo'.
- '+ outra parcela' separa o dano em dois tipos.
- Defesa condicional vira caixa desligada ('Dano de magia?').
- Exceção vira caixa desligada que cancela ('Arma mágica ou de prata?').

Seguir as regras de foco, região viva montada vazia e alvos de 45 px do CLAUDE.md.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/HpPanel.tsx`, `apps/web/src/systems/dnd5e/components/play/hpEntry.ts`
- **Testes:** HpPanel.test.tsx:
- O tiefling vê os chips; o humano sem defesa não.
- Fogo + 13: 6, com o aviso.
- Duas parcelas somam certo.
- O foco vai ao 'Aplicar'.
- liveRegions() montadas vazias.
- Petrificado sem defesa da ficha continua oferecendo veneno.
- **Aceite:** Quem não tem defesa usa o painel exatamente como na Fase 1.

#### 5. Bloco Defesas na aba Estado

A StatusTab ganha 'Defesas', o bloco informativo da seção 9 do plano. Ele usa describeDamageDefenses e mostra também as defesas das condições.

Revisão e PDF ganham a mesma linha só se o dono aprovar (dúvida de produto), pela mesma função.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/StatusTab.tsx`
- **Testes:** StatusTab.test.tsx: o tiefling mostra 'Resistência a fogo (Resistência Infernal)'; a ficha sem defesa não ganha o bloco.
- **Aceite:** A linha de defesa sai da mesma função em toda tela que a mostra.

#### 6. Docs

- CLAUDE.md, seção Modo de jogo: tipos de dano, defesas e parcelas no painel de PV. A Tabela Ancestral Dracônico passa a apontar para damage-types.json.
- regras-dano-e-morte.md: a seção 'Resistências e vulnerabilidades do personagem' passa a implementada. A resistência condicional da Fúria passa a ser efeito ligado (onda seguinte).

- **Arquivos:** `CLAUDE.md`, `docs/regras-dano-e-morte.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs: dedicado.

### PWA: instalável e offline (`pwa`)

- **Tamanho:** M
- **Depende de:** nada

Instalar o app no celular e jogar sem rede na mesa.

Vem cedo de propósito:
- não toca nenhum arquivo quente;
- vale sozinha;
- faz o fluxo de atualização passar pelas muitas publicações da Fase 2, o que acha um bug de cache logo, e não no fim.

#### 1. Manifesto e ícones

- apps/web/public/manifest.webmanifest: 'Forja de Heróis', pt-BR, standalone, cores do tema.
- Ícones 192, 512 e maskable, gerados de apps/web/public/favicon.svg por script e versionados.
- apps/web/index.html liga o manifesto e o apple-touch-icon.

- **Arquivos:** `apps/web/public/manifest.webmanifest`, `scripts/make-icons.mjs`, `apps/web/index.html`
- **Testes:** Teste de unidade do manifesto: campos obrigatórios presentes e os ícones existem em apps/web/public/.
- **Aceite:** O Lighthouse marca o app como instalável.

#### 2. Service worker e fontes offline

Avaliar vite-plugin-pwa (MIT) com Vite 8 e rolldown. Se não servir, usar um SW próprio, com a lista de precache gerada por um plugin pequeno no apps/web/vite.config.ts.

- Precache do shell, do JS e dos JSON.
- As fontes Cinzel e Lora, hoje importadas do Google no index.css, passam a ser servidas pelo próprio app (são OFL) ou entram em cache de runtime.
- Registro só em produção, no apps/web/src/main.tsx. O núcleo continua sem regra de sistema.
- Cabeçalhos no vercel.json (ele já existe na raiz, para o build do workspace) só se os padrão não servirem. A Vercel já serve arquivo sem hash com max-age=0, must-revalidate; conferir sw.js e o manifesto com curl -I depois da publicação.

- **Arquivos:** `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/src/index.css`, `apps/web/package.json`
- **Testes:** - Teste de unidade: o registro só acontece em PROD.
- Roteiro manual offline: abrir, jogar, recarregar e criar ficha sem rede.
- **Aceite:** Depois da primeira visita, o jogo e o criador abrem e funcionam offline, com as fontes certas.

#### 3. Atualização e persistência

- A versão nova vale na próxima abertura. Nunca recarregar com o jogo aberto; um aviso discreto 'Atualizado' aparece na galeria.
- Ao instalar, chamar navigator.storage.persist().
- Registrar no CLAUDE.md (Arquitetura).

- **Arquivos:** `apps/web/src/main.tsx`, `apps/web/src/GlobalGallery.tsx`, `CLAUDE.md`
- **Testes:** Teste do fluxo de atualização com o SW simulado: 'waiting' não troca a página aberta.
- **Aceite:** O app nunca recarrega sozinho com o jogo aberto.

### Efeitos ativos: o motor e a Fúria (`efeitos-ativos`)

- **Tamanho:** G
- **Depende de:** `defesas`

Ligar a Fúria e ver os números mudarem:
- o Dano de Fúria entra no dano das armas corpo a corpo de Força;
- vantagem em testes e TR de Força;
- resistência a concussão, cortante e perfurante, aplicada no painel de PV;
- a concentração termina ao entrar (decisão e);
- conjurar fica proibido.

Revisão e PDF continuam com as notas.

#### 1. Tipos do efeito ligado, da ação mínima, da sessão e do estado

Em types/effects.ts:
- ToggleDeclaration, sem custo, texto, duração ou concentração, que vêm da fonte;
- ToggleModifier (com suppressEarlyEnd), ToggleEnd e ActiveEffect;
- RollModeEffect.attackScope;
- StateEffect 'cannotCast';
- ConditionalDamageBonus.toggle;
- CastingRestriction.toggle e blocks;
- FeatureEffects.toggle, toggleModifiers e actions.

O cabeçalho do arquivo deixa de dizer que 'o que o jogador ativa fica só na descrição': passa a dizer que efeitos ligados e ações entram, sob a regra de ouro.

types/actions.ts nasce mínimo: ActionTiming, ActionCost (recurso), ActionOutcome (toggleOn e toggleOff) e ActionDeclaration.

types/session.ts: SheetSession, ResolvedToggle, WornArmor e NO_SESSION.

types/playState.ts: ActiveToggle e PlayState.activeEffects. O default é [] no sanitizePlayState, sem subir a versão.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/types/condition.ts`, `packages/rules/src/systems/dnd5e/types/actions.ts`, `packages/rules/src/systems/dnd5e/types/session.ts`, `packages/rules/src/systems/dnd5e/types/playState.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** playState.test.ts (sanitize):
- Estado salvo sem o campo carrega com [].
- Entrada sem id ou com tipo errado sai.
- O import da Fase 0 valida o campo.
- **Aceite:** Estado antigo abre sem aviso. Tipos estritos, sem any.

#### 2. A Fúria e as que a modificam, nos dados

Fúria (3643-3672):
- toggle { id 'rage', label 'Em fúria', page 48, endsOn ['unconscious'], earlyEndReminder };
- benefits { requires 'noHeavyArmor', effects: vantagem em abilityCheck e save de STR, damageDefenses B/P/S };
- actions 'rage-enter' (bonusAction, custo 1 'rage', toggleOn) e 'rage-end' (bonusAction, requiresToggle, toggleOff). O custo mora só aqui;
- o conditionalDamage do Dano de Fúria ganha toggle 'rage';
- a castingRestriction ganha toggle 'rage' e blocks ['cast','concentrate']. Fica fora dos benefícios, então vale mesmo de armadura pesada.

Modificadores:
- Frenesi (3770-3776): option 'frenzy' com onEnd exhaustion 1.
- Fúria Inconsciente (3778-3781): conditionImmunity a enfeitiçado e amedrontado, mais suspends.
- Fúria Persistente (3743-3746): suppressEarlyEnd.
- Totens, em ProgressionOption.effects, pela tabela de progressionOptions:
  - Águia, 3º nível (3842-3848): benefits noHeavyArmor e notice;
  - Lobo, 3º nível: notice;
  - Urso, 3º nível (3854-3857): resistência allExcept psíquico, sem cláusula de armadura;
  - Águia, 14º nível (3890-3894): flySpeed 'walking';
  - Lobo e Urso, 14º nível: notice.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/data/totem-warrior-totems.json`, `packages/rules/src/systems/dnd5e/utils/progressionOptions.ts`, `packages/rules/src/systems/dnd5e/data/__tests__/toggles.test.ts`
- **Testes:** toggles.test.ts:
- Todo toggle citado em conditionalDamage, castingRestriction, actions ou toggleModifiers existe.
- Ids únicos.
- O recurso do custo existe na mesma característica.
- Toda declaração tem página.
- Option referenciada existe.
- **Aceite:** A Fúria inteira sai dos dados, sem if por nome e sem custo ou texto repetido.

#### 3. Sessão: as mesmas funções, com o estado

Em sheetEffects:
- getSheetToggles(draft, scores): no nível da classe dona, com os modificadores das características e das opções escolhidas.

Em utils/activeEffects.ts:
- resolveActiveEffects(active, toggles, worn): o que vale agora, com blockedBy;
- getSheetSession(draft, state).

Parâmetro opcional session = NO_SESSION em: getSheetArmorClass, getSpeedBonuses, getSheetSpeed, describeSpeedBonuses, getArmorSpeedPenalty, getMartialArts, getWeaponAttackEffects, getSheetAttacks, getUnproficientArmor e getCastingRestrictions. getRollGuide e getConcentrationGuide derivam a sessão do estado que já recebem, sem parâmetro novo.

buildPlaySheet ganha toggles e defenses. getPlaySpeed(state, sheet) aplica o deslocamento dos efeitos ligados antes das condições.

usePlayView: armorClass = getSheetArmorClass(draft, scores, getSheetSession(draft, state)).

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`, `packages/rules/src/systems/dnd5e/utils/activeEffects.ts`, `packages/rules/src/systems/dnd5e/utils/attackUtils.ts`, `packages/rules/src/systems/dnd5e/utils/proficiencyUtils.ts`, `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`, `packages/rules/src/systems/dnd5e/utils/playSheet.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`, `apps/web/src/systems/dnd5e/components/play/usePlayView.ts`
- **Testes:** - Para cada ficha de packages/rules/src/test/fixtures.ts, 'sem sessão', NO_SESSION e 'antes' dão o mesmo resultado em: CA, deslocamento, linhas de ataque, restrições e guia inteiro.
- activeEffects.test.ts: Fúria de Placas fica com blockedBy; Urso de Placas, sem.
- **Aceite:** ReviewStep.test e PrintableSheet sem diferença. Revisão e PDF nunca recebem sessão.

#### 4. Condições e efeitos ligados no mesmo agregador

ConditionState ganha toggles?: ResolvedToggle[]. getActiveConditionEffects soma os efeitos ligados com a origem 'toggle:<id>':
- modos, com ActiveConditionEffects.scopedAttack para o attackScope de cada linha;
- defesas com tipo;
- imunidade a condição: addCondition recusa a nova, e a já gravada fica suspensa, com linha;
- cannotCast e endsConcentration vindos da restrição em vigor.

getPlayConditionEffects(state) vira getPlayEffects(state, sheet). O rollGuide passa pela sessão, e o damagePipeline lê as defesas ligadas.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`, `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** conditionEffects.test.ts:
- Fúria: vantagem em check:STR, skill:athletics e save:STR; nada no ataque.
- De Placas: sem os benefícios, mas com cannotCast e endsConcentration.
- Fúria Inconsciente suspende Amedrontado gravado.
- Urso resiste a fogo e não a psíquico, inclusive de Placas.
- **Aceite:** Uma só escada da p. 175 para condições e efeitos ligados.

#### 5. Ligar, desligar e o que encerra sozinho

useAction(state, sheet, id, { option, now }), na versão mínima: confere e gasta o custo, depois aplica toggleOn ou toggleOff.

activateToggle (interno, e direto para efeito sem custo):
- recusa morto ou inconsciente;
- encerra a concentração pelo checkConcentration que já existe, com aviso citando a p. 48 (decisão e);
- suspende as condições afetadas.

deactivateToggle aplica o onEnd da opção. No Frenesi, +1 exaustão pelo caminho de setExhaustion, com aviso.

Encerramentos automáticos:
- toZeroHp e addCondition('unconscious') encerram os efeitos com endsOn 'unconscious'.
- startConcentration recusa com cannotCast ou endsConcentration de efeito: 'Em fúria você não pode se concentrar (pág. 48)'.

Na reconciliação, efeito que a ficha não tem mais sai, com aviso.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** playState.test.ts:
- Entrar em fúria gasta 1 uso e encerra a concentração.
- Sem usos: recusa.
- Cair a 0 PV encerra a fúria.
- Encerrar o Frenesi dá +1 exaustão.
- Um desfazer volta fúria, concentração e exaustão juntos.
- De Placas: gasta o uso e avisa que não há benefícios.
- **Aceite:** Todo efeito colateral vem com um aviso que o diz, e um Desfazer desfaz tudo.

#### 6. Números ao vivo: dano e conjuração

WeaponAttack ganha includedBonuses { attack, damage }, estruturado. Nele getWeaponAttack escreve o que já somou: a Arquearia e, agora, o Dano de Fúria ligado. O rollGuide lê dali, e o INCLUDED_ATTACK_BONUS por regex sai.

O Dano de Fúria entra no número quando o toggle está ligado, sem bloqueio, na linha que cumpre o escopo:
- linha de Força, corpo a corpo: soma;
- linha de Destreza: continua nota;
- arma de arremesso: a linha corpo a corpo soma, com a nota 'arremessando, sem o Dano de Fúria';
- golpe desarmado de dano fixo: soma ao total, e o piso 0 vale sobre o total (decisões 25 e 27).

Com o toggle ligado, a restrição sai de castingRestrictions e entra em notes (a caixa vermelha) e no texto das magias da aba Regras.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/weaponFormat.ts`, `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`, `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`, `apps/web/src/systems/dnd5e/components/play/ruleReference.ts`
- **Testes:** weaponFormat.test.ts e rollGuide.test.ts:
- Bárbaro 3 em fúria: machado grande 1d12+5, com a parcela Dano de Fúria +2.
- Rapieira com DES maior: continua nota.
- Machadinha corpo a corpo: soma, com a nota de arremesso.
- Golpe desarmado com FOR 6 em fúria: 1.
- De Placas: nota 'não vale agora'.
- A Arquearia continua parcela.
- Desligar a fúria devolve o guia de antes.
- **Aceite:** Ligar e desligar é um ciclo exato: o guia volta igual.

#### 7. Tela: Efeitos ativos

ActiveEffectsSection, na aba Estado: cada efeito disponível com o botão que roda a ação que o liga ou desliga. Mostra o custo e o saldo ('gasta 1 Fúria — restam 2') e a opção (Frenesi). Ligado, mostra o que está fazendo ou o que o bloqueia.

Na VitalsBar, um chip por efeito ligado; o toque leva à seção.

Foco:
- Ligar → 'Encerrar'.
- Encerrar → título da seção.
- Recusa: o foco fica.

O que muda só no número é anunciado pelo ChangeAnnouncer.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/ActiveEffectsSection.tsx`, `apps/web/src/systems/dnd5e/components/play/StatusTab.tsx`, `apps/web/src/systems/dnd5e/components/play/VitalsBar.tsx`
- **Testes:** ActiveEffectsSection.test.tsx e VitalsBar.test.tsx:
- Ligar mostra o chip e o dano novo na aba Ataques.
- Foco conforme a regra.
- Recusa sem uso: aviso, foco mantido.
- **Aceite:** No celular, ligar a Fúria é um toque.

#### 8. Docs

- CLAUDE.md: efeitos ativos, sessão (as duas portas), a regra 'condição satisfeita pelo estado' e o fim do texto 'até o estado em fúria chegar'.
- Novo docs/regras-efeitos-ativos.md: Fúria (3643-3672) com a decisão e, Fúria Persistente, Frenesi, Fúria Inconsciente, totens e 'Combinando Efeitos Mágicos' (p. 207, linhas 18487-18498).

- **Arquivos:** `CLAUDE.md`, `docs/regras-efeitos-ativos.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs: dedicado.

### Bênção, Escudo Arcano, Armadura Arcana e dano extra na arma (`efeitos-recebidos`)

- **Tamanho:** M
- **Depende de:** `efeitos-ativos`

Quem está abençoado, sob o Escudo Arcano ou com a Armadura Arcana marca o efeito e já vê a jogada, a CA e o deslocamento certos. Vale para efeito conjurado por aliado e por si mesmo.

O paladino 11 passa a ver o 1d8 radiante da Destruição Divina Aprimorada no dano das armas corpo a corpo.

#### 1. Catálogo de efeitos de magia e de ação

data/active-effects.json traz ToggleDeclaration[] com spellId. Texto, duração e concentração vêm de spells.json. Cada entrada leva a linha do extrato:
- Bênção (20595-20607): rollDice +1d4 em ataque e TR, com deathSave (decisão 22).
- Perdição (25990-26004): −1d4.
- Escudo Arcano (23192-23203): acBonus 5, endsOn startOfYourTurn, notice sobre os mísseis mágicos.
- Armadura Arcana (20244-20255): acFormula 13 + DES, endsOn donArmor.
- Escudo da Fé (23204-23216): +2.
- Velocidade (28204-28219): +2 de CA, vantagem em TR de DES, deslocamento ×2, e notice da ação extra e da letargia ao terminar.
- Passos Longos (25901-25907): +10 pés.
- Auxílio Divino (20514-20521): weaponDamage 1d4 radiante no escopo weapon-attack.
- Pele de Árvore (25943-25953): acMinimum 16.
- Esquivar, 'action:dodge' (17408-17414): againstYou, endsOn startOfYourTurn, incapacitated e speedZero. A vantagem só entra depois da dúvida de regra.

A mesma magia não liga duas vezes: um id, um efeito (p. 207). Magias diferentes somam.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/active-effects.json`, `packages/rules/src/systems/dnd5e/utils/activeEffects.ts`, `packages/rules/src/systems/dnd5e/data/__tests__/toggles.test.ts`
- **Testes:** toggles.test.ts:
- spellId existe.
- Página e linhas presentes.
- Nenhum campo de texto copiado de spells.json.
- Ligar a mesma magia duas vezes não acumula.
- **Aceite:** Catálogo validado por teste. Nenhuma entrada sem página.

#### 2. Os números novos

Jogadas:
- RollGuideEntry ganha extraDice. A Bênção vira '1d20 + 5 + 1d4' (notação 1d20+5+1d4, com o d20 em primeiro para o natural).
- withTableMode e withInspirationSpent preservam os dados a mais.
- rollBonus entra no modificador.

CA:
- calculateArmorClass recebe bonuses, extraUnarmored e minimum, vindos da sessão.
- A Armadura Arcana disputa a maior com a Defesa sem Armadura (p. 14).
- O escudo segue a dúvida de regra.

Deslocamento:
- getPlaySpeed aplica bônus, ×2 e voo.
- O zero do Agarrado vence, e ignoreBonuses vale.

Dano:
- RollGuideEntry ganha parts: '1d8 + 3 cortante + 1d4 radiante'.
- O crítico dobra todos os dados (p. 196, linhas 17752-17764), com o desmarcar do item 6 de regras-dano-e-morte.md.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`, `packages/rules/src/systems/dnd5e/utils/armorClassUtils.ts`, `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`, `apps/web/src/systems/dnd5e/components/play/RollRecipeSheet.tsx`, `apps/web/src/systems/dnd5e/components/play/playDice.ts`, `apps/web/src/systems/dnd5e/components/play/numberSources.ts`
- **Testes:** rollGuide.test.ts:
- Bênção no ataque, no TR e no teste contra a morte.
- Perdição.
- As duas juntas.
- Bênção com vantagem da mesa: '2d20kh1+5+1d4'.
- Crítico com Auxílio Divino: '2d8 + 3 + 2d4'.

armorClassUtils.test.ts:
- Bárbaro com Armadura Arcana: fica a maior.
- Escudo Arcano como parcela.
- Pele de Árvore com escudo: max(CA, 16).
- Escudo da Fé + Velocidade: +4.

playState.test.ts:
- Velocidade dobra o deslocamento.
- Agarrado zera mesmo com Passos Longos.

playDice.test.ts: o natural sai do d20 com 1d4 junto.
- **Aceite:** O 'de onde vem' da CA e de cada jogada mostra a parcela com o nome da magia.

#### 3. Destruição Divina Aprimorada no número

Escopo novo 'melee-weapon': em isWeaponInScope, toda arma corpo a corpo; em isUnarmedStrikeInScope, false.

A Destruição Divina Aprimorada (9984-9991) ganha WeaponAttackEffect { weapons: 'melee-weapon', extraDamage: 1d8 radiante }. É incondicional: entra na fórmula de toda arma corpo a corpo na Revisão, no PDF e no jogo ('1d8+3 cortante + 1d8 radiante'), com o mesmo parts da tarefa anterior.

O texto de ficha salva de paladino 11+ muda, e isso entra no aviso de migração (decisão 10.2.23).

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/utils/weaponFormat.ts`, `packages/rules/src/systems/dnd5e/utils/attackUtils.ts`, `packages/rules/src/systems/dnd5e/data/class-progression-features.json`
- **Testes:** weaponFormat.test.ts e rollGuide.test.ts, no paladino 11:
- Espada longa: +1d8 radiante.
- Golpe desarmado: sem.
- Azagaia arremessada: sem.
- Crítico: 2d8 + 2d8.
- Paladino 10: sem.
- **Aceite:** A decisão c fica presa em teste e no número.

#### 4. Tela: Recebeu uma magia?

O botão 'Recebeu uma magia?' abre o catálogo, com busca:
- as magias de alcance Pessoal só aparecem para quem as conhece;
- pede a escolha quando houver;
- avisa que quem conjurou é quem mantém a concentração.

O efeito que você mesmo conjurou e sustenta (sustainedByConcentration) acaba junto com a sua concentração, seja por fim voluntário, dano ou incapacitação, com aviso. O recebido de aliado só sai à mão.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/ActiveEffectsSection.tsx`, `apps/web/src/systems/dnd5e/components/play/ReceivedEffectSheet.tsx`, `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** - playState.test.ts: perder a concentração desliga a Bênção própria e mantém a de aliado.
- ReceivedEffectSheet.test.tsx: busca, escolha e foco.
- **Aceite:** Em dois toques, o aviso do aliado ('você está abençoado') vira o número certo.

#### 5. Docs

- CLAUDE.md: catálogo, parts e extraDice, e a Destruição Divina Aprimorada no número.
- regras-efeitos-ativos.md: cada magia, com a linha do extrato.

- **Arquivos:** `CLAUDE.md`, `docs/regras-efeitos-ativos.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs:.

### Ações padrão, bloco de ação, checklist e Novo turno (`turno`)

- **Tamanho:** M
- **Depende de:** `efeitos-ativos`

Responder 'o que posso fazer no meu turno?' com:
- as ações padrão agrupadas em Ação / Ação Bônus / Reação / Outras;
- o 'Usar' que gasta o recurso;
- o checklist leve;
- o Novo turno, que encerra o que dura até o início do seu turno.

#### 1. Bloco de ação completo e getSheetActions

types/actions.ts completo: ActionSave, DiceSpec, DamageReaction, DamageRider e os outros resultados. RacialTraitEffects e ProgressionOption.effects passam a aceitar actions.

utils/actionUtils.ts:
- getSheetActions(draft, scores), que junta:
  - as ações padrão;
  - as das características, no nível da classe dona;
  - as de talentos e raça, no nível de personagem;
  - as das opções escolhidas em slot: as manobras de getClassManeuvers e getFeatManeuvers, as invocações e as disciplinas;
- valores resolvidos por evaluateQuantity;
- groupActionsByTiming.

O resultado vai para PlaySheet.actions.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/actions.ts`, `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/types/race.ts`, `packages/rules/src/systems/dnd5e/utils/actionUtils.ts`, `packages/rules/src/systems/dnd5e/utils/playSheet.ts`
- **Testes:** actionUtils.test.ts:
- Guerreiro 3 / mago 2: a Fúria não aparece; as ações de guerreiro aparecem no nível da classe.
- CD e dados resolvidos.
- Opção com requiresPick não cumprido fica de fora.
- **Aceite:** Nenhuma ação montada em componente.

#### 2. Ações padrão nos dados

data/combat-actions.json, a partir de regras-acoes-em-combate.md (seções 6 a 8, linhas 17340-17470 e 17604-17642):
- Atacar: link 'attacks'.
- Conjurar uma Magia: link 'spellbook'.
- Disparada, Desengajar, Ajudar.
- Esquivar: toggleOn 'action:dodge'.
- Esconder: link skill:stealth.
- Preparar: usa a reação.
- Procurar: links de percepção e investigação.
- Usar um Objeto: link 'bag'.
- Agarrar e Empurrar: link de atletismo; substituem um ataque.
- Ataque de Oportunidade: reação.
- Combate com Duas Armas: ação bônus, requires twoLightMeleeWeapons.
- Levantar-se: movimento, requires prone, chama standUp.
- Interagir com um objeto: livre.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/combat-actions.json`, `packages/rules/src/systems/dnd5e/data/__tests__/combatActions.test.ts`
- **Testes:** combatActions.test.ts:
- Ids únicos.
- Toda ação tem página.
- Todo link aponta para uma jogada que getRollGuide gera ou para um destino conhecido.
- **Aceite:** As ações condicionadas só aparecem quando valem.

#### 3. O turno no estado e o Usar

PlayState.turn (TurnState) começa vazio, e a Nova sessão também o zera.

Operações:
- markTurn: marca ou desmarca uma das quatro casas.
- newTurn:
  - zera o turno e o oncePerTurnUsed;
  - encerra os efeitos com endsOn startOfYourTurn, com aviso;
  - com a Fúria ligada, sem suppressEarlyEnd e sem ataque nem dano marcados, lembra o fim prematuro, com o texto da dúvida de regra.
- useAction completo:
  - confere e gasta o custo; recusa se faltar;
  - aplica os resultados com applyHealing, grantTempHp e activateToggle;
  - marca o momento; momento já usado gera só aviso;
  - extraActions libera outra ação.

O damagePipeline marca tookDamage, e 'Atacar' marca attacked.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/playState.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** playState.test.ts:
- Surto de Ação dá extraActions e gasta o uso.
- Novo turno encerra o Escudo Arcano e o Esquivar.
- Fúria sem ataque nem dano lembra; bárbaro 15 não.
- Segunda ação bônus: aviso, sem recusa.
- Usar sem recurso: recusa.
- O desfazer volta o turno.
- **Aceite:** O checklist lembra e nunca impede de jogar.

#### 4. Tela: Ações e checklist

Depende da decisão de produto sobre as abas.

ActionsTab:
- grupos Ação, Ação Bônus, Reação e Outras;
- Atacar mostra os AttackCard de hoje;
- cada ação tem custo e saldo visíveis, o botão Usar e um '?' que abre a descrição da fonte;
- sem nenhuma ação bônus, o grupo diz isso (regras-acoes-em-combate.md, seção 9).

TurnChecklist: Ação, Bônus, Movimento (com getPlaySpeed) e Reação, mais o botão Novo turno.

Foco: o Usar que some leva ao título do grupo. Os saldos são anunciados pelo ChangeAnnouncer.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/ActionsTab.tsx`, `apps/web/src/systems/dnd5e/components/play/TurnChecklist.tsx`, `apps/web/src/systems/dnd5e/components/play/playTabs.ts`, `apps/web/src/systems/dnd5e/components/play/AttacksTab.tsx`
- **Testes:** - ActionsTab.test.tsx: Usar gasta; recusa mantém o foco.
- TurnChecklist.test.tsx: Novo turno limpa e anuncia.
- PlayScreen.test.tsx: swipe e teclado com a aba nova.
- **Aceite:** O iniciante vê no celular o que pode fazer em cada momento do turno, com o custo.

#### 5. Docs

- CLAUDE.md, seção Modo de jogo: ações, turno, Usar e quem recusa e quem só avisa.
- Ligar ao regras-acoes-em-combate.md.

- **Arquivos:** `CLAUDE.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs:.

### Dano estruturado de magia: esquema, processo, receita e truques (`magias-base`)

- **Tamanho:** M
- **Depende de:** `defesas`

Montar o esquema e o processo de revisão que não chuta regra. Os 27 truques passam a mostrar, nas abas Magia e Regras, a receita de dano pelo nível de personagem, os feixes e o crítico.

A onda vale sozinha, sem esperar o grimório.

#### 1. Esquema e carga

- types/spellMechanics.ts e data/spell-mechanics.json, fora do parse-spells. Além de dano e cura, o esquema já traz tempHp, maxHpIncrease, targets e a escolha de tipo.
- utils/spellMechanics.ts expõe getSpellMechanics(id).

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/spellMechanics.ts`, `packages/rules/src/systems/dnd5e/data/spell-mechanics.json`, `packages/rules/src/systems/dnd5e/utils/spellMechanics.ts`
- **Testes:** Coberto pelos testes de consistência.
- **Aceite:** O parse-spells não toca o arquivo.

#### 2. Proposta automática, nunca dado

scripts/draft-spell-mechanics.mjs lê spells.json e o extrato e propõe um rascunho por lote. Cada campo traz a evidência que casou e a confiança. As evidências procuradas:
- 'NdM';
- o rótulo de damage-types.json;
- 'teste de resistência de X';
- 'metade desse dano';
- 'ataque ... com magia';
- 'Em Níveis Superiores ... NdM';
- '5° nível (2dX)';
- 'pontos de vida temporários';
- 'esfera de N metros'.

Escreve no scratch, nunca no código (packages/ ou apps/).

- **Arquivos:** `scripts/draft-spell-mechanics.mjs`
- **Testes:** O rascunho do lote T é conferido na revisão.
- **Aceite:** Nenhum campo vai a src/ sem revisão.

#### 3. Testes de consistência e cobertura

Cada entrada é conferida contra o texto da magia:
- o id existe e o nível bate com o lote;
- cada 'NdM' aparece literal na descrição;
- o rótulo do tipo e o atributo do TR aparecem;
- perSlotAbove existe se, e só se, 'Em Níveis Superiores' fala de dano, cura ou PV;
- truque de dano tem byCharacterLevel 1/5/11/17;
- targetEffect existe no catálogo;
- lote fechado cobre 100% do nível, com reviewed ou textOnly com motivo.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/__tests__/spellMechanics.test.ts`
- **Testes:** O próprio arquivo.
- **Aceite:** Erro de digitação de dado ou de tipo falha no CI.

#### 4. Guia da magia como receita de leitura

Os montadores d20Entry e damageEntry saem do rollGuide para um módulo comum (utils/guideEntries.ts), sem cópia.

utils/spellGuide.ts: getSpellGuide(draft, state, { casterKey, spellId, castLevel }) monta:
- ataque e CD da conjuração;
- dano por parte, com o crítico só para magia com jogada de ataque;
- truque pelo nível de PERSONAGEM (draft.level);
- instâncias;
- cura e PV temporários com o modificador de conjuração;
- o ganho do nível maior: 'No 4º nível: 9d6 (+1d6)'.

Nas abas Magia e Regras, a magia com mecânica ganha 'Dano' e 'Ataque', que abrem o RollRecipeSheet.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/guideEntries.ts`, `packages/rules/src/systems/dnd5e/utils/spellGuide.ts`, `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`, `apps/web/src/systems/dnd5e/components/play/MagicTab.tsx`, `apps/web/src/systems/dnd5e/components/play/RulesTab.tsx`
- **Testes:** spellGuide.test.ts:
- Raio de Fogo para guerreiro 4 / mago 1: 2d10; crítico 4d10.
- Chama Sagrada: TR, sem crítico.
- Rajada Mística no 5º nível de personagem: 2 feixes.
- rollGuide sem diferença depois da extração.
- **Aceite:** Nenhuma fórmula de magia montada em componente, e o mago já vê o dano certo dos truques.

#### 5. Lote T: os 27 truques

Revisar cada truque contra o extrato (capítulo 11), gravando bookLines. Dano que depende do Mestre vira textOnly com motivo. Divergência pt-BR × inglês para o lote e vai ao dono antes do commit.

Criar docs/magias/mecanica-magias.md, com o processo, a lista do lote e os pontos em aberto.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/spell-mechanics.json`, `docs/magias/mecanica-magias.md`
- **Testes:** spellMechanics.test.ts com o lote T fechado.
- **Aceite:** Os 27 truques têm entrada, e as dúvidas encontradas foram ao dono.

### Grimório jogável: conjurar, ritual, ação bônus e concentração (`grimorio`)

- **Tamanho:** G
- **Depende de:** `turno`, `magias-base`

Conjurar pela ficha:
- escolher o espaço, vendo o ganho do nível maior;
- conjurar como ritual sem gastar, pela regra da classe;
- receber o aviso da regra da magia de ação bônus;
- ter a concentração marcada sozinha;
- curar a si mesmo ou ligar o efeito em si no mesmo toque.

#### 1. Modelo do grimório

utils/spellbook.ts, sobre a função pura de magias conhecidas da Fase 0.

getPlaySpellbook(draft, state) monta uma lista por conjuração: class:<id>, feat:<id>, race e granted:<feature>. Cada magia traz:
- status: cantrip, prepared, known, inSpellbook, alwaysPrepared, atWill, perRest ou ritualOnly;
- as fontes de espaço que servem;
- CD e ataque de getRollGuide().spellcasting, com a mesma chave.

Outras funções:
- canCastAsRitual(caster, spell): predicado puro sobre a regra de describeCastingAids (p. 203-204, linhas 18174-18191), sem segunda cópia;
- castingTimeKind(spell): cobre os 13 valores de castingTime.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/spellbook.ts`, `packages/rules/src/systems/dnd5e/utils/spellUtils.ts`, `packages/rules/src/systems/dnd5e/utils/playSheet.ts`
- **Testes:** spellbook.test.ts:
- Mago faz ritual do grimório sem preparar.
- Clérigo faz ritual só das preparadas.
- Bardo faz ritual das conhecidas.
- Multiclasse usa espaço acima do que conhece (linhas 14828-14837).
- castingTimeKind cobre os 13 valores.
- **Aceite:** A aba Regras e o grimório leem a mesma lista.

#### 2. Conjurar como operação pura

castSpell(state, sheet, { casterKey, spellId, castLevel, pay: slot | pact | created | resource | ritual | free, targetsSelf, now }):
- recusa com cannotCast em vigor (Fúria), com armadura sem proficiência vestida (p. 144), morto ou incapacitado, e com componente V sem fala;
- gasta o que foi escolhido; o ritual não gasta e não sobe de nível;
- marca o turno pelo tempo de conjuração;
- avisa da magia de ação bônus conforme a dúvida de regra da ordem, e também com magia de reação no próprio turno (linhas 18204-18210);
- começa a concentração, trocando a anterior com o aviso de hoje;
- com o alvo sendo você: liga o targetEffect (sustainedByConcentration), aplica a cura (applyHealing), os PV temporários (grantTempHp) ou o PV máximo da Ajuda (adjustMaxHp);
- grava turn.spellsCast.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** playState.test.ts:
- Gasta o espaço certo: pool, Pacto e criado.
- Ritual não gasta.
- Palavra Curativa (ação bônus) e depois Bola de Fogo: aviso.
- Truque de 1 ação depois da ação bônus: sem aviso.
- Concentração trocada.
- Em fúria: recusa.
- Mago de cota de malha sem proficiência: recusa.
- Curar Ferimentos em si: cura.
- O desfazer volta espaço, concentração e PV.
- **Aceite:** Nenhum gasto de espaço espalhado na tela: tudo passa por castSpell.

#### 3. Tela: a aba Magia vira grimório

Depende da decisão de produto sobre as abas.

A MagicTab ganha a lista por conjuração e nível, com as marcas, e nos truques 'escala pelo nível de personagem: N'.

O botão Conjurar abre o SpellCastSheet, com:
- o espaço disponível e o ganho do nível, pelo spellGuide quando o lote já existe, senão pelo texto de 'Em Níveis Superiores';
- 'Como ritual (+10 min)';
- a receita;
- 'Em você?';
- os avisos.

A aba Regras continua só leitura.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/MagicTab.tsx`, `apps/web/src/systems/dnd5e/components/play/SpellCastSheet.tsx`, `apps/web/src/systems/dnd5e/components/play/ruleReference.ts`
- **Testes:** MagicTab.test.tsx e SpellCastSheet.test.tsx:
- Conjurar apaga a bolinha certa.
- Ritual não aparece para quem não pode.
- Avisos em região viva.
- O foco volta ao item.
- **Aceite:** Um clérigo conjura Curar Ferimentos no 2º nível em três toques.

#### 4. Docs

CLAUDE.md, Modo de jogo: grimório, castSpell e a lista de recusas. Ligar a regras-conjuracao.md.

- **Arquivos:** `CLAUDE.md`, `docs/regras-conjuracao.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs:.

### Vestir e tirar armadura com a CA ao vivo (`armadura`)

- **Tamanho:** M
- **Depende de:** `turno`

Na tela do jogo, vestir ou tirar armadura e escudo e ver ao vivo a CA, o deslocamento, as Artes Marciais, os benefícios da Fúria e os avisos de proficiência.

O criador não muda, e a CA com armadura média passa a seguir a Maestria em Armadura Média.

#### 1. Maestria em Armadura Média como efeito

Hoje calculateArmorClass trava a armadura média em +2 de DES, e a ficha ignora o talento (15195-15202).

O efeito mediumArmorMaxDex 3 (com Destreza 16 ou mais) e mediumArmorNoStealthDisadvantage entra no talento e em calculateArmorClass.

Isso muda a CA de ficha salva, então entra no aviso de migração (decisão 10.2.23).

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/data/feats.json`, `packages/rules/src/systems/dnd5e/utils/armorClassUtils.ts`, `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`
- **Testes:** armorClassUtils.test.ts:
- Meia-armadura, DES 16, com o talento: 15 + 3.
- Sem o talento: 15 + 2.
- Sem desvantagem de Furtividade.
- **Aceite:** A CA da Revisão, do PDF e do jogo concordam.

#### 2. Armadura vestida na sessão

PlayState.wornArmor (com basis) alimenta SheetSession.worn. getDraftEquippedArmor(draft, session) usa a vestida, validada contra a carregada (PlaySheet.carriedArmor, da função de inventário da Fase 0).

Passam por ela:
- CA;
- Movimento sem Armadura e Movimento Rápido;
- redução por falta de Força;
- Artes Marciais;
- benefícios da Fúria;
- getUnproficientArmor;
- desvantagem de Furtividade.

buildPlaySheet(draft, worn). O playStore remonta o sheet quando state.wornArmor muda, seja por operação, desfazer ou reconciliação.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`, `packages/rules/src/systems/dnd5e/utils/equipmentUtils.ts`, `packages/rules/src/systems/dnd5e/utils/proficiencyUtils.ts`, `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`, `packages/rules/src/systems/dnd5e/utils/playSheet.ts`, `apps/web/src/systems/dnd5e/stores/playStore.ts`
- **Testes:** sheetEffects.test.ts, rollGuide.test.ts e playStore.test.ts:
- Monge que tira a armadura ganha a Defesa sem Armadura e o deslocamento.
- Bárbaro que veste Placas perde os benefícios da Fúria.
- Mago de cota de malha sem proficiência: desvantagem e 'não pode conjurar'.
- standUp lê o deslocamento novo.
- **Aceite:** Sem sessão, tudo como antes. Com sessão, a barra e as operações leem o mesmo número.

#### 3. Operações

- donArmor e doffArmor avisam o tempo da tabela da p. 146 (linhas 13327-13332); o app não conta esse tempo.
- donShield e doffShield marcam a ação do turno.
- resetWornArmor volta à ficha.
- Vestir armadura encerra a Armadura Arcana.

Na reconciliação:
- base diferente do equipado no draft: a sobreposição cai, com o aviso 'você mudou o equipamento no criador';
- armadura que saiu do inventário: sai também, com aviso.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** playState.test.ts:
- Vestir encerra a Armadura Arcana.
- Item fora do inventário: recusa.
- Ficha com outra armadura equipada no criador: a sobreposição cai, com aviso.
- Desfazer funciona.
- **Aceite:** Toda troca pode ser desfeita, e o criador sempre manda quando muda.

#### 4. Tela

Seção 'Equipamento vestido', na aba decidida pelo dono. A CA ganha o 'era N', como o deslocamento já tem.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/WornEquipmentSection.tsx`, `apps/web/src/systems/dnd5e/components/play/VitalsBar.tsx`
- **Testes:** WornEquipmentSection.test.tsx: troca, CA visível e foco.
- **Aceite:** A CA muda no mesmo toque.

#### 5. Docs

CLAUDE.md: armadura vestida como sessão com base, e a Maestria em Armadura Média.

- **Arquivos:** `CLAUDE.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs:.

### Inventário de sessão: moedas, munição, consumíveis e carga (`inventario`)

- **Tamanho:** M
- **Depende de:** `turno`

- Moedas com +/−.
- Munição com −1 e recuperação da metade.
- Poção de Cura com 'Usar'.
- O peso contra a capacidade da regra padrão.

#### 1. Dados

general-items.json:
- piecesPerUnit: Flechas 20, Virotes 20, Balas de Funda 20, Agulhas 50.
- use nos consumíveis:
  - Poção de Cura: ação, 2d4 + 2 (linhas 13895-13897);
  - Antídoto: toggle de vantagem condicional contra veneno;
  - Ácido, Fogo Alquímico e Água Benta: ataque e dano;
  - Kit de Primeiros-Socorros: 10 usos, estabilizar sem teste (13833-13836);
  - Veneno Básico: rider.

weapons.json ganha ammunition: arcos → flechas, bestas → virotes, funda → balas, zarabatana → agulhas.

Aspecto da Besta Urso (3873-3876) ganha carryingCapacityMultiplier 2.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/general-items.json`, `packages/rules/src/systems/dnd5e/data/weapons.json`, `packages/rules/src/systems/dnd5e/types/equipment.ts`, `packages/rules/src/systems/dnd5e/data/totem-warrior-totems.json`
- **Testes:** items.test.ts:
- Toda arma de munição aponta para um item de categoria ammunition.
- Todo use tem página.
- **Aceite:** A munição é contada por peça.

#### 2. Estado e operações

PlayState.inventory guarda deltas sobre o inventário da Fase 0.

Operações:
- spendAmmo: −1 peça; sem munição, recusa ('a arma não ataca', linha 13412); marca attacked.
- recoverAmmo: devolve floor(gastas / 2) e zera o contador.
- adjustItem.
- adjustCoins: por denominação; recusa abaixo de 0.
- useItem: aplica o resultado e tira 1.

Carga, só com aviso: 7,5 × Força final em kg (15817-15819), ×2 com o Urso; 100 moedas pesam 1 kg (13110-13111).

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/playState.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`, `packages/rules/src/systems/dnd5e/utils/inventoryPlay.ts`
- **Testes:** playState.test.ts:
- Gastar 5 flechas e recuperar 2.
- Gastar sem munição: recusa.
- Poção cura 2d4 + 2 com o valor digitado.
- Moeda abaixo de 0: recusa.
- Aviso de carga com Força 8.
- Urso 6 dobra a capacidade.
- **Aceite:** Os deltas sobrevivem quando a ficha muda no criador; item que saiu da ficha sai do delta, com aviso.

#### 3. Tela

Seção Bolsa, na aba decidida pelo dono: moedas, munição e consumíveis com Usar, mais peso e capacidade.

O cartão de ataque de arma de munição mostra 'Flechas: 18', o botão '−1' e 'Recuperar metade (N)'.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/BagSection.tsx`, `apps/web/src/systems/dnd5e/components/play/AttacksTab.tsx`
- **Testes:** BagSection.test.tsx e AttacksTab.test.tsx: −1, recuperar, Usar e foco.
- **Aceite:** Na mesa, gastar uma flecha é um toque.

#### 4. Docs

CLAUDE.md: inventário de sessão. regras-equipamentos.md, seção 6.3: implementada.

- **Arquivos:** `CLAUDE.md`, `docs/regras-equipamentos.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs:.

### Ações das classes marciais, 'somar ao dano' e reações sobre o dano (`acoes-marciais`)

- **Tamanho:** M
- **Depende de:** `turno`, `efeitos-recebidos`

Bárbaro, guerreiro, monge, ladino e patrulheiro com as próprias ações no turno e os custos visíveis.

- Na receita de dano, Ataque Furtivo e manobras se somam com um toque.
- No painel de PV, Esquiva Sobrenatural e Aparar reduzem o dano antes da resistência.

#### 1. Somar ao dano, ataque poderoso e reações sobre o dano

Somar ao dano: na folha de dano do RollRecipeSheet, 'Somar ao dano' lista os riders no escopo da linha:
- Ataque Furtivo;
- Assassino de Colossos;
- manobras;
- Inimigo Favorito +2 'contra o inimigo favorito'.

Ao confirmar, soma as partes na fórmula (o crítico dobra, p. 196) e chama useAction, que gasta o custo e marca oncePerTurnUsed.

Ataque poderoso: powerAttack { −5, +10 } no Mestre de Armas Grandes (melee-heavy, requiresProficiency) e no Atirador Aguçado (ranged, requiresProficiency). É opção da folha (withPowerAttack), como o Normal/V/D, nunca estado.

No HpPanel, as reações do tipo damageReaction:
- Esquiva Sobrenatural: halve;
- Aparar: reduce pelo valor digitado do dado + DES;
- Defletir Projéteis: reduce 1d10 + DES + nível de monge.

Entram antes da resistência (p. 199, linhas 17816-17823) e marcam a reação.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/RollRecipeSheet.tsx`, `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`, `packages/rules/src/systems/dnd5e/utils/weaponFormat.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`, `apps/web/src/systems/dnd5e/components/play/HpPanel.tsx`, `packages/rules/src/systems/dnd5e/types/effects.ts`
- **Testes:** rollGuide.test.ts:
- Ataque Furtivo soma 3d6 e dobra no crítico.
- −5/+10 só em arma pesada com proficiência.

playState.test.ts:
- 20 com Esquiva Sobrenatural e resistência: 5.
- Segundo Ataque Furtivo no turno: aviso.
- Aparar com 7: reduz 7.

RollRecipeSheet.test.tsx.
- **Aceite:** O ladino rola o dano com o Ataque Furtivo sem somar de cabeça.

#### 2. Dados do lote marcial

Cada ação com página e linha do extrato.

Bárbaro:
- Ataque bônus do Frenesi (requiresToggle rage, requiresOption frenzy).
- Ataque Descuidado: ação SEM efeito, só o lembrete 'marque Vantagem na folha; ataques contra você têm vantagem até o seu próximo turno' (decisão d e item 27 de regras-dano-e-morte.md).
- Presença Intimidante: TR de SAB, CD 8 + prof + CAR.
- Disparada como ação bônus pelo Totem da Águia (requiresToggle rage, requires noHeavyArmor).

Guerreiro:
- Retomar o Fôlego: ação bônus, cura 1d10 + nível de guerreiro.
- Surto de Ação.
- Indomável.
- As 16 manobras: custo 1 dado de superioridade, CD 'maneuver', como rider, reação ou ação.
- Magia de Guerra.

Monge:
- Rajada de Golpes.
- Defesa Paciente: toggleOn action:dodge.
- Passo do Vento.
- Golpe desarmado bônus das Artes Marciais.
- Ataque Atordoante: rider com TR de CON pela CD do chi.
- Defletir Projéteis.
- Queda Lenta.
- Integridade Corporal.
- Corpo Vazio (9322): 4 chi, toggle 'empty-body', invisível e resistência allExcept energia.

Ladino:
- Ataque Furtivo: rider, oncePerTurn.
- Ação Ardilosa.
- Esquiva Sobrenatural (7881).
- Golpe de Sorte.

Patrulheiro:
- Pés Rápidos: Disparada bônus.
- Desaparecer: Esconder bônus.
- Consciência Primitiva.
- Matador de Inimigos: +SAB uma vez por turno, no ataque ou no dano.
- Assassino de Colossos: rider 1d8, uma vez por turno.
- Esquiva do Rastreador: reação.
- Rajada do Rastreador: nota.
- Inimigo Favorito: rider +2.
- As opções do Caçador.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/data/battle-master-maneuvers.json`, `packages/rules/src/systems/dnd5e/data/four-elements-disciplines.json`, `packages/rules/src/systems/dnd5e/data/totem-warrior-totems.json`, `packages/rules/src/systems/dnd5e/data/hunters-prey.json`, `packages/rules/src/systems/dnd5e/data/hunter-defensive-tactics.json`, `packages/rules/src/systems/dnd5e/data/hunter-multiattack.json`
- **Testes:** actionUtils.test.ts: um personagem de cada classe, com as ações e os custos esperados.
- **Aceite:** Nenhuma ação sem página. Os custos batem com os recursos existentes.

#### 3. Cobertura das características

Toda característica, opção ou manobra do lote cujo texto diz 'ação bônus', 'reação' ou 'com uma ação' tem actions ou está numa lista explícita de exceções com motivo.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/__tests__/featureActions.test.ts`
- **Testes:** O próprio arquivo.
- **Aceite:** Nada fica esquecido em silêncio.

### Magias concedidas por característica (`magias-concedidas`)

- **Tamanho:** M
- **Depende de:** `grimorio`

Estruturar as magias de domínio, juramento, Círculo da Terra, Totem, invocações, disciplinas e do Rastreador.

No grimório, na Revisão e no PDF elas aparecem como sempre preparadas, conhecidas, à vontade, só ritual ou com custo de chi.

#### 1. grantedSpells nos dados

FeatureEffects.grantedSpells, aceito também em ProgressionOption (terrenos, invocações e disciplinas). Ids de spells.json, com as linhas do extrato:
- Domínios (Magias de Domínio, 5313 e seguintes): sempre preparadas.
- Juramentos: sempre preparadas.
- Terrenos: em land-circle-terrains.json.
- Conselheiro Espiritual (3819 e seguintes) e Andarilho Espiritual: só ritual.
- Artes Sombrias: 2 chi.
- Disciplinas: custo em chi.
- Invocações: à vontade (Armadura de Sombras) ou 1 vez por descanso longo com espaço de bruxo.
- Magia do Rastreador Subterrâneo: conhecidas, fora do limite.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/utils/progressionOptions.ts`, `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/data/land-circle-terrains.json`, `packages/rules/src/systems/dnd5e/data/eldritch-invocations.json`, `packages/rules/src/systems/dnd5e/data/four-elements-disciplines.json`, `packages/rules/src/systems/dnd5e/data/totem-warrior-totems.json`
- **Testes:** grantedSpells.test.ts:
- Todo id existe.
- O nível da magia é conjurável no nível da característica.
- Toda entrada tem página.
- A lista de cada domínio bate com o texto da description.
- **Aceite:** Domínio, juramento e círculo completos.

#### 2. Fonte única no criador e no jogo

getCasterEntries ganha alwaysPrepared e granted. getSpellSources passa a incluí-las, então a magia de domínio escolhida também como preparada gera o aviso de repetida (avisa, sem bloquear).

- getMaxPreparedSpells não as conta.
- A Revisão e o PDF as listam sob a classe.
- getPlaySpellbook usa os mesmos dados.

- **Arquivos:** `packages/rules/src/systems/dnd5e/utils/spellUtils.ts`, `packages/rules/src/systems/dnd5e/utils/spellbook.ts`, `apps/web/src/systems/dnd5e/components/steps/ReviewStep.tsx`, `apps/web/src/systems/dnd5e/components/PrintableSheet.tsx`
- **Testes:** - spellUtils.test.ts e repeatedSpells.test.ts.
- ReviewStep.test.tsx: clérigo da Vida mostra Bênção e Curar Ferimentos como de domínio.
- **Aceite:** A magia de domínio não conta nas preparadas, e a repetida avisa sem bloquear.

### Preparar magias pela tela do jogo (`preparar-magias`)

- **Tamanho:** M
- **Depende de:** `magias-concedidas`

Depois do descanso longo, clérigo, druida, paladino e mago trocam as preparadas na tela do jogo, com contador e desfazer.

O criador e o PDF não mudam. Uma troca feita no criador depois vence, com aviso.

#### 1. Preparadas no estado de jogo

PlayState.preparedSpells: Record<casterKey, { ids, basis }>. Ausente, vale a lista do draft nos preparados e nenhuma no mago.

prepareSpells(state, sheet, casterKey, ids) valida:
- preparados: só magias da lista da classe, em níveis com espaço;
- mago: só do grimório;
- máximo de getMaxPreparedSpells;
- as concedidas não contam.

Fora do resumo do descanso longo, só avisa.

resetPreparedSpells volta à ficha.

Na reconciliação:
- basis diferente da lista atual do draft: a sobreposição cai, com aviso;
- senão, corta só o que deixou de valer (o máximo baixou), com aviso.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/playState.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`, `packages/rules/src/systems/dnd5e/utils/spellbook.ts`
- **Testes:** playState.test.ts:
- Acima do máximo: recusa.
- Mago fora do grimório: recusa.
- Fora do descanso: aviso.
- Sabedoria menor no criador: a lista é cortada, com aviso.
- Preparadas trocadas no criador: a sobreposição cai, com aviso.
- Desfazer funciona.
- **Aceite:** O draft nunca é escrito, e o criador manda quando muda.

#### 2. Tela de preparar

- O LongRestPanel ganha um último passo, 'Preparar magias', para quem prepara.
- O PrepareSpellsSheet tem busca, filtro por nível e o contador X/N; as concedidas aparecem travadas.
- O grimório ganha 'Trocar preparadas', com o aviso da regra.
- O mago que nunca preparou vê 'Prepare suas magias do dia (N)'.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/LongRestPanel.tsx`, `apps/web/src/systems/dnd5e/components/play/PrepareSpellsSheet.tsx`, `apps/web/src/systems/dnd5e/components/play/MagicTab.tsx`
- **Testes:** PrepareSpellsSheet.test.tsx e RestPanels.test.tsx: contador, travadas e foco.
- **Aceite:** O clérigo troca a lista em um minuto depois do descanso.

#### 3. Docs

CLAUDE.md: as preparadas são da sessão, com base; o PDF fica para a Fase 3.

- **Arquivos:** `CLAUDE.md`
- **Testes:** Sem teste novo.
- **Aceite:** Commit docs:.

### Conjuração Flexível, Metamágica e Restauração Mística (`conjuracao-flexivel`)

- **Tamanho:** M
- **Depende de:** `grimorio`

O feiticeiro, pela tela do jogo:
- cria espaços com pontos e converte espaços em pontos;
- gasta a metamágica ao conjurar;
- recupera pontos no descanso curto do 20º nível.

#### 1. Dados

- Fonte de Magia ganha flexibleCasting: custos 2/3/5/6/7 do 1º ao 5º nível, teto no 5º (linhas 6715-6738).
- metamagic-options.json ganha metamagic: cost (número, ou spellLevel com mínimo 1 no truque) e changesCastingTime na Acelerada.
- Restauração Mística (6807-6809): shortRestRecovery 4, sem passar do teto da tabela (6710-6712).

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/data/metamagic-options.json`, `packages/rules/src/systems/dnd5e/types/effects.ts`
- **Testes:** data/__tests__: custos conferidos com a tabela.
- **Aceite:** Nenhum custo de metamágica ou de espaço fixo no código.

#### 2. Espaços criados e conversão

PlayState.createdSpellSlots: zera no descanso longo; getSpellSlotsAvailable os inclui.

- createSpellSlot (ação bônus): recusa sem pontos ou acima do 5º nível.
- convertSlotToPoints (ação bônus): aceita o espaço de Pacto e segue a dúvida de regra sobre o teto.
- completeShortRest aplica o shortRestRecovery.

Na reconciliação, o que foi criado some se a ficha não tem mais pontos de feitiçaria.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/playState.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`
- **Testes:** playState.test.ts:
- Criar um espaço de 3º gasta 5 pontos.
- Converter Pacto de 3º dá 3.
- O descanso longo apaga o criado.
- A Restauração Mística para no teto.
- Desfazer funciona.
- **Aceite:** O espaço criado aparece e se gasta como os outros.

#### 3. Metamágica ao conjurar e tela

- No SpellCastSheet, a metamágica conhecida aparece com o custo: uma por magia, salvo o texto dizer outra coisa (6745-6748). A Acelerada entra na regra da magia de ação bônus.
- Na aba Magia, o bloco Pontos de feitiçaria ganha 'Criar espaço' e 'Converter espaço', com prévia e saldo.

- **Arquivos:** `apps/web/src/systems/dnd5e/components/play/SpellCastSheet.tsx`, `apps/web/src/systems/dnd5e/components/play/MagicTab.tsx`, `apps/web/src/systems/dnd5e/components/play/SorceryPointsSheet.tsx`
- **Testes:** - SpellCastSheet.test.tsx: Magia Gêmea numa magia de 3º gasta 3 pontos.
- SorceryPointsSheet.test.tsx.
- **Aceite:** O feiticeiro joga sem contar pontos de cabeça.

### Ações das classes divinas e arcanas (`acoes-divinas-arcanas`)

- **Tamanho:** M
- **Depende de:** `acoes-marciais`, `grimorio`

Clérigo, paladino, druida, bardo, feiticeiro, bruxo e mago com:
- Canalizar Divindade;
- Destruição Divina;
- Cura pelas Mãos;
- Inspiração de Bardo;
- as ações de subclasse.

#### 1. Destruição Divina

Rider no escopo existente melee-weapon-attack (linhas 9911-9919; vale no golpe desarmado pela decisão 27), com custo spellSlot:
- 2d8 mais 1d8 por nível acima do 1º, até 5d8;
- +1d8 contra corruptor ou morto-vivo como opção da folha, que pode chegar a 6d8;
- os dados dobram no crítico;
- com a Aprimorada, soma o 1d8 que já está no número.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/utils/rollGuide.ts`
- **Testes:** rollGuide.test.ts:
- Espaço de 3º: 4d8.
- Espaço de 5º: 5d8.
- 5º contra morto-vivo: 6d8.
- Vale no golpe desarmado.
- **Aceite:** O paladino rola a Destruição Divina sem contar dados de cabeça.

#### 2. Dados do lote divino e arcano

Cada ação com página e linha do extrato.

Clérigo:
- Expulsar e Destruir Mortos-Vivos.
- Canalizar Divindade dos domínios: Preservar a Vida, Ira Destruidora, Ataque Dirigido, Bênção do Deus da Guerra, Radiação do Amanhecer, Invocar Duplicidade e outras.
- Golpe Divino: rider, uma vez por turno.
- Labareda Protetora e Ira da Tormenta: reações.
- Amortecer Elementos (5756): damageReaction resist.

Paladino:
- Cura pelas Mãos: valor escolhido.
- Sentido Divino.
- Canalizar Divindade dos juramentos; Arma Sagrada é toggle de +CAR no ataque com a arma escolhida.
- Voto de Inimizade.

Bardo: Inspiração de Bardo, Palavras de Interrupção e Inspiração em Combate.

Arcanos:
- Prodígio, Presença Feérica, Névoa de Fuga, Sorte do Próprio Obscuro, Lançar no Inferno e outras de subclasse.
- Forma Selvagem fica como nota (o modo forma é da Fase 3).

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/class-progression-features.json`
- **Testes:** - actionUtils.test.ts: um personagem por classe.
- featureActions.test.ts: cobertura estendida a estas classes.
- **Aceite:** Nenhuma característica de ação fica sem declaração ou sem exceção com motivo.

### Ações de talentos e traços raciais (`acoes-talentos-racas`)

- **Tamanho:** M
- **Depende de:** `acoes-marciais`

Arma de Sopro com CD e dano prontos, e as reações e ações bônus dos talentos visíveis no turno.

#### 1. Dados

Arma de Sopro: ação, com o TR (DES ou CON) e a área do ancestral, a CD e os dados do recurso que já existe, e o tipo fromAncestor.

Talentos:
- reações: Sentinela, Matador de Conjuradores, Conjurador de Guerra (magia como ataque de oportunidade), Duelista Defensivo (+prof de CA contra um ataque, como nota) e Mestre de Escudo;
- ações bônus: Maestria em Arma de Haste, Especialista em Besta, Mestre de Escudo, Imobilizador e Investida Poderosa;
- Atacante Bestial: rerrolar o dano uma vez por turno, como nota da folha;
- Curandeiro e Líder Inspirador ficam para recursos-completos.

Cada um com página e linha.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/races.json`, `packages/rules/src/systems/dnd5e/data/feats.json`
- **Testes:** - actionUtils.test.ts: draconato vermelho 6 com cone, TR de DES, CD e 3d6 de fogo.
- featureActions.test.ts estendido a talentos e traços.
- **Aceite:** Nenhum talento com ação fica sem declaração ou sem exceção com motivo.

### Recursos que faltam (seção 8.2) (`recursos-completos`)

- **Tamanho:** M
- **Depende de:** `acoes-divinas-arcanas`, `acoes-talentos-racas`, `conjuracao-flexivel`

Ficam jogáveis:
- magias inatas com contador;
- Fúria Implacável e Sobrecarga;
- Curandeiro e Líder Inspirador;
- Resistência Demoníaca e Afinidade Elemental;
- Proteção Arcana e Prodígio;
- as recuperações ao rolar iniciativa.

#### 1. Magias inatas com contador

InnateSpell ganha uses nos dados (Legado Infernal, Magia Drow). getSheetResources deriva 'innate:<spellId>', com o nome da magia.

describeInnateSpellUsage e o PDF passam a ler o dado, sem o '1×/descanso longo' fixo. O grimório gasta esse recurso no nível fixo (castLevel).

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/race.ts`, `packages/rules/src/systems/dnd5e/data/races.json`, `packages/rules/src/systems/dnd5e/utils/sheetEffects.ts`, `packages/rules/src/systems/dnd5e/utils/raceUtils.ts`, `apps/web/src/systems/dnd5e/components/PrintableSheet.tsx`
- **Testes:** - sheetEffects.test.ts: tiefling 3 tem repreensão infernal 1 vez, no 2º nível.
- spellbook.test.ts.
- **Aceite:** PDF e jogo dizem o mesmo uso.

#### 2. Contadores que escalam

ResourceEffect ganha counter, guardado em PlayState.restCounters.

Fúria Implacável (3733-3741):
- ao cair a 0 PV com a Fúria ligada, aviso relentlessRage com CD 10 + 5 × usos;
- a tela pergunta o resultado do TR e reaplica o dano, como na Resistência Implacável.

Sobrecarga (8776-8789):
- opção do jogador no SpellCastSheet;
- a partir do 2º uso, aplica (usos)d12 × nível de dano necrótico com ignoreDefenses.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/utils/playState.ts`, `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `apps/web/src/systems/dnd5e/components/play/HpPanel.tsx`, `apps/web/src/systems/dnd5e/components/play/SpellCastSheet.tsx`
- **Testes:** playState.test.ts:
- Fúria Implacável: CD 10, depois 15; o descanso curto volta a 10.
- Sobrecarga: o 2º uso causa 2d12 por nível, ignorando a resistência.
- **Aceite:** Todo uso tem aviso e pode ser desfeito.

#### 3. Talentos, escolhas de sessão, Proteção Arcana, Prodígio e iniciativa

- Curandeiro (15076-15088): gasta 1 uso do kit; cura 1d6 + 4 + o total de Dados de Vida do alvo; estabilizar dá 1 PV. Em si, uma vez por descanso (restCounters).
- Líder Inspirador (15170-15181): PV temporários de nível + CAR por grantTempHp, uma vez por descanso para você.
- Resistência Demoníaca (4821-4827): escolha do tipo depois de descanso curto ou longo, em sessionPicks.
- Afinidade Elemental (6857-6864): 1 ponto de feitiçaria liga a resistência ao tipo do ancestral, como opção do SpellCastSheet.
- Proteção Arcana (8522-8540):
  - PlayState.arcaneWard, criada por castSpell numa abjuração de 1º nível ou mais, com 2 × nível de mago + INT;
  - recupera 2 × o nível da magia;
  - absorve no pipeline conforme a dúvida de regra.
- Prodígio (8574 e 8613): PlayState.portents, anotados no descanso longo e gastos com 'Usar'.
- Recuperação ao rolar iniciativa sem uso, pelo initiativeRecovery, disparada pela receita de iniciativa ou por 'Rolei iniciativa':
  - Auto Aperfeiçoamento (9331), 4 chi;
  - Inspiração Superior (4232), 1 uso;
  - Implacável (7531), 1 dado.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/feats.json`, `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/utils/playState.ts`, `packages/rules/src/systems/dnd5e/types/playState.ts`, `apps/web/src/systems/dnd5e/components/play/HpPanel.tsx`
- **Testes:** - playState.test.ts: cada item do detalhe.
- HpPanel.test.tsx: a Proteção Arcana absorve na ordem decidida.
- **Aceite:** A lista de recursos da seção 8.2 fica fechada.

### Dano estruturado: magias de 1º nível (62) (`magias-lote-1`)

- **Tamanho:** M
- **Depende de:** `magias-base`

Mísseis Mágicos, Curar Ferimentos, Palavra Curativa, Mãos Flamejantes, Onda Trovejante e as outras de 1º nível com a receita pronta e o ganho do nível maior.

#### 1. Lote 1: dados revisados

Mesmo processo do lote T:
- proposta automática;
- revisão contra o extrato, gravando bookLines;
- textOnly com motivo;
- divergências ao dono.

Bênção e Perdição ganham targetEffect quando o catálogo já tiver o id. Vitalidade Falsa usa tempHp.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/spell-mechanics.json`, `docs/magias/mecanica-magias.md`
- **Testes:** - spellMechanics.test.ts com o lote 1 fechado.
- spellGuide.test.ts:
  - Mísseis Mágicos no 3º nível: 5 dardos de 1d4 + 1;
  - Curar Ferimentos no 2º: 2d8 + mod;
  - Vitalidade Falsa no 2º: 1d4 + 9.
- **Aceite:** As 62 magias de 1º nível têm entrada, e as dúvidas foram ao dono.

### Dano estruturado: magias de 2º nível (59) (`magias-lote-2`)

- **Tamanho:** M
- **Depende de:** `magias-base`

As magias de 2º nível jogáveis, como Raio Ardente, Arma Espiritual (+1d8 a cada dois níveis), Esfera Flamejante e Ajuda (PV máximo).

#### 1. Lote 2: dados revisados

Mesmo processo. perSlotAbove.every cobre 'a cada dois níveis', e maxHpIncrease cobre a Ajuda.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/spell-mechanics.json`, `docs/magias/mecanica-magias.md`
- **Testes:** - spellMechanics.test.ts com o lote 2 fechado.
- spellGuide.test.ts: Arma Espiritual no 4º nível dá 2d8 + mod; Ajuda no 3º, +10.
- **Aceite:** O lote está 100% coberto.

### Dano estruturado: magias de 3º nível (50) (`magias-lote-3`)

- **Tamanho:** M
- **Depende de:** `magias-base`

Bola de Fogo, Relâmpago, Toque Vampírico e as outras de 3º nível jogáveis.

#### 1. Lote 3: dados revisados

Mesmo processo, com a área estruturada.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/spell-mechanics.json`, `docs/magias/mecanica-magias.md`
- **Testes:** - spellMechanics.test.ts com o lote 3 fechado.
- spellGuide.test.ts: Bola de Fogo no 5º nível dá 10d6, TR de DES, metade no sucesso.
- **Aceite:** O lote está 100% coberto.

### Dano estruturado: magias de 4º e 5º nível (77) (`magias-lote-4-5`)

- **Tamanho:** M
- **Depende de:** `magias-base`

As magias de 4º e 5º nível jogáveis.

#### 1. Lote 4–5: dados revisados

Mesmo processo.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/spell-mechanics.json`, `docs/magias/mecanica-magias.md`
- **Testes:** spellMechanics.test.ts com o lote fechado.
- **Aceite:** O lote está 100% coberto.

### Dano estruturado: magias de 6º a 9º nível (86) (`magias-lote-6-9`)

- **Tamanho:** M
- **Depende de:** `magias-base`

Fechar as 361 magias.

#### 1. Lote 6–9: dados revisados

Mesmo processo. Ao fechar, spellMechanics.test passa a exigir 100% das 361 magias.

- **Arquivos:** `packages/rules/src/systems/dnd5e/data/spell-mechanics.json`, `docs/magias/mecanica-magias.md`
- **Testes:** spellMechanics.test.ts global.
- **Aceite:** 361 de 361, entre reviewed e textOnly com motivo.

### Modificadores de dano e cura de magia (`magias-modificadores`)

- **Tamanho:** P
- **Depende de:** `magias-lote-1`

Truque Potente, Evocação Potencializada, Afinidade Elemental, Rajada Agonizante e Discípulo da Vida entram no número da magia.

#### 1. spellDamageBonus e spellHealingBonus

Efeitos nas características e invocações, com as linhas do extrato:
- Truque Potente (8762-8766): metade do dano no sucesso do TR.
- Evocação Potencializada (8770-8775): +INT em uma jogada de dano.
- Afinidade Elemental (6857-6864): +CAR no tipo do ancestral, numa jogada.
- Rajada Agonizante: +CAR por feixe.
- Discípulo da Vida (5862 e seguintes): +2 + o nível da magia na cura.

O spellGuide aplica cada um como parcela nomeada.

- **Arquivos:** `packages/rules/src/systems/dnd5e/types/effects.ts`, `packages/rules/src/systems/dnd5e/data/class-progression-features.json`, `packages/rules/src/systems/dnd5e/data/eldritch-invocations.json`, `packages/rules/src/systems/dnd5e/utils/spellGuide.ts`
- **Testes:** spellGuide.test.ts:
- Rajada Mística com Agonizante no 5º nível: 2 feixes de 1d10 + CAR.
- Curar Ferimentos no 1º com Discípulo da Vida: 1d8 + mod + 3.
- Raio de Fogo com Evocação Potencializada: +INT uma vez.
- **Aceite:** O 'de onde vem' mostra a parcela de cada característica.

## Dúvidas de regra

- Esquivar. O pt-BR diz 'vantagem em testes de Destreza', que são testes de habilidade. O inglês diz 'Dexterity saving throws', testes de resistência. Isso muda a regra e alcança também a Defesa Paciente do monge, que remete ao Esquivar. Hoje o app não aplica a vantagem do Esquivar em jogada nenhuma (item 1 de regras-acoes-em-combate.md). *(docs/_book-extracts/dnd-phb.txt, linhas 17408-17414 (Esquivar, p. 192))* **Recomendação:** Seguir o inglês: vantagem em TR de Destreza. O efeito 'action:dodge' é declarado assim. Registrar o caso na lista pt-BR × inglês do CLAUDE.md e em bookText.test.ts.
- Fim prematuro da Fúria. O pt-BR diz 'se seu turno acabar e você não tiver atacado nenhuma criatura hostil desde seu último turno ou não tiver sofrido dano nesse período', o que se lê como 'termina se faltar qualquer um dos dois'. O inglês ('haven't attacked ... or taken damage since then') quer dizer 'termina se não fez nenhum dos dois'. O texto dos dados já usa 'nem' (a leitura do inglês), mas o caso não está na lista pt-BR × inglês. O lembrete do Novo turno depende dessa leitura. *(docs/_book-extracts/dnd-phb.txt, linhas 3662-3667 (Fúria, p. 48))* **Recomendação:** Seguir o inglês: só termina sem ataque E sem dano. Registrar no CLAUDE.md e em bookText.test.ts, e prender o lembrete do Novo turno em teste. A Fúria Persistente (bárbaro 15) desliga o lembrete.
- Ordem da magia de ação bônus. 'Você não pode conjurar outra magia durante o mesmo turno' vem depois de conjurar a de ação bônus. Quem já conjurou com a ação uma magia de 1º nível ou mais pode conjurar, depois, uma de ação bônus no mesmo turno? A decisão de 2026-10-29 fixou o 'só um truque de 1 ação', mas o doc deixou a ordem em aberto (regras-conjuracao.md, Ponto em aberto 2), e o aviso do castSpell depende disso. *(docs/_book-extracts/dnd-phb.txt, linhas 18204-18210 (Ação Bônus, p. 204))* **Recomendação:** O turno inteiro, em qualquer ordem: a mesma restrição antes e depois. Só aviso, nunca recusa.
- Dano de vários tipos num só evento. O exemplo do livro tem um tipo só e uma aura que reduz 'todo o dano em 5'. Duas perguntas: a redução fixa vale uma vez por evento ou uma vez por parcela? A metade arredonda por parcela ou sobre a soma do tipo? O pipeline com parcelas desta fase (golpe com Auxílio Divino, coluna de chamas, Maestria em Armadura Pesada) depende disso. É o item 12 de regras-dano-e-morte.md, sem decisão. *(docs/_book-extracts/dnd-phb.txt, linhas 17816-17826 (Resistência e Vulnerabilidade, p. 199))* **Recomendação:** A redução fixa vale por evento, sobre as parcelas do tipo que ela alcança. A resistência se aplica e arredonda por tipo (somando as parcelas do mesmo tipo antes), depois soma. É a proposta que o doc já segue.
- Conjuração Flexível: converter um espaço em pontos quando o ganho passaria do máximo da tabela. O livro diz que 'você nunca poderá ter mais pontos de feitiçaria que os mostrados na tabela'. Os pontos excedentes se perdem, ou a conversão não pode ser feita? *(docs/_book-extracts/dnd-phb.txt, linhas 6710-6712 (teto) e 6734-6738 (conversão))* **Recomendação:** Permitir a conversão, com o excedente perdido, e avisar antes de confirmar, como a cura acima do máximo (p. 199).
- Proteção Arcana (mago abjurador): 'sempre que você sofrer dano, a proteção sofrerá o dano no lugar'. A resistência se aplica antes ou depois? A proteção absorve antes ou depois dos PV temporários? *(docs/_book-extracts/dnd-phb.txt, linhas 8522-8540 (Proteção Arcana, p. 99); ordem de aplicação em regras-dano-e-morte.md, Notas)* **Recomendação:** Resistência primeiro, porque o dano 'sofrido' já sai resolvido pela p. 199. Depois a proteção absorve, depois os PV temporários, depois o PV.
- Armadura Arcana com escudo. A magia vale para quem 'não esteja vestindo armadura' e acaba 'se o alvo colocar uma armadura'. A tabela 'Vestindo e Despindo uma Armadura' lista o escudo junto das armaduras. Pegar um escudo encerra a magia, ou ele soma +2? *(docs/_book-extracts/dnd-phb.txt, linhas 20244-20255 (Armadura Arcana) e 13327-13332 (tabela que inclui o Escudo))* **Recomendação:** O escudo não encerra a magia e soma +2, como na Defesa sem Armadura do bárbaro. 'Colocar uma armadura' é a armadura de corpo.

## Dúvidas de produto

- Onde ficam as ações, o grimório, a bolsa e o equipamento vestido? No celular, as abas têm uma palavra cada e dividem 360 px. **Recomendação:** Manter as 6 abas:
- 'Ataques' vira 'Ações', com os ataques no grupo Ação;
- 'Magia' vira o grimório (espaços, lista e Conjurar);
- 'Equipamento vestido' e 'Bolsa' entram como seções da aba Estado;
- 'Regras' segue só leitura.

Uma 7ª aba apertaria os alvos de toque.
- Onde ficam o checklist do turno e o 'Novo turno'? O 'Usar' e o 'Conjurar' marcam as casas sozinhos? **Recomendação:** Uma linha compacta no topo da aba Ações, com as quatro casas e o Novo turno, sem 'modo combate'. O Usar e o Conjurar marcam a casa sozinhos, e o toque manual corrige. O checklist nunca impede de jogar.
- As defesas (resistências e imunidades) entram também na Revisão e no PDF? Hoje elas só existem no texto dos traços. **Recomendação:** Sim, uma linha 'Defesas' com a mesma função do jogo (describeDamageDefenses). A aba Estado já ganha o bloco nesta fase de qualquer jeito.
- Itens novos durante a sessão (saque, compra): só do catálogo do livro ou também texto livre? E arma ou armadura nova vira linha de ataque ou pode ser vestida no jogo? **Recomendação:** Consumíveis, munição e itens gerais do catálogo, mais item de texto livre sem mecânica. Arma e armadura novas entram pelo criador, porque é mudança estrutural. A sobreposição com base cuida do que muda lá.

## Respondidas no desenho

- Onde mora o 'ligado': em PlayState.activeEffects (id, opção, escolha e se é sustentado pela sua concentração). O draft nunca guarda estado de jogo.
- Efeito ligado vira número sem duplicar conta. O condicional ganha a chave do efeito ligado: o Dano de Fúria continua vindo do recurso 'rage-damage'. A declaração não repete texto, duração, concentração nem custo: o texto vem da fonte, e o custo vem da ação que liga. Revisão e PDF não passam sessão e continuam com a nota.
- Preparadas, armadura vestida, espaços criados, escolhas e deltas são sobreposições com base. Se o criador mudou o que estava na base, a sobreposição cai e a ficha manda, com aviso; senão, corta só o que deixou de valer. O desfazer é o do playStore.
- Mago que nunca preparou no jogo começa sem preparadas, com o convite 'Prepare suas magias do dia (N)'. Marcar as N primeiras do grimório seria chutar.
- Preparar fora do descanso longo só avisa, não impede. É o mesmo precedente do aviso das 24 h do descanso longo.
- Recusas, pelo precedente de spendResource e startConcentration:
- conjurar em fúria;
- conjurar com armadura sem proficiência vestida (p. 144), com o mesmo critério da Fúria;
- personagem morto ou incapacitado;
- usar sem recurso.
Ação do turno já usada gera só aviso.
- Fúria de armadura pesada gasta o uso e não dá os benefícios. A restrição de conjuração e o fim da concentração valem mesmo assim, porque estão fora da lista de benefícios (linhas 3647-3661). O Urso não tem cláusula de armadura (linha 3854) e vale como está escrito.
- A Fúria Persistente (bárbaro 15, linhas 3743-3746) desliga o lembrete de fim prematuro do Novo turno.
- Bênção e Perdição alcançam o teste contra a morte, pelo mesmo raciocínio da decisão 22 (Sortudo).
- O +1d4 da Bênção entra na fórmula ('1d20 + 5 + 1d4') apesar do 'pode', porque é sempre benéfico. A Perdição é obrigatória.
- Combinando efeitos mágicos (p. 207, linhas 18487-18498): a mesma magia não acumula, então um id fica ligado uma vez só; magias diferentes somam (Escudo da Fé + Velocidade dão +4 de CA).
- Truques e feixes da Rajada Mística escalam pelo nível de PERSONAGEM (decisão de 2026-10-29, regras-conjuracao.md seção 2).
- Crítico de magia:
- só em magia com jogada de ataque;
- dobra todos os dados, inclusive os somados como Ataque Furtivo e Destruição Divina (linhas 17752-17764), com o desmarcar da proposta do item 6 de regras-dano-e-morte.md;
- Crítico Brutal e Ataques Selvagens não valem em magia.
- Auxílio Divino ('seus ataques com arma') vale no golpe desarmado, pela mesma leitura da decisão a. Usa o escopo weapon-attack, que já existe.
- Destruição Divina ('ataque corpo-a-corpo com arma') vale no golpe desarmado pela decisão 27, no escopo melee-weapon-attack, que já existe. A Aprimorada não vale, pela decisão c, no escopo novo melee-weapon. O +1d8 contra corruptor ou morto-vivo vem depois do teto: pode dar 6d8 (linhas 9915-9919).
- Sobrecarga não é divergência. O pt-BR também a torna opcional ('você pode aumentar o poder', 'se usar de novo essa característica', linhas 8776-8789), e o texto dos dados já diz 'você pode'. Fica como opção do jogador no SpellCastSheet, sem levar ao dono.
- Pele de Árvore: 'a CA do alvo não pode ser inferior a 16, independentemente do tipo de armadura' (linhas 25950-25953) é piso sobre a CA final: max(CA com tudo, 16). Os bônus não somam por cima do 16.
- Conjuração Flexível com Pacto: 'um espaço de magia disponível' (linhas 6734-6738) inclui o de Pacto, que é espaço de magia (p. 166). Os espaços criados vão ao pool comum, nunca ao de Pacto.
- A reação volta no início do seu próximo turno (seção Reações, linhas 17130-17131). O 'apenas uma reação por turno' do Preparar (linhas 17445-17446) é deslize da tradução, já registrado no item 2 de regras-acoes-em-combate.md. O checklist segue a seção Reações sem levar o caso ao dono de novo.
- Ordem no painel de PV: reação que reduz ou divide o dano (Esquiva Sobrenatural, Aparar, Defletir Projéteis) e a redução da Maestria em Armadura Pesada vêm antes da resistência, porque a resistência entra 'depois de todos os modificadores' (p. 199, linhas 17816-17823). A caixa da Maestria usa o texto do pt-BR ('de ataques não mágicos').
- Resistência Demoníaca: 'Dano causado por armas mágicas ou armas de prata ignoram essa resistência' (linhas 4826-4827) é exceção. Vira caixa que cancela, desligada por padrão; não é condição que liga.
- Ataque Descuidado não vira efeito ligado. A decisão d e o item 27 de regras-dano-e-morte.md o deixam como circunstância que o jogador marca na folha (Normal/V/D). No turno ele aparece como ação, com o lembrete.
- Munição: recupera a metade, arredondada para baixo (p. 7), das gastas desde a última recuperação.
- Carga:
- 7,5 × Força final em kg (linha 15817);
- ×2 com o Aspecto da Besta Urso (linhas 3873-3876);
- 100 moedas pesam 1 kg (linha 13110);
- personagem Pequeno não muda;
- sem a variante Sobrecarga.
- Moedas por denominação (pc, pp, pe, po, pl). O saldo inicial de getStartingMoney é dividido em po, pp e pc, como em formatCoins, e o gasto vira delta.
- Os efeitos ligados não contam rodadas, porque o app não conta tempo de jogo. Os que valem 'até o início do seu próximo turno' acabam no Novo turno. Os de 'primeiro turno do combate' (Explorador Natural, Batedor do Subterrâneo) ficam como nota, porque o app não marca combate.
- Pontos de feitiçaria nunca passam da tabela (linhas 6710-6712). O espaço criado só tem teto de nível (5º), sem teto de quantidade, e some no descanso longo.
- 'Imune a veneno' (Pureza Corporal, Proteção Natural) vale para o dano e para a condição Envenenado, a mesma leitura do Petrificado (item 5 de regras-condicoes.md).
- A Nova sessão zera o turno e não desliga os efeitos ligados. Tempo de jogo não é tempo de relógio: a sessão pode acabar no meio de um combate.
- Ação que cura (Retomar o Fôlego, Poção de Cura): a tela ensina a fórmula, e o jogador digita o resultado ou usa os dados do app, como no Dado de Vida.
- Efeitos recebidos: qualquer ficha liga os do catálogo, porque a magia é conjurada nela. Os de alcance Pessoal (Escudo Arcano, Auxílio Divino) só aparecem para quem os conhece. O catálogo cresce com os lotes de magia.
- spell-mechanics.json fica separado de spells.json porque o parse-spells regenera spells.json a partir de docs/magias.
- O tipo de dano no painel de PV só aparece com alguma defesa a aplicar. Quem não tem nenhuma usa o painel como na Fase 1.
- Divergência de texto encontrada durante um lote de magias para o lote e vai ao dono antes do commit. Depois entra na lista pt-BR × inglês e em bookText.test.ts.
- PWA: a versão nova vale na próxima abertura, nunca com recarga no meio do jogo, e a galeria mostra um aviso discreto. É o padrão menos intrusivo, coerente com 'sem som e sem vibração'; não é gosto que mude o desenho.

## Riscos e mudanças do crítico

- O parâmetro de sessão atravessa muitas funções; esquecer um caminho faz a barra divergir da receita. Mitigação:
- testes 'sem sessão ≡ NO_SESSION ≡ antes' sobre todas as fichas de fixtures;
- um único lugar para o deslocamento ao vivo, getPlaySpeed(state, sheet), usado pela barra e pelas operações.
- O trabalho de dados é o maior custo: cerca de 312 características, 42 talentos, traços, 16 manobras, invocações, disciplinas e 361 magias. Mitigação: lotes pequenos, testes de cobertura com lista explícita de exceções e textOnly com motivo, nunca chute.
- Divergências pt-BR × inglês aparecem no meio dos lotes; duas já estão na mesa (Esquivar e o fim da Fúria). Cada uma para o lote até o dono decidir.
- Arquivos quentes compartilhados com a Fase 0: types/playState.ts, sanitizePlayState, export e import, e a extração do PrintableSheet. Começar com a Fase 0 na main evita retrabalho de rebase. Os nomes das funções puras de inventário e de magias conhecidas da Fase 0 ainda precisam ser confirmados na hora.
- Trocar getPlayConditionEffects(state) por getPlayEffects(state, sheet) e estender getActiveConditionEffects mexe no rollGuide, no playState e em muitos testes. É um passo dedicado, com a suíte verde antes de seguir.
- Efeitos colaterais automáticos podem surpreender: a Fúria encerra a concentração, o Frenesi dá exaustão, o Novo turno encerra o Escudo Arcano e uma edição no criador derruba uma sobreposição. Cada um precisa de aviso explícito e de um único desfazer para tudo.
- Sobreposições contra edições no criador formam muitas combinações: preparadas, armadura vestida, espaços criados, efeitos ligados e deltas de inventário, cada uma com base igual ou diferente. É preciso uma matriz de testes de reconciliação.
- 'Avisa, não impede' convive com recusas. O CLAUDE.md precisa listar quem recusa e quem avisa, para não haver deriva.
- Números de ficha salva mudam nesta fase e entram no aviso de migração (decisão 10.2.23):
- dano das armas corpo a corpo do paladino 11+ (Destruição Divina Aprimorada);
- CA com armadura média e o talento (Maestria em Armadura Média);
- magias de domínio estruturadas fazem aparecer o aviso de magia repetida.
- Arcana Mística e a Lista de Magias Expandida do patrono não têm escolha no criador. O grimório do bruxo 11+ mostra o recurso sem a magia. Fica fora da Fase 2, porque é mudança no criador; vale levar ao dono depois.
- PWA: cache velho na mesa, compatibilidade do plugin com Vite 8/rolldown e fontes do Google offline. Mitigação: versão nova só na próxima abertura, conferência dos cabeçalhos depois da publicação e teste offline manual. Por isso a onda vem cedo.
- Os toques novos que somem com a própria ação (Ligar e Encerrar, Usar, Conjurar, −1, chips de tipo) precisam seguir a regra de foco e de região viva do CLAUDE.md. Do contrário, a acessibilidade regride.
- Cota do localStorage: os campos novos são pequenos, e o histórico de rolagens continua sendo o maior consumidor. Manter o teto atual e medir com várias fichas.
- Mudança do crítico: saiu a onda 'golpe desarmado'. As decisões a, b, c e e já estão na main (commits 29d8624, 7a59398, a7192c7, 34cef9f e abef657), inclusive os escopos weapon-attack e melee-weapon-attack e os docs. A onda refazia trabalho feito.
- Mudança do crítico: os escopos de ataque reaproveitam os que existem. O 'melee-attack' do desenho era o melee-weapon-attack que já existe; ficam novos só 'melee-weapon' (Aprimorada) e 'melee-heavy' (Mestre de Armas Grandes), com requiresProficiency para Mestre de Armas Grandes e Atirador Aguçado, que o livro exige.
- Mudança do crítico: a Destruição Divina Aprimorada entra no NÚMERO das armas corpo a corpo (extraDamage), na Revisão, no PDF e no jogo. É incondicional ('sempre que você atingir uma criatura com uma arma corpo-a-corpo'), e a regra de ouro manda pôr no número. O desenho só a tratava como escopo.
- Mudança do crítico: o Ataque Descuidado deixou de ser efeito ligado ('reckless'). O item 27 de regras-dano-e-morte.md registra que é 'circunstância que o jogador marca na folha da receita, sem efeito declarado'.
- Mudança do crítico: o custo de ligar mora só na ação (rage-enter), e texto, duração e concentração vêm da fonte (description ou spells.json). O desenho declarava o custo no toggle e de novo na ação, e copiava a concentração da magia, o que quebrava a fonte única. Por isso types/actions.ts nasce mínimo já na onda efeitos-ativos.
- Mudança do crítico: a sessão tem duas portas e o getPlayNumbers saiu. As funções que já recebem o estado (getRollGuide, getConcentrationGuide) derivam a sessão sem parâmetro novo. O deslocamento ao vivo passa a ser buildPlaySheet(draft, worn) mais getPlaySpeed(state, sheet), com o playStore remontando o sheet quando a armadura muda. No desenho, standUp e a Disparada liam o sheet.speed congelado enquanto a barra lia outro número.
- Mudança do crítico: as sobreposições ganharam base. Sem ela, uma troca de preparadas ou de armadura feita no criador ficaria escondida atrás da sobreposição antiga, e a reconciliação só cortaria o que é inválido.
- Mudança do crítico: dragon-ancestors.json e conditions.json deixam de guardar damageLabel, que passa a sair de damage-types.json. O desenho mantinha o rótulo nos dois lugares e testava a igualdade, o que é duplicação.
- Mudança do crítico: a lista de defesas foi completada com Escudo de Pensamentos, Avatar da Batalha, a exceção da Resistência Demoníaca, a redução da Maestria em Armadura Pesada e Evasão como nota. Também foram completados:
- Corpo Vazio e Amortecer Elementos, nas ondas de ações;
- a caixa de veneno do Petrificado, substituída pelos chips;
- DamageInput.parts, para dano de dois tipos.
- Mudança do crítico: entraram itens que faltavam no escopo:
- Fúria Persistente, que cala o lembrete;
- Aspecto da Besta Urso na carga;
- Maestria em Armadura Média, um bug de CA de hoje que a onda armadura conserta;
- recuperações ao rolar iniciativa (Auto Aperfeiçoamento, Inspiração Superior, Implacável);
- Prodígio e Proteção Arcana com estado;
- ações do patrulheiro listadas uma a uma;
- reações sobre o dano generalizadas (Aparar, Defletir Projéteis, Amortecer Elementos);
- castSpell recusando com armadura sem proficiência.
- Mudança do crítico: o esquema de magia ganhou tempHp, maxHpIncrease (Ajuda), targets e escolha de tipo. A onda magias-base deixou de depender do grimório e mostra a receita de leitura nas abas Regras e Magia. Assim os lotes valem sozinhos e correm em paralelo desde cedo, e o grimório passa a depender de magias-base.
- Mudança do crítico na ordem:
- PWA subiu para a 2ª posição, porque é independente e exercita o fluxo de atualização nas publicações da fase;
- magias-modificadores depende só do lote 1, e não de ações divinas;
- armadura e inventário vêm logo depois do grimório, por serem M e decisões explícitas do dono.
- Mudança do crítico nas dúvidas:
- foram para selfAnswered, com a linha que as resolve: Sobrecarga (o pt-BR também a torna opcional), Pele de Árvore (o texto já diz que é piso) e a conversão de espaço de Pacto;
- entraram como ruleDoubts: a ordem da magia de ação bônus (Ponto em aberto 2 de regras-conjuracao.md) e o dano de vários tipos (item 12 de regras-dano-e-morte.md), porque o castSpell e o pipeline dependem delas;
- o fluxo de atualização da PWA saiu de productDoubts.
- Mudança do crítico nas referências:
- 'decisão 10' (resistência + vulnerabilidade) é o item 1 de regras-dano-e-morte.md;
- a ordem dos modificadores antes da resistência é da p. 199 (linhas 17816-17823), não da p. 197;
- o bônus incluído na linha de ataque passa a campo estruturado (WeaponAttack.includedBonuses), em vez de uma segunda regex sobre a nota.
