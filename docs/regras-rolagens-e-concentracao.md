# Rolagens, inspiração, iniciativa e concentração — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR. Introdução "Como Jogar", págs. 6-7; Cap. 4 "Personalidade e Antecedente", pág. 127; Cap. 7 "Utilizando Habilidades", págs. 175-181; Cap. 9 "Combate", págs. 191, 196, 198-199; Cap. 10 "Conjurando Magias", págs. 203-206; Apêndice A "Condições", págs. 291-293. Citações pontuais de traços, características de classe e talentos: págs. 28, 54, 85-86, 167, 169, 170, 172.
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt`. Esta é a **fonte da verdade documental** para o motor de rolagem e para a parte de rolagens da ficha viva do módulo de jogo (pipeline: livro → este doc → dados/tipos/utils → UI).
>
> As seções 1 a 10 são regra do livro. A seção 11 traz as notas de implementação e **não** é regra. A seção 12 lista o que o dono precisa decidir.

## 1. Dados de jogo e notação (págs. 6-7)

- O jogo usa dados poliédricos. A notação é a letra **d** seguida do número de lados: **d4, d6, d8, d10, d12 e d20**. Um d6 é o dado cúbico comum.
- **Dado percentual (d100):** gera um número de 1 a 100 com **dois d10 numerados de 0 a 9**. Um dado, escolhido **antes** de jogar, dá as dezenas e o outro as unidades. 7 e 1 dão 71. **Dois 0 dão 100.** Com o d10 numerado em dezenas (00, 10, 20…), 70 e 1 dão 71, e 00 e 0 dão 100.
- **Expressão:** a regra diz quantos dados de cada tipo jogar e o modificador a somar. **"3d8 + 5"** = jogue três d8, some os resultados e some 5 ao total.
- **1d3 e 1d2** usam a mesma notação, mas não existem como dado físico comum:
  - **1d3:** jogue 1d6 e divida o resultado por 2, **arredondando para cima**.
  - **1d2:** jogue qualquer dado e "atribua 1 ou 2 ao resultado par ou ímpar" (ordem do extrato, linha 433; ver Pontos em aberto, item 12). Outra forma: se o número tirado for **mais da metade** dos lados do dado, o resultado é 2.

## 2. A regra do d20 (pág. 7)

Testes de habilidade, jogadas de ataque e testes de resistência são as **três jogadas principais com o d20**. As três seguem os mesmos passos:

1. **Jogue o dado e some os modificadores.** Em geral é o modificador de uma das seis habilidades. Às vezes soma-se também o **bônus de proficiência**, por uma perícia do personagem.
2. **Aplique bônus ou penalidades circunstanciais.** Podem vir de uma característica de classe, de uma magia, de uma situação particular ou de outro efeito.
3. **Compare o total com o número alvo.** Se o total **igualar ou superar** o alvo, a jogada é um **sucesso**. Caso contrário, é um **fracasso**. Quem define o alvo e anuncia o resultado é em geral o Mestre.

| Jogada | Número alvo |
| --- | --- |
| Teste de habilidade | Classe de Dificuldade (**CD**) |
| Teste de resistência | Classe de Dificuldade (**CD**) |
| Jogada de ataque | Classe de Armadura (**CA**) do alvo |

## 3. Duas regras gerais (pág. 7)

- **O específico vence o geral.** Traços raciais, características de classe, magias, itens mágicos e habilidades de monstros muitas vezes abrem exceções às regras gerais. Se uma regra específica contradiz uma regra geral, **vale a específica**. As exceções costumam ser pequenas. Exemplos do livro: muitos aventureiros não têm proficiência com arcos longos, mas todos os elfos da floresta têm, por um traço racial; um aventureiro normalmente não atravessa paredes, mas algumas magias tornam isso possível. As magias são a maioria das exceções.
- **Arredonde para baixo.** Ao dividir um número no jogo, arredonde para baixo se o resultado tiver fração, **mesmo que a fração seja maior que a metade**.

## 4. Vantagem e desvantagem (págs. 7 e 175)

Uma habilidade especial, uma magia ou uma circunstância pode conceder **vantagem** ou impor **desvantagem** em um teste de habilidade, teste de resistência ou jogada de ataque.

- **Mecânica:** jogue **um segundo d20**. Com **vantagem**, use o **maior** resultado. Com **desvantagem**, use o **menor**. Exemplo do livro: 17 e 5 dão **5** com desvantagem e **17** com vantagem.
- **Não acumula:** se várias situações dão vantagem, você ainda joga **apenas um d20 adicional**. O mesmo vale para desvantagem.
- **Uma anula a outra:** se a jogada tem **vantagem e desvantagem ao mesmo tempo**, você não tem nenhuma das duas e joga **apenas um d20**. Isso vale **qualquer que seja a quantidade** de cada lado: várias desvantagens e uma só vantagem também resultam em jogada normal, e vice-versa.
- **Rerrolagem com dois dados:** quando você tem vantagem ou desvantagem e algo permite jogar de novo um d20 (o livro cita o traço **Sortudo** dos halflings), **só um dos dois dados pode ser jogado de novo, e você escolhe qual**. Exemplo do livro: com vantagem num teste de habilidade e resultados 1 e 13, o halfling pode usar Sortudo para jogar de novo o 1.
- **De onde vêm:** em geral de habilidades especiais, ações ou magias. A **Inspiração** (seção 8) também pode conceder vantagem. O Mestre também pode decidir que uma circunstância concede vantagem ou impõe desvantagem.

| Fontes de vantagem | Fontes de desvantagem | Resultado | d20 jogados |
| --- | --- | --- | --- |
| 0 | 0 | normal | 1 |
| 1 ou mais | 0 | vantagem (maior) | 2 |
| 0 | 1 ou mais | desvantagem (menor) | 2 |
| 1 ou mais | 1 ou mais | normal | 1 |

### 4.1 Rerrolagens citadas (págs. 28 e 172)

Não são regra geral. Ficam aqui porque mexem diretamente no d20.

- **Sortudo (traço racial, halfling, pág. 28):** ao obter um **1 natural** em uma jogada de ataque, teste de habilidade ou teste de resistência, você pode jogar o dado de novo e **deve usar o novo resultado**.
- **Sortudo (talento, pág. 172):** você tem **3 pontos de sorte**. Em uma jogada de ataque, teste de habilidade ou teste de resistência, pode gastar um ponto para **jogar um d20 adicional**. Pode decidir gastar **depois de jogar o dado, mas antes de saber o resultado da jogada**. Você escolhe qual dos d20 usar. Também pode gastar um ponto quando uma jogada de ataque é feita **contra você**: jogue um d20 e escolha se o ataque usa o dado do atacante ou o seu. Se mais de uma criatura gastar ponto de sorte na mesma jogada, os pontos se cancelam e nenhum dado adicional é jogado. Os pontos voltam ao fim de um **descanso longo**.

## 5. Bônus de proficiência nas jogadas (págs. 175-176)

- O bônus vem do nível e se aplica a testes de habilidade, testes de resistência e jogadas de ataque.
- **Nunca é somado mais de uma vez** à mesma jogada, mesmo que duas regras digam para somar. Exemplo do livro: duas regras dando proficiência em TR de Sabedoria → some uma vez só.
- Pode ser **multiplicado ou dividido** antes de ser aplicado. A Especialização do ladino, por exemplo, dobra o bônus. Mesmo que várias regras se apliquem, você **soma uma vez e multiplica ou divide uma vez**.
- Multiplicar sem ter proficiência dá **0**. Sem proficiência em História, uma habilidade que dobra o bônus em testes de Inteligência (História) não acrescenta nada.
- Em geral o bônus **não é multiplicado** em jogadas de ataque e testes de resistência. Se algo permitir, valem as mesmas regras.
- **Bônus dividido, exemplos citados:**
  - **Versatilidade (bardo, 2º nível, pág. 54):** metade do bônus de proficiência, **arredondado para baixo**, em qualquer teste de habilidade que ainda não tenha o bônus de proficiência.
  - **Atletismo Extraordinário (guerreiro Campeão, 7º nível, pág. 85):** metade do bônus de proficiência, **"arredondado para cima"** no próprio texto, em qualquer teste de Força, Destreza ou Constituição em que você ainda não aplique o bônus de proficiência.

*(Já implementado em `proficiencyUtils.ts → getSkillChecks`, ver o CLAUDE.md.)*

## 6. Testes de habilidade (págs. 176-177)

### 6.1 O teste (pág. 176)

O Mestre pede um teste de habilidade quando alguém tenta uma ação que **não é um ataque** e que pode fracassar. Ele escolhe a habilidade relevante e a dificuldade (CD). Para fazer o teste, jogue um d20, some o modificador da habilidade, aplique bônus e penalidades e compare com a CD. **Igualar ou superar a CD = sucesso.** O fracasso significa nenhum progresso, ou um progresso acompanhado de um revés definido pelo Mestre.

| Dificuldade da tarefa | CD |
| --- | --- |
| Muito fácil | 5 |
| Fácil | 10 |
| Moderada | 15 |
| Difícil | 20 |
| Muito difícil | 25 |
| Quase impossível | 30 |

Com **proficiência na perícia** pedida ("Faça um teste de Sabedoria (Percepção)"), some o bônus de proficiência. Sem proficiência, é um teste normal da habilidade. *Variação (pág. 177):* o Mestre pode combinar uma perícia com uma habilidade incomum, como Constituição (Atletismo) ou Força (Intimidação).

### 6.2 Testes resistidos (pág. 176)

Quando os esforços de dois lados se opõem diretamente, os dois fazem o teste de habilidade adequado, com seus bônus e penalidades. Em vez de comparar com uma CD, **comparam os totais entre si**. O **maior total vence**.

- **Empate:** a situação **continua como estava**. Assim, um lado pode "vencer" mesmo empatando. Dois personagens disputando um anel no chão: ninguém o pega. Monstro forçando uma porta contra um aventureiro que a segura: a porta continua fechada.

### 6.3 Testes passivos (pág. 177)

Um teste passivo é um teste de habilidade **sem rolagem de dados**. Representa a média de uma tarefa repetida (procurar portas secretas várias vezes) ou um teste que o Mestre faz em segredo (perceber um monstro escondido).

> **Valor passivo = 10 + todos os modificadores que normalmente se aplicam ao teste**
> **Vantagem: +5. Desvantagem: −5.**

O total é chamado de **valor**. Exemplo do livro: personagem de 1º nível com Sabedoria 15 e proficiência em Percepção → Sabedoria (Percepção) passiva **14**. As regras de esconder-se (seção "Destreza", cap. 7) e as de exploração (cap. 8) usam testes passivos. A surpresa também compara a Destreza (Furtividade) de quem se esconde com a Sabedoria (Percepção) passiva do outro lado (pág. 191).

### 6.4 Trabalho em equipe e testes em grupo (pág. 177)

- **Trabalho em equipe:** quem lidera o esforço, ou quem tem o maior modificador, faz o teste **com vantagem**. Só ajuda quem poderia tentar a tarefa sozinho, e só quando a ajuda é de fato produtiva. Em combate, isso exige a ação Ajudar (cap. 9).
- **Teste em grupo:** todos fazem o teste. Se **pelo menos metade** tiver sucesso, o grupo tem sucesso.

## 7. Testes de resistência (pág. 181)

- O teste de resistência (TR) representa a tentativa de resistir a uma magia, armadilha, veneno, doença ou ameaça parecida. Em geral **você não escolhe fazê-lo: é forçado a fazer**.
- **Jogue um d20 e some o modificador da habilidade** correspondente: Destreza para TR de Destreza, por exemplo.
- Pode receber bônus ou penalidade situacional e ser afetado por vantagem ou desvantagem, conforme o Mestre determinar.
- **Proficiência:** cada classe dá proficiência em pelo menos dois TR (o mago, por exemplo, em Inteligência e Sabedoria). Com proficiência, some o bônus de proficiência aos TR daquela habilidade.
- A **CD** é definida pelo efeito que provocou o teste. Para magias, ela depende da habilidade de conjuração e do bônus de proficiência de quem conjurou. O **efeito** do sucesso ou do fracasso também vem descrito no efeito. Em geral, sucesso significa nenhum dano ou dano reduzido.

## 8. Inspiração (pág. 127)

- **O que é:** uma regra que o **Mestre pode usar** para recompensar você por interpretar o personagem de acordo com seus traços de personalidade, ideais, vínculos e defeitos.
- **Como se ganha:** o Mestre decide quando conceder. Normalmente vem quando você interpreta seus traços de personalidade, cede às desvantagens descritas pelos defeitos e vínculos, ou mostra de outra forma como o personagem realmente é. O Mestre diz como obter inspiração durante o jogo.
- **Não acumula:** você **tem ou não tem** inspiração. Não dá para guardar várias "inspirações" para depois.
- **Como se usa:** você pode gastá-la ao fazer uma **jogada de ataque, teste de resistência ou teste de habilidade**. Gastar a inspiração dá **vantagem naquela jogada**.
- **Passar adiante:** se tem inspiração, você pode recompensar outro jogador por boa interpretação, raciocínio inteligente ou algo empolgante no jogo. Quando outro personagem contribui de verdade para a história, de forma divertida e interessante, você pode **abrir mão da sua inspiração para dá-la a ele**.
- O cap. 7 (pág. 175) retoma o tema: a inspiração "também pode conceder uma vantagem a você em testes relacionados com a personalidade do personagem, ideais ou vínculos" (ver Pontos em aberto).

> Não confundir com a **Inspiração de Bardo** (característica de classe, com dado e usos por descanso), que é outra regra.

## 9. Iniciativa (págs. 179 e 191)

- **É um teste de Destreza** (pág. 179). No início de todo combate, você joga a iniciativa fazendo um teste de Destreza. A iniciativa define a ordem dos turnos.
- **Ordem (pág. 191):** quando o combate começa, cada participante faz um teste de Destreza. O Mestre faz **uma jogada só para um grupo de criaturas idênticas**, que agem ao mesmo tempo. Os combatentes ficam em ordem do **maior total para o menor**. É a **ordem de iniciativa**, e ela **não muda** de uma rodada para outra.
- **Empates (pág. 191):** o Mestre decide a ordem entre as criaturas que controla, e os jogadores decidem a ordem entre os seus personagens. Se o empate for entre um monstro e um personagem de jogador, o Mestre pode decidir. **Opcional:** o Mestre pode pedir que os empatados joguem um d20 cada, e o maior age primeiro.
- **Lugar no combate (pág. 191):** no passo a passo do combate, a iniciativa é o passo 3, depois de determinar a surpresa e as posições. Quem está **surpreso** não pode se mover nem **realizar uma ação** no seu primeiro turno do combate, e também não pode usar uma reação até esse turno terminar. Um membro do grupo pode ser surpreendido mesmo que outro não seja.
- Modificador citado: o talento **Alerta** (pág. 167) dá **+5 de bônus em iniciativa** e impede que você seja surpreso enquanto estiver consciente.
- Características que somam meia proficiência em testes de habilidade (seção 5): **Versatilidade** (pág. 54, qualquer teste de habilidade) e **Atletismo Extraordinário** (pág. 85, testes de Força, Destreza ou Constituição). O livro não as cita ao falar de iniciativa. Se alcançam a iniciativa por ela ser teste de Destreza é inferência (Pontos em aberto, item 7).

## 10. Concentração (págs. 203-206)

### 10.1 A regra (pág. 205)

- Algumas magias exigem concentração para continuar ativas. **Se você perder a concentração, a magia termina.**
- A necessidade de concentração aparece na **"Duração"** da magia, que também diz por quanto tempo ela pode ser mantida.
- Você pode **encerrar a concentração a qualquer momento**, sem gastar ação.
- Atividades normais, como **mover-se e atacar, não atrapalham** a concentração.

### 10.2 O que quebra a concentração (págs. 205-206)

| Fator | Regra |
| --- | --- |
| **Conjurar outra magia de concentração** | Você perde a concentração. **Não é possível se concentrar em duas magias ao mesmo tempo.** |
| **Sofrer dano** | Sempre que sofrer dano enquanto se concentra, faça um **TR de Constituição** para manter a concentração. **CD = 10 ou metade do dano recebido, o que for maior.** Dano de **várias origens** (uma flecha e um sopro de dragão, por exemplo) exige **um teste para cada origem**. |
| **Ficar incapacitado ou morrer** | A concentração se perde. |
| **Fenômeno ambiental** (decisão do Mestre) | O Mestre pode exigir um TR de Constituição **CD 10** para manter a concentração, por exemplo quando uma onda atinge você num navio em plena tempestade. |

- **Metade do dano:** pela regra geral da pág. 7, a metade é arredondada para baixo. Exemplo: 21 de dano → metade 10 → CD 10. 25 de dano → metade 12 → CD 12.
- **Extrato:** na pág. 205, a lista acima aparece intercalada com o quadro "As escolas de magia" (linhas 18305-18354). A lista continua na linha 18355 e não parece haver texto faltando.

### 10.3 Condições que incapacitam (Apêndice A, págs. 291-293)

Pela regra acima ("se ficar incapacitado ou se morrer", linhas 18370-18372), todas encerram a concentração:

| Condição / estado | Página | Texto |
| --- | --- | --- |
| Incapacitado | 292 | não pode realizar ações ou reações |
| Atordoado | 291 | "está incapacitada (veja a condição)" |
| Inconsciente | 292 | "está incapacitada (veja a condição)" |
| Paralisado | 293 | "está incapacitada (veja a condição)" |
| Petrificado | 293 | "está incapacitada (veja a condição)" |
| **Morte** | 199, 292 | por qualquer caminho: Exaustão nível 6 ("Morte", pág. 292); morte instantânea, quando o dano que sobra ao chegar a 0 PV é "igual ou maior do que seu máximo de pontos de vida" ou quando, já a 0 PV, o dano é "equivalente ou exceder seu máximo" (pág. 199); e o terceiro fracasso no teste de resistência contra a morte (pág. 199) |

### 10.4 Tempo de conjuração e rituais (págs. 203-204)

- **Tempos de conjuração maiores (pág. 204):** algumas magias, **incluindo as conjuradas como ritual**, levam minutos ou horas para conjurar. Se o tempo de conjuração passa de uma ação ou uma reação, você **gasta sua ação em cada turno** de conjuração e **precisa manter a concentração** enquanto conjura. Se a concentração for quebrada, **a magia falha, mas o espaço de magia não é gasto**. Para tentar de novo, é preciso começar do início.
- **Rituais (págs. 203-204):** uma magia marcada como ritual pode ser conjurada normalmente ou como ritual. O ritual leva **10 minutos a mais** e **não gasta espaço de magia**, por isso não pode ser conjurado em nível superior. Para conjurar como ritual, é preciso ter uma característica que permita, como a do clérigo e a do druida, e ter a magia preparada ou conhecida, a menos que a característica diga o contrário, como no caso do mago. Na seção de rituais, o extrato não fala de concentração além da regra de tempo de conjuração maior acima.

### 10.5 Modificadores citados do teste de concentração

- **Conjurador de Guerra (talento, pág. 169):** **vantagem** nos TR de Constituição para manter a concentração quando você sofre dano.
- **Matador de Conjuradores (talento, pág. 170):** quando *você* causa dano a uma criatura concentrada, ela tem **desvantagem** no TR para manter a concentração. É um talento do atacante. Na ficha do alvo, aparece como desvantagem imposta de fora.
- **Exemplo de magia:** algumas magias tratam o efeito como "distração grave para os propósitos de manter a concentração" (extrato linha 27927, pág. 286). Isso cai na regra de fenômeno do Mestre.

## 11. Notas de implementação (mapeamento pro app)

Não faz parte da regra do livro. Orienta a execução das próximas fases. Já decidido: o estado de jogo fica separado da ficha (a ficha nunca é reescrita em jogo, só se registra o "gasto"); o motor de rolagem é puro e separado da animação; rolagem digital por padrão, com entrada manual de dado físico; MVP só de D&D.

### 11.1 Onde cada coisa mora

- **`src/core/dice` é agnóstico de sistema.** Sabe notação, d20 com vantagem e desvantagem (inclusive a função pura que resolve o modo a partir das listas de fontes, item 2 abaixo), naturais, lista de modificadores com origem e registro do resultado. **Não sabe** o que é crítico, falha automática, concentração ou inspiração.
- **`src/systems/dnd5e`** monta a jogada a partir da ficha: quais modificadores, quais fontes de vantagem e desvantagem, qual a CD e se há falha automática. Também interpreta o resultado: d20 natural **≥ margem de crítico da ficha** (`critThreshold`: padrão 20; Campeão 19 no nível 3+ e 18 no 15+, págs. 85-86, declarado como efeito em `sheetEffects`) num ataque **que acertou** vira crítico (só o 20 natural acerta automaticamente; decisão 7 do dono, 2026-10-24), a CD de concentração vem do dano, gastar a inspiração gera vantagem.
- **Um contrato só.** O crítico (detecção por `critThreshold`, `critExtraRolls` para o desfazer, crítico forçado) é definido em `regras-dano-e-morte.md` ("O que o motor de rolagem precisa para o crítico"). A falha automática e a tradução de condições em fontes de vantagem e desvantagem são definidas em `regras-condicoes.md` (6.1 e 6.5). Este documento não redefine nenhum dos dois.

### 11.2 Contrato mínimo do motor (`src/core/dice`)

1. **Notação:** fazer o parse de `NdX`, `NdX + K`, `NdX − K` e somas de termos (`2d6 + 1d4 + 3`), com X em {2, 3, 4, 6, 8, 10, 12, 20, 100}. O **d100** sai direto de 1 a 100, sem simular dezenas e unidades (a probabilidade é a mesma). Os **d2 e d3** digitais saem uniformes. A simulação com d6 (seção 1) só existe para dado físico.
2. **d20 com modo:** `mode: 'normal' | 'advantage' | 'disadvantage'`. Quem resolve o modo é uma função pura **de `src/core/dice`** sobre **duas listas de fontes**, `advantageSources[]` e `disadvantageSources[]`, seguindo a tabela da seção 4. A regra (uma de cada lado anula, várias do mesmo lado valem uma) não depende do que cada fonte é, por isso mora no core. O que entra nas listas é decidido no dnd5e (`regras-condicoes.md`, 6.1). As fontes ficam guardadas para a UI explicar "por que essa jogada é normal" quando uma anula a outra.
3. **Mostrar os dois dados:** com vantagem ou desvantagem, o resultado guarda **os dois d20** e marca qual foi mantido (`kept`) e qual foi descartado (`dropped`). A UI mostra o descartado esmaecido, nunca o esconde.
4. **Naturais:** cada d20 guarda o valor natural. O resultado expõe `natural` (o dado mantido) e as flags `isNat1` e `isNat20`, que são só leitura do dado. **Quem dá sentido a elas é o sistema.** O crítico **não** sai de `isNat20`: o dnd5e compara `natural >= critThreshold` **e** confere o acerto (`regras-dano-e-morte.md`; decisão 7). No PHB 2014, só a jogada de ataque (pág. 196, com a margem ampliada do Campeão, págs. 85-86) e o TR contra a morte (pág. 199) têm regra para 1 e 20. Em teste de habilidade e TR comum, o 20 natural **não é sucesso automático** (ver Pontos em aberto).
5. **Modificadores com origem:** `modifiers: { value: number; source: string; label: string }[]`, por exemplo `{ value: 3, source: 'ability:dex', label: 'Destreza' }` e `{ value: 2, source: 'proficiency', label: 'Proficiência' }`. O total = dados mantidos + soma dos modificadores. É isso que responde "de onde vem este número". A origem vem dos mesmos agregadores da ficha (`getSkillChecks`, `sheetEffects`), e **a conta não é refeita no motor**.
6. **Rerrolagem:** operação sobre um resultado já existente que troca **um** dado escolhido (seção 4) e guarda o valor anterior (`rerolledFrom`), com a fonte (ex.: `trait:halfling-lucky`). Cobre o Sortudo halfling. O "d20 adicional" do talento Sortudo fica pendente (Pontos em aberto).
7. **Registro serializável:** cada rolagem vira um objeto JSON puro: `id`, `timestamp`, `kind` (`ability-check`, `saving-throw`, `attack`, `damage`, `initiative`, `concentration`, `death-save`, `free`), `expression`, `dice[]` (lados, valor, `kept`/`dropped`, `origin: 'digital' | 'manual'`), `mode` com as fontes, `modifiers[]`, `total` e, opcionalmente, `dc` ou `targetAc` e `outcome`. Sem funções nem classes, para entrar no estado de jogo, no histórico e no export JSON.
   - **Resultado forçado:** `forcedOutcome?: { result: 'failure' | 'success'; source: string; label: string }`, por exemplo `{ result: 'failure', source: 'condition:paralyzed', label: 'Falha automática (Paralisado)' }`. O core não sabe o que é falha automática: só guarda que o sistema forçou o `outcome` e por quê. Quando presente, `outcome` segue `forcedOutcome.result` qualquer que seja o dado. É o caminho da falha automática em TR de Força e Destreza (Atordoado, Inconsciente, Paralisado, Petrificado, págs. 291-293), decidida pelo dnd5e **antes** do motor (`regras-condicoes.md`, 6.1 e 6.5). A jogada pode nem ter `dice[]`, ou ter dados se o jogador escolher "rolar mesmo assim", que fica discreto e não bloqueia (decisão 12; `regras-condicoes.md`, item 9). O `'success'` fica reservado para um sucesso automático futuro, que nenhuma regra lida aqui pede. A falha de Cego e Surdo ("teste que requeira o uso da visão/audição") é condicional e vira aviso, não `forcedOutcome` padrão.
8. **Entrada manual de dado físico:** para cada dado, aceitar o valor tirado na mesa em vez de gerar um. O valor é validado no intervalo 1..X (para o d100, 1..100 já somado). Com vantagem, a UI pede **dois** d20. O registro marca `origin: 'manual'`. O mesmo caminho atende a "rolei aqui na mesa, só calcula".
9. **Aleatoriedade injetável:** o gerador entra como parâmetro (`rng: () => number`) para os testes serem determinísticos. Em produção, usar `crypto.getRandomValues`.

### 11.3 Crítico (decisão já tomada)

- Num **d20 natural ≥ margem de crítico da ficha** em jogada de ataque **que acertou** (`critThreshold`: padrão 20, pág. 196; Campeão 19 a partir do 3º nível e 18 a partir do 15º, págs. 85-86; declarado como efeito em `sheetEffects`, não como `if` na UI; só o 20 natural acerta automaticamente, o 19/18 precisa que o total acerte, decisão 7), o sistema monta o dano com **todos os dados dobrados** (pág. 198), inclusive dados extras como o Ataque Furtivo. **Os modificadores não dobram.** Fica um **desfazer** para quando o Mestre não confirmar o acerto, por exemplo porque o alvo é imune a crítico por efeito de mesa.
- O contrato do crítico no motor (grupos de dados, `critExtraRolls` guardados à parte para o desfazer, crítico forçado sem d20) é o de `regras-dano-e-morte.md`, "O que o motor de rolagem precisa para o crítico". Não há um segundo contrato aqui.
- Num **1 natural em ataque**, a jogada mostra "erra automaticamente" e não oferece dano.

### 11.4 Concentração na ficha viva

- **Estado de jogo:** `concentration: { spellId: string; startedAt: string } | null`. Fica no estado de jogo, nunca na ficha. A fonte de "esta magia exige concentração" é `spells.json → concentration: boolean`, que já existe.
- **Ao conjurar** uma magia com `concentration: true`, marcar "Concentrando em X". Se já houver outra ativa, **avisar antes** que a anterior termina (seção 10.2) e trocar.
- **Ao registrar dano com concentração ativa:** mostrar na hora o lembrete **"TR de Constituição para manter X — CD N"**, com `N = max(10, floor(dano / 2))`, e um botão que rola o TR de CON com os modificadores da ficha (habilidade + proficiência em TR de CON, quando houver). **Cada evento de dano (com todas as suas parcelas) é uma origem**: dois eventos geram dois lembretes, cada um com a sua CD. A CD usa o **total do evento** depois de resistências (passo 3 de "Ordem de aplicação de um dano recebido" em `regras-dano-e-morte.md`), **contando o que os PV temporários absorveram**, com metade arredondada para baixo (assumido (E), a confirmar; Pontos em aberto, itens 4 e 5). A entrada é a lista de parcelas `{ amount, damageType, ... }` por evento, e um golpe com vários tipos de dano gera **um** lembrete, não um por parcela: um teste por evento de dano (assumido (E); item 13).
- O TR de CON da concentração recebe as mesmas fontes de vantagem/desvantagem dos demais TR de CON, inclusive a Exaustão 3 (`regras-condicoes.md`, 6.3).
- **Fracasso no TR:** a concentração termina, com desfazer. **Sucesso:** nada muda.
- **Conjurador de Guerra:** na jogada de concentração, a vantagem já vem marcada como fonte do talento, porque ali o efeito está sempre ligado. Fora dessa jogada, vira linha condicional na ficha ("vantagem no TR de CON para manter concentração"), seguindo a regra de ouro do `sheetEffects`. **Matador de Conjuradores** é do atacante: a UI só oferece um seletor manual de "desvantagem imposta".
- **Quebra automática** (assumido (F), a confirmar): aplicar uma condição que incapacita (`incapacitated`, `paralyzed`, `petrified`, `stunned`, `unconscious`; seção 10.3), cair a 0 PV (Inconsciente, inclusive no nocaute) ou **qualquer transição `lifeState → 'dead'`** de `regras-dano-e-morte.md` (morte instantânea, terceiro fracasso no teste contra a morte, Exaustão 6 = morte) encerra a concentração sozinho, no mesmo evento desfazível que causou a mudança. É efeito incondicional e entra no estado.
- **Fenômeno ambiental:** um botão manual "Mestre pediu TR de concentração" rola com CD 10.
- **Encerrar voluntariamente:** um botão simples, sem custo, porque não gasta ação.
- **Tempo de conjuração maior (pág. 204):** fora do MVP, salvo decisão em contrário. Ver Pontos em aberto.

### 11.5 Inspiração

- No PHB 2014, a inspiração é **binária**: `hasInspiration: boolean` no estado de jogo. Não há contador, porque ela não acumula (pág. 127). Marcar "ganhei" é ação do jogador quando o Mestre concede, já que não há mestre no app.
- **Gastar:** em uma jogada de ataque, TR ou teste, a opção "usar inspiração" acrescenta a fonte `inspiration` à lista de vantagem e zera o flag ao confirmar a jogada.
- **Já ter vantagem** torna o gasto inútil, porque vantagem não acumula. **Ter desvantagem** faz o gasto anular a desvantagem e a jogada sai normal. A UI deve **avisar** nos dois casos, sem impedir.
- **Dar a outro jogador:** sem multiplayer, é só "abrir mão", que zera o flag e registra no histórico.
- **Nome na UI:** "Inspiração", separada visualmente da "Inspiração de Bardo", que é um recurso com dado e usos e pertence ao doc de recursos.

### 11.6 Iniciativa, testes e passivos

- **A iniciativa é um teste de Destreza** e passa pela mesma montagem dos testes de habilidade de DES: modificador de DES + efeitos que valem para testes de habilidade + bônus específicos de iniciativa (Alerta +5, pág. 167). Ela **não** é calculada à parte como "modificador de DES" (ver Pontos em aberto, item 7, sobre a Versatilidade e o Atletismo Extraordinário). **Envenenado e Exaustão 1 dão desvantagem na iniciativa** (decisão 9; item 6).
- O app mostra **o total**. Empates são assunto da mesa (seção 9), e o app pode oferecer um d20 de desempate opcional.
- **Testes resistidos:** o app rola só o lado do jogador. O resultado do outro lado, quando houver, entra manualmente. Empate = "a situação continua como estava".
- **Passivo:** continua vindo de `getPassiveScore`. Vantagem e desvantagem que já valem para o passivo hoje (as da ficha) seguem o +5/−5 da pág. 177. As que vêm de condição ou exaustão (Envenenado, Exaustão 1) **entram como −5** na Percepção passiva (decisão 9; item 6 aqui e item 8 de `regras-condicoes.md`), vindas do mesmo agregador `sheetEffects.ts` com o estado de jogo como fonte (decisão 11). As condicionais viram linha própria.

### 11.7 Arredondamento (observação do autor, não do livro)

- A regra geral é arredondar para baixo (seção 3). Dois textos dizem "para cima" na própria regra: o 1d3 simulado com d6 (pág. 6) e o Atletismo Extraordinário (pág. 85). Leio os dois como regra específica que vence a geral. O livro não os cita como exemplo disso.
- Consequência: nenhum arredondamento fixo no motor. Quem divide (o agregador da ficha) informa o modo. Hoje o Atletismo Extraordinário está só como texto em `class-progression-features.json`, sem `effects`. Ao declará-lo, o meio bônus dele arredonda para cima, e o da Versatilidade para baixo, e os dois nunca se somam (seção 5: "soma uma vez e multiplica ou divide uma vez").
- O d3 digital sai uniforme (11.2, item 1), sem divisão. O arredondamento do 1d3 só importa na entrada manual com d6 (item 11).

## 12. Pontos em aberto (decidir com o dono)

1. **Alcance da inspiração.** O cap. 4 (pág. 127, linhas 11416-11419) permite gastá-la em **qualquer** jogada de ataque, TR ou teste de habilidade; o cap. 7 (pág. 175, linhas 15504-15506) fala em testes ligados à personalidade, ideais ou vínculos. Sem decisão. Segue a proposta (a pág. 127, sem restringir na UI) até decisão em contrário.
2. **Momento de gastar a inspiração** (linha 11416). Antes ou depois de ver o dado? Sem decisão. Segue a proposta (oferecer **antes** de rolar) até decisão em contrário.
3. **Talento Sortudo com vantagem ou desvantagem.** O extrato (pág. 172, linhas 15382-15389) não diz como o "d20 adicional" se combina com uma jogada que já tem dois d20. A regra do cap. 7 sobre rerrolagem (pág. 175) trata de "refazer", não de "dado adicional". Não chutar: definir antes de implementar o talento no motor.
4. **"Dano recebido" na CD de concentração** (linhas 18365-18366): antes ou depois de resistência/vulnerabilidade, e com PV temporários? **Assumido (2026-10-24), a confirmar (E):** o dano depois da resistência, contando o que os PV temporários absorveram.
5. **Arredondamento da metade do dano.** **Assumido (2026-10-24), a confirmar (E):** CD = `max(10, floor(dano / 2))`, pela regra geral da pág. 7.
6. **Desvantagem incondicional no passivo e na iniciativa** (Exaustão 1 e Envenenado, pág. 292; passivo, pág. 177; iniciativa, págs. 179/191). **Decidido (2026-10-24):** valem também na Percepção passiva (−5) e na iniciativa (desvantagem). Vale para este documento e para `regras-condicoes.md` (item 8 e tabela 6.3), já sincronizados.
7. **Versatilidade e Atletismo Extraordinário na iniciativa.** A Versatilidade (pág. 54) soma metade da proficiência, arredondada para baixo, em "qualquer teste de habilidade" sem proficiência. O Atletismo Extraordinário (Campeão 7, pág. 85) soma metade, "arredondado para cima", em "qualquer teste de Força, Destreza ou Constituição" sem proficiência. Com a iniciativa sendo teste de Destreza (págs. 179/191), os dois entrariam nela. Mesma natureza de inferência do item 6 (que o dono decidiu aplicar à desvantagem, mas não a estes bônus). Leio "teste de Força, Destreza ou Constituição" como teste de habilidade, não de resistência, porque o livro chama este de "teste de resistência de Força". Confirmar as duas coisas.
8. **20 e 1 naturais em testes de habilidade e TR comuns.** O extrato só dá regra para ataque (pág. 196) e TR contra a morte (pág. 199). Decidir se a UI destaca o natural nesses casos só como visual (sem sucesso automático) ou não destaca.
9. **Desempate de iniciativa.** Oferecer ou não o d20 de desempate opcional da pág. 191.
10. **Concentração durante tempo de conjuração maior** (pág. 204), incluindo rituais com +10 minutos. Sem decisão. Segue a proposta da seção 11.4 (fora do MVP) até decisão em contrário.
11. **d2 e d3 com dado físico.** Na entrada manual, aceitar o resultado final (1-2 ou 1-3) ou o d6 tirado, com a conversão da pág. 6 feita pelo app. Sem decisão. Segue a proposta (aceitar o resultado final) até decisão em contrário.
12. **Tradução:** trechos lidos: linhas 405-520, 4168-4172, 7312-7332, 11394-11426, 15471-15760, 15944-15948, 16161-16193, 17039-17063, 17524-17535, 17752-17764, 17853-17906, 18174-18228, 18295-18380, 28440-28605.
    - **1d2 (linha 433, pág. 7):** o extrato diz "atribua 1 ou 2 ao resultado par ou ímpar". Lido ao pé da letra, o 1 vai para o par e o 2 para o ímpar. A regra em inglês que conheço diz "odd or even", o que põe o 1 no ímpar. A ordem parece invertida na tradução. A seção 1 mantém o texto do extrato. Para o motor é indiferente, porque o d2 digital sai uniforme e as duas atribuições dão 50%. Só importaria num texto de ajuda para dado físico: qual ordem exibir?
    - Fora isso, não achei outra divergência evidente entre o pt-BR e a regra de 2014. A tensão interna do item 1 é do próprio livro, não da tradução.
13. **Golpe com vários tipos de dano e a concentração** (linhas 18366-18369: "para cada origem do dano"). Um ataque com parcelas de tipos diferentes é uma origem ou várias? **Assumido (2026-10-24), a confirmar (E):** um teste por evento de dano, com a CD pelo total do evento.
