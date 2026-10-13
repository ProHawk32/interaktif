import { useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_DONATE_URL, DEFAULT_NOTICE, fullUrl } from "../game/data";
import type { LinkState, LinkStatus } from "../game/donations";
import { obsUrl, type Settings } from "../game/settings";
import type { YTInfo, YTStatus } from "../game/youtube";

export interface ManualDonation {
  name: string;
  amount: number;
  message: string;
  avatar: string;
}

export type LinkKind = "sl" | "se";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  yt: { status: YTStatus; error: string; info: YTInfo };
  sl: LinkState;
  se: LinkState;
  onConnect: (fresh: boolean) => void;
  onDisconnect: () => void;
  onLinkConnect: (kind: LinkKind, fresh: boolean) => void;
  onLinkDisconnect: (kind: LinkKind) => void;
  onManualDonate: (d: ManualDonation) => void;
  onTestAlert: () => void;
  onReset: (seed: boolean) => void;
  onSkipBoss: () => void;
}

const YT_STATUS: Record<YTStatus, [string, string]> = {
  idle: ["Bağlı değil", "#adb5bd"],
  connecting: ["Bağlanıyor…", "#ffd43b"],
  live: ["CANLI · Sohbet ve Super Chat'ler okunuyor", "#51cf66"],
  error: ["Hata", "#ff6b6b"],
  ended: ["Yayın / sohbet sona erdi", "#ff922b"],
};

const LINK_STATUS: Record<LinkStatus, [string, string]> = {
  idle: ["Bağlı değil", "#adb5bd"],
  connecting: ["Bağlanıyor…", "#ffd43b"],
  live: ["CANLI · ByNoGame bağışları anlık alınıyor", "#51cf66"],
  error: ["Hata", "#ff6b6b"],
};

function Section({ title, children, accent = "#ffd43b" }: { title: string; children: ReactNode; accent?: string }) {
  return (
    <section className="rounded-lg border border-[#3b2a1f] bg-black/30 p-4">
      <h3 className="mb-3 text-[16px] font-black" style={{ color: accent }}>
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-bold text-white/85">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-white/50">{hint}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#51cf66]" : "bg-white/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Status({ text, color, extra }: { text: string; color: string; extra?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-black/40 px-3 py-2 text-[13.5px]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <b style={{ color }}>{text}</b>
      {extra && <span className="ml-auto text-[12px] text-white/55">{extra}</span>}
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-3 py-2 text-[13px] text-[#ffa8a8]">{children}</div>;
}

function Secret({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        className="inp font-mono text-[13px]"
        type={show ? "text" : "password"}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="button" className="btn btn-ghost shrink-0" onClick={() => setShow((v) => !v)}>
        {show ? "Gizle" : "Göster"}
      </button>
    </div>
  );
}

export default function ControlPanel(p: Props) {
  const s = p.settings;
  const [fresh, setFresh] = useState(s.simulate);
  const [copied, setCopied] = useState(false);
  const [ytHelp, setYtHelp] = useState(false);
  const [bngHelp, setBngHelp] = useState(true);
  const [md, setMd] = useState({ name: "", amount: "50", message: "", avatar: "" });
  if (!p.open) return null;

  const [ytText, ytColor] = YT_STATUS[p.yt.status];
  const [slText, slColor] = LINK_STATUS[p.sl.status];
  const [seText, seColor] = LINK_STATUS[p.se.status];
  const canYt = s.apiKey.trim().length > 10 && s.videoInput.trim().length > 0;
  const url = obsUrl(s);
  const donateUrl = fullUrl(s.donateUrl);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const manual = (amount: number, fallbackName?: string) => {
    const name = (md.name.trim() || fallbackName || "").slice(0, 32);
    if (!name) return;
    p.onManualDonate({ name, amount: Math.max(1, Math.round(amount)), message: md.message.trim().slice(0, 220), avatar: md.avatar.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onClick={p.onClose}>
      <div className="w-full max-w-[840px] rounded-xl border-2 border-[#c9a063] bg-[#14100c] text-[15px] text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-[#3b2a1f] bg-[#14100c] px-5 py-3">
          <div className="text-[20px] font-black text-[#ffd43b]">⚙️ Yayıncı Paneli</div>
          <button onClick={p.onClose} className="rounded-md px-2 text-[22px] text-white/60 hover:bg-white/10 hover:text-white" aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* ------------------------------ ByNoGame ------------------------------ */}
          <Section title="💖 ByNoGame Bağış Entegrasyonu" accent="#ff8fab">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <Field
                  label="ByNoGame bağış linkin"
                  hint="Ekrandaki 'BAĞIŞ YAP' butonu, QR kod ve chat'teki !bağış komutu izleyiciyi bu adrese yönlendirir."
                >
                  <div className="flex gap-2">
                    <input className="inp" value={s.donateUrl} onChange={(e) => p.update({ donateUrl: e.target.value })} placeholder={DEFAULT_DONATE_URL} />
                    <a className="btn btn-ghost shrink-0" href={donateUrl} target="_blank" rel="noopener noreferrer">
                      Aç ↗
                    </a>
                  </div>
                </Field>
              </div>
              <div className="qr-wrap shrink-0">
                <QRCodeSVG value={donateUrl} size={84} level="M" marginSize={0} />
              </div>
            </div>

            <button className="text-[13px] font-bold text-[#74c0fc] hover:underline" onClick={() => setBngHelp((v) => !v)}>
              {bngHelp ? "▾" : "▸"} Kurulum: ByNoGame bağışları oyuna nasıl düşer?
            </button>
            {bngHelp && (
              <ol className="list-decimal space-y-1 rounded-md bg-black/40 py-2 pl-8 pr-3 text-[13px] text-white/85">
                <li>
                  <a className="text-[#74c0fc] underline" href="https://donate.bynogame.com/" target="_blank" rel="noopener noreferrer">
                    donate.bynogame.com
                  </a>{" "}
                  → giriş yap → <b>Yayıncı Ayarları → Bildirim servisi tercihiniz</b> → <b>Streamlabs</b> (veya StreamElements) seç ve hesabını bağla.
                </li>
                <li>
                  <b>Streamlabs:</b>{" "}
                  <a className="text-[#74c0fc] underline" href="https://streamlabs.com/dashboard#/settings/api-settings" target="_blank" rel="noopener noreferrer">
                    Ayarlar → API Settings → API Tokens
                  </a>{" "}
                  → <b>"Your Socket API Token"</b>'ı kopyala, aşağıya yapıştır.
                </li>
                <li>
                  <b>StreamElements:</b>{" "}
                  <a className="text-[#74c0fc] underline" href="https://streamelements.com/dashboard/account/channels" target="_blank" rel="noopener noreferrer">
                    Hesap → Channels
                  </a>{" "}
                  → <b>"Show secrets"</b> → <b>JWT Token</b>'ı kopyala, aşağıya yapıştır.
                </li>
                <li>
                  <b>Bağlan</b>'a bas → ByNoGame'den (veya Streamlabs/StreamElements panelinden) test bağışı gönder → ekranda üstten bildirim, kayan yazı ve karakter görünür.
                </li>
                <li>
                  İzleyicilere: "Destekleyen isim" alanına <b>YouTube adınızı</b> yazın → profil resmi ve kanal linki otomatik eşleşir (YouTube bağlantısı açıkken).
                </li>
              </ol>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-[#3b2a1f] bg-black/25 p-3">
                <div className="text-[15px] font-black text-[#80f5d2]">Streamlabs köprüsü</div>
                <Status text={slText} color={slColor} extra={p.sl.count ? `${p.sl.count} bağış alındı` : undefined} />
                {p.sl.error && s.slConnect && <ErrorBox>{p.sl.error}</ErrorBox>}
                <Field label="Socket API Token">
                  <Secret value={s.slToken} disabled={s.slConnect} onChange={(v) => p.update({ slToken: v })} placeholder="eyJ0eXAiOiJKV1Qi…" />
                </Field>
                {s.slConnect ? (
                  <button className="btn btn-red" onClick={() => p.onLinkDisconnect("sl")}>
                    ⏹ Bağlantıyı Kes
                  </button>
                ) : (
                  <button className="btn btn-gold" disabled={s.slToken.trim().length < 20} onClick={() => p.onLinkConnect("sl", fresh)}>
                    🔌 Bağlan
                  </button>
                )}
              </div>
              <div className="space-y-2 rounded-lg border border-[#3b2a1f] bg-black/25 p-3">
                <div className="text-[15px] font-black text-[#ffa8a8]">StreamElements köprüsü</div>
                <Status text={seText} color={seColor} extra={p.se.count ? `${p.se.count} bağış alındı` : undefined} />
                {p.se.error && s.seConnect && <ErrorBox>{p.se.error}</ErrorBox>}
                <Field label="JWT Token">
                  <Secret value={s.seToken} disabled={s.seConnect} onChange={(v) => p.update({ seToken: v })} placeholder="eyJhbGciOi…" />
                </Field>
                <Field label="Kanal ID (opsiyonel)" hint="Boş bırakılırsa JWT içinden otomatik alınır.">
                  <input className="inp font-mono text-[13px]" value={s.seChannel} disabled={s.seConnect} onChange={(e) => p.update({ seChannel: e.target.value })} />
                </Field>
                {s.seConnect ? (
                  <button className="btn btn-red" onClick={() => p.onLinkDisconnect("se")}>
                    ⏹ Bağlantıyı Kes
                  </button>
                ) : (
                  <button className="btn btn-gold" disabled={s.seToken.trim().length < 20} onClick={() => p.onLinkConnect("se", fresh)}>
                    🔌 Bağlan
                  </button>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-white/80">
              <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
              Bağlanınca demo verilerini temizle (boş kaleyle başla)
            </label>

            <div className="rounded-lg border border-[#3b2a1f] bg-black/25 p-3">
              <div className="mb-2 text-[15px] font-black text-[#ffd43b]">
                ✍️ Manuel bağış ekle <span className="text-[12px] font-semibold text-white/50">(köprü kurulmadıysa moderatör buradan girer)</span>
              </div>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input className="inp" placeholder="Destekleyen isim" value={md.name} maxLength={32} onChange={(e) => setMd((m) => ({ ...m, name: e.target.value }))} />
                <input className="inp" type="number" min={1} placeholder="TL" value={md.amount} onChange={(e) => setMd((m) => ({ ...m, amount: e.target.value }))} />
                <input className="inp col-span-2" placeholder="Mesaj (opsiyonel)" value={md.message} maxLength={220} onChange={(e) => setMd((m) => ({ ...m, message: e.target.value }))} />
                <input className="inp col-span-2" placeholder="Profil resmi URL (opsiyonel)" value={md.avatar} onChange={(e) => setMd((m) => ({ ...m, avatar: e.target.value }))} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="btn btn-gold"
                  disabled={!md.name.trim()}
                  onClick={() => {
                    manual(Number(md.amount) || 1);
                    setMd((m) => ({ ...m, message: "" }));
                  }}
                >
                  💖 Bağışı Ekle
                </button>
                <button className="btn btn-ghost" onClick={p.onTestAlert}>
                  🔔 Rastgele test bildirimi
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[10, 50, 100, 250, 600, 1000, 2500, 5000].map((q) => (
                  <button key={q} className="btn btn-ghost !px-3 !py-1.5 text-[13px]" onClick={() => manual(q, s.testName || "Yayıncı")}>
                    {q} TL
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ------------------------------ Ekran ------------------------------ */}
          <Section title="🖥️ Ekran & Bildirim Ayarları">
            <Field label="Gönüllülük bilgilendirme yazısı (ekranda sürekli görünür)">
              <textarea className="inp min-h-[64px] resize-y" value={s.noticeText} maxLength={180} onChange={(e) => p.update({ noticeText: e.target.value })} />
            </Field>
            <button className="text-[12px] font-bold text-[#74c0fc] hover:underline" onClick={() => p.update({ noticeText: DEFAULT_NOTICE })}>
              ↺ Varsayılan yazıya dön
            </button>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle checked={s.showAmounts} onChange={(v) => p.update({ showAmounts: v })} label="Bildirim ve kayan yazıda tutarı göster" />
              <Toggle checked={s.alertSound} onChange={(v) => p.update({ alertSound: v })} label="Bağış bildirim sesi" />
              <Toggle checked={s.tts} onChange={(v) => p.update({ tts: v })} label="Bağış mesajını sesli oku (TTS)" />
              <Toggle checked={s.simulate} onChange={(v) => p.update({ simulate: v })} label="Demo simülasyonu (sahte bağışlar)" />
              <Toggle checked={s.hideUi} onChange={(v) => p.update({ hideUi: v })} label="Yayın modu (kontrolleri gizle)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bağış hedefi (TL)" hint="Hedef dolunca otomatik bir sonrakine geçer">
                <input className="inp" type="number" min={100} step={500} value={s.goal} onChange={(e) => p.update({ goal: Math.max(100, Number(e.target.value) || 10000) })} />
              </Field>
              <Field label="Patron can çarpanı" hint="Az bağış gelen yayınlarda düşürün">
                <select className="inp" value={s.hpMult} onChange={(e) => p.update({ hpMult: Number(e.target.value) })}>
                  {[0.1, 0.25, 0.5, 1, 2, 3, 5, 10].map((m) => (
                    <option key={m} value={m}>
                      {m}x
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          {/* ------------------------------ YouTube ------------------------------ */}
          <Section title="📺 YouTube Canlı Yayın (sohbet komutları, Super Chat, profil resimleri)" accent="#ff6b6b">
            <Status
              text={ytText + (p.yt.info.title ? ` · ${p.yt.info.title}` : "")}
              color={ytColor}
              extra={s.connect ? `${p.yt.info.polls} sorgu · ${p.yt.info.messages} mesaj · ${p.yt.info.donations} bağış` : undefined}
            />
            {p.yt.error && <ErrorBox>{p.yt.error}</ErrorBox>}
            <Field label="YouTube Data API v3 anahtarı">
              <Secret value={s.apiKey} disabled={s.connect} onChange={(v) => p.update({ apiKey: v })} placeholder="AIza…" />
            </Field>
            <Field label="Canlı yayın linki / video ID / kanal (@kullanıcıadı)" hint="Örn: youtube.com/watch?v=XXXXXXXXXXX · youtube.com/live/XXXXXXXXXXX · @kanalim">
              <input className="inp" value={s.videoInput} disabled={s.connect} onChange={(e) => p.update({ videoInput: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
            </Field>
            {!s.connect ? (
              <button className="btn btn-gold" disabled={!canYt} onClick={() => p.onConnect(fresh)}>
                🔴 YouTube'a Bağlan
              </button>
            ) : (
              <button className="btn btn-red" onClick={p.onDisconnect}>
                ⏹ Bağlantıyı Kes
              </button>
            )}
            <button className="block text-[13px] font-bold text-[#74c0fc] hover:underline" onClick={() => setYtHelp((v) => !v)}>
              {ytHelp ? "▾" : "▸"} API anahtarı nasıl alınır?
            </button>
            {ytHelp && (
              <ol className="list-decimal space-y-1 rounded-md bg-black/40 py-2 pl-8 pr-3 text-[13px] text-white/80">
                <li>
                  <a className="text-[#74c0fc] underline" href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
                    Google Cloud Console
                  </a>
                  'da proje oluşturun, <b>YouTube Data API v3</b>'ü etkinleştirin.
                </li>
                <li>"Kimlik Bilgileri → API anahtarı" oluşturup buraya yapıştırın, yayın linkini girip bağlanın.</li>
                <li>Sohbetteki !bağış · !saldır · !sıra komutları ve YouTube profil resimleri bu bağlantıyla çalışır.</li>
              </ol>
            )}
          </Section>

          {/* ------------------------------ OBS ------------------------------ */}
          <Section title="🎥 OBS Kurulumu">
            <Field label="OBS → Kaynak Ekle → Tarayıcı → bu linki yapıştırın (1920×1080). Kontroller gizli açılır, bağlantılar otomatik kurulur.">
              <div className="flex gap-2">
                <input className="inp font-mono text-[12px]" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
                <button className="btn btn-ghost shrink-0" onClick={copy}>
                  {copied ? "✓ Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </Field>
            <p className="text-[12px] font-semibold text-[#ffa8a8]">⚠️ Bu link gizli anahtarlarınızı içerir — kimseyle paylaşmayın, yayında göstermeyin.</p>
            <p className="text-[12px] text-white/55">Ses için OBS'te tarayıcı kaynağının "Sesi OBS üzerinden kontrol et" seçeneğini açabilirsiniz.</p>
          </Section>

          {/* ------------------------------ Dönüşüm ------------------------------ */}
          <Section title="💱 Bağış Dönüşümü">
            <div className="grid grid-cols-3 gap-3">
              <Field label="1 USD = ? TL" hint="Yabancı para bağışlar için">
                <input className="inp" type="number" min={1} value={s.usdTry} onChange={(e) => p.update({ usdTry: Math.max(1, Number(e.target.value) || 1) })} />
              </Field>
              <Field label="Üyelik değeri (TL)" hint="YouTube yeni / hediye üyelik">
                <input className="inp" type="number" min={0} value={s.memberValue} onChange={(e) => p.update({ memberValue: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
              <Field label="YouTube sorgu aralığı (sn)" hint="Kota tasarrufu için artırın">
                <input className="inp" type="number" min={2} value={Math.round(s.minPollMs / 1000)} onChange={(e) => p.update({ minPollMs: Math.max(2, Number(e.target.value) || 5) * 1000 })} />
              </Field>
            </div>
          </Section>

          {/* ------------------------------ Yönetim ------------------------------ */}
          <Section title="⚠️ Yönetim">
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" onClick={p.onSkipBoss}>
                ⏭ Sonraki patrona geç
              </button>
              <button className="btn btn-red" onClick={() => window.confirm("Tüm bağışçılar ve ilerleme silinsin mi?") && p.onReset(false)}>
                🗑 Sıfırla (boş kale)
              </button>
              <button className="btn btn-ghost" onClick={() => window.confirm("Demo verileriyle yeniden başlatılsın mı?") && p.onReset(true)}>
                🎮 Demo ile sıfırla
              </button>
            </div>
            <p className="text-[12px] text-white/50">İlerleme tarayıcıya otomatik kaydedilir; sayfa yenilense de savaş kaldığı yerden devam eder.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
