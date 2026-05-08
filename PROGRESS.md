# Progresso — D&D Character Creator

> Atualizado: 2026-05-05

## Status atual

**V1 funcionalmente completa.** Wizard completo, persistência funcionando, export/import JSON implementados.

**Em andamento:** Sistema de magias — digitalização das magias do PHB 2014 em `docs/spells/`

**Próximo passo:** Continuar digitalizando magias e modelar `Spell` em código

---

## Roadmap pós-V1

1. **Sistema de magias** — em andamento (ver seção própria)
2. **Level up** — XP e progressão de classe (depende de magias)
3. **Export PDF** — última feature antes de deploy
4. **Deploy estático** — Vercel ou Netlify, depois que tudo estiver pronto

---

## Fluxo do wizard

| #   | Etapa       | Status       |
| --- | ----------- | ------------ |
| 1   | Nome        | ✅ Concluído |
| 2   | Raça        | ✅ Concluído |
| 3   | Classe      | ✅ Concluído |
| 4   | Atributos   | ✅ Concluído |
| 5   | Antecedente | ✅ Concluído |
| 6   | Equipamento | ✅ Concluído |
| 7   | Revisão     | ✅ Concluído |

---

## Sistema de magias (em andamento)

### Decisões já tomadas

- Magias armazenadas como arquivos `.md` individuais em `docs/spells/<id>.md`
- Frontmatter YAML com metadados estruturados, corpo em markdown pra descrição
- IDs em inglês kebab-case (ex: `cure-wounds`), display em português
- `level` é fixo (nunca muda), seção "Em níveis superiores" descreve uso com slot superior; cantrips usam seção "Escalonamento"
- `components` em linha única no formato `V, S, M (descrição entre parênteses)`
- Conjuração com slot superior (não confundir com nível da magia, que é imutável)

### Pendente

- [ ] Digitalizar magias restantes do PHB 2014 (~360 no total, ~14 feitas)
- [ ] Definir paradigmas de conjuração por classe (preparados full caster vs. conhecidos full caster vs. half caster)
- [ ] Modelar `Spell` em `src/types/spell.ts`
- [ ] Build script: parsear `.md` em `docs/spells/` para `src/data/spells.json`
- [ ] UI de seleção de cantrips e magias iniciais (passo do wizard ou pós-criação)
- [ ] Cálculo e exibição de CD de magia + bônus de ataque na revisão
- [ ] Slots por nível por classe (tabela de progressão)
- [ ] Marcação de magias preparadas (Clérigo, Druida, Mago, Paladino+, Patrulheiro+)
- [ ] Indicação de ritual e concentração na ficha

### Fora de escopo (V2)

- Efeitos estruturados (dano calculado pelo app) — descrição fica em texto livre
- Aprender/trocar magias ao subir de nível (entra junto com level up)

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

- `StepIndicator` — barra de progresso com os 7 passos
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
| 2026-05-05 | Magias armazenadas como `.md` individuais em `docs/spells/` com frontmatter YAML; build script converte para JSON consumido pelo app — fonte legível pra humanos, dados estruturados pra aplicação |
| 2026-05-05 | Descrições de magia em texto livre (markdown); efeitos não são estruturados — cálculos de dano/condição ficam com o jogador na mesa                                                                |
| 2026-05-05 | Deploy postergado até final do roadmap (após magias, level up e export PDF) — projeto solo sem usuários esperando, evita manter URL pública estável durante refatorações grandes                   |

---

## Backlog (V2 e além)

- IndexedDB para fichas múltiplas
- Raças e classes homebrew
- Suplementos: Xanathar's Guide, Tasha's Cauldron
