# Dano, cura e morte — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR, Cap. 9 "Combate", págs. 195-200 ("Realizando um Ataque" até "Pontos de Vida Temporários"). Referências pontuais: Introdução, pág. 7 ("Arredonde para Baixo"); Cap. 3, págs. 85-86 (Campeão); Apêndice A, pág. 292 (condição Inconsciente).
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt` (linhas ~17471-17973). Esta é a **fonte da verdade documental** para o motor de rolagem e o estado de vida do **módulo de jogo** (pipeline: livro → este doc → dados/tipos/utils → UI).
>
> Escopo: só o que a ficha viva de **um personagem jogador** precisa — jogada de ataque (para o motor de rolagem), dano, cura, 0 PV, morte e PV temporários. Ficam fora: cobertura em detalhe, ataques de oportunidade, agarrão/encontrão, combate montado/subaquático, descanso (Cap. 8) e vantagem/desvantagem (Cap. 7).

## 1. Jogada de ataque (págs. 195-196)

### Estrutura de um ataque (págs. 195-196)

1. **Escolha o alvo** dentro do alcance do ataque: uma criatura, um objeto ou um local.
2. **Determine os modificadores.** O Mestre determina se o alvo tem cobertura e se você tem vantagem ou desvantagem contra ele. Magias, habilidades especiais e outros efeitos podem aplicar penalidades ou bônus na jogada de ataque.
3. **Resolva o ataque.** Você faz a jogada de ataque. Se acertar, joga o dano, a não ser que o ataque tenha regras específicas que digam o contrário. Alguns ataques causam efeitos especiais em adição ou ao invés do dano.

"Se você realiza uma jogada de ataque, então você está realizando um ataque."

### Jogadas de ataque (pág. 196)

- Jogue **1d20 + os modificadores apropriados**. Se o total **igualar ou ultrapassar a CA** do alvo, o ataque acerta.

### Modificadores da jogada (pág. 196)

Os dois modificadores mais comuns de um personagem são o **modificador de habilidade** e o **bônus de proficiência**.

| Tipo de ataque | Modificador de habilidade | Proficiência |
| --- | --- | --- |
| Arma corpo-a-corpo | Força | Se for proficiente com a arma |
| Arma à distância | Destreza | Se for proficiente com a arma |
| Arma com **Acuidade** ou **Arremesso** | "quebram essa regra" (ver propriedades no Cap. 5) | Se for proficiente com a arma |
| Ataque de magia | Habilidade de conjuração de quem conjura (Cap. 10) | **Sempre** ("bem como quando ataca com uma magia") |

### Rolando 1 ou 20 (pág. 196)

- **20 no d20:** o ataque **acerta**, independentemente de qualquer modificador ou da CA do alvo, e é considerado um **acerto crítico** (seção 4).
- **1 no d20:** o ataque **erra**, independentemente de qualquer modificador ou da CA do alvo.
- O texto não prevê nenhum efeito extra para o 1 além do erro (não há "falha crítica" no livro).

### Outros pontos do capítulo que mexem na jogada (págs. 196-197)

Só o que vira sinal para o motor; o detalhe da regra não é deste doc.

- **Atacar um alvo que você não pode ver:** desvantagem na jogada de ataque (pág. 196). **Criatura que não pode ver você:** você tem vantagem contra ela (pág. 197).
- **Distância longa:** desvantagem além da distância normal; não pode atacar além da longa (pág. 197).
- **Ataque à distância engajado:** desvantagem se estiver a 1,5 metro de uma criatura hostil que possa vê-lo e não esteja incapacitada (pág. 197).
- **Ataque desarmado:** soco, chute, cabeçada etc. (não contam como armas). Se atingir, causa dano de **concussão igual a 1 + modificador de Força**. Você é proficiente com seus ataques desarmados (pág. 197).
- **Combater com duas armas:** o ataque extra da ação bônus **não adiciona o modificador de habilidade ao dano**, a menos que ele seja negativo (pág. 197).
- **Cobertura** (pág. 198): é bônus na **CA e nos testes de resistência de Destreza do alvo** (meia-cobertura +2; três-quartos +5; total = não pode ser alvo direto; linhas 17697-17698 e 17703-17704). Se o alvo está atrás de várias fontes de cobertura, **os graus não se somam: vale só o de maior grau** (linhas 17691-17693). Para a ficha individual, só importa se o próprio personagem estiver coberto, e aí os dois bônus (CA e TR de Destreza) são dele.

### Margem de crítico ampliada (fora do Cap. 9)

O "20" acima é a regra geral. Características podem ampliá-la. Exemplo: o Campeão (guerreiro) tem **Crítico Aprimorado**, "margem de acerto crítico de 19 a 20" nos ataques com armas, a partir do 3º nível (pág. 85, linhas 7312-7314), e **Crítico Superior**, de 18 a 20, a partir do 15º nível (pág. 86, linhas 7329-7331).

O texto dessas características fala só em **margem de acerto crítico**. Ele **não diz** que o 19 (ou o 18) acerta independentemente da CA: o acerto automático da pág. 196 está escrito só para o **20** (linhas 17528-17532). Ver "Pontos em aberto".

## 2. Pontos de vida (pág. 198)

- Os PV representam a durabilidade física e mental, a vontade de viver e a sorte.
- Os **pontos de vida atuais** (geralmente chamados só de "pontos de vida") podem ser **qualquer número entre o máximo e 0**. Não existem PV negativos.
- Todo dano sofrido é subtraído dos pontos de vida. **A perda de PV não afeta as capacidades da criatura até ela cair a 0.**

## 3. Jogadas de dano (pág. 198)

- Cada arma, magia e habilidade nociva especifica seu dano. Você **joga o dado de dano, adiciona os modificadores e aplica ao alvo**. Armas mágicas, habilidades especiais e outros fatores podem dar bônus ao dano.
- **Ataque com arma:** você adiciona ao dano o **mesmo modificador de habilidade usado na jogada de ataque**.
- **Magia:** a própria magia diz quais dados de dano são jogados e se é possível adicionar modificadores.
- **Vários alvos ao mesmo tempo:** se uma magia ou outro efeito causa dano em mais de um alvo ao mesmo tempo, **jogue o dano uma única vez para todos** (ex.: *bola de fogo*, *coluna de chamas*).
- **Dano total abaixo de 1:** a seção não traz piso para o dano. Há casos no próprio capítulo em que o modificador negativo pode levar o total a 0 ou menos: o ataque desarmado (1 + mod. de Força, linhas 17601-17602) e o ataque extra de duas armas, que aplica o modificador quando é negativo (linhas 17637-17639). Não achei piso em outro ponto do extrato. Ver "Pontos em aberto".

## 4. Acertos críticos (pág. 198)

Texto do livro (transcrição):

> "Quando você obtém um acerto crítico, você rola dados de dano extras do ataque contra o alvo. Jogue todos os dados de dano duas vezes e some todos eles. Depois disso, adicione os modificadores relevantes normalmente. Para acelerar o jogo, você pode jogar todos os dados de dano de uma só vez.
>
> Por exemplo, se você jogar um acerto crítico com uma adaga, você joga 2d4 para o dano em vez de 1d4, e adiciona o modificador de habilidade relevante. Se o ataque envolve outros dados de dano, como a característica Ataque Furtivo, do ladino, ele joga esses dados duas vezes também."

Resumindo:

- **Dobram:** todos os **dados** de dano do ataque, inclusive outros dados que o ataque envolva (o exemplo do livro é o **Ataque Furtivo**).
- **Não dobram:** os **modificadores** (valores fixos), que entram uma vez, "normalmente".

## 5. Tipos de dano (pág. 198)

Os tipos de dano não têm regras próprias, mas outras regras (como resistência) dependem deles. A lista do livro, com os exemplos dele:

| Tipo (livro) | Exemplos do livro | `id` sugerido |
| --- | --- | --- |
| Ácido | baforada de dragão negro; enzimas do pudim negro | `acid` |
| Concussão | ataque brusco de força: martelos, queda, constrição | `bludgeoning` |
| Cortante | espadas, machados, garras de monstros | `slashing` |
| Elétrico | magia *relâmpago*; baforada de dragão azul | `lightning` |
| Energia | energia mágica pura; *mísseis mágicos*, *arma espiritual* | `force` |
| Fogo | dragões vermelhos; muitas magias de chamas | `fire` |
| Frio | lança do diabo do gelo; baforada de dragão branco | `cold` |
| Necrótico | mortos-vivos; *toque arrepiante*; seca a matéria e a alma | `necrotic` |
| Perfurante | perfuração e empalação: lanças, mordidas | `piercing` |
| Psíquico | habilidades mentais; rajada psiônica do devorador de mentes | `psychic` |
| Radiante | *coluna de chamas*; arma de um anjo; cauteriza a carne | `radiant` |
| Trovejante | estouro e concussão do som; *onda trovejante* | `thunder` |
| Veneno | ferrões venenosos; gases tóxicos; baforada de dragão verde | `poison` |

São **13 tipos**.

## 6. Resistência e vulnerabilidade a dano (pág. 199)

- **Resistência** a um tipo: aquele tipo de dano é **reduzido pela metade** contra a criatura.
- **Vulnerabilidade** a um tipo: aquele tipo de dano é **dobrado** contra a criatura.
- **Ordem:** resistência e vulnerabilidade são aplicadas **depois de todos os modificadores de dano**. Exemplo do livro: 25 de concussão contra uma criatura com resistência a concussão, dentro de uma aura que reduz todo dano em 5. Fica 25 − 5 = 20, depois metade: **10 de dano**.
- **Não acumulam:** várias resistências (ou vulnerabilidades) que afetam o mesmo tipo de dano **contam como uma só**. Exemplo: resistência a fogo + resistência a todo dano não-mágico contra fogo não-mágico = metade, **não** três quartos.
- **Arredondamento:** a seção não fala disso. A regra geral do livro (pág. 7, "Arredonde para Baixo") diz que, sempre que dividir um número no jogo, você **arredonda para baixo**, mesmo que a fração passe da metade.
- **Ataque com vários tipos de dano:** a seção não trata. O exemplo do livro tem **um só tipo** (concussão) e uma aura que "reduz todo o dano em 5" (linhas 17816-17823). Não diz se uma redução de "todo o dano" vale uma vez por ataque ou uma vez por tipo, nem se a metade arredonda por parcela ou sobre a soma do mesmo tipo. Ver "Pontos em aberto".

## 7. Cura (pág. 199)

- O dano não é permanente, a menos que resulte em morte, e mesmo a morte é reversível com magias poderosas. Descanso recupera PV (Cap. 8). Métodos mágicos (*curar ferimentos*, *poção de cura*) removem dano instantaneamente.
- Os PV recuperados **somam aos PV atuais**, mas **não podem exceder o máximo**. O excedente é **perdido**. Exemplo do livro: um patrulheiro com 14/20 recebe 8 de cura e recupera **6**.
- **Uma criatura que morreu não pode recuperar pontos de vida** até que uma magia como *reviver* restaure sua vida.

## 8. Caindo a 0 pontos de vida (pág. 199)

Ao cair a 0 PV, você **morre direto** (seção 8.1) **ou fica inconsciente** (seção 8.2).

### 8.1 Morte instantânea (pág. 199)

- Quando um dano reduz seus PV a 0 **e ainda sobra dano**, você morre se **o dano que sobrou for igual ou maior que o seu máximo de pontos de vida**.
- Exemplo do livro: uma clériga com máximo 12 está com 6 PV. Sofre 18 de dano: chega a 0 e sobram 12. Como 12 ≥ 12, **morre**.

### 8.2 Caindo inconsciente (pág. 199)

- Se o dano reduz seus PV a 0 e **não** mata você, você cai **inconsciente** (Apêndice A).
- Essa inconsciência **acaba quando você recupera quaisquer pontos de vida**.

Condição **Inconsciente** (Apêndice A, pág. 292), para referência. Ela tem efeitos que o módulo de jogo mostra:

- A criatura fica incapacitada, não pode se mover nem falar e não tem ciência dos arredores.
- Larga tudo o que segura e fica caída.
- **Falha automaticamente** em testes de resistência de Força ou Destreza.
- Jogadas de ataque contra ela têm **vantagem**.
- Qualquer ataque que a atinja é **acerto crítico** se o atacante estiver a até 1,5 metro dela.

### 8.3 Testes de resistência contra a morte (pág. 199)

- **Quando:** sempre que você **começar seu turno com 0 PV**.
- **Não é vinculado a nenhum valor de habilidade.** Você está "nas mãos do destino", auxiliado **apenas por magias e características que melhoram suas chances de sucesso em um teste de resistência**.
- **Jogada:** "Você joga um d20. Se tirar 10 ou mais, você é bem sucedido. Caso contrário, você fracassa" (linhas 17889-17891). Um sucesso ou fracasso isolado não tem efeito por si só.
- **3 sucessos:** você **estabiliza** (seção 9). **3 fracassos:** você **morre**.
- Os sucessos e fracassos **não precisam ser consecutivos**. Anote ambos até ter três de um mesmo tipo.
- **Zeram** os dois contadores quando você **recupera quaisquer PV** ou quando **se estabiliza**.

| Resultado | Efeito |
| --- | --- |
| **1 natural** no d20 | Conta como **dois fracassos** (linhas 17897-17899) |
| **20 natural** no d20 | Você **recupera 1 ponto de vida** (logo, a inconsciência acaba: seção 8.2) |
| Demais: 10 ou mais | 1 sucesso |
| Demais: abaixo de 10 | 1 fracasso |

Sem bônus, "10 ou mais" é o próprio d20. Com uma magia ou característica que soma ao teste, se o 10 é comparado ao **total** ou ao d20 é o Ponto em aberto 4.

**Sofrendo dano com 0 PV:**

| Situação | Efeito |
| --- | --- |
| Qualquer dano a 0 PV | **1 fracasso** no teste contra a morte |
| O dano é de um **acerto crítico** | **2 fracassos** |
| O dano é **igual ou maior que seu máximo de PV** | **Morte instantânea** |

### 8.4 Descrevendo os efeitos de dano (quadro, pág. 199)

Só narrativa. Entre metade e o máximo de PV não há sinais de ferimento. Abaixo da metade aparecem cortes e contusões. A 0 PV, ferimento que sangra, trauma ou inconsciência. Pode virar texto de sabor na UI; não é regra mecânica.

## 9. Estabilizando uma criatura (págs. 199-200)

- A melhor forma de salvar uma criatura com 0 PV é **curá-la**. Sem cura, ela pode ser **estabilizada** para não morrer pelos fracassos nos testes contra a morte.
- **Primeiros socorros:** você usa **sua ação** para tentar estabilizar uma criatura inconsciente com um teste de **Sabedoria (Medicina) CD 10**.
- **Criatura estável:**
  - **não** faz testes contra a morte, mesmo com 0 PV, mas **permanece inconsciente**;
  - se **sofrer qualquer dano**, deixa de estar estável e precisa voltar a fazer testes contra a morte;
  - se não for curada, **recupera 1 PV depois de 1d4 horas**.

## 10. Monstros e morte (pág. 200)

A maioria dos Mestres declara um monstro morto no instante em que ele cai a 0 PV, sem testes contra a morte. Vilões poderosos e personagens especiais do Mestre são exceções comuns. **Não se aplica ao módulo de jogo individual**, que só cuida do personagem do jogador.

## 11. Nocauteando uma criatura (pág. 200)

- Quando um atacante reduz uma criatura a 0 PV com um **ataque corpo-a-corpo**, ele pode **nocauteá-la** em vez de dar um golpe fatal.
- A escolha é feita **no instante em que o dano é causado**.
- A criatura **cai inconsciente e está estável**.

## 12. Pontos de vida temporários (pág. 200)

O que o texto **diz**:

- São concedidos por magias e habilidades especiais. **Não são PV de verdade**; são uma reserva contra dano.
- **Absorvem primeiro:** ao sofrer dano, os PV temporários são perdidos antes e o restante passa aos PV atuais. Exemplo do livro: 5 temporários e 7 de dano significa perder os 5 e sofrer 2.
- **Podem exceder o máximo:** como ficam separados dos PV de verdade, um personagem com PV cheios pode receber PV temporários.
- **Cura não recupera PV temporários.**
- **Não se somam.** Se você já tem PV temporários e recebe mais, **você decide** se mantém os que tem ou fica com os novos. Exemplo do livro: 10 e depois 12 dá 12 **ou** 10, **nunca 22**.
- **A 0 PV:** receber PV temporários **não recupera a consciência nem estabiliza**. Você ainda pode sofrer dano direcionado aos temporários, mas "apenas uma cura verdadeira pode salvar você".
- **Duração:** a menos que a característica que os concede tenha uma duração, eles duram **até acabarem ou até você terminar um descanso longo**.

O que o texto **não diz** (ver "Pontos em aberto"):

- se um dano totalmente absorvido pelos temporários, a 0 PV, conta fracasso no teste contra a morte;
- se o "dano que sobrou" da morte instantânea é contado antes ou depois dos temporários (a leitura natural é depois, porque o dano "é transferido" aos PV atuais);
- se os temporários somem ao cair a 0 PV. O texto só fala em acabarem, na duração própria ou no descanso longo.

---

## Notas de implementação (mapeamento pro app)

Não faz parte da regra do livro. Orienta a execução das próximas fases do módulo de jogo.

### Estado de jogo (separado da ficha)

A ficha nunca é reescrita em jogo. O estado guarda o **gasto**:

```ts
type LifeState = 'conscious' | 'dying' | 'stable' | 'dead'

interface HitPointState {
  damageTaken: number      // PV perdidos, medidos contra o máximo DA FICHA (ver fórmula abaixo)
  tempHp: number           // reserva separada, pode passar do máximo
  deathSaves: { successes: 0 | 1 | 2 | 3; failures: 0 | 1 | 2 | 3 }
  lifeState: LifeState
}
```

- Dois máximos: `sheetMaxHp` vem **sempre** da ficha (derivado). Um efeito **incondicional** que mexa no máximo (ex.: exaustão nível 4, PV máximo pela metade, linha 28545, decisão já tomada) dá o `effectiveMaxHp`. Uma característica que impeça a redução do máximo (ex.: Acostumado à Morte-Vida, "seu máximo de pontos de vida não pode mais ser reduzido", `class-progression-features.json`) deve ser declarada como efeito e anula a redução.
- **Uma fórmula só (Ponto em aberto 5: (a) assumido (C), (b) decidido):**
  - **Corte gravado ao reduzir o máximo** (decisão 4 do dono, 2026-10-24): ao entrar na exaustão 4 (ou em qualquer redução incondicional do máximo), `damageTaken = max(damageTaken, sheetMaxHp - effectiveMaxHp)`. O PV atual acima do novo máximo **se perde** e **não volta** quando a redução acaba.
  - Daí o invariante **`sheetMaxHp - damageTaken ≤ effectiveMaxHp`**, mantido por toda operação, e a fórmula **`currentHp = max(0, sheetMaxHp - damageTaken)`**, sem teto na leitura.
  - Toda operação (dano, cura) age sobre o **valor visível** `currentHp` e depois regrava `damageTaken = sheetMaxHp - novoCurrentHp`. Assim a cura nunca "some" e o teto é sempre o máximo **efetivo** (assumido (C); é a conta de `docs/regras-descanso.md`, seção 6.1: novo atual = min(máx. efetivo, atual + cura)).
  - **Reduzir o máximo nunca leva a 0 PV sozinho** (com efetivo ≥ 1; ver Ponto em aberto 17). Quem tem PV acima do novo máximo fica no novo máximo, nunca em 0, e `lifeState` só muda pelo pipeline de dano. Ex.: máximo 40, `damageTaken` 25 (PV 15), exaustão 4 → efetivo 20 → PV 15, nada a cortar; cura de 3 → PV 18. Ex. do corte: máximo 40, cheio, exaustão 4 → `damageTaken` 20, PV 20; a exaustão cai para 3 → máximo 40, PV **continua** 20.
  - O descanso longo recupera até o máximo efetivo depois do −1 de exaustão (`docs/regras-descanso.md`, seção 6.1 e Ponto em aberto 12).
- `lifeState` é derivável em parte (`dead` e `stable` não são), por isso fica explícito. `dying` = 0 PV, inconsciente, fazendo testes.

### Máquina de estados de vida

```
                 cura > 0 (seção 7)
     ┌──────────────────────────────────────────────┐
     ▼                                              │
 conscious ── dano leva a 0, sobra < maxHp ──▶ dying ──┤
     │        (nocaute corpo-a-corpo ──▶ stable)    │
     │                                              │
     │── dano leva a 0, sobra ≥ maxHp ──▶ dead      │
     │   (mesmo com nocaute: leitura assumida,      │
     │    Ponto em aberto 13)                       │
                                                    │
 dying:  teste contra a morte no início do turno    │
         ├─ 20 natural ──▶ conscious com 1 PV ──────┘
         ├─ 3º sucesso ──▶ stable
         ├─ 3º fracasso (1 = 2 fracassos) ──▶ dead
         └─ sofre dano: +1 fracasso (crítico: +2), mesmo
            se os PV temporários absorvem tudo; dano ≥ maxHp efetivo ──▶ dead

 stable: não testa; continua inconsciente
         ├─ sofre dano ──▶ dying com +1 fracasso (crítico: +2) (assumido (D))
         ├─ cura > 0 ──▶ conscious
         └─ 1d4 horas sem cura ──▶ conscious com 1 PV

 qualquer: exaustão 6 ──▶ dead (assumido (F))

 dead:   cura não tem efeito; sai só pelo botão "fui revivido"
         (conscious com 1 PV, contadores zerados; decisão 13) ou pelo desfazer
```

- **Zerar contadores** (`deathSaves`) ao entrar em `conscious` (recuperou PV, ou "fui revivido") e ao entrar em `stable`.
- **"Fui revivido"** (decisão 13): grava `lifeState = 'conscious'`, `damageTaken = sheetMaxHp - 1` (1 PV) e `deathSaves` zerados, num evento desfazível. É ação manual do jogador (o MVP não modela *reviver* e afins). O que fazer com a exaustão quando a morte veio da exaustão 6 é o Ponto em aberto 18.
- **PV temporários não mudam `lifeState`** e **não somem ao cair a 0 PV** (decisão 6). Recebê-los a 0 PV não acorda nem estabiliza.
- **Inconsciente derivado do `lifeState`** (modelo de `regras-condicoes.md`, 6.4): enquanto `dying`/`stable`, a condição **Inconsciente** (pág. 292) está ativa **sem ser gravada** em `conditions`, e seus efeitos saem do mesmo agregador `sheetEffects.ts`, com o estado de jogo como fonte (decisão 11). Falha automática em TR de For/Des entra como falha (mostrada como falha, com "rolar mesmo assim" discreto; decisão 12). As vantagens dos ataques contra o personagem e o crítico a 1,5 metro viram **aviso** (são do atacante).
- **Efeitos na transição para 0 PV** (o `onApply` do Inconsciente, que não tem "aplicar" para dispará-lo): ao entrar em `dying` **ou** `stable` (inclusive pelo nocaute, que vai direto a `stable`), no **mesmo evento desfazível** do dano: grava **Caído** como condição própria, avisa que o personagem largou o que segurava e **encerra a concentração** (assumido (F)). Ao recuperar PV, o Inconsciente some sozinho e o **Caído continua** até o personagem se levantar (decisão 14).

### Ordem de aplicação de um dano recebido

Entrada: lista de parcelas `{ amount, damageType, isCritical, isMagical? }` (um ataque pode ter vários tipos), uma lista de **modificadores no nível do evento** (ex.: "reduz todo o dano em 5"), mais um sinal `knockout?` (o atacante escolheu nocautear; só vale para corpo-a-corpo).

O modelo de entrada fica **flexível** porque o livro não decide os ataques com vários tipos (Ponto em aberto 12): a redução fixa fica no evento, não copiada em cada parcela, e a resistência é por tipo. A ordem abaixo é **proposta**.

1. **Modificadores de dano** que não são resistência (ex.: redução fixa de uma aura), **uma vez por evento** (proposta; como repartir entre tipos é o Ponto em aberto 12).
2. **Resistência / vulnerabilidade por tipo**, depois do passo 1 (pág. 199). Várias resistências ao mesmo tipo contam como uma (idem vulnerabilidade). Metade arredonda **para baixo** (pág. 7). Proposta: somar as parcelas do mesmo tipo e arredondar uma vez por tipo (Ponto em aberto 12). **Resistência e vulnerabilidade ao mesmo tipo:** o app aplica **só a resistência** (metade, para baixo); qualquer outro ajuste é manual (decisão 10).
3. **Soma** os tipos = `total`, com **piso 0**: modificador negativo nunca leva o dano abaixo de 0 nem o transforma em cura (decisão 3). Este `total` é o "dano recebido" da concentração: CD = `max(10, floor(total / 2))`, já contando o que os PV temporários vão absorver, **um teste por evento** (assumido (E); `regras-rolagens-e-concentracao.md`, 11.4).
4. **PV temporários absorvem primeiro:** `absorbed = min(tempHp, total)`; `tempHp -= absorbed`; `rest = total - absorbed`.
5. Se `lifeState === 'conscious'`:
   - `current = currentHp` (fórmula acima; pelo invariante, nunca acima do máximo efetivo). Se `rest < current`: `damageTaken = sheetMaxHp - (current - rest)`. Fim.
   - Senão, `overflow = rest - current` e o personagem vai a 0 (`damageTaken = sheetMaxHp`, o que dá `currentHp = 0` com qualquer máximo efetivo):
     - `overflow ≥ effectiveMaxHp` → `dead` (morte instantânea; o máximo **efetivo**, assumido (C));
     - senão, `knockout` → `stable`; caso contrário → `dying` com contadores zerados. Nos dois casos, disparam os efeitos da transição para 0 PV (Caído gravado, aviso de largar o que segura, fim da concentração; seção anterior).
     - A morte instantânea é avaliada **antes** do nocaute, então o dano massivo vence o nocaute. O texto do nocaute (linhas 17937-17941) não trata dessa interação; **decidido** assim (Ponto em aberto 13).
     - `tempHp` restante **não** é zerado ao cair a 0 (decisão 6).
6. Se `lifeState` é `dying` ou `stable` (já a 0 PV):
   - `rest ≥ effectiveMaxHp` → `dead` (mesmo máximo do passo 5);
   - senão, `failures += isCritical ? 2 : 1` (limitado a 3; 3 → `dead`), e `stable` vira `dying` (assumido (D)).
   - **Inclusive com `rest === 0`** (tudo absorvido pelos temporários): conta o fracasso, porque a regra fala em "qualquer dano" (decisão 5). Já um evento com `total === 0` depois do piso e da resistência **não** é dano: não conta fracasso nem pede TR de concentração (decidido, Ponto em aberto 19).
7. Toda transição para `dead` (passos 5 e 6, terceiro fracasso, exaustão 6) encerra a concentração no mesmo evento (assumido (F)).
8. Tudo vira um **evento de log desfazível** (o estado anterior é guardado), coerente com o "desfazer" do crítico.

**Cura:** `dead` → sem efeito (só "fui revivido"). Caso contrário, `novo = min(effectiveMaxHp, currentHp + heal)` e `damageTaken = sheetMaxHp - novo`, com `heal` de **piso 0** (decisão 3). O excedente se perde. Se estava a 0 e `heal > 0` → `conscious`, contadores zerados, e o Caído gravado continua (decisão 14). Cura **não** toca `tempHp`.

**Ganhar PV temporários:** se `tempHp > 0`, a UI pergunta "manter X ou ficar com Y?" (escolha do jogador, regra do livro). O padrão sugerido é o maior, sem decidir sozinha. **No MVP o estado guarda só o número**, e o **descanso longo zera `tempHp`**, como em `docs/regras-descanso.md` (seção 6.1), **exceto** quando o personagem começou o descanso com 0 PV: aí o descanso não dá nenhum benefício e os temporários ficam (assumido (A)). Fontes com duração própria ficam para depois: aí guardar `{ amount, sourceId, expiresAt? }`. Se uma fonte com duração própria sobrevive ao descanso longo é o Ponto em aberto 15.

### Resistências e vulnerabilidades do personagem

O passo 2 recebe as resistências do **próprio personagem**. Elas vêm de **efeitos declarados nos dados**, agregados por `sheetEffects`, não de `if` na UI. Hoje `types/effects.ts` não tem resistência a dano (só testes de resistência). Proposta: um efeito novo, algo como `damageResistance: { types, condition? }` (e o par `damageVulnerability`).

Segue a regra de ouro dos efeitos:

- **Incondicional** → o pipeline aplica sozinho. Ex.: Acostumado à Morte-Vida, "resistência a dano necrótico" (`class-progression-features.json`, linha 1452); a condição **Petrificado** ("resistência a todos os tipos de dano", pág. 293), que chega pelo mesmo agregador com o estado de jogo como fonte (decisão 11; `regras-condicoes.md`, 6.3).
- **Condicional** → vira **toggle/linha própria** perguntada antes de aplicar o dano, desligada por padrão. Ex.: Fúria do bárbaro, resistência a concussão, cortante e perfurante só enquanto em fúria e sem armadura pesada (linha 7: "em fúria?"); resistência "proveniente de ataques com armas não-mágicas" (linha 662: "o ataque era de arma não-mágica?", que casa com o `isMagical?` da parcela).

### Cobertura do personagem

A cobertura (seção 1) é um **toggle condicional** ("estou atrás de meia-cobertura / três-quartos"), não um número fixo da ficha. Ligado, mostra a CA e o TR de Destreza com o bônus como linha própria. Um seletor único de grau já respeita a regra de que os graus não se somam.

### O que o motor de rolagem (`src/core/dice`) precisa para o crítico

O motor é puro e agnóstico de sistema; o D&D monta a expressão.

- **Expressão de dano em grupos**, não um número só: `[{ count, sides, source }]` + `flat[]`. Ex.: adaga do ladino = `1d4 (arma) + 3d6 (Ataque Furtivo) + mod Des (flat)`.
- **Crítico = dobra o `count` de cada grupo de dados** (todos os dados do ataque, inclusive Ataque Furtivo). Os `flat` ficam iguais. Pode rolar tudo de uma vez (o livro autoriza).
- **Os dados extras do crítico ficam guardados à parte** (`critExtraRolls`), para o **desfazer** removê-los sem rerrolar a jogada normal.
- **Detecção de crítico:** a partir do **d20 natural** (o dado que valeu, após vantagem/desvantagem), nunca do total. O motor separa duas coisas:
  - **acerto automático:** só `natural === 20` (linhas 17528-17532);
  - **crítico:** `natural >= critThreshold` **e o ataque acertou** (o total iguala ou passa a CA, ou é o 20 natural). Decidido (decisão 7, Ponto em aberto 16): o 19/18 da margem ampliada **não** acerta automaticamente; só é crítico se o total acertar. O motor deixa essa regra num lugar só.
  - `critThreshold` vem da ficha: padrão 20; Campeão 19 (nível 3+) e 18 (nível 15+), declarado como efeito nos dados (`sheetEffects`), não como `if` na UI.
  - `natural === 1` → erro automático, sem efeito extra.
  - Quando a CA do alvo é desconhecida (o caso comum, o jogador não sabe a CA do monstro), um 19/18 natural do Campeão vira pergunta "acertou?" antes de dobrar os dados.
- O motor também precisa aceitar **crítico forçado** (sem d20; ex.: o dano recebido veio de um crítico contra o personagem inconsciente). A entrada manual de dano recebido tem um "foi crítico?" que alimenta o passo 6.
- **Dano em área:** uma rolagem só (pág. 198). O motor não rerrola por alvo.
- **Entrada manual (dado físico):** o jogador informa o valor de cada dado (ou o d20 natural). As regras de natural 1/20, crítico e teste contra a morte rodam igual sobre o valor informado.
- **Teste contra a morte:** `1d20` + só os bônus marcados como "a todos os testes de resistência" (o livro diz "magias e características que melhoram suas chances"). **Nada** de modificador de habilidade ou proficiência.
  - **Modo:** o teste também recebe as fontes de **vantagem/desvantagem** que valem para todos os testes de resistência, montadas como `advantageSources[]`/`disadvantageSources[]` (`regras-rolagens-e-concentracao.md`, 11.2). Ex.: a **Exaustão 3** ("desvantagem nos testes de resistência", pág. 292) dá desvantagem no teste contra a morte. É a proposta de `regras-condicoes.md`, Ponto em aberto 16, seguida até decisão em contrário.
  - **Desfecho:** o **10 é comparado ao total** (d20 + bônus); o **1 e o 20 são do d20 natural** (o dado mantido, depois de vantagem/desvantagem) (decisão 8).
  - Não há falha automática: a do Inconsciente vale só para TR de Força e Destreza, e o teste contra a morte não é vinculado a habilidade.
- **Estável → 1 PV em 1d4 horas:** o motor rola 1d4 e a UI mostra "recupera 1 PV em N horas". O app não conta tempo real; o jogador confirma.
- **Tipos de dano:** `DamageType` em `src/systems/dnd5e/types/equipment.ts` hoje só tem `bludgeoning | piercing | slashing` (armas). Para resistências e magias, ampliar para os 13 `id` da seção 5 (e `DAMAGE_TYPE_PT` em `utils/weaponFormat.ts`).

## Pontos em aberto (decidir com o dono)

1. **Resistência + vulnerabilidade ao mesmo tipo ao mesmo tempo** (pág. 199 não trata). **Decidido (2026-10-24):** o app aplica só a resistência (metade, arredondada para baixo); o resto é manual.
2. **Dano totalmente absorvido por PV temporários a 0 PV conta fracasso?** (linhas 17901-17906 × 17966-17970). **Decidido (2026-10-24):** conta, porque a regra fala em "qualquer dano".
3. **Dano em criatura estável** (linhas 17921-17923): aquele dano já conta 1 fracasso (2 se crítico)? **Assumido (2026-10-24), a confirmar (D):** conta 1 fracasso (2 se crítico) e a criatura volta a `dying`.
4. **"Tirar 10 ou mais" com bônus.** **Decidido (2026-10-24):** o 10 é comparado ao **total**; o 1 e o 20 são do d20 natural. Quais efeitos contam como "melhoram suas chances": sem decisão; segue a proposta das Notas (bônus e fontes de vantagem/desvantagem que valem para todos os testes de resistência, ex.: Exaustão 3) até decisão em contrário.
5. **PV máximo reduzido** (ex.: exaustão 4).
   - (a) **Qual máximo vale** para a morte instantânea e para o teto da cura? **Assumido (2026-10-24), a confirmar (C):** o máximo **efetivo** (já reduzido).
   - (b) **O que acontece com os PV atuais acima do novo máximo?** **Decidido (2026-10-24):** se perdem; o corte é gravado em `damageTaken` e não volta quando a exaustão sai. `docs/regras-descanso.md`, seção 6.1, já foi alinhado (invariante `sheetMaxHp − damageTaken ≤ effectiveMaxHp`).
6. **Quais dados extras dobram no crítico** (linhas 17762-17764). Sem decisão. Segue a proposta (o motor dobra todo grupo de dados da expressão do ataque e o jogador pode desmarcar um grupo, junto com o desfazer) até decisão em contrário.
7. **PV temporários ao cair a 0 PV.** **Decidido (2026-10-24):** não somem.
8. **Morte instantânea com PV temporários:** o "dano que sobrou" é contado depois de os temporários absorverem? Sem decisão. Segue a leitura assumida na ordem de aplicação (depois) até decisão em contrário.
9. **Tradução, cobertura (linhas 17703-17706):** "três-quartos" e "cobertura superior" são o mesmo grau. Sem decisão. Segue a proposta ("três-quartos" na UI) até decisão em contrário.
10. **Tradução, crítico (linha 17763-17764):** "ele joga esses dados duas vezes também". Não muda a regra. Só registro.
11. **Morte e "reviver":** botão de "desfazer morte" além do desfazer? **Decidido (2026-10-24):** botão "fui revivido", que volta a `conscious` com 1 PV e contadores zerados, além do desfazer.
12. **Ataque com vários tipos de dano** (linhas 17816-17823): (a) redução fixa por evento ou por parcela; (b) metade por parcela ou sobre a soma do tipo. Sem decisão. Segue a proposta (redução no nível do evento, resistência e arredondamento por tipo) até decisão em contrário.
13. **Nocaute com dano que sobra ≥ PV máximo** (linhas 17937-17941 × 17854-17857). **Decidido (2026-10-25):** o dano massivo vence o nocaute. A morte instantânea é avaliada antes do nocaute, no pipeline e na tela (a caixa de nocaute com dano massivo leva a `dead`).
14. **Dano total ≤ 0 com modificador negativo.** **Decidido (2026-10-24):** piso 0. O dano nunca vira cura.
15. **PV temporários com duração própria e o descanso longo** (linhas 17970-17973). Sem decisão. Segue a proposta do MVP (só o número; o descanso longo zera, salvo com 0 PV no início, assumido (A)) até decisão em contrário.
16. **Margem de crítico ampliada e acerto automático** (linhas 17528-17532, 7312-7314 e 7329-7331). **Decidido (2026-10-24):** só o 20 natural acerta automaticamente; 19/18 é crítico se o total acertar.
17. **Máximo efetivo 0.** Com PV máximo da ficha 1, a exaustão 4 dá `floor(1 / 2) = 0` (pág. 7), e o corte gravado levaria o personagem a 0 PV sem passar pelo pipeline de dano, contra a restrição "reduzir o máximo nunca leva a 0 PV sozinho". O livro não trata do caso. Caso de borda, sem proposta.
18. **"Fui revivido" depois de morte por exaustão 6.** A decisão 13 diz o que o botão faz com PV e contadores, mas não com o nível de exaustão. Se ele fica em 6, a morte derivada continua. Sem decisão.
19. **Evento de dano com total 0 a 0 PV.** Com o piso 0 (decisão 3), um dano pode dar 0 (ex.: ataque desarmado com Força negativa). Isso é "qualquer dano" e conta fracasso, como o dano absorvido pelos temporários (decisão 5)? **Decidido (2026-10-25):** não. Dano 0 não é dano: nada muda no estado, nem fracasso a 0 PV nem TR de concentração. A diferença para a decisão 5 é que lá o dano existiu e só foi absorvido.
20. **Crítico Aprimorado/Superior e o golpe desarmado** (págs. 85-86 e 196). A margem do Campeão fala em "ataques com armas"; o golpe desarmado não é arma. **Decidido (2026-10-25):** a margem vale só nos ataques com arma; o golpe desarmado fica no 20. **Premissa revista, aplicação em aberto (2026-10-29):** a decisão 27 diz que o golpe desarmado, sem ser arma, é *ataque corpo a corpo com arma*; "não é arma" deixou de bastar para tirá-lo de "seus ataques com armas" (no inglês, "your weapon attacks"). Se a margem passa a valer nele é pergunta para o dono. Até a resposta, o app segue a decisão de 2026-10-25 (só o 20); não estender o raciocínio "não é arma" a outro efeito.
21. **Que dado o Crítico Brutal e os Ataques Selvagens rolam a mais** (págs. 41 e 49). "Um dado de dano da arma": o da arma ou o que ela usa naquele ataque? **Decidido (2026-10-25):** o dado que a arma usa naquele ataque: o versátil quando usada a duas mãos, o de Artes Marciais quando ele substitui o da arma. A nota do dano crítico diz o dado de cada entrada ("role mais 2d12"), fora da fórmula. **Em aberto (2026-10-29):** os dois só valem nas armas corpo a corpo, porque o golpe desarmado "não é arma". Com a decisão 27, ele é ataque corpo a corpo com arma, e o pt-BR dos dois fala em "acerto crítico com uma arma corpo-a-corpo". Fica para o dono decidir se valem no golpe desarmado e com que dado, já que sem Artes Marciais nem Especialista em Briga o dano dele é fixo, sem dado. Até lá, só nas armas.
22. **Sortudo no teste contra a morte** (págs. 28 e 199). O teste contra a morte é um teste de resistência especial; o Sortudo alcança "teste de resistência". **Decidido (2026-10-25):** vale. A nota do Sortudo aparece no teste contra a morte; com os dados do app, um 1 natural oferece "Rolar de novo (Sortudo)" antes de registrar (com vantagem ou desvantagem, só o dado que saiu 1 é rolado de novo, pág. 175). Sem os dados do app, a nota basta.
23. **Nocaute na tela de dano** (pág. 200). O pipeline já tinha o `knockout`; a tela não o oferecia. **Decidido (2026-10-25):** no modo Dano, só com o personagem consciente, uma caixa discreta "Fui nocauteado (o atacante escolheu, corpo a corpo, pág. 200)" que passa `knockout` ao dano.
24. **PV de quem morre por Exaustão 6** (pág. 292). A exaustão 6 mata sem dano, e o PV atual ficava como estava (com o corte da 4). **Decidido (2026-10-25):** quem morre por Exaustão 6 fica com 0 PV; o desfazer devolve o estado de antes. Todo morto lê 0 PV na reconciliação.
25. **Golpe desarmado com dano 0 ou menos** (pág. 196; item 14). Com Força baixa, 1 + mod. de Força dá 0 (ou −1 com Força 6-7). **Decidido (2026-10-25):** o guia de rolagens mostra 0 (piso 0 do item 14), com a parcela "Mínimo 0" na conta quando houve corte, e a nota "não causa dano".
26. **Ajuste temporário do PV máximo (Ajuda) com a Exaustão 4** (págs. 215 e 292). O corte da metade vale antes ou depois do ajuste? **Decidido (2026-10-25):** o corte é sobre o máximo já somado ao ajuste (`floor((máx. da ficha + ajuste) / 2)`), em qualquer ordem.
27. **Golpe desarmado e "ataque com arma"** (págs. 48 e 196). O pt-BR opõe o golpe desarmado ao "ataque corpo-a-corpo armado"; o inglês diz que ele é *melee weapon attack*, sem ser arma. O Dano de Fúria vale em "ataque com arma corpo-a-corpo usando Força". **Decidido (2026-10-29):** segue o inglês. O golpe desarmado é ataque corpo a corpo com arma, e o Dano de Fúria vale nele (o escopo `melee-strength`); os efeitos que falam da arma (Duelismo, Armas Grandes, Arquearia, duas armas) não. Com o dano fixo em 0 (item 25), a nota do bônus diz a conta inteira ("com ele, o dano é 1 (1 − 2 + 2)"), porque o piso 0 é sobre o total (item 14). Ver o caso na lista pt-BR × inglês do CLAUDE.md. Os itens 20 e 21 dependiam da premissa "não é arma" e ficaram em aberto.
