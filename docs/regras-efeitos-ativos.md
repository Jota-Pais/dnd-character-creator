# Efeitos ativos — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR. Cap. 3, o Bárbaro: Fúria (pág. 48, linhas 3643-3672), Fúria Persistente (pág. 49, linhas 3743-3746), Frenesi (pág. 49, linhas 3770-3776), Fúria Inconsciente (pág. 49, linhas 3778-3781) e os totens do Guerreiro Totêmico (pág. 50, linhas 3842-3857 e 3890-3905); Cap. 10, "Combinando Efeitos Mágicos" (pág. 207, linhas 18487-18498).
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

### 2.4 Os totens do Guerreiro Totêmico (pág. 50)

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
- **O fim:** cair a 0 PV ou aplicar o Inconsciente encerra a fúria, com aviso. O fim pelo turno sem ataque nem dano é lembrete (o app não conta turnos): a seção Efeitos ativos o mostra, e o Novo turno (onda `turno`) também o usará; a Fúria Persistente o tira.
- **As defesas:** ligada, a resistência da Fúria (e a do Urso) entra na lista do painel de PV e no bloco Defesas. A do Urso, "exceto psíquico", precisa do tipo: o painel mostra um chip por tipo que ela alcança, e o "Outro tipo" fica para o psíquico e o dano sem tipo.
- **O voo da Águia** é linha da seção Efeitos ativos, com o deslocamento de caminhada do jogo; o app não tem deslocamento de voo nos vitais.

## 6. Pontos em aberto

- **Fúria até a morte instantânea:** o livro encerra a fúria quando você cai inconsciente; a morte instantânea (o dano que sobra é igual ou maior que o PV máximo, pág. 199) não deixa o personagem inconsciente, e o app não encerra a fúria nela. Morto, nenhuma ação se usa (a recusa vale), e o "Fui revivido" volta com a fúria ligada: encerre na seção Efeitos ativos.
