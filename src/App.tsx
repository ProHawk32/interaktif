import { useCallback, useEffect, useRef, useState } from "react";
import Boss from "./components/Boss";
import Castle from "./components/Castle";
import ChatPanel from "./components/ChatPanel";
import ControlPanel from "./components/ControlPanel";
import DonatePanel from "./components/DonatePanel";
import DonationAlert from "./components/DonationAlert";
import Effects from "./components/Effects";
import Ticker from "./components/Ticker";
import VictoryOverlay from "./components/VictoryOverlay";
import { extractHandle, isDefaultAvatar, lookupUser, rememberUser, resolveHandle } from "./game/avatars";
import { DEMO_NAMES, DONATE_LINES, bossFor, donorId, formatNum, formatTL, pick, randomDonationAmount } from "./game/data";
import { useStreamElements, useStreamlabs, type IncomingDonation, type LinkStatus } from "./game/donations";
import { STAGE_H, STAGE_W } from "./game/layout";
import { loadSettings, saveSettings, type Settings } from "./game/settings";
import { preloadSprites } from "./game/sprites";
import type { DonationInput } from "./game/types";
import { useGame } from "./game/useGame";
import { toTL, useYouTubeLive, type YTEvent, type YTStatus } from "./game/youtube";

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let alive = true;
    const bg = new Image();
    bg.src = "/images/bg.jpg";
    preloadSprites((done, total) => {
      if (alive) setProgress(done / total);
    }).finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return <Loading progress={progress} />;
  return <Game />;
}

function Loading({ progress }: { progress: number }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#07090c] text-white">
      <div className="crown-float text-[44px]">🏰</div>
      <div className="font-title text-[36px] font-black text-[#ffd43b]">ZİNDAN BASKINI</div>
      <div className="text-[16px] text-white/70">Kale inşa ediliyor, karakterler hazırlanıyor…</div>
      <div className="h-3 w-80 overflow-hidden rounded-full border border-[#c9a063] bg-black">
        <div className="h-full bg-gradient-to-r from-[#c9a063] to-[#ffd43b] transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

function modeLabel(s: Settings, yt: YTStatus, sl: LinkStatus, se: LinkStatus): { label: string; color: string } {
  const parts: string[] = [];
  let color = "#adb5bd";
  if (s.slConnect || s.seConnect) {
    const live = (s.slConnect && sl === "live") || (s.seConnect && se === "live");
    const err = (s.slConnect && sl === "error") || (s.seConnect && se === "error");
    parts.push(live ? "💖 ByNoGame ✓" : err ? "💖 ByNoGame ⚠" : "💖 ByNoGame …");
    color = live ? "#8ce99a" : err ? "#ff922b" : "#ffd43b";
  }
  if (s.connect) {
    parts.push(yt === "live" ? "🔴 YouTube ✓" : yt === "error" ? "🔴 YouTube ⚠" : yt === "ended" ? "⏹ YouTube" : "🔴 YouTube …");
    if (color === "#adb5bd") color = yt === "live" ? "#ff6b6b" : yt === "error" ? "#ff922b" : "#ffd43b";
  }
  if (!parts.length) return s.simulate ? { label: "🎮 DEMO MODU", color: "#9ad0ff" } : { label: "⏸ Bağlantı yok", color: "#adb5bd" };
  return { label: parts.join(" · "), color };
}

function Game() {
  const scale = useStageScale();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...patch };
      saveSettings(n);
      return n;
    });
  }, []);

  const { state, donate, chat, nextBoss, reset } = useGame({ simulate: settings.simulate, hpMult: settings.hpMult, donateUrl: settings.donateUrl });

  /** Profil resmi + kanal eşleştirmesi yapıp bağışı oyuna aktarır */
  const donateRich = useCallback(
    async (d: DonationInput) => {
      const out: DonationInput = { ...d };
      if (isDefaultAvatar(out.avatar)) out.avatar = undefined;
      const known = lookupUser(d.name);
      if (known) {
        out.avatar = out.avatar ?? known.avatar;
        out.channelUrl = out.channelUrl ?? known.channelUrl;
        if (!out.id && known.channelId) out.id = "yt:" + known.channelId;
      }
      const key = settingsRef.current.apiKey.trim();
      if (!out.avatar && key) {
        const handle = extractHandle(d.name, d.message);
        if (handle) {
          const r = await resolveHandle(handle, key);
          if (r) {
            out.avatar = r.avatar;
            out.channelUrl = out.channelUrl ?? r.channelUrl;
            if (!out.id && r.channelId) out.id = "yt:" + r.channelId;
          }
        }
      }
      donate(out);
    },
    [donate],
  );

  /** ByNoGame → Streamlabs / StreamElements → oyun */
  const onExternal = useCallback(
    (d: IncomingDonation) => {
      const s = settingsRef.current;
      const tl = Math.max(1, Math.round(toTL(d.amount, d.currency, s.usdTry)));
      const isTry = d.currency === "TRY";
      void donateRich({
        name: d.name,
        amount: tl,
        message: d.message,
        avatar: d.avatar,
        display: isTry ? formatTL(tl) : `${d.display} (≈${formatTL(tl)})`,
        source: "bynogame",
        kind: "bynogame",
        via: isTry ? "ByNoGame" : d.via,
      });
    },
    [donateRich],
  );

  const sl = useStreamlabs({ token: settings.slToken, active: settings.slConnect, onDonation: onExternal });
  const se = useStreamElements({ token: settings.seToken, active: settings.seConnect, channel: settings.seChannel, onDonation: onExternal });

  const onEvents = useCallback(
    (events: YTEvent[]) => {
      for (const e of events) {
        rememberUser(e.author.name, { avatar: e.author.avatar || undefined, channelUrl: e.author.channelUrl, channelId: e.author.channelId });
        const id = "yt:" + e.author.channelId;
        if (e.type === "donation") {
          donate({ id, name: e.author.name, amount: e.amountTL, avatar: e.author.avatar, channelUrl: e.author.channelUrl, message: e.text, display: e.display, source: "youtube", kind: e.kind });
        } else {
          chat(
            { id, name: e.author.name, avatar: e.author.avatar, channelUrl: e.author.channelUrl, isOwner: e.author.isOwner, isMod: e.author.isMod, isMember: e.author.isMember },
            e.text,
            "youtube",
          );
        }
      }
    },
    [donate, chat],
  );

  const yt = useYouTubeLive({
    apiKey: settings.apiKey,
    videoInput: settings.videoInput,
    active: settings.connect && settings.apiKey.trim().length > 0 && settings.videoInput.trim().length > 0,
    usdTry: settings.usdTry,
    memberValue: settings.memberValue,
    minPollMs: settings.minPollMs,
    onEvents,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, []);

  const [panel, setPanel] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(false);
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) setPanel((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const def = bossFor(state.bossIndex);
  const shaking = state.shakeUntil > now;
  const mode = modeLabel(settings, yt.status, sl.status, se.status);
  const showBanner = state.bossSpawnAt > 0 && now - state.bossSpawnAt < 3800 && !state.victory;
  const testerName = settings.testName || "Yayıncı";

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div className="relative shrink-0 select-none overflow-hidden" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "center" }}>
        <div className="absolute inset-0" style={{ animation: shaking ? "shake .35s linear" : undefined }}>
          {/* Arka plan */}
          <img src="/images/bg.jpg" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 38%, rgba(6,8,12,.5) 62%, rgba(6,8,12,.6))" }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at 22% 70%, ${def.color}22, transparent 55%)` }} />

          {/* Başlık */}
          <div className="panel absolute z-30 px-4 py-1.5" style={{ left: 12, top: 42 }}>
            <div className="font-title ol whitespace-nowrap text-[20px] font-black tracking-wide text-white">
              ZİNDAN BASKINI: <span className="text-[#ffd43b]">BAĞIŞÇI KALESİ SAVAŞI</span>
            </div>
          </div>

          <Boss state={state} now={now} />
          <DonatePanel total={state.totalDonated} goal={settings.goal} donateUrl={settings.donateUrl} notice={settings.noticeText} ctaActive={state.ctaUntil > now} ctaBy={state.ctaBy} />
          <Castle donors={state.donors} />
          <Effects effects={state.effects} />

          <ChatPanel
            chat={state.chat}
            log={state.log}
            donors={state.donors}
            showInput={!settings.hideUi}
            mode={mode}
            showAmounts={settings.showAmounts}
            donateUrl={settings.donateUrl}
            onSend={(t) => chat({ id: donorId(testerName), name: testerName }, t, "test")}
          />

          {showBanner && (
            <div className="pointer-events-none absolute z-[45] whitespace-nowrap text-center" style={{ left: 300, top: 380, animation: "banner 3.8s ease-out forwards" }}>
              <div className="ol text-[20px] font-black tracking-[0.3em] text-[#ff6b6b]">⚠ YENİ PATRON ⚠</div>
              <div className="font-title ol text-[48px] font-black leading-tight" style={{ color: def.color }}>
                {def.name}
              </div>
              <div className="ol-sm text-[17px] font-bold text-white">
                {def.title} · {formatNum(state.bossMax)} HP
              </div>
            </div>
          )}

          {state.victory && (
            <VictoryOverlay victory={state.victory} now={now} hpMult={settings.hpMult} pending={state.pendingDamage} showSkip={!settings.hideUi} onSkip={nextBoss} />
          )}
        </div>

        {/* Üstten yavaş kayan bağışçı isimleri + üstten gelen bağış bildirimi */}
        <Ticker recent={state.recent} donateUrl={settings.donateUrl} showAmounts={settings.showAmounts} tick={Math.floor(now / 5000)} />
        <DonationAlert alert={state.alerts[0]} startedAt={state.alertAt} now={now} showAmounts={settings.showAmounts} sound={settings.alertSound} tts={settings.tts} />
      </div>

      <button
        onClick={() => setPanel(true)}
        title="Yayıncı Paneli (Ctrl+Shift+P)"
        className={`fixed bottom-3 right-3 z-[90] flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#c9a063] bg-black/75 text-[24px] shadow-lg transition hover:scale-110 ${settings.hideUi ? "opacity-0 hover:opacity-100" : "opacity-95"}`}
      >
        ⚙️
      </button>

      <ControlPanel
        open={panel}
        onClose={() => setPanel(false)}
        settings={settings}
        update={update}
        yt={yt}
        sl={sl}
        se={se}
        onConnect={(fresh) => {
          if (fresh) reset(false);
          update({ connect: true, simulate: false });
        }}
        onDisconnect={() => update({ connect: false })}
        onLinkConnect={(kind, fresh) => {
          if (fresh) reset(false);
          update(kind === "sl" ? { slConnect: true, simulate: false } : { seConnect: true, simulate: false });
        }}
        onLinkDisconnect={(kind) => update(kind === "sl" ? { slConnect: false } : { seConnect: false })}
        onManualDonate={(m) =>
          void donateRich({ name: m.name, amount: m.amount, message: m.message, avatar: m.avatar || undefined, source: "bynogame", kind: "manual", via: "ByNoGame" })
        }
        onTestAlert={() => {
          const name = pick(DEMO_NAMES);
          void donateRich({ name, amount: randomDonationAmount(), message: pick(DONATE_LINES), source: "test", kind: "test", via: "ByNoGame · test" });
        }}
        onReset={(seed) => reset(seed)}
        onSkipBoss={nextBoss}
      />
    </div>
  );
}
