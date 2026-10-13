import type { Effect } from "../game/types";
import Sprite from "./Sprite";

export default function Effects({ effects }: { effects: Effect[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {effects.map((e) => {
        if (e.kind === "lunge") {
          return (
            <div key={e.id} className="fx-lunge absolute" style={{ left: e.x, top: e.y }}>
              <div style={{ transform: "translate(-50%, -100%)" }}>
                <Sprite sprite={e.sprite ?? "rookie"} height={e.size ?? 88} />
              </div>
            </div>
          );
        }
        if (e.kind === "hit" || e.kind === "bossHit") {
          return (
            <div
              key={e.id}
              className="fx-hit absolute leading-none"
              style={{ left: e.x, top: e.y, fontSize: e.size ?? 54, filter: `drop-shadow(0 0 10px ${e.kind === "bossHit" ? "#ff4d4d" : "#7df9ff"})` }}
            >
              {e.icon}
            </div>
          );
        }
        return (
          <div key={e.id} className="fx-num ol absolute text-center font-black leading-none" style={{ left: e.x, top: e.y, color: e.color, fontSize: e.size ?? 26 }}>
            {e.kind === "crit" && <div className="mb-0.5 text-[15px] tracking-widest text-[#ffd43b]">KRİTİK!</div>}
            {e.text}
          </div>
        );
      })}
    </div>
  );
}
