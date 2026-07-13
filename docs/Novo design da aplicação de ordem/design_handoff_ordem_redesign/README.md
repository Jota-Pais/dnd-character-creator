# Handoff: Redesign do módulo Ordem Paranormal (padrão visual)

## Visão geral
Novo padrão de design para o app "Forja de Heróis" (criador de fichas), módulo **Ordem Paranormal**: tema escuro ocultista com vermelho do Símbolo Maior, foco em **usabilidade** — texto grande, alto contraste, opções sempre legíveis (sem clicar uma a uma), alvos de clique generosos.

Este pacote descreve **apenas o padrão de design** (tokens, tipografia, componentes, layout). As regras de negócio das telas (validação, cálculos, ordem das etapas) já existem no codebase e **não mudam**.

## Sobre os arquivos deste pacote
`Redesign Ordem.dc.html` é uma **referência de design em HTML** — um protótipo mostrando aparência e comportamento pretendidos, não código de produção. A tarefa é **recriar este visual no codebase existente** (React 19 + Tailwind v4 + Zustand), usando os padrões já estabelecidos (ex.: sobrescrever tokens no escopo `.theme-ordem` em `src/index.css`, como já é feito hoje).

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos e estados são finais — recriar pixel-perfect com Tailwind.

## Design tokens

### Cores — módulo Ordem (escopo `.theme-ordem`)
Fundos:
- `#0b0608` — fundo principal das telas do wizard
- `#0e080a` — sidebar / barras de rodapé
- `#120a0c` — cards, inputs, superfícies
- `#1a0c0e` — superfícies secundárias (avatares, botões de stepper)
- `#170c0e` / `#170d0f` — hover de linhas/itens

Vermelhos (acento Ordem):
- `#ef4444` — acento principal (números, valores, ícones ativos)
- `#dc2626` — botões primários, símbolo, seleção
- `#fca5a5` — texto de destaque sobre fundo escuro (títulos ativos, chips)
- `#fecaca` — glifo ✦ de etapa concluída
- `#7f1d1d` — bordas de destaque/seleção
- `#2a0d0f` — fundo de item ativo/selecionado
- `#c96a6a` — links/ações secundárias vermelhas
- Fundo de chip selecionável: `rgba(220,38,38,.12)`

Neutros (texto):
- `#f6ece0` — títulos e texto principal
- `#ede2d6` — texto padrão
- `#d8c7b8` — corpo de leitura em cards
- `#cbb8a8` — labels/uppercase
- `#b3a094` — texto secundário
- `#a08b80` — texto terciário (mínimo permitido para texto legível)
- `#8a7368` — apenas estados desabilitados
- Bordas neutras: `#2a1518` (padrão), `#3d2a2c` (inputs/botões), hover `#6b4a44`

Tela neutra compartilhada (galeria, serve Ordem + D&D):
- fundo `#0e0c0a`, bordas `#3a332b` (hover `#5c5245`), texto secundário `#a39685` / `#cbbfae`
- botão primário neutro: fundo `#e8d5b7`, texto `#1a1510`, hover `#f5e8cc`
- Acentos D&D (dourado, tema atual mantido): `#f0b429`, `#fcd67a`, bordas `#7a4e05`, fundo ativo `#241a08`/`#31230b`, linha `#13100a`/`#181308`, hover borda `#7a4e05`

Elementos paranormais (etiquetas de rituais):
- Sangue `#ef4444` · Morte `#a1a1aa` · Energia `#c084fc` · Conhecimento `#fbbf24` · Medo `#e2e8f0`
- Chip de elemento: cor do elemento no texto + borda, fundo `rgba(<cor>,.12)`, uppercase 10.5px, letter-spacing .08em

Sombras/glow:
- Botão primário: `0 4px 18px rgba(220,38,38,.35)` (CTA final: `0 4px 22px rgba(220,38,38,.45)`)
- Seleção: `0 0 14–18px rgba(220,38,38,.2–.3)`
- Foco de input: `0 0 0 4px rgba(220,38,38,.15–.18)` + borda `#dc2626`

### Tipografia
- Display/títulos/labels de etapas: **Cinzel** (Google Fonts; 400/600/700/900)
- Corpo: **Lora** (400/500/600/700)
- Overline de etapa: 11px, uppercase, letter-spacing .22em, cor `#ef4444`, weight 600
- H2 da etapa: Cinzel 700, 25–27px, `#f6ece0`
- Labels de seção em cards: 11px uppercase, letter-spacing .16em, `#cbb8a8`
- Corpo em cards: 13.5–14px, line-height 1.5–1.6
- Valores numéricos grandes (NEX, PV, pontos): Cinzel 900, 22–26px, `#ef4444`
- **Tamanho mínimo de texto: 11px** (só para overlines/labels); texto de leitura nunca abaixo de 12.5px

### Espaçamento e formas
- Border-radius: 10–12px (cards e botões), 8px (chips, itens de lista, inputs pequenos), 999px (pills)
- Padding de cards: 16–20px × 20–24px
- Gaps: 8–12px entre itens de lista; 24–28px entre colunas
- Alvos de clique: **mínimo 40×40px** (steppers 40px, botões de ação 35–38px em linhas densas)

## O Símbolo Maior (asset `simbolo-maior.webp`)
Arte branca sobre transparente — usar sempre como **máscara CSS** de uma camada vermelha:

```css
background: #dc2626;
mask: url('simbolo-maior.webp') center/contain no-repeat;
-webkit-mask: url('simbolo-maior.webp') center/contain no-repeat;
```

Usos:
1. **Logo** — 34–44px ao lado do wordmark "ORDEM".
2. **Fundo ambiente** — 560–720px, fora do centro (cantos), `opacity: .07–.13`, com rotação lenta contínua (`rotate 360deg` em **240s linear infinite**), `pointer-events:none`. Varie o canto por tela. Nunca na galeria neutra.
3. Vinheta opcional: `radial-gradient` vermelho `rgba(127,29,29,.18–.25)` no mesmo canto.

## Padrões de componentes

### Shell do wizard
- **Sidebar fixa 250px** (fundo `#0e080a`, borda direita `#2a1518`): logo + wordmark; chip do agente ("Agente: Nome · NEX X%"); lista das 9 etapas; rodapé "← Meus agentes".
- Item de etapa: círculo 23px com número (Cinzel 700) + label 12.5px.
  - **Concluída**: círculo preenchido `#7f1d1d` com glifo `✦` `#fecaca`; label `#cbb8a8`; clicável.
  - **Ativa**: fundo `#2a0d0f`, borda `#7f1d1d`, círculo com borda `#ef4444`, label `#fca5a5` 700.
  - **Pendente**: borda `#3d2a2c`, número `#8a7368`, label `#b3a094`; não clicável.
- **Área principal**: overline "ETAPA N DE 9 · NOME" + H2 + subtítulo; sigilo ao fundo.
- **Rodapé de navegação**: barra com borda superior `#2a1518`, fundo `#0e080a`; "← Voltar" (texto) à esquerda; CTA vermelho à direita.

### Botões
- **Primário**: fundo `#dc2626`, hover `#ef4444`, texto branco, Cinzel 700 14.5px, letter-spacing .06em, radius 10px, padding 12px 30px, sombra vermelha. Sufixo `✦` no CTA de avanço.
- **Desabilitado com explicação**: fundo `#5a1214`, texto `#c9a5a5`, `cursor:not-allowed`, e o rótulo diz **o que falta** (ex.: "Escolha mais 2 perícias") em vez de só "Continuar".
- **Secundário**: transparente, borda `#3d2a2c`, texto `#b3a094`; hover: borda `#6b4a44`, texto `#ede2d6`.
- **Ícone**: 35–38px quadrado, radius 8px, mesma paleta do secundário; hover de ação destrutiva vira vermelho (`#ef4444` + borda `#7f1d1d`).

### Cards de opção (classe, origem)
- Não selecionado: borda 2px `#2a1518`, fundo `#120a0c`; hover borda `#7f1d1d`.
- Selecionado: borda 2px `#dc2626`, fundo `#2a0d0f`, glow, badge "Selecionada ✦" (pill `#dc2626`) ou sufixo `✦`.
- **Cada card mostra a informação-chave sem precisar de clique** (descrição completa, ou perícias + nome do poder).
- Padrão mestre-detalhe: grade de opções à esquerda + painel de detalhe sticky à direita.

### Chips de perícia
- Garantida: texto `#fca5a5`, fundo `rgba(220,38,38,.12)`, borda `#7f1d1d`, 13–13.5px 600, padding 6px 14px, radius 6px.
- Selecionada (removível): fundo `#dc2626`, texto branco, sufixo `✕`.
- Disponível: texto `#cbb8a8`, fundo `#120a0c`, borda `#3d2a2c`; hover vermelho.
- Grupos com contador visível: "4 **de 6**" (número em Cinzel 900 vermelho).

### Tiles de estatística (PV/PE/Sanidade/Defesa)
Card centrado: label 10.5px uppercase `#a08b80` + valor Cinzel 900 24–26px `#ef4444`. Em destaque (revisão): borda `#7f1d1d`, fundo `rgba(42,13,15,.4)`.

### Listas de seleção longas (rituais etc.)
Substituir `<select>` por **catálogo visível**: slots escolhidos no topo (cards com etiqueta de elemento) + grade de opções em 2 colunas com nome + elemento, filtros por elemento em pills coloridas.

### Galeria (tela compartilhada)
Neutra (sem vermelho no chrome, sem sigilo de fundo). Personagens em **linhas** (grid `40px 1.4fr 1fr auto auto`): avatar losango (quadrado 40px rotacionado 45°, inicial dentro), nome + subtítulo, NEX/Nível, botão "Abrir", ações em ícones. Seções separadas por sistema, cada uma com cabeçalho na cor do sistema (marcador + título + contador em pill + régua em gradiente).

## Interações e estados
- Hover sempre presente em itens clicáveis (borda e/ou texto clareiam; nunca só opacidade).
- Foco de input: borda `#dc2626` + anel `rgba(220,38,38,.15)`.
- Transições curtas (~150–200ms) em cor/borda; rotação do sigilo 240s linear infinite.
- Navegação livre entre etapas já visitadas pela sidebar (mesma regra atual do app).
- Etapa desabilitada não tem hover nem cursor pointer.

## Acessibilidade / usabilidade (motivo do redesign)
- Nada de texto com baixa opacidade sobre escuro — usar a escala de neutros acima.
- Texto de leitura ≥ 12.5px; descrições nunca truncadas em telas de escolha.
- Alvos ≥ 40px; contadores e mensagens dizem exatamente o que falta.
- Opções comparáveis lado a lado (mestre-detalhe), sem esconder informação atrás de cliques.

## Assets
- `simbolo-maior.webp` — Símbolo Maior (1000×1000, branco/alpha), copiado de `src/systems/ordem/assets/`. Usar via mask, nunca `<img>` direto sobre fundo claro.
- Fontes: Cinzel + Lora via Google Fonts (já usadas no app).

## Arquivos
- `Redesign Ordem.dc.html` — protótipo de referência com as telas: Galeria (neutra, 2 seções), Nome, Atributos, Origem, Classe, Perícias, Rituais, Revisão. Abra no navegador; a seção "2a" é a versão aprovada.
- `simbolo-maior.webp` — asset do símbolo.

## Fora do escopo deste handoff
- Regras/validações das etapas (já existem no codebase).
- Telas Progressão (6) e Equipamento (8) — aplicar os mesmos padrões acima.
- Tema D&D: mantém o dourado atual; apenas a galeria compartilhada adota o chrome neutro descrito.
