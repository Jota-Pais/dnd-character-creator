# Feedbacks de Playtest (intake)

> Documento de trabalho — captura de feedbacks de usuários reais (a partir de 2026-07-09).
> Fase de **intake**: itens registrados sem ação. Execução/correção só depois do "pode executar".
> Legenda de triagem: 🐛 bug · 📖 fidelidade ao livro · 🎨 UX/polish · ✨ feature nova

---

### F1 — Descrições de equipamento no passo de Equipamento (D&D)
- **Sistema:** D&D 5e
- **Onde:** passo Equipamento (escolha do equipamento inicial)
- **Relato:** ao escolher itens (ex.: criando um ladino, apareceu opção de rapieira vs. espada curta), não há descrição do que cada equipamento é/faz. O usuário não tem como decidir sem saber dano e propriedades de cada arma. Como o objetivo do app é o jogador não precisar abrir o livro, o passo deveria mostrar, para cada opção, o dano e as propriedades (ex.: acuidade/finesse = pode usar Destreza, leve, uma mão vs. duas mãos, versátil etc.).
- **Triagem:** 🎨 UX/polish (alto valor — vai direto à proposta do produto)
- **Nota técnica:** os dados já existem estruturados em `weapons.json` (dano, tipo, propriedades) — é **exibir**, não digitalizar. Estender também a armaduras/escudos (CA, propriedades) e itens.
- **Obs.:** o próprio exemplo do usuário confunde as propriedades da rapieira (ele achou que era "duas mãos"; na verdade é acuidade + uma mão) — o que reforça a necessidade de mostrar os dados corretos.
- **Status:** registrado (sem ação)

### F2 — Conferir cálculo de PV total (D&D, método média)
- **Sistema:** D&D 5e
- **Onde:** cálculo de PV / Revisão
- **Relato:** ladino de nível 3, usando **média** (não rolando), deu **18 PV**. Pareceu pouco ("como se tivesse faltado um dado"). Pedido de **conferência** (não é erro com certeza).
- **Triagem:** 📖 fidelidade ao livro (regra esclarecida; falta só confirmar o valor de CON do caso)
- **Regra (confirmada no código, conferido contra o PHB na Fase 1):** nível 1 usa o **máximo** do dado de vida (não a média) + mod CON; níveis 2+ usam a média (`floor(dado/2)+1`) + mod CON. Ladino = d8 → nv1 = 8+CON, cada nível seguinte = 5+CON. A dúvida do usuário ("no nv1 seria 8+5") não procede: o "+5" só entra a partir do 2º nível; somar no nv1 contaria o 1º nível duas vezes. Código bate: `getHpAtLevel1 = hitDie + con`, `getAverageHpPerLevel = floor(hitDie/2)+1`, total = `nv1 + (média+con)×(nível−1)`.
- **Veredito:** 18 = `8 + 5 + 5` está **correto para CON 10–11 (mod 0)**. **Ponto real a confirmar:** qual a CON do ladino? Se for >11 e o total continuar 18, aí sim é bug (mod de CON não somado por nível). Ex.: CON 14 (+2) deveria dar `10+7+7 = 24`. **Aguardando o valor de CON do usuário.**
- **Status:** registrado (sem ação) — regra esclarecida; pendente confirmar CON

### F3 — Ficha mostrando "2d8" de Dados de Vida no ladino nv3 (D&D)
- **Sistema:** D&D 5e
- **Onde:** "a ficha" (a esclarecer: ficha impressa / Revisão / linha de rolagem)
- **Relato:** a ficha do ladino nv3 diz que ele tem **2d8** de dados de vida. Está certo?
- **Triagem:** 📖 fidelidade ao livro (a reproduzir)
- **Regra:** Dados de Vida = nível do personagem. Ladino nv3 → **3d8** (não 2d8).
- **Análise (código):** único display de "Dados de Vida" é `PrintableSheet` linha ~179: `${level}d${hitDie}` → 3d8 pra nv3. Usa o **mesmo** `level` que produz "Pontos de Vida" 18 e "Nível" 3, então a ficha impressa **não pode** mostrar 2d8 com nível 3. O único "2" no app é a linha "Rolagens (níveis 2+)" na Revisão (mostra `nível−1` = 2 dados rolados acima do 1º nível, só no método Rolar) — é a rolagem, não o total.
- **Hipótese:** provavelmente **não é bug** (misread da linha de rolagem, ou personagem na verdade nv2). **A confirmar com o usuário:** onde exatamente viu "2d8" e se o campo "Nível" está 3. Se for a ficha impressa com Nível 3 → investigar a fundo (seria contradição com o código).
- **Status:** registrado (sem ação) — aguardando o usuário localizar onde viu o "2d8"

### F4 — Emoji 🎲 do D&D é genérico demais
- **Sistema:** D&D 5e
- **Onde:** `GlobalGallery.tsx` — ícone do sistema no seletor "Novo personagem" (linha ~123) e no card de personagem (linha ~179, ao lado de 👁️ do Ordem Paranormal)
- **Relato:** o emoji 🎲 (dado) usado pra identificar D&D é muito genérico — qualquer RPG de mesa usa dados, não é específico do D&D.
- **Triagem:** 🎨 UX/polish (identidade visual)
- **Nota técnica:** hoje só 2 lugares usam esse emoji como ícone-de-sistema (fácil trocar); há mais ocorrências de 🎲 no app (botão "Rolar", método de equipamento etc.) que são sobre **rolar dados**, não sobre identidade do D&D — não confundir os dois usos na hora de corrigir.
- **A decidir na execução:** emoji substituto (ex.: 🐉 dragão, 🛡️ escudo, ⚔️ espadas — algo mais associado a fantasia medieval / D&D especificamente).
- **Status:** ✅ CORRIGIDO — 🎲 → 🐉 (dragão, o símbolo mais icônico do D&D; combina com o 👁️ do Ordem) nos 3 pontos de identidade (card e seletor da galeria global + header do app D&D). Os 🎲 dos botões de "rolar dados/ouro" foram mantidos (são sobre rolagem, não identidade).

### F5 — Descrição de ataque na ficha (PDF) confusa; deveria ser por arma
- **Sistema:** D&D 5e
- **Onde:** `PrintableSheet.tsx` (~linhas 220-224), seção "Ataques & Conjuração" da ficha impressa/PDF
- **Relato:** o texto atual é uma fórmula genérica — "Ataque corpo-a-corpo (Força): +1 · À distância / com acuidade (Destreza): +5 (+ o dano da arma equipada)" — e não dá pra entender de bater o olho. O usuário quer **uma linha por arma equipada**, no estilo das descrições de magia (bate o olho → sabe o que rolar), algo como: "Rapieira: +5, dano 1d8+3 (Agilidade)". Se a arma permite mais de um ataque por turno, marcar com algo tipo "2x" no início da linha.
- **Triagem:** 🎨 UX/polish (clareza de uso na mesa — vai direto à proposta do produto)
- **Nota técnica:** o texto atual é uma fórmula fixa que nem lista as armas do personagem — não usa `weapons.json`/equipamento equipado pra nada. Essa melhoria **já estava anotada no backlog do ROADMAP.md** ("Exportação de PDF — Detalhamento de Armas"), mas nunca foi feita; este feedback a confirma como prioridade real de usuário, não só ideia interna.
- **A decidir na execução:** de onde vem "qual atributo usar" por arma (acuidade → melhor de FOR/DES; à distância → DES; corpo a corpo comum → FOR) e como detectar "múltiplos ataques" (feature Ataque Extra da classe, não a arma em si) pro indicador "2x".
- **Status:** registrado (sem ação)

### F6 — Texto do Ataque Furtivo sempre diz "1d6", mas o personagem tem 2d6 (nv3)
- **Sistema:** D&D 5e
- **Onde:** duas seções da mesma ficha (Revisão e ficha impressa) mostram números diferentes pro mesmo recurso: "Habilidades de Classe" (`classes.json`, texto fixo da feature de nível 1: "adicione **1d6** de dano...") vs. "Recursos de Classe" (`classResourceUtils.ts` + `progression.json`, dinâmico por nível: "Ataque Furtivo: **2d6**" pra ladino nv3).
- **Relato:** o usuário achou confuso porque o texto da habilidade diz 1d6, mas a ficha (recursos) mostra 2d6. **O valor 2d6 está correto** pro ladino nível 3 (tabela do PHB: 1d6/nv1, 2d6/nv3, 3d6/nv5...) — `progression.json` confirmado (`sneakAttackDice: [1,1,2,2,3,3,...]`, índice do nv3 = 2). O problema é a **redação**: o texto da feature é estático (escrito uma vez, no nível em que é concedida) e nunca reflete o valor atual pro nível do personagem, coexistindo com o painel dinâmico que mostra o número certo — dois números diferentes na mesma ficha, sem explicação.
- **Triagem:** 🎨 UX/polish (clareza — não é bug de cálculo, o `Recursos de Classe` já está certo)
- **A decidir na execução:** ajustar o texto estático da feature "Ataque Furtivo" em `classes.json` pra não fixar o "1d6" (ex.: "adicione **[dado]** de dano... (veja Recursos de Classe)"), ou remover a redundância achando um jeito de a descrição referenciar o valor dinâmico. Mesmo padrão pode valer pra outras features com dado escalável por nível (ex.: Dado de Superioridade do Mestre de Batalha, Artes Marciais do monge) — vale conferir se têm o mesmo problema.
- **Status:** ✅ CORRIGIDO — varredura pegou 2 features com o mesmo padrão: **Ataque Furtivo** (ladino, "1d6") e **Artes Marciais** (monge, "1d4"). As duas descrições em `classes.json` deixaram de hardcodar o dado inicial e passaram a apontar "veja Recursos de Classe" (painel dinâmico que já mostra o valor certo por nível). (Dado de Superioridade do Mestre de Batalha está em feature de subclasse, não tem painel de recurso duplicando — sem conflito.)

### F7 — Falta espaço na ficha pra anotar PV atual (durante a sessão)
- **Sistema:** D&D 5e (provavelmente vale para Ordem também — a confirmar no escopo)
- **Onde:** ficha impressa/PDF (`PrintableSheet.tsx`)
- **Relato:** a ficha impressa não tem espaço pro jogador ir riscando/anotando a vida atual (e outros contadores de sessão) enquanto joga — só mostra o PV **máximo**.
- **Triagem:** 🎨 UX/polish (usabilidade na mesa)
- **Nota:** este item **já estava no backlog do ROADMAP.md** ("Exportação de PDF — Espaços de Controle de Sessão / Tracking", linha ~389): espaços em branco pra PV Atual, PV Temporário, bolinhas de Teste contra a Morte, checkboxes de slots de magia e recursos de classe (Fúria, Ki etc.) gastos. O usuário confirma que isso é real necessidade de uso, não só ideia interna — vira prioridade real, não mais icebox.
- **A decidir na execução:** layout dos espaços (caixa de texto em branco vs. checkboxes/bolinhas), quais contadores entram na v1 desse item (PV atual é o pedido explícito; os demais — PV temp, testes contra morte, slots/recursos — podem entrar junto ou ficar pra uma 2ª leva).
- **Status:** registrado (sem ação)

### F8 — Seleção de Trilha (Ordem) não explica a trilha nem mostra as habilidades futuras
- **Sistema:** Ordem Paranormal
- **Onde:** `ProgressionStep.tsx`, componente `TrilhaSection` (linhas ~116-149), passo "Progressão" do wizard
- **Relato:** na hora de escolher a trilha, falta (1) uma explicação melhor do que é a trilha, e (2) mostrar **todas** as habilidades da trilha (não só a atual), mesmo que o personagem só tenha NEX 10% no momento — pra o jogador decidir sabendo o que vai receber no futuro.
- **Triagem:** 🎨 UX/polish (decisão informada — bate direto na visão do produto de "controle total das escolhas")
- **Achados no código (confirmam os dois pontos exatos do relato):**
  1. O botão de cada trilha (linha ~133-134) só mostra `name` + `requirement` — a `description` da trilha (já existe em `trilhas.json`, ex.: "Treinado para abater alvos com eficiência e velocidade. Suas armas são suas melhores amigas.") **nunca é exibida** na seleção.
  2. Depois de escolhida, a lista de features (linha ~140) filtra `f.nex <= draft.nex` — em NEX 10% só aparece a feature de NEX 10, escondendo as de NEX 40/65/99 (o resto da progressão da trilha) — exatamente o que o usuário descreveu.
- **A decidir na execução:** exibir a `description` no card/botão de cada trilha (mesmo antes de selecionar, pra ajudar a decidir entre as 5 opções) e, ao selecionar, listar **todas** as features (10/40/65/99), sinalizando visualmente quais já foram alcançadas (NEX atual) vs. quais ainda são futuras (ex.: opacidade menor, ícone de cadeado, ou "🔒 ainda não alcançado").
- **Status:** ✅ CORRIGIDO — cada trilha mostra sua `description` no card (antes de escolher); ao selecionar, lista **todos** os 4 poderes (NEX 10/40/65/99), com os futuros esmaecidos + "🔒" + "(ainda não alcançado)".

### F9 — Amaldiçoar Arma precisa de escolha de elemento ao ser aprendido (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** `RitualsStep.tsx` (seleção de rituais do Ocultista); dado `amaldicoar-arma` em `rituals.json`
- **Relato:** o ritual Amaldiçoar Arma não serve simultaneamente pra todos os elementos — o jogador escolhe **um** elemento específico ao aprendê-lo, e o ritual passa a ser só daquele elemento. A UI de seleção deveria deixar escolher qual.
- **Confirmado no livro:** "Quando aprender este ritual, escolha um elemento entre Conhecimento, Energia, Morte e Sangue. Este ritual passa a ser do elemento escolhido." (regra real, não é só apresentação — o tipo de dano do bônus (+1d6) depende do elemento escolhido.)
- **Confirmado no código:** `amaldicoar-arma` é o **único** ritual do jogo com `elements.length > 1` (`["knowledge","energy","death","blood"]` — os outros 80 rituais têm elemento único). Hoje o `RitualsStep` só lista os 4 elementos juntos (`Conhecimento/Energia/Morte/Sangue`) tanto no `<option>` do dropdown quanto no painel de detalhe — não existe nenhum campo no draft pra registrar qual dos 4 o jogador escolheu para aquela instância do ritual.
- **Triagem:** 📖 fidelidade ao livro / gap de modelagem (é uma escolha de regra real faltando, não só clareza de texto — mais parecido com as "escolhas de progressão" que viraram seletor real no D&D, Fase 3.5b, do que com um ajuste de UX puro)
- **A decidir na execução:** provavelmente precisa de um campo novo no draft (algo como `ritualElementChoices: Record<string, OrdemElement>`, chaveado pelo id do ritual) pra guardar a escolha quando o ritual selecionado for `amaldicoar-arma`; UI mostra um seletor de elemento extra só quando esse ritual específico é escolhido; Revisão/ficha impressa devem exibir o elemento escolhido, não os 4.
- **Status:** ✅ CORRIGIDO — novo campo `ritualElementChoices: Record<string, OrdemElement>` no draft (reset no `setClass`, coberto no import); `RitualsStep` mostra um seletor de elemento quando o ritual escolhido é multi-elemento e bloqueia o avanço até escolher (`isRitualStepComplete` exige o elemento); Revisão e ficha exibem só o elemento escolhido via `formatRitualElementLabel`. +2 testes unitários + asserção no smoke test.

### F10 — Patente não é perguntada/explicada na criação (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** faltando em todo o wizard; só aparece hardcoded como "Patente: Recruta" na ficha impressa (`PrintableSheet.tsx` linha 38)
- **Relato:** ao criar o personagem, não foi pedida a Patente.
- **Isto é decisão de escopo deliberada, não bug** (já documentada no ROADMAP.md, seção "Equipamento e Patente"): Patente é recurso de **campanha** (ganho com Pontos de Prestígio ao longo de missões, concedidos pelo mestre), não de criação — todo agente novo começa **Recruta (0 PP)** por regra do livro, e o próprio livro sugere um "Equipamento Inicial" simplificado pra acelerar a criação, sem simular a Patente completa. Não faria sentido perguntar "quantos PP você tem" pra um personagem que nunca jogou uma missão.
- **Triagem:** 🎨 UX/polish (a decisão está certa; falta só **comunicá-la**) — não é 📖 nem 🐛, já que a regra foi seguida corretamente
- **Gap real encontrado:** o app nunca explica essa decisão pro jogador em nenhum ponto do fluxo (nem no passo de Equipamento, onde a Patente Recruta é o que define os limites de categoria/carga) — só aparece de relance na ficha final, sem contexto. Por isso pareceu "esquecimento" e não "decisão".
- **A decidir na execução:** adicionar uma nota breve no passo Equipamento (algo como "Todo agente novo começa como Recruta — a Patente sobe em jogo, com Pontos de Prestígio ganhos em missões") pra fechar essa lacuna de comunicação, sem mudar a mecânica.
- **Status:** ✅ CORRIGIDO — nota no passo Equipamento explicando que todo agente novo começa Recruta e que a Patente sobe em jogo (via Pontos de Prestígio do mestre), por isso não é escolhida na criação. Sem mudança de mecânica.

### F11 — Nenhum item de equipamento (Ordem) tem descrição
- **Sistema:** Ordem Paranormal
- **Onde:** passo Equipamento (`EquipmentStep.tsx`); dado `equipments.json`
- **Relato:** a seção de itens precisa de descrição — o jogador precisa saber o que está escolhendo (mesmo pedido do F1, mas pro Ordem).
- **Confirmado no código:** dos **70 itens** de `equipments.json`, **todos os 70** têm o campo `description` vazio/ausente (o tipo `OrdemEquipmentBase` já tem `description?: string` opcional — é só um gap de dado, não de modelagem). Armas/proteções têm campos mecânicos (dano, categoria, Defesa etc.) exibidos, mas nenhum texto explicativo do item em si (o que ele faz, pra que serve).
- **Triagem:** 🎨 UX/polish (mesmo princípio do F1 — decisão informada é a proposta central do produto)
- **A decidir na execução:** digitalizar as descrições do Cap. 3 do livro pra cada item (armas, proteções, granadas, acessórios, itens gerais) e exibi-las no passo Equipamento (e Revisão/ficha, se fizer sentido).
- **Status:** registrado (sem ação)

### F12 — Sistema de Modificações de arma/proteção/acessório não existe (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** ausente em `equipments.json`/`equipment.ts` e no `EquipmentStep.tsx`
- **Relato:** as armas precisam ter como adicionar modificações.
- **Confirmado no livro:** existe um sistema inteiro de Modificações (Cap. 3) — Tabela 3.5 (armas, ex.: "Certeira: +2 em testes de ataque"), Tabela 3.7 (proteções) e Tabela 3.9 (acessórios). Cada modificação aumenta a categoria do item em I (mais caro/raro, análogo a upgrade de item mágico no D&D).
- **Confirmado no código:** não existe **nenhum** campo de modificação no tipo `OrdemEquipment` nem dado de lista de modificações — o sistema simplesmente não foi implementado.
- **Triagem:** ✨ feature nova (mecânica inteira faltando, não é ajuste pontual)
- **Nota de escopo:** pode ter tensão com a decisão da Fase 14 de não simular Patente completa (upgrade de categoria via modificação normalmente dependeria de posse permanente/Patente mais alta) — **a esclarecer com o usuário na execução**: modificações entram no loadout inicial (Recruta) do jeito que o livro permite, ou fica só pro pós-criação (fora do escopo do criador de fichas, já que a Patente também está fora)?
- **Status:** registrado (sem ação) — decisão de escopo pendente

### F13 — Mochila Militar (e possivelmente outros itens) não aplica seu efeito mecânico
- **Sistema:** Ordem Paranormal
- **Onde:** `equipments.json` (`mochila-militar`) + cálculo de capacidade de carga (`equipmentUtils.ts`, `getMaxCapacity`)
- **Relato:** o item Mochila Militar deveria aumentar a carga que o personagem consegue carregar; o usuário suspeita que outros itens também não estão tendo seus efeitos respeitados.
- **Confirmado no livro:** "Mochila Militar. Uma mochila leve e de alta qualidade. Ela não usa nenhum espaço e **aumenta sua capacidade de carga em 2 espaços**."
- **Confirmado no código:** `mochila-militar` em `equipments.json` só tem `{ id, name, category: 1, spaces: 0, type: "general" }` — **sem nenhum campo de bônus de carga**, e `getMaxCapacity(strength)` calcula só `max(2, 5×Força)`, sem considerar equipamento nenhum. O item existe na loja mas seu efeito mecânico não existe em lugar nenhum.
- **Triagem:** 🐛 bug (regra do livro com efeito mecânico definido, simplesmente não aplicado)
- **Suspeita a investigar (confirma a preocupação do usuário):** o tipo `OrdemGeneralItem` não tem **nenhum campo mecânico** além de `id/name/category/spaces/type` — então qualquer item "geral"/"acessório" do livro com efeito de jogo (ex.: máscara de gás +10 Fortitude vs. respiração, óculos de visão térmica anula penalidade de camuflagem, corda, algemas etc.) **certamente também não está implementado**. Provável padrão sistêmico, não só a mochila.
- **A decidir na execução:** levantar quais itens gerais/acessórios do Cap. 3 têm efeito mecânico definido no livro (não só flavor text) e decidir quais entram no escopo do criador de fichas (mochila militar/carga parece claramente dentro do escopo, por afetar a validação já existente de equipamento).
- **Status:** ✅ CORRIGIDO — campo `carryBonus` no tipo de equipamento; Mochila Militar = `carryBonus: 2`; novo `getTotalCarryCapacity(draft)` (base 5×Força + bônus dos itens) usado na validação e nos displays (passo Equipamento, Revisão, ficha). Varredura do livro confirmou que **só a Mochila Militar** afeta capacidade de carga — os demais itens têm efeitos de jogo (não de criação), cobertos pelas descrições do F11. +3 testes.

### F14 — Galeria não unifica os sistemas depois de "Concluir"; só unifica com refresh (D&D + Ordem)
- **Sistema:** ambos (D&D 5e e Ordem Paranormal)
- **Onde:** `Dnd5eApp.tsx` (linhas ~14, 88, 96-99) e `OrdemApp.tsx` (mesmo padrão, linhas ~14, 87, 95-97); `characterStore.ts` de cada sistema (`goToGallery`); `core/stores/appStore.ts` (`activeSystemId`, sem persistência)
- **Relato:** ao terminar uma ficha de Ordem, só aparecem fichas de Ordem na galeria; ao terminar uma de D&D, só aparecem as de D&D. Dando refresh (F5), aparecem todas juntas, como deveria.
- **Triagem:** 🐛 bug real — quebra a promessa central da Fase 15 (galeria "Multiverso" unificada)
- **Causa raiz confirmada no código:** cada sistema (`Dnd5eApp`/`OrdemApp`) ainda tem sua **própria galeria interna legada** (`view === 'gallery'` → renderiza `<Gallery />` do próprio sistema, componente que existia antes da unificação da Fase 15) e os botões "Concluir ✓ (voltar à galeria)"/"← Meus personagens" chamam `goToGallery()` do store **daquele sistema**, que só muda o `view` interno — nunca chama `setActiveSystem(null)` (do `appStore` central), que é o que de fato leva à `GlobalGallery` unificada. Ou seja, `App.tsx` continua renderizando `Dnd5eApp`/`OrdemApp` (porque `activeSystemId` continua `'dnd5e'`/`'ordem'`), e cada um mostra sua galeria mono-sistema por baixo do capô.
- **Por que o refresh "conserta":** `useAppStore` (`activeSystemId`) não usa persistência (`create` puro, sem `persist`/localStorage) — todo reload de página reinicializa `activeSystemId` para `null`, e `App.tsx` cai no `else` que renderiza `GlobalGallery`, mostrando os dois sistemas juntos corretamente.
- **A decidir na execução:** provavelmente a correção certa é fazer `goToGallery()`/"Concluir"/"Meus personagens" chamarem `setActiveSystem(null)` (saindo pra `GlobalGallery` de verdade) em vez de setar o `view` interno do sistema — e então **remover** as galerias internas legadas (`Gallery.tsx` de cada sistema) e o estado `view: 'gallery'` de cada store, já que a `GlobalGallery` os substituiu na Fase 15 mas ficaram como código morto/duplicado ainda em uso.
- **Status:** ✅ CORRIGIDO — `goToGallery`/`reset` dos dois stores agora chamam `setActiveSystem(null)` (voltam à `GlobalGallery` unificada); branch `view === 'gallery'` e os dois `Gallery.tsx` internos (código morto) removidos; +4 testes de regressão (D&D e Ordem).
