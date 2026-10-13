import { DEFAULT_DONATE_URL, DEFAULT_NOTICE } from "./data";

export interface Settings {
  apiKey: string;
  videoInput: string;
  connect: boolean;
  simulate: boolean;
  tiktokUsername: string;
  tiktokServerUrl: string;
  tiktokConnect: boolean;
  hideUi: boolean;
  goal: number;
  hpMult: number;
  usdTry: number;
  memberValue: number;
  minPollMs: number;
  testName: string;
  /** ByNoGame bağış linki */
  donateUrl: string;
  /** Ekranda sürekli görünen gönüllülük yazısı */
  noticeText: string;
  /** Bildirim / kayan yazıda bağış tutarı gösterilsin mi */
  showAmounts: boolean;
  /** Streamlabs Socket API token (ByNoGame → Streamlabs) */
  slToken: string;
  slConnect: boolean;
  /** StreamElements JWT (ByNoGame → StreamElements) */
  seToken: string;
  seConnect: boolean;
  seChannel: string;
  alertSound: boolean;
  tts: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  videoInput: "",
  connect: false,
  simulate: false,
  tiktokUsername: "",
  tiktokServerUrl: "ws://127.0.0.1:21213",
  tiktokConnect: false,
  hideUi: false,
  goal: 10000,
  hpMult: 1,
  usdTry: 43,
  memberValue: 50,
  minPollMs: 5000,
  testName: "Yayıncı",
  donateUrl: DEFAULT_DONATE_URL,
  noticeText: DEFAULT_NOTICE,
  showAmounts: false,
  slToken: "",
  slConnect: false,
  seToken: "",
  seConnect: false,
  seChannel: "",
  alertSound: true,
  tts: false,
};

const KEY = "zb-settings-v1";

export function loadSettings(): Settings {
  let s: Settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  try {
    const p = new URLSearchParams(window.location.search);
    const str = (k: string) => p.get(k)?.trim() ?? "";
    if (str("key")) s.apiKey = str("key");
    const video = str("video") || str("v");
    if (video) s.videoInput = video;
    if (str("donate")) s.donateUrl = str("donate");
    if (str("sl")) s.slToken = str("sl");
    if (str("se")) s.seToken = str("se");
    if (str("sech")) s.seChannel = str("sech");
    if (str("notice")) s.noticeText = str("notice");
    if (p.get("amounts") === "1") s.showAmounts = true;
    if (p.get("amounts") === "0") s.showAmounts = false;
    if (p.get("sound") === "0") s.alertSound = false;
    if (p.get("tts") === "1") s.tts = true;
    if (p.get("obs") === "1") {
      s.hideUi = true;
      s.simulate = false;
      s.connect = !!(s.apiKey && s.videoInput);
      s.slConnect = !!s.slToken;
      s.seConnect = !!s.seToken;
    }
    const goal = Number(p.get("goal"));
    if (goal > 0) s.goal = goal;
    const hp = Number(p.get("hp"));
    if (hp > 0) s.hpMult = hp;
  } catch {
    /* ignore */
  }
  s.simulate = false;
  if (!s.donateUrl?.trim()) s.donateUrl = DEFAULT_DONATE_URL;
  if (!s.noticeText?.trim()) s.noticeText = DEFAULT_NOTICE;
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** OBS tarayıcı kaynağı için tüm ayarları taşıyan link (OBS'in kendi localStorage'ı ayrıdır) */
export function obsUrl(s: Settings): string {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  const set = (k: string, v: string) => {
    if (v.trim()) u.searchParams.set(k, v.trim());
  };
  set("key", s.apiKey);
  set("video", s.videoInput);
  set("sl", s.slToken);
  set("se", s.seToken);
  set("sech", s.seChannel);
  set("ttuser", s.tiktokUsername);
  set("ttserver", s.tiktokServerUrl);
  if (s.tiktokConnect && s.tiktokUsername.trim()) u.searchParams.set("ttlive", "1");
  if (s.donateUrl.trim() !== DEFAULT_DONATE_URL) set("donate", s.donateUrl);
  if (s.noticeText.trim() !== DEFAULT_NOTICE) set("notice", s.noticeText);
  u.searchParams.set("obs", "1");
  if (s.showAmounts) u.searchParams.set("amounts", "1");
  if (!s.alertSound) u.searchParams.set("sound", "0");
  if (s.tts) u.searchParams.set("tts", "1");
  if (s.goal !== DEFAULT_SETTINGS.goal) u.searchParams.set("goal", String(s.goal));
  if (s.hpMult !== 1) u.searchParams.set("hp", String(s.hpMult));
  return u.toString();
}
