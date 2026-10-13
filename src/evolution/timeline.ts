export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** 120 BPM: one bar = 2 s = 60 frames. Must match music/evolution.py. */
export const BAR = 60;
export const BEAT = 15;
export const BARS = 46;
export const TOTAL_FRAMES = BARS * BAR;

export const b = (bar: number, beat = 0) => Math.round(bar * BAR + beat * BEAT);

/** Frame at which each form is fully assembled; the swarm morphs between consecutive keys. */
export const KEYS = {
  soup: 0,
  cell: b(4),
  colony: b(8, 2),
  cambrian: b(12),
  fish: b(16),
  tetrapod: b(18, 1),
  sauropod: b(20),
  impact: b(24),
  ash: b(24, 2),
  mammal: b(26, 1),
  bird: b(28, 1),
  march: b(30),
  human: b(32),
  dna: b(34),
  tree: b(38),
  seed: b(44, 2),
} as const;

/** Years before present at key frames; the HUD interpolates logarithmically. */
export const DEEP_TIME: [number, number][] = [
  [0, 4.0e9],
  [b(4), 3.8e9],
  [b(8), 1.5e9],
  [b(12), 5.4e8],
  [b(16), 4.4e8],
  [b(18), 3.75e8],
  [b(20), 2.3e8],
  [b(24), 6.6e7],
  [b(26), 6.6e7],
  [b(28), 5.0e7],
  [b(30), 7.0e6],
  [b(32), 3.0e5],
  [b(33, 1), 3.0e5],
  [b(34), 1],
];
