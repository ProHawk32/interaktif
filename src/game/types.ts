export type DonorSource = "youtube" | "tiktok" | "test" | "bynogame";

export interface Donor {
  id: string;
  name: string;
  avatar?: string;
  channelUrl?: string;
  total: number;
  hp: number;
  downUntil: number | null;
  lastDonation: number;
  damage: number;
  totalDamage: number;
  lastAttack: number;
  source: DonorSource;
}

export type EffectKind = "lunge" | "hit" | "dmg" | "crit" | "bossHit" | "bossDmg";

export interface Effect {
  id: number;
  kind: EffectKind;
  x: number;
  y: number;
  until: number;
  text?: string;
  sprite?: string;
  color?: string;
  icon?: string;
  size?: number;
}

export type ChatKind = "chat" | "donate" | "system" | "boss" | "owner";

export interface ChatMsg {
  id: number;
  user: string;
  text: string;
  kind: ChatKind;
  color: string;
  avatar?: string;
  display?: string;
  amount?: number;
  badge?: string;
}

export interface RecentDonation {
  id: number;
  name: string;
  display: string;
  amount: number;
  avatar?: string;
  message?: string;
  at?: number;
}

/** Üstten kayarak gelen bağış bildirimi */
export interface AlertItem {
  id: number;
  name: string;
  avatar?: string;
  message: string;
  display: string;
  amount: number;
  via: string;
  clsTitle: string;
  clsColor: string;
  note: string;
  stars: number;
}

export interface Victory {
  at: number;
  bossIndex: number;
  bossName: string;
  top: Donor[];
  mvp: Donor | null;
  lastHit: string;
}

export type DonationKind = "superchat" | "sticker" | "member" | "gift" | "test" | "bynogame" | "manual" | "tiktokGift";

export interface DonationInput {
  id?: string;
  name: string;
  amount: number;
  avatar?: string;
  channelUrl?: string;
  message?: string;
  display?: string;
  source: DonorSource;
  kind?: DonationKind;
  via?: string;
  countTowardsTotal?: boolean;
}

export interface ChatAuthor {
  id: string;
  name: string;
  avatar?: string;
  channelUrl?: string;
  isOwner?: boolean;
  isMod?: boolean;
  isMember?: boolean;
}

export interface GameState {
  bossIndex: number;
  bossHp: number;
  bossMax: number;
  hpMult: number;
  bossHurtUntil: number;
  bossAttackUntil: number;
  bossSpawnAt: number;
  shakeUntil: number;
  donors: Donor[];
  effects: Effect[];
  chat: ChatMsg[];
  log: ChatMsg[];
  recent: RecentDonation[];
  victory: Victory | null;
  totalDonated: number;
  pendingDamage: number;
  lastSysReply: number;
  alerts: AlertItem[];
  alertAt: number;
  ctaUntil: number;
  ctaBy: string;
  lastCta: number;
}
