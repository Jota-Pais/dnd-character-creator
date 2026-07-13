# ⚒️ Forja de Heróis — Criador de Fichas de RPG

Um aplicativo web pra criar fichas de RPG de mesa em **poucos minutos**, mesmo sem nunca ter aberto o livro de regras: um assistente guiado passo a passo esconde a complexidade das regras (mas nunca as escolhas), calcula tudo sozinho e entrega uma ficha pronta pra imprimir e levar pra mesa.

Hoje a Forja suporta **dois sistemas completos**, e a arquitetura foi desenhada pra receber outros.

## 🎲 Sistemas Suportados

### D&D 5ª Edição (Livro do Jogador 2014)
- Fichas de **nível 1 a 20**, fiéis ao PHB 2014 (sem regras do One D&D / 2024).
- Fluxo em 8 passos: Nome e nível → Raça → Classe → Atributos → Magias → Antecedente → Equipamento → Revisão.
- Todas as raças e classes do livro básico, com traços, proficiências, subclasses e progressão completa (ASI, Ataque Extra, recursos por nível).
- Sistema de magias completo: truques e magias conhecidas/preparadas, espaços por nível, CD e bônus de conjuração derivados.
- Atributos por array padrão, compra de pontos, rolagem (4d6) ou valores personalizados; PV por média ou rolagem.
- Equipamento inicial por pacotes de classe ou compra com ouro rolado.

### Ordem Paranormal RPG
- Agentes completos de **NEX 5% a 99%**: origem, classe, trilha, poderes, aumentos de atributo, graus de treinamento e Versatilidade.
- **Rituais** com elementos, círculos, custos em PE (com reduções de Ritual Predileto e Lâmina Maldita) e DT calculada.
- **Equipamento com Patente**: limites de requisição por categoria (com vagas flexíveis — item menor ocupa vaga maior), capacidade de carga, **modificações** (Tabelas 3.5/3.7/3.9) e **itens amaldiçoados** (maldições com elementos opressores, tudo dobrado nos números da ficha).
- Itens paranormais da Tabela 3.10, incluindo componentes ritualísticos com aviso automático pra conjuradores.
- Múltiplas unidades do mesmo item (dois revólveres com maldições diferentes, cada um com sua linha de ataque).
- Ficha imprimível em **2 páginas no formato da Ficha de Agente oficial**, com tabela completa de perícias, ataques por arma e inventário.

## ✨ Funcionalidades Gerais

- **Assistente guiado com validação em tempo real** — não dá pra avançar com um passo incompleto, e o stepper permite voltar a qualquer etapa já preenchida, em ordem livre.
- **Galeria unificada de personagens** dos dois sistemas, com salvamento automático local (localStorage).
- **Exportar/importar fichas em JSON** pra portabilidade entre dispositivos.
- **Ficha imprimível / exportável em PDF** direto do navegador, com o nome do arquivo no padrão "Personagem — Sistema".
- **Fidelidade aos livros**: os dados são digitalizados das fontes oficiais e auditados; mais de 570 testes automatizados cobrem fórmulas de derivação, validações e regras.

## 🛠️ Stack

- **[React 19](https://react.dev/)** + **React Compiler** (memoização automática)
- **[TypeScript](https://www.typescriptlang.org/)** estrito
- **[Vite](https://vitejs.dev/)**
- **[Tailwind CSS v4](https://tailwindcss.com/)**
- **[Zustand](https://zustand-demo.pmnd.rs/)** (estado global)
- **[Vitest](https://vitest.dev/)** + Testing Library (testes)

SPA 100% front-end, sem backend — pronta pra deploy estático.

## 📁 Arquitetura

O núcleo é **agnóstico de sistema**: cada RPG é um módulo plugável.

```
src/
 ├─ core/       # Motor agnóstico: tipos base, registro de sistemas, estado global
 ├─ components/ # Design system / UI genérica (sem regras de negócio)
 └─ systems/    # Módulos de RPG (plugins)
     ├─ dnd5e/  # D&D 5e: data (JSONs do PHB), types, utils, stores e componentes
     └─ ordem/  # Ordem Paranormal: idem, com dados digitalizados do livro
docs/           # Regras digitalizadas em markdown + rastreador de playtest
```

Cada módulo define seus passos do wizard, validações, dados e ficha imprimível; o core só orquestra.

## 🚀 Como Executar Localmente

Pré-requisitos: [Node.js](https://nodejs.org/) 18+ e npm.

```bash
git clone https://github.com/Jota-Pais/dnd-character-creator.git
cd dnd-character-creator
npm install
npm run dev
```

O app abre em `http://localhost:5173/`.

## 📝 Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — checagem de tipos (`tsc -b`) + build de produção
- `npm run test` — testes com Vitest
- `npm run lint` — ESLint

## 📜 Notas Legais

Projeto de estudo e uso pessoal, sem fins comerciais. **Dungeons & Dragons** e todo o conteúdo relacionado são propriedade da Wizards of the Coast. **Ordem Paranormal RPG** é criação de Rafael Lange (Cellbit), publicado pela Jambo Editora. Este projeto não reproduz os livros — apenas implementa as mecânicas necessárias pra criação de fichas; adquira os livros oficiais.
