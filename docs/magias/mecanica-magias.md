# Dano estruturado de magia — D&D 5e (PHB 2014)

> **Fonte:** Livro do Jogador pt-BR, Cap. 11 "Magias" (o texto de cada magia, com as linhas do extrato na tabela de cada lote); Cap. 9, "Jogadas de Dano" e "Acertos Críticos" (pág. 198, linhas 17735-17764); Cap. 10, os truques (pág. 203, linhas 18167-18173). As decisões: truques e feixes da Rajada Mística escalam pelo nível de **personagem** (2026-10-29, `docs/regras-conjuracao.md`, seção 2), e o crítico de magia só vale na magia com jogada de ataque, dobrando todos os dados (`docs/fase2-desenho-tecnico.md`, "Respondidas no desenho").
> Feito a partir do extrato `docs/_book-extracts/dnd-phb.txt`. É a **fonte da verdade documental** de `packages/rules/src/systems/dnd5e/data/spell-mechanics.json` (Fase 2 do modo de jogo, onda `magias-base`; desenho em `docs/fase2-desenho-tecnico.md`). A página citada é a impressa no pt-BR (o número logo depois do marcador `PAGINA` do extrato: marcador + 1 até o 188, + 2 a partir do 189).
>
> A seção 1 diz o que os dados guardam, a 2 o processo de cada lote e a 3 os lotes revisados. A seção 4 lista o que fica em aberto com o dono. A seção 5 traz as notas de implementação da leitura na tela e **não** é regra.

## 1. O que os dados guardam

`data/spell-mechanics.json` diz o que cada magia faz **em número**, ao lado de `spells.json` e fora dele: o `scripts/parse-spells.mjs` regenera o spells.json a partir de `docs/magias/regras-magias.md` e apagaria o que estivesse lá. O tipo é `types/spellMechanics.ts`, e `utils/spellMechanics.ts` (`getSpellMechanics`) é a única leitura.

- **Resolução:** jogada de ataque com magia (corpo a corpo ou à distância), TR do alvo (o atributo e o que o sucesso faz: metade do dano, nenhum dano, ou outra coisa que o texto diz), automática, ou nada a rolar.
- **Dano por parte:** os dados, o bônus (fixo ou o modificador de conjuração), o tipo (um id de `damage-types.json`, ou a escolha entre alguns) e a situação em que só aquela parte vale.
- **O que cresce:** `perSlotAbove`, por nível de espaço acima do da magia (`every` para o "a cada dois níveis"); `byCharacterLevel`, o total de dados em degraus de nível de personagem (os truques: 1º, 5º, 11º e 17º).
- **Instâncias:** jogadas separadas da mesma magia (os feixes da Rajada Mística, os dardos, os raios).
- **Cura, PV temporários e aumento de PV máximo**, com dados, valor fixo e o modificador; **alvos** (até quantas criaturas, e quantas a mais por nível); **área**; e o **efeito no alvo** (o id em `data/active-effects.json`).
- **Status:** `reviewed` quando tudo o que a magia faz em número está declarado e conferido — a magia de utilidade, sem número nenhum (Luz, Consertar), também, com a resolução `none`; `textOnly` quando há número ou efeito que o esquema ainda não diz ou que depende do Mestre, com o motivo. A entrada `textOnly` não leva dano, cura nem instâncias: o guia não mostra receita pela metade, só o texto.
- **Linhas do extrato** (`bookLines`): do nome da magia ao fim do texto. É contra elas que a revisão foi feita.

## 2. O processo de cada lote

1. **Proposta automática.** `node scripts/draft-spell-mechanics.mjs --batch T` (ou `1`, `2`, `3`, `4-5`, `6-9`) lê o spells.json e o extrato e grava um rascunho no scratch (a pasta temporária, ou `--out`; o script recusa `packages/` e `apps/`). Cada magia vem com as linhas e a página do extrato, e cada campo com o trecho que casou, se ele está no texto do app, no livro ou nos dois, e a confiança. As evidências procuradas: o "NdM", o rótulo de `damage-types.json`, o "teste de resistência de X", o "metade desse dano", o "ataque ... com magia", o "Em Níveis Superiores", o "5° nível (2dX)" dos truques, os feixes, os "pontos de vida temporários", a cura e a área. O rascunho é proposta, nunca dado.
2. **Revisão contra o extrato.** Cada magia é lida no livro, inteira: o dado, o tipo, o atributo do TR, o que o sucesso faz, o ataque, os degraus e o que cresce. As `bookLines` vão para a entrada, e `node scripts/draft-spell-mechanics.mjs --check` confere que cada uma começa no cabeçalho da magia e não passa do bloco dela.
3. **Só no texto, com o motivo.** O que o livro não deixa claro, o que depende do Mestre e o que o esquema ainda não diz vira `textOnly`. Nada é chutado.
4. **Divergência pt-BR × inglês** encontrada na revisão vai ao dono antes de a parte dela entrar (a regra do CLAUDE.md, "pt-BR × inglês"): a magia fica `textOnly` com o motivo até a decisão, que depois entra na lista do CLAUDE.md e em `data/__tests__/bookText.test.ts`.
5. **Testes.** `data/__tests__/spellMechanics.test.ts` confere cada entrada com o texto da magia no spells.json (o extrato fica fora do git, então o CI usa o texto do app, que é o do livro digitalizado): o id existe e o nível bate com o lote; cada "NdM" aparece literal; o rótulo do tipo e o atributo do TR aparecem; o `perSlotAbove` existe se, e só se, o "Em Níveis Superiores" fala de dano, cura ou PV; o truque de dano tem os degraus 1/5/11/17; o `targetEffect` existe no catálogo. O lote revisado entra em `CLOSED_BATCHES`, e daí o teste cobra 100% do nível. O "dano ácido" do livro (pág. 198 e Espirro Ácido) vale pelo "dano de ácido" do app, só redação (CLAUDE.md, "Tipos de dano").

## 3. Lotes revisados

### 3.1 Lote T: os 27 truques (revisado em 2026-10-31)

Todos os truques de dano escalam nos degraus de personagem 5º, 11º e 17º ("quando você alcança o 5° nível (2dX), 11° nível (3dX) e 17° nível (4dX)"); a Rajada Mística escala nos feixes (dois no 5º, três no 11º, quatro no 17º), com o dano de cada um em 1d10.

| Magia | id | Pág. | Linhas | Resolução | Dano | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Amizade | `friends` | 216 | 19768-19785 | — | — | só texto: a vantagem nos testes de Carisma é efeito ligado em você, fora do catálogo |
| Ataque Certeiro | `true-strike` | 221 | 20315-20325 | — | — | só texto: a vantagem no primeiro ataque do próximo turno é efeito ligado, fora do catálogo |
| Bordão Místico | `shillelagh` | 224 | 20719-20733 | — | — | só texto: muda a arma (atributo de conjuração, dado d8), sem dano próprio |
| Chama Sagrada | `sacred-flame` | 226 | 20987-20999 | TR de Destreza, nenhum dano no sucesso | 1d8 radiante | revisado |
| Chicote de Espinhos | `thorn-whip` | 226 | 21000-21015 | ataque corpo a corpo com magia | 1d6 perfurante | revisado |
| Consertar | `mending` | 232 | 21689-21704 | — | — | revisado, sem número |
| Criar Chamas | `produce-flame` | 235 | 22161-22180 | ataque à distância com magia | 1d8 de fogo | revisado |
| Druidismo | `druidcraft` | 242 | 22994-23015 | — | — | revisado, sem número |
| Espirro Ácido | `acid-splash` | 244 | 23395-23407 | TR de Destreza, nenhum dano no sucesso; até 2 alvos | 1d6 de ácido | revisado |
| Estabilizar | `spare-the-dying` | 246 | 23437-23445 | — | — | revisado, sem número |
| Globos de Luz | `dancing-lights` | 249 | 23902-23920 | — | — | revisado, sem número |
| Ilusão Menor | `minor-illusion` | 250 | 24011-24039 | — | — | revisado, sem número (seção 4, item 3) |
| Luz | `light` | 255 | 24550-24565 | — | — | só texto: divergência pt-BR × inglês em aberto (seção 4, item 1) |
| Mãos Mágicas | `mage-hand` | 257 | 24740-24758 | — | — | revisado, sem número |
| Mensagem | `message` | 258 | 24847-24863 | — | — | revisado, sem número |
| Orientação | `guidance` | 266 | 25731-25741 | — | — | só texto: o d4 é do alvo, uma vez, num teste de habilidade; fora do catálogo |
| Prestidigitação | `prestidigitation` | 271 | 26186-26212 | — | — | revisado, sem número (seção 4, item 2) |
| Proteção contra Lâminas | `blade-ward` | 272 | 26388-26397 | — | — | só texto: a resistência até o fim do próximo turno é efeito ligado, fora do catálogo |
| Raio de Fogo | `fire-bolt` | 274 | 26573-26586 | ataque à distância com magia | 1d10 de fogo | revisado |
| Raio de Gelo | `ray-of-frost` | 274 | 26587-26599 | ataque à distância com magia | 1d8 de frio | revisado |
| Rajada de Veneno | `poison-spray` | 275 | 26682-26695 | TR de Constituição, nenhum dano no sucesso | 1d12 de veneno | revisado |
| Rajada Mística | `eldritch-blast` | 275 | 26696-26710 | ataque à distância com magia, um por feixe | 1d10 de energia por feixe | revisado |
| Resistência | `resistance` | 278 | 26976-26986 | — | — | só texto: o d4 é do alvo, uma vez, num TR; fora do catálogo |
| Taumaturgia | `thaumaturgy` | 284 | 27681-27703 | — | — | revisado, sem número |
| Toque Arrepiante | `chill-touch` | 288 | 28075-28092 | ataque à distância com magia | 1d8 necrótico | revisado |
| Toque Chocante | `shocking-grasp` | 288 | 28093-28107 | ataque corpo a corpo com magia | 1d8 elétrico | revisado |
| Zombaria Viciosa | `vicious-mockery` | 290 | 28402-28416 | TR de Sabedoria, nenhum dano no sucesso | 1d4 psíquico | revisado |

Notas da revisão:

- **"Nenhum dano no sucesso"** dos truques de TR: o livro diz "deve ser bem sucedido num teste de resistência ... ou sofrerá 1dX", sem metade.
- **O que o truque faz no alvo além do dano** (o deslocamento do Raio de Gelo, o "não recupera PV" do Toque Arrepiante, as reações do Toque Chocante, a desvantagem da Zombaria Viciosa, o puxão do Chicote de Espinhos) fica no texto: é do alvo, e a receita é de quem conjura. A vantagem do Toque Chocante contra armadura de metal é circunstância que a mesa marca na folha da receita (o Normal / Vantagem / Desvantagem).
- **Espirro Ácido, dois alvos:** "uma criatura ... ou duas criaturas ... a 1,5 metro uma da outra"; cada uma faz o TR, e o dano se joga uma vez para os dois ("Se uma magia ou outro efeito causar dano em mais de um alvo ao mesmo tempo, jogue o dano uma única vez para todos os alvos", pág. 198, linhas 17746-17751).
- **Ortografia do extrato** que os dados já corrigiram ("um muda", "maia", "conjura-la") não é divergência.

## 4. Pontos em aberto (decidir com o dono)

1. **Luz** (pág. 255, linhas 24563-24565): "a criatura deve ser bem sucedida num teste de Destreza para evitar a magia". O inglês diz "Dexterity saving throw": o TR de Destreza, contra a CD da magia, e não um teste de habilidade. É o mesmo caso do Esquivar (CLAUDE.md, pt-BR × inglês). Até a decisão, a Luz fica só no texto. Proposta: seguir o inglês, corrigir o texto da magia (spells.json e `docs/magias/regras-magias.md`) e prender em `bookText.test.ts`.
2. **Prestidigitação** (pág. 271, linhas 26200-26203): "limpa ou suja um objeto de até 1 metro cúbico" e "esfria, esquenta ou melhora o sabor de até 1 metro cúbico de matéria inorgânica". O inglês diz "1 cubic foot" (um cubo de 30 centímetros), cerca de 35 vezes menos. Não muda número da receita (a magia não tem), só o texto. Proposta: seguir o inglês, "um objeto que caiba num cubo de 30 centímetros" e "a matéria inorgânica que caiba num cubo de 30 centímetros", com o mesmo registro.
3. **Ilusão Menor** (pág. 250, linhas 24028-24030): a imagem "não pode ter mais de 1,5 metro cúbico". O inglês diz "no larger than a 5-foot cube", um cubo de 1,5 metro de lado (o Druidismo, pág. 242, traduz o mesmo "5-foot cube" por "cubo de 1,5 metro"). Proposta: "não pode ser maior que um cubo de 1,5 metro", com o mesmo registro.
4. **Efeitos no alvo fora do catálogo:** Orientação, Resistência, Proteção contra Lâminas, Ataque Certeiro e Amizade ficam só no texto até o catálogo dos efeitos recebidos (`data/active-effects.json`) ganhar o efeito de cada uma. Orientação e Resistência pedem o efeito de uso único (o d4 uma vez, depois a magia acaba), e a Proteção contra Lâminas o fim "no fim do seu próximo turno", que o catálogo ainda não tem.
5. **Bordão Místico** muda a linha de ataque da clava e do bordão: entra quando a linha de ataque souber do efeito ligado (como o Auxílio Divino), não como dano da magia.
6. **A CD e o ataque das magias de fora da conjuração de classe ou de talento** (o truque da raça, o truque da subclasse, as magias inatas) não existem no app: a receita dessas magias mostra o dano, sem o ataque nem a CD, e diz isso. O truque do Alto Elfo e as inatas declaram o atributo nos dados (`spellcastingAbility`, `InnateSpell.ability`), e a conta é a geral do Cap. 10 (pág. 207, linhas 18471-18481: a CD é 8 + o modificador da habilidade de conjuração + a proficiência, e o ataque, o modificador + a proficiência); o truque do Acólito da Natureza (Domínio da Natureza) não diz qual atributo usa.

## 5. A leitura na tela (notas de implementação, não é regra)

- **O guia da magia** (`utils/spellGuide.ts`, `getSpellGuide(draft, state, { casterKey, spellId, castLevel })`) monta a receita a partir destes dados e da conjuração do guia de rolagens (`RollGuide.spellcasting`, pela chave `class:<classe>` ou `feat:<talento>`): o ataque é o da conjuração, com a magia no rótulo; o TR do alvo vem com a CD; o dano sai por parte, com o crítico só na magia com jogada de ataque; o truque e os feixes crescem pelo nível de personagem; a cura e os PV temporários levam o modificador de conjuração; o ganho do nível maior sai como "No 3º nível: 5d6 (+2d6)". Só a magia revisada tem guia.
- **As jogadas** se montam pelos mesmos montadores do guia da ficha (`utils/guideEntries.ts`), e o id de cada uma (`spell:<magia>:<nível do espaço>:<parte>@<conjuração>`) deixa a folha da receita remontá-la com o estado de agora (`findSpellGuideEntry`): com o Envenenado marcado, o ataque da magia sai com desvantagem, como o de magia da conjuração.
- **Na tela:** a aba Magia mostra, em cada conjuração, "O que rolar nas magias" (`getCasterSpellGuides`: só as revisadas com algo a rolar); a folha da magia na aba Regras mostra "O que rolar". O ataque e o dano abrem a receita, e o ataque leva ao dano. A receita aberta da folha da magia fica por cima dela, e o Esc fecha só a de cima. Nenhuma fórmula de magia é montada em componente.
