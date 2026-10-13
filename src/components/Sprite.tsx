import type { CSSProperties } from "react";
import { getSprite } from "../game/sprites";

interface Props {
  sprite: string;
  height: number;
  width?: number;
  down?: boolean;
  aura?: string;
  special?: "legend" | "immortal";
  className?: string;
  style?: CSSProperties;
  filter?: string;
}

const OUTLINE = "drop-shadow(0 0 1.5px rgba(0,0,0,.95)) drop-shadow(0 3px 3px rgba(0,0,0,.55))";

/** Arka planı canvas ile temizlenmiş, kırpılmış şeffaf sprite */
export default function Sprite({ sprite, height, width, down, aura, special, className = "", style, filter }: Props) {
  const s = getSprite(sprite);
  const w = width ?? height * s.aspect;
  return (
    <div className={`pointer-events-none relative ${className}`} style={{ width: w, height, ...style }}>
      {special && !down && <div className={special === "immortal" ? "rainbow-aura" : "legend-aura"} />}
      {aura && !down && (
        <div
          className="aura absolute rounded-full"
          style={{ left: "-22%", right: "-22%", top: "-8%", bottom: "-4%", background: `radial-gradient(closest-side, ${aura}cc, ${aura}55 45%, transparent 75%)` }}
        />
      )}
      <img
        src={s.url}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain object-bottom"
        style={{ filter: down ? `grayscale(1) brightness(.5) ${OUTLINE}` : filter ?? OUTLINE, opacity: down ? 0.75 : 1 }}
      />
      {special === "immortal" && !down && (
        <>
          <span className="sparkle" style={{ left: "8%", top: "12%" }}>✦</span>
          <span className="sparkle" style={{ right: "6%", top: "30%", animationDelay: "-.6s" }}>✦</span>
          <span className="sparkle" style={{ left: "20%", bottom: "18%", animationDelay: "-1.1s" }}>✦</span>
        </>
      )}
    </div>
  );
}
