import { Fragment, memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { prettyUrl, truncate } from "../game/data";
import type { RecentDonation } from "../game/types";
import Avatar from "./Avatar";

/** Akıcı, sabit hızlı kayan yazı (içerik değişince zıplamaz) */
function Marquee({ children, speed }: { children: ReactNode; speed: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBoxW(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let x = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const w = copyRef.current?.offsetWidth ?? 0;
      if (w > 0) {
        x += speed * dt;
        while (x >= w) x -= w;
      }
      if (trackRef.current) trackRef.current.style.transform = `translate3d(${-x}px,0,0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return (
    <div
      ref={boxRef}
      className="relative h-full min-w-0 flex-1 overflow-hidden"
      style={{ maskImage: "linear-gradient(90deg, transparent, #000 2.5%, #000 97.5%, transparent)" }}
    >
      <div ref={trackRef} className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap will-change-transform">
        <div ref={copyRef} className="flex shrink-0 items-center" style={{ minWidth: boxW }}>
          {children}
        </div>
        <div className="flex shrink-0 items-center" style={{ minWidth: boxW }} aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="px-4 text-[#c9a063]">✦</span>;
}

function Promo({ url }: { url: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold">
      <span className="text-[#ff8fab]">💖 Sen de destek ol:</span>
      <span className="text-white underline decoration-[#ff8fab] decoration-2 underline-offset-2">{prettyUrl(url)}</span>
      <span className="text-[#9ad0ff]">· İsim alanına YouTube adını yaz, profil resmin ekranda görünsün</span>
      <span className="text-[#8ce99a]">· Bağış tamamen gönüllüdür</span>
      <Sep />
    </span>
  );
}

interface Props {
  recent: RecentDonation[];
  donateUrl: string;
  showAmounts: boolean;
  /** 5 sn'de bir artan sayaç — "YENİ" rozetlerini günceller */
  tick: number;
}

function Ticker({ recent, donateUrl, showAmounts, tick }: Props) {
  const items = [...recent].reverse().slice(0, 25);
  const nowMs = tick * 5000;
  return (
    <div className="ticker absolute inset-x-0 top-0 z-[56] flex h-[34px] items-stretch">
      <div className="ticker-label">💖 BAĞIŞ YAPANLAR</div>
      <Marquee speed={42}>
        {items.length === 0 && (
          <span className="font-bold text-white/85">
            İlk destekçi sen ol! 👑 Zirvedeki taht seni bekliyor <Sep />
          </span>
        )}
        {items.map((r, i) => (
          <Fragment key={r.id}>
            {i > 0 && i % 6 === 0 && <Promo url={donateUrl} />}
            <span className="inline-flex items-center gap-2">
              {r.at && nowMs - r.at < 90_000 ? <span className="new-badge">YENİ</span> : null}
              <Avatar name={r.name} src={r.avatar} size={24} ring="#c9a063" />
              <span className="font-extrabold text-white">{r.name}</span>
              {showAmounts && <span className="font-black text-[#ffd43b]">{r.display}</span>}
              {r.message ? <span className="font-medium italic text-white/75">“{truncate(r.message, 70)}”</span> : null}
              <Sep />
            </span>
          </Fragment>
        ))}
        <Promo url={donateUrl} />
      </Marquee>
      <div className="ticker-note">✅ BAĞIŞLAR GÖNÜLLÜDÜR</div>
    </div>
  );
}

export default memo(Ticker);
