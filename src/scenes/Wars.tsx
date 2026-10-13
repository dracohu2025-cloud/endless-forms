import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle, Reveal } from "../components/Typography";
import { CINZEL, SERIF_SC } from "../fonts";
import { bassLevel, pulse } from "../lib/audio";
import { clamp, easeInCubic, easeOutCubic, easeOutExpo, mulberry32, progress } from "../lib/util";
import { W } from "../timeline";

/** Branching fracture lines radiating from an impact point. */
const cracks = (x: number, y: number, seed: number, arms: number) => {
  const r = mulberry32(seed);
  const out: { d: string; w: number }[] = [];
  const grow = (px: number, py: number, ang: number, len: number, w: number, depth: number) => {
    let d = `M${px.toFixed(1)},${py.toFixed(1)}`;
    let cx = px;
    let cy = py;
    const steps = 6 + Math.floor(r() * 6);
    for (let i = 0; i < steps; i++) {
      ang += (r() - 0.5) * 0.7;
      const l = len / steps;
      cx += Math.cos(ang) * l;
      cy += Math.sin(ang) * l;
      d += ` L${cx.toFixed(1)},${cy.toFixed(1)}`;
      if (depth < 3 && r() < 0.28) grow(cx, cy, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), len * 0.5, w * 0.6, depth + 1);
    }
    out.push({ d, w });
  };
  for (let i = 0; i < arms; i++) grow(x, y, (i / arms) * Math.PI * 2 + r() * 0.5, 380 + r() * 520, 5, 0);
  return out;
};

const barbedWire = (y: number) => {
  let line = `M-20,${y}`;
  let barbs = "";
  for (let x = -20; x <= W + 20; x += 20) line += ` L${x},${y + Math.sin(x * 0.012) * 18}`;
  for (let x = 30; x < W; x += 90) {
    const yy = y + Math.sin(x * 0.012) * 18;
    barbs += `M${x - 14},${yy - 16} L${x + 14},${yy + 16} M${x + 14},${yy - 16} L${x - 14},${yy + 16} `;
  }
  return { line, barbs };
};

export const Wars: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const boom = Math.min(1.5, pulse(g, 0.55, 7));
  const bass = bassLevel(g);
  const c1 = useMemo(() => cracks(540, 430, 7, 7), []);
  const c2 = useMemo(() => cracks(540, 690, 19, 8), []);
  const wire = useMemo(() => barbedWire(980), []);
  const war = 1 - easeInCubic(progress(f, 112, 22));
  const hope = easeOutCubic(progress(f, 140, 100));
  const lightR = 30 + 520 * Math.pow(hope, 1.8);

  const crackLayer = (set: { d: string; w: number }[], at: number) => {
    const t = progress(f, at, 7);
    if (t <= 0) return null;
    const heat = Math.exp(-(f - at) / 18);
    return (
      <g style={{ filter: `drop-shadow(0 0 ${6 + 16 * heat}px rgba(255,60,20,0.9))` }}>
        {set.map((c, i) => (
          <path key={i} d={c.d} fill="none" stroke={`rgb(255,${Math.round(90 + 165 * heat)},${Math.round(60 + 190 * heat)})`}
            strokeWidth={c.w} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1}
            strokeDashoffset={1 - easeOutExpo(t)} opacity={0.35 + 0.65 * heat} />
        ))}
      </g>
    );
  };

  const year = (text: string, at: number, y: number) => {
    const t = progress(f, at, 9);
    if (t <= 0) return null;
    const e = easeOutExpo(t);
    const ab = 10 * Math.exp(-(f - at) / 10) + 2 * boom;
    return (
      <div style={{ position: "absolute", left: 0, top: y, width: W, textAlign: "center", fontFamily: CINZEL, fontWeight: 900,
        fontSize: 128, letterSpacing: "0.04em", lineHeight: 1, opacity: e, transform: `scale(${1 + 0.8 * (1 - e)})` }}>
        <span style={{ position: "absolute", left: 0, right: 0, color: "rgba(0,220,255,0.55)", transform: `translateX(${-ab}px)`, mixBlendMode: "screen" }}>{text}</span>
        <span style={{ position: "absolute", left: 0, right: 0, color: "rgba(255,0,40,0.8)", transform: `translateX(${ab}px)`, mixBlendMode: "screen" }}>{text}</span>
        <span style={{ position: "relative", color: "#fff0e8", textShadow: `0 0 ${30 + 40 * boom}px rgba(255,40,20,0.95), 0 0 120px rgba(255,30,10,0.6)` }}>{text}</span>
      </div>
    );
  };

  return (
    <Stage from={from} dur={dur} zoom={[1.0, 1.08]} shake={1.2} fadeOut={3}
      background="radial-gradient(ellipse 90% 70% at 50% 40%, #1a0404 0%, #080101 60%, #000 100%)">
      <div style={{ position: "absolute", inset: 0, opacity: war,
        background: `radial-gradient(ellipse 80% 60% at 50% 45%, rgba(200,20,10,${0.25 + 0.45 * Math.min(1, boom * 0.7) + 0.2 * bass}) 0%, rgba(60,0,0,0.2) 50%, rgba(0,0,0,0) 80%)` }} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0, opacity: war * 0.5, mixBlendMode: "screen", filter: "blur(8px)" }}>
        {[-1, 1].map((s) => {
          const a = ((s * 18 + Math.sin(f * 0.03 + s) * 14) * Math.PI) / 180;
          const bx = 540 + s * 320;
          const tipX = bx + Math.sin(a) * 2000;
          const tipY = 1920 - Math.cos(a) * 2000;
          const nx = Math.cos(a) * 120;
          const ny = Math.sin(a) * 120;
          return <path key={s} d={`M${bx - 10},1920 L${tipX - nx},${tipY - ny} L${tipX + nx},${tipY + ny} L${bx + 10},1920 Z`} fill="rgba(255,230,200,0.25)" />;
        })}
      </svg>
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0, opacity: war }}>
        {crackLayer(c1, 0)}
        {crackLayer(c2, 60)}
        <g opacity={easeOutCubic(progress(f, 10, 40))}>
          <path d={wire.line} stroke="#050101" strokeWidth={5} fill="none" />
          <path d={wire.barbs} stroke="#050101" strokeWidth={4} fill="none" />
          <path d={wire.line} stroke="rgba(255,70,40,0.5)" strokeWidth={1.2} fill="none" transform="translate(0,-2)" />
        </g>
      </svg>
      <div style={{ opacity: war }}>
        {year("1914 — 1918", 0, 360)}
        {year("1939 — 1945", 60, 620)}
      </div>
      <Particles count={160} seed={33} colors={["#9a9a9a", "#6e6e6e", "#c0b8b0"]} size={[0.8, 2.8]} vx={[-0.4, 0.6]} vy={[0.6, 2.2]}
        sway={16} opacity={0.55} hardness={0.6} />
      <Particles count={60} seed={34} colors={["#ff5a2a", "#ffa050"]} size={[0.8, 2.2]} vx={[-0.5, 0.5]} vy={[-2.5, -0.6]}
        sway={10} opacity={0.8 * war} boost={1 + boom * 0.4} />
      <EraTitle
        date="1914 — 1945 年"
        title="两次世界大战"
        en="THE WORLD WARS"
        start={4}
        tone={{ text: "#fff0ea", accent: "#ff7a5a", sub: "rgba(255,150,130,0.85)", glow: "rgba(255,30,10,0.6)" }}
        lines={[{ text: "数千万生命，消逝于战火", at: 46 }]}
        exitAt={106}
        y={1160}
        titleSize={128}
      />
      <div style={{ position: "absolute", left: 540 - lightR, top: 760 - lightR, width: lightR * 2, height: lightR * 2, borderRadius: lightR,
        opacity: hope, background: "radial-gradient(circle, rgba(255,250,235,1) 0%, rgba(255,222,160,0.75) 10%, rgba(255,190,110,0.25) 35%, rgba(255,170,90,0) 70%)" }} />
      <div style={{ position: "absolute", left: 0, top: 1110, width: W, textAlign: "center" }}>
        <div style={{ fontFamily: SERIF_SC, fontWeight: 900, fontSize: 112, letterSpacing: "0.3em", paddingLeft: "0.3em", color: "#fff6e8",
          textShadow: "0 0 40px rgba(255,200,130,0.6)" }}>
          <Reveal text="废墟之上" start={140} stagger={6} dur={26} rise={30} blur={22} />
        </div>
        <div style={{ marginTop: 40, fontFamily: SERIF_SC, fontWeight: 600, fontSize: 40, letterSpacing: "0.2em", color: "#ffd790",
          opacity: clamp(progress(f, 170, 10)) }}>
          <Reveal text="1950 · 舒曼宣言" start={170} stagger={1.5} dur={14} rise={12} blur={8} />
        </div>
        <div style={{ marginTop: 22, fontFamily: SERIF_SC, fontWeight: 500, fontSize: 48, letterSpacing: "0.16em", color: "#fff1dc" }}>
          <Reveal text="欧洲，选择了和解与联合" start={188} stagger={1.6} dur={16} rise={12} blur={10} />
        </div>
      </div>
    </Stage>
  );
};
