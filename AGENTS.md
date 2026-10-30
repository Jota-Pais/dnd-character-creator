# D&D Character Creator — AGENTS.md

## Visão do Produto

Qualquer pessoa que decida jogar D&D — mesmo pela primeira vez — deve conseguir criar uma ficha em **poucos minutos**, sem assistir a vídeos nem ler centenas de páginas de regras, mantendo **controle total das próprias escolhas** e vivendo uma experiência **gamificada e prazerosa**.

Toda decisão de produto e design serve a esse objetivo: guiar o iniciante sem tirar dele o controle, esconder a complexidade das regras (mas nunca as escolhas) e tornar a criação um momento divertido — não uma lição de casa.

## Stack

- **Vite** + **React 19** + **TypeScript estrito**
- **React Compiler** (memoização automática)
- **Tailwind v4**
- **Zustand** (gerenciamento de estado)
- **Vitest** (testes unitários)

## Arquitetura

- **SPA front-end pura**, sem backend
- Persistência local no navegador (localStorage na V1, possivelmente IndexedDB no futuro)
- **Sistemas Multi-RPG (Arquitetura Modular):** O núcleo da aplicação (`core/`) é completamente agnóstico de regras de negócio. Todos os dados, regras e telas específicas ficam isolados nos seus respectivos módulos de sistema (ex: `systems/dnd5e`) — as regras no motor (`packages/rules`), as telas no site (`apps/web`).
- Deploy estático na Vercel (`vercel.json` na raiz), com CI de lint, testes e build no GitHub Actions
- Sem servidor por enquanto: não sugerir API routes, server actions ou arquitetura com servidor próprio. O servidor (conta e sincronização) é plano do dono para depois, e o motor de regras já fica pronto para ele
- App instalável e sem rede (iPhone pela tela de início, Android pelo APK que abre o site publicado): service worker que guarda só o que é do site, versão nova só na próxima abertura (nunca recarrega no meio do jogo), margens de área segura no que fica fixo nas bordas. Ver `docs/app-instalavel.md`
- APK do Android (`apps/mobile`, Capacitor 8): casca que abre o site publicado (origem fixa, as fichas moram nela); código do site só do APK em `apps/web/src/core/native` (`isNativeApp()`); o voltar do Android pelo `useBackHandler` (folha e menu na camada `overlay`); chave de assinatura nunca no repositório. Ver `docs/app-android.md`

## Versão de D&D

- **D&D 5e clássico — PHB de 2014**
- Não misturar regras do PHB 2024 / "One D&D" sem confirmação explícita do usuário
- Suplementos (Xanathar, Tasha, etc.) ficam fora do escopo até decisão explícita

## Escopo da V1

- Fichas de **nível 1 a 20**, com **multiclasse no D&D 5e** (PHB 2014, cap. 6; ver `docs/regras-multiclasse.md`)
- Pontos de vida por dois métodos: **média** (`average`) ou **rolagem** (`roll`) dos dados de vida acima do nível 1
- Raças e classes do livro básico (PHB 2014)
- Sistema de magias (truques e magias por nível, slots, CD e bônus de ataque derivados do nível)
- Fluxo de criação completo (9 passos):
  1. Nome (e nível)
  2. Raça
  3. Classe
  4. Atributos
  5. Aprimoramentos (ASI/talentos; apenas para níveis com espaço de ASI, ou Humano Variante)
  6. Magias (apenas para conjuradores; após Atributos/Aprimoramentos para o jogador já conhecer os modificadores finais)
  7. Antecedente
  8. Equipamento
  9. Revisão
- Salvar/carregar localmente
- Exportar/importar ficha como JSON (portabilidade entre dispositivos)

**Fora do escopo da V1:** evolução de personagem em sessão (level up dinâmico / XP), suplementos, raças/classes homebrew. (Multiclasse **entrou** no escopo em 2026-07-14, para o D&D 5e.)

## Estrutura de Pastas

Workspaces npm; todo comando roda da raiz (`npm run dev`, `build`, `test`, `lint`, `typecheck`).

packages/rules/src/   # @rpg/rules: o motor, puro (sem React, zustand nem API do navegador; testes em node)
 ├─ core/             # dice (motor de dados), utils (id, canonicalJson)
 ├─ systems/          # data, types e utils de cada sistema (dnd5e, ordem), com os testes
 └─ test/fixtures.ts
apps/web/src/         # @rpg/web: o site (importa o motor como @rpg/rules/<caminho>)
 ├─ core/             # tipos do IRpgSystem, registro dos sistemas, AppStore, galleryGrouping
 ├─ components/       # Design System / UI Genérica (Componentes sem regras de negócios)
 └─ systems/          # components, stores e storage.ts / playStorage.ts (localStorage) de cada sistema
apps/mobile/          # @rpg/mobile: o APK do Android (Capacitor; android/, a página de erro em www/)
docs/                 # Regras digitalizadas em markdown
scripts/              # gravam nos dados do motor (packages/rules/src/systems/<sistema>/data)

Arquivo novo vai ao motor quando é regra e não precisa de tela; o que importa React ou zustand, toca API do navegador ou tem classe do Tailwind fica no site. O site importa o motor, nunca o contrário (o ESLint, que recusa no pacote `.tsx` e import, também por `import()`, de React, zustand, Capacitor e do site, e o tsconfig do pacote, sem a lib DOM nem os tipos do Vite, cobram). No Node, o motor entra por um bundler ou carregador de TS (o Vitest hoje): o Node puro não o carrega.

## Convenções de Código

- Componentes funcionais com hooks, sem class components
- **PascalCase** para componentes (`CharacterSheet.tsx`)
- **camelCase** para utilitários e funções (`calculateModifier.ts`)
- TypeScript estrito (`strict: true` no tsconfig)
- Prettier + ESLint configurados
- Commits pequenos e atômicos
- Código (variáveis, funções, tipos, nomes de arquivo) em **inglês**

## Idioma

- **Código:** inglês
- **Mensagens de commit, comentários e docs:** português
- **Interface do app:** português

## Persistência

- Toda leitura/escrita de ficha deve passar pela camada de storage do próprio sistema: `apps/web/src/systems/<sistema>/utils/storage.ts` (no site; o motor não conhece o navegador)
- A V1 implementa essa camada usando localStorage
- Componentes e stores **nunca** acessam localStorage diretamente
- Isso permite migrar para IndexedDB no futuro sem refatorar a aplicação

## Fontes da Verdade

- **Conceitual:** o livro PHB 2014 (referência humana, fora do projeto)
- **Documental:** arquivos em `/docs` (regras digitalizadas em markdown, referência intermediária)
- **Operacional:** JSONs em `packages/rules/src/systems/<sistema>/data` (consumidos pela aplicação em runtime)

Em caso de divergência, voltar à fonte conceitual (o livro).

## Testes

- Cobertura **obrigatória** para:
  - Cálculos de modificadores de atributo
  - Bônus de proficiência
  - Fórmulas de derivação (pontos de vida iniciais, CA base, CD de magia)
  - Funções de validação de regras (ex: pré-requisitos, limites)
- Cobertura **recomendada** para utilitários puros em geral
- Componentes de UI: testar comportamento crítico (ex: fluxo de seleção), não cobertura exaustiva

## Workflow do Codex

1. **Sempre propor um plano antes de implementar** — aguardar aprovação do usuário
2. **Nunca chutar regras de D&D** — perguntar ao usuário se houver dúvida sobre uma regra; consultar `/docs` quando o trecho relevante já tiver sido digitalizado
3. **Commitar a cada feature concluída** — commits atômicos com mensagem em português
4. **Atualizar este AGENTS.md** quando novas decisões arquiteturais surgirem, em commit dedicado com prefixo `docs:`

## Definição de Pronto (Definition of Done)

Uma feature está pronta quando:

- Implementação concluída
- Tipos TypeScript corretos e estritos
- Testes escritos (quando aplicável conforme seção "Testes")
- Funciona localmente sem erros no console
- Commit feito com mensagem clara em português
