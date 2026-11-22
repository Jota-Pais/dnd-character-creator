# ⚒️ Criador de Ficha — fichas de RPG de mesa

Aplicativo web pra criar fichas de RPG de mesa em poucos minutos, mesmo sem conhecer as regras: um assistente guiado conduz cada escolha, calcula tudo sozinho e entrega uma ficha pronta pra imprimir e levar pra mesa.

**🌐 Acesse online:** [dnd-character-creator-gamma.vercel.app](https://dnd-character-creator-gamma.vercel.app/)

## 🎲 Sistemas

- **D&D 5ª Edição (PHB 2014)** — personagens do nível 1 ao 20, com raças, classes, magias, antecedentes e equipamento do livro básico.
- **Ordem Paranormal RPG** — agentes de NEX 5% a 99%, com origens, classes, trilhas, poderes, rituais e equipamento completo (Patente, modificações e itens amaldiçoados).

## ✨ Funcionalidades

- Assistente passo a passo com validação em tempo real e navegação livre entre etapas.
- Galeria de personagens com salvamento automático no navegador.
- Instalável no celular e funciona sem internet depois da primeira visita ([como funciona](docs/app-instalavel.md)): no iPhone, pela tela de início; no Android, como APK ([app do Android](docs/app-android.md)).
- Exportar/importar fichas em JSON, uma a uma ou todas num arquivo só.
- Ficha imprimível / exportável em PDF.
- Regras digitalizadas das fontes oficiais, cobertas por mais de 1.100 testes automatizados.

## 🛠️ Stack

React 19 + TypeScript estrito · Vite · Tailwind CSS v4 · Zustand · Vitest.

Front e back separados, num repositório com workspaces npm: o motor de regras (`packages/rules`, TypeScript puro, sem tela, que roda no navegador e no Node por um bundler ou carregador de TS), o site (`apps/web`), a API de conta e sincronização (`apps/api`, Express + Prisma + Postgres), o contrato entre os dois (`packages/contracts`) e o APK do Android (`apps/mobile`, Capacitor, que abre o site publicado). A ficha fica no aparelho e o app funciona sem internet; com conta, as fichas aparecem em qualquer aparelho (`docs/servidor-e-sincronizacao.md`). A arquitetura é modular: o núcleo (`core/`) é agnóstico de regras, e cada sistema é um plugin em `systems/` — pronto pra receber outros RPGs.

## 🚀 Como Executar

Pré-requisitos: [Node.js](https://nodejs.org/) 22+ e npm.

```bash
git clone https://github.com/Jota-Pais/dnd-character-creator.git
cd dnd-character-creator
npm install
npm run dev:api:local   # a API, com um banco de teste na memória (num terminal)
npm run dev             # o site (em outro)
```

O app abre em `http://localhost:5173/`, na tela de criar conta. A API do modo local não precisa de banco instalado nem de internet, e esquece tudo ao ser encerrada; para usar um Postgres de verdade (Neon), veja `docs/servidor-e-sincronizacao.md`. Outros scripts, todos da raiz: `npm run build` (o site, saída em `apps/web/dist`), `npm run build:api`, `npm run test`, `npm run lint`, `npm run typecheck`.

## 📜 Notas Legais

Projeto de estudo e uso pessoal, sem fins comerciais. **Dungeons & Dragons** é propriedade da Wizards of the Coast; **Ordem Paranormal RPG** é criação de Rafael Lange (Cellbit), publicado pela Jambo Editora. Este projeto não reproduz os livros — adquira as obras oficiais.
