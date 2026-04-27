# Classes — D&D 5e PHB 2014

## Bárbaro

**ID:** barbarian

**Descrição curta:** Um combatente feroz e primitivo que utiliza sua fúria inesgotável para devastar inimigos no combate corpo a corpo e resistir a quantidades massivas de dano.

**Atributo principal:** STR

**Atributo secundário:** CON

**Dado de Vida:** d12

**PV no nível 1:** 12 + modificador de CON

**PV nos níveis seguintes:** 1d12 (ou 7) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: STR
- ability: CON

**Proficiências em armaduras:**

- armor: light
- armor: medium
- armor: shield

**Proficiências em armas:**

- weapon-category: simple
- weapon-category: martial

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: animal-handling, athletics, intimidation, nature, perception, survival

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: greataxe, qualquer-arma-marcial-corpo-a-corpo
- choice: equipment | quantidade: 1 | de: 2x handaxe, qualquer-arma-simples
- pack: explorers-pack
- item: 4x javelin

**Riqueza inicial (alternativa ao equipamento padrão):** 2d4 x 10 po

**Conjuração:**

- isCaster: false

**Features de nível 1:**

- **Fúria:** Como uma ação bônus, você entra em um estado de ferocidade primitiva que dura 1 minuto. Enquanto não estiver de armadura pesada, ganha vantagem em testes de habilidade e resistência de Força, recebe um bônus nas jogadas de dano corpo-a-corpo baseadas em Força (começa em +2) e ganha resistência contra dano de concussão, cortante e perfurante. Não pode conjurar ou concentrar em magias.
- **Defesa sem Armadura:** Quando não estiver vestindo armadura, sua Classe de Armadura é igual a 10 + seu modificador de Destreza + seu modificador de Constituição. O uso de escudo não impede esse benefício.

**Subclasses (Arquétipos):**

- Caminho do Furioso — escolhido no nível 3
- Caminho do Guerreiro Totêmico — escolhido no nível 3

---

## Bardo

**ID:** bard

**Descrição curta:** Um artista versátil e conjurador arcano que manipula a magia através da música e das palavras. Capaz de inspirar aliados, atrapalhar inimigos e desempenhar quase qualquer papel no grupo com excelência.

**Atributo principal:** CHA

**Atributo secundário:** DEX

**Dado de Vida:** d8

**PV no nível 1:** 8 + modificador de CON

**PV nos níveis seguintes:** 1d8 (ou 5) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: DEX
- ability: CHA

**Proficiências em armaduras:**

- armor: light

**Proficiências em armas:**

- weapon-category: simple
- weapon: hand-crossbow
- weapon: longsword
- weapon: rapier
- weapon: shortsword

**Proficiências em ferramentas:**

- choice: tool | quantidade: 3 | de: qualquer-instrumento-musical

**Proficiências em perícias:**

- choice: skill | quantidade: 3 | de: qualquer-pericia

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: rapier, longsword, qualquer-arma-simples
- choice: equipment | quantidade: 1 | de: diplomats-pack, entertainers-pack
- choice: equipment | quantidade: 1 | de: lute, qualquer-instrumento-musical
- item: leather-armor
- item: dagger

**Riqueza inicial (alternativa ao equipamento padrão):** 5d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: CHA
- cantripsKnown: 2
- spellcastingType: known
- spellsKnownAtLevel1: 4
- ritualCasting: true
- spellcastingFocus: musical-instrument

**Features de nível 1:**

- **Conjuração:** Capacidade de conjurar magias e truques da lista do Bardo usando o Carisma. Pode conjurar magias com a tag ritual como rituais e utilizar um instrumento musical como foco de conjuração.
- **Inspiração de Bardo:** Usando uma ação bônus, você escolhe uma criatura (exceto você) a até 18 metros. Ela ganha um dado de Inspiração (1d6). Nos próximos 10 minutos, a criatura pode adicionar o resultado do dado a uma jogada de ataque, teste de habilidade ou teste de resistência que realizar. Usos iguais ao seu modificador de Carisma, recarregando em um descanso longo.

**Subclasses (Arquétipos):**

- Colégio do Conhecimento — escolhido no nível 3
- Colégio da Bravura — escolhido no nível 3

---

## Bruxo

**ID:** warlock

**Descrição curta:** Um conjurador versátil que extrai sua magia de um pacto firmado com uma entidade extraplanar, personalizando seus poderes através de invocações místicas.

**Atributo principal:** CHA

**Atributo secundário:** CON

**Dado de Vida:** d8

**PV no nível 1:** 8 + modificador de CON

**PV nos níveis seguintes:** 1d8 (ou 5) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: WIS
- ability: CHA

**Proficiências em armaduras:**

- armor: light

**Proficiências em armas:**

- weapon-category: simple

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: arcana, deception, history, intimidation, investigation, nature, religion

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: light-crossbow e 20 bolts, qualquer-arma-simples
- choice: equipment | quantidade: 1 | de: component-pouch, arcane-focus
- choice: equipment | quantidade: 1 | de: scholars-pack, dungeoneers-pack
- item: leather-armor
- item: qualquer-arma-simples
- item: 2x dagger

**Riqueza inicial (alternativa ao equipamento padrão):** 4d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: CHA
- cantripsKnown: 2
- spellcastingType: known
- spellsKnownAtLevel1: 2
- ritualCasting: false
- spellcastingFocus: arcane-focus

**Features de nível 1:**

- **Patrono Transcendental:** Você conclui uma barganha com um ser transcendental. Sua escolha lhe confere traços no 1° nível e novamente no 6°, 10° e 14° nível.
- **Magia de Pacto:** Sua pesquisa arcana e a magia outorgada pelo seu patrono concedem a capacidade de conjurar magias. Todos os seus espaços de magia são do mesmo nível e você recobra todos os espaços gastos após um descanso curto ou longo.

**Subclasses (Arquétipos):**

- A Arquifada — escolhido no nível 1
- O Corruptor — escolhido no nível 1
- O Grande Antigo — escolhido no nível 1

---

### Subclasse: A Arquifada

**ID:** the-archfey

**Classe pai:** warlock

**Descrição curta:** Um pacto com uma criatura mística e lendária das cortes feéricas, concedendo magias enganosas voltadas para ilusão, encanto e mobilidade.

**Features adicionais de nível 1:**

- **Lista de Magia Expandida:** Permite que você escolha magias de uma lista expandida da Arquifada quando for aprender magias de bruxo.
- **Presença Feérica:** Com uma ação, você força cada criatura num cubo de 3 metros centrado em você a fazer um teste de Sabedoria. Se falharem, ficam enfeitiçadas ou amedrontadas por você (à sua escolha) até o início do seu próximo turno. Recarrega em descanso curto ou longo.

**Proficiências adicionais:** Nenhuma

**Magias adicionais concedidas:** Sim — lista expandida de magias do patrono (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: O Corruptor

**ID:** the-fiend

**Classe pai:** warlock

**Descrição curta:** Um pacto selado com uma criatura das profundezas infernais ou abissais, focando em magias destrutivas flamejantes e resiliência mortal.

**Features adicionais de nível 1:**

- **Lista de Magia Expandida:** Permite que você escolha magias de uma lista expandida do Corruptor quando for aprender magias de bruxo.
- **Bênção do Obscuro:** Quando você reduz uma criatura hostil a 0 pontos de vida, você ganha uma quantidade de pontos de vida temporários igual ao seu modificador de Carisma + seu nível de bruxo (mínimo 1).

**Proficiências adicionais:** Nenhuma

**Magias adicionais concedidas:** Sim — lista expandida de magias do patrono (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: O Grande Antigo

**ID:** the-great-old-one

**Classe pai:** warlock

**Descrição curta:** Um elo com uma entidade incompreensível e alienígena do Reino Distante, voltado para poderes mentais, telepatia e o desdobramento da sanidade.

**Features adicionais de nível 1:**

- **Lista de Magia Expandida:** Permite que você escolha magias de uma lista expandida do Grande Antigo quando for aprender magias de bruxo.
- **Despertar a Mente:** Você pode se comunicar telepaticamente com qualquer criatura que possa ver a até 18 metros. Você não precisa compartilhar o mesmo idioma, mas a criatura deve compreender pelo menos um idioma para entender suas expressões.

**Proficiências adicionais:** Nenhuma

**Magias adicionais concedidas:** Sim — lista expandida de magias do patrono (referenciar /docs/regras-magias.md quando for criado)

---

## Clérigo

**ID:** cleric

**Descrição curta:** Um intermediário divino que conjura magias através de profunda devoção. Capaz de atuar como curandeiro poderoso, líder suporte ou combatente formidável, dependendo da divindade a que serve.

**Atributo principal:** WIS

**Atributo secundário:** STR ou CON

**Dado de Vida:** d8

**PV no nível 1:** 8 + modificador de CON

**PV nos níveis seguintes:** 1d8 (ou 5) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: WIS
- ability: CHA

**Proficiências em armaduras:**

- armor: light
- armor: medium
- armor: shield

**Proficiências em armas:**

- weapon-category: simple

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: history, insight, medicine, persuasion, religion

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: mace, warhammer
- choice: equipment | quantidade: 1 | de: scale-mail, leather-armor, chain-mail
- choice: equipment | quantidade: 1 | de: light-crossbow e 20 bolts, qualquer-arma-simples
- choice: equipment | quantidade: 1 | de: priests-pack, explorers-pack
- item: shield
- item: holy-symbol

**Riqueza inicial (alternativa ao equipamento padrão):** 5d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: WIS
- cantripsKnown: 3
- spellcastingType: prepared
- spellsKnownAtLevel1: "ver fórmula"
- preparedFormula: modificador de Sabedoria + nível de clérigo
- ritualCasting: true
- spellcastingFocus: holy-symbol

**Features de nível 1:**

- **Conjuração:** Capacidade de conjurar magias divinas, preparando uma lista de magias diariamente após um descanso longo.
- **Domínio Divino:** Você escolhe um domínio relacionado à sua divindade. Essa escolha concede magias de domínio (que estão sempre preparadas) e características exclusivas no 1º nível, além de ditar opções do seu Canalizar Divindade no 2º nível.

**Subclasses (Arquétipos):**

- Domínio do Conhecimento — escolhido no nível 1
- Domínio da Enganação — escolhido no nível 1
- Domínio da Guerra — escolhido no nível 1
- Domínio da Luz — escolhido no nível 1
- Domínio da Natureza — escolhido no nível 1
- Domínio da Tempestade — escolhido no nível 1
- Domínio da Vida — escolhido no nível 1

---

### Subclasse: Domínio do Conhecimento

**ID:** knowledge-domain

**Classe pai:** cleric

**Descrição curta:** Focado no estudo, na compreensão e na desmistificação dos segredos do multiverso. Seus clérigos atuam como sábios com proficiências amplas.

**Features adicionais de nível 1:**

- **Bênçãos do Conhecimento:** Você aprende dois idiomas à sua escolha. Também ganha proficiência e dobra o bônus de proficiência em duas perícias dentre: Arcanismo, História, Natureza ou Religião.

**Proficiências adicionais:**

- choice: skill | quantidade: 2 | de: arcana, history, nature, religion | expertise: true
- choice: language | quantidade: 2 | de: any

**Magias adicionais concedidas:** Sim — magias de domínio sempre preparadas (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: Domínio da Enganação

**ID:** trickery-domain

**Classe pai:** cleric

**Descrição curta:** Voltado para deuses das travessuras, ilusões e furtividade. Clérigos deste domínio quebram regras, ignoram tradições e enganam seus inimigos.

**Features adicionais de nível 1:**

- **Bênção do Trapaceiro:** Você pode usar uma ação para tocar uma criatura voluntária (que não seja você) para conceder-lhe vantagem em testes de Destreza (Furtividade) por 1 hora.

**Proficiências adicionais:** Nenhuma

**Magias adicionais concedidas:** Sim — magias de domínio sempre preparadas (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: Domínio da Guerra

**ID:** war-domain

**Classe pai:** cleric

**Descrição curta:** Deuses guerreiros concedem capacidades de linha de frente, permitindo que seus clérigos inspirem coragem e obliterem os oponentes em embates corpo-a-corpo.

**Features adicionais de nível 1:**

- **Sacerdote da Guerra:** Seu deus envia rajadas de inspiração. Quando você usa a ação de Ataque, pode realizar um ataque com arma como uma ação bônus (usos iguais ao mod. de Sabedoria por descanso longo).

**Proficiências adicionais:**

- armor: heavy
- weapon-category: martial

**Magias adicionais concedidas:** Sim — magias de domínio sempre preparadas (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: Domínio da Luz

**ID:** light-domain

**Classe pai:** cleric

**Descrição curta:** Devotos de deuses do sol e da vigilância, focados em afastar as trevas, banir ilusões e incinerar forças inimigas com fogo radiante.

**Features adicionais de nível 1:**

- **Truque Adicional:** Você ganha o truque _luz_, caso ainda não o conheça.
- **Labareda Protetora:** Quando for atacado por uma criatura a até 9 metros, você pode usar sua reação para impor desvantagem na jogada de ataque ao ofuscá-la com luz.

**Proficiências adicionais:** Nenhuma

**Magias adicionais concedidas:** Sim — magias de domínio sempre preparadas + truque _luz_ automaticamente (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: Domínio da Natureza

**ID:** nature-domain

**Classe pai:** cleric

**Descrição curta:** Atuam como elo entre os deuses e o mundo selvagem, abençoando colheitas ou caçando abominações com o auxílio dos elementos e das feras.

**Features adicionais de nível 1:**

- **Acólito da Natureza:** Você aprende um truque de druida e ganha proficiência em uma perícia relacionada à vida selvagem.

**Proficiências adicionais:**

- armor: heavy
- choice: skill | quantidade: 1 | de: animal-handling, nature, survival
- choice: cantrip | quantidade: 1 | de: druid-cantrip-list

**Magias adicionais concedidas:** Sim — magias de domínio sempre preparadas + 1 truque de druida à escolha (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: Domínio da Tempestade

**ID:** tempest-domain

**Classe pai:** cleric

**Descrição curta:** Representantes da ira divina através dos céus revoltos, capazes de repelir e devastar inimigos com poder trovejante e relâmpagos.

**Features adicionais de nível 1:**

- **Ira da Tormenta:** Quando atingido corpo-a-corpo, pode usar uma reação para forçar o atacante a realizar um teste de resistência de Destreza. Se falhar, sofre 2d8 de dano elétrico ou trovejante (metade no sucesso).

**Proficiências adicionais:**

- armor: heavy
- weapon-category: martial

**Magias adicionais concedidas:** Sim — magias de domínio sempre preparadas (referenciar /docs/regras-magias.md quando for criado)

---

### Subclasse: Domínio da Vida

**ID:** life-domain

**Classe pai:** cleric

**Descrição curta:** O clássico suporte divino. Totalmente devotado à preservação vital, é insuperável no uso de magias de cura, protegendo todos os aliados da morte.

**Features adicionais de nível 1:**

- **Discípulo da Vida:** Suas magias de cura são aprimoradas. Quando curar pontos de vida de uma criatura com uma magia, ela recupera pontos de vida adicionais iguais a 2 + o nível da magia.

**Proficiências adicionais:**

- armor: heavy

**Magias adicionais concedidas:** Sim — magias de domínio sempre preparadas (referenciar /docs/regras-magias.md quando for criado)

---

## Druida

**ID:** druid

**Descrição curta:** Conjuradores devotados ao equilíbrio natural e às forças elementais, capazes de assumir formas de feras selvagens e conjurar a fúria da própria natureza para proteger suas terras.

**Atributo principal:** WIS

**Atributo secundário:** CON

**Dado de Vida:** d8

**PV no nível 1:** 8 + modificador de CON

**PV nos níveis seguintes:** 1d8 (ou 5) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: INT
- ability: WIS

**Proficiências em armaduras:**

- armor: light
- armor: medium
- armor: shield

**Restrições mecânicas:**

- not-allowed: metal-armor, metal-shield

**Proficiências em armas:**

- weapon: club
- weapon: dagger
- weapon: dart
- weapon: javelin
- weapon: mace
- weapon: quarterstaff
- weapon: scimitar
- weapon: sickle
- weapon: sling
- weapon: spear

**Proficiências em ferramentas:**

- tool: herbalism-kit

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: arcana, animal-handling, insight, medicine, nature, perception, religion, survival

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: wooden-shield, qualquer-arma-simples
- choice: equipment | quantidade: 1 | de: scimitar, qualquer-arma-corpo-a-corpo-simples
- item: leather-armor
- pack: explorers-pack
- item: druidic-focus

**Riqueza inicial (alternativa ao equipamento padrão):** 2d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: WIS
- cantripsKnown: 2
- spellcastingType: prepared
- spellsKnownAtLevel1: "ver fórmula"
- preparedFormula: modificador de Sabedoria + nível de druida
- ritualCasting: true
- spellcastingFocus: druidic-focus

**Features de nível 1:**

- **Druídico:** Você conhece o idioma secreto dos druidas. Pode falar e usá-lo para deixar mensagens ocultas. Você e outros que conhecem o idioma as notam automaticamente; outros precisam ser bem-sucedidos em um teste de Sabedoria (Percepção) CD 15 para notar a mensagem, mas não conseguem decifrar sem magia.
- **Conjuração:** Capacidade de conjurar magias divinas focadas nos elementos e na natureza, com a versatilidade de alterar as magias preparadas diariamente após um descanso longo.

**Subclasses (Arquétipos):**

- Círculo da Terra — escolhido no nível 2
- Círculo da Lua — escolhido no nível 2

---

## Feiticeiro

**ID:** sorcerer

**Descrição curta:** Conjuradores inatos cuja magia não advém de anos de estudo em tomos antigos, mas sim de uma linhagem exótica, influência cósmica ou magia bruta e caótica que flui em suas próprias veias.

**Atributo principal:** CHA

**Atributo secundário:** CON

**Dado de Vida:** d6

**PV no nível 1:** 6 + modificador de CON

**PV nos níveis seguintes:** 1d6 (ou 4) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: CON
- ability: CHA

**Proficiências em armaduras:** Nenhuma

**Proficiências em armas:**

- weapon: dagger
- weapon: dart
- weapon: sling
- weapon: quarterstaff
- weapon: light-crossbow

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: arcana, deception, insight, intimidation, persuasion, religion

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: light-crossbow e 20 bolts, qualquer-arma-simples
- choice: equipment | quantidade: 1 | de: component-pouch, arcane-focus
- choice: equipment | quantidade: 1 | de: dungeoneers-pack, explorers-pack
- item: 2x dagger

**Riqueza inicial (alternativa ao equipamento padrão):** 3d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: CHA
- cantripsKnown: 4
- spellcastingType: known
- spellsKnownAtLevel1: 2
- ritualCasting: false
- spellcastingFocus: arcane-focus

**Features de nível 1:**

- **Conjuração:** Capacidade de lançar feitiços usando o próprio Carisma como força de vontade para manipular a trama da magia, além de conhecer 4 truques.
- **Origem de Feitiçaria:** A escolha que determina a fonte do seu poder mágico inerente, conferindo características exclusivas neste nível e nos níveis 6, 14 e 18.

**Subclasses (Arquétipos):**

- Linhagem Dracônica — escolhido no nível 1
- Magia Selvagem — escolhido no nível 1

---

### Subclasse: Linhagem Dracônica

**ID:** draconic-bloodline

**Classe pai:** sorcerer

**Descrição curta:** A magia de poderosos dragões corre no seu sangue devido a pactos ancestrais ou descendência direta, dotando-o de resiliência física e afinidade elemental.

**Features adicionais de nível 1:**

- **Ancestral Dracônico:** Você escolhe um tipo de dragão para ser seu ancestral. O tipo de dano associado afetará habilidades futuras. Você dobra o bônus de proficiência em testes de Carisma ao interagir com dragões.
- **Resiliência Dracônica (PV):** Seu máximo de pontos de vida aumenta em 1 no nível 1, e mais 1 a cada nível subsequente da classe.
- **Resiliência Dracônica (CA):** Quando não estiver usando armadura, sua CA é 13 + modificador de DEX devido à presença de minúsculas escamas de dragão.

**Proficiências adicionais:**

- language: draconic

**Magias adicionais concedidas:** Nenhuma

---

### Subclasse: Magia Selvagem

**ID:** wild-magic

**Classe pai:** sorcerer

**Descrição curta:** Um conduíte caótico de forças elementais puras e imprevisíveis. Suas magias podem causar efeitos drásticos inesperados ou dobrar a sorte a seu favor.

**Features adicionais de nível 1:**

- **Surto de Magia Selvagem:** A magia pode escapar do seu controle. Sempre que você conjurar uma magia de feiticeiro de nível 1 ou superior, o Mestre pode pedir que você role um d20. Se rolar um 1, você precisará rolar na tabela de Surto de Magia Selvagem para causar um efeito mágico aleatório.
- **Marés de Caos:** Você pode manipular o acaso para ganhar vantagem em uma jogada de ataque, teste de habilidade ou teste de resistência. Após utilizar, você não poderá usá-la novamente até terminar um descanso longo ou o Mestre fazer você engatilhar um Surto de Magia Selvagem.

**Proficiências adicionais:** Nenhuma

**Magias adicionais concedidas:** Nenhuma

---

## Guerreiro

**ID:** fighter

**Descrição curta:** Especialistas em combate que dominam o uso de todas as armas e armaduras. Combinam resistência, treinamento tático e versatilidade marcial incomparável no campo de batalha.

**Atributo principal:** STR ou DEX

**Atributo secundário:** CON ou INT

**Dado de Vida:** d10

**PV no nível 1:** 10 + modificador de CON

**PV nos níveis seguintes:** 1d10 (ou 6) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: STR
- ability: CON

**Proficiências em armaduras:**

- armor: light
- armor: medium
- armor: heavy
- armor: shield

**Proficiências em armas:**

- weapon-category: simple
- weapon-category: martial

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: acrobatics, animal-handling, athletics, history, insight, intimidation, perception, survival

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: chain-mail, leather-armor e longbow e 20x arrows
- choice: equipment | quantidade: 1 | de: qualquer-arma-marcial e shield, 2x qualquer-arma-marcial
- choice: equipment | quantidade: 1 | de: light-crossbow e 20 bolts, 2x handaxe
- choice: equipment | quantidade: 1 | de: dungeoneers-pack, explorers-pack

**Riqueza inicial (alternativa ao equipamento padrão):** 5d4 x 10 po

**Conjuração:**

- isCaster: false

**Features de nível 1:**

- **Estilo de Luta:** Você adota um estilo de combate particular que será sua especialidade (Arquearia, Combate com Armas Grandes, Combate com Duas Armas, Defesa, Duelismo ou Proteção), recebendo um bônus mecânico passivo.
- **Retomar o Fôlego:** Você possui uma reserva de estamina para se proteger de danos. No seu turno, pode usar uma ação bônus para recuperar pontos de vida igual a 1d10 + seu nível de guerreiro. Requer um descanso curto ou longo para usar novamente.

**Subclasses (Arquétipos):**

- Campeão — escolhido no nível 3
- Cavaleiro Arcano — escolhido no nível 3
- Mestre de Batalha — escolhido no nível 3

---

## Ladino

**ID:** rogue

**Descrição curta:** Um mestre da furtividade, das perícias e da precisão letal. Ladinos usam astúcia para resolver problemas complexos, desarmar armadilhas e explorar as fraquezas dos inimigos com ataques furtivos devastadores.

**Atributo principal:** DEX

**Atributo secundário:** INT

**Dado de Vida:** d8

**PV no nível 1:** 8 + modificador de CON

**PV nos níveis seguintes:** 1d8 (ou 5) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: DEX
- ability: INT

**Proficiências em armaduras:**

- armor: light

**Proficiências em armas:**

- weapon-category: simple
- weapon: hand-crossbow
- weapon: longsword
- weapon: rapier
- weapon: shortsword

**Proficiências em ferramentas:**

- tool: thieves-tools

**Proficiências em perícias:**

- choice: skill | quantidade: 4 | de: acrobatics, athletics, performance, deception, stealth, intimidation, insight, investigation, perception, persuasion, sleight-of-hand

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: rapier, longsword
- choice: equipment | quantidade: 1 | de: shortbow e 20 arrows, shortsword
- choice: equipment | quantidade: 1 | de: burglars-pack, dungeoneers-pack, explorers-pack
- item: leather-armor
- item: 2x dagger
- item: thieves-tools

**Riqueza inicial (alternativa ao equipamento padrão):** 4d4 x 10 po

**Conjuração:**

- isCaster: false

**Features de nível 1:**

- **Especialização:** Você escolhe duas perícias nas quais é proficiente, ou uma perícia e a proficiência em ferramentas de ladrão. Seu bônus de proficiência é dobrado em qualquer teste de habilidade que utilize essas opções.
- **Ataque Furtivo:** Uma vez por turno, você pode adicionar 1d6 nas jogadas de dano contra uma criatura que atingir, desde que tenha vantagem na jogada de ataque (ou se houver um inimigo do seu alvo a 1,5 metro dele). O ataque deve ser feito com uma arma de acuidade ou à distância.
- **Gíria de Ladrão:** Você conhece códigos secretos e um dialeto próprio. Pode esconder mensagens em conversas normais (demorando quatro vezes mais para transmitir a ideia) e identificar símbolos secretos deixados em locais indicando perigos, alvos ou refúgios.

**Subclasses (Arquétipos):**

- Assassino — escolhido no nível 3
- Ladrão — escolhido no nível 3
- Trapaceiro Arcano — escolhido no nível 3

---

## Mago

**ID:** wizard

**Descrição curta:** Estudiosos devotados às artes arcanas que manipulam a estrutura da realidade através do intelecto, memorizando e conjurando um vasto leque de magias a partir do seu grimório.

**Atributo principal:** INT

**Atributo secundário:** CON ou DEX

**Dado de Vida:** d6

**PV no nível 1:** 6 + modificador de CON

**PV nos níveis seguintes:** 1d6 (ou 4) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: INT
- ability: WIS

**Proficiências em armaduras:** Nenhuma

**Proficiências em armas:**

- weapon: dagger
- weapon: dart
- weapon: sling
- weapon: quarterstaff
- weapon: light-crossbow

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: arcana, history, insight, investigation, medicine, religion

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: quarterstaff, dagger
- choice: equipment | quantidade: 1 | de: component-pouch, arcane-focus
- choice: equipment | quantidade: 1 | de: scholars-pack, explorers-pack
- item: spellbook

**Riqueza inicial (alternativa ao equipamento padrão):** 4d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: INT
- cantripsKnown: 3
- spellcastingType: hybrid
- spellsKnownAtLevel1: 6 (no grimório)
- preparedFormula: modificador de Inteligência + nível de mago
- ritualCasting: true
- spellcastingFocus: arcane-focus

**Features de nível 1:**

- **Conjuração:** Capacidade de conjurar magias arcanas a partir do seu grimório, preparando diariamente uma lista de magias usando o seu intelecto. Pode conjurar como ritual qualquer magia que tenha no grimório com o descritor ritual, sem precisar de a ter preparada.
- **Recuperação Arcana:** Uma vez por dia, ao terminar um descanso curto, podes recuperar espaços de magia gastos cujo nível combinado seja igual ou inferior a metade do teu nível de mago (arredondado para cima). Nenhum dos espaços recuperados pode ser de 6º nível ou superior.

**Subclasses (Arquétipos):**

- Escola de Abjuração — escolhido no nível 2
- Escola de Adivinhação — escolhido no nível 2
- Escola de Conjuração — escolhido no nível 2
- Escola de Encantamento — escolhido no nível 2
- Escola de Evocação — escolhido no nível 2
- Escola de Ilusão — escolhido no nível 2
- Escola de Necromancia — escolhido no nível 2
- Escola de Transmutação — escolhido no nível 2

---

## Monge

**ID:** monk

**Descrição curta:** Um combatente mestre em artes marciais que canaliza a energia mística do chi para realizar feitos físicos impressionantes, ataques desarmados incrivelmente rápidos e defesas sobrenaturais sem o uso de armaduras.

**Atributo principal:** DEX

**Atributo secundário:** WIS

**Dado de Vida:** d8

**PV no nível 1:** 8 + modificador de CON

**PV nos níveis seguintes:** 1d8 (ou 5) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: STR
- ability: DEX

**Proficiências em armaduras:** Nenhuma

**Proficiências em armas:**

- weapon-category: simple
- weapon: shortsword

**Proficiências em ferramentas:**

- choice: tool | quantidade: 1 | de: qualquer-ferramenta-de-artesao, qualquer-instrumento-musical

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: acrobatics, athletics, stealth, history, insight, religion

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: shortsword, qualquer-arma-simples
- choice: equipment | quantidade: 1 | de: dungeoneers-pack, explorers-pack
- item: 10x dart

**Riqueza inicial (alternativa ao equipamento padrão):** 5d4 po (nota: única classe sem multiplicador x10)

**Conjuração:**

- isCaster: false

**Features de nível 1:**

- **Defesa sem Armadura:** Quando você não estiver vestindo nenhuma armadura nem empunhando um escudo, sua Classe de Armadura será igual a 10 + seu modificador de Destreza + seu modificador de Sabedoria.
- **Artes Marciais:** Sua prática concede maestria com golpes desarmados e armas de monge (armas simples corpo-a-corpo que não tenham a propriedade pesada ou duas mãos, e espadas curtas). Permite usar Destreza para as jogadas de ataque e dano, usar um d4 no lugar do dano normal (aumenta com o nível) e realizar um golpe desarmado com uma ação bônus sempre que usar a ação de Ataque com um ataque desarmado ou arma de monge.

**Subclasses (Arquétipos):**

- Caminho da Mão Aberta — escolhido no nível 3
- Caminho da Sombra — escolhido no nível 3
- Caminho dos Quatro Elementos — escolhido no nível 3

---

## Paladino

**ID:** paladin

**Descrição curta:** Um campeão abençoado e guerreiro divino, cujos juramentos sagrados lhe concedem tanto proezas marciais implacáveis quanto o poder mágico para curar aliados e destruir as forças do mal.

**Atributo principal:** STR

**Atributo secundário:** CHA

**Dado de Vida:** d10

**PV no nível 1:** 10 + modificador de CON

**PV nos níveis seguintes:** 1d10 (ou 6) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: WIS
- ability: CHA

**Proficiências em armaduras:**

- armor: light
- armor: medium
- armor: heavy
- armor: shield

**Proficiências em armas:**

- weapon-category: simple
- weapon-category: martial

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 2 | de: athletics, insight, intimidation, medicine, persuasion, religion

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: qualquer-arma-marcial e shield, 2x qualquer-arma-marcial
- choice: equipment | quantidade: 1 | de: 5x javelin, qualquer-arma-simples-corpo-a-corpo
- choice: equipment | quantidade: 1 | de: priests-pack, explorers-pack
- item: chain-mail
- item: holy-symbol

**Riqueza inicial (alternativa ao equipamento padrão):** 5d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: CHA
- cantripsKnown: 0
- spellcastingType: prepared
- spellsKnownAtLevel1: 0
- preparedFormula: modificador de Carisma + metade do nível de paladino (arredondado para baixo)
- ritualCasting: false
- spellcastingFocus: holy-symbol
- castingStartsAtLevel: 2

**Features de nível 1:**

- **Sentido Divino:** Com uma ação, você expande sua consciência para sentir o bem ou mal. Até o final do próximo turno, você sabe a localização de qualquer celestial, corruptor ou morto-vivo a até 18 metros que não possua cobertura total, além de detectar lugares ou objetos consagrados ou conspurcados. Usos iguais a 1 + modificador de Carisma, recarregando num descanso longo.
- **Cura pelas Mãos:** Você possui um poço de poder curativo igual a 5 vezes seu nível de paladino. Com uma ação, você pode tocar uma criatura e gastar poder do poço para curar seus pontos de vida. Alternativamente, você pode gastar 5 pontos de cura para remover uma doença ou neutralizar um veneno da criatura. Não afeta mortos-vivos ou constructos.

**Subclasses (Arquétipos):**

- Juramento de Devoção — escolhido no nível 3
- Juramento dos Anciões — escolhido no nível 3
- Juramento de Vingança — escolhido no nível 3

---

## Patrulheiro

**ID:** ranger

**Descrição curta:** Guerreiros da natureza especializados em caçar ameaças monstruosas nas margens da civilização. Combinam profundo conhecimento de sobrevivência, técnicas de combate mortais e conjuração de magias naturais para rastrear e abater suas presas.

**Atributo principal:** DEX

**Atributo secundário:** WIS

**Dado de Vida:** d10

**PV no nível 1:** 10 + modificador de CON

**PV nos níveis seguintes:** 1d10 (ou 6) + modificador de CON por nível

**Proficiências em testes de resistência:**

- ability: STR
- ability: DEX

**Proficiências em armaduras:**

- armor: light
- armor: medium
- armor: shield

**Proficiências em armas:**

- weapon-category: simple
- weapon-category: martial

**Proficiências em ferramentas:** Nenhuma

**Proficiências em perícias:**

- choice: skill | quantidade: 3 | de: animal-handling, athletics, insight, investigation, nature, perception, stealth, survival

**Equipamento inicial (padrão):**

- choice: equipment | quantidade: 1 | de: scale-mail, leather-armor
- choice: equipment | quantidade: 1 | de: 2x shortsword, 2x qualquer-arma-simples-corpo-a-corpo
- choice: equipment | quantidade: 1 | de: explorers-pack, dungeoneers-pack
- item: longbow e 20 arrows

**Riqueza inicial (alternativa ao equipamento padrão):** 5d4 x 10 po

**Conjuração:**

- isCaster: true
- spellcastingAbility: WIS
- cantripsKnown: 0
- spellcastingType: known
- spellsKnownAtLevel1: 0
- ritualCasting: false
- spellcastingFocus: component-pouch
- castingStartsAtLevel: 2

**Features de nível 1:**

- **Inimigo Favorito:** Você adquire experiência caçando e rastreando um tipo de inimigo específico. Recebe +2 de bônus nas jogadas de dano contra eles, tem vantagem em testes de Sabedoria (Sobrevivência) para rastreá-los e testes de Inteligência para lembrar informações, além de aprender o idioma falado pelo inimigo.
- **Explorador Natural:** Você domina a navegação pelos ermos e reage rápido em emboscadas. Você ignora terreno difícil, ganha vantagem nas rolagens de iniciativa e, no seu primeiro turno de combate, tem vantagem em ataques contra quem ainda não agiu. Também ganha diversos bônus de exploração e rastreamento em viagens longas.

**Subclasses (Arquétipos):**

- Conclave da Besta — escolhido no nível 3
- Conclave do Caçador — escolhido no nível 3
- Conclave do Rastreador Subterrâneo — escolhido no nível 3
