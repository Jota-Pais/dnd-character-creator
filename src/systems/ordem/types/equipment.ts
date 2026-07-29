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
}

export interface OrdemProtection extends OrdemEquipmentBase {
  type: 'protection';
  defenseBonus: number;
  isShield?: boolean;
}

export interface OrdemGeneralItem extends OrdemEquipmentBase {
  type: 'general' | 'explosive' | 'accessory';
}

export type OrdemEquipment = OrdemWeapon | OrdemProtection | OrdemGeneralItem;
