# Ordem Paranormal — Levantamento de Automação de Efeitos

Data: 2026-07-29. Objetivo: mapear, habilidade por habilidade, o que a ficha **já calcula
automaticamente** e o que ainda **só existe como texto**, para chegar em "ao terminar o wizard, a
ficha está 100% pronta pra mesa".

> **Estado: gaps fechados em 2026-07-29.** As tabelas abaixo são o diagnóstico ORIGINAL (o "antes").
> Os 37 gaps foram implementados no branch `feat/ordem-automacao-efeitos` — ver a seção
> [Resolução](#resolução-2026-07-29) no fim do documento, que registra o que virou automático,
> os dois rulings de regra e uma inconsistência achada no livro.

## Legenda

| | Significado |
|---|---|
| ✅ | **Automático** — a ficha calcula o número/slot/atributo derivado |
| 📝 | **Só texto (correto)** — habilidade ativada em jogo ("gaste X PE"), 1×/cena, ou decisão de mesa. Não há número a pré-calcular |
| ⚠️ | **Gap** — tem efeito determinístico (número, slot, proficiência, escolha) que a ficha deveria resolver e não resolve |

## Como a automação funciona hoje (3 canais)

1. **`effects` estruturado nos dados** — `OriginPowerEffects` (origens), `TrilhaFeatureEffects`
   (trilhas), `ParanormalPowerEffects` (poderes paranormais). Agregadores em `characterUtils`,
   `paranormalPowerUtils` e `curseUtils`.
2. **Hardcode por id** — poderes de **classe** não têm nenhum `effects` preenchido; os 15 que
   funcionam estão escritos à mão em `ordemWeaponUtils`, `equipmentUtils` e `characterUtils`
   (`hasClassPower(draft, 'sure-shot')` etc.). O campo `ClassPower.effects` existe no tipo mas
   **nenhum código o lê**.
3. **Texto puro** — descrição impressa em "Habilidades / Poderes" na Revisão e no PDF.

### Cobertura de `effects` nos dados

| Família | Itens | Com `effects` | Automatizados (qualquer canal) |
|---|---|---|---|
| Origens (poder de origem) | 26 | 9 | 11 |
| Poderes de classe | 45 | **0** | 15 (hardcode por id) |
| Features de trilha | 60 | 7 (+6 `grantsRitual`) | 16 |
| Poderes paranormais | 22 | 9 | 11 |
| Habilidades de classe | 3 | — | 1 |
| **Total** | **156** | 25 | **54** |

Os ~65 itens restantes são 📝 legítimos (ativados em jogo). Os **~37 gaps** estão abaixo.

---

## 1. Origens (26)

Automáticos: Calejado (PV/NEX), Cicatrizes Psicológicas (SAN/NEX), Dedicação (PE + limite de PE),
Patrulha (Defesa), Mão Pesada (dano c.a.c.), Para Bellum (dano de fogo), Eu Já Sabia (RD mental =
INT), Ferramenta de Trabalho (ataque/dano/margem + proficiência), Ferramentas Favoritas (categoria
−I), Traços do Outro Lado (concede poder paranormal + metade da SAN inicial).

| Origem / Poder | Efeito | Status |
|---|---|---|
| Agente de Saúde — Técnica Medicinal | "+Intelecto no total de PV curados" | ⚠️ passivo numérico não resolvido (o análogo Ritual Potente já vira nota com o valor) |
| Magnata — Patrocinador da Ordem | "Limite de crédito sempre um acima" | ⚠️ o PDF/Equipamento imprimem `patente.credit` cru; não sobe um degrau |
| Religioso — Acalentar | +5 em Religião (acalmar); cura 1d6+PRE de Sanidade | ⚠️ bônus de perícia condicional sem número na coluna "Outros" |
| Acadêmico, Atleta, Executivo, Investigador, Servidor Público, Trabalhador Rural, Trambiqueiro, T.I., Amnésico, Artista, Chef, Mercenário, Criminoso | gastam PE / 1×missão / decisão de mesa | 📝 |

## 2. Habilidades de classe (3)

| Habilidade | Efeito | Status |
|---|---|---|
| Ocultista — Escolhido pelo Outro Lado | 3 rituais + 1/NEX; libera círculos | ✅ `getRitualSlotsCount` / `getMaxRitualCircle` |
| Especialista — Eclético e **Perito** | "escolhe **2 perícias treinadas**; gasta PE para +1dX (d6→d12 por NEX)" | ⚠️ **escolha obrigatória que não existe no draft**. Nem as 2 perícias nem o dado do NEX aparecem na ficha |
| Combatente — Ataque Especial | 2 PE/+5 … 5 PE/+20 conforme NEX | ⚠️ imprime a tabela inteira; poderia resolver "no seu NEX: 3 PE = +10" |

## 3. Poderes de classe (45) — `effects` = 0, tudo hardcode

### Combatente (19)

| Poder | Efeito | Status |
|---|---|---|
| Armamento Pesado | proficiência armas pesadas | ✅ `hasWeaponProficiency` |
| Artista Marcial | desarmado 1d6/1d8/1d10 letal | ✅ arma sintética em `getUnarmedAttack` |
| Golpe Pesado | +1 dado de dano c.a.c. | ✅ |
| Tanque de Guerra | +2 Defesa e +2 RD da proteção pesada | ✅ |
| Tiro Certeiro | +Agilidade no dano de armas de disparo | ✅ |
| Transcender | concede poder paranormal (+ penalidade de SAN) | ✅ |
| Treinamento em Perícia | 2 perícias / sobe grau | ✅ |
| **Proteção Pesada** | proficiência com proteções pesadas | ⚠️ **proficiência de proteção não é modelada em lugar nenhum** (`armorProficiencies` só é exibido no ClassStep) |
| **Reflexos Defensivos** | +5 Defesa **e** em testes de resistência contra inimigos em alcance curto | ⚠️ condicional permanente, sem número na ficha |
| Ataque de Oportunidade, Combater com Duas Armas, Combate Defensivo, Golpe Demolidor, Incansável, Presteza Atlética, Saque Rápido, Segurar o Gatilho, Sentido Tático, Tiro de Cobertura | custam PE / reação | 📝 |

### Especialista (15)

| Poder | Efeito | Status |
|---|---|---|
| Balística Avançada | proficiência + **+2 dano** táticas de fogo | ✅ |
| Ninja Urbano | proficiência + **+2 dano** táticas c.a.c. | ✅ |
| Mochila de Utilidades | −1 categoria, −1 espaço | ✅ |
| **Hacker** | +5 Tecnologia (invadir sistemas) | ⚠️ sem número na ficha |
| **Perito em Explosivos** | +Intelecto na DT dos explosivos; exclui INT alvos | ⚠️ explosivos não têm DT modelada nem linha de ataque |
| **Primeira Impressão** | +ØØ no 1º teste social da cena | ⚠️ menor: nota de dado não resolvida |
| Conhecimento Aplicado, Mãos Rápidas, Movimento Tático, Na Trilha Certa, Nerd, Pensamento Ágil | custam PE | 📝 |

### Ocultista (14)

| Poder | Efeito | Status |
|---|---|---|
| Especialista em Elemento | +2 DT dos rituais do elemento | ✅ `getRitualDt` |
| Mestre em Elemento | −1 PE nos rituais do elemento | ✅ `getRitualCost` |
| Ritual Predileto | −1 PE no ritual escolhido | ✅ (+ picker na Revisão) |
| Tatuagem Ritualística | −1 PE em ritual pessoal que mira você | ✅ |
| Ritual Potente | +Intelecto no dano/cura dos rituais | ✅ nota com valor resolvido |
| **Envolto em Mistério** | +5 Enganação e Intimidação (vs. não treinado em Ocultismo) | ⚠️ sem número |
| **Identificação Paranormal** | +10 Ocultismo para identificar | ⚠️ sem número |
| **Criar Selo** | máximo de selos = Presença | ⚠️ menor: número resolvível ("máx. 3 selos") |
| **Ferramentas Paranormais** | ativa equipamento paranormal sem PE | ⚠️ menor: nota nos itens paranormais do loadout |
| **Improvisar Componentes** | acha componentes de um elemento | ⚠️ menor: deveria relativizar o aviso "faltam Componentes Ritualísticos" |
| Camuflar Ocultismo, Fluxo de Poder, Guiado pelo Paranormal, Intuição Paranormal | custam PE | 📝 |

## 4. Features de trilha (60)

Automáticas: A Favorita/Técnica Secreta/Sublime/Máquina de Matar (redução de categoria I→IV),
Técnica Letal (+2 margem c.a.c.), Casca Grossa (RD = Vigor ao bloquear), Inquebrável (RD 5
machucado), Inventário Otimizado (carga +INT), Mente Sã (+5 resist. paranormal), Presença Poderosa
(limite de PE p/ ritual), Inabalável (RD mental/paranormal 10), Rituais Eficientes (+5 DT),
Lâmina Maldita (ritual + custo −1 + ataque por Ocultismo), e os 6 `grantsRitual` de NEX 99%.

| Trilha / Feature | Efeito faltando | Status |
|---|---|---|
| **Tropa de Choque — Casca Grossa** (NEX 10) | "**+1 PV para cada 5% de NEX**" — só a RD condicional está no `effects`; `TrilhaFeatureEffects` **não tem campo de PV** | ⚠️ **PV errado na ficha** (em NEX 99%: faltam 20 PV) |
| **Graduado — Saber Ampliado** (NEX 10) | "aprende 1 ritual de 1º círculo + 1 a cada novo círculo; não contam no limite" | ⚠️ **slots de ritual não existem** (1 a 4 rituais faltando) |
| **Graduado — Grimório Ritualístico** (NEX 40) | "aprende **Intelecto** rituais de 1º/2º círculo + 1 por círculo novo" | ⚠️ **slots não existem** (até 5+ rituais faltando) |
| **Aniquilador — Máquina de Matar** (NEX 99) | "o dano da arma favorita **aumenta em um passo**" (redução IV e +2 margem já entram) | ⚠️ dano não escala |
| **Atirador de Elite — Mira de Elite** (NEX 10) | proficiência com armas de fogo de **balas longas** + **+Intelecto no dano** delas | ⚠️ armas não têm vínculo com munição no catálogo |
| **Infiltrador — Ataque Furtivo** (NEX 10) | +1d6 / +2d6 (40%) / +3d6 (65%) / +4d6 (99%) | ⚠️ dado escalonado não resolvido na ficha |
| **Infiltrador — Gatuno** (NEX 40) | +5 Atletismo e Crime | ⚠️ sem número |
| **Operações Especiais — Iniciativa Aprimorada** (NEX 10) | +5 Iniciativa | ⚠️ sem número |
| **Tropa de Choque — Inquebrável** (NEX 99) | "+10 na Defesa enquanto machucado" (a RD 5 já aparece) | ⚠️ metade da feature vira número, metade não |
| **Técnico — Remendão** (NEX 40) | "equipamentos de **investigação** têm categoria reduzida em I" | ⚠️ o catálogo não marca "equipamento de investigação" |
| **Médico de Campo — Paramédico** (NEX 10) | cura 2d10 (+1d10 em 40/65/99%) | ⚠️ menor: dado resolvível pelo NEX |
| **Negociador — Discurso Motivador** (NEX 40) | +Ø / +ØØ a partir de 65% | ⚠️ menor: idem |
| **Atirador de Elite — Atirar para Matar** (NEX 99) | crítico com arma de fogo = dano máximo | ⚠️ menor: nota na linha de crítico |
| Demais 40 features (Comandante de Campo, Guerreiro 40/65/99, Op. Especiais 40/65/99, Conduíte 10/40/65, Flagelador, Lâmina Paranormal 40/65, Negociador 10/65/99, Técnico 65/99, Médico 40/65/99, Infiltrador 65/99, Aniquilador 40/65 efeitos) | custam PE / reação / 1×cena | 📝 |

## 5. Poderes paranormais (22)

Automáticos: Aprender Ritual (ritual + elemento + custo/DT), Resistir a Elemento (RD 10/20),
Expansão de Conhecimento (poder de outra classe, com pré-requisitos e params — inclusive o 2º poder
por afinidade), Precognição (+2 Defesa e resistências), Sensitivo (+5 em 3 perícias), Visão do
Oculto (+5 Percepção), Golpe de Sorte (margem +1 / multiplicador +1), Encarar a Morte (limite de PE),
Potencial Aprimorado (PE/NEX), Sangue de Ferro (PV/NEX + Fortitude por afinidade), Campo Protetor
(+5 Reflexos por afinidade).

| Poder | Efeito faltando | Status |
|---|---|---|
| **Arma de Sangue** | garra/lâmina 1d6 de Sangue, arma simples leve — **permanente com afinidade** | ⚠️ não aparece em "Ataques" (o Desarmado do Artista Marcial já usa esse padrão de arma sintética) |
| **Sangue Fervente** | +1 (ou +2) em Agilidade **ou** Força enquanto machucado | ⚠️ atributo condicional sem linha própria |
| **Campo Protetor** (base) | +5 Defesa ao esquivar | ⚠️ menor: condicional sem número |
| **Sangue Vivo** | cura acelerada 2 (5 com afinidade) | ⚠️ menor: número resolvível |
| Afortunado, Causalidade Fortuita, Percepção Paranormal, Manipular Entropia, Escapar da Morte, Potencial Reaproveitado, Surto Temporal, Anatomia Insana | rerrolagens / 1×cena / gastam PE | 📝 |
| Afinidade Elemental (NEX 50%) | dispensa componentes do elemento afim, +ØØ/−ØØ | ✅ inclusive no aviso de componentes |

## 6. Camada de equipamento

| Item | Efeito | Status |
|---|---|---|
| Modificações de arma/proteção/acessório com número (Certeira, Cruel, Perigosa, Alongada, Calibre Grosso, Mira Laser, Discreta, Reforçada, Blindada) | ataque/dano/margem/espaço/Defesa/RD | ✅ |
| Maldições (19) | atributos, Defesa, PV/PE, dano extra, margem dobrada, alcance, RD por peso | ✅ |
| Patente | vagas por categoria, com item menor descendo em vaga maior | ✅ |
| **Acessórios `utensilio` / `vestimenta`** | "+2 numa **perícia à escolha**, definida ao adquirir" | ⚠️ **escolha não modelada** e bônus ausente da ficha |
| **Modificação `aprimorado`** | o bônus do acessório sobe para **+5** | ⚠️ depende da escolha acima |
| **Modificação `funcao-adicional`** | "+2 em uma **perícia adicional à escolha**" | ⚠️ segunda escolha não modelada |
| **Modificações de munição (`dum-dum` +2 multiplicador, `explosiva` +2d6)** | aplicadas na munição, precisam chegar na arma | ⚠️ as 6 munições existem, mas armas não declaram munição → efeito nunca chega ao ataque |
| **Kit de Perícia** | sem o kit, −5 no teste; "existe um kit para cada perícia" | ⚠️ não se escolhe qual kit; a ficha não sinaliza perícias sem kit |
| **Proficiência de proteção** | sem proficiência há penalidade; Escudo conta como pesada | ⚠️ nenhuma verificação (só armas têm aviso "Sem Proficiência") |
| **Proteção Pesada: −5 em perícias com penalidade de carga** | `skills.json` já marca `loadPenalty` | ⚠️ o PDF só imprime o marcador `+`; a penalidade não é aplicada |
| **Explosivos (5 granadas/mina)** | arremesso em alcance médio, dano e DT de resistência | ⚠️ não geram linha de ataque nem DT (e Perito em Explosivos soma INT nessa DT) |

---

## Gaps por severidade

### P0 — número/slot **errado ou ausente** na ficha pronta

1. **Casca Grossa** (Tropa de Choque NEX 10): +1 PV por 5% de NEX nunca somado — até **−20 PV**.
2. **Saber Ampliado + Grimório Ritualístico** (Graduado): de 2 a ~10 rituais conhecidos que a ficha
   simplesmente não tem. É o maior buraco de conteúdo do módulo.
3. **Perito** (Especialista): escolha obrigatória de 2 perícias que não existe no wizard.
4. **Acessórios (+2 em perícia à escolha)** + `aprimorado` + `funcao-adicional`: escolha inexistente
   e bônus fora da ficha.
5. **Mira de Elite** (Atirador de Elite): proficiência + INT no dano; exige vincular arma↔munição.
6. **Modificações de munição** (`dum-dum`, `explosiva`): mesmo vínculo arma↔munição.
7. **Máquina de Matar**: dano da arma favorita não sobe um passo.
8. **Ataque Furtivo**: dados extras (1d6→4d6) não resolvidos.
9. **Proficiência de proteção** + **−5 por carga da Proteção Pesada**.
10. **Explosivos**: sem linha de ataque e sem DT.

### P1 — bônus permanentes de perícia sem número (coluna "Outros" do PDF só lê poder paranormal)

Hacker (+5 Tec), Gatuno (+5 Atl/Crime), Iniciativa Aprimorada (+5 Ini), Envolto em Mistério (+5
Eng/Int), Identificação Paranormal (+10 Ocu), Acalentar (+5 Rel), Reflexos Defensivos (+5 Def e
resistências), Inquebrável (+10 Def machucado), Campo Protetor (+5 Def esquivando), Sangue Fervente
(+1/+2 AGI ou FOR machucado).

### P2 — valores escaláveis que a ficha poderia resolver pelo NEX/atributo

Ataque Especial, Perito (dado), Paramédico, Discurso Motivador, Técnica Medicinal, Criar Selo,
Sangue Vivo, Atirar para Matar, Arma de Sangue (linha de ataque), Patrocinador da Ordem (crédito),
Ferramentas Paranormais, Improvisar Componentes, Primeira Impressão.

### P3 — dados faltando no catálogo (pré-requisito dos itens acima)

- `OrdemWeapon.ammo` (qual munição a arma usa) → Mira de Elite, Disparo Impactante, mods de munição.
- Tag "equipamento de investigação" → Remendão, Improvisar, Preparado para Tudo.
- DT/dano estruturados nos explosivos → Perito em Explosivos.
- Perícia do Kit de Perícia (escolha por unidade).

---

## Proposta de arquitetura

O padrão de 3 canais já funciona, mas o canal 2 (hardcode por id) é o que travou os poderes de
classe. Sugestão em 3 movimentos:

1. **Um tipo de efeito unificado** (`SheetEffects`) compartilhado por origem, classe, trilha e poder
   paranormal, com os campos que hoje faltam: `skillBonus` (com `condition?: string`),
   `conditionalDefenseBonus`, `hpPerNexStep`/`peFlat` (trilha), `damageStepUp`, `extraDamageDice`,
   `armorProficiency`, `grantsRitualSlots` (círculo + quantidade), `resolvedNote` (texto com valores
   já substituídos pelo NEX/atributo).
2. **Um agregador único** `getSheetEffects(draft)` que percorre origem + classe + poderes + features
   de trilha alcançadas + instâncias paranormais + equipamento, devolvendo tudo somado com a fonte
   de cada linha. Revisão e PDF passam a ler só ele (hoje cada seção chama 8–10 getters).
3. **Escolhas novas como slot na etapa dona** (padrão Transcender/Aprender Ritual): Perito e Kit de
   Perícia em **Perícias**; perícia do acessório e munição em **Equipamento**; slots de ritual do
   Graduado em **Rituais**.

Ordem sugerida de implementação: **P0.1–P0.3** (erros de número/escolha) → **P1** (canal de bônus de
perícia condicional, que sozinho fecha 10 gaps) → **P3** (dados de munição/investigação) → **P0.5–10**
→ **P2** (notas resolvidas).

---

## Resolução (2026-07-29)

Implementado no branch `feat/ordem-automacao-efeitos`, em 6 commits. 862 testes.

### Arquitetura final

`utils/sheetEffects.ts` é o agregador único que a Revisão e o PDF leem: atravessa origem, poderes
de classe (inclusive os aprendidos por Expansão de Conhecimento), features de trilha alcançadas,
poderes paranormais e o loadout. Vive em módulo próprio porque precisa ler `equipmentUtils`, que já
lê `characterUtils` — o módulo separado evita o ciclo.

`types/effects.ts` guarda os tipos de efeito compartilhados pelas quatro famílias
(`ConditionalSkillBonus`, `ConditionalDefenseBonus`), pra não divergirem.

**Regra de ouro adotada:** efeito INCONDICIONAL entra no número da ficha; efeito CONDICIONAL vira
linha própria com a condição. Somar o +5 do Hacker em todo teste de Tecnologia, ou o +10 do
Inquebrável fora de "machucado", seria mentir na ficha.

### Fechado por severidade

| Gap | Como ficou |
|---|---|
| Casca Grossa | `hpPerNexStep` em `TrilhaFeatureEffects`, retroativo — eram até 20 PV a menos |
| Saber Ampliado + Grimório | slots próprios na etapa Rituais, círculo travado pela feature |
| Perito | `expertSkillChoices` na etapa Perícias, com custo/dado resolvidos pelo NEX |
| Munição | `OrdemWeapon.ammo` + uma linha de ataque por variante compatível carregada |
| Mods de munição | Dum dum (+2 multiplicador) e Explosiva (+2d6) chegam na arma certa |
| Mira de Elite | +Intelecto no dano e proficiência com as armas de balas longas |
| Máquina de Matar | +1 dado do mesmo tipo (ruling do usuário) |
| Ataque Furtivo | dado resolvido pelo NEX (+1d6 → +4d6) |
| Proficiência de proteção | passou a existir: classe + poder, com o Escudo contando como pesada |
| Penalidade de carga | −5 da Proteção Pesada nas perícias marcadas, no total da perícia |
| Explosivos | seção própria com dano, área e DT (10 + limite de PE + atributo, p. 80) |
| Bônus de perícia (P1) | canal único; Gatuno e Iniciativa Aprimorada somam, Hacker/Envolto em Mistério/Identificação Paranormal/Acalentar viram linha com a condição |
| Defesa condicional | Reflexos Defensivos, Inquebrável e Campo Protetor, cada um com sua condição |
| Notas resolvidas (P2) | Ataque Especial, Paramédico, Discurso Motivador, Criar Selo (= Presença), Técnica Medicinal (= Intelecto), Ferramentas Paranormais |
| Crédito do Magnata | Patrocinador da Ordem sobe um degrau (Baixo → Médio…), com teto em Ilimitado |
| Arma de Sangue | linha de ataque como arma sintética, igual ao Desarmado do Artista Marcial |

### Rulings de regra

1. **"Aumenta o dano em um passo" (Máquina de Matar)** — o livro usa a expressão mas não define a
   escala de passos de dano em lugar algum (para alcance ele explicita, para dano não). Decisão do
   usuário: um passo = **mais um dado do mesmo tipo**, como Golpe Pesado e Calibre Grosso já fazem
   (katana 1d10 → 2d10).
2. **Intelecto do Grimório Ritualístico** — "rituais igual ao seu Intelecto" é medido no **NEX 40%**,
   quando a feature é recebida: o Aumento de Atributo do NEX 20% conta, o do 50% não. Escolhido por
   estabilidade — slot que aparece sozinho depois confunde.

### Inconsistência no livro (registrada, não "corrigida")

A p. 80 define **DT de teste de resistência = 10 + limite de PE + atributo** e dá o exemplo: um
Combatente com Vigor 3 em NEX 55% teria DT 18. Mas a **Tabela 1.2** dá limite de PE **11** no NEX
55% → 10 + 11 + 3 = **24**. O 18 corresponde ao limite do NEX 25% (5). O projeto segue a Tabela 1.2,
que é a regra; o exemplo parece erro de edição. Vale para `getRitualDt` e `getSheetExplosives`.

### Acessórios e a regra de não-acúmulo (p. 63)

`utensilio` e `vestimenta` concedem "+2 numa perícia à escolha, definida ao adquirir". A escolha
agora existe por UNIDADE, na etapa Equipamento (`accessorySkillChoices`), com Luta e Pontaria fora:

- `aprimorado` sobe o bônus do item para **+5**
- `funcao-adicional` abre um **segundo** slot de perícia (+2)
- a etapa fica pendente enquanto um acessório requisitado não tiver perícia definida

**"Bônus fornecidos por itens não são cumulativos"** (p. 63): o agregador marca bônus de item como
`nonCumulative`, e `getSkillBonusTotal` soma as habilidades normalmente mas usa só o **MAIOR** bônus
de item. Bônus de item continua somando com bônus de habilidade — o não-acúmulo é entre itens. A
penalidade de carga da Proteção Pesada nunca é marcada, então soma sempre (é penalidade, não bônus
concorrente).

Pegar dois itens na mesma perícia é **permitido** (nada no livro proíbe): a etapa não bloqueia, e o
passo de Equipamento mostra um aviso explícito nomeando a perícia, as fontes e qual valor a ficha
vai usar.

**Limite de duas vestimentas** ("você pode receber os bônus de no máximo duas vestimentas ao mesmo
tempo", p. 63): requisitar mais é permitido — vestir/despir é uma ação completa, então a troca é na
mesa —, mas só duas contam na ficha. Decisão do projeto: valem as **duas de maior bônus** (empate
pela ordem do loadout), que é o que o agente naturalmente vestiria; as demais aparecem no aviso e
na linha do item como "inativo". Se algum dia isso precisar ser escolha do jogador, o lugar é um
marcador de "vestindo" por unidade na etapa Equipamento.

**Aprimorado duas vezes:** `repeatableWith` na modificação modela a exceção do livro — o Aprimorado
pode ser aplicado uma 2ª vez quando a peça tem Função Adicional, e aí a 2ª aplicação sobe o slot
adicional para +5. Cada aplicação cobra categoria (Utensílio I + 3 mods = IV). No card, o botão
cicla 0 → 1 → 2 → 0 e mostra "×2". `getEffectiveModIds` descarta aplicações além do limite, então um
2º Aprimorado que perdeu a Função Adicional deixa de valer em TODOS os cálculos — inclusive na
categoria —, sem precisar de limpeza na UI ou migração de save.

### Gaps que sobraram (deliberadamente)

- **Kit de Perícia**: não se escolhe de qual perícia é o kit, então a ficha não sinaliza as perícias
  que sofreriam −5 sem ele.
- **Remendão** (Técnico NEX 40%): "equipamentos de investigação têm categoria reduzida em I" — falta
  a tag de "equipamento de investigação" no catálogo.
- Habilidades ativadas em jogo (~65 itens) continuam só com a descrição, e está correto: não há
  número a pré-calcular em "gaste 2 PE para reagir".
