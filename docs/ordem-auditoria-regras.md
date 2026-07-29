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
