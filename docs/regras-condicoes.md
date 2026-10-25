# Condições — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR, Apêndice A "Condições", págs. 291-293 (com remissões pontuais aos Caps. 7, 8, 9 e 10 e à Introdução, citadas em cada trecho).
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt` (linhas 28440-28605). Esta é a **fonte da verdade documental** para as condições do módulo de jogo (pipeline: livro → este doc → `conditions.json`/tipos/utils → UI).
>
> As condições são aplicadas **durante o jogo** (por magia, ataque, perigo do ambiente). Na criação de ficha elas não existem; no app, vivem no **estado de jogo**, nunca na ficha.

## 1. Regras gerais (pág. 291)

- Condições **alteram as capacidades** de uma criatura de diversas maneiras e surgem como resultado de uma magia ou outro efeito. A maioria (como **cego**) é prejudicial; algumas poucas (como **invisível**) podem ser vantajosas.
- **Fim da condição:** uma condição se encerra ao ser **remediada** (ex.: **caído** é remediado levantando-se) **ou** de acordo com uma **duração** expressa no efeito que a impôs.
- **Não acumulam consigo mesmas:** se mais de um efeito impuser a **mesma** condição a uma criatura, **cada aplicação tem sua própria duração**, mas os efeitos **não se agravam**. "Ou a criatura tem a condição ou não."
  - A **Exaustão** funciona de outro jeito, mas isso não vem deste texto introdutório: é o quadro da pág. 292 que diz que um novo efeito de exaustão **aumenta o nível atual** (linhas 28548-28551; ver seção 4).
- As definições a seguir especificam o que acontece a uma criatura sujeita a cada condição.

## 2. Índice das condições (págs. 291-293)

O extrato traz **14 condições + Exaustão**, na ordem alfabética do livro em português. A Exaustão aparece no extrato entre Inconsciente e Invisível (é um quadro destacado na pág. 292); a lista sugerida de ids **bate 1:1** com o extrato.

| # | Condição (livro) | `id` | Pág. |
| --- | --- | --- | --- |
| 1 | Agarrado | `grappled` | 291 |
| 2 | Amedrontado | `frightened` | 291 |
| 3 | Atordoado | `stunned` | 291 |
| 4 | Caído | `prone` | 291 |
| 5 | Cego | `blinded` | 291 |
| 6 | Enfeitiçado | `charmed` | 292 |
| 7 | Envenenado | `poisoned` | 292 |
| 8 | Impedido | `restrained` | 292 |
| 9 | Incapacitado | `incapacitated` | 292 |
| 10 | Inconsciente | `unconscious` | 292 |
| 11 | Invisível | `invisible` | 293 |
| 12 | Paralisado | `paralyzed` | 293 |
| 13 | Petrificado | `petrified` | 293 |
| 14 | Surdo | `deafened` | 293 |
| — | Exaustão (quadro) | `exhaustion` | 292 |

## 3. As condições (págs. 291-293)

### 3.1 Agarrado — `grappled` (pág. 291)

- O **deslocamento** de uma criatura agarrada se torna **0**, e ela **não pode se beneficiar de qualquer bônus** em seu deslocamento.
- A condição **se encerra** caso a criatura que a agarrou fique **incapacitada** (ver 3.9).
- A condição **se encerra** se um efeito (como a magia *onda trovejante*) **remover** a criatura agarrada do **alcance** de quem a agarrou ou do efeito que causa a condição.

### 3.2 Amedrontado — `frightened` (pág. 291)

- Sofre **desvantagem em testes de habilidade e jogadas de ataque** enquanto a **fonte do seu medo estiver em sua linha de visão**.
- **Não pode se mover voluntariamente** para uma posição que a faça **terminar o turno mais próxima** da fonte de medo do que sua posição inicial. *(ver Pontos em aberto, item 1)*

### 3.3 Atordoado — `stunned` (pág. 291)

- Está **incapacitada** (ver 3.9). **Não pode se mover** e somente pode **falar hesitantemente**.
- **Falha automaticamente** em testes de resistência de **Força ou Destreza**.
- Jogadas de ataque **contra** a criatura possuem **vantagem**.

### 3.4 Caído — `prone` (pág. 291)

- A única opção de movimento é **rastejar**, a menos que ela **se levante**, encerrando assim a condição.
- Sofre **desvantagem nas jogadas de ataque**.
- Uma jogada de ataque **contra** a criatura possui **vantagem** se o atacante estiver **a 1,5 metro** dela; de qualquer outra forma, a jogada sofre **desvantagem**.

### 3.5 Cego — `blinded` (pág. 291)

- **Falha automaticamente** em qualquer **teste de habilidade que requeira o uso da visão**.
- Jogadas de ataque **contra** a criatura possuem **vantagem**, e **os ataques da criatura** sofrem **desvantagem**.
- *(O texto pt-BR não traz a frase "não pode ver" — ver Pontos em aberto, item 2.)*

### 3.6 Enfeitiçado — `charmed` (pág. 292)

- **Não pode atacar quem a enfeitiçou** nem tê-lo como alvo de habilidades ou efeitos mágicos nocivos.
- **Quem a enfeitiçou** possui **vantagem** em testes de habilidade feitos para **interagir socialmente** com a criatura.

### 3.7 Envenenado — `poisoned` (pág. 292)

- Sofre **desvantagem em jogadas de ataque e testes de habilidade**.

### 3.8 Impedido — `restrained` (pág. 292)

- O **deslocamento** se torna **0**, e ela **não pode se beneficiar de qualquer bônus** em seu deslocamento.
- Jogadas de ataque **contra** a criatura possuem **vantagem**, e **os ataques da criatura** sofrem **desvantagem**.
- Sofre **desvantagem em testes de resistência de Destreza**.

### 3.9 Incapacitado — `incapacitated` (pág. 292)

- **Não pode realizar ações ou reações.**

### 3.10 Inconsciente — `unconscious` (pág. 292)

- Está **incapacitada** (ver 3.9). **Não pode se mover ou falar** e **não tem ciência de seus arredores**.
- **Larga tudo que estiver segurando** e **fica caída**.
- **Falha automaticamente** em testes de resistência de **Força ou Destreza**.
- Jogadas de ataque **contra** a criatura possuem **vantagem**.
- Qualquer ataque que **atinja** a criatura é um **acerto crítico**, se o atacante estiver **a 1,5 metro** dela.

### 3.11 Invisível — `invisible` (pág. 293)

- É **impossível de ser vista** sem a ajuda de magia ou sentidos especiais. Para o propósito de **se esconder**, a criatura é considerada em **área de escuridão densa** (termo do Cap. 8, pág. 185). A localização pode ser **detectada** por qualquer barulho que ela faça ou rastros que deixe.
- Jogadas de ataque **contra** a criatura sofrem **desvantagem**, e **os ataques da criatura** possuem **vantagem**.

### 3.12 Paralisado — `paralyzed` (pág. 293)

- Está **incapacitada** (ver 3.9). **Não pode se mover ou falar.**
- **Falha automaticamente** em testes de resistência de **Força e Destreza**.
- Jogadas de ataque **contra** a criatura possuem **vantagem**.
- Qualquer ataque que **atinja** a criatura é um **acerto crítico**, se o atacante estiver **a 1,5 metro** dela.

### 3.13 Petrificado — `petrified` (pág. 293)

- Está **transformada**, junto com todos os **objetos não-mágicos** que estiver vestindo ou carregando, em uma substância sólida e inanimada (geralmente pedra). Seu **peso é multiplicado por dez**, e ela **para de envelhecer**.
- Está **incapacitada** (ver 3.9), **não pode se mover ou falar**, e **não tem ciência de seus arredores**.
- Jogadas de ataque **contra** a criatura possuem **vantagem**.
- **Falha automaticamente** em testes de resistência de **Força e Destreza**.
- Tem **resistência a todos os tipos de dano**.
- É **imune a veneno e doenças**, embora um veneno ou doença **previamente presente** em seu sistema seja apenas **suspenso**, não neutralizado.

### 3.14 Surdo — `deafened` (pág. 293)

- **Falha automaticamente** em qualquer **teste de habilidade que requeira o uso da audição**.
- *(O texto pt-BR não traz a frase "não pode ouvir" — ver Pontos em aberto, item 2.)*

## 4. Exaustão — `exhaustion` (pág. 292)

Algumas habilidades especiais e perigos ambientais (como **fome** e **exposição prolongada a temperaturas congelantes ou escaldantes**) podem impor uma condição especial chamada **exaustão**. Ela é medida em **seis níveis**. Um efeito pode fazer uma criatura sofrer **um ou mais níveis**, como especificado na descrição do efeito.

| Nível | Efeito |
| --- | --- |
| 1 | Desvantagem em testes de habilidade |
| 2 | Deslocamento reduzido à metade |
| 3 | Desvantagem nas jogadas de ataque e testes de resistência |
| 4 | Máximo de pontos de vida reduzido à metade |
| 5 | Deslocamento reduzido a 0 |
| 6 | Morte |

- **Acúmulo:** se uma criatura que já possui um nível de exaustão sofrer outro efeito que também causa exaustão, o nível atual **aumenta** na quantidade especificada pela descrição do efeito que a causou.
- **Efeitos cumulativos:** a criatura sofre o efeito do **nível atual e de todos os níveis anteriores**. Ex. do livro: no nível 2, deslocamento pela metade **e** desvantagem em testes de habilidade.
- **Remoção:** um efeito que remova exaustão **reduz seu nível**; **todos** os efeitos de exaustão desaparecem se o nível for reduzido **abaixo de 1**.
- **Descanso longo:** terminar um descanso longo reduz a exaustão em **1 nível**, **contanto que** a criatura também tenha **ingerido um pouco de água e comida**.

## 5. Regras de outros capítulos que tocam as condições

Não fazem parte do Apêndice A, mas o módulo de jogo precisa delas para aplicar as condições corretamente. Todas estão no mesmo extrato.

| Regra | O que diz | Pág. | Linhas do extrato |
| --- | --- | --- | --- |
| Arredonde para baixo | Ao dividir qualquer número no jogo, arredonde para baixo se terminar em fração, mesmo se a fração for maior que a metade. | 7 | 516-520 |
| Vantagem e desvantagem | Várias fontes de vantagem (ou de desvantagem) ainda dão só **um** d20 adicional. Se houver vantagem **e** desvantagem, elas se anulam, **mesmo** que haja várias de um lado e uma só do outro: rola-se um d20. | 175 | 15471-15494 |
| Testes passivos | Valor = 10 + modificadores do teste; **+5** com vantagem, **−5** com desvantagem. | 177 | 15701-15716 |
| Iniciativa | É um **teste de Destreza**, ou seja, é teste de habilidade. | 179 | 15944-15948 |
| Escuridão densa | Bloqueia a visão; quem está nela está efetivamente cego ao tentar ver algo obscurecido. | 185 | 16549-16553 |
| Estar caído | Jogar-se ao chão não gasta deslocamento. **Levantar-se custa metade do deslocamento** (9 m → 4,5 m); **não pode** se levantar sem deslocamento suficiente ou com **deslocamento 0**. Rastejar: cada 1,5 m custa 1,5 m adicional. | 192-193 | 17218-17236 |
| Agarrar | Agarrar: teste de Força (Atletismo) resistido por Força (Atletismo) ou Destreza (Acrobacia) do alvo (o alvo escolhe). O agarrador pode soltar quando quiser (sem ação). **Escapar** custa uma **ação**: teste de Força (Atletismo) ou Destreza (Acrobacia) resistido pelo Força (Atletismo) do agarrador. Mover levando o agarrado: deslocamento pela metade (salvo se ele for 2+ categorias de tamanho menor). | 197 | 17653-17669 |
| Caindo inconsciente | Dano que reduz os PV a 0 e não mata deixa o personagem **inconsciente**; essa inconsciência **acaba quando ele recupera qualquer PV**. | 199 | 17864-17868 |
| Nocauteando uma criatura | Quem reduz uma criatura a 0 PV com ataque corpo-a-corpo pode nocauteá-la, escolhendo no instante do dano; a criatura **cai inconsciente e está estável**. | 200 | 17934-17941 |
| Concentração | Perde-se a concentração ao **ficar incapacitado ou morrer**. | 205 | 18370-18372 |

## 6. Notas de implementação (mapeamento pro app)

Não faz parte da regra do livro: orienta a fase `/src/data` → código do módulo de jogo.

### 6.1 Onde mora cada coisa

- **`src/systems/dnd5e/data/conditions.json`**: catálogo estático (as 14 condições + exaustão), com texto do livro e efeitos estruturados. Nenhuma regra de condição espalhada em `if` na UI (mesma regra de ouro de `sheetEffects.ts`).
- **Estado de jogo** (separado da ficha, que nunca é reescrita): guarda **quais condições estão ativas** e o **nível de exaustão**, e nada mais. Os números com condição aplicada são **derivados** na hora (ficha + estado de jogo → ficha efetiva), do mesmo jeito que `getSkillChecks` deriva perícias.
  - Proposta: `conditions: { id: ConditionId; instances: { source?: string; duration?: string }[] }[]` e `exhaustionLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6` (mesmo nome de campo de `regras-descanso.md`, seção 6.1). As `instances` existem para honrar "cada aplicação tem sua própria duração" (seção 1); a condição está ativa enquanto tiver **pelo menos uma** instância, e os efeitos **nunca** se multiplicam por instância. (Pontos em aberto, item 7, decidido: no MVP, lista de ids com uma nota de duração opcional por condição.)
- **Motor de rolagem** (`src/core/dice`, puro e agnóstico de sistema): não conhece condições. O contrato é o de `regras-rolagens-e-concentracao.md`, seção 11.2: `modifiers: { value, source, label }[]` e as duas listas `advantageSources[]` / `disadvantageSources[]`, das quais uma função pura resolve o `mode` pela regra da pág. 175 (adv + desv = normal; várias do mesmo lado = uma). As fontes ficam guardadas para a UI explicar "por que essa jogada é normal (Envenenado × Invisível)".
  - O lado **dnd5e** traduz os efeitos ativos de condição e exaustão em entradas dessas listas, com `source` estável, por exemplo `condition:poisoned`, `condition:invisible`, `exhaustion:3`, e em `modifiers[]` quando houver número. **Decidido (item 13):** isso mora no **mesmo agregador** `utils/sheetEffects.ts` (vocabulário em `types/effects.ts`), com o estado de jogo como mais uma fonte. Nada de agregador paralelo.
  - A **falha automática** é conceito do D&D e **não** é flag do core: o dnd5e a decide **antes** de chamar o motor e grava a jogada com `outcome` forçado de falha no registro (`forcedOutcome` do 11.2, item 7), com a origem ("Falha automática (Paralisado)"). **Decidido (item 9):** o app mostra como falha, com um "rolar mesmo assim" discreto que não bloqueia.

### 6.2 Forma de dados proposta para `conditions.json`

```jsonc
{
  "conditions": [
    {
      "id": "restrained",            // estável, inglês; nunca muda
      "name": "Impedido",            // rótulo pt-BR do livro
      "page": 292,
      "text": [                      // tópicos do livro, para o card/tooltip
        "O deslocamento de uma criatura impedida se torna 0, e ela não pode se beneficiar de qualquer bônus em seu deslocamento.",
        "Jogadas de ataque contra a criatura possuem vantagem, e os ataques da criatura sofrem desvantagem.",
        "A criatura sofre desvantagem em testes de resistência de Destreza."
      ],
      "implies": [],                 // condições DERIVADAS (somem junto com esta)
      "onApply": {},                 // efeitos que ficam ao aplicar (sobrevivem ao fim desta)
      "effects": [
        { "kind": "speed", "op": "set", "value": 0, "ignoreBonuses": true, "scope": "sheet" },
        { "kind": "rollMode", "roll": "attack", "mode": "disadvantage", "scope": "sheet" },
        { "kind": "rollMode", "roll": "save", "abilities": ["dex"], "mode": "disadvantage", "scope": "sheet" },
        { "kind": "againstYou", "text": "Jogadas de ataque contra você têm vantagem.", "scope": "notice" }
      ]
    }
  ],
  "exhaustion": {
    "id": "exhaustion",
    "name": "Exaustão",
    "page": 292,
    "maxLevel": 6,
    "cumulative": true,              // nível N aplica os efeitos de 1..N
    "longRest": { "reduceBy": 1, "requires": "Ter ingerido um pouco de água e comida." },
    "levels": [
      { "level": 1, "text": "Desvantagem em testes de habilidade", "effects": [ { "kind": "rollMode", "roll": "abilityCheck", "mode": "disadvantage", "scope": "sheet" } ] },
      { "level": 2, "text": "Deslocamento reduzido à metade",       "effects": [ { "kind": "speed", "op": "half", "scope": "sheet" } ] },
      { "level": 3, "text": "Desvantagem nas jogadas de ataque e testes de resistência", "effects": [
          { "kind": "rollMode", "roll": "attack", "mode": "disadvantage", "scope": "sheet" },
          { "kind": "rollMode", "roll": "save", "mode": "disadvantage", "scope": "sheet" } ] },
      { "level": 4, "text": "Máximo de pontos de vida reduzido à metade", "effects": [ { "kind": "hpMax", "op": "half", "scope": "sheet" } ] },
      { "level": 5, "text": "Deslocamento reduzido a 0",            "effects": [ { "kind": "speed", "op": "set", "value": 0, "scope": "sheet" } ] },
      { "level": 6, "text": "Morte",                                "effects": [ { "kind": "death", "scope": "gameState" } ] }
    ]
  }
}
```

- **Texto de Cego e Surdo** (decidido, item 2): o `text` do app acrescenta a frase de abertura que falta no pt-BR, "não pode ver" (Cego) e "não pode ouvir" (Surdo), antes da falha automática. O Amedrontado mantém o texto pt-BR (item 1).

Vocabulário de `kind` proposto. **Onde mora (decidido, item 13):** estende `types/effects.ts` e é agregado por `sheetEffects.ts`, com o estado de jogo como mais uma fonte agregada. Como `FeatureEffects` hoje é um objeto de campos opcionais (não uma união por `kind`), a forma exata de encaixar o vocabulário fica para a implementação. A tabela abaixo descreve o conteúdo:

| `kind` | Campos | Exemplo de uso |
| --- | --- | --- |
| `rollMode` | `roll: 'attack' \| 'abilityCheck' \| 'save'`, `abilities?`, `mode`, `when?` | Envenenado, Impedido, Exaustão 1/3; com `when` vira linha (Amedrontado) |
| `autoFail` | `roll`, `abilities?`, `when?` | FOR/DES em Atordoado etc.; com `when` ("requer visão") vira aviso |
| `speed` | `op: 'set' \| 'half'`, `value?`, `ignoreBonuses?` | Agarrado, Impedido, Exaustão 2/5 |
| `cannotMove` / `cannotSpeak` | — | Atordoado, Paralisado, Inconsciente, Petrificado |
| `noActions` / `noReactions` | — | Incapacitado |
| `hpMax` | `op: 'half'` | Exaustão 4 |
| `damageResistance` | `types: 'all'` | Petrificado |
| `immunity` | `to: string[]` | Petrificado (ver Pontos em aberto, item 5) |
| `againstYou` | `text`, `mode?`, `within?` | vantagem de atacantes, crítico a 1,5 m |
| `notice` | `text` | narrativa: fala hesitante, peso ×10, não envelhece |
| `death` | — | Exaustão 6 |

`scope` é a classificação da seção 6.3: `sheet` (1), `notice` (2), `gameState` (3).

### 6.3 Classificação de cada efeito

**(1) `sheet`**: incondicional; muda número ou estado da ficha efetiva (entra no número, com a origem visível: "Deslocamento 0 (Agarrado)").
**(2) `notice`**: condicional, situacional ou sobre a rolagem de **outra** criatura; vira linha própria ou aviso, nunca altera número.
**(3) `gameState`**: mexe no estado de jogo (encerra concentração, aplica outra condição, bloqueia ações, morte).

| Condição | Efeito | Classe | Como o app aplica |
| --- | --- | --- | --- |
| Agarrado | Deslocamento 0, sem bônus | 1 | Deslocamento efetivo = 0; `ignoreBonuses` descarta os bônus que hoje vêm de `getSpeedBonuses` em `sheetEffects.ts` (ex.: `speedBonus` do Mobilidade) |
| Agarrado | Termina se o agarrador ficar incapacitado / for afastado | 2 | Aviso; a remoção é manual (o app não conhece o agarrador) |
| Agarrado | Escapar (pág. 197) | 3 | Atalho "Escapar": ação, rola FOR (Atletismo) ou DES (Acrobacia); se der certo, o jogador remove |
| Amedrontado | Desvantagem em testes de habilidade e ataques com a fonte à vista | 2 | Linha "com a fonte do medo à vista"; ver item 3 em aberto para um toggle |
| Amedrontado | Não se aproxima da fonte | 2 | Aviso |
| Atordoado | ⇒ Incapacitado | 3 | `implies: ["incapacitated"]` |
| Atordoado | Não pode se mover | 1 | Deslocamento efetivo exibido como 0 (Atordoado) |
| Atordoado | Fala hesitante | 2 | `notice` |
| Atordoado | Falha automática em resistência de FOR/DES | 1 | `autoFail` nos dois testes de resistência |
| Atordoado | Ataques contra têm vantagem | 2 | `againstYou` |
| Caído | Só rasteja; levantar custa metade do deslocamento, impossível com deslocamento 0 (pág. 193) | 3 | Botão "Levantar" remove a condição; bloqueado/avisado se deslocamento efetivo = 0 |
| Caído | Desvantagem nas jogadas de ataque | 1 | `rollMode` em todo ataque |
| Caído | Contra: vantagem a 1,5 m, desvantagem além | 2 | `againstYou` |
| Cego | Falha automática em teste que requer visão | 2 | Aviso (o app não sabe quais testes usam visão) |
| Cego | Seus ataques com desvantagem | 1 | `rollMode` em todo ataque |
| Cego | Ataques contra com vantagem | 2 | `againstYou` |
| Enfeitiçado | Não ataca nem mira quem enfeitiçou | 2 | Aviso |
| Enfeitiçado | Encantador com vantagem social | 2 | `againstYou` |
| Envenenado | Desvantagem em ataques e testes de habilidade | 1 | `rollMode` em ataques e em todo teste de habilidade (perícias, atributo puro, **iniciativa** com desvantagem) e valores passivos −5 (pág. 177; decidido, item 8) |
| Impedido | Deslocamento 0, sem bônus | 1 | Igual Agarrado |
| Impedido | Seus ataques com desvantagem | 1 | `rollMode` |
| Impedido | Desvantagem em resistência de DES | 1 | `rollMode` save `dex` |
| Impedido | Ataques contra com vantagem | 2 | `againstYou` |
| Incapacitado | Sem ações nem reações | 3 | Desabilita/avisa nos botões de ação/reação (ataque, conjurar) |
| Incapacitado | Encerra concentração (pág. 205) | 3 | Ao ficar ativo (direto ou por `implies`: Atordoado, Inconsciente, Paralisado, Petrificado), encerra a concentração do estado de jogo, com desfazer (assumido (F), a confirmar) |
| Inconsciente | ⇒ Incapacitado | 3 | `implies: ["incapacitated"]` (encerra concentração por tabela) |
| Inconsciente | Larga o que segura e fica caído | 3 | `onApply: { addConditions: ["prone"], dropHeldItems: true }`, disparado na transição para Inconsciente (6.4). O Caído **fica** quando a inconsciência acaba (só sai ao levantar; decidido, item 15); "largar" vira aviso se o app não rastrear mãos |
| Inconsciente | Não pode se mover ou falar; sem ciência dos arredores | 1 / 2 | Deslocamento efetivo 0; "sem ciência" como `notice` |
| Inconsciente | Falha automática em resistência de FOR/DES | 1 | `autoFail` |
| Inconsciente | Ataques contra com vantagem; crítico a 1,5 m | 2 | `againstYou` |
| Inconsciente | A 0 PV: entra; sai ao recuperar PV (pág. 199); nocaute: inconsciente e estável (pág. 200) | 3 | Derivada do `lifeState` (`dying`/`stable`), não gravada; os efeitos de `onApply` (Caído, aviso de largar, fim da concentração) disparam na transição para 0 PV, inclusive no nocaute (6.4; item 6, segue a proposta; `regras-dano-e-morte.md` já escrito igual) |
| Invisível | Seus ataques com vantagem | 1 | `rollMode` advantage em todo ataque |
| Invisível | Ataques contra com desvantagem; conta como escuridão densa para se esconder; detectável por barulho/rastros | 2 | `againstYou` + `notice` |
| Paralisado | ⇒ Incapacitado; não pode se mover ou falar | 3 / 1 | `implies` + deslocamento efetivo 0 |
| Paralisado | Falha automática em resistência de FOR/DES | 1 | `autoFail` |
| Paralisado | Ataques contra com vantagem; crítico a 1,5 m | 2 | `againstYou` |
| Petrificado | ⇒ Incapacitado; não se move, não fala, sem ciência | 3 / 1 | `implies` + deslocamento efetivo 0 |
| Petrificado | Falha automática em resistência de FOR/DES | 1 | `autoFail` |
| Petrificado | Resistência a todo dano | 1 | Incondicional enquanto durar: o pipeline de dano de `regras-dano-e-morte.md` aplica a metade sozinho (decidido, item 5), com a origem visível; com vulnerabilidade ao mesmo tipo, só a resistência (decisão 10) |
| Petrificado | Imune a veneno e doenças; veneno/doença prévios ficam suspensos | 3 | Envenenado ativo fica "suspenso" (sem efeito, não removido) enquanto Petrificado durar |
| Petrificado | Peso ×10, não envelhece | 2 | `notice` |
| Petrificado | Ataques contra com vantagem | 2 | `againstYou` |
| Surdo | Falha automática em teste que requer audição | 2 | Aviso |
| Exaustão 1 | Desvantagem em **todos** os testes de habilidade | 1 | `rollMode` em perícias, atributo puro e **iniciativa** (teste de DES, pág. 179); valores passivos −5 (pág. 177; decidido, item 8) |
| Exaustão 2 | Deslocamento à metade | 1 | `floor(deslocamento / 2)` (pág. 7) |
| Exaustão 3 | Desvantagem em ataques e **todos** os testes de resistência | 1 | Inclui o teste de resistência contra a morte e o de Constituição da concentração. O TR contra a morte de `regras-dano-e-morte.md` já recebe o modo (Notas, "Teste contra a morte"; item 16, segue a proposta) |
| Exaustão 4 | PV máximo à metade | 1 | `floor(pvMax / 2)` (pág. 7) no `maxHp` efetivo. Ao entrar, o PV atual acima do novo máximo **se perde**: o corte é gravado em `damageTaken` e não volta quando a exaustão sai (decidido, item 4) |
| Exaustão 5 | Deslocamento 0 | 1 | Prevalece sobre o "metade" do nível 2 |
| Exaustão 6 | Morte | 3 | `lifeState = 'dead'` (`regras-dano-e-morte.md`) e encerra a concentração (pág. 205), no mesmo evento desfazível (assumido (F), a confirmar) |
| Exaustão | Descanso longo −1 nível se comeu e bebeu | 3 | No fluxo de descanso longo, caixa "comeu e bebeu?", **marcada por padrão** (decidido, item 14), e reduz 1 nível. Com 0 PV no início do descanso, não reduz (assumido (A), `regras-descanso.md`) |

### 6.4 Implicação × efeito de aplicação

Duas relações diferentes, que não devem ser confundidas no modelo:

- **`implies` (derivada):** Atordoado, Inconsciente, Paralisado e Petrificado **estão incapacitados** enquanto durarem. O Incapacitado derivado **não é gravado** no estado de jogo: é calculado e some junto com a condição-mãe. O jogador vê "Incapacitado (por Paralisado)".
- **`onApply` (gravada):** Inconsciente **faz cair** (Caído) e **largar** o que segura. O Caído é gravado como condição própria e **sobrevive** ao fim da inconsciência, porque o livro remedia o Caído levantando-se (linhas 28447-28448), não acordando (decidido, item 15).
- **Inconsciente a 0 PV (modelo único, item 6; segue a proposta):** Inconsciente ativo = `lifeState` em `dying`/`stable` **ou** uma instância manual (magia *sono* etc.). A de 0 PV **não** é gravada em `conditions`, para não duplicar o `lifeState`. Como não há "aplicar" que dispare o `onApply`, os efeitos dele (Caído gravado, aviso de largar o que segura, fim da concentração, este assumido (F)) disparam na **transição** para 0 PV, inclusive no nocaute (que vai direto a `stable`, linhas 17940-17941), dentro do **mesmo evento desfazível** do dano. Ao recuperar PV, o `lifeState` volta a `conscious` e a inconsciência some sozinha; o Caído gravado fica (decisão 14). `regras-dano-e-morte.md` (Notas, "Máquina de estados de vida") descreve o mesmo modelo.
- Se o jogador aplicar Incapacitado direto **e** houver um implícito, vale a regra da seção 1: tem ou não tem, sem agravar.

### 6.5 Rolagem e números

- **Ordem de resolução por rolagem:** (a) `autoFail` incondicional → decidido no dnd5e, antes do motor: o app mostra "Falha automática (Paralisado)" como resultado, com um "rolar mesmo assim" discreto que não bloqueia (decidido, item 9); (b) converte cada `rollMode` de `scope: sheet` (condições + exaustão) numa entrada de `advantageSources[]`/`disadvantageSources[]` com sua origem, e o motor resolve pela regra da pág. 175 (adv + desv = normal, várias do mesmo lado = uma); (c) os `rollMode` com `when` aparecem como alternância por rolagem ("fonte do medo à vista?"), sem entrar no padrão.
- **Ataques contra você** (vantagem, crítico a 1,5 m) não são rolados pelo app num módulo individual: são só `notice` no painel de condições, para o jogador avisar o Mestre.
- **Deslocamento efetivo:** começa do deslocamento da ficha (em pés, como `races.json`/`speedBonus`), aplica `half` (Exaustão 2) e depois `set 0` (Agarrado, Impedido, Exaustão 5, "não pode se mover"). `ignoreBonuses` descarta os bônus antes de zerar (diferença só cosmética, já que o resultado é 0).
- **Estado de jogo apenas guarda; a ficha nunca muda.** Remover Exaustão 4 devolve o PV **máximo** da ficha sem cálculo extra. O PV **atual** fica como estava, porque o corte já foi gravado no `damageTaken` ao entrar na Exaustão 4 (decidido, item 4: opção (b)). A conta (`currentHp = max(0, sheetMaxHp − damageTaken)`, invariante `sheetMaxHp − damageTaken ≤ effectiveMaxHp`) é a de `regras-dano-e-morte.md` e `regras-descanso.md`, 6.1.
- **Passivos e iniciativa:** a desvantagem incondicional em testes de habilidade (Exaustão 1, Envenenado) vale também para a Percepção passiva e os demais valores passivos (−5, pág. 177) e para a iniciativa (desvantagem, teste de DES, pág. 179) (decidido, item 8; `regras-rolagens-e-concentracao.md`, item 6).

## 7. Pontos em aberto (decidir com o dono)

1. **Amedrontado: tradução diverge do inglês (linhas 28471-28473).** O pt-BR fala em "terminar o turno" mais perto da fonte; o inglês, só em não se aproximar. Qual texto usar? **Decidido (2026-10-24):** mantém o texto pt-BR.
2. **Cego e Surdo sem a frase de abertura (linhas 28491-28493 e 28603-28605).** Acrescentar "não pode ver" / "não pode ouvir"? **Decidido (2026-10-24):** sim, no `text` do app (seção 6.2).
3. **Amedrontado: padrão do "fonte à vista".** A proposta era alternância por rolagem **ligada por padrão**. Continua aberto: a proposta conflita com a seção 6.5(c) ("os `rollMode` com `when` aparecem como alternância por rolagem, sem entrar no padrão") e com a decisão do dono de que efeito condicional vira linha/aviso, não número. As notas seguem a 6.5(c) (desligada) até decisão.
4. **Exaustão 4 e PV atual (linha 28545).** (a) só limitar na leitura ou (b) gravar o corte? **Decidido (2026-10-24):** (b). O PV atual acima do novo máximo se perde (o corte é gravado em `damageTaken`) e não volta quando a exaustão sai. O teto da cura e a morte instantânea usam o máximo efetivo (assumido (C), a confirmar; `regras-dano-e-morte.md`, item 5).
5. **Petrificado "imune a veneno e doenças" (linhas 28599-28601).**
   - Resistência a todo dano: aplicar sozinha ou só mostrar? **Decidido (2026-10-24):** aplica no pipeline de dano, pela decisão de que efeito incondicional de condição entra no número (com vulnerabilidade ao mesmo tipo, só a resistência; decisão 10).
   - **Continua aberto:** "imune a veneno" é ao dano do tipo veneno, à condição Envenenado ou aos dois? O rastreador de PV zera o dano de veneno? A suspensão do Envenenado ativo (6.3) segue como proposta.
6. **0 PV ⇒ Inconsciente automático (linhas 17865-17868 e 17940-17941).** Modelo da 6.4 (derivado do `lifeState`, efeitos de `onApply` na transição para 0 PV, inclusive no nocaute). Segue a proposta até decisão em contrário. Partes já cobertas: o Caído continua ao acordar (**Decidido (2026-10-24)**, item 15); o fim da concentração ao ficar com 0 PV (**Assumido (2026-10-24), a confirmar (F)**). `regras-dano-e-morte.md` (Notas, "Máquina de estados de vida") já foi escrito igual.
7. **Instâncias por condição.** Lista de instâncias (origem/duração) ou um booleano por condição no MVP? **Decidido (2026-10-25):** no MVP, um liga/desliga por condição, com uma nota opcional de texto livre para a duração ("até o fim do próximo turno"). O app não conta tempo nem encerra a condição sozinho. As instâncias ficam para depois.
8. **Exaustão 1 nos valores passivos** (o mesmo vale para Envenenado). **Decidido (2026-10-24):** aplica: −5 na Percepção passiva e desvantagem na iniciativa.
9. **Falha automática e o dado físico.** Bloquear a rolagem ou deixar rolar? **Decidido (2026-10-24):** mostra como falha, com um "rolar mesmo assim" discreto (não bloqueia).
10. **Deslocamento à metade em metros.** 25 pés → 12 pés: mostrar 3,6 m ou arredondar para a grade de 1,5 m (3 m)? Sem decisão.
11. **Atacar alvo paralisado/inconsciente.** Toggle "alvo paralisado/inconsciente a 1,5 m" que transforma o acerto em crítico? Decisão de produto, sem decisão.
12. **Artefatos do extrato (não são divergências de regra):** "S CONDIÇÕES", "critura", o "conforme especificado no efeito" ausente na linha 28558 e o "Força e/ou Destreza" com o mesmo sentido. Só registro.
13. **Onde moram os efeitos de condição (decisão de arquitetura).** (a) estender `types/effects.ts`/`sheetEffects.ts` ou (b) agregador próprio? **Decidido (2026-10-24):** (a). O mesmo agregador `utils/sheetEffects.ts`, com o estado de jogo como mais uma fonte; nada de agregador paralelo.
14. **Padrão da caixa "comeu e bebeu" no descanso longo (linhas 28561-28563).** **Decidido (2026-10-24):** marcada por padrão, com o jogador podendo desmarcar.
15. **Ao acordar, o personagem continua Caído? (linhas 28525-28526 e 28447-28448).** **Decidido (2026-10-24):** sim, continua Caído até se levantar.
16. **TR contra a morte com vantagem/desvantagem** (Exaustão 3, linhas 28543-28544). Sem decisão própria. Segue a proposta (o TR contra a morte recebe as fontes de vantagem/desvantagem que valem para todos os testes de resistência) até decisão em contrário; já registrada em `regras-dano-e-morte.md` (Notas, "Teste contra a morte").
