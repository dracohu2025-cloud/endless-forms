import React from "react";
import { useCurrentFrame } from "remotion";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle } from "../components/Typography";
import { SERIF_SC } from "../fonts";
import { loudness, pulse } from "../lib/audio";
import { clamp, easeInCubic, easeOutCubic, easeOutExpo, progress } from "../lib/util";
import { W } from "../timeline";

const WORDS = [
  { text: "自由", at: 60, y: 300, glow: "70,110,255", band: { x: 0, c: "35,70,200" } },
  { text: "平等", at: 90, y: 560, glow: "255,255,255", band: { x: 360, c: "235,235,245" } },
  { text: "博爱", at: 120, y: 820, glow: "255,50,60", band: { x: 720, c: "210,25,45" } },
];

export const Enlightenment: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const lv = loudness(g);
  const reason = easeOutCubic(progress(f, 0, 55)) * (1 - easeInCubic(progress(f, 58, 8)));
  const hitP = Math.min(1.4, pulse(g, 0.9, 6));
  const build = easeInCubic(progress(f, 196, 44));

  return (
    <Stage from={from} dur={dur} zoom={[1.0, 1.05]} shake={0.8} fadeOut={4}
      background="radial-gradient(ellipse 90% 70% at 50% 40%, #12162a 0%, #07080f 60%, #020203 100%)">
      <div style={{ position: "absolute", left: 540 - 900, top: 640 - 900, width: 1800, height: 1800, opacity: reason,
        background: "repeating-conic-gradient(from 0deg, rgba(255,236,190,0.22) 0deg 1.4deg, rgba(255,236,190,0) 1.4deg 9deg)",
        transform: `rotate(${f * 0.25}deg)`,
        WebkitMaskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 25%, transparent 60%)" }} />
      <div style={{ position: "absolute", left: 540 - 300, top: 640 - 300, width: 600, height: 600, borderRadius: 300, opacity: reason,
        background: `radial-gradient(circle, rgba(255,250,235,1) 0%, rgba(255,230,170,${0.6 + 0.3 * lv}) 8%, rgba(255,190,110,0.25) 30%, rgba(0,0,0,0) 65%)`,
        transform: `scale(${0.6 + 0.5 * reason})` }} />

      {WORDS.map((w, i) => {
        const t = progress(f, w.at - 2, 26);
        if (t <= 0) return null;
        return (
          <div key={i} style={{ position: "absolute", left: w.band.x, top: 0, width: 360, height: 1920,
            opacity: easeOutCubic(t) * (0.5 + 0.2 * Math.sin(f * 0.05 + i)) + build * 0.3,
            background: `linear-gradient(180deg, rgba(${w.band.c},0) 0%, rgba(${w.band.c},0.55) 30%, rgba(${w.band.c},0.35) 60%, rgba(${w.band.c},0) 100%)`,
            filter: "blur(30px)", mixBlendMode: "screen" }} />
        );
      })}
      <Particles count={140} seed={17} colors={["#ffcc80", "#ffffff", "#ff6a4a", "#8fb0ff"]} size={[0.8, 2.6]}
        vx={[-0.5, 0.5]} vy={[-3.2, -0.8]} sway={10} opacity={clamp(progress(f, 60, 20)) * (0.6 + build)} boost={1 + hitP * 0.5} />
      {WORDS.map((w, i) => {
        const t = progress(f, w.at, 10);
        if (t <= 0) return null;
        const e = easeOutExpo(t);
        const ring = progress(f, w.at, 26);
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: 540 - 260, top: w.y + 125 - 260, width: 520, height: 520, borderRadius: 260,
              border: `${6 * (1 - ring)}px solid rgba(${w.glow},${0.9 * (1 - ring)})`, transform: `scale(${0.3 + ring * 1.8})`,
              boxShadow: `0 0 40px rgba(${w.glow},${0.6 * (1 - ring)})` }} />
            <div style={{ position: "absolute", left: 0, top: w.y, width: W, textAlign: "center", fontFamily: SERIF_SC,
              fontWeight: 900, fontSize: 230, lineHeight: 1.08, letterSpacing: "0.12em", paddingLeft: "0.12em", color: "#fffaf2",
              opacity: e, transform: `scale(${1 + 0.9 * (1 - e)})`, filter: `blur(${(1 - e) * 20}px)`,
              textShadow: `0 0 ${30 + 30 * hitP}px rgba(${w.glow},0.9), 0 0 120px rgba(${w.glow},0.55)` }}>
              {w.text}
            </div>
          </React.Fragment>
        );
      })}
      <EraTitle
        date="1715 — 1789 年"
        title="启蒙运动"
        en="THE ENLIGHTENMENT"
        start={2}
        tone={{ text: "#fffaf0", accent: "#ffd790", sub: "rgba(255,226,170,0.9)", glow: "rgba(255,200,120,0.55)" }}
        exitAt={50}
        y={1160}
      />
      <EraTitle
        date="1789 年"
        title="法国大革命"
        en="THE FRENCH REVOLUTION"
        start={128}
        tone={{ text: "#ffffff", accent: "#ffd790", sub: "rgba(200,215,255,0.9)", glow: "rgba(255,80,80,0.45)" }}
        lines={[{ text: "《人权宣言》：人生而自由，权利平等", at: 160, size: 40 }]}
        exitAt={226}
        y={1160}
        titleSize={140}
      />
      <div style={{ position: "absolute", inset: 0, background: "#fff6e6", opacity: build * 0.75, mixBlendMode: "screen" }} />
    </Stage>
  );
};
