import data from "../data/audio.json";
import { clamp } from "./util";

type AudioData = {
  rms: number[];
  low: number[];
  high: number[];
  hits: [number, number][];
  stars: [number, number][];
};

const audio = data as unknown as AudioData;

const sample = (arr: number[], f: number) => {
  const i = clamp(Math.floor(f), 0, arr.length - 1);
  const j = clamp(i + 1, 0, arr.length - 1);
  const t = f - Math.floor(f);
  return arr[i] * (1 - t) + arr[j] * t;
};

/** Overall loudness of the soundtrack at a frame, ~0..1. */
export const loudness = (f: number) => sample(audio.rms, f);
export const bassLevel = (f: number) => sample(audio.low, f);
export const trebleLevel = (f: number) => sample(audio.high, f);

/**
 * Sum of exponentially decaying pulses from drum hits / impacts that
 * happened at or before frame f. minStrength filters to the bigger hits.
 */
export const pulse = (f: number, minStrength = 0, decay = 6) => {
  let p = 0;
  for (const [t, s] of audio.hits) {
    if (t > f) break;
    const dt = f - t;
    if (s < minStrength || dt > decay * 6) continue;
    p += s * Math.exp(-dt / decay);
  }
  return p;
};

/** Frame at which each of the twelve finale stars is struck (one per Ode to Joy note). */
export const starFrames = audio.stars.map(([t]) => t);
