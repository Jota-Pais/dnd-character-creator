# D&D Character Creator — CLAUDE.md

## Visão do Produto

Qualquer pessoa que decida jogar D&D — mesmo pela primeira vez — deve conseguir criar uma ficha em **poucos minutos**, sem assistir a vídeos nem ler centenas de páginas de regras, mantendo **controle total das próprias escolhas** e vivendo uma experiência **gamificada e prazerosa**.

Toda decisão de produto e design serve a esse objetivo: guiar o iniciante sem tirar dele o controle, esconder a complexidade das regras (mas nunca as escolhas) e tornar a criação um momento divertido — não uma lição de casa.

## Arquitetura

- **SPA front-end pura**, sem backend
- Persistência local no navegador (localStorage na V1, possivelmente IndexedDB no futuro)
- **Sistemas Multi-RPG (Arquitetura Modular):** O núcleo da aplicação (`src/core`) é completamente agnóstico de regras de negócio. Todos os dados, regras e telas específicas ficam isolados nos seus respectivos módulos de sistema (ex: `src/systems/dnd5e`).
- Deploy estático na Vercel, com CI de lint + testes via GitHub Actions (`.github/workflows/ci.yml`) a cada push/PR na `main`
- Não sugerir API routes, server actions ou qualquer arquitetura com servidor próprio

### Proficiências e efeitos (portado do módulo Ordem, 2026-08-29)

Dois motores, um em cada arquivo, espelhando o que o Ordem já fazia:

- **`utils/proficiencyUtils.ts` — quem tem o quê.** Fonte única de perícias, ferramentas, idiomas, armaduras, armas e resistências, agregando raça, classe (com o subconjunto de multiclasse da p. 166), subclasse e talento. Nada de agregação paralela em outro módulo.
  - A exclusão é **por slot**, não por fonte: a lista de perícias da classe e os extras da subclasse são concessões independentes, e cada classe da multiclasse tem as suas. É o que impede repetir uma perícia (regra da p. 125).
  - Exceção: o picker de *expertise* (Domínio do Conhecimento) **não** exclui — lá dobrar uma perícia que você já tem é o ponto.
  - **Especialização** também mora aqui: `getExpertiseSkills` junta a de cada classe da multiclasse (só as levas que o nível NELA libera — `expertise.grants` em `classes.json`) e a do Domínio do Conhecimento. O seletor de uma classe não oferece o que outra fonte já dobra (o bônus só se multiplica uma vez, p. 175).
  - **`getSkillChecks` é o número de cada perícia** na Revisão e no PDF (modificador + bônus dobrado, inteiro ou metade, nunca somados), e `getPassiveScore` o valor passivo. Não refazer a conta no componente — foi assim que a Especialização do bardo e a Versatilidade sumiram da ficha.
  - **Meia proficiência** (Versatilidade, Atletismo Extraordinário) é efeito `halfProficiencyOnChecks` (`rounding` + `abilities` opcional) em feature de classe/subclasse. As fontes não somam: `getCheckProficiencyBonus(draft, proficiência, atributo)` fica com a maior para o atributo do teste (perícia, iniciativa), e as linhas da Revisão e do PDF saem de `describeHalfProficiencyOnChecks`.
  - **Estilo de Luta da classe** só conta pelo `fightingStyleGrant` de `classes.json` (nível NA classe + lista: guerreiro 1º/seis, paladino e patrulheiro 2º/quatro), via `getClassFightingStyleOptions` — seletor, validação e ficha. Abaixo do nível a escolha fica no draft e não mexe em número.
  - **`getSavingThrowChecks` é o número de cada resistência**, sobre `getSavingThrowProficiencies`: classe inicial (a multiclasse não dá resistência inicial, p. 166) + Resiliente + features de classe com `savingThrowProficiencies` (Mente Escorregadia, Alma de Diamante), estas de qualquer classe da multiclasse. Ler `cls.savingThrows` no componente foi o que sumiu com o Resiliente da ficha.
- **`utils/sheetEffects.ts` — o que as características fazem.** Efeitos declarados nos dados (`types/effects.ts`), agregados aqui. Regra de ouro herdada do Ordem: **efeito incondicional entra no número da ficha; efeito condicional vira linha própria com a condição** (somar o +1 do Ambidestro mentiria pra quem usa escudo).
  - Escolhas que uma característica abre (Perito, Poliglota, Mestre de Armas, Colégio do Conhecimento) viram **slot na etapa dona dela**, ao lado do catálogo — nunca um catálogo aninhado dentro do card.
  - Consequência de regra que a ficha não deve "resolver" sozinha vira **aviso**, não alteração de número: armadura sem proficiência (p. 144) avisa da desvantagem em vez de mexer nos valores.
  - Features de classe também declaram efeito (`effects` em `class-progression-features.json`, ex.: a Versatilidade do bardo 2), agregadas por `getOwnedClassFeatures` — cada classe da multiclasse no nível que tem nela.
  - **CA** sai só de `getSheetArmorClass` (Revisão e PDF; o texto aberto por `formatArmorClassBreakdown`). Formas de CA sem armadura são efeito (`unarmoredAc`: Defesa sem Armadura, Resiliência Dracônica) e não se somam — a ficha mostra a maior (p. 14); a mesma característica (mesmo `id`) de duas classes vale uma vez (p. 166). PV por nível da classe dona da feature é `hpPerClassLevel`; por nível de personagem (talento, raça) é `hpPerLevel`.
  - **Ataques por ação** saem só de `getAttacksPerAction` (o total, que `getSheetAttacks` leva a cada linha como `attacksPerAction` — o "2×" que a Revisão e o PDF leem da linha, nunca do total: arma de recarga fica em 1, p. 149, com nota; o Especialista em Besta é o efeito `ignoresLoading`, só nas bestas com proficiência, p. 169) e `describeAttacksPerAction` (as linhas da Revisão e do PDF). Ataque Extra é efeito (`attacksPerAction`, degraus por nível na classe dona: guerreiro 2/3/4 no 5º/11º/20º) e não soma entre classes — vale o maior (p. 166). Opção escolhida em slot de progressão também declara efeito (`effects` em `ProgressionOption`): a Lâmina Sedenta é `conditionalAttacksPerAction`, linha com a condição, que some com Ataque Extra. Nunca procurar feature pelo nome.
  - **Deslocamento** sai só de `getSheetSpeed` (raça + bônus ativos) e `describeSpeedBonuses` (as linhas da Revisão e do PDF); metros sempre por `formatMeters`. Talento é `speedBonus` (incondicional). Bônus que depende do equipamento é `equipmentSpeedBonus` (degraus pelo nível na classe dona + `requires`: Movimento Rápido sem armadura pesada, Movimento sem Armadura sem armadura nem escudo): a ficha sabe o que está equipado (o mesmo `getEquippedArmor` da CA), então **entra no número quando a condição é cumprida** e vira linha — somada ou não, com o motivo. A armadura vestida sem a Força da tabela (`strengthRequirement`) tira 3 m (p. 146) — por isso as duas funções recebem os **atributos finais**, como a CA —, e o traço que anula a redução é efeito racial (`heavyArmorSpeedUnreduced`, o Deslocamento do anão, p. 20): o número fica intacto e a linha diz que foi ignorada.
  - **Traços raciais** listados lado a lado (etapa Raça, Revisão, PDF) não repetem nome entre raça e sub-raça (teste de dados); a key das listas é posição + nome.
  - **Compras do método riqueza** só valem com o método riqueza ativo (p. 145: equipamento inicial OU compra): toda leitura passa por `getActivePurchases` (equipmentUtils) — CA, deslocamento, Artes Marciais, avisos de proficiência, ataques, inventário e dinheiro. Trocar de método não apaga o carrinho; fora da própria loja (EquipmentStep), nunca ler `equipment.purchasedItems` direto.
  - **Linhas de ataque** saem só de `getSheetAttacks` (`utils/attackUtils.ts`: uma linha por arma carregada + o golpe desarmado, que toda ficha tem, p. 196), e a conta de cada linha é `getWeaponAttack` / `getUnarmedStrike` (`utils/weaponFormat.ts`). O que as características fazem nelas é efeito: `weaponAttacks` (Estilo de Luta em `FIGHTING_STYLES`, Golpes de Chi) com escopo de arma — `attackBonus` é incondicional e entra no número (Arquearia), `note` é condicional e vira nota na arma (Duelismo, Armas Grandes); `martialArts` (dado no recurso da mesma feature, `requires` de equipamento como o deslocamento: entra no número das armas de monge e do golpe desarmado quando cumprida); `unarmedDamageDie` (Especialista em Briga). Dano fixo (golpe desarmado, zarabatana) sai resolvido ("3", não "1+2"). A nota da regra-base do ataque da outra mão (p. 196) só aparece com duas armas leves corpo a corpo carregadas (`carriesTwoLightMeleeWeapons`, contando quantidade); a do Estilo Combate com Duas Armas, sempre. Versátil é segundo valor no dano (`formatAttackDamage`). Estilo de Luta possuído (inclusive o Adicional do campeão) vem de `getOwnedFightingStyleIds`.

  - **Recursos** (usos, poços, dados que crescem: Fúria, Chi, Inspiração de Bardo, Cura pelas Mãos, Sortudo, Arma de Sopro) também são efeito: `effects.resources` na feature de classe/subclasse, no talento (`feats.json`) ou no traço racial (`races.json`), calculados por `getSheetResources` — feature de classe no nível NA classe dona; raça e talento no nível de personagem — com os atributos finais. Cada recurso leva a origem (`source`), e a ficha mostra um bloco por origem. Mesmo `id` de duas fontes não soma (vale o maior, p. 166), salvo `addsToExisting` (o dado a mais do Adepto Marcial). A conta e o texto (`describeResource` / `formatResourceLine`) moram em `utils/classResourceUtils.ts` — a Revisão e o PDF leem de lá.

Ao adicionar uma característica nova, prefira declará-la como efeito nos dados a espalhar `if` pela UI.

**Texto das características de classe** mora só em `class-progression-features.json` (classes.json não tem mais cópia; etapa Classe, Revisão e ficha leem via `classUtils`). É texto de mesa, não resumo de card: alvo, alcance, ação/reação, momento, duração, término, imunidade e recarga, conferidos com o livro. Valor que escala e já é recurso calculado aponta para "Recursos", nunca número fixo.

**Conjuração** (`utils/spellUtils.ts`) vem da classe ou, quando a classe não conjura, da subclasse: o Cavaleiro Arcano e o Trapaceiro Arcano têm `spellcasting` próprio em `classes.json` (lista de mago, `schoolRestriction`, `requiredCantrips`), e as tabelas de truques e magias conhecidas ficam em `progression.json` pelo id da subclasse (espaços na tabela `third`). Nunca ler `cls.spellcasting` direto: `getSpellcastingSource` (classUtils) / `getEntrySpellcasting` resolvem quem conjura, e `getCasterEntries` é a lista que a etapa Magias, a Revisão e o PDF usam. Truque dado pela característica (mãos mágicas) é derivado, não gravado no draft. O tipo de conjurador vem do `casterProgression` de `classes.json`; o pool da multiclasse usa `getCombinedCasterLevel` (p. 166-167).

**Magia escolhida em slot de progressão que ocupa vaga da tabela** declara `countsAsKnownSpell` no slot (`progression-choices.json`): os Segredos Mágicos do bardo "já estão incluídos" nas Magias Conhecidas (p. 54) — Segredo truque ocupa vaga de Truques Conhecidos (decisão do usuário, 2026-10-25); os Adicionais do Conhecimento (p. 55) não têm o campo e vêm por cima. O quanto a etapa pede sai de `getCantripColumn` / `getSpellColumn` (total, ocupadas pelos Segredos, a escolher), e os avisos de excesso de `getSpellChoiceOverflows` — a etapa Magias, a Revisão e o PDF leem daí; `isSpellStepComplete` recebe as `progressionChoices`. O seletor de Segredos oferece só truque ou magia de nível que a classe conjura (`getSecretSpellOptions`).

- **Atributo de conjuração é sempre o final** (`getFinalAbilityScores`: raça + aprimoramentos), na etapa Magias, na Revisão e no PDF — nunca `draft.abilityScores`. Magias escolhidas acima do teto (atributo baixado depois) não são apagadas: `getSpellChoiceOverflow` vira aviso nas três telas.
- **Segredos Mágicos** (bardo 10/14/18, Colégio do Conhecimento 6) são escolhas de progressão (`SPELL_OPTIONS_LIST_ID`), mas são magias da classe: saem em `bonusSpells` de `getCasterEntries` e aparecem com as magias do bardo. As **Escolhas de Progressão** da Revisão e do PDF vêm de `getProgressionChoiceBlocks` (`progressionOptions.ts`), que deixa esses slots de fora.

## Versão de D&D

- **D&D 5e clássico — PHB de 2014**
- Não misturar regras do PHB 2024 / "One D&D" sem confirmação explícita do usuário
- Suplementos (Xanathar, Tasha, etc.) ficam fora do escopo até decisão explícita

## Escopo da V1

- Fichas de **nível 1 a 20**, com **multiclasse no D&D 5e** (PHB 2014, cap. 6; ver `docs/regras-multiclasse.md`)
- Pontos de vida por dois métodos: **média** (`average`) ou **rolagem** (`roll`) dos dados de vida acima do nível 1
- Raças e classes do livro básico (PHB 2014)
- Sistema de magias (truques e magias por nível, slots, CD e bônus de ataque derivados do nível)
- Fluxo de criação completo (9 passos):
  1. Nome (e nível)
  2. Raça
  3. Classe
  4. Atributos
  5. Aprimoramentos (ASI/talentos; apenas para níveis com espaço de ASI, ou Humano Variante)
  6. Magias (apenas para conjuradores; após Atributos/Aprimoramentos para o jogador já conhecer os modificadores finais)
  7. Antecedente
  8. Equipamento
  9. Revisão
- Salvar/carregar localmente
- Exportar/importar ficha como JSON (portabilidade entre dispositivos)

**Fora do escopo da V1:** evolução de personagem em sessão (level up dinâmico / XP), suplementos, raças/classes homebrew. (Multiclasse **entrou** no escopo em 2026-07-14, para o D&D 5e.)

## Convenções de Código

- Commits pequenos e atômicos
- Código (variáveis, funções, tipos, nomes de arquivo) em **inglês**

## Idioma

- **Código:** inglês
- **Mensagens de commit, comentários e docs:** português
- **Interface do app:** português

## Persistência

- Toda leitura/escrita de ficha passa pela camada de storage **do próprio sistema**: `src/systems/<sistema>/utils/storage.ts` (hoje `dnd5e` e `ordem`). O núcleo (`src/core`) e a galeria global (`src/GlobalGallery.tsx`) não acessam localStorage: usam as funções exportadas por essas camadas
- No `storage.ts` do dnd5e ficam a sessão do wizard (versionada por `SESSION_VERSION`) e a biblioteca; campo novo no draft ganha default em `withDraftDefaults` (e sanitização em `utils/draftValidation.ts`)
- A V1 implementa essas camadas usando localStorage
- Componentes e stores **nunca** acessam localStorage diretamente
- Isso permite migrar para IndexedDB no futuro sem refatorar a aplicação

## Fontes da Verdade

- **Conceitual:** o livro PHB 2014 (referência humana, fora do projeto)
- **Documental:** arquivos em `/docs` (regras digitalizadas em markdown, referência intermediária)
- **Operacional:** JSONs em `/src/data` (consumidos pela aplicação em runtime)

Em caso de divergência, voltar à fonte conceitual (o livro).

## Testes

- Cobertura **obrigatória** para:
  - Cálculos de modificadores de atributo
  - Bônus de proficiência
  - Fórmulas de derivação (pontos de vida iniciais, CA base, CD de magia)
  - Funções de validação de regras (ex: pré-requisitos, limites)
- Cobertura **recomendada** para utilitários puros em geral
- Componentes de UI: testar comportamento crítico (ex: fluxo de seleção), não cobertura exaustiva

## Workflow do Claude Code

1. **Sempre propor um plano antes de implementar** — aguardar aprovação do usuário
2. **Nunca chutar regras de D&D** — perguntar ao usuário se houver dúvida sobre uma regra; consultar `/docs` quando o trecho relevante já tiver sido digitalizado
3. **Commitar a cada feature concluída** — commits atômicos com mensagem em português
4. **Atualizar este CLAUDE.md** quando novas decisões arquiteturais surgirem, em commit dedicado com prefixo `docs:`

## Definição de Pronto (Definition of Done)

Uma feature está pronta quando:

- Implementação concluída
- Tipos TypeScript corretos e estritos
- Testes escritos (quando aplicável conforme seção "Testes")
- Funciona localmente sem erros no console
- Commit feito com mensagem clara em português
