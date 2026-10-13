import type { AlertItem } from "./types";

export const DMG_PER_TL = 40;
export const VICTORY_MS = 60_000;
export const MEDAL = ["#ffd43b", "#dee2e6", "#e8a87c"];
export const DEFAULT_DONATE_URL = "https://donate.bynogame.com/hawk";
export const DEFAULT_NOTICE =
  "Bağışlar tamamen gönüllülük esasına dayanır. Oyuna katılmak ücretsizdir, kimse bağış yapmaya zorlanmaz.";

/* ------------------------------------------------------------------ */
/*  KARAKTER EVRİMİ — toplam bağışa göre karakter şekli                */
/* ------------------------------------------------------------------ */
export interface CharClass {
  idx: number;
  title: string;
  short: string;
  sprite: string;
  min: number;
  color: string;
  atk: number;
  hp: number;
  aura?: string;
  special?: "legend" | "immortal";
}

export const CLASSES: CharClass[] = [
  { idx: 0, title: "Çaresiz Köylü", short: "Köylü", sprite: "villager", min: 1, color: "#ced4da", atk: 40, hp: 600 },
  { idx: 1, title: "Acemi Savaşçı", short: "Acemi", sprite: "rookie", min: 10, color: "#f1f3f5", atk: 80, hp: 900 },
  { idx: 2, title: "Büyücü Çırağı", short: "Çırak", sprite: "apprentice", min: 50, color: "#d0bfff", atk: 140, hp: 1300 },
  { idx: 3, title: "Usta Avcı", short: "Avcı", sprite: "archer", min: 100, color: "#8ce99a", atk: 220, hp: 1800 },
  { idx: 4, title: "Muhafız", short: "Muhafız", sprite: "warrior", min: 200, color: "#74c0fc", atk: 320, hp: 2500 },
  { idx: 5, title: "Karanlık Büyücü", short: "Kara Büyücü", sprite: "mage", min: 350, color: "#e599f7", atk: 450, hp: 3300, aura: "#9d4edd" },
  { idx: 6, title: "Ejderha Katili", short: "Ejderha Katili", sprite: "valkyrie", min: 600, color: "#ffa94d", atk: 650, hp: 4300, aura: "#ff6b35" },
  { idx: 7, title: "Savaş Tanrısı", short: "Savaş Tanrısı", sprite: "knight_gold", min: 1000, color: "#ffd43b", atk: 900, hp: 5500, aura: "#ffb703" },
  { idx: 8, title: "Efsanevi Savaş Tanrısı", short: "Efsanevi", sprite: "knight_gold", min: 2500, color: "#ffe066", atk: 1300, hp: 7000, aura: "#ffd166", special: "legend" },
  { idx: 9, title: "Ölümsüz İmparator", short: "Ölümsüz", sprite: "knight_gold", min: 5000, color: "#fff3bf", atk: 1800, hp: 9000, aura: "#fff3bf", special: "immortal" },
];

export function classFor(total: number): CharClass {
  for (let i = CLASSES.length - 1; i >= 0; i--) if (total >= CLASSES[i].min) return CLASSES[i];
  return CLASSES[0];
}

/** 1-3 yıldız: bir sonraki evrime ne kadar yaklaşıldığı */
export function starsFor(total: number): number {
  const c = classFor(total);
  const next = CLASSES[c.idx + 1];
  if (!next) return 3;
  const p = (total - c.min) / (next.min - c.min);
  return p < 0.34 ? 1 : p < 0.67 ? 2 : 3;
}

/** Evrim seviyesi büyüdükçe karakter de büyür */
export function sizeFactor(c: CharClass): number {
  return 0.88 + c.idx * 0.036;
}

export function maxHpFor(total: number): number {
  const c = classFor(total);
  return c.hp + (starsFor(total) - 1) * Math.round(c.hp * 0.1);
}

/* ------------------------------------------------------------------ */
/*  PATRONLAR                                                          */
/* ------------------------------------------------------------------ */
export type BossParticles = "poison" | "embers" | "skulls" | "snow" | "fire";
export type BossIdle = "sway" | "breathe" | "float" | "hover";

export interface BossDef {
  key: string;
  name: string;
  title: string;
  sprite: string;
  baseHp: number;
  height: number;
  color: string;
  attackName: string;
  attackIcon: string;
  dmg: [number, number];
  targets: number;
  particles: BossParticles;
  idle: BossIdle;
  final?: boolean;
}

export const BOSSES: BossDef[] = [
  { key: "zombie", name: "LANETLİ KÖYLÜ", title: "Zindanın İlk Kurbanı", sprite: "boss1", baseHp: 50_000, height: 250, color: "#a9e34b", attackName: "Paslı Yaba", attackIcon: "🔱", dmg: [180, 420], targets: 1, particles: "poison", idle: "sway" },
  { key: "darkknight", name: "KARA MUHAFIZ", title: "Lanetli Kalkanın Sahibi", sprite: "boss2", baseHp: 120_000, height: 290, color: "#ff4d6d", attackName: "Kara Kılıç", attackIcon: "⚔️", dmg: [260, 560], targets: 1, particles: "embers", idle: "breathe" },
  { key: "necro", name: "NEKROMANSER", title: "Ölülerin Efendisi", sprite: "boss3", baseHp: 300_000, height: 330, color: "#69db7c", attackName: "Ruh Laneti", attackIcon: "💀", dmg: [380, 780], targets: 2, particles: "skulls", idle: "float" },
  { key: "ice", name: "BUZ VALKİRİSİ", title: "Donmuş Kanatların Kraliçesi", sprite: "boss4", baseHp: 750_000, height: 370, color: "#74c0fc", attackName: "Buz Fırtınası", attackIcon: "❄️", dmg: [520, 1050], targets: 2, particles: "snow", idle: "hover" },
  { key: "demon", name: "ZİNDAN PATRONU", title: "Kalenin Kâbusu", sprite: "boss5", baseHp: 3_000_000, height: 430, color: "#ff922b", attackName: "Cehennem Nefesi", attackIcon: "🔥", dmg: [700, 1500], targets: 3, particles: "fire", idle: "breathe", final: true },
];

export function bossFor(index: number): BossDef {
  const n = BOSSES.length;
  return BOSSES[((index % n) + n) % n];
}

export function bossCycle(index: number): number {
  return Math.floor(index / BOSSES.length);
}

export function bossMaxHp(index: number, mult: number): number {
  return Math.max(1000, Math.round(bossFor(index).baseHp * (1 + bossCycle(index)) * mult));
}

/* ------------------------------------------------------------------ */
/*  KALE KATLARI — sıralamaya göre (miktar yazılmaz)                    */
/* ------------------------------------------------------------------ */
export interface Floor {
  idx: number;
  name: string;
  label: string;
  from: number;
  to: number | null;
  y: number;
  x0: number;
  slots: number[];
  h: number;
  maxW: number;
}

export const FLOORS: Floor[] = [
  { idx: 0, name: "KALE ZİRVESİ", label: "1. SIRADAKİ", from: 1, to: 1, y: 232, x0: 990, slots: [1076], h: 140, maxW: 160 },
  { idx: 1, name: "TEPE TERAS", label: "2. SIRADAKİ", from: 2, to: 2, y: 360, x0: 870, slots: [936], h: 120, maxW: 135 },
  { idx: 2, name: "ŞEREF LOCASI", label: "3. SIRADAKİ", from: 3, to: 3, y: 494, x0: 730, slots: [875], h: 112, maxW: 125 },
  { idx: 3, name: "SAVAŞ BALKONU", label: "4-8. SIRA", from: 4, to: 8, y: 630, x0: 600, slots: [650, 765, 880, 995, 1110], h: 92, maxW: 108 },
  { idx: 4, name: "GİRİŞ KAT", label: "9. SIRA VE SONRASI", from: 9, to: null, y: 766, x0: 500, slots: [555, 665, 775, 885, 995, 1105], h: 88, maxW: 104 },
];

export function floorForRank(rank: number): Floor | undefined {
  return FLOORS.find((f) => rank >= f.from && (f.to === null || rank <= f.to));
}

/* ------------------------------------------------------------------ */
/*  BAĞIŞ / BİLDİRİM YARDIMCILARI                                       */
/* ------------------------------------------------------------------ */
export function alertDuration(a: Pick<AlertItem, "message">): number {
  return 6500 + Math.min(6000, a.message.length * 55);
}

export function fullUrl(u: string): string {
  const t = u.trim();
  if (!t) return DEFAULT_DONATE_URL;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function prettyUrl(u: string): string {
  return fullUrl(u).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

export function normName(n: string): string {
  return n.trim().replace(/^@/, "").toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/* ------------------------------------------------------------------ */
/*  DEMO / SOHBET                                                      */
/* ------------------------------------------------------------------ */
export const DEMO_NAMES = [
  "KING_GAMER_TR", "FIRE_LADY", "MAGIC_GUY", "USER_XYZ", "ZindanKurdu", "EfsaneBerk", "AyseOyunda", "MehmetGG",
  "NightOwl_61", "CanavarAvcisi", "Pixel_Deniz", "Kaan_Reis", "ElifPro", "GölgeKılıç", "BuraKx", "Selin_42",
  "OrkKatili", "YusufYT", "KaraBüyücü", "DemirYumruk", "ZeynepZ", "TurkishWarrior", "Mert_06", "AteşKraliçesi",
  "LastHit_Baran", "Muhafiz_Ali", "UstaAvci", "BuyucuCiragi", "AcemiCan",
];

export const CHAT_LINES = [
  "SALDIR!", "KESELİM!", "patron düşüyor!!", "KRAL GELDİ 👑", "ejderha katili reis", "bu patron çok sağlam",
  "ben köylüyüm kimse bakmasın 😭", "KALE ZİRVESİNE ÇIKACAĞIM", "LET'S GOOO", "PogChamp", "patron bana vurdu 😡",
  "canım gitti heal yok mu", "MAGIC_GUY taşıyor", "clip it!!", "wombo combo", "!sıra", "bu boss hileli", "GG",
  "5. patron gelince görürsünüz", "zirve çok uzak", "F", "KATLİAM", "W chat", "kılıcım hazır ⚔️", "BÜYÜ ATIYORUM ✨",
  "!saldır", "evrimleştim!!", "yıldızlarım doldu ⭐⭐⭐", "!bağış", "selam chat 👋", "yayın çok iyi bugün",
];

export const DONATE_LINES = [
  "al bunu patron!", "zirveye geliyorum 👑", "kesin şunu artık", "bağış savaşı başlasın", "benden küçük bir katkı ❤️",
  "KALE BENİM", "köylülükten kurtulayım", "patron düşsün", "ekip için 💪", "bu da benden 🔥", "evrimleşme vakti!",
  "selamlar hawk, yayın efsane", "ejderhayı birlikte keselim", "",
];

const NAME_COLORS = ["#ff8787", "#74c0fc", "#63e6be", "#ffe066", "#b197fc", "#f783ac", "#ffc078", "#66d9e8", "#ff922b", "#38d9a9", "#a9e34b", "#e599f7"];

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function colorForName(name: string): string {
  return NAME_COLORS[hashStr(name) % NAME_COLORS.length];
}

export function formatNum(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("tr-TR");
}

export function formatTL(n: number): string {
  return `${formatNum(n)} TL`;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDonationAmount(): number {
  const r = Math.random();
  if (r < 0.3) return Math.floor(Math.random() * 9) + 1;
  if (r < 0.6) return pick([10, 15, 20, 25, 30, 40, 50]);
  if (r < 0.82) return pick([60, 75, 100, 120, 150]);
  if (r < 0.95) return pick([200, 250, 300, 400, 500]);
  return pick([600, 750, 1000]);
}

/** YouTube Super Chat renk kademeleri (TL karşılığına göre) */
export function superChatColor(tl: number): string {
  if (tl >= 1000) return "#e62117";
  if (tl >= 500) return "#e91e63";
  if (tl >= 250) return "#f57c00";
  if (tl >= 100) return "#ffca28";
  if (tl >= 50) return "#1de9b6";
  if (tl >= 20) return "#00e5ff";
  return "#1e88e5";
}

export function textOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}

export function donorId(name: string): string {
  return "n:" + name.trim().toLocaleLowerCase("tr-TR");
}

export function normalizeCmd(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/i̇/g, "i")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");
}

/** "!bağış", "bağış yap", "bağış linki" vb. → bağış linkini göster */
export function isDonateRequest(text: string): boolean {
  const c = normalizeCmd(text);
  return /^!(bagis|donate|destek|link|bynogame)(\s|$)/.test(c) || /(^|\s)(bagis|donate)\s*(yap|link|adres|nasil|nerden|nereden)/.test(c);
}

export function channelLink(d: { channelUrl?: string; name: string }): string {
  return d.channelUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(d.name)}&sp=EgIQAg%253D%253D`;
}

export function initialsAvatar(name: string): string {
  const hue = hashStr(name) % 360;
  const letters = (name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2) || "?").toLocaleUpperCase("tr-TR");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,58%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,30%)"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><text x="48" y="61" font-family="Rubik,Arial,sans-serif" font-size="38" font-weight="800" fill="#fff" text-anchor="middle">${letters}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
