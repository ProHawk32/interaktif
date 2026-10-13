/**
 * Sprite işleme hattı:
 *  1) Görseli canvas'a çiz
 *  2) Kenar piksellerinden arka plan rengini bul (k-means, dama desenini de yakalar)
 *  3) Kenarlardan flood-fill ile arka planı sil, kenarlarda yumuşak alfa + renk ayrıştırma
 *  4) Küçük artık lekeleri temizle, karakterin etrafını kırp
 *  5) (Patronlar için) palet değişimi / ayna çevirme uygula
 */
export interface SpriteData {
  url: string;
  aspect: number;
}

type Stop = [number, string];
type RGB = [number, number, number];

interface SpriteDef {
  src: string;
  max: number;
  map?: Stop[];
  mix?: number;
  flip?: boolean;
  /** Bu dosya varsa otomatik kullanılır (public/images/custom/...) */
  custom?: string;
}

export const SPRITES: Record<string, SpriteDef> = {
  villager: { src: "/images/villager.png", max: 300 },
  rookie: { src: "/images/rookie.png", max: 300 },
  apprentice: { src: "/images/apprentice.png", max: 300 },
  archer: { src: "/images/archer.png", max: 300 },
  warrior: { src: "/images/warrior.png", max: 300 },
  mage: { src: "/images/mage.png", max: 300 },
  valkyrie: { src: "/images/valkyrie.png", max: 300 },
  knight_gold: { src: "/images/knight_gold.png", max: 360 },
  boss1: {
    src: "/images/villager.png", custom: "/images/custom/boss1.png", max: 560, flip: true, mix: 0.88,
    map: [[0, "#0b1006"], [0.32, "#2b4413"], [0.66, "#7fb332"], [1, "#f0ffc4"]],
  },
  boss2: {
    src: "/images/warrior.png", custom: "/images/custom/boss2.png", max: 600, flip: true, mix: 0.92,
    map: [[0, "#040407"], [0.3, "#22060c"], [0.6, "#a3122a"], [0.85, "#f0a3ad"], [1, "#ffffff"]],
  },
  boss3: {
    src: "/images/mage.png", custom: "/images/custom/boss3.png", max: 640, flip: true, mix: 0.92,
    map: [[0, "#020503"], [0.34, "#0b3a1c"], [0.68, "#37d067"], [1, "#e6ffc9"]],
  },
  boss4: {
    src: "/images/valkyrie.png", custom: "/images/custom/boss4.png", max: 680, flip: true, mix: 0.9,
    map: [[0, "#030716"], [0.34, "#103576"], [0.68, "#4cc2f5"], [1, "#f4fdff"]],
  },
  boss5: { src: "/images/boss.png", custom: "/images/custom/boss5.png", max: 760 },
};

const store = new Map<string, SpriteData>();
const cleanCache = new Map<string, Promise<HTMLCanvasElement>>();

export function getSprite(key: string): SpriteData {
  return store.get(key) ?? { url: SPRITES[key]?.src ?? "", aspect: 1 };
}

export async function preloadSprites(onProgress?: (done: number, total: number) => void): Promise<void> {
  const keys = Object.keys(SPRITES);
  let done = 0;
  await Promise.all(
    keys.map(async (key) => {
      const def = SPRITES[key];
      let data: SpriteData | null = null;
      if (def.custom) {
        try {
          data = await exportVariant(await cleaned(def.custom), def.max);
        } catch {
          data = null;
        }
      }
      if (!data) {
        try {
          data = await exportVariant(await cleaned(def.src), def.max, def.map, def.flip, def.mix);
        } catch {
          data = { url: def.src, aspect: 1 };
        }
      }
      store.set(key, data);
      done += 1;
      onProgress?.(done, keys.length);
    }),
  );
}

function cleaned(src: string): Promise<HTMLCanvasElement> {
  let p = cleanCache.get(src);
  if (!p) {
    p = withTimeout(loadImage(src), 20000).then(cleanImage);
    cleanCache.set(src, p);
  }
  return p;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.naturalWidth > 0 ? resolve(img) : reject(new Error("empty")));
    img.onerror = () => reject(new Error("load " + src));
    img.src = src;
  });
}

function cleanImage(img: HTMLImageElement): HTMLCanvasElement {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.min(1, 720 / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * s));
  const h = Math.max(1, Math.round(ih * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  removeBackground(data);
  removeSpecks(data);
  ctx.putImageData(data, 0, 0);
  const b = alphaBounds(data);
  if (!b) throw new Error("empty sprite");
  const pad = 3;
  const x0 = Math.max(0, b.x0 - pad);
  const y0 = Math.max(0, b.y0 - pad);
  const x1 = Math.min(w, b.x1 + pad + 1);
  const y1 = Math.min(h, b.y1 + pad + 1);
  const out = document.createElement("canvas");
  out.width = x1 - x0;
  out.height = y1 - y0;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("canvas");
  octx.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return out;
}

async function exportVariant(src: HTMLCanvasElement, max: number, map?: Stop[], flip?: boolean, mix = 0.9): Promise<SpriteData> {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * s));
  const h = Math.max(1, Math.round(src.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: !!map });
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (flip) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (map) gradientMap(ctx, w, h, map, mix);
  const url = await toUrl(c);
  return { url, aspect: w / h };
}

function toUrl(c: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    try {
      c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : c.toDataURL("image/png")), "image/png");
    } catch {
      resolve(c.toDataURL("image/png"));
    }
  });
}

/* ------------------------------ arka plan silme ------------------------------ */

function d2(a: RGB, b: RGB): number {
  const r = a[0] - b[0];
  const g = a[1] - b[1];
  const bl = a[2] - b[2];
  return r * r + g * g + bl * bl;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function clusterBg(samples: RGB[]): RGB[] {
  if (!samples.length) return [[0, 0, 0]];
  let c0: RGB = [median(samples.map((s) => s[0])), median(samples.map((s) => s[1])), median(samples.map((s) => s[2]))];
  let c1: RGB = samples[0];
  let far = -1;
  for (const s of samples) {
    const v = d2(s, c0);
    if (v > far) {
      far = v;
      c1 = s;
    }
  }
  const assign = new Uint8Array(samples.length);
  for (let it = 0; it < 8; it++) {
    const acc = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    samples.forEach((s, i) => {
      const k = d2(s, c0) <= d2(s, c1) ? 0 : 1;
      assign[i] = k;
      const a = acc[k];
      a[0] += s[0];
      a[1] += s[1];
      a[2] += s[2];
      a[3] += 1;
    });
    if (acc[0][3]) c0 = [acc[0][0] / acc[0][3], acc[0][1] / acc[0][3], acc[0][2] / acc[0][3]];
    if (acc[1][3]) c1 = [acc[1][0] / acc[1][3], acc[1][1] / acc[1][3], acc[1][2] / acc[1][3]];
  }
  const stats = [c0, c1]
    .map((c, k) => {
      let n = 0;
      let spread = 0;
      samples.forEach((s, i) => {
        if (assign[i] === k) {
          n++;
          spread += Math.sqrt(d2(s, c));
        }
      });
      return { c, share: n / samples.length, spread: n ? spread / n : 999 };
    })
    .sort((a, b) => b.share - a.share);
  const out: RGB[] = [stats[0].c];
  if (stats[1].share >= 0.28 && stats[1].spread < 14 && Math.sqrt(d2(stats[0].c, stats[1].c)) > 18) out.push(stats[1].c);
  return out;
}

function removeBackground(img: ImageData): void {
  const { width: w, height: h, data: d } = img;
  const N = w * h;
  const samples: RGB[] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 160));
  const add = (x: number, y: number) => {
    const p = (y * w + x) * 4;
    samples.push([d[p], d[p + 1], d[p + 2]]);
  };
  for (let x = 0; x < w; x += step) {
    add(x, 0);
    add(x, Math.min(2, h - 1));
    add(x, h - 1);
    add(x, Math.max(0, h - 3));
  }
  for (let y = 0; y < h; y += step) {
    add(0, y);
    add(Math.min(2, w - 1), y);
    add(w - 1, y);
    add(Math.max(0, w - 3), y);
  }
  const bgs = clusterBg(samples);

  const dist = new Float32Array(N);
  const nearest = new Uint8Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    let best = Infinity;
    let bi = 0;
    for (let k = 0; k < bgs.length; k++) {
      const c = bgs[k];
      const dr = d[p] - c[0];
      const dg = d[p + 1] - c[1];
      const db = d[p + 2] - c[2];
      const v = dr * dr + dg * dg + db * db;
      if (v < best) {
        best = v;
        bi = k;
      }
    }
    dist[i] = Math.sqrt(best);
    nearest[i] = bi;
  }

  const HARD = 36;
  const SOFT = 80;
  const st = new Uint8Array(N); // 0 = kalsın, 1 = silindi, 2 = yumuşak kenar
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  const seed = (i: number) => {
    if (st[i] === 0 && dist[i] < HARD) {
      st[i] = 1;
      q[qt++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (qh < qt) {
    const i = q[qh++];
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < N - w) seed(i + w);
  }

  // yumuşak kenar bandı (en fazla 3 piksel içeri)
  const depth = new Uint8Array(N);
  qh = 0;
  qt = 0;
  for (let i = 0; i < N; i++) {
    if (st[i] !== 0 || dist[i] >= SOFT) continue;
    const x = i % w;
    if ((x > 0 && st[i - 1] === 1) || (x < w - 1 && st[i + 1] === 1) || (i >= w && st[i - w] === 1) || (i < N - w && st[i + w] === 1)) {
      st[i] = 2;
      depth[i] = 1;
      q[qt++] = i;
    }
  }
  const soft = (n: number, dep: number) => {
    if (st[n] === 0 && dist[n] < SOFT) {
      st[n] = 2;
      depth[n] = dep;
      q[qt++] = n;
    }
  };
  while (qh < qt) {
    const i = q[qh++];
    const dep = depth[i];
    if (dep >= 3) continue;
    const x = i % w;
    if (x > 0) soft(i - 1, dep + 1);
    if (x < w - 1) soft(i + 1, dep + 1);
    if (i >= w) soft(i - w, dep + 1);
    if (i < N - w) soft(i + w, dep + 1);
  }

  for (let i = 0, p = 0; i < N; i++, p += 4) {
    if (st[i] === 1) {
      d[p + 3] = 0;
      continue;
    }
    if (st[i] !== 2) continue;
    const a = (dist[i] - HARD) / (SOFT - HARD);
    if (a < 0.1) {
      d[p + 3] = 0;
      continue;
    }
    const c = bgs[nearest[i]];
    for (let k = 0; k < 3; k++) d[p + k] = Math.max(0, Math.min(255, (d[p + k] - (1 - a) * c[k]) / a));
    d[p + 3] = Math.round(d[p + 3] * a);
  }
}

function removeSpecks(img: ImageData): void {
  const { width: w, height: h, data: d } = img;
  const N = w * h;
  for (let i = 0; i < N; i++) if (d[i * 4 + 3] <= 24) d[i * 4 + 3] = 0;
  const label = new Int32Array(N);
  const q = new Int32Array(N);
  const sizes: number[] = [0];
  for (let i = 0; i < N; i++) {
    if (label[i] || d[i * 4 + 3] === 0) continue;
    const id = sizes.length;
    let qh = 0;
    let qt = 0;
    q[qt++] = i;
    label[i] = id;
    while (qh < qt) {
      const j = q[qh++];
      const x = j % w;
      if (x > 0 && !label[j - 1] && d[(j - 1) * 4 + 3] !== 0) {
        label[j - 1] = id;
        q[qt++] = j - 1;
      }
      if (x < w - 1 && !label[j + 1] && d[(j + 1) * 4 + 3] !== 0) {
        label[j + 1] = id;
        q[qt++] = j + 1;
      }
      if (j >= w && !label[j - w] && d[(j - w) * 4 + 3] !== 0) {
        label[j - w] = id;
        q[qt++] = j - w;
      }
      if (j < N - w && !label[j + w] && d[(j + w) * 4 + 3] !== 0) {
        label[j + w] = id;
        q[qt++] = j + w;
      }
    }
    sizes.push(qt);
  }
  let max = 0;
  for (const s of sizes) if (s > max) max = s;
  const minKeep = Math.max(30, max * 0.015);
  for (let i = 0; i < N; i++) {
    const l = label[i];
    if (l && sizes[l] < minKeep) d[i * 4 + 3] = 0;
  }
}

function alphaBounds(img: ImageData): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width: w, height: h, data: d } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/* ------------------------------ palet değişimi ------------------------------ */

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function buildLut(stops: Stop[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const st = stops.map(([pos, col]) => ({ pos, rgb: hexToRgb(col) }));
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < st.length - 2 && t > st[k + 1].pos) k++;
    const a = st[k];
    const b = st[Math.min(k + 1, st.length - 1)];
    const f = b.pos === a.pos ? 0 : Math.min(1, Math.max(0, (t - a.pos) / (b.pos - a.pos)));
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a.rgb[c] + (b.rgb[c] - a.rgb[c]) * f;
  }
  return lut;
}

function gradientMap(ctx: CanvasRenderingContext2D, w: number, h: number, stops: Stop[], mix: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lut = buildLut(stops);
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] === 0) continue;
    const lum = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    const l = Math.max(0, Math.min(255, (lum - 110) * 1.2 + 120)) | 0;
    const li = l * 3;
    d[p] = d[p] * (1 - mix) + lut[li] * mix;
    d[p + 1] = d[p + 1] * (1 - mix) + lut[li + 1] * mix;
    d[p + 2] = d[p + 2] * (1 - mix) + lut[li + 2] * mix;
  }
  ctx.putImageData(img, 0, 0);
}
