# Efeitos ativos — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR. Cap. 3, o Bárbaro: Fúria (pág. 48, linhas 3643-3672), Fúria Implacável (pág. 49, linhas 3733-3742), Fúria Persistente (pág. 49, linhas 3743-3746), Frenesi (pág. 49, linhas 3770-3776), Fúria Inconsciente (pág. 49, linhas 3778-3781) e os totens do Guerreiro Totêmico (pág. 50, linhas 3842-3857 e 3890-3905); Cap. 8, a duração dos descansos (pág. 188, linhas 16797-16798 e 16812-16813); Cap. 10, "Combinando Efeitos Mágicos" (pág. 207, linhas 18487-18498).
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt`. É a **fonte da verdade documental** dos efeitos ligados do modo de jogo (Fase 2, onda `efeitos-ativos`; desenho em `docs/fase2-desenho-tecnico.md`). A página citada é a impressa no pt-BR (o número logo depois do marcador `PAGINA` do extrato: marcador + 1 até o 188, + 2 a partir do 189).
>
> As seções 1 a 4 são regra do livro, com as decisões do dono. A seção 5 traz as notas de implementação e **não** é regra. A seção 6 lista o que fica em aberto.

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
- **O fim:** cair a 0 PV, aplicar o Inconsciente ou morrer por qualquer caminho (o `toDead`: a morte instantânea, a exaustão 6, o terceiro fracasso) encerra a fúria, com aviso e a exaustão do Frenesi. O fim pelo turno sem ataque nem dano é lembrete (o app não conta turnos): a seção Efeitos ativos o mostra, e o Novo turno (onda `turno`) também o usará; a Fúria Persistente o tira. O fim pelo descanso é declarado (`endsOn` 'shortRest' e 'longRest') e sai no começo do descanso (`endTogglesOnRest`), com aviso e na prévia dos dois painéis; se o Frenesi levar à exaustão 6, o descanso não conclui e diz para encerrar a fúria antes. Na seção, além da ação bônus "Encerrar a fúria" (que recusa quem não pode agir), o "Já acabou" (sem gastar ação, `deactivateToggle`) registra o fim que não é ação, com a exaustão do Frenesi.
- **A reconciliação:** a ficha que não tem mais o efeito o desliga, com aviso; a que não tem mais a opção (trocou o caminho, baixou do 3º nível) mantém a fúria sem o Frenesi, também com aviso: a exaustão do fim deixa de vir.
- **O empate de FOR e DES** na arma de acuidade, na de monge e no golpe desarmado com Artes Marciais: em fúria, a linha fica na Força, que soma o Dano de Fúria sem custar nada (o ataque e o dano da arma são os mesmos); sem a fúria, o empate segue com a Destreza.
- **As defesas:** ligada, a resistência da Fúria (e a do Urso) entra na lista do painel de PV e no bloco Defesas. A do Urso, "exceto psíquico", precisa do tipo: o painel mostra um chip por tipo que ela alcança, e o "Outro tipo" fica para o psíquico e o dano sem tipo.
- **O voo da Águia** é linha da seção Efeitos ativos, com o deslocamento de caminhada do jogo; o app não tem deslocamento de voo nos vitais.
- **A Fúria Implacável** (leva `ajustes-leva-1`, 2026-10-30) é modificador da Fúria (`toggleModifiers`): declara o teste para ficar com 1 PV (`zeroHpSave`: atributo, CD de partida, quanto ela sobe por uso, o descanso que a volta e a página). Os usos desde o último descanso moram em `PlayState.restCounters` (`{}` por padrão, sem subir a versão). Cair a 0 PV em fúria sem morrer acontece como sempre (a fúria acaba, com o Frenesi) e traz o aviso com a CD e a receita do TR; o "Passei: fico com 1 PV" desfaz a queda e reaplica o mesmo dano terminando em 1 PV (`applyDamageDroppingToOneHp(…, 'save')`, o caminho da Resistência Implacável), ainda em fúria, e conta o uso. A receita sai do estado de antes do dano (`getZeroHpSaveGuide(draft, stateBefore, …)`, com o topo do desfazer, de onde o "Passei" reaplica): quem passa não caiu, então o teste é feito em fúria e na exaustão de antes — o Furioso na exaustão 2 que cai em Frenesi não rola com a desvantagem da exaustão 3 (correção da revisão, 2026-10-30). Com a Resistência Implacável do meio-orc, as duas ofertas aparecem, à escolha. O descanso curto ou longo zera o contador, com o aviso "a CD volta a 10"; a ficha que perde a característica (o nível baixou no criador) perde o contador na reconciliação, como o gasto do recurso que ela não tem, e a CD não volta alta com a característica de volta.

## 6. Pontos em aberto

- **A falha no teste da Fúria Implacável conta como uso?** "Cada vez que você utilizar essa característica após a primeira, a CD aumenta em 5" (linhas 3740-3741): o texto não diz se usar é fazer o teste ou passar nele. Hoje o app só conta quem passa (o "Passei"); quem falha não registra nada, e a próxima CD fica a mesma. Levado ao dono, com a recomendação da revisão: contar a tentativa ("você pode realizar um teste", linha 3737), com um "Falhei" no aviso que soma o uso sem mudar o PV, no mesmo passo do desfazer.
- **A oferta quando a própria queda mata** (linhas 3736-3738, "e não morrer"): o Furioso 11 em Frenesi na exaustão 5 que cai a 0 PV morre pela exaustão 6 que o fim da fúria traz, e o aviso oferece o teste mesmo assim. Ver o Ponto em aberto 29 de `regras-dano-e-morte.md`, que vale também para a Resistência Implacável.

Decididos em 2026-10-30 (pelo texto do livro) e feitos na leva `ajustes-leva-1`:
- **A fúria na morte que não passa pelo Inconsciente** (a instantânea e a da exaustão 6): acaba, como na queda (seção 1).
- **A Fúria Implacável** entrou antes da onda `recursos-completos` (seções 2.4 e 5).
- **As Auras de Coragem (paladino 10, pág. 111, linhas 9978-9981) e de Devoção (Juramento de Devoção 7, pág. 112, linhas 10105-10108)** valem como imunidade a condição do próprio paladino, só enquanto ele estiver consciente; os aliados ficam fora, porque o app é a ficha individual (`regras-dano-e-morte.md`, "Resistências e vulnerabilidades do personagem").
