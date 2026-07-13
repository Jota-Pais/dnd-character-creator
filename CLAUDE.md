# D&D Character Creator — CLAUDE.md

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
- **Sistemas Multi-RPG (Arquitetura Modular):** O núcleo da aplicação (`src/core`) é completamente agnóstico de regras de negócio. Todos os dados, regras e telas específicas ficam isolados nos seus respectivos módulos de sistema (ex: `src/systems/dnd5e`).
- Deploy estático (Vercel/Netlify) quando chegar a hora
- Não sugerir API routes, server actions ou qualquer arquitetura com servidor próprio

## Versão de D&D

- **D&D 5e clássico — PHB de 2014**
- Não misturar regras do PHB 2024 / "One D&D" sem confirmação explícita do usuário
- Suplementos (Xanathar, Tasha, etc.) ficam fora do escopo até decisão explícita

## Escopo da V1

- Fichas de **nível 1 a 20** (uma única classe; sem multiclasse)
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

**Fora do escopo da V1:** multiclasse, evolução de personagem em sessão (level up dinâmico / XP), suplementos, raças/classes homebrew.

## Estrutura de Pastas

src/
 ├─ core/       # Motor agnóstico, tipos base, gerenciamento de estado global (AppStore)
 ├─ components/ # Design System / UI Genérica (Componentes sem regras de negócios)
 └─ systems/    # Módulos de RPG (Plugins)
     ├─ dnd5e/  # Todo o universo do D&D (data, utils, types, stores e components específicos)
     └─ ordem/  # (Futuro) Arquivos do Ordem Paranormal
 docs/          # Regras digitalizadas em markdown

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

- Toda leitura/escrita de ficha deve passar por uma camada abstraída em `/src/utils/storage.ts`
- A V1 implementa essa camada usando localStorage
- Componentes e stores **nunca** acessam localStorage diretamente
- Isso permite migrar para IndexedDB no futuro sem refatorar a aplicação

## Fontes da Verdade

- **Conceitual:** o livro PHB 2014 (referência humana, fora do projeto)
- **Documental:** arquivos em `/docs` (regras digitalizadas em markdown, referência intermediária)
- **Operacional:** JSONs em `/src/data` (consumidos pela aplicação em runtime)

Em caso de divergência, voltar à fonte conceitual (o livro).

## Testes

- Cobertura **obrigatória** para:
  - Cálculos de modificadores de atributo
  - Bônus de proficiência
  - Fórmulas de derivação (pontos de vida iniciais, CA base, CD de magia)
  - Funções de validação de regras (ex: pré-requisitos, limites)
- Cobertura **recomendada** para utilitários puros em geral
- Componentes de UI: testar comportamento crítico (ex: fluxo de seleção), não cobertura exaustiva

## Workflow do Claude Code

1. **Sempre propor um plano antes de implementar** — aguardar aprovação do usuário
2. **Nunca chutar regras de D&D** — perguntar ao usuário se houver dúvida sobre uma regra; consultar `/docs` quando o trecho relevante já tiver sido digitalizado
3. **Commitar a cada feature concluída** — commits atômicos com mensagem em português
4. **Atualizar este CLAUDE.md** quando novas decisões arquiteturais surgirem, em commit dedicado com prefixo `docs:`

## Definição de Pronto (Definition of Done)

Uma feature está pronta quando:

- Implementação concluída
- Tipos TypeScript corretos e estritos
- Testes escritos (quando aplicável conforme seção "Testes")
- Funciona localmente sem erros no console
- Commit feito com mensagem clara em português
