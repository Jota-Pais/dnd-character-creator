# Multiclasse — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR, Cap. 6 "Opções de Personalização", págs. 165-167.
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt`. Esta é a **fonte da verdade documental** para a implementação de multiclasse (pipeline: livro → este doc → dados/tipos/utils → UI).
>
> Multiclasse é uma **regra opcional** do PHB ("com a permissão do Mestre"). No app, é ativada pelo modo **"Multiclasse"** no passo Nome; o caminho de classe única permanece o padrão.

## 1. Regra geral (pág. 165)

- Ao avançar de nível, você pode ganhar um nível em uma **nova classe** em vez de continuar na atual. Os níveis de **todas** as classes **somam** para o seu nível de personagem — ex.: mago 3 + guerreiro 2 = personagem de **5º nível**.
- É possível ter 3, 4+ classes. O trade-off é **versatilidade em troca de foco**.
- **Equipamento inicial:** você recebe **apenas o da sua primeira classe**.

## 2. Pré-requisitos (pág. 166)

Para se qualificar para uma nova classe, você deve atender aos **valores mínimos de habilidade da classe nova E de todas as suas classes atuais**.

| Classe | `id` | Mínimo |
| --- | --- | --- |
| Bárbaro | `barbarian` | Força 13 |
| Bardo | `bard` | Carisma 13 |
| Bruxo | `warlock` | Carisma 13 |
| Clérigo | `cleric` | Sabedoria 13 |
| Druida | `druid` | Sabedoria 13 |
| Feiticeiro | `sorcerer` | Carisma 13 |
| Guerreiro | `fighter` | Força 13 **ou** Destreza 13 |
| Ladino | `rogue` | Destreza 13 |
| Mago | `wizard` | Inteligência 13 |
| Monge | `monk` | Destreza 13 **e** Sabedoria 13 |
| Paladino | `paladin` | Força 13 **e** Carisma 13 |
| Patrulheiro | `ranger` | Destreza 13 **e** Sabedoria 13 |

- **"ou"** = basta um dos atributos; **"e"** = todos os listados.
- No app: avaliado sobre os atributos **finais** (base + racial + ASI/talento). A regra vale para *entrar* e para *continuar* — como criamos a ficha já no nível final, basta checar que todas as classes escolhidas cumprem seus mínimos.

## 3. Pontos de Vida e Dados de Vida (pág. 166)

- Você ganha os PV da nova classe **como para níveis após o 1º** — ou seja, **média ou rolagem** do dado + mod. de CON, **nunca o máximo**. O PV de 1º nível (dado no máximo) vale só quando você é personagem de 1º nível, isto é, **apenas para a primeira classe**.
- Os **Dados de Vida** de todas as classes formam um **poço**: dados de mesmo tipo somam (paladino 5/guerreiro 5 → **10d10**); tipos diferentes ficam separados (paladino 5/clérigo 5 → **5d10 + 5d8**).

## 4. Bônus de Proficiência (pág. 166)

Sempre baseado no **nível de personagem total**, não no nível em uma classe (guerreiro 3/ladino 2 → nível 5 → **+3**). *(Já é assim no app — deriva de `draft.level`.)*

## 5. Proficiências de Multiclasse (pág. 166)

Ao ganhar um nível em uma classe **diferente da primeira**, você recebe **apenas parte** das proficiências iniciais dela:

| Classe | Proficiências adquiridas ao multiclassar |
| --- | --- |
| Bárbaro | Escudos, armas simples, armas marciais |
| Bardo | Armadura leve, **1 perícia à sua escolha**, 1 instrumento musical à escolha |
| Bruxo | Armadura leve, armas simples |
| Clérigo | Armadura leve, armadura média, escudos |
| Druida | Armadura leve, armadura média, escudos (druidas não usam armadura/escudo de metal) |
| Feiticeiro | — (nada) |
| Guerreiro | Armadura leve, armadura média, escudos, armas simples, armas marciais |
| Ladino | Armadura leve, **1 perícia da lista da classe**, ferramentas de ladrão |
| Mago | — (nada) |
| Monge | Armas simples, espadas curtas |
| Paladino | Armadura leve, armadura média, escudos, armas simples, armas marciais |
| Patrulheiro | Armadura leve, armadura média, escudos, armas simples, armas marciais, **1 perícia da lista da classe** |

- **Testes de Resistência (saving throws) NÃO entram** na multiclasse — vêm **exclusivamente da primeira classe**.
- Só **Bardo, Ladino e Patrulheiro** concedem **perícia** ao multiclassar (1 cada). As demais classes **não** dão perícia nova.
- **Só a primeira classe** concede: resistências, a lista **completa** de perícias iniciais e o equipamento inicial.

## 6. Características de Classe — exceções (pág. 166)

Regra geral: você ganha as características de cada classe no nível que tem nela. Quatro características têm regra extra na multiclasse:

- **Ataque Extra** — **não empilha**. Ter Ataque Extra de duas classes não dá mais ataques (máx. 2), a menos que a própria classe especifique mais (ex.: guerreiro nº de ataques cresce com o nível de guerreiro). A invocação Lâmina Sedenta (bruxo) também não soma com Ataque Extra.
- **Defesa sem Armadura** — se você **já tem** (bárbaro ou monge), **não pode** ganhá-la de outra classe.
- **Canalizar Divindade** — você ganha os **efeitos** de ambas as classes, mas readquirir a característica **não dá usos adicionais**; os usos só sobem quando um nível de classe diz isso explicitamente (clérigo 6/paladino 4 → 2 usos, graças ao nível de clérigo).
- **Conjuração** — ver seção 7.

## 7. Conjuração multiclasse (págs. 166-167)

Se você tem a característica **Conjuração de apenas uma classe**, segue as regras daquela classe (nada muda — é o caso de hoje). Com Conjuração em **mais de uma** classe:

### Magias conhecidas e preparadas
Determinadas **por classe, individualmente**, como se você fosse membro de classe única daquela classe: as contagens (truques, conhecidas, preparadas) e o **nível máximo de magia** vêm do seu nível **naquela** classe. Cada magia conhecida/preparada fica **associada a uma classe** e usa a **habilidade de conjuração dessa classe** — logo, **CD e bônus de ataque de magia são por classe**. O foco de conjuração também é por classe.

### Espaços de magia (pool combinado)
Some, para achar seu **nível de conjurador**:
- **níveis inteiros** em bardo, clérigo, druida, feiticeiro e mago;
- **metade (arredondado para baixo)** dos níveis em paladino e patrulheiro;
- **um terço (arredondado para baixo)** dos níveis de guerreiro/ladino **se** você tiver **Cavaleiro Arcano** ou **Trapaceiro Arcano**.

Use esse total na tabela **Multiclasse para Conjurador** (seção 8). A tabela pode conceder slots de nível **mais alto** que as magias que você conhece/prepara; você pode usá-los para conjurar magias de nível **inferior** (inclusive aprimorando por upcasting).

> **Exemplo do livro:** patrulheiro 4/mago 3 → nível de conjurador = ⌊4/2⌋ + 3 = **5** → 4 slots de 1º, 3 de 2º, 2 de 3º nível. Você conhece só magias de patrulheiro de 1º e magias de mago até 2º, mas pode gastar o slot de 3º para conjurá-las.

### Magia de Pacto (bruxo)
Os slots de **Magia de Pacto** ficam **separados** do pool combinado (níveis de bruxo **não** entram no nível de conjurador). São, porém, **interoperáveis**: slots de Pacto conjuram magias das classes com Conjuração que você conhece/prepara, e slots de Conjuração conjuram magias de bruxo que você conhece.

## 8. Tabela — Multiclasse para Conjurador: espaços por nível de magia (pág. 167)

`Nível` = nível de conjurador combinado (seção 7).

| Nível | 1º | 2º | 3º | 4º | 5º | 6º | 7º | 8º | 9º |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | – | – | – | – | – | – | – | – |
| 2 | 3 | – | – | – | – | – | – | – | – |
| 3 | 4 | 2 | – | – | – | – | – | – | – |
| 4 | 4 | 3 | – | – | – | – | – | – | – |
| 5 | 4 | 3 | 2 | – | – | – | – | – | – |
| 6 | 4 | 3 | 3 | – | – | – | – | – | – |
| 7 | 4 | 3 | 3 | 1 | – | – | – | – | – |
| 8 | 4 | 3 | 3 | 2 | – | – | – | – | – |
| 9 | 4 | 3 | 3 | 3 | 1 | – | – | – | – |
| 10 | 4 | 3 | 3 | 3 | 2 | – | – | – | – |
| 11 | 4 | 3 | 3 | 3 | 2 | 1 | – | – | – |
| 12 | 4 | 3 | 3 | 3 | 2 | 1 | – | – | – |
| 13 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | – | – |
| 14 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | – | – |
| 15 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | – |
| 16 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | – |
| 17 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | 1 |
| 18 | 4 | 3 | 3 | 3 | 3 | 1 | 1 | 1 | 1 |
| 19 | 4 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 1 |
| 20 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | 1 |

## 9. Notas de implementação (mapeamento pro app)

Não faz parte da regra do livro — orienta a execução das próximas fases.

- **A tabela da seção 8 é idêntica à tabela de conjurador pleno** já usada no app (`progression.json → spellSlots.full`). Implementação: `nível de conjurador combinado → índice na tabela full existente`, sem tabela nova. *(Verificado linha a linha: as 20 linhas batem 1:1 com `spellSlots.full`.)*
- **`casterProgression` por classe:** `full` = bard, cleric, druid, sorcerer, wizard; `half` = paladin, ranger; `none` = barbarian, fighter, monk, rogue; `pact` = warlock. O caso **`third`** NÃO é da classe — é da **subclasse** `eldritch-knight` (guerreiro) e `arcane-trickster` (ladino); modelar no nível de subclasse.
- **Half nível 1 conta 0** (⌊1/2⌋ = 0): um "dip" de paladino/patrulheiro nível 1 não adiciona slots ao pool.
- **Pré-requisitos bloqueiam** a finalização da ficha (decisão de produto — fiel ao livro), avaliados sobre os atributos finais.
- **Tokens de proficiência a introduzir (Fase 1):** armaduras `light-armor` / `medium-armor` / `heavy-armor`, `shields`; armas `simple-weapons` / `martial-weapons` e específicas (`shortswords`); ferramentas (`thieves-tools`); instrumento musical; perícia "à escolha" / "da lista da classe".
- **Só a primeira classe (`draft.classes[0]`)** concede resistências, perícias iniciais completas e equipamento inicial; as demais seguem a Tabela de Proficiências de Multiclasse (seção 5).
