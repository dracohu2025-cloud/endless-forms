import React, { useMemo } from "react";
import { AbsoluteFill, Freeze } from "remotion";
import { FrameCanvas } from "../components/Canvas";
import { Grain } from "../components/Overlays";
import { Swarm, sprite } from "./components/Swarm";
import { TreeOfLife } from "./components/TreeOfLife";
import { SPECIMENS } from "./engine/forms";
import { LOOK_STRIDE } from "./engine/rig";
import { TREE_CX, TREE_CY } from "./engine/tree";
import { DISPLAY, MONO, SANS } from "./fonts";
import { GA } from "./lib/audio";
import { mulberry32 } from "./lib/math";
import { W } from "./timeline";

const TREE_FRAME = 2500;
const PARTICLES = 3200;

type Layout = {
  h: number;
  titleTop: number;
  cy: number;
  treeScale: number;
  ring: number;
  box: number;
  footer: boolean;
};

const LAYOUTS: Record<"short" | "tall", Layout> = {
  short: { h: 1440, titleTop: 70, cy: 850, treeScale: 0.6, ring: 405, box: 172, footer: false },
  tall: { h: 1920, titleTop: 170, cy: 1090, treeScale: 0.66, ring: 418, box: 180, footer: true },
};

/** Evaluate a form once and return its particles normalised into a box of the given size. */
const bake = (k: number, box: number, tall: number) => {
  const sp = SPECIMENS[k];
  const xy = new Float32Array(PARTICLES * 2);
  const look = new Float32Array(PARTICLES * LOOK_STRIDE);
  sp.form.eval(sp.f, xy, look, 0, PARTICLES);
  const xs = Array.from({ length: PARTICLES }, (_, i) => xy[i * 2]).sort((a, b) => a - b);
  const ys = Array.from({ length: PARTICLES }, (_, i) => xy[i * 2 + 1]).sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.floor(p * (arr.length - 1))];
  const x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99);
  const bh = box * tall;
  const s = Math.min(box / (x1 - x0), bh / (y1 - y0));
  return { xy, look, s, mx: (x0 + x1) / 2, my: (y0 + y1) / 2 };
};

const STARS = (() => {
  const r = mulberry32(21);
  return Array.from({ length: 300 }, () => ({ x: r() * W, y: r() * 1920, s: 0.4 + r() * r() * 2.2, a: 0.2 + 0.6 * r() }));
})();

export const EvolutionCover: React.FC<{ tall: boolean }> = ({ tall }) => {
  const L = LAYOUTS[tall ? "tall" : "short"];
  const n = SPECIMENS.length;
  const slots = SPECIMENS.map((sp, k) => {
    const human = k === n - 1;
    const a = ((human ? -36 : 200 - (k * 190) / (n - 2)) * Math.PI) / 180;
    return { x: 540 + Math.cos(a) * L.ring, y: L.cy + Math.sin(a) * L.ring, a, human, box: L.box * (human ? 1.15 : 1) };
  });
  const baked = useMemo(() => slots.map((s, k) => bake(k, s.box, s.human ? 1.5 : 0.82)), [tall]);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 55% at 50% ${(L.cy / L.h) * 100}%, #0b2236 0%, #050c1a 50%, #010207 100%)`, overflow: "hidden" }}>
      <svg width={W} height={L.h} style={{ position: "absolute", inset: 0 }}>
        {STARS.filter((s) => s.y < L.h).map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#e6f3ff" opacity={s.a * 0.6} />
        ))}
      </svg>

      <div style={{ position: "absolute", left: 540 - TREE_CX * L.treeScale, top: L.cy - TREE_CY * L.treeScale, width: W, height: 1920,
        transform: `scale(${L.treeScale})`, transformOrigin: "0 0" }}>
        <Freeze frame={TREE_FRAME}>
          <TreeOfLife bare />
          <Swarm />
        </Freeze>
      </div>

      <svg width={W} height={L.h} style={{ position: "absolute", inset: 0 }}>
        {slots.map((s, k) => {
          const r0 = 300 * L.treeScale + 14;
          const r1 = L.ring - L.box * 0.55;
          return (
            <line key={k} x1={540 + Math.cos(s.a) * r0} y1={L.cy + Math.sin(s.a) * r0} x2={540 + Math.cos(s.a) * r1} y2={L.cy + Math.sin(s.a) * r1}
              stroke={s.human ? "rgba(255,230,170,0.6)" : "rgba(150,230,255,0.28)"} strokeWidth={1.5} strokeDasharray="3 6" />
          );
        })}
      </svg>

      <FrameCanvas
        deps={[tall]}
        height={L.h}
        style={{ height: L.h, mixBlendMode: "screen" }}
        draw={(ctx) => {
          ctx.globalCompositeOperation = "lighter";
          slots.forEach((slot, k) => {
            const b = baked[k];
            const s = b.s;
            for (let i = 0; i < PARTICLES; i++) {
              const j = i * LOOK_STRIDE;
              const a = Math.min(1, b.look[j + 2] * b.look[j + 4] * 0.9);
              if (a < 0.02) continue;
              const x = slot.x + (b.xy[i * 2] - b.mx) * s;
              const y = slot.y + (b.xy[i * 2 + 1] - b.my) * s;
              const r = b.look[j + 3] * 7 * Math.max(0.42, s) * 0.9;
              ctx.globalAlpha = a;
              ctx.drawImage(sprite(b.look[j], b.look[j + 1]), x - r, y - r, r * 2, r * 2);
            }
          });
        }}
      />

      {slots.map((s, k) => {
        const sp = SPECIMENS[k];
        const below = s.y + (s.human ? s.box * 0.78 : s.box * 0.42) + 6;
        return (
          <div key={k} style={{ position: "absolute", left: s.x - 110, top: below, width: 220, textAlign: "center",
            textShadow: "0 0 10px #000, 0 0 20px #000" }}>
            <div style={{ fontFamily: SANS, fontWeight: s.human ? 700 : 500, fontSize: s.human ? 34 : 26, letterSpacing: "0.12em",
              color: s.human ? "#fff1c0" : "#e8fbff" }}>{sp.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.12em", color: s.human ? "rgba(255,230,180,0.8)" : "rgba(150,230,255,0.7)", marginTop: 2 }}>
              {sp.age}
            </div>
          </div>
        );
      })}

      <div style={{ position: "absolute", left: 0, width: W, top: L.cy - 26, textAlign: "center", fontFamily: MONO, fontSize: 16,
        letterSpacing: "0.3em", color: "rgba(220,250,255,0.85)", textShadow: "0 0 10px #000" }}>
        <div style={{ marginTop: 64 }}>LUCA · 40 亿年前</div>
      </div>

      <div style={{ position: "absolute", left: 0, width: W, top: L.titleTop, textAlign: "center", color: "#effdff" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: tall ? 60 : 52, letterSpacing: "0.1em", paddingLeft: "0.1em",
          textShadow: "0 0 30px rgba(110,230,255,0.7)" }}>ENDLESS FORMS</div>
        <div style={{ marginTop: tall ? 18 : 6, fontFamily: SANS, fontWeight: 700, fontSize: tall ? 190 : 168, lineHeight: 1.05,
          letterSpacing: "0.22em", paddingLeft: "0.22em",
          background: "linear-gradient(180deg, #ffffff 0%, #bff6ff 55%, #5fd3ef 100%)", WebkitBackgroundClip: "text", color: "transparent",
          filter: "drop-shadow(0 0 26px rgba(90,220,255,0.55))" }}>进化论</div>
        <div style={{ marginTop: tall ? 22 : 12, fontFamily: SANS, fontWeight: 300, fontSize: tall ? 40 : 34, letterSpacing: "0.3em", paddingLeft: "0.3em" }}>
          40 亿年，从一个细胞到你
        </div>
      </div>

      {L.footer && (
        <div style={{ position: "absolute", left: 0, width: W, top: 1700, textAlign: "center" }}>
          <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 30, letterSpacing: "0.3em", paddingLeft: "0.3em", color: "rgba(230,248,255,0.9)" }}>
            画面与音乐 · 全部由代码生成
          </div>
          <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 20, letterSpacing: "0.18em", color: "rgba(150,230,255,0.7)" }}>
            BGM 主旋律由遗传算法进化 {GA[GA.length - 1].gen} 代
          </div>
        </div>
      )}
      {!L.footer && (
        <div style={{ position: "absolute", right: 36, top: 36, fontFamily: MONO, fontSize: 16, letterSpacing: "0.2em", color: "rgba(150,230,255,0.75)",
          border: "1px solid rgba(150,230,255,0.4)", padding: "8px 14px", borderRadius: 4 }}>
          100% CODE
        </div>
      )}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)" }} />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
