import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outDir = path.resolve(__dirname, '../src/systems/ordem/data')
const outFile = path.join(outDir, 'equipments.json')

function cat(str) {
  if (str === '0') return 0;
  if (str === 'I') return 1;
  if (str === 'II') return 2;
  if (str === 'III') return 3;
  if (str === 'IV') return 4;
  return 0;
}

const equipments = [
  // Armas Simples
  { id: 'faca', name: 'Faca', category: 0, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'leve', weaponCategory: 'corpo_a_corpo', damage: '1d4', critical: '19', range: 'Curto', damageType: 'C' },
  { id: 'martelo', name: 'Martelo', category: 0, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'leve', weaponCategory: 'corpo_a_corpo', damage: '1d6', critical: 'x2', range: '-', damageType: 'I' },
  { id: 'punhal', name: 'Punhal', category: 0, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'leve', weaponCategory: 'corpo_a_corpo', damage: '1d4', critical: 'x3', range: '-', damageType: 'P' },
  { id: 'bastao', name: 'Bastão', category: 0, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '1d6/1d8', critical: 'x2', range: '-', damageType: 'I' },
  { id: 'machete', name: 'Machete', category: 0, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '1d6', critical: '19', range: '-', damageType: 'C' },
  { id: 'lanca', name: 'Lança', category: 0, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '1d6', critical: 'x2', range: 'Curto', damageType: 'P' },
  { id: 'cajado', name: 'Cajado', category: 0, spaces: 2, type: 'weapon', proficiency: 'simple', grip: 'duas_maos', weaponCategory: 'corpo_a_corpo', damage: '1d6/1d6', critical: 'x2', range: '-', damageType: 'I' },
  { id: 'arco', name: 'Arco', category: 0, spaces: 2, type: 'weapon', proficiency: 'simple', grip: 'duas_maos', weaponCategory: 'disparo', damage: '1d6', critical: 'x3', range: 'Médio', damageType: 'P' },
  { id: 'besta', name: 'Besta', category: 0, spaces: 2, type: 'weapon', proficiency: 'simple', grip: 'duas_maos', weaponCategory: 'disparo', damage: '1d8', critical: '19', range: 'Médio', damageType: 'P' },
  { id: 'pistola', name: 'Pistola', category: 1, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'leve', weaponCategory: 'fogo', damage: '1d12', critical: '18', range: 'Curto', damageType: 'B' },
  { id: 'revolver', name: 'Revólver', category: 1, spaces: 1, type: 'weapon', proficiency: 'simple', grip: 'leve', weaponCategory: 'fogo', damage: '2d6', critical: '19/x3', range: 'Curto', damageType: 'B' },
  { id: 'fuzil-de-caca', name: 'Fuzil de Caça', category: 1, spaces: 2, type: 'weapon', proficiency: 'simple', grip: 'duas_maos', weaponCategory: 'fogo', damage: '2d8', critical: '19/x3', range: 'Médio', damageType: 'B' },
  
  // Armas Táticas
  { id: 'machadinha', name: 'Machadinha', category: 0, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'leve', weaponCategory: 'corpo_a_corpo', damage: '1d6', critical: 'x3', range: 'Curto', damageType: 'C' },
  { id: 'nunchaku', name: 'Nunchaku', category: 0, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'leve', weaponCategory: 'corpo_a_corpo', damage: '1d8', critical: 'x2', range: '-', damageType: 'I' },
  { id: 'corrente', name: 'Corrente', category: 0, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '1d8', critical: 'x2', range: '-', damageType: 'I' },
  { id: 'espada', name: 'Espada', category: 1, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '1d8/1d10', critical: '19', range: '-', damageType: 'C' },
  { id: 'florete', name: 'Florete', category: 1, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '1d6', critical: '18', range: '-', damageType: 'P' },
  { id: 'machado', name: 'Machado', category: 1, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '1d8', critical: 'x3', range: '-', damageType: 'C' },
  { id: 'maca', name: 'Maça', category: 1, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'uma_mao', weaponCategory: 'corpo_a_corpo', damage: '2d4', critical: 'x2', range: '-', damageType: 'I' },
  { id: 'acha', name: 'Acha', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'corpo_a_corpo', damage: '1d12', critical: 'x3', range: '-', damageType: 'C' },
  { id: 'gadanho', name: 'Gadanho', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'corpo_a_corpo', damage: '2d4', critical: 'x4', range: '-', damageType: 'C' },
  { id: 'katana', name: 'Katana', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'corpo_a_corpo', damage: '1d10', critical: '19', range: '-', damageType: 'C' },
  { id: 'marreta', name: 'Marreta', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'corpo_a_corpo', damage: '3d4', critical: 'x2', range: '-', damageType: 'I' },
  { id: 'montante', name: 'Montante', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'corpo_a_corpo', damage: '2d6', critical: '19', range: '-', damageType: 'C' },
  { id: 'motosserra', name: 'Moto-serra', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'corpo_a_corpo', damage: '3d6', critical: 'x2', range: '-', damageType: 'C' },
  { id: 'arco-composto', name: 'Arco Composto', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'disparo', damage: '1d10', critical: 'x3', range: 'Médio', damageType: 'P' },
  { id: 'balestra', name: 'Balestra', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'disparo', damage: '1d12', critical: '19', range: 'Médio', damageType: 'P' },
  { id: 'submetralhadora', name: 'Submetralhadora', category: 1, spaces: 1, type: 'weapon', proficiency: 'tactical', grip: 'uma_mao', weaponCategory: 'fogo', damage: '2d6', critical: '19/x3', range: 'Curto', damageType: 'B' },
  { id: 'espingarda', name: 'Espingarda', category: 1, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'fogo', damage: '4d6', critical: 'x3', range: 'Curto', damageType: 'B' },
  { id: 'fuzil-assalto', name: 'Fuzil de Assalto', category: 2, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'fogo', damage: '2d10', critical: '19/x3', range: 'Médio', damageType: 'B' },
  { id: 'fuzil-precisao', name: 'Fuzil de Precisão', category: 3, spaces: 2, type: 'weapon', proficiency: 'tactical', grip: 'duas_maos', weaponCategory: 'fogo', damage: '2d10', critical: '19/x3', range: 'Longo', damageType: 'B' },
  
  // Armas Pesadas
  { id: 'bazuca', name: 'Bazuca', category: 3, spaces: 2, type: 'weapon', proficiency: 'heavy', grip: 'duas_maos', weaponCategory: 'fogo', damage: '10d8', critical: 'x2', range: 'Médio', damageType: 'I' },
  { id: 'lanca-chamas', name: 'Lança-chamas', category: 3, spaces: 2, type: 'weapon', proficiency: 'heavy', grip: 'duas_maos', weaponCategory: 'fogo', damage: '6d6', critical: 'x2', range: 'Curto', damageType: 'Fogo' },
  { id: 'metralhadora', name: 'Metralhadora', category: 2, spaces: 2, type: 'weapon', proficiency: 'heavy', grip: 'duas_maos', weaponCategory: 'fogo', damage: '2d12', critical: '19/x3', range: 'Médio', damageType: 'B' },

  // Munições
  { id: 'municao-flechas', name: 'Flechas', category: 0, spaces: 1, type: 'general' },
  { id: 'municao-balas-curtas', name: 'Balas Curtas', category: 0, spaces: 1, type: 'general' },
  { id: 'municao-balas-longas', name: 'Balas Longas', category: 1, spaces: 1, type: 'general' },
  { id: 'municao-cartuchos', name: 'Cartuchos', category: 1, spaces: 1, type: 'general' },
  { id: 'municao-foguete', name: 'Foguete', category: 1, spaces: 1, type: 'general' },
  { id: 'municao-combustivel', name: 'Combustível', category: 1, spaces: 1, type: 'general' },

  // Proteções
  { id: 'protecao-leve', name: 'Proteção Leve', category: 1, spaces: 2, type: 'protection', defenseBonus: 5 },
  { id: 'protecao-pesada', name: 'Proteção Pesada', category: 2, spaces: 5, type: 'protection', defenseBonus: 10 },
  { id: 'escudo', name: 'Escudo', category: 0, spaces: 2, type: 'protection', defenseBonus: 2, isShield: true },

  // Acessórios
  { id: 'kit-pericia', name: 'Kit de Perícia', category: 0, spaces: 1, type: 'accessory' },
  { id: 'utensilio', name: 'Utensílio', category: 1, spaces: 1, type: 'accessory' },
  { id: 'vestimenta', name: 'Vestimenta', category: 1, spaces: 1, type: 'accessory' },

  // Explosivos
  { id: 'granada-atordoamento', name: 'Granada de Atordoamento', category: 0, spaces: 1, type: 'explosive' },
  { id: 'granada-fragmentacao', name: 'Granada de Fragmentação', category: 1, spaces: 1, type: 'explosive' },
  { id: 'granada-fumaca', name: 'Granada de Fumaça', category: 0, spaces: 1, type: 'explosive' },
  { id: 'granada-incendiaria', name: 'Granada Incendiária', category: 1, spaces: 1, type: 'explosive' },
  { id: 'mina-antipessoal', name: 'Mina Antipessoal', category: 1, spaces: 1, type: 'explosive' },

  // Itens Operacionais
  { id: 'algemas', name: 'Algemas', category: 0, spaces: 1, type: 'general' },
  { id: 'arpeu', name: 'Arpéu', category: 0, spaces: 1, type: 'general' },
  { id: 'bandoleira', name: 'Bandoleira', category: 1, spaces: 1, type: 'general' },
  { id: 'binoculos', name: 'Binóculos', category: 0, spaces: 1, type: 'general' },
  { id: 'bloqueador-sinal', name: 'Bloqueador de Sinal', category: 1, spaces: 1, type: 'general' },
  { id: 'cicatrizante', name: 'Cicatrizante', category: 1, spaces: 1, type: 'general' },
  { id: 'corda', name: 'Corda', category: 0, spaces: 1, type: 'general' },
  { id: 'equipamento-sobrevivencia', name: 'Equipamento de Sobrevivência', category: 0, spaces: 2, type: 'general' },
  { id: 'lanterna-tatica', name: 'Lanterna Tática', category: 1, spaces: 1, type: 'general' },
  { id: 'mascara-gas', name: 'Máscara de Gás', category: 0, spaces: 1, type: 'general' },
  { id: 'mochila-militar', name: 'Mochila Militar', category: 1, spaces: 0, type: 'general' }, // * (does not take space)
  { id: 'oculos-visao-termica', name: 'Óculos de Visão Térmica', category: 1, spaces: 1, type: 'general' },
  { id: 'pe-cabra', name: 'Pé de Cabra', category: 0, spaces: 1, type: 'general' },
  { id: 'pistola-dardos', name: 'Pistola de Dardos', category: 1, spaces: 1, type: 'general' },
  { id: 'pistola-sinalizadora', name: 'Pistola Sinalizadora', category: 0, spaces: 1, type: 'general' },
  { id: 'soqueira', name: 'Soqueira', category: 0, spaces: 1, type: 'general' }, // technically a weapon enhancement, but placed as general for now
  { id: 'spray-pimenta', name: 'Spray de Pimenta', category: 1, spaces: 1, type: 'general' },
  { id: 'taser', name: 'Taser', category: 1, spaces: 1, type: 'general' },
  { id: 'traje-hazmat', name: 'Traje Hazmat', category: 1, spaces: 2, type: 'general' }
];

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(equipments, null, 2))
console.log(`Saved ${equipments.length} equipments to ${outFile}`)
