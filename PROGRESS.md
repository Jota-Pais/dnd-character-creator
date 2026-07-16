# Progresso — D&D Character Creator (+ Ordem Paranormal)

> Atualizado: 2026-07-16
> Histórico completo de todas as fases de build (1–16, D&D + Ordem) e o Backlog de Polimentos: ver `ROADMAP.md`. Este arquivo é só o retrato do **estado atual** — não duplica fase a fase o que já está registrado lá.

## Status atual

**Todo o roadmap de build está concluído** — Fases 1–16 do `ROADMAP.md`: D&D 5e nível 1–20 completo e Ordem Paranormal NEX 5–99% completo, ambos auditados linha a linha contra o livro.

Desde **2026-07-09** o projeto está em **fase de playtest** com usuários reais. Feedback registrado item a item em `docs/playtest-feedback.md`; **F1–F29, F31–F32 concluídos**, **F30 (redesign visual do módulo Ordem) em andamento** — resumo na seção "Fase de Playtest" abaixo.

**Próximo passo:** terminar o padrão mestre-detalhe pendente do F30 e seguir recebendo/priorizando feedback de playtest. Deploy estático (Fase 8.3 do `ROADMAP.md`) já está no ar (Vercel, `https://dnd-character-creator-gamma.vercel.app/`), com CI de lint + testes via GitHub Actions.

## Multiclasse D&D 5e — ✅ CONCLUÍDA (2026-07-14)

Fora do escopo original da V1, implementada a pedido durante o playtest, fiel ao PHB 2014 (cap. 6). Regras digitalizadas em `docs/regras-multiclasse.md`. Modelo **aditivo**: `draft.additionalClasses: ClassEntry[]` sobre os campos existentes — o caminho de **classe única continua byte-a-byte idêntico** (zero regressão), e a UI de multiclasse é opt-in pelo toggle do passo Nome. 6 fases / commits:

- **Dados & tipos:** pré-requisitos de atributo (semântica E/OU), tabela de proficiências de multiclasse, proficiências de armadura/arma por classe (antes ausentes) e `casterProgression` (full/half/third/pact/none; `third` via Cavaleiro Arcano / Trapaceiro Arcano).
- **Modelo & agregação (`multiclassUtils`, testada):** `draft.level` vira orçamento (nível da primária = total − adicionais); PV em poço (só o 1º nível da classe inicial usa o dado máximo); proficiências agregadas (inicial completa + subconjunto de multiclasse das adicionais); ASI por classe; **nível de conjurador combinado** (pleno ×1 + meio ⌊÷2⌋ + third ⌊÷3⌋; Pacto do Bruxo à parte).
- **UX (Nome + Classe + Aprimoramentos):** toggle Classe única/Multiclasse; alocador de níveis com "+ adicionar classe" respeitando o orçamento; painel de escolhas por classe; ASI por classe; **pré-requisitos bloqueiam** a finalização (fiel ao livro), avaliados sobre os atributos finais.
- **Conjuração & ficha:** `SpellStep` com uma seção por classe conjuradora (contagens/atributo próprios) + pool de slots combinado; Revisão e ficha impressa agregam tudo — identidade "Guerreiro 3° / Mago 2° — nível 5", dados de vida `6d10 + 4d6`, CD/ataque por classe, features/recursos/progressão por classe, resistências só da 1ª classe, Ataque Extra não empilha.

Verificado no browser (Edge via Playwright) em cada fase, incluindo smoke de Paladino 6/Feiticeiro 4 (PV 66, slots 4/3/3/1, dois blocos de conjuração CD 15). 631 testes, tsc, lint e build verdes.

## Fase de Playtest (2026-07-09 → em andamento)

> Tracker completo, item a item (relato do usuário + regra conferida no livro + o que mudou no código): `docs/playtest-feedback.md`. Este resumo agrupa por tema — não duplica o detalhe, só orienta.

**31 itens concluídos (F1–F29, F31–F32).** Agrupados por natureza:

- **Bugs de fidelidade ao livro corrigidos:** F6 (texto estático de dado escalável divergia do painel dinâmico — Ataque Furtivo/Artes Marciais), F9 (ritual Amaldiçoar Arma sem escolha de elemento), F13 (Mochila Militar não aumentava a capacidade de carga), F16 (preview de PV/PE no passo Classe não usava atributos efetivos — o cálculo real da Revisão já estava certo), F20 (perícia fixa da classe repetida da origem não dava escolha compensatória), F22 (Componentes Ritualísticos da Tabela 3.10 ausentes de `equipments.json`), F32 (Amaldiçoar Arma pode ser conhecido mais de uma vez, uma por elemento — FAQ oficial). F2 e F3 foram investigados e **confirmados corretos** pelo usuário (sem bug, sem alteração de código). **F31** (efeitos determinísticos de origens, trilhas e poderes do Ordem aplicados na ficha: RD empilhada, carga com Intelecto, DT e custos de ritual).
- **Bug real (não de regra):** F14 — galeria não unificava D&D+Ordem depois de "Concluir" (só corrigia com refresh); causa raiz eram galerias internas legadas por sistema, removidas junto com a correção.
- **Features novas:** F12 (Patente + Modificações de equipamento — decisão de escopo que revoga a Fase 9 original "sem Patente"), F15 (método "Personalizado" de atributos no D&D), F17 (Itens Amaldiçoados — 34 maldições), F18 (múltiplas unidades do mesmo item de equipamento, cada uma com mods/maldições próprias), F19 (stepper clicável — navegação livre entre etapas nos dois sistemas), F21 (item de categoria menor pode ocupar vaga de categoria maior na Patente), F27 (poderes com escolha embutida: Treinamento em Perícia, Especialista/Mestre em Elemento, Mochila de Utilidades), F29 (NEX 0% como grau real de progressão, com PV/PE/SAN corretos).
- **UX/clareza:** F1 e F11 (descrições de equipamento, D&D e Ordem), F4 (emoji do D&D 🎲→🐉), F5 (ataques por arma no PDF), F7 (espaços de controle de sessão na ficha — depois reformatado pelo F23), F8 (seleção de trilha explica a mecânica e mostra as habilidades futuras), F10→F12 (Patente explicada e depois virou parâmetro escolhível), F23 (ficha do Ordem no formato oficial de 2 páginas), F24 (Personalização na Revisão: ritual predileto + perícia de ataque), F25 (auditoria dos 46 poderes de classe — vários bônus que só existiam como texto do livro passaram a valer nos números da ficha), F26 (ritual armazenado na arma Ritualística visível na ficha), F28 (trilhas em colunas no passo Progressão).

**F30 — Redesign visual do módulo Ordem: 🔄 em andamento.** Handoff de design externo (protótipo hifi; conteúdo relevante já incorporado ao `DESIGN.md`, pasta original removida do repo em 2026-07-13). **Fase 1 ✅** (tokens `.theme-ordem`, sidebar fixa de 250px, sigilo animado, rodapé de navegação), **Fase 2 ✅** (galeria neutra em linhas por sistema), ambas de 2026-07-13, e **Fase 3 ✅** (2026-07-14 — catálogo visível de rituais no lugar do `<select>`, CTA desabilitado explicando o que falta pro jogador, chips de perícia no padrão novo, etiquetas coloridas por elemento de ritual). **Pendente:** só o padrão mestre-detalhe em Origem/Classe.

**Ajustes de playtest sem número F** (feitos diretamente, fora do intake formal):
- Fonte base do app aumentada (`html { font-size: 112.5% }`, 2026-07-12) e tons de texto secundário (`parchment` 400–700) clareados — legibilidade.
- 2026-07-13: correção do seletor de perícia de ataque do Ordem (só Ocultismo via Lâmina Maldita, não escolha livre — ajuste ao F24); perícias mostram o atributo do qual derivam (ex. "Atletismo (FOR)"); passo Classe do Ordem explica as fórmulas de PV/PE/SAN com o cálculo por extenso pro NEX atual.
- 2026-07-13: `DESIGN.md` criado — auditoria do sistema visual (cores, tipografia, radius, spacing, componentes), validada contra o schema oficial do formato (`npx @google/design.md lint`, 0 erros).
- 2026-07-16: responsividade — `StepIndicator` (compartilhado) ganhou rolagem horizontal própria em vez de vazar a página ou ser cortado pelo `overflow-hidden` do Ordem; `Tooltip` não vaza mais a viewport perto da borda; D&D ganhou um `StepNav` compartilhado (`src/components/wizard/StepNav.tsx`, no molde do que o Ordem já tinha), substituindo 5-6 variações mobile/desktop duplicadas nos 8 passos; galeria (`CharacterRow`) trocou grid de colunas fixas por flex-wrap (botões vazavam no mobile); pré-visualização de impressão ganhou largura fixa (794px, proporção A4) em vez de encolher e amassar o layout no celular; folha de impressão do Ordem trocou `break-after: page` fixo por `min-height` (tabela de Ataques longa deixava uma folha quase em branco no meio do PDF).

---

## Fluxo do wizard

| #   | Etapa         | Status       |
| --- | ------------- | ------------ |
| 1   | Nome (+nível) | ✅ Concluído |
| 2   | Raça          | ✅ Concluído |
| 3   | Classe        | ✅ Concluído |
| 4   | Atributos     | ✅ Concluído |
| 5   | Magias        | ✅ Concluído |
| 6   | Antecedente   | ✅ Concluído |
| 7   | Equipamento   | ✅ Concluído |
| 8   | Revisão       | ✅ Concluído |

---

## Sistema de magias (concluído)

### Decisões tomadas

- Magias em dois arquivos `.md` em `docs/magias/`: `regras-magias.md` (descrições com frontmatter YAML) e `magias-por-classe.md` (referência humana)
- `scripts/parse-spells.mjs` parseia `regras-magias.md` → `src/data/spells.json` (347 magias)
- IDs em inglês kebab-case, display em português
- Passo "Magias" inserido após "Atributos" no wizard (8 passos no total)
- Conjuradores "known" (bardo, bruxo, feiticeiro): seleção de N magias conhecidas
- Conjuradores "prepared" (clérigo, druida): seleção de magias preparadas, cap = mod+nível
- Conjurador "hybrid" (mago): 6 magias no grimório

### Implementado

- `src/types/spell.ts`: Spell, SpellSchool, SpellClass, SpellChoices
- `src/utils/spellUtils.ts`: lookup, filtros, CD, bônus de ataque, slots, validação
- `src/components/steps/SpellStep.tsx`: grid de cards, painel de detalhe, abas truques/1°nível
- `ReviewStep`: seção de magias com CD, bônus de ataque, slots e listas

---

## O que foi feito (estado atual do código)

### Fundação

- Setup Vite + React 19 + TypeScript strict + Tailwind v4 + Zustand + Vitest
- Tema visual D&D (taverna): paleta parchment/gold, fonte fantasy
- `src/utils/storage.ts` — camada de persistência abstraída sobre localStorage
- `src/stores/characterStore.ts` — store Zustand centralizado; salva draft no localStorage a cada `nextStep()`

### Dados e tipos

- `src/types/race.ts` + `src/data/races.json` — 9 raças PHB 2014 com sub-raças e choices
- `src/types/class.ts` + `src/data/classes.json` — 12 classes PHB 2014 com `startingEquipment`
- `src/types/background.ts` + `src/data/backgrounds.json` — antecedentes com proficiências, idiomas e equipamento
- `src/types/equipment.ts` — union discriminada por `kind`; custos em cobre; `DamageRoll` estruturado
- `src/data/weapons.json`, `armors.json`, `tools.json`, `general-items.json`, `equipment-packs.json`

### Utilitários (todos com testes)

- `src/utils/raceUtils.ts` — bônus racial, choices de raça, idiomas/proficiências concedidos
- `src/utils/classUtils.ts` — proficiências, hit dice, HP inicial, equipment inicial por classe
- `src/utils/abilityScoreUtils.ts` — point buy, standard array, modificadores, formatação
- `src/utils/backgroundUtils.ts` — proficiências e equipamento do antecedente
- `src/utils/equipmentUtils.ts` — resolução de choices, lookup de itens, getArmor

### Componentes do wizard

- `StepIndicator` — barra de progresso com os 8 passos
- `NameStep` — campo de nome
- `RaceStep` — cards de raça + sub-raça + choice panel (atributos, perícias, idiomas, ferramentas)
- `ClassStep` — cards de classe + choice panel (perícias, estilos de combate, subclasse, etc.)
- `AbilitiesStep` — seletor de método (standard array / point buy / roll) + tabela de atributos com bônus raciais
- `BackgroundStep` — cards de antecedente + choice panel (ferramentas, idiomas)
- `EquipmentStep` — seletor de método (equipamento padrão vs. rolar ouro) + cards de escolha
- `ReviewStep` — resumo completo: identidade, quick stats (PV/CA/iniciativa/deslocamento), grid de atributos, resistências, todas as 18 perícias, idiomas, ferramentas, equipamento, característica de antecedente; botão de exportar JSON e recomeçar com confirmação

### Correções e polimento

- Idiomas não podem ser escolhidos duas vezes: `excludedLanguages` prop propaga os idiomas já obtidos (fixos da raça + escolhas da raça) para o painel de antecedente; seleções obsoletas são limpas automaticamente por `useEffect`
- CA na revisão calculada com a armadura detectada no equipamento padrão (fallback 10 + mod. DES)
- Exportação de ficha como arquivo `.json` (download no browser)
- Importação de ficha via upload de `.json` na tela de nome; valida estrutura antes de aceitar
- Persistência real: `storage.ts` salva `{ draft, currentStep }` juntos; store inicializa direto do localStorage sem `useEffect` em App; `prevStep` também persiste o step atual

---

## Decisões arquiteturais registradas

| Data       | Decisão                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-29 | Equipamentos modelados com union discriminada por `kind`; `choices[]` aceita opção única sem caso especial                                                                                         |
| 2026-04-29 | `DamageRoll` estruturado (`{ dice, sides }`) em vez de string — evita parsing em runtime                                                                                                           |
| 2026-04-29 | Custos armazenados em cobre (canônico); formatação (po/pp/pe) derivada nas funções de display                                                                                                      |
| 2026-04-29 | `storage.ts` como camada abstrata — stores e componentes nunca tocam localStorage diretamente; preparado para migrar para IndexedDB                                                                |
| 2026-04-29 | Point buy com mínimo 8 e máximo 15 pré-racial; orçamento de 27 pontos (regra PHB 2014)                                                                                                             |
| 2026-05-01 | `excludedLanguages` passado como prop aos painéis de escolha — mantém a lógica de deduplicação no nível do step, não no componente genérico                                                        |
| 2026-05-01 | Sessão salva como `{ draft, currentStep }` em chave única `dnd-character-session`; store lê do localStorage na inicialização do módulo, sem `useEffect`                                            |
| 2026-05-05 | Descrições de magia em texto livre (markdown); efeitos não são estruturados — cálculos de dano/condição ficam com o jogador na mesa                                                                |
| 2026-05-05 | Deploy postergado até final do roadmap (após magias, level up e export PDF) — projeto solo sem usuários esperando, evita manter URL pública estável durante refatorações grandes                   |
| 2026-05-08 | Magias em dois arquivos consolidados em `docs/magias/` (regras-magias.md + magias-por-classe.md); `scripts/parse-spells.mjs` gera `src/data/spells.json` (347 magias)                              |
| 2026-05-08 | Passo "Magias" inserido APÓS atributos (posição 5 de 8) para o jogador conhecer os modificadores de conjuração antes de escolher magias preparadas                                                  |
| 2026-06-03 | Escopo ampliado para **níveis 1–20**: tabelas de progressão (proficiência, slots full/half/warlock, truques/magias conhecidas) em `src/data/progression.json`; HP por **média** ou **rolagem**; sessão versionada (`SESSION_VERSION = 3`) descarta drafts de schema antigo |
| 2026-07-16 | Deploy estático antecipado pra durante o playtest (Vercel + CI via GitHub Actions) — revoga a decisão de 2026-05-05 de esperar o roadmap fechar                                                     |
