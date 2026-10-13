import { formatNum } from "../game/data";

interface Props {
  hp: number;
  max: number;
  width: number;
  height?: number;
  label?: boolean;
}

export default function HpBar({ hp, max, width, height = 8, label = false }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const c = pct > 0.5 ? "#40c057" : pct > 0.25 ? "#fab005" : "#fa5252";
  return (
    <div className="relative overflow-hidden rounded-[3px]" style={{ width, height, background: "#1a0f0c", border: "1.5px solid #000", boxShadow: "0 0 0 1px #6b4a2a" }}>
      <div className="h-full transition-[width] duration-300" style={{ width: `${pct * 100}%`, background: c }} />
      <div className="absolute inset-x-0 top-0 h-[40%] bg-white/25" />
      {label && (
        <div className="ol-sm absolute inset-0 flex items-center justify-center font-bold leading-none text-white" style={{ fontSize: Math.max(10, height - 2) }}>
          {formatNum(hp)} / {formatNum(max)} HP
        </div>
      )}
    </div>
  );
}
