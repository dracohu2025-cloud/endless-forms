import data from "../data/audio.json";

type Ev = { k: string; f: number; n?: number; l?: number; s?: number };
export type GaPhrase = { bar: number; gen: number; fit: number; genome: number[] };

const events = data.events as Ev[];
const at = (arr: number[], f: number) => {
  const i = Math.max(0, Math.min(arr.length - 1, Math.floor(f)));
  return arr[i] ?? 0;
};

export const loudness = (f: number) => at(data.rms, f);
export const bass = (f: number) => at(data.low, f);
export const air = (f: number) => at(data.high, f);

export const eventsOf = (kind: string) => events.filter((e) => e.k === kind);

const cache = new Map<string, number[]>();
const framesOf = (kind: string) => {
  if (!cache.has(kind)) cache.set(kind, eventsOf(kind).map((e) => e.f));
  return cache.get(kind)!;
};

/** Exponentially decaying pulse from the most recent event(s) of a kind. */
export const pulse = (f: number, kind: string, decay = 6) => {
  let v = 0;
  for (const e of framesOf(kind)) {
    if (e > f) break;
    v = Math.max(v, Math.exp(-(f - e) / decay));
  }
  return v;
};

export const lastEvent = (f: number, kind: string) => {
  let last: Ev | null = null;
  for (const e of eventsOf(kind)) {
    if (e.f > f) break;
    last = e;
  }
  return last;
};

export const GA = data.ga as GaPhrase[];
export const SCALE = data.scale as number[];
export const DIVISIONS = eventsOf("div").map((e) => e.f);
