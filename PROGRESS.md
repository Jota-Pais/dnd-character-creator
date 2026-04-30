# Progresso — D&D Character Creator

> Atualizado: 2026-04-29

## Status atual

**Etapa em andamento:** Tela de revisão (step 7)
**Próximo passo:** Export/import JSON → polimento de UI → deploy

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
| 7   | Revisão     | 🚧 Próximo   |

---

## O que foi feito (estado atual do código)

### Fundação

- Setup Vite + React 19 + TypeScript strict + Tailwind v4 + Zustand + Vitest
- Tema visual D&D (taverna): paleta parchment/gold, fonte fantasy
- `src/utils/storage.ts` — camada de persistência abstraída sobre localStorage (componentes e stores nunca acessam localStorage diretamente)
- `src/stores/characterStore.ts` — store Zustand centralizado; auto-salva no localStorage a cada `nextStep()`

### Dados e tipos

- `src/types/race.ts` + `src/data/races.json` — 9 raças PHB 2014 com sub-raças e choices modelados
- `src/types/class.ts` + `src/data/classes.json` — 12 classes PHB 2014 com `startingEquipment` (opções de classe) e equipment dos antecedentes
- `src/types/background.ts` + `src/data/backgrounds.json` — antecedentes com proficiências, languages e equipment
- `src/types/equipment.ts` — union discriminada por `kind` (weapon/armor/tool/general/pack); custos em cobre; `DamageRoll` estruturado
- `src/data/weapons.json`, `armors.json`, `tools.json`, `general-items.json`, `equipment-packs.json`

### Utilitários (todos com testes)

- `src/utils/raceUtils.ts` — cálculos de bônus racial, choices de raça
- `src/utils/classUtils.ts` — proficiências, hit dice, equipment inicial por classe
- `src/utils/abilityScoreUtils.ts` — point buy, standard array, modificadores
- `src/utils/backgroundUtils.ts` — proficiências e equipment do antecedente
- `src/utils/equipmentUtils.ts` — resolução de choices, cálculo de inventário final

### Componentes do wizard

- `StepIndicator` — barra de progresso com os 7 passos
- `NameStep` — campo de nome
- `RaceStep` — cards de raça + sub-raça + choice panel
- `ClassStep` — cards de classe + choice panel (perícias, estilos de combate, etc.)
- `AbilitiesStep` — seletor de método (standard array / point buy / roll) + tabela de atributos
- `BackgroundStep` — cards de antecedente + choice panel
- `EquipmentStep` — seletor de método (class choices vs. gold roll) + cards de escolha

---

## O que falta para a V1 estar completa

### 🚧 Em andamento

- [ ] Tela de revisão (step 7)
  - Resumo de todos os campos preenchidos
  - Estatísticas derivadas: HP, CA, modificadores, bônus de proficiência
  - Inventário final consolidado
  - Botão "Finalizar personagem"

### 📋 Pendente

- [ ] Export/import JSON
  - Botão "Exportar ficha (.json)" na tela de revisão
  - Botão "Importar ficha" na tela inicial
- [ ] Polimento de UI
  - Validação visual de campos obrigatórios
  - Feedback de erro/aviso quando step está incompleto
  - Responsividade mobile
- [ ] Deploy estático (Vercel ou Netlify)

---

## Decisões arquiteturais registradas

| Data       | Decisão                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-29 | Equipamentos modelados com union discriminada por `kind`; `choices[]` aceita opção única sem caso especial — refatorar se virar dor |
| 2026-04-29 | `DamageRoll` estruturado (`{ dice, sides, bonus }`) em vez de string `"1d6"` — evita parsing em runtime                             |
| 2026-04-29 | Custos armazenados em cobre (canônico); formatação (po/pp/pe) derivada nas funções de display                                       |
| 2026-04-29 | `storage.ts` como camada abstrata — stores e componentes nunca tocam localStorage diretamente; preparado para migrar para IndexedDB |
| 2026-04-29 | Point buy com mínimo 8 e máximo 15 pré-racial; orçamento de 27 pontos (regra PHB 2014)                                              |

---

## Backlog pós-V1

- Magias detalhadas (spell slots, lista de magias por classe)
- Level up (XP, progressão de classe)
- IndexedDB para fichas múltiplas
- Raças e classes homebrew
- Suplementos: Xanathar's Guide, Tasha's Cauldron
