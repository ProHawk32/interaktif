import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  ByNoGame bağış köprüsü                                              */
/*  ByNoGame → (Bildirim servisi) → Streamlabs / StreamElements → Oyun   */
/*                                                                      */
/*  ByNoGame resmi olarak bağışları Streamlabs veya StreamElements'e     */
/*  iletir. Bu modül iki servisin gerçek zamanlı socket API'lerini       */
/*  dinler ve gelen her bağışı oyuna aktarır.                            */
/* ------------------------------------------------------------------ */

export type LinkStatus = "idle" | "connecting" | "live" | "error";

export interface LinkState {
  status: LinkStatus;
  error: string;
  count: number;
}

export interface IncomingDonation {
  id: string;
  name: string;
  amount: number;
  currency: string;
  message: string;
  avatar?: string;
  display: string;
  via: string;
}

interface Opts {
  token: string;
  active: boolean;
  channel?: string;
  onDonation: (d: IncomingDonation) => void;
}

/* ------------------------------ Streamlabs ------------------------------ */

interface SLDonation {
  id?: number | string;
  _id?: string;
  name?: string;
  from?: string;
  amount?: string | number;
  currency?: string;
  message?: string;
  formatted_amount?: string;
  formattedAmount?: string;
}

interface SLEvent {
  type?: string;
  for?: string;
  message?: SLDonation[] | SLDonation;
  event_id?: string;
}

/**
 * Streamlabs Socket API (socket.io v2 → Engine.IO v3) — harici kütüphane olmadan düz WebSocket ile.
 * Token: Streamlabs → Ayarlar → API Settings → API Tokens → "Your Socket API Token"
 */
export function useStreamlabs({ token, active, onDonation }: Opts): LinkState {
  const [st, setSt] = useState<LinkState>({ status: "idle", error: "", count: 0 });
  const cb = useRef(onDonation);
  cb.current = onDonation;

  useEffect(() => {
    const tk = token.trim();
    if (!active || !tk) {
      setSt((s) => ({ ...s, status: "idle", error: "" }));
      return;
    }
    let ws: WebSocket | null = null;
    let ping = 0;
    let retry = 0;
    let attempt = 0;
    let stopped = false;
    let ready = false;
    const seen = new Set<string>();
    const set = (status: LinkStatus, error = "") => setSt((s) => ({ ...s, status, error }));

    const handle = (e: SLEvent | undefined) => {
      if (!e || e.type !== "donation" || (e.for && e.for !== "streamlabs")) return;
      const list = Array.isArray(e.message) ? e.message : e.message ? [e.message] : [];
      for (const m of list) {
        const id = "sl:" + String(m._id ?? m.id ?? `${e.event_id ?? ""}-${m.name ?? ""}-${m.amount ?? ""}`);
        if (seen.has(id)) continue;
        seen.add(id);
        const amount = Number(m.amount) || 0;
        if (amount <= 0) continue;
        const currency = (m.currency || "TRY").toUpperCase();
        cb.current({
          id,
          name: (m.name || m.from || "Anonim").trim(),
          amount,
          currency,
          message: (m.message ?? "").trim(),
          display: m.formatted_amount || m.formattedAmount || `${amount} ${currency}`,
          via: "Streamlabs",
        });
        setSt((s) => ({ ...s, count: s.count + 1 }));
      }
    };

    const schedule = () => {
      if (stopped) return;
      attempt += 1;
      retry = window.setTimeout(connect, Math.min(30000, 2000 * attempt));
    };

    function connect() {
      ready = false;
      set("connecting");
      try {
        ws = new WebSocket(`wss://sockets.streamlabs.com/socket.io/?token=${encodeURIComponent(tk)}&EIO=3&transport=websocket`);
      } catch {
        set("error", "WebSocket açılamadı.");
        schedule();
        return;
      }
      const sock = ws;
      sock.onmessage = (ev) => {
        const s = typeof ev.data === "string" ? ev.data : "";
        if (s.startsWith("0{")) {
          let iv = 25000;
          try {
            iv = (JSON.parse(s.slice(1)) as { pingInterval?: number }).pingInterval ?? 25000;
          } catch {
            /* ignore */
          }
          window.clearInterval(ping);
          ping = window.setInterval(() => {
            try {
              sock.send("2");
            } catch {
              /* ignore */
            }
          }, iv);
        } else if (s === "40") {
          ready = true;
          attempt = 0;
          set("live");
        } else if (s.startsWith("44")) {
          set("error", "Streamlabs bağlantıyı reddetti — Socket API Token'ı kontrol edin.");
        } else if (s.startsWith("42")) {
          try {
            const arr = JSON.parse(s.slice(2)) as unknown[];
            if (arr[0] === "event") handle(arr[1] as SLEvent);
          } catch {
            /* ignore */
          }
        }
      };
      sock.onclose = () => {
        window.clearInterval(ping);
        if (stopped) return;
        set("error", ready ? "Bağlantı koptu, yeniden bağlanılıyor…" : "Streamlabs'e bağlanılamadı — Socket API Token'ı kontrol edin.");
        schedule();
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearInterval(ping);
      window.clearTimeout(retry);
      if (ws) {
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [token, active]);

  return st;
}

/* ---------------------------- StreamElements ---------------------------- */

interface SETip {
  username?: string;
  displayName?: string;
  name?: string;
  amount?: number | string;
  currency?: string;
  message?: string;
  avatar?: string;
  tipId?: string;
}

interface SEActivity {
  type?: string;
  _id?: string;
  activityId?: string;
  data?: SETip;
}

interface SEFrame {
  type?: string;
  topic?: string;
  error?: string;
  data?: unknown;
}

function jwtChannel(token: string): string {
  try {
    const part = token.split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="))) as { channel?: string; channel_id?: string };
    return json.channel ?? json.channel_id ?? "";
  } catch {
    return "";
  }
}

/**
 * StreamElements Astro WebSocket (wss://astro.streamelements.com) — "channel.activities" konusundaki "tip" olayları.
 * Token: StreamElements → profil → Channels/Hesap → "Show secrets" → JWT Token
 */
export function useStreamElements({ token, active, channel, onDonation }: Opts): LinkState {
  const [st, setSt] = useState<LinkState>({ status: "idle", error: "", count: 0 });
  const cb = useRef(onDonation);
  cb.current = onDonation;

  useEffect(() => {
    const tk = token.trim();
    if (!active || !tk) {
      setSt((s) => ({ ...s, status: "idle", error: "" }));
      return;
    }
    const tokenType = tk.startsWith("eyJ") ? "jwt" : "apikey";
    const room = (channel ?? "").trim() || (tokenType === "jwt" ? jwtChannel(tk) : "");
    let ws: WebSocket | null = null;
    let retry = 0;
    let attempt = 0;
    let stopped = false;
    let ready = false;
    const seen = new Set<string>();
    const set = (status: LinkStatus, error = "") => setSt((s) => ({ ...s, status, error }));

    const handle = (a: SEActivity | undefined) => {
      if (!a || a.type !== "tip") return;
      const d = a.data ?? {};
      const id = "se:" + String(a._id ?? a.activityId ?? d.tipId ?? `${d.username ?? ""}-${d.amount ?? ""}-${Date.now()}`);
      if (seen.has(id)) return;
      seen.add(id);
      const amount = Number(d.amount) || 0;
      if (amount <= 0) return;
      const currency = (d.currency || "TRY").toUpperCase();
      cb.current({
        id,
        name: (d.displayName || d.username || d.name || "Anonim").trim(),
        amount,
        currency,
        message: (d.message ?? "").trim(),
        avatar: d.avatar,
        display: `${amount} ${currency}`,
        via: "StreamElements",
      });
      setSt((s) => ({ ...s, count: s.count + 1 }));
    };

    const schedule = () => {
      if (stopped) return;
      attempt += 1;
      retry = window.setTimeout(() => connect(), Math.min(30000, 2000 * attempt));
    };

    function connect(reconnectToken?: string) {
      ready = false;
      set("connecting");
      try {
        ws = new WebSocket("wss://astro.streamelements.com/" + (reconnectToken ? `?reconnect_token=${encodeURIComponent(reconnectToken)}` : ""));
      } catch {
        set("error", "WebSocket açılamadı.");
        schedule();
        return;
      }
      const sock = ws;
      sock.onmessage = (ev) => {
        let f: SEFrame;
        try {
          f = JSON.parse(String(ev.data)) as SEFrame;
        } catch {
          return;
        }
        if (f.type === "welcome") {
          if (reconnectToken) {
            ready = true;
            set("live");
            return;
          }
          sock.send(
            JSON.stringify({
              type: "subscribe",
              nonce: `zb-${Date.now()}`,
              data: { topic: "channel.activities", room, token: tk, token_type: tokenType },
            }),
          );
        } else if (f.type === "response") {
          if (f.error) {
            set("error", `StreamElements: ${(f.data as { message?: string } | undefined)?.message ?? f.error} — JWT Token'ı kontrol edin.`);
          } else {
            ready = true;
            attempt = 0;
            set("live");
          }
        } else if (f.type === "message" && f.topic === "channel.activities") {
          handle(f.data as SEActivity);
        } else if (f.type === "reconnect") {
          const rt = (f.data as { reconnect_token?: string } | undefined)?.reconnect_token;
          sock.onclose = null;
          try {
            sock.close();
          } catch {
            /* ignore */
          }
          connect(rt);
        }
      };
      sock.onclose = () => {
        if (stopped) return;
        set("error", ready ? "Bağlantı koptu, yeniden bağlanılıyor…" : "StreamElements'e bağlanılamadı — JWT Token'ı kontrol edin.");
        schedule();
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      if (ws) {
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [token, active, channel]);

  return st;
}
