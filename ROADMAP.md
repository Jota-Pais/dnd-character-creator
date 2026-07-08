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

## Fase 3 — Progressão completa 1–20 (o épico de dados) — 🔄 NÚCLEO PRONTO, FALTA A CAUDA

O maior bloco de trabalho. Núcleo (recursos + features das 12 classes) concluído; falta a cauda das subclasses e os seletores de escolhas de progressão.

| # | Etapa | Detalhe | Status |
| - | ----- | ------- | ------ |
| 3.1 | Modelo de dados por nível | `LevelFeature`/`featuresByLevel`; `progression.json` com `classResources` (fúrias, ki, ataque furtivo, inspiração, pontos de feitiçaria, invocações, canalizar divindade, forma selvagem); `classResourceUtils`; painel de recursos na Revisão | ✅ |
| 3.2 | Lote A — marciais | Bárbaro, Guerreiro, Ladino, Monge (features de classe 1–20) | ✅ |
| 3.3 | Lote B — conjuradores plenos | Clérigo, Druida, Mago, Feiticeiro | ✅ |
| 3.4 | Lote C — híbridos | Bardo, Bruxo, Paladino, Patrulheiro | ✅ |
| 3.5a | Features por nível das **subclasses** | ⚠️ **FALTA.** Só o bárbaro (Furioso, Totêmico) está feito. Faltam **39 subclasses**. Ver detalhamento abaixo. | 🔄 |
| 3.5b | Escolhas de progressão como **seletores reais** | ⚠️ **FALTA (não iniciado).** Ver detalhamento abaixo. | ⬜ |
| 3.6 | Revisão por nível | Features de classe agrupadas por nível ✅; painel de recursos ✅. Falta só refletir as features de subclasse de nível alto (depende de 3.5a). | ✅ (parcial) |

**Pronto quando:** um personagem de nível N exibe exatamente as features/recursos que o livro dá até o nível N, com as escolhas de progressão feitas pelo jogador.

### 📌 Detalhamento do que falta na Fase 3 (para não esquecer)

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

**3.5b — escolhas de progressão como seletores reais** (mini-projeto: modelo + dados + UI):

- Hoje essas escolhas aparecem só como TEXTO na descrição da feature. Falta torná-las seletores que gravam a escolha do jogador (a visão do produto pede "controle total das escolhas").
- Inclui as escolhas de ENTRADA de subclasse (ex-etapa 2.3): totem do bárbaro (Águia/Lobo/Urso), manobras iniciais do Mestre de Batalha, disciplinas do monge Quatro Elementos, terreno do druida da Terra, opção de Presa do Caçador do patrulheiro.
- E as escolhas de nível alto: invocações místicas do bruxo (lista ~30), metamagia do feiticeiro (~8 opções), manobras adicionais do Mestre de Batalha (lista de 16), expertise adicional (ladino nv6 / bardo nv3 e 10), segredos mágicos do bardo, estilo de luta extra.
- Trabalho: (1) digitar as listas de opções do livro (manobras, invocações, metamagia) em `src/data/`; (2) estender o modelo de escolhas (algo como `progressionChoices` no draft, ou ampliar `SubclassChoiceSelections`); (3) UI de "Escolhas de progressão" (provavelmente no passo Classe ou num painel dedicado), gerada por nível ≤ nível do personagem; (4) validação e exibição na Revisão.
- Escopo comparável ao de ASI/Talentos (Fase 4).

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

## Fase 7 — Export PDF

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 7.1 | Ficha imprimível | Rota/visão de impressão com CSS `@media print` — imprime/salva PDF pelo navegador, zero dependências |
| 7.2 | (Opcional) PDF nativo | `pdf-lib` para gerar a ficha oficial preenchida, se a versão imprimível não bastar |

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
