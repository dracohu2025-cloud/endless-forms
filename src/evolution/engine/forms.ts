import { clamp, curl, easeIn, easeInOut, easeOut, lerp, mulberry32, noise2, progress, smooth } from "../lib/math";
import { H, W } from "../timeline";
import { cells, embryoBinding, generation, MAX_GEN } from "./embryo";
import {
  ammonite, anomalocaris, bird, fish, hominin, humanFront, jellyfish, mammal, pterosaur, sauropod, tetrapod, trilobite,
} from "./organisms";
import { composite, Form, Look, LOOK_STRIDE, place, rigForm } from "./rig";
import { HUMAN_LEAF, polar, TREE, TREE_R, treeRotation } from "./tree";

export const N = 6400;

const lk = (h: number, s: number, l: number, size: number, a: number): Look => [h, s, l, size, a];

// ---------------------------------------------------------------------------
// free-particle forms
// ---------------------------------------------------------------------------
function field(seed: number, fn: (i: number, f: number, bx: number, by: number, r: number, out: Float32Array, j: number) => void, look: (r: number, i: number) => Look): Form {
  const cache = new Map<number, { bx: Float32Array; by: Float32Array; r: Float32Array; look: Float32Array }>();
  const bind = (n: number) => {
    let b = cache.get(n);
    if (!b) {
      const rnd = mulberry32(seed + n);
      b = { bx: new Float32Array(n), by: new Float32Array(n), r: new Float32Array(n), look: new Float32Array(n * LOOK_STRIDE) };
      for (let i = 0; i < n; i++) {
        b.bx[i] = rnd();
        b.by[i] = rnd();
        b.r[i] = rnd();
        b.look.set(look(rnd(), i), i * LOOK_STRIDE);
      }
      cache.set(n, b);
    }
    return b;
  };
  return {
    eval(f, xy, look, o, n) {
      const b = bind(n);
      for (let i = 0; i < n; i++) fn(i, f, b.bx[i], b.by[i], b.r[i], xy, (o + i) * 2);
      look.set(b.look, o * LOOK_STRIDE);
    },
  };
}

const wrap = (v: number, m: number) => ((v % m) + m) % m;

const soup = field(
  11,
  (i, f, bx, by, r, xy, j) => {
    if (r < 0.16) {
      // hydrothermal plume rising from the vent
      const life = wrap(bx + f * 0.004 * (0.6 + r * 3), 1);
      const spread = 40 + life * 380;
      xy[j] = 540 + (by - 0.5) * spread + 50 * noise2(by * 9, f * 0.01 + life * 3);
      xy[j + 1] = H - 120 - life * 1300;
      return;
    }
    const x = bx * (W + 200) - 100;
    const y = by * (H + 200) - 100;
    xy[j] = wrap(x + 110 * noise2(x * 0.0018, y * 0.0018 + f * 0.003) + f * 0.12, W + 200) - 100;
    xy[j + 1] = wrap(y + 110 * noise2(y * 0.0018 + 7, x * 0.0018 + f * 0.003) - f * 0.2, H + 200) - 100;
  },
  (r, i) => {
    const vent = i % 100 < 16;
    return vent ? lk(22 + 20 * r, 1, 0.8, 1.2 + 1.6 * r, 0.55) : lk(175 + 30 * r, 0.9, 0.55, 0.9 + 1.8 * r * r, 0.25 + 0.4 * r);
  },
);

const plankton = field(
  23,
  (i, f, bx, by, r, xy, j) => {
    xy[j] = wrap(bx * W + 40 * noise2(bx * 7, f * 0.004) + f * 0.05 * (r - 0.5), W);
    xy[j + 1] = wrap(by * H - f * (0.15 + 0.4 * r), H);
  },
  (r) => lk(185 + 40 * r, 0.8, 0.5, 0.7 + 2.6 * r * r, 0.2 + 0.35 * r),
);

const ash = field(
  31,
  (i, f, bx, by, r, xy, j) => {
    xy[j] = wrap(bx * W + 35 * Math.sin(f * 0.02 + i) + 60 * noise2(bx * 4, f * 0.003), W);
    xy[j + 1] = wrap(by * (H + 100) + (f - 1440) * (0.6 + 1.2 * r), H + 100) - 50;
  },
  (r) => lk(25, 0.12, 0.42 + 0.3 * r, 1 + 2.4 * r, 0.3 + 0.45 * r),
);

const seed = field(
  41,
  (i, f, bx, by, r, xy, j) => {
    const cx = 540;
    const cy = 880;
    if (r < 0.55) {
      const a = bx * Math.PI * 2;
      const d = Math.sqrt(by) * 16;
      xy[j] = cx + Math.cos(a) * d;
      xy[j + 1] = cy + Math.sin(a) * d;
    } else {
      const a = bx * Math.PI * 2 + f * (0.004 + 0.01 * by) * (r > 0.8 ? -1 : 1);
      const d = 40 + 260 * Math.pow(by, 1.6);
      xy[j] = cx + Math.cos(a) * d;
      xy[j + 1] = cy + Math.sin(a) * d * 0.98;
    }
  },
  (r) => (r < 0.55 ? lk(190, 0.4, 1, 1.2 + r, 0.8) : lk(180 + 40 * r, 0.9, 0.5, 0.8 + r, 0.25 + 0.3 * r)),
);

// ---------------------------------------------------------------------------
// embryo / colony
// ---------------------------------------------------------------------------
const embryoForm: Form = (() => {
  const cache = new Map<number, ReturnType<typeof embryoBinding>>();
  return {
    eval(f, xy, look, o, n) {
      let b = cache.get(n);
      if (!b) cache.set(n, (b = embryoBinding(n)));
      const cs = cells(Math.max(f, 240));
      const g = generation(Math.max(f, 240));
      for (let i = 0; i < n; i++) {
        const c = cs[b.code[i] >> (MAX_GEN - g)];
        const rot = f * (b.nucleus[i] ? 0.01 : 0.004) + (b.code[i] & 7);
        const cr = Math.cos(rot);
        const sr = Math.sin(rot);
        const ox = b.ox[i] * cr - b.oy[i] * sr;
        const oy = b.ox[i] * sr + b.oy[i] * cr;
        const j = (o + i) * 2;
        xy[j] = c.x + ox * c.r;
        xy[j + 1] = c.y + oy * c.r;
        const depth = 0.6 + 0.4 * (1 - c.z) / 2 + 0.2;
        const k = (o + i) * LOOK_STRIDE;
        look[k] = b.nucleus[i] ? c.hue + 20 : c.hue;
        look[k + 1] = 0.9;
        look[k + 2] = (b.nucleus[i] ? 1 : 0.55) * depth;
        look[k + 3] = b.nucleus[i] ? 1.6 : 1.1;
        look[k + 4] = b.nucleus[i] ? 0.85 : 0.45;
      }
    },
  };
})();

// ---------------------------------------------------------------------------
// organisms placed in the world
// ---------------------------------------------------------------------------
const L = (fn: (c: number, s: number, v: number, r: number) => Look) => fn;

const jellyLook = (hue: number) =>
  L((c, s, v, r) => {
    if (c === 0) return Math.abs(v) > 0.85 ? lk(hue, 1, 1, 1.5, 0.9) : lk(hue + 20 * s, 0.9, 0.45 + 0.4 * s, 1.3, 0.35);
    if (c <= 9) return lk(hue - 40 * s, 1, 0.8 - 0.4 * s, 1.0, 0.7);
    return lk(hue + 25, 1, 0.75, 1.3, 0.6);
  });

const CAMBRIAN_PARTS = [
  { form: rigForm((f) => place(jellyfish(f, 0), 300, 720 - (f - 720) * 0.45, 440), 720, jellyLook(305), 1), w: 22 },
  { form: rigForm((f) => place(jellyfish(f, 2), 820, 1230 - (f - 720) * 0.35, 250), 720, jellyLook(190), 2), w: 9 },
  {
    form: rigForm((f) => place(ammonite(f), 810 - (f - 720) * 0.35, 560, 380, 0.3), 720,
      L((c, s, v, r) => (c === 0 ? lk(40 + 20 * s, 0.75, (Math.cos(s * 120) > 0.2 ? 1 : 0.45) * (0.6 + 0.4 * Math.abs(v)), 1.3, 0.7) : lk(10, 1, 0.8, 1.1, 0.6))), 3),
    w: 13,
  },
  {
    form: rigForm((f) => place(anomalocaris(f), 800 - (f - 720) * 1.25, 1410 + 25 * Math.sin(f * 0.03), 600, Math.PI + 0.1), 720,
      L((c, s, v, r) => {
        if (c === 0) return lk(355 + 15 * s, 1, 0.7 + 0.3 * Math.abs(v), 1.3, 0.75);
        if (c <= 22) return lk(15, 1, 0.6, 1.1, 0.55);
        if (c <= 26 && c % 2 === 0) return lk(185, 1, 1, 1.6, 0.9);
        return lk(20, 1, 0.8, 1.2, 0.7);
      }), 4),
    w: 22,
  },
  {
    form: rigForm((f) => place(trilobite(f), 230 + (f - 720) * 0.25, 1700, 210, -0.2), 720,
      L((c, s, v, r) => (c === 0 ? lk(42, 0.95, (Math.cos(s * 70) > 0 ? 1 : 0.5) * (Math.abs(v) < 0.3 ? 1 : 0.65), 1.2, 0.75) : lk(35, 0.8, 0.7, 1, 0.6))), 5),
    w: 8,
  },
  {
    form: rigForm((f) => place(trilobite(f, 1.3), 860 - (f - 720) * 0.2, 1660, 165, Math.PI + 0.25), 720,
      L((c, s, v, r) => (c === 0 ? lk(28, 0.95, (Math.cos(s * 70) > 0 ? 1 : 0.5) * (Math.abs(v) < 0.3 ? 1 : 0.65), 1.2, 0.75) : lk(20, 0.8, 0.7, 1, 0.6))), 6),
    w: 6,
  },
  { form: plankton, w: 20 },
];
const cambrian = composite(CAMBRIAN_PARTS);

const fishLook = L((c, s, v, r) => {
  if (c === 0) return lk(195 + 15 * v, 1, v > 0.4 ? 1 : 0.55 + 0.45 * Math.abs(v), 1.3, 0.75);
  if (c === 6) return lk(60, 0.2, 1.4, 2.0, 1);
  return lk(265 + 20 * s, 1, 0.75, 1.1, 0.65);
});

const SCHOOL = Array.from({ length: 14 }, (_, k) => {
  const r = mulberry32(900 + k);
  return { dx: (r() - 0.5) * 700, dy: 150 + r() * 600, s: 90 + r() * 70, ph: r() * 6 };
});

const FISH_PARTS = [
  { form: rigForm((f) => place(fish(f), 470 + (f - 930) * 0.9, 1150 - (f - 930) * 1.6, 860, -0.5), 960, fishLook, 7), w: 80 },
  ...SCHOOL.map((q, k) => ({
    form: rigForm((f) => place(fish(f * 1.4, q.ph, 1.4), 460 + q.dx + (f - 930) * 1.1, 1250 + q.dy - (f - 930) * 1.9, q.s, -0.55), 960,
      L((c) => (c === 6 ? lk(60, 0.2, 1, 1.4, 0.9) : lk(175, 1, 0.7, 1.0, 0.6))), 100 + k),
    w: 1.4,
  })),
];
const fishForm = composite(FISH_PARTS);

const tetraForm = rigForm((f) => place(tetrapod(f), 250 + (f - 1070) * 1.5, 1262 - (f - 1070) * 0.08, 720), 1100,
  L((c, s, v, r) => {
    if (c === 6) return lk(60, 0.2, 1.4, 2, 1);
    const far = c === 4 || c === 5;
    return lk(110 + 30 * s + (c === 1 ? 20 : 0), 0.95, (far ? 0.4 : 0.7) + (v < -0.5 ? 0.3 : 0), 1.25, far ? 0.45 : 0.75);
  }), 8);

const sauroLook = L((c, s, v, r) => {
  if (c === 8) return lk(50, 0.2, 1.3, 1.8, 1);
  const far = c === 6 || c === 7;
  const rim = v < -0.7 ? 0.45 : 0;
  return lk(28 + 12 * (c === 1 ? s : 0) - (c === 3 ? 8 * s : 0), 1, (far ? 0.35 : 0.62) + rim, 1.5, far ? 0.4 : 0.75);
});

const gait = (f: number) => (f - 1200) / 120;

const SAURO_PARTS = [
  { form: rigForm((f) => place(sauropod(f, gait(f)), 330 + (f - 1200) * 0.5, 1420, 620), 1200, sauroLook, 9, { outline: 0.25 }), w: 86 },
  { form: rigForm((f) => place(pterosaur(f, 0), 90 + (f - 1170) * 1.1, 600 + 30 * Math.sin(f * 0.03), 300), 1200, L((c) => lk(12, 1, 0.75, 1.1, 0.7)), 10), w: 8 },
  { form: rigForm((f) => place(pterosaur(f, 1.6), 30 + (f - 1170) * 0.8, 760 + 20 * Math.sin(f * 0.025 + 1), 200), 1200, L((c) => lk(20, 1, 0.6, 1, 0.6)), 11), w: 6 },
];
const sauroForm = composite(SAURO_PARTS);

const mammalLook = L((c, s, v, r) => {
  if (c === 10) return lk(55, 0.2, 1.5, 2.2, 1);
  if (c >= 7) return lk(40, 0.3, 0.7, 0.8, 0.6);
  const far = c === 5 || c === 6;
  return lk(30 + 8 * s, 0.55, (far ? 0.35 : 0.6) + (v < -0.6 ? 0.35 : 0), 1.3, far ? 0.4 : 0.75);
});

const mammalForm = rigForm((f) => {
  const t = f - 1540;
  const run = 1 - smooth((t - 70) / 40);
  const rear = smooth((t - 95) / 30) * 0.45;
  return place(mammal(f, run, rear), 520 + 40 * run * Math.sin(t * 0.02), 1330, 900);
}, 1560, mammalLook, 12);

const BIRD_PARTS = [
  { form: rigForm((f) => place(mammal(f, 0, 0.45), 300, 1480, 420), 1700, mammalLook, 13), w: 26 },
  {
    form: rigForm((f) => {
      const t = f - 1680;
      return place(bird(f), 360 + t * 2.3, 1180 - t * 2.6, 760, -0.55);
    }, 1700,
      L((c, s, v, r) => {
        if (c === 6) return lk(50, 0.2, 1.5, 2, 1);
        if (c >= 4) return lk(190 + 60 * s + 20 * v, 1, 0.65 + 0.35 * s, 1.3, 0.75);
        return lk(200 + 30 * v, 1, 0.75, 1.3, 0.75);
      }), 14),
    w: 74,
  },
];
const birdForm = composite(BIRD_PARTS);

export const MARCH = [
  { p: 0, s: 380, x: 120 },
  { p: 0.28, s: 450, x: 315 },
  { p: 0.52, s: 510, x: 520 },
  { p: 0.76, s: 570, x: 725 },
  { p: 1, s: 640, x: 920 },
];
export const MARCH_GROUND = 1440;

const marchForm = composite(
  MARCH.map((m, k) => ({
    form: rigForm((f) => place(hominin(f, m.p, k * 0.21), m.x, MARCH_GROUND, m.s), 1800,
      L((c, s, v, r) => {
        const far = c === 3 || c === 5;
        return lk(lerp(28, 190, m.p) + 10 * s, lerp(0.95, 0.7, m.p), (far ? 0.4 : 0.7) + (v < -0.6 ? 0.3 : 0), 1.25, far ? 0.45 : 0.8);
      }), 20 + k, { outline: 0.4 }),
    w: m.s,
  })),
);

const humanForm = rigForm((f) => place(humanFront(f, smooth((f - 1922) / 62)), 540, 1600, 900), 1900,
  L((c, s, v, r) => lk(185 + 30 * Math.abs(v) + (c === 2 ? 10 : 0), 0.85, 0.5 + 0.5 * (Math.abs(v) > 0.85 ? 1 : 0.45 * r), 1.3, 0.72)), 30, { outline: 0.18 });

/** Single organisms, frozen at a flattering frame, for stills such as the cover. */
export const SPECIMENS: { name: string; age: string; form: Form; f: number }[] = [
  { name: "细胞", age: "38 亿年前", form: embryoForm, f: 520 },
  { name: "奇虾", age: "5.2 亿年前", form: CAMBRIAN_PARTS[3].form, f: 820 },
  { name: "鱼", age: "4.4 亿年前", form: FISH_PARTS[0].form, f: 990 },
  { name: "四足动物", age: "3.7 亿年前", form: tetraForm, f: 1110 },
  { name: "恐龙", age: "1.6 亿年前", form: SAURO_PARTS[0].form, f: 1290 },
  { name: "哺乳动物", age: "6600 万年前", form: mammalForm, f: 1580 },
  { name: "鸟", age: "6000 万年前", form: BIRD_PARTS[1].form, f: 1712 },
  { name: "智人", age: "30 万年前", form: humanForm, f: 1990 },
];

// ---------------------------------------------------------------------------
// DNA double helix
// ---------------------------------------------------------------------------
const BASE_HUE = [95, 30, 265, 210]; // A T C G
const RUNGS = 30;
const SEQ = (() => {
  const r = mulberry32(4);
  return Array.from({ length: RUNGS }, () => Math.floor(r() * 4));
})();
export const DNA_SEQ = SEQ;
export const helixAt = (f: number, s: number, strand: 0 | 1) => {
  const top = 150;
  const bot = 1770;
  const R = 230;
  const turns = 3.2;
  const th = s * turns * Math.PI * 2 + f * 0.032 + strand * Math.PI;
  const x3 = Math.cos(th) * R;
  const z = Math.sin(th) * R;
  const y3 = top + s * (bot - top);
  const k = 1500 / (1500 + z);
  return { x: 540 + x3 * k, y: 960 + (y3 - 960) * k, z: z / R, k };
};

const dnaForm: Form = (() => {
  const cache = new Map<number, Float32Array>();
  return {
    eval(f, xy, look, o, n) {
      let b = cache.get(n);
      if (!b) {
        const r = mulberry32(77 + n);
        b = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) b.set([r(), r(), r(), r()], i * 4);
        cache.set(n, b);
      }
      for (let i = 0; i < n; i++) {
        const [kind, s0, u, jit] = [b[i * 4], b[i * 4 + 1], b[i * 4 + 2], b[i * 4 + 3]];
        const j = (o + i) * 2;
        const k = (o + i) * LOOK_STRIDE;
        if (kind < 0.62) {
          const strand = kind < 0.31 ? 0 : 1;
          const s = wrap(s0 + f * 0.0006 * (strand ? 1 : -1), 1);
          const p = helixAt(f, s, strand as 0 | 1);
          const a = jit * Math.PI * 2;
          xy[j] = p.x + Math.cos(a) * 13 * p.k * u;
          xy[j + 1] = p.y + Math.sin(a) * 13 * p.k * u;
          const front = (1 - p.z) / 2;
          look[k] = strand ? 310 : 188;
          look[k + 1] = 1;
          look[k + 2] = 0.35 + 0.75 * front;
          look[k + 3] = 1.2 + 0.9 * front;
          look[k + 4] = 0.4 + 0.5 * front;
        } else {
          const m = Math.floor(s0 * RUNGS);
          const s = (m + 0.5) / RUNGS;
          const A = helixAt(f, s, 0);
          const B = helixAt(f, s, 1);
          const t = 0.06 + 0.88 * u;
          xy[j] = lerp(A.x, B.x, t) + (jit - 0.5) * 6;
          xy[j + 1] = lerp(A.y, B.y, t) + (jit - 0.5) * 6;
          const base = SEQ[m];
          const pair = [1, 0, 3, 2][base];
          const z = lerp(A.z, B.z, t);
          const front = (1 - z) / 2;
          look[k] = BASE_HUE[t < 0.5 ? base : pair];
          look[k + 1] = 1;
          look[k + 2] = 0.3 + 0.7 * front;
          look[k + 3] = 1.1 + 0.6 * front;
          look[k + 4] = 0.35 + 0.45 * front;
        }
      }
    },
  };
})();

// ---------------------------------------------------------------------------
// Tree of life
// ---------------------------------------------------------------------------
const treeForm: Form = (() => {
  const cache = new Map<number, Float32Array>();
  const segs = TREE.branches;
  const lens = segs.map((s) => Math.abs(s.r1 - s.r0) + Math.abs(s.a1 - s.a0) * s.r0 + 1);
  const total = lens.reduce((a, x) => a + x, 0);
  return {
    eval(f, xy, look, o, n) {
      let b = cache.get(n);
      if (!b) {
        const r = mulberry32(99 + n);
        b = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          const leafy = r() < 0.6;
          let idx: number;
          if (leafy) idx = Math.floor(r() * TREE.leaves.length);
          else {
            let x = r() * total;
            idx = 0;
            while (idx < segs.length - 1 && x > lens[idx]) x -= lens[idx++];
          }
          b.set([leafy ? 1 : 0, idx, r(), r()], i * 4);
        }
        cache.set(n, b);
      }
      const rot = treeRotation(f);
      for (let i = 0; i < n; i++) {
        const leafy = b[i * 4] > 0.5;
        const idx = b[i * 4 + 1];
        const u = b[i * 4 + 2];
        const w = b[i * 4 + 3];
        const j = (o + i) * 2;
        const k = (o + i) * LOOK_STRIDE;
        if (leafy) {
          const leaf = TREE.leaves[idx];
          const me = idx === HUMAN_LEAF;
          const [x, y] = polar(leaf.a, TREE_R + 6 + u * 10, rot);
          xy[j] = x + (w - 0.5) * 6;
          xy[j + 1] = y + (u - 0.5) * 6;
          look[k] = me ? 50 : [95, 35, 190][leaf.domain] + 30 * (w - 0.5);
          look[k + 1] = me ? 0.3 : 1;
          look[k + 2] = me ? 1.6 : 0.85;
          look[k + 3] = me ? 2 : 1.3;
          look[k + 4] = me ? 1 : 0.7;
        } else {
          const sgm = segs[idx];
          const a = lerp(sgm.a0, sgm.a1, u);
          const rr = lerp(sgm.r0, sgm.r1, u);
          const [x, y] = polar(a, rr, rot);
          xy[j] = x;
          xy[j + 1] = y;
          look[k] = [95, 35, 190][sgm.domain];
          look[k + 1] = 0.9;
          look[k + 2] = 0.5;
          look[k + 3] = 0.9;
          look[k + 4] = 0.35;
        }
      }
    },
  };
})();

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------
type Warp = (x: number, y: number, t: number, i: number) => [number, number];
type Stage = { form: Form; from: number; dur: number; swirl?: number; burst?: [number, number]; warpA?: Warp };

const zoomInto = (cx: number, cy: number, amount: number): Warp => (x, y, t) => {
  const k = 1 + amount * easeIn(t);
  return [cx + (x - cx) * k, cy + (y - cy) * k];
};

export const STAGES: Stage[] = [
  { form: soup, from: -100, dur: 1 },
  { form: embryoForm, from: 180, dur: 60, swirl: 160 },
  { form: cambrian, from: 714, dur: 46, swirl: 120, burst: [540, 880] },
  { form: fishForm, from: 925, dur: 50, swirl: 140 },
  { form: tetraForm, from: 1062, dur: 46, swirl: 110 },
  { form: sauroForm, from: 1160, dur: 50, swirl: 120 },
  { form: ash, from: 1440, dur: 60, swirl: 60, burst: [760, 1000] },
  { form: mammalForm, from: 1530, dur: 50, swirl: 100 },
  { form: birdForm, from: 1672, dur: 36, swirl: 90 },
  { form: marchForm, from: 1762, dur: 46, swirl: 110 },
  { form: humanForm, from: 1880, dur: 48, swirl: 110 },
  { form: dnaForm, from: 2000, dur: 50, swirl: 90, warpA: zoomInto(540, 800, 5) },
  { form: treeForm, from: 2240, dur: 60, swirl: 150 },
  { form: seed, from: 2610, dur: 80, swirl: 120 },
];

const stageIndex = (f: number) => {
  let k = 0;
  for (let i = 0; i < STAGES.length; i++) if (f >= STAGES[i].from) k = i;
  return k;
};

const DELAY = (() => {
  const r = mulberry32(5);
  return Float32Array.from({ length: N }, () => r());
})();

const bufA = { xy: new Float32Array(N * 2), look: new Float32Array(N * LOOK_STRIDE) };
const bufB = { xy: new Float32Array(N * 2), look: new Float32Array(N * LOOK_STRIDE) };
const out = { xy: new Float32Array(N * 2), look: new Float32Array(N * LOOK_STRIDE) };
const tmp: [number, number] = [0, 0];

const hueLerp = (a: number, b: number, t: number) => {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
};

/** Particle positions and looks for a frame. */
export function swarm(f: number) {
  const k = stageIndex(f);
  const st = STAGES[k];
  const t = (f - st.from) / st.dur;
  if (k === 0 || t >= 1) {
    st.form.eval(f, out.xy, out.look, 0, N);
    return out;
  }
  const prev = STAGES[k - 1];
  prev.form.eval(f, bufA.xy, bufA.look, 0, N);
  st.form.eval(f, bufB.xy, bufB.look, 0, N);
  const spread = 0.7;
  const swirl = st.swirl ?? 100;
  for (let i = 0; i < N; i++) {
    const ti = clamp(t * (1 + spread) - DELAY[i] * spread);
    let ax = bufA.xy[i * 2];
    let ay = bufA.xy[i * 2 + 1];
    if (st.warpA) [ax, ay] = st.warpA(ax, ay, ti, i);
    if (st.burst) {
      const [bx, by] = st.burst;
      const dx = ax - bx;
      const dy = ay - by;
      const d = Math.hypot(dx, dy) + 1;
      const kick = easeOut(Math.min(1, ti * 2.2)) * (380 + 300 * DELAY[i]);
      ax += (dx / d) * kick;
      ay += (dy / d) * kick;
    }
    const e = st.burst ? smooth(clamp(ti * 1.5 - 0.5)) : easeInOut(ti);
    const bx = bufB.xy[i * 2];
    const by = bufB.xy[i * 2 + 1];
    curl(ax * 0.0025 + i * 0.0001, ay * 0.0025 + f * 0.01, tmp);
    const sw = Math.sin(Math.PI * ti) * swirl;
    out.xy[i * 2] = lerp(ax, bx, e) + tmp[0] * sw;
    out.xy[i * 2 + 1] = lerp(ay, by, e) + tmp[1] * sw;
    const ka = i * LOOK_STRIDE;
    out.look[ka] = hueLerp(bufA.look[ka], bufB.look[ka], e);
    for (let q = 1; q < LOOK_STRIDE; q++) out.look[ka + q] = lerp(bufA.look[ka + q], bufB.look[ka + q], e);
  }
  return out;
}

export const stageAt = (f: number) => STAGES[stageIndex(f)];
export const morphAmount = (f: number) => {
  const st = stageAt(f);
  return clamp((f - st.from) / st.dur);
};
export { progress };
