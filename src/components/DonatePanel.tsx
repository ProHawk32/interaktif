import { QRCodeSVG } from "qrcode.react";
import { formatTL, fullUrl, prettyUrl } from "../game/data";

interface Props {
  total: number;
  goal: number;
  donateUrl: string;
  notice: string;
  ctaActive: boolean;
  ctaBy: string;
}

/** Bağış hedefi + ByNoGame "Bağış Yap" butonu + QR + gönüllülük bilgilendirmesi */
export default function DonatePanel({ total, goal, donateUrl, notice, ctaActive, ctaBy }: Props) {
  const g = Math.max(1, goal);
  const stage = Math.floor(total / g);
  const target = (stage + 1) * g;
  const pct = (total - stage * g) / g;
  const url = fullUrl(donateUrl);

  return (
    <div
      className={`panel absolute z-30 flex flex-col items-center gap-1 px-3 pb-2 pt-1.5 text-center ${ctaActive ? "cta-pulse" : ""}`}
      style={{ left: 598, top: 42, width: 236 }}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-[11.5px] font-extrabold tracking-[0.08em] text-[#ffd43b]">💰 BAĞIŞ HEDEFİ</span>
        <span className="rounded bg-[#ffd43b]/15 px-1.5 text-[11px] font-bold text-[#ffd43b]">
          {stage > 0 ? `✓${stage} · ` : ""}HEDEF #{stage + 1}
        </span>
      </div>
      <div className="relative h-[22px] w-full overflow-hidden rounded-full border-2 border-black" style={{ boxShadow: "0 0 0 1.5px #c9a063", background: "#1a120c" }}>
        <div className="donation-fill h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, pct * 100)}%` }} />
        <div className="ol-sm absolute inset-0 flex items-center justify-center text-[12.5px] font-black text-white">
          {formatTL(total)} / {formatTL(target)}
        </div>
      </div>

      <a href={url} target="_blank" rel="noopener noreferrer" className="donate-btn mt-1" title="ByNoGame bağış sayfasını aç">
        💖 BAĞIŞ YAP
      </a>
      <a href={url} target="_blank" rel="noopener noreferrer" className="qr-wrap" title="Telefonla okut → bağış sayfası">
        <QRCodeSVG value={url} size={86} level="M" marginSize={2} bgColor="#ffffff" fgColor="#14100c" />
      </a>
      <div className="ol-sm text-[14px] font-black leading-tight text-white">{prettyUrl(url)}</div>
      {ctaActive && ctaBy ? (
        <div className="cta-call w-full truncate rounded-md bg-[#ff8fab]/20 px-1 py-0.5 text-[12px] font-extrabold leading-tight text-[#ffc9d9]">
          📢 {ctaBy} bağış linkini istedi!
        </div>
      ) : (
        <div className="text-[12px] font-semibold leading-tight text-white/80">
          Chat'e <b className="text-[#ff8fab]">!bağış</b> yaz 💬
        </div>
      )}
      <div className="notice-box">ℹ️ {notice}</div>
    </div>
  );
}
