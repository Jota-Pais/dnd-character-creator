# Descanso — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR, Cap. 8 "Aventurando", seção "Descanso", pág. 188. Trechos de apoio: Cap. 1 (págs. 12 e 15), Cap. 2 (pág. 24), Cap. 6 "Multiclasse" (pág. 165), Cap. 6 "Talentos" (pág. 172), Cap. 9 "Combate" (págs. 199-200), Cap. 10 "Conjuração" (pág. 203), descrições de classe (págs. 53, 54, 58, 65, 80, 85 e 97) e Apêndice A "Condições" (pág. 292).
> Digitalizado do extrato `docs/_book-extracts/dnd-phb.txt` (linhas 16786-16831, mais as indicadas em cada seção). Esta é a **fonte da verdade documental** para o descanso no módulo de jogo (pipeline: livro → este doc → dados/tipos/utils → UI).
>
> Escopo: descanso curto, descanso longo e Dados de Vida. Exaustão e recursos de classe aparecem só como **referência cruzada**: as regras completas ficam em `docs/regras-condicoes.md` e na etapa de recursos de classe.

## 1. Regra geral (pág. 188)

- Os aventureiros precisam descansar: tempo para dormir e comer, cuidar dos ferimentos, "atualizar suas mentes e espíritos para conjurar magias" e se preparar para mais aventuras (linhas 16786-16792).
- São dois tipos: **descansos curtos** no meio de um dia de aventuras e um **descanso longo** ao fim do dia (linhas 16793-16795).

## 2. Dados de Vida — o que são e quantos você tem (págs. 12, 15 e 165)

- **Tipo e quantidade:** a ficha registra o **tipo** de Dado de Vida e o **número** de Dados de Vida. Depois de um descanso, você pode gastá-los para recuperar pontos de vida (pág. 12, linhas 844-849).
- **1 por nível:** no 1º nível o personagem tem 1 Dado de Vida, do tipo definido pela classe (pág. 12, linhas 795-796); cada nível ganho dá **1 Dado de Vida adicional** (pág. 15, linhas 1186-1187).
- **Máximo:** o total de Dados de Vida é **igual ao nível do personagem** (pág. 188, linhas 16802-16804).
- **Tipo por classe:** d12 bárbaro; d10 guerreiro, paladino, patrulheiro; d8 bardo, bruxo, clérigo, druida, ladino, monge; d6 feiticeiro, mago (linha "Dado de Vida: 1dX por nível de …" de cada classe, Cap. 3).

### 2.1 Multiclasse: o poço de Dados de Vida (pág. 165)

Texto do livro (linhas 14713-14722): você **adiciona os Dados de Vida de todas as suas classes** para formar seu **poço de Dados de Vida**.

| Situação | Como fica o poço | Exemplo do livro |
| --- | --- | --- |
| Classes com o **mesmo** tipo de dado | Somam num só grupo | paladino 5/guerreiro 5 → **10d10** |
| Classes com tipos **diferentes** | "monitore-os separadamente" | paladino 5/clérigo 5 → **5d10 + 5d8** |

- O livro **não diz** como escolher quais tipos voltam no descanso longo (ver Pontos em aberto).
- *(Já existe no app: `getHitDicePool` em `src/systems/dnd5e/utils/multiclassUtils.ts` devolve o poço agrupado por tipo. Ver também `docs/regras-multiclasse.md`, seção 3.)*

## 3. Descanso curto (pág. 188)

Linhas 16796-16810.

- **Duração:** um período de inatividade de **pelo menos 1 hora**.
- **Atividade permitida:** nada "mais árduo do que comer, beber, ler e tratar seus ferimentos".
- **Gastar Dados de Vida:** **no final** do descanso curto, o personagem pode gastar **um ou mais** Dados de Vida, até o máximo que possui (= nível do personagem).
- **Rolagem:** para cada Dado de Vida gasto, o jogador **rola o dado e soma o modificador de Constituição**. O personagem recupera pontos de vida **iguais a essa jogada**.
- **Um de cada vez:** o jogador pode decidir gastar **um Dado de Vida adicional após cada jogada**. Ou seja, ele vê o resultado antes de decidir se gasta o próximo.
- **Dados gastos não voltam no descanso curto.** Eles voltam em parte ao terminar um descanso longo (seção 4).
- O texto do descanso curto **não** traz limite por dia, pré-requisito de PV nem regra de interrupção. Esses três aparecem só no descanso longo.

### 3.1 Teto da cura (pág. 199)

Linhas 17837-17841, seção "Cura": os pontos de vida recuperados somam aos atuais, mas **não podem passar do máximo**. O excedente é perdido. Vale também para a cura com Dados de Vida.

## 4. Descanso longo (pág. 188)

Linhas 16811-16831.

### 4.1 Duração e atividade
- Período de inatividade prolongada de **pelo menos 8 horas**.
- O personagem **dorme** ou exerce **atividades leves**: "ler, falar, comer ou vigiar por não mais de 2 horas".

### 4.2 Interrupção
- Se o descanso for interrompido por **atividade extenuante** ("pelo menos 1 hora de caminhada, combate, conjurando magias ou atividades semelhantes"), os personagens **devem começar o descanso de novo** para ganhar algum benefício dele.

### 4.3 Benefícios (no final do descanso)
| O que volta | Quanto | Linhas |
| --- | --- | --- |
| Pontos de vida | **Todos** os pontos de vida perdidos | 16821-16822 |
| Dados de Vida gastos | Uma quantidade "igual a **metade** da quantidade total de Dados de Vida do personagem". Exemplo do livro: "se um personagem tem oito Dados de Vida, ele **pode** recuperar quatro Dados de Vida ao terminar um descanso longo" | 16822-16827 |

- O texto pt-BR **não** traz arredondamento (total ímpar) **nem** mínimo (personagem de 1º nível tem 1 Dado de Vida). A frase da regra também não tem a palavra "até", mas o exemplo diz "**pode** recuperar quatro", o que sugere um teto, não uma quantidade fixa. Ver Pontos em aberto.
- Como o texto fala em recuperar Dados de Vida **gastos**, não se passa do total do poço.

### 4.4 Restrições
- **No máximo um** descanso longo com benefícios **a cada 24 horas** (linhas 16828-16830).
- O personagem precisa ter **pelo menos 1 ponto de vida no início** do descanso para obter os benefícios (linhas 16830-16831).
  - Referência: uma criatura **estável** a 0 PV que não é curada recupera **1 ponto de vida depois de 1d4 horas** (pág. 200, linhas 17924-17925).

## 5. Outras regras que dependem do descanso (referência cruzada)

Não são da seção "Descanso", mas o assistente de descanso precisa saber delas.

### 5.1 Espaços de magia (págs. 53, 58, 65 e 203)
- **Regra geral:** "Terminar um descanso longo restaura qualquer espaço de magia gasto" (pág. 203, linhas 18144-18146). Cada classe com Conjuração repete isso, ex.: bardo (pág. 53, linhas 4104-4105).
- **Bruxo, Magia de Pacto:** "Você recobra todos os espaços de magia gastos quando você completa um **descanso curto ou longo**" (pág. 58, linhas 4531-4533).
- **Multiclasse:** os espaços de Pacto ficam **separados** do pool combinado. Ver `docs/regras-multiclasse.md`, seção 7 ("Magia de Pacto").
- **Magias preparadas:** as classes que preparam magias podem mudar a lista **quando terminam um descanso longo**. Ex.: clérigo (pág. 65, linhas 5277-5278).

### 5.2 Pontos de vida temporários (pág. 200)
- A não ser que a característica que os concede tenha uma duração, eles **duram até acabarem ou até você terminar um descanso longo** (linhas 17970-17973).

### 5.3 Exaustão (pág. 292) — ver `docs/regras-condicoes.md`
- "Terminar um descanso longo **reduz a exaustão** de uma criatura **em 1 nível**, contanto que ela também tenha **ingerido um pouco de água e comida**" (linhas 28561-28563).
- Interação: no **nível 4** de exaustão, o **máximo de pontos de vida** fica reduzido à metade (linha 28545). A tabela completa e o acúmulo de níveis ficam no doc de condições.

### 5.4 Características que "recuperam no descanso"
- Muitas características de **classe**, traços de **raça** e **talentos** têm usos que voltam ao terminar um descanso (dezenas de ocorrências no extrato). Todas dependem das regras deste documento para saber **quando** um descanso terminou.
- A redação **varia** de texto para texto. **Não** há padrão "curto ou longo": no extrato, a maior parte das ocorrências diz só descanso **longo**. Um exemplo de cada redação:
  - **só longo** (a mais comum): Magia Drow, "Você precisa terminar um descanso longo para poder conjurar as magias desse traço novamente" (pág. 24, linhas 1941-1943);
  - **curto ou longo:** Magia de Pacto do bruxo, "quando você completa um descanso curto ou longo" (pág. 58, linhas 4531-4533); Retomar o Fôlego do guerreiro (pág. 85, linhas 7263-7264);
  - **só curto:** Restauração Mística do feiticeiro, "sempre que você terminar um descanso curto" (pág. 80, linhas 6808-6809); Recuperação Arcana do mago, "Uma vez por dia, quando você terminar um descanso curto" (pág. 97, linhas 8433-8437).
- A recuperação exata de cada recurso **não** é listada aqui: é a etapa de recursos de classe, que deve transcrever a frase de cada um, sem assumir uma redação padrão.
- Duas regras mexem na **própria cura com Dados de Vida** e o assistente precisa conhecê-las (detalhe na etapa de recursos/talentos):
  - talento **Resistente**: cada Dado de Vida rolado para recuperar PV cura **no mínimo 2× o modificador de CON (mínimo de 2)** (pág. 172, linhas 15342-15345);
  - **Canção de Descanso** do bardo: quem gasta Dados de Vida no fim do descanso curto e ouve a atuação recupera **1d6 PV adicionais**, que crescem com o nível de bardo (pág. 54, linhas 4173-4183).

## 6. Notas de implementação (mapeamento pro app)

Não faz parte da regra do livro. Orienta a execução das próximas fases.

### 6.1 O que o estado de jogo guarda
A ficha (`CharacterDraft`) **nunca é reescrita** pelo descanso. O estado de jogo guarda só o **gasto**, e o valor atual é sempre derivado: atual = máximo da ficha − gasto.

| Campo (sugestão) | Conteúdo | Descanso curto | Descanso longo | Bloqueado pela falta de benefício (0 PV / 24 h / interrupção)? |
| --- | --- | --- | --- | --- |
| `damageTaken` | PV perdidos (o PV atual é derivado do máximo) | cura dos Dados de Vida pela operação de cura de `regras-dano-e-morte.md` (ver abaixo) | volta a 0, ou a `sheetMaxHp − effectiveMaxHp` se a exaustão continuar ≥ 4 depois do −1 (ver abaixo) | sim (seção 4.3) |
| `lifeState` | `conscious` / `dying` / `stable` / `dead` (definido em `regras-dano-e-morte.md`) | vai a `conscious` se a cura dos Dados de Vida tirar o personagem de 0 PV (ver Pontos em aberto, item 6) | — (o descanso longo exige 1 PV no início) | — |
| `deathSaves` | Sucessos e fracassos contra a morte (idem) | zerados junto com a saída de 0 PV | — | — |
| `tempHp` | PV temporários | não muda | volta a 0 (seção 5.2) | sim (assumido (A), item 10) |
| `hitDiceSpent` | Gastos **por tipo**, ex.: `{ 10: 2, 8: 1 }` | + dados gastos | − recuperados (seção 4.3; quantidade e tipos: itens 1-3) | sim (seção 4.3) |
| `pactSlotsSpent` | Espaços de Pacto gastos | volta a 0 | volta a 0 | sim (assumido (A), item 10) |
| `spellSlotsSpent` | Espaços do pool (por nível) gastos | não muda | volta a 0 | sim (assumido (A), item 10) |
| `exhaustionLevel` | 0-6 | não muda | −1 se comeu e bebeu (seção 5.3; caixa marcada por padrão, item 8) | sim (assumido (A), item 10) |
| recursos (`getSheetResources`) | Usos gastos de cada `SheetResource` (pelo `id` estável) | voltam os de recarga `'short'` | voltam os de recarga `'short'`, `'long'` e `'day'` (assumido (B), item 11) | sim (assumido (A), item 10) |
| `lastLongRestAt` *(opcional)* | Data real do último descanso longo | — | grava | — |

- **Cura dos Dados de Vida = a mesma operação de cura** de `regras-dano-e-morte.md` (Notas de implementação, parágrafo "Cura"; ex.: uma função `applyHealing`), não uma conta própria do descanso. Assim, `lifeState` e `deathSaves` saem certos de graça: quem estava `dying`/`stable` e recupera PV vai a `conscious` com os contadores zerados (pág. 199, linhas 17867-17868 e 17895-17896), e um personagem `dead` não recupera PV (linhas 17846-17848).
- **Teto da cura sobre os PV atuais efetivos.** O livro soma a cura aos PV **atuais** e não deixa passar do máximo (linhas 17837-17841). O teto é o **máximo efetivo** (já reduzido pela exaustão 4; assumido (C), `regras-dano-e-morte.md`, Ponto em aberto 5a). Ao **entrar** na exaustão 4, o corte é **gravado** em `damageTaken` (decisão 4 do dono, 2026-10-24): `damageTaken = max(damageTaken, sheetMaxHp − effectiveMaxHp)`. Por isso vale sempre o invariante **`sheetMaxHp − damageTaken ≤ effectiveMaxHp`**, o PV atual nunca passa do máximo efetivo e a fórmula fica **`currentHp = max(0, sheetMaxHp − damageTaken)`**. A cura: **novo atual = min(máx. efetivo, atual + cura)**, e daí se deriva `damageTaken` (= máx. da ficha − novo atual).
  - Ex.: máximo 20, efetivo 10, `damageTaken` 15 → PV atual 5 (já abaixo do efetivo, nada a cortar). Um dado que rola 5 → novo atual = min(10, 5 + 5) = 10, `damageTaken` 10. Outro dado que rola 4 → min(10, 14) = 10: o excedente se perde.
  - Ex. do corte: máximo 20, `damageTaken` 0 (PV 20), entra na exaustão 4 → `damageTaken` 10, PV 10. Se a exaustão cai para 3, o máximo volta a 20, mas o PV **fica** 10: o corte não volta (decisão 4).

- **Disponível por tipo** = `getHitDicePool(draft)` − `hitDiceSpent`. Como o poço é derivado da ficha, mudar nível ou classe no criador não corrompe o estado: basta limitar o gasto ao novo poço.
- **Ordem da exaustão 4 no descanso longo:** com o corte gravado (decisão 4), a ordem passa a importar. Leitura deste doc (a mesma que a versão anterior já dava como resultado: "o PV atual já sai como o máximo cheio"), a confirmar no item 12 dos Pontos em aberto: os dois benefícios valem "ao terminar" o descanso, então primeiro aplica o −1 de exaustão (se "comeu e bebeu") e depois recupera "todos os PV perdidos" até o máximo **efetivo** resultante, pela mesma regra do teto: `damageTaken = sheetMaxHp − effectiveMaxHp`. Se a exaustão caiu de 4 para 3, isso dá `damageTaken` 0 e o PV sai cheio; se ficou em 4 ou mais (não comeu e bebeu, ou estava em 5), o PV sai no máximo efetivo, sem violar o invariante. Zerar `damageTaken` sem olhar a exaustão deixaria o PV atual acima do máximo efetivo.
- **24 horas:** o app não tem relógio do mundo do jogo, e uma data real não representa o tempo do jogo (uma sessão pode cobrir vários dias, e um dia do jogo pode se espalhar por várias sessões). Sugestão: `lastLongRestAt` serve só para histórico e resumo. A regra vira **aviso** na prévia ("só um descanso longo a cada 24 horas no jogo"), sem bloquear. Segue essa proposta até decisão em contrário (Pontos em aberto, item 5).
- **1 PV no início:** dá para checar pelo próprio estado (PV atual = 0). O livro diz que, sem 1 PV, o personagem não obtém "seus benefícios", mas não lista quais efeitos da tabela contam como benefício. **Assumido (2026-10-24), a confirmar (A):** com 0 PV no início, o descanso longo não dá **nenhum** benefício: nem PV, nem Dados de Vida, nem espaços de magia (pool e Pacto), nem recursos, nem a exaustão −1, nem o fim dos PV temporários (Pontos em aberto, item 10). A prévia explica o bloqueio, citando a regra do estável (seção 4.4). Como as 24 h viram só aviso (item 5) e a interrupção fica a cargo do jogador (item 7), na prática o app só aplica o bloqueio no caso de 0 PV.
- **Recursos de classe, talento e raça** (`getSheetResources` em `sheetEffects.ts`, `SheetResource` com `id` estável): o estado de jogo guarda o gasto por `id`. Recarga `'short'` volta no curto **e** no longo; `'long'`, só no longo; **`'day'` (Recuperação Arcana) volta no descanso longo** (assumido (B), a confirmar; Pontos em aberto, item 11). Recursos com `uses: 'unlimited'` não têm gasto a guardar.

### 6.2 Fluxo em duas fases (assistente de descanso)
Tudo acontece num **rascunho de descanso** que fica em memória. Nada é gravado no estado de jogo antes do "Confirmar". Cancelar descarta tudo, inclusive as rolagens. Isso evita o atrito do DDB, em que rolar sem confirmar curava sem descontar os dados.

1. **Prévia** — mostra o que vai voltar e o que não vai:
   - curto: espaços de Pacto, recursos "curto ou longo" e os Dados de Vida disponíveis por tipo;
   - longo: PV cheio (até o máximo efetivo, seção 6.1), quantos Dados de Vida voltam (`max(1, floor(total / 2))`, limitado aos gastos; decisões 1 e 2), espaços do pool e de Pacto, recursos (inclusive os de recarga `'day'`, assumido (B)), PV temporários zerados e a exaustão −1 com a caixa "comeu e bebeu" **marcada por padrão** (decisão 14);
   - na multiclasse, o jogador **escolhe** quais tipos de Dado de Vida voltam; o app pré-preenche com os **maiores primeiro** e deixa trocar (decisão 2);
   - os pré-requisitos: com 0 PV no início, a prévia **bloqueia todos** os benefícios e explica por quê (assumido (A)); as 24 h viram só aviso (item 5);
   - com `lifeState === 'dead'`, a prévia **bloqueia** a cura (o morto não recupera PV, linhas 17846-17848) e avisa por quê.
2. **Gastar Dados de Vida, um a um** (só no descanso curto):
   - o jogador escolhe o **tipo** quando o poço tem mais de um (multiclasse);
   - **rolagem digital** pelo motor puro de `src/core/dice`, ligada por padrão, ou **valor manual** do dado físico (validar de 1 ao número de lados);
   - soma o mod. de CON (de `getFinalAbilityScores`) e mostra a conta aberta, ex.: "d8: 5 + 2 = 7"; com CON negativa, a cura tem **piso 0** e nunca vira dano (decisão 3), ex.: "d6: 1 − 2 = 0";
   - mostra o PV parcial, já com o teto do máximo efetivo (seção 3.1 e seção 6.1), e decide-se **após cada rolagem** se gasta o próximo;
   - um "desfazer último dado" dentro do rascunho ajuda quem digitou o valor manual errado.
3. **Confirmar** — aplica tudo de uma vez como **uma operação nomeada** (`shortRest` / `longRest`), que entra no desfazer geral do módulo.
4. **Resumo** — PV antes → depois, dados gastos e recuperados por tipo, espaços e recursos que voltaram e a exaustão.

- **Resistente** e **Canção de Descanso** entram na conta se estiverem declarados como efeito nos dados (`types/effects.ts`). Se não estiverem, viram **aviso** na fase 2 ("o bônus da Canção de Descanso não está automatizado"), sem mexer no número. As duas funcionam de jeitos diferentes:
  - **Resistente** vale **por rolagem**: é um piso aplicado a cada Dado de Vida rolado (2× mod. de CON, mínimo 2; linhas 15342-15345). Entra na fase 2, em cada dado.
  - **Canção de Descanso** é **uma rolagem extra única** por criatura (1d6, ou 1d8/1d10/1d12 conforme o nível de bardo), no **fim** do descanso curto, e só se a criatura gastou **um ou mais** Dados de Vida (linhas 4177-4183). Não é bônus por dado: entra no Confirmar, uma vez só.

### 6.3 O caso do bruxo (Magia de Pacto)
- Descanso curto recupera **só** `pactSlotsSpent`. O pool combinado (`spellSlotsSpent`) **só** volta no longo (seção 5.1; `docs/regras-multiclasse.md`, seção 7).
- Os dois conjuntos já são separados no código: `getPactSlots` e `getCombinedSpellSlots` (`src/systems/dnd5e/utils/spellUtils.ts`). O estado de jogo deve espelhar essa separação.
- **Teste obrigatório:** bruxo/mago faz um descanso curto e recupera os espaços de Pacto, mas **não** os de mago.

### 6.4 Testes
Funções puras com cobertura, conforme a seção "Testes" do CLAUDE.md:
- `getHitDiceAvailable`;
- `getHitDiceRecoveredOnLongRest`: `max(1, floor(total / 2))` limitado aos gastos (decisão 1): nível 1 → 1; total 5 → 2; total 8 → 4; nada gasto → 0;
- sugestão de tipos na multiclasse: maiores primeiro (ex.: 5d10 + 5d8, todos gastos, volta 5 → 5d10), com a escolha do jogador valendo sobre a sugestão (decisão 2);
- `applyHitDieRoll`: o teto do máximo efetivo e o mod. de CON negativo com piso 0 (decisão 3: 1 − 2 = 0, nunca −1);
- entrar na exaustão 4 grava o corte (`damageTaken = max(damageTaken, sheetMaxHp − effectiveMaxHp)`) e sair dela não devolve o PV cortado (decisão 4); o invariante `sheetMaxHp − damageTaken ≤ effectiveMaxHp` vale depois de toda operação;
- cura por Dado de Vida com exaustão 4: teto no máximo efetivo, excedente perdido (exemplos da seção 6.1);
- descanso longo com exaustão 4: com "comeu e bebeu" (4 → 3), PV cheio; sem (fica 4), PV no máximo efetivo (seção 6.1; leitura do item 12);
- cura por Dado de Vida a partir de `stable`/`dying`: fica `conscious`, os contadores zeram e o Caído gravado continua (decisão 14); a partir de `dead`: sem efeito (se o descanso curto a 0 PV é permitido continua no item 6);
- Canção de Descanso aplicada **uma vez só** no Confirmar, mesmo com vários Dados de Vida gastos, e nenhuma vez se nenhum foi gasto;
- `applyShortRest` e `applyLongRest`: com 0 PV no início, o longo não muda **nada** (assumido (A): PV, Dados de Vida, espaços, recursos, exaustão e PV temporários ficam como estavam); o bruxo/mago; os PV temporários; a exaustão com e sem "comeu e bebeu"; recursos `'short'` no curto e `'short'`/`'long'`/`'day'` no longo (assumido (B)).

## 7. Pontos em aberto (decidir com o dono)

1. **Dados de Vida recuperados no descanso longo — "metade", sem mínimo** (linhas 16822-16827). A tradução omite o "mínimo de 1" do inglês; no nível 1, metade = ½. **Decidido (2026-10-24):** vale o mínimo de 1 do inglês. O descanso longo recupera até `max(1, floor(total / 2))` Dados de Vida gastos (nunca mais que os gastos).
2. **Arredondamento de total ímpar.** Nem o pt-BR nem o exemplo (8 → 4) dizem o que fazer com 5, 7, 9… **Decidido (2026-10-24):** para baixo (pág. 7), com o mínimo de 1 do item 1.
3. **Multiclasse: quais tipos voltam no descanso longo** (linhas 14713-14722). **Decidido (2026-10-24):** o jogador escolhe; o app sugere os maiores primeiro e deixa trocar.
4. **Dado de Vida + mod. de CON negativo** (linhas 16804-16807). O livro não traz piso. **Decidido (2026-10-24):** piso 0. A cura nunca vira dano.
5. **Limite de 24 horas sem relógio de jogo** (linhas 16828-16830). Aviso na prévia ou bloqueio por data real? Sem decisão. Segue a proposta (aviso na prévia, sem bloquear; seção 6.1) até decisão em contrário.
6. **0 PV e descanso longo / curto** (linhas 16830-16831).
   - Descanso longo com 0 PV no início: bloquear ou oferecer o atalho do estável (1 PV após 1d4 horas, pág. 200)? **Assumido (2026-10-24), a confirmar (A):** o descanso longo não dá nenhum benefício (ver item 10). O atalho do estável continua sendo só o 1d4 do rastreador de PV (`regras-dano-e-morte.md`), fora do descanso.
   - **Continua aberto:** no descanso curto, que não exige 1 PV no texto, um personagem a 0 PV pode gastar Dados de Vida? Se puder, a cura o leva a `conscious` e zera os testes contra a morte (seção 6.1).
7. **Interrupção do descanso longo no app** (linhas 16815-16820). Sem decisão. Segue a proposta (o jogador só confirma o descanso que de fato terminou, com um texto de ajuda na prévia) até decisão em contrário.
8. **Exaustão "comeu e bebeu"** (linhas 28561-28563). Caixa marcada ou desmarcada? **Decidido (2026-10-24):** marcada por padrão, com o jogador podendo desmarcar (`regras-condicoes.md`, item 14).
9. **Leitura de "vigiar por não mais de 2 horas"** (linhas 16814-16815). Só para vigiar ou para todas as atividades leves? Não afeta o app, que não mede tempo. Fica só registrado.
10. **O que o bloqueio de benefícios suspende** (linhas 16819-16820 e 16828-16831). A seção "Descanso" só lista PV e Dados de Vida; espaços de magia (linha 18144), expiração dos PV temporários (linhas 17972-17973), exaustão −1 (linhas 28561-28563) e recursos vêm de outras regras. **Assumido (2026-10-24), a confirmar (A):** com 0 PV no início, o descanso longo não dá **nenhum** benefício: PV, Dados de Vida, espaços (pool e Pacto), recursos, exaustão −1 e fim dos PV temporários. Para as 24 h e a interrupção o app não bloqueia (itens 5 e 7), então o alcance do bloqueio nesses dois casos fica sem efeito prático.
11. **Recarga "uma vez por dia" (Recuperação Arcana, pág. 97, linhas 8433-8437).** O texto diz "uma vez por dia, quando você terminar um descanso curto", e o app não tem relógio de jogo. **Assumido (2026-10-24), a confirmar (B):** recursos de recarga `'day'` voltam no descanso longo.
12. **Exaustão 4 e PV no mesmo descanso longo** (consequência da decisão 4, que grava o corte). Se o descanso baixa a exaustão de 4 para 3, o personagem sai com PV cheio (o −1 vale antes da recuperação de "todos os PV perdidos") ou no máximo reduzido (o corte gravado não volta)? Os dois benefícios valem "ao terminar" o descanso e o livro não dá ordem. A seção 6.1 segue a leitura de PV cheio, que era o resultado da versão anterior deste doc, até decisão em contrário.
