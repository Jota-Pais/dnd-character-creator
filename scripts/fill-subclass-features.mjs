#!/usr/bin/env node
// Preenche as features de ENTRADA (nível de escolha da subclasse) das subclasses
// que estavam vazias, a partir do PHB 2014. Fonte: docs/regras-classes.md + livro.
// Idempotente: só sobrescreve subclasses presentes no mapa FEATURES abaixo.
import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const CLASSES_PATH = resolve(root, 'src/data/classes.json')

// subclassId -> features de entrada [{ name, description }]
const FEATURES = {
  // ── Bárbaro (nível 3) ──
  'berserker': [
    { name: 'Frenesi', description: 'Ao entrar em fúria, você pode entrar em frenesi. Pela duração da fúria, você pode realizar um único ataque corpo-a-corpo com arma como ação bônus em cada um dos seus turnos. Quando a fúria acabar, você sofre um nível de exaustão.' },
  ],
  'totem-warrior': [
    { name: 'Conselheiro Espiritual', description: 'Você adquire a habilidade de conjurar as magias sentido bestial e falar com animais, mas apenas na forma de rituais.' },
    { name: 'Totem Espiritual', description: 'Escolha um totem espiritual — Águia, Lobo ou Urso — e ganhe seu benefício em fúria. Águia: inimigos têm desvantagem em ataques de oportunidade contra você e você pode Disparar como ação bônus. Lobo: aliados têm vantagem em ataques corpo-a-corpo contra inimigos a 1,5 m de você. Urso: você tem resistência a todo dano exceto psíquico.' },
  ],

  // ── Guerreiro (nível 3) ──
  'champion': [
    { name: 'Crítico Aprimorado', description: 'Seus ataques com arma causam acerto crítico com uma rolagem de 19 ou 20 na jogada de ataque.' },
  ],
  'battle-master': [
    { name: 'Superioridade em Combate', description: 'Você aprende 3 manobras (de uma lista) alimentadas por 4 dados de superioridade (d8), recuperados em descanso curto ou longo. A CD das manobras é 8 + bônus de proficiência + seu modificador de Força ou Destreza.' },
    { name: 'Estudioso da Guerra', description: 'Você ganha proficiência com um tipo de ferramenta de artesão, à sua escolha.' },
  ],
  'eldritch-knight': [
    { name: 'Conjuração', description: 'Você amplia seu poderio marcial com magia de mago (usando Inteligência): aprende 2 truques e algumas magias de 1° nível, focadas em abjuração e evocação.' },
    { name: 'Vínculo com Arma', description: 'Por um ritual de 1 hora, você forja um elo com até duas armas. Você não pode ser desarmado delas e pode invocá-las para sua mão como ação bônus, se estiverem no mesmo plano.' },
  ],

  // ── Ladino (nível 3) ──
  'thief': [
    { name: 'Mãos Rápidas', description: 'Você pode usar a ação bônus da Ação Ardilosa para fazer um teste de Destreza (Prestidigitação), usar ferramentas de ladrão para desarmar armadilha ou abrir fechadura, ou realizar a ação de Usar um Objeto.' },
    { name: 'Andarilho de Telhados', description: 'Escalar não custa movimento extra e, ao saltar com corrida, a distância aumenta em 0,3 m × seu modificador de Destreza.' },
  ],
  'assassin': [
    { name: 'Proficiência Adicional', description: 'Você ganha proficiência com kit de disfarce e kit de venenos.' },
    { name: 'Assassinar', description: 'Você tem vantagem em ataques contra criaturas que ainda não agiram no combate. Qualquer acerto contra uma criatura surpresa é um acerto crítico.' },
  ],
  'arcane-trickster': [
    { name: 'Conjuração', description: 'Você adquire magia de mago (usando Inteligência), com foco em ilusão e encantamento: aprende 3 truques (incluindo mãos mágicas) e algumas magias de 1° nível.' },
    { name: 'Mãos Mágicas Malabaristas', description: 'Ao conjurar mãos mágicas você pode torná-la invisível, guardar/recuperar objetos em recipientes de outra criatura e usar ferramentas de ladrão à distância, controlando-a com a ação bônus da Ação Ardilosa.' },
  ],

  // ── Monge (nível 3) ──
  'open-hand': [
    { name: 'Técnica da Mão Aberta', description: 'Quando você atinge com um ataque da Rajada de Golpes, pode impor um efeito ao alvo: derrubá-lo (resistência de Destreza), empurrá-lo 4,5 m (resistência de Força) ou impedir suas reações até o fim do próximo turno dele.' },
  ],
  'shadow': [
    { name: 'Artes Sombrias', description: 'Você pode gastar 2 pontos de chi para conjurar escuridão, visão no escuro, passos sem pegadas ou silêncio, sem componentes materiais. Ganha o truque ilusão menor, se ainda não o conhecia.' },
  ],
  'four-elements': [
    { name: 'Discípulo dos Elementos', description: 'Você aprende disciplinas mágicas que gastam pontos de chi para manipular os quatro elementos. Conhece a Sintonia Elemental e mais uma disciplina, à sua escolha.' },
  ],

  // ── Paladino (nível 3) ──
  'oath-of-devotion': [
    { name: 'Magias de Juramento', description: 'Você recebe magias de juramento sempre preparadas conforme sobe de nível (proteção contra o bem e mal e santuário no 3° nível).' },
    { name: 'Canalizar Divindade', description: 'Duas opções: Arma Sagrada (imbui uma arma, somando seu mod. de Carisma aos ataques e emitindo luz) e Expulsar o Profano (força corruptores e mortos-vivos a fugir).' },
  ],
  'oath-of-the-ancients': [
    { name: 'Magias de Juramento', description: 'Você recebe magias de juramento sempre preparadas conforme sobe de nível (fogo das fadas e enfeitiçar pessoa no 3° nível).' },
    { name: 'Canalizar Divindade', description: 'Duas opções: Fúria da Natureza (enreda inimigos com vinhas espectrais) e Expulsar os Infiéis (força fadas e corruptores a fugir).' },
  ],
  'oath-of-vengeance': [
    { name: 'Magias de Juramento', description: 'Você recebe magias de juramento sempre preparadas conforme sobe de nível (perdição e enfeitiçar pessoa no 3° nível).' },
    { name: 'Canalizar Divindade', description: 'Duas opções: Abjurar Inimigo (amedronta e reduz o deslocamento de um inimigo) e Voto de Inimizade (vantagem nas jogadas de ataque contra um alvo escolhido).' },
  ],

  // ── Patrulheiro (nível 3) ──
  'hunter': [
    { name: 'Presa do Caçador', description: 'Escolha uma opção: Assassino de Colossos (1d8 de dano extra a alvos feridos), Matador de Gigantes (reação para atacar criaturas Grandes ou maiores) ou Destruidor de Hordas (um ataque adicional contra outra criatura próxima).' },
  ],
  'beast-master': [
    { name: 'Companheiro Animal', description: 'Você forma um vínculo mágico com uma besta de VD 1/4 ou inferior, que luta ao seu lado, obedece a seus comandos e usa seu bônus de proficiência.' },
  ],
  'gloom-stalker': [
    { name: 'Batedor do Subterrâneo', description: 'No primeiro turno de combate, você ganha +3 m de deslocamento e um ataque adicional se usar a ação de Ataque. Criaturas com visão no escuro não têm vantagem para detectá-lo no escuro.' },
    { name: 'Magia do Rastreador Subterrâneo', description: 'Você ganha visão no escuro de 27 m e magias adicionais sempre preparadas conforme sobe de nível (disfarçar-se no 3° nível).' },
  ],

  // ── Bardo (nível 3) ──
  'college-of-lore': [
    { name: 'Proficiência Adicional', description: 'Você ganha proficiência em três perícias, à sua escolha.' },
    { name: 'Palavras de Interrupção', description: 'Com sua reação e um uso de Inspiração de Bardo, subtraia o dado de inspiração da jogada de ataque, teste de habilidade ou jogada de dano de uma criatura a até 18 m.' },
  ],
  'college-of-valor': [
    { name: 'Proficiências Adicionais', description: 'Você ganha proficiência com armaduras médias, escudos e armas marciais.' },
    { name: 'Inspiração em Combate', description: 'Uma criatura com sua Inspiração de Bardo pode somar o dado a uma jogada de dano ou, com uma reação, à CA contra um ataque.' },
  ],

  // ── Druida (nível 2) ──
  'circle-of-the-land': [
    { name: 'Truque Adicional', description: 'Você aprende um truque de druida adicional, à sua escolha.' },
    { name: 'Recuperação Natural', description: 'Durante um descanso curto, você recupera espaços de magia gastos cujo total de níveis seja até metade do seu nível de druida (uma vez por dia).' },
  ],
  'circle-of-the-moon': [
    { name: 'Forma Selvagem de Combate', description: 'Você pode usar Forma Selvagem como ação bônus e, transformado, gastar espaços de magia como ação bônus para recuperar pontos de vida.' },
    { name: 'Formas do Círculo', description: 'Você pode assumir formas de bestas mais poderosas (VD até 1, aumentando conforme sobe de nível).' },
  ],

  // ── Mago (nível 2) — cada escola: "Instruído" (custo/tempo de cópia à metade) + feature ──
  'abjuration': [
    { name: 'Abjuração Instruída', description: 'O ouro e o tempo para copiar magias de abjuração no seu grimório são reduzidos à metade.' },
    { name: 'Proteção Arcana', description: 'Ao conjurar uma magia de abjuração de 1° nível ou superior, você cria uma proteção mágica que absorve dano até um limite baseado no seu nível de mago.' },
  ],
  'divination': [
    { name: 'Adivinhação Instruída', description: 'O ouro e o tempo para copiar magias de adivinhação no seu grimório são reduzidos à metade.' },
    { name: 'Prodígio', description: 'Após um descanso longo, role dois d20 e registre os valores; você pode substituir qualquer jogada de ataque, teste ou resistência (sua ou de uma criatura visível) por um deles.' },
  ],
  'conjuration': [
    { name: 'Conjuração Instruída', description: 'O ouro e o tempo para copiar magias de conjuração no seu grimório são reduzidos à metade.' },
    { name: 'Conjuração Menor', description: 'Com uma ação, você conjura um objeto inanimado (até 3 kg, cabendo num cubo de 30 cm) que dura 1 hora.' },
  ],
  'enchantment': [
    { name: 'Encantamento Instruído', description: 'O ouro e o tempo para copiar magias de encantamento no seu grimório são reduzidos à metade.' },
    { name: 'Olhar Hipnotizante', description: 'Com uma ação, você deixa uma criatura a até 1,5 m atordoada enquanto a fita (resistência de Sabedoria para resistir).' },
  ],
  'evocation': [
    { name: 'Evocação Instruída', description: 'O ouro e o tempo para copiar magias de evocação no seu grimório são reduzidos à metade.' },
    { name: 'Esculpir Magias', description: 'Ao conjurar uma magia de evocação que afeta outras criaturas, você protege 1 + o nível da magia delas, que passam automaticamente na resistência e não sofrem dano.' },
  ],
  'illusion': [
    { name: 'Ilusão Instruída', description: 'O ouro e o tempo para copiar magias de ilusão no seu grimório são reduzidos à metade.' },
    { name: 'Ilusão Menor Aprimorada', description: 'Você aprende o truque ilusão menor (ou outro, se já o conhece) e pode criar som e imagem ao mesmo tempo com uma única conjuração.' },
  ],
  'necromancy': [
    { name: 'Necromancia Instruída', description: 'O ouro e o tempo para copiar magias de necromancia no seu grimório são reduzidos à metade.' },
    { name: 'Colheita Sinistra', description: 'Quando você mata uma criatura com uma magia de 1° nível ou superior, recupera pontos de vida iguais a duas vezes o nível da magia (ou três vezes, se for morto-vivo).' },
  ],
  'transmutation': [
    { name: 'Transmutação Instruída', description: 'O ouro e o tempo para copiar magias de transmutação no seu grimório são reduzidos à metade.' },
    { name: 'Alquimia Menor', description: 'Você pode transformar temporariamente um objeto não-mágico de madeira, pedra, ferro, cobre ou prata em outro desses materiais.' },
  ],
}

// Injeção in-place preservando o estilo compacto do arquivo: cada subclasse está
// em uma única linha; substituímos apenas o "features": [] dessa linha.
let raw = readFileSync(CLASSES_PATH, 'utf-8')
let filled = 0
for (const [id, features] of Object.entries(FEATURES)) {
  const compact =
    '[' +
    features
      .map(f => `{ "name": ${JSON.stringify(f.name)}, "description": ${JSON.stringify(f.description)} }`)
      .join(', ') +
    ']'
  // localiza a linha da subclasse pelo id e troca seu features vazio
  const lineRe = new RegExp(`("id": "${id}",[^\\n]*?)"features": \\[\\]`)
  if (!lineRe.test(raw)) {
    console.warn(`  ! subclasse não encontrada ou já preenchida: ${id}`)
    continue
  }
  raw = raw.replace(lineRe, `$1"features": ${compact}`)
  filled++
}
writeFileSync(CLASSES_PATH, raw, 'utf-8')
// valida que continua sendo JSON válido
JSON.parse(raw)
console.log(`✓ ${filled} subclasses preenchidas (de ${Object.keys(FEATURES).length} no mapa); JSON válido`)
