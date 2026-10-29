# Conjuração em jogo — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR. Cap. 10 "Conjurando Magias", págs. 203-204 (extrato, linhas 18086-18228); Cap. 6 "Multiclasse", págs. 165-166 (linhas 14638-14644 e 14791-14817); Cap. 3, a Conjuração de Ritual de cada classe: bardo (pág. 53, linhas 4136-4138), clérigo (pág. 65, linhas 5296-5298), druida (pág. 73, linhas 6133-6135) e mago (pág. 96, linhas 8415-8418); Cap. 11, o texto de um truque que escala (*raio de fogo*, pág. 274, linhas 26584-26586).
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt`. É a **fonte da verdade documental** do grimório jogável da Fase 2 do modo de jogo (`docs/estudo-dnd-beyond-modulo-jogo.md`, seção 9). A página citada é a impressa no pt-BR (o número logo depois do marcador `PAGINA` do extrato); onde uma decisão cita a página do original em inglês, isso vem dito.
>
> Fica em outro doc o que já estava digitalizado: concentração, tempos de conjuração maiores e o ritual como tempo de conjuração (`docs/regras-rolagens-e-concentracao.md`, seção 10); espaços de magia e Magia de Pacto na multiclasse (`docs/regras-multiclasse.md`); a ação Conjurar uma Magia e o que é ação bônus e reação (`docs/regras-acoes-em-combate.md`).
>
> As seções 1 a 4 são regra do livro. A seção 5 traz as notas de implementação e **não** é regra. A seção 6 lista o que o dono precisa ver.

## 1. Nível da magia e truques (pág. 203)

- **Nível da magia** (linhas 18086-18098): cada magia tem um nível de 0 a 9. Os **truques** são de nível 0. "Nível de magia e nível do personagem não correspondem diretamente": em geral o personagem precisa estar no 17º nível, e não no 9º, para usar uma magia de 9º nível.
- **Truque** (linhas 18167-18173): "Um truque é uma magia que pode ser conjurada sem limite, sem precisar usar o espaço de uma magia e sem precisar ser preparada." O nível de magia de um truque é 0.

## 2. Truques que escalam: pelo nível do personagem

- **O texto do truque** (Cap. 11). Exemplo, *raio de fogo* (pág. 274, linhas 26584-26586): "O dano dessa magia aumenta em 1d10 quando você alcança o 5° nível (2d10), 11° nível (3d10) e 17° nível (4d10)." O degrau é "quando você alcança o Nº nível", sem "nessa classe", que é como o livro escreve quando quer o nível na classe (ex.: a disciplina elemental do monge, linha 9473: "Quando você alcança o 5° nível nessa classe").
- **Nível de personagem** (pág. 165, linhas 14640-14644): "Seus níveis em todas as classes são somados para determinar seu nível de personagem. Por exemplo, se você tiver três níveis de mago e dois de guerreiro, você será um personagem de 5° nível."
- **Decidido (2026-10-29):** o truque escala pelo nível do **personagem**, também na multiclasse (decisão do dono, que cita a p. 164 do original). Exemplo: um guerreiro 4 / mago 1 conjura *raio de fogo* com 2d10.
- A seção Conjuração da multiclasse no pt-BR (pág. 166, linhas 14791-14817) não fala de truques: diz só que as magias conhecidas e preparadas são determinadas por classe, como se o personagem fosse de classe única, e que cada magia usa a habilidade de conjuração da classe a que está associada. Ver Pontos em aberto, item 1.

## 3. Tempo de conjuração (pág. 204)

"Muitas magias requerem uma simples ação para serem conjuradas, mas algumas magias requerem ações bônus, uma reação, ou muito mais tempo para ser conjurada" (linhas 18200-18203).

### 3.1 Uma ação

É o caso comum: em combate, a magia de 1 ação gasta a ação do turno, pela ação Conjurar uma Magia (`docs/regras-acoes-em-combate.md`, seção 6.3).

### 3.2 Ação bônus (linhas 18204-18210)

> "Uma magia conjurada com uma ação bônus é especialmente veloz. Você deve usar uma ação bônus no seu turno para conjurar a magia, presumindo que já não tenha feito uso da ação bônus nesse turno. Você não pode conjurar outra magia durante o mesmo turno, exceto se for um truque que tenha tempo de conjuração de 1 ação."

- Gasta a **ação bônus** do turno; quem já usou a ação bônus no turno não a conjura.
- **Decidido (2026-10-29):** no turno em que conjura uma magia de ação bônus, o personagem só pode conjurar, além dela, **um truque de 1 ação**.
- Pelo texto, a proibição é de "outra magia", qualquer que seja o tempo de conjuração dela: a magia de 1º nível ou superior de 1 ação e a magia de reação conjurada no próprio turno ficam de fora (outra de ação bônus já não cabe, porque a ação bônus foi gasta). A reação no turno de outra criatura é outro turno e não entra. Se a proibição alcança também a magia conjurada **antes** da de ação bônus no mesmo turno é o Ponto em aberto 2.

### 3.3 Reação (linhas 18211-18217)

> "Algumas magias podem ser conjuradas como uma reação. Essas magias levam uma fração de segundo para virem à tona e são conjuradas em resposta a algum evento. Se uma magia pode ser conjurada como uma reação, a descrição da magia diz exatamente quando você pode fazer isto."

- Gasta a **reação**: depois dela, nenhuma outra até o início do próximo turno do personagem (pág. 192; `docs/regras-acoes-em-combate.md`, seção 4).
- O gatilho vem no tempo de conjuração da própria magia. Em `spells.json`, as quatro magias de reação o trazem no campo: "1 reação, que você faz quando é atingido por um ataque ou alvo da magia mísseis mágicos" (*escudo arcano*), "1 reação, que você realiza quando vê uma criatura a até 18 metros conjurando uma magia" (*contramágica*), "1 reação, que você realiza quando você ou uma criatura a até 18 metros cair" (*queda suave*) e "1 reação, que você faz em resposta ao sofre dano de uma criatura a até 18 metros de você e que você possa ver" (*repreensão infernal*).

### 3.4 Tempos maiores

Minutos ou horas, inclusive o ritual: `docs/regras-rolagens-e-concentracao.md`, seção 10.4 (gasta a ação a cada turno, mantém a concentração; se ela quebrar, a magia falha e o espaço não é gasto).

## 4. Rituais

### 4.1 A regra geral (págs. 203-204, linhas 18174-18191)

- Uma magia com o descritor **ritual** pode ser conjurada pelas regras normais ou **como ritual**.
- O ritual leva **10 minutos a mais** que o tempo normal e **não gasta espaço de magia**; por isso **não pode ser conjurado em nível superior**.
- Para conjurar como ritual é preciso **uma característica que dê essa capacidade** ("o clérigo e o druida, por exemplo, possuem tal característica") e ter a magia **preparada ou na lista de magias conhecidas**, "a menos que a característica para o uso do ritual do personagem especifique o contrário, tal como acontece com o mago".

### 4.2 Por classe

| Classe | Pág. | Texto do pt-BR | O que vale |
| --- | --- | --- | --- |
| Bardo | 53 | "Você pode conjurar qualquer magia de bardo que você conheça como um ritual se ela possuir o descritor ritual." | As magias de bardo **conhecidas** com o descritor ritual. |
| Clérigo | 65 | "Você pode conjurar qualquer magia de clérigo que você conheça como um ritual se ela possuir o descritor ritual." | As magias de clérigo **preparadas** com o descritor ritual. O "que você conheça" é texto copiado do bardo; os dados seguem o inglês (CLAUDE.md, pt-BR × inglês; preso em `bookText.test.ts`). |
| Druida | 73 | "Você pode conjurar qualquer magia de druida que você conheça como um ritual se ela possuir o descritor ritual." | As magias de druida **preparadas** com o descritor ritual. Mesmo caso do clérigo. |
| Mago | 96 | "Você pode conjurar qualquer magia de mago como um ritual se ela possuir o descritor ritual, desde que a possua em seu grimório. Você não precisa ter essa magia preparada." | As magias de mago **do grimório** com o descritor ritual, **sem precisar prepará-las**. |

- As outras classes não têm Conjuração de Ritual na característica Conjuração (bruxo, feiticeiro, paladino, patrulheiro, Cavaleiro Arcano e Trapaceiro Arcano). Outras fontes de ritual, como o talento Conjurador de Ritual (pág. 169) e a invocação Livro de Segredos Antigos do bruxo (pág. 61), têm a regra no próprio texto e ficam fora desta digitalização.
- Na multiclasse, cada magia fica associada a uma classe (pág. 166, linhas 14812-14814): a característica de ritual de uma classe alcança as magias **daquela** classe, como o texto de cada uma diz ("magia de bardo", "magia de clérigo"...).

## 5. Notas de implementação (mapeamento pro app)

Não faz parte da regra do livro. Orienta o grimório jogável da Fase 2.

- **Tempo de conjuração nos dados:** `spells.json → castingTime` tem 13 valores. Classificação: "1 ação" (269), "1 ação bônus" (27), "1 reação, que…" (4, com o gatilho no texto) e os maiores ("1 minuto", "10 minutos", "1 hora", "8 horas", "12 horas", "24 horas"). O único valor composto, "1 ação ou 8 horas" (*ampliar plantas*), tem as duas formas. A classificação é um campo derivado ou declarado nos dados, nunca um `if` pelo nome da magia.
- **Magia de ação bônus (seção 3.2):** o estado do turno (o checklist leve da Fase 2, decisão 10.2.10) marca que uma magia de ação bônus foi conjurada; daí até o fim do turno, a tela avisa nas outras magias que só um truque de 1 ação pode ser conjurado. Como as outras restrições do modo de jogo, avisa com o motivo e a página, sem esconder a magia.
- **Truque que escala (seção 2):** o dado do truque sai do **nível de personagem** (`draft.level`), nunca do nível na classe; vale também para o truque da raça e do talento. O degrau vem estruturado no dano da magia (decisão 10.2.6), não da leitura do texto na tela.
- **Ritual (seção 4):** quem pode conjurar como ritual e quais magias vem da característica de cada classe da multiclasse (conhecidas do bardo, preparadas do clérigo e do druida, grimório do mago); conjurar como ritual não gasta espaço, não oferece nível superior e mostra os 10 minutos a mais. `spells.json → ritual` (31 magias) diz quais têm o descritor.
- **Fúria:** em fúria não se conjura nem se concentra, e entrar em fúria encerra a concentração (pág. 48; `docs/regras-rolagens-e-concentracao.md`, seção 10.2). Vale para toda magia, inclusive o ritual e o truque.

## 6. Pontos em aberto (decidir com o dono)

1. **Tradução, truques na multiclasse.** A decisão de 2026-10-29 (seção 2) cita a p. 164 do original, a seção de conjuração da multiclasse. No pt-BR, essa seção (pág. 166, linhas 14791-14817) não traz frase nenhuma sobre truques: a regra sai do texto de cada truque ("quando você alcança o 5° nível") e da definição de nível de personagem (pág. 165). Se o original traz ali a frase de que o truque cresce pelo nível de personagem, é uma omissão da tradução. Não muda a regra adotada; falta só decidir se o caso entra na lista pt-BR × inglês do CLAUDE.md (nenhum texto dos dados carrega a frase hoje).
2. **Ordem da magia de ação bônus** (linhas 18208-18210). "Você não pode conjurar outra magia durante o mesmo turno" vem depois de conjurar a de ação bônus. Quem já conjurou uma magia de 1º nível ou superior com a ação pode, depois, conjurar uma de ação bônus no mesmo turno? A leitura do turno inteiro diz que não (a mesma restrição, em qualquer ordem). Sem decisão. Segue a proposta (o turno inteiro, em qualquer ordem) até decisão em contrário.
