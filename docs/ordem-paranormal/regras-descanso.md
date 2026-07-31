# Interlúdio e descanso — Ordem Paranormal v10.1

Fonte: Capítulo 4 (Combate), seção Interlúdio, livro básico pt-BR, p. 92–93. Digitalizado para o modo de jogo (ficha viva).

## Cena de interlúdio

Cenas em que os personagens não estão investigando nem combatendo. É onde se recupera.

- O **mestre** define quando começa e termina. Não tem duração fixa em horas.
- Geralmente envolve descansar em local seguro (esconderijo, hotel).
- **Personagens ao relento e sem acampamento não podem fazer interlúdio.**
- Os jogadores podem pedir um interlúdio; o mestre decide se é possível e quais condições estão disponíveis. Forçar muitos pode aumentar a urgência das cenas seguintes.

> **Durante um interlúdio, cada personagem pode fazer até DUAS das ações a seguir.**

## As 7 ações de interlúdio

| Ação | Efeito | Limite |
| --- | --- | --- |
| **Alimentar-se** | Refeição especial; escolhe um prato (ver abaixo). | 1× por interlúdio, e só havendo onde conseguir a refeição |
| **Dormir** | Recupera PV e PE (ver abaixo). | 1× por interlúdio |
| **Exercitar-se** | +1d6 num teste de Agilidade, Força ou Vigor até o fim da missão. Acumula até o valor de **Vigor** bônus; só um por teste. | — |
| **Ler** | +1d6 num teste de Intelecto ou Presença até o fim da missão. Acumula até o valor de **Intelecto** bônus; só um por teste. | — |
| **Manutenção** | Conserta um item quebrado, recuperando os PV dele ao máximo. | — |
| **Relaxar** | Como dormir, mas recupera **Sanidade**. | 1× por interlúdio |
| **Revisar Caso** | Teste de perícia apropriada para recuperar uma pista perdida de uma cena de investigação. | pode repetir no mesmo interlúdio |

## Dormir

Recupera PV **e** PE conforme o **limite de PE** (Tabela 1.2 — já implementado em `getPeLimit(nex)`) e a condição de descanso:

| Condição | Multiplicador | Exemplo |
| --- | --- | --- |
| **Precária** | ½ | dentro do carro, tenda de acampamento |
| **Normal** | ×1 | quarto simples, cama e banheiro funcionais |
| **Confortável** | ×2 | hotel ou pousada três estrelas |
| **Luxuosa** | ×3 | hotel de luxo, tratamento vip, spa |

Exemplo do livro: personagem de **NEX 35% (limite de PE 7)** em descanso normal recupera **7 PV e 7 PE**.

O acesso às condições depende do **limite de crédito** e de onde o grupo está — um personagem numa cidadezinha provavelmente não alcança a luxuosa, mesmo com crédito alto.

## Relaxar

Funciona como dormir, **exceto que recupera Sanidade** em vez de PV e PE.

- Para **cada** personagem que relaxar no mesmo interlúdio, **todos** os participantes recuperam **+1 ponto de Sanidade** adicional.

## Pratos (ação Alimentar-se)

| Prato | Benefício |
| --- | --- |
| **Favorito** | Se relaxar neste interlúdio, +2 pontos de Sanidade adicionais |
| **Nutritivo** | Se dormir neste interlúdio, aumenta a recuperação de **PV** em um degrau |
| **Energético** | Se dormir neste interlúdio, aumenta a recuperação de **PE** em um degrau |
| **Rápido** | Se revisar caso neste interlúdio, +5 no teste de perícia |

"Um degrau" é literal: confortável (×2) vira ×3. O livro dá o exemplo — *"recuperação confortável, ou dobrada, por exemplo, se torna triplicada"*.

## Notas para a implementação

- A recuperação é **derivada**, não digitada: `limite de PE × multiplicador de qualidade`, com o degrau extra do prato aplicado separadamente a PV e a PE. Nutritivo e Energético afetam trilhas diferentes, então os multiplicadores de PV e PE precisam ser calculados em separado.
- **Arredondamento:** a recuperação precária é metade, e a regra geral do livro arredonda divisões **para baixo** (ver [regras-combate.md](regras-combate.md)).
- Exercitar-se e Ler geram **bônus acumulados que duram até o fim da missão** — não são consumidos no interlúdio. Se entrarem no app, precisam de estado próprio na sessão (um estoque de +1d6, com teto por Vigor/Intelecto e gasto de um por teste), não só um número na ficha.
- O teto de duas ações por interlúdio e os limites de "1× por interlúdio" são regra de estado, não de exibição: o app deve bloquear a terceira ação e o segundo "dormir".
- Nada aqui é automático — quem declara o interlúdio é o mestre. A UI oferece, o jogador confirma.
