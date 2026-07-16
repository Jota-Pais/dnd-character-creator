# Feedbacks de Playtest (intake)

> Documento de trabalho — captura de feedbacks de usuários reais (a partir de 2026-07-09).
> Fase de **intake**: itens registrados sem ação. Execução/correção só depois do "pode executar".
> Legenda de triagem: 🐛 bug · 📖 fidelidade ao livro · 🎨 UX/polish · ✨ feature nova

## Refinamentos pós-execução (2026-07-10)

- **R1 — Ataques por arma na ficha do Ordem** (paridade com o F5 do D&D): ✅ a Revisão e a ficha impressa do Ordem ganharam uma seção **Ataques** por arma equipada — perícia (Luta/Pontaria), quantos d20 rolar (Força/Agilidade, pegando o melhor) + bônus de treino, dano (com Força no corpo a corpo), crítico e alcance. `ordemWeaponUtils.getOrdemWeaponAttack`.
- **R2 — Efeitos de combate das modificações aplicados aos números** (não só texto): ✅ Certeira/Alongada entram no bônus de ataque, Cruel no dano, Calibre Grosso adiciona +1 dado, Perigosa/Mira Laser ampliam a margem de ameaça do crítico. Campos de combate adicionados às modificações; dobrados no `getOrdemWeaponAttack`. (Dum dum/Explosiva são de munição — ficam na lista de mods do item de munição.)

---

### F1 — Descrições de equipamento no passo de Equipamento (D&D)
- **Sistema:** D&D 5e
- **Onde:** passo Equipamento (escolha do equipamento inicial)
- **Relato:** ao escolher itens (ex.: criando um ladino, apareceu opção de rapieira vs. espada curta), não há descrição do que cada equipamento é/faz. O usuário não tem como decidir sem saber dano e propriedades de cada arma. Como o objetivo do app é o jogador não precisar abrir o livro, o passo deveria mostrar, para cada opção, o dano e as propriedades (ex.: acuidade/finesse = pode usar Destreza, leve, uma mão vs. duas mãos, versátil etc.).
- **Triagem:** 🎨 UX/polish (alto valor — vai direto à proposta do produto)
- **Nota técnica:** os dados já existem estruturados em `weapons.json` (dano, tipo, propriedades) — é **exibir**, não digitalizar. Estender também a armaduras/escudos (CA, propriedades) e itens.
- **Obs.:** o próprio exemplo do usuário confunde as propriedades da rapieira (ele achou que era "duas mãos"; na verdade é acuidade + uma mão) — o que reforça a necessidade de mostrar os dados corretos.
- **Status:** ✅ CORRIGIDO — **armas** (`weaponFormat.ts`: dano + tipo + propriedades em PT — acuidade/leve/versátil/arremesso etc.), no resumo das opções fixas e no grid por filtro. **Armaduras/escudos** (2026-07-10): `formatArmorSummary` mostra CA (leve = CA+Des, média = +Des máx 2, pesada = fixa, escudo = +2) + propriedades (Força mínima, desvantagem em Furtividade). **Pacotes**: `formatPackContents` lista o conteúdo (ex.: "Mochila, Saco de Dormir, 2× Fantasia..."). Itens triviais (corda, tocha) ficam só com o nome. +6 testes no total.

### F2 — Conferir cálculo de PV total (D&D, método média)
- **Sistema:** D&D 5e
- **Onde:** cálculo de PV / Revisão
- **Relato:** ladino de nível 3, usando **média** (não rolando), deu **18 PV**. Pareceu pouco ("como se tivesse faltado um dado"). Pedido de **conferência** (não é erro com certeza).
- **Triagem:** 📖 fidelidade ao livro (regra esclarecida; falta só confirmar o valor de CON do caso)
- **Regra (confirmada no código, conferido contra o PHB na Fase 1):** nível 1 usa o **máximo** do dado de vida (não a média) + mod CON; níveis 2+ usam a média (`floor(dado/2)+1`) + mod CON. Ladino = d8 → nv1 = 8+CON, cada nível seguinte = 5+CON. A dúvida do usuário ("no nv1 seria 8+5") não procede: o "+5" só entra a partir do 2º nível; somar no nv1 contaria o 1º nível duas vezes. Código bate: `getHpAtLevel1 = hitDie + con`, `getAverageHpPerLevel = floor(hitDie/2)+1`, total = `nv1 + (média+con)×(nível−1)`.
- **Veredito:** 18 = `8 + 5 + 5` está **correto para CON 10–11 (mod 0)**. **Ponto real a confirmar:** qual a CON do ladino? Se for >11 e o total continuar 18, aí sim é bug (mod de CON não somado por nível). Ex.: CON 14 (+2) deveria dar `10+7+7 = 24`. **Aguardando o valor de CON do usuário.**
- **Status:** ✅ FECHADO (2026-07-10) — o usuário confirmou que a análise estava correta; não é bug (18 PV é o esperado para CON 10–11). Sem alteração de código.

### F3 — Ficha mostrando "2d8" de Dados de Vida no ladino nv3 (D&D)
- **Sistema:** D&D 5e
- **Onde:** "a ficha" (a esclarecer: ficha impressa / Revisão / linha de rolagem)
- **Relato:** a ficha do ladino nv3 diz que ele tem **2d8** de dados de vida. Está certo?
- **Triagem:** 📖 fidelidade ao livro (a reproduzir)
- **Regra:** Dados de Vida = nível do personagem. Ladino nv3 → **3d8** (não 2d8).
- **Análise (código):** único display de "Dados de Vida" é `PrintableSheet` linha ~179: `${level}d${hitDie}` → 3d8 pra nv3. Usa o **mesmo** `level` que produz "Pontos de Vida" 18 e "Nível" 3, então a ficha impressa **não pode** mostrar 2d8 com nível 3. O único "2" no app é a linha "Rolagens (níveis 2+)" na Revisão (mostra `nível−1` = 2 dados rolados acima do 1º nível, só no método Rolar) — é a rolagem, não o total.
- **Hipótese:** provavelmente **não é bug** (misread da linha de rolagem, ou personagem na verdade nv2). **A confirmar com o usuário:** onde exatamente viu "2d8" e se o campo "Nível" está 3. Se for a ficha impressa com Nível 3 → investigar a fundo (seria contradição com o código).
- **Status:** ✅ FECHADO (2026-07-10) — o usuário confirmou que a análise estava correta; o código mostra 3d8 (correto). Não é bug. Sem alteração de código.

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
- **Status:** ✅ CORRIGIDO — a seção "Ataques & Conjuração" do PDF virou uma **tabela por arma equipada** (Arma · Ataque · Dano · Atributo), ex.: "Rapieira · +5 · 1d8+3 perfurante · Destreza". Atributo escolhido pela regra (acuidade → melhor de FOR/DES; à distância → DES; senão FOR). Prefixo "N×" nas armas quando o personagem tem "Ataque Extra" (conta as ocorrências da feature: 2× no nv5, 3× no nv11...), com nota explicativa. `getWeaponAttack` no `weaponFormat.ts` (+4 testes) e `gatherEquippedWeapons` na ficha.

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
- **Status:** ✅ CORRIGIDO — box "Controle de Sessão (preencha a lápis)" na ficha impressa. **D&D:** PV Atual (/máx), PV Temporário (linhas em branco), Testes contra a Morte (○○○/○○○), círculos ○ marcáveis nos espaços de magia e nos recursos de pool (Fúria/Ki etc. — os que são dado, como Ataque Furtivo, ficam sem círculo). **Ordem:** PV/PE/Sanidade atuais (linhas em branco / máx). Feito nos dois sistemas.

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
- **Status:** ✅ CORRIGIDO → ↪ **SUPERADO pelo F12** — a nota inicial explicava por que a Patente *não* era escolhida; mas a decisão de 2026-07-10 (F12) tornou a Patente um parâmetro **escolhível** na criação. A nota foi substituída pelo seletor de Patente + explicação do que ela faz, no passo Equipamento.

### F11 — Nenhum item de equipamento (Ordem) tem descrição
- **Sistema:** Ordem Paranormal
- **Onde:** passo Equipamento (`EquipmentStep.tsx`); dado `equipments.json`
- **Relato:** a seção de itens precisa de descrição — o jogador precisa saber o que está escolhendo (mesmo pedido do F1, mas pro Ordem).
- **Confirmado no código:** dos **70 itens** de `equipments.json`, **todos os 70** têm o campo `description` vazio/ausente (o tipo `OrdemEquipmentBase` já tem `description?: string` opcional — é só um gap de dado, não de modelagem). Armas/proteções têm campos mecânicos (dano, categoria, Defesa etc.) exibidos, mas nenhum texto explicativo do item em si (o que ele faz, pra que serve).
- **Triagem:** 🎨 UX/polish (mesmo princípio do F1 — decisão informada é a proposta central do produto)
- **A decidir na execução:** digitalizar as descrições do Cap. 3 do livro pra cada item (armas, proteções, granadas, acessórios, itens gerais) e exibi-las no passo Equipamento (e Revisão/ficha, se fizer sentido).
- **Status:** ✅ CORRIGIDO — os 70 itens ganharam `description` em `equipments.json`, exibida no passo Equipamento. Itens gerais/acessórios/explosivos/proteções digitalizados fielmente do Cap. 3 (com o efeito mecânico: máscara de gás +10 Fortitude, taser 1d6 + atordoado, granadas, etc.); armas e munições receberam descrição funcional curta (os stats já aparecem nos chips). Teste de integridade garante que nenhum item fique sem descrição. (Nota: a extração via workflow paralelo falhou por um bug de args + limite de sessão; refeito inline lendo o livro.)

### F12 — Sistema de Modificações de arma/proteção/acessório não existe (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** ausente em `equipments.json`/`equipment.ts` e no `EquipmentStep.tsx`
- **Relato:** as armas precisam ter como adicionar modificações.
- **Confirmado no livro:** existe um sistema inteiro de Modificações (Cap. 3) — Tabela 3.5 (armas, ex.: "Certeira: +2 em testes de ataque"), Tabela 3.7 (proteções) e Tabela 3.9 (acessórios). Cada modificação aumenta a categoria do item em I (mais caro/raro, análogo a upgrade de item mágico no D&D).
- **Confirmado no código:** não existe **nenhum** campo de modificação no tipo `OrdemEquipment` nem dado de lista de modificações — o sistema simplesmente não foi implementado.
- **Triagem:** ✨ feature nova (mecânica inteira faltando, não é ajuste pontual)
- **Decisão de escopo (2026-07-10):** o usuário decidiu que **Patente e Modificações são obrigatórias** — Patente vira um parâmetro escolhível na criação (como o NEX é o "nível" do agente), e as Modificações entram junto. Isso **revoga** a decisão da Fase 14 ("sem Patente, loadout fixo de Recruta"). Implementação em 2 fases.
- **Status:** 🔄 EM ANDAMENTO —
  - **Fase A (Patente) ✅ CONCLUÍDA:** `patente` no draft + `patentes.json` (Tabela 3.1) + `patenteUtils` (getPatente/getCategoryLimit/isValidPatente); seletor de Patente no passo Equipamento; validação passou a usar o limite por categoria da Patente (Cat 0 ilimitada, I–IV pela tabela) no lugar da regra fixa "≤2 Cat I, nada de II+"; a loja mostra todas as categorias com contador por categoria; proficiência de arma virou **informativa** (não bloqueia — o livro permite possuir sem proficiência, e isso destrava armas pesadas de Patente alta); Revisão/ficha mostram a Patente. +8 testes.
  - **Fase B (Modificações) ✅ CONCLUÍDA:** `modifications.json` (23 mods das Tabelas 3.5/3.7/3.9) + tipo + `modificationUtils` (aplicabilidade por tipo de arma/proteção/acessório, "não acumula igual", conflitos como Reforçada×Discreta); campo `equipmentModifications` no draft; cada mod **sobe a categoria efetiva em I** (`getEffectiveCategory`) e consome um slot da Patente na validação; efeitos de **espaço** (Discreta −1, Reforçada/Blindada +1) e **Defesa** (Reforçada +2) aplicados de verdade (`getModifiedSpaces`/`getModifiedDefenseBonus`), não só texto; UI de modificação por item selecionado no passo Equipamento (bloqueia mod que estouraria a Patente); Revisão/ficha listam as mods e a categoria efetiva. +7 testes.
- **Status geral:** ✅ CONCLUÍDO (Fases A + B).

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

### F15 — Método "Personalizado" de atributos no D&D (feature nova)
- **Sistema:** D&D 5e
- **Onde:** passo Atributos (`AbilitiesStep` + `MethodSelector`)
- **Relato:** além dos métodos existentes (Array Padrão, Compra de Pontos, Rolagem), queria uma opção **custom** onde a pessoa digita o número que quiser em cada atributo, sem passar do máximo (18 — a faixa dos dados, já que é o equivalente a três 6).
- **Triagem:** ✨ feature nova
- **Regra:** método manual/homebrew — cada atributo livre na faixa dos dados de criação (3 a 18, do 4d6 descartando o menor), sem limite de soma. Os bônus de raça entram por cima (18 + racial pode chegar ao teto 20).
- **Status:** ✅ FEITO (2026-07-10) — novo método `'custom'`: card no seletor, `CustomPanel` com input editável por atributo (+/− e digitação, clamp 3–18 no blur), validação `isAbilitiesStepComplete` (todos em 3–18) e `clampCustomScore`. Import robusto (ABILITY_METHODS aceita 'custom'). +8 testes (validação, clamp, render do painel).

### F16 — Aumento de Vigor por NEX tem que aumentar o PV retroativamente (desde o NEX 5%)
- **Sistema:** Ordem Paranormal
- **Onde:** cálculo de PV (Aumentos de Atributo do passo Progressão, NEX 20/50/80/95%)
- **Relato:** em NEX maiores o personagem ganha mais pontos de atributo; se ganhar +1 de Vigor num desses aumentos, "tem que lembrar de aumentar a vida dele desde o nível 0" — ou seja, o PV precisa ser recalculado retroativamente, como se o Vigor novo valesse desde o começo.
- **Triagem:** 📖 fidelidade ao livro (conferência de regra)
- **Regra (conferida no livro):** PV máximo é característica **derivada** de classe + Vigor (pág. 36, "Toques Finais"): inicial (20/16/12 + Vig) e "+X PV (+Vig) **a cada novo nível de exposição**". Logo, aumentar o Vigor recalcula o PV em todos os degraus, do 5% ao NEX atual. Mesmo princípio pro PE com Presença. (O livro reforça essa lógica retroativa no poder Potencial Aprimorado: "se escolher este poder em NEX 30%, recebe 6 PE".)
- **Análise (código):** **já está correto** nos pontos que valem: `deriveStats` calcula `PV = inicial + Vig + degraus×(porNex + Vig)` e a Revisão + ficha impressa passam `getEffectiveAttributes(draft)` (base + aumentos de NEX, teto 5) — então +1 Vigor no NEX 50% soma +1 PV do inicial e +1 por degrau, retroativo de verdade. Idem PE/Presença.
- **Gaps encontrados na conferência:** (1) o preview de PV/PE no passo **Classe** usava `draft.attributes` (base) — ao voltar pra lá depois de escolher aumentos na Progressão, mostrava PV/PE menores que os da Revisão; (2) não havia teste travando o comportamento retroativo (obrigatório pra fórmula de derivação, pelo CLAUDE.md).
- **Status:** ✅ CORRIGIDO — ClassStep passou a usar `getEffectiveAttributes`; +2 testes de integração (aumentos de Vigor→PV e Presença→PE recalculados retroativamente em todos os degraus).

### F17 — Itens Amaldiçoados (maldições) no equipamento (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** passo Equipamento + Revisão + ficha impressa
- **Relato:** o usuário viu numa ficha um "revólver ritualístico energético", perguntou o que significava e pediu pra **adicionar itens amaldiçoados ao app**, bem detalhado (inclusive o custo do ritual da maldição Ritualística), porque quer montar uma ficha com um **revólver senciente**.
- **Triagem:** ✨ feature nova (capítulo "Itens Amaldiçoados", pág. 144-148 do livro)
- **Regras implementadas (conferidas no livro):** maldições funcionam como modificações (benefício × aumento de categoria). A 1ª maldição sobe a categoria em **II**, as seguintes em **I**; ajustes acumulam com os das modificações; **maldições iguais não se acumulam** (nem no item, nem os bônus entre itens); **elementos opressores não coexistem** no mesmo item (ciclo: Sangue⊳Conhecimento⊳Energia⊳Morte⊳Sangue). 34 maldições: 12 de armas, 10 de proteções, 12 de acessórios (só utensílios/vestuários — kits fora, como no livro).
- **Efeitos nos números** (como no R2): Defesa (Repulsora/Cinética/Letárgica +2, Defesa +5), atributos de acessórios (Carisma +1 Pre **sem PE**, Sagacidade +1 Int, Destreza +1 Agi, Disposição +1 Vig → **PV retroativo**, Pujança +1 For → carga/dano), Vitalidade +15 PV, Esforço Adicional +5 PE, Lancinante/Erosiva +1d8 no dano, Predadora duplica a margem de ameaça (antes dos aumentos fixos — fuzil de caça 19→17, exemplo do livro) e sobe o alcance. Efeitos condicionais (2 PE etc.) ficam como texto integral na ficha, com custos — Ritualística inclui a Tabela 5.2 (1º círculo 1 PE, 2º 3, 3º 6, 4º 10).
- **Escolhas de parâmetro:** Antielemento (elemento, 1d4), Proteção Elemental (elemento, incl. Medo) e Conjuração (ritual de 1º círculo vinculado) exigem escolha na aplicação — validação bloqueia escolha pendente.
- **Curiosidade:** o exemplo original do usuário (Ritualística + Energética) é **ilegal pelo livro** — Conhecimento oprime Energia; a validação bloqueia essa combinação. O revólver senciente (Cat I → III) exige patente Agente Especial+.
- **Fora do escopo (por ora):** itens amaldiçoados **especiais** (Coração Pulsante, Punhos Enraivecidos etc., pág. 148+) — objetos únicos com mecânicas próprias; entram se houver pedido.
- **Status:** ✅ FEITO (2026-07-12) — `data/curses.json` + `types/curse.ts` + `utils/curseUtils.ts`; categoria/validação em `equipmentUtils`, combate em `ordemWeaponUtils`, stats via `getCursedDerivedStats` (Revisão, ficha impressa e preview da Classe), UI no `EquipmentStep` (seletor roxo + selects de parâmetro), seção "Itens Amaldiçoados" detalhada na Revisão e no PDF. Import robusto (campos novos com default). +22 testes.

### F18 — Permitir duas (ou mais) unidades do mesmo item, com características diferentes (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** passo Equipamento (+ Revisão, ataques e ficha impressa)
- **Relato:** o usuário vai jogar com **2 revólveres com características diferentes** (maldições/modificações distintas) e o sistema não permitia: a seleção era um conjunto de ids únicos (clicar de novo removia o item) e mods/maldições eram chaveadas pelo id do item — dois revólveres compartilhariam tudo.
- **Triagem:** ✨ feature (limitação real de modelo de dados; o livro não impõe "1 de cada item" — só carga e limite de categoria por Patente)
- **Solução (modelo de unidades):** `equipmentChoices` guarda **unidades**: a 1ª unidade de um item usa o próprio id (`revolver`) e duplicatas ganham sufixo (`revolver#2`, `#3`...). Mods, maldições e escolhas de parâmetro são chaveadas pela unidade. **Saves/exports antigos continuam válidos sem migração** (1 unidade por item = mesmo formato). Carga, contadores de categoria da Patente e Defesa contam por unidade.
- **UI:** card do item mostra "×N"; botão "＋ adicionar outra unidade"; cada unidade tem seu bloco próprio de Modificações/Maldições, com cabeçalho numerado ("Revólver #2 · Cat III") e botão de remover. Revisão/ataques/PDF listam cada unidade com rótulo numerado — cada revólver vira uma linha própria na tabela de Ataques, com seus números.
- **Detalhe:** o elemento-alvo escolhido do Antielemento agora aparece na ficha ("elemento-alvo: Energia") e é por unidade — dá pra ter dois revólveres Antielemento contra elementos diferentes.
- **Status:** ✅ FEITO (2026-07-12) — `instanceItemId`/`newInstanceUid`/`getInstanceLabel`/`getDraftInstanceCategory` em `equipmentUtils`; `EquipmentStep` reestruturado por unidade; Revisão/PrintableSheet por unidade; `formatCurseChoiceDetail` em `curseUtils`. +4 testes (uids, ataques distintos por unidade, limite de Patente com 2× Cat III, escolhas por unidade).

### F19 — Stepper clicável: voltar/pular pra qualquer etapa em ordem livre (D&D + Ordem)
- **Sistema:** ambos (o `StepIndicator` é compartilhado)
- **Onde:** indicador de etapas do wizard (as "moedas" no topo)
- **Relato:** o usuário quer clicar em qualquer etapa do stepper pra voltar e mudar o que quiser (atributos, perícias...) em ordem livre, em vez de só andar com próximo/anterior.
- **Triagem:** 🎨 UX (navegação)
- **Regra de alcance:** clicável = toda etapa cujas anteriores estão completas — pra trás sempre, pra frente até o 1º passo incompleto (o mesmo alcance de apertar "próximo" repetidamente; **nunca pula validação**). A checagem existe na UI (etapa não-clicável) e no store (`goToStep` valida de novo — defesa em profundidade, como o `nextStep`).
- **Status:** ✅ FEITO (2026-07-12) — `goToStep` nas duas stores (persiste a ficha na biblioteca ao navegar, como próximo/anterior); `StepIndicator` ganhou `onStepClick` + estado clicável (hover com scale/dourado, `aria-current`, botão desabilitado nas inalcançáveis); `OrdemApp`/`Dnd5eApp` calculam o alcance via `isComplete` de cada etapa. +3 testes de store (navegação livre com ficha completa, bloqueio além do 1º incompleto, persistência).

### F20 — Perícia repetida (origem × classe) deve dar direito a "escolher outra" (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** passo Perícias (contagem de escolhas livres)
- **Relato:** o usuário perguntou o que acontece quando fica treinado na mesma perícia duas vezes (ex.: Vontade pela origem E pela classe) — "ganho alguma coisa com isso?"
- **Triagem:** 📖 fidelidade ao livro (a resposta revelou um gap real)
- **Regra (pág. 25):** perícia repetida **não acumula nada** (treinada 2× não vira veterana — grau só sobe em NEX 35/70% ou pelo poder Treinamento em Perícia). Em vez disso: *"Se receber uma perícia que já havia recebido pela origem, escolha outra."*
- **Análise (código):** nas perícias **de escolha** (grupos do Combatente e escolhas livres) o app já excluía as reservadas das opções — o jogador é obrigado a "escolher outra" ✓. O gap era nas **fixas do Ocultista** (Ocultismo, Vontade): colidindo com a origem (Religioso/Servidor Público/Vítima dão Vontade; Cultista Arrependido/Teórico da Conspiração dão Ocultismo), o app deduplicava e o jogador **perdia uma perícia** sem compensação.
- **Status:** ✅ CORRIGIDO (2026-07-12) — cada perícia fixa da classe repetida da origem soma **+1 à escolha livre** (`getFixedSkillOverlapWithOrigin` + `getRequiredFreeSkillCount`); o passo Perícias explica a compensação ("você ganhou +1 na escolha livre") e o preview da Classe mostra a contagem certa. Validação acompanha automaticamente (usa a mesma contagem). +2 testes (Vítima+Ocultista → 7 escolhas; sem colisão → inalterado). Nota: grupos de escolha nunca zeram com os dados atuais (nenhuma origem cobre as duas opções de um grupo).

### F21 — Item de categoria menor pode ocupar vaga de categoria maior (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** passo Equipamento (limites de requisição da Patente, Tabela 3.1)
- **Relato:** o usuário pediu pra permitir usar um item de categoria menor num slot de categoria maior, **sinalizando muito bem** — ex.: "4/3 itens de categoria I e 1/2 itens de categoria II, e já marcar como máximo atingido".
- **Triagem:** ✨ decisão de mesa (o livro define o limite estritamente por categoria — "até três itens de categoria I e um item de categoria II", pág. 63; a extensão "vaga maior aceita item menor" é ruling do usuário, natural e generosa)
- **Regra implementada:** viabilidade = pra todo nível k (I→IV), nº de itens com categoria ≥ k ≤ nº de vagas com categoria ≥ k (itens de categoria maior têm prioridade; item menor só desce em vaga maior sobrando). Vale pra unidades, modificações e maldições (que sobem a categoria efetiva) — o botão só habilita se a configuração nova continuar cabendo nas vagas.
- **Sinalização:** contadores por categoria mostram `itens/limite` (ex.: **4/3** em Cat I, em dourado com "+1 na vaga de cat. maior") e a categoria que emprestou mostra a vaga ocupada (**1/1** com "inclui 1 de cat. menor"); "máximo atingido" quando as vagas esgotam; vermelho + "sem vaga — remova um item" só quando realmente inviável. Texto da Patente explica a regra; cards bloqueados dizem "Sem vaga na Patente".
- **Status:** ✅ FEITO (2026-07-12) — `getEffectiveCategoryCounts`/`fitsPatenteSlots`/`fitsWithAdjustedCounts`/`getCategorySlotAllocation` em `equipmentUtils`; validação (`isEquipmentStepComplete`) e todas as checagens da UI trocadas pra simulação de vagas. +4 testes (condição de viabilidade, Operador com 4× Cat I válido / 5× inválido, alocação de exibição, prioridade do item de categoria maior).

### F22 — Componentes Ritualísticos (e Itens Paranormais da Tabela 3.10) faltando no equipamento (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** passo Equipamento (`equipments.json`) + aviso na Revisão
- **Relato:** o usuário perguntou se os componentes ritualísticos precisam entrar no inventário, se ocupam carga e por que não aparecem nos equipamentos.
- **Triagem:** 📖 fidelidade ao livro (lacuna de digitalização — a Tabela 3.10 "Itens Paranormais", pág. 66-68, ficou fora do `equipments.json`)
- **Regra (conferida no livro):** conjurar ritual exige **uma mão livre + manipular componentes ritualísticos do elemento** (exceto Medo) — sem eles, não conjura (pág. 119). Componentes **não são gastos** na conjuração. Na Tabela 3.10: **Categoria 0, 1 espaço** (por elemento; não existem componentes de Medo).
- **Implementado:** seção **"Itens Paranormais"** no passo Equipamento com a Tabela 3.10: 4 kits de Componentes Ritualísticos (Conhecimento/Energia/Morte/Sangue, Cat 0, 1 esp.) + Amarras de (Elemento), Câmera de Aura Paranormal, Emissor de Pulsos, Escuta de Ruídos e Scanner de Manifestação (todos Cat II, 1 esp.), com descrições completas e custos. **Aviso inteligente**: Ocultista com rituais de um elemento sem os componentes correspondentes vê alerta âmbar no Equipamento e na Revisão (rituais multi-elemento contam pelo elemento escolhido; Medo é isento). Não bloqueia a ficha (possuir é opcional; conjurar é que não dá).
- **Pendência:** o **Medidor de Estabilidade da Membrana** tem descrição no livro (pág. 67) mas **não aparece na Tabela 3.10 extraída** (sem categoria/espaço) — deixado de fora até o usuário confirmar os dados no livro físico.
- **Status:** ✅ FEITO (2026-07-12) — 9 itens novos em `equipments.json` (campos `paranormal` e `ritualComponentFor`), `getMissingRitualComponentElements` em `equipmentUtils`, avisos no `EquipmentStep` e `ReviewStep`. +4 testes.

### F23 — Ficha imprimível do Ordem no formato da Ficha de Agente oficial, em 2 páginas
- **Sistema:** Ordem Paranormal
- **Onde:** `PrintableSheet.tsx` (ficha impressa/PDF)
- **Relato:** o usuário quer o PDF em **duas páginas**, seguindo o formato da Ficha de Agente oficial da Jambo (`Ficha Branca 1.0.pdf`) — sem os desenhos, só os dados dispostos da mesma forma.
- **Triagem:** 🎨 UX (layout de impressão)
- **Implementado — Página 1:** cabeçalho Personagem/Jogador; **Atributos** em arranjo pentagonal (AGI no topo, FOR/INT, PRE/VIG); caixas Origem/Classe; NEX% + PE/rodada + Desl.; PV/PE/SAN com campo "Atuais" pra lápis (substitui o box de Controle de Sessão do F7 — mesmo papel, formato oficial); Defesa com a fórmula (=10+AGI+Equip.+Outros); linhas Proteção/Resistências; tabela completa das **28 perícias** (marcadores * somente treinada e + penalidade de carga, dados = atributo em d20, bônus de treino 0/+5/+10/+15, coluna "Outros" em branco; treinadas em negrito); **Ataques** por arma com linhas extras em branco.
- **Página 2** (`break-after: page`): **Habilidades & Rituais** (poder de origem, habilidade de classe, trilha, poderes e rituais com elemento/círculo/**custo em PE** — Tabela 5.2) + box **DT de Rituais** = 10 + limite de PE por rodada + Presença (exemplo do livro, pág. 121: Pre 3/NEX 5% → 14); **Inventário** (Pontos de Prestígio, Patente, Limite de Itens I–IV, Limite de Crédito, Carga Máx., tabela Item/Categoria/Espaços com mods/maldições); Itens Amaldiçoados detalhados; **Descrição** (Aparência/Personalidade/Histórico/Objetivo com linhas em branco + conceito).
- **Status:** ✅ FEITO (2026-07-12) — smoke test atualizado pro novo layout; classe `.page-break` no CSS de impressão. Ajustes pós-feedback: coluna Dados só com quantidade + atributo (d20 no cabeçalho); Habilidades e Rituais em seções separadas.

### F24 — Personalização da ficha: Ritual Predileto e perícia de ataque (Lâmina Maldita) (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** passo Revisão (nova seção "Personalização") + custos de rituais na Revisão e no PDF + ataques
- **Relato:** (1) o poder **Ritual Predileto** não deixava escolher qual ritual é o predileto — a ficha marcava o custo errado e o jogador gastaria PE errado na mesa; (2) com a **Lâmina Maldita** (trilha Lâmina Paranormal), os ataques com a arma amaldiçoada podem usar **Ocultismo** em vez de Luta/Pontaria, e a ficha não permitia. O usuário sugeriu uma tela de "customizações da ficha" no final (qual seu ritual favorito? com qual perícia ataca? etc.).
- **Triagem:** 📖 fidelidade ao livro + ✨ UX (seção de personalização)
- **Regras (conferidas):** Ritual Predileto — "Escolha um ritual que você conhece. Você reduz em –1 PE o custo do ritual. Essa redução se acumula com reduções fornecidas por outras fontes." Lâmina Maldita (NEX 10%) — aprende Amaldiçoar Arma (se já conhece, custo −1 PE) e, ao conjurá-lo, pode usar Ocultismo em vez de Luta/Pontaria nos ataques com a arma amaldiçoada.
- **Implementado:** seção **"Personalização"** na Revisão com: select do **ritual predileto** (aparece só com o poder, inclusive via Versatilidade) e select da **perícia de ataque por arma** (Automática / Luta / Pontaria / Ocultismo — com nota da Lâmina Maldita). Custos de ritual na Revisão e no PDF agora saem calculados com as reduções e a justificativa ("custo 0 PE (predileto −1, Lâmina Maldita −1)"), com piso 0; o predileto ganha ★ no PDF. Ataques com Ocultismo rolam Intelecto d20 + treino de Ocultismo (dano corpo a corpo segue com Força). Campos novos: `favoriteRitual` e `weaponSkillChoices` (import robusto).
- **Fora do escopo (anotado):** outros poderes com escolha embutida — Especialista/Mestre em Elemento (elemento) e Transcender (poder paranormal) — ainda sem picker; e a Lâmina Maldita "aprende Amaldiçoar Arma" não adiciona o ritual automaticamente à lista. Ficam pra próxima rodada se o playtest pedir.
- **Status:** ✅ FEITO (2026-07-12) — `hasClassPower`/`hasFavoredRitualPower`/`hasLaminaMaldita`/`getRitualCost` em `characterUtils`; `skillOverride` no `getOrdemWeaponAttack`; `RITUAL_COST` movido pro `ritualUtils`. +5 testes.

### F25 — Ritual Potente na ficha + varredura de poderes com efeito mecânico não aplicado (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** rolagens/números derivados dos poderes de classe (ficha, Revisão, ataques, Defesa, proficiências)
- **Relato:** o usuário notou que o **Ritual Potente** (soma Intelecto no dano/cura dos rituais) não aparecia na ficha, e pediu uma **auditoria geral**: "a cada poder novo que eu olho, a funcionalidade não está sendo aplicada na prática".
- **Triagem:** 📖 fidelidade ao livro (varredura dos 46 poderes de classe)
- **Aplicados nos números (efeitos determinísticos):**
  - **Ritual Potente** — nota destacada nas seções de Rituais (Revisão + PDF) com o valor calculado: "some +Int nas rolagens de dano ou efeitos de cura" (os dados ficam nas descrições dos rituais; a nota evita parsear texto e cobre discente/verdadeiro).
  - **Golpe Pesado** — +1 dado de dano (mesmo tipo) em armas corpo a corpo.
  - **Tiro Certeiro** — +Agilidade no dano de armas de disparo (arco/besta/balestra; NÃO armas de fogo).
  - **Balística Avançada** — +2 de dano em armas táticas de fogo + proficiência.
  - **Ninja Urbano** — +2 de dano em armas táticas corpo a corpo + proficiência.
  - **Tanque de Guerra** — +2 na Defesa da proteção pesada equipada (a RD +2 fica no texto do poder).
  - **Armamento Pesado** — proficiência com armas pesadas (sinalização "Sem Proficiência" some).
- **Ficam como texto (condicionais — dependem de gasto de PE/ação/contexto):** Ataque de Oportunidade, Combate Defensivo (+5 Defesa é ativável), Golpe Demolidor, Segurar o Gatilho, Sentido Tático, Fogo de Cobertura, Mãos Rápidas, Reflexos Defensivos (+5 condicionado a alcance curto), bônus situacionais de perícia (Hacker, Envolto em Mistério, Identificação Paranormal, Primeira Impressão — a coluna "Outros" da ficha serve pra isso), etc.
- **Pendências (precisam de escolha própria, como o F24):** **Treinamento em Perícia** (escolher 2 perícias — não vira perícia treinada hoje!), **Especialista/Mestre em Elemento** (elemento), **Transcender** (poder paranormal), **Mochila de Utilidades** (item −1 categoria/−1 espaço), **Artista Marcial** (ataque desarmado não existe como arma no app). Registrado pra próxima rodada.
- **Status:** ✅ FEITO (2026-07-12) — bônus de dano/Defesa/proficiência via `hasClassPower` no `ordemWeaponUtils`/`equipmentUtils`; nota do Ritual Potente na Revisão e no PDF. +3 testes.

### F26 — Ritual armazenado na arma Ritualística visível na ficha (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** Personalização (Revisão) + seção Itens Amaldiçoados (Revisão e PDF)
- **Relato:** o usuário achou que o "revólver senciente" tinha um ritual e não via nada na ficha. **Esclarecimento de regra:** Senciente não guarda ritual (arma flutua/ataca sozinha); quem guarda é a **Ritualística** — o ritual é conjurado *pra dentro* da arma em jogo (pagando os PE) e descarregado num acerto, com troca livre. O que faltava era um lugar na ficha pra registrar o ritual armazenado.
- **Status:** ✅ FEITO (2026-07-12) — na Personalização, armas com Ritualística ganham select opcional do ritual armazenado (dentre os conhecidos, com o custo em PE); a escolha aparece na seção Itens Amaldiçoados ("ritual armazenado: X") na Revisão e no PDF; sem escolha, o PDF imprime "Ritual armazenado (a lápis): ______". Armazenada em `equipmentCurseChoices` (`uid:ritualistica`), sem validação obrigatória (é opcional por regra). Ajustes: no PDF as maldições entram na seção "Habilidades / Poderes" (sem seção própria) e a Descrição foi removida.

### F27 — Poderes com escolha embutida: Treinamento em Perícia + Especialista/Mestre em Elemento (Ordem)
- **Sistema:** Ordem Paranormal
- **Onde:** passo Progressão (escolha embutida sob o poder) + perícias/custos derivados
- **Relato:** pendência do F25 — o usuário achou que já estava feito e mandou seguir.
- **Implementado:** campo `powerParams` (por slot: `slot-N`/`versatility`). **Treinamento em Perícia**: 2 selects sob o poder — perícia destreinada vira treinada; já treinada sobe de grau (NEX 35%+ → veterano, 70%+ → expert), tudo refletido em `getTrainedSkills`/`getSkillGrade` (ficha, perícias, ataques). **Especialista/Mestre em Elemento**: chips de elemento; Mestre aplica −1 PE nos rituais do elemento no `getRitualCost` (acumula com predileto/Lâmina Maldita). Validação: o passo Progressão só completa com os parâmetros preenchidos (`arePowerParamsComplete`); import robusto.
- **Pendências restantes do pacote:** Transcender (precisa digitalizar os poderes paranormais do livro — sessão dedicada, decisão do usuário), Especialista em Elemento não anota o +2 de DT na ficha (a DT exibida é a geral), e o parâmetro de poder escolhido via **Versatilidade** não tem UI (o modelo já suporta a chave `versatility`).
- **Status:** ✅ FEITO (2026-07-12) — +3 testes. **Mochila de Utilidades** saiu em seguida (decisão do usuário: a escolha do item mora no passo Equipamento): toggle "🎒" por unidade não-arma quando o agente tem o poder (um item por vez), aplicando −1 categoria (`getDraftInstanceCategory`) e −1 espaço (`getModifiedSpaces`) — reflete em contadores, vagas da Patente, carga e ficha. Campo `utilityBackpackItem` (limpo ao remover a unidade; import robusto). +1 teste (578 no total).

### F28 — Trilhas em colunas no passo Progressão (Ordem)
- **Relato:** a página de Progressão tinha muito espaço vazio; o usuário pediu uma coluna por trilha, com os detalhes à mostra sem precisar clicar.
- **Status:** ✅ FEITO (2026-07-12) — grid de até 5 colunas na largura da página, cada card com descrição, requisito e os 4 poderes (🔒 nos não alcançados); demais seções seguem na coluna central.

### F29 — NEX 0% existe; 0→5% conta como nível de exposição (ruling do usuário, Ordem)
- **Relato:** dá sim pra fazer ficha NEX 0%, e um ocultista NEX 5% com Vig 1 tem **16 PV** — os valores "iniciais" das classes valem no 0%, e cada degrau (inclusive 0→5%) concede os ganhos por NEX de PV/PE/SAN.
- **Status:** ✅ FEITO (2026-07-12) — NEX_STEPS ganhou o 0%; PV/PE/SAN derivam com +1 degrau em todos os NEX (ocultista 5% Vig1 = 16 PV ✓); limite de PE preservado pela Tabela 1.2 (5%→1, 10%→2... mínimo 1 no 0%); rituais seguem 3 iniciais no 5% (+1 por NEX acima); slider do Nome começa no 0% ("pessoas comuns"); Progressão vazia até 5%. Testes recalculados (580 no total).

### F30 — Redesign do módulo Ordem (handoff em docs/Novo design da aplicação de ordem)
- **Relato:** o usuário entregou um handoff hifi (README + protótipo HTML, seção 2a aprovada) com novo padrão visual do Ordem — só design; regras intactas.
- **Status:** 🔄 EM ANDAMENTO (2026-07-13) — **Fase 1 ✅**: tokens novos no `.theme-ordem` (vermelhos + neutros de alto contraste, re-tematizando todos os passos), sidebar fixa de 250px (logo/etapas/estados ✦/Meus agentes), overline "Etapa N de 9", sigilo girando (240s) + vinheta, StepNav como barra fixa com CTA vermelho. **Fase 2 ✅**: galeria neutra em linhas por sistema (avatar losango, Abrir tintado, ações 35px). **Pendente**: aplicar padrões finos por tela (catálogo visível de rituais no lugar de selects, mestre-detalhe em Origem/Classe conforme protótipo, CTA desabilitado dizendo "o que falta", chips de perícia no padrão novo, etiquetas coloridas de elemento).

### F31 — Efeitos determinísticos de Origem, Trilha e Poderes estruturados na ficha (Ordem)
- **Relato:** Continuação da varredura (iniciada no F25) para aplicar bônus estáticos à ficha, desta vez cobrindo origens e trilhas.
- **Implementado em 5 fases:**
  1. **Efeitos de Origem:** Stats base (Patrulha +2 Def; Calejado +PV; Cicatrizes +SAN; Dedicação +PE e limite). Dano de Mão Pesada e Para Bellum.
  2. **Rituais:** Bônus na DT (Rituais Eficientes +5, Especialista +2), custo (Tatuagem Ritualística −1), bônus no limite de PE (Presença Poderosa).
  3. **Resistências:** Mente Sã, Inabalável, Eu Já Sabia adicionados à aba de resistências. Regra de empilhamento de Resistência a Dano (RD) aplicada.
  4. **Inventário:** Inventário Otimizado passa a somar Intelecto à carga.
  5. **Combate:** Ferramenta de Trabalho (+1 arma escolhida) e ataque Desarmado do Artista Marcial resolvidos.
- **Pendências justificadas:** Remendão (não há tag de itens "de investigação") e Traços do Outro Lado / Transcender (Poderes Paranormais ainda não digitalizados).
- **Status:** ✅ FEITO (2026-07-14) — 5 fases implementadas, regras de RD empilhadas e testes cobrindo todas as mecânicas acima (678 testes passando).

### F32 — Amaldiçoar Arma pode ser conhecido mais de uma vez, uma por elemento (Ordem)
- **Relato:** o usuário quer dois "Amaldiçoar Arma" na mesma ficha, um de cada elemento — segundo ele, é preciso aprender o ritual de novo pra cada elemento (FAQ/errata oficial da Jambô, confirmada pelo usuário quando perguntado pela fonte).
- **Achado no código:** a regra geral "não se conhece o mesmo ritual duas vezes" (`isRitualStepComplete`) barrava qualquer repetição de id, inclusive rituais multi-elemento — e `ritualElementChoices` era keyed por **id do ritual**, incapaz de guardar dois elementos diferentes pra duas instâncias do mesmo id.
- **Implementado:** `ritualElementChoices` passou a ser keyed por **instância** (índice do slot em `ritualChoices`, ou `granted:<id>` pra rituais concedidos por trilha) em vez de por id do ritual. `isRitualStepComplete` permite repetir um ritual multi-elemento desde que o elemento escolhido seja diferente em cada instância (a duplicata real — mesmo ritual + mesmo elemento 2× — continua barrada). No passo Rituais, o seletor de ritual não exclui mais rituais multi-elemento já escolhidos noutro slot, e os botões de elemento desabilitam o elemento já usado por outra instância do mesmo ritual. `getRitualCost`/`getRitualDt`/`getMissingRitualComponentElements` resolvem o elemento por instância (slot ou concedido), então Mestre/Especialista em Elemento e o aviso de Componentes Ritualísticos calculam certo mesmo com duas instâncias de elementos diferentes.
- **Limitação conhecida (não resolvida — fora do escopo pedido):** Ritual Predileto e o "ritual armazenado" da arma Ritualística guardam só o **id** do ritual (não a instância) — se o personagem tiver duas instâncias de Amaldiçoar Arma, marcar uma como predileta desconta PE nas duas (o dropdown deduplica por id, mostrando o ritual uma vez só). Regra rara de acontecer na prática (exige favoritar justo um ritual do qual já se tem 2 cópias).
- **Status:** ✅ FEITO (2026-07-15) — verificado no browser (Playwright/Edge): as duas instâncias aparecem no passo Rituais com elementos mutuamente exclusivos, e na Revisão/PDF com custo/DT e aviso de componentes corretos por elemento. +4 testes.
