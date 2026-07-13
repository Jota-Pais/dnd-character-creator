---
version: alpha
name: D&D Character Creator — Grimório de Pergaminho
description: >
  Estética "grimório de fantasia": fundo quase preto com gradientes marrons, serifada
  ornamental (Cinzel) para títulos/rótulos, serifada de leitura (Lora) para corpo,
  acabamento dourado para destaque. Tokens abaixo representam o tema padrão (D&D 5e);
  o módulo Ordem Paranormal reteama gold/parchment via .theme-ordem (ver Colors).

colors:
  # Escala completa extraída de src/index.css (@theme) — tema padrão (D&D 5e)
  gold-300: "#fcd67a"
  gold-400: "#f0b429"
  gold-500: "#d4900a"
  gold-600: "#a36b07"
  gold-700: "#7a4e05"
  gold-800: "#52330a"
  gold-900: "#2d1c06"
  parchment-100: "#f5e8cc"
  parchment-200: "#e8d5b7"
  parchment-300: "#d4b896"
  parchment-400: "#c9a883"
  parchment-500: "#b08d63"
  parchment-600: "#9a7650"
  parchment-700: "#7d5c3c"
  parchment-800: "#3a2614"
  parchment-900: "#231608"
  parchment-950: "#120c04"
  # Mesmos nomes de token, reteamados por .theme-ordem — ver seção Colors
  gold-400-ordem: "#ef4444"
  gold-500-ordem: "#dc2626"
  # Cor ad hoc usada em erro/campo obrigatório (red-500 stock do Tailwind, sem token próprio)
  error: "#ef4444"
  # Papéis semânticos (aliases apontando para a escala acima)
  primary: "{colors.gold-500}"
  secondary: "{colors.parchment-500}"
  neutral: "{colors.parchment-900}"
  surface: "{colors.parchment-950}"
  on-surface: "{colors.parchment-200}"

typography:
  h1:
    fontFamily: Cinzel
    fontSize: 33.75px
    fontWeight: 700
  heading-sm:
    fontFamily: Cinzel
    fontSize: 18px
    fontWeight: 700
  body:
    fontFamily: Lora
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: Cinzel
    fontSize: 13.5px
    fontWeight: 600
    letterSpacing: 0.08em

rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  xxl: 16px
  full: 9999px

spacing:
  xs: 9px
  sm: 13.5px
  md: 18px
  lg: 22.5px
  xl: 27px
  xxl: 45px

components:
  button-primary:
    backgroundColor: "{colors.gold-500}"
    textColor: "{colors.parchment-950}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: 13.5px
  button-primary-hover:
    backgroundColor: "{colors.gold-400}"
  choice-card:
    backgroundColor: "rgba(20, 14, 6, 0.8)"
    rounded: "{rounded.xxl}"
    padding: 18px
    typography: "{typography.heading-sm}"
  choice-card-selected:
    backgroundColor: "rgba(30, 22, 12, 0.95)"
  tooltip-popover:
    backgroundColor: "{colors.parchment-950}"
    textColor: "{colors.parchment-300}"
    rounded: "{rounded.lg}"
    padding: 13.5px
  step-indicator-node:
    backgroundColor: "{colors.gold-500}"
    textColor: "{colors.parchment-950}"
    rounded: "{rounded.full}"
    size: 40.5px
---

# DESIGN.md — D&D Character Creator (e Ordem Paranormal)

> Validado com `npx @google/design.md lint DESIGN.md`. Os valores acima são o "ponto de
> referência normativo" extraído do tema padrão (D&D 5e); onde o código diverge desse
> ponto de referência — e diverge com frequência — a divergência está documentada como
> prosa nas seções abaixo e, de forma consolidada, em "Inconsistências identificadas".

## Overview

Este projeto é uma SPA React (Vite + Tailwind v4) com uma arquitetura multi-sistema: um núcleo agnóstico (`src/core`) e módulos de regras isolados (`src/systems/dnd5e`, `src/systems/ordem`). O design, porém, **não segue essa mesma separação em camadas** — não há uma pasta de design system central com componentes de UI genéricos; existem apenas dois componentes verdadeiramente compartilhados (`Tooltip`, `StepIndicator`) e uma pasta `src/components` quase vazia. Tudo mais (cards, botões, painéis, badges, callouts) é reimplementado por componente, com classes Tailwind copiadas e ligeiramente ajustadas a cada vez.

A identidade visual é clara e consistente na intenção: **estética "grimório/pergaminho de fantasia"** — fundo quase preto com gradientes radiais marrons, fonte serifada ornamental (Cinzel) para títulos e rótulos, fonte serifada de leitura (Lora) para corpo, acabamento dourado (`gold-*`) para destaque, e uma escala neutra quente (`parchment-*`) fazendo o papel de "cinza" do sistema. Essa base foi implementada como **design tokens reais** em `src/index.css` via `@theme` do Tailwind v4 — é a parte mais madura do sistema, e é o que está representado no front matter acima.

A partir daí, a maturidade cai: tipografia (tamanhos/papéis), border-radius e espaçamento **não têm token nenhum no código-fonte** — os valores no front matter acima foram *reconstruídos* a partir do uso mais comum observado, não extraídos de uma escala que o projeto já declara. E o trabalho mais recente (a tela de galeria `GlobalGallery.tsx` e o novo shell do Ordem `OrdemApp.tsx`, do handoff "Redesign Ordem" registrado no histórico do projeto) abandonou os tokens de cor inteiramente em favor de hex inline via `style={{}}`, criando uma segunda paleta paralela que se parece com a primeira mas não é ela.

Em resumo: há um sistema de design real (cor + tipografia de família), cercado por convenções informais (radius, spacing, tamanhos) e por pelo menos duas exceções deliberadas que vivem fora dele (paleta inline da galeria/Ordem, paleta cinza da ficha de impressão), mais uma paleta de "accent por entidade" (raça/classe/antecedente) que é dado de conteúdo, não token de UI.

## Colors

- **Primary (`gold-500`, `#d4900a`):** ação primária, estado ativo/selecionado, foco, destaque de marca — o dourado é a assinatura visual do produto.
- **Secondary (`parchment-500`, `#b08d63`):** tom intermediário da escala neutra, usado em texto secundário e elementos utilitários.
- **Neutral (`parchment-900`, `#231608`) / Surface (`parchment-950`, `#120c04`):** fundos escuros de superfície — `parchment` faz o papel de "neutral" **e** de "surface" ao mesmo tempo; não existe uma escala `gray` própria do design system.
- **On-surface (`parchment-200`, `#e8d5b7`):** cor de texto principal sobre os fundos escuros.
- **Tertiary: não definido.** Este não é um sistema de três cores — é fundamentalmente dourado + escala neutra quente. Não há uma terceira cor de marca; o que existe em seu lugar é a paleta de *accent por entidade* (abaixo), que cumpre um papel parecido mas é dado de conteúdo, não token de UI.

**Reteamado por sistema.** `.theme-ordem` (aplicado no elemento raiz do `OrdemApp`) sobrescreve os **mesmos nomes de custom property** `--color-gold-*`/`--color-parchment-*` com outros valores — no front matter isso está representado como tokens irmãos (`gold-400-ordem #ef4444`, `gold-500-ordem #dc2626`) para deixar explícito que é vermelho, não âmbar, no Ordem. Como as utilities do Tailwind v4 resolvem cor via `var(--color-*)`, isso reteama automaticamente qualquer componente que use as classes `bg-gold-500`/`text-parchment-400` etc. — um mecanismo elegante que só funciona para quem de fato usa essas classes (ver Inconsistências, item 1).

**Origem do redesign do Ordem (histórico).** O tema escuro/vermelho e a paleta hex inline de `GlobalGallery.tsx`/`OrdemApp.tsx` vieram de um handoff de design externo (protótipo HTML de alta fidelidade, "Redesign Ordem", implementado em F30) que especificava as cores **em hex direto** (formato normal pra um brief de design). Quem implementou copiou os hex literalmente em vez de mapear de volta para os tokens `gold`/`parchment` já existentes — por isso a paleta "nova" é tão parecida com a "antiga" sem ser a mesma. O pacote de handoff foi removido do repo após a implementação (servia só como referência temporária); os valores relevantes já estão capturados aqui.

**Cores de elemento de ritual (Ordem, dado de conteúdo).** O mesmo handoff definiu um mapeamento de cor por elemento paranormal — Sangue `#ef4444`, Morte `#a1a1aa`, Energia `#c084fc`, Conhecimento `#fbbf24`, Medo `#e2e8f0` — usado nos chips de `RitualsStep.tsx`. No código isso aparece como classes Tailwind stock (`red-*`, `zinc-*`, `purple-*`, `amber-*`, `slate-*`) sem nenhum comentário ligando-as ao elemento que representam; quem olha só o código não tem como saber que é um mapeamento deliberado 1:1, não uma escolha ad hoc (reforça o item 3 de Inconsistências).

**Accent por entidade (fora do token system).** `classUtils.ts`, `raceUtils.ts` e `backgroundUtils.ts` definem uma cor hex própria por raça/classe/antecedente (ex.: `barbarian #c0392b`, `wizard #1f618d`, `dwarf #d97706`) usada para colorir a faixa/borda do card e badges de cada opção. Ajuda o jogador a diferenciar ~40 opções à primeira vista — mas são ~34 valores soltos, sem paleta documentada, sem relação com `gold`/`parchment`. Não estão no front matter porque não são tokens de UI, são dado de conteúdo.

**Erro/status (`error`, `#ef4444`):** vermelho stock do Tailwind (`red-500`) usado ad hoc para campo obrigatório/erro — coincide numericamente com `gold-400-ordem`, mas é uma coincidência de picking manual, não a mesma decisão. Além do erro, categorias (ritual/elemento) usam outras cores stock do Tailwind (`purple-900`, `amber-400`, `zinc-950`, `slate-900`) sem mapeamento nenhum — não entraram no front matter por não terem um papel semântico único e estável.

**Fichas de impressão** (`PrintableSheet`, ambos os sistemas) usam uma terceira paleta, `gray-*` do Tailwind puro sobre fundo branco forçado — deliberadamente fora deste sistema de cor (ver Elevation e Inconsistências, item 9).

## Typography

- **`h1` — Cinzel 700, 33.75px** (`font-fantasy font-bold text-3xl`): título do wizard (`Dnd5eApp`/`OrdemApp`). A galeria (`GlobalGallery.tsx`) usa `text-2xl` (27px) para o mesmo papel — dois tamanhos concorrentes; 33.75px foi escolhido aqui por ser o do fluxo principal (wizard).
- **`heading-sm` — Cinzel 700, 18px** (`font-fantasy font-bold text-base`): título de card/seção (ex.: nome da classe/raça em `ClassCard`/`RaceCard`). Convive com instâncias em `text-lg`/`text-xl` sem critério — não é uma escala fechada, é o tamanho mais comum observado.
- **`body` — Lora 400, 18px, line-height 1.6**: a única regra de tipografia realmente declarada no CSS do projeto (`body { font-family: var(--font-body); line-height: 1.6 }`). Na prática, a maioria dos parágrafos de descrição usa `text-xs`/`text-sm` (13.5px/15.75px) em vez do tamanho herdado do `body` — o token aqui reflete a declaração do projeto, não o tamanho mais frequentemente renderizado.
- **`label` — Cinzel 600, 13.5px, letter-spacing 0.08em** (`font-fantasy`, uppercase eyebrow): rótulos/eyebrows em maiúsculas aparecem em pelo menos seis tamanhos distintos (`text-[10px]`, `text-[11px]`, `text-xs`, `text-[12.5px]`, `text-[13px]`, `text-[13.5px]`) e cinco valores de letter-spacing (`.04em`, `.08em`, `.13em`, `.16em`, `.22em`, `tracking-widest`). O token representa o ponto médio observado, não uma escala real.
- **Base global**: `html { font-size: 112.5% }` (18px) — um override direto de página, comentado no CSS como resposta a feedback de playtest ("fontes pequenas demais"). Como está em `rem`, reescala proporcionalmente toda a escala do Tailwind — os valores em px acima (33.75px, 18px, 13.5px...) já refletem esse override, não os px "de catálogo" do Tailwind (que assumiriam 16px de base).

## Layout

- Contêiner principal: `max-w-6xl mx-auto px-4` (wizard D&D) vs. `max-w-5xl mx-auto` (galeria) — larguras máximas diferentes para papéis parecidos (tela cheia de app), sem uma constante compartilhada.
- O Ordem Paranormal usa uma estrutura diferente do D&D: sidebar fixa de 250px em desktop (`OrdemApp.tsx`) com navegação vertical por etapa, enquanto o D&D usa um `StepIndicator` horizontal centralizado no topo. Os dois sistemas só compartilham o componente `StepIndicator` na versão mobile do Ordem.
- **Espaçamento (tokens `spacing.*` acima) não é uma escala declarada pelo projeto** — são os valores mais comuns da escala padrão do Tailwind (múltiplos de `0.25rem`), já convertidos para px considerando o root de 18px: `xs` 9px (`gap-2`/`p-2`), `sm` 13.5px (`gap-3`/`py-3`), `md` 18px (`p-4`/`px-4` — o padding de card mais comum), `lg` 22.5px (`px-5`), `xl` 27px (`px-6`), `xxl` 45px (`p-10`, usado no estado vazio da galeria). Valores próximos (`py-2` vs `py-2.5` vs `py-3`; `px-4` vs `px-5` vs `px-6`) convivem em componentes com o mesmo papel, sugerindo ajuste visual pontual em vez de uma escala decidida — ver Inconsistências, item 6.
- Fundo de página: gradientes radiais marrons fixos via `background-image` no `body` (`@layer base`), compartilhados por toda a aplicação independente do sistema ativo — uma das poucas decisões de layout verdadeiramente globais.
- Impressão (`@media print`): layout paralelo dedicado — fundo forçado a branco, sombras e cantos arredondados zerados, quebras de página via `.page-break { break-after: page }`.

## Elevation

Não há uma escala de elevação declarada; sombra é usada de forma oportunista, não sistemática (por isso não há tokens de elevação no front matter — o schema do DESIGN.md também não modela elevação como token, só como prosa):

- **Feedback de interação com cor de marca**: em vários componentes do fluxo D&D (`StepIndicator`, inputs de nome, botão primário), o hover/foco usa `shadow-md`/`shadow-lg` combinado com a cor do token via opacidade (`shadow-gold-900/40`, `shadow-gold-900/30`, `shadow-gold-900/20`) — sombra "com a cor da marca" só ativada em interação. É o padrão mais deliberado de elevação no projeto. O handoff de design do Ordem (histórico, F30) especificava o mesmo princípio em vermelho (`0 4px 18px rgba(220,38,38,.35)` no botão primário, glow de seleção `0 0 14–18px rgba(220,38,38,.2–.3)`, anel de foco `0 0 0 4px rgba(220,38,38,.15–.18)`) — é o mesmo padrão de "sombra tingida pela marca" do D&D, só que especificado em rgba direto em vez de via token.
- **Cards de escolha** (`ClassCard`, `RaceCard`) usam `boxShadow` inline (não classes Tailwind) com uma fórmula própria: `0 0 20px {accent}25, 0 4px 12px rgba(0,0,0,0.4)` quando selecionado, `0 2px 8px rgba(0,0,0,0.3)` quando não — coerente entre esses dois componentes, mas não replicada em `BackgroundCard`, que não usa sombra nenhuma.
- **Popovers** (`Tooltip`, menu "Novo personagem" na galeria) usam `shadow-xl` simples, sem tingimento de cor.
- A maior parte dos cards estáticos (badges, listas, painéis informativos) é **flat** — sem sombra alguma, apoiando-se só em borda + fundo para separar camadas.
- Fichas de impressão removem sombra explicitamente (`box-shadow: none !important`), coerente com o objetivo de imprimir em papel.

## Shapes

- **`rounded.lg` (8px) e `rounded.xl` (12px) dominam** (a maioria dos 246 usos de `rounded-*` no projeto), mas convivem com `rounded.md` (6px), `rounded.xxl` (16px), `rounded.sm` (4px), `rounded.full` (9999px) e ao menos um valor arbitrário (`rounded-[10px]`, na linha da galeria) sem um critério de papel evidente. Os valores acima são simplesmente a escala default do Tailwind v4 — o projeto não define um radius próprio, só usa pedaços da escala padrão de forma ad hoc.
- `rounded.full` é reservado consistentemente para elementos circulares (nós do step indicator, avatares, dots, badges de contagem) — o padrão mais limpo desta seção.
- Cantos "duros" (`rounded-none`) só aparecem forçados no modo impressão.
- Cards de escolha de mesma função usam raios diferentes: `ClassCard`/`RaceCard` → `rounded.xxl` (16px); `BackgroundCard`/`EquipmentChoiceCard` → `rounded.xl` (12px). Não há uma regra de "cards grandes = xxl, cards compactos = xl".

## Components

Os componentes abaixo estão modelados no front matter (`components.*`) com as propriedades que o schema do DESIGN.md reconhece (`backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`). Tudo que a UI real faz além dessas propriedades — cor de borda por seleção, hex inline, paletas por sistema — não tem onde ser tokenizado neste schema, e por isso só existe como prosa abaixo.

- **`button-primary` / `button-primary-hover`**: `bg-gold-500`/texto `parchment-950`, `font-fantasy font-bold`, hover `bg-gold-400` + sombra dourada. Presente em `NameStep`, `Dnd5eApp`/`OrdemApp` (imprimir), `GlobalGallery` (novo personagem) — mas cada instância real usa um `rounded` (`lg` ou `xl`) e um padding levemente diferentes; o token representa a versão mais comum.
- **`choice-card` / `choice-card-selected`**: botão-cartão com borda de 2px (não modelável neste schema — ver nota acima), fundo translúcido escuro e uma cor de destaque (`accent`) por entidade que ilumina borda/faixa/badges quando selecionado. É o componente mais repetido do app — e também o mais claramente copiado-e-colado em vez de compartilhado: `ClassCard`/`RaceCard` e `BackgroundCard` resolvem a mesma ideia com radius, sombra e paleta de fundo levemente diferentes (ver Inconsistências).
- **`tooltip-popover`**: `src/components/common/Tooltip.tsx` — ícone "?" que abre um popover sob clique (não hover, para funcionar em mobile). Único componente genuinamente genérico além do StepIndicator.
- **`step-indicator-node`**: `src/components/wizard/StepIndicator.tsx` — nó circular numerado, estado done/active/upcoming via token de cor, linha conectora fina. Único componente de navegação compartilhado entre os dois sistemas.
- **Sidebar do Ordem** (`OrdemApp.tsx`, fora do front matter): navegação vertical fixa exclusiva desse sistema, construída inteiramente com hex inline via `style`, não com as classes de token — ver Inconsistências.
- **Character row / galeria** (`GlobalGallery.tsx`, fora do front matter): avatar em losango (quadrado rotate 45°), nome, subtítulo, nível/NEX, ações (abrir, duplicar, exportar, excluir com confirmação inline). Também 100% hex inline, com paleta própria por sistema (`SYSTEM_UI`).
- **Callout de status** (fora do front matter): caixa `bg`+`border`+`text` da mesma família de cor Tailwind stock (ex. `red-950`/`red-900`/`red-300`). Reimplementada a cada Step que precisa, sem componente compartilhado.
- **Ficha de impressão** (`PrintableSheet`, fora do front matter): tema visual totalmente à parte — fundo branco, paleta `gray-*`, sem sombras, layout em páginas A4 com `page-break`.

## Do's and Don'ts

**Do**
- Usar `colors.gold-*` / `colors.parchment-*` (via as classes `bg-gold-500`, `text-parchment-400` etc. — nunca hex cru) em qualquer tela nova do wizard. É o que faz o reteamado por sistema (`.theme-ordem`) funcionar automaticamente.
- Aplicar `typography.label` (Cinzel) a títulos, rótulos e valores de destaque; `typography.body` (Lora, herdado) para texto corrido.
- Seguir o padrão de accent-por-entidade (`CLASS_PRESENTATION`/`RACE_PRESENTATION`/`BACKGROUND_PRESENTATION`) ao adicionar novo conteúdo selecionável.
- Reservar `rounded.full` só para formas circulares (nós, avatares, dots).

**Don't**
- Não hardcodar hex via `style={{ color: '#...' }}` para cores de UI (chrome, fundo, texto) — é exatamente o que quebrou o reteamado em `GlobalGallery.tsx` e no shell do `OrdemApp.tsx`. Se a cor precisa mudar por sistema, ela tem que resolver por `var(--color-*)`, não um valor calculado à mão que imita o token.
- Não introduzir uma nova cor Tailwind stock (`red-*`, `purple-*`, `amber-*`, `zinc-*`, `slate-*`...) para mais um estado de "aviso" ou "categoria" sem checar se já existe um uso equivalente.
- Não escolher `rounded`/tamanho de fonte/padding "no olho" para um novo card — usar os tokens `rounded.*`/`typography.*`/`spacing.*` acima como ponto de partida, mesmo sabendo que eles foram reconstruídos por observação, não declarados originalmente.
- Não duplicar valores de cor entre `.theme-ordem` (CSS) e componentes JS. Se um componente novo do Ordem precisa da cor de marca, ele deve puxar `gold-500`/`parchment-400` etc., não copiar o hex de `.theme-ordem` para dentro de um objeto JS (como fez `SYSTEM_UI` em `GlobalGallery.tsx`).

## Inconsistências identificadas

1. **Duas paletas de cor paralelas para o mesmo produto.** A maior parte do wizard D&D usa os tokens (`bg-gold-500`, `text-parchment-400`...). Mas o trabalho mais recente — `GlobalGallery.tsx` (tela de galeria) e o shell novo do `OrdemApp.tsx` (sidebar, header de etapa) — foi escrito inteiramente com hex inline via `style={{}}`, com valores próximos mas **não idênticos** aos tokens (ex.: fundo `#0e0c0a`/`#0b0608` na galeria/Ordem vs `parchment-950` `#120c04`/`#120a0c` no token; vermelho `#ef4444` repetido à mão em vários lugares do Ordem em vez de referenciar `gold-400-ordem`, que já vale exatamente isso). Resultado: o reteamado central (`.theme-ordem` sobrescrevendo `var(--color-*)`) simplesmente não se aplica a essas telas.

2. **Cor "accent" por entidade sem paleta.** ~34 valores hex em `classUtils.ts`/`raceUtils.ts`/`backgroundUtils.ts`, escolhidos individualmente, sem relação declarada entre si nem com `gold`/`parchment`. Funciona visualmente, mas não é auditável como paleta.

3. **Cores de status sem mapeamento.** Erro, aviso e categorias usam Tailwind stock (`red`, `purple`, `amber`, `zinc`, `slate`, `green`) diretamente, cada tela escolhendo por conta própria. O mesmo vermelho pode significar "campo obrigatório" ou "ritual mais perigoso" sem nenhuma relação formal entre os dois usos.

4. **Radius sem critério de papel.** `rounded.lg`/`rounded.xl` dominam, mas `ClassCard`/`RaceCard` (`rounded.xxl`) e `BackgroundCard`/`EquipmentChoiceCard` (`rounded.xl`) resolvem o mesmo problema — cartão de escolha selecionável — com raios diferentes.

5. **Tipografia sem escala.** `text-2xl` vs `text-3xl` competem pelo mesmo papel de "título de tela"; rótulos uppercase variam entre seis tamanhos e cinco letter-spacings distintos sem que nenhum pareça a escolha "certa" — parecem valores ajustados visualmente um a um. Os tokens `typography.*` no front matter são a melhor aproximação de uma escala, não uma escala real.

6. **Espaçamento sem escala.** Mesmo padrão do item 5: valores próximos (`py-2` vs `py-2.5` vs `py-3`; `px-4` vs `px-5` vs `px-6`) convivem em componentes com o mesmo papel.

7. **`font-fantasy` aplicada muito além da regra global.** O CSS declara `font-fantasy` só para `h1/h2/h3` (`@layer base`), mas na prática quase todo componente aplica a classe manualmente a botões, badges, labels e valores — a regra global é, na prática, redundante.

8. **Só dois componentes verdadeiramente compartilhados** (`Tooltip`, `StepIndicator`) em um app com ~30 arquivos de componente. A consistência que existe hoje é fruto de copiar-e-colar, não de reuso de código — o que explica por que pequenas divergências (itens 1, 4, 5, 6) se acumulam sem serem percebidas.

9. **Ficha de impressão como sistema de cor paralelo, não documentado.** `PrintableSheet` (D&D e Ordem) abandona `gold`/`parchment` inteiramente por uma paleta `gray-*` do Tailwind puro, com fundo branco forçado. É a decisão certa para papel, mas não há nenhum comentário no código explicando que é um tema à parte intencional.

10. **Alvo de clique abaixo do próprio mínimo briefado.** O handoff de design do Ordem (histórico) definia acessibilidade como motivo central do redesign, com regra explícita de "alvos ≥ 40×40px". O `IconBtn` de `GlobalGallery.tsx` (duplicar/exportar/excluir na linha de personagem) usa `w-[35px] h-[35px]` — 5px abaixo do próprio mínimo que motivou o redesign.

11. **O schema do DESIGN.md não modela alguns dos padrões mais usados no código real** (cor de borda por seleção, hex inline por sistema, paleta por entidade). Isso não é um problema do código — é um limite do formato de tokens (só `backgroundColor`/`textColor`/`typography`/`rounded`/`padding`/`size`/`height`/`width` são propriedades reconhecidas de componente). Esses padrões estão documentados em prosa nas seções acima, mas ficam fora do que uma ferramenta consegue validar automaticamente hoje.
