import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle } from "../components/Typography";
import { loudness } from "../lib/audio";
import { clamp, easeOutCubic, hash, progress } from "../lib/util";
import { W } from "../timeline";

const CX = 540;
const CY = 700;
const JEWELS = ["#d0102e", "#1f52d1", "#e9a628", "#139157", "#7e32c4", "#2c9be0", "#d8326a", "#f2c040"];
const GOLD = 7;

const mix = (hex: string, t: number, to: number) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${v.map((c) => Math.round(c + (to - c) * t)).join(",")})`;
};

type Cell = { d: string; color: number; r: number; seed: number };

const polar = (r: number, a: number): [number, number] => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const circle = (x: number, y: number, r: number) => `M${x - r},${y} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;

const lancet = (a: number, r0: number, r1: number, w: number) => {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const P = (u: number, v: number) => `${CX + u * ca - v * sa},${CY + u * sa + v * ca}`;
  const shoulder = r0 + (r1 - r0) * 0.62;
  return `M${P(r0, -w * 0.6)} L${P(shoulder, -w)} Q${P(r1 - (r1 - shoulder) * 0.25, -w)} ${P(r1, 0)} Q${P(r1 - (r1 - shoulder) * 0.25, w)} ${P(shoulder, w)} L${P(r0, w * 0.6)} Q${P(r0 - 10, 0)} ${P(r0, -w * 0.6)} Z`;
};

const buildWindow = (): { cells: Cell[]; lead: string[] } => {
  const cells: Cell[] = [];
  const lead: string[] = [];
  let seed = 1;
  cells.push({ d: circle(CX, CY, 58), color: GOLD, r: 0, seed: seed++ });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const [x, y] = polar(30, a);
    cells.push({ d: circle(x, y, 16), color: i % 2 ? 0 : 1, r: 20, seed: seed++ });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [x, y] = polar(108, a);
    cells.push({ d: circle(x, y, 40), color: i % 2 ? 1 : 0, r: 108, seed: seed++ });
    const [x2, y2] = polar(108, a);
    cells.push({ d: circle(x2, y2, 17), color: GOLD, r: 110, seed: seed++ });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    cells.push({ d: lancet(a, 162, 300, 38), color: [2, 3, 4, 5][i % 4], r: 200, seed: seed++ });
    cells.push({ d: lancet(a, 176, 240, 18), color: [0, 6][i % 2], r: 210, seed: seed++ });
    const [x, y] = polar(296, a + Math.PI / 12);
    cells.push({ d: circle(x, y, 24), color: [1, 0][i % 2], r: 290, seed: seed++ });
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const [x, y] = polar(340, a);
    cells.push({ d: circle(x, y, 15), color: i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0, r: 340, seed: seed++ });
  }
  lead.push(circle(CX, CY, 362), circle(CX, CY, 320), circle(CX, CY, 150), circle(CX, CY, 70));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const [x0, y0] = polar(150, a);
    const [x1, y1] = polar(320, a);
    if (i % 2 === 0) lead.push(`M${x0},${y0} L${x1},${y1}`);
  }
  return { cells, lead };
};

export const MiddleAges: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const lv = loudness(g);
  const { cells, lead } = useMemo(buildWindow, []);
  const rot = f * 0.06;
  const rays = [
    { x: 300, w: 90, c: "40,90,255", sway: 0 },
    { x: 440, w: 70, c: "255,60,80", sway: 1 },
    { x: 560, w: 110, c: "255,190,80", sway: 2 },
    { x: 680, w: 70, c: "140,70,255", sway: 3 },
    { x: 790, w: 90, c: "40,190,130", sway: 4 },
  ];
  const rayA = easeOutCubic(progress(f, 30, 90));

  const windowSvg = (blur: boolean) => (
    <svg width={W} height={1920} style={{ position: "absolute", inset: 0, filter: blur ? "blur(30px)" : undefined,
      mixBlendMode: blur ? "screen" : undefined, opacity: blur ? 1 : 1, transform: blur ? "scale(1.06)" : undefined, transformOrigin: `${CX}px ${CY}px` }}>
      <defs>
        {JEWELS.map((c, i) => (
          <radialGradient key={i} id={`jw${i}`} cx="45%" cy="40%" r="65%">
            <stop offset="0" stopColor={mix(c, 0.6, 255)} />
            <stop offset="0.45" stopColor={c} />
            <stop offset="1" stopColor={mix(c, 0.55, 0)} />
          </radialGradient>
        ))}
        <radialGradient id={`glass${blur ? "b" : ""}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={`rotate(${rot} ${CX} ${CY})`}>
        {!blur && <path d={circle(CX, CY, 372)} fill="#0b0709" />}
        {cells.map((c, i) => {
          const build = easeOutCubic(progress(f, 4 + c.r * 0.22, 26));
          if (build <= 0) return null;
          const fl = 0.72 + 0.28 * Math.sin(f * (0.05 + hash(c.seed) * 0.08) + hash(c.seed * 3) * 6.28);
          const a = clamp(build * fl * (0.75 + 0.35 * lv));
          return <path key={i} d={c.d} fill={blur ? JEWELS[c.color] : `url(#jw${c.color})`} opacity={a} stroke={blur ? "none" : "#140b0f"} strokeWidth={4} />;
        })}
        {!blur && (
          <g fill="none" stroke="#1a1014" strokeWidth={7}>
            {lead.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        )}
        {!blur && (
          <g fill="none" stroke="rgba(255,220,170,0.25)" strokeWidth={1.5}>
            {lead.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        )}
      </g>
      {!blur && <circle cx={CX} cy={CY} r={360} fill={`url(#glass)`} opacity={0.35 + 0.25 * lv} style={{ mixBlendMode: "screen" }} />}
    </svg>
  );

  return (
    <Stage from={from} dur={dur} zoom={[1.06, 1.0]}
      background="radial-gradient(ellipse 90% 70% at 50% 36%, #1a1028 0%, #0a0612 50%, #030205 100%)">
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b2f3a" />
            <stop offset="1" stopColor="#120c12" />
          </linearGradient>
        </defs>
        <path d="M30,1920 V1230 A1010,1010 0 0,1 540,300 A1010,1010 0 0,1 1050,1230 V1920 H990 V1236 A950,950 0 0,0 540,372 A950,950 0 0,0 90,1236 V1920 Z"
          fill="url(#stone)" opacity={0.9} />
        <path d="M90,1236 A950,950 0 0,1 540,372 A950,950 0 0,1 990,1236" fill="none" stroke="rgba(255,200,150,0.18)" strokeWidth={2} />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <line key={k} x1={150 + k * 156} y1={1150} x2={150 + k * 156} y2={1920} stroke="rgba(255,210,170,0.06)" strokeWidth={26} />
        ))}
      </svg>
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", filter: "blur(10px)" }}>
        <defs>
          {rays.map((r, i) => (
            <linearGradient key={i} id={`ray${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={`rgb(${r.c})`} stopOpacity={0.32 * rayA} />
              <stop offset="1" stopColor={`rgb(${r.c})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {rays.map((r, i) => {
          const sway = Math.sin(f * 0.02 + r.sway) * 30;
          const top = r.x + (r.x - 540) * -0.3;
          return (
            <path key={i} d={`M${top - r.w * 0.3},${700} L${top + r.w * 0.3},${700} L${r.x + sway + r.w * 1.6 + (r.x - 540) * 0.9},1920 L${r.x + sway - r.w * 1.6 + (r.x - 540) * 0.9},1920 Z`}
              fill={`url(#ray${i})`} />
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: CX - 620, top: CY - 620, width: 1240, height: 1240, borderRadius: 620,
        background: `radial-gradient(circle, rgba(120,80,255,${0.28 + 0.2 * lv}) 0%, rgba(200,40,90,0.14) 35%, rgba(0,0,0,0) 65%)` }} />
      {windowSvg(true)}
      {windowSvg(false)}
      <Particles count={120} seed={21} colors={["#fff0d0", "#ffd9a0", "#c8d8ff"]} size={[0.6, 2.2]} vx={[-0.1, 0.1]}
        vy={[-0.25, 0.1]} sway={18} twinkle={0.7} opacity={0.6 * rayA} area={{ x: 120, y: 760, w: 840, h: 1100 }} />
      <EraTitle
        date="公元 476 — 1453 年"
        title="中世纪"
        en="THE MIDDLE AGES"
        tone={{ text: "#fff4ea", accent: "#e9b860", sub: "rgba(220,200,255,0.85)", glow: "rgba(150,100,255,0.55)" }}
        lines={[
          { text: "信仰 · 骑士 · 大教堂", at: 40, until: 132 },
          { text: "「建筑是人类的大书」—— 雨果", at: 140 },
        ]}
        exitAt={224}
        y={1160}
      />
    </Stage>
  );
};
