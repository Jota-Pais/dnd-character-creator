# Ordem Paranormal — Auditoria de Regras contra o Livro

Data: 2026-07-29. Diferente do [levantamento de automação](./ordem-automacao-levantamento.md), que
perguntava "isso está calculado?", esta auditoria pergunta **"isso está calculado CERTO?"** —
comparando cada número e regra implementada com o livro (`docs/_book-extracts/ordem-paranormal.txt`).

## Conferido e correto

Verificado item por item contra as tabelas e o texto do livro. Nada a fazer aqui:

| Área | Referência | Situação |
|---|---|---|
| PV/PE/SAN iniciais das 3 classes | Tabelas 1.3/1.4/1.5 | ✅ 20+Vig/2+Pre/12, 16+Vig/3+Pre/16, 12+Vig/4+Pre/20 |
| Ganhos por degrau de NEX | idem | ✅ 4/2/3, 3/3/4, 2/4/5 |
| Limite de PE por turno | Tabela 1.2 | ✅ 1 em NEX 5% … 20 em NEX 99% |
| Cadência da progressão | Tabelas 1.3/1.4/1.5 | ✅ trilha 10/40/65/99, poderes 15/30/45/60/75/90, atributo 20/50/80/95, grau 35/70, versatilidade 50 |
| Grau de Treinamento (quantidade) | p. 26/29/33 | ✅ 1+Int (combatente), 5+Int (especialista), 3+Int (ocultista) |
| Perícias e proficiências por classe | p. 26/29/33 | ✅ inclusive Ocultista sem proficiência de proteção |
| Geração de atributos | p. 16 | ✅ todos em 1, 4 pontos, um pode ir a 0 por +1 ponto, teto inicial 3 (soma sempre 9) |
| Teto do Aumento de Atributo | p. 26 | ✅ 5, e só "desta forma" (maldição pode passar) |
| Defesa | p. 37 | ✅ 10 + Agilidade + modificadores |
| Deslocamento padrão | p. 37 | ✅ 9m |
| Patentes | Tabela 3.1 | ✅ PP, limite de crédito e vagas por categoria |
| Capacidade de carga | p. 55 | ✅ 5 espaços por ponto de Força (2 se Força 0) |
| Custo de rituais | Tabela 5.2 | ✅ 1/3/6/10 PE |
| DT de ritual | p. 121 | ✅ 10 + limite de PE + **Presença** (os exemplos do livro, NEX 5% → 14 e NEX 99% → 35, fecham) |
| Limite do Aprender Ritual | p. 119 | ✅ igual ao Intelecto; rituais de classe do Ocultista não contam |
| Origens (26) | p. 17-21 | ✅ as 2 perícias treinadas e o poder de cada uma |
| Tabela de origens por 2d20 | Tabela 1.1 | ✅ as faixas de rolagem batem com a curva de 2d20 |
| Armas (34) | Tabela 3.3 | ✅ categoria, dano, crítico, alcance, espaços e empunhadura — **exceto o Florete** (ver F5) |
| Munições (6) | Tabela 3.4 | ✅ categoria e espaços |
| Proteções (3) | Tabela 3.6 | ✅ +5/I/2, +10/II/5, escudo +2/0/2; RD 2 e penalidade de carga da pesada; escudo conta como pesada p/ proficiência |
| Rituais (81) | p. 122-160 | ✅ contagem fecha (80 de elemento único + Amaldiçoar Arma multi-elemento) |
| Maldições (34) | p. 145-148 | ✅ Vitalidade +15 PV, Esforço Adicional +5 PE, atributos +1 (Carisma sem PE, Sagacidade sem perícias), Cinética RD 2/5 por peso |
| Dedicação (Universitário) | p. 21 | ✅ +1 PE, +1 por NEX ímpar (15…95), limite +1 |

**Erro de edição no livro, já registrado:** o exemplo de DT da p. 80 (Vigor 3, NEX 55% → 18) contradiz
a Tabela 1.2, que dá limite de PE 11 nesse NEX (→ 24). O 18 corresponde ao limite do NEX 25%. Os
exemplos da p. 121 usam a tabela corretamente, o que confirma o deslize. Seguimos a tabela.

---

> **Estado: todos os problemas corrigidos em 2026-07-30.** As seções abaixo descrevem cada achado
> como diagnosticado; o que mudou está no fim de cada uma, em **Correção**. Dois achados novos
> apareceram durante a implementação (F8 e F9) e também estão fechados.

## Problemas encontrados

### F1 — Sobrecarga bloqueia a ficha em vez de penalizar (P0)

**Livro (p. 55):** "Se ultrapassar esse limite, fica **sobrecarregado**; você sofre –5 em Defesa e
testes de perícia afetadas por carga, e seu deslocamento é reduzido em –3m. Você **não pode
ultrapassar o dobro** desse limite."

**Hoje:** `isEquipmentStepComplete` devolve `false` assim que os espaços passam da capacidade — a
etapa trava. O app proíbe um estado que o livro permite (com penalidade).

**Correção:** permitir até 2× a capacidade, aplicar as três penalidades na ficha (Defesa −5, perícias
de carga −5, deslocamento −3m) e bloquear só acima de 2×. As penalidades de carga já têm canal
próprio (o −5 da Proteção Pesada), então somam naturalmente.

### F2 — Penalidade por não proficiência com ARMA não é aplicada (P1)

**Livro (p. 56):** "Se você atacar com uma arma com a qual não seja proficiente, sofre **–ØØ** nos
testes de ataque."

**Hoje:** a UI marca "Sem Proficiência" no card do item, mas `getOrdemWeaponAttack` não altera
`rollDice` — a linha de ataque de um Ocultista com fuzil mostra os mesmos dados de um Combatente.

### F3 — Penalidade por não proficiência com PROTEÇÃO não é aplicada (P1)

**Livro (p. 62):** "Se você usar uma proteção com a qual não seja proficiente, sofre **–ØØ** em testes
baseados em Força ou Agilidade."

**Hoje:** idem — só o rótulo. Esta é mais ampla que a F2: atinge todas as perícias de Força e
Agilidade, não só ataques. Um Ocultista de proteção leve (nenhuma classe dá isso a ele) deveria
carregar −ØØ em metade da ficha.

**As duas exigem a regra de dados negativos (p. 13), hoje ausente do projeto:** "Se uma penalidade
for diminuir o número de dados que você rola para menos que 1, role a quantidade de dados que
rolaria se essa penalidade fosse um bônus, mas escolha o **pior** valor." Ex.: Agilidade 2 com −ØØ
→ rola 4d20 e pega o pior.

### F4 — Engenhosidade (Especialista) não existe no projeto (P2)

**Livro (Tabela 1.4 e p. 29):** a Tabela 1.4 lista "Engenhosidade (veterano)" em NEX 40% e
"Engenhosidade (expert)" em NEX 75%. A regra: "quando usa sua habilidade Eclético, você pode gastar
2 PE adicionais para receber os benefícios de ser veterano na perícia. Em NEX 75%, pode gastar 4 PE
adicionais para receber os benefícios de ser expert."

**Hoje:** a habilidade do Especialista no `classes.json` descreve só Eclético e Perito. Engenhosidade
não aparece em lugar nenhum — nem como texto. É a terceira parte da habilidade de classe.

**Correção:** entra no `scalingByNex` da habilidade de classe, que já resolve o patamar pelo NEX.

### F5 — Florete: tipo de dano divergente (P3, decisão sua)

**Livro (Tabela 3.3):** `Florete | I | 1d6 | 18 | — | C | 1` — tipo **C** (corte).

**Hoje:** `"damageType": "P"` (perfuração), e a descrição que escrevemos ("estocada perfurante")
reforça o erro.

Fisicamente o florete é arma de estocada, então **pode ser typo do livro** — mas a fonte da verdade
do projeto é o livro. Decisão sua: seguir a tabela (C) ou manter P como correção consciente.

### F6 — Armas de arremesso não oferecem o teste de Pontaria (P4)

**Livro (p. 56):** Faca, Lança e Machadinha aparecem como corpo a corpo **com alcance Curto** — podem
ser arremessadas. E: "Quando você ataca com uma arma de arremesso, soma seu valor de Força às
rolagens de dano", mas o teste é de **Pontaria**.

**Hoje:** cada arma tem um único `weaponCategory`, então essas três são `corpo_a_corpo` e a ficha
mostra só "Luta". Quem arremessa a faca não tem a linha do teste certo.

**Correção possível:** uma segunda linha de ataque ("Faca (arremesso) — Pontaria") para armas corpo a
corpo que têm alcance.

### F7 — Coronhada e arma improvisada fora do catálogo (P4)

**Livro (Tabela 3.3 e p. 59):** Coronhada (1d4/1d6, x2, tipo I) — usar uma arma de fogo como
contundente. Arma improvisada: corpo a corpo de uma mão, 1d6, com **−Ø no teste de ataque**. Ataque
desarmado 1d3 não letal (este já temos).

Não são itens requisitáveis, então o lugar deles é uma nota de ficha ao lado do Desarmado, não o
catálogo de equipamento.

---

## Achados novos, durante a implementação

### F8 — Atributo 0 mostrava "0d20" na ficha (P0)

**Livro (p. 16):** "Se você tem um atributo 0, rola **dois dados** em testes daquele atributo, mas usa
o **pior** resultado."

Atributo 0 é legal na criação (o livro reduz um atributo a 0 na própria personagem-exemplo, Bianca,
com Força 0), e a ficha calculava o pool como o valor do atributo — resultando em `0d20`, que não
existe. Fechado junto com F2/F3, porque é a mesma máquina de "role e pegue o pior".

### F9 — Arremesso usava Luta em vez de Pontaria (P1, latente)

**Livro (p. 56):** ataques de arremesso são ataques **à distância** — "para atacar com uma arma de
combate à distância, faça um teste de **Pontaria**... São subdivididas em de arremesso, disparo e
fogo" — mas somam Força no dano, ao contrário de disparo e fogo.

`isMelee()` devolvia `true` para `arremesso` e era usada tanto para escolher a perícia quanto para
somar Força, misturando as duas coisas. Não tinha efeito visível porque nenhuma arma do catálogo é
`arremesso` — mas quebrou na hora de implementar a F6. Agora `isMelee` significa só "corpo a corpo"
(quem usa Luta) e `addsStrengthToDamage` cobre corpo a corpo **e** arremesso.

---

## Correções aplicadas (2026-07-30)

| Achado | O que mudou |
|---|---|
| **F1** | `getLoadState` classifica em dentro do limite / sobrecarregado / impossível. Passar da capacidade é permitido e aplica −5 Defesa (via `getModifiedDefenseBonus`), −5 nas perícias de carga (via o canal de bônus, acumulando com a Proteção Pesada) e deslocamento 6m. Só acima de 2× bloqueia. Aviso destacado no Equipamento e bloco próprio na Revisão e no PDF |
| **F2** | Arma sem proficiência: −ØØ no teste de ataque, com a fonte anotada na linha |
| **F3** | Proteção sem proficiência: −ØØ em **todos** os testes de Força e Agilidade — entra na tabela de perícias e nos ataques por Luta/Pontaria (não no ataque por Ocultismo, que é Intelecto). Aviso próprio no Equipamento, porque a penalidade é ampla |
| **F4** | Engenhosidade entrou na habilidade do Especialista, com `scalingByNex` resolvendo o patamar (NEX 40% veterano, 75% expert) |
| **F5** | Florete: `damageType` P → **C**, e a descrição corrigida (seguindo a Tabela 3.3, por decisão do usuário) |
| **F6** | Faca, Lança e Machadinha rendem uma segunda linha, "(arremesso)", com Pontaria e a Força ainda somada no dano |
| **F7** | Coronhada virou ataque sintético quando o agente carrega arma de fogo (1d4, ou 1d6 se a arma é de duas mãos, impacto letal). Arma improvisada ficou fora, por decisão do usuário |
| **F8** | `getDicePool` centraliza o pool: atributo 0 → 2 dados pelo pior; penalidade que derruba abaixo de 1 → rola como se fosse bônus, pelo pior. A ficha marca "pior" onde aplicável. **Metade revertida em 2026-08-02** — ver abaixo |
| **F9** | `isMelee` passou a ser só corpo a corpo; `addsStrengthToDamage` cobre a regra de dano do arremesso |

### F8, revertido pela metade (2026-08-02)

O "2 pior" do **atributo 0** saiu: `getDicePool(0)` volta a render **0 dados**, e a ficha volta a
mostrar `0` na coluna de dados e `0d20` nos ataques — como era antes da auditoria. É uma decisão
de produto do usuário contra a p. 16 do livro: o "2 pior" na coluna confundia mais do que ajudava.
A regra segue digitalizada em `regras-atributos.md` — **não é bug, não reimplementar sem pedido.**

A outra metade do F8 **fica**: a regra de dados negativos da p. 13, quando uma **penalidade**
(arma/proteção sem proficiência, condições) derruba o pool abaixo de 1 dado, continua rolando como
se a penalidade fosse bônus e pegando o pior. É outra regra, e o usuário não pediu pra tirar.

**Fontes de proficiência conferidas exaustivamente** antes de aplicar F2/F3 (a penalidade errada é
pior que penalidade nenhuma). O livro concede proficiência em exatamente 6 lugares para armas —
classe, Armamento Pesado, Balística Avançada, Ninja Urbano, Mira de Elite e Ferramenta de Trabalho
(que diz "sabe usar", sem a palavra proficiência) — e 3 para proteções: classe, Proteção Pesada e o
Escudo contando como pesada. Todas já estavam implementadas, inclusive quando o poder chega por
Versatilidade ou Expansão de Conhecimento.

---

# Segunda rodada (2026-07-30)

> **Estado: corrigido.** Ver **Correções da segunda rodada** no fim.

Áreas que a primeira rodada não tinha coberto: Tabela 2.1 (perícias), pré-requisitos dos poderes de
classe, Tabela 3.5 (modificações de arma) e — o filão principal — a seção **"Habilidades de Armas"**
e as **descrições individuais das armas** (p. 58-61), que carregam regras que a Tabela 3.3 não mostra.

## Conferido e correto nesta rodada

| Área | Referência | Situação |
|---|---|---|
| As 28 perícias: atributo-base, "somente treinada", "penalidade de carga" | Tabela 2.1 | ✅ exceto a contradição da Intuição (ver G11) |
| Pré-requisitos dos poderes de classe (todos os 20 que têm) | p. 26/29/33 | ✅ inclusive Combater com Duas Armas e Movimento Tático, que o grep só achou depois (o livro hifeniza "Pré-re-quisito" entre linhas) |
| Modificações de arma e munição (16) | Tabela 3.5 | ✅ inclusive Dum dum +2 multiplicador e Explosiva +2d6 |
| Mapeamento arma ↔ munição e durações dos pacotes | p. 60 | ✅ confirma o vínculo implementado ontem |
| Coronhada: 1d4 leve/uma mão, 1d6 duas mãos | p. 58 | ✅ confirma o que foi implementado ontem |

## Problemas encontrados

### G1 — Armas ágeis não existem no projeto (P0)

**Livro (p. 59, "Habilidades de Armas → Armas Ágeis"):** "Facas, punhais, cajados, nunchakus,
floretes e katanas permitem que você aplique sua **Agilidade em vez de sua Força** em testes de
ataque e rolagens de dano realizadas com elas."

O changelog da edição (p. 6) trata isso como mudança de destaque: o poder "Acuidade com Arma" foi
**removido** justamente porque as armas ágeis passaram a permitir builds de corpo a corpo por
Agilidade "sem que eles precisem pagar nada por isso". E o poder **Artista Marcial** diz que o
ataque desarmado "conta como armas ágeis" — hoje o código tem um comentário dizendo que isso não é
modelado porque nada dependia disso. Passou a depender.

**Hoje:** `getOrdemWeaponAttack` usa Força para todo corpo a corpo, no pool de dados **e** no dano.
Um agente de Agilidade 4 / Força 1 com katana aparece na ficha com 1d20 e +1 de dano, quando deveria
ter 4d20 e +4.

**São 6 armas:** faca, punhal, cajado, nunchaku, florete, katana (+ desarmado com Artista Marcial).

**Decisão de UX pendente:** o livro diz "permitem que você aplique" — é escolha do jogador por
ataque. Ou a ficha usa automaticamente o melhor atributo (os dois — ataque e dano — trocam juntos,
então o maior é sempre a escolha ótima), ou vira uma escolha explícita como a perícia de ataque da
Lâmina Maldita.

### G2 — Arco Composto soma Força no dano (P1)

**Livro (p. 58):** "Arco Composto. [...] **Ao contrário de outras armas de disparo, permite que você
aplique seu valor de Força às rolagens de dano.**"

**Hoje:** `addsStrengthToDamage` cobre só corpo a corpo e arremesso, então o arco composto não soma
nada — é a única arma de disparo com essa exceção.

### G3 — Motosserra: −2 nos testes de ataque (P1)

**Livro (p. 59):** "esta arma é muito desajeitada e **impõe uma penalidade de –2 nos seus testes de
ataque**". Penalidade fixa e incondicional, que a ficha não aplica. (O outro efeito — "sempre que
rolar um 6 em um dado de dano, role um dado adicional" — é rolagem em jogo, cabe como nota.)

### G4 — Armas automáticas e rajada (P1)

**Livro (p. 59):** "Fuzis de assalto, submetralhadoras e metralhadoras podem disparar tiros únicos
[...] ou **rajadas**. Quando dispara uma rajada, você sofre **–Ø no teste de ataque, mas causa 1 dado
de dano adicional** do mesmo tipo."

Duas consequências: (a) a rajada é uma segunda forma de atacar com essas três armas, que a ficha não
mostra; (b) essas armas **já são automáticas**, mas o catálogo não marca isso — então a modificação
**Ferrolho Automático** ("a arma se torna automática") é oferecida a elas, onde é redundante. A
modificação Compensador ("anula a penalidade por rajadas") também não tem como agir sem a rajada
modelada.

### G5 — Metralhadora: −5 sem Força 4 ou apoio (P2)

**Livro (p. 59):** "você precisa ter **Força 4 ou maior** ou gastar uma ação de movimento para
apoiá-la em seu tripé; caso contrário, **sofre –5 em seus ataques**." A ficha conhece a Força, então
dá para resolver: com Força < 4, mostrar a penalidade (ou a nota de que exige apoio).

### G6 — Fuzil de Precisão: +5 na margem se veterano em Pontaria (P2)

**Livro (p. 59):** "Se for **veterano em Pontaria** e mirar com um fuzil de precisão, você recebe
**+5 na margem de ameaça**." A ficha sabe o grau de treinamento — é nota resolvível.

### G7 — Regras de empunhadura condicionais (P2)

- **Katana** (p. 59): "Se você for **veterano em Luta** pode usá-la como uma **arma de uma mão**."
- **Cajado** (p. 58): "pode ser usado com Combater com Duas Armas (e poderes similares) [...] como
  se fosse uma arma de uma mão e uma arma leve."

### G8 — Armas com área e regras de alcance próprias (P2)

- **Espingarda** (p. 58): "causa apenas **metade do dano** em alcance médio ou maior."
- **Lança-chamas** (p. 59): atinge todos numa **linha de 1,5m** em alcance curto; um único teste de
  ataque comparado com a Defesa de todos; atingidos ficam **em chamas**.
- **Bazuca** (p. 58): dano no alvo **e em todos num raio de 3m** (estes com Reflexos DT Agi para
  metade); pode ser disparada num **ponto**, sem teste de ataque.
- **Besta, Balestra e Bazuca**: exigem ação de movimento para recarregar a cada disparo.

### G11 — Intuição: o livro se contradiz (nenhuma ação, decisão registrada)

**Tabela 2.1** lista Intuição com atributo-base **Int**. O cabeçalho da descrição da perícia (p. 45)
diz **INTUIÇÃO (PRE)**.

Nossos dados usam **Presença**, e é a leitura defensável: a descrição diz "mede sua empatia e sexto
sentido"; Percepção também é Presença; e o poder paranormal **Sensitivo** concede "+5 em Diplomacia,
Intimidação e Intuição" — um trio coerente de perícias de Presença. A célula da tabela parece ser o
deslize. Sem mudança de código. **Confirmado pelo usuário (2026-07-30): Intuição é com Presença.**

---

## Correções da segunda rodada (2026-07-30)

| Achado | O que mudou |
|---|---|
| **G1** | Campo `agile` nas seis armas do livro (faca, punhal, cajado, nunchaku, florete, katana) e no desarmado quando há Artista Marcial. O ataque usa o **melhor** entre Força e Agilidade — no pool de dados **e** no bônus de dano —, e a ficha mostra qual atributo em `attributeUsed` ("Luta (AGI) 4d20"). O ataque por Ocultismo (Lâmina Maldita) fica fora da troca, porque é Intelecto |
| **G2** | `addsStrengthDamage` no Arco Composto: soma Força no dano apesar de ser arma de disparo |
| **G3** | `attackPenalty: 2` na motosserra, descontada do bônus de ataque; o dado extra ao rolar 6 e a ação para ligar viraram notas |
| **G4** | `automatic` nas três armas automáticas, visível no resumo do card e como nota na ficha ("pode disparar rajada: −Ø por +1 dado"). A modificação Ferrolho Automático deixa de ser oferecida a elas (`excludesAutomatic`). A rajada em si não é modelada, por decisão do usuário |
| **G5** | Nota da metralhadora, só quando a Força é menor que 4: exige apoiar em tripé, senão −5 |
| **G6** | Nota do fuzil de precisão, só quando veterano ou expert em Pontaria: +5 na margem ao mirar |
| **G7** | Nota da katana (uma mão, se veterano em Luta) e do cajado (conta como uma mão e leve para Combater com Duas Armas) |
| **G8** | Notas de espingarda (metade do dano em alcance médio+), lança-chamas (linha de 1,5m), bazuca (raio de 3m, disparo em ponto) e recarga de besta/balestra/bazuca. Também a corrente (+2 para desarmar e derrubar) |

**Decisão de UX na G1:** o livro diz "permitem que você aplique", o que é escolha do jogador por
ataque. A ficha usa o melhor atributo automaticamente porque ataque e dano trocam **juntos** — não há
trade-off a decidir, o maior é sempre ótimo. Mas o atributo aparece na linha ("Luta (AGI)"), pra a
regra não ficar escondida e o jogador poder optar diferente na mesa.

Nove testes antigos falharam ao aplicar a G1, todos porque usavam a **faca** (que é ágil) com
Agilidade 3 / Força 2 — o número mudou porque a regra mudou. Os que testavam a regra BASE de corpo a
corpo passaram a usar o machete (não ágil); os demais tiveram a expectativa atualizada com o motivo
no comentário.

---

# Terceira rodada (2026-07-30)

Áreas restantes: os **81 rituais em detalhe** (a primeira rodada só conferiu a contagem), os poderes
paranormais e as tabelas de equipamento geral. Os stat blocks dos rituais foram comparados campo a
campo com o livro por script, normalizando os cortes de palavra do extract do PDF ("Vonta de",
"Forti tude", "pes soal").

## Conferido e correto nesta rodada

| Área | Situação |
|---|---|
| Os 81 rituais: círculo, elementos, execução, alcance e alvo | ✅ nenhuma divergência |
| Pré-requisitos dos poderes paranormais (10 dos 22 têm) | ✅ Conhecimento/Energia/Morte/Sangue com as contagens certas |
| Semântica do `elementCount` | ✅ "Morte 2" exige **dois outros** poderes de Morte — a contagem só acumula depois da instância ser validada, como a p. 114 manda |
| Unicidade dos poderes paranormais | ✅ "só pode escolher cada poder uma vez", exceto Aprender Ritual e a 2ª cópia por afinidade |
| Tabela 3.8 (27 itens gerais, acessórios e explosivos): categoria e espaços | ✅ inclusive a Mochila Militar, cujo `*` no livro é 0 espaço |
| Chamas do Caos sem linha de Resistência | ✅ o livro realmente não tem — foi falso positivo do meu primeiro script |

## Problemas encontrados

### H1 — 13 campos de stat block de ritual truncados ou vazios (P1)

A digitalização cortou valores nas quebras de linha do livro. Em 12 rituais, o que a ficha imprime
está incompleto:

| Ritual | Campo | Nosso | Livro |
|---|---|---|---|
| Canalizar o Medo | duração | `permanente até ser` | `permanente até ser descarregada` |
| Compreensão Paranormal | resistência | `Vontade anula` | `Vontade anula (veja texto)` |
| Convocar o Algoz | resistência | `Vontade parcial,` | `Vontade parcial, Fortitude parcial` |
| Decadência | resistência | `Fortitude reduz` | `Fortitude reduz à metade` |
| Desacelerar Impacto | duração | `até chegar ao solo ou` | `até chegar ao solo ou cena, o que vier primeiro` |
| Eco Espiral | resistência | `Fortitude reduz` | `Fortitude reduz à metade` |
| Hemofagia | resistência | `Fortitude reduz` | `Fortitude reduz à metade` |
| Invadir Mente | duração | `instantânea` | `instantânea ou 1 dia` |
| Invadir Mente | resistência | *(vazio)* | `Vontade parcial ou nenhuma` |
| Mergulho Mental | resistência | `Vontade parcial` | `Vontade parcial (veja texto)` |
| Miasma Entrópico | resistência | `Forti tude parcial` | `Fortitude parcial (veja texto)` |
| Paradoxo | resistência | `Fortitude reduz` | `Fortitude reduz à metade` |
| Vínculo de Sangue | resistência | `Fortitude` | `Fortitude anula` |

**Por que importa:** a Revisão e o PDF imprimem a resistência de cada ritual conhecido. "Fortitude
reduz", sem o "à metade", não diz ao jogador o que um sucesso faz; "Vínculo de Sangue: Fortitude"
esconde que o teste **anula** o ritual. E `Forti tude` é um erro visível na ficha.

O `Forti tude` mostra que parte da digitalização veio de cópia direta do PDF, então a mesma classe de
erro pode existir nas 81 **descrições** — que este script não compara (só os campos do stat block).

### H2 — Discente e Verdadeiro só existem como texto (P2, decisão pendente)

Praticamente todo ritual tem versões avançadas: "Discente (+2 PE): muda o bônus de dano para +2d6.
Requer 2º círculo." / "Verdadeiro (+5 PE): ... Requer 3º círculo e afinidade." Hoje isso vive dentro
da `description`, como texto corrido.

A ficha calcula o custo base com todas as reduções (Ritual Predileto −1, Mestre em Elemento −1,
Tatuagem Ritualística −1), mas não os custos avançados — então quem quiser conjurar um Discente
refaz a conta na mesa. E os requisitos ("Requer 3º círculo", "Requer 4º círculo e afinidade") são
verificáveis contra o personagem: a ficha poderia dizer **quais versões ele já pode usar**.

Estruturar isso significaria extrair de cada descrição os degraus (nome, custo extra, círculo
mínimo, exige afinidade) — trabalho de dados considerável, e a decisão de fazer ou não é do usuário.

**Decisão do usuário (2026-07-30): não estruturar.** O texto do livro já diz "+3 PE" / "+5 PE" em
cada degrau, e os rituais continuam mostrando todas as versões na descrição. Sem mudança.

## Correções da terceira rodada (2026-07-30)

**19 campos de stat block corrigidos em 17 rituais** (13 da tabela da H1, mais 6 encontrados
depois). Os seis extras apareceram porque os testes de regressão são mais rígidos que o script de
auditoria: o script comparava normalizando espaços, então `"instantâ nea"` batia com `instantânea` do
livro e passava — mas o dado quebrado é o que a ficha imprime.

| Ritual | Campo | Era | Virou |
|---|---|---|---|
| Vomitar Pestes | resistência | `Reflexos reduz` | `Reflexos reduz à metade` |
| Convocação Instantânea | alcance | `ilimita do` | `ilimitado` |
| Decadência, Eletrocussão, Hemofagia, Lâmina do Medo | duração | `instantâ nea` | `instantânea` |

**Três suspeitos que estavam CERTOS** e não foram tocados, porque o livro é assim mesmo:
Perturbação (`Vontade (anula)`, com parênteses), Poeira da Podridão (`Fortitude (veja texto)`) e
Deflagração de Energia (stat block sem linha de Duração).

### Testes de regressão

Cinco travas novas em `ritualUtils.test.ts`, mirando a *classe* do erro e não só os casos corrigidos:

- nenhum campo termina em conector solto ou pontuação (`Fortitude reduz`, `Vontade parcial,`)
- nenhum campo tem palavra partida pelo OCR (`Forti tude`, `instantâ nea`, `ilimita do`)
- **execução** e **alcance** têm vocabulário fechado no livro, então viraram allowlist — trava bem
  mais forte que padrão de texto
- todo termo de resistência diz o que o sucesso faz (um `Fortitude` sozinho não informa nada)
- os 19 valores corrigidos, um a um

Foram esses testes que acharam os 6 casos extras.

### Passada nas descrições (2026-07-30)

O `Forti tude` levantou a suspeita de que a digitalização tinha vindo de cópia direta do PDF, e que
a mesma classe de artefato poderia estar nos textos. Três verificações:

**1. As 81 descrições de ritual são fiéis ao livro — 100%.** Comparação por continência: o texto do
livro sem lixo de paginação e com a hifenização de fim de linha juntada, tudo normalizado sem
espaços nem acentos, tem que CONTER a nossa descrição. As 81 passaram. O artefato estava confinado
aos campos do stat block (já corrigidos), não ao corpo do texto.

**2. Varredura de artefato de OCR nos 12 arquivos de dados** (rituais, poderes de classe, trilhas,
origens, poderes paranormais, maldições, equipamentos, perícias, classes, patentes, modificações,
atributos), procurando hífen solto no meio de palavra (`"modi- ficação"`), espaço duplo, quebra de
linha vazada, marca d'água do PDF e raízes que o OCR costuma partir: **limpo**. O único acerto foi
falso positivo ("Você **modifica s**ua aparência").

**3. Fidelidade numérica das descrições de habilidade** — 45 poderes de classe, 60 features de
trilha, 26 poderes de origem, 22 paranormais e 34 maldições. Como nossos textos são condensados (não
literais), o teste foi: todo número, dado e custo que aparece no NOSSO texto tem que existir no
trecho correspondente do livro. **Nenhuma divergência real.** Quatro sinalizações, todas resolvidas:

- *Faro para Pistas* e *Ritualística*: falha do localizador — pegou a Tabela 1.1 num caso e o poder
  de classe "Tatuagem Ritualística" no outro (colisão de nome com a maldição "Ritualística")
- *Conjuração* e *Ritualística*: nosso texto é o do livro **mais** um parêntese que nós acrescentamos
  explicitando os custos da Tabela 5.2 (1/3/6/10 PE) — acréscimo correto, conferido na 1ª rodada
- *Sangue de Ferro*: ver a limitação abaixo

### Limitação do extract (não é bug nosso)

O `docs/_book-extracts/ordem-paranormal.txt` tem pelo menos um ponto onde a quebra de página comeu
texto do corpo: a descrição de **Sangue de Ferro** termina em "Você recebe +2 pon-" e a linha
seguinte já é o capítulo RITUAIS. O resto do poder não está no extract, então nossa descrição dele
**não pode ser verificada por aqui** — ela é consistente e paralela à do Potencial Aprimorado (que é
verificável), mas conferir de verdade exige a página do PDF.

Vale como recado geral: "conferido contra o extract" não é o mesmo que "conferido contra o livro
impresso" nos pontos onde o extract perdeu conteúdo.

---

# Quarta rodada (2026-07-30)

As três lacunas de cobertura que a terceira rodada declarou em aberto: a Tabela 3.10 (itens
paranormais), a Afinidade Elemental (p. 116) e os pontos do Capítulo 4/5 que tocam a ficha.

## Conferido e correto

| Área | Situação |
|---|---|
| Tabela 3.10 — os 6 itens paranormais, categoria e espaços | ✅ Amarras II/1, Câmera II/1, Componentes 0/1, Emissor II/1, Escuta II/1, Scanner II/1 |
| Descrições dos itens paranormais | ✅ condensadas mas fiéis (armadilha e laçar das Amarras, DTs, custos em PE) |
| Afinidade Elemental (p. 116) | ✅ elemento a partir do NEX 50%, ativação no primeiro transcender dali em diante, e os 3 benefícios cobertos: dispensa de componentes, o ±ØØ como nota, e a 2ª escolha de poder |
| Mapa do elemento opressor (`OPPRESSOR_OF`) | ✅ o livro diz "a Morte é o elemento opressor do Sangue" e o mapa tem `blood: 'death'`; o ciclo inteiro fecha com o `OPPRESSES` de `curseUtils` |
| Condições `machucado` e `morrendo` | ✅ as condições que nossos efeitos citam existem e significam o que dizem |

**Mais uma contradição interna do livro:** a Tabela 3.10 lista "**Câmara** de aura paranormal", mas a
descrição do item (p. 67) diz "**Câmera** de Aura Paranormal. Esta **câmera** amaldiçoada..." e o
efeito é tirar fotos. Nossos dados usam "Câmera", que é o certo. Sem ação — é o terceiro caso, junto
com o exemplo de DT da p. 80 e o atributo-base da Intuição.

## Problemas encontrados

### I1 — Amarras e Scanner nunca resolvem o elemento (P1)

O livro nomeia três itens paranormais com o placeholder "(Elemento)", porque o elemento é escolhido
ao requisitar: **Amarras de (Elemento)**, **Componentes Ritualísticos de (Elemento)** e **Scanner de
Manifestação Paranormal de (Elemento)**. O elemento muda o efeito — as Amarras só imobilizam
criaturas vulneráveis *ao elemento que as compõe*, e o Scanner detecta manifestações *do elemento
escolhido*.

Os Componentes nós dividimos em **4 itens concretos** (um por elemento), e isso funciona: alimenta o
aviso de componentes faltando. Mas Amarras e Scanner ficaram como **item único com o `(Elemento)`
literal no nome** — então a ficha imprime "Amarras de (Elemento)", um placeholder não resolvido, e o
jogador não tem onde registrar qual elemento escolheu.

É a mesma classe de escolha que já foi resolvida duas vezes (perícia do acessório, perícia do kit).
Duas formas:

- **dividir em 4 itens cada** (8 novas entradas), seguindo o precedente dos Componentes; ou
- **escolha de elemento por unidade**, como a maldição Proteção Elemental (`element: 'varies'` +
  `choice: 'element'`) e o kit já fazem — mantém o catálogo com um item por item do livro

### I2 — O limiar de "machucado" não aparece na ficha (P2)

**Livro (p. 94):** "Machucado. Se estiver com **menos da metade** de seus PV totais, você está
machucado. Por si só, essa condição não causa penalidades, mas serve de pré-requisito para certas
habilidades e efeitos."

E há várias habilidades penduradas nela: **Inquebrável** (+10 Defesa e RD 5 enquanto machucado),
**Sangue Fervente** (+1/+2 em Agilidade ou Força), **Sangue Vivo** (cura acelerada na primeira vez
que ficar machucado) e **Resgate** (aliado machucado). A ficha mostra a condição como texto —
"enquanto estiver machucado" — mas nunca diz **a partir de quantos PV isso vale**, embora o número
seja trivial de derivar do PV total que já está impresso ao lado.

Para um agente com 34 PV, machucado é 16 PV ou menos. Hoje o jogador faz essa conta no meio do
combate, com três efeitos dependendo dela.

## Correções da quarta rodada (2026-07-30)

**I1 — escolha de elemento por unidade.** `needsElementChoice` marca os dois itens, e o elemento
escolhido vive em `draft.equipmentElementChoices` por UNIDADE — dá pra carregar Amarras de Sangue e
Amarras de Morte ao mesmo tempo, como um ritual multi-elemento pode ser conhecido em dois elementos.
São os 4 elementos paranormais (não há versão de Medo, como não há Componentes Ritualísticos de Medo).

O detalhe que fecha a coisa: **`getInstanceLabel` resolve o placeholder**, então "Amarras de
(Elemento)" vira "Amarras de Sangue" em todo lugar de uma vez — inventário, avisos, PDF —, e a
etapa fica pendente enquanto a escolha não é feita, com os chips de elemento no card do item.

**I2 — limiar de machucado na ficha.** `getWoundedThreshold(maxHp)` = `ceil(PV/2) − 1`, o maior valor
que ainda é "menos da metade". Aparecia embaixo do PV na Revisão ("machucado com 16 ou menos") e no
quadro de PV do PDF.

> **Revertido em 2026-07-30, por decisão do usuário.** "Todo mundo sabe olhar pra própria vida e
> sabe se tá abaixo da metade ou não" — a linha era ruído numa ficha que já imprime o PV total e tem
> campo em branco para o PV atual. A função e o teste foram removidos junto com a exibição. Vale
> igualmente para o limiar de perturbado da quinta rodada (L4). **Se algum dia voltar, o motivo terá
> de ser outro** (por exemplo, a ficha passar a rastrear PV atuais), não o cálculo em si.

---

# Quinta rodada (2026-07-30)

O método mudou. As quatro rodadas anteriores perguntavam "o que temos está certo?"; esta perguntou
**"o que o livro tem e nós não temos?"** — cobertura inversa, por script, comparando o CONJUNTO de
habilidades do livro com o dos dados, em vez de cada dado nosso contra o livro. Foi assim que as
áreas cobertas "de um lado só" finalmente fecharam.

## Conferido e correto

| Área | Verificação | Situação |
|---|---|---|
| **60 habilidades de trilha** (15 × 4) | cobertura nos DOIS sentidos + NEX + ordem + texto | ✅ nenhuma falta, nenhuma inventada, nenhum NEX trocado |
| **45 poderes de classe** | idem, extraindo os bullets do capítulo 1 | ✅ exatamente 45 nos dois lados |
| **22 poderes paranormais** | cobertura, pré-requisitos e afinidade | ✅ 2 gerais + 5 por elemento |
| **34 maldições** | cobertura por seção (12 armas / 10 proteções / 12 acessórios) e textos | ✅ |
| **26 origens** | perícias e poder, contra as **descrições** (não a Tabela 1.1 — ver abaixo) | ✅ |
| **28 perícias** | Tabela 2.1 mais os 4 kits e o escopo de cada um | ✅ |
| **Tabela 3.7** (modificações de proteção) | 4 modificações — **nunca auditada antes** | ✅ inclusive "só em pesada/leve" e o conflito Reforçada × Discreta |
| **Tabela 3.9** (modificações de acessório) | 4 modificações — **nunca auditada antes** | ✅ |
| Regra transversal das modificações | "cada modificação aumenta a categoria do item em I" (p. 62, 64 e 65) | ✅ `getEffectiveCategory` |
| **79 equipamentos** | todo número da nossa descrição tem respaldo no trecho do livro | ✅ (2 falsos positivos: o +5/+10 de Defesa vem da Tabela 3.6) |
| Itens amaldiçoados (p. 144) | elementos opressores, categoria +II/+I, bônus iguais não acumulam | ✅ |
| Condições citadas nos dados | as 24 existem no livro com o sentido que usamos | ✅ |

**Sangue de Ferro deixou de ser ponto cego.** A terceira rodada registrou que o extract cortava a
descrição em "Você recebe +2 pon-" e que o poder era inverificável por aqui. O texto **está** no
extract, deslocado para dentro do bloco do Surto Temporal (quebra de coluna): "+2 pontos de vida por
NEX… em NEX 50%, recebe 20 PV… Afinidade: +5 em Fortitude e imune a venenos e doenças". Confere
integralmente com a nossa descrição e com `hpPerNexStep: 2`. A limitação registrada lá está fechada.

## Problemas encontrados

### L1 — Itens amaldiçoados ignoravam a restrição de Patente (P1)

**Livro (p. 144):** "Independentemente de suas categorias, itens amaldiçoados são liberados apenas
para **agentes especiais, oficiais de operações e agentes de elite**."

Só as vagas por categoria eram checadas. E a restrição **não** é redundante com elas: o Escudo é
categoria 0, então com uma maldição vira categoria II — que cabe na única vaga de categoria II do
**Operador**. Um Operador conseguia sair de missão com um escudo amaldiçoado.

### L2 — "O preço da maldição" não existia no app (P2)

**Livro (p. 145):** cada maldição impõe uma penalidade **cumulativa** conforme o elemento — a cada
falha em teste do atributo ligado a ele, 2 pontos de Sanidade por maldição: Conhecimento→Intelecto,
Energia→Agilidade, Morte→Presença, Sangue→Força ou Vigor.

É o contrapeso permanente de carregar esses itens, é inteiramente derivável do loadout, e não
aparecia em lugar nenhum — nem na etapa de Equipamento, nem na ficha.

### L3 — Resistências de maldição não chegavam à ficha (P2)

Profética (Conhecimento 10), Voltaica (Energia 10), Repulsiva (Morte 10), Regenerativa (Sangue 10),
Proteção Elemental (10 no elemento escolhido) e Escudo Mental (mental 10) viviam só no texto do
efeito — enquanto **a mesma regra** vinda do poder paranormal *Resistir a Elemento* já alimentava
`elementResistances` e aparecia no quadro de Resistências. Metade das fontes contava, metade não.

### L4 — Limiar de "perturbado" ausente (P2) — **descartado**

**Livro (p. 95):** "Perturbado. Se estiver com **menos da metade de sua Sanidade total**, você está
perturbado. Por si só, essa condição não causa penalidades, mas serve de pré-requisito para certas
habilidades e efeitos." É o texto de *machucado*, palavra por palavra, trocando PV por SAN.

A quarta rodada colocou o limiar de machucado embaixo do PV (I2); a Sanidade ficou sem o equivalente.

> **Descartado em 2026-07-30, por decisão do usuário — junto com o de machucado (I2).** O jogador vê
> o próprio PV/SAN e sabe se está abaixo da metade; imprimir a conta é ruído. Diferença de peso entre
> os dois, registrada na hora da decisão: *machucado* tem quatro habilidades penduradas nele
> (Inquebrável, Sangue Fervente, Sangue Vivo, Resgate), enquanto **nenhuma** habilidade do nosso
> conteúdo depende de *perturbado* — ele só serve ao gatilho da Tabela 5.1 e a efeitos de criaturas,
> que são do lado do mestre. Mesmo assim, os dois saíram.

### L5 — Três itens perderam a DT na digitalização (P2)

Taser, Spray de Pimenta e Pistola de Dardos diziam "(Fortitude evita)"; o livro diz "(Fortitude **DT
Agi** evita)". Sem a sigla, o jogador não sabe qual é a dificuldade — e a ficha já resolvia essa mesma
fórmula (p. 80) para explosivos e rituais.

O gap era maior que os três itens: *Cai Dentro* ("DT Vig"), *Assassinar* ("DT Agi"), as Amarras (duas
DTs na mesma descrição) e o Emissor de Pulsos também deixavam a conta para a mesa.

### L6 — Soqueira não fazia nada (P2)

**Livro (p. 66):** "fornece +1 em rolagens de dano desarmado. Uma soqueira pode receber modificações
de armas corpo a corpo e **aplica os efeitos de suas modificações em seus ataques desarmados**."

Nenhuma das três partes existia: o +1 não entrava na linha do Desarmado (que a ficha calcula, com
Artista Marcial, Golpe Pesado e Mão Pesada), o item não aceitava modificações no catálogo
(`modAppliesTo` exigia `type === 'weapon'`) e portanto não havia o que repassar.

### L7 / L8 — Duas cláusulas perdidas na condensação (P3)

- **Eloquência** (Negociador NEX 10%) cortava "um alvo hostil ou envolvido em combate recebe +5 no
  teste de resistência e tem direito a um novo teste por rodada" e "quem passar fica imune por um dia".
- **Cai Dentro** (Tropa de Choque NEX 40%) cortava "só funciona se você puder ser efetivamente
  atacado" e "um oponente que passe no teste não pode ser afetado até o final da cena".

## Contradições internas do livro (registradas, sem mudança de código)

Somam-se às três já registradas (o exemplo de DT da p. 80, o atributo-base da Intuição e
Câmara/Câmera):

**4. A Tabela 1.1 tem 6 nomes de poder de origem desatualizados** em relação às descrições das
p. 17-21, que são o texto de regra:

| Origem | Tabela 1.1 | Descrição (e nossos dados) |
|---|---|---|
| Militar | "+1 de dano à distância" | **Para Bellum** (+2 com armas de fogo) |
| Operário | "Ferramentas da Profissão" | **Ferramenta de Trabalho** |
| Religioso | "Exorcismo" | **Acalentar** |
| T.I. | "Computação Avançada" | **Motor de Busca** |
| Trabalhador Rural | "Trilhas e Rumos" | **Desbravador** |
| Universitário | "Empenho" | **Dedicação** |

Parece uma revisão de edição que não voltou à tabela. Seguimos as descrições.

**5. O exemplo do Perito (p. 29) contradiz a Tabela 1.4.** O texto diz "em NEX 55%, pode gastar 4 PE
para receber +1d12"; a tabela dá **4 PE / +1d10** em 55%, e +1d12 só em 85%. Mesmo padrão do deslize
da p. 80 — seguimos a tabela.

## Correções da quinta rodada (2026-07-30)

| Achado | O que mudou |
|---|---|
| **L1** | `CURSE_ALLOWED_PATENTES` + `canPatenteUseCursedItems`; `areCursesValid` reprova quando a Patente não libera, então a etapa trava. No card, os botões de maldição ficam desabilitados com a razão no `title` e um aviso acima; **remover** continua liberado, para consertar save antigo ou Patente rebaixada depois. `getCursesBlockedByPatente` nomeia as unidades no aviso da etapa |
| **L2** | `getUnitCursePrice`/`formatUnitCursePrice` (agregado por elemento, cumulativo) e `getCursePriceNote` (por maldição). Aparece como observação curta na descrição de cada maldição no card do Equipamento, ao lado do nome do item na Revisão e em linha própria no PDF. Medo não tem preço — a p. 145 define só os quatro elementos |
| **L3** | Campos `elementResistance`/`mentalResistance` nas 6 maldições e `getCurseResistances`, que entra no quadro de Resistências (Revisão e PDF) e no resumo da página 1, com a fonte nomeada. Bônus iguais em itens diferentes contam uma vez (p. 144), mas Proteção Elemental de elementos diferentes são fontes distintas |
| **L4** | ~~limiar de perturbado na ficha~~ — **descartado na revisão do usuário**, que aproveitou para tirar também o de machucado (I2). Nenhuma função nova sobrou: `getDisturbedThreshold` e `getWoundedThreshold` foram removidas, com os testes e as duas exibições |
| **L5** | Os três textos recuperaram o "DT Agi", e `resolveDtInText` troca a sigla pelo número já calculado ("DT Vig" → "DT 18 — Vig") nas descrições que a ficha imprime: habilidades de origem/classe/trilha/poderes, maldições e itens. `getAbilityDt` centraliza a fórmula da p. 80, que `getSheetExplosives` passou a usar |
| **L6** | `flatDamageBonus` na arma sintética do Desarmado (+1 com Soqueira no loadout); `modAppliesTo` passou a aceitar a Soqueira nas modificações corpo a corpo; e `getUnarmedAttack` repassa as modificações dela para a linha, com a fonte anotada |
| **L7/L8** | As duas descrições completadas com as cláusulas que faltavam |

### Por que resolver a DT no texto, em vez de estruturar campo por campo

Estruturar exigiria um campo por caso e ainda assim não cobriria as **Amarras**, que impõem dois
testes diferentes (Reflexos DT Int e Vontade DT Agi) na mesma descrição. O livro escreve essas DTs
sempre no mesmo formato fechado — "DT" seguido da sigla do atributo —, então uma substituição no ponto
de exibição alcança todos os casos de uma vez, inclusive os que vierem depois. A sigla continua
visível ("DT 18 — Vig") para o jogador saber de onde veio o número e conferir se mudou depois de um
Aumento de Atributo.

### Testes de regressão

Vinte e nove travas novas (as duas dos limiares saíram com a decisão acima), mirando a classe do erro:

- **Patente × maldição**: as 5 patentes; e o caso que prova que a regra não é redundante (escudo Cat 0
  amaldiçoado → Cat II cabe na vaga do Operador, mas o livro proíbe)
- **Preço**: o mapa elemento→atributo; cumulatividade (duas maldições do mesmo elemento = 4 SAN);
  elementos diferentes no mesmo item; escolha pendente e Medo sem preço
- **Resistências**: as duas fontes (elemental e mental), não-acúmulo da mesma maldição em dois itens,
  Proteção Elemental de elementos diferentes como fontes distintas, e maldição em item não requisitado
- **DT**: a fórmula, várias DTs no mesmo texto, DT numérica intocada, e o atributo lido COM maldições
- **Soqueira**: o +1, o repasse de modificações, a nota da fonte, e o catálogo aceitando as mods certas
- **Dados**: as cláusulas de Eloquência e Cai Dentro, a sigla de DT preservada nas features, e uma
  trava genérica — nenhum item IMPÕE teste de resistência sem dizer a DT (explosivos de fora, porque
  a DT deles vive no campo estruturado `resistance`)
