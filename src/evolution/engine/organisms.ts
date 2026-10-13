import { Chain, grow, poly, prof, seg } from "./rig";

/*
 * Skeletons in local units (body length ≈ 1). x points forward (head), y points down.
 * Every function returns the same number of chains, in the same order, for any t.
 */

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Cambrian sea
// ---------------------------------------------------------------------------
export function jellyfish(t: number, ph = 0): Chain[] {
  const p = Math.sin(t * 0.11 + ph);
  const squeeze = (s: number) => 1 - 0.16 * p * s * s;
  const bell = poly(12, (s) => [0, -0.46 + s * 0.42 - 0.03 * p, (0.02 + 0.33 * Math.sqrt(1 - (1 - s) ** 2)) * squeeze(s)]);
  const rimY = -0.04 - 0.03 * p;
  const out: Chain[] = [bell];
  for (let k = 0; k < 9; k++) {
    const x0 = (-0.29 + (k * 0.58) / 8) * squeeze(1);
    out.push(poly(14, (s) => [x0 * (1 - 0.25 * s) + 0.07 * s * Math.sin(5 * s - t * 0.07 + k * 1.3), rimY + s * (0.85 + 0.12 * Math.sin(k * 2.1)), 0.006]));
  }
  for (let k = 0; k < 3; k++) {
    const x0 = (k - 1) * 0.06;
    out.push(poly(12, (s) => [x0 + 0.05 * s * Math.sin(3 * s - t * 0.05 + k * 2), rimY - 0.04 + s * 0.6, 0.035 * (1 - s) + 0.008]));
  }
  return out;
}

export function trilobite(t: number, ph = 0): Chain[] {
  const body = poly(16, (s) => [0.5 - s, 0, prof(s, [[0, 0.1], [0.12, 0.3], [0.26, 0.31], [0.75, 0.2], [0.92, 0.1], [1, 0.03]])]);
  const out: Chain[] = [body];
  for (const side of [-1, 1]) {
    out.push(grow(0.47, side * 0.05, (s) => -side * 0.1 + side * (0.5 + 0.25 * s + 0.08 * Math.sin(t * 0.09 + ph)), 0.32, 7, (s) => 0.012 * (1 - s) + 0.004));
  }
  for (let k = 0; k < 9; k++) {
    const x = 0.25 - k * 0.06;
    const s = (0.5 - x);
    const r = prof(s, [[0, 0.1], [0.12, 0.3], [0.26, 0.31], [0.75, 0.2], [0.92, 0.1], [1, 0.03]]);
    for (const side of [-1, 1]) {
      const a = side * (Math.PI / 2 + 0.35 + 0.25 * Math.sin(t * 0.3 + k * 0.8 + ph + (side > 0 ? Math.PI : 0)));
      out.push(grow(x, side * r * 0.95, () => a, 0.07, 3, (q) => 0.01 * (1 - q) + 0.003));
    }
  }
  return out;
}

export function anomalocaris(t: number): Chain[] {
  const wav = (s: number) => 0.025 * Math.sin(4 * s - t * 0.09);
  const pr: [number, number][] = [[0, 0.07], [0.14, 0.12], [0.6, 0.1], [0.9, 0.05], [1, 0.03]];
  const body = poly(16, (s) => [0.5 - s, wav(s), prof(s, pr)]);
  const out: Chain[] = [body];
  for (let k = 0; k < 11; k++) {
    const s = 0.16 + k * 0.064;
    const r = prof(s, pr);
    for (const side of [-1, 1]) {
      const a = side * (Math.PI / 2 + 0.45 + 0.42 * Math.sin(t * 0.16 - k * 0.55));
      out.push(grow(0.5 - s, wav(s) + side * r * 0.9, () => a, 0.15 * (1 - k / 15), 3, (q) => 0.05 * (1 - q) + 0.008));
    }
  }
  for (const side of [-1, 1]) {
    const curlA = 0.25 + 0.12 * Math.sin(t * 0.05);
    out.push(grow(0.5, side * 0.035, (s) => side * (0.15 + s * 9 * curlA), 0.3, 10, (s) => 0.024 * (1 - s) + 0.007));
    out.push(seg([[0.42, side * 0.06, 0.01], [0.45, side * 0.15, 0.03]]));
  }
  for (const a of [-0.5, 0, 0.5]) {
    out.push(grow(-0.5, wav(1), () => Math.PI + a + 0.15 * Math.sin(t * 0.1), 0.14, 4, (s) => 0.035 * (1 - s) + 0.006));
  }
  return out;
}

export function ammonite(t: number): Chain[] {
  const b = 0.19;
  const turns = 3.3 * Math.PI;
  const rot = 0.06 * Math.sin(t * 0.03);
  const shell = poly(44, (s) => {
    const th = s * turns;
    const rr = 0.032 * Math.exp(b * th);
    return [rr * Math.cos(th + rot), rr * Math.sin(th + rot), rr * 0.36];
  });
  const end = shell[shell.length - 1];
  const prev = shell[shell.length - 2];
  const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
  const out: Chain[] = [shell];
  for (let k = 0; k < 9; k++) {
    const off = (k / 8 - 0.5) * end.r * 1.6;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    out.push(grow(end.x + nx * off, end.y + ny * off, (s) => ang + (k / 8 - 0.5) * 0.9 + 0.6 * s * Math.sin(t * 0.08 + k), 0.24, 8, (s) => 0.012 * (1 - s) + 0.003));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vertebrates
// ---------------------------------------------------------------------------
export function fish(t: number, ph = 0, amp = 1): Chain[] {
  const w = t * 0.22 + ph;
  const lat = (s: number) => amp * (0.012 + 0.07 * s * s) * Math.sin(6.5 * s - w);
  const pr: [number, number][] = [[0, 0.035], [0.08, 0.085], [0.25, 0.125], [0.55, 0.09], [0.85, 0.03], [1, 0.018]];
  const body = poly(18, (s) => [0.5 - s, lat(s), prof(s, pr)]);
  const tb = body[body.length - 1];
  const tp = body[body.length - 2];
  const ta = Math.atan2(tb.y - tp.y, tb.x - tp.x);
  const lobe = (d: number) => grow(tb.x, tb.y, (s) => ta + d * (0.5 + 0.25 * s), 0.2, 5, (s) => 0.04 * (1 - s) + 0.005);
  const at = (s: number) => body[Math.round(s * (body.length - 1))];
  const d = at(0.32);
  const pc = at(0.24);
  const an = at(0.66);
  return [
    body,
    lobe(-1),
    lobe(1),
    grow(d.x, d.y - d.r * 0.9, (s) => -Math.PI / 2 - 0.9 - 0.4 * s, 0.17, 5, (s) => 0.035 * (1 - s) + 0.004),
    grow(pc.x, pc.y + pc.r * 0.8, (s) => Math.PI / 2 + 0.9 + 0.3 * s + 0.15 * Math.sin(w * 1.3), 0.14, 4, (s) => 0.03 * (1 - s) + 0.004),
    grow(an.x, an.y + an.r * 0.9, () => Math.PI / 2 + 1.0, 0.08, 3, (s) => 0.022 * (1 - s) + 0.003),
    seg([[0.41, -0.025, 0.016], [0.415, -0.025, 0.016]]),
  ];
}

/** Two-segment leg with foot planted on y=0 during stance and lifted during swing. */
function leg(hx: number, hy: number, phase: number, stride: number, lift: number, knee: number, r: [number, number, number], groundY = 0): Chain {
  const ph = ((phase % 1) + 1) % 1;
  const stance = 0.72;
  let fx: number;
  let fy: number;
  if (ph < stance) {
    fx = hx + stride * (0.5 - ph / stance);
    fy = groundY;
  } else {
    const q = (ph - stance) / (1 - stance);
    fx = hx + stride * (-0.5 + q);
    fy = groundY - lift * Math.sin(Math.PI * q);
  }
  const mx = (hx + fx) / 2 + knee;
  const my = (hy + fy) / 2 - Math.abs(knee) * 0.3;
  return seg([[hx, hy, r[0]], [mx, my, r[1]], [fx, fy, r[2]], [fx + 0.03, fy, r[2] * 0.7]]);
}

export function tetrapod(t: number): Chain[] {
  const g = t / 40;
  const bob = 0.01 * Math.sin(g * TAU * 2);
  const pr: [number, number][] = [[0, 0.022], [0.1, 0.045], [0.18, 0.04], [0.3, 0.055], [0.6, 0.064], [1, 0.045]];
  const body = poly(14, (s) => [0.38 - s * 0.72, -0.17 + bob - 0.02 * Math.sin(Math.PI * s) + 0.015 * Math.sin(3 * s - g * TAU), prof(s, pr)]);
  const tail = grow(-0.34, -0.17 + bob, (s) => Math.PI - 0.12 + 0.18 * s + 0.1 * Math.sin(g * TAU - s * 3), 0.55, 12, (s) => 0.045 * (1 - s) + 0.004);
  const legs = [
    leg(0.17, -0.15 + bob, g, 0.16, 0.06, 0.05, [0.03, 0.026, 0.02]),
    leg(-0.3, -0.15 + bob, g + 0.5, 0.16, 0.06, -0.05, [0.034, 0.028, 0.02]),
    leg(0.19, -0.16 + bob, g + 0.5, 0.16, 0.06, 0.05, [0.026, 0.022, 0.017]),
    leg(-0.28, -0.16 + bob, g, 0.16, 0.06, -0.05, [0.028, 0.024, 0.017]),
  ];
  return [body, tail, ...legs, seg([[0.33, -0.205 + bob, 0.012], [0.335, -0.205 + bob, 0.012]])];
}

/** Sauropod; `g` is gait phase in cycles (1 cycle = 4 footfalls). */
export function sauropod(t: number, g: number): Chain[] {
  const bob = 0.012 * Math.abs(Math.sin(g * TAU * 2));
  const body = poly(9, (s) => [0.4 - s * 0.8, -0.7 + bob - 0.05 * Math.sin(Math.PI * s), prof(s, [[0, 0.21], [0.45, 0.28], [1, 0.22]])]);
  const sway = 0.06 * Math.sin(t * 0.025);
  const neck = grow(0.36, -0.8 + bob, (s) => -1.08 + 0.45 * s + sway * s, 0.88, 12, (s) => 0.13 * (1 - s) + 0.045);
  const ne = neck[neck.length - 1];
  const head = grow(ne.x, ne.y, (s) => 0.25 + 0.3 * s, 0.13, 4, (s) => 0.05 * (1 - s) + 0.022);
  const tail = grow(-0.38, -0.72 + bob, (s) => Math.PI - 0.5 + 0.62 * s + 0.07 * Math.sin(t * 0.04 - s * 3) * s, 1.15, 18, (s) => 0.16 * (1 - s) ** 1.2 + 0.006);
  const L = (hx: number, hy: number, k: number, knee: number, r: [number, number, number]) =>
    leg(hx, hy + bob, g - k * 0.25, 0.3, 0.08, knee, r);
  return [
    body, neck, head, tail,
    L(-0.25, -0.6, 0, -0.04, [0.12, 0.09, 0.08]),
    L(0.25, -0.62, 1, 0.035, [0.1, 0.08, 0.075]),
    L(-0.17, -0.62, 2, -0.04, [0.1, 0.075, 0.065]),
    L(0.33, -0.64, 3, 0.035, [0.085, 0.07, 0.06]),
    seg([[ne.x + 0.08, ne.y - 0.005, 0.012], [ne.x + 0.085, ne.y - 0.005, 0.012]]),
  ];
}

export function pterosaur(t: number, ph = 0): Chain[] {
  const a = Math.sin(t * 0.2 + ph);
  const body = seg([[0.14, 0, 0.015], [0.05, 0.005, 0.03], [-0.08, 0.01, 0.025], [-0.14, 0.012, 0.006]]);
  const beak = seg([[0.14, 0, 0.018], [0.3, 0.02, 0.003]]);
  const crest = seg([[0.13, -0.01, 0.012], [0.04, -0.08, 0.003]]);
  const wing = (k: number, len: number) => grow(0.03, -0.005, (s) => -Math.PI / 2 - 0.25 - a * 1.1 * (k ? 0.85 : 1) + 0.6 * s, len, 6, (s) => 0.085 * (1 - s) ** 0.8 + 0.004);
  return [body, beak, crest, wing(0, 0.55), wing(1, 0.42)];
}

export function mammal(t: number, run = 1, rear = 0): Chain[] {
  const g = t / 9 * run;
  const bob = 0.012 * Math.abs(Math.sin(g * TAU)) * run;
  const tilt = rear * 0.9;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const R = (x: number, y: number): [number, number] => {
    const px = x + 0.22;
    return [px * ct + y * st - 0.22, -px * st + y * ct];
  };
  const pr: [number, number][] = [[0, 0.008], [0.12, 0.035], [0.22, 0.05], [0.3, 0.045], [0.6, 0.085], [0.88, 0.075], [1, 0.045]];
  const body = poly(14, (s) => {
    const [x, y] = R(0.3 - 0.58 * s, -0.11 - bob - 0.03 * Math.sin(Math.PI * s) + 0.01 * Math.sin(t * 0.2) * (1 - s));
    return [x, y, prof(s, pr)];
  });
  const [ex, ey] = R(0.19, -0.165 - bob);
  const [eyx, eyy] = R(0.235, -0.13 - bob);
  const [tx, ty] = R(-0.28, -0.1 - bob);
  const ear = seg([[ex, ey, 0.022], [ex - 0.02, ey - 0.05, 0.012]]);
  const tail = grow(tx, ty, (s) => Math.PI + 0.3 - 1.2 * s + 0.2 * Math.sin(t * 0.15 + s * 4) - tilt, 0.42, 10, (s) => 0.012 * (1 - s) + 0.004);
  const [fhx, fhy] = R(0.12, -0.08 - bob);
  const [hhx, hhy] = R(-0.2, -0.08 - bob);
  const legs = [
    leg(fhx, fhy, g, 0.1 * run, 0.04 * run, 0.02, [0.022, 0.018, 0.014]),
    leg(hhx, hhy, g + 0.5, 0.1 * run, 0.04 * run, -0.03, [0.03, 0.022, 0.014]),
    leg(fhx + 0.01, fhy, g + 0.5, 0.1 * run, 0.04 * run, 0.02, [0.018, 0.015, 0.012]),
    leg(hhx + 0.01, hhy, g, 0.1 * run, 0.04 * run, -0.03, [0.024, 0.018, 0.012]),
  ];
  const whiskers = [-1, 0, 1].map((k) => {
    const [wx, wy] = R(0.29, -0.115 - bob);
    return grow(wx, wy, () => -0.2 + k * 0.25, 0.12, 3, () => 0.003);
  });
  return [body, ear, tail, ...legs, ...whiskers, seg([[eyx, eyy, 0.013], [eyx + 0.004, eyy, 0.013]])];
}

export function bird(t: number): Chain[] {
  const a = Math.sin(t * 0.21);
  const body = seg([[0.32, 0.01, 0.004], [0.24, -0.005, 0.03], [0.19, -0.01, 0.045], [0.11, 0.005, 0.042], [0, 0.01, 0.075], [-0.12, 0.012, 0.065], [-0.22, 0.01, 0.035]]);
  const tail = [-0.35, 0, 0.35].map((d) => grow(-0.22, 0.01, () => Math.PI + d * 0.6, 0.2, 4, (s) => 0.028 * (1 - s) + 0.014));
  const wing = (k: number, len: number) =>
    grow(0.02, -0.03, (s) => -Math.PI / 2 - 0.35 - a * 1.15 * (k ? 0.9 : 1) + (0.35 + 0.5 * Math.max(0, -a)) * s * 1.4, len, 7, (s) => prof(s, [[0, 0.09], [0.45, 0.085], [0.8, 0.05], [1, 0.012]]));
  return [body, ...tail, wing(0, 0.62), wing(1, 0.5), seg([[0.215, -0.02, 0.01], [0.218, -0.02, 0.01]])];
}

// ---------------------------------------------------------------------------
// Hominins. Feet on y=0, upright head top at y≈-1.
// ---------------------------------------------------------------------------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hominin(t: number, p: number, ph = 0): Chain[] {
  const g = t / 36 + ph;
  const w = g * TAU;
  const lean = lerp(1.05, 0.04, p);
  const legL = lerp(0.36, 0.5, p);
  const armL = lerp(0.6, 0.42, p);
  const torso = lerp(0.36, 0.34, p);
  const kneeBase = lerp(0.35, 0.04, p);
  const hipY = -legL * Math.cos(kneeBase * 0.5) * 0.98 - 0.006 * Math.abs(Math.sin(w));
  const hip = { x: 0, y: hipY };
  const legC = (q: number, dim: number): Chain => {
    const th = 0.42 * Math.sin(w + q);
    const bend = kneeBase + 0.55 * Math.max(0, Math.sin(w + q + 1.4));
    const kx = hip.x + (legL / 2) * Math.sin(th);
    const ky = hip.y + (legL / 2) * Math.cos(th);
    const sh = th - bend;
    const ax = kx + (legL / 2) * Math.sin(sh);
    const ay = Math.min(0, ky + (legL / 2) * Math.cos(sh));
    return seg([[hip.x, hip.y, 0.055 * dim], [kx, ky, 0.04 * dim], [ax, ay, 0.03 * dim], [ax + 0.07, ay, 0.018 * dim]]);
  };
  const nx = hip.x + torso * Math.sin(lean);
  const ny = hip.y - torso * Math.cos(lean);
  const trunk = seg([
    [hip.x, hip.y, 0.075],
    [lerp(hip.x, nx, 0.55), lerp(hip.y, ny, 0.55), 0.085],
    [lerp(hip.x, nx, 0.85), lerp(hip.y, ny, 0.85), 0.08],
    [nx, ny, 0.04],
  ]);
  const hl = lerp(0.55, 0.12, p);
  const hx = nx + 0.075 * Math.sin(lean + hl);
  const hy = ny - 0.075 * Math.cos(lean + hl);
  const head = seg([[nx, ny, 0.035], [hx, hy, 0.062], [hx + 0.045 * Math.sin(lean + hl), hy - 0.045 * Math.cos(lean + hl), 0.055], [hx + lerp(0.07, 0.05, p), hy + 0.01, lerp(0.03, 0.012, p)]]);
  const sx = lerp(hip.x, nx, 0.85);
  const sy = lerp(hip.y, ny, 0.85);
  const armC = (q: number, dim: number): Chain => {
    const base = lerp(0.55, 0.0, p);
    const al = -0.45 * Math.sin(w + q) + base;
    const ex = sx + (armL / 2) * Math.sin(al);
    const ey = sy + (armL / 2) * Math.cos(al);
    const fx = ex + (armL / 2) * Math.sin(al + lerp(0.1, 0.35, p));
    const fy = Math.min(0, ey + (armL / 2) * Math.cos(al + lerp(0.1, 0.35, p)));
    return seg([[sx, sy, 0.04 * dim], [ex, ey, 0.032 * dim], [fx, fy, 0.026 * dim], [fx + 0.02, fy + 0.03, 0.02 * dim]]);
  };
  return [trunk, head, legC(0, 1), legC(Math.PI, 0.85), armC(Math.PI, 1), armC(0, 0.85)];
}

export function humanFront(t: number, raise: number): Chain[] {
  const br = 1 + 0.025 * Math.sin(t * 0.09);
  const legs = [-1, 1].map((sx) => seg([[sx * 0.055, -0.49, 0.085], [sx * 0.068, -0.4, 0.066], [sx * 0.078, -0.28, 0.042], [sx * 0.08, -0.17, 0.04], [sx * 0.085, -0.05, 0.026], [sx * 0.1, -0.01, 0.022], [sx * 0.13, 0, 0.016]]));
  const torso = seg([[0, -0.47, 0.105], [0, -0.53, 0.098], [0, -0.6, 0.085], [0, -0.68, 0.1 * br], [0, -0.75, 0.115 * br], [0, -0.8, 0.105], [0, -0.84, 0.04]]);
  const shoulders = seg([[-0.17, -0.795, 0.045], [-0.08, -0.81, 0.05], [0.08, -0.81, 0.05], [0.17, -0.795, 0.045]]);
  const lift = 0.012 * raise;
  const head = seg([[0, -0.85, 0.035], [0, -0.885 - lift, 0.05], [0, -0.92 - lift, 0.062], [0, -0.96 - lift, 0.058], [0, -0.99 - lift, 0.035]]);
  const a = lerp(0.16, 2.25, raise) + 0.04 * Math.sin(t * 0.09);
  const arms = [-1, 1].map((sx) => {
    const ex = sx * 0.17 + sx * 0.2 * Math.sin(a);
    const ey = -0.79 + 0.2 * Math.cos(a);
    const a2 = a + lerp(0.04, 0.35, raise);
    const hx = ex + sx * 0.18 * Math.sin(a2);
    const hy = ey + 0.18 * Math.cos(a2);
    const mx = (sx * 0.17 + ex) / 2;
    const my = (-0.79 + ey) / 2;
    return seg([[sx * 0.17, -0.79, 0.044], [mx, my, 0.038], [ex, ey, 0.03], [(ex + hx) / 2, (ey + hy) / 2, 0.027], [hx, hy, 0.022], [hx + sx * 0.05 * Math.sin(a2), hy + 0.05 * Math.cos(a2), 0.024]]);
  });
  return [torso, shoulders, head, ...legs, ...arms];
}
