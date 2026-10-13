export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** One bar of the 120 BPM score = 2 s = 60 frames. */
export const BAR = 60;
export const BEAT = 15;
export const TOTAL_FRAMES = 46 * BAR;

export const at = (bar: number, beat = 0) => Math.round(bar * BAR + beat * BEAT);

export type SceneId =
  | "intro"
  | "greece"
  | "rome"
  | "middle"
  | "renaissance"
  | "exploration"
  | "enlightenment"
  | "industrial"
  | "wars"
  | "finale"
  | "end";

export const SCENES: Record<SceneId, [number, number]> = {
  intro: [0, 4],
  greece: [4, 8],
  rome: [8, 12],
  middle: [12, 16],
  renaissance: [16, 20],
  exploration: [20, 24],
  enlightenment: [24, 28],
  industrial: [28, 32],
  wars: [32, 36],
  finale: [36, 44],
  end: [44, 46],
};

/** Era stops on the persistent time axis, with the years each scene sweeps through. */
export const ERAS: { id: SceneId; label: string; years: [number, number] }[] = [
  { id: "greece", label: "希腊", years: [-800, -146] },
  { id: "rome", label: "罗马", years: [-27, 476] },
  { id: "middle", label: "中世纪", years: [476, 1453] },
  { id: "renaissance", label: "文艺复兴", years: [1453, 1600] },
  { id: "exploration", label: "大航海", years: [1492, 1687] },
  { id: "enlightenment", label: "启蒙", years: [1715, 1789] },
  { id: "industrial", label: "工业", years: [1769, 1900] },
  { id: "wars", label: "世界大战", years: [1914, 1950] },
  { id: "finale", label: "联合", years: [1950, 2026] },
];
