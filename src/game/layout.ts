import { FLOORS, bossFor, classFor, sizeFactor, type Floor } from "./data";
import { getSprite } from "./sprites";
import type { Donor } from "./types";

export const STAGE_W = 1408;
export const STAGE_H = 792;
export const BOSS_FEET = 602;

export interface Placement {
  donor: Donor;
  rank: number;
  floor: Floor;
  slot: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sıralamaya göre kat ve yuva yerleşimi; karakter boyutu evrim seviyesine göre */
export function computeLayout(donors: Donor[]): { placed: Placement[]; overflow: number[] } {
  const placed: Placement[] = [];
  const overflow = FLOORS.map(() => 0);
  donors.forEach((donor, i) => {
    const rank = i + 1;
    const fi = FLOORS.findIndex((f) => rank >= f.from && (f.to === null || rank <= f.to));
    if (fi < 0) return;
    const floor = FLOORS[fi];
    const slot = rank - floor.from;
    if (slot >= floor.slots.length) {
      overflow[fi] += 1;
      return;
    }
    const cls = classFor(donor.total);
    const aspect = getSprite(cls.sprite).aspect || 1;
    let h = floor.h * sizeFactor(cls);
    let w = h * aspect;
    if (w > floor.maxW) {
      w = floor.maxW;
      h = w / aspect;
    }
    placed.push({ donor, rank, floor, slot, x: floor.slots[slot], y: floor.y, w, h });
  });
  return { placed, overflow };
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function bossBox(index: number): Box {
  const def = bossFor(index);
  const aspect = getSprite(def.sprite).aspect || 1;
  let h = def.height;
  let w = h * aspect;
  if (w > 600) {
    w = 600;
    h = w / aspect;
  }
  const left = Math.max(4, Math.min(290 - w / 2, 600 - w));
  return { left, top: BOSS_FEET - h, width: w, height: h };
}
