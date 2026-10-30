# App do Android (APK)

> O app do Android é uma casca nativa (`apps/mobile`, Capacitor 8) que **abre o site publicado** `https://dnd-character-creator-gamma.vercel.app`, por decisão do dono de 2026-10-29. Não há App Store nem Play Store: o dono manda o APK no grupo da turma. Feito em 2026-10-30.
>
> **A origem não pode mudar.** As fichas moram no localStorage dela, dentro do app. Domínio novo é app novo, com a galeria vazia. O `apps/mobile/test/androidShell.test.ts` prende o endereço.

O site e o service worker são os do app instalável: `docs/app-instalavel.md`. Este doc é só o que muda no APK.

## 1. Como funciona

- **O APK não leva cópia do site.** Ele abre o endereço publicado num WebView. Cada push na `main` vai para a Vercel e chega ao celular: a versão nova baixa numa abertura e entra quando o Android encerra o app (ou a pessoa o tira dos recentes), ou pelo "Atualizar agora" da galeria. Abrir pelo ícone com o app ainda vivo (o voltar da galeria só minimiza) traz a mesma página, na versão velha; por isso o aviso, no APK, é "Atualização pronta: toque em Atualizar agora para usá-la.". APK novo só quando muda a parte nativa.
- **Sem rede**, o service worker do site abre a última versão guardada, com as fichas. Na primeira abertura, sem rede, ainda não há cópia: aparece a página de erro ("Sem conexão").
- **A página de erro** (`apps/mobile/www/index.html`, o `server.errorPath`) mora no APK, fora do site, no visual do app. Ela aparece sem rede e sem cópia, quando o site não responde, ou com o WebView abaixo do 111, quando pede para atualizar o "Android System WebView" (o build do site pede o Chrome 111; o Capacitor confere ao abrir, pelo `minWebViewVersion`). O "Tentar de novo" e o voltar dela são da casca nativa (`NativeShellPlugin.java`): ela não tem a ponte do Capacitor, e o voltar a fecha (o app tenta de novo ao ser aberto).
- **O site sabe que está no APK** pelo Capacitor: a ponte nativa entra na página antes do nosso código (pelo `DOCUMENT_START_SCRIPT` do WebView, também na página aberta pelo service worker). O código do site que só vale no APK está em `apps/web/src/core/native` e não roda no navegador (`isNativeApp()` falso: nem os plugins são chamados).
- **O que o WebView não faz, a casca faz** (desde o 0.1.1, versionCode 2): o WebView ignora o download do site (o link para um `blob:`), sem arquivo nem erro, e não implementa o `window.print()`. O "Exportar", o "Exportar todas" e o "Exportar Ficha como JSON" abrem o "Salvar como" do Android (Downloads, Drive, o que o aparelho tiver; `saveFile` do `NativeShellPlugin.java`), e a data da cópia de segurança só entra com o arquivo gravado: cancelado, o lembrete continua. O "Imprimir / Salvar PDF" abre a impressão do Android (`print`), com o "Salvar como PDF" e o nome da ficha no arquivo. No APK 0.1.0, que não tem os dois, o site avisa "O app precisa da versão nova para isso: peça o APK no grupo." (o mínimo do `app-version.json` é o 2). O "Importar" sempre funcionou: o seletor de arquivo é do Capacitor.
- **Só o site navega dentro do app** (`allowNavigation`); link para outro endereço abre no navegador do celular. Tudo por https (`usesCleartextTraffic="false"`).

## 2. Comportamento de app

- **Voltar do Android** (`core/navigation/back.ts`, ligado em `core/native/nativeApp.ts`): fecha a folha aberta (a do jogo, o menu de sistema, o "Excluir?" da galeria); depois volta a tela: o jogo à galeria (o painel de descanso e a engrenagem abertos fecham antes), a impressão à ficha, e o criador refaz o caminho desta visita: a etapa de onde se veio e, da primeira que se abriu, a galeria (a ficha aberta na Revisão pelo "Abrir" volta direto, sem passar pelas 9 etapas). Na galeria, minimiza o app, como o botão de início: nada se perde. Tela ou folha nova que precise do voltar registra com `useBackHandler` (camada `overlay` para folha e menu, `screen` para tela).
- **Barras e área segura**: de ponta a ponta em todo Android (`EdgeToEdge` no `MainActivity`), barras transparentes com ícones claros. Com o WebView 140 ou mais novo, a página vai até as bordas e as margens são as `env(safe-area-inset-*)` do site; no mais velho, o SystemBars do Capacitor (`insetsHandling: 'native'`) encolhe a página para dentro das barras, que mostram o fundo do tema. O teclado aberto encolhe a página.
- **Tela acesa**: a mesma preferência e o mesmo `useWakeLock` do site. A Screen Wake Lock funciona no WebView do Android: conferido em 2026-10-30, ela liga e solta o `KEEP_SCREEN_ON` da janela (`adb shell dumpsys window`). Nenhum plugin.
- **Girar a tela** não recria a tela (`configChanges` no manifesto): o jogo continua onde estava. A orientação é a do aparelho.
- **WebView encerrado pelo Android** (falta de memória, no segundo plano): a tela é recriada em vez de o app fechar com erro, e o site reabre o jogo aberto. Se cair de novo em menos de 10 s, o app fecha (sem repetir para sempre).
- **Nome e ícone** do PWA: "Forja de Heróis" nas configurações, "Forja" embaixo do ícone; o ícone adaptável e a abertura usam o d20 do favicon (`node scripts/make-icons.mjs android` desenha de novo).
- **Pacote** `io.github.jotapais.forja`. Trocar é publicar outro app, sem as fichas deste.

## 3. Gerar o APK

Pré-requisitos: Android Studio (o SDK e o JDK 21 que vem com ele; o Capacitor 8 pede o 21) e `npm install` na raiz. O script acha o JDK sozinho: `FORJA_JAVA_HOME`, o `JAVA_HOME` se for 21 ou mais novo, ou o `jbr` do Android Studio. Não precisa mudar variável do sistema.

```bash
npm run apk:release -w @rpg/mobile   # o da turma: assinado, copiado com o nome da versão
npm run apk:debug -w @rpg/mobile     # o de teste
```

O script roda o `cap sync android` (a página de erro e o `capacitor.config.json` vão para o projeto; ambos ficam fora do git), o Gradle e, no release, copia para `../dnd-character-creator-apk/forja-de-herois-<versionName>.apk` (ou `FORJA_APK_DIR`). Pelo Android Studio também dá: `npx cap sync android` em `apps/mobile` e abrir `apps/mobile/android`.

## 4. Assinar

O APK da turma é assinado sempre com a mesma chave. **O Android só instala uma versão nova por cima com a mesma assinatura**: com outra chave, a turma teria de desinstalar o app, e as fichas iriam junto.

- A chave (`forja-release.jks`) e as senhas (`forja-release.properties`: `storeFile`, `storePassword`, `keyAlias`, `keyPassword`, o `storeFile` relativo ao arquivo) moram **fora do repositório**: nesta máquina, em `C:/Users/jotap/projetos-pessoais/dnd-character-creator-chaves/`. Guarde uma cópia da pasta fora do PC (nuvem pessoal, pendrive).
- O Gradle acha o arquivo pela variável `FORJA_SIGNING_PROPERTIES` ou pela linha `forja.signingProperties=<caminho>` do `apps/mobile/android/local.properties` (ignorado pelo git). Sem ele, o release para com a mensagem; o debug não precisa.
- Os `.gitignore` recusam `.jks`, `.keystore`, `.p12`, propriedades de assinatura e APK em qualquer pasta.
- Para conferir quem assinou: `apksigner verify --print-certs <apk>` (nas build-tools do SDK). O de 0.1.0 e o de 0.1.1: SHA-256 `58019d265b29355afed9cdb16f87759a750e033e0fcf84d09ad135cf538882e4`.

## 5. Subir a versão

1. Mudou só o site? **Não suba nada**: o push na `main` já chega a todos.
2. Mudou a parte nativa (plugin, ícone, nome, Capacitor, `apps/mobile/android`)? Em `apps/mobile/android/app/build.gradle`, some 1 ao `forjaVersionCode` (o Android só instala por cima um número maior) e suba o `forjaVersionName` (semver: `0.1.1` para correção, `0.2.0` para algo novo).
3. Gere o release (`npm run apk:release -w @rpg/mobile`) e mande o `forja-de-herois-<versão>.apk` no grupo.
4. Se o site passou a **depender** do APK novo (chama um plugin que o velho não tem), suba `android.minVersionCode` em `apps/web/public/app-version.json` para o versionCode novo, no mesmo push ou depois de distribuir o APK. O APK mais velho que ele mostra na galeria "Tem uma versão nova do app: peça o APK no grupo." O arquivo é lido sempre da rede (fora do cache do service worker); no navegador, nada aparece. O teste do `apps/mobile` recusa um mínimo acima do versionCode de agora.
5. Atualizar o Capacitor de major é parte nativa: o `@capacitor/core` e o `@capacitor/app` do site e os do `apps/mobile` andam juntos, no mesmo major, e o APK novo sobe o mínimo.

## 6. Testar com o site local

A variante de teste (`npm run apk:debug`) se instala ao lado da da turma (`io.github.jotapais.forja.teste`, "Forja (teste)"), com as fichas à parte. Com `FORJA_DEV_URL` na hora do build, ela abre esse endereço em vez do site publicado; só o debug muda (`ForjaDevServerConfig` no `app/build.gradle`), o release sempre abre o publicado.

```bash
npm run build && npm run preview -- --port 5263 --strictPort        # o build, com o service worker
FORJA_DEV_URL=http://localhost:5263 npm run apk:debug -w @rpg/mobile
adb reverse tcp:5263 tcp:5263                                       # o celular ou o emulador vê a porta do PC como localhost
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Use `localhost` com o `adb reverse` (pelo cabo, também num celular de verdade): é contexto seguro, então o service worker e a tela acesa funcionam. Pelo `http://10.0.2.2:5263` (o PC visto do emulador) ou pelo IP da rede, a página abre, mas sem service worker nem Wake Lock (http fora do localhost não é contexto seguro). A variante de teste abre também em WebView velho (o mínimo 111 fica de fora dela), para conferir a casca num emulador antigo; lá, o que pede o 111 pode sair com a cor errada. O WebView da variante de teste aceita o DevTools: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` e `chrome://inspect`.

## 7. Distribuir e instalar

- Mande o arquivo `forja-de-herois-<versão>.apk` no grupo do WhatsApp.
- No celular: tocar no arquivo; o Android pede para **permitir instalar apps desta fonte** (o WhatsApp ou o app de arquivos); permitir e voltar; "Instalar". O Play Protect pode avisar de app desconhecido: "Instalar assim mesmo" (ele não vem da loja).
- APK novo instala **por cima**, sem desinstalar: as fichas ficam. Desinstalar apaga as fichas do app (ou exporte antes: galeria → "Exportar todas" → "Salvar", com o APK 0.1.1 ou mais novo).
- O app precisa do Android 7 ou mais novo, com o "Android System WebView" 111 ou mais novo (vem atualizado pela Play Store).

## 8. Limites

- O APK de release abre o site publicado: **ele só mostra mudança depois do push** na `main` (e da publicação na Vercel). Para testar antes, a variante de teste com o site local.
- As fichas do APK e as do Chrome (e do app que o Chrome instala, que guarda junto com ele) são separadas. Para levar de um ao outro: "Exportar todas" num e "Importar" no outro; a galeria vazia do APK diz isso.
- O "Tentar de novo" da página de erro usa o `navigator.onLine` para dizer "Ainda sem internet" sem sair da página; em alguns aparelhos ele diz que há rede sem haver, e aí a página de erro só aparece de novo.
- Sem notificação, sem trabalho em segundo plano e sem atualização automática do APK (é o aviso da galeria e o grupo).

## 9. Conferido no emulador (2026-10-30)

Pixel 6 do Android Studio (Android 13, WebView 109), a variante de teste no `vite preview` do build atual (com o service worker) pelo `adb reverse`, e o release:

- Abre a galeria; "Jogar" (toque de verdade, `adb shell input tap`) abre o jogo com a tela acesa (`KEEP_SCREEN_ON` na janela), que some ao sair do jogo.
- Voltar: a folha da CA fecha com o foco de volta na CA; o jogo volta à galeria; a galeria minimiza o app (o processo continua, e reabre na galeria). Início no meio do jogo e voltar ao app: o jogo continua, com a tela acesa.
- Girar a tela no jogo: sem recarregar, dentro da área segura.
- Sem rede (modo avião, sem o `adb reverse`) depois da primeira abertura: o app fechado e aberto de novo sai do service worker, com as fontes, e o "Jogar" funciona.
- Sem rede na primeira abertura (dados do app apagados): a página de erro; o "Tentar de novo" sem rede fica nela; com a rede de volta, abre o site; o voltar nela fecha o app.
- O WebView encerrado (`kill` do processo dele): a tela recriada, de volta ao jogo aberto.
- O aviso de APK velho com o mínimo em 2 no build servido, e sem ele com o 1.
- Console da página limpo (só o registro das chamadas de plugin que o Capacitor faz na variante de teste).
- O release: assinado, abre a página que pede o WebView novo (o emulador tem o 109); o ícone e o nome "Forja" na lista de apps, e a abertura com o d20.
- O "Sem conexão" da página de erro foi conferido no Edge (o emulador mostra a variante do WebView velho).

O 0.1.1 (2026-10-30), a variante de teste no build servido pelo `adb reverse`, com toques de verdade:

- "Exportar todas" do lembrete abre o "Salvar como" do Android com `forja-de-herois-fichas-AAAA-MM-DD.json` em Downloads; cancelado, a data da cópia não entra e o lembrete fica; salvo, o arquivo aparece em `/sdcard/Download` (a cópia inteira, com a ficha) e o lembrete some. O "↓" de uma ficha salva `Krusk-dnd5e.json`.
- "Imprimir / Salvar PDF" abre a impressão do Android com a ficha (3 páginas, sem os botões da tela); "Salvar como PDF" grava `Krusk — D&D 5e.pdf`.
- Voltar: "Abrir" (Revisão) → voltar → galeria; impressão → ficha → galeria; no jogo, o painel de descanso e a engrenagem abertos fecham antes de sair.
- A galeria vazia diz "Nenhuma ficha salva neste app" e como trazer as fichas do navegador.
- O release 0.1.1: assinado com a mesma chave (o SHA-256 acima), versionCode 2, abre o site publicado.

**Fica para o celular de verdade** (o emulador tem o WebView 109, abaixo do mínimo, e não tem Play Store para atualizá-lo): o release abrindo o site publicado, as margens de ponta a ponta do WebView 140+ (entalhe e barra de gestos), e as cores do Tailwind 4. Roteiro no Android da turma:

1. Instalar o APK pelo WhatsApp (seção 7); o ícone e o nome "Forja".
2. Abrir com internet: a galeria; criar uma ficha, "Jogar".
3. Na galeria, "Exportar todas" → "Salvar": o arquivo em Downloads (Arquivos). Numa ficha, "Imprimir / Salvar PDF" → "Salvar como PDF".
4. No jogo: a barra de status e a de gestos não cobrem nada; o celular deitado; a tela não apaga sozinha; o voltar fecha a folha aberta, volta à galeria e, nela, sai para a tela de início.
5. Fechar o app de verdade (tirar dos recentes), modo avião, abrir: a galeria e o jogo abrem sem rede.
6. Depois de um push na `main`: abrir (o aviso "Atualização pronta" na galeria), fechar de verdade e abrir de novo (já é a nova), ou tocar em "Atualizar agora".
