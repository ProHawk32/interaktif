import { FLOORS, MEDAL, channelLink, classFor, maxHpFor, starsFor, type Floor } from "../game/data";
import { computeLayout, type Placement } from "../game/layout";
import type { Donor } from "../game/types";
import Avatar from "./Avatar";
import HpBar from "./HpBar";
import Sprite from "./Sprite";

export function Stars({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap tracking-[-1px] text-[#ffd43b]">
      {"★".repeat(n)}
      <span className="opacity-25">{"★".repeat(Math.max(0, 3 - n))}</span>
    </span>
  );
}

export function YtIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 28 20" className="shrink-0">
      <rect width="28" height="20" rx="5" fill="#ff0000" />
      <path d="M11 5.5v9l8-4.5z" fill="#fff" />
    </svg>
  );
}

export default function Castle({ donors }: { donors: Donor[] }) {
  const { placed, overflow } = computeLayout(donors);
  const top3 = placed.filter((p) => p.rank <= 3);
  const rest = placed.filter((p) => p.rank > 3);
  return (
    <>
      {FLOORS.map((f) => (
        <FloorView key={f.idx} f={f} overflow={overflow[f.idx]} />
      ))}
      {placed.map((p) => (
        <Character key={p.donor.id} p={p} />
      ))}
      {FLOORS.map((f) => (
        <div key={"rail" + f.idx} className="balcony-rail pointer-events-none absolute z-[12]" style={{ left: f.x0 - 30, right: 0, top: f.y - 15, height: 17 }} />
      ))}
      {rest.map((p) => (
        <NamePlate key={"np" + p.donor.id} p={p} />
      ))}
      {top3.map((p) => (
        <TopCard key={"tc" + p.donor.id} p={p} />
      ))}
      {placed.length === 0 && <EmptyThrone />}
    </>
  );
}

function FloorView({ f, overflow }: { f: Floor; overflow: number }) {
  return (
    <>
      <div className="balcony-slab absolute z-[5]" style={{ left: f.x0 - 30, right: 0, top: f.y - 4, height: 24 }} />
      <div className="floor-label absolute z-[15]" style={{ right: 10, top: f.y + 1 }}>
        <span className="text-white">{f.name}</span>
        <span className="mx-1.5 text-[#c9a063]">·</span>
        <span className="text-[#ffd43b]">{f.label}</span>
      </div>
      {overflow > 0 && (
        <div className="ol-sm absolute z-[15] rounded-md border border-[#c9a063]/60 bg-black/70 px-2 py-0.5 text-[14px] font-bold text-white" style={{ left: f.slots[f.slots.length - 1] + 62, top: f.y - 44 }}>
          +{overflow} kişi
        </div>
      )}
    </>
  );
}

function Character({ p }: { p: Placement }) {
  const d = p.donor;
  const c = classFor(d.total);
  const down = d.downUntil !== null;
  return (
    <div className="absolute z-10" style={{ left: p.x, top: p.y, transition: "left .8s ease, top .8s ease" }}>
      <div className="relative" style={{ transform: "translate(-50%, -100%)" }}>
        {p.rank === 1 && !down && (
          <div className="crown-abs absolute left-1/2 text-[34px] leading-none" style={{ top: -30 }}>
            👑
          </div>
        )}
        <div className={down ? "" : "bob"} style={{ animationDelay: `${-((p.slot * 0.31 + p.floor.idx * 0.17) % 1.8)}s` }}>
          <Sprite sprite={c.sprite} height={p.h} width={p.w} down={down} aura={c.aura} special={c.special} />
        </div>
        {down && <div className="ol-sm absolute inset-x-0 bottom-[35%] text-center text-[15px] font-black text-[#ff8787]">💀 YERDE</div>}
      </div>
    </div>
  );
}

function NamePlate({ p }: { p: Placement }) {
  const d = p.donor;
  const c = classFor(d.total);
  return (
    <div
      className="pointer-events-none absolute z-[15] flex flex-col items-center"
      style={{ left: p.x, top: p.y - p.h - 4, transform: "translate(-50%, -100%)", transition: "left .8s ease, top .8s ease" }}
      title={`${p.rank}. sıra · ${c.title}`}
    >
      <div className="ol-sm flex max-w-[126px] items-center gap-1 whitespace-nowrap text-[14px] font-bold leading-none">
        <span className="text-[#ffd43b]">{p.rank}.</span>
        <span className="truncate text-white">{d.name}</span>
      </div>
      <div className="mt-[3px] flex items-center gap-1">
        <HpBar hp={d.hp} max={maxHpFor(d.total)} width={62} height={7} />
        <span className="text-[10px] leading-none">
          <Stars n={starsFor(d.total)} />
        </span>
      </div>
    </div>
  );
}

function TopCard({ p }: { p: Placement }) {
  const d = p.donor;
  const c = classFor(d.total);
  const medal = MEDAL[p.rank - 1];
  const left = p.x + p.w / 2 + 8;

  if (p.rank === 1) {
    return (
      <div className="panel champion-card absolute z-20 flex flex-col items-center px-3 pb-2.5 pt-3 text-center" style={{ left, right: 10, top: 44 }}>
        <div className="relative">
          <div className="crown-float absolute -top-[20px] left-0 right-0 text-center text-[24px] leading-none">👑</div>
          <Avatar name={d.name} src={d.avatar} size={64} ring={medal} />
          <div className="rank-badge" style={{ background: medal }}>
            1
          </div>
        </div>
        <div className="mt-1.5 text-[12px] font-extrabold tracking-[0.16em] text-[#ffd43b]">BAĞIŞ ŞAMPİYONU</div>
        <a
          href={channelLink(d)}
          target="_blank"
          rel="noopener noreferrer"
          title="YouTube kanalına git"
          className="ol-sm flex max-w-full items-center gap-1.5 text-[20px] font-black leading-tight text-white transition hover:text-[#ffd43b] hover:underline"
        >
          <span className="truncate">{d.name}</span>
          <YtIcon size={18} />
        </a>
        <div className="text-[14px] font-bold leading-tight" style={{ color: c.color }}>
          {c.title} <Stars n={starsFor(d.total)} />
        </div>
        <div className="mt-1.5">
          <HpBar hp={d.hp} max={maxHpFor(d.total)} width={196} height={14} label />
        </div>
      </div>
    );
  }

  return (
    <div className="panel absolute z-20 flex items-center gap-2.5 px-2.5 py-2" style={{ left, top: p.y - 106, width: 238 }}>
      <div className="relative">
        <Avatar name={d.name} src={d.avatar} size={52} ring={medal} />
        <div className="rank-badge" style={{ background: medal }}>
          {p.rank}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold tracking-[0.12em]" style={{ color: medal }}>
          {p.rank}. SIRADAKİ
        </div>
        <a
          href={channelLink(d)}
          target="_blank"
          rel="noopener noreferrer"
          title="YouTube kanalına git"
          className="ol-sm flex items-center gap-1 text-[17px] font-black leading-tight text-white transition hover:text-[#ffd43b] hover:underline"
        >
          <span className="truncate">{d.name}</span>
          <YtIcon size={15} />
        </a>
        <div className="truncate text-[13px] font-bold leading-tight" style={{ color: c.color }}>
          {c.title} <Stars n={starsFor(d.total)} />
        </div>
        <div className="mt-1">
          <HpBar hp={d.hp} max={maxHpFor(d.total)} width={152} height={9} />
        </div>
      </div>
    </div>
  );
}

function EmptyThrone() {
  const f = FLOORS[0];
  return (
    <div className="panel absolute z-20 flex flex-col items-center px-4 py-4 text-center" style={{ left: f.slots[0] - 40, right: 10, top: 56 }}>
      <div className="crown-float text-[38px] leading-none">👑</div>
      <div className="mt-1 text-[14px] font-extrabold tracking-[0.15em] text-[#ffd43b]">ZİRVE BOŞ!</div>
      <div className="mt-1 text-[16px] font-bold text-white">İlk Super Chat'i atan kaleyi ele geçirir</div>
    </div>
  );
}
