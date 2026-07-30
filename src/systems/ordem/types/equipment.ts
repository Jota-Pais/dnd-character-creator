export type OrdemEquipmentCategory = 0 | 1 | 2 | 3 | 4;

export type OrdemEquipmentType = 'weapon' | 'protection' | 'general' | 'explosive' | 'accessory';

export interface OrdemEquipmentBase {
  id: string;
  name: string;
  category: OrdemEquipmentCategory;
  spaces: number;
  type: OrdemEquipmentType;
  description?: string;
  /** Bônus à capacidade de carga concedido pelo item (ex.: Mochila Militar = +2 espaços). */
  carryBonus?: number;
  /** Resistência a dano incondicional concedida pelo item (ex.: Proteção Pesada 2, Traje Hazmat 10). */
  damageResistance?: number;
  /** Tipos de dano cobertos pela `damageResistance` (ex.: "balístico, corte, impacto e perfuração"). */
  damageResistanceLabel?: string;
  /** Item Paranormal (Tabela 3.10) — exibido em seção própria no passo de Equipamento. */
  paranormal?: boolean;
  /** Componentes ritualísticos: elemento cujos rituais este kit permite conjurar. */
  ritualComponentFor?: 'knowledge' | 'energy' | 'death' | 'blood';
}

export type OrdemWeaponProficiency = 'simple' | 'tactical' | 'heavy';
export type OrdemWeaponGrip = 'leve' | 'uma_mao' | 'duas_maos';
export type OrdemWeaponCategory = 'corpo_a_corpo' | 'arremesso' | 'disparo' | 'fogo';

/**
 * Munição que a arma consome (Tabela 3.4). Cada tipo serve um grupo fechado de armas — uma
 * espingarda não dispara balas curtas —, então as modificações de munição (Dum dum, Explosiva)
 * só alcançam as armas do mesmo tipo (ver `getWeaponAmmoVariants`).
 */
export type OrdemAmmoId =
  | 'municao-flechas'
  | 'municao-balas-curtas'
  | 'municao-balas-longas'
  | 'municao-cartuchos'
  | 'municao-foguete'
  | 'municao-combustivel';

export interface OrdemWeapon extends OrdemEquipmentBase {
  type: 'weapon';
  proficiency: OrdemWeaponProficiency;
  weaponCategory: OrdemWeaponCategory;
  grip: OrdemWeaponGrip;
  damage: string;
  critical: string;
  range: string;
  damageType: string;
  /** Munição consumida; ausente nas armas corpo a corpo e de arremesso. */
  ammo?: OrdemAmmoId;
  /**
   * Arma ágil (p. 59): "permite que você aplique sua Agilidade em vez de sua Força em testes de
   * ataque e rolagens de dano realizadas com elas". São seis — faca, punhal, cajado, nunchaku,
   * florete e katana — e o ataque desarmado com o poder Artista Marcial.
   */
  agile?: boolean;
  /**
   * Arma automática (p. 59): pode disparar rajada (−Ø no ataque por +1 dado de dano). A rajada em
   * si é decisão de jogo, não da ficha; o campo existe para o jogador SABER que a arma é
   * automática e para não oferecerem a ela a modificação Ferrolho Automático.
   */
  automatic?: boolean;
  /** Penalidade fixa nos testes de ataque com esta arma (motosserra: −2, por ser desajeitada). */
  attackPenalty?: number;
  /**
   * Soma Força nas rolagens de dano mesmo sendo arma de disparo — exceção do Arco Composto
   * ("ao contrário de outras armas de disparo", p. 58).
   */
  addsStrengthDamage?: boolean;
  /**
   * Regras próprias da arma que a ficha exibe junto do ataque (área, alcance, recarga). Só texto
   * fixo; regras que dependem do personagem são resolvidas em `getWeaponRuleNotes`.
   */
  rules?: string[];
}

export interface OrdemProtection extends OrdemEquipmentBase {
  type: 'protection';
  defenseBonus: number;
  isShield?: boolean;
}

export interface OrdemGeneralItem extends OrdemEquipmentBase {
  type: 'general' | 'accessory';
}

/**
 * Explosivo (Tabela 3.8, p. 64). Arremessado num PONTO em alcance médio — não há teste de
 * ataque contra a Defesa de ninguém, por isso não entra na tabela de Ataques: o que a ficha
 * precisa é o dano, a área e a DT do teste de resistência (ver `getExplosiveDt`).
 */
export interface OrdemExplosive extends OrdemEquipmentBase {
  type: 'explosive';
  /** Dano em dados, quando o explosivo causa dano (a granada de fumaça não causa). */
  damage?: string;
  /** Tipo de dano por extenso (ex.: "perfuração", "fogo"). */
  damageType?: string;
  /** Área afetada (ex.: "raio de 6m", "cone de 6m"). */
  area: string;
  /** Alcance do arremesso/detonação (ex.: "Médio", "Longo"). */
  range: string;
  /**
   * Teste de resistência permitido, quando houver. `attribute` é o atributo do AGENTE que
   * compõe a DT ("DT Agi" / "DT Int" no livro) — a DT é 10 + limite de PE + esse atributo (p. 80).
   */
  resistance?: {
    /** Perícia do teste, por extenso (ex.: "Reflexos", "Fortitude"). */
    skill: string;
    attribute: 'agility' | 'strength' | 'intellect' | 'presence' | 'vigor';
    /** O que o sucesso faz (ex.: "reduz o dano à metade"). */
    effect: string;
  };
}

export type OrdemEquipment = OrdemWeapon | OrdemProtection | OrdemGeneralItem | OrdemExplosive;
