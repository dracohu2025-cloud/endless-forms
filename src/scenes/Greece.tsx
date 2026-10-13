import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { FrameCanvas } from "../components/Canvas";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle, GhostYear } from "../components/Typography";
import { loudness } from "../lib/audio";
import { clamp, easeOutCubic, mulberry32, progress } from "../lib/util";
import { W } from "../timeline";

const GOLD = "#ecd39b";

type Stroke = { d: string; at: number; dur: number; w?: number; o?: number };

/** Parthenon elevation as a list of timed pen strokes. */
const temple = (): Stroke[] => {
  const s: Stroke[] = [];
  const steps = [
    [140, 940, 980],
    [160, 920, 950],
    [180, 900, 922],
  ];
  steps.forEach(([x0, x1, y], i) => {
    s.push({ d: `M${x0},${y} H${x1}`, at: i * 5, dur: 26, w: 3 });
    s.push({ d: `M${x0},${y} V${y + (i === 0 ? 8 : 28 - i * 2)} M${x1},${y} V${y + (i === 0 ? 8 : 28 - i * 2)}`, at: i * 5 + 10, dur: 14, w: 3 });
  });
  const n = 8;
  for (let k = 0; k < n; k++) {
    const cx = 222 + (k * (858 - 222)) / (n - 1);
    const at = 18 + Math.abs(k - 3.5) * 5;
    const b = 30;
    const t = 25;
    s.push({ d: `M${cx - b},900 C${cx - b - 1},800 ${cx - t - 1},700 ${cx - t},652`, at, dur: 40, w: 3 });
    s.push({ d: `M${cx + b},900 C${cx + b + 1},800 ${cx + t + 1},700 ${cx + t},652`, at: at + 2, dur: 40, w: 3 });
    for (const u of [-0.5, 0, 0.5]) {
      s.push({ d: `M${cx + u * b},896 L${cx + u * t},656`, at: at + 10, dur: 40, w: 1.2, o: 0.55 });
    }
    s.push({ d: `M${cx - t},652 Q${cx - t - 4},640 ${cx - 36},636 H${cx + 36} Q${cx + t + 4},640 ${cx + t},652`, at: at + 34, dur: 14, w: 2.5 });
    s.push({ d: `M${cx - 40},636 V624 H${cx + 40} V636`, at: at + 40, dur: 12, w: 2.5 });
  }
  s.push({ d: "M170,624 H910 V588 H170 Z", at: 70, dur: 26, w: 3 });
  s.push({ d: "M170,606 H910", at: 78, dur: 22, w: 1.2, o: 0.6 });
  s.push({ d: "M166,588 H914 V546 H166 Z", at: 80, dur: 26, w: 3 });
  for (let x = 186; x < 900; x += 46.5) {
    s.push({ d: `M${x},584 V550 M${x + 8},584 V550 M${x + 16},584 V550`, at: 88 + (x - 186) / 40, dur: 10, w: 1.4, o: 0.75 });
  }
  s.push({ d: "M150,546 H930 L930,534 H150 Z", at: 92, dur: 22, w: 3 });
  s.push({ d: "M150,534 L540,412 L930,534", at: 100, dur: 34, w: 3.2 });
  s.push({ d: "M196,528 L540,424 L884,528", at: 110, dur: 30, w: 1.4, o: 0.6 });
  s.push({ d: "M540,404 l-8,-22 l16,0 Z M150,534 l-10,-16 M930,534 l10,-16", at: 128, dur: 14, w: 2 });
  return s;
};

const meander = (x0: number, y: number, units: number, u = 34) => {
  let d = "";
  for (let i = 0; i < units; i++) {
    const x = x0 + i * u;
    d += `M${x},${y + u} V${y} H${x + u * 0.75} V${y + u * 0.75} H${x + u * 0.25} V${y + u * 0.25} H${x + u * 0.5} V${y + u * 0.5} `;
  }
  return d;
};

export const Greece: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const lv = loudness(from + f);
  const strokes = useMemo(temple, []);
  const sunrise = easeOutCubic(progress(f, 0, 160));
  const geoP = easeOutCubic(progress(f, 0, 110));
  const fill = easeOutCubic(progress(f, 120, 60));
  const glitter = useMemo(() => {
    const r = mulberry32(42);
    return Array.from({ length: 140 }, () => ({ x: r() * W, y: 1010 + Math.pow(r(), 1.6) * 900, w: 20 + r() * 90, ph: r() * 6.28, sp: 0.08 + r() * 0.2 }));
  }, []);

  return (
    <Stage from={from} dur={dur} zoom={[1.0, 1.06]}
      background="linear-gradient(180deg, #050d1f 0%, #0b2240 38%, #1d4a6a 52%, #0b2a40 53%, #061a2c 75%, #030c17 100%)">
      <div style={{ position: "absolute", left: 540 - 700, top: 760 - 700, width: 1400, height: 1400, borderRadius: 700,
        background: `radial-gradient(circle, rgba(255,214,150,${0.55 * sunrise}) 0%, rgba(255,160,90,${0.25 * sunrise}) 22%, rgba(120,90,140,${0.12 * sunrise}) 45%, rgba(0,0,0,0) 70%)`,
        transform: `translateY(${(1 - sunrise) * 120}px)` }} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`rotate(${f * 0.05} 540 700)`} stroke="rgba(170,205,255,0.22)" fill="none" strokeWidth={1.5}>
          {[
            "M540,700 m-420,0 a420,420 0 1,0 840,0 a420,420 0 1,0 -840,0",
            "M540,280 L903.7,910 L176.3,910 Z",
            "M540,280 L903.7,490 L903.7,910 L540,1120 L176.3,910 L176.3,490 Z",
            "M540,700 m-210,0 a210,210 0 1,0 420,0 a210,210 0 1,0 -420,0",
            "M120,700 H960 M540,280 V1120",
            "M176.3,490 L903.7,910 M903.7,490 L176.3,910",
          ].map((d, i) => (
            <path key={i} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp(geoP * 1.4 - i * 0.08)} />
          ))}
        </g>
      </svg>
      <FrameCanvas deps={[f]} draw={(ctx) => {
        ctx.globalCompositeOperation = "lighter";
        for (const gl of glitter) {
          const a = Math.max(0, Math.sin(f * gl.sp + gl.ph)) * (1 - (gl.y - 1010) / 1000) * 0.5 * sunrise;
          if (a < 0.02) continue;
          const grad = ctx.createLinearGradient(gl.x - gl.w / 2, 0, gl.x + gl.w / 2, 0);
          grad.addColorStop(0, "rgba(255,210,150,0)");
          grad.addColorStop(0.5, `rgba(255,220,170,${a})`);
          grad.addColorStop(1, "rgba(255,210,150,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(gl.x - gl.w / 2, gl.y, gl.w, 2.2);
        }
      }} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="marble" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6e2" stopOpacity="0.30" />
            <stop offset="1" stopColor="#d9c39a" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d="M150,534 L540,412 L930,534 V624 H170 Z M180,900 H900 V922 H180 Z" fill="url(#marble)" opacity={fill} />
        <g fill="none" stroke={GOLD} strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 ${6 + 6 * lv}px rgba(255,205,130,0.9))` }}>
          {strokes.map((s, i) => (
            <path key={i} d={s.d} strokeWidth={s.w ?? 2} opacity={s.o ?? 1} pathLength={1} strokeDasharray={1}
              strokeDashoffset={1 - easeOutCubic(progress(f, s.at, s.dur))} />
          ))}
        </g>
        <g transform={`translate(${-((f * 0.9) % 34)}, 0)`} stroke="rgba(236,211,155,0.7)" fill="none" strokeWidth={2.4}
          opacity={easeOutCubic(progress(f, 40, 40))}>
          <path d={meander(0, 1022, 36)} />
          <path d="M0,1012 H1200 M0,1066 H1200" strokeWidth={1.6} />
        </g>
      </svg>
      <Particles count={90} seed={11} colors={["#ffe0a0", "#fff2cc"]} size={[0.8, 3]} vx={[-0.15, 0.15]}
        vy={[-0.9, -0.25]} sway={14} twinkle={0.6} opacity={0.75} parallax />
      <GhostYear text="800 BC" color="#ecd39b" y={250} size={240} opacity={0.08} />
      <EraTitle
        date="公元前 800 — 前 146 年"
        title="古希腊"
        en="ANCIENT GREECE"
        tone={{ text: "#fff6e4", accent: "#ecd39b", sub: "rgba(236,211,155,0.85)", glow: "rgba(255,190,110,0.45)" }}
        lines={[
          { text: "民主 · 哲学 · 几何 · 戏剧", at: 40, until: 132 },
          { text: "「认识你自己」—— 德尔斐神庙箴言", at: 140 },
        ]}
        exitAt={224}
        y={1140}
      />
    </Stage>
  );
};
