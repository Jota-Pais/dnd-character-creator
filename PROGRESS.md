# Progresso — D&D Character Creator

> Atualizado: 2026-07-08

## Status atual

**Fases 1–7 concluídas.** Falta só a Fase 8 (gamificação, auditoria final e deploy).

**Próximo passo:** Fase 8 — glossário ampliado + medidor de completude + notas para iniciantes + bugiganga aleatória na criação (consome `trinkets.json`), auditoria capítulo-a-capítulo contra o livro, e deploy estático.

### Fase 5.1 — Montarias/veículos + bugigangas ✅ CONCLUÍDA (2026-07-08)

- `src/data/mounts-vehicles.json`: 26 itens (8 montarias, 8 arreios/selas, 10 veículos), na loja sob nova categoria "Montarias" (`getShopCatalog` + `ShopCategory` + filtro em `EquipmentStep`). Fecha a Fase 5 (loja completa no método riqueza).
- `src/data/trinkets.json`: 100 bugigangas (d100), só dados — o sorteio na criação é da Fase 8.1.
- Bens comerciais (escambo): fora, por decisão de produto. Delegado e revisado: dados conferidos linha a linha contra a tabela do PHB pt-BR; build/lint/354 testes verdes.

### Fase 3.5b — Escolhas de progressão (seletores reais) ✅ CONCLUÍDA (2026-07-08)

- Manobras (Mestre de Batalha), invocações místicas (bruxo), metamágica (feiticeiro), disciplinas elementais (monge 4 Elementos), totem (bárbaro), terreno (druida da Terra), presa/táticas/ataques/defesa do Caçador (patrulheiro), segredos mágicos (bardo) e estilo de luta adicional (Campeão) agora são seletores que gravam a escolha do jogador — antes eram só texto genérico.
- `src/data/progression-choices.json` (mapa de slots por classe/subclasse) + 10 arquivos de listas de opções digitados do PHB; `progressionChoiceUtils` (com testes) resolve os slots por nível e valida completude; `ProgressionChoicesPanel` no passo Classe e nova seção "Escolhas de Progressão" na Revisão.
- Implementação delegada e revisada: build/lint/354 testes verdes; contagens das listas conferidas contra o livro. Correções na revisão registradas no `ROADMAP.md` (Fase 3, "Execução real" da 3.5b), incl. um bug de robustez em `withDraftDefaults` (fichas antigas travariam).

### Fase 3.5a — Features de subclasse por nível ✅ CONCLUÍDA (2026-07-08)

- As 41 subclasses das 12 classes (antes só berserker/totem-warrior do bárbaro) têm `LevelFeature[]` completo em `src/data/class-progression-features.json`, digitalizado do PDF do PHB.
- Trabalho de digitalização mecânica feito por agentes em paralelo (um por classe) — 2 nesta sessão (bardo, bruxo) e 9 por outra ferramenta (clérigo, druida, feiticeiro, guerreiro, ladino, mago, monge, paladino, patrulheiro).
- Auditoria pós-merge: script de validação estrutural (todas as subclasses de `classes.json` presentes, níveis válidos), `npm run build`/`lint`/`test` (347 testes) verdes, spot-check manual de 5 subclasses contra o PDF sem divergência. Pegou e corrigiu uma divergência real (bardo/bruxo relatados como mesclados, mas não estavam).
- Ver detalhamento e receita de execução no `ROADMAP.md` (Fase 3, seção 3.5a).

### Fase 7 — Export PDF ✅ CONCLUÍDA (2026-07-08)

- Ficha imprimível própria (`PrintableSheet`) em PT, com tudo que o jogador usa na mesa; impressão/PDF pelo navegador (`window.print`), zero dependências. Botão "Imprimir / Salvar como PDF" na Revisão. Decisão de formato registrada na memória.

### Fase 6 — Biblioteca de fichas ✅ CONCLUÍDA (2026-07-08)

- Múltiplos personagens: galeria inicial (abrir, duplicar, exportar, excluir, criar, importar). Antes só existia uma ficha.
- `storage`: camada de biblioteca versionada em localStorage, com migração automática da sessão única legada.
- Store: `view` (galeria/wizard), `library`, `currentId`; nextStep/prevStep salvam na biblioteca; "Concluir" na Revisão salva e volta à galeria.
- IndexedDB adiado (só se o volume exigir).

### Fase 5 — Loja de equipamento ✅ NÚCLEO (2026-07-08)

- **5.2/5.3** ✅ Loja no método riqueza: catálogo com filtro/busca, carrinho, saldo ao vivo, bloqueio sem saldo; Revisão lista compras + saldo; CA considera armadura/escudo comprados.
- **5.1** ⬜ Montarias/veículos, bens comerciais e bugigangas compráveis (dados ainda não em `/data`) — baixo impacto.

### Fase 4 — ASI e Talentos ✅ CONCLUÍDA (2026-07-08)

- **4.1/4.2** ✅ ASI: passo "Aprimoramentos" (entre Atributos e Magias). Níveis de ASI por classe, teto de 20, cálculo centralizado de atributos finais. Corrige o bug de atributos errados em nível ≥4. `SESSION_VERSION` 4.
- **4.1 (talentos)** ✅ `feats.json` com os 42 talentos do cap. 6 (do PDF), incl. 13 meio-talentos com atributos elegíveis; tipo Feat + featUtils + testes.
- **4.3** ✅ Talento do Humano Variante como seletor real (não mais texto).
- **4.4** ✅ Efeitos dos meio-talentos (+1 atributo) aplicados aos atributos finais, com teto 20.
- **4.5** ✅ Revisão lista talentos (ASI + racial) e usa os atributos finais.

### Fase 3 — progressão 1–20 (em andamento)

- **3.1** ✅ Fundação: `classResources` em `progression.json` (fúrias, ki, ataque furtivo, inspiração, pontos de feitiçaria, invocações, canalizar divindade, forma selvagem — verificado no PDF); `classResourceUtils` + testes; painel "Recursos de Classe" na Revisão; `getClassFeaturesUpToLevel`.
- **3.2–3.4** ✅ Features por nível 1–20 das **12 classes** em `src/data/class-progression-features.json` (arquivo separado; `classes.json` estável). Marciais, conjuradores plenos e híbridos, todos digitados do PDF do livro. A Revisão agrupa as habilidades de classe por nível (só as até o nível do personagem).
- **3.5a** 🔄 Features por nível das **subclasses**: bárbaro ✅; faltam 39 subclasses. **Detalhado no ROADMAP.md** (lista de subclasses + níveis + armadilhas de nome).
- **3.5b** ⬜ Escolhas de progressão como seletores reais (manobras, invocações, metamagia, expertise, totem, terreno, etc.). Não iniciado — **detalhado no ROADMAP.md**.
- **3.6** ✅ (parcial) Revisão por nível das features de classe; painel de recursos pronto. Falta refletir features de subclasse de nível alto (depende de 3.5a).

> **Nota de prioridade:** as features de nível alto (6/10/14) das subclasses são a "cauda" da progressão (poucos personagens as alcançam, e a de entrada já aparece). Sistemas ausentes de maior impacto — **Fase 4 (ASI/talentos)**, que afeta todo personagem nível ≥4, e a loja de equipamento (Fase 5) — podem valer mais que terminar as 39 subclasses. Decisão do produto: continuar a cauda de 3.5 ou saltar para a Fase 4.

> Arquitetura adotada: `featuresByLevel` num arquivo separado (`class-progression-features.json`), keyed por classId/subclassId, mergeado em runtime por `getClassFeaturesUpToLevel` (com fallback para o formato atual nas classes ainda não digitadas). Diffs limpos e `classes.json` intacto.

### Fase 2 — subclasses (concluída — núcleo) (2026-07-07)

- **2.1** Seleção de subclasse por nível para as 12 classes (antes só 3); rótulo correto por classe; validação e Revisão sensíveis ao nível
- **2.2** Features de entrada das 41 subclasses digitadas do PHB (as 29 que estavam vazias); `scripts/fill-subclass-features.mjs` injeta preservando o formato compacto do JSON
- **2.3** As escolhas embutidas na entrada da subclasse (totem do bárbaro, manobras do Mestre de Batalha, disciplinas do monge, terreno do druida, Presa do Caçador) hoje aparecem como texto na feature; transformá-las em seletores reais foi **movido para a Fase 3**, pois usa a mesma infraestrutura de "escolher N de uma lista" das escolhas de progressão (invocações, metamagia, expertise adicional).

### Fase 1 — correções concluídas (2026-07-07)

- **1.1** Import de ficha robusto (`sanitizeImportedDraft`) — não trava mais o app; retoma o wizard no 1º passo incompleto
- **1.2** CA fiel ao PHB (`calculateArmorClass`): escudo, Defesa sem Armadura (bárbaro/monge), Estilo de Luta Defesa, com testes
- **1.3** Percepção passiva na ficha
- **1.4** Teto de magias preparadas imposto (exige ≥ 1, não mais 0)
- **1.5** Deduplicação de perícias/ferramentas entre raça×classe×antecedente; corrige proficiências raciais fixas ausentes (elfo/Percepção etc.)
- **1.6** Magias raciais estruturadas (drow/tiefling) e truque real do alto elfo; exibidas na Revisão
- **1.7** 14 magias faltantes digitadas do livro → **361 magias** (total do PHB); nome de `purify-food-and-drink` corrigido
- **1.8** Validação defensiva no `nextStep`; selo de conjurador sensível ao nível

> Nota: itens apontados como "não-PHB" na auditoria (subclasse Rastreador Subterrâneo; conjuntos de jogo Xadrez do Dragão / Três Dragões) foram verificados no PDF do livro e **estão** nesta edição — mantidos.

Ver `ROADMAP.md` para as fases 2–8.

---

## Roadmap pós-V1

1. **Sistema de magias** — ✅ concluído (ver seção própria)
2. **Níveis 1–20** — ✅ concluído (nível do personagem, HP por nível, progressão de magias/slots/proficiência). Resta, se desejado: features de classe específicas por nível e XP.
3. **Export PDF** — última feature antes de deploy
4. **Deploy estático** — Vercel ou Netlify, depois que tudo estiver pronto

---

### Fase 13 — Ordem Paranormal: Rituais ✅ CONCLUÍDA (2026-07-09)
- 81 rituais do Cap. 5 (26/22/16/17 por círculo) com stat block completo e multi-elemento (`rituals.json` + `regras-rituais.md`, gerados pelo `extract-rituais-ordem.mjs`).
- Ocultista escolhe rituais em slots reais: 3 iniciais de 1º círculo + 1 a cada NEX; círculo máximo por NEX (2º@25%/3º@55%/4º@85%) e círculo por slot conforme o NEX de aquisição.
- Rituais do Ocultista NÃO contam no limite de Intelecto (esse limite é só do poder "Aprender Ritual") — a implementação já usava NEX.

### Fase 14 — Ordem Paranormal: Equipamento Inicial ✅ CONCLUÍDA (2026-07-09)
- Loadout padrão Recruta com categorias e slots baseados em atributo (Força).
- Lista de equipamentos parseada do livro e estruturada em JSON (weapons, protections, general items).
- Restrições de proficiência de armas de classe e limite de categoria I aplicados.
- EquipmentStep.tsx implementado para selecionar equipamento.

### Fase 15 — Ordem Paranormal: Export & Biblioteca ✅ CONCLUÍDA (2026-07-09)
- `PrintableSheet.tsx` finalizado com rituais e lista de equipamentos detalhada.
- Refatoração para a `GlobalGallery` rodar diretamente em `App.tsx` para misturar perfeitamente personagens de D&D e Ordem em um "Multiverso".
- As bibliotecas das duas storage são mantidas isoladas mas lidas ao mesmo tempo na galeria inicial.
- Import discriminado por chave (`abilityScores` = D&D, `attributes` = Ordem), sem misrouting entre sistemas.

### Revisão das Fases 13–15 ✅ (2026-07-09)
Auditoria do trabalho entregue pelo agente externo (foco em erros de lógica). Corrigidos 6 bugs + 4 testes de regressão; 477 testes, build e lint verdes. Detalhes no `ROADMAP.md` (Fase 13). Resumo:
- Rituais vazavam em ficha de não-conjurador (`setClass` não limpava `ritualChoices`; Revisão/ficha sem guarda de classe).
- Rituais duplicáveis entre slots (seletor não excluía os já escolhidos; validação não rejeitava repetição).
- Revisão/ficha não cortavam rituais pelos slots do NEX atual (baixar o NEX deixava resíduo).
- Rótulo do último slot mostrava "NEX 100%" (inexistente) → corrigido para 99% via helper `getRitualSlotNex`.
- Equipamento não barrava Categoria II+ em import (a UI já filtrava) → validação defensiva.
- Nota de regra do ROADMAP ("rituais limitados pelo Intelecto") corrigida.

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

---

## Backlog (V2 e além)

- IndexedDB para fichas múltiplas
- Raças e classes homebrew
- Suplementos: Xanathar's Guide, Tasha's Cauldron
