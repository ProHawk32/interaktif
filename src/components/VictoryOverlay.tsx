import { MEDAL, VICTORY_MS, bossFor, bossMaxHp, channelLink, classFor, formatNum } from "../game/data";
import type { Victory } from "../game/types";
import Avatar from "./Avatar";
import Sprite from "./Sprite";

interface Props {
  victory: Victory;
  now: number;
  hpMult: number;
  pending: number;
  showSkip: boolean;
  onSkip: () => void;
}

export default function VictoryOverlay({ victory, now, hpMult, pending, showSkip, onSkip }: Props) {
  const remainMs = Math.max(0, victory.at + VICTORY_MS - now);
  const remain = Math.ceil(remainMs / 1000);
  const frac = remainMs / VICTORY_MS;
  const next = bossFor(victory.bossIndex + 1);
  const nextHp = bossMaxHp(victory.bossIndex + 1, hpMult);
  const R = 38;
  const C = 2 * Math.PI * R;
  const order = [victory.top[1], victory.top[0], victory.top[2]];

  return (
    <div className="fade-in absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="panel pop-in relative w-[760px] px-8 pb-6 pt-5 text-center" style={{ boxShadow: "0 0 0 3px #2a1d12, 0 0 80px rgba(255,212,59,.35)" }}>
        <div className="text-[14px] font-extrabold tracking-[0.35em] text-[#8ce99a]">🏆 ZAFER! 🏆</div>
        <h2 className="font-title ol text-[44px] font-black leading-tight text-[#ffd43b]">PATRON YENİLDİ!</h2>
        <div className="text-[18px] font-bold text-white">
          {victory.bossName} düştü · Son vuruş: <span className="text-[#7df9ff]">{victory.lastHit}</span>
        </div>

        <div className="mt-4 flex items-end justify-center gap-5">
          {order.map((d, i) => {
            const place = i === 1 ? 1 : i === 0 ? 2 : 3;
            if (!d) return <div key={place} className="w-44" />;
            const c = classFor(d.total);
            return (
              <div key={d.id} className="flex w-44 flex-col items-center">
                <Sprite sprite={c.sprite} height={place === 1 ? 112 : 86} aura={c.aura} special={c.special} />
                <div className="mt-1 flex max-w-full items-center gap-1.5">
                  <Avatar name={d.name} src={d.avatar} size={place === 1 ? 34 : 28} ring={MEDAL[place - 1]} />
                  <a href={channelLink(d)} target="_blank" rel="noopener noreferrer" className="truncate text-[16px] font-black text-white hover:text-[#ffd43b] hover:underline">
                    {d.name}
                  </a>
                </div>
                <div className="text-[13px] font-bold" style={{ color: c.color }}>
                  {c.title}
                </div>
                <div
                  className="mt-1 flex w-full items-start justify-center rounded-t-md pt-1 text-[14px] font-black text-[#1b1208]"
                  style={{ height: place === 1 ? 58 : place === 2 ? 42 : 30, background: `linear-gradient(180deg, ${MEDAL[place - 1]}, ${MEDAL[place - 1]}99)` }}
                >
                  {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"} {formatNum(d.damage)} hasar
                </div>
              </div>
            );
          })}
        </div>

        {victory.mvp && (
          <div className="mt-3 text-[15px] font-bold text-white">
            ⚔️ En çok hasar (MVP): <span className="text-[#7df9ff]">{victory.mvp.name}</span> — {formatNum(victory.mvp.damage)}
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-5 rounded-lg border border-[#3b2a1f] bg-black/40 px-4 py-3">
          <div className="relative h-[92px] w-[92px] shrink-0">
            <svg width="92" height="92" className="-rotate-90">
              <circle r={R} cx="46" cy="46" stroke="#3b2a1f" strokeWidth="8" fill="none" />
              <circle
                r={R}
                cx="46"
                cy="46"
                stroke={next.color}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                style={{ transition: "stroke-dashoffset .2s linear" }}
              />
            </svg>
            <div className="ol absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-[30px] font-black text-white">{remain}</span>
              <span className="text-[10px] font-bold text-white/70">SANİYE</span>
            </div>
          </div>
          <div className="relative shrink-0">
            <Sprite sprite={next.sprite} height={84} filter={`brightness(0) drop-shadow(0 0 8px ${next.color})`} />
            <div className="ol absolute inset-0 flex items-center justify-center text-[30px] font-black text-white/90">?</div>
          </div>
          <div className="min-w-0 text-left">
            <div className="text-[12px] font-extrabold tracking-[0.2em] text-white/70">SIRADAKİ PATRON</div>
            <div className="text-[24px] font-black leading-tight" style={{ color: next.color }}>
              {next.name} {next.final && <span className="final-badge align-middle">SON PATRON</span>}
            </div>
            <div className="text-[14px] text-white/85">
              {next.title} · <b>{formatNum(nextHp)} HP</b>
            </div>
            <div className="text-[13px] font-semibold text-white/70">{remain} saniye içinde otomatik başlayacak</div>
            {pending > 0 && <div className="text-[13px] font-bold text-[#ffd43b]">⚡ Biriken bağış hasarı: {formatNum(pending)}</div>}
          </div>
        </div>

        {showSkip && (
          <button onClick={onSkip} className="btn btn-red mt-4">
            ⏩ Hemen Başlat
          </button>
        )}
      </div>
    </div>
  );
}
