# App instalável e sem rede

> O site publicado (`https://dnd-character-creator-gamma.vercel.app`) vira app no celular, por decisão do dono de 2026-10-29: no **iPhone**, o site instalado pela tela de início (sem App Store); no **Android**, o APK distribuído direto, que abre o mesmo site (ou o "Instalar app" do Chrome). Feito em 2026-10-29 e 2026-10-30.
>
> **A origem não pode mudar.** As fichas moram no localStorage dela, o service worker e o cache também, e o APK abre esse endereço. Domínio novo é app novo, com a galeria vazia.

## 1. Como funciona

- **Manifesto** (`apps/web/public/manifest.webmanifest`): "Forja de Heróis", nome curto "Forja" (a tela de início corta por volta de 12 caracteres), `standalone`, início e escopo em `/`, cores do fundo do tema (`#0e0a06`) e ícones 192 e 512, comuns e maskable. No iPhone, o ícone é o `apple-touch-icon` (180 px), e o modo de tela cheia e a barra de status preta (o conteúdo começa abaixo dela) vêm das metas `apple-*` do `index.html`. O `manifest.test.ts` confere os campos, os ícones e as ligações.
- **Ícones**: o d20 do favicon sobre o fundo do tema (ícone de tela de início é opaco). Os PNGs ficam versionados em `apps/web/public/icons`; quando o favicon mudar, `node scripts/make-icons.mjs` os desenha de novo (precisa do Edge ou do Chrome instalado).
- **Fontes do próprio site**: Cinzel e Lora vêm dos pacotes `@fontsource-variable` (OFL), não do Google. Entram no cache junto com o build, sem pedido a terceiros, e só os subconjuntos que o texto usa descem (`unicode-range`).
- **Service worker** (`vite-plugin-pwa` com o Workbox, gerado no build como `/sw.js`; a configuração está no `apps/web/vite.config.ts`). Guarda o build inteiro: HTML, JS, CSS, fontes, ícones e a imagem do Ordem (22 arquivos, ~2,6 MB). Ficam de fora os subconjuntos cirílico e vietnamita das fontes, que o português não usa. Toda navegação abre o `index.html` guardado, e a versão nova apaga o cache da velha. Só entra no cache o que é do site: nenhum cache de outro domínio.
- **Registro** (`apps/web/src/core/pwa/serviceWorker.ts`, chamado no `main.tsx`): só no build de produção (no `npm run dev` não há SW, que guardaria código velho) e só depois do `load`, para a primeira abertura não dividir a rede com o SW baixando o build.
- **Área segura**: com `viewport-fit=cover`, a página vai até as bordas. O `body` leva as margens `env(safe-area-inset-*)`, e uma capa (`body::before`) cobre o que rola por baixo da barra de status do Android de ponta a ponta. O que fica fixo nas bordas soma a margem: os vitais do jogo, o aviso do pé, as folhas e o rodapé do criador. Sem entalhe nem barra, as margens valem 0.

## 2. Como atualiza

Cada push na `main` vai para a Vercel e chega ao celular sozinho, sem APK novo. O APK só muda quando muda a parte nativa.

1. A Vercel publica um `sw.js` novo, porque a lista de arquivos com revisão muda a cada build.
2. Na abertura seguinte do app, o navegador procura o `sw.js`. A Vercel o serve com `max-age=0, must-revalidate`, então ele não fica preso em cache. O app que volta do segundo plano sem ser fechado também procura, no máximo uma vez por hora (`checkForUpdateOnReturn`). Achando, o SW novo baixa a versão nova inteira e **espera**.
3. A página aberta continua na versão velha: **nada recarrega sozinho, nunca no meio do jogo**. A galeria mostra "Versão nova do app pronta", com "Atualizar agora" para quem quiser na hora (`GalleryNotices.tsx`). Esse é o único lugar que recarrega, e só pelo toque.
4. Quando nenhuma página usa mais a versão velha, a nova assume. Isso acontece na próxima abertura, com o app fechado de verdade: no Android e no iPhone, tirado da lista de apps recentes. Trocar de app não fecha.

Por isso uma publicação leva **duas aberturas** para valer: a primeira baixa, a segunda usa. Sem rede, o app abre a última versão guardada, e a procura falha em silêncio até a próxima.

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

## 5. Carregamento medido (2026-10-30)

Build servido (`vite preview`), Edge no tamanho do celular (390×844, toque), CPU 4× mais lenta e os perfis de rede do DevTools do Chrome ("Fast 4G" e "Slow 4G"), pelo CDP. Cada número é a mediana de 3 rodadas, com 3 fichas na biblioteca. "Galeria" é o título e um "Jogar" na tela, com o React montado; "fontes" é o `document.fonts.ready` depois disso. A abertura repetida é fechar e abrir de novo, no mesmo navegador. As duas versões foram medidas na mesma sessão da máquina.

| | 1ª abertura, 4G rápido | 1ª abertura, 4G lento | Repetida, 4G rápido | Repetida, 4G lento |
|---|---|---|---|---|
| **Antes** (sem SW, fontes do Google) | galeria 1,31 s · fontes 2,04 s | 4,74 s · 6,65 s | 1,21 s · 2,11 s | 1,88 s · 2,53 s |
| **Depois** (SW, fontes do site) | galeria 1,32 s · fontes 1,87 s | 5,01 s · 6,33 s | 0,95 s · 1,78 s | 0,90 s · 1,60 s |

- A abertura repetida sai toda do SW: nada pela rede, o mesmo tempo em qualquer conexão, e sem rede também.
- Na primeira abertura, o que segura a galeria é o JS, um arquivo só: 1,9 MB, 513 kB comprimido, a maior parte nos dados dos dois sistemas (o `spells.json` sozinho tem 475 kB). No 4G lento, as duas versões variam de 4,5 s a 5,2 s, rodada a rodada.
- Achado medindo: a capa da barra de status puxava a Lora junto com o JS, antes de haver texto na tela. A linha que o `content` dela abre pede a fonte. Com fonte genérica na capa (`indexCss.test.ts`), a primeira abertura no 4G lento passou de 5,22 s para 5,01 s nas medianas, e de 5,3 s para 4,8 s numa rodada de cada com o mesmo build. No 4G rápido, a diferença some no ruído.
- **Decisão: o código fica num arquivo só.** A primeira abertura em 4G rápido (1,3 s) está longe dos ~3 s a partir dos quais valeria dividir. O aviso de tamanho do build está em 2 MB (`chunkSizeWarningLimit`, logo acima do JS de hoje). Quando ele voltar, ou se a primeira abertura incomodar no 4G lento, divida: o Ordem e a impressão sob demanda (`import()`), e meça de novo.

## 6. Conferido nos navegadores (2026-10-29 e 2026-10-30)

- **WebKit do Playwright** (390×844, toque) e **Edge** (360×740, emulação de celular), no build servido: galeria, Jogar, as 6 abas (toque e deslizar), PV (dano, cura, temporários), folha da receita (com vantagem da mesa), descansos, condições, teste contra a morte, notas e recarregar no jogo, exportar e importar uma ficha e todas. Console limpo. O WebKit achou o foco que caía no body ao fechar a folha do jogo (o toque não dá foco ao botão no Safari), corrigido em `pressedControl.ts`.
- **Sem rede** (Edge e WebKit): a galeria abre com as fontes, o "Jogar" abre a mesa, recarregar no jogo volta a ela, e dá para criar ficha nova dos dois sistemas.
- **Atualização** (Edge e WebKit), com a publicação simulada (o `sw.js` muda e o servidor reinicia): com o jogo aberto, a versão nova baixa e espera sem recarregar a mesa; a galeria avisa; a próxima abertura já é a nova; o "Atualizar agora" aplica.
- **Instalável**: o Chromium (`Page.getInstallabilityErrors`, o que o Lighthouse confere) não aponta erro, num perfil normal.
- **O que o WebKit de Windows não mostra.** Ele não é o Safari do iPhone: não tem o teclado virtual nem a barra do Safari que encolhe, nem o entalhe de verdade. Ele também desenha a Cinzel e a Lora num peso só: o eixo de peso da fonte variável muda a largura, não o traço, e o mesmo arquivo sai certo no Edge. Isso fica para o roteiro no aparelho.

## 7. Roteiro no aparelho

Para a turma de teste, num iPhone e num Android:

1. Instalar: no iPhone pela dica da galeria; no Android pelo APK ou pelo "Instalar app" do Chrome. O ícone e o nome "Forja" na tela de início.
2. No iPhone, com fichas no Safari: "Exportar todas" pela dica, instalar, e "Importar" no app.
3. Abrir em modo avião: a galeria, criar uma ficha, jogar.
4. No jogo: os títulos e números em negrito (Cinzel), o campo de PV com o teclado numérico aberto (o "Aplicar" à vista), a folha da receita com a barra do Safari aparecendo e sumindo, o celular deitado (entalhe).
5. "Exportar todas": o arquivo aparece em Arquivos (iPhone) ou em Downloads (Android) e volta pelo "Importar".
6. Depois de um push na `main`: abrir (o aviso de versão nova aparece na galeria), fechar o app de verdade e abrir de novo (já é a nova).
