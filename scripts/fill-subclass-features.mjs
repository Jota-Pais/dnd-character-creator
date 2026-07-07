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
