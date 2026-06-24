# 🎲 Criador de Personagem - D&D 5e (PHB 2014)

<p align="center">
  <img src="src/assets/hero.png" alt="Criador de Personagem D&D 5e" width="100%">
</p>

Um aplicativo web moderno, intuitivo e responsivo para criação de personagens de Dungeons & Dragons 5ª Edição, baseado nas regras do Player's Handbook (Livro do Jogador) de 2014.

## ✨ Funcionalidades

- **Criação Passo a Passo**: Um assistente (wizard) guiado e fluido para montar seu personagem de forma progressiva.
  - 📝 **Nome**: Defina a identidade do seu aventureiro.
  - 🧝 **Raça**: Escolha suas origens e receba traços raciais, aumento de atributos e proficiências.
  - ⚔️ **Classe**: Defina seu caminho heroico, proficiências, equipamentos iniciais e habilidades de classe.
  - 🎲 **Habilidades**: Gere e distribua seus atributos (Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma).
  - 📜 **Antecedente**: Descubra a história e origem do seu personagem antes da aventura.
- **Validação em Tempo Real**: O sistema guia o usuário e evita que etapas fiquem incompletas.
- **Design Temático e Imersivo**: Interface rica e responsiva, utilizando estilos e paletas de cores que remetem a pergaminhos, ouro e fantasia clássica.

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído utilizando as ferramentas mais modernas do ecossistema front-end:

- **[React 19](https://react.dev/)**: Biblioteca poderosa para construção da interface de usuário com componentes.
- **[TypeScript](https://www.typescriptlang.org/)**: Superset do JavaScript que adiciona tipagem estática e maior segurança ao código.
- **[Vite](https://vitejs.dev/)**: Build tool e bundler ultrarrápido para uma excelente experiência de desenvolvimento.
- **[Tailwind CSS v4](https://tailwindcss.com/)**: Framework CSS utilitário para estilização rápida, consistente e responsiva.
- **[Zustand](https://zustand-demo.pmnd.rs/)**: Gerenciamento de estado global da aplicação de forma leve e direta (sem boilerplate desnecessário).

## 📁 Estrutura do Projeto

Abaixo uma visão geral da organização do código-fonte (`/src`):

- `/components`: Componentes visuais do React, organizados em subdiretórios:
  - `/steps`: Telas específicas de cada passo do assistente de criação.
  - `/wizard`: Componentes de controle do assistente (ex: indicador de progresso).
  - Componentes de UI menores (botões, cards, etc.).
- `/stores`: Lógica de gerenciamento de estado global com Zustand (ex: `characterStore.ts`).
- `/data`: Estruturas de dados estáticos e catálogos baseados nas regras de D&D.
- `/types`: Definições globais de tipos e interfaces do TypeScript para garantir a integridade dos dados.
- `/utils`: Funções utilitárias.
- `/docs`: Documentação adicional e transcrição em Markdown das regras utilizadas no projeto.

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- npm (ou outro gerenciador de pacotes como yarn/pnpm)

### Instalação e Execução

1. Clone o repositório ou faça o download dos arquivos:
   ```bash
   git clone <url-do-repositorio>
   cd dnd-character-creator
   ```

2. Instale as dependências do projeto:
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. O aplicativo estará disponível no navegador, geralmente no endereço `http://localhost:5173/`.

## 📝 Scripts Disponíveis

- `npm run dev`: Inicia o servidor local de desenvolvimento.
- `npm run build`: Faz a checagem de tipos (`tsc`) e gera a build de produção otimizada.
- `npm run lint`: Executa o ESLint para encontrar e reportar problemas no código.
- `npm run test`: Executa os testes automatizados com o Vitest.

## 📄 Licença

O **código** deste projeto está sob a licença MIT — veja [`LICENSE`](LICENSE).

## 📜 Notas Legais

Este projeto foi criado para fins de estudo e uso pessoal. O conteúdo relacionado a Dungeons & Dragons, como nomes, regras e mecânicas, é de propriedade intelectual da Wizards of the Coast.
