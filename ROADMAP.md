# Roadmap de Execução — Projeto Completo (PHB 2014)

> Criado: 2026-07-07 · Baseado na auditoria completa do código (fluxo/UI, dados, lógica/testes)
> Objetivo: fechar integralmente a promessa do produto — criação de fichas **níveis 1–20 fiéis ao PHB 2014** — corrigindo primeiro o que está errado no núcleo de nível 1.

## Fonte da verdade e método de trabalho

**Livro:** `C:\Users\jotap\OneDrive\DnD\livros\d&d-5e-livro-do-jogador-fundo-branco-biblioteca-c3a9lfica.pdf` (pt-BR, 314 páginas, camada de texto extraível — verificado com `pdf-parse`).

Toda regra nova ou corrigida segue o pipeline do CLAUDE.md, sem exceção:

```
Livro (PDF) → /docs/*.md (digitalização) → /src/data/*.json → tipos + utils + testes → UI
```

- A extração de texto do PDF pode ser semi-automatizada com um script Node (`pdf-parse`), no padrão do `scripts/parse-spells.mjs` já existente.
- Nenhuma regra entra no JSON "de memória" — sempre conferida no livro e registrada em `/docs` antes.
- Cada etapa termina com: `tsc` + lint + testes verdes, commit atômico em português, `PROGRESS.md` atualizado.

---

## Visão geral das fases

| Fase | Tema | Por quê nesta ordem | Esforço |
| ---- | ---- | ------------------- | ------- |
| 1 | Correções no núcleo de nível 1 | Bugs afetam o coração do produto hoje | M |
| 2 | Subclasse para as 12 classes | Maior alavancagem: o hook já existe no código | S |
| 3 | Progressão completa 1–20 (features + recursos) | O épico de dados que fecha a promessa | XL |
| 4 | ASI e Talentos | Depende do modelo por nível da fase 3 | L |
| 5 | Loja de equipamento (método riqueza) | Elimina o beco sem saída do ouro rolado | M |
| 6 | Biblioteca de fichas (múltiplos personagens) | Muda o modelo de persistência — melhor depois do draft estabilizar | M |
| 7 | Export PDF | Precisa da ficha completa (fases 3–5) para valer a pena | M |
| 8 | Gamificação, auditoria final e deploy | Polimento sobre produto completo | M |

---

## Fase 1 — Correções no núcleo de nível 1 ✅ CONCLUÍDA (2026-07-07)

Bugs e infidelidades ao livro que afetam qualquer personagem, inclusive nível 1. Todas as 8 etapas entregues (ver PROGRESS.md). 271 testes, build e lint verdes.

| # | Etapa | Detalhe | Referência no livro |
| - | ----- | ------- | ------------------- |
| 1.1 | Import robusto | Validação estrutural completa em `importCharacter` (tipos, nível, aninhados); merge com `EMPTY_DRAFT` como no `loadSession`; import incompleto direciona ao primeiro passo incompleto, não à Revisão; testes de `storage.ts` (hoje zero) | — |
| 1.2 | CA correta e testada | Extrair para util `calculateArmorClass`: escudo soma +2, Defesa sem Armadura (bárbaro 10+DES+CON, monge 10+DES+SAB), estilo de luta Defesa +1, cap de DES na armadura média; cobertura de testes (obrigatória por CLAUDE.md) | Cap. 5 (armaduras) e caps. de classe |
| 1.3 | Percepção passiva | `10 + mod SAB (+prof se proficiente)` — util + Revisão + teste | Cap. 7 |
| 1.4 | Cap de preparadas imposto | `SpellStep` limita seleção ao máximo (`mod + nível`, mín. 1) e exige ≥ 1 preparada para avançar; testes | Cap. 10 + classes preparadas |
| 1.5 | Perícias/ferramentas duplicadas | Estender o padrão `excludedLanguages` para perícias e ferramentas entre raça × classe × antecedente (PHB: escolhe substituta) | Cap. 4 (antecedentes) |
| 1.6 | Correções raciais | Drow: Visão no Escuro **Superior (36 m / 120 pés)**; truques raciais fixos estruturados (Drow: Globos de Luz; Tiefling: Taumaturgia); exibir truque do Alto Elfo (e demais concessões raciais) na Revisão | Cap. 2 |
| 1.7 | Magias faltantes | Digitalizar do livro as ~14 magias ausentes (incluindo **Zombaria Viciante**) → 361; corrigir os 11 blocos duplicados ("T") em `docs/magias/regras-magias.md`; re-rodar `parse-spells` | Cap. 11 |
| 1.8 | Higiene | Remover conteúdo não-PHB (subclasse Rastreador Subterrâneo; 2 conjuntos de jogo extras); `nextStep()` valida no store (não só no botão); contador da aba de magias de 1º nível; badge "conjurador" sensível ao nível | — |

**Pronto quando:** criação de nível 1 é 100% fiel ao livro, nenhum JSON importado derruba o app, CA/percepção passiva corretas e testadas.

---

## Fase 2 — Subclasse para as 12 classes ✅ NÚCLEO CONCLUÍDO (2026-07-07)

A validação `isClassStepComplete(cls, choices, currentLevel)` já aceita nível — só não era usada.

| # | Etapa | Detalhe | Status |
| - | ----- | ------- | ------ |
| 2.1 | Ativar seleção por nível | Passar `draft.level` ao `isClassStepComplete`; `ClassChoicePanel` renderiza o seletor quando `subclassLevel <= level` (todas as classes) | ✅ |
| 2.2 | Features de entrada das 29 subclasses vazias | Digitalizadas do PHB; `scripts/fill-subclass-features.mjs` | ✅ |
| 2.3 | Escolhas embutidas na entrada da subclasse | Totem, manobras, disciplinas, terreno, Presa do Caçador — **movido para a Fase 3** (mesma infraestrutura de "escolher N de uma lista" das escolhas de progressão) | ↪ Fase 3 |

**Pronto quando:** qualquer classe criada em nível ≥ `subclassLevel` escolhe subclasse (obrigatória) e recebe as features de entrada. ✅ (as sub-escolhas viram seletores na Fase 3)

---

## Fase 3 — Progressão completa 1–20 (o épico de dados) — ✅ CONCLUÍDA (2026-07-08)

O maior bloco de trabalho. Núcleo (recursos + features das 12 classes), features de subclasse por nível (3.5a) e seletores de escolhas de progressão (3.5b) concluídos.

| # | Etapa | Detalhe | Status |
| - | ----- | ------- | ------ |
| 3.1 | Modelo de dados por nível | `LevelFeature`/`featuresByLevel`; `progression.json` com `classResources` (fúrias, ki, ataque furtivo, inspiração, pontos de feitiçaria, invocações, canalizar divindade, forma selvagem); `classResourceUtils`; painel de recursos na Revisão | ✅ |
| 3.2 | Lote A — marciais | Bárbaro, Guerreiro, Ladino, Monge (features de classe 1–20) | ✅ |
| 3.3 | Lote B — conjuradores plenos | Clérigo, Druida, Mago, Feiticeiro | ✅ |
| 3.4 | Lote C — híbridos | Bardo, Bruxo, Paladino, Patrulheiro | ✅ |
| 3.5a | Features por nível das **subclasses** | ✅ **Concluída (2026-07-08).** As 41 subclasses das 12 classes têm features por nível completas em `class-progression-features.json`, digitalizadas do PDF (delegado a agentes por classe, conferido: JSON válido, todas as subclasses de `classes.json` presentes, build/lint/347 testes verdes, spot-check manual contra o livro sem divergência). | ✅ |
| 3.5b | Escolhas de progressão como **seletores reais** | ✅ **Concluída (2026-07-08).** `progression-choices.json` + 10 arquivos de listas de opções (manobras, invocações, metamágica, disciplinas, totens, terrenos, presa do caçador etc.), `progressionChoiceUtils` (com testes), painel `ProgressionChoicesPanel` e seção na Revisão. Desenho da arquitetura + delegação da implementação; revisado (build/lint/354 testes verdes, fidelidade das listas conferida contra o PHB). | ✅ |
| 3.6 | Revisão por nível | Features de classe agrupadas por nível ✅; painel de recursos ✅; features de subclasse de nível alto agora disponíveis nos dados (3.5a concluída) — falta só confirmar que a Revisão já exibe todas corretamente. | ✅ (quase completa) |

**Pronto quando:** um personagem de nível N exibe exatamente as features/recursos que o livro dá até o nível N, com as escolhas de progressão feitas pelo jogador.

### 📌 Detalhamento do que falta na Fase 3 (para não esquecer)

**3.5a — ✅ CONCLUÍDA (2026-07-08).** Ficou registrado abaixo como referência (ids/níveis por classe), mas os dados já estão todos em `class-progression-features.json`.

<details>
<summary>Registro histórico da tarefa 3.5a (já concluída)</summary>

**3.5a — features por nível das 39 subclasses restantes** (trabalho mecânico, padrão já provado):

- Onde: preencher o objeto `subclasses` de `src/data/class-progression-features.json`, keyed por `subclassId` → `LevelFeature[]` (mesmo formato do bárbaro, já lá).
- O helper `getClassFeaturesUpToLevel` (em `classUtils.ts`) já lê esse objeto e exibe na Revisão; hoje as subclasses sem entrada nele mostram só a feature de ENTRADA (fallback). Não precisa mexer em código, só em dados.
- Faltam (níveis de features conforme o livro):
  - Guerreiro: Campeão, Mestre de Batalha, Cavaleiro Arcano (features em 3/7/10/15/18)
  - Ladino: Ladrão, Assassino, Trapaceiro Arcano (3/9/13/17)
  - Monge: Mão Aberta, Sombra, Quatro Elementos (3/6/11/17)
  - Bardo: Conhecimento, Bravura (3/6/14)
  - Druida: Terra, Lua (2/6/10/14)
  - Clérigo: 7 domínios (1/2/6/8/17) — o maior lote
  - Feiticeiro: Dracônica, Selvagem (1/6/14/18)
  - Bruxo: Arquifada, Corruptor, Grande Antigo (1/6/10/14)
  - Mago: 8 escolas (2/6/10/14)
  - Paladino: Devoção, Anciões, Vingança (3/7/15/20; obs.: entrada 3 já tem magias de juramento + canalizar divindade)
  - Patrulheiro: Besta, Caçador, Rastreador Subterrâneo (3/7/11/15)
- Fonte: o PDF do livro (ver [[phb-2014-pdf]] na memória). Extração via `pdf-parse` (scripts de sondagem no padrão já usado). **Atenção a colisões de nome entre classes** (ex.: "Corpo Atemporal" existe no monge nv15 E no druida nv18; "Golpe Divino" é feature de domínio do clérigo, não do paladino, cujo smite é "Destruição Divina"). Sempre conferir o nível/classe no PDF.

#### 📋 Plano de execução para 3.5a (pensado para delegar — tarefa mecânica, baixo risco)

Testado em 2026-07-08 com 2 agentes reais (bardo e bruxo) — resultado limpo, sem ambiguidade, formato correto de primeira. Confirma que é trabalho de "achar no livro e transcrever formatado", não decisão de design. Segue a receita pronta para rodar com qualquer ferramenta/agente:

**1. Unidade de trabalho = 1 classe** (evita conflito de escrita concorrente se paralelizar). As 11 classes que faltam, com subclasses e níveis de feature:

| Classe (`id`) | Subclasses (`id` — nome PT) | Níveis |
| --- | --- | --- |
| `bard` ✅ feito | `college-of-lore` — Colégio do Conhecimento; `college-of-valor` — Colégio da Bravura | 3, 6, 14 |
| `warlock` ✅ feito | `the-archfey` — A Arquifada; `the-fiend` — O Corruptor; `the-great-old-one` — O Grande Antigo | 1, 6, 10, 14 |
| `cleric` | `knowledge-domain`, `trickery-domain`, `war-domain`, `light-domain`, `nature-domain`, `tempest-domain`, `life-domain` (Domínio do Conhecimento/Enganação/Guerra/Luz/Natureza/Tempestade/Vida) | 1, 2, 6, 8, 17 |
| `druid` | `circle-of-the-land` — Círculo da Terra; `circle-of-the-moon` — Círculo da Lua | 2, 6, 10, 14 |
| `sorcerer` | `draconic-bloodline` — Linhagem Dracônica; `wild-magic` — Magia Selvagem | 1, 6, 14, 18 |
| `fighter` | `champion` — Campeão; `battle-master` — Mestre de Batalha; `eldritch-knight` — Cavaleiro Arcano | 3, 7, 10, 15, 18 |
| `rogue` | `thief` — Ladrão; `assassin` — Assassino; `arcane-trickster` — Trapaceiro Arcano | 3, 9, 13, 17 |
| `wizard` | `abjuration`, `divination`, `conjuration`, `enchantment`, `evocation`, `illusion`, `necromancy`, `transmutation` (8 escolas) | 2, 6, 10, 14 |
| `monk` | `open-hand` — Mão Aberta; `shadow` — Sombra; `four-elements` — Quatro Elementos | 3, 6, 11, 17 |
| `paladin` | `oath-of-devotion` — Devoção; `oath-of-the-ancients` — Anciões; `oath-of-vengeance` — Vingança | 3, 7, 15, 20 |
| `ranger` | `beast-master` — Conclave da Besta; `hunter` — Conclave do Caçador; `gloom-stalker` — Conclave do Rastreador Subterrâneo | 3, 7, 11, 15 |

**2. Fontes por unidade de trabalho:**
- Nível de entrada (o primeiro da lista): já digitalizado em `src/data/classes.json`, dentro do array `subclasses` de cada classe (buscar por `"id": "<subclass-id>"`). Só precisa condensar pro estilo do padrão (ver ponto 3), não precisa ir ao PDF pra esse nível.
- Níveis mais altos: texto do livro. Já foi extraído uma vez para texto puro (ver ponto 4) — buscar pelo nome da subclasse/feature em MAIÚSCULAS (é como aparece no livro) e ler o contexto ao redor.

**3. Formato/estilo de saída** — espelhar exatamente `src/data/class-progression-features.json`, chave `"subclasses"`, exemplos `"berserker"`/`"totem-warrior"` (já prontos): array de `{ "level": N, "name": "Nome em Português", "description": "1-3 frases, mecânico, sem floreio" }`.

**4. Extração do PDF** — `pdf-parse` (o que está instalado é a v2.4.5, API por classe, NÃO a v1 baseada em função):
```js
const { PDFParse } = require('pdf-parse'); // require('pdf-parse') NÃO é mais uma função
const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
const result = await parser.getText(); // result.pages = [{ num, text }, ...]
```
PDF: `C:\Users\jotap\OneDrive\DnD\livros\d&d-5e-livro-do-jogador-fundo-branco-biblioteca-c3a9lfica.pdf` (314 páginas; cuidado com o `&` no nome do arquivo — atrapalha alguns shells, copiar para um caminho sem `&` se necessário). Já existe um dump completo em texto puro (314 páginas, ~1,3M caracteres, marcadores `===== PAGINA N =====` = índice do PDF, não o número impresso no rodapé) em `C:\Users\jotap\AppData\Local\Temp\claude\C--Users-jotap-Projetos-pessoais-dnd-character-creator\503e4055-24e7-4973-8cd5-100e674f7243\scratchpad\phb-full-text.txt` — é um diretório temp de sessão, pode não sobreviver; se sumir, é só re-rodar a extração acima (leva ~1-2 min).

**5. Saída de cada unidade** — um fragmento JSON isolado por classe (ex.: `subclass-cleric.json`), não editar `class-progression-features.json` diretamente — evita conflito se rodar em paralelo. Já prontos (2026-07-08, revisados, sem ambiguidade reportada):
- `subclass-bard.json` e `subclass-warlock.json` no scratchpad acima.

**6. Depois de ter os fragmentos:** mesclar na chave `"subclasses"` de `class-progression-features.json`, validar JSON, rodar `npm run build`, `npm run lint`, `npm test`, atualizar ROADMAP/PROGRESS (marcar 3.5a ✅) e commitar.

**Execução real:** as 9 classes restantes (clérigo, druida, feiticeiro, guerreiro, ladino, mago, monge, paladino, patrulheiro) foram feitas por outra ferramenta de agentes em paralelo, um por classe, e mescladas direto em `class-progression-features.json` (commit `feat(data): adiciona habilidades de subclasse extraídas do phb para todas as 9 classes restantes`). Bardo e bruxo tinham sido testados antes nesta sessão mas ficaram só como fragmentos no scratchpad — a outra ferramenta relatou (incorretamente) que já estavam mesclados; a auditoria estrutural pegou a divergência e os dois foram mesclados manualmente depois. Validado: todas as 41 subclasses de `classes.json` presentes em `class-progression-features.json`, JSON válido, `npm run build`/`lint`/`test` (347 testes) verdes, e spot-check manual de 5 subclasses (incluindo Mestre de Batalha, cujo upgrade de dado de superioridade pra d10/d12 nos níveis 10/18 foi confirmado linha a linha no PDF) sem nenhuma divergência.

</details>

**3.5b — escolhas de progressão como seletores reais** (mini-projeto: modelo + dados + UI):

- Hoje essas escolhas aparecem só como TEXTO na descrição da feature. Falta torná-las seletores que gravam a escolha do jogador (a visão do produto pede "controle total das escolhas").
- Inclui as escolhas de ENTRADA de subclasse (ex-etapa 2.3): totem do bárbaro (Águia/Lobo/Urso), manobras iniciais do Mestre de Batalha, disciplinas do monge Quatro Elementos, terreno do druida da Terra, opção de Presa do Caçador do patrulheiro.
- E as escolhas de nível alto: invocações místicas do bruxo (lista ~30), metamagia do feiticeiro (~8 opções), manobras adicionais do Mestre de Batalha (lista de 16), expertise adicional (ladino nv6 / bardo nv3 e 10), segredos mágicos do bardo, estilo de luta extra.
- Trabalho: (1) digitar as listas de opções do livro (manobras, invocações, metamagia) em `src/data/`; (2) estender o modelo de escolhas (algo como `progressionChoices` no draft, ou ampliar `SubclassChoiceSelections`); (3) UI de "Escolhas de progressão" (provavelmente no passo Classe ou num painel dedicado), gerada por nível ≤ nível do personagem; (4) validação e exibição na Revisão.
- Escopo comparável ao de ASI/Talentos (Fase 4).

#### 📋 Desenho da arquitetura para 3.5b (2026-07-08 — pronto pra delegar a implementação inteira)

Diferente da 3.5a (dado uniforme), aqui o formato varia por tipo de escolha. Decisão: reaproveitar o padrão já provado de `asiUtils.ts`/`ImprovementsStep.tsx` (slot por nível alcançado, validação por completude), generalizado o bastante pra cobrir todos os casos — em vez de inventar um mecanismo novo por tipo de escolha.

**Modelo de dados:**
- `ClassChoiceSelections` (em `src/types/class.ts`) ganha um campo novo: `progressionChoices: Record<string, string[]>` — chave = id do slot, valor = ids das opções escolhidas. Atualizar `EMPTY_CLASS_CHOICES` e `EMPTY_DRAFT.classChoices` (em `character.ts`) e `emptyClassChoices()`/`sanitizeClassChoices()` (em `draftValidation.ts`, seguindo o padrão de `subclassExtras` ali do lado).
- Novo arquivo `src/data/progression-choices.json`: mapa de `classId` OU `subclassId` (mesmo namespace, ids já são únicos no projeto) → array de slots `{ id, level, count, cumulative, optionsListId, label }`. `cumulative: true` = escolhas de níveis anteriores continuam válidas (manobras, invocações, metamagia, disciplinas); `cumulative: false` = escolha única e substituível (totem, terreno, presa do caçador).
- Um arquivo de dados por lista de opções, cada opção `{ id, name, description }` (+ `prerequisite?: string` pra invocações): `battle-master-maneuvers.json`, `eldritch-invocations.json`, `metamagic-options.json`, `four-elements-disciplines.json`, `totem-warrior-totems.json`, `land-circle-terrains.json`, `hunters-prey.json`, `hunter-defensive-tactics.json`, `hunter-multiattack.json`, `hunter-superior-defense.json`. Exceção: Segredos Mágicos do bardo usa `optionsListId: "any-known-spell"` (sentinela) — resolve dinamicamente contra `spells.json` em vez de um arquivo novo.

**Tabela de slots conhecida** (ponto de partida — a outra ferramenta deve **confirmar cada nível/contagem no livro**, não copiar cegamente; se o livro divergir daqui, vale o livro):

| Classe/subclasse | Slot | Nível | Qtd | Cumulativo | Lista |
|---|---|---|---|---|---|
| `battle-master` | maneuvers | 3 / 7 / 10 / 15 | 3 / 2 / 2 / 2 | sim | battle-master-maneuvers (16 manobras — texto completo já extraído do PDF, ver prompt de delegação) |
| `warlock` (qualquer padrinho) | invocations | 2 / 5 / 7 / 9 / 12 / 15 / 18 | 2 / 1 / 1 / 1 / 1 / 1 / 1 | sim | eldritch-invocations (~30; algumas têm pré-requisito de nível/pacto — incluir como texto informativo, não travar seleção nesta fase) |
| `sorcerer` | metamagic | 3 / 10 / 17 | 2 / 1 / 1 | sim | metamagic-options (~8) |
| `four-elements` | disciplines | 3 / 6 / 11 / 17 | conferir no livro | sim | four-elements-disciplines |
| `totem-warrior` | totem | 3 | 1 | **não** (escolha única; níveis 6/14 só revelam o texto do MESMO totem, sem nova UI de escolha) | totem-warrior-totems (Águia/Lobo/Urso) |
| `circle-of-the-land` | terrain | 2 | 1 | não | land-circle-terrains (7 terrenos; cada um concede magias de círculo — **não** precisa integrar com o sistema de magias, só registrar a escolha e listar as magias concedidas como texto na Revisão, mesma simplificação já adotada pra descrições de magia) |
| `hunter` | hunters-prey / defensive-tactics / multiattack / superior-defense | 3 / 7 / 11 / 15 | 1 cada | não | 4 listas pequenas (3, 3, 2, 3 opções) |
| `college-of-lore` | magical-secrets | 6 / 14 | 2 / 2 | sim | `any-known-spell` (resolve contra `spells.json`, não é lista nova) |
| `bard` (classe base, não subclasse — conferir se já não é coberto por 3.2-3.4) | magical-secrets-base | 10 / 14 | 2 / 2 | sim | `any-known-spell` |
| `champion` | fighting-style-extra | 10 | 1 | sim (soma ao estilo já escolhido) | reaproveita `FIGHTING_STYLES` de `classUtils.ts`, excluindo o já escolhido |

**Fora desse mecanismo genérico (resolver como ajuste pontual, não como slot novo):** expertise adicional de ladino (nv6) e bardo (nv3/10) — já existe campo `expertiseItems` e painel de UI em `ClassChoicePanel.tsx`; só falta tornar `hasExpertise` sensível a múltiplos níveis (ex.: `expertiseLevels: number[]` por classe) em vez da contagem fixa de 2 hoje.

**Pontos de integração no código (para a outra ferramenta seguir sem inventar):**
1. `src/utils/progressionChoiceUtils.ts` (novo) — espelhar `asiUtils.ts`: `getReachedProgressionSlots(classId, subclassId, level)`, `isProgressionChoicesComplete(...)`. Testes obrigatórios (`__tests__/progressionChoiceUtils.test.ts`), como manda o CLAUDE.md.
2. `src/utils/classUtils.ts`, função `isClassStepComplete` (linha ~197) — adicionar a validação dos slots alcançados, no mesmo bloco onde já valida `subclassExtras`.
3. `src/components/class/ClassChoicePanel.tsx` — novo componente `ProgressionChoicesPanel` (mesmo estilo de `SubclassExtrasPanel`, que já mora nesse arquivo), renderizado depois dela.
4. `src/components/steps/ReviewStep.tsx` — nova seção "Escolhas de Progressão" logo depois de "Habilidades de Classe" (linha ~593), listando as opções escolhidas por slot.
5. `src/utils/draftValidation.ts` — `sanitizeClassChoices`/`emptyClassChoices` (linhas ~42 e ~78) precisam do novo campo pro import de ficha não quebrar.

Ver prompt de delegação completo na conversa de 2026-07-08 (não duplicado aqui pra não desatualizar) — cobre o texto das 16 manobras já extraído do livro, as instruções de onde buscar cada lista restante no `phb-full-text.txt`, e os requisitos de build/lint/test antes de finalizar.

**Execução real (2026-07-08):** implementação delegada; a auditoria pós-entrega encontrou e corrigiu: (1) build quebrado por import não usado (`ProgressionOption`) — a ferramenta relatou verde incorretamente; (2) `any` reprovado pelo lint em `progressionOptions.ts`; (3) **bug de robustez**: `withDraftDefaults` (storage) fazia merge raso e deixava `classChoices.progressionChoices` undefined em fichas salvas antes desta fase → travaria a Revisão/validação; corrigido re-preenchendo `classChoices` com os defaults; (4) código morto (bloco de comentários de raciocínio no painel) removido; (5) Estilo de Luta Adicional do Campeão agora exclui o estilo já escolhido; (6) resíduo `scratch_find.py` removido. Fidelidade das listas conferida contra o PHB: metamágica (8), disciplinas dos 4 elementos (17), invocações (32), terrenos (8), manobras (16) — todas batem. Limitações conhecidas deixadas para depois: invocações não validam pré-requisitos (combinado nesta fase); expertise adicional de ladino nv6 / bardo nv3-10 continua fixa em 2 (ajuste pontual não feito, não é regressão).

---

## Fase 4 — ASI e Talentos ✅ CONCLUÍDA (2026-07-08)

Passo "Aprimoramentos" no wizard: por espaço de ASI, +2 num atributo, +1 em dois, ou um talento (42 do PHB, meio-talentos com +1). Talento do Humano Variante como seletor real. Tudo refletido nos atributos finais (teto 20) e na ficha.

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 4.1 | Dados de talentos | Digitalizar cap. 6 (~42 talentos) → `docs/regras-talentos.md` → `feats.json` + tipos |
| 4.2 | Novo passo "Aprimoramentos" | Entre **Atributos** e **Magias** (ASI muda modificadores → afeta magias preparadas e CD). Para cada nível de ASI ≤ nível do personagem (4/8/12/16/19 + extras de guerreiro 6/14 e ladino 10): escolher **+2**, **+1/+1** ou **talento**; teto 20 por atributo |
| 4.3 | Humano Variante | Seleção real de talento (substitui o campo de texto livre) |
| 4.4 | Efeitos estruturados | Talentos com efeito mecânico direto aplicados à ficha (+1 atributo, Resistente, Vigilante +5 iniciativa, Duro +2 PV/nível, perícias); talentos situacionais ficam como texto na ficha |
| 4.5 | Revisão | Talentos exibidos com seus efeitos; atributos finais = base + racial + ASI + talento |

**Pronto quando:** personagem de nível 20 sai com atributos e talentos corretos pelo livro. O passo não aparece para nível < 4 sem Humano Variante.

---

## Fase 5 — Loja de equipamento (método riqueza) — 🔄 NÚCLEO PRONTO

| # | Etapa | Detalhe | Status |
| - | ----- | ------- | ------ |
| 5.1 | Dados que faltam do cap. 5 | Montarias e veículos, selas/arreios; bens comerciais; tabela de bugigangas (d100) — ainda não no `/data`. Baixo impacto. | ⬜ |
| 5.2 | Loja | `getShopCatalog` + componente Shop no passo Equipamento: filtro por categoria, busca, carrinho (+/−), saldo restante ao vivo, bloqueio sem saldo. | ✅ |
| 5.3 | Ficha considera compras | CA detecta armadura/escudo comprados (getEquippedArmor); Revisão lista itens comprados + saldo restante. | ✅ |

**Pronto quando:** o jogador que rola ouro monta o equipamento inteiro dentro do app, sem ser mandado de volta ao livro. ✅ (com o catálogo atual; falta só 5.1 — itens extras)

---

## Fase 6 — Biblioteca de fichas ✅ CONCLUÍDA (2026-07-08)

| # | Etapa | Detalhe | Status |
| - | ----- | ------- | ------ |
| 6.1 | Camada de biblioteca em `storage.ts` | Lista de fichas versionada em localStorage; migração automática da sessão única legada. | ✅ |
| 6.2 | Tela inicial (galeria) | Criar, abrir, duplicar, excluir (com confirmação), exportar, importar; estado vazio. | ✅ |
| 6.3 | Re-edição guiada | `openCharacter` reabre a ficha no passo em que parou; validações reavaliadas pelo wizard. | ✅ |

**Pronto quando:** criar um segundo personagem não apaga o primeiro; qualquer ficha pode ser reaberta e editada. ✅

---

## Fase 7 — Export PDF ✅ CONCLUÍDA (2026-07-08)

Decisão de formato: ficha **própria** (não a oficial da WotC), em português, com tudo que o jogador usa na mesa. Ver [[pdf-export-formato]] na memória.

| # | Etapa | Detalhe | Status |
| - | ----- | ------- | ------ |
| 7.1 | Ficha imprimível | `PrintableSheet` (documento claro) + view 'print' + CSS `@media print`; botão "Imprimir / Salvar como PDF" na Revisão. Zero dependências. Conteúdo: identidade, atributos, combate, resistências, 18 perícias, ataques, magias, recursos, proficiências/idiomas, magias raciais, traços, features por nível, talentos, inventário. | ✅ |
| 7.2 | (Opcional) PDF nativo / folha oficial | `pdf-lib` — plano B, só se a versão imprimível não bastar. | ⬜ (não necessário) |

---

## Fase 8 — Gamificação, auditoria final e deploy

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 8.1 | Gamificação | Glossário ampliado (hoje 10 termos), medidor de completude da ficha, notas "para iniciantes" visíveis nos cards de classe, bugiganga aleatória na criação (momento divertido) |
| 8.2 | Auditoria final contra o livro | Checklist por capítulo (raças, classes, equipamento, magias, talentos) conferindo dados × livro |
| 8.3 | Deploy estático | Vercel/Netlify + smoke test do fluxo completo |

---

## Decisões a registrar no CLAUDE.md quando as fases começarem

- Escopo ampliado: ASI/talentos e features por nível **entram** no escopo (revoga "fora do escopo" parcial da V1).
- Novo passo "Aprimoramentos" no wizard (9 passos).
- Modelo `featuresByLevel` e recursos de classe em `progression.json`.
- Biblioteca de fichas: localStorage versionado; critério de migração para IndexedDB.

---

## 📌 Backlog de Polimentos e Melhorias (Icebox)

Pequenos detalhes, abstrações ou ideias de melhoria contínua identificados durante o desenvolvimento que não formam uma "Fase" principal do roadmap, mas ficam registrados como sugestões para evoluções futuras:

- **Exportação de PDF — Detalhamento de Armas:** Pode ser interessante adicionar uma tabela individual para cada arma equipada, unindo a fórmula global de acerto com o dado de dano específico da arma (já disponível em `weapons.json`), facilitando a visualização rápida durante o combate.
- **Exportação de PDF — Página de Magias (Grimório):** Como o banco de dados já possui a descrição completa de todas as magias (`spells.json`), uma excelente melhoria seria gerar uma segunda página (anexo) no PDF dedicada exclusivamente a imprimir os textos completos das magias conhecidas do personagem.
- **Exportação de PDF — Traços de Antecedente:** A ficha atualmente resolve com precisão matemática as proficiências e equipamentos dos antecedentes. Seria uma boa adição considerar imprimir também a "habilidade narrativa" de cada antecedente (ex: "Contato Criminal" do Criminoso) na seção de Traços.
- **Exportação de PDF — Espaços de Controle de Sessão (Tracking):** Pode ser muito útil incluir na interface do PDF espaços "em branco" visuais (caixas ou linhas) projetados para o jogador marcar e apagar com lápis na mesa. Exemplos: áreas explícitas para HP Atual, HP Temporário, bolinhas de Testes contra a Morte, e *checkboxes* para marcar os usos gastos de slots de magia e recursos de classe (como Fúria ou Ki).
