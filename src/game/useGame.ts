import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  DMG_PER_TL, FLOORS, VICTORY_MS, alertDuration, bossCycle, bossFor, bossMaxHp,
  classFor, colorForName, donorId, floorForRank, formatNum, formatTL, isDonateRequest, maxHpFor, normName, normalizeCmd,
  prettyUrl, starsFor, superChatColor,
} from "./data";
import { BOSS_FEET, bossBox, computeLayout } from "./layout";
import type {
  AlertItem, ChatAuthor, ChatKind, ChatMsg, DonationInput, DonationKind, Donor, DonorSource, Effect, GameState,
  RecentDonation, Victory,
} from "./types";

const SAVE_KEY = "zb-save-v4";
const MAX_CHAT = 80;
const MAX_LOG = 60;
const CTA_MS = 10_000;

const VIA: Record<DonationKind, string> = {
  superchat: "YouTube Super Chat",
  sticker: "Super Sticker",
  member: "YouTube Üyelik",
  gift: "Hediye Üyelik",
  bynogame: "ByNoGame",
  manual: "ByNoGame",
  tiktokGift: "TikTok LIVE hediyesi",
};

let uid = 1;
const nid = () => uid++;

function msg(user: string, text: string, kind: ChatKind, color?: string, extra?: Partial<ChatMsg>): ChatMsg {
  return { id: nid(), user, text, kind, color: color ?? colorForName(user), ...extra };
}

function sys(text: string, color = "#ffe08a"): ChatMsg {
  return msg("KALE", text, "system", color);
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  const out: T[] = [];
  while (a.length && out.length < n) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
}

function sortDonors(list: Donor[]): Donor[] {
  return [...list].sort((a, b) => b.total - a.total || a.lastDonation - b.lastDonation);
}

function makeDonor(id: string, name: string, source: DonorSource, now: number): Donor {
  return { id, name, total: 0, hp: 600, downUntil: null, lastDonation: now, damage: 0, totalDamage: 0, lastAttack: 0, source };
}

/** Önce kimlikle, bulunamazsa isimle eşleştir (ByNoGame bağışçısı YouTube sohbetinden komut yazınca da tanınır) */
function findDonor(list: Donor[], id: string, name: string): Donor | undefined {
  const n = normName(name);
  return list.find((d) => d.id === id) ?? list.find((d) => normName(d.name) === n);
}

function freshState(hpMult: number): GameState {
  const now = Date.now();
  const donors: Donor[] = [];
  const recent: RecentDonation[] = [];
  const max = bossMaxHp(0, hpMult);
  return {
    bossIndex: 0,
    bossHp: max,
    bossMax: max,
    hpMult,
    bossHurtUntil: 0,
    bossAttackUntil: 0,
    bossSpawnAt: 0,
    shakeUntil: 0,
    donors: sortDonors(donors),
    effects: [],
    chat: [
      sys("⚔️ Zindan Baskını başladı! Bağış yap, karakterin kaleye yerleşsin ve patrona saldırsın."),
      sys("💖 Bağışlar tamamen gönüllüdür. Komutlar: !bağış (link) · !saldır · !sıra", "#ff8fab"),
    ],
    log: [],
    recent,
    victory: null,
    totalDonated: 0,
    pendingDamage: 0,
    lastSysReply: 0,
    alerts: [],
    alertAt: 0,
    ctaUntil: 0,
    ctaBy: "",
    lastCta: 0,
  };
}

interface SaveData {
  v: number;
  bossIndex?: number;
  bossHp?: number;
  bossMax?: number;
  donors?: Donor[];
  totalDonated?: number;
  recent?: RecentDonation[];
  victory?: Victory | null;
  pendingDamage?: number;
  chat?: ChatMsg[];
}

function loadState(hpMult: number): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveData;
    const savedDonors = s.donors;
    if (s.v !== 4 || !Array.isArray(savedDonors)) return null;
    const base = freshState(false, hpMult);
    return {
      ...base,
      bossIndex: s.bossIndex ?? 0,
      bossHp: s.bossHp ?? base.bossHp,
      bossMax: s.bossMax ?? base.bossMax,
      donors: sortDonors(savedDonors.map((d) => ({ ...d, downUntil: null }))),
      totalDonated: s.totalDonated ?? 0,
      recent: (s.recent ?? []).map((r) => ({ ...r, id: nid(), at: 0 })),
      victory: s.victory ?? null,
      pendingDamage: s.pendingDamage ?? 0,
      chat: [...(s.chat ?? []).slice(-20).map((m) => ({ ...m, id: nid() })), sys("💾 Kayıtlı savaş yüklendi.")],
    };
  } catch {
    return null;
  }
}

function saveState(s: GameState): void {
  try {
    const data: SaveData = {
      v: 4,
      bossIndex: s.bossIndex,
      bossHp: s.bossHp,
      bossMax: s.bossMax,
      donors: s.donors,
      totalDonated: s.totalDonated,
      recent: s.recent,
      victory: s.victory,
      pendingDamage: s.pendingDamage,
      chat: s.chat.slice(-20),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */

type Action =
  | { type: "DONATE"; d: DonationInput }
  | { type: "AUTO_ATTACK" }
  | { type: "MANUAL_ATTACK"; id: string; name: string }
  | { type: "RANK_QUERY"; id: string; name: string }
  | { type: "CTA"; by: string; url: string; auto?: boolean }
  | { type: "BOSS_ATTACK" }
  | { type: "CHAT"; m: ChatMsg }
  | { type: "TICK" }
  | { type: "NEXT_BOSS" }
  | { type: "RESET" }
  | { type: "SET_HP_MULT"; mult: number };

function strikeEffects(s: GameState, sprite: string, dmg: number, crit: boolean, now: number, big: boolean, small = false): Effect[] {
  const box = bossBox(s.bossIndex);
  const lx = Math.max(box.left + box.width * 0.55, Math.min(600, box.left + box.width * 0.82 + rand(-30, 60)));
  const ly = BOSS_FEET - rand(0, 40);
  const hx = box.left + box.width * rand(0.35, 0.8);
  const hy = box.top + box.height * rand(0.2, 0.55);
  return [
    { id: nid(), kind: "lunge", x: lx, y: ly, sprite, until: now + (small ? 1000 : 1300), size: small ? 72 : 90 },
    { id: nid(), kind: "hit", x: hx, y: hy, icon: big || crit ? "💥" : "⚔️", until: now + 520, size: big ? 78 : small ? 40 : 56 },
    {
      id: nid(), kind: crit ? "crit" : "dmg", x: hx + rand(-20, 20), y: hy - 24, text: "-" + formatNum(dmg),
      color: crit ? "#ff4d4d" : big ? "#ffd43b" : "#ffffff", until: now + 1300, size: crit ? 36 : big ? 34 : small ? 21 : 27,
    },
  ];
}

function finishHit(s: GameState, dmg: number, by: string, now: number): GameState {
  const bossHp = Math.max(0, s.bossHp - dmg);
  let victory: Victory | null = s.victory;
  let chat = s.chat;
  if (bossHp <= 0 && !victory) {
    const def = bossFor(s.bossIndex);
    const mvp = [...s.donors].sort((a, b) => b.damage - a.damage)[0] ?? null;
    victory = { at: now, bossIndex: s.bossIndex, bossName: def.name, top: s.donors.slice(0, 3), mvp, lastHit: by };
    chat = [...chat, sys(`🏆 ${def.name} YENİLDİ! Son vuruş: ${by}. Sıradaki patron 60 saniye içinde geliyor!`, "#8ce99a")];
  }
  return { ...s, bossHp, victory, chat: chat.slice(-MAX_CHAT), log: s.log.slice(-MAX_LOG) };
}

function spawnNext(s: GameState, now: number): GameState {
  const idx = s.bossIndex + 1;
  const def = bossFor(idx);
  const max = bossMaxHp(idx, s.hpMult);
  const pending = Math.min(s.pendingDamage, Math.round(max * 0.5));
  const cycle = bossCycle(idx);
  const chat = [
    ...s.chat,
    sys(`⚠️ YENİ PATRON: ${def.name}${cycle > 0 ? ` (Döngü ${cycle + 1})` : ""} — ${def.title} · ${formatNum(max)} HP`, def.color),
  ];
  if (pending > 0) chat.push(sys(`⚡ Biriken bağış hasarı patrona vuruldu: -${formatNum(pending)}`, "#ffd43b"));
  return {
    ...s,
    bossIndex: idx,
    bossMax: max,
    bossHp: max - pending,
    victory: null,
    pendingDamage: 0,
    bossSpawnAt: now,
    effects: [],
    donors: s.donors.map((d) => ({ ...d, damage: 0, hp: maxHpFor(d.total), downUntil: null })),
    chat: chat.slice(-MAX_CHAT),
  };
}

function reducer(state: GameState, action: Action): GameState {
  const now = Date.now();
  switch (action.type) {
    case "CHAT":
      return { ...state, chat: [...state.chat, action.m].slice(-MAX_CHAT) };

    case "DONATE": {
      const inp = action.d;
      const amount = Math.max(1, Math.round(inp.amount));
      const id = inp.id ?? donorId(inp.name);
      const prevIdx = state.donors.findIndex((d) => d.id === id);
      const prev = prevIdx >= 0 ? state.donors[prevIdx] : makeDonor(id, inp.name, inp.source, now);
      const oldCls = classFor(prev.total);
      const total = prev.total + amount;
      const cls = classFor(total);
      const updated: Donor = {
        ...prev,
        name: inp.name || prev.name,
        avatar: inp.avatar || prev.avatar,
        channelUrl: inp.channelUrl || prev.channelUrl,
        total,
        hp: maxHpFor(total),
        downUntil: null,
        lastDonation: now,
      };
      let donors = sortDonors(prevIdx >= 0 ? state.donors.map((d) => (d.id === id ? updated : d)) : [...state.donors, updated]);
      const rank = donors.findIndex((d) => d.id === id) + 1;
      const display = inp.display || formatTL(amount);
      const message = (inp.message ?? "").trim().slice(0, 220);
      const joined = prevIdx < 0;
      const evolved = !joined && cls.idx > oldCls.idx;
      const rankUp = rank <= 3 && (joined || rank < prevIdx + 1);

      const chat = [...state.chat, msg(updated.name, message, "donate", superChatColor(amount), { avatar: updated.avatar, display, amount })];
      if (joined) chat.push(sys(`🛡️ ${updated.name} kaleye katıldı → ${cls.title}`, cls.color));
      else if (evolved) chat.push(sys(`✨ ${updated.name} evrimleşti → ${cls.title}!`, cls.color));
      if (rankUp) chat.push(sys(`👑 ${updated.name} yükseldi → ${FLOORS[rank - 1].name} (${rank}. sıra)!`, "#ffd43b"));

      const notes = [joined ? `Kaleye katıldı → ${cls.title}` : evolved ? `Evrimleşti → ${cls.title}` : cls.title];
      if (rankUp) notes.push(`👑 ${rank}. sıraya yerleşti`);
      const alert: AlertItem = {
        id: nid(),
        name: updated.name,
        avatar: updated.avatar,
        message,
        display,
        amount,
        via: inp.via ?? VIA[inp.kind ?? "test"],
        clsTitle: cls.title,
        clsColor: cls.color,
        note: notes.join(" · "),
        stars: starsFor(total),
      };
      const alerts = [...state.alerts, alert].slice(-30);
      const alertAt = state.alerts.length ? state.alertAt : now;
      const recent = [...state.recent, { id: nid(), name: updated.name, display, amount, avatar: updated.avatar, message, at: now }].slice(-30);
      const base: GameState = { ...state, donors, recent, alerts, alertAt, totalDonated: state.totalDonated + (inp.countTowardsTotal === false ? 0 : amount), chat: chat.slice(-MAX_CHAT) };

      // Zafer ekranındayken gelen bağışların hasarı bir sonraki patrona aktarılır
      if (state.victory) return { ...base, pendingDamage: state.pendingDamage + Math.round(amount * DMG_PER_TL) };

      const crit = Math.random() < 0.12;
      const dmg = Math.round(amount * DMG_PER_TL * rand(0.9, 1.2) * (crit ? 2 : 1));
      donors = donors.map((d) => (d.id === id ? { ...d, damage: d.damage + dmg, totalDamage: d.totalDamage + dmg } : d));
      const effects = [...state.effects, ...strikeEffects(state, cls.sprite, dmg, crit, now, amount >= 100)];
      const log = [...state.log, msg(updated.name, `→ -${formatNum(dmg)} hasar${crit ? " · KRİTİK!" : ""}`, "donate", superChatColor(amount), { display })];
      return finishHit(
        { ...base, donors, effects, log, bossHurtUntil: now + 320, shakeUntil: amount >= 250 ? now + 450 : state.shakeUntil },
        dmg,
        updated.name,
        now,
      );
    }

    case "AUTO_ATTACK": {
      if (state.victory || state.bossHp <= 0) return state;
      const ready = state.donors.filter((d) => !d.downUntil && now - d.lastAttack > 2400);
      if (!ready.length) return state;
      const n = Math.min(3, Math.max(1, Math.round(state.donors.length / 5)));
      const attackers = sample(ready, n);
      let total = 0;
      const effects = [...state.effects];
      const dealt = new Map<string, number>();
      for (const a of attackers) {
        const cls = classFor(a.total);
        const crit = Math.random() < 0.08;
        const dmg = Math.round(cls.atk * rand(0.8, 1.2) * (crit ? 2 : 1));
        total += dmg;
        dealt.set(a.id, dmg);
        effects.push(...strikeEffects(state, cls.sprite, dmg, crit, now, false, true));
      }
      const donors = state.donors.map((d) => {
        const dmg = dealt.get(d.id);
        return dmg ? { ...d, lastAttack: now, damage: d.damage + dmg, totalDamage: d.totalDamage + dmg } : d;
      });
      return finishHit({ ...state, donors, effects, bossHurtUntil: now + 200 }, total, attackers[attackers.length - 1].name, now);
    }

    case "MANUAL_ATTACK": {
      const d = findDonor(state.donors, action.id, action.name);
      if (!d) {
        if (now - state.lastSysReply < 6000) return state;
        return { ...state, lastSysReply: now, chat: [...state.chat, sys(`${action.name}: saldırmak için önce bağış yapmalısın! (!bağış ile linki gör — tamamen gönüllü)`)].slice(-MAX_CHAT) };
      }
      if (state.victory) return state;
      if (d.downUntil) {
        if (now - state.lastSysReply < 4000) return state;
        return { ...state, lastSysReply: now, chat: [...state.chat, sys(`${d.name} yerde! 20 saniye içinde kendiliğinden kalkacak.`)].slice(-MAX_CHAT) };
      }
      if (now - d.lastAttack < 4000) return state;
      const cls = classFor(d.total);
      const crit = Math.random() < 0.15;
      const dmg = Math.round(cls.atk * 1.6 * rand(0.9, 1.2) * (crit ? 2 : 1));
      const donors = state.donors.map((x) => (x.id === d.id ? { ...x, lastAttack: now, damage: x.damage + dmg, totalDamage: x.totalDamage + dmg } : x));
      const effects = [...state.effects, ...strikeEffects(state, cls.sprite, dmg, crit, now, false)];
      const log = [...state.log, msg(d.name, `!saldır → -${formatNum(dmg)}${crit ? " · KRİTİK!" : ""}`, "chat")];
      return finishHit({ ...state, donors, effects, log, bossHurtUntil: now + 250 }, dmg, d.name, now);
    }

    case "RANK_QUERY": {
      if (now - state.lastSysReply < 2500) return state;
      const d = findDonor(state.donors, action.id, action.name);
      let text: string;
      if (!d) {
        text = `${action.name}: henüz kalede değilsin. İstersen !bağış ile linki görebilirsin (tamamen gönüllü).`;
      } else {
        const rank = state.donors.findIndex((x) => x.id === d.id) + 1;
        const c = classFor(d.total);
        text = `${d.name}: ${rank}. sıra · ${floorForRank(rank)?.name ?? ""} · ${c.title} ${"★".repeat(starsFor(d.total))} · ${formatNum(d.damage)} hasar`;
      }
      return { ...state, lastSysReply: now, chat: [...state.chat, sys(text, "#9ad0ff")].slice(-MAX_CHAT) };
    }

    case "CTA": {
      if (!action.auto && now - state.lastCta < 12_000) return state;
      const chat = action.auto
        ? state.chat
        : [...state.chat, sys(`💖 ${action.by ? action.by + " → " : ""}Bağış linki: ${prettyUrl(action.url)} · Bağış tamamen gönüllüdür.`, "#ff8fab")].slice(-MAX_CHAT);
      return { ...state, ctaUntil: now + CTA_MS, ctaBy: action.by, lastCta: action.auto ? state.lastCta : now, chat };
    }

    case "BOSS_ATTACK": {
      if (state.victory) return state;
      const def = bossFor(state.bossIndex);
      const alive = state.donors.filter((d) => !d.downUntil);
      if (!alive.length) return state;
      const targets = sample(alive, def.targets);
      const mult = 1 + bossCycle(state.bossIndex) * 0.3;
      const pos = new Map(computeLayout(state.donors).placed.map((p) => [p.donor.id, p]));
      let donors = state.donors;
      const effects = [...state.effects];
      const chat = [...state.chat];
      const log = [...state.log];
      for (const t of targets) {
        const dmg = Math.round(rand(def.dmg[0], def.dmg[1]) * mult);
        const hp = Math.max(0, t.hp - dmg);
        const down = hp <= 0;
        donors = donors.map((d) => (d.id === t.id ? { ...d, hp, downUntil: down ? now + 20000 : null } : d));
        const p = pos.get(t.id);
        if (p) {
          effects.push(
            { id: nid(), kind: "bossHit", x: p.x, y: p.y - p.h * 0.55, icon: def.attackIcon, until: now + 800, size: 52 },
            { id: nid(), kind: "bossDmg", x: p.x, y: p.y - p.h - 20, text: "-" + formatNum(dmg), color: "#ff6b6b", until: now + 1200, size: 22 },
          );
        }
        if (down) chat.push(msg(def.name, `${def.attackName} ile ${t.name} yere serildi! 20 sn sonra ayağa kalkacak.`, "boss", def.color));
        log.push(msg(def.name, `${def.attackName} → ${t.name} -${formatNum(dmg)}${down ? " 💀" : ""}`, "boss", def.color));
      }
      return {
        ...state,
        donors,
        effects,
        chat: chat.slice(-MAX_CHAT),
        log: log.slice(-MAX_LOG),
        bossAttackUntil: now + 450,
        shakeUntil: def.final ? now + 400 : state.shakeUntil,
      };
    }

    case "TICK": {
      const effects = state.effects.filter((e) => e.until > now);
      let changed = effects.length !== state.effects.length;
      let donors = state.donors;
      if (donors.some((d) => d.downUntil !== null && d.downUntil <= now)) {
        donors = donors.map((d) => (d.downUntil !== null && d.downUntil <= now ? { ...d, downUntil: null, hp: maxHpFor(d.total) } : d));
        changed = true;
      }
      let alerts = state.alerts;
      let alertAt = state.alertAt;
      if (alerts.length && now - alertAt >= alertDuration(alerts[0])) {
        alerts = alerts.slice(1);
        alertAt = now;
        changed = true;
      }
      const next = changed ? { ...state, effects, donors, alerts, alertAt } : state;
      if (state.victory && now - state.victory.at >= VICTORY_MS) return spawnNext(next, now);
      return next;
    }

    case "NEXT_BOSS":
      return spawnNext(state, now);

    case "RESET":
      return freshState(state.hpMult);

    case "SET_HP_MULT": {
      if (action.mult === state.hpMult) return state;
      const max = bossMaxHp(state.bossIndex, action.mult);
      const ratio = state.bossMax > 0 ? state.bossHp / state.bossMax : 1;
      return { ...state, hpMult: action.mult, bossMax: max, bossHp: Math.round(max * ratio) };
    }

    default:
      return state;
  }
}

interface GameOpts {
  hpMult: number;
  donateUrl: string;
}

function init(opts: GameOpts): GameState {
  return loadState(opts.hpMult) ?? freshState(opts.hpMult);
}

export function useGame(opts: GameOpts) {
  const [state, dispatch] = useReducer(reducer, opts, init);
  const ref = useRef(state);
  ref.current = state;
  const urlRef = useRef(opts.donateUrl);
  urlRef.current = opts.donateUrl;

  useEffect(() => {
    dispatch({ type: "SET_HP_MULT", mult: opts.hpMult });
  }, [opts.hpMult]);

  // ana döngüler
  useEffect(() => {
    const tick = window.setInterval(() => dispatch({ type: "TICK" }), 250);
    const auto = window.setInterval(() => dispatch({ type: "AUTO_ATTACK" }), 1500);
    const save = window.setInterval(() => saveState(ref.current), 2000);
    // her 4 dakikada bir bağış panelini nazikçe hatırlat (sohbete yazmadan)
    const remind = window.setInterval(() => dispatch({ type: "CTA", by: "", url: urlRef.current, auto: true }), 240_000);
    const onUnload = () => saveState(ref.current);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(auto);
      window.clearInterval(save);
      window.clearInterval(remind);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  // patron saldırıları
  useEffect(() => {
    let t = 0;
    const loop = () => {
      dispatch({ type: "BOSS_ATTACK" });
      t = window.setTimeout(loop, rand(3500, 6500));
    };
    t = window.setTimeout(loop, 4000);
    return () => window.clearTimeout(t);
  }, []);

  // Sahte sohbet ve sahte bağış simülasyonu kaldırıldı; yalnızca gerçek platform etkinlikleri işlenir.

  const donate = useCallback((d: DonationInput) => dispatch({ type: "DONATE", d }), []);

  const chat = useCallback((a: ChatAuthor, text: string, source: DonorSource) => {
    const t = text.trim();
    if (!t) return;
    const badge = a.isOwner ? "YAYINCI" : a.isMod ? "MOD" : a.isMember ? "ÜYE" : undefined;
    dispatch({ type: "CHAT", m: msg(a.name, t, a.isOwner ? "owner" : "chat", undefined, { avatar: a.avatar, badge }) });
    const cmd = normalizeCmd(t);
    if (isDonateRequest(t)) {
      dispatch({ type: "CTA", by: a.name, url: urlRef.current });
      return;
    }
    if (/^!(saldir|attack|vur)/.test(cmd)) dispatch({ type: "MANUAL_ATTACK", id: a.id, name: a.name });
    else if (/^!(sira|rank)/.test(cmd)) dispatch({ type: "RANK_QUERY", id: a.id, name: a.name });
  }, []);

  const nextBoss = useCallback(() => dispatch({ type: "NEXT_BOSS" }), []);
  const reset = useCallback((_seed: boolean) => dispatch({ type: "RESET" }), []);

  return { state, donate, chat, nextBoss, reset };
}
