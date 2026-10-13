import { normName } from "./data";

/**
 * Profil resmi çözümleme:
 *  1) YouTube sohbetinde görülen kullanıcılar (isim → avatar + kanal) hafızada tutulur.
 *     ByNoGame bağışındaki "Destekleyen isim" YouTube adıyla aynıysa avatar ve kanal otomatik eşleşir.
 *  2) İsim "@kullaniciadi" ise (veya mesajda geçiyorsa) YouTube API ile kanal avatarı alınır (1 kota birimi).
 *  3) Hiçbiri yoksa baş harflerden renkli avatar üretilir (Avatar bileşeni).
 */
export interface KnownUser {
  avatar?: string;
  channelUrl?: string;
  channelId?: string;
  at: number;
}

const USERS_KEY = "zb-known-users-v1";
const HANDLES_KEY = "zb-yt-handles-v1";

function load<T>(key: string): Record<string, T> {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, T>) : {};
  } catch {
    return {};
  }
}

const users = load<KnownUser>(USERS_KEY);
const handles = load<KnownUser | null>(HANDLES_KEY);
let timer = 0;

function persist(): void {
  if (timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    try {
      const keys = Object.keys(users);
      if (keys.length > 3000) {
        keys
          .sort((a, b) => (users[a]?.at ?? 0) - (users[b]?.at ?? 0))
          .slice(0, keys.length - 3000)
          .forEach((k) => delete users[k]);
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(HANDLES_KEY, JSON.stringify(handles));
    } catch {
      /* ignore */
    }
  }, 2500);
}

export function rememberUser(name: string, info: Partial<Omit<KnownUser, "at">>): void {
  const k = normName(name);
  if (!k) return;
  const prev = users[k];
  users[k] = {
    avatar: info.avatar || prev?.avatar,
    channelUrl: info.channelUrl || prev?.channelUrl,
    channelId: info.channelId || prev?.channelId,
    at: Date.now(),
  };
  persist();
}

export function lookupUser(name: string): KnownUser | undefined {
  return users[normName(name)];
}

export function isDefaultAvatar(url?: string): boolean {
  return !url || /default[-_]?(avatar|profile)|user-default-pictures|no[-_]?avatar|placeholder/i.test(url);
}

export function extractHandle(name: string, message?: string): string | null {
  const m = name.trim().match(/^@([\w.-]{3,30})$/) ?? (message ?? "").match(/(?:^|\s)@([\w.-]{3,30})/);
  return m ? m[1] : null;
}

interface ChannelsResponse {
  items?: { id?: string; snippet?: { thumbnails?: { default?: { url?: string }; medium?: { url?: string } } } }[];
}

export async function resolveHandle(handle: string, apiKey: string): Promise<KnownUser | null> {
  const k = handle.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(handles, k)) return handles[k] ?? null;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 3500);
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent("@" + handle)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as ChannelsResponse;
    const it = j.items?.[0];
    const info: KnownUser | null = it?.id
      ? {
          channelId: it.id,
          avatar: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url,
          channelUrl: `https://www.youtube.com/channel/${it.id}`,
          at: Date.now(),
        }
      : null;
    handles[k] = info;
    persist();
    return info;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}
