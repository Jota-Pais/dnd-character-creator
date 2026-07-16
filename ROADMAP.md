# Roadmap de Execução — Projeto Completo (PHB 2014)

> Criado: 2026-07-07 · Baseado na auditoria completa do código (fluxo/UI, dados, lógica/testes)
> Objetivo: fechar integralmente a promessa do produto — criação de fichas **níveis 1–20 fiéis ao PHB 2014** — corrigindo primeiro o que está errado no núcleo de nível 1.
>
> **Status (2026-07-13): roadmap de build 100% concluído** — Fases 1–16 (D&D 5e + Ordem Paranormal). Desde 2026-07-09 o projeto está em **fase de playtest**: ver `docs/playtest-feedback.md` (tracker item a item) e `PROGRESS.md` (resumo consolidado, seção "Fase de Playtest"). Este arquivo permanece como registro histórico de como cada fase foi decidida e executada — não é mais atualizado fase a fase.
>
> **2026-07-14:** implementada a **multiclasse do D&D 5e** (fora do escopo original da V1) — regras em `docs/regras-multiclasse.md`, detalhe em `PROGRESS.md` ("Multiclasse D&D 5e").

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

## Fase 5 — Loja de equipamento (método riqueza) — ✅ CONCLUÍDA (2026-07-08)

| # | Etapa | Detalhe | Status |
| - | ----- | ------- | ------ |
| 5.1 | Dados que faltam do cap. 5 | ✅ **Concluída (2026-07-08).** `mounts-vehicles.json` (26 itens: 8 montarias, 8 arreios/selas, 10 veículos) na loja sob nova categoria "Montarias"; `trinkets.json` (100 bugigangas d100, só dados — sorteio fica pra Fase 8). Bens comerciais/escambo: **fora** por decisão de produto (preços de commodity, não mercadoria de criação). Delegado e revisado: build/lint/354 testes verdes; preços/nomes conferidos linha a linha contra a tabela do PHB pt-BR (a edição pt-BR tem só 4 veículos terrestres — sem o "Wagon 35po" do PHB inglês; barding fica fora por ser preço ×4, não fixo). | ✅ |
| 5.2 | Loja | `getShopCatalog` + componente Shop no passo Equipamento: filtro por categoria, busca, carrinho (+/−), saldo restante ao vivo, bloqueio sem saldo. | ✅ |
| 5.3 | Ficha considera compras | CA detecta armadura/escudo comprados (getEquippedArmor); Revisão lista itens comprados + saldo restante. | ✅ |

**Pronto quando:** o jogador que rola ouro monta o equipamento inteiro dentro do app, sem ser mandado de volta ao livro. ✅

#### 📋 Desenho da 5.1 (2026-07-08 — pronto pra delegar)

Decisões de escopo (o item original listava três coisas; nem todas viram mercadoria):
- **Montarias e veículos → ENTRAM na loja.** Novo `src/data/mounts-vehicles.json` (montarias: cavalo de montaria/tração/guerra, pônei, mula, camelo, mastim, elefante; equipamento de montaria: selas de montaria/militar/exótica/carga, freio e rédea, alforje, ração animal, estábulo; veículos terrestres e aquáticos), cada item com `id`, `name`, `subcategory` (`mount`/`tack`/`vehicle`), `cost` (em **cobre**, canônico), `weight` (kg, `null` quando o PHB não dá). Integrar como nova `ShopCategory` **'Montarias'**: estender o tipo em `equipmentUtils.ts` (~linha 102), incluir os itens em `getShopCatalog` (~linha 112), e adicionar `'Montarias'` ao array `SHOP_CATEGORIES` de `src/components/steps/EquipmentStep.tsx` (~linha 411).
- **Bugigangas (d100) → só DADOS nesta fase.** Novo `src/data/trinkets.json` (`{ "roll": 1..100, "description": "..." }`). NÃO entram na loja (são de sabor/gratuitas). O consumo — "bugiganga aleatória na criação" — é a **Fase 8.1**; 5.1 só deixa o dado pronto.
- **Bens comerciais (trade goods) → FORA.** Decisão: são preços de commodity de referência (1 po = 1 galinha etc.), não equipamento de criação; incluir só poluiria a loja. Se um dia quiser, é referência, não mercadoria. (Reverter é trivial: adicionar um `trade-goods.json` e outra `ShopCategory`.)

Fonte: PHB pt-BR, seção "Montarias e Veículos" e "Bugigangas" do cap. 5 (texto já extraído em `phb-full-text.txt` no scratchpad — ver [[phb-2014-pdf]]). Ao final: `npm run build`/`lint`/`test` verdes; se a loja ganhar um teste do catálogo, incluir montarias. Prompt de delegação completo na conversa de 2026-07-08.

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

## Fase 8 — Auditoria final e Deploy

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 8.1 | Gamificação & Usabilidade | ⏩ **Parcialmente adiada.** "Notas para iniciantes" nos cards de raça/classe (badge "⭐ Bom para iniciantes") já existia desde 2026-06-03 — mantido aqui só por precisão histórica, item **já concluído**. Glossário ampliado, medidor de completude e sorteio de bugigangas seguem no Backlog de Polimentos. |
| 8.2 | Auditoria final contra o livro | ✅ **Concluída (2026-07-08).** Script de auditoria confirmou estatísticas exatas do PHB pt-BR: 9 raças (20 variantes), 12 classes (40 subclasses - removido "Gloom Stalker" extraído por engano), 13 antecedentes, 42 talentos, 361 magias, loja 100% PHB. Tudo verificado. |
| 8.3 | Deploy estático | 🔄 **Em andamento (2026-07-16).** Decisão: antecipar o deploy pra durante o playtest (não esperar ele fechar), pra playtesters externos deixarem de depender de rodar o app localmente. CI de lint + testes via GitHub Actions (`.github/workflows/ci.yml`) já no repo. Falta: conectar o repositório à Vercel (ação manual do usuário, feita fora do Claude Code) e rodar o smoke test do fluxo completo (dnd5e + ordem) contra a URL de produção. |

---

## Fase 9 — Arquitetura de Multi-Sistemas & Integração Ordem Paranormal

> **Fonte da verdade (Ordem Paranormal):** `C:\Users\jotap\OneDrive\DnD\livros\jamboeditora-ordem-paranormal-v10-1_6303ef296f48a_240220_145308.pdf` (pt-BR, 322 páginas, texto extraível via `pdf-parse` — verificado 2026-07-08, mesmo padrão usado no D&D). Pipeline idêntico ao do CLAUDE.md: `Livro → docs/ordem-paranormal/*.md → src/systems/ordem/data/*.json → tipos + utils + testes → UI`.
>
> **Cache do texto extraído:** `docs/_book-extracts/ordem-paranormal.txt` (322 páginas, texto puro com marcadores `===== PAGINA N =====`, ~816 KB). Gerado uma vez via `pdf-parse` (`PDFParse` API v2.4.5+, `new PDFParse({ data }).getText()`) e versionado **fora do git** (`.gitignore`) — evita re-extrair o PDF a cada sessão nova; se o arquivo sumir, é só re-rodar a extração (leva menos de 1 min). Todas as citações de regra abaixo foram conferidas neste arquivo, não de memória.

### Recorte do livro — o que entra na ficha, o que fica de fora

O livro básico do OP mistura conteúdo de **jogador** e de **mestre** no mesmo volume (diferente do D&D, que separa PHB/DMG/MM em livros distintos). Sumário conferido linha a linha no PDF:

| Capítulo | Conteúdo | Entra na V1? |
| - | - | - |
| 1. Criação de Personagem | Conceito, atributos, origem, classe, perícias, toques finais | ✅ núcleo do wizard |
| 2. Perícias | 28 perícias, cada uma com atributo-base e bônus fixo por treinamento | ✅ |
| 3. Equipamento | Patente, capacidade de carga, armas, proteções, itens gerais | ✅ com ressalva — ver decisão abaixo |
| 4. Regras | Fórmulas derivadas (PV, PE, Sanidade, Defesa, iniciativa) | ✅ só o necessário pra derivar a ficha — não as regras de mesa (investigação, combate tático) |
| 5. O Outro Lado | Exposição Paranormal (NEX), Poderes Paranormais, **Rituais** | ✅ parcial — NEX, poderes e rituais (o "sistema de magia" do OP); ❌ Entidades do Outro Lado e Itens Amaldiçoados (conteúdo de mestre/tesouro, não de criação) |
| 6. O Mestre | Preparação de sessão, gerador de missões, arbitragem | ❌ fora — 100% conteúdo de mestre |
| 7. Ameaças | Bestiário completo (criaturas de Sangue/Morte/Conhecimento/Energia) | ❌ fora — equivalente ao Monster Manual |
| 8. O Mundo de Ordem Paranormal | Organizações, lore | ❌ fora — worldbuilding, não afeta a ficha |

Mesma régua já aplicada ao D&D: fichas de jogador, não conteúdo de mestre.

### Estrutura de regras do OP (leitura profunda dos Caps. 1–3 e das seções relevantes do Cap. 5 — registrada pra não regredir no meio do trabalho, e pra não desenhar o módulo "no estilo do D&D" por preguiça de reler o livro)

**Atributos e testes**
- **5 atributos** (Agilidade, Força, Intelecto, Presença, Vigor) — sem "modificador" como D&D: um teste rola **N d20 e usa o melhor** (N = valor do atributo); atributo 0 rola 2d20 e usa o **pior**. Criação: todos começam em 1, +4 pontos pra distribuir, teto inicial 3, pode zerar um atributo pra ganhar +1 ponto extra (mesmo *formato* de decisão que o point buy do D&D — cogitar reaproveitamento de UI na Fase 11, não do zero).
- Intelecto tem efeito colateral direto na ficha: concede **perícias treinadas adicionais em quantidade igual ao seu valor** (não é só "atributo-chave de Ciências/Investigação/etc.").

**Perícias (Cap. 2) — bem diferente do "proficiente ou não" do D&D**
- **28 perícias** (não é a contagem genérica do sumário — conferidas 1 a 1 na Tabela 2.1): Acrobacia, Adestramento, Artes, Atletismo, Atualidades, Ciências, Crime, Diplomacia, Enganação, Fortitude, Furtividade, Iniciativa, Intimidação, Intuição, Investigação, Luta, Medicina, Ocultismo, Percepção, Pilotagem, Pontaria, Profissão, Reflexos, Religião, Sobrevivência, Tática, Tecnologia, Vontade.
- Bônus por grau de treinamento — **fixo, não escala com nível**: Destreinado +0, Treinado +5, Veterano +10, Expert +15.
- Um subconjunto é "**só treinada**" (Adestramento, Artes, Ciências, Crime, Ocultismo, Pilotagem, Profissão, Religião, Tática, Tecnologia) — sem treinamento, a perícia **não pode ser usada de jeito nenhum** (diferente do D&D, onde qualquer perícia é testável, treinada ou não). Isso importa pro validador de "ficha completa": escolher perícias erradas pode deixar o personagem sem conseguir usar rituais (exige Ocultismo) ou pilotar (exige Pilotagem), por exemplo.
- Um subconjunto sofre "**penalidade de carga**" (Acrobacia, Crime, Furtividade) — liga direto com a capacidade de carga do Cap. 3.

**Classes, trilhas e NEX (Caps. 1 e 5)**
- **3 classes fixas** (Combatente, Especialista, Ocultista), cada uma com **5 trilhas** (= 15 trilhas, equivalente a subclasses). Cadência **igual nas 3 classes** (conferida nos exemplos de trilha de cada uma — Aniquilador/combatente, Atirador de Elite/especialista, Conduíte/ocultista): trilha escolhida em **NEX 10%**, novo poder da trilha em **NEX 40%, 65% e 99%** — 4 entregas fixas, não variável por trilha como eu tinha registrado antes (estava errado).
- Cada classe também tem um slot repetido de "**Poder de [Classe]**" — uma lista própria (Poderes de Combatente / de Especialista / de Ocultista) da qual você escolhe 1 em **NEX 15%**, outro em **NEX 30%** e mais um a cada **15 pontos de NEX** depois disso (45, 60, 75, 90...) — bem mais frequente que o ASI/talento do D&D (a cada 4-5 níveis). Tamanho exato de cada lista fica pra catalogar na Fase 13.
- Em **NEX 50%** todas as classes ganham "Versatilidade": trocar o próprio poder de classe por um da trilha alternativa, ou o 2º ponto em perícia por perícia extra (varia por classe — conferir ao digitalizar).
- **Progressão por NEX** (Nível de Exposição Paranormal), não por nível de personagem: **5% → 99%** em passos de 5% (5, 10, 15... 95) + um degrau final de 99% (não 100%) = **20 degraus**, estruturalmente paralelo aos 20 níveis do D&D. **NEX 100% não é alcançável por progressão normal** — o livro é explícito que exige um evento especial ("Desconjuração") e tem consequências narrativas graves; portanto o teto prático da progressão jogável é **99%**, não 100%. Cada degrau concede PV/PE/Sanidade (conforme Vigor/Presença) e o limite de PE gasto por turno (Tabela 1.2, 1 em NEX 5% até 20 em NEX 99%).
- **26 origens** (equivalente a antecedentes — corrigido: leitura parcial anterior tinha registrado 15; a Tabela 1.1 completa lista 26, sorteáveis por 2d20), cada uma dá 2 perícias treinadas + 1 poder de origem.

**Rituais (magia) — Cap. 5**
- Organizados por elemento (Sangue, Morte, Conhecimento, Energia, Medo — 5 elementos, não 4 como eu havia registrado) × círculo (1º ao 4º — só 4 "níveis de magia", bem mais enxuto que os 9 do D&D). Só o Ocultista conjura por padrão; limite de rituais conhecidos depende do Intelecto.

**Equipamento e Patente (Cap. 3) — sistema completamente diferente do "comprar com ouro" do D&D**
- **Patente ≠ NEX.** NEX mede poder individual do agente; Patente mede posição hierárquica *dentro da Ordem* e é ganha com **Pontos de Prestígio (PP)**, concedidos pelo mestre ao fim de cada missão (+10 resolver o caso, +2 por pista, −2/−5 por mortes) — **não existe forma de "criar" um personagem já em patente alta**; todo agente novo começa **Recruta (0 PP)**. Isso é fundamentalmente incompatível com um criador de fichas estático: Patente é um recurso de campanha, não de criação.
- O que a Patente concede: um **limite de crédito** (Baixo/Médio/Alto/Ilimitado, pra compras gerais durante uma missão) e um **limite de itens por categoria** requisitáveis a cada missão (a Ordem "empresta" equipamento, não é posse permanente): Recruta = itens de Categoria 0 ilimitados (só limitados pela carga) + até 2 de Categoria I; nada de II/III/IV. Os limites sobem com a patente (Tabela 3.1).
- **Capacidade de carga**: 5 espaços por ponto de Força (2 se Força 0); passar do limite dá sobrecarga (−5 Defesa/perícias de carga, −3m deslocamento); nunca pode passar do dobro do limite.
- O próprio livro resolve a tensão "personagem novo não tem Patente pra comprar nada" com uma saída oficial: *"Equipamento Inicial. Para acelerar o início da primeira sessão, escolha um equipamento padrão para seu personagem e anote-o em sua ficha."* — ou seja, o livro já prevê um **loadout inicial simplificado**, não o sistema de Patente completo, pra character creation.
- Armas são categorizadas por proficiência (Simples — todos sabem; Táticas — só combatentes começam sabendo; Pesadas — ninguém começa sabendo) × tipo (corpo a corpo / à distância: arremesso, disparo, fogo) × empunhadura (leve/uma mão/duas mãos), com categoria (0/I/II/III), dano, crítico, alcance, tipo de dano e espaço — tabela de complexidade parecida com a de armas do D&D, boa candidata a JSON direto.

### ⚠️ Decisão de escopo pro equipamento — REVOGADA em 2026-07-10 (ver abaixo)

~~Fechado (2026-07-08): **não seguimos a Patente completa** — a Fase 14 implementa um **loadout inicial no padrão Recruta** (Categoria 0 + até 2 de Categoria I, restrito por carga e proficiência).~~

**Revogado no playtest (2026-07-10, feedback F12):** o usuário decidiu que **Patente e Modificações são obrigatórias**. A Patente passou a ser um **parâmetro escolhível na criação** (como o NEX é o "nível" do agente): o jogador escolhe a Patente (Recruta → Agente de Elite) e ela define o **limite de itens por categoria** (Tabela 3.1). As **Modificações** (Tabelas 3.5/3.7/3.9) também entraram — cada uma sobe a categoria efetiva do item em I, consumindo os slots da Patente. Proficiência de arma virou informativa (não bloqueia — o livro permite possuir sem proficiência). Implementado em `patenteUtils`/`modificationUtils` + dados + UI (ver F12 no `docs/playtest-feedback.md`). O "limite de crédito" (compra em missão) segue fora — é uso de mesa, não de criação.

### 🔧 Achado: o status da Fase 9.1 estava incorreto — reaberta como 9.1b

A tabela antiga marcava "9.1 Refatoração de Isolamento" como ✅ concluída, mas a árvore de trabalho atual (ainda não commitada) mostra que a divisão foi só **física**: os arquivos do D&D foram movidos pra `src/systems/dnd5e/`, mas a interface `IRpgSystem` (`src/core/types/system.ts`) e o `AppStore` (`src/core/stores/appStore.ts`) são só esqueleto — nada os consome de fato. `App.tsx` decide o sistema ativo com um `if` fixo pra `'dnd5e'`; `Dnd5eApp.tsx` não implementa `IRpgSystem` — hardcoda os próprios steps, `Gallery`, `PrintableSheet` e `StepIndicator`. E `Gallery.tsx`, `PrintableSheet.tsx`, `StepIndicator.tsx` e `InfoTooltip.tsx` continuam fisicamente em `src/components/` mas importam direto de `systems/dnd5e/*` (`characterStore`, `WIZARD_STEPS`, `GLOSSARY`...) — ou seja, hoje **são** componentes do D&D, só não estão na pasta certa.

Se começarmos o módulo Ordem por cima disso, ou duplicamos ~150 linhas de "chrome" (header/footer/step indicator/alternância print) por sistema, ou fechamos a genericização primeiro. Terminar isso é **pré-requisito**, não trabalho paralelo — por isso vira fase própria abaixo, antes de qualquer linha de dado do OP.

### Visão geral das fases

| Fase | Tema | Por quê nesta ordem | Esforço |
| - | - | - | - |
| 9.1b | ✅ Fechar a genericização do core (registro de sistemas + `IRpgSystem.Component`) | Pré-requisito — sem isso, cada sistema novo duplica chrome | M |
| 10 | ✅ Ordem — fundação de dados (atributos, perícias, origens, classes) | Espelha as Fases 1–2 do D&D: dados base antes de fluxo | M |
| 11 | ✅ Ordem — fluxo de criação (passo a passo do agente) | UI do wizard sobre os dados da Fase 10 | L |
| 12 | ✅ Ordem — progressão por NEX (5%→99%: trilhas + poderes de classe + atributo/treino/versatilidade) | Equivalente à Fase 3 do D&D (o épico de dados) | XL |
| 13 | Ordem — Rituais (Poderes já saíram na Fase 12) | Equivalente a Magias do D&D | L |
| 14 | Ordem — Equipamento inicial (loadout padrão Recruta) | Escopo fechado — ver decisão acima | M |
| 15 | Ordem — ficha, revisão, export PDF, biblioteca | Reuso máximo do core (armazenamento/galeria já genéricos após 9.1b) | S–M |
| 16 | Auditoria final contra o livro + seleção de sistema no App | Paralelo à Fase 8 do D&D | S |

**Fase 9.1b — pronto quando:** um `AppShell` genérico no core renderiza qualquer `IRpgSystem` (steps, Gallery, PrintableSheet, alternância galeria/print) sem nenhuma referência a D&D; `Dnd5eApp` vira a implementação de `IRpgSystem` pro D&D; `Gallery`/`PrintableSheet`/`StepIndicator`/`InfoTooltip` migram pra dentro de `src/systems/dnd5e/` (ou a parte mecânica deles vira genérica de verdade, quando fizer sentido reaproveitar). D&D continua funcionando 100% igual — build/lint/testes verdes, refatoração invisível pro usuário.

**Fase 10 — ✅ CONCLUÍDA (2026-07-08).** `src/systems/ordem/data/*.json` tem os 5 atributos, as 28 perícias (atributo-base, só-treinada?, penalidade de carga?), as 26 origens (perícias + poder) e as 3 classes (PV/PE/SAN iniciais e por NEX, perícias, proficiências de arma/proteção) digitalizados e conferidos linha a linha contra o livro, com tipos TS estritos — zero UI ainda. Auditoria estrutural automatizada (contagens, ids duplicados, referências cruzadas perícia↔atributo e origem/classe↔perícia, cobertura contígua 2–40 da tabela de sorteio de origem) sem divergências. Digitalização curada em `docs/ordem-paranormal/*.md`.

**Fase 11 — ✅ CONCLUÍDA (2026-07-09).** Wizard de 6 passos (Nome+Conceito, Atributos, Origem, Classe, Perícias, Revisão) em `useOrdemStore` próprio, com biblioteca/storage isolados do D&D (chave de localStorage separada). `ordemSystem` implementa `IRpgSystem` de verdade — `App.tsx` já lista os dois sistemas lado a lado. Regras aplicadas: point-buy validado (soma sempre 9, no máx. 1 atributo zerado), a regra do livro "perícia já recebida pela origem exclui a opção" nos grupos de escolha da classe, e o caso do Amnésico (perícias "à escolha do mestre" viram escolha do jogador, já que não há mestre no app). 44 testes novos + fluxo completo validado manualmente num browser real (Playwright temporário), zero erros de console. Achado durante o teste: o app não tinha nenhum jeito de sair do D&D pra escolher outro sistema — adicionado link "Trocar de sistema" no rodapé de ambos os apps.

**Fase 12 — ✅ CONCLUÍDA (2026-07-09).** As 15 trilhas (5 por classe, features de NEX 10/40/65/99) e as listas de Poder de Combatente/Especialista/Ocultista (19+15+16, com 3 poderes compartilhados entre classes) digitalizadas por completo em `docs/ordem-paranormal/regras-classes.md` e `src/systems/ordem/data/{trilhas,class-powers}.json`. Novo passo "Progressão" no wizard: seletor de NEX (5–99, movido pro passo Nome), trilha (NEX 10%), poderes de classe (slots reais em NEX 15/30/45/60/75/90), aumento de atributo (NEX 20/50/80/95, teto 5), grau de treinamento (NEX 35/70 — contagem varia por classe: 1+Int/5+Int/3+Int, corrigido de um erro de leitura anterior) e Versatilidade (NEX 50%). PV/PE/Sanidade escalam com o NEX escolhido. 74 testes novos; bug real (exclusão de poder entre slots escondia a própria escolha do slot) encontrado e corrigido só no teste manual em browser real — coberto por teste de regressão depois. Escopo de Poderes que estava planejado pra Fase 13 saiu junto, por estar fortemente acoplado aos slots de NEX.

**Fase 13 — ✅ CONCLUÍDA (2026-07-09; revisada 2026-07-09).** Ocultistas escolhem rituais (por círculo 1º–4º e elemento) nos slots abertos pelo "Escolhido pelo Outro Lado" (3 iniciais de 1º círculo + 1 a cada NEX; círculo máximo 2º@25% / 3º@55% / 4º@85%) — mesmo padrão de "slot real" já usado. 81 rituais do Cap. 5 (26/22/16/17 por círculo) digitalizados com stat block completo e multi-elemento em `docs/ordem-paranormal/regras-rituais.md` + `src/systems/ordem/data/rituals.json`, gerados de forma idempotente pelo `scripts/extract-rituais-ordem.mjs`. **Correção de regra:** os rituais do Ocultista **não** contam no limite de rituais conhecidos por Intelecto (livro pág. 34/119) — esse limite vale só pro poder "Aprender Ritual". A implementação já estava certa (limitada pelo NEX, `3 + índice de NEX`); a nota anterior desta fase ("limitados pelo Intelecto") é que estava errada. **Revisão pós-entrega** encontrou e corrigiu: (1) vazamento de rituais numa ficha de não-conjurador (`setClass` não limpava `ritualChoices`, e Revisão/ficha não guardavam por classe); (2) rituais duplicáveis entre slots (seletor não excluía os já escolhidos); (3) resíduo ao baixar o NEX (Revisão/ficha não cortavam pelos slots do NEX); (4) rótulo "Ritual NEX 100%" no último slot (100% não existe). Poderes já saíram completos na Fase 12.

**Fase 14 — ✅ CONCLUÍDA (2026-07-09) · 🔁 ampliada no playtest (2026-07-10).** Entregou primeiro o loadout padrão Recruta. Depois, no playtest (feedback F12), o escopo foi ampliado: **Patente virou parâmetro escolhível** (define o limite de itens por categoria — Tabela 3.1) e o **sistema de Modificações** (Tabelas 3.5/3.7/3.9) foi implementado (cada mod sobe a categoria efetiva do item, consumindo slots da Patente; efeitos de espaço/Defesa aplicados). Proficiência de arma virou informativa. Ver F12 no `docs/playtest-feedback.md`.

**Fase 15 — ✅ CONCLUÍDA (2026-07-09; revisada 2026-07-09).** Galeria global unificada (`GlobalGallery`, no topo do `App.tsx`) lista personagens de D&D e Ordem misturados e ordenados por atualização, com as duas bibliotecas de localStorage isoladas mas lidas juntas; cada ação (abrir/duplicar/excluir/exportar/criar/importar) é roteada pelo sistema do card. Import discriminado por chave (`abilityScores` = D&D, `attributes` = Ordem — chaves disjuntas, sem risco de misrouting entre sistemas). Ficha imprimível (`PrintableSheet`) com rituais e equipamento detalhados. **Revisão:** import cross-system, roteamento de ações e derivação de rituais/equipamento (Força efetiva na capacidade) conferidos; as correções de rituais entraram junto com a Fase 13.

**Fase 16 — ✅ CONCLUÍDA (2026-07-09).** Auditoria completa do módulo Ordem contra o livro (Caps. 1–5), estrutural (scripts) + fidelidade de regras linha a linha:
- **Contagens/estrutura batem 1:1:** 5 atributos, 28 perícias, 26 origens (tabela de sorteio 2d20 contígua 2–40), 3 classes, 15 trilhas (5/classe, NEX 10/40/65/99), 45 poderes (19/15/16, 3 compartilhados), 81 rituais (26/22/16/17); todas as referências cruzadas válidas, sem IDs duplicados.
- **Regras conferidas contra o livro:** Tabela 2.1 (atributo-base/só-treinada/carga das 28 perícias — zero divergência), PV/PE/Sanidade iniciais e por NEX das 3 classes, perícias/proficiências/grau de treinamento (1/5/3 + Int), cadências de NEX (Tabela 1.3), point-buy (soma 9, teto 3, 1 zerável), limite de PE/turno (Tabela 1.2).
- **Correções aplicadas:** (A1) **Defesa** (10 + Agilidade + proteção, livro pág. 43) passou a ser derivada e exibida na Revisão e na ficha — antes não existia; (A2) descrições de atributo corrigidas (Intuição é de Intelecto, não Presença; Adestramento/Artes são de Presença) — só o texto estava errado, os cálculos usam `skills.json`, que já estava certo; (A3) limite de PE por turno e (A4) deslocamento (9m) agora aparecem na ficha.
- **Seleção de sistema:** já entregue pela `GlobalGallery` (criar/abrir personagem de D&D ou Ordem lado a lado no "Multiverso").

---

## Decisões a registrar no CLAUDE.md quando as fases começarem

- Escopo ampliado: ASI/talentos e features por nível **entram** no escopo (revoga "fora do escopo" parcial da V1).
- Novo passo "Aprimoramentos" no wizard (9 passos).
- Modelo `featuresByLevel` e recursos de classe em `progression.json`.
- Biblioteca de fichas: localStorage versionado; critério de migração para IndexedDB.

---

## 📌 Backlog de Polimentos e Melhorias (Icebox / Pós-Testes)

Pequenos detalhes, abstrações, gamificação ou ideias de melhoria contínua identificados durante o desenvolvimento (priorizados conforme feedback de playtest — ver `docs/playtest-feedback.md`).

> Itens já entregues durante o playtest foram removidos desta lista (conferido contra o código em 2026-07-13): "Notas para iniciantes" (já existia desde 2026-06-03), "Detalhamento de Armas no PDF" (F5, 2026-07-10) e "Espaços de Controle de Sessão" (F7, 2026-07-10, depois reformatado pelo F23). Detalhe de cada um em `PROGRESS.md`.

- **Gamificação & UX:**
  - Glossário ampliado (adicionar mais além dos 11 termos atuais em `glossary.ts`).
  - Medidor de completude da ficha ("Falta escolher X atributos").
  - Sorteio de bugiganga aleatória na criação do personagem (dado pronto em `trinkets.json`, não consumido em lugar nenhum ainda).
- **Exportação de PDF — Página de Magias (Grimório):** Como o banco de dados já possui a descrição completa de todas as magias (`spells.json`), uma excelente melhoria seria gerar uma segunda página (anexo) no PDF dedicada exclusivamente a imprimir os textos completos das magias conhecidas do personagem.
- **Exportação de PDF — Traços de Antecedente:** A ficha atualmente resolve com precisão matemática as proficiências e equipamentos dos antecedentes. Seria uma boa adição considerar imprimir também a "habilidade narrativa" de cada antecedente (ex: "Contato Criminal" do Criminoso) na seção de Traços.
