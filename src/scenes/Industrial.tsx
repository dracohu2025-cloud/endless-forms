import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { FrameCanvas } from "../components/Canvas";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle, GhostYear } from "../components/Typography";
import { bassLevel, pulse } from "../lib/audio";
import { easeOutCubic, mulberry32, progress } from "../lib/util";
import { W } from "../timeline";

const MODULE = 14;

type Gear = { x: number; y: number; teeth: number; r: number; phase: number; ratio: number; tone: number };

/** Chain of meshing gears: each new gear is placed tangent to its parent at angle `a`, phase-aligned. */
const buildGears = (): Gear[] => {
  const g: Gear[] = [];
  const add = (parent: number, teeth: number, aDeg: number, tone: number) => {
    const r = (teeth * MODULE) / 2;
    if (parent < 0) {
      g.push({ x: 300, y: 600, teeth, r, phase: 0, ratio: 1, tone });
      return;
    }
    const p = g[parent];
    const a = (aDeg * Math.PI) / 180;
    const x = p.x + Math.cos(a) * (p.r + r);
    const y = p.y + Math.sin(a) * (p.r + r);
    const ratio = -p.ratio * (p.teeth / teeth);
    const phase = a + Math.PI + Math.PI / teeth - ((p.phase - a) * p.teeth) / teeth;
    g.push({ x, y, teeth, r, phase, ratio, tone });
  };
  add(-1, 24, 0, 0);
  add(0, 14, -25, 1);
  add(1, 32, 40, 0);
  add(2, 12, 150, 1);
  add(0, 18, 110, 1);
  add(2, 16, -60, 1);
  add(4, 26, 175, 0);
  return g;
};

const gearPath = (teeth: number, r: number) => {
  const ro = r + MODULE;
  const rr = r - 1.25 * MODULE;
  const pa = (Math.PI * 2) / teeth;
  let d = "";
  for (let k = 0; k < teeth; k++) {
    const c = k * pa;
    const pts = [
      [rr, c - pa * 0.32],
      [ro, c - pa * 0.17],
      [ro, c + pa * 0.17],
      [rr, c + pa * 0.32],
      [rr, c + pa * 0.68],
    ];
    pts.forEach(([rad, a], i) => {
      d += `${k === 0 && i === 0 ? "M" : "L"}${(rad * Math.cos(a)).toFixed(1)},${(rad * Math.sin(a)).toFixed(1)} `;
    });
  }
  d += "Z ";
  const hub = r * 0.2;
  d += `M${hub},0 A${hub},${hub} 0 1,0 ${-hub},0 A${hub},${hub} 0 1,0 ${hub},0 Z `;
  if (r > 90) {
    const spokes = r > 160 ? 6 : 5;
    const r0 = r * 0.32;
    const r1 = rr - MODULE * 0.9;
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * Math.PI * 2 + 0.16;
      const a1 = ((s + 1) / spokes) * Math.PI * 2 - 0.16;
      const P = (rad: number, a: number) => `${(rad * Math.cos(a)).toFixed(1)},${(rad * Math.sin(a)).toFixed(1)}`;
      d += `M${P(r0, a0 + 0.12)} L${P(r1, a0)} A${r1},${r1} 0 0,1 ${P(r1, a1)} L${P(r0, a1 - 0.12)} A${r0},${r0} 0 0,0 ${P(r0, a0 + 0.12)} Z `;
    }
  }
  return d;
};

export const Industrial: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const gears = useMemo(buildGears, []);
  const paths = useMemo(() => gears.map((gr) => gearPath(gr.teeth, gr.r)), [gears]);
  const bass = bassLevel(g);
  const clang = Math.min(1.2, pulse(g, 0.4, 5));
  const spin = f * 0.017 + Math.min(1, pulse(g, 0.7, 8)) * 0.02;
  const puffs = useMemo(() => {
    const r = mulberry32(64);
    return Array.from({ length: 34 }, () => ({ x: r() * W, y: 300 + r() * 1700, s: 140 + r() * 260, vx: 0.4 + r() * 1.1, vy: -(0.6 + r() * 1.4), ph: r() * 400 }));
  }, []);

  return (
    <Stage from={from} dur={dur} zoom={[1.06, 1.0]} shake={0.7}
      background="linear-gradient(180deg, #0a0605 0%, #160c07 45%, #2a1206 80%, #3a1606 100%)">
      <div style={{ position: "absolute", left: -200, top: 1100, width: 1480, height: 1200, borderRadius: 740,
        background: `radial-gradient(ellipse, rgba(255,110,30,${0.45 + 0.3 * bass}) 0%, rgba(255,80,20,0.15) 40%, rgba(0,0,0,0) 70%)` }} />
      <FrameCanvas deps={[f]} draw={(ctx) => {
        for (const p of puffs) {
          const life = ((f + p.ph) % 400) / 400;
          const x = ((p.x + (f + p.ph) * p.vx) % (W + 600)) - 300;
          const y = p.y + ((f + p.ph) % 400) * p.vy;
          const s = p.s * (0.6 + life * 1.2);
          const a = Math.sin(life * Math.PI) * 0.22;
          const grad = ctx.createRadialGradient(x, y, 0, x, y, s);
          grad.addColorStop(0, `rgba(90,62,48,${a})`);
          grad.addColorStop(0.6, `rgba(60,40,32,${a * 0.5})`);
          grad.addColorStop(1, "rgba(40,28,22,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(x - s, y - s, s * 2, s * 2);
        }
      }} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="copper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f2b27a" />
            <stop offset="0.45" stopColor="#b86a34" />
            <stop offset="1" stopColor="#4a220e" />
          </linearGradient>
          <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbe3a0" />
            <stop offset="0.5" stopColor="#c99a3e" />
            <stop offset="1" stopColor="#5a3c12" />
          </linearGradient>
          <radialGradient id="heat" cx="50%" cy="100%" r="80%">
            <stop offset="0" stopColor="#ff8a3a" stopOpacity={0.55} />
            <stop offset="1" stopColor="#ff8a3a" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g style={{ filter: `drop-shadow(0 18px 30px rgba(0,0,0,0.7)) drop-shadow(0 0 ${8 + 14 * clang}px rgba(255,140,60,${0.35 + 0.3 * clang}))` }}>
          {gears.map((gr, i) => {
            const appear = easeOutCubic(progress(f, i * 5, 26));
            const ang = ((gr.phase + spin * gr.ratio) * 180) / Math.PI;
            return (
              <g key={i} transform={`translate(${gr.x},${gr.y}) scale(${0.6 + 0.4 * appear})`} opacity={appear}>
                <g transform={`rotate(${ang})`}>
                  <path d={paths[i]} fill={gr.tone ? "url(#brass)" : "url(#copper)"} fillRule="evenodd" stroke="#1e0f06" strokeWidth={2.5} />
                  <path d={paths[i]} fill="url(#heat)" fillRule="evenodd" />
                  <circle r={gr.r * 0.82} fill="none" stroke="rgba(255,220,170,0.25)" strokeWidth={2} />
                  <circle r={gr.r * 0.1} fill="#1e0f06" />
                  {Array.from({ length: 6 }, (_, k) => (
                    <circle key={k} cx={Math.cos((k / 6) * Math.PI * 2) * gr.r * 0.14} cy={Math.sin((k / 6) * Math.PI * 2) * gr.r * 0.14} r={3} fill="#2a1408" />
                  ))}
                </g>
              </g>
            );
          })}
        </g>
      </svg>
      <Particles count={110} seed={29} colors={["#ffb050", "#ff7020", "#ffe0a0"]} size={[0.6, 2.4]} vx={[-0.8, 0.8]}
        vy={[-5, -1.5]} sway={8} opacity={0.85} boost={1 + clang * 0.6} area={{ x: 0, y: 300, w: W, h: 1700 }} />
      <GhostYear text="1769" color="#f2b27a" y={1480} size={260} opacity={0.1} />
      <EraTitle
        date="18 — 19 世纪"
        title="工业革命"
        en="INDUSTRIAL REVOLUTION"
        tone={{ text: "#fff2e2", accent: "#ffb060", sub: "rgba(255,190,120,0.9)", glow: "rgba(255,110,30,0.6)" }}
        lines={[
          { text: "蒸汽 · 钢铁 · 铁路", at: 40, until: 132 },
          { text: "1769 · 瓦特改良蒸汽机", at: 140 },
        ]}
        exitAt={224}
        y={1170}
        titleSize={140}
      />
    </Stage>
  );
};
