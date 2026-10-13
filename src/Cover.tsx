import React from "react";
import { AbsoluteFill, Freeze } from "remotion";
import { Grain, Vignette } from "./components/Overlays";
import { Particles } from "./components/Particles";
import { CINZEL, SERIF_SC } from "./fonts";
import { Enlightenment } from "./scenes/Enlightenment";
import { Exploration } from "./scenes/Exploration";
import { Finale, starPath } from "./scenes/Finale";
import { Greece } from "./scenes/Greece";
import { Industrial } from "./scenes/Industrial";
import { EuropeMap } from "./scenes/Intro";
import { MiddleAges } from "./scenes/MiddleAges";
import { Renaissance } from "./scenes/Renaissance";
import { Rome } from "./scenes/Rome";
import { Wars } from "./scenes/Wars";
import { BAR, SCENES, SceneId, W } from "./timeline";

type Pane = {
  scene: SceneId;
  C: React.FC<{ from: number; dur: number }>;
  /** Absolute frame of the film to freeze on. */
  frame: number;
  /** Vertical centre of the crop, in film pixels. */
  cy: number;
  zoom: number;
  label: string;
  year: string;
};

const PANES: Pane[] = [
  { scene: "greece", C: Greece, frame: 430, cy: 700, zoom: 1.0, label: "古希腊", year: "前 800" },
  { scene: "rome", C: Rome, frame: 670, cy: 650, zoom: 1.0, label: "罗马", year: "前 27" },
  { scene: "middle", C: MiddleAges, frame: 910, cy: 680, zoom: 1.12, label: "中世纪", year: "476" },
  { scene: "renaissance", C: Renaissance, frame: 1150, cy: 650, zoom: 0.95, label: "文艺复兴", year: "1453" },
  { scene: "exploration", C: Exploration, frame: 1270, cy: 640, zoom: 1.05, label: "大航海", year: "1492" },
  { scene: "enlightenment", C: Enlightenment, frame: 1630, cy: 760, zoom: 0.74, label: "大革命", year: "1789" },
  { scene: "industrial", C: Industrial, frame: 1870, cy: 600, zoom: 1.0, label: "工业革命", year: "1769" },
  { scene: "wars", C: Wars, frame: 1990, cy: 585, zoom: 0.88, label: "世界大战", year: "1914" },
  { scene: "finale", C: Finale, frame: 2460, cy: 790, zoom: 0.88, label: "欧洲联合", year: "1950" },
];

/** Pointed (gothic) arch of width w, height h, arc radius r·w. */
const archPath = (w: number, h: number, r = 0.62) => {
  const R = r * w;
  const rise = Math.sqrt(R * R - (R - w / 2) * (R - w / 2));
  return `M0,${h} L0,${rise} A${R},${R} 0 0 1 ${w / 2},0 A${R},${R} 0 0 1 ${w},${rise} L${w},${h} Z`;
};

/** Film y below which each scene's own era caption begins. */
const CUT = 1160;

const Window: React.FC<{ pane: Pane; w: number; h: number; i: number }> = ({ pane, w, h, i }) => {
  const [b0, b1] = SCENES[pane.scene];
  const from = b0 * BAR;
  const s = (w / W) * pane.zoom;
  const d = archPath(w, h);
  const { C } = pane;
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, clipPath: `path('${d}')`, background: "#000" }}>
        <div style={{ position: "absolute", left: w / 2 - 540 * s, top: h * 0.4 - pane.cy * s, width: W, height: 1920,
          transform: `scale(${s})`, transformOrigin: "0 0",
          WebkitMaskImage: `linear-gradient(180deg, #000 ${CUT - 160}px, transparent ${CUT}px)` }}>
          <div style={{ position: "absolute", inset: 0,
            WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 160px, #000 920px, transparent 1080px)" }}>
            <Freeze frame={pane.frame - from}>
              <C from={from} dur={(b1 - b0) * BAR} />
            </Freeze>
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0) 48%, rgba(4,8,26,0.75) 70%, rgba(4,8,26,0.97) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 40px rgba(0,0,0,0.65)" }} />
      </div>
      <svg width={w + 20} height={h + 20} style={{ position: "absolute", left: -10, top: -10, overflow: "visible" }}>
        <g transform="translate(10,10)">
          <path d={d} fill="none" stroke="rgba(255,214,130,0.35)" strokeWidth={9} style={{ filter: "blur(6px)" }} />
          <path d={d} fill="none" stroke="url(#archGold)" strokeWidth={3} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: h * 0.07, textAlign: "center" }}>
        <div style={{ fontFamily: CINZEL, fontSize: Math.round(w * 0.062), letterSpacing: "0.2em", paddingLeft: "0.2em",
          color: "rgba(255,220,150,0.9)", marginBottom: 2 }}>
          {String(i + 1).padStart(2, "0")} · {pane.year}
        </div>
        <div style={{ fontFamily: SERIF_SC, fontWeight: 900, fontSize: Math.round(w * 0.135), letterSpacing: "0.12em",
          paddingLeft: "0.12em", color: "#fff7e6", textShadow: "0 2px 12px rgba(0,0,0,0.9), 0 0 24px rgba(255,200,110,0.45)" }}>
          {pane.label}
        </div>
      </div>
    </div>
  );
};

const GoldRule: React.FC<{ width: number }> = ({ width }) => (
  <div style={{ width, height: 2, background: "linear-gradient(90deg, rgba(255,214,130,0), rgba(255,214,130,0.9), rgba(255,214,130,0))" }} />
);

export type CoverProps = { tall: boolean };

export const Cover: React.FC<CoverProps> = ({ tall }) => {
  const H = tall ? 1920 : 1440;
  const L = tall
    ? { emblem: 175, tag: 296, title: 392, cn: 128, hook: 40, gridTop: 888, winW: 300, winH: 290, gap: 24, rowGap: 30, ringCy: 560 }
    : { emblem: 0, tag: 70, title: 150, cn: 118, hook: 36, gridTop: 560, winW: 296, winH: 252, gap: 22, rowGap: 22, ringCy: 330 };
  const gridW = L.winW * 3 + L.gap * 2;
  const gridH = L.winH * 3 + L.rowGap * 2;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 55% at 50% 22%, #1d3a9c 0%, #0b1d63 38%, #040b2e 70%, #01030f 100%)",
      overflow: "hidden" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="archGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff3c8" />
            <stop offset="0.5" stopColor="#e6b85c" />
            <stop offset="1" stopColor="#8f6424" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: "absolute", left: W / 2 - 1100, top: L.ringCy - 1100, width: 2200, height: 2200,
        background: "repeating-conic-gradient(from 0deg, rgba(255,215,120,0.10) 0deg 2.5deg, rgba(255,215,120,0) 2.5deg 12deg)",
        WebkitMaskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,0.45) 26%, transparent 55%)" }} />
      <Freeze frame={0}>
        <Particles count={tall ? 220 : 170} seed={77} colors={["#ffe08a", "#fff4d0", "#bcd0ff"]} size={[0.6, 2.6]}
          vx={[0, 0]} vy={[0, 0]} twinkle={0.6} opacity={0.8} />
      </Freeze>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 1920,
        transform: `translateY(${L.ringCy - 800}px)`, opacity: 0.4 }}>
        <EuropeMap frame={999} drawStart={0} drawDur={1} cx={540} cy={800} width={tall ? 980 : 900} color="rgba(255,214,120,0.9)" />
      </div>
      {tall && (
        <svg width={W} height={340} style={{ position: "absolute", left: 0, top: 0 }}>
          <circle cx={540} cy={L.emblem} r={100} fill="rgba(255,210,90,0.10)" style={{ filter: "blur(20px)" }} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
            return (
              <path key={i} d={starPath(14)} fill="#ffd84d" stroke="#fff3b0" strokeWidth={1}
                transform={`translate(${540 + 74 * Math.cos(a)},${L.emblem + 74 * Math.sin(a)})`}
                style={{ filter: "drop-shadow(0 0 8px rgba(255,210,80,0.95))" }} />
            );
          })}
        </svg>
      )}

      <div style={{ position: "absolute", left: 0, top: L.tag, width: W, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: SERIF_SC, fontWeight: 700, fontSize: tall ? 32 : 28, letterSpacing: "0.22em", paddingLeft: "0.22em",
          color: "#1a1206", padding: "10px 30px 10px 36px", borderRadius: 999,
          background: "linear-gradient(180deg, #fff1c2 0%, #f0c35f 55%, #c8902f 100%)",
          boxShadow: "0 0 30px rgba(255,200,90,0.55), inset 0 1px 0 rgba(255,255,255,0.7)" }}>
          画面 + 配乐 · 100% 代码生成
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, top: L.title, width: W, textAlign: "center" }}>
        <div style={{ fontFamily: CINZEL, fontWeight: 800, fontSize: tall ? 150 : 120, letterSpacing: "0.16em", paddingLeft: "0.16em",
          lineHeight: 1, filter: "drop-shadow(0 0 26px rgba(255,190,100,0.55))",
          background: "linear-gradient(100deg, #b8873a 0%, #f6e2b0 32%, #fffaf0 42%, #e2b25c 60%, #a8762f 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          EUROPA
        </div>
        <div style={{ marginTop: tall ? 36 : 22, fontFamily: SERIF_SC, fontWeight: 900, fontSize: L.cn, letterSpacing: "0.2em",
          paddingLeft: "0.2em", lineHeight: 1.1, color: "#ffffff",
          textShadow: "0 4px 0 rgba(120,80,20,0.55), 0 0 34px rgba(255,200,110,0.75), 0 0 90px rgba(255,170,70,0.45)" }}>
          欧洲文明史
        </div>
        <div style={{ marginTop: tall ? 34 : 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 26 }}>
          <GoldRule width={tall ? 150 : 120} />
          <div style={{ fontFamily: SERIF_SC, fontWeight: 700, fontSize: L.hook + 12, letterSpacing: "0.16em", paddingLeft: "0.16em",
            color: "#ffd98a", textShadow: "0 0 18px rgba(255,200,100,0.6)" }}>
            90 秒，看完三千年
          </div>
          <GoldRule width={tall ? 150 : 120} />
        </div>
      </div>

      <div style={{ position: "absolute", left: (W - gridW) / 2, top: L.gridTop, width: gridW, height: gridH,
        display: "grid", gridTemplateColumns: `repeat(3, ${L.winW}px)`, columnGap: L.gap, rowGap: L.rowGap }}>
        {PANES.map((p, i) => (
          <Window key={p.scene} pane={p} w={L.winW} h={L.winH} i={i} />
        ))}
      </div>

      <div style={{ position: "absolute", left: 0, top: L.gridTop + gridH + (tall ? 44 : 34), width: W, textAlign: "center",
        fontFamily: CINZEL, fontSize: tall ? 24 : 20, letterSpacing: "0.34em", paddingLeft: "0.34em", color: "rgba(255,226,150,0.8)" }}>
        ATHENAE · ROMA · FLORENTIA · PARIS · BRUXELLAE
      </div>
      <Vignette strength={0.55} />
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};
