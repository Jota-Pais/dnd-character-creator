# App instalável e sem rede

> O site publicado (`https://dnd-character-creator-gamma.vercel.app`) vira app no celular, por decisão do dono de 2026-10-29: no **iPhone**, o site instalado pela tela de início (sem App Store); no **Android**, o APK distribuído direto, que abre o mesmo site (`docs/app-android.md`; o Chrome não oferece sozinho instalar o site, ver a seção 1). Feito em 2026-10-29 e 2026-10-30.
>
> **A origem não pode mudar.** As fichas moram no localStorage dela, o service worker e o cache também, e o APK abre esse endereço. Domínio novo é app novo, com a galeria vazia.

## 1. Como funciona

- **Manifesto** (`apps/web/public/manifest.webmanifest`): "Forja de Heróis", nome curto "Forja" (a tela de início corta por volta de 12 caracteres), `standalone`, início e escopo em `/`, cores do fundo do tema (`#0e0a06`) e ícones 192 e 512, comuns e maskable. No iPhone, o ícone é o `apple-touch-icon` (180 px), e o modo de tela cheia e a barra de status preta (o conteúdo começa abaixo dela) vêm das metas `apple-*` do `index.html`. O `manifest.test.ts` confere os campos, os ícones e as ligações.
- **Ícones**: o d20 do favicon sobre o fundo do tema (ícone de tela de início é opaco). Os PNGs ficam versionados em `apps/web/public/icons`; quando o favicon mudar, `node scripts/make-icons.mjs` os desenha de novo (precisa do Edge ou do Chrome instalado).
- **Fontes do próprio site**: Cinzel e Lora vêm dos pacotes `@fontsource-variable` (OFL), não do Google. Entram no cache junto com o build, sem pedido a terceiros, e só os subconjuntos que o texto usa descem (`unicode-range`).
- **Service worker** (`vite-plugin-pwa` com o Workbox, gerado no build como `/sw.js`; a configuração está no `apps/web/vite.config.ts`). Guarda o build inteiro: HTML, JS (o da abertura e os pedaços sob demanda, seção 5), CSS, fontes, ícones e a imagem do Ordem (27 arquivos, ~2,7 MB). Ficam de fora os subconjuntos cirílico e vietnamita das fontes, que o português não usa. Toda navegação abre o `index.html` guardado, e a versão nova apaga o cache da velha. Só entra no cache o que é do site: nenhum cache de outro domínio.
- **Registro** (`apps/web/src/core/pwa/serviceWorker.ts`, chamado no `main.tsx`): só no build de produção (no `npm run dev` não há SW, que guardaria código velho) e só depois do `load`, para a primeira abertura não dividir a rede com o SW baixando o build.
- **No Android, o app é o APK** (2026-10-30). Sozinho, o Chrome do Android ofereceria instalar o site (a barrinha de instalar), e o que ele instala é um segundo "Forja", com as fichas à parte das do APK. Fora do APK, no Android, a página recusa o `beforeinstallprompt` (`refuseAutomaticInstallOffer`, `core/pwa/platform.ts`), e a oferta automática não aparece. O "Instalar app" do menu do Chrome continua: é escolha de quem o procura, e a página não tem como tirá-lo. No computador e no iPhone nada muda, e o manifesto fica (o iPhone precisa dele). O Chrome em modo computador (o padrão nos tablets grandes, e o "Site para computador" do celular) se apresenta como Linux de mesa: o site reconhece o Android pela tela de toque, como o iPad que se diz Mac (`isAndroid`; não conferido num tablet de verdade, e o Linux de mesa com tela de toque também fica sem a oferta automática).
- **Área segura**: com `viewport-fit=cover`, a página vai até as bordas. O `body` leva as margens `env(safe-area-inset-*)`, e uma capa (`body::before`) cobre o que rola por baixo da barra de status do Android de ponta a ponta. O que fica fixo nas bordas soma a margem: os vitais do jogo, o aviso do pé, as folhas e o rodapé do criador. Sem entalhe nem barra, as margens valem 0.

## 2. Como atualiza

Cada push na `main` vai para a Vercel e chega ao celular sozinho, sem APK novo. O APK só muda quando muda a parte nativa.

1. A Vercel publica um `sw.js` novo, porque a lista de arquivos com revisão muda a cada build.
2. Na abertura seguinte do app, o navegador procura o `sw.js`. A Vercel o serve com `max-age=0, must-revalidate`, então ele não fica preso em cache. O app que volta do segundo plano sem ser fechado também procura, no máximo uma vez por hora (`checkForUpdateOnReturn`); no APK do Android, também o que vai para o segundo plano, no mesmo limite. A procura que falha (sem rede) não gasta a hora: a próxima volta procura de novo. Achando, o SW novo baixa a versão nova inteira e **espera**.
3. A página aberta continua na versão velha: **no criador e no jogo, nada recarrega, nunca**. A galeria mostra "Versão nova do app pronta", com "Atualizar agora" para quem quiser na hora (`GalleryNotices.tsx`; no APK do Android, "Atualização pronta"). Só a galeria recarrega: no navegador e no iPhone, só pelo toque; no APK, também sozinha, quando o app volta do segundo plano para a galeria sem nada aberto (`applyUpdateOnReturn`; as condições em `docs/app-android.md`).
4. Quando nenhuma página usa mais a versão velha, a nova assume. Isso acontece na próxima abertura, com o app fechado de verdade: no Android e no iPhone, tirado da lista de apps recentes. Trocar de app não fecha.

Por isso uma publicação leva **duas aberturas** para valer: a primeira baixa, a segunda usa. No APK, a que usa é, em geral, a volta à galeria depois de uma ida ao segundo plano. Sem rede, o app abre a última versão guardada, e a procura falha em silêncio até a próxima.

Depois da primeira publicação com o SW, confira com `curl -I https://dnd-character-creator-gamma.vercel.app/sw.js`: deve vir `cache-control: public, max-age=0, must-revalidate`. É o padrão da Vercel para arquivo sem hash, conferido no `/favicon.svg` em 2026-10-30. Se não vier, o `vercel.json` ganha o cabeçalho.

## 3. Dados no aparelho

- **Onde moram as fichas**: no localStorage da origem, pelas camadas de storage de cada sistema (`dnd-character-library`, `ordem-character-library`, `dnd-play-states` e as do jogo). O que o app guarda do aparelho fora das fichas (a resposta do armazenamento persistente e os avisos da galeria) fica em `app-device` (`core/utils/deviceStorage.ts`). Perder o `app-device` só faz um aviso voltar.
- **Armazenamento persistente**: o app pede `navigator.storage.persist()` na primeira gravação de ficha da sessão, nunca ao abrir (`core/pwa/persistentStorage.ts`). No Chrome e no Safari o pedido é silencioso; no Firefox vira uma pergunta, perto do que a motivou. Recusado, o app só pede de novo quando passa a estar instalado, porque é a instalação que muda a resposta do Chrome. A recusa não muda nada no app.
- **Exportar todas / Importar** (galeria): um arquivo `forja-de-herois-fichas-AAAA-MM-DD.json`, no formato `rpg-character-backup` versão 1 (`libraryBackup.ts`). Cada ficha vai no formato do exportar dela: a do D&D no envelope `CharacterFile` versão 2, com o estado de jogo; a do Ordem no draft. O "Importar" da galeria reconhece a cópia e lê cada ficha pelo caminho do importar de uma ficha. Cada uma entra como ficha nova. A igual a uma daqui (a mesma ficha e o mesmo estado de jogo) fica de fora, para restaurar a mesma cópia duas vezes não dobrar a galeria.
- **Lembrete de cópia** (galeria, `core/utils/backupReminder.ts`): aparece com ficha e nenhuma cópia, ou com mudança depois de uma cópia de mais de 14 dias. "Agora não" o cala por 7 dias.
- **O download** (`core/utils/download.ts`, o mesmo nos três exportar) solta o endereço do arquivo só um minuto depois do clique. O Safari do iPhone lê o arquivo depois que o clique volta, e soltar na hora faz o download falhar lá.

## 4. iPhone: o que muda e os limites

- **Instalar é à mão**: Compartilhar → "Adicionar à Tela de Início", no Safari ou em outro navegador do iPhone. O iPhone não oferece a instalação sozinho, então a galeria mostra a dica no iOS fora do app instalado. "Entendi" a dispensa de vez, e instalado ela some (`core/pwa/platform.ts`: `isIos`, `isInstalled`).
- **O app instalado guarda à parte do navegador.** Ele começa sem as fichas criadas no Safari, e o que se cria nele não aparece no Safari. Com ficha no navegador, a dica diz isso e traz o "Exportar todas": a cópia no Safari, o "Importar" no app.
- **Por que instalar**: o Safari apaga o que o site guarda depois de 7 dias de uso do Safari sem abrir o site. O app da tela de início conta só os dias de uso dele. Instalado, ele também abre sem internet.
- **Versão mínima: iOS 16.4.** O Tailwind 4 e o alvo do build (`baseline-widely-available` do Vite 8: Safari 16.4, Chrome 111) pedem essa versão. iPhone que parou no iOS 15 (o 7 e os anteriores) fica de fora. No Android, Chrome 111 ou mais novo.
- **O arquivo exportado** vai para Arquivos → Downloads, ou abre a pré-visualização com o botão de compartilhar. O "Importar" escolhe o arquivo em Arquivos.
- **Fora do que o app usa**: notificação e trabalho em segundo plano.

## 5. Carregamento medido (2026-10-30 e 2026-10-31)

### O app instalável (2026-10-30)

Build servido (`vite preview`), Edge no tamanho do celular (390×844, toque), CPU 4× mais lenta e os perfis de rede do DevTools do Chrome ("Fast 4G" e "Slow 4G"), pelo CDP. Cada número é a mediana de 3 rodadas, com 3 fichas na biblioteca. "Galeria" é o título e um "Jogar" na tela, com o React montado; "fontes" é o `document.fonts.ready` depois disso. A abertura repetida é fechar e abrir de novo, no mesmo navegador. As duas versões foram medidas na mesma sessão da máquina.

| | 1ª abertura, 4G rápido | 1ª abertura, 4G lento | Repetida, 4G rápido | Repetida, 4G lento |
|---|---|---|---|---|
| **Antes** (sem SW, fontes do Google) | galeria 1,31 s · fontes 2,04 s | 4,74 s · 6,65 s | 1,21 s · 2,11 s | 1,88 s · 2,53 s |
| **Depois** (SW, fontes do site) | galeria 1,32 s · fontes 1,87 s | 5,01 s · 6,33 s | 0,95 s · 1,78 s | 0,90 s · 1,60 s |

- A abertura repetida sai toda do SW: nada pela rede, o mesmo tempo em qualquer conexão, e sem rede também.
- Na primeira abertura, o que segura a galeria é o JS, um arquivo só: 1,9 MB, 513 kB comprimido, a maior parte nos dados dos dois sistemas (o `spells.json` sozinho tem 475 kB). No 4G lento, as duas versões variam de 4,5 s a 5,2 s, rodada a rodada.
- Achado medindo: a capa da barra de status puxava a Lora junto com o JS, antes de haver texto na tela. A linha que o `content` dela abre pede a fonte. Com fonte genérica na capa (`indexCss.test.ts`), a primeira abertura no 4G lento passou de 5,22 s para 5,01 s nas medianas, e de 5,3 s para 4,8 s numa rodada de cada com o mesmo build. No 4G rápido, a diferença some no ruído.
- A decisão de então: o código num arquivo só, porque a primeira abertura em 4G rápido (1,3 s) estava longe dos ~3 s a partir dos quais valeria dividir, com o aviso de tamanho do build em 2 MB (`chunkSizeWarningLimit`) e, quando ele voltasse, o Ordem e a impressão sob demanda (`import()`). Ele voltou na onda `magias-base` da Fase 2, e a divisão está abaixo.

### O JS em pedaços (2026-10-31)

O aviso voltou com o JS em 2.083 kB (578 kB comprimido). O Ordem Paranormal e a ficha imprimível dos dois sistemas passaram a descer sob demanda (`core/utils/lazyScreen.ts`, por `import()` com o `React.lazy`), e a galeria abre sem eles.

| Arquivo | Tamanho | Comprimido |
|---|---|---|
| Antes: o JS inteiro | 2.083 kB | 578 kB |
| Depois: o da abertura (galeria, D&D, a regra do Ordem que a galeria usa) | 1.891 kB | 529 kB |
| O criador do Ordem | 139 kB | 36 kB |
| A ficha imprimível do Ordem / do D&D | 26 kB / 23 kB | 7 kB / 7 kB |
| O que o criador e a ficha do Ordem dividem | 11 kB | 5 kB |

Medido como em 2026-10-30, na mesma sessão para as duas versões, com 3 fichas (2 do D&D, completas, e 1 do Ordem):

| | 1ª abertura, 4G rápido | 1ª abertura, 4G lento | Repetida, 4G rápido | Repetida, 4G lento |
|---|---|---|---|---|
| **Antes** (um arquivo só) | galeria 1,30 s · fontes 1,97 s | 4,96 s · 6,01 s | 0,37 s · 0,92 s | 0,49 s · 0,98 s |
| **Depois** (em pedaços) | galeria 1,25 s · fontes 1,74 s | 4,76 s · 5,77 s | 0,36 s · 0,89 s | 0,63 s · 1,16 s |

- O ganho é o dos bytes a menos na primeira abertura: 0,2 s no 4G lento, quase nada no rápido. A repetida não muda: sai do SW, e varia de 0,3 s a 0,7 s rodada a rodada em qualquer versão.
- **Os pedaços descem sozinhos na abertura** (`preloadAfterOpening`, no `main.tsx`), e não só no toque. Assim a página tem o código inteiro da versão dela antes de qualquer troca de versão: o SW novo que assume com a página aberta (o "Atualizar agora", a volta à galeria no APK, outra aba) não tem os pedaços da versão velha, e a Vercel também não. Conferido no Edge: depois da abertura, abrir o Ordem, as duas impressões e o jogo não pede nenhum arquivo.
- Achado medindo: descendo no `load`, os pedaços disputavam a rede com as fontes, que o navegador só pede ao desenhar a primeira tela, e no celular lento o React a desenha depois do `load`. No 4G lento, as fontes chegavam 0,4 s depois (6,42 s contra 5,98 s antes da divisão, na mesma sessão). Agora os pedaços esperam a primeira tela no ar e as fontes dela (`document.fonts.ready`).
- **Nas aberturas seguintes, os pedaços descem na hora**, do SW, antes de a galeria aparecer: ali não há rede a disputar. Esperando a abertura, como na primeira visita, eles chegavam uns 0,3 s depois da galeria, e o toque nesse meio (o "Abrir" de um agente do Ordem) via o "Carregando…" por 0,3 s, o tempo que o React segura o `fallback` que entrou. Medido no Edge (390×844, CPU 4×, a página vinda do SW), com o toque assim que a galeria aparece: o "Carregando…" em 3 de 8 rodadas esperando a abertura, em nenhuma descendo na hora. O custo fica no ruído da abertura repetida: a galeria em 0,40 s contra 0,37 s no 4G rápido e em 0,39 s nos dois no lento (medianas de 12 rodadas, alternando as duas versões); esperando só o primeiro quadro, sem as fontes, ela não mudava, mas o toque ainda via o "Carregando…" em 1 de 8.
- Já carregada, a tela monta no mesmo render. Só o toque antes de o pedaço descer, na primeira visita e nos primeiros segundos, vê o "Carregando…".
- **Sem rede, depois da primeira visita** (Edge, 390 e 360 px): o SW guarda os pedaços (o `**/*.js` do `globPatterns` já os pega), e a galeria, o criador e a impressão do Ordem, a impressão do D&D, o jogo e o agente novo abrem, com os pedaços saindo do SW e o console limpo. O APK abre o mesmo site, na mesma origem e sem interceptar pedidos: o WebView (111 ou mais) carrega os pedaços como o Edge. Não conferido num aparelho; está no roteiro da seção 7.
- **Um corte a mais, medido e não feito: o D&D** (o criador e o jogo, 451 kB, 135 kB comprimido). A galeria apareceria em 3,93 s no 4G lento (−0,8 s) e em 1,07 s no rápido. Mas quem toca "Jogar" assim que a galeria aparece chegaria à mesa depois: 5,67 s contra 5,15 s no 4G lento, 1,82 s contra 1,67 s no rápido. A espera só mudaria de lugar, do abrir para o primeiro "Jogar".
- **Como medir de novo.** Sirva o build em `127.0.0.1` (`npm run preview -- --host 127.0.0.1 --port N --strictPort`) e abra esse endereço. Com `localhost`, o servidor escuta só no `::1`, e o Edge às vezes tenta antes o `127.0.0.1`, que demora ~2 s para recusar: a primeira abertura no 4G rápido mediu 3,2 s em vez de 1,3 s nas duas versões.
- O aviso continua em 2 MB, com o JS da abertura em 1,89 MB. Quando ele voltar, meça de novo; o próximo corte é o do D&D acima, se a galeria antes do primeiro "Jogar" valer a troca.

## 6. Conferido nos navegadores (2026-10-29 e 2026-10-30)

- **WebKit do Playwright** (390×844, toque) e **Edge** (360×740, emulação de celular), no build servido: galeria, Jogar, as 6 abas (toque e deslizar), PV (dano, cura, temporários), folha da receita (com vantagem da mesa), descansos, condições, teste contra a morte, notas e recarregar no jogo, exportar e importar uma ficha e todas. Console limpo. O WebKit achou o foco que caía no body ao fechar a folha do jogo (o toque não dá foco ao botão no Safari), corrigido em `pressedControl.ts`.
- **Sem rede** (Edge e WebKit): a galeria abre com as fontes, o "Jogar" abre a mesa, recarregar no jogo volta a ela, e dá para criar ficha nova dos dois sistemas.
- **Atualização** (Edge e WebKit), com a publicação simulada (o `sw.js` muda e o servidor reinicia): com o jogo aberto, a versão nova baixa e espera sem recarregar a mesa; a galeria avisa; a próxima abertura já é a nova; o "Atualizar agora" aplica.
- **Instalável**: o Chromium (`Page.getInstallabilityErrors`, o que o Lighthouse confere) não aponta erro, num perfil normal.
- **O que o WebKit de Windows não mostra.** Ele não é o Safari do iPhone: não tem o teclado virtual nem a barra do Safari que encolhe, nem o entalhe de verdade. Ele também desenha a Cinzel e a Lora num peso só: o eixo de peso da fonte variável muda a largura, não o traço, e o mesmo arquivo sai certo no Edge. Isso fica para o roteiro no aparelho.

## 7. Roteiro no aparelho

Para a turma de teste, num iPhone e num Android:

1. Instalar: no iPhone pela dica da galeria; no Android pelo APK. No Chrome do Android, o site não oferece instalar sozinho. O ícone e o nome "Forja" na tela de início.
2. No iPhone, com fichas no Safari: "Exportar todas" pela dica, instalar, e "Importar" no app.
3. Abrir em modo avião: a galeria, criar uma ficha, jogar, abrir uma ficha do Ordem e a impressão de uma ficha de cada sistema (os dois descem sob demanda, seção 5).
4. No jogo: os títulos e números em negrito (Cinzel), o campo de PV com o teclado numérico aberto (o "Aplicar" à vista), a folha da receita com a barra do Safari aparecendo e sumindo, o celular deitado (entalhe).
5. "Exportar todas": o arquivo aparece em Arquivos (iPhone) ou em Downloads (Android) e volta pelo "Importar".
6. Depois de um push na `main`: abrir (o aviso de versão nova aparece na galeria), fechar o app de verdade e abrir de novo (já é a nova). No APK, o roteiro da atualização é o do `docs/app-android.md`.
