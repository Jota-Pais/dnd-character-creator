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
  /** Item Paranormal (Tabela 3.10) — exibido em seção própria no passo de Equipamento. */
  paranormal?: boolean;
  /** Componentes ritualísticos: elemento cujos rituais este kit permite conjurar. */
  ritualComponentFor?: 'knowledge' | 'energy' | 'death' | 'blood';
}

export type OrdemWeaponProficiency = 'simple' | 'tactical' | 'heavy';
export type OrdemWeaponGrip = 'leve' | 'uma_mao' | 'duas_maos';
export type OrdemWeaponCategory = 'corpo_a_corpo' | 'arremesso' | 'disparo' | 'fogo';

export interface OrdemWeapon extends OrdemEquipmentBase {
  type: 'weapon';
  proficiency: OrdemWeaponProficiency;
  weaponCategory: OrdemWeaponCategory;
  grip: OrdemWeaponGrip;
  damage: string;
  critical: string;
  range: string;
  damageType: string;
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
