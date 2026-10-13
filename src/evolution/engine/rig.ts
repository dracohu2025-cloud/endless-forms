import { mulberry32 } from "../lib/math";

/**
 * Particle rigging. An organism is a set of chains; each chain is a polyline of
 * joints with a radius (a "capsule chain"). Every particle is bound once to
 * (chain, segment, u along segment, v across the width), so when the pose
 * function moves the skeleton the particles ride along with it.
 */
export type J = { x: number; y: number; r: number };
export type Chain = J[];
export type Pose = (f: number) => Chain[];

/** Per-particle appearance: hue (deg), saturation 0..1, brightness 0..1+, radius px, alpha. */
export type Look = [number, number, number, number, number];
export type LookFn = (chain: number, s: number, v: number, rnd: number) => Look;

export const LOOK_STRIDE = 5;

export interface Form {
  eval(f: number, xy: Float32Array, look: Float32Array, o: number, n: number): void;
}

type Binding = {
  chain: Uint16Array;
  seg: Uint16Array;
  u: Float32Array;
  v: Float32Array;
  look: Float32Array;
};

export function rigForm(pose: Pose, refFrame: number, look: LookFn, seed: number, opts: { outline?: number; weights?: number[] } = {}): Form {
  const outline = opts.outline ?? 0.3;
  const cache = new Map<number, Binding>();

  const bind = (n: number): Binding => {
    const hit = cache.get(n);
    if (hit) return hit;
    const rnd = mulberry32(seed * 7919 + n);
    const ref = pose(refFrame);
    // area of each segment = length × 2 × mean radius (plus a floor so thin chains still get particles)
    const segW: number[][] = ref.map((c) => {
      const w: number[] = [];
      for (let k = 0; k < c.length - 1; k++) {
        const len = Math.hypot(c[k + 1].x - c[k].x, c[k + 1].y - c[k].y);
        w.push(len * (c[k].r + c[k + 1].r + 0.01));
      }
      return w;
    });
    const chainW = segW.map((w, i) => w.reduce((a, x) => a + x, 0) * (opts.weights?.[i] ?? 1));
    const total = chainW.reduce((a, x) => a + x, 0);
    const B: Binding = {
      chain: new Uint16Array(n),
      seg: new Uint16Array(n),
      u: new Float32Array(n),
      v: new Float32Array(n),
      look: new Float32Array(n * LOOK_STRIDE),
    };
    for (let i = 0; i < n; i++) {
      let x = rnd() * total;
      let ci = 0;
      while (ci < chainW.length - 1 && x > chainW[ci]) x -= chainW[ci++];
      const ws = segW[ci];
      const sumW = ws.reduce((a, b) => a + b, 0);
      let y = rnd() * sumW;
      let si = 0;
      while (si < ws.length - 1 && y > ws[si]) y -= ws[si++];
      const u = rnd();
      const edge = rnd() < outline;
      const v = edge ? (rnd() < 0.5 ? -1 : 1) * (0.88 + 0.12 * rnd()) : rnd() * 2 - 1;
      B.chain[i] = ci;
      B.seg[i] = si;
      B.u[i] = u;
      B.v[i] = v;
      const s = (si + u) / Math.max(1, ws.length);
      const lk = look(ci, s, v, rnd());
      B.look.set(lk, i * LOOK_STRIDE);
    }
    cache.set(n, B);
    return B;
  };

  return {
    eval(f, xy, lk, o, n) {
      if (n <= 0) return;
      const B = bind(n);
      const P = pose(f);
      for (let i = 0; i < n; i++) {
        const c = P[B.chain[i]];
        const k = Math.min(B.seg[i], c.length - 2);
        const a = c[k];
        const bj = c[k + 1];
        const u = B.u[i];
        const x = a.x + (bj.x - a.x) * u;
        const y = a.y + (bj.y - a.y) * u;
        const r = a.r + (bj.r - a.r) * u;
        let dx = bj.x - a.x;
        let dy = bj.y - a.y;
        const L = Math.hypot(dx, dy) || 1;
        dx /= L;
        dy /= L;
        const j = (o + i) * 2;
        xy[j] = x - dy * r * B.v[i];
        xy[j + 1] = y + dx * r * B.v[i];
      }
      lk.set(B.look, o * LOOK_STRIDE);
    },
  };
}

/** Split the particle range across several forms by weight. */
export function composite(parts: { form: Form; w: number }[]): Form {
  const total = parts.reduce((a, p) => a + p.w, 0);
  return {
    eval(f, xy, lk, o, n) {
      let start = 0;
      parts.forEach((p, i) => {
        const end = i === parts.length - 1 ? n : Math.round(start + (n * p.w) / total);
        p.form.eval(f, xy, lk, o + start, end - start);
        start = end;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// skeleton helpers
// ---------------------------------------------------------------------------
export const poly = (n: number, fn: (s: number) => [number, number, number]): Chain => {
  const c: Chain = [];
  for (let k = 0; k < n; k++) {
    const [x, y, r] = fn(k / (n - 1));
    c.push({ x, y, r });
  }
  return c;
};

/** Chain grown by integrating a heading: like a tentacle, neck or tail. */
export const grow = (
  x0: number,
  y0: number,
  heading: (s: number) => number,
  len: number,
  n: number,
  radius: (s: number) => number,
): Chain => {
  const c: Chain = [{ x: x0, y: y0, r: radius(0) }];
  const step = len / (n - 1);
  let x = x0;
  let y = y0;
  for (let k = 1; k < n; k++) {
    const s = k / (n - 1);
    const h = heading(s - 0.5 / (n - 1));
    x += Math.cos(h) * step;
    y += Math.sin(h) * step;
    c.push({ x, y, r: radius(s) });
  }
  return c;
};

export const seg = (pts: [number, number, number][]): Chain => pts.map(([x, y, r]) => ({ x, y, r }));

/** Transform local chains: scale, rotate, flip and translate. */
export const place = (chains: Chain[], tx: number, ty: number, sc: number, rot = 0, flip = false): Chain[] => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const fx = flip ? -1 : 1;
  return chains.map((ch) =>
    ch.map((j) => {
      const x = j.x * fx;
      return { x: tx + (x * c - j.y * s) * sc, y: ty + (x * s + j.y * c) * sc, r: j.r * sc };
    }),
  );
};

export const prof = (s: number, pts: [number, number][]) => {
  if (s <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (s <= pts[i][0]) {
      const [s0, r0] = pts[i - 1];
      const [s1, r1] = pts[i];
      const t = (s - s0) / (s1 - s0);
      return r0 + (r1 - r0) * (t * t * (3 - 2 * t));
    }
  }
  return pts[pts.length - 1][1];
};
