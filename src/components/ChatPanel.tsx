import { useEffect, useRef, useState } from "react";
import { BOSSES, CLASSES, DMG_PER_TL, FLOORS, MEDAL, channelLink, classFor, formatNum, prettyUrl, starsFor, textOn } from "../game/data";
import type { ChatMsg, Donor } from "../game/types";
import Avatar from "./Avatar";
import { Stars } from "./Castle";

type Tab = "chat" | "rank" | "log" | "help";

const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "💬 Sohbet" },
  { id: "rank", label: "🏰 Sıralama" },
  { id: "log", label: "⚔️ Savaş" },
  { id: "help", label: "❓ Nasıl?" },
];

const HIDDEN_DONATION_COLOR = "#c2255c";

interface Props {
  chat: ChatMsg[];
  log: ChatMsg[];
  donors: Donor[];
  showInput: boolean;
  onSend: (text: string) => void;
  mode: { label: string; color: string };
  showAmounts: boolean;
  donateUrl: string;
}

export default function ChatPanel({ chat, log, donors, showInput, onSend, mode, showAmounts, donateUrl }: Props) {
  const [tab, setTab] = useState<Tab>("chat");
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el && (tab === "chat" || tab === "log")) el.scrollTop = el.scrollHeight;
  }, [chat, log, tab]);

  return (
    <div className="panel absolute z-40 flex flex-col overflow-hidden" style={{ left: 10, top: 604, width: 474, height: 180 }}>
      <div className="flex items-center gap-1 border-b border-[#3b2a1f] bg-black/35 px-1.5 py-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-2 py-0.5 text-[12.5px] font-bold transition ${tab === t.id ? "bg-[#c9a063] text-[#1b1208]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto truncate pr-1 text-[12px] font-extrabold" style={{ color: mode.color }}>
          {mode.label}
        </span>
      </div>

      <div ref={listRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto px-2 py-1 text-[14px] leading-[1.32]">
        {tab === "chat" && chat.map((m) => <ChatLine key={m.id} m={m} showAmounts={showAmounts} />)}
        {tab === "log" &&
          (log.length === 0 ? (
            <div className="py-2 text-white/50">Henüz vuruş yok…</div>
          ) : (
            log.map((m) => (
              <div key={m.id} className="py-[1px]">
                <span className="font-bold" style={{ color: m.kind === "donate" && !showAmounts ? "#ff8fab" : m.color }}>
                  {m.kind === "donate" ? "💖 " : ""}
                  {m.user}
                </span>{" "}
                {m.kind === "donate" && showAmounts && m.display ? <b className="text-[#ffd43b]">{m.display} </b> : null}
                <span className="text-white/90">{m.text}</span>
              </div>
            ))
          ))}
        {tab === "rank" &&
          (donors.length === 0 ? (
            <div className="py-2 text-white/50">Kale boş — ilk destekçiyi bekliyoruz!</div>
          ) : (
            donors.slice(0, 50).map((d, i) => {
              const c = classFor(d.total);
              const top = i < 3;
              return (
                <div key={d.id} className="flex items-center gap-2 py-[2px]">
                  <span className="w-6 shrink-0 text-right font-black" style={{ color: top ? MEDAL[i] : "#adb5bd" }}>
                    {i + 1}.
                  </span>
                  <Avatar name={d.name} src={d.avatar} size={20} ring={top ? MEDAL[i] : "transparent"} />
                  {top ? (
                    <a href={channelLink(d)} target="_blank" rel="noopener noreferrer" className="truncate font-bold text-white hover:text-[#ffd43b] hover:underline">
                      {d.name} ↗
                    </a>
                  ) : (
                    <span className="truncate font-semibold">{d.name}</span>
                  )}
                  <span className="shrink-0 text-[12.5px] font-semibold" style={{ color: c.color }}>
                    {c.short} <Stars n={starsFor(d.total)} />
                  </span>
                  <span className="ml-auto shrink-0 text-[12px] text-white/60">{formatNum(d.damage)} hasar</span>
                </div>
              );
            })
          ))}
        {tab === "help" && <Help donateUrl={donateUrl} />}
      </div>

      {showInput && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend(text);
            setText("");
          }}
          className="flex border-t border-[#3b2a1f]"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Test: mesaj, !bağış, !bağış 50, !saldır, !sıra"
            className="h-8 min-w-0 flex-1 bg-black/40 px-2 text-[14px] text-white outline-none placeholder:text-white/35"
          />
          <button type="submit" className="bg-[#c9a063] px-3 text-[13px] font-extrabold text-[#1b1208] hover:bg-[#ffd43b]">
            GÖNDER
          </button>
        </form>
      )}
    </div>
  );
}

function ChatLine({ m, showAmounts }: { m: ChatMsg; showAmounts: boolean }) {
  if (m.kind === "donate") {
    const bg = showAmounts ? m.color : HIDDEN_DONATION_COLOR;
    const fg = textOn(bg);
    return (
      <div className="my-1 overflow-hidden rounded-md shadow-md" style={{ background: bg, color: fg }}>
        <div className="flex items-center gap-2 px-2 py-1" style={{ background: "rgba(0,0,0,.14)" }}>
          <Avatar name={m.user} src={m.avatar} size={22} ring="rgba(255,255,255,.75)" />
          <span className="truncate font-bold">{m.user}</span>
          <span className="ml-auto shrink-0 font-black">{showAmounts ? m.display : "💖 Bağış"}</span>
        </div>
        {m.text && <div className="px-2 py-1 font-semibold">{m.text}</div>}
      </div>
    );
  }
  if (m.kind === "system") {
    return (
      <div className="my-0.5 font-semibold" style={{ color: m.color }}>
        {m.text}
      </div>
    );
  }
  if (m.kind === "boss") {
    return (
      <div className="my-0.5 rounded bg-[#ff6b6b]/12 px-1 font-semibold" style={{ color: m.color }}>
        👹 <b>{m.user}:</b> {m.text}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-1.5 py-[1px]">
      {m.avatar && <Avatar name={m.user} src={m.avatar} size={18} ring="transparent" className="mt-[1px]" />}
      <div className="min-w-0 break-words">
        <span className="font-bold" style={{ color: m.kind === "owner" ? "#ffd43b" : m.color }}>
          {m.user}
        </span>
        {m.badge && <span className="ml-1 rounded bg-white/15 px-1 align-middle text-[10px] font-bold">{m.badge}</span>}
        <span className="text-white">: {m.text}</span>
      </div>
    </div>
  );
}

function Help({ donateUrl }: { donateUrl: string }) {
  return (
    <div className="space-y-1.5 py-1 text-[13.5px] text-white/90">
      <p className="rounded bg-[#2b8a3e]/25 px-1.5 py-1 font-semibold text-[#d3f9d8]">
        ℹ️ Bağışlar tamamen gönüllülük esasına dayanır. Oyunu izlemek ve sohbete katılmak ücretsizdir; kimse bağış yapmaya zorlanmaz. 18 yaşından küçüksen ailenin izni olmadan bağış yapma.
      </p>
      <p>
        <b className="text-[#ff8fab]">💖 Nasıl bağış yapılır?</b> <b>{prettyUrl(donateUrl)}</b> adresine gir (QR kodu okut, panele tıkla ya da chat'e <b>!bağış</b> yaz). "Destekleyen isim" alanına <b>YouTube adını</b> yazarsan profil resmin ve kanalın ekranda görünür. Mesajın üstten bildirimde çıkar.
      </p>
      <p>
        <b className="text-[#ffd43b]">⚔️ Bağış = Saldırı:</b> Her bağış karakterini anında patrona saldırtır (1 TL ≈ {DMG_PER_TL} hasar, %12 kritik). YouTube Super Chat / üyelikler de sayılır.
      </p>
      <p>
        <b className="text-[#ffd43b]">🏰 Katlar = Sıralama:</b> {FLOORS.map((f) => `${f.name} (${f.label})`).join(" · ")}
      </p>
      <p>
        <b className="text-[#ffd43b]">🧬 Karakter evrimi</b> (toplam desteğe göre): {CLASSES.map((c) => `${c.short} ${c.min}₺`).join(" → ")}. ★ yıldızlar bir sonraki evrime yakınlığı gösterir.
      </p>
      <p>
        <b className="text-[#ffd43b]">⌨️ Komutlar:</b> !bağış (link) · !saldır (kaledekiler, 4 sn bekleme) · !sıra
      </p>
      <p>
        <b className="text-[#ffd43b]">👹 Patronlar:</b> {BOSSES.map((b, i) => `${i + 1}. ${b.name} (${formatNum(b.baseHp)} HP)`).join(" · ")}
      </p>
      <p>
        <b className="text-[#ffd43b]">💀 Yere düşen</b> 20 sn sonra kalkar. Patron yenilince 60 sn sonra sıradaki otomatik gelir.
      </p>
    </div>
  );
}
