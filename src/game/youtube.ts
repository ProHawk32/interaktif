import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  YouTube Data API v3 — Canlı sohbet + Super Chat okuyucu             */
/* ------------------------------------------------------------------ */

export interface YTAuthor {
  channelId: string;
  name: string;
  avatar: string;
  channelUrl: string;
  isOwner: boolean;
  isMod: boolean;
  isMember: boolean;
}

export type YTEvent =
  | { type: "chat"; id: string; author: YTAuthor; text: string }
  | { type: "donation"; id: string; author: YTAuthor; amountTL: number; display: string; text: string; kind: "superchat" | "sticker" | "member" | "gift" };

export type YTStatus = "idle" | "connecting" | "live" | "error" | "ended";

export interface YTInfo {
  title?: string;
  channel?: string;
  videoId?: string;
  polls: number;
  messages: number;
  donations: number;
  lastPoll?: number;
}

interface ApiErr {
  error?: { message?: string; errors?: { reason?: string }[] };
}
interface RawAuthor {
  channelId?: string;
  channelUrl?: string;
  displayName?: string;
  profileImageUrl?: string;
  isChatOwner?: boolean;
  isChatSponsor?: boolean;
  isChatModerator?: boolean;
}
interface RawAmount {
  amountMicros?: string | number;
  currency?: string;
  amountDisplayString?: string;
}
interface RawSnippet {
  type?: string;
  authorChannelId?: string;
  displayMessage?: string;
  textMessageDetails?: { messageText?: string };
  superChatDetails?: RawAmount & { userComment?: string; tier?: number };
  superStickerDetails?: RawAmount & { superStickerMetadata?: { altText?: string } };
  newSponsorDetails?: { memberLevelName?: string; isUpgrade?: boolean };
  memberMilestoneChatDetails?: { userComment?: string; memberMonth?: number };
  membershipGiftingDetails?: { giftMembershipsCount?: number; giftMembershipsLevelName?: string };
}
interface RawItem {
  id?: string;
  snippet?: RawSnippet;
  authorDetails?: RawAuthor;
}
interface ChatResponse {
  nextPageToken?: string;
  pollingIntervalMillis?: number;
  offlineAt?: string;
  items?: RawItem[];
}
interface VideosResponse {
  items?: { id?: string; snippet?: { title?: string; channelTitle?: string }; liveStreamingDetails?: { activeLiveChatId?: string } }[];
}
interface SearchResponse {
  items?: { id?: { videoId?: string } }[];
}
interface ChannelsResponse {
  items?: { id?: string }[];
}

/** 1 birim yabancı paranın yaklaşık USD değeri (TL'ye çevirmek için "1 USD = X TL" ayarı ile çarpılır) */
const USD_PER_UNIT: Record<string, number> = {
  USD: 1, EUR: 1.16, GBP: 1.34, CHF: 1.25, CAD: 0.73, AUD: 0.66, NZD: 0.6, JPY: 0.0067, KRW: 0.00072, CNY: 0.14,
  HKD: 0.128, TWD: 0.033, SGD: 0.78, INR: 0.0115, IDR: 0.000061, MYR: 0.236, PHP: 0.0175, THB: 0.03, VND: 0.000038,
  AZN: 0.588, KZT: 0.0019, RUB: 0.0125, UAH: 0.024, BYN: 0.3, GEL: 0.37, PLN: 0.27, CZK: 0.047, HUF: 0.0029,
  RON: 0.23, BGN: 0.59, RSD: 0.0099, SEK: 0.105, NOK: 0.099, DKK: 0.155, ISK: 0.0081, SAR: 0.267, AED: 0.272,
  QAR: 0.275, KWD: 3.27, BHD: 2.65, OMR: 2.6, JOD: 1.41, EGP: 0.02, ILS: 0.29, MAD: 0.11, ZAR: 0.057, NGN: 0.00065,
  KES: 0.0077, BRL: 0.18, MXN: 0.054, ARS: 0.00075, CLP: 0.00105, COP: 0.00025, PEN: 0.28, UYU: 0.025,
  BOB: 0.145, PYG: 0.000135, CRC: 0.002, DOP: 0.016, GTQ: 0.13, HNL: 0.039, NIO: 0.027,
};

export function toTL(amount: number, currency: string, usdTry: number): number {
  const cur = (currency || "USD").toUpperCase();
  if (cur === "TRY") return amount;
  const usd = USD_PER_UNIT[cur] ?? 1;
  return amount * usd * usdTry;
}

export function parseVideoInput(input: string): { videoId?: string; channelId?: string; handle?: string } {
  const s = input.trim();
  if (!s) return {};
  const v = s.match(/(?:[?&]v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/);
  if (v) return { videoId: v[1] };
  const ch = s.match(/(UC[\w-]{22})/);
  if (ch) return { channelId: ch[1] };
  const h = s.match(/@([\w.-]{3,30})/);
  if (h) return { handle: h[1] };
  if (/^[\w-]{11}$/.test(s)) return { videoId: s };
  return {};
}

const REASONS: Record<string, string> = {
  quotaExceeded: "Günlük YouTube API kotası doldu. 5 dk sonra tekrar denenecek.",
  dailyLimitExceeded: "Günlük YouTube API kotası doldu.",
  keyInvalid: "API anahtarı geçersiz.",
  badRequest: "Geçersiz istek (API anahtarı / video bilgisi kontrol edin).",
  forbidden: "Erişim reddedildi (API anahtarı kısıtlamalarını kontrol edin).",
  accessNotConfigured: "YouTube Data API v3 bu Google Cloud projesinde etkin değil.",
  ipRefererBlocked: "API anahtarı bu siteye izin vermiyor (HTTP yönlendiren kısıtlaması).",
  liveChatEnded: "Canlı sohbet sona erdi.",
  liveChatNotFound: "Canlı sohbet bulunamadı.",
  liveChatDisabled: "Bu yayında canlı sohbet kapalı.",
  rateLimitExceeded: "Çok sık istek gönderildi, bekleniyor…",
};

class YTError extends Error {
  reason: string;
  constructor(message: string, reason = "") {
    super(message);
    this.reason = reason;
  }
}

async function api<T>(path: string, params: Record<string, string>, key: string, signal: AbortSignal): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  let res: Response;
  try {
    res = await fetch(url.toString(), { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new YTError("Ağ hatası: YouTube API'ye ulaşılamadı.", "network");
  }
  const json = (await res.json().catch(() => ({}))) as T & ApiErr;
  if (!res.ok || json.error) {
    const reason = json.error?.errors?.[0]?.reason ?? "";
    throw new YTError(REASONS[reason] ?? json.error?.message ?? `HTTP ${res.status}`, reason);
  }
  return json;
}

async function resolveLiveChat(key: string, input: string, signal: AbortSignal) {
  const p = parseVideoInput(input);
  let videoId = p.videoId;
  let channelId = p.channelId;
  if (!videoId && p.handle) {
    const r = await api<ChannelsResponse>("channels", { part: "id", forHandle: "@" + p.handle }, key, signal);
    channelId = r.items?.[0]?.id;
    if (!channelId) throw new YTError("Kanal bulunamadı: @" + p.handle, "notFound");
  }
  if (!videoId && channelId) {
    const r = await api<SearchResponse>("search", { part: "id", channelId, eventType: "live", type: "video", maxResults: "1" }, key, signal);
    videoId = r.items?.[0]?.id?.videoId;
    if (!videoId) throw new YTError("Bu kanalda şu anda aktif bir canlı yayın yok.", "noLive");
  }
  if (!videoId) throw new YTError("Geçerli bir canlı yayın linki, video ID'si veya kanal (@kullanıcı) girin.", "badInput");
  const r = await api<VideosResponse>("videos", { part: "liveStreamingDetails,snippet", id: videoId }, key, signal);
  const item = r.items?.[0];
  if (!item) throw new YTError("Video bulunamadı.", "notFound");
  const liveChatId = item.liveStreamingDetails?.activeLiveChatId;
  if (!liveChatId) throw new YTError("Bu videoda aktif canlı sohbet yok (yayın başlamamış veya bitmiş olabilir).", "noChat");
  return { liveChatId, videoId, title: item.snippet?.title, channel: item.snippet?.channelTitle };
}

const PROCESSED_KEY = "zb-yt-processed-v1";

function loadProcessed(): Set<string> {
  try {
    const a = JSON.parse(localStorage.getItem(PROCESSED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(a) ? (a as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveProcessed(set: Set<string>): void {
  try {
    localStorage.setItem(PROCESSED_KEY, JSON.stringify(Array.from(set).slice(-3000)));
  } catch {
    /* ignore */
  }
}

function amountOf(d: RawAmount | undefined): number {
  return Number(d?.amountMicros ?? 0) / 1_000_000;
}

function parseItems(items: RawItem[], processed: Set<string>, usdTry: number, memberValue: number): YTEvent[] {
  const out: YTEvent[] = [];
  for (const it of items) {
    if (!it.id || processed.has(it.id)) continue;
    processed.add(it.id);
    const sn = it.snippet ?? {};
    const ad = it.authorDetails ?? {};
    const channelId = ad.channelId ?? sn.authorChannelId ?? it.id;
    const author: YTAuthor = {
      channelId,
      name: ad.displayName ?? "Anonim",
      avatar: ad.profileImageUrl ?? "",
      channelUrl: ad.channelUrl ?? `https://www.youtube.com/channel/${channelId}`,
      isOwner: !!ad.isChatOwner,
      isMod: !!ad.isChatModerator,
      isMember: !!ad.isChatSponsor,
    };
    switch (sn.type) {
      case "textMessageEvent":
        out.push({ type: "chat", id: it.id, author, text: sn.textMessageDetails?.messageText ?? sn.displayMessage ?? "" });
        break;
      case "superChatEvent": {
        const d = sn.superChatDetails;
        const amt = amountOf(d);
        out.push({
          type: "donation", id: it.id, author, kind: "superchat",
          amountTL: Math.max(1, Math.round(toTL(amt, d?.currency ?? "USD", usdTry))),
          display: d?.amountDisplayString ?? `${amt} ${d?.currency ?? ""}`,
          text: d?.userComment ?? "",
        });
        break;
      }
      case "superStickerEvent": {
        const d = sn.superStickerDetails;
        const amt = amountOf(d);
        out.push({
          type: "donation", id: it.id, author, kind: "sticker",
          amountTL: Math.max(1, Math.round(toTL(amt, d?.currency ?? "USD", usdTry))),
          display: d?.amountDisplayString ?? `${amt} ${d?.currency ?? ""}`,
          text: `🎟️ ${d?.superStickerMetadata?.altText ?? "Super Sticker"}`,
        });
        break;
      }
      case "newSponsorEvent":
        out.push({
          type: "donation", id: it.id, author, kind: "member", amountTL: memberValue,
          display: "⭐ Yeni Üye", text: sn.newSponsorDetails?.memberLevelName ?? "Kanal üyesi oldu!",
        });
        break;
      case "membershipGiftingEvent": {
        const n = sn.membershipGiftingDetails?.giftMembershipsCount ?? 1;
        out.push({
          type: "donation", id: it.id, author, kind: "gift", amountTL: memberValue * n,
          display: `🎁 ${n} Üyelik`, text: `${n} üyelik hediye etti!`,
        });
        break;
      }
      case "memberMilestoneChatEvent":
        out.push({ type: "chat", id: it.id, author, text: `⭐ ${sn.memberMilestoneChatDetails?.memberMonth ?? ""}. ay üyelik! ${sn.memberMilestoneChatDetails?.userComment ?? ""}` });
        break;
      default:
        break;
    }
  }
  return out;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface Options {
  apiKey: string;
  videoInput: string;
  active: boolean;
  usdTry: number;
  memberValue: number;
  minPollMs: number;
  onEvents: (events: YTEvent[]) => void;
}

export function useYouTubeLive(opts: Options) {
  const [status, setStatus] = useState<YTStatus>("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState<YTInfo>({ polls: 0, messages: 0, donations: 0 });
  const cbRef = useRef(opts.onEvents);
  cbRef.current = opts.onEvents;
  const ratesRef = useRef({ usdTry: opts.usdTry, memberValue: opts.memberValue });
  ratesRef.current = { usdTry: opts.usdTry, memberValue: opts.memberValue };
  const { active, apiKey, videoInput, minPollMs } = opts;

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      setError("");
      return;
    }
    let cancelled = false;
    let timer = 0;
    const ctrl = new AbortController();
    const processed = loadProcessed();
    const key = apiKey.trim();
    let liveChatId = "";
    let pageToken = "";
    const schedule = (ms: number, fn: () => void) => {
      if (!cancelled) timer = window.setTimeout(fn, ms);
    };

    const poll = async () => {
      try {
        const params: Record<string, string> = { liveChatId, part: "snippet,authorDetails", maxResults: "2000", profileImageSize: "88", hl: "tr" };
        if (pageToken) params.pageToken = pageToken;
        const r = await api<ChatResponse>("liveChat/messages", params, key, ctrl.signal);
        if (cancelled) return;
        if (r.nextPageToken) pageToken = r.nextPageToken;
        const events = parseItems(r.items ?? [], processed, ratesRef.current.usdTry, ratesRef.current.memberValue);
        if (events.length) {
          saveProcessed(processed);
          cbRef.current(events);
        }
        const chats = events.filter((e) => e.type === "chat").length;
        setInfo((i) => ({ ...i, polls: i.polls + 1, messages: i.messages + chats, donations: i.donations + (events.length - chats), lastPoll: Date.now() }));
        if (r.offlineAt) {
          setStatus("ended");
          setError("Yayın sona erdi.");
          return;
        }
        setStatus("live");
        setError("");
        schedule(Math.max(minPollMs, r.pollingIntervalMillis ?? 5000), poll);
      } catch (e) {
        if (cancelled) return;
        const reason = (e as { reason?: string }).reason ?? "";
        setError(errMsg(e));
        if (reason === "liveChatEnded" || reason === "liveChatNotFound" || reason === "liveChatDisabled") {
          setStatus("ended");
          return;
        }
        setStatus("error");
        schedule(reason === "quotaExceeded" || reason === "dailyLimitExceeded" ? 300000 : 15000, poll);
      }
    };

    const connect = async () => {
      setStatus("connecting");
      setError("");
      try {
        const r = await resolveLiveChat(key, videoInput, ctrl.signal);
        if (cancelled) return;
        liveChatId = r.liveChatId;
        setInfo((i) => ({ ...i, title: r.title, channel: r.channel, videoId: r.videoId }));
        void poll();
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(errMsg(e));
        // Video ID ile bağlantıda ucuz yeniden deneme (kanal araması kota yer, tekrar denenmez)
        if (parseVideoInput(videoInput).videoId) schedule(30000, () => void connect());
      }
    };

    void connect();
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [active, apiKey, videoInput, minPollMs]);

  return { status, error, info };
}
