# Estudo: D&D Beyond como referência para o nosso módulo de jogo

*Data: 2026-10-23. Este relatório se baseia só no dossiê de pesquisa das cinco frentes externas (ficha em jogo, dados e log, campanha/multiplayer, mobile e percepção, concorrentes) e na leitura do código da main (frente dados-dnd5e). As cinco frentes externas passaram por checagem. A frente de código não teve checador formal. Na revisão ela foi conferida por amostragem contra a main e contra o extrato do PHB (`docs/_book-extracts/dnd-phb.txt`). Bateram as contagens de magias, concentração, rituais, valores de `castingTime` e features. Houve uma correção: são 19 arquivos de teste em `utils/__tests__`, não 20.*

**Legenda de confiança**
- **[confirmado]**: um checador conferiu a afirmação.
- **[corrigido]**: o dado já aparece com a correção do checador.
- **[não verificável]**: o checador não conseguiu conferir. Quase sempre o motivo foi o erro de certificado TLS em `dndbeyond.com` e `dndbeyond-support.wizards.com` nesta rede, ou o bloqueio do Reddit.
- Achados sem marca vêm da leitura do nosso código ou são síntese do estudo.

---

## 1. Resumo executivo

- **O líder valida a tese.** O próprio D&D Beyond (DDB) admite que o app atual não serve bem à mesa presencial. Na Gen Con 2026 (keynote de 30/07) ele anunciou um app móvel novo, "built from the ground up to make in-person play easier". O lançamento está **previsto para 2027**: a atualização de meio de ano e a Vice falam em "início de 2027", e a comicbook.com e a frente de campanha só em "2027", sem mês. [corrigido] Pelo anúncio, o app **deve mostrar** ações, recursos, PV e condições (inclusive concentração) e deve permitir rolar no app ou usar dados físicos ("as much or as little digital assistance as you want"). É quase a mesma tese do nosso módulo, com uma janela de alguns meses.
- **A ficha atual do DDB rastreia bem o básico**: PV com PV temporário, testes contra a morte no lugar do PV, espaços de magia com "Conjurar", recursos de uso limitado com reset por descanso, dados de vida roláveis no descanso curto, moedas e inventário. **Os buracos são crônicos**:
  - a concentração não existe na ficha, e é pedida desde ~2017;
  - exaustão e condições não mexem nos números;
  - buffs como Bênção e Fúria não entram nas rolagens;
  - o tipo de dano não aplica resistência;
  - a munição não é descontada;
  - a UX de PV no celular é ruim;
  - a tela de preparar magias confunde iniciantes.

  Extensões de terceiros existem justamente para tapar esses buracos, o que é sinal de demanda.
- **Nosso diferencial estrutural**: funcionamos offline de verdade, sem conta e sem limite de fichas. Temos uma edição só (PHB 2014, sem vazamento de 2024), interface em português e ajuda contextual. O DDB falha em todos esses pontos.
- **O código atual cobre bem o estático e não tem nada de sessão.**
  - Máximos e bônus já existem como funções puras e testadas: atributos, perícias, CA, PV máximo, dados de vida, espaços combinados e de Pacto, CD.
  - Falta todo o estado de jogo: PV atual, gastos, condições, morte, moedas.
  - Falta também a camada de dados "ativável": tipo de ação, usos, recuperação e dano estruturado de magias. Dos recursos de classe, só **5 são contadores** prontos. O resto é informação de exibição.
  - Há **bugs de base** que o modo de jogo herdaria (seção 8.3). Corrigi-los muda os números de fichas já salvas.
- **Recomendação.** Antes do MVP vem uma Fase 0 de alicerce:
  - corrigir os bugs de base, com plano de migração;
  - extrair um "modelo de ficha" único;
  - digitalizar em `/docs` as regras de combate, descanso e condições, que já estão no extrato do livro com linhas localizadas;
  - criar o estado de jogo separado da ficha;
  - criar um motor de rolagem puro no núcleo;
  - registrar no CLAUDE.md o módulo de jogo no escopo, proibindo multiplayer e backend.

  O MVP é a **ficha viva individual com rolagem**. Entram:
  - bloco de vitais fixo e Dano/Cura num toque;
  - estados de morte completos;
  - espaços e recursos clicáveis;
  - descansos em duas fases;
  - condições, concentração e inspiração;
  - **regra a um toque** para características, traços e magias, e "de onde vem este número";
  - nota livre;
  - rolar tocando no número, com vantagem/desvantagem visível, conta aberta e histórico local.

  A animação é 2D. Ações por tipo, efeitos ativos, grimório com upcast, inventário e 3D ficam para depois. Campanha, mestre e sincronização ficam fora, como horizonte que exige backend. Algumas decisões precisam vir **antes** da Fase 1, porque mudam o MVP:
  - crítico;
  - efeitos incondicionais de condição;
  - o que conta como sessão e o que conta como edição da ficha.

---

## 2. O que é o D&D Beyond hoje (estado em 2026-10-23)

| Frente | Estado atual | Confiança |
|---|---|---|
| **App móvel** | iOS com nota 4,7 em 92 mil avaliações, v2.92.2 de ~20/out/2026. As notas de versão dizem só "Minor bug fixes and improvements" desde a 2.75 (02/06/2025), sinal de manutenção à espera do app novo. Google Play com 4,6 em ~113 mil avaliações, número de agregador de 2025. | iOS [confirmado/corrigido]; Play [não verificável] |
| **App novo** | Anunciado na Gen Con 2026 (30/07). Roda sobre um motor de regras "developed over the past two years", com regras como dados. Versão inicial prevista para 2027 (parte das fontes diz "início de 2027") e expansão ao longo do ano. Não se falou em offline nem em 2014 versus 2024. O termo "Entity-Component-System" não apareceu em nenhuma fonte. | [corrigido] |
| **Roadmap 2026** (19/02/2026) | Reconstrução da plataforma com regras e conteúdo como dados, builder renovado, ferramentas de mestre. A atualização de meio de ano (post 2223, perto da Gen Con, data exata não confirmada) traz DM Scene Prep, Custom Uploads, ferramentas fora do Maps, New Play Experience, nova busca e Looking for Group. | [confirmado/corrigido] |
| **Quickbuilder** | O Quickbuilder **não é novo em 2026**. No fim de mar/2026 saiu um Quickbuilder novo que substitui o antigo. Ele cria personagem de nível 1 em poucos passos guiados, promete "não exigir conhecimento de regras" e evitar erros de iniciante (esquecer bônus, repetir perícia). Funciona do celular ao 4K. Segundo o changelog, roda sem conta, mas a frente de campanha não confirmou esse ponto. É o primeiro passo de um Character Builder novo. **As fontes divergem sobre a data do builder**: duas frentes dizem "fim de 2026" ou "ainda em 2026", e a frente mobile diz "sem data". **Concorre diretamente com a nossa visão de produto.** | [corrigido]; "sem conta" [não verificável]; data do builder divergente |
| **Rótulos de edição** | Desde 02/03/2026 o conteúdo 2014 se chama "5e" e o de 2024 "5.5e", porque a mistura "has led to confusion about which rules apply". O filtro de personagens prontos por conjunto de regras está "coming soon" (changelog de 19/10/2026). | [confirmado] |
| **Crise 2014→2024** | Em 23/08/2024 o DDB anunciou a troca forçada de magias e itens das fichas 2014. Voltou atrás em 26–27/08 ("We misjudged the impact"). O 2014 virou "Legacy", e ainda há relatos de efeitos 2024 vazando. | [confirmado] |
| **Dados** | Shared Dice: rolagem 3D vista por todos, na web desde 23/02/2026 e no iOS/Android desde 10/06/2026. Todas as contas ganharam 5 conjuntos. Houve meses de correções de desempenho. | [corrigido] |
| **Maps (VTT 2D)** | Gratuidade anunciada no fim de jul/2025, **valendo desde 16/09/2025**, com até 13 pessoas por sessão. Ficha aberta pelo token (Vice, 26/05/2026). Journals só no Maps (27/05/2026). Condições sincronizadas com a ficha (fim de jul/2026, às vezes exigindo recarregar). Uploads próprios só no plano Master (~15–16/10/2026). | [corrigido/confirmado] |
| **Sigil (VTT 3D)** | ~90% da equipe demitida em 18/03/2025. Fica disponível **até 31/10/2026**, daqui a 8 dias. | [corrigido] |
| **Encounters (Beta) do site** | Continua de pé, com regras do DMG 2014 e sem mudanças planejadas. O suporte manda usar o Maps para as regras de 2024. | [confirmado] |
| **Modelo de negócio** | Conta grátis com 6 vagas de personagem. Ao cancelar a assinatura, o jogador escolhe 6 e o resto fica trancado. Drops (mai/2026, primeira leva em 04/06): conteúdo exclusivo de assinante. | [confirmado] |
| **Idioma** | Só inglês. O único conteúdo não inglês é o PHB em italiano. Em 2023 a equipe disse que a localização "has proven difficult". | [confirmado] |
| **Lacunas persistentes** | Concentração ausente da ficha até a última fonte vista (jul/2026). Exaustão 2024 não implementada. Buffs fora das rolagens. | concentração [confirmado]; o resto em parte [não verificável] |

**Leitura:** o DDB está apostando no jogo online e social (Maps, Shared Dice, Drops). O presencial fica para 2027, com foco em 5.5e. Uma ficha de jogo PHB 2014, offline, sem conta e em português tem espaço próprio.

---

## 3. Anatomia da ficha em jogo

### 3.1 Filosofia e navegação
- **Princípios do redesenho de jun/2018**, que valem até hoje:
  - visual "neo-retrô" parecido com o papel;
  - **snippets** sempre à vista: uma frase curta com os números já calculados, como a CD e o dano finais;
  - fim dos "collapsibles" ("Remove Collapsibles – Retain Access to Full Descriptions");
  - **painel lateral** com a regra completa ao tocar, fixável no desktop e deslizante no mobile.

  O checador confirmou que "almost 70% of the sheet usage is on desktop resolutions" (post 262, não necessariamente o 256). A afirmação de que isso valia **inclusive durante o jogo** não foi confirmada. [confirmado no essencial; autoria, citações literais e códigos `{{savedc:cha}}` não verificáveis]
- **Estrutura**:
  - Cabeçalho fixo com retrato, nome, classe e nível, Descanso Curto e Longo, atalho ao builder e "Launch game".
  - Seções: Atributos/Resistências/Sentidos (passivas), Uso Limitado, Perícias, Ações, Inventário, Magias, Deslocamento/Defesas, Características & Traços, Proficiências, Antecedente, Notas (campos prontos e livres) e Extras (montarias, familiares, formas de Forma Selvagem).
  - O menu do retrato reúne aparência, builder, XP, configurações, Game Log, descansos e PDF.
  - No mobile se navega por swipe e por um botão de salto rápido. No app, desde 2024, dá para reordenar as abas e fixar perícias favoritas.

  [não verificável; a lista oficial das abas no desktop não foi achada]
- **Detalhe ao tocar**: no app (2024), tocar em iniciativa, deslocamento, atributo, resistência, sentido ou CA mostra como o número foi calculado. [não verificável] O custo desse desenho é que o efeito mecânico (ex.: exaustão) fica só no texto.
- **Ficha versus builder**: o DDB não tem modo jogo separado. A ficha é a tela de jogo, e a edição estrutural fica no builder ("Manage Character & Levels"). [corrigido]
- **Lição para nós**:
  - ficha enxuta no modo jogo, com o resto como "referência";
  - frase curta com o número resolvido e a regra a um toque;
  - tocar no número mostra de onde ele vem;
  - a edição estrutural volta ao nosso fluxo de 9 passos.

### 3.2 PV, PV temporário e morte
- **Fluxo**: um ajuste rápido de cura/dano no quadro de PV, mais um painel completo com Max HP Modifier, Override Max HP e PV temporários. O temporário é consumido primeiro. O descanso tem a opção "Reset Maximum HP changes", para coisas como a mordida de vampiro. Houve um bug em que o override também jogava o PV atual para o máximo. [não verificável, exceto a issue do Beyond20 de 06/07/2021, que fala em "HP management sheet"]
- **Atrito no celular** (2018):
  - "clunky as all heck to record 15 points of damage… on mobile";
  - o Enter não aplica, e é preciso tocar em APPLY CHANGES;
  - a Cura pelas Mãos alta exigia "47 clicks";
  - tipo de dano no tracker, para aplicar resistência, foi pedido em out/2024 e não existe.

  O pesquisador estimou, sem medir, ~2–3 interações no desktop e ~4 no mobile. [não verificável]
- **Testes contra a morte**: com 0 PV, o quadro de PV vira o tracker de sucessos e falhas e volta ao normal com cura. O rastreador de combate do mestre ganhou a mesma lógica em 20/jan/2022 (changelog 1150). Há o relato de um bug em que um dado de vida negativo no descanso curto podia levar o PV abaixo de 0. [confirmado o rastreador; a parte da ficha (fórum de 2020) e o bug não verificáveis]
- **Lição**:
  - Dano/Cura num toque, com teclado numérico grande, botões rápidos e "+5/−7" inline (padrão Roll20 e Stat Bubbles).
  - O PV temporário fica em campo próprio e não soma. Quando chega PV temporário novo, a ficha **pergunta ao jogador** se ele mantém o antigo ou troca. O PHB 2014 deixa a escolha ao jogador (extrato, linhas 17959–17965), então "fica o maior" automático seria chutar regra.
  - Um **modificador temporário de PV máximo** (ex.: Auxílio, drenos, exaustão 4) é resetado no descanso longo, no padrão "Reset Maximum HP changes".
  - A morte substitui o PV na mesma área, com explicação curta e com todos os estados do livro (linhas 17849–17941):
    - **morrendo**, com testes contra a morte e Inconsciente aplicado sozinho a 0 PV;
    - **estável**, sem testes, volta com 1 PV em 1d4 horas e perde a estabilidade se tomar dano;
    - **morto**, por 3 falhas, dano massivo ou exaustão 6.

    PV temporário a 0 PV não acorda o personagem.

### 3.3 Condições, exaustão, concentração e inspiração
- **Condições**: popup perto do PV, com tooltip da regra. A exaustão tem nível, mas **os efeitos não se aplicam** ("temporary effects that the character sheet cannot apply"). A exaustão de 2024 não está implementada. [não verificável] As condições sincronizam com o Maps desde o fim de jul/2026, sem efeito mecânico, e usuários pedem que elas "actively affect the character sheets". [confirmado]
- **Concentração**: **não existe na ficha**. É o pedido mais antigo ("It's been requested hundreds of times… It's a simple addition."). Usuários usam o checkbox de Inspiração como contorno. Em 2026 ela aparece só como plano, para o Maps e para o app novo ("concentrating on a spell"). [confirmado] Extensões cobrem o buraco [confirmado]:
  - o userscript Reaction-and-Concentration-Tracker (Tampermonkey, MIT) traz caixas de concentração e de reação e alerta com a CD ao tomar dano;
  - a Character Sheet Overhaul traz barra de turno e concentração que pede o TR de CON;
  - a TrueSight UI (Firefox) traz um anel visual.
- **Inspiração**: toggle sim/não. Não se achou como a Heroic Inspiration (2024) aparece hoje. Na regra 2024 ela é no máximo 1 ponto e vira rerrolagem, não vantagem. [não verificável]
- **Lição**: diferencial barato e de alto valor.
  - **Condições e exaustão** (Apêndice A do PHB 2014: 14 condições mais a Exaustão, com tabela de 6 níveis; linhas 28440–28563) são **tensão com a regra de ouro**.
    - A regra de ouro do projeto manda efeito **condicional** virar linha própria com a condição, e efeito **incondicional** entrar no número.
    - Vários efeitos de condição são incondicionais:
      - exaustão 4: PV máximo pela metade;
      - exaustão 2: deslocamento pela metade;
      - exaustão 5, Agarrado e Impedido: deslocamento 0;
      - Inconsciente: incapacitado.
    - Pelo menos o PV máximo da exaustão 4 precisa entrar no rastreador de PV para ele funcionar. O resto (vantagem e desvantagem em testes) é condicional e vira aviso.
    - Decisão do dono na seção 10.2.
  - **Concentração**: ao conjurar uma magia de concentração, a ficha marca "Concentrando em X". Ao conjurar outra, avisa que a primeira cai. Ao tomar dano, mostra o teste de CON com a CD. Ficar Incapacitado também quebra a concentração.
  - **Inspiração de 2014**: um liga/desliga.

### 3.4 Descansos, dados de vida e recursos de uso limitado
- **Descansos**: botões no cabeçalho e no topo de Uso Limitado, mais "Dawn". Cada painel mostra o que recupera. Dados de vida são roláveis no descanso curto desde 19/08/2021. Em 26/08/2021 a cura automática passou a vir marcada por padrão. [confirmado]
- **Atritos** [não verificável]:
  - era preciso confirmar o descanso para os dados ficarem marcados;
  - rolar sem confirmar curava sem descontar os dados;
  - a gestão de dados de vida na multiclasse é "wonky";
  - a Recuperação Arcana é desmarcada à mão;
  - recurso que volta inteiro no longo e em parte no curto não é tratado ("built to be either/or");
  - falta "a single view" de todos os usos.
- **Correção sobre o descanso longo** [corrigido]:
  - A regra "o longo recupera metade dos dados de vida" vale para 2014. Em 2024 se recuperam todos, e fichas 2024 recuperando metade foram registradas como bug.
  - O "mínimo 1" vem da edição em inglês. A tradução em português do nosso extrato diz só "metade da quantidade total" (linhas 16821–16827), e isso precisa de confirmação do dono.
  - O "mínimo 0 em dado de vida + CON" não está no livro. É fala de moderador do DDB.
- **Pré-requisitos do descanso longo** (linhas 16828–16831): o personagem começa com pelo menos 1 PV, e só cabe um descanso longo a cada 24 horas.
- **Uso Limitado**: agrega tudo que tem reset em fileiras de checkboxes, com reset em massa. Recursos homebrew com reset "Other" viravam "3 Uses / Special" sem caixas, e pools grandes eram ajustados clique a clique. [não verificável]
- **Lição**: um **assistente de descanso didático em duas fases**, no padrão Shard e Roll20:
  - mostra o que vai voltar;
  - gasta os dados de vida um a um, decidindo após cada rolagem;
  - escolhe o tipo de dado na multiclasse;
  - respeita os pré-requisitos do longo;
  - só aplica ao confirmar e termina com um resumo.

  Os recursos ficam declarados nos dados (máximo, tipo de reset, pool ou pips).

### 3.5 Magias
- **Fluxo**: lista por nível com espaços restantes. "Cast" escolhe o nível do espaço e o gasta. Rituais preparados podem ir com espaço ou como ritual; os do grimório não preparados, só como ritual. A preferência "Show Level-Scaled Spells" mostra as versões elevadas. [não verificável]
- **Dor de iniciante** (out/2025, ainda sem correção em abr/2026) [não verificável]:
  - no "Manage Spells" do mago, os botões dizem "LEARN/DELETE" em vez de "PREPARE/UNPREPARE";
  - o DELETE de truque apagava de verdade;
  - magias de item ou talento não gastam espaço sozinhas.
- **Lição**:
  - Conjurar em 1–2 toques, com upcast mostrando o ganho e marcando a concentração.
  - Rótulos óbvios ("Preparar"/"Despreparar"), contador "x de N preparadas" e truques separados.
  - Pacto e multiclasse tratados à parte.
  - O grimório também precisa de regras que o DDB não destaca (seção 8.2):
    - ritual com regra diferente por classe;
    - magia de ação bônus restringindo a outra magia do turno;
    - truque escalando pelo nível do personagem.

### 3.6 Ações, ações bônus e reações
- **Estrutura**: Ações / Ações Bônus / Reações / Outros / Uso Limitado, com armas equipadas, ataques de magia e características. Tem botões separados de acerto e dano, as ações padrão, menu Normal/Vantagem/Desvantagem/Crítico e cabeçalho de vitais fixo. Fonte: issue 1848 do Campfire, ago/2026, que é **fonte secundária**. [confirmado como resumo de terceiro]
- **Não há** rastreio de "já usei a reação ou a ação bônus"; extensões adicionam checklist e "End Turn". A munição não é descontada, e munição +1 não entra ("by design"). [não verificável]
- **Lição**: organizar o modo jogo pela economia de ações é o maior ganho didático ("o que posso fazer no meu turno?"). Isso exige também as **ações padrão do PHB** (Atacar, Disparada, Desengajar, Esquivar, Ajudar, Esconder, Preparar, Procurar, Usar Objeto), o ataque de oportunidade e o combate com duas armas como ação bônus. Esses dados ainda não existem (seção 8.2).

### 3.7 Inventário, moedas, carga e sintonização
- Contêineres desde fev/2022, cada um com toggle "Active" para o peso; carga; moedas; sintonização travada em 3 ("players were accidentally attuning to more items"); inventário de grupo só em campanha. [não verificável] Numa avaliação da App Store de 15/06/2024, o usuário reclama que item customizado com bônus "won't apply to your stats" e diz que volta para "paper and pencil". [confirmado]
- **Lição**: na nossa V1 bastariam moedas com +/−, quantidades (consumíveis e munição, com a regra do PHB de recuperar metade da munição após o combate) e, se decidido, equipar/desequipar recalculando a CA. Inventário de grupo fica fora.

### 3.8 Customização e efeitos ativos
- A ficha permite ajustes ad hoc: itens, CA, ações, sentidos, defesas, perícias e magias (no app desde jan–mar/2024). [não verificável] Buffs temporários continuam sem efeito ativo. A Rollwarden (que liga e desliga Bênção e soma o dado no rolador, inclusive dobrando no crítico) e a Overhaul existem para isso. **Ressalva**: a Rollwarden tem 1 usuário e licença "All Rights Reserved", então não serve como prova de demanda em volume. [corrigido]
- **Lição**:
  - Poucos overrides, com explicação de onde vem cada número.
  - Efeitos ativos ganham liga/desliga e entram como linhas condicionais: Fúria ligada, Bênção recebida, Escudo Arcano.
  - Falta decidir se um efeito ativo **incondicional** muda o número durante a sessão. É o caso da Armadura Arcana, que define a CA como 13 + DES (decisão na seção 10.2).

### 3.9 Sinais de demanda vindos de extensões
A Character Sheet Overhaul (Edge e Chrome, v2.2.0, gratuita) adiciona [confirmado parcialmente]:
- botão End Turn com checklist por turno (ação, bônus, movimento, reação);
- pedido de TR de CON ao tomar dano;
- cronômetro de rodadas por condição (condições vencidas ficam riscadas);
- brilho de vida com efeito de sangue no acerto.

O aviso de "Low HP" com limite configurável não foi achado. O vídeo da extensão ("actually notice you just got chunked…") não foi verificado. Vários desses itens são **gamificação pura** e cabem numa SPA local.

---

## 4. Dados e animação

### 4.1 Como o DDB rola
- **"Clicar no número"**: com o toggle "Dice Rolling" (Character Settings) ligado, ataque e dano ficam em caixas clicáveis. Também rolam perícias, resistências, iniciativa (pela ficha desde 11/03/2025) e dados de vida (desde 19/08/2021). [confirmado] Pelo fórum, com o toggle desligado os botões somem e **não há como registrar o resultado de um dado físico**, uma demanda que existe desde 2021. [não verificável]
- **Vantagem/desvantagem**: o DDB não aplica sozinho. O clique direito abre Advantage / Disadvantage / Flat Roll; o toque longo vem de resposta de staff. Em monstros isso chegou em 04/02/2025, com opção de rolar direto. Atalhos de terceiros no Beyond20: Shift = vantagem, Ctrl = desvantagem, Alt = normal (repositório canônico kakaroto/Beyond20, v2.21.0 de 17/09/2026). [corrigido] A "posição deliberada da equipe" e os relatos opostos de fev/2026 não são verificáveis.
- **Crítico**:
  - O menu do dano tem "Critical Hit" e "Flat Roll".
  - Um tópico de bug relata que o 20 natural ativa "Double Roll Damage" sozinho e que não dá para desmarcar. A data (jun/2026) e se isso ainda vale não foram confirmadas, e o changelog não registra crítico automático.
  - A margem expandida (Improved Critical 19) era manual.
  - Dados extras de características (Ataque Furtivo, Golpe Divino) foram fonte histórica de erro.

  [não verificável no geral; menu e animações de crítico confirmados]
- **Rolador livre**: bandeja no canto inferior esquerdo, com destino próprio desde 02/06/2021, e "Clear Dice" (bloco abr–jun/2026). A sintaxe aceita não está documentada. [corrigido]
- **Game Log**: open beta em 25/01/2021 e post oficial em 02/02/2021. Mostra a ação, o total com modificadores e o visual do conjunto. Foi reescrito em abr/2026 ("massively reduce game log errors", consultas 20x mais rápidas). [confirmado] Reclamações [não verificável]:
  - ocupa ~1/3 da ficha;
  - não dá para limpar;
  - é difícil achar a rolagem nova;
  - a conta detalhada sumiu ("mostrar a matemática").
- **Shared Dice / 3D** [corrigido]:
  - Chegou em 23/02/2026 na web e em 10/06/2026 no mobile, descrito como "Presentation and consistency upgrade, not a rules change".
  - A estreia teve lentidão (Maps com mais de 10 s por ação) e crashes. Depois vieram assets 40% menores e 28 conjuntos otimizados.
  - Há um modo sem renderização 3D, com o bug "dice rolls do not apply on HP if rendering of 3D is disabled".
  - Reclamações: dados grandes cobrindo o resultado e dados alheios atravessando a tela.

  Que o motor usa Three.js é alegação de usuário. [não verificável]
- **Monetização**: os conjuntos de dados são produto do Marketplace e item de exibição ("show off their purchased or unlocked dice"). Houve brindes em 2020, 2021 e fev/2026. O conjunto do DMG 2024 era **bônus de pré-venda**, e o Core Rulebook Bundle 2024 trazia 9 conjuntos. [corrigido] Preços não encontrados.

### 4.2 Lições do Owlbear Rodeo
- O Owlbear tirou o "arrastar para jogar" por "possible cheating" e o trocou por rerrolagem explícita de um dado, com os outros travados. Tem rolagem oculta e som por material (post de 31/10/2022). [confirmado]
- Testes de justiça com 2.000 d20 e qui-quadrado, mais um Fairness Tester na extensão: post de **22/02/2024**. [corrigido]
- O diálogo de rolagem tem +/- de quantidade, bônus e V/D, e uma seção de "rolagens recentes" para alternar entre acerto e dano. [confirmado]
- O código (owlbear-rodeo/dice) é GPL-3.0, sem commits desde 10/04/2024. Serve de referência de UX, não de código.

### 4.3 Bibliotecas: panorama técnico

| Opção | Licença | Peso | Resultado predeterminado | Manutenção | Observação |
|---|---|---|---|---|---|
| `@3d-dice/dice-box` 1.1.4 | MIT | bundle ~198 KB min / 40 KB gzip; mundo 3D ~1,45 MB min + ammo.wasm 317 KB + ~290 KB por tema; fallback onscreen ~391 KB | **Não** (o resultado sai da física) | Sem release desde 24/08/2024, último push em 21/10/2024, 29 issues+PRs | Sem tipos TS; exige assets em `/public` [confirmado] |
| `@3d-dice/dice-box-threejs` 0.0.12 | MIT | depende de three ^0.143 + cannon-es | **Sim** (`6d6@4,4,…`) | publish em 26/10/2022, último push em 12/11/2023 | [corrigido] |
| three (0.186.1) + cannon-es (0.20) próprio | MIT | three ~736 KB min / ~185 KB gzip antes de tree-shaking; cannon-es 122 KB / 34 KB gzip | Sim, se a nossa lógica forçar a face | three ativo (24/09/2026); **cannon-es parado desde 08/2022** | A física sem manutenção pesa contra [corrigido] |
| Rapier (`@dimforge/rapier3d-compat` 0.21) | Apache-2.0 | ~15 MB descompactado (WASM embutido) | Não nativamente (sai da física) | Ativo (25/09/2026) | [confirmado] |
| Dice So Nice | **AGPL-3.0** | — | — | — | Só referência de UX |
| `@dice-roller/rpg-dice-roller` 5.5.1 | MIT | 813 KB min / **210 KB gzip** (mathjs + random-js) | — | push em 21/11/2025, tem tipos | Pesado demais para a notação de que precisamos [confirmado] |
| 2D/CSS próprio | — | ~0 | Sim | — | Sem dependência |

**Condição para qualquer opção com física** (three + cannon-es/Rapier, dice-box): a simulação precisa ser **forçada** a um resultado já sorteado pelo motor. Dá para escolher ou girar a face depois que o dado assenta, ou gravar a trajetória antes. Se o resultado sair da física, violamos a restrição de cálculo separado da animação. Rapier e dice-box só servem nessa condição.

### 4.4 O que isso significa para nós (sem código)
- **Separar cálculo de apresentação**, como pede a restrição do projeto.
  - Um **motor de rolagem puro em TypeScript no núcleo** (`src/core`, agnóstico de sistema) decide o resultado com RNG confiável (`crypto.getRandomValues`) e é testado no vitest.
  - A notação necessária é pequena: NdX+M, 2d20 com o maior ou o menor, e o crítico dobrando dados.
  - O motor deve servir ao D&D e à reserva de d20 do Ordem, já modelada em `src/systems/ordem/utils/ordemWeaponUtils.ts` como `rollDice`/`rollMode`. [confirmado]
  - Hoje a main usa `Math.random` espalhado e não tem motor central: em `characterStore`, `abilityScoreUtils` e `EquipmentStep`, e também nos dois storages (`src/systems/dnd5e/utils/storage.ts` e `src/systems/ordem/utils/storage.ts`, provavelmente para gerar ids).
- **A animação só apresenta** o número já sorteado:
  - 2D/CSS leve por padrão;
  - 3D opcional, carregado sob demanda, nunca no bundle da criação e sempre forçado ao resultado do motor;
  - respeita `prefers-reduced-motion`;
  - nunca cobre o resultado, que fica sempre legível.
- **Acessibilidade**: o resultado é anunciado por `aria-live`, com contraste adequado, alvos de toque grandes e uso completo pelo teclado. A crítica registrada ao Pathbuilder no VoiceOver mostra que isso pesa.
- **UX de rolagem para iniciante**:
  - seletor Normal/Vantagem/Desvantagem **visível**, de 3 estados, e não escondido em clique direito;
  - mostrar os dois d20 e destacar o que valeu;
  - mostrar sempre a conta (d20 [14] + 5 = 19);
  - comemorar o 20 e o 1;
  - "rolagens recentes" como atalho.
- **Coexistir com dados físicos**: rolar no app nunca é obrigatório. A melhoria fácil sobre o DDB é **digitar o resultado do dado físico** sem perder o botão. Falta decidir se a rolagem digital vem ligada por padrão (seção 10.2).
- **Log local por ficha**, persistido pela camada de storage:
  - gaveta recolhível, com a rolagem mais recente no topo;
  - limite de entradas e botão de limpar;
  - limite pensado para a cota do localStorage (~5 MB, compartilhada entre as fichas dos dois sistemas).

  "Para quem mostrar" (Everyone/Self/DM) e Discord não se aplicam. "Copiar resultado" em texto cobre o essencial.

---

## 5. Campanha e multiplayer: horizonte futuro

> **Decisão do dono do produto:** campanha e multiplayer só entram quando a ferramenta estiver mais madura e tiver um **backend de verdade**. Nada aqui é proposta para agora. Esta seção registra o que o DDB oferece e o que o módulo individual deve **preparar desde já** para não fechar essa porta.

### 5.1 O que o DDB oferece (tudo depende de conta e servidor)
- **Campanha**: objeto no servidor com link de convite redefinível. O mestre vê a ficha completa de todos. Historicamente, quem vê também edita; o modo só-leitura prometido não foi confirmado. Privacidade Campaign Only/Public/Private. Conta grátis com 6 vagas de personagem. [confirmado; a visibilidade só por fórum]
- **Compartilhamento de conteúdo (Master)**: até 5 campanhas, 12 jogadores por campanha contando o mestre e 99 personagens (estes números vêm de fórum). Se quem compartilha sai, as fichas podem quebrar. [confirmado parcialmente]
- **Game Log compartilhado e destinos** Everyone/Self/DM desde 02/06/2021. Quebrou várias vezes. [confirmado]
  - Em 10/02/2026: "Roll to DM… unintentionally removed… It is now back!".
  - Entre jul e set/2026: correção do "everyone vs self" no mobile.
  - Em 2026 houve pedido de rolagem oculta até de quem rola.
- **Discord via Avrae**: `!campaign` e sincronização nos dois sentidos; do Discord para o DDB vão só checks, saves e ataques. O vínculo de conta leva até 15 min. Há relatos de atrasos. [a documentação confirmada; os relatos não verificados]
- **Maps** [confirmado]:
  - encontros com iniciativa (out/2024);
  - PV de monstros;
  - condições sincronizadas;
  - visão de espectador para projetor/TV (artigo oficial "Spectator View");
  - dificuldade pelo DMG 2024.
- **Integrações de terceiros** [corrigido]:
  - Beyond20: GPL-3.0, 36 mil usuários no AMO, quebra quando o DDB muda o site;
  - dddice;
  - integração comunitária com Pixels (post de 22/08/2024, não oficial).

### 5.2 Registro técnico para quando chegar a hora (não proposto agora)
A pesquisa mapeou alternativas sem backend próprio. Elas ficam como **registro**, já que a decisão é esperar um backend real:
- **BroadcastChannel**: mesma origem e mesmo navegador, Baseline desde mar/2022, entrega **assíncrona**. [corrigido]
- **QR/link com o estado**: a fixture `COMPLETE_DRAFT` (`src/test/fixtures.ts`) tem 675 B em JSON, 376 B com deflate-raw e 502 caracteres em base64url. O QR v40-L comporta 2.953 B. Ficha de nível 20 não foi medida. [confirmado]
- **P2P**:
  - Trystero (MIT, Nostr por padrão, pacotes `@trystero-p2p/*`);
  - PeerJS Cloud, no ar em 23/10/2026;
  - os servidores padrão do **y-webrtc estão mortos** (teste de 23/10/2026);
  - SDP manual por QR [não verificável];
  - entre 10 e 25% das sessões precisam de TURN [não verificável], e TURN confiável exige servidor (Cloudflare) ou cadastro (Metered).
- **Discord webhook**: CORS liberado (teste de 23/10/2026) e expõe X-RateLimit-* (limite observado: 5). A URL é um segredo. [confirmado]
- **Gerenciados** [corrigido]:
  - Firebase Spark: 100 conexões RTDB por projeto, e o app é desligado se estourar a cota;
  - Supabase grátis: 200 conexões, 2 milhões de mensagens/mês, pausa após 7 dias sem requisições ao banco, 2 projetos ativos.

### 5.3 O que o módulo individual deve preparar desde já
Tudo abaixo serve à ficha individual hoje e mantém a porta aberta:
1. **Estado de jogo separado da ficha**, como campo irmão do draft (ex.: `play` em `SavedCharacter`). Isso evita o "quem vê, edita" do DDB: no futuro, o mestre pode ter uma cópia só-leitura da ficha e um estado de mesa à parte.
2. **Estado em "gasto", não em "atual"** (padrão Foundry `spent` e Dicecloud `damage`), com os máximos sempre derivados da ficha. Um estado assim é pequeno e mesclável. Falta cobrir **o que passa do máximo ou altera o máximo**:
   - espaços criados pela Conjuração Flexível do feiticeiro, que somem no descanso longo;
   - a troca de recursos da Forma Selvagem;
   - o modificador temporário de PV máximo.

   O esquema precisa de "extras temporários" (ou gasto negativo) e de "ajuste temporário de máximo", cada um com a sua regra de reset.
3. **Ids estáveis** para tudo que o estado referencia: recursos, condições, espaços (pool e Pacto separados), itens e rolagens. Nada de referência por nome. Já houve um bug corrigido de idioma guardado pelo nome (commit b85f211).
4. **Formatos 100% serializáveis e versionados**, com versão do esquema e versão dos dados em cada estado e em cada exportação. Sanitizador próprio no import, no padrão do `sanitizeImportedDraft`. A versão também serve para **migrar** fichas salvas quando os números mudarem (seção 8.3).
5. **Rolagem como dado, não como animação.** Cada rolagem vira um registro autocontido: id, timestamp, o que foi rolado, dados individuais, modificadores, total, modo V/D e origem ("app" ou "manual"). O log local só de acréscimo de hoje vira, amanhã, um evento transmissível.
6. **Mudanças de estado como operações nomeadas** (dano, cura, gastar espaço, descanso…), passando por funções puras. Isso dá desfazer agora e eventos/deltas no futuro.
7. **Nenhum segredo no conteúdo exportável.** Se um dia houver webhook ou credencial, ela fica fora da ficha.
8. **Núcleo agnóstico**: o contrato de "jogar" e o motor de dados ficam no `src/core`, para que um protocolo futuro sirva ao D&D e ao Ordem.
9. **Funcionar 100% sem rede**: a rede, quando vier, é bônus.

---

## 6. O que os usuários amam e odeiam

**Amam (o mínimo esperado de qualquer ficha digital)**
- A "ficha no bolso", com as contas feitas ("having the pocket character sheet is huge").
- Tocar na magia ou habilidade e ler a regra na hora ("I can simply click on the spell and it will tell 'em how it works"). É o argumento mais citado para iniciantes.
- Rolar direto da ficha com o modificador somado.
- PV, espaços e usos marcáveis, e botões de descanso que resetam tudo.
- Personalização visual (temas, fundos, molduras). O DDB usa isso como recompensa (fundo liberado a todos em 28/01/2026).
- Rolagens compartilhadas, que viraram expectativa no jogo online em 2026.

As citações de review vindas de agregador não foram verificadas.

**Odeiam (ranking da frente mobile, por frequência e força)**
1. **Offline frágil e dependência de servidor.** A ficha fica presa carregando sem internet, problema ligado a Optional Class Features e Customize Your Origin. Há lentidão e quedas no meio da sessão: mais de 1.200 avisos no Downdetector numa queda, e um "timing out" corrigido em out/2026 [este não verificável].
2. **Editar no jogo exige ir ao site**: subir de nível, trocar equipamento, consumir itens. [confirmado como histórico] O Quickbuilder de 2026 atenua o problema na criação pelo celular.
3. **Confusão e desconfiança 2014/2024** (Legacy, vazamentos, rótulos 5e/5.5e).
4. **Tablet = celular ampliado.** No fórum, 96% numa enquete de ago/2023 pediram uma ficha que aproveitasse a tela [não verificável]. A paisagem é prometida desde 2020.
5. **Iniciante perdido na mesa**: "the rest of the table stares at them, waiting"; a ficha parece "a tax form from some other dimension" (blog de 18/02/2025, que descreve a experiência com as regras 2024). [confirmado]
6. **Recursos e descansos parciais manuais.**
7. **Limite de 6 fichas, trancamento ao cancelar e pagar de novo pelo livro**, agravados pelos Drops (mai/2026). [confirmado]
8. **Falta de português.**
9. **Forma Selvagem e customizações fracas.** [não verificável]
10. **PDF exportado falho**: em branco, cortado, com todas as magias. [não verificável]

Mais específicas da ficha: concentração ausente, buffs fora das rolagens, preparar magias confuso, munição sem desconto, painel de dados intrusivo e falta de notas no app.

**Para nós**: as dores 1, 3, 7 e 8 resolvemos quase de graça pela arquitetura. As dores 2, 5 e 6 são o coração do módulo. Atenção: o DDB ataca as dores 1, 2 e 5 com o app de 2027 e com o Quickbuilder, o que estreita a janela.

---

## 7. Lições dos concorrentes

| Ferramenta | O que faz bem | Lição para nós | Cuidado | Confiança |
|---|---|---|---|---|
| **Roll20 (ficha 2024)** | Campo único de PV entre dois botões (dano/cura); temporário consumido primeiro; cura até o máximo; a 0 PV o bloco vira testes contra a morte; modal de descanso com resumo; ações agrupadas por tipo; visualização compacta | Copiar Dano/Cura num campo e a troca PV↔morte | Regras 2024 (exaustão −2/nível). O app móvel foi **retirado das lojas**; hoje se usa a web na tela inicial. O bug de morte na visualização compacta já foi **corrigido** | PV/morte [confirmado]; modal e toggles [não verificável] |
| **Foundry dnd5e** | **Jogar/Editar** desde 3.0.0 (31/01/2024); Favoritos; `UsesField {spent, max, recovery}` com valor = clamp(max − spent); descansos declarativos (curto: período `sr` + slots `pact`; longo: PV, DV, `lr`+`sr`, `spell`+`pact`, temporários, exaustão −1); AEs condicionais na 6.0.0 (10/09/2026, exige v14) | O modelo de dados mais maduro: guardar "gasto", recuperação declarada, descanso como função pura, Pacto como tipo de slot à parte | O editor de efeito condicional ainda é JSON cru. Roda auto-hospedado, então o offline é "parcial", não "não" | [confirmado/corrigido] |
| **Dicecloud v2** | Árvore de propriedades; atributo com `damage` + `reset`; `actionType` (action/bonus/reaction…); ficha "auditável" (de onde vem cada número) | "Gasto" em vez de "atual"; tocar para ver a origem do número | A liberdade total de atributos é o oposto do que o iniciante precisa. GPL-3.0; sem commits desde 23/01/2026 | [confirmado] |
| **Fight Club 5e** | Offline nativo; Class Trackers; reset de slots no curto por classe (3.7, 20/01/2020); slots unificados na multiclasse (3.6); exaustão em Condições (3.1.0) | Referência de app só local que funcionou; Pacto na multiclasse como teste obrigatório | Parado desde a v3.23 (09/04/2023) | [confirmado] |
| **Shard Tabletop** | Página única igual em todos os aparelhos; bloco fixo CA/Iniciativa/DV/PV/temporário/Descanso; **descanso com prévia e confirmação**; morte que surge e some; ícone d20 nos roláveis; usos em 4 tipos (fixo, atributo, nível, proficiência) com pools nomeados; Inspiração como condição; log de sessão e "NEW SESSION" | A melhor referência de UX para iniciante: copiar o bloco fixo, o descanso em duas fases, a morte automática, os ícones d20 e, se decidido, o "Nova sessão" | Offline não confirmado | [confirmado] |
| **PrismScroll** | Sem conta, dados no aparelho; menus Status (exaustão, condições, morte) e Defesas (10.0.2); aventura-tutorial "The Lantern Thief" com cópia de treino do personagem | Menu Status agrupado; tutorial jogável com cópia | **Mistura 2014 e 2024**; o export de personagem é grátis, mas PDF, rolador e fichas ilimitadas são Pro (US$ 9,99) | [corrigido] |
| **5e Character Sheet** | Offline, sem conta, 9 heróis prontos para "jogar hoje", 9 guias em linguagem simples | Personagem de exemplo e mini-guias "?" | Só iPhone, SRD 5.1 | [confirmado] |
| **Fifth Edition Character Sheet (Kammerer)** | Rollback e restaurar; Google Drive | O "desfazer" é valioso para iniciante | Reclamação de slots com bruxo multiclasse (21/04/2024) | [corrigido] |
| **Pathbuilder 2e** | Grátis com compra única; criador e ficha juntos; offline; JSON/PDF; a precisão de regras é o principal elogio; iOS desde 13/10/2025 | Modelo de negócio e portabilidade parecidos com o nosso | Layout de celular esticado no tablet; UI de jogo pouco amigável; crítica de acessibilidade (VoiceOver); modo de jogo **não confirmado** em fonte primária | [confirmado/corrigido] |
| **Owlbear Rodeo + extensões** | Stat Bubbles com matemática inline ("+6/−6"); confiança nos dados | Matemática inline no campo de PV | Sem ficha nativa; GPL | em parte [não verificável] |
| **Demiplane** | Consulta de regra embutida; notas e diário na ficha; comprado pelo Roll20 em jun/2024 | Diário de sessão local e simples | Suporte a 5e raso | aquisição [confirmado]; resto [não verificável] |
| **Alchemy RPG** | Slots como bolinhas; journal da sessão | — | Estado atual incerto | [não verificável] |

**Armadilha recorrente**: os **slots de Pacto na multiclasse**. Fight Club, Kammerer e outros erraram. O padrão certo tem dois conjuntos. O combinado (tabela de multiclasse) volta no descanso longo. O de Pacto volta no curto e no longo. Os dois conjuram magias de qualquer classe (PHB 2014, p. 164). [confirmado]

**Espaço livre**: nenhum concorrente junta offline sem conta, descanso com prévia, PHB 2014 estrito com multiclasse e guia para iniciante.

---

## 8. Onde estamos: o que o D&D 5e já sustenta e o que falta

### 8.1 O que já existe e é reaproveitável
- **Valores derivados como funções puras e testadas** (19 arquivos de teste em `utils/__tests__`):
  - `getFinalAbilityScores`, `getProficiencyBonus`;
  - `getSkillChecks` e `getPassiveScore` (fonte única das perícias);
  - `getSavingThrowProficiencies`;
  - `calculateArmorClass`, com as parcelas e a desvantagem de Furtividade;
  - `getTotalHp`, `getHitDicePool` (ex.: 3d10 + 2d6);
  - `getInitiativeBonusTotal`, `getSpeedBonusTotal`, `getConditionalAcBonuses`;
  - `getCombinedSpellSlots`, `getPactSlots` (já separados);
  - `getSpellSaveDC`, `getSpellAttackBonus`, `getMaxPreparedSpells`;
  - `getClassResources`, `getUnproficientArmor`.

  Os arquivos são `src/systems/dnd5e/utils/proficiencyUtils.ts`, `armorClassUtils.ts`, `sheetEffects.ts`, `multiclassUtils.ts` e `spellUtils.ts`. **A camada "máximos e bônus" do modo de jogo está pronta**: no modo de jogo, atual = máximo − gasto, mais os extras temporários da seção 5.3. As parcelas da CA e a fonte única das perícias já permitem mostrar "de onde vem este número" quase de graça.
- **Padrão de efeitos declarados** (`types/effects.ts` + `sheetEffects.ts`), com o condicional como linha própria. O `getOwnedClassFeatures` já percorre cada classe da multiclasse no nível dela. É o modelo certo para um tipo irmão de ações e recursos.
- **Armas bem estruturadas** (`types/equipment.ts`): dano com dados, lados e valor fixo (`DamageRoll`), tipo de dano e propriedades tipadas (acuidade, versátil, alcance, munição). O dano de arma já pode ser rolado. Os bugs de base da seção 8.3 afetam o bônus somado.
- **Magias** (`spells.json`, 361 entradas): concentração (154) e ritual (31) em booleanos. O `castingTime` tem só 13 valores e dá para classificar. Isso já sustenta um grimório jogável: filtros, marcador de concentração, gastar espaço e ritual.
- **Texto das regras**: `docs/_book-extracts/dnd-phb.txt`, que fica só no checkout principal, fora do git do worktree. Trechos localizados na revisão:
  - Descanso curto e longo: linhas 16796–16831;
  - Acertos críticos: 17752–17764;
  - 0 PV, morte instantânea, testes contra a morte, estabilizar, nocaute: 17849–17941;
  - PV temporários: 17942–17970;
  - Concentração: 18295 em diante;
  - Apêndice A (condições): 28440–28563, com a Exaustão na 28533.
- **Persistência abstraída**: os componentes não tocam o localStorage. Mas a camada é **por sistema**: `src/systems/dnd5e/utils/storage.ts` e `src/systems/ordem/utils/storage.ts`. A pasta `src/utils/` nem existe, ao contrário do que diz o CLAUDE.md. **O CLAUDE.md precisa ser corrigido para descrever o storage por sistema.**

### 8.2 Lacunas para uma ficha jogável
- **Nenhum estado de sessão.** O `CharacterDraft` (`types/character.ts:78-143`) guarda só a criação. Faltam:
  - PV atual, PV temporário e modificador temporário de PV máximo;
  - testes contra a morte e o estado estável/morto;
  - dados de vida gastos;
  - espaços gastos (pool e Pacto) e usos gastos, mais os extras temporários;
  - condições, exaustão, concentração e inspiração;
  - moedas, munição e consumíveis;
  - flag de equipado;
  - magias preparadas do dia;
  - notas.

  A ficha imprimível deixa tudo isso "a lápis" (`PrintableSheet.tsx:370-377`).
- **Persistência**: o `loadLibrary` reconstrói cada ficha campo a campo, então descarta campos novos. O `exportCharacter` só leva o draft, e o `sanitizeImportedDraft` usa whitelist (`storage.ts:92-146`, `draftValidation.ts:256-296`). Um estado de jogo precisa entrar no mapper, no export/import e num sanitizador próprio.
- **Navegação e contrato**:
  - o `IRpgSystem` (`src/core/types/system.ts`) só conhece criação, impressão e galeria;
  - a `AppState` de `system.ts` é código morto;
  - a `GlobalGallery` chama os stores de cada sistema direto, e o único botão principal é "Abrir";
  - o store do D&D só tem as views `'gallery' | 'wizard' | 'print'`;
  - não existe shell de jogo (o `WizardShell` é de etapas).
- **Agregações presas em componente**: `gatherEquippedWeapons`, `gatherInventory`, as magias conhecidas por todas as vias, `attacksPerAction`, `featureBlocks` e `progressionBlocks` estão dentro do `PrintableSheet`, e a `ReviewStep` repete parte disso. O modo de jogo seria a terceira cópia da conta. É preciso um **modelo de ficha puro** (ex.: `utils/sheetModel.ts`) consumido por Revisão, PDF e Jogo.
- **Recursos de classe**: o `classResourceUtils` tem **12 entradas em 9 classes**, só com o máximo, como string e **sem recuperação**.
  - **Contadores de verdade são só 5**: Fúrias, Chi, Pontos de Feitiçaria, Canalizar Divindade e Forma Selvagem.
  - O resto é **informação de exibição**: Dano de Fúria, dado de Artes Marciais, Movimento sem Armadura, Ataque Furtivo, dado de Inspiração de Bardo e Invocações conhecidas.
  - Os **usos** da Inspiração de Bardo (CAR, mínimo 1) não existem.
  - Faltam ainda:
    - a Fonte de Inspiração;
    - Retomar o Fôlego, Surto de Ação e Indomável;
    - Cura pelas Mãos e Sentido Divino;
    - Dados de Superioridade;
    - Recuperação Arcana e Natural, Arcana Mística;
    - Toque Purificador, Integridade Corporal, Golpe de Sorte, Marés de Caos, Prodígio;
    - recursos de subclasse em geral.
- **Talentos com uso ativo ou que afetam o jogo**: o `feats.json` tem 42 talentos, e só 12 declaram `effects`. Ficam de fora, entre outros:
  - Sortudo, com pontos que voltam no descanso longo;
  - Iniciado em Magia, com magia de 1º nível uma vez por descanso longo;
  - Curandeiro;
  - Líder Inspirador, que dá PV temporários;
  - Conjurador de Guerra, com vantagem no teste de concentração (linha condicional);
  - Conjurador de Ritual, com livro de rituais;
  - Mestre de Armas Grandes e Atirador Aguçado, com a escolha de −5/+10;
  - Sentinela e Matador de Conjuradores, que dão reações;
  - Resistente, com mínimo de 2×CON por dado de vida.
- **Features** (297): só `{level, name, description}`, sem tipo de ação, uso, recuperação ou dado. O `effects.ts` exclui de propósito o que é ativado em jogo. Uma aba de Ações exige um **bloco declarativo novo** (ativação, usos, recuperação), verificado contra o livro regra por regra. É trabalho de dados grande.
- **Ações padrão do turno**: não há dados de Atacar, Disparada, Desengajar, Esquivar, Ajudar, Esconder, Preparar, Procurar e Usar Objeto, nem do ataque de oportunidade e do combate com duas armas como ação bônus.
- **Dados para o crítico**: Crítico Aprimorado e Crítico Superior (margem 19 e 18), Crítico Brutal do bárbaro (dados extras) e o traço do meio-orc em `races.json:541` (um dado extra da arma) não estão estruturados.
- **Dados para o descanso**: a Canção de Descanso do bardo (dado extra na cura do descanso curto) existe só como texto. O Resistente (acima) também.
- **Magias**:
  - dano, tipo, resistência, tipo de ataque, área e escala (upcast e truque) existem só no markdown: 124 têm dados, 138 citam resistência, 105 têm "Em níveis superiores" e 11 truques escalam;
  - truques escalam pelo **nível do personagem**, não pelo nível da classe, o que importa na multiclasse;
  - faltam as regras de magia de ação bônus (a outra magia do turno só pode ser um truque de 1 ação) e de ritual por classe (o mago conjura do grimório; clérigo e druida só as preparadas; o bardo só as conhecidas).
- **Magias sempre preparadas** (domínio, juramento, círculo da Terra, patrono expandido), Arcana Mística, Dádiva do Pacto e outras: só prosa, não estruturadas nem escolhidas no criador.
- **Magias inatas** (`InnateSpell`): sem usos, recuperação ou nível de conjuração. O PDF escreve "1×/descanso longo" fixo.
- **Inventário**: não materializado (`CharacterInventory` declarado e nunca usado). A munição vem em pacotes, sem a regra de recuperar metade após o combate. Não há carteira. O equipado é inferido. Consumíveis não têm efeito estruturado, e não há itens mágicos.
- **Condições**:
  - não há dados nem tipos, o glossário não tem nenhuma e não existe `docs/regras-condicoes.md`;
  - o futuro `conditions.json` deve ter **14 condições mais a Exaustão** (15 entradas). O dossiê fala em "15 condições + exaustão", o que conta a exaustão duas vezes;
  - além do texto, ele precisa dos efeitos que mexem no estado de jogo:
    - Inconsciente larga o que segura e torna crítico o ataque a 1,5 m;
    - Incapacitado quebra a concentração;
    - os deslocamentos 0 e metade;
    - o PV máximo pela metade na exaustão 4.
- **Traços raciais**: resistências a dano, Arma de Sopro, Resistência Implacável, Sortudo e Bravura existem só em prosa. Não há campo `damageResistances`.
- **Custos das escolhas de progressão** (chi, pontos de feitiçaria, dado de superioridade): não estruturados.

### 8.3 Bugs de base que o modo de jogo herdaria

*Os itens 1 a 5 foram reconferidos à mão na main depois da revisão, e todos se confirmam:*
- *1: a Tenacidade Anã é só texto em `races.json`, e `getFeatHpBonus` soma apenas talentos;*
- *2: `CASTER_TYPES` é indexado só pela classe, e `pooledCasterEntries` ignora a subclasse;*
- *3: só existe uma entrada "Ataque Extra" do guerreiro, no nível 5;*
- *4: `weaponFormat.ts:96` sempre soma a proficiência;*
- *5: `ReviewStep.tsx:141` e `PrintableSheet.tsx:220` usam `cls.savingThrows`.*

*O item 6 não foi reconferido.*
1. **Tenacidade Anã** e **Resiliência Dracônica** (PV por nível; CA 13 + DES) não entram em PV nem em CA.
2. **Cavaleiro Arcano e Trapaceiro Arcano não ganham espaços nem magias**: não há tabela `third` em `progression.json`, e `getCombinedCasterLevel` só é chamado nos testes.
3. **Ataque Extra do guerreiro 11/20** sai como 2×. A conta é feita pelo nome, e a escala está na prosa (`PrintableSheet.tsx:252`).
4. **Ataque com arma soma proficiência sem checar** `hasWeaponProficiency`. Também não aplica estilo de luta, Artes Marciais, Dano de Fúria nem o dano versátil a duas mãos.
5. **Revisão e PDF ignoram a resistência do Resiliente**: usam `cls.savingThrows` em vez de `getSavingThrowProficiencies`.
6. Movimento sem Armadura do monge e Movimento Rápido do bárbaro ficam fora do deslocamento.

**Migração**: corrigir os bugs 1 a 3 muda PV, CA e espaços de **fichas já salvas**. É preciso um plano de migração (pela versão do esquema e dos dados) e um aviso ao jogador ("sua ficha foi corrigida: PV 12 → 14"). Com o estado em "gasto", o valor atual sobe junto com o máximo, mas isso precisa de teste.

---

## 9. Recomendação: escopo do módulo em fases

**Escopo decidido**: só a ficha individual usada durante o jogo, mais a rolagem de dados.

**Restrições**:
- SPA sem backend;
- PHB 2014;
- **ficha imutável durante o jogo**: só o estado de sessão muda, e mudança estrutural volta ao fluxo de criação;
- cálculo de dados separado da animação.

**Decisões que precisam vir antes da Fase 1**, porque mudam o MVP: crítico (10.2.7), efeitos incondicionais de condição (10.2.15), o que conta como sessão (10.2.4) e rolagem digital por padrão (10.2.18).

### Fase 0: alicerce (antes de qualquer tela)
- **Registrar o módulo no CLAUDE.md**, em commit `docs:`.
  - Hoje a V1 não lista modo de jogo e põe "evolução de personagem em sessão" fora do escopo.
  - O commit deve incluir a ficha jogável no escopo, manter subir de nível e XP fora e proibir explicitamente multiplayer, mestre e backend.
  - Também deve corrigir a descrição do storage: a camada é por sistema, em `src/systems/<sistema>/utils/storage.ts`.
- **Corrigir os bugs de base** da seção 8.3, de preferência declarando como efeito nos dados (ex.: PV e CA sem armadura como efeitos de raça e de feature) em vez de espalhar `if`. Incluir a **migração** das fichas salvas e o aviso ao jogador.
- **Extrair o modelo de ficha puro** (armas equipadas, magias conhecidas, ataques por ação, inventário inicial resolvido), para Revisão, PDF e Jogo lerem a mesma conta.
- **Digitalizar em `/docs`** as regras do modo de jogo a partir das linhas já localizadas no extrato (seção 8.1): descanso, morte (com estável e dano massivo), PV temporário, concentração, condições e exaustão, dano e crítico, ações padrão e carga. Isso segue o fluxo livro → `/docs` → `src/data`. Os pontos em que a tradução diverge do inglês vão ao dono (10.1).
- **Dados de condições**: 14 condições mais a Exaustão, com o texto e os efeitos que mexem no estado de jogo.
- **Declarar a recuperação dos 5 pools existentes** e criar os usos da Inspiração de Bardo.
- **Definir o estado de jogo** como campo irmão do draft:
  - em "gasto", com extras temporários e ajuste temporário de máximo;
  - com ids estáveis e versão;
  - incluído no mapper, no export/import (a decidir) e num sanitizador.
- **Motor de rolagem puro no núcleo**: RNG confiável, notação mínima, V/D, crítico e resultado como registro serializável, com cobertura obrigatória de testes. Os `Math.random` espalhados, inclusive nos storages, passam a usar uma fonte comum.
- **Contrato de "jogar"** como capacidade **opcional** do sistema no `IRpgSystem`; o Ordem pode não implementar ainda (decisão 10.2.17). Remover a `AppState` morta.

### Fase 1: MVP "ficha viva + dados"

**Fechada em 2026-10-29.** Ficaram de fora, de propósito:
- tela acesa, som e vibração, que esperam a decisão 10.2.22;
- a trava de "um descanso longo a cada 24 h", porque é tempo de jogo, não de relógio. Fica só o aviso.

- **Entrada**: botão "Jogar" na galeria, que abre uma view de jogo própria e responsiva. No celular em retrato, uma coluna com seções por swipe. No tablet e no desktop, mais densidade.
- **Bloco de vitais fixo**: CA, Iniciativa, PV com barra, PV temporário, Dados de Vida, Descanso e Inspiração como liga/desliga.
- **PV**:
  - Dano/Cura num toque, com teclado numérico e "+5/−7";
  - o temporário absorve primeiro e não soma; ao receber PV temporário novo, a ficha pergunta "manter X ou trocar por Y";
  - a cura não passa do máximo;
  - ajuste temporário de PV máximo, resetado no descanso longo;
  - **desfazer a última ação**.
- **Estados de morte completos**:
  - os testes contra a morte surgem a 0 PV, com Inconsciente aplicado, e somem ao curar;
  - estável, morto e dano massivo seguem o livro;
  - PV temporário a 0 PV não acorda o personagem;
  - explicação curta e rolagem opcional.
- **Espaços de magia** (combinados e de Pacto separados) como bolinhas clicáveis.
- **Recursos**: os 5 contadores existentes mais os usos da Inspiração de Bardo, com a recuperação declarada na Fase 0. Os outros 6 itens do `classResourceUtils` aparecem como informação.
- **Descansos curto e longo em duas fases**:
  - prévia do que volta;
  - gastar dados de vida um a um, com rolagem ou valor manual, escolhendo o tipo na multiclasse;
  - confirmar e ver o resumo;
  - o longo respeita os pré-requisitos (pelo menos 1 PV, um a cada 24 h).

  Teste obrigatório: bruxo/mago no descanso curto recupera só o Pacto. A Canção de Descanso e o Resistente entram se os dados estiverem declarados; senão, viram aviso.
- **Condições do PHB 2014 e exaustão 1–6**: lista com toque para ler a regra. O efeito condicional aparece como **aviso ou linha condicional**. O efeito incondicional (PV máximo na exaustão 4, deslocamento 0 ou pela metade) segue a decisão 10.2.15; a recomendação é aplicá-lo no número, como manda a regra de ouro.
- **Concentração como marcador manual** ("Concentrando em…"), com o lembrete do teste de CON e da CD ao registrar dano. A concentração cai sozinha com Incapacitado.
- **Regra a um toque**: características, traços, talentos e magias em modo leitura, com a regra completa num painel. Sem isso, o modo de jogo perde para o PDF.
- **"De onde vem este número"**: tocar em CA, perícia, resistência e iniciativa mostra as parcelas.
- **Nota livre por ficha.**
- **Rolagem**:
  - tocar em perícia, resistência, atributo, iniciativa e ataque com arma rola;
  - **dano de arma**, que já está estruturado, com o crítico conforme a decisão 10.2.7, para não rolar ataque sem rolar dano;
  - seletor Normal/V/D visível, com os dois d20 na vantagem e na desvantagem;
  - conta sempre aberta, com o 20 e o 1 destacados;
  - **entrada manual de dado físico**;
  - rolador livre simples (d4 a d100, quantidade, modificador);
  - histórico local por ficha, com limite de entradas;
  - "copiar resultado".
- **Animação 2D/CSS** leve, com `prefers-reduced-motion`.
- **Acessibilidade mínima**: `aria-live` no resultado, contraste, alvos de toque e teclado. Manter a tela acesa (Screen Wake Lock API) e som ou vibração opcionais vêm de conhecimento geral, não do dossiê, e precisam de verificação antes de virar requisito (10.2.22).
- **Gamificação barata**: feedback visual de dano e cura, aviso de PV baixo (inspirado nas extensões) e celebração do 20 natural.

### Fase 2: o turno completo
- **"O que posso fazer no meu turno?"**: ações agrupadas em Ação / Ação Bônus / Reação / Outras, com as ações padrão do PHB, custo visível e botão "Usar" que gasta o recurso. Exige o bloco declarativo novo nas features, nos talentos e nos traços raciais (ex.: Arma de Sopro, Sortudo).
- **Efeitos ativos com liga/desliga** (Fúria, Bênção, Escudo Arcano, Armadura Arcana) como linhas condicionais. Fúria e Bênção são candidatas a ir antes, conforme a decisão 10.2.16, que também define se um efeito ativo incondicional muda a CA.
- **Recursos completos** (a lista da seção 8.2), talentos com uso, magias inatas com contador e custos das escolhas de progressão. Entram também a **Conjuração Flexível** como extras temporários, condicionada à decisão 10.2.4.
- **Grimório jogável**:
  - Conjurar gastando espaço, com upcast mostrando o ganho;
  - ritual sem gastar, com a regra por classe;
  - restrição da magia de ação bônus;
  - truques escalando pelo nível do personagem;
  - concentração marcada automaticamente ao conjurar e aviso de troca.

  **Preparar magias após o descanso longo** é condicionado à decisão 10.2.4. Para clérigo, druida e paladino, trocar as preparadas hoje reescreve `spellChoices.spells` do draft, ou seja, mexe na ficha.
- **Dano estruturado de magias**, com dados extraídos semiautomaticamente da descrição e **revisados contra o livro**. O dano extra no crítico usa Crítico Aprimorado, Superior e Brutal e o traço do meio-orc, uma vez estruturados.
- **Checklist leve do turno** (ação, bônus, movimento, reação), se aprovado.
- **Inventário de sessão**:
  - moedas +/−;
  - munição −1, com a recuperação de metade após o combate;
  - consumíveis (ex.: Poção de Cura);
  - equipar/desequipar com a CA ao vivo, se aprovado e condicionado à decisão 10.2.4.
- **Defesas** (resistências e imunidades) como bloco informativo, com seleção opcional de tipo de dano aplicando a resistência.
- **PWA** (instalável e offline com service worker).

### Fase 3: refinamentos
- **Dados 3D opcionais**, carregados sob demanda.
  - Medir o peso real no build antes de escolher a biblioteca, e evitar GPL/AGPL.
  - A animação sempre forçada ao resultado do motor (seção 4.3).
  - Hoje a rota preferível é three com física própria ou dice-box-threejs (MIT, aceita resultado predeterminado), lembrando que o cannon-es está parado. Rapier e dice-box só servem se for possível forçar a face.
- **Temas de dado** como recompensa local por marcos, com licenças próprias ou verificadas.
- **Modo forma** (Forma Selvagem/Polimorfia), com dano excedente.
- **Diário de sessão** estruturado, além da nota livre do MVP, e um eventual "Nova sessão" (decisão 10.2.20). Personagem de exemplo e mini-guias "?" (decisão 10.2.21).
- **PDF** refletindo o estado de jogo e só as magias preparadas.
- **Ordem** implementado sobre o mesmo contrato, se não for antecipado (10.2.17).

### Fica de fora (e por quê)
| Fora | Por quê |
|---|---|
| Campanha, mestre, rastreador de iniciativa de grupo, monstros | Decisão do produto. Exige backend e dados de monstros (SRD); a dificuldade de encontro seria do DMG, fora do PHB |
| Compartilhamento e sincronização entre jogadores, Game Log compartilhado, destinos Everyone/Self/DM, rolagem oculta | Decisão: só com backend real. Não há outros participantes |
| Discord (webhook/Avrae), Beyond20, VTT, mapa | Sem mesa compartilhada na V1. Até o DDB tem problemas de confiabilidade aqui, e o Sigil mostra o custo de um VTT pesado |
| Subir de nível e XP em sessão | O CLAUDE.md põe "evolução de personagem em sessão" fora da V1. Subir de nível só pelo criador (a confirmar, 10.2.2) |
| Regras 2024 (Inspiração Heroica, exaustão −2, todos os DV no longo) | O projeto é PHB 2014. Usar a confusão do DDB como argumento ("sua ficha 2014 nunca muda sozinha") |
| Edição estrutural no modo jogo (nível, classe, atributos) | Restrição de ficha imutável; volta ao fluxo de criação |
| Efeito **condicional** aplicado sozinho nos números (Bênção, vantagens de condição) | Regra de ouro do projeto: o condicional vira linha e aviso. O incondicional entra no número, conforme as decisões 10.2.15 e 10.2.16 |
| Overrides livres estilo Dicecloud e homebrew | Contra o foco no iniciante; homebrew está fora do escopo da V1 |
| Itens mágicos e sintonização | Não há itens mágicos nos dados |

---

## 10. Riscos e decisões que você precisa tomar

### 10.1 Dúvidas de regra que não podem ser chutadas
*Conferir no PHB 2014 e digitalizar em `/docs` antes de implementar. As páginas citadas pelo dossiê não foram conferidas. As linhas do extrato (`docs/_book-extracts/dnd-phb.txt`) foram localizadas na revisão e estão indicadas abaixo.*

1. **Crítico** (linhas 17752–17764). O texto diz para rolar todos os dados de dano do ataque duas vezes, inclusive os dados extras do ataque (o exemplo citado é o Ataque Furtivo), com os modificadores normais. **Resolvido no essencial.** Falta confirmar:
   - a margem expandida (Crítico Aprimorado 19, Crítico Superior 18);
   - o Crítico Brutal do bárbaro;
   - o dado extra do meio-orc (`races.json:541`);
   - como cada um entra no motor.
2. **Testes contra a morte** (linhas 17849–17941). Pontos a confirmar:
   - 10 ou mais é sucesso;
   - o 1 natural conta 2 falhas;
   - o 20 natural volta com 1 PV;
   - dano a 0 PV conta falha, e crítico conta duas;
   - regras de estabilizar e de nocaute.

   **Dano massivo existe**: se o dano restante depois de chegar a 0 PV for igual ou maior que o PV máximo, o personagem morre.
3. **Dados de vida no descanso curto** (linhas 16796–16820): gastar um por vez, decidindo após cada rolagem. O "mínimo 0 em dado de vida + CON" **não está no livro**; é fala de moderador do DDB. O dono decide se vale.
4. **Descanso longo** (linhas 16821–16831):
   - recupera o PV total;
   - recupera metade dos dados de vida. O **"mínimo 1" vem da edição em inglês**, e a tradução diz só "metade da quantidade total", então é preciso decidir qual vale;
   - começa com pelo menos 1 PV, e só cabe um a cada 24 h;
   - na multiclasse, **quais tipos de dado de vida voltam** é dúvida em aberto;
   - os PV temporários terminam ou não? Confirmar.
5. **Exaustão** (linha 28533): a tabela de 6 níveis e a redução de 1 nível por descanso longo com comida e bebida.
6. **PV temporários** (linhas 17942–17970): **resolvido pelo livro**. Eles não somam, e o jogador **decide** se fica com os antigos ou com os novos (linhas 17959–17965). Confirmar se a cura não os afeta e se PV temporário a 0 PV não acorda o personagem.
7. **Concentração** (linha 18295 em diante): CD 10 ou metade do dano, o que for maior; o que a quebra (inclusive ficar Incapacitado); uma magia por vez.
8. **Magia de Pacto e multiclasse**: recuperação no curto, uso cruzado entre classes e tabela combinada (p. 164–165, `docs/regras-multiclasse.md`).
9. **Recuperação Arcana e Natural**: limite e restrições.
10. **Inspiração 2014**: binária, concedida pelo mestre, dá vantagem.
11. **Recursos que recuperam diferente no curto e no longo**, e a recuperação exata de cada recurso e talento da seção 8.2.
12. **Truques escalam pelo nível do personagem** na multiclasse, não pelo nível da classe.
13. **Magias**: a restrição da magia de ação bônus e as regras de ritual por classe (mago, clérigo, druida, bardo).
14. **Condições** (linhas 28440–28563): os efeitos mecânicos exatos de cada uma das 14 mais a Exaustão. Em especial Inconsciente (larga o que segura, crítico a 1,5 m), Incapacitado, Agarrado e Impedido.
15. **Munição**: recuperar metade após o combate (seção de armas do PHB).
16. **Carga** (p. 176), se o inventário entrar.

### 10.2 Decisões de produto
1. **Fichas incompletas** (`missingCount > 0`) podem ser jogadas ou ficam bloqueadas?
2. **O que acontece com o estado de jogo** quando o jogador volta ao criador e muda nível, classe ou atributos? Com o estado em "gasto" ele sobrevive, mas o que fazer com recursos que deixam de existir? Confirmar também que **subir de nível só acontece pelo criador** ("evolução de personagem em sessão" está fora da V1 no CLAUDE.md).
3. **O export/import JSON leva o estado da sessão** ou só a ficha?
4. **"Ficha imutável" versus sessão**: preparar magias após o descanso longo (para clérigo, druida e paladino isso hoje reescreve `spellChoices.spells`), equipar/desequipar, trocar armadura e a Conjuração Flexível do feiticeiro contam como sessão ou como edição da ficha?
5. **Bugs de base**: corrigir na Fase 0 (recomendado) ou junto com o módulo?
6. **Profundidade das magias** no MVP: só concentração, ritual e tempo (já dá para um grimório) ou também dano estruturado (trabalho grande de dados)?
7. **Crítico automático** no 20 natural (o DDB recebeu reclamação por não deixar desmarcar) ou só um botão "rolar dano crítico"? **Precisa vir antes da Fase 1**, porque o dano de arma entra no MVP.
8. **Entrada manual de dado físico** ao lado do botão de rolar (recomendado: sim)?
9. **3D**: fora do MVP (recomendado) ou já na V1?
10. **Checklist de turno** (ação, bônus, movimento, reação): no MVP ou na Fase 2?
11. **Inventário e moedas** no MVP ou na Fase 2?
12. **Contrato "play" no `IRpgSystem` já agora**, com a galeria passando a usar o contrato em vez dos stores diretos?
13. **Temas de dado como recompensa** (gamificação local)?
14. **PWA** entra no MVP ou na Fase 2?
15. **Condições e exaustão com efeito incondicional** (PV máximo na exaustão 4, deslocamento 0 ou pela metade) mudam o número, como manda a regra de ouro (recomendado), ou ficam só como aviso?
16. **Efeitos ativos** (Fúria, Bênção, Armadura Arcana, Escudo Arcano) entram no MVP como liga/desliga ou na Fase 2? E um efeito ativo incondicional (Armadura Arcana: CA 13 + DES) muda a CA durante a sessão?
17. **O Ordem Paranormal precisa ser atendido já no MVP?** O pedido fala das fichas produzidas pelo app, o que inclui as do Ordem. A pergunta 10.2.12 só trata do contrato.
18. **A rolagem digital vem ligada por padrão**, ou o padrão é "só contabilidade" com dados físicos? Dá para desligar por ficha? **Decidido (2026-10-25):** desligada por padrão. O jogador rola na mesa e a tela mostra o que rolar e quanto somar. Os dados do app são uma configuração, sem destaque no MVP.
19. **Mínimo 1 no descanso longo e mínimo 0 no dado de vida + CON** (seção 10.1, itens 3 e 4): o que vale?
20. **Quanto histórico de rolagens guardar?** Existe um "Nova sessão" (padrão Shard) que limpa o log e reseta marcadores? A cota do localStorage (~5 MB) é compartilhada entre as fichas dos dois sistemas.
21. **Personagens de exemplo e tutorial jogável** (padrão 5e Character Sheet e PrismScroll): entram, e em qual fase?
22. **Notas de sessão** no MVP (recomendado: nota livre) ou só na Fase 3? Acessibilidade mínima e tela acesa contam como requisito do MVP?
23. **Migração**: os bugs da Fase 0 mudam números de fichas já salvas. Avisar o jogador e migrar automaticamente?

### 10.3 Riscos
- **Janela competitiva**: o app presencial do DDB (previsto para 2027) e o Quickbuilder (2026, para iniciante; o "sem conta" é [não verificável]) miram o mesmo público. A data do Character Builder novo diverge entre as fontes. Nossa defesa é PHB 2014 estrito, offline, sem conta e em português.
- **Trabalho de dados subestimado**: declarar ativação, usos e recuperação de 297 features, 42 talentos, traços raciais, ações padrão, condições e dano de 361 magias exige revisão regra por regra no livro. É o maior custo do módulo.
- **Contaminação de regras 2024**: Roll20, PrismScroll e o próprio DDB servem de referência de UX, mas muitas vezes estão nas regras de 2024. Toda regra vem do PHB. Onde a tradução diverge do inglês (o "mínimo 1"), decide o dono.
- **Tensão com a regra de ouro**: tratar todas as condições como aviso contraria o "incondicional entra no número" e quebra o rastreador de PV na exaustão 4.
- **Desempenho e intrusão do 3D**: foram a maior fonte de reclamação do DDB em 2026. As bibliotecas 3D estão com manutenção fraca (dice-box, cannon-es, owlbear/dice), algumas são GPL/AGPL, e as de física só servem se for possível forçar o resultado.
- **Terceira cópia da conta**: sem extrair o modelo de ficha, o Jogo vai divergir da Revisão e do PDF, como já aconteceu com o Resiliente.
- **Persistência silenciosa**: o `loadLibrary`, que reconstrói campo a campo, apagaria o estado de jogo se não for atualizado.
- **Migração das fichas salvas**: corrigir os bugs de base muda PV, CA e espaços sem o jogador esperar.
- **Cota do localStorage**: histórico de rolagens e estado de jogo de muitas fichas, nos dois sistemas, dividem ~5 MB.
- **Limites desta pesquisa**: o domínio do DDB e o seu suporte deram erro de TLS nesta rede, e o Reddit ficou inacessível. Vários detalhes finos são [não verificável]: nomes exatos das abas, layout atual do ajuste rápido de PV, conteúdo exato do painel de descanso de 2026 e contagens de toques (estimativas). O modo de jogo do Pathbuilder também não foi visto em fonte primária. A frente de código foi conferida só por amostragem. Vale reconferir no navegador antes de usar algum desses pontos como requisito.

---

## 11. Fontes

**Código e documentos do projeto**
- `CLAUDE.md` (escopo da V1, regra de ouro do `sheetEffects`, persistência)
- `src/core/types/system.ts`, `src/core/systems/registry.ts`, `src/core/stores/appStore.ts`, `src/App.tsx`, `src/GlobalGallery.tsx`
- `src/systems/dnd5e/stores/characterStore.ts`, `src/systems/dnd5e/Dnd5eApp.tsx`, `src/components/wizard/WizardShell.tsx`
- `src/systems/dnd5e/utils/storage.ts`, `draftValidation.ts`, `proficiencyUtils.ts`, `armorClassUtils.ts`, `sheetEffects.ts`, `multiclassUtils.ts`, `spellUtils.ts`, `classResourceUtils.ts`, `weaponFormat.ts`, `classUtils.ts`, `equipmentUtils.ts`, `glossary.ts`, `abilityScoreUtils.ts`; `src/systems/dnd5e/utils/__tests__/` (19 arquivos)
- `src/systems/dnd5e/types/character.ts`, `effects.ts`, `class.ts`, `spell.ts`, `race.ts`, `equipment.ts`
- `src/systems/dnd5e/data/classes.json`, `class-progression-features.json`, `progression.json`, `progression-choices.json`, `spells.json`, `races.json` (linha 541), `feats.json`, `general-items.json`, `battle-master-maneuvers.json`, `metamagic-options.json`, `four-elements-disciplines.json`
- `src/systems/dnd5e/components/PrintableSheet.tsx`, `components/steps/ReviewStep.tsx`, `components/steps/SpellStep.tsx`, `components/steps/EquipmentStep.tsx`
- `src/systems/ordem/utils/ordemWeaponUtils.ts`, `src/systems/ordem/utils/storage.ts`, `src/test/fixtures.ts`
- `docs/_book-extracts/dnd-phb.txt`: linha 88; 16796–16831 (descansos); 17752–17764 (crítico); 17849–17941 (0 PV e morte); 17942–17970 (PV temporários); 18295 em diante (concentração); 28440–28563 (Apêndice A, Exaustão na 28533)
- `docs/regras-classes.md`, `docs/magias/regras-magias.md`, `docs/regras-multiclasse.md`

**D&D Beyond: oficial (posts, changelog, suporte)**
- https://www.dndbeyond.com/old-changelog/256-character-sheet-revamp
- https://www.dndbeyond.com/changelog
- https://www.dndbeyond.com/changelog/1061-rollable-hit-dice
- https://www.dndbeyond.com/old-changelog/1150-death-saving-throws
- https://www.dndbeyond.com/old-changelog/324-mobile-sheet-swiping-and-product-key-redemption
- https://www.dndbeyond.com/old-changelog/844-character-sheet-changelog-july-7th-updates
- https://www.dndbeyond.com/old-changelog/827-character-sheet-changelog-early-june-updates
- https://www.dndbeyond.com/old-changelog/937-share-your-dice-rolls-digital-dice-open-beta
- https://www.dndbeyond.com/posts/939-share-your-dice-results-with-the-brand-new-game
- https://www.dndbeyond.com/old-changelog/1013-keep-your-rolls-secret
- https://www.dndbeyond.com/old-changelog/789-digital-dice-alpha-is-live
- https://www.dndbeyond.com/old-changelog/966-monster-dice-rolling-for-the-encounter-builder
- https://www.dndbeyond.com/old-changelog/971-d-d-beyond-mobile-app-2-0
- https://www.dndbeyond.com/posts/1003-how-to-customize-your-character-sheet-on-d-d
- https://www.dndbeyond.com/posts/1054-its-in-the-bag-how-to-use-containers-on-your
- https://www.dndbeyond.com/posts/1816-the-official-d-d-vtt-navigating-maps-on-d-d-beyond
- https://www.dndbeyond.com/posts/1841-roll-for-initiative-combat-tracking-comes-to-the
- https://www.dndbeyond.com/posts/1863-monster-stat-blocks-and-hit-point-tracking-come-to
- https://www.dndbeyond.com/posts/1875-updating-your-campaign-to-the-5-5e-d-d-rules
- https://www.dndbeyond.com/posts/2116-d-d-beyond-2025-wrap-up
- https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap
- https://www.dndbeyond.com/posts/2133-roll-5-sets-of-digital-dice-today-to-celebrate-the
- https://www.dndbeyond.com/posts/2135-behind-the-screen-the-new-quickbuilder-and-future
- https://www.dndbeyond.com/posts/2156-introducing-d-d-beyond-drops-a-growing-content
- https://www.dndbeyond.com/posts/2186-whats-new-on-ddb-shared-dice-rolls-onto-mobile
- https://www.dndbeyond.com/posts/2212-condition-tracking-comes-to-the-maps-vtt
- https://www.dndbeyond.com/posts/2223-mid-year-update-d-d-beyonds-2026-development
- https://www.dndbeyond.com/subscribe
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193980820-Character-Header
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747201888404-Digital-Dice-How-to-roll-your-free-or-premium-Digital-Dice
- https://dndbeyond-support.wizards.com/hc/en-us/sections/46493883372436-Shared-Dice-3D-Dice
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46494109625236-Where-can-I-roll-Shared-Dice
- https://dndbeyond-support.wizards.com/hc/en-us/articles/50149172432020-Performance-Optimized-Dice-Sets-for-Mobile-and-Lower-Spec-Computers
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46494067702932-Can-I-show-off-my-digital-dice-sets
- https://dndbeyond-support.wizards.com/hc/en-us/articles/40964522619540-Shared-Party-Inventory-FAQ
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46363705015188-Who-can-join-a-game-session-with-Maps
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164-Combat-Encounters-on-Maps
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747237485716
- https://dndbeyond-support.wizards.com/hc/en-us/articles/42550438974868-Sigil-Sunset-FAQ
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46714474300692-Why-is-D-D-Beyond-making-this-change-now
- https://dndbeyond-support.wizards.com/hc/en-us/articles/49018920243348-What-happens-to-all-my-characters-using-Drops-options-if-I-cancel-my-subscription
- https://dndbeyond-support.wizards.com/hc/en-us/articles/49482708273044-Are-Journals-accessible-anywhere-outside-of-Maps-like-the-Campaign-Page
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193137684-D-D-Beyond-Mobile-App

**D&D Beyond: fórum (percepção; em grande parte não verificável)**
- …/18376-hit-points-and-healing-pools-on-mobile
- …/208374-add-damage-type-to-the-health-tracker
- …/112538-concentration-indicator
- …/4863-exhaustion-is-only-available-as-a-single-condition
- …/196579-short-rest-hit-die
- …/231051-spells-management-is-confusing-and-frustrating
- …/236696-new-dice-roller
- …/237012-official-update-on-dice-performance-issues
- …/177402-mobile-app-on-tablet
- …/215943-show-more-on-the-character-sheet-with-larger
- …/192075-how-do-i-change-language-in-my-character-sheet
- …/186771-arcane-recovery
- …/215305-druid-character-sheet-failings

Todos ficam sob https://www.dndbeyond.com/forums/; os caminhos completos estão no dossiê.

**Imprensa e terceiros sobre o DDB**
- https://dnyuz.com/2026/08/07/dungeons-and-dragons-every-new-tool-announced-for-dd-beyond/
- https://www.vice.com/en/article/dungeons-and-dragons-every-new-tool-announced-for-dd-beyond/
- https://comicbook.com/gaming/feature/everything-revealed-for-dnd-2027-roadmap-gen-con-2026-recap/
- https://www.belloflostsouls.net/2026/03/dd-beyond-launches-new-character-quickbuilder-for-first-level-follies.html
- https://www.belloflostsouls.net/2026/08/dd-beyond-to-go-mobile-in-the-near-future.html
- https://www.wargamer.com/dnd/free-maps-vtt
- https://www.wargamer.com/dnd/beyond-reverses-2024-decision-backlash
- https://www.wargamer.com/dnd/beyond-roadmap
- https://www.rascal.news/wizards-of-the-coast-shutters-sigil-virtual-tabletop-project-lays-off-30-staff/
- https://arcane.org/2026/04/20/sharing-is-caring-content-sharing-in-dd-beyond/
- https://en.wikipedia.org/wiki/D%26D_Beyond
- https://apps.apple.com/us/app/d-d-beyond/id1501810129
- https://dndforbeginners.substack.com/p/confusion-isnt-fun
- https://github.com/AwsomeFox/campfire/issues/1848

**Extensões e integrações**
- https://microsoftedge.microsoft.com/addons/detail/ddb-character-sheet-ove/kgocgldlnkhjfbpblnpgkpmagabddedm
- https://rollwarden.app/
- https://addons.mozilla.org/firefox/addon/rollwarden/
- https://github.com/jasentm/Reaction-and-Concentration-Tracker
- https://addons.mozilla.org/addon/truesight-ui/
- https://github.com/kakaroto/Beyond20 (e `src/common/settings.js`)
- https://avrae.readthedocs.io/en/latest/ddb.html
- https://docs.dddice.com/docs/integrations/dnd-beyond/
- https://gamewithpixels.com/blogs/blog/dnd-beyond-with-pixels
- https://github.com/TaylorHo/dnd-beyond-kit

**Concorrentes**
- https://help.roll20.net/hc/en-us/articles/30748164251287-Dungeons-Dragons-2024-Character-Sheet
- https://blog.roll20.net/posts/game-changing-features-on-roll20s-2024-dd-character-sheets/
- https://help.roll20.net/hc/en-us/articles/4411213438231-Using-Roll20-on-Mobile-Devices
- https://github.com/foundryvtt/dnd5e/releases (e `module/config.mjs`, `module/data/shared/uses-field.mjs`, `module/documents/actor/actor.mjs`)
- https://github.com/ThaumRystra/DiceCloud (e `app/imports/api/properties/Attributes.ts`, `Actions.ts`)
- https://apps.apple.com/us/app/fight-club-5th-edition/id901057473
- https://apps.apple.com/us/app/pathbuilder-2e/id6740821064
- https://www.shardtabletop.com/howto/using-character-sheet
- https://www.shardtabletop.com/howto/usage-values
- https://apps.apple.com/us/app/prismscroll-5e-companion/id1364209163
- https://5echaractersheet.com/
- https://apps.apple.com/us/app/fifth-edition-character-sheet/id967650851
- https://extensions.owlbear.rodeo/bubble-tracker
- https://forums.demiplane.com/t/pathfinder-nexus-characters-tools-launch-version-update/2732
- https://alchemyrpg.com/player-walkthrough

**Dados: bibliotecas e referências**
- https://blog.owlbear.rodeo/owlbear-rodeo-2-0-dice-deep-dive/
- https://blog.owlbear.rodeo/are-owlbear-rodeos-dice-still-fair/
- https://github.com/owlbear-rodeo/dice
- https://github.com/3d-dice/dice-box
- https://fantasticdice.games/docs/usage/config
- https://github.com/3d-dice/dice-box-threejs
- https://gitlab.com/riccisi/foundryvtt-dice-so-nice
- https://bundlephobia.com/api/size?package=@3d-dice/dice-box@1.1.4
- https://bundlephobia.com/api/size?package=three@0.186.1
- https://bundlephobia.com/api/size?package=cannon-es@0.20.0
- https://bundlephobia.com/api/size?package=@dice-roller/rpg-dice-roller@5.5.1

**Horizonte multiplayer (registro)**
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream
- https://github.com/dmotz/trystero
- https://peerjs.com/peerserver.html
- https://github.com/yjs/y-webrtc
- https://developers.cloudflare.com/realtime/pricing/
- https://www.metered.ca/tools/openrelay/
- https://firebase.google.com/pricing
- https://supabase.com/pricing
- https://supabase.com/docs/guides/realtime/limits
- https://help.roll20.net/hc/en-us/articles/30748164251287-Dungeons-Dragons-2024-Character-Sheet (Inspiração Heroica 2024)

**Fora do dossiê (a verificar antes de usar como requisito)**
- Screen Wake Lock API e som/vibração na rolagem: conhecimento geral sobre uso presencial, sem fonte no dossiê.
