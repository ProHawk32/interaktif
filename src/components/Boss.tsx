import type { CSSProperties } from "react";
import { BOSSES, bossCycle, bossFor, formatNum, type BossParticles } from "../game/data";
import { bossBox } from "../game/layout";
import { getSprite } from "../game/sprites";
import type { GameState } from "../game/types";

interface ParticleCfg {
  icon: string;
  anim: "rise" | "fall" | "drift";
  count: number;
  size: [number, number];
  dur: [number, number];
  color?: string;
  blur?: number;
}

const PARTICLES: Record<BossParticles, ParticleCfg> = {
  poison: { icon: "", anim: "rise", count: 10, size: [18, 42], dur: [3, 5], color: "#94d82d", blur: 6 },
  embers: { icon: "", anim: "rise", count: 16, size: [4, 9], dur: [2.2, 4], color: "#ff4d4d" },
  skulls: { icon: "💀", anim: "drift", count: 6, size: [18, 30], dur: [3, 5] },
  snow: { icon: "❄️", anim: "fall", count: 12, size: [12, 24], dur: [3, 6] },
  fire: { icon: "🔥", anim: "rise", count: 12, size: [18, 36], dur: [2, 3.6] },
};

export default function Boss({ state, now }: { state: GameState; now: number }) {
  const def = bossFor(state.bossIndex);
  const box = bossBox(state.bossIndex);
  const sprite = getSprite(def.sprite);
  const hurt = state.bossHurtUntil > now;
  const attacking = state.bossAttackUntil > now;
  const dead = !!state.victory;
  const spawning = state.bossSpawnAt > 0 && now - state.bossSpawnAt < 1200;
  const pct = state.bossMax > 0 ? state.bossHp / state.bossMax : 0;
  const order = (state.bossIndex % BOSSES.length) + 1;
  const cycle = bossCycle(state.bossIndex);

  return (
    <>
      {/* Patron bilgisi + HP */}
      <div className="absolute z-30" style={{ left: 12, top: 88, width: 568 }}>
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="ol truncate text-[26px] font-black leading-none text-white">{def.name}</span>
            <span className="ol-sm text-[15px] font-extrabold" style={{ color: def.color }}>
              Lv.{state.bossIndex + 1}
            </span>
            {def.final && <span className="final-badge">SON PATRON</span>}
          </div>
          <span className="ol-sm shrink-0 text-[13px] font-bold text-white/85">
            PATRON {order}/5{cycle > 0 ? ` · DÖNGÜ ${cycle + 1}` : ""}
          </span>
        </div>
        <div className="ol-sm mt-0.5 text-[13px] font-semibold" style={{ color: def.color }}>
          {def.title}
        </div>
        <BossHpBar hp={state.bossHp} max={state.bossMax} color={def.color} />
        {!dead && pct < 0.15 && (
          <div className="ol-sm mt-1 text-[15px] font-black text-[#ff6b6b]" style={{ animation: "blink .8s steps(2) infinite" }}>
            ⚠ PATRON ÖLMEK ÜZERE!
          </div>
        )}
      </div>

      {/* Patron sprite */}
      <div className="pointer-events-none absolute z-[8]" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
        <div className="absolute rounded-[50%]" style={{ left: "4%", right: "4%", bottom: -14, height: 36, background: "radial-gradient(closest-side, rgba(0,0,0,.8), transparent)" }} />
        {!dead && (
          <div
            className="absolute"
            style={{ inset: "-10% -16% 0", background: `radial-gradient(closest-side, ${def.color}50, transparent 70%)`, animation: "aura-pulse 2.4s ease-in-out infinite" }}
          />
        )}
        <div key={state.bossIndex} className={`absolute inset-0 ${dead ? "boss-die" : spawning ? "boss-spawn" : ""}`}>
          <div className={`h-full w-full ${dead ? "" : "boss-" + def.idle}`}>
            <div className={`h-full w-full ${hurt ? "boss-hurt" : ""}`} style={{ transform: attacking ? "translateX(28px) scale(1.05)" : undefined, transition: "transform .18s ease-out" }}>
              <img
                src={sprite.url}
                alt={def.name}
                draggable={false}
                className="h-full w-full object-contain object-bottom"
                style={{
                  filter: hurt
                    ? "brightness(2.2) sepia(1) saturate(5) hue-rotate(-35deg) drop-shadow(0 0 2px #000)"
                    : `drop-shadow(0 0 2px rgba(0,0,0,.95)) drop-shadow(0 0 22px ${def.color}88)`,
                }}
              />
            </div>
          </div>
        </div>
        {!dead && <Particles kind={def.particles} color={def.color} />}
      </div>
    </>
  );
}

function BossHpBar({ hp, max, color }: { hp: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  return (
    <div
      className="relative mt-1 h-[26px] w-full overflow-hidden rounded-md border-2 border-black"
      style={{ background: "#1a0b0b", boxShadow: `0 0 0 2px #c9a063, 0 0 14px ${color}55, 0 4px 10px rgba(0,0,0,.6)` }}
    >
      <div className="absolute inset-y-0 left-0 bg-white/70 transition-[width] delay-200 duration-700" style={{ width: `${pct * 100}%` }} />
      <div className="absolute inset-y-0 left-0 transition-[width] duration-150" style={{ width: `${pct * 100}%`, background: "linear-gradient(180deg, #ff6b6b, #c92a2a 60%, #861515)" }} />
      <div className="absolute inset-x-0 top-0 h-[40%] bg-white/15" />
      {[0.25, 0.5, 0.75].map((t) => (
        <div key={t} className="absolute inset-y-0 w-[2px] bg-black/40" style={{ left: `${t * 100}%` }} />
      ))}
      <div className="ol-sm absolute inset-0 flex items-center justify-center gap-2 text-[15px] font-black text-white">
        <span>
          {formatNum(hp)} / {formatNum(max)} HP
        </span>
        <span className="text-[13px] text-white/80">%{(pct * 100).toFixed(pct < 0.1 ? 1 : 0)}</span>
      </div>
    </div>
  );
}

function Particles({ kind, color }: { kind: BossParticles; color: string }) {
  const cfg = PARTICLES[kind];
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: cfg.count }, (_, i) => {
        const x = (i * 37 + 11) % 100;
        const y = (i * 53 + 7) % 100;
        const size = cfg.size[0] + (((i * 29) % 100) / 100) * (cfg.size[1] - cfg.size[0]);
        const dur = cfg.dur[0] + (((i * 17) % 10) / 10) * (cfg.dur[1] - cfg.dur[0]);
        const style: CSSProperties = { left: `${x}%`, fontSize: size, animationDuration: `${dur}s`, animationDelay: `${-((i * 0.73) % dur)}s` };
        if (cfg.anim === "rise") style.bottom = `${y % 40}%`;
        else if (cfg.anim === "fall") style.top = `${(y % 30) - 10}%`;
        else style.top = `${y % 80}%`;
        if (cfg.icon) {
          return (
            <span key={i} className={`absolute leading-none p-${cfg.anim}`} style={style}>
              {cfg.icon}
            </span>
          );
        }
        const c = cfg.color ?? color;
        return (
          <span
            key={i}
            className={`absolute rounded-full p-${cfg.anim}`}
            style={{ ...style, width: size, height: size, background: c, boxShadow: `0 0 ${size}px ${c}`, filter: cfg.blur ? `blur(${cfg.blur}px)` : undefined }}
          />
        );
      })}
    </div>
  );
}
