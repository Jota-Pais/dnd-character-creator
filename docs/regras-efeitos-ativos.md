# Efeitos ativos — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR. Cap. 3, o Bárbaro: Fúria (pág. 48, linhas 3643-3672), Fúria Implacável (pág. 49, linhas 3733-3742), Fúria Persistente (pág. 49, linhas 3743-3746), Frenesi (pág. 49, linhas 3770-3776), Fúria Inconsciente (pág. 49, linhas 3778-3781) e os totens do Guerreiro Totêmico (pág. 50, linhas 3842-3857 e 3890-3905); Cap. 8, a duração dos descansos (pág. 188, linhas 16797-16798 e 16812-16813); Cap. 10, "Combinando Efeitos Mágicos" (pág. 207, linhas 18487-18498); as magias e ações recebidas da seção 7 (Cap. 9 e 11, cada uma com as linhas dela).
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt`. É a **fonte da verdade documental** dos efeitos ligados do modo de jogo (Fase 2, onda `efeitos-ativos`; desenho em `docs/fase2-desenho-tecnico.md`). A página citada é a impressa no pt-BR (o número logo depois do marcador `PAGINA` do extrato: marcador + 1 até o 188, + 2 a partir do 189).
>
> As seções 1 a 4 e 7 são regra do livro, com as decisões do dono. A seção 5 traz as notas de implementação e **não** é regra. A seção 6 lista o que fica em aberto.

## 1. Fúria (pág. 48, linhas 3643-3672)

> "Em batalha, você luta com uma ferocidade primitiva. No seu turno, você pode entrar em fúria com uma ação bônus."

- **Entrar:** ação bônus, no seu turno. Gasta um uso de Fúria; "quando você tiver usado a quantidade de fúrias mostrada para o seu nível de bárbaro [...] você precisará terminar um descanso longo antes de poder entrar em fúria novamente". No 20º nível, os usos são ilimitados (coluna Fúrias da tabela O Bárbaro).
- **Benefícios, "se você não estiver vestindo uma armadura pesada"** (linhas 3647-3658):
  - vantagem em testes de Força e testes de resistência de Força;
  - bônus nas jogadas de dano "quando você desferir um ataque com arma corpo-a-corpo usando Força" — a coluna Dano de Fúria (+2, +3 no 9º, +4 no 16º nível de bárbaro);
  - resistência contra dano de concussão, cortante e perfurante.
- **Fora dos benefícios** (linhas 3659-3661): "Se você for capaz de conjurar magias, você não poderá conjurá-las ou se concentrar nelas enquanto estiver em fúria." Vale também de armadura pesada.
- **Decidido (2026-10-29, decisão e):** entrar em fúria **encerra a concentração** (`docs/regras-rolagens-e-concentracao.md`, Pontos em aberto, item 14).
- **Duração e fim** (linhas 3662-3669): dura 1 minuto. "Ela termina prematuramente se você cair inconsciente ou se seu turno acabar e você não tiver atacado nenhuma criatura hostil desde seu último turno ou não tiver sofrido dano nesse período. Você também pode terminar sua fúria no seu turno com uma ação bônus."
- **Decidido (2026-10-30), pt-BR × inglês:** o fim prematuro segue o inglês — "if your turn ends and you haven't attacked a hostile creature since your last turn or taken damage since then": a fúria só termina **sem ataque E sem dano**. O pt-BR ("não tiver atacado [...] ou não tiver sofrido dano") se lê como "falta qualquer um dos dois". O caso está na lista pt-BR × inglês do CLAUDE.md e preso em `data/__tests__/bookText.test.ts`.
- **Fúria de armadura pesada** (decisão do desenho, linhas 3647-3661): entrar gasta o uso e não dá os benefícios; a restrição de conjuração e o fim da concentração valem assim mesmo, porque estão fora da lista.
- **O descanso dura mais que a fúria** (2026-10-30, na revisão da onda): o descanso curto tem "pelo menos 1 hora de duração" e o longo "pelo menos 8 horas" (pág. 188, linhas 16797-16798 e 16812-16813), e a fúria, 1 minuto. Concluído com ela ligada, ela acabou no começo dele: termina antes do que o descanso devolve, e a exaustão do Frenesi vem antes do −1 do descanso longo (pág. 292, linhas 28561-28563). Não é regra nova, é a conta das durações; o app não conta o tempo de jogo, mas o descanso é tempo de jogo declarado (a Nova sessão, que é tempo de relógio, continua sem desligar nada).
- **O fim que não é ação:** a duração e o fim prematuro acabam a fúria sem ação nenhuma; só "terminar sua fúria no seu turno" é ação bônus. Quem não pode agir (Atordoado, Paralisado) também tem a fúria acabando.
- **Decidido (2026-10-30), a morte também acaba a fúria:** a morte instantânea (o dano que sobra é igual ou maior que o PV máximo, pág. 199) e a exaustão 6 (pág. 292) não deixam o personagem inconsciente, mas o morto não continua em fúria. Toda morte encerra o que acaba ao cair inconsciente, com o mesmo aviso e a exaustão do Frenesi; reviver não traz a fúria de volta. Na morte a 0 PV (o terceiro fracasso, o dano a 0 PV), ela já tinha acabado na queda.

## 2. O que modifica a Fúria

### 2.1 Fúria Persistente (bárbaro 15, pág. 49, linhas 3743-3746)

> "A partir do 15° nível, sua fúria é tão brutal que ela só termina prematuramente se você cair inconsciente ou se você decidir terminá-la."

Sem o fim pelo turno sem ataque nem dano.

### 2.2 Frenesi (Caminho do Furioso 3, pág. 49, linhas 3770-3776)

> "Começando no momento que você escolhe esse caminho no 3° nível, você pode entrar num frenesi quando estiver em fúria. Se você desejar, pela duração da sua fúria, você pode realizar um único ataque corpo-a-corpo com arma, com uma ação bônus, em cada um de seus turnos após esse. Quando sua fúria acabar, você sofrerá um nível de exaustão (como descrito no apêndice A)."

O frenesi se escolhe ao entrar em fúria e custa um nível de exaustão quando ela acaba, por qualquer motivo.

### 2.3 Fúria Inconsciente (Caminho do Furioso 6, pág. 49, linhas 3778-3781)

> "A partir do 6° nível, você não pode ser enfeitiçado ou amedrontado enquanto estiver em fúria. Se você estava enfeitiçado ou amedrontado quando entrou em fúria, o efeito é suspenso pela duração da fúria."

Fora dos benefícios da Fúria: vale também de armadura pesada.

### 2.4 Fúria Implacável (bárbaro 11, pág. 49, linhas 3733-3742)

> "Se você cair para 0 pontos de vida enquanto estiver em fúria e não morrer, você pode realizar um teste de resistência de Constituição CD 10. Se você for bem sucedido, você volta para 1 ponto de vida ao invés disso. Cada vez que você utilizar essa característica após a primeira, a CD aumenta em 5. Assim que você terminar um descanso curto ou longo a CD volta para 10."

- **Quando:** cair a 0 PV em fúria, sem morrer: a morte instantânea fica de fora, e quem já está a 0 PV não "cai". Fora dos benefícios da Fúria: vale também de armadura pesada.
- **Decidido (2026-10-30), quem passa não caiu:** fica com 1 PV, e nada do que a queda faz acontece — a fúria continua, sem o Caído, sem largar o que segura e sem a exaustão do Frenesi. Não é preciso escolher a ordem entre o fim da fúria a 0 PV e o teste.
- **A CD:** 10 no primeiro uso, mais 5 a cada uso depois dele (15, 20…); volta a 10 ao terminar um descanso curto ou longo.
- **Decidido (2026-10-30), a falha também é uso:** "você pode realizar um teste" (linha 3737) é o uso; quem falha também usou a característica, e a próxima CD sobe 5. A queda fica como estava.
- **A Aura de Proteção no teste** (paladino 6, pág. 111, linhas 9969-9975: "Você deve estar consciente para garantir esse bônus"): o bárbaro 11 / paladino 6 faz o teste com a aura no número. Não é decisão nova: quem passa não caiu, então o teste é feito no estado de antes da queda — ainda em fúria e na exaustão de antes, como acima, e também consciente —, e a aura entra no número dos TR do paladino consciente (seção 6). No estado de depois, a 0 PV, ela ficaria de fora (registrado na revisão da leva `ajustes-leva-2`, 2026-10-31, com teste).
- **Decidido (2026-10-30), a queda que mata pela exaustão do Frenesi:** o Furioso 11 em Frenesi na exaustão 5 que cai a 0 PV morre pela exaustão 6 que o fim da fúria traz. O teste é oferecido assim mesmo: quem passa não caiu, então a fúria não acaba, a exaustão não vem e a morte também não (o mesmo vale para a Resistência Implacável do meio-orc; Ponto em aberto 29 de `regras-dano-e-morte.md`).

### 2.5 Os totens do Guerreiro Totêmico (pág. 50)

Cada característica é uma escolha própria, "o mesmo animal [...] ou um diferente" (`CLAUDE.md`, Escolhas de progressão).

- **Totem Espiritual, 3º nível** (linhas 3842-3857):
  - **Águia:** "Quando estiver em fúria e não estiver vestindo uma armadura pesada, as outras criaturas terão desvantagem nas jogadas de ataque de oportunidade contra você e você pode usar a ação de Disparada como uma ação bônus no seu turno."
  - **Lobo:** "Quando estiver em fúria, seus amigos tem vantagem nas jogadas de ataque corpo-a-corpo realizadas contra qualquer criatura a 1,5 metro de você que seja hostil a você."
  - **Urso:** "Quando em fúria, você adquire resistência a todos os tipos de dano, exceto dano psíquico." Sem cláusula de armadura: vale também de armadura pesada (decisão do desenho).
- **Aspecto da Besta, 6º nível:** não depende da fúria (a capacidade de carga do Urso fica para a onda do inventário).
- **Sintonia Totêmica, 14º nível** (linhas 3890-3905):
  - **Águia:** "Quando estiver em fúria, você adquire um deslocamento de voo igual ao seu deslocamento de caminhada. Esse benefício funciona apenas em pequenas explosões: você cai se terminar seu turno no ar e não tiver nada em que possa se agarrar."
  - **Lobo:** "Quando estiver em fúria, você pode usar uma ação bônus no seu turno para derrubar uma criatura Grande ou menor no chão quando você atingi-la com um ataque corpo-a-corpo com arma."
  - **Urso:** "Quando estiver em fúria, qualquer criatura a até 1,5 metro de você que for hostil a você terá desvantagem nas jogadas de ataque contra outros alvos além de você ou outro personagem com essa característica. Um inimigo é imune a esse efeito se ele não puder ver ou ouvir você ou caso ele não possa ser amedrontado."

## 3. Combinando efeitos mágicos (pág. 207, linhas 18487-18498)

> "Os efeitos de diferentes magias se somam enquanto as durações dessas magias acontecem ao mesmo tempo. Os efeitos de magias iguais conjuradas múltiplas vezes, no entanto, não se somam. Ao invés disto, o efeito mais potente – como o bônus mais elevado – dessas magias se aplica enquanto suas durações permanecerem sobrepostos."

Exemplo do livro: dois clérigos conjuram *bênção* no mesmo alvo; ele ganha o benefício de uma só. Para o app (decisão do desenho): o mesmo efeito fica ligado uma vez só; efeitos diferentes somam.

## 4. A ordem das vantagens

A vantagem da Fúria entra na mesma escada das condições (pág. 175): várias do mesmo lado valem uma, uma de cada lado anula (a Fúria e o Envenenado, num teste de Força, dão a jogada normal).

## 5. Notas de implementação (não é regra)

- **Onde mora o "ligado":** em `PlayState.activeEffects` (id, quando ligou e a opção), com `[]` por padrão no `sanitizePlayState`, sem subir a versão. O draft nunca guarda estado de jogo. A Nova sessão não desliga os efeitos ligados.
- **Declaração nos dados, sem cópia:** a Fúria declara o efeito (`effects.toggle`: rótulo, página, benefícios com `requires: noHeavyArmor`, fim ao cair inconsciente e o lembrete do fim prematuro) e as ações de ação bônus que o ligam e o encerram (`effects.actions`). O custo (1 uso de `rage`) mora só na ação; o texto e a duração, só na característica. O Dano de Fúria continua saindo do recurso `rage-damage`, e o condicional e a restrição de conjuração ganham a chave `toggle: 'rage'`. O Frenesi, a Fúria Inconsciente, a Fúria Persistente e os totens são `toggleModifiers` (os totens pela tabela das opções, `totem-warrior-totems.json`).
- **A condição é satisfeita pelo estado:** ligado e cumprido, o efeito entra no número, com a parcela nomeada (`WeaponAttack.includedBonuses`); a Revisão e o PDF não têm estado e continuam com a nota. A linha de Força soma o Dano de Fúria; a de Destreza (acuidade, Artes Marciais) continua nota; a arma de arremesso soma na linha corpo a corpo, com a nota de que arremessada não soma; o golpe desarmado de dano fixo soma ao total, e o piso 0 vale sobre o total (`regras-dano-e-morte.md`, decisões 25 e 27).
- **As recusas e os avisos:** entrar em fúria sem usos, morto, inconsciente ou incapacitado é recusado, sem gastar nada; já em fúria, também. Cada efeito colateral vem com aviso, no mesmo passo do desfazer: a concentração encerrada, a condição suspensa pela imunidade, a fúria de armadura pesada sem os benefícios, a exaustão do Frenesi. Em fúria, começar a concentração é recusado ("Em fúria você não pode se concentrar (pág. 48).") e a restrição de conjuração aparece em vigor (a caixa vermelha da aba Magia, a seção Concentração, as magias da aba Regras). Aplicar o Enfeitiçado ou o Amedrontado com a Fúria Inconsciente é recusado, e o já gravado fica suspenso.
- **O fim:** cair a 0 PV, aplicar o Inconsciente ou morrer por qualquer caminho (o `toDead`: a morte instantânea, a exaustão 6, o terceiro fracasso) encerra a fúria, com aviso e a exaustão do Frenesi. O fim pelo turno sem ataque nem dano é lembrete (o app não conta turnos): a seção Efeitos ativos o mostra, e o Novo turno (onda `turno`) o repete sem desligar a fúria; a Fúria Persistente o tira. A janela é a do livro, do fim do seu turno anterior ao fim do que acabou ("desde seu último turno", linhas 3662-3666): o ataque no seu turno (o "Usar" de Atacar e da outra mão) e o dano ou o ataque de reação antes dele. O app não vê o fim do turno: conta o dano aplicado e o ataque de oportunidade como vindos depois do seu turno, e o Novo turno os leva ao seguinte (`TurnState.afterTurn` → `beforeTurn`). O limite está no próprio lembrete: o dano sofrido durante o seu turno conta para o próximo, e quem o sofreu sabe que a fúria continua. O fim pelo descanso é declarado (`endsOn` 'shortRest' e 'longRest') e sai no começo do descanso (`endTogglesOnRest`), com aviso e na prévia dos dois painéis; se o Frenesi levar à exaustão 6, o descanso não conclui e diz para encerrar a fúria antes. Na seção, além da ação bônus "Encerrar a fúria" (que recusa quem não pode agir), o "Já acabou" (sem gastar ação, `deactivateToggle`) registra o fim que não é ação, com a exaustão do Frenesi.
- **A reconciliação:** a ficha que não tem mais o efeito o desliga, com aviso; a que não tem mais a opção (trocou o caminho, baixou do 3º nível) mantém a fúria sem o Frenesi, também com aviso: a exaustão do fim deixa de vir.
- **O empate de FOR e DES** na arma de acuidade, na de monge e no golpe desarmado com Artes Marciais: em fúria, a linha fica na Força, que soma o Dano de Fúria sem custar nada (o ataque e o dano da arma são os mesmos); sem a fúria, o empate segue com a Destreza.
- **As defesas:** ligada, a resistência da Fúria (e a do Urso) entra na lista do painel de PV e no bloco Defesas. A do Urso, "exceto psíquico", precisa do tipo: o painel mostra um chip por tipo que ela alcança, e o "Outro tipo" fica para o psíquico e o dano sem tipo.
- **O voo da Águia** é linha da seção Efeitos ativos, com o deslocamento de caminhada do jogo; o app não tem deslocamento de voo nos vitais.
- **A Fúria Implacável** (leva `ajustes-leva-1`, 2026-10-30) é modificador da Fúria (`toggleModifiers`): declara o teste para ficar com 1 PV (`zeroHpSave`: atributo, CD de partida, quanto ela sobe por uso, o descanso que a volta e a página). Os usos desde o último descanso moram em `PlayState.restCounters` (`{}` por padrão, sem subir a versão). Cair a 0 PV em fúria sem morrer acontece como sempre (a fúria acaba, com o Frenesi) e traz o aviso com a CD e a receita do TR; o "Passei: fico com 1 PV" desfaz a queda e reaplica o mesmo dano terminando em 1 PV (`applyDamageDroppingToOneHp(…, 'save')`, o caminho da Resistência Implacável), ainda em fúria, e conta o uso; o "Falhei", ao lado dele (leva `ajustes-leva-2`), desfaz e reaplica o mesmo dano com a falha (`DamageInput.zeroHpSaveFailed`), que conta o uso sem mudar o PV, no mesmo passo do desfazer — o teste não é oferecido de novo, e a Resistência Implacável continua, com a falha no dano dela. A queda que mata pela exaustão do Frenesi traz as duas ofertas com a frase "Ficando com 1 PV, você não cai, e a morte pela exaustão do Frenesi também não acontece.". A receita sai do estado de antes do dano (`getZeroHpSaveGuide(draft, stateBefore, …)`, com o topo do desfazer, de onde o "Passei" reaplica): quem passa não caiu, então o teste é feito em fúria e na exaustão de antes — o Furioso na exaustão 2 que cai em Frenesi não rola com a desvantagem da exaustão 3 (correção da revisão, 2026-10-30) —, e consciente: a Aura de Proteção do bárbaro 11 / paladino 6 entra no número (seção 2.4). Com a Resistência Implacável do meio-orc, as duas ofertas aparecem, à escolha. O descanso curto ou longo zera o contador, com o aviso "a CD volta a 10"; a ficha que perde a característica (o nível baixou no criador) perde o contador na reconciliação, como o gasto do recurso que ela não tem, e a CD não volta alta com a característica de volta.

## 6. Pontos em aberto

Nenhum em aberto: os da leva 2 foram decididos pelo dono em 2026-10-30, todos pela recomendação.

Decididos em 2026-10-30 (pela recomendação) e feitos na leva `ajustes-leva-2`:
- **A falha no teste da Fúria Implacável conta como uso** ("Cada vez que você utilizar essa característica após a primeira, a CD aumenta em 5", linhas 3740-3741; "você pode realizar um teste", linha 3737): o "Falhei", no mesmo aviso do "Passei", soma o uso no contador sem mudar o PV, no mesmo passo do desfazer (seções 2.4 e 5).
- **A oferta quando a própria queda mata** (linhas 3736-3738, "e não morrer"): o Furioso 11 em Frenesi na exaustão 5 que cai a 0 PV morre pela exaustão 6 que o fim da fúria traz. As ofertas continuam (a Fúria Implacável e a Resistência Implacável), e o aviso diz que, ficando com 1 PV, a morte pela exaustão do Frenesi também não acontece — coerente com "quem passa não caiu" (seção 2.4; Ponto em aberto 29 de `regras-dano-e-morte.md`).
- **O Auxílio Divino na Rede** (linhas 20519-20521, "seus ataques com arma causam 1d4 de dano radiante extra ao atingirem"): a Rede é arma e acerta sem causar dano (pág. 150, linhas 13476-13488, e a tabela de armas, linha 13548); com o Auxílio Divino ligado, o acerto causa o 1d4 radiante, e a linha da Rede ganha dano só com o dado a mais (seção 7.8).
- **O mínimo 0 com dano extra de outro tipo** (item 14 e decisões 25 e 27 de `regras-dano-e-morte.md`): o golpe desarmado com Força 6-7 dá 1 − 2 = −1 de concussão; com o Auxílio Divino, o piso 0 é **por parcela** (0 concussão + 1d4 radiante), porque o pipeline aplica as defesas por tipo (item 12) e o painel de PV recebe as parcelas por tipo. Era o que o app já fazia (seção 7.8).
- **A ordem do bônus e do dobro no deslocamento** (Velocidade, linhas 28211-28212, "o deslocamento do alvo é dobrado"; Passos Longos, linhas 25906-25907, "O deslocamento do alvo aumenta em 3 metros"): o livro não diz se o bônus entra antes ou depois do dobro. Fica **bônus → dobro → metade** (9 m de base com os dois: (9 + 3) × 2 = 24 m), o que o app já fazia: o bônus de Passos Longos é do mesmo tipo dos que a ficha já soma ao deslocamento antes de tudo (o Movimento Rápido do bárbaro, o Movimento sem Armadura do monge), a Velocidade dobra o deslocamento que o personagem tem, e a metade da Exaustão 2 vem por último (seção 7.7).
- **A Aura de Proteção** (paladino 6, pág. 111, linhas 9969-9975: "Você deve estar consciente para garantir esse bônus"): no jogo, com o paladino consciente — o mesmo critério das Auras de Coragem e de Devoção, abaixo —, o bônus (modificador de Carisma, mínimo +1) entra no número dos TR do próprio paladino, com a parcela nomeada no "de onde vem" (o da concentração também); inconsciente (a 0 PV, com o Inconsciente gravado ou morto), fica a nota. A Revisão e o PDF, sem estado, continuam com a linha. Os aliados ficam fora, como nas outras auras.

Decididos em 2026-10-30 (pelo texto do livro) e feitos na leva `ajustes-leva-1`:
- **A fúria na morte que não passa pelo Inconsciente** (a instantânea e a da exaustão 6): acaba, como na queda (seção 1).
- **A Fúria Implacável** entrou antes da onda `recursos-completos` (seções 2.4 e 5).
- **As Auras de Coragem (paladino 10, pág. 111, linhas 9978-9981) e de Devoção (Juramento de Devoção 7, pág. 112, linhas 10105-10108)** valem como imunidade a condição do próprio paladino, só enquanto ele estiver consciente; os aliados ficam fora, porque o app é a ficha individual (`regras-dano-e-morte.md`, "Resistências e vulnerabilidades do personagem").

## 7. Efeitos recebidos: magias e ações (onda `efeitos-recebidos`, 2026-10-30)

O catálogo `data/active-effects.json` traz as magias e ações que se marcam em você. Cada entrada declara só o que o efeito faz, com a página e as linhas do extrato; o nome, o texto, a duração, o alcance e a concentração são os de `spells.json`. Qualquer ficha liga a que um aliado conjura nela; as de alcance Pessoal (Escudo Arcano, Auxílio Divino), só quem as conhece (decisão do desenho, "Respondidas no desenho").

- **Lacuna conhecida até a onda `magias-concedidas`:** o "conhece" é o de `getKnownSpells`, que não traz as magias sempre preparadas das características ("Quando você ganha uma magia de domínio, você sempre a tem preparada", linhas 5313-5318). O clérigo do Domínio da Guerra 1 não vê o Auxílio Divino (linhas 5601-5603), e a magia de concentração que só a característica dá não pergunta quem conjurou: a Bênção do Domínio da Vida (linhas 5852-5854), o Escudo da Fé da Guerra, a Perdição do Juramento de Vingança 3 (linhas 10272-10274) e a Velocidade do Círculo da Terra (Pradaria) 5 (linhas 6349-6351) ficam gravadas como de aliado. A onda `magias-concedidas` faz o `getCatalogToggles` ler as sempre preparadas; a preparada no jogo (o paladino que preparou o Auxílio Divino no dia sem escolhê-lo no criador) espera a `preparar-magias`.

### 7.1 Bênção (pág. 223, linhas 20595-20607)

> "Sempre que um alvo realizar uma jogada de ataque ou teste de resistência antes da magia acabar, o alvo pode jogar um d4 e adicionar o valor jogado ao ataque ou teste de resistência."

- **+1d4** nas jogadas de ataque e nos testes de resistência, com o d4 na fórmula ("1d20 + 5 + 1d4"), apesar do "pode": é sempre benéfico (decisão do desenho).
- Vale no **teste contra a morte**, pelo raciocínio da decisão 22 (Sortudo): o app pede o d4 quando o d20 não decide sozinho (o 1 e o 20 decidem).
- Concentração, até 1 minuto: de quem a conjurou.

### 7.2 Perdição (pág. 269, linhas 25990-26004)

> "Sempre que um alvo que falhou nessa resistência realizar uma jogada de ataque ou um teste de resistência antes da magia acabar, o alvo deve rolar um d4 e subtrair o valor rolado da jogada de ataque ou teste de resistência."

- **−1d4** nas mesmas jogadas da Bênção, inclusive o teste contra a morte; é obrigatória. Marcar a Perdição é dizer que você falhou no TR de Carisma.

### 7.3 Escudo Arcano (pág. 243, linhas 23192-23203)

> "Até o início do seu próximo turno, você recebe +5 de bônus na CA, incluindo contra o ataque que desencadeou a magia, e você não sofre dano de mísseis mágicos."

- **+5 de CA**, parcela própria; o "não sofre dano de mísseis mágicos" é linha. Alcance Pessoal.
- Acaba no início do seu próximo turno (`endsOn: 'startOfYourTurn'`): o Novo turno da aba Ações o encerra, com aviso (onda `turno`); o "Já acabou" continua para quem não usa o checklist.

### 7.4 Armadura Arcana (pág. 220, linhas 20244-20255)

> "Você toca uma criatura voluntária que não esteja vestindo armadura [...]. A CA base do alvo se torna 13 + o modificador de Destreza dele. A magia acaba se o alvo colocar uma armadura [...]."

- **13 + DES** como fórmula de CA sem armadura: disputa a base com as das características, e fica a maior (pág. 14, "você escolhe qual usar").
- **Decidido (2026-10-30):** o escudo não encerra a magia e soma +2, como na Defesa sem Armadura do bárbaro; "colocar uma armadura" é a armadura de corpo (a tabela "Vestindo e Despindo uma Armadura", linhas 13327-13332, lista o escudo à parte). Com armadura vestida na ficha, a magia fica sem os benefícios (`requires: 'noArmor'`); vestir no jogo é da onda `armadura` (`endsOn: 'donArmor'`).
- Dura 8 horas: o descanso longo a encerra; o curto, não.

### 7.5 Escudo da Fé (págs. 243-244, linhas 23204-23216)

- **+2 de CA** pela duração (concentração, até 10 minutos, de quem conjurou).

### 7.6 Velocidade (pág. 289, linhas 28204-28219)

> "Até a magia acabar, o deslocamento do alvo é dobrado, ele ganha +2 de bônus na CA, ele tem vantagem em testes de resistência de Destreza e ganha uma ação adicional em cada um dos turnos dele. [...] Quando a magia acabar, o alvo não poderá se mover ou realizar ações até depois do seu próximo turno [...]."

- **Deslocamento dobrado**, **+2 de CA**, **vantagem nos TR de Destreza**; a ação a mais (só Atacar com um ataque com arma, Disparada, Desengajar, Esconder ou Usar um Objeto) é linha e entra no turno (onda `turno`): o efeito `extraTurnAction` lista as ações que ela aceita, o "Usar" da segunda ação do turno a gasta sem aviso quando ela ou a ação já feita é uma delas, e o checklist mostra o "+1".
- A letargia ao acabar o app não aplica: o aviso do fim a diz (`onEnd`), por qualquer motivo.
- Escudo da Fé + Velocidade: +4 de CA — magias diferentes somam (seção 3).

### 7.7 Passos Longos (pág. 267, linhas 25901-25907)

- **+3 m** no deslocamento (10 pés). **Decidido (2026-10-30, seção 6):** bônus → dobro → metade — somados antes do dobro da Velocidade, e a metade da Exaustão 2 por último (os efeitos ligados antes das condições). O livro não fixa a ordem. O Agarrado e o Impedido zeram assim mesmo: "não pode se beneficiar de qualquer bônus em seu deslocamento" (pág. 291).

### 7.8 Auxílio Divino (pág. 222, linhas 20514-20521)

> "Até o fim da magia, seus ataques com arma causam 1d4 de dano radiante extra ao atingirem."

- **+1d4 radiante** no dano de todo ataque com arma, como parcela de outro tipo ("1d8 + 3 cortante + 1d4 radiante"). Vale no golpe desarmado, que é ataque com arma sem ser arma (decisão a). Alcance Pessoal e concentração: é sempre sua, sustentada pela sua concentração.
- **Decidido (2026-10-30), a Rede:** é arma e acerta sem causar dano (pág. 150, linhas 13476-13488); com o Auxílio Divino, o acerto causa o 1d4 radiante, e a linha dela ganha dano só com o dado a mais ("1d4 radiante", sem o modificador do atributo; no crítico, "2d4 radiante").
- **Decidido (2026-10-30), o mínimo 0 é por parcela:** o golpe desarmado com Força 6-7 fica em "0 concussão + 1d4 radiante" — o piso 0 vale na concussão, e o 1d4 radiante é dano à parte (decisão 25 de `regras-dano-e-morte.md`).

### 7.9 Pele de Árvore (pág. 268, linhas 25943-25953)

> "[...] a CA do alvo não pode ser inferior a 16, independentemente do tipo de armadura que ela esteja vestindo."

- **Piso de 16** sobre a CA com tudo, escudo e Escudo Arcano incluídos: max(CA, 16), e os bônus não somam por cima do piso (decisão do desenho). No "de onde vem", a parcela que falta leva o nome da magia.

### 7.10 Esquivar (ação, pág. 194, linhas 17408-17414)

> "Até o começo do seu próximo turno, qualquer jogada de ataque contra você é feita com desvantagem se você puder ver o atacante e você tem vantagem em testes de Destreza. Você perde esse benefício se estiver incapacitado [...] ou se seu deslocamento cair para 0."

- **Decidido (2026-10-30), pt-BR × inglês:** vantagem nos **testes de resistência** de Destreza ("Dexterity saving throws"); o pt-BR diz "testes de Destreza". Na lista do CLAUDE.md e preso em `bookText.test.ts`.
- A desvantagem dos ataques contra você é linha (o jogador avisa o Mestre). Incapacitado (gravado ou derivado) ou com o deslocamento em 0, acaba sozinho, com aviso; a 0 PV, também (o Inconsciente incapacita).
- A ação Esquivar (aba Ações, `data/combat-actions.json`, onda `turno`) o liga e o Novo turno o encerra. **Decidido (2026-10-30):** com o deslocamento já em 0 (o Agarrado, o Impedido, a Exaustão 5), o benefício não vem — ele se perde com o deslocamento em 0 —: a ação conta (marca o turno), o efeito não liga, e o aviso diz a regra com a página (Ponto em aberto 4 de `regras-acoes-em-combate.md`). A Defesa Paciente do monge, que remete a ela, chega com a onda `acoes-marciais`.

### 7.11 Destruição Divina Aprimorada (paladino 11, pág. 111, linhas 9984-9991)

- **+1d8 radiante** no dano de toda **arma** corpo a corpo, incondicional: está no número na Revisão, no PDF e no jogo. O golpe desarmado fica de fora (decisão c, pelo inglês). A azagaia soma na linha corpo a corpo, e arremessada não soma (o ataque arremessado é à distância).
- A ficha salva de paladino 11+ muda de número, e o aviso de correção o diz (decisão 10.2.23).

### 7.12 O crítico (pág. 198, linhas 17752-17764)

> "Jogue todos os dados de dano duas vezes e some todos eles. [...] Se o ataque envolve outros dados de dano, como a característica Ataque Furtivo, do ladino, ele joga esses dados duas vezes também."

- Os dados a mais do dano dobram com os da arma ("2d8 + 3 cortante + 2d4 radiante"); o fixo não. A folha do crítico deixa desmarcar um grupo (item 6 de `regras-dano-e-morte.md`).

### 7.13 Quem conjura mantém a concentração

- A magia de concentração que você conjurou em si (`sustainedByConcentration`) começa a sua concentração nela e acaba junto com ela, por qualquer motivo: fim voluntário, dano, incapacitação, outra concentração (pág. 205). O contrário também vale, porque a concentração dura no máximo o que a magia dura ("Também é descrito na própria magia quanto tempo você pode manter sua concentração nela", linhas 18299-18302): a magia própria que acaba — o "Já acabou", o descanso — leva junto a concentração nela, com o aviso (correção da revisão, 2026-10-30).
- A concentração começada pela seção Concentração com o nome da magia digitado ("Bênção"; sem acento e sem maiúscula, também) é a mesma do "Eu conjurei em mim": ganha o id da magia, sem o aviso de duas magias nem novo começo.
- A recebida de um aliado não depende da sua concentração: quem a mantém é ele, e ela só sai à mão.
- A magia recebida liga a 0 PV (a Bênção nos testes contra a morte): o app só registra o que a mesa já fez. A Fúria, que você liga, continua recusando o inconsciente. A de alcance Pessoal sem concentração (o Escudo Arcano) também liga a 0 PV ou incapacitado: ela não acaba com a incapacitação, e a conjurada antes de cair (a reação ao ataque que derrubou) se registra depois. A de alcance Pessoal com concentração (o Auxílio Divino) começa a concentração, que recusa inconsciente, incapacitado e em fúria.
- O descanso encerra a magia que dura no máximo ele, pela conta das durações de `spells.json` (a rodada tem 6 segundos, pág. 191): a Bênção nos dois descansos; a Armadura Arcana (8 horas) só no longo, que tem pelo menos 8 horas (pág. 188). É o mesmo raciocínio da Fúria (seção 1).
- A reconciliação que tira a magia que a ficha não conhece mais (o Auxílio Divino desmarcado no criador) não encerra a concentração nela: a ficha mudou, a magia na mesa não acabou, e a concentração é só o rótulo, que a ficha continua mostrando.
