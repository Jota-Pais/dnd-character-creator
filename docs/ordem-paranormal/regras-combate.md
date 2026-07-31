# Combate — Ordem Paranormal v10.1

Fonte: Capítulo 4 (Combate), livro básico pt-BR, p. 82–90. Digitalizado para o modo de jogo (ficha viva).

## Iniciativa

- No início do combate, cada envolvido faz **um teste de Iniciativa** (perícia de Agilidade). O mestre faz um único teste para todos os inimigos; havendo bônus diferentes, usa o **menor**.
- Resultados mais altos agem primeiro. **Empate:** os empatados rolam entre si para desempatar.
- Não se rola Iniciativa de novo a cada rodada — a ordem vale para o combate inteiro.
- **Entrando na luta depois:** faz o teste e age quando seu turno chegar, **na rodada seguinte**.

### Surpresa

- Quem não percebeu os inimigos está **surpreendido**. Se você percebeu e eles não, são eles os surpreendidos. Se os dois lados se perceberam, ninguém está.
- Todos rolam Iniciativa no começo da cena, inclusive os surpreendidos — mas **os surpreendidos só agem a partir da segunda rodada**.
- Quem percebe é decisão do mestre; em geral, teste de Percepção oposto pela Furtividade dos inimigos.

## A rodada e o turno

- Uma **rodada** ≈ 6 segundos. Começa no turno de quem tem a Iniciativa mais alta e termina após o turno de quem tem a mais baixa.
- Efeitos medidos em rodadas terminam imediatamente **antes** do mesmo resultado de Iniciativa em que começaram, passado o número apropriado de rodadas.

## Tipos de ação

No seu turno você pode fazer **uma ação padrão e uma ação de movimento**, em qualquer ordem. Pode trocar a padrão por uma de movimento (duas de movimento), mas **não o inverso**. Pode abrir mão das duas para fazer uma **ação completa**.

Portanto, por turno:

| Combinação |
| --- |
| uma ação padrão + uma ação de movimento |
| ou duas ações de movimento |
| ou uma ação completa |

Mais **qualquer quantidade** de ações livres e reações.

| Tipo | O que é |
| --- | --- |
| **Padrão** | Executa uma tarefa. Atacar e conjurar um ritual são os casos comuns. |
| **Movimento** | Movimento físico. Percorrer o deslocamento, levantar-se, sacar arma, pegar item da mochila, abrir porta, entrar num carro. |
| **Completa** | Consome a padrão **e** a de movimento. Normalmente ainda permite ações extras, livres e reações. |
| **Livre** | Quase nenhum tempo; só no seu turno; quantidade livre. O mestre pode limitar. Dar uma ordem curta é livre; explicar um plano inteiro, não. |
| **Reação** | Resposta a outra coisa, pode ocorrer **fora do seu turno**. Quantidade livre. Funciona mesmo sem poder agir normalmente (ex.: atordoado) — exceto reações especiais como bloqueios e esquivas. |

## Teste de ataque

É um teste de perícia: **Luta** (corpo a corpo) ou **Pontaria** (à distância). A **DT é a Defesa do alvo**. Resultado ≥ Defesa acerta e causa dano.

## Dano

```
dano corpo a corpo ou de arremesso = dano da arma + Força do atacante
dano de disparo ou de fogo         = dano da arma
```

### Tipos de dano

Balístico, Corte, Eletricidade, Fogo, Frio, Impacto, **Mental**, **Paranormal**, Perfuração, Químico.

O tipo por si só não tem efeito de regra — serve para casar com resistências e imunidades (ex.: resistência a corte 5 reduz em 5 todo dano de corte).

Dois casos importam para a ficha viva:
- **Mental** reduz **Sanidade**, não PV.
- **Paranormal** sempre tem um subtipo de elemento: Conhecimento, Energia, Medo, Morte ou Sangue.

## Acertos críticos

Cada arma tem uma **margem de ameaça** (18, 19 ou 20 — ausente = 20) e um **multiplicador** (x2, x3 ou x4 — ausente = x2).

Crítico acontece quando você **acerta o ataque** *e* o resultado do dado é **igual ou maior que a margem de ameaça**.

> **Multiplicam-se apenas os dados de dano.** Bônus numéricos e dados extras (como os do Ataque Furtivo) **não** são multiplicados.

Ou seja: `dano = (dados da arma × multiplicador) + bônus + dados extras` — nunca `(dados + bônus) × multiplicador`.

Certos seres são imunes a crítico; ainda sofrem o dano normal.

## Dano massivo

Se sofrer, **de uma só vez**, dano igual ou maior que metade dos seus PV totais e **não** for reduzido a 0 PV, faça um teste de **Fortitude (DT 15, +2 para cada 10 pontos de dano sofridos)**. Falhando, é reduzido a 0 PV (inconsciente e morrendo).

## Dano não letal

- Soma-se ao dano letal para determinar quando você fica **inconsciente**, mas **não** para determinar quando fica **morrendo**.
- Ao ser curado, cura-se primeiro o dano não letal.
- O dano é letal por padrão. Dá para usar uma arma corpo a corpo para causar dano não letal com **–5 no teste de ataque**. Ataques desarmados e certas armas já causam não letal.

## 0 PV, morrendo e morte

Não existem PV negativos.

- **Machucado:** menos da metade dos PV totais. Sem penalidade por si só — serve de pré-requisito para habilidades e efeitos.
- **Morrendo:** reduzido a 0 PV → adquire **inconsciente** e **morrendo**.
  - **Inconsciente** termina com qualquer efeito que cure ao menos 1 PV.
  - **Morrendo** termina com um teste de **Medicina (DT 20)** ou efeitos específicos.

### Divergência no próprio livro — e a leitura adotada

O livro define "morrendo" duas vezes, de formas incompatíveis:

| | Capítulo 4, p. 87 | Glossário, p. 311 |
| --- | --- | --- |
| Morre quando | **inicia** 3 turnos morrendo na cena | **termina** mais de 3 rodadas morrendo na cena |
| Sai de "morrendo" | teste de **Medicina (DT 20)** ou efeitos específicos | voltar a ter **pelo menos 1 PV** |

> ✅ **Decisão (2026-07-31, com o usuário): o app segue o Capítulo 4.** É o capítulo dedicado a combate, mais detalhado, e traz exemplo trabalhado (a Bianca). Ele separa **inconsciente** de **morrendo**: curar 1 PV tira o personagem do chão, mas ele **continua morrendo** e o contador segue correndo até alguém passar num teste de Medicina (DT 20).

Consequências para o motor:

- Contador de morte por **turno iniciado** enquanto morrendo, na mesma cena, não precisando ser consecutivos. No terceiro, morre.
- Cura de ≥1 PV remove **inconsciente**, e **não** remove morrendo.
- Só Medicina DT 20 (ou efeito específico) remove morrendo e zera o contador.
- O contador é da **cena**: começar cena nova zera.

## Ordem de cálculo

- **Arredondamento:** divisões arredondam **para baixo**, salvo indicação contrária.
- **Ordem:** multiplicações e divisões antes de somas e subtrações. O resultado do **teste de resistência é sempre o primeiro** a ser aplicado; resistência a dano, por último.
- **Multiplicações acumuladas:** combine num único multiplicador, cada efeito além do primeiro somando (seu multiplicador − 1). Ex.: x2 + x2 = x3.

Exemplo do livro: granada de 15 pontos num combatente com proteção pesada (resistência a dano 2). Passa em Reflexos → 7 (15/2). Usa Casca Grossa → 3 (7/2). Aplica resistência 2 → **1 ponto**.

## Notas para a implementação

- O app não conhece a Defesa do alvo (não há inimigos no escopo da ficha viva). Logo, ele **rola o ataque e sinaliza quando o dado caiu na margem de ameaça**, deixando a confirmação do acerto com o jogador — e só então oferece a rolagem de dano crítica.
- A separação `dados × multiplicador` **+** `bônus` precisa existir na estrutura do dano desde o começo; embutir o bônus na string de dano impede o crítico correto.
- Iniciativa é perícia de Agilidade — o pool sai de `getSkillDicePool(draft, 'initiative')`, que já existe.
