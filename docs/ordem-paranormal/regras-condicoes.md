# Condições — Ordem Paranormal v10.1

Fonte: Glossário de Condições, livro básico pt-BR, p. 310–311. Digitalizado para o modo de jogo (ficha viva).

## Regra geral

> A menos que especificado o contrário, **as condições terminam no fim da cena**.

## Notação do livro

| Notação | Significado |
| --- | --- |
| **–O** | Penalidade de **1 dado** no pool do teste |
| **–OO** | Penalidade de **2 dados** |
| **–5 / –10 na Defesa** | Penalidade numérica, direta na Defesa |

A penalidade em dados já é modelada pelo motor: `getDicePool(atributo, dicePenalty)` em `attributeUtils.ts`. Quando a penalidade derruba o pool abaixo de 1 dado, o personagem rola e pega o **pior** resultado (p. 13) — a função já resolve isso.

## As 36 condições

| Condição | Efeito | Família |
| --- | --- | --- |
| **Abalado** | –O em testes. Ficar abalado de novo → apavorado. | medo |
| **Agarrado** | Fica desprevenido e imóvel, –O em testes de ataque, só ataca com armas leves. Ataque à distância contra alvo agarrado tem 50% de acertar o alvo errado. | paralisia |
| **Alquebrado** | Custo em PE de habilidades e rituais **+1**. | mental |
| **Apavorado** | –OO em testes de perícia; deve fugir da fonte do medo da forma mais eficiente (pode parar ao perdê-la de vista ou se afastar além de alcance médio). Não podendo fugir, age, mas não se aproxima voluntariamente. | medo |
| **Asfixiado** | Não pode respirar. Prende o fôlego por (Vigor + 1) rodadas; cada dano sofrido reduz esse total em 1. Ao fim do turno da última rodada, fica **morrendo**. | — |
| **Atordoado** | Fica desprevenido e **não pode fazer ações**. | mental |
| **Caído** | –OO em ataques corpo a corpo, deslocamento reduzido a 1,5 m, **–5 na Defesa contra corpo a corpo** e **+5 na Defesa contra à distância**. | — |
| **Cego** | Fica desprevenido e lento; não faz testes de Percepção para observar; –OO em perícias de Agilidade ou Força; todos os alvos recebem camuflagem total. Vale também em escuridão total. | sentidos |
| **Confuso** | Rola 1d6 no início do turno: **1** move-se em direção aleatória (1d8); **2–3** não age, balbucia; **4–5** ataca o ser mais próximo (ou a si mesmo, só rolando o dano); **6** a condição termina. | mental |
| **Debilitado** | –OO em testes de Agilidade, Força e Vigor. De novo → inconsciente. | — |
| **Desprevenido** | –5 na Defesa e –O em Reflexos. Você fica desprevenido contra inimigos que não possa perceber. | — |
| **Doente** | Sob efeito de uma doença. | — |
| **Em Chamas** | 1d6 de dano de fogo no início dos seus turnos. Ação padrão para apagar com as mãos; imersão em água também apaga. | — |
| **Enjoado** | Só pode fazer **uma** ação padrão **ou** de movimento por rodada (não ambas). | — |
| **Enredado** | Fica lento e vulnerável, –O em testes de ataque. | paralisia |
| **Envenenado** | Varia pelo veneno: outra condição (ex.: fraco, enjoado) ou dano recorrente (ex.: 1d12 por rodada). Duração pela descrição do veneno; se nada for dito, dura a cena. **Dano recorrente de envenenado sempre acumula**, mesmo de fontes iguais. | — |
| **Esmorecido** | –OO em testes de Intelecto e Presença. | mental |
| **Exausto** | Fica debilitado, lento e vulnerável. De novo → inconsciente. | fadiga |
| **Fascinado** | –OO em Percepção; não pode agir exceto observar o que o fascinou. Qualquer ação hostil contra ele anula. Balançar para tirar: ação padrão. | mental |
| **Fatigado** | Fica fraco e vulnerável. De novo → exausto. | fadiga |
| **Fraco** | –O em testes de Agilidade, Força¹ e Vigor. De novo → debilitado. | — |
| **Frustrado** | –O em testes de Intelecto e Presença. De novo → esmorecido. | mental |
| **Imóvel** | Todas as formas de deslocamento reduzidas a 0 m. | paralisia |
| **Inconsciente** | Fica indefeso e não pode fazer ações, **incluindo reações**. Balançar para acordar: ação padrão. | — |
| **Indefeso** | Considerado desprevenido, mas com **–10 na Defesa**; falha automaticamente em Reflexos; pode sofrer golpe de misericórdia. | — |
| **Lento** | Deslocamentos reduzidos à metade (arredondando para baixo no incremento de 1,5 m); não pode correr nem investir. | paralisia |
| **Machucado** | Menos da metade dos PV totais. Sem penalidade própria — é pré-requisito de habilidades e efeitos. | — |
| **Morrendo** | Com 0 PV. Fica inconsciente; morre ao acumular rodadas morrendo na mesma cena (ver a divergência em [regras-combate.md](regras-combate.md)). | — |
| **Ofuscado** | –O em testes de ataque e de Percepção. | sentidos |
| **Paralisado** | Fica imóvel e indefeso; só realiza ações puramente mentais. | paralisia |
| **Pasmo** | Não pode fazer ações. | mental |
| **Petrificado** | Fica inconsciente e recebe **resistência a dano 10**. | — |
| **Sangrando** | No início dos seus turnos, teste de **Vigor (DT 20)**: passando, estabiliza e remove a condição; falhando, perde **1d6 PV** e continua sangrando. | — |
| **Surdo** | Não faz testes de Percepção para ouvir; **–OO em testes de Iniciativa**; considerado em condição ruim para lançar rituais. | sentidos |
| **Surpreendido** | Não ciente dos inimigos: fica desprevenido e não pode fazer ações. | — |
| **Vulnerável** | –5 na Defesa. | — |

¹ O extrato do livro traz "Agilidade, **Físico** e Vigor" em Fraco. "Físico" não é atributo do sistema (os cinco são Agilidade, Força, Intelecto, Presença, Vigor) e a condição-irmã **Debilitado** usa "Agilidade, Força e Vigor" — logo, é erro de digitação do livro/extração. Registrado como **Força**.

## Cadeias de agravamento

Quatro condições escalam ao serem aplicadas de novo. O motor precisa tratar a reaplicação, não apenas o estado:

```
Abalado    → Apavorado
Frustrado  → Esmorecido
Fraco      → Debilitado → Inconsciente
Fatigado   → Exausto    → Inconsciente
```

## Condições que compõem outras

Várias condições aplicam outras. Ao modelar, elas precisam ser resolvidas em cascata para os efeitos não se perderem:

| Condição | Aplica também |
| --- | --- |
| Agarrado | desprevenido, imóvel |
| Cego | desprevenido, lento |
| Enredado | lento, vulnerável |
| Exausto | debilitado, lento, vulnerável |
| Fatigado | fraco, vulnerável |
| Inconsciente | indefeso |
| Indefeso | desprevenido (com –10 na Defesa no lugar do –5) |
| Paralisado | imóvel, indefeso |
| Petrificado | inconsciente |
| Surpreendido | desprevenido |
| Morrendo | inconsciente |

## Notas para a implementação

- **Nem toda condição é automatizável.** As mecânicas (penalidade de dados, Defesa, deslocamento, dano recorrente) entram no motor; as narrativas (Apavorado "deve fugir", Fascinado "só observa", Doente) ficam como texto na ficha. Marcar isso no dado, para a UI saber o que exibe e o que aplica.
- **Machucado e Morrendo são derivadas dos PV**, não escolhidas pelo jogador: o motor liga e desliga sozinho a partir do PV atual.
- **Alquebrado** é a única que altera custo de recurso (+1 PE) — precisa entrar no cálculo de disponibilidade de ritual, não só na exibição.
- **Desprevenido** aparece em muitas cascatas; vale ser um efeito único referenciado, não copiado.
