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

## Fase 1 — Correções no núcleo de nível 1

Bugs e infidelidades ao livro que afetam qualquer personagem, inclusive nível 1.

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

## Fase 2 — Subclasse para as 12 classes

A validação `isClassStepComplete(cls, choices, currentLevel)` já aceita nível — só não é usada.

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 2.1 | Ativar seleção por nível | Passar `draft.level` ao `isClassStepComplete`; `ClassChoicePanel` renderiza o seletor quando `subclassLevel <= level` (todas as classes, não só as de nível 1) |
| 2.2 | Features de entrada das 29 subclasses vazias | Digitalizar do livro a(s) feature(s) do nível de entrada de cada subclasse (bárbaro, bardo, druida, guerreiro, ladino, mago, monge, paladino, patrulheiro) |
| 2.3 | Escolhas embutidas na entrada da subclasse | Ex.: Totem (bárbaro 3), manobras do Mestre de Batalha (guerreiro 3), disciplinas elementais (monge 3) — modelar como `subclassExtras`, no padrão já existente para clérigo/bruxo/feiticeiro |

**Pronto quando:** qualquer classe criada em nível ≥ `subclassLevel` escolhe subclasse (obrigatória) e recebe as features de entrada.

---

## Fase 3 — Progressão completa 1–20 (o épico de dados)

O maior bloco de trabalho. Divide-se em modelo de dados + 3 lotes de digitalização.

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 3.1 | Modelo de dados por nível | `featuresByLevel: { level, name, description, choices? }[]` em classe e subclasse; `progression.json` ganha recursos não-mágicos por classe (fúrias + dano de fúria, ki + dado de artes marciais, ataque furtivo, inspiração de bardo, canalizar divindade, forma selvagem, pontos de feitiçaria, invocações conhecidas, ataque extra etc.); bump de `SESSION_VERSION` |
| 3.2 | Lote A — marciais | Bárbaro, Guerreiro, Ladino, Monge: docs → JSON → testes de integridade (toda classe tem feature em todo nível que o livro lista) |
| 3.3 | Lote B — conjuradores plenos | Clérigo, Druida, Mago, Feiticeiro |
| 3.4 | Lote C — híbridos | Bardo, Bruxo, Paladino, Patrulheiro |
| 3.5 | Escolhas de nível alto | Invocações místicas, metamagia, manobras adicionais, expertise adicional (ladino 6 / bardo 3-10), segredos mágicos, estilo de luta extra — seção "Escolhas de progressão" no passo Classe, geradas das `choices` por nível ≤ nível do personagem |
| 3.6 | Revisão por nível | Features agrupadas por nível até o nível atual; painel de recursos de classe (ki, fúrias, dados de inspiração...) na ficha |

**Pronto quando:** um personagem de nível N exibe exatamente as features/recursos que o livro dá até o nível N, com as escolhas de progressão feitas pelo jogador.

---

## Fase 4 — ASI e Talentos

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 4.1 | Dados de talentos | Digitalizar cap. 6 (~42 talentos) → `docs/regras-talentos.md` → `feats.json` + tipos |
| 4.2 | Novo passo "Aprimoramentos" | Entre **Atributos** e **Magias** (ASI muda modificadores → afeta magias preparadas e CD). Para cada nível de ASI ≤ nível do personagem (4/8/12/16/19 + extras de guerreiro 6/14 e ladino 10): escolher **+2**, **+1/+1** ou **talento**; teto 20 por atributo |
| 4.3 | Humano Variante | Seleção real de talento (substitui o campo de texto livre) |
| 4.4 | Efeitos estruturados | Talentos com efeito mecânico direto aplicados à ficha (+1 atributo, Resistente, Vigilante +5 iniciativa, Duro +2 PV/nível, perícias); talentos situacionais ficam como texto na ficha |
| 4.5 | Revisão | Talentos exibidos com seus efeitos; atributos finais = base + racial + ASI + talento |

**Pronto quando:** personagem de nível 20 sai com atributos e talentos corretos pelo livro. O passo não aparece para nível < 4 sem Humano Variante.

---

## Fase 5 — Loja de equipamento (método riqueza)

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 5.1 | Dados que faltam do cap. 5 | Montarias e veículos, selas/arreios; bens comerciais; tabela de bugigangas (d100) como sabor |
| 5.2 | Loja | Ao rolar riqueza: catálogo completo com busca/filtro por categoria, carrinho, saldo restante em po/pp/pc; adicionar item manual (nome livre) para casos fora do catálogo |
| 5.3 | Ficha considera compras | CA detecta armadura/escudo comprados; inventário da Revisão lista os itens adquiridos |

**Pronto quando:** o jogador que rola ouro monta o equipamento inteiro dentro do app, sem ser mandado de volta ao livro.

---

## Fase 6 — Biblioteca de fichas

| # | Etapa | Detalhe |
| - | ----- | ------- |
| 6.1 | Camada de biblioteca em `storage.ts` | Lista nomeada de fichas (id, nome, classe, nível, data), mantendo a abstração; localStorage na primeira versão (migração IndexedDB só se o volume exigir — registrar decisão) |
| 6.2 | Tela inicial (galeria) | Criar novo, abrir, duplicar, excluir, exportar; import validado cai na galeria |
| 6.3 | Re-edição guiada | Abrir ficha existente em qualquer passo do wizard, com validações reavaliadas |

**Pronto quando:** criar um segundo personagem não apaga o primeiro; qualquer ficha pode ser reaberta e editada.

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
