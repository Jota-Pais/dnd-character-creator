# Servidor, conta e sincronização

Desde 2026-11-21 o Criador de Ficha tem back-end, banco e login: a mesma pessoa vê as suas fichas em qualquer aparelho, e o dono tem um banco com as fichas criadas. Este documento é a referência: o que existe, como funciona, o que o dono faz e como publicar.

## 1. As decisões do dono (2026-11-21)

| Tema | Decisão |
|---|---|
| Sem rede | **Offline + sincroniza.** A ficha continua gravada no aparelho e tudo funciona sem rede; com rede, sincroniza com o banco |
| Login | **Obrigatório, sem exceção.** Sem conta ninguém usa o app. Sem internet e sem nunca ter entrado no aparelho, o app não abre |
| Como entrar | **E-mail e senha**, sem confirmação de e-mail e sem "esqueci a senha": o dono redefine por comando |
| Cadastro | **Aberto**: qualquer pessoa com o link cria conta |
| Repositório | **Um só**, com `apps/api` (back) e `apps/web` (front) separados, e o contrato num pacote compartilhado |
| Hospedagem | API na **Render**, banco na **Neon**, site na **Vercel**, no endereço de sempre |
| Front | Reorganizado em camadas (`core ← systems ← features ← app`) |

O que **não** mudou: a origem `https://dnd-character-creator-gamma.vercel.app` (as fichas dos aparelhos e o APK dependem dela), o motor de regras, as regras de D&D e do Ordem, o comportamento do criador e do jogo, a troca de versão do service worker e o APK (nenhum código nativo novo).

## 2. As peças

```
navegador / app instalado / APK
        │  https://dnd-character-creator-gamma.vercel.app
        ▼
   Vercel ── o site (apps/web), estático
        │  /api/*  ── rewrite ──►  Render ── a API (apps/api, Express)
        │                               │
        │                               ▼
        │                           Neon ── Postgres
```

- A API mora em `/api`, **na mesma origem do site**: em produção por um rewrite da Vercel, em desenvolvimento pelo proxy do Vite. O cookie de sessão é de primeira parte e não existe CORS.
- O service worker guarda só o build do site. Nunca responde por `/api` (`navigateFallbackDenylist`, sem `runtimeCaching`; o cliente pede com `cache: 'no-store'`).
- O servidor **não conhece regra de RPG**: guarda o draft e o estado de jogo como JSON e tira dele só o nome, para o dono navegar. Quem entende o conteúdo é o cliente.

| Workspace | O que é |
|---|---|
| `packages/contracts` (`@rpg/contracts`) | O que o site e a API trocam: schemas Zod (o servidor valida com eles), tipos, códigos de erro e limites. O site só leva os tipos e os valores de `constants` (o Zod não entra no navegador) |
| `apps/api` (`@rpg/api`) | Express 5 + Prisma 7 + Postgres. Um módulo por assunto (`auth`, `characters`, `sync`, `health`), três camadas por sufixo: `*.routes.ts` (HTTP e validação), `*.service.ts` (a regra) e `*.repository.ts` (o banco, atrás de uma interface) |
| `apps/web` (`@rpg/web`) | O site. `core/api` (o cliente HTTP), `core/sync` (o diário, a decisão e o motor da sincronização), `features/auth` (conta, telas, portão), `features/sync` (o motor ligado ao app) |

## 3. O banco

Tabelas (snake_case; o schema comentado está em `apps/api/prisma/schema.prisma`):

| Tabela | O que guarda |
|---|---|
| `users` | A conta: `email` (único, em minúsculas), `password_hash` (bcrypt), `change_counter`, `created_at` |
| `sessions` | Um aparelho conectado: `token_hash` (o SHA-256 do token do cookie), `last_seen_at`, `expires_at`, `user_agent` |
| `characters` | Uma ficha de qualquer sistema: `system` (`dnd5e`/`ordem`), `name` (tirado do draft), `step`, `draft` (JSONB), `schema`, `client_updated_at`, `revision`, `change_seq`, `deleted_at` |
| `play_states` | O estado de jogo de uma ficha: `state` (JSONB), `schema`, `client_updated_at`, `revision`, `change_seq` |

- **Ficha apagada vira lápide** (`deleted_at`) e nunca é expurgada: o banco guarda tudo o que foi criado, e o draft da apagada continua lá.
- `revision` é do documento (sobe a cada gravação aceita: é o que detecta conflito). `change_seq` é da conta (sai de `users.change_counter`, na mesma transação e com a linha da conta travada): é o cursor da leitura, e nunca pula uma gravação.
- **A senha não é legível.** Fica só o hash. Não dá para "olhar a senha de alguém no banco": o caminho é gravar uma nova (seção 6).

Para ver as fichas: o painel da Neon (SQL Editor), ou `npm run db:studio -w @rpg/api`. Exemplo:

```sql
select u.email, c.system, c.name, c.updated_at, c.deleted_at
from characters c join users u on u.id = c.user_id
order by c.updated_at desc;
```

## 4. O contrato da API

Tudo em `packages/contracts`. Erro sempre no envelope `{ "error": { "code", "message", "fields"? } }`, com a mensagem em português, pronta para a tela.

| Rota | O que faz |
|---|---|
| `GET /health` | Público, sem banco: é por ele que a Render sabe que a instância subiu |
| `POST /api/auth/register` · `POST /api/auth/login` | `{email, password}` → `{user}` e o cookie de sessão. Senha de 8 a 72 caracteres. 5 erros de senha em 15 minutos travam o e-mail |
| `POST /api/auth/logout` | Encerra a sessão deste aparelho |
| `GET /api/auth/session` | Sempre 200: `{user}` ou `{user: null}` |
| `GET /api/sync/changes?since=<cursor>` | O que mudou na conta desde o cursor (com as lápides), em páginas; `hasMore` |
| `PUT /api/characters/:id` | `{system, step, draft, schema, clientUpdatedAt, baseRevision}` → `{revision}`, ou 409 com a versão do servidor em `current` |
| `DELETE /api/characters/:id?baseRevision=n` | Lápide; 409 se a ficha mudou depois |
| `PUT /api/characters/:id/play-state` | `{state, schema, clientUpdatedAt, baseRevision}`, mesma regra |

- **A sessão** é um cookie `HttpOnly; SameSite=Lax` (e `Secure` em produção) com um token aleatório; o banco guarda só o hash. Vale 180 dias e se renova com o uso (no máximo uma gravação por dia): quem usa o app não é desconectado. O JavaScript da página nunca vê o token, e o aparelho não guarda senha.
- **Pedido que grava** só vale vindo do site (`Origin` conferido contra `APP_ORIGIN`) e, nas rotas de ficha e de sincronização, com o cabeçalho `x-account-id` igual ao usuário da sessão: com duas abas, uma pode trocar de conta enquanto a outra ainda tem as fichas da anterior.
- **Gravar** é dizer de qual revisão se partiu. Na revisão do servidor, entra; atrás dela, 409, e quem decide é o aparelho. Repetir exatamente o mesmo pedido responde a revisão atual (o aparelho que não recebeu a resposta repete sem virar conflito consigo mesmo).
- Códigos: `VALIDATION`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `FORBIDDEN_ORIGIN`, `ACCOUNT_MISMATCH`, `NOT_FOUND`, `CHARACTER_NOT_FOUND`, `EMAIL_TAKEN`, `CONFLICT`, `PAYLOAD_TOO_LARGE` (1 MB por documento), `RATE_LIMITED`, `INTERNAL`.

## 5. A sincronização no aparelho

As fichas continuam no localStorage, como sempre. Ao lado delas mora o **diário** (`app-sync`, `core/sync/syncStorage.ts`): por documento, a revisão do servidor que o aparelho conhece e se há alteração a enviar; mais o cursor da leitura e a conta dona dos dados.

**Quatro ideias sustentam tudo:**

1. **A marca de "mudou" nasce dentro da gravação**, nas três camadas de storage (`saveCharacterEntry`, `deleteCharacterEntry`, `savePlayState`). Nenhum store ou componente precisa lembrar. Só marca quando o conteúdo mudou: navegar entre etapas e abrir o jogo não marcam.
2. **O que vem do servidor só é aplicado com a galeria na tela.** Nada é escrito por cima de ficha ou jogo aberto.
3. **Uma função pura decide** (`core/sync/reconcile.ts`), a mesma na leitura e no 409 de um envio.
4. **A exclusão só sobe quando o jogador apagou.** Biblioteca que some por defeito nunca vira ordem de apagar: a leitura completa traz as fichas de volta.

**O que acontece quando os dois lados mudaram o mesmo documento:**

| No aparelho | No servidor | Resultado |
|---|---|---|
| não mexeu | versão nova | recebe a do servidor |
| não mexeu | apagada | apaga aqui também |
| mexeu | mexeu, mesmo conteúdo | adota a revisão, sem cópia |
| mexeu, mais recente | mexeu | fica a do aparelho; a do servidor vira **cópia** |
| mexeu | mexeu, mais recente | fica a do servidor; a do aparelho vira **cópia** (com a ficha aberta, espera a volta à galeria) |
| mexeu | apagada | a edição ganha: a ficha volta ao servidor |
| apagou | mexeu | a edição ganha: a ficha volta ao aparelho |

"Mais recente" é pelo relógio de cada aparelho. Por isso **a versão que perde nunca some**: vira uma ficha à parte, "Nome (conflito 21/11 14:32)", e a galeria avisa. No estado de jogo, o que perde vira uma cópia da ficha com ele dentro ("Nome (jogo em conflito 21/11 14:32)"). O relógio só decide qual versão fica com o id; nenhuma é descartada.

**Quando sincroniza:** ao entrar, na abertura, quando a rede volta, ao voltar à galeria, 3 s depois da última alteração de ficha, 15 s depois da última do jogo (no máximo 60 s depois da primeira), a cada minuto com a galeria na tela, e ao esconder a página (melhor esforço). Sem conseguir falar com o servidor, tenta de novo em 5 s, 15 s, 60 s e 5 min.

**A linha de conta da galeria** diz em que pé está: "Em dia", "Sincronizando…", "N alterações a enviar", "Sem conexão: N alterações guardadas neste aparelho", "Sessão expirada". O toque nela pede a sincronização agora. As fichas estão sempre no aparelho: nenhuma dessas frases quer dizer que algo se perdeu.

**Aparelhos em versões diferentes do app.** O app instalado só troca de versão na abertura seguinte. Cada documento leva um número `schema`; o app mais velho que recebe um maior que o seu não o aplica nem o regrava (ele apagaria os campos que não conhece), e a galeria pede a atualização. **Campo novo no draft ou no estado de jogo sobe o `schema` do documento** (`DRAFT_SYNC_SCHEMA`, `PLAY_STATE_SYNC_SCHEMA`); o typecheck quebra em `features/sync/__tests__/syncSchema.test.ts` até alguém lembrar.

## 6. A conta no aparelho

- **O portão** (`app/App.tsx`): sem ninguém conectado, o app é a tela de entrar. Decide pelo que o aparelho lembra (`app-account`: só o "quem", sem senha nem token), na hora e sem rede. **Quem já entrou neste aparelho abre o app sem internet**, direto na galeria ou no jogo que estava aberto. O servidor confirma a sessão depois, em segundo plano.
- **Primeiro login num aparelho que já tinha fichas** (todo usuário de antes da conta): as fichas passam a ser da conta que entrar e sobem; as que a conta já tem descem. Nada é apagado antes de o servidor confirmar.
- **Sessão expirada**: o portão não fecha (as fichas estão no aparelho). A sincronização para, e a galeria pede "Entrar de novo".
- **Sair**: tenta mandar antes o que falta. Com tudo no servidor, as fichas saem do aparelho. Com alteração que não subiu, pergunta antes, e, confirmado, não apaga nada: elas ficam guardadas e sobem quando a mesma conta entrar de novo.
- **Outra conta no mesmo aparelho**: se o que há é de outra conta e já subiu, o aparelho é limpo. Se há alteração dela por enviar, ninguém entra por cima: as saídas são entrar como a dona, exportar as fichas, ou descartar com confirmação.

### Os comandos do dono

Da raiz do repositório, com o `.env` de `apps/api` apontando para o banco que se quer mexer:

```bash
npm run user:list -w @rpg/api                              # as contas: e-mail, desde quando, fichas, último uso
npm run user:password -w @rpg/api -- ana@exemplo.com       # o "esqueci a senha": gera uma senha nova e a mostra
npm run user:password -w @rpg/api -- ana@exemplo.com "x"   # ou grava a que você escolher (8 a 72 caracteres)
npm run db:studio -w @rpg/api                              # as tabelas, no navegador
```

Redefinir a senha desconecta todos os aparelhos da conta; a pessoa entra de novo com a senha nova, e as fichas que estavam nos aparelhos continuam neles.

## 7. Rodar no seu computador

```bash
npm run dev:api:local     # a API sem Neon e sem internet (porta 3333), com um Postgres dentro do processo
npm run dev               # o site (porta 5173), que repassa /api para a 3333
```

O banco do modo local mora na memória: ao parar o comando, as contas e as fichas dele somem. Para duas "pessoas", use duas janelas anônimas (ou dois navegadores).

Contra a Neon (o branch `dev`): copie `apps/api/.env.example` para `apps/api/.env`, preencha as duas URLs e rode `npm run dev:api`. As migrations: `npm run db:deploy -w @rpg/api` (aplica as pendentes); para criar uma nova, `npm run db:migrate -w @rpg/api`, **só no branch `dev`**.

Os testes da API não precisam de banco instalado: os de serviço e de rota rodam sobre repositórios em memória, e os dos repositórios do Prisma rodam contra o PGlite (um Postgres de verdade dentro do processo), com as migrations de `prisma/migrations` aplicadas.

## 8. Publicar

A ordem importa: **o login obrigatório não pode chegar aos celulares antes de a API estar no ar.** Por isso o trabalho ficou no branch `arquitetura-front-back`, e a `main` (que publica sozinha) só o recebe no passo 5.

1. **Neon.** *Feito em 2026-11-21:* o projeto `criador-de-ficha` (id `proud-pond-14780351`, região `aws-us-east-2`, Postgres 18), com o branch `main` (produção) e o `dev` (desenvolvimento), e a migration aplicada nos dois. As URLs do `dev` estão em `apps/api/.env`; as do `main` (a *pooled*, com `-pooler`, e a direta), no painel da Neon, em "Connect". Nenhuma das duas vai para o repositório.
2. **Render.** *Feito em 2026-11-22:* o serviço `criador-de-ficha-api` (id `srv-dc14nmff3r2c73bk7mi0`), criado por "New > Blueprint" com o branch `arquitetura-front-back` (o `render.yaml` da raiz descreve o serviço, e por enquanto manda a API subir desse mesmo branch). O painel pediu `DATABASE_URL` (a pooled) e `DATABASE_URL_UNPOOLED` (a direta), do branch `main` da Neon. O build aplica as migrations pendentes (`db:deploy`).
3. **Conferir.** *Feito em 2026-11-22:* `https://criador-de-ficha-api.onrender.com/health` responde `{"status":"ok","environment":"production",…}`; o login lê o banco (conta que não existe: 401), o pedido que grava vindo de outra origem é recusado (403) e a sincronização sem sessão também (401). A URL pública é a que o painel da Render mostra no topo da página do serviço; ela sai do `name` do `render.yaml`.
4. **Vercel.** *Feito em 2026-11-22:* o `vercel.json` da raiz repassa `/api/:path*` para `https://criador-de-ficha-api.onrender.com/api/:path*`, com o cabeçalho `x-vercel-enable-rewrite-caching: 0` (a API também responde `Cache-Control: no-store`). `app/__tests__/viteConfig.test.ts` prende os dois. As prévias da Vercel ficam atrás do login da Vercel e têm outra origem: lá, o que grava é recusado pela API (`APP_ORIGIN`), e só a produção conversa com ela.

5. **Merge na `main`** e push (a conta `Jota-Pais` no `gh`), com o `render.yaml` voltando a dizer `branch: main` no mesmo merge, e o mesmo commit enviado aos dois branches de uma vez (`git push origin main arquitetura-front-back`): o Blueprint lê o `render.yaml` do branch a que foi ligado (`arquitetura-front-back`), e é por lá que o serviço fica sabendo que passa a acompanhar a `main`. A Vercel publica o site com o login. Depois, no painel da Render, ligar o próprio Blueprint à `main` (Blueprints › o do serviço › Settings › branch), para o branch de trabalho poder ser apagado; conferir na página do serviço que o branch dele é a `main`.
6. **Conferir em produção**: `https://dnd-character-creator-gamma.vercel.app/api/auth/session` responde `{"user":null}`; criar a conta; ver a ficha num segundo aparelho.
7. **Avisar a turma**: abrir o app **com internet** e criar a conta antes da próxima sessão. Sem conta e sem rede, o app não abre (decisão do dono); as fichas de cada aparelho continuam guardadas e sobem para a conta de quem entrar.

Depois de publicado, cada push na `main` que toque `apps/api`, `packages/contracts` ou o núcleo do motor refaz o deploy da API sozinho (`buildFilter` do `render.yaml`). **Variável de ambiente nova** entra no painel da Render antes do merge que a exige: sem ela o boot cai.

### Limites conhecidos

- **O plano gratuito da Render dorme sem uso.** O primeiro pedido depois de um tempo parado pode levar até um minuto. Como a ficha está no aparelho, isso só pesa ao entrar (a tela avisa "o servidor está acordando") e atrasa a sincronização em segundo plano.
- **Duas abas no mesmo aparelho editando a mesma ficha**: a última gravação ganha, como antes da conta.
- O navegador escreve no console toda resposta 4xx (a senha errada, o 409 de um conflito): é o registro do pedido, não um erro do app.

## 9. Roteiro no aparelho (depois de publicar)

O que os testes automáticos não alcançam:

- [ ] **APK do Android**: entrar, fechar o app pelos recentes, abrir de novo: continua conectado (o cookie sobrevive ao encerramento do WebView).
- [ ] **APK, sem rede**: modo avião, abrir o app: galeria com as fichas, "Sem conexão…"; jogar; voltar a rede: "Em dia".
- [ ] **iPhone, app da tela de início**: entrar; as fichas da conta aparecem (o app instalado guarda à parte do Safari). Depois de 7 dias sem abrir, conferir se continua conectado.
- [ ] **Dois aparelhos**: mudar a mesma ficha nos dois sem rede; ao voltar, a cópia de conflito aparece nos dois, com o aviso.
- [ ] **Usuário antigo**: num aparelho que já tinha fichas antes da conta, criar a conta: as fichas continuam lá e aparecem no segundo aparelho.
- [ ] **Primeiro acesso do dia**: o aviso de "servidor acordando" aparece e o login conclui.

## 10. Como foi conferido (2026-11-21)

- **Testes**: 162 arquivos, 3.709 testes. Os da API cobrem as regras (sobre repositórios em memória) e o SQL de produção (sobre o PGlite, com a migration aplicada). Os do motor de sincronização rodam contra um servidor e aparelhos de mentira, incluindo dois roteiros aleatórios com semente em que os dois aparelhos terminam iguais ao servidor e nenhuma versão gravada se perde.
- **No navegador (Edge, pelo playwright-core), contra a API local**: dois contextos (dois aparelhos) da mesma conta. A conta criada num aparelho que já tinha fichas; o segundo aparelho recebendo tudo, idêntico; criar e apagar chegando ao outro; jogar sem rede e sincronizar na volta; o conflito com a cópia e o aviso; sair e entrar de novo; cookie `HttpOnly`; console sem erros.
- **Contra a Neon** (o branch `dev`, com a API rodando local): o que o Postgres embutido não mostra, por atender uma conexão só. Cinco gravações da mesma ficha ao mesmo tempo, da mesma base: só uma entra, e as outras quatro recebem a versão que ganhou; vinte fichas criadas ao mesmo tempo: todas entram, e o cursor sai sem buraco. O roteiro de dois aparelhos no navegador passou inteiro também assim, e os dois comandos do dono (listar contas, redefinir senha) foram exercitados.
- **No build de produção, com o service worker**: sem rede o app abre direto na galeria com a conta lembrada; `/api` não é respondido pelo service worker; criar ficha e jogar funcionam; recarregar no meio do jogo volta ao jogo; tudo sobe quando a rede volta.
- **A reorganização do front** foi movimento puro: os testes passaram sem mudar asserção, e o build saiu com os mesmos hashes de antes.
