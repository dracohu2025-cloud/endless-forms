import { mulberry32 } from "../lib/math";

/**
 * A circular, time-calibrated tree of life. Root (LUCA) in the centre, three
 * domains, and every living lineage ending on the outer ring ("today").
 */
export type Branch = { a0: number; a1: number; r0: number; r1: number; domain: number; depth: number };
export type Leaf = { a: number; domain: number };

export const TREE_CX = 540;
export const TREE_CY = 960;
export const TREE_R = 430;
const MAX_DEPTH = 9;

export const DOMAINS = [
  { name: "细菌", en: "BACTERIA", hue: 95 },
  { name: "古菌", en: "ARCHAEA", hue: 35 },
  { name: "真核生物", en: "EUKARYOTA", hue: 190 },
];

function build() {
  const r = mulberry32(2026);
  const branches: Branch[] = [];
  const leaves: Leaf[] = [];
  const spans: [number, number][] = [
    [-Math.PI / 2 - 0.3, -Math.PI / 2 - 0.3 + 2.1],
    [-Math.PI / 2 - 0.3 + 2.18, -Math.PI / 2 - 0.3 + 3.55],
    [-Math.PI / 2 - 0.3 + 3.63, -Math.PI / 2 - 0.3 + Math.PI * 2 - 0.08],
  ];
  const rec = (a0: number, a1: number, rStart: number, depth: number, domain: number) => {
    const a = (a0 + a1) / 2;
    const isLeaf = depth >= MAX_DEPTH || (depth > 4 && r() < 0.12) || a1 - a0 < 0.012;
    const rEnd = isLeaf ? TREE_R : Math.min(TREE_R - 8, rStart + (TREE_R - rStart) * (0.18 + 0.32 * r()));
    branches.push({ a0: a, a1: a, r0: rStart, r1: rEnd, domain, depth });
    if (isLeaf) {
      leaves.push({ a, domain });
      return;
    }
    const k = r() < 0.72 ? 2 : 3;
    const cuts = [a0];
    for (let i = 1; i < k; i++) cuts.push(a0 + ((a1 - a0) * (i + (r() - 0.5) * 0.5)) / k);
    cuts.push(a1);
    for (let i = 0; i < k; i++) {
      const ca = (cuts[i] + cuts[i + 1]) / 2;
      branches.push({ a0: a, a1: ca, r0: rEnd, r1: rEnd, domain, depth: depth + 0.5 });
      rec(cuts[i], cuts[i + 1], rEnd, depth + 1, domain);
    }
  };
  const rootR = 26;
  spans.forEach(([a0, a1], d) => {
    const a = (a0 + a1) / 2;
    branches.push({ a0: -Math.PI / 2, a1: a, r0: rootR, r1: rootR, domain: d, depth: 0 });
    rec(a0, a1, rootR, 1, d);
  });
  return { branches, leaves };
}

export const TREE = build();

/** The leaf that is us: a eukaryote low on the left of the ring, where there is room for a label. */
export const HUMAN_LEAF = (() => {
  let best = 0;
  let bd = 1e9;
  TREE.leaves.forEach((l, i) => {
    if (l.domain !== 2) return;
    const d = Math.abs(l.a - 2.05);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
})();

export const treeRotation = (f: number) => (f - 2250) * 0.0009;

export const polar = (a: number, r: number, rot: number): [number, number] => [
  TREE_CX + Math.cos(a + rot) * r,
  TREE_CY + Math.sin(a + rot) * r,
];
