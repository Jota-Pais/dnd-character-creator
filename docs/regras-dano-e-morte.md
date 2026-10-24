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
- **Uma fórmula só (proposta, ver Ponto em aberto 5):**
  - `currentHp = clamp(sheetMaxHp - damageTaken, 0, effectiveMaxHp)`.
  - Toda operação (dano, cura) age sobre o **valor visível** `currentHp` e depois regrava `damageTaken = sheetMaxHp - novoCurrentHp`. Assim a cura nunca "some" e o teto é sempre o máximo efetivo (é a conta que `docs/regras-descanso.md`, seção 6.1, já pede: novo atual = min(máx. efetivo, atual + cura)).
  - **Reduzir o máximo nunca leva a 0 PV sozinho.** Pela fórmula, quem tem PV acima do novo máximo fica no novo máximo, nunca em 0, e `lifeState` só muda pelo pipeline de dano. Ex.: máximo 40, `damageTaken` 25 (PV 15), exaustão 4 → efetivo 20 → PV 15 (não 0); cura de 3 → PV 18.
  - Efeito colateral a decidir: ao sair da exaustão 4 fora de um descanso longo, os PV "cortados" pelo teto voltam (máx. 40, cheio, exaustão 4 → PV 20; a exaustão cai para 3 → PV 40 de novo). A alternativa é normalizar `damageTaken` no momento da redução (os PV acima do novo máximo se perdem). O texto da exaustão (linha 28545) só diz "Máximo de pontos de vida reduzido à metade" e não diz o que acontece com os PV atuais acima do novo máximo.
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
         └─ sofre dano: +1 fracasso (crítico: +2); dano ≥ maxHp ──▶ dead

 stable: não testa; continua inconsciente
         ├─ sofre dano ──▶ dying (ver Pontos em aberto, item 3)
         ├─ cura > 0 ──▶ conscious
         └─ 1d4 horas sem cura ──▶ conscious com 1 PV

 dead:   cura não tem efeito (só "reviver" e afins; fora do MVP)
```

- **Zerar contadores** (`deathSaves`) ao entrar em `conscious` (recuperou PV) e ao entrar em `stable`.
- **PV temporários não mudam `lifeState`.** Recebê-los a 0 PV não acorda nem estabiliza.
- Enquanto `dying`/`stable`, a UI aplica a condição **Inconsciente** (pág. 292) como efeito incondicional: falha automática em TR de For/Des (no número). As vantagens dos ataques contra o personagem e o crítico a 1,5 metro viram **aviso** (são do atacante).

### Ordem de aplicação de um dano recebido

Entrada: lista de parcelas `{ amount, damageType, isCritical, isMagical? }` (um ataque pode ter vários tipos), uma lista de **modificadores no nível do evento** (ex.: "reduz todo o dano em 5"), mais um sinal `knockout?` (o atacante escolheu nocautear; só vale para corpo-a-corpo).

O modelo de entrada fica **flexível** porque o livro não decide os ataques com vários tipos (Ponto em aberto 12): a redução fixa fica no evento, não copiada em cada parcela, e a resistência é por tipo. A ordem abaixo é **proposta**.

1. **Modificadores de dano** que não são resistência (ex.: redução fixa de uma aura), **uma vez por evento** (proposta; como repartir entre tipos é o Ponto em aberto 12).
2. **Resistência / vulnerabilidade por tipo**, depois do passo 1 (pág. 199). Várias resistências ao mesmo tipo contam como uma (idem vulnerabilidade). Metade arredonda **para baixo** (pág. 7). Proposta: somar as parcelas do mesmo tipo e arredondar uma vez por tipo (Ponto em aberto 12).
3. **Soma** os tipos = `total`. Piso do total com modificador negativo: Ponto em aberto 14.
4. **PV temporários absorvem primeiro:** `absorbed = min(tempHp, total)`; `tempHp -= absorbed`; `rest = total - absorbed`.
5. Se `lifeState === 'conscious'`:
   - `current = currentHp` (fórmula acima, já com o teto do máximo efetivo). Se `rest < current`: `damageTaken = sheetMaxHp - (current - rest)`. Fim.
   - Senão, `overflow = rest - current` e o personagem vai a 0 (`damageTaken = sheetMaxHp`, o que dá `currentHp = 0` com qualquer máximo efetivo):
     - `overflow ≥ maxHp` → `dead` (morte instantânea). Qual máximo (`sheetMaxHp` ou `effectiveMaxHp`) é o Ponto em aberto 5;
     - senão, `knockout` → `stable`; caso contrário → `dying` com contadores zerados.
     - A morte instantânea é avaliada **antes** do nocaute, então o dano massivo vence o nocaute. É **leitura assumida**: o texto do nocaute (linhas 17937-17941) não trata dessa interação (Ponto em aberto 13).
6. Se `lifeState` é `dying` ou `stable` (já a 0 PV):
   - `rest ≥ maxHp` → `dead` (mesmo máximo do passo 5);
   - senão, `failures += isCritical ? 2 : 1` (limitado a 3; 3 → `dead`), e `stable` vira `dying`.
   - Caso `rest === 0` (tudo absorvido pelos temporários): **decisão em aberto** (item 2).
7. Tudo vira um **evento de log desfazível** (o estado anterior é guardado), coerente com o "desfazer" do crítico.

**Cura:** `dead` → sem efeito. Caso contrário, `novo = min(effectiveMaxHp, currentHp + heal)` e `damageTaken = sheetMaxHp - novo`. O excedente se perde. Se estava a 0 e `heal > 0` → `conscious`, contadores zerados. Cura **não** toca `tempHp`.

**Ganhar PV temporários:** se `tempHp > 0`, a UI pergunta "manter X ou ficar com Y?" (escolha do jogador, regra do livro). O padrão sugerido é o maior, sem decidir sozinha. **No MVP o estado guarda só o número**, e o **descanso longo zera `tempHp`** sempre, como em `docs/regras-descanso.md` (seção 6.1). Fontes com duração própria ficam para depois: aí guardar `{ amount, sourceId, expiresAt? }`. Se uma fonte com duração própria sobrevive ao descanso longo é o Ponto em aberto 15.

### Resistências e vulnerabilidades do personagem

O passo 2 recebe as resistências do **próprio personagem**. Elas vêm de **efeitos declarados nos dados**, agregados por `sheetEffects`, não de `if` na UI. Hoje `types/effects.ts` não tem resistência a dano (só testes de resistência). Proposta: um efeito novo, algo como `damageResistance: { types, condition? }` (e o par `damageVulnerability`).

Segue a regra de ouro dos efeitos:

- **Incondicional** → o pipeline aplica sozinho. Ex.: Acostumado à Morte-Vida, "resistência a dano necrótico" (`class-progression-features.json`, linha 1452).
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
  - **crítico:** `natural >= critThreshold` **e o ataque acertou** (o total iguala ou passa a CA, ou é o 20 natural). É o que o texto sustenta; se o 19/18 da margem ampliada também acerta automaticamente é o Ponto em aberto 16. O motor deve deixar essa troca num lugar só.
  - `critThreshold` vem da ficha: padrão 20; Campeão 19 (nível 3+) e 18 (nível 15+), declarado como efeito nos dados (`sheetEffects`), não como `if` na UI.
  - `natural === 1` → erro automático, sem efeito extra.
  - Quando a CA do alvo é desconhecida (o caso comum, o jogador não sabe a CA do monstro), um 19/18 natural do Campeão vira pergunta "acertou?" antes de dobrar os dados.
- O motor também precisa aceitar **crítico forçado** (sem d20; ex.: o dano recebido veio de um crítico contra o personagem inconsciente). A entrada manual de dano recebido tem um "foi crítico?" que alimenta o passo 6.
- **Dano em área:** uma rolagem só (pág. 198). O motor não rerrola por alvo.
- **Entrada manual (dado físico):** o jogador informa o valor de cada dado (ou o d20 natural). As regras de natural 1/20, crítico e teste contra a morte rodam igual sobre o valor informado.
- **Teste contra a morte:** `1d20` + só os bônus marcados como "a todos os testes de resistência" (o livro diz "magias e características que melhoram suas chances"). **Nada** de modificador de habilidade ou proficiência. 1 e 20 avaliados no **natural**.
- **Estável → 1 PV em 1d4 horas:** o motor rola 1d4 e a UI mostra "recupera 1 PV em N horas". O app não conta tempo real; o jogador confirma.
- **Tipos de dano:** `DamageType` em `src/systems/dnd5e/types/equipment.ts` hoje só tem `bludgeoning | piercing | slashing` (armas). Para resistências e magias, ampliar para os 13 `id` da seção 5 (e `DAMAGE_TYPE_PT` em `utils/weaponFormat.ts`).

## Pontos em aberto (decidir com o dono)

1. **Resistência + vulnerabilidade ao mesmo tipo ao mesmo tempo:** o texto (pág. 199) não trata do caso. Só diz que várias do **mesmo** tipo (resistência ou vulnerabilidade) contam como uma. O que o motor faz?
2. **Dano totalmente absorvido por PV temporários a 0 PV conta fracasso?** "Sofrendo Dano com 0 PV" (linhas 17901-17906) diz "qualquer dano". "PV temporários" (linhas 17966-17970) diz que você "ainda pode sofrer dano, direcionando o dano sofrido aos pontos de vida temporários". O texto não resolve.
3. **Dano em criatura estável:** o texto (linhas 17921-17923) diz que ela "não estará mais estável e precisa fazer de novo um teste de resistência contra a morte". Não diz explicitamente se aquele dano já conta 1 fracasso (2 se crítico), como na regra geral de dano a 0 PV. A nota de implementação assume que conta, porque a criatura estável também está a 0 PV. Confirmar.
4. **"Tirar 10 ou mais" com bônus:** com uma magia ou característica que soma ao teste contra a morte, o 10 é sobre o **total** (leitura assumida). O 1 e o 20 são do d20 natural ("obtém um 1 no d20"). Confirmar, e definir quais efeitos do app contam como "melhoram suas chances de ser bem sucedido em um teste de resistência".
5. **PV máximo reduzido** (ex.: exaustão 4, já decidido que entra no número): duas decisões juntas.
   - (a) **Qual máximo vale** para a morte instantânea (passos 5 e 6) e para o teto da cura: o da ficha ou o **efetivo** (reduzido)? O texto do Cap. 9 só diz "seu máximo de pontos de vida".
   - (b) **O que acontece com os PV atuais acima do novo máximo.** O texto da exaustão (linha 28545) só diz "Máximo de pontos de vida reduzido à metade". Proposta das Notas: `currentHp = clamp(sheetMaxHp - damageTaken, 0, effectiveMaxHp)`, com dano e cura agindo sobre o valor visível. Efeito: os PV cortados voltam se a redução acabar fora de um descanso longo. A alternativa é normalizar `damageTaken` na redução (os PV cortados se perdem). Restrição em qualquer opção: a redução do máximo **nunca** pode deixar alguém a 0 PV sem transição de estado. Obs.: o exemplo de `docs/regras-descanso.md`, seção 6.1 (máx. 20, efetivo 10, `damageTaken` 15, "PV atual 0"), supõe a leitura antiga (efetivo − `damageTaken`). Pela fórmula proposta, o PV atual ali seria 5. Alinhar aquele doc depois da decisão.
6. **Quais dados extras dobram no crítico:** o livro diz "todos os dados de dano" e "outros dados de dano" que o ataque envolva, com o Ataque Furtivo como único exemplo (linhas 17762-17764). Para dados que vêm de outras características ou magias junto com o ataque, o texto não lista. Proposta: o motor dobra todo grupo de dados da expressão do ataque, e o jogador pode desmarcar um grupo (junto com o "desfazer" já decidido).
7. **PV temporários ao cair a 0 PV:** o texto não diz que somem, só que duram até acabar, até o fim da duração própria ou até o descanso longo. Manter como estão?
8. **Morte instantânea com PV temporários:** confirmar que o "dano que sobrou" é contado **depois** de os temporários absorverem (leitura assumida na ordem de aplicação).
9. **Tradução, cobertura (linhas 17703-17706):** o parágrafo começa com "três-quartos de cobertura" (+5) e na frase seguinte chama o mesmo grau de "cobertura superior", nome que também aparece no exemplo da linha 17696. É a mesma coisa, com nomes diferentes. Escolher um termo para a UI ("três-quartos" parece mais claro).
10. **Tradução, crítico (linha 17763-17764):** "ele joga esses dados duas vezes também". O "ele" parece se referir ao jogador, e não muda a regra. Só registro.
11. **Morte e "reviver":** o MVP não modela ressurreição. Um personagem `dead` só sai desse estado por ação manual do jogador ("o Mestre me reviveu")? Precisa de botão de "desfazer morte" além do desfazer do último evento?
12. **Ataque com vários tipos de dano** (linhas 17816-17823; o exemplo do livro tem um tipo só):
    - (a) uma redução fixa de "todo o dano" vale **uma vez por ataque/evento** ou **uma vez por parcela/tipo**? Por parcela, a aura de −5 desconta 10 num ataque cortante + fogo. E, se for uma vez por evento, como repartir entre os tipos quando só um deles sofre resistência?
    - (b) a metade da resistência arredonda **por parcela** ou **sobre a soma** das parcelas do mesmo tipo?
    - Proposta das Notas: redução no nível do evento, resistência e arredondamento por tipo.
13. **Nocaute com dano que sobra ≥ PV máximo:** morte instantânea ou nocaute? O texto do nocaute (linhas 17937-17941) só diz que, ao reduzir a 0 PV com ataque corpo-a-corpo, o atacante pode nocautear, e a criatura "cai inconsciente e está estável". O da morte instantânea (linhas 17854-17857) não fala de nocaute. As Notas avaliam a morte primeiro (leitura assumida, só proposta).
14. **Dano total ≤ 0 com modificador negativo:** piso 0, piso 1 ou sem piso? O texto não diz (ataque desarmado, linhas 17601-17602; duas armas, linhas 17637-17639), e o grep do extrato não achou piso de dano. Coerência com `docs/regras-descanso.md`, Ponto em aberto 4 (cura com CON negativa, recomendado piso 0): para dano, "sem piso" faria um dano virar cura. Sugestão de produto: piso 0, mas é decisão do dono.
15. **PV temporários com duração própria e o descanso longo:** o texto (linhas 17970-17973) diz que, **sem** duração própria, duram até acabarem ou até o descanso longo. Não diz se uma fonte **com** duração própria que ainda não venceu sobrevive ao descanso longo. No MVP (só o número) o descanso longo zera sempre, como em `docs/regras-descanso.md`.
16. **Margem de crítico ampliada e acerto automático:** um 19 natural do Campeão (18 no nível 15) contra CA alta **acerta automaticamente** ou só é crítico **se o total acertar**? O acerto automático está escrito só para o 20 (linhas 17528-17532). O Crítico Aprimorado e o Crítico Superior dão só "margem de acerto crítico" (linhas 7312-7314 e 7329-7331). As Notas seguem o texto (acerto automático só no 20; crítico na margem só se acertar), com a troca isolada num lugar só do motor.
