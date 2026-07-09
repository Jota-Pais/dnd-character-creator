import fs from 'fs';
import path from 'path';

const textPath = path.join(process.cwd(), 'docs/_book-extracts/ordem-paranormal.txt');
const outputPath = path.join(process.cwd(), 'src/systems/ordem/data/rituals.json');

const text = fs.readFileSync(textPath, 'utf-8');
const lines = text.split('\n');

const rituals = [];
let currentCircle = 1;
let currentElement = 'knowledge';

const elementMap = {
  'SANGUE': 'blood',
  'MORTE': 'death',
  'ENERGIA': 'energy',
  'CONHECIMENTO': 'knowledge',
  'MEDO': 'fear'
};

const slugify = (str) => {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

let currentRitual = null;

for (let i = 7937; i <= 8112; i++) {
  let line = lines[i].trim();
  if (!line || line.startsWith('Miguel Machado') || line.startsWith('===== PAGINA') || line.match(/^\d+$/) || line === 'LISTA DE RITUAIS') {
    continue;
  }

  if (line.match(/^1o\s+CÍRCULO/i)) { currentCircle = 1; continue; }
  if (line.match(/^2o\s+CÍRCULO/i)) { currentCircle = 2; continue; }
  if (line.match(/^3o\s+CÍRCULO/i)) { currentCircle = 3; continue; }
  if (line.match(/^4o\s+CÍRCULO/i)) { currentCircle = 4; continue; }

  if (elementMap[line]) {
    currentElement = elementMap[line];
    continue;
  }

  const isRitualStart = line.match(/^([\p{Lu}][\p{L}0-9\s-]*)\.\s*(.*)/u);
  
  if (isRitualStart && isRitualStart[1].trim().split(' ').length <= 5) {
    if (currentRitual) {
      rituals.push(currentRitual);
    }
    const name = isRitualStart[1].trim();
    let desc = isRitualStart[2].trim();
    currentRitual = {
      id: slugify(name),
      name: name,
      circle: currentCircle,
      element: currentElement,
      description: desc
    };
  } else if (currentRitual) {
    if (currentRitual.description && !currentRitual.description.endsWith(' ')) {
       currentRitual.description += ' ';
    }
    currentRitual.description += line;
  }
}

if (currentRitual) {
  rituals.push(currentRitual);
}

rituals.forEach(r => {
  r.description = r.description.trim().replace(/\s+/g, ' ');
  if (!r.description.endsWith('.')) {
    r.description += '.';
  }
});

fs.writeFileSync(outputPath, JSON.stringify(rituals, null, 2), 'utf-8');
console.log(`Extracted ${rituals.length} rituals to ${outputPath}`);
