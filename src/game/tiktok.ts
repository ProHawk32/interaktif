import { useEffect, useRef, useState } from "react";
import type { LinkState, LinkStatus } from "./donations";

export interface TikTokLiveEvent {
  type: "chat" | "gift" | "follow" | "like";
  id: string;
  user: { uniqueId: string; nickname: string; avatar?: string };
  text?: string;
  giftName?: string;
  count?: number;
  coins?: number;
}

interface Options {
  serverUrl: string;
  username: string;
  active: boolean;
  onEvent: (event: TikTokLiveEvent) => void;
}

export function useTikTokLive({ serverUrl, username, active, onEvent }: Options): LinkState {
  const [state, setState] = useState<LinkState>({ status: "idle", error: "", count: 0 });
  const callback = useRef(onEvent);
  callback.current = onEvent;

  useEffect(() => {
    const user = username.trim().replace(/^@/, "");
    if (!active || !user) {
      setState((s) => ({ ...s, status: "idle", error: "" }));
      return;
    }

    let socket: WebSocket | undefined;
    let retryTimer = 0;
    let stopped = false;
    let attempts = 0;
    const seen = new Set<string>();
    const setStatus = (status: LinkStatus, error = "") =>
      setState((s) => ({ ...s, status, error }));

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");
      try {
        socket = new WebSocket(serverUrl.trim() || "ws://127.0.0.1:21213");
      } catch {
        setStatus("error", "TikTok köprüsü açılamadı. Yerel TikTok sunucusunu çalıştırın.");
        retry();
        return;
      }

      const current = socket;
      current.onopen = () => {
        attempts = 0;
        current.send(JSON.stringify({ type: "connect", username: user }));
      };
      current.onmessage = (message) => {
        let payload: any;
        try {
          payload = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (payload.type === "status") {
          setStatus(payload.status, payload.error || "");
          return;
        }
        if (!["chat", "gift", "follow", "like"].includes(payload.type) || !payload.user) return;
        const eventId = String(payload.id || "");
        if (eventId && seen.has(eventId)) return;
        if (eventId) {
          seen.add(eventId);
          if (seen.size > 3000) seen.delete(seen.values().next().value as string);
        }
        callback.current(payload as TikTokLiveEvent);
        setState((s) => ({ ...s, count: s.count + 1 }));
      };
      current.onerror = () => setStatus("error", "TikTok köprüsüne bağlanılamadı. Sunucunun 21213 portunda çalıştığını kontrol edin.");
      current.onclose = () => {
        if (stopped) return;
        setStatus("error", "TikTok köprüsü bağlantısı koptu; yeniden deneniyor…");
        retry();
      };
    };

    function retry() {
      if (stopped) return;
      attempts += 1;
      retryTimer = window.setTimeout(connect, Math.min(30000, 2000 * attempts));
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        try {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "disconnect" }));
          socket.close();
        } catch { /* ignore */ }
      }
    };
  }, [serverUrl, username, active]);

  return state;
}
