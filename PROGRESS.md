# Progresso — D&D Character Creator

> Atualizado: 2026-07-07

## Status atual

**Fase 1 do ROADMAP concluída — núcleo de nível 1 corrigido e fiel ao PHB.** Wizard de 8 passos funcionando, com seleção de nível (1–20), PV por média ou rolagem, progressão de magias/slots/proficiência por nível, persistência e export/import JSON. 271 testes passando, build e lint limpos.

**Próximo passo:** concluir a Fase 3.5 (features das 39 subclasses restantes + seletores de escolhas de progressão) OU avançar para a Fase 5 (loja de equipamento). Fases 1, 2, 4 completas; Fase 3 com o núcleo pronto.

### Fase 4 — ASI e Talentos ✅ CONCLUÍDA (2026-07-08)

- **4.1/4.2** ✅ ASI: passo "Aprimoramentos" (entre Atributos e Magias). Níveis de ASI por classe, teto de 20, cálculo centralizado de atributos finais. Corrige o bug de atributos errados em nível ≥4. `SESSION_VERSION` 4.
- **4.1 (talentos)** ✅ `feats.json` com os 42 talentos do cap. 6 (do PDF), incl. 13 meio-talentos com atributos elegíveis; tipo Feat + featUtils + testes.
- **4.3** ✅ Talento do Humano Variante como seletor real (não mais texto).
- **4.4** ✅ Efeitos dos meio-talentos (+1 atributo) aplicados aos atributos finais, com teto 20.
- **4.5** ✅ Revisão lista talentos (ASI + racial) e usa os atributos finais.

### Fase 3 — progressão 1–20 (em andamento)

- **3.1** ✅ Fundação: `classResources` em `progression.json` (fúrias, ki, ataque furtivo, inspiração, pontos de feitiçaria, invocações, canalizar divindade, forma selvagem — verificado no PDF); `classResourceUtils` + testes; painel "Recursos de Classe" na Revisão; `getClassFeaturesUpToLevel`.
- **3.2–3.4** ✅ Features por nível 1–20 das **12 classes** em `src/data/class-progression-features.json` (arquivo separado; `classes.json` estável). Marciais, conjuradores plenos e híbridos, todos digitados do PDF do livro. A Revisão agrupa as habilidades de classe por nível (só as até o nível do personagem).
- **3.5** 🔄 (a) features por nível das **subclasses**: bárbaro ✅ (Furioso, Totêmico); faltam 39 subclasses (mesmo padrão mecânico). (b) escolhas de progressão como seletores reais (invocações, metamagia, manobras, expertise adicional, + escolhas de entrada da ex-2.3) — exige modelo + UI, ainda não iniciado.
- **3.6** ✅ (parcial) Revisão por nível feita para as features de classe e das subclasses já digitadas; painel de recursos de classe pronto.

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
