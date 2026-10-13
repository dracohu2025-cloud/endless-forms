import { DIVISIONS } from "../lib/audio";
import { clamp, easeInOut, lerp, mulberry32, noise2, progress } from "../lib/math";

/**
 * Cell lineage: one cell at bar 4 divides on every "div" note of the score
 * (1 → 2 → 4 … → 64), alternating cleavage axes like an early embryo. From
 * bar 8 the 64 cells migrate onto a rotating hollow sphere (a Volvox-like colony).
 */
export const MAX_GEN = 6;
const DIV = DIVISIONS.slice(0, MAX_GEN + 1);
export const BIRTH = DIV[0];
const R0 = 175;
const CX = 540;
const CY = 880;

export const genRadius = (g: number) => R0 * Math.pow(2, -g / 2.4);

const divProgress = (f: number, g: number) => {
  const start = DIV[g];
  const next = DIV[g + 1] ?? start + 30;
  const dur = Math.max(10, Math.min(24, (next - start) * 0.9));
  const t = clamp((f - start) / dur);
  const c1 = 1.9;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const generation = (f: number) => {
  let g = 0;
  for (let k = 1; k < DIV.length; k++) if (f >= DIV[k]) g = k;
  return g;
};

const axis = (g: number) => (g % 2 ? 0 : Math.PI / 2) + 0.35 * Math.sin(g * 2.3 + 1);

export type Cell = { x: number; y: number; r: number; z: number; hue: number };

const SPHERE: [number, number, number][] = (() => {
  const n = 2 ** MAX_GEN;
  const pts: [number, number, number][] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    pts.push([Math.cos(i * ga) * rr, y, Math.sin(i * ga) * rr]);
  }
  return pts;
})();

const COLONY_START = 495;
const COLONY_DUR = 110;

function cleavage(f: number, g: number): { x: number; y: number }[] {
  let pts = [{ x: CX, y: CY }];
  for (let k = 1; k <= g; k++) {
    const p = divProgress(f, k);
    const a = axis(k);
    const sep = genRadius(k) * 1.04 * p;
    const next: { x: number; y: number }[] = [];
    for (const q of pts) {
      next.push({ x: q.x - Math.cos(a) * sep, y: q.y - Math.sin(a) * sep });
      next.push({ x: q.x + Math.cos(a) * sep, y: q.y + Math.sin(a) * sep });
    }
    pts = next;
  }
  return pts;
}

const sphereOrder: number[] = (() => {
  // assign cleavage cells to sphere sites by matching angular order around the centre
  const ref = cleavage(10_000, MAX_GEN);
  const byAngle = ref.map((p, i) => ({ i, a: Math.atan2(p.y - CY, p.x - CX), d: Math.hypot(p.x - CX, p.y - CY) }));
  const sites = SPHERE.map((p, i) => ({ i, a: Math.atan2(p[1], p[0]), d: Math.hypot(p[0], p[1]) }));
  byAngle.sort((a, b) => a.d - b.d || a.a - b.a);
  sites.sort((a, b) => a.d - b.d || a.a - b.a);
  const map = new Array(ref.length).fill(0);
  byAngle.forEach((c, k) => (map[c.i] = sites[k].i));
  return map;
})();

export function cells(f: number): Cell[] {
  const g = generation(f);
  const flat = cleavage(f, g);
  const r = genRadius(g) * (g === 0 ? clamp((f - BIRTH + 20) / 20) : 1);
  const m = easeInOut(progress(f, COLONY_START, COLONY_DUR));
  const breathe = 1 + 0.03 * Math.sin(f * 0.15);
  const push = 1 + 0.7 * Math.pow(progress(f, 640, 80), 2.2);
  const rotY = (f - COLONY_START) * 0.014;
  const tilt = 0.45;
  const Rs = 300 * push;
  return flat.map((p, i) => {
    const wob = 4 * noise2(i * 3.1, f * 0.02);
    let x = p.x + wob;
    let y = p.y + wob * 0.7;
    let rr = r * breathe;
    let z = 0;
    if (m > 0 && g === MAX_GEN) {
      const s = SPHERE[sphereOrder[i]];
      const cx = s[0] * Math.cos(rotY) + s[2] * Math.sin(rotY);
      const cz = -s[0] * Math.sin(rotY) + s[2] * Math.cos(rotY);
      const cy = s[1] * Math.cos(tilt) - cz * Math.sin(tilt);
      const cz2 = s[1] * Math.sin(tilt) + cz * Math.cos(tilt);
      const k = 1100 / (1100 + cz2 * Rs);
      x = lerp(x, CX + cx * Rs * k, m);
      y = lerp(y, CY + cy * Rs * k, m);
      rr = lerp(rr, 44 * push * k, m);
      z = cz2 * m;
    }
    const hue = lerp(178, [178, 150, 200, 300, 95][i % 5], clamp((f - 600) / 80));
    return { x, y, r: rr, z, hue };
  });
}

/** Stable per-particle lineage bits + intracellular offset. */
export function embryoBinding(n: number) {
  const r = mulberry32(1859);
  const code = new Uint8Array(n);
  const ox = new Float32Array(n);
  const oy = new Float32Array(n);
  const nucleus = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    code[i] = Math.floor(r() * 64);
    const nuc = r() < 0.28;
    nucleus[i] = nuc ? 1 : 0;
    const a = r() * Math.PI * 2;
    const d = nuc ? Math.sqrt(r()) * 0.3 : 0.35 + Math.sqrt(r()) * 0.58;
    ox[i] = Math.cos(a) * d;
    oy[i] = Math.sin(a) * d;
  }
  return { code, ox, oy, nucleus };
}
