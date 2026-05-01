# Progresso — D&D Character Creator

> Atualizado: 2026-05-01

## Status atual

**Wizard completo.** Todas as 7 etapas estão funcionando.
**Próximo passo:** Persistência real (restaurar rascunho no reload) → Import JSON → Deploy

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

---

## O que falta para a V1 estar completa

### 🔴 Bug: persistência não restaura ao recarregar

O `loadFromStorage()` existe no store mas **nunca é chamado** em `App.tsx`. Além disso, o `currentStep` não é salvo no localStorage — só o `draft`. Resultado: o usuário perde toda a navegação ao dar F5.

**Fix necessário:**
1. Salvar `{ draft, currentStep }` juntos no localStorage (ou chaves separadas)
2. Chamar `loadFromStorage()` no `useEffect` de mount em `App.tsx` — ou melhor, inicializar o store já com o estado restaurado

### 📋 Pendente

- [ ] **Import JSON** — botão "Importar ficha" na tela inicial (ou na revisão) para restaurar um `.json` exportado anteriormente; necessário para portabilidade entre dispositivos (escopo V1)
- [ ] **Persistência real no reload** — fix do bug acima
- [ ] **Deploy estático** — Vercel ou Netlify (configuração mínima, é SPA pura)

---

## Decisões arquiteturais registradas

| Data       | Decisão |
| ---------- | ------- |
| 2026-04-29 | Equipamentos modelados com union discriminada por `kind`; `choices[]` aceita opção única sem caso especial |
| 2026-04-29 | `DamageRoll` estruturado (`{ dice, sides }`) em vez de string — evita parsing em runtime |
| 2026-04-29 | Custos armazenados em cobre (canônico); formatação (po/pp/pe) derivada nas funções de display |
| 2026-04-29 | `storage.ts` como camada abstrata — stores e componentes nunca tocam localStorage diretamente; preparado para migrar para IndexedDB |
| 2026-04-29 | Point buy com mínimo 8 e máximo 15 pré-racial; orçamento de 27 pontos (regra PHB 2014) |
| 2026-05-01 | `excludedLanguages` passado como prop aos painéis de escolha — mantém a lógica de deduplicação no nível do step, não no componente genérico |

---

## Backlog pós-V1

- Magias detalhadas (spell slots, lista de magias por classe)
- Level up (XP, progressão de classe)
- IndexedDB para fichas múltiplas
- Raças e classes homebrew
- Suplementos: Xanathar's Guide, Tasha's Cauldron
