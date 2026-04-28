# Equipamentos — D&D 5e PHB 2014

## Sistema de Moedas

| Moeda           | Sigla | Valor em pc |
| --------------- | ----- | ----------- |
| Peça de Cobre   | pc    | 1           |
| Peça de Prata   | pp    | 10          |
| Peça de Eletro  | pe    | 50          |
| Peça de Ouro    | po    | 100         |
| Peça de Platina | ppt   | 1000        |

**Convenção:** custos registrados na moeda original do PHB (ex: `5 po`, `2 pp`). Conversão pra pc é feita no JSON gerado.

---

# 1. Armas

## Tipos de dano

- `bludgeoning` (concussão)
- `piercing` (perfurante)
- `slashing` (cortante)

## Propriedades de arma

- `ammunition` (munição) — usa munição, com alcance específico
- `finesse` (acuidade) — pode usar STR ou DEX no ataque
- `heavy` (pesada) — desvantagem se usuário Pequeno
- `light` (leve) — pode ser usada em ataque com duas armas
- `loading` (recarga) — só 1 ataque por turno
- `range` (alcance) — distância de ataque normal/máxima em metros
- `reach` (alcance estendido) — +1.5m de alcance
- `special` (especial) — efeito único descrito no item
- `thrown` (arremesso) — pode ser arremessada
- `two-handed` (duas mãos) — requer duas mãos
- `versatile` (versátil) — pode ser usada com uma ou duas mãos (dano alterado)

## Armas Simples Corpo-a-Corpo

### Adaga

**ID:** dagger
**Nome:** Adaga
**Categoria:** simple
**Tipo:** melee
**Custo:** 2 po
**Dano:** 1d4 `piercing`
**Peso:** 0.5 kg
**Propriedades:** `finesse`, `light`, `thrown` (range 6/18)

### Azagaia

**ID:** javelin
**Nome:** Azagaia
**Categoria:** simple
**Tipo:** melee
**Custo:** 5 pp
**Dano:** 1d6 `piercing`
**Peso:** 1 kg
**Propriedades:** `thrown` (range 9/36)

### Bordão

**ID:** quarterstaff
**Nome:** Bordão
**Categoria:** simple
**Tipo:** melee
**Custo:** 2 pp
**Dano:** 1d6 `bludgeoning`
**Peso:** 2 kg
**Propriedades:** `versatile` (1d8)

### Clava Grande

**ID:** greatclub
**Nome:** Clava Grande
**Categoria:** simple
**Tipo:** melee
**Custo:** 2 pp
**Dano:** 1d8 `bludgeoning`
**Peso:** 5 kg
**Propriedades:** `heavy`, `two-handed`

### Foice Curta

**ID:** sickle
**Nome:** Foice Curta
**Categoria:** simple
**Tipo:** melee
**Custo:** 1 po
**Dano:** 1d4 `slashing`
**Peso:** 1 kg
**Propriedades:** `light`

### Lança

**ID:** spear
**Nome:** Lança
**Categoria:** simple
**Tipo:** melee
**Custo:** 1 po
**Dano:** 1d6 `piercing`
**Peso:** 1.5 kg
**Propriedades:** `thrown` (range 6/18), `versatile` (1d8)

### Maça

**ID:** mace
**Nome:** Maça
**Categoria:** simple
**Tipo:** melee
**Custo:** 5 po
**Dano:** 1d6 `bludgeoning`
**Peso:** 2 kg
**Propriedades:** Nenhuma

### Machadinha

**ID:** handaxe
**Nome:** Machadinha
**Categoria:** simple
**Tipo:** melee
**Custo:** 5 po
**Dano:** 1d6 `slashing`
**Peso:** 1 kg
**Propriedades:** `light`, `thrown` (range 6/18)

### Martelo Leve

**ID:** light-hammer
**Nome:** Martelo Leve
**Categoria:** simple
**Tipo:** melee
**Custo:** 2 po
**Dano:** 1d4 `bludgeoning`
**Peso:** 1 kg
**Propriedades:** `light`, `thrown` (range 6/18)

### Porrete

**ID:** club
**Nome:** Porrete
**Categoria:** simple
**Tipo:** melee
**Custo:** 1 pp
**Dano:** 1d4 `bludgeoning`
**Peso:** 1 kg
**Propriedades:** `light`

## Armas Simples à Distância

### Arco Curto

**ID:** shortbow
**Nome:** Arco Curto
**Categoria:** simple
**Tipo:** ranged
**Custo:** 25 po
**Dano:** 1d6 `piercing`
**Peso:** 1 kg
**Propriedades:** `ammunition` (range 24/96), `two-handed`

### Besta Leve

**ID:** light-crossbow
**Nome:** Besta Leve
**Categoria:** simple
**Tipo:** ranged
**Custo:** 25 po
**Dano:** 1d8 `piercing`
**Peso:** 2.5 kg
**Propriedades:** `ammunition` (range 24/96), `loading`, `two-handed`

### Dardo

**ID:** dart
**Nome:** Dardo
**Categoria:** simple
**Tipo:** ranged
**Custo:** 5 pc
**Dano:** 1d4 `piercing`
**Peso:** 0.1 kg
**Propriedades:** `finesse`, `thrown` (range 6/18)

### Funda

**ID:** sling
**Nome:** Funda
**Categoria:** simple
**Tipo:** ranged
**Custo:** 1 pp
**Dano:** 1d4 `bludgeoning`
**Peso:** null
**Propriedades:** `ammunition` (range 9/36)

## Armas Marciais Corpo-a-Corpo

### Alabarda

**ID:** halberd
**Nome:** Alabarda
**Categoria:** martial
**Tipo:** melee
**Custo:** 20 po
**Dano:** 1d10 `slashing`
**Peso:** 3 kg
**Propriedades:** `heavy`, `reach`, `two-handed`

### Cimitarra

**ID:** scimitar
**Nome:** Cimitarra
**Categoria:** martial
**Tipo:** melee
**Custo:** 25 po
**Dano:** 1d6 `slashing`
**Peso:** 1.5 kg
**Propriedades:** `finesse`, `light`

### Chicote

**ID:** whip
**Nome:** Chicote
**Categoria:** martial
**Tipo:** melee
**Custo:** 2 po
**Dano:** 1d4 `slashing`
**Peso:** 1.5 kg
**Propriedades:** `finesse`, `reach`

### Espada Curta

**ID:** shortsword
**Nome:** Espada Curta
**Categoria:** martial
**Tipo:** melee
**Custo:** 10 po
**Dano:** 1d6 `piercing`
**Peso:** 1 kg
**Propriedades:** `finesse`, `light`

### Espada Grande

**ID:** greatsword
**Nome:** Espada Grande
**Categoria:** martial
**Tipo:** melee
**Custo:** 50 po
**Dano:** 2d6 `slashing`
**Peso:** 3 kg
**Propriedades:** `heavy`, `two-handed`

### Espada Longa

**ID:** longsword
**Nome:** Espada Longa
**Categoria:** martial
**Tipo:** melee
**Custo:** 15 po
**Dano:** 1d8 `slashing`
**Peso:** 1.5 kg
**Propriedades:** `versatile` (1d10)

### Glaive

**ID:** glaive
**Nome:** Glaive
**Categoria:** martial
**Tipo:** melee
**Custo:** 20 po
**Dano:** 1d10 `slashing`
**Peso:** 3 kg
**Propriedades:** `heavy`, `reach`, `two-handed`

### Lança de Montaria

**ID:** lance
**Nome:** Lança de Montaria
**Categoria:** martial
**Tipo:** melee
**Custo:** 10 po
**Dano:** 1d12 `piercing`
**Peso:** 3 kg
**Propriedades:** `reach`, `special`

### Lança Longa

**ID:** pike
**Nome:** Lança Longa
**Categoria:** martial
**Tipo:** melee
**Custo:** 5 po
**Dano:** 1d10 `piercing`
**Peso:** 4 kg
**Propriedades:** `heavy`, `reach`, `two-handed`

### Maça Estrela

**ID:** morningstar
**Nome:** Maça Estrela
**Categoria:** martial
**Tipo:** melee
**Custo:** 15 po
**Dano:** 1d8 `piercing`
**Peso:** 2 kg
**Propriedades:** Nenhuma

### Machado Grande

**ID:** greataxe
**Nome:** Machado Grande
**Categoria:** martial
**Tipo:** melee
**Custo:** 30 po
**Dano:** 1d12 `slashing`
**Peso:** 3.5 kg
**Propriedades:** `heavy`, `two-handed`

### Machado de Batalha

**ID:** battleaxe
**Nome:** Machado de Batalha
**Categoria:** martial
**Tipo:** melee
**Custo:** 10 po
**Dano:** 1d8 `slashing`
**Peso:** 2 kg
**Propriedades:** `versatile` (1d10)

### Malho

**ID:** maul
**Nome:** Malho
**Categoria:** martial
**Tipo:** melee
**Custo:** 10 po
**Dano:** 2d6 `bludgeoning`
**Peso:** 5 kg
**Propriedades:** `heavy`, `two-handed`

### Mangual

**ID:** flail
**Nome:** Mangual
**Categoria:** martial
**Tipo:** melee
**Custo:** 10 po
**Dano:** 1d8 `bludgeoning`
**Peso:** 1 kg
**Propriedades:** Nenhuma

### Martelo de Guerra

**ID:** warhammer
**Nome:** Martelo de Guerra
**Categoria:** martial
**Tipo:** melee
**Custo:** 15 po
**Dano:** 1d8 `bludgeoning`
**Peso:** 1 kg
**Propriedades:** `versatile` (1d10)

### Picareta de Guerra

**ID:** war-pick
**Nome:** Picareta de Guerra
**Categoria:** martial
**Tipo:** melee
**Custo:** 5 po
**Dano:** 1d8 `piercing`
**Peso:** 1 kg
**Propriedades:** Nenhuma

### Rapieira

**ID:** rapier
**Nome:** Rapieira
**Categoria:** martial
**Tipo:** melee
**Custo:** 25 po
**Dano:** 1d8 `piercing`
**Peso:** 1 kg
**Propriedades:** `finesse`

### Tridente

**ID:** trident
**Nome:** Tridente
**Categoria:** martial
**Tipo:** melee
**Custo:** 5 po
**Dano:** 1d6 `piercing`
**Peso:** 2 kg
**Propriedades:** `thrown` (range 6/18), `versatile` (1d8)

## Armas Marciais à Distância

### Arco Longo

**ID:** longbow
**Nome:** Arco Longo
**Categoria:** martial
**Tipo:** ranged
**Custo:** 50 po
**Dano:** 1d8 `piercing`
**Peso:** 1 kg
**Propriedades:** `ammunition` (range 45/180), `heavy`, `two-handed`

### Besta de Mão

**ID:** hand-crossbow
**Nome:** Besta de Mão
**Categoria:** martial
**Tipo:** ranged
**Custo:** 75 po
**Dano:** 1d6 `piercing`
**Peso:** 1.5 kg
**Propriedades:** `ammunition` (range 9/36), `light`, `loading`

### Besta Pesada

**ID:** heavy-crossbow
**Nome:** Besta Pesada
**Categoria:** martial
**Tipo:** ranged
**Custo:** 50 po
**Dano:** 1d10 `piercing`
**Peso:** 4.5 kg
**Propriedades:** `ammunition` (range 30/120), `heavy`, `loading`, `two-handed`

### Rede

**ID:** net
**Nome:** Rede
**Categoria:** martial
**Tipo:** ranged
**Custo:** 1 po
**Dano:** null (efeito especial, não causa dano)
**Peso:** 1.5 kg
**Propriedades:** `special`, `thrown` (range 1.5/4.5)

### Zarabatana

**ID:** blowgun
**Nome:** Zarabatana
**Categoria:** martial
**Tipo:** ranged
**Custo:** 10 po
**Dano:** 1 `piercing` (fixo, sem rolagem)
**Peso:** 0.5 kg
**Propriedades:** `ammunition` (range 7.5/30), `loading`

---

# 2. Armaduras

## Cálculo de CA por categoria

- **Leve:** CA = base + mod. DEX completo
- **Média:** CA = base + mod. DEX (máximo +2)
- **Pesada:** CA = base (DEX não conta)
- **Escudo:** +2 na CA quando equipado, independente da armadura

## Armadura Leve

### Acolchoada

**ID:** padded
**Nome:** Acolchoada
**Categoria:** light
**Custo:** 5 po
**CA Base:** 11
**Modificador de DEX:** full
**Requisito de Força:** null
**Penalidade de Furtividade:** true
**Peso:** 4 kg

### Couro

**ID:** leather
**Nome:** Couro
**Categoria:** light
**Custo:** 10 po
**CA Base:** 11
**Modificador de DEX:** full
**Requisito de Força:** null
**Penalidade de Furtividade:** false
**Peso:** 5 kg

### Couro Batido

**ID:** studded-leather
**Nome:** Couro Batido
**Categoria:** light
**Custo:** 45 po
**CA Base:** 12
**Modificador de DEX:** full
**Requisito de Força:** null
**Penalidade de Furtividade:** false
**Peso:** 6.5 kg

## Armadura Média

### Gibão de Peles

**ID:** hide
**Nome:** Gibão de Peles
**Categoria:** medium
**Custo:** 10 po
**CA Base:** 12
**Modificador de DEX:** max-2
**Requisito de Força:** null
**Penalidade de Furtividade:** false
**Peso:** 6 kg

### Camisão de Malha

**ID:** chain-shirt
**Nome:** Camisão de Malha
**Categoria:** medium
**Custo:** 30 po
**CA Base:** 13
**Modificador de DEX:** max-2
**Requisito de Força:** null
**Penalidade de Furtividade:** false
**Peso:** 10 kg

### Brunea

**ID:** scale-mail
**Nome:** Brunea
**Categoria:** medium
**Custo:** 50 po
**CA Base:** 14
**Modificador de DEX:** max-2
**Requisito de Força:** null
**Penalidade de Furtividade:** true
**Peso:** 22.5 kg

### Peitoral

**ID:** breastplate
**Nome:** Peitoral
**Categoria:** medium
**Custo:** 400 po
**CA Base:** 14
**Modificador de DEX:** max-2
**Requisito de Força:** null
**Penalidade de Furtividade:** false
**Peso:** 10 kg

### Meia-Armadura

**ID:** half-plate
**Nome:** Meia-Armadura
**Categoria:** medium
**Custo:** 750 po
**CA Base:** 15
**Modificador de DEX:** max-2
**Requisito de Força:** null
**Penalidade de Furtividade:** true
**Peso:** 20 kg

## Armadura Pesada

### Cota de Anéis

**ID:** ring-mail
**Nome:** Cota de Anéis
**Categoria:** heavy
**Custo:** 30 po
**CA Base:** 14
**Modificador de DEX:** none
**Requisito de Força:** null
**Penalidade de Furtividade:** true
**Peso:** 20 kg

### Cota de Malha

**ID:** chain-mail
**Nome:** Cota de Malha
**Categoria:** heavy
**Custo:** 75 po
**CA Base:** 16
**Modificador de DEX:** none
**Requisito de Força:** 13
**Penalidade de Furtividade:** true
**Peso:** 27.5 kg

### Cota de Talas

**ID:** splint
**Nome:** Cota de Talas
**Categoria:** heavy
**Custo:** 200 po
**CA Base:** 17
**Modificador de DEX:** none
**Requisito de Força:** 15
**Penalidade de Furtividade:** true
**Peso:** 30 kg

### Placas

**ID:** plate
**Nome:** Placas
**Categoria:** heavy
**Custo:** 1500 po
**CA Base:** 18
**Modificador de DEX:** none
**Requisito de Força:** 15
**Penalidade de Furtividade:** true
**Peso:** 32.5 kg

## Escudo

### Escudo

**ID:** shield
**Nome:** Escudo
**Categoria:** shield
**Custo:** 10 po
**CA Base:** +2
**Modificador de DEX:** none
**Requisito de Força:** null
**Penalidade de Furtividade:** false
**Peso:** 3 kg

# 3. Ferramentas

## Schema

## Ferramentas de Artesão

### Ferramentas de Carpinteiro

**ID:** carpenters-tools
**Nome:** Ferramentas de Carpinteiro
**Categoria:** artisan
**Custo:** 8 po
**Peso:** 3 kg

### Ferramentas de Cartógrafo

**ID:** cartographers-tools
**Nome:** Ferramentas de Cartógrafo
**Categoria:** artisan
**Custo:** 15 po
**Peso:** 3 kg

### Ferramentas de Costureiro

**ID:** weavers-tools
**Nome:** Ferramentas de Costureiro
**Categoria:** artisan
**Custo:** 1 po
**Peso:** 2.5 kg

### Ferramentas de Coureiro

**ID:** leatherworkers-tools
**Nome:** Ferramentas de Coureiro
**Categoria:** artisan
**Custo:** 5 po
**Peso:** 2.5 kg

### Ferramentas de Entalhador

**ID:** woodcarvers-tools
**Nome:** Ferramentas de Entalhador
**Categoria:** artisan
**Custo:** 1 po
**Peso:** 2.5 kg

### Ferramentas de Ferreiro

**ID:** smiths-tools
**Nome:** Ferramentas de Ferreiro
**Categoria:** artisan
**Custo:** 20 po
**Peso:** 4 kg

### Ferramentas de Funileiro

**ID:** tinkers-tools
**Nome:** Ferramentas de Funileiro
**Categoria:** artisan
**Custo:** 50 po
**Peso:** 5 kg

### Ferramentas de Joalheiro

**ID:** jewelers-tools
**Nome:** Ferramentas de Joalheiro
**Categoria:** artisan
**Custo:** 25 po
**Peso:** 1 kg

### Ferramentas de Oleiro

**ID:** potters-tools
**Nome:** Ferramentas de Oleiro
**Categoria:** artisan
**Custo:** 10 po
**Peso:** 1.5 kg

### Ferramentas de Pedreiro

**ID:** masons-tools
**Nome:** Ferramentas de Pedreiro
**Categoria:** artisan
**Custo:** 10 po
**Peso:** 4 kg

### Ferramentas de Pintor

**ID:** painters-supplies
**Nome:** Ferramentas de Pintor
**Categoria:** artisan
**Custo:** 10 po
**Peso:** 2.5 kg

### Ferramentas de Sapateiro

**ID:** cobblers-tools
**Nome:** Ferramentas de Sapateiro
**Categoria:** artisan
**Custo:** 5 po
**Peso:** 2.5 kg

### Ferramentas de Vidreiro

**ID:** glassblowers-tools
**Nome:** Ferramentas de Vidreiro
**Categoria:** artisan
**Custo:** 30 po
**Peso:** 2.5 kg

### Suprimentos de Alquimista

**ID:** alchemists-supplies
**Nome:** Suprimentos de Alquimista
**Categoria:** artisan
**Custo:** 50 po
**Peso:** 4 kg

### Suprimentos de Cervejeiro

**ID:** brewers-tools
**Nome:** Suprimentos de Cervejeiro
**Categoria:** artisan
**Custo:** 20 po
**Peso:** 4.5 kg

### Suprimentos de Caligrafia

**ID:** calligraphers-supplies
**Nome:** Suprimentos de Caligrafia
**Categoria:** artisan
**Custo:** 10 po
**Peso:** 2.5 kg

### Utensílios de Cozinheiro

**ID:** cooks-utensils
**Nome:** Utensílios de Cozinheiro
**Categoria:** artisan
**Custo:** 1 po
**Peso:** 4 kg

## Instrumentos Musicais

(igual ao seu, só capitalizando "Pã" em "Flauta de Pã" — você já tem)

### Alaúde

**ID:** lute
**Nome:** Alaúde
**Categoria:** musical-instrument
**Custo:** 35 po
**Peso:** 1 kg

### Flauta

**ID:** flute
**Nome:** Flauta
**Categoria:** musical-instrument
**Custo:** 2 po
**Peso:** 0.5 kg

### Flauta de Pã

**ID:** pan-flute
**Nome:** Flauta de Pã
**Categoria:** musical-instrument
**Custo:** 12 po
**Peso:** 1 kg

### Gaita de Foles

**ID:** bagpipes
**Nome:** Gaita de Foles
**Categoria:** musical-instrument
**Custo:** 30 po
**Peso:** 3 kg

### Lira

**ID:** lyre
**Nome:** Lira
**Categoria:** musical-instrument
**Custo:** 30 po
**Peso:** 1 kg

### Oboé

**ID:** shawm
**Nome:** Oboé
**Categoria:** musical-instrument
**Custo:** 2 po
**Peso:** 0.5 kg

### Tambor

**ID:** drum
**Nome:** Tambor
**Categoria:** musical-instrument
**Custo:** 6 po
**Peso:** 1.5 kg

### Trombeta

**ID:** horn
**Nome:** Trombeta
**Categoria:** musical-instrument
**Custo:** 3 po
**Peso:** 1 kg

### Violino

**ID:** viol
**Nome:** Violino
**Categoria:** musical-instrument
**Custo:** 30 po
**Peso:** 3 kg

### Xilofone

**ID:** xylophone
**Nome:** Xilofone
**Categoria:** musical-instrument
**Custo:** 25 po
**Peso:** 5 kg

## Conjuntos de Jogos

### Baralho de Cartas

**ID:** playing-card-set
**Nome:** Baralho de Cartas
**Categoria:** gaming-set
**Custo:** 5 pp
**Peso:** null

### Conjunto de Dados

**ID:** dice-set
**Nome:** Conjunto de Dados
**Categoria:** gaming-set
**Custo:** 1 pp
**Peso:** null

### Jogo dos Três Dragões

**ID:** three-dragon-ante-set
**Nome:** Jogo dos Três Dragões
**Categoria:** gaming-set
**Custo:** 5 po
**Peso:** null

### Xadrez do Dragão

**ID:** dragonchess-set
**Nome:** Xadrez do Dragão
**Categoria:** gaming-set
**Custo:** 1 po
**Peso:** 0.25 kg

## Kits e Outras Ferramentas

### Ferramentas de Navegação

**ID:** navigators-tools
**Nome:** Ferramentas de Navegação
**Categoria:** other
**Custo:** 25 po
**Peso:** 1 kg

### Ferramentas de Ladrão

**ID:** thieves-tools
**Nome:** Ferramentas de Ladrão
**Categoria:** other
**Custo:** 25 po
**Peso:** 0.5 kg

### Kit de Disfarce

**ID:** disguise-kit
**Nome:** Kit de Disfarce
**Categoria:** other
**Custo:** 25 po
**Peso:** 1.5 kg

### Kit de Falsificação

**ID:** forgery-kit
**Nome:** Kit de Falsificação
**Categoria:** other
**Custo:** 15 po
**Peso:** 2.5 kg

### Kit de Herbalismo

**ID:** herbalism-kit
**Nome:** Kit de Herbalismo
**Categoria:** other
**Custo:** 5 po
**Peso:** 1.5 kg

### Kit de Venenos

**ID:** poisoners-kit
**Nome:** Kit de Venenos
**Categoria:** other
**Custo:** 50 po
**Peso:** 1 kg

## Proficiências sem Item Físico

### Veículos Terrestres

**ID:** land-vehicles
**Nome:** Veículos Terrestres
**Categoria:** other
**Custo:** null
**Peso:** null

### Veículos Aquáticos

**ID:** water-vehicles
**Nome:** Veículos Aquáticos
**Categoria:** other
**Custo:** null
**Peso:** null

# 4. Equipamento Geral

## Schema

## Categorias

- `container` — recipientes (mochila, baú, bolsa, frasco, saco)
- `light-source` — fontes de luz (tocha, vela, lanterna, lâmpada)
- `food` — comida e bebida (rações, água)
- `clothing` — roupas e vestimentas
- `focus` — focos de conjuração (símbolo sagrado, foco arcano, foco druídico, bolsa de componentes, grimório)
- `ammunition` — munições (flechas, virotes, balas, dardos)
- `religious` — itens religiosos não-foco (incenso, livro de orações, incensário)
- `tool-related` — itens auxiliares de ofício (corda, pé de cabra, martelo)
- `consumable` — consumíveis (poção de cura, óleo, ácido, fogo alquímico)
- `survival` — itens de sobrevivência (saco de dormir, cobertor, kit de refeição)
- `general` — uso geral sem categoria específica (espelho, sabão, perfume)
- `background-item` — itens narrativos exclusivos de antecedentes (não compráveis)

## Itens Gerais

### Ábaco

**ID:** abacus
**Nome:** Ábaco
**Custo:** 2 po
**Peso:** 1 kg
**Categoria:** general

### Ácido (vidro)

**ID:** acid-vial
**Nome:** Ácido (Vidro)
**Custo:** 25 po
**Peso:** 0.5 kg
**Categoria:** consumable

### Água Benta (Frasco)

**ID:** holy-water-flask
**Nome:** Água Benta (Frasco)
**Custo:** 25 po
**Peso:** 0.5 kg
**Categoria:** consumable

### Algemas

**ID:** manacles
**Nome:** Algemas
**Custo:** 2 po
**Peso:** 2 kg
**Categoria:** tool-related

### Algibeira

**ID:** pouch
**Nome:** Algibeira
**Custo:** 5 po
**Peso:** 0.5 kg
**Categoria:** container

### Aljava

**ID:** quiver
**Nome:** Aljava
**Custo:** 1 po
**Peso:** 0.5 kg
**Categoria:** container

### Ampulheta

**ID:** hourglass
**Nome:** Ampulheta
**Custo:** 25 po
**Peso:** 0.5 kg
**Categoria:** general

### Antídoto (Vidro)

**ID:** antitoxin
**Nome:** Antídoto (Vidro)
**Custo:** 50 po
**Peso:** null
**Categoria:** consumable

### Apito de Advertência

**ID:** signal-whistle
**Nome:** Apito de Advertência
**Custo:** 25 po
**Peso:** 0.5 kg
**Categoria:** general

### Aríete Portátil

**ID:** portable-ram
**Nome:** Aríete Portátil
**Custo:** 4 po
**Peso:** 17.5 kg
**Categoria:** tool-related

### Armadilha de Caça

**ID:** hunting-trap
**Nome:** Armadilha de Caça
**Custo:** 5 po
**Peso:** 12.5 kg
**Categoria:** survival

### Arpéu

**ID:** grappling-hook
**Nome:** Arpéu
**Custo:** 2 po
**Peso:** 2 kg
**Categoria:** tool-related

### Balança de Mercador

**ID:** merchant-scale
**Nome:** Balança de Mercador
**Custo:** 5 po
**Peso:** 1.5 kg
**Categoria:** tool-related

### Balde

**ID:** bucket
**Nome:** Balde
**Custo:** 5 pc
**Peso:** 1 kg
**Categoria:** container

### Barbante (3 metros)

**ID:** string
**Nome:** Barbante (3 metros)
**Custo:** null
**Peso:** null
**Categoria:** tool-related

### Barril

**ID:** barrel
**Nome:** Barril
**Custo:** 2 po
**Peso:** 35 kg
**Categoria:** container

### Baú

**ID:** chest
**Nome:** Baú
**Custo:** 5 po
**Peso:** 12.5 kg
**Categoria:** container

### Caixa de Esmolas

**ID:** alms-box
**Nome:** Caixa de Esmolas
**Custo:** null
**Peso:** null
**Categoria:** religious

### Caixa de Fogo

**ID:** tinderbox
**Nome:** Caixa de Fogo
**Custo:** 5 pp
**Peso:** 0.5 kg
**Categoria:** survival

### Caneca

**ID:** tankard
**Nome:** Caneca
**Custo:** 2 pc
**Peso:** 0.5 kg
**Categoria:** general

### Caneta Tinteiro

**ID:** ink-pen
**Nome:** Caneta Tinteiro
**Custo:** 2 pc
**Peso:** null
**Categoria:** general

### Cantil

**ID:** waterskin
**Nome:** Cantil
**Custo:** 2 pp
**Peso:** 2.5 kg
**Categoria:** container

### Cesto

**ID:** basket
**Nome:** Cesto
**Custo:** 4 pp
**Peso:** 1 kg
**Categoria:** container

### Cobertor

**ID:** blanket
**Nome:** Cobertor
**Custo:** 5 pp
**Peso:** 1.5 kg
**Categoria:** survival

### Cobertor de Inverno

**ID:** winter-blanket
**Nome:** Cobertor de Inverno
**Custo:** 5 pp
**Peso:** 1.5 kg
**Categoria:** survival

### Corda de Cânhamo (15 metros)

**ID:** hempen-rope
**Nome:** Corda de Cânhamo (15 metros)
**Custo:** 1 po
**Peso:** 5 kg
**Categoria:** tool-related

### Corda de Seda (15 metros)

**ID:** silk-rope
**Nome:** Corda de Seda (15 metros)
**Custo:** 10 po
**Peso:** 2.5 kg
**Categoria:** tool-related

### Corrente (3 metros)

**ID:** chain
**Nome:** Corrente (3 metros)
**Custo:** 5 po
**Peso:** 5 kg
**Categoria:** tool-related

### Equipamento de Pescaria

**ID:** fishing-tackle
**Nome:** Equipamento de Pescaria
**Custo:** 1 po
**Peso:** 2 kg
**Categoria:** survival

### Escada (3 metros)

**ID:** ladder
**Nome:** Escada (3 metros)
**Custo:** 1 pp
**Peso:** 12.5 kg
**Categoria:** tool-related

### Esferas (sacola com 1.000)

**ID:** ball-bearings
**Nome:** Esferas (Sacola com 1.000)
**Custo:** 1 po
**Peso:** 1 kg
**Categoria:** tool-related

### Espelho de Aço

**ID:** steel-mirror
**Nome:** Espelho de Aço
**Custo:** 5 po
**Peso:** 0.25 kg
**Categoria:** general

### Estrepes (Bolsa com 20)

**ID:** caltrops
**Nome:** Estrepes (Bolsa com 20)
**Custo:** 1 po
**Peso:** 1 kg
**Categoria:** tool-related

### Fechadura

**ID:** lock
**Nome:** Fechadura
**Custo:** 10 po
**Peso:** 0.5 kg
**Categoria:** general

### Fogo Alquímico (Frasco)

**ID:** alchemists-fire
**Nome:** Fogo Alquímico (Frasco)
**Custo:** 50 po
**Peso:** 0.5 kg
**Categoria:** consumable

### Frasco

**ID:** vial
**Nome:** Frasco
**Custo:** 2 pc
**Peso:** 1 kg
**Categoria:** container

### Garrafa de Vidro

**ID:** glass-bottle
**Nome:** Garrafa de Vidro
**Custo:** 1 po
**Peso:** 1 kg
**Categoria:** container

### Giz (1 peça)

**ID:** chalk
**Nome:** Giz (1 peça)
**Custo:** 1 pc
**Peso:** null
**Categoria:** general

### Incensário

**ID:** censer
**Nome:** Incensário
**Custo:** null
**Peso:** null
**Categoria:** religious

### Incenso (Bloco)

**ID:** incense
**Nome:** Incenso (Bloco)
**Custo:** null
**Peso:** null
**Categoria:** religious

### Jarra

**ID:** pitcher
**Nome:** Jarra
**Custo:** 4 pc
**Peso:** 2 kg
**Categoria:** container

### Kit de Escalada

**ID:** climbers-kit
**Nome:** Kit de Escalada
**Custo:** 25 po
**Peso:** 6 kg
**Categoria:** tool-related

### Kit de Primeiros-Socorros

**ID:** healers-kit
**Nome:** Kit de Primeiros-Socorros
**Custo:** 5 po
**Peso:** 1.5 kg
**Categoria:** survival

### Kit de Refeição

**ID:** mess-kit
**Nome:** Kit de Refeição
**Custo:** 2 pp
**Peso:** 0.5 kg
**Categoria:** survival

### Lâmpada

**ID:** lamp
**Nome:** Lâmpada
**Custo:** 5 pp
**Peso:** 0.5 kg
**Categoria:** light-source

### Lanterna Coberta

**ID:** hooded-lantern
**Nome:** Lanterna Coberta
**Custo:** 5 po
**Peso:** 1 kg
**Categoria:** light-source

### Lanterna Furta-Fogo

**ID:** bullseye-lantern
**Nome:** Lanterna Furta-Fogo
**Custo:** 10 po
**Peso:** 1 kg
**Categoria:** light-source

### Lente de Aumento

**ID:** magnifying-glass
**Nome:** Lente de Aumento
**Custo:** 100 po
**Peso:** null
**Categoria:** general

### Livro

**ID:** book
**Nome:** Livro
**Custo:** 25 po
**Peso:** 2.5 kg
**Categoria:** general

### Luneta

**ID:** spyglass
**Nome:** Luneta
**Custo:** 1000 po
**Peso:** 0.5 kg
**Categoria:** general

### Marreta

**ID:** sledgehammer
**Nome:** Marreta
**Custo:** 2 po
**Peso:** 5 kg
**Categoria:** tool-related

### Martelo

**ID:** hammer
**Nome:** Martelo
**Custo:** 1 po
**Peso:** 1.5 kg
**Categoria:** tool-related

### Mochila

**ID:** backpack
**Nome:** Mochila
**Custo:** 2 po
**Peso:** 2.5 kg
**Categoria:** container

### Óleo (Frasco)

**ID:** oil-flask
**Nome:** Óleo (Frasco)
**Custo:** 1 pp
**Peso:** 0.5 kg
**Categoria:** consumable

### Pá

**ID:** shovel
**Nome:** Pá
**Custo:** 2 po
**Peso:** 2.5 kg
**Categoria:** tool-related

### Panela de Ferro

**ID:** iron-pot
**Nome:** Panela de Ferro
**Custo:** 2 po
**Peso:** 5 kg
**Categoria:** survival

### Papel (uma folha)

**ID:** paper
**Nome:** Papel (uma folha)
**Custo:** 2 pp
**Peso:** null
**Categoria:** general

### Parafina

**ID:** sealing-wax
**Nome:** Parafina
**Custo:** 5 pp
**Peso:** null
**Categoria:** general

### Pé de Cabra

**ID:** crowbar
**Nome:** Pé de Cabra
**Custo:** 2 po
**Peso:** 2.5 kg
**Categoria:** tool-related

### Pedra de Amolar

**ID:** whetstone
**Nome:** Pedra de Amolar
**Custo:** 1 pc
**Peso:** null
**Categoria:** general

### Perfume (Frasco)

**ID:** perfume
**Nome:** Perfume (Frasco)
**Custo:** 5 po
**Peso:** null
**Categoria:** general

### Pergaminho (uma folha)

**ID:** parchment
**Nome:** Pergaminho (uma folha)
**Custo:** 1 pp
**Peso:** null
**Categoria:** general

### Picareta de Minerador

**ID:** miners-pick
**Nome:** Picareta de Minerador
**Custo:** 2 po
**Peso:** 5 kg
**Categoria:** tool-related

### Píton

**ID:** piton
**Nome:** Píton
**Custo:** 5 pc
**Peso:** null
**Categoria:** tool-related

### Poção de Cura

**ID:** potion-of-healing
**Nome:** Poção de Cura
**Custo:** 50 po
**Peso:** 0.25 kg
**Categoria:** consumable

### Porta-Mapas

**ID:** map-case
**Nome:** Porta-Mapas
**Custo:** 1 po
**Peso:** 0.5 kg
**Categoria:** container

### Porta-Pergaminhos

**ID:** scroll-case
**Nome:** Porta-Pergaminhos
**Custo:** 1 po
**Peso:** 0.5 kg
**Categoria:** container

### Porta-Virotes

**ID:** crossbow-bolt-case
**Nome:** Porta-Virotes
**Custo:** 1 po
**Peso:** 0.5 kg
**Categoria:** container

### Pregos de Ferro (10)

**ID:** iron-spikes
**Nome:** Pregos de Ferro (10)
**Custo:** 1 po
**Peso:** 2.5 kg
**Categoria:** tool-related

### Rações de Viagem (1 dia)

**ID:** rations
**Nome:** Rações de Viagem (1 dia)
**Custo:** 5 pp
**Peso:** 1 kg
**Categoria:** food

### Roldana e Polia

**ID:** block-and-tackle
**Nome:** Roldana e Polia
**Custo:** 1 po
**Peso:** 2.5 kg
**Categoria:** tool-related

### Sabão

**ID:** soap
**Nome:** Sabão
**Custo:** 2 pc
**Peso:** null
**Categoria:** general

### Saco

**ID:** sack
**Nome:** Saco
**Custo:** 1 pc
**Peso:** 0.25 kg
**Categoria:** container

### Saco de Dormir

**ID:** bedroll
**Nome:** Saco de Dormir
**Custo:** 1 po
**Peso:** 3.5 kg
**Categoria:** survival

### Sino

**ID:** bell
**Nome:** Sino
**Custo:** 1 po
**Peso:** null
**Categoria:** general

### Tenda para Duas Pessoas

**ID:** tent
**Nome:** Tenda para Duas Pessoas
**Custo:** 2 po
**Peso:** 10 kg
**Categoria:** survival

### Tinta (Frasco de 30ml)

**ID:** ink-bottle
**Nome:** Tinta (Frasco de 30ml)
**Custo:** 10 po
**Peso:** null
**Categoria:** general

### Tocha

**ID:** torch
**Nome:** Tocha
**Custo:** 1 pc
**Peso:** 0.5 kg
**Categoria:** light-source

### Vara (3 metros)

**ID:** long-pole
**Nome:** Vara (3 metros)
**Custo:** 5 pc
**Peso:** 3.5 kg
**Categoria:** tool-related

### Vela

**ID:** candle
**Nome:** Vela
**Custo:** 1 pc
**Peso:** null
**Categoria:** light-source

### Veneno Básico (Frasco)

**ID:** basic-poison
**Nome:** Veneno Básico (Frasco)
**Custo:** 100 po
**Peso:** null
**Categoria:** consumable

### Saquinho de Areia

**ID:** sand-pouch
**Nome:** Saquinho de Areia
**Custo:** null
**Peso:** null
**Categoria:** general

## Munições

### Balas de Funda (20)

**ID:** sling-bullets
**Nome:** Balas de Funda (20)
**Custo:** 4 pc
**Peso:** 0.75 kg
**Categoria:** ammunition

### Flechas (20)

**ID:** arrows
**Nome:** Flechas (20)
**Custo:** 1 po
**Peso:** 0.5 kg
**Categoria:** ammunition

### Virotes (20)

**ID:** crossbow-bolts
**Nome:** Virotes (20)
**Custo:** 1 po
**Peso:** 0.75 kg
**Categoria:** ammunition

### Agulhas de Zarabatana (50)

**ID:** blowgun-needles
**Nome:** Agulhas de Zarabatana (50)
**Custo:** 1 po
**Peso:** 0.5 kg
**Categoria:** ammunition

## Focos de Conjuração

> **Nota:** os IDs `arcane-focus`, `druidic-focus` e `holy-symbol` são "agregadores conceituais" usados em referências de classes/antecedentes. Quando o jogador escolhe receber um foco, ele escolhe entre as variantes específicas listadas abaixo de cada agregador.

### Foco Arcano (qualquer variante)

**ID:** arcane-focus
**Nome:** Foco Arcano (qualquer variante)
**Custo:** null
**Peso:** null
**Categoria:** focus

### Bastão (Foco Arcano)

**ID:** rod
**Nome:** Bastão (Foco Arcano)
**Custo:** 10 po
**Peso:** 1 kg
**Categoria:** focus

### Cajado (Foco Arcano)

**ID:** arcane-staff
**Nome:** Cajado (Foco Arcano)
**Custo:** 5 po
**Peso:** 2 kg
**Categoria:** focus

### Cristal (Foco Arcano)

**ID:** crystal
**Nome:** Cristal (Foco Arcano)
**Custo:** 10 po
**Peso:** 0.5 kg
**Categoria:** focus

### Orbe (Foco Arcano)

**ID:** orb
**Nome:** Orbe (Foco Arcano)
**Custo:** 20 po
**Peso:** 1.5 kg
**Categoria:** focus

### Varinha (Foco Arcano)

**ID:** wand
**Nome:** Varinha (Foco Arcano)
**Custo:** 10 po
**Peso:** 0.5 kg
**Categoria:** focus

### Foco Druídico (qualquer variante)

**ID:** druidic-focus
**Nome:** Foco Druídico (qualquer variante)
**Custo:** null
**Peso:** null
**Categoria:** focus

### Cajado de Madeira (Foco Druídico)

**ID:** wooden-staff
**Nome:** Cajado de Madeira (Foco Druídico)
**Custo:** 5 po
**Peso:** 2 kg
**Categoria:** focus

### Ramo de Visco (Foco Druídico)

**ID:** sprig-of-mistletoe
**Nome:** Ramo de Visco (Foco Druídico)
**Custo:** 1 po
**Peso:** null
**Categoria:** focus

### Totem (Foco Druídico)

**ID:** totem
**Nome:** Totem (Foco Druídico)
**Custo:** 1 po
**Peso:** null
**Categoria:** focus

### Varinha de Teixo (Foco Druídico)

**ID:** yew-wand
**Nome:** Varinha de Teixo (Foco Druídico)
**Custo:** 10 po
**Peso:** 0.5 kg
**Categoria:** focus

### Símbolo Sagrado (qualquer variante)

**ID:** holy-symbol
**Nome:** Símbolo Sagrado (qualquer variante)
**Custo:** null
**Peso:** null
**Categoria:** focus

### Amuleto (Símbolo Sagrado)

**ID:** amulet
**Nome:** Amuleto (Símbolo Sagrado)
**Custo:** 5 po
**Peso:** 0.5 kg
**Categoria:** focus

### Emblema (Símbolo Sagrado)

**ID:** emblem
**Nome:** Emblema (Símbolo Sagrado)
**Custo:** 5 po
**Peso:** null
**Categoria:** focus

### Relicário (Símbolo Sagrado)

**ID:** reliquary
**Nome:** Relicário (Símbolo Sagrado)
**Custo:** 5 po
**Peso:** 1 kg
**Categoria:** focus

### Bolsa de Componentes

**ID:** component-pouch
**Nome:** Bolsa de Componentes
**Custo:** 25 po
**Peso:** 1 kg
**Categoria:** focus

### Grimório

**ID:** spellbook
**Nome:** Grimório
**Custo:** 50 po
**Peso:** 1.5 kg
**Categoria:** focus

## Roupas e Vestimentas

### Roupas Comuns

**ID:** common-clothes
**Nome:** Roupas Comuns
**Custo:** 5 pp
**Peso:** 1.5 kg
**Categoria:** clothing

### Roupas de Viajante

**ID:** travelers-clothes
**Nome:** Roupas de Viajante
**Custo:** 2 po
**Peso:** 2 kg
**Categoria:** clothing

### Roupas de Entretenimento

**ID:** costume
**Nome:** Roupas de Entretenimento
**Custo:** 5 po
**Peso:** 2 kg
**Categoria:** clothing

### Roupas Finas

**ID:** fine-clothes
**Nome:** Roupas Finas
**Custo:** 15 po
**Peso:** 3 kg
**Categoria:** clothing

### Manto

**ID:** cloak
**Nome:** Manto
**Custo:** 1 po
**Peso:** 2 kg
**Categoria:** clothing

### Robes

**ID:** robes
**Nome:** Robes
**Custo:** 1 po
**Peso:** 2 kg
**Categoria:** clothing

### Vestimentas

**ID:** vestments
**Nome:** Vestimentas
**Custo:** 1 po
**Peso:** 2 kg
**Categoria:** clothing

## Itens Narrativos de Antecedentes

> **Nota:** estes itens não são compráveis. São recebidos automaticamente ao escolher o antecedente correspondente. Custo `0 pc` indica que é concedido pelo antecedente, não comprável no mercado.

### Livro de Orações

**ID:** prayer-book
**Nome:** Livro de Orações
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Roda de Orações

**ID:** prayer-wheel
**Nome:** Roda de Orações
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Bastão de Incenso

**ID:** incense-stick
**Nome:** Bastão de Incenso
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Carta de Introdução

**ID:** introduction-letter
**Nome:** Carta de Introdução
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Favor de um Admirador

**ID:** favor-from-admirer
**Nome:** Favor de um Admirador
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Ferramentas de Trapaça

**ID:** con-tools
**Nome:** Ferramentas de Trapaça
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Roupas Comuns Escuras

**ID:** dark-common-clothes
**Nome:** Roupas Comuns Escuras
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Troféu de Animal

**ID:** animal-trophy
**Nome:** Troféu de Animal
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Pino de Amarração

**ID:** belaying-pin
**Nome:** Pino de Amarração
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Amuleto de Sorte

**ID:** lucky-charm
**Nome:** Amuleto de Sorte
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Anel de Sinete

**ID:** signet-ring
**Nome:** Anel de Sinete
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Pergaminho de Linhagem

**ID:** scroll-of-pedigree
**Nome:** Pergaminho de Linhagem
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Faca Pequena

**ID:** small-knife
**Nome:** Faca Pequena
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Mapa da Cidade

**ID:** city-map
**Nome:** Mapa da Cidade
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Rato de Estimação

**ID:** pet-mouse
**Nome:** Rato de Estimação
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Lembrança dos Pais

**ID:** parents-token
**Nome:** Lembrança dos Pais
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Pena

**ID:** quill
**Nome:** Pena
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Carta de um Colega

**ID:** letter-from-colleague
**Nome:** Carta de um Colega
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Insígnia de Patente

**ID:** rank-insignia
**Nome:** Insígnia de Patente
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Troféu de um Inimigo Caído

**ID:** trophy-from-fallen-enemy
**Nome:** Troféu de um Inimigo Caído
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

### Dados de Osso

**ID:** bone-dice
**Nome:** Dados de Osso
**Custo:** 0 pc
**Peso:** null
**Categoria:** background-item

# 5. Pacotes de Equipamento

## Schema

`ref:` aponta pra um ID cadastrado nas seções 1 (armas), 2 (armaduras), 3 (ferramentas) ou 4 (equipamento geral).

## Pacotes do PHB 2014

### Pacote de Artista

**ID:** entertainers-pack
**Nome:** Pacote de Artista
**Custo:** 40 po
**Conteúdo:**

- ref: backpack | quantidade: 1
- ref: bedroll | quantidade: 1
- ref: costume | quantidade: 2
- ref: candle | quantidade: 5
- ref: rations | quantidade: 5
- ref: waterskin | quantidade: 1
- ref: disguise-kit | quantidade: 1

### Pacote de Assaltante

**ID:** burglars-pack
**Nome:** Pacote de Assaltante
**Custo:** 16 po
**Conteúdo:**

- ref: backpack | quantidade: 1
- ref: ball-bearings | quantidade: 1
- ref: string | quantidade: 1
- ref: bell | quantidade: 1
- ref: candle | quantidade: 5
- ref: crowbar | quantidade: 1
- ref: hammer | quantidade: 1
- ref: piton | quantidade: 10
- ref: hooded-lantern | quantidade: 1
- ref: oil-flask | quantidade: 2
- ref: rations | quantidade: 5
- ref: tinderbox | quantidade: 1
- ref: waterskin | quantidade: 1
- ref: hempen-rope | quantidade: 1

### Pacote de Aventureiro

**ID:** dungeoneers-pack
**Nome:** Pacote de Aventureiro
**Custo:** 12 po
**Conteúdo:**

- ref: backpack | quantidade: 1
- ref: crowbar | quantidade: 1
- ref: hammer | quantidade: 1
- ref: piton | quantidade: 10
- ref: torch | quantidade: 10
- ref: tinderbox | quantidade: 1
- ref: rations | quantidade: 10
- ref: waterskin | quantidade: 1
- ref: hempen-rope | quantidade: 1

### Pacote de Diplomata

**ID:** diplomats-pack
**Nome:** Pacote de Diplomata
**Custo:** 39 po
**Conteúdo:**

- ref: chest | quantidade: 1
- ref: map-case | quantidade: 2
- ref: fine-clothes | quantidade: 1
- ref: ink-bottle | quantidade: 1
- ref: ink-pen | quantidade: 1
- ref: lamp | quantidade: 1
- ref: oil-flask | quantidade: 2
- ref: paper | quantidade: 5
- ref: perfume | quantidade: 1
- ref: sealing-wax | quantidade: 1
- ref: soap | quantidade: 1

### Pacote de Estudioso

**ID:** scholars-pack
**Nome:** Pacote de Estudioso
**Custo:** 40 po
**Conteúdo:**

- ref: backpack | quantidade: 1
- ref: book | quantidade: 1
- ref: ink-bottle | quantidade: 1
- ref: ink-pen | quantidade: 1
- ref: parchment | quantidade: 10
- ref: sand-pouch | quantidade: 1
- ref: small-knife | quantidade: 1

### Pacote de Explorador

**ID:** explorers-pack
**Nome:** Pacote de Explorador
**Custo:** 10 po
**Conteúdo:**

- ref: backpack | quantidade: 1
- ref: bedroll | quantidade: 1
- ref: mess-kit | quantidade: 1
- ref: tinderbox | quantidade: 1
- ref: torch | quantidade: 10
- ref: rations | quantidade: 10
- ref: waterskin | quantidade: 1
- ref: hempen-rope | quantidade: 1

### Pacote de Sacerdote

**ID:** priests-pack
**Nome:** Pacote de Sacerdote
**Custo:** 19 po
**Conteúdo:**

- ref: backpack | quantidade: 1
- ref: blanket | quantidade: 1
- ref: candle | quantidade: 10
- ref: tinderbox | quantidade: 1
- ref: alms-box | quantidade: 1
- ref: incense | quantidade: 2
- ref: censer | quantidade: 1
- ref: vestments | quantidade: 1
- ref: rations | quantidade: 2
- ref: waterskin | quantidade: 1
