export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const progress = (f: number, start: number, dur: number) => clamp((f - start) / dur);
export const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const envelope = (f: number, inStart: number, inDur: number, outStart: number, outDur: number) =>
  Math.min(easeOut(progress(f, inStart, inDur)), 1 - easeIn(progress(f, outStart, outDur)));

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D simplex noise (Gustavson), seeded permutation.
const perm = new Uint8Array(512);
{
  const r = mulberry32(42);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2c = (3 - Math.sqrt(3)) / 6;

export function noise2(x: number, y: number) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2c;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + G2c;
  const y1 = y0 - j1 + G2c;
  const x2 = x0 - 1 + 2 * G2c;
  const y2 = y0 - 1 + 2 * G2c;
  const ii = i & 255;
  const jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    const g = G2[perm[ii + perm[jj]] & 7];
    t0 *= t0;
    n += t0 * t0 * (g[0] * x0 + g[1] * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    const g = G2[perm[ii + i1 + perm[jj + j1]] & 7];
    t1 *= t1;
    n += t1 * t1 * (g[0] * x1 + g[1] * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    const g = G2[perm[ii + 1 + perm[jj + 1]] & 7];
    t2 *= t2;
    n += t2 * t2 * (g[0] * x2 + g[1] * y2);
  }
  return 70 * n;
}

/** Divergence-free 2D flow (curl of a noise potential). */
export function curl(x: number, y: number, out: [number, number]) {
  const e = 0.01;
  const dx = noise2(x + e, y) - noise2(x - e, y);
  const dy = noise2(x, y + e) - noise2(x, y - e);
  out[0] = dy / (2 * e);
  out[1] = -dx / (2 * e);
  return out;
}

export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h.toFixed(1)},${s}%,${l}%,${a})`;

/** Interpolate a [frame, value][] table (log-space when `log`). */
export function table(f: number, pts: [number, number][], log = false) {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [f1, v1] = pts[i];
    if (f <= f1) {
      const [f0, v0] = pts[i - 1];
      const t = smooth((f - f0) / (f1 - f0));
      return log ? Math.exp(lerp(Math.log(v0), Math.log(v1), t)) : lerp(v0, v1, t);
    }
  }
  return pts[pts.length - 1][1];
}
