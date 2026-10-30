# ⚒️ Forja de Heróis — Criador de Fichas de RPG

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

SPA 100% front-end, sem backend, num repositório com workspaces npm: o motor de regras (`packages/rules`, TypeScript puro, sem tela, que roda no navegador e no Node por um bundler ou carregador de TS), o site (`apps/web`) e o APK do Android (`apps/mobile`, Capacitor, que abre o site publicado). A arquitetura é modular: o núcleo (`core/`) é agnóstico de regras, e cada sistema é um plugin em `systems/` — pronto pra receber outros RPGs.

## 🚀 Como Executar

Pré-requisitos: [Node.js](https://nodejs.org/) 20+ e npm.

```bash
git clone https://github.com/Jota-Pais/dnd-character-creator.git
cd dnd-character-creator
npm install
npm run dev
```

O app abre em `http://localhost:5173/`. Outros scripts, todos da raiz: `npm run build` (saída em `apps/web/dist`), `npm run test`, `npm run lint`, `npm run typecheck`.

## 📜 Notas Legais

Projeto de estudo e uso pessoal, sem fins comerciais. **Dungeons & Dragons** é propriedade da Wizards of the Coast; **Ordem Paranormal RPG** é criação de Rafael Lange (Cellbit), publicado pela Jambo Editora. Este projeto não reproduz os livros — adquira as obras oficiais.
