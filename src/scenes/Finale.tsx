import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import geo from "../data/geo.json";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle, Reveal } from "../components/Typography";
import { CINZEL, SERIF_SC } from "../fonts";
import { loudness, pulse, starFrames } from "../lib/audio";
import { easeInCubic, easeOutBack, easeOutCubic, progress } from "../lib/util";
import { W } from "../timeline";
import { EuropeMap, RingText } from "./Intro";

const CX = 540;
const CY = 745;
const STAR_R = 392;

export const starPath = (r: number) => {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.382;
    d += `${i === 0 ? "M" : "L"}${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)} `;
  }
  return d + "Z";
};

const POEM = [
  { text: "希腊，给了它思想", at: 240 },
  { text: "罗马，给了它秩序", at: 300 },
  { text: "理性，给了它光芒", at: 360 },
  { text: "苦难，教会它团结", at: 420 },
];

type City = { name: string; x: number; y: number };

export const Finale: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const lv = loudness(g);
  const beat = Math.min(1.2, pulse(g, 0.5, 6));
  const mapW = 700;
  const scale = mapW / geo.europe.w;
  const mapH = geo.europe.h * scale;
  const links = useMemo(() => {
    const cs = geo.cities as City[];
    const out: { a: City; b: City; k: number }[] = [];
    const seen = new Set<string>();
    cs.forEach((c, i) => {
      const near = cs
        .map((d, j) => ({ d, j, dist: Math.hypot(d.x - c.x, d.y - c.y) }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.dist - q.dist)
        .slice(0, 3);
      near.forEach((o) => {
        const key = [i, o.j].sort().join("-");
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ a: c, b: o.d, k: out.length });
      });
    });
    return out;
  }, []);
  const toScreen = (c: City) => [CX - mapW / 2 + c.x * scale, CY - mapH / 2 + c.y * scale];
  const netP = progress(f, 240, 200);
  const outro = easeInCubic(progress(f, 466, 14));

  return (
    <Stage from={from} dur={dur} zoom={[1.0, 1.06]} shake={0.35} fadeOut={2}
      background="radial-gradient(ellipse 85% 65% at 50% 38%, #2148b8 0%, #0d2a85 35%, #061650 70%, #020722 100%)">
      <div style={{ position: "absolute", left: CX - 1100, top: CY - 1100, width: 2200, height: 2200,
        background: "repeating-conic-gradient(from 0deg, rgba(255,215,120,0.10) 0deg 3deg, rgba(255,215,120,0) 3deg 15deg)",
        transform: `rotate(${f * 0.1}deg)`, opacity: 0.6 + 0.4 * lv,
        WebkitMaskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,0.5) 30%, transparent 62%)" }} />
      <Particles count={180} seed={51} colors={["#ffe08a", "#fff4d0", "#ffd050"]} size={[0.6, 2.6]} vx={[-0.2, 0.2]}
        vy={[-0.8, -0.1]} sway={12} twinkle={0.6} opacity={0.75} boost={1 + beat * 0.4} parallax />
      <EuropeMap frame={f} drawStart={0} drawDur={70} cx={CX} cy={CY} width={mapW} color="rgba(255,214,120,0.9)"
        opacity={0.85 - 0.25 * easeOutCubic(progress(f, 240, 60))} cityStart={20} cityStagger={1.2} cityColor="#fff1c4" />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g style={{ filter: "drop-shadow(0 0 6px rgba(255,220,140,0.9))" }}>
          {links.map((l) => {
            const t = Math.min(1, Math.max(0, netP * 1.6 - (l.k / links.length) * 0.6));
            if (t <= 0) return null;
            const [x1, y1] = toScreen(l.a);
            const [x2, y2] = toScreen(l.b);
            const e = easeOutCubic(t);
            const run = ((f * 0.02 + l.k * 0.137) % 1);
            return (
              <g key={l.k}>
                <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * e} y2={y1 + (y2 - y1) * e} stroke="rgba(255,230,160,0.55)" strokeWidth={1.4} />
                {t >= 1 && <circle cx={x1 + (x2 - x1) * run} cy={y1 + (y2 - y1) * run} r={2.6} fill="#fff" opacity={0.9} />}
              </g>
            );
          })}
        </g>
      </svg>
      <RingText id="finale-ring" text={"ATHENAE · ROMA · CONSTANTINOPOLIS · FLORENTIA · LISBOA · PARIS · LONDINIUM · BRUXELLAE · "}
        cx={CX} cy={CY} r={452} rotate={-f * 0.1} color="#ffd98a" size={22} opacity={0.5 * easeOutCubic(progress(f, 30, 60))} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="starglow">
            <stop offset="0" stopColor="#fff6c8" stopOpacity="0.9" />
            <stop offset="0.3" stopColor="#ffd34d" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffd34d" stopOpacity="0" />
          </radialGradient>
        </defs>
        {starFrames.map((sf, i) => {
          const local = sf - from;
          const t = progress(f, local - 1, 10);
          if (t <= 0) return null;
          const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
          const x = CX + STAR_R * Math.cos(a);
          const y = CY + STAR_R * Math.sin(a);
          const flare = Math.exp(-Math.max(0, f - local) / 9);
          const s = easeOutBack(t);
          return (
            <g key={i} transform={`translate(${x},${y})`}>
              <circle r={60 + 90 * flare} fill="url(#starglow)" opacity={0.5 + 0.5 * flare} />
              <rect x={-160 * flare} y={-1.5} width={320 * flare} height={3} fill="#fff6d0" opacity={flare} />
              <rect x={-1.5} y={-90 * flare} width={3} height={180 * flare} fill="#fff6d0" opacity={flare * 0.8} />
              <path d={starPath(34 * s * (1 + 0.06 * beat))} fill="#ffd84d" stroke="#fff3b0" strokeWidth={1.5}
                style={{ filter: "drop-shadow(0 0 10px rgba(255,210,80,0.9))" }} />
            </g>
          );
        })}
      </svg>
      <EraTitle
        date="1950 — 今天"
        title="走向联合"
        en="UNITED IN DIVERSITY"
        start={14}
        tone={{ text: "#ffffff", accent: "#ffd34d", sub: "rgba(255,226,140,0.95)", glow: "rgba(255,210,90,0.55)" }}
        lines={[{ text: "「多元一体」—— 欧盟格言", at: 70 }]}
        exitAt={226}
        y={1196}
        titleSize={140}
      />
      <div style={{ position: "absolute", left: 0, top: 1210, width: W, textAlign: "center", opacity: 1 - outro }}>
        {POEM.map((p, i) => {
          const active = f >= p.at;
          const next = POEM[i + 1];
          const dimmed = next && f >= next.at ? 0.5 : 1;
          return (
            <div key={i} style={{ fontFamily: SERIF_SC, fontWeight: 700, fontSize: 52, lineHeight: 1.75, letterSpacing: "0.2em",
              paddingLeft: "0.2em", color: "#fff8e6", opacity: active ? dimmed : 0,
              textShadow: "0 0 26px rgba(255,210,100,0.6)" }}>
              <Reveal text={p.text} start={p.at} stagger={2} dur={16} rise={20} blur={14} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, top: 1600, width: W, textAlign: "center", fontFamily: CINZEL, fontSize: 22,
        letterSpacing: "0.3em", color: "rgba(255,226,140,0.7)", opacity: easeOutCubic(progress(f, 60, 30)) * (1 - outro) }}>
        ODE TO JOY · L. V. BEETHOVEN · 1824
      </div>
    </Stage>
  );
};

export const EndCard: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const out = easeInCubic(progress(f, dur - 28, 26));
  const ring = easeOutCubic(progress(f, 0, 40));
  return (
    <Stage from={from} dur={dur} zoom={[1.04, 1.0]} fadeIn={1} fadeOut={1}
      background="radial-gradient(ellipse 85% 65% at 50% 36%, #17318a 0%, #081a5c 45%, #020820 100%)">
      <Particles count={140} seed={61} colors={["#ffe08a", "#fff4d0"]} size={[0.6, 2.4]} vx={[-0.15, 0.15]} vy={[-0.6, -0.1]}
        twinkle={0.6} opacity={0.7} frameOffset={from} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = -Math.PI / 2 + (i / 12) * Math.PI * 2 + (1 - ring) * 0.6;
          const r = 150 + 60 * (1 - ring);
          return (
            <path key={i} d={starPath(17)} fill="#ffd84d" transform={`translate(${540 + r * Math.cos(a)},${520 + r * Math.sin(a)})`}
              style={{ filter: "drop-shadow(0 0 8px rgba(255,210,80,0.9))" }} opacity={ring} />
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, top: 790, width: W, textAlign: "center" }}>
        <div style={{ fontFamily: CINZEL, fontWeight: 800, fontSize: 150, letterSpacing: "0.16em", paddingLeft: "0.16em", lineHeight: 1.1,
          filter: "drop-shadow(0 0 26px rgba(255,200,100,0.5))" }}>
          <Reveal text="EUROPA" start={2} stagger={2.5} dur={20} rise={30} blur={20} scaleFrom={1.2}
            charStyle={{ background: "linear-gradient(180deg, #fff6d8 0%, #f0c96a 55%, #b88a34 100%)", WebkitBackgroundClip: "text",
              backgroundClip: "text", color: "transparent" }} />
        </div>
        <div style={{ marginTop: 44, fontFamily: SERIF_SC, fontWeight: 900, fontSize: 84, letterSpacing: "0.4em", paddingLeft: "0.4em",
          color: "#fff6e2", textShadow: "0 0 30px rgba(255,200,110,0.55)" }}>
          <Reveal text="欧洲文明史" start={14} stagger={3} dur={20} rise={24} blur={16} />
        </div>
        <div style={{ marginTop: 34, fontFamily: SERIF_SC, fontSize: 38, letterSpacing: "0.4em", paddingLeft: "0.4em", color: "#ffd98a" }}>
          <Reveal text="三千年 · 九十秒" start={28} stagger={1.5} dur={14} rise={10} blur={8} />
        </div>
        <div style={{ marginTop: 110, fontFamily: SERIF_SC, fontSize: 30, letterSpacing: "0.3em", paddingLeft: "0.3em",
          color: "rgba(230,236,255,0.75)" }}>
          <Reveal text="画面与音乐 · 全部由代码生成" start={42} stagger={1} dur={14} rise={8} blur={6} />
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: out }} />
    </Stage>
  );
};
