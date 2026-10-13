import { useEffect } from "react";
import { alertDuration } from "../game/data";
import type { AlertItem } from "../game/types";
import Avatar from "./Avatar";
import { Stars } from "./Castle";

let audioCtx: AudioContext | null = null;

/** Kısa, hoş bir "bağış geldi" zil sesi (dosya gerektirmez) */
function chime(big: boolean): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const notes = big ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880, 1174.66];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.6);
    });
  } catch {
    /* ignore */
  }
}

function speak(text: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text.slice(0, 220));
    u.lang = "tr-TR";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("tr"));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}

interface Props {
  alert?: AlertItem;
  startedAt: number;
  now: number;
  showAmounts: boolean;
  sound: boolean;
  tts: boolean;
}

export default function DonationAlert({ alert, startedAt, now, showAmounts, sound, tts }: Props) {
  const id = alert?.id;
  useEffect(() => {
    if (!alert) return;
    if (sound) chime(alert.amount >= 250);
    if (tts && alert.message) window.setTimeout(() => speak(`${alert.name} diyor ki: ${alert.message}`), 900);
    // yalnızca yeni bildirim geldiğinde çalışır
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alert) return null;
  const dur = alertDuration(alert);
  const elapsed = Math.max(0, now - startedAt);
  const leaving = dur - elapsed < 450;
  const remain = Math.max(0, 1 - elapsed / dur);

  return (
    <div className="pointer-events-none absolute inset-x-0 z-[58] flex justify-center" style={{ top: 40 }}>
      <div key={alert.id} className={`alert-card ${leaving ? "alert-out" : "alert-in"}`}>
        <div className="alert-shine" />
        {[8, 22, 38, 62, 78, 92].map((x, i) => (
          <span key={x} className="alert-heart" style={{ left: `${x}%`, animationDelay: `${-i * 0.45}s` }}>
            {i % 2 ? "✨" : "💖"}
          </span>
        ))}
        <div className="relative flex items-center gap-4 px-5 pb-3.5 pt-4">
          <div className="relative shrink-0">
            <Avatar name={alert.name} src={alert.avatar} size={96} ring="#ffd43b" />
            <span className="heart-pop absolute -bottom-1 -right-2 text-[30px] leading-none">💖</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-black tracking-[0.28em] text-[#ff8fab]">YENİ BAĞIŞ</span>
              <span className="rounded bg-white/12 px-1.5 py-[1px] text-[11.5px] font-bold text-white/85">{alert.via}</span>
              {showAmounts && (
                <span className="ml-auto rounded-full bg-[#ffd43b] px-3 py-0.5 text-[17px] font-black text-[#1b1208] shadow">{alert.display}</span>
              )}
            </div>
            <div className="ol truncate text-[34px] font-black leading-tight text-[#ffd43b]">{alert.name}</div>
            {alert.message ? (
              <div className="ol-sm line-clamp-3 break-words text-[19px] font-semibold leading-snug text-white">“{alert.message}”</div>
            ) : (
              <div className="ol-sm text-[17px] font-semibold text-white/75">Kaleye destek verdi! 💪</div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-[14px] font-bold" style={{ color: alert.clsColor }}>
              ⚔️ {alert.note} <Stars n={alert.stars} />
            </div>
          </div>
        </div>
        <div className="h-[5px] w-full bg-black/45">
          <div className="h-full bg-gradient-to-r from-[#ff8fab] via-[#ffd43b] to-[#ff8fab]" style={{ width: `${remain * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
