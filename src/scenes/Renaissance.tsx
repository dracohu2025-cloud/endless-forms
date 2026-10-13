import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { EraTitle } from "../components/Typography";
import { clamp, easeInOutCubic, easeOutCubic, mulberry32, progress } from "../lib/util";
import { W } from "../timeline";

const INK = "#3b2414";
const CHALK = "#a3442a";
const CX = 540;
const CY = 690;

type Stroke = { d: string; at: number; dur: number; w: number; c: string; o?: number };

/** Golden rectangle subdivision → squares + quarter-circle spiral arcs. */
const goldenSpiral = (x: number, y: number, w: number, h: number, n: number) => {
  const squares: string[] = [];
  let arcs = "";
  let dir = 0;
  for (let i = 0; i < n; i++) {
    let s: number, sx: number, sy: number, cx: number, cy: number, a0: number;
    if (dir === 0) {
      s = h; sx = x; sy = y; x += s; w -= s; cx = sx + s; cy = sy + s; a0 = Math.PI;
    } else if (dir === 1) {
      s = w; sx = x; sy = y; y += s; h -= s; cx = sx; cy = sy + s; a0 = -Math.PI / 2;
    } else if (dir === 2) {
      s = h; sx = x + w - s; sy = y; w -= s; cx = sx; cy = sy; a0 = 0;
    } else {
      s = w; sx = x; sy = y + h - s; h -= s; cx = sx + s; cy = sy; a0 = Math.PI / 2;
    }
    squares.push(`M${sx},${sy} h${s} v${s} h${-s} Z`);
    const p0 = [cx + s * Math.cos(a0), cy + s * Math.sin(a0)];
    const p1 = [cx + s * Math.cos(a0 + Math.PI / 2), cy + s * Math.sin(a0 + Math.PI / 2)];
    arcs += `${i === 0 ? `M${p0[0]},${p0[1]}` : ""} A${s},${s} 0 0,1 ${p1[0]},${p1[1]} `;
    dir = (dir + 1) % 4;
  }
  return { squares, arcs };
};

/** Pseudo mirror-script: loops along a baseline, like Leonardo's notebooks from afar. */
const scribble = (x0: number, y0: number, len: number, seed: number) => {
  const r = mulberry32(seed);
  let d = `M${x0},${y0}`;
  let x = x0;
  while (x < x0 + len) {
    const wordLen = 20 + r() * 60;
    const end = Math.min(x0 + len, x + wordLen);
    for (; x < end; x += 3) {
      const t = x * 0.45 + seed;
      const y = y0 - Math.abs(Math.sin(t)) * (5 + r() * 5) * (r() < 0.08 ? 2.2 : 1);
      d += ` L${(x - Math.cos(t) * 3).toFixed(1)},${y.toFixed(1)}`;
    }
    x += 10 + r() * 8;
    d += ` M${x.toFixed(1)},${y0}`;
  }
  return d;
};

const buildStrokes = (): Stroke[] => {
  const s: Stroke[] = [];
  const R = 330;
  s.push({ d: `M${CX},${CY - R} a${R},${R} 0 1,1 -0.01,0`, at: 0, dur: 50, w: 3, c: INK });
  const sq = 560;
  const top = CY + R - sq;
  s.push({ d: `M${CX - sq / 2},${top} h${sq} v${sq} h${-sq} Z`, at: 18, dur: 50, w: 3, c: INK });
  s.push({ d: `M${CX},${CY - R - 30} V${CY + R + 30} M${CX - R - 30},${CY} H${CX + R + 30}`, at: 36, dur: 40, w: 1.4, c: INK, o: 0.6 });
  s.push({ d: `M${CX - sq / 2},${top} L${CX + sq / 2},${top + sq} M${CX + sq / 2},${top} L${CX - sq / 2},${top + sq}`, at: 44, dur: 40, w: 1.2, c: INK, o: 0.45 });
  for (let k = 1; k < 8; k++) {
    const y = top + (sq * k) / 8;
    s.push({ d: `M${CX - sq / 2 - 14},${y} h14 M${CX + sq / 2},${y} h14`, at: 60 + k * 2, dur: 10, w: 1.4, c: INK, o: 0.7 });
  }
  s.push({ d: `M${CX - R},${CY - 40} A${R * 1.2},${R * 1.2} 0 0,1 ${CX + R},${CY - 40}`, at: 70, dur: 30, w: 1, c: INK, o: 0.35 });
  const gw = 560;
  const gh = gw / 1.618034;
  const sp = goldenSpiral(CX - gw / 2, CY - gh / 2 + 30, gw, gh, 9);
  sp.squares.forEach((d, i) => s.push({ d, at: 66 + i * 7, dur: 22, w: 1.6, c: CHALK, o: 0.75 }));
  s.push({ d: sp.arcs, at: 92, dur: 80, w: 3.4, c: CHALK });
  const blocks = [
    [72, 300, 150, 7],
    [862, 300, 150, 7],
    [72, 1000, 150, 5],
    [862, 1000, 150, 5],
  ];
  let seed = 3;
  blocks.forEach(([x, y, len, rows], b) => {
    for (let i = 0; i < rows; i++) {
      s.push({ d: scribble(x, y + i * 22, len * (0.6 + ((i * 37) % 10) / 25), seed++), at: 100 + b * 12 + i * 4, dur: 26, w: 1.2, c: INK, o: 0.55 });
    }
  });
  return s;
};

export const Renaissance: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const strokes = useMemo(buildStrokes, []);
  const floorA = easeOutCubic(progress(f, 20, 60));
  const stains = useMemo(() => {
    const r = mulberry32(77);
    return Array.from({ length: 9 }, () => ({ x: r() * W, y: r() * 1920, s: 120 + r() * 380, a: 0.05 + r() * 0.08 }));
  }, []);
  const floor = useMemo(() => {
    let d = "";
    for (let k = -14; k <= 14; k++) d += `M${CX},${CY} L${CX + k * 150},1920 `;
    for (let k = 1; k < 14; k++) {
      const y = CY + 1230 / (1 + (14 - k) * 0.55);
      d += `M0,${y.toFixed(1)} H${W} `;
    }
    return d;
  }, []);
  const camera = easeInOutCubic(progress(f, 0, dur));

  return (
    <Stage from={from} dur={dur} zoom={[1.0, 1.0]}
      background="radial-gradient(ellipse 85% 70% at 50% 42%, #f3e7cc 0%, #e6d3a8 55%, #c8a874 85%, #8e6a3c 100%)">
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.12 - 0.1 * camera}) translateY(${-20 + 30 * camera}px)` }}>
        {stains.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: s.x - s.s, top: s.y - s.s, width: s.s * 2, height: s.s * 2, borderRadius: s.s,
            background: `radial-gradient(circle, rgba(120,80,30,${s.a}) 0%, rgba(120,80,30,${s.a * 0.4}) 50%, rgba(120,80,30,0) 70%)` }} />
        ))}
        <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <clipPath id="floorclip">
              <rect x={0} y={1060} width={W} height={900} />
            </clipPath>
          </defs>
          <path d={floor} stroke={INK} strokeWidth={1} fill="none" opacity={0.16 * floorA} clipPath="url(#floorclip)" />
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {strokes.map((s, i) => {
              const p = easeOutCubic(progress(f, s.at, s.dur));
              if (p <= 0) return null;
              return (
                <path key={i} d={s.d} stroke={s.c} strokeWidth={s.w} opacity={(s.o ?? 0.9) * clamp(p * 4)} pathLength={1}
                  strokeDasharray={1} strokeDashoffset={1 - p} />
              );
            })}
          </g>
          <g opacity={easeOutCubic(progress(f, 150, 30))} fontFamily="'Cormorant Garamond', serif" fontStyle="italic" fill={INK}>
            <text x={CX + 345} y={CY - 6} fontSize={30} opacity={0.7}>φ</text>
            <text x={CX - 250} y={CY + 372} fontSize={34} opacity={0.75}>Homo ad circulum et quadratum</text>
          </g>
        </svg>
      </div>
      <EraTitle
        date="1453 — 1600 年"
        title="文艺复兴"
        en="RENAISSANCE"
        tone={{ text: "#2b190c", accent: "#8a3a1a", sub: "#6a4528", glow: "rgba(255,245,220,0.9)", shadow: "none" }}
        lines={[
          { text: "达·芬奇 · 米开朗基罗 · 拉斐尔", at: 40, until: 132 },
          { text: "重新发现「人」的价值", at: 140 },
        ]}
        exitAt={224}
        y={1150}
      />
    </Stage>
  );
};
