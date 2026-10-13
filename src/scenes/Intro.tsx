import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import geo from "../data/geo.json";
import { LensStreak } from "../components/Overlays";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { Reveal } from "../components/Typography";
import { CINZEL, SERIF_SC } from "../fonts";
import { loudness } from "../lib/audio";
import { clamp, easeInCubic, easeOutCubic, easeOutExpo, progress } from "../lib/util";
import { W } from "../timeline";

type City = { name: string; x: number; y: number };

export const EuropeMap: React.FC<{
  frame: number;
  drawStart: number;
  drawDur: number;
  cx: number;
  cy: number;
  width: number;
  color: string;
  opacity?: number;
  cityStart?: number;
  cityStagger?: number;
  cityColor?: string;
}> = ({ frame, drawStart, drawDur, cx, cy, width, color, opacity = 1, cityStart, cityStagger = 2.2, cityColor = "#ffe2a8" }) => {
  const scale = width / geo.europe.w;
  const h = geo.europe.h * scale;
  const cities = useMemo(() => {
    const ath = geo.cities[0];
    return [...(geo.cities as City[])].sort(
      (a, b) => Math.hypot(a.x - ath.x, a.y - ath.y) - Math.hypot(b.x - ath.x, b.y - ath.y),
    );
  }, []);
  const p = easeOutCubic(progress(frame, drawStart, drawDur));
  const maskId = `emask-${cx}-${cy}`;
  return (
    <svg
      width={W}
      height={1920}
      style={{ position: "absolute", left: 0, top: 0, opacity }}
      viewBox={`0 0 ${W} 1920`}
    >
      <defs>
        <radialGradient id={maskId + "c"}>
          <stop offset="0" stopColor={cityColor} stopOpacity="0.9" />
          <stop offset="0.25" stopColor={cityColor} stopOpacity="0.35" />
          <stop offset="1" stopColor={cityColor} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={maskId + "g"} cx="50%" cy="50%" r="50%">
          <stop offset="0.6" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={maskId}>
          <rect x={cx - width / 2 - 40} y={cy - h / 2 - 40} width={width + 80} height={h + 80} fill={`url(#${maskId}g)`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} transform={`translate(${cx - width / 2}, ${cy - h / 2}) scale(${scale})`}>
        <g style={{ filter: `drop-shadow(0 0 ${6 / scale}px ${color})` }}>
          {geo.europe.paths.map((pt, i) => {
            const local = clamp(p * 1.25 - (i / geo.europe.paths.length) * 0.25);
            return (
              <path
                key={i}
                d={pt.d}
                fill="none"
                stroke={color}
                strokeWidth={1.6 / scale}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - local}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </g>
        {cityStart !== undefined &&
          cities.map((c, i) => {
            const t = progress(frame, cityStart + i * cityStagger, 14);
            if (t <= 0) return null;
            const e = easeOutExpo(t);
            const flare = Math.exp(-Math.max(0, frame - cityStart - i * cityStagger) / 10);
            return (
              <g key={c.name} transform={`translate(${c.x}, ${c.y})`}>
                <circle r={(16 + 34 * flare) / scale} fill={`url(#${maskId}c)`} opacity={(0.55 + 0.45 * flare) * e} />
                <circle r={2.4 / scale} fill="#fff" opacity={e} />
              </g>
            );
          })}
      </g>
    </svg>
  );
};

export const RingText: React.FC<{
  text: string;
  cx: number;
  cy: number;
  r: number;
  rotate: number;
  color: string;
  size: number;
  opacity: number;
  id: string;
}> = ({ text, cx, cy, r, rotate, color, size, opacity, id }) => (
  <svg width={W} height={1920} style={{ position: "absolute", left: 0, top: 0, opacity }}>
    <defs>
      <path id={id} d={`M ${cx} ${cy - r} a ${r} ${r} 0 1 1 -0.01 0`} />
    </defs>
    <g transform={`rotate(${rotate} ${cx} ${cy})`}>
      <text fill={color} fontFamily={CINZEL} fontSize={size} fontWeight={600} letterSpacing={size * 0.32}>
        <textPath href={`#${id}`}>{text}</textPath>
      </text>
    </g>
  </svg>
);

export const Intro: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const lv = loudness(g);
  const titleIn = progress(f, 34, 70);
  const spacing = 0.62 - 0.46 * easeOutExpo(titleIn);
  const dim = 1 - 0.55 * easeOutCubic(progress(f, 120, 60));
  const streak = easeOutExpo(progress(f, 0, 26)) * (1 - 0.65 * easeOutCubic(progress(f, 26, 60))) + 0.15 * lv;
  const end = easeInCubic(progress(f, 205, 35));

  return (
    <Stage from={from} dur={dur} zoom={[1.08, 1.0]} fadeIn={1} fadeOut={6}
      background="radial-gradient(ellipse 80% 60% at 50% 44%, #1a1f45 0%, #0a0b1c 45%, #010104 100%)">
      <Particles count={260} seed={3} colors={["#ffffff", "#ffe6b0", "#bcd0ff"]} size={[0.6, 2.6]}
        vx={[-0.05, 0.05]} vy={[-0.12, -0.02]} twinkle={0.8} opacity={0.9} parallax />
      <EuropeMap frame={f} drawStart={8} drawDur={120} cx={540} cy={800} width={1000}
        color="rgba(232,199,122,0.85)" opacity={0.75 * dim} cityStart={50} cityStagger={2.4} />
      <RingText id="intro-ring" text={"ΕΥΡΩΠΗ · EUROPA · ΕΥΡΩΠΗ · EUROPA · ΕΥΡΩΠΗ · EUROPA · ΕΥΡΩΠΗ · EUROPA · "}
        cx={540} cy={800} r={470} rotate={f * 0.12 - 30} color="#e8c77a" size={26}
        opacity={0.55 * easeOutCubic(progress(f, 80, 60))} />
      <LensStreak y={790} intensity={streak} />
      <div style={{ position: "absolute", left: 0, top: 700, width: W, textAlign: "center" }}>
        <div
          style={{
            fontFamily: CINZEL,
            fontWeight: 800,
            fontSize: 168,
            letterSpacing: `${spacing}em`,
            paddingLeft: `${spacing}em`,
            lineHeight: 1,
            opacity: easeOutCubic(titleIn),
            filter: `blur(${(1 - easeOutCubic(titleIn)) * 22}px) drop-shadow(0 0 28px rgba(255,190,110,0.45))`,
            background: `linear-gradient(100deg, #b8873a 0%, #f6e2b0 ${30 + f * 0.25}%, #fff7e2 ${38 + f * 0.25}%, #d9a650 ${55 + f * 0.25}%, #a8762f 100%)`,
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          EUROPA
        </div>
        <div style={{ marginTop: 56, fontFamily: SERIF_SC, fontWeight: 900, fontSize: 96, letterSpacing: "0.42em",
          paddingLeft: "0.42em", color: "#fff4dc", textShadow: "0 0 30px rgba(255,190,110,0.6), 0 0 80px rgba(255,170,80,0.35)" }}>
          <Reveal text="欧洲文明史" start={70} stagger={5} dur={22} rise={40} blur={24} scaleFrom={1.3} />
        </div>
        <div style={{ marginTop: 40, fontFamily: SERIF_SC, fontWeight: 500, fontSize: 40, letterSpacing: "0.4em",
          paddingLeft: "0.4em", color: "#e8c77a" }}>
          <Reveal text="三千年 · 九十秒" start={104} stagger={2} dur={16} rise={14} blur={10} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 1330, textAlign: "center", fontFamily: SERIF_SC,
        fontSize: 34, lineHeight: 1.9, letterSpacing: "0.08em", color: "rgba(240,226,200,0.85)",
        opacity: easeOutCubic(progress(f, 140, 20)) }}>
        <Reveal text="「欧罗巴」之名，源自希腊神话中" start={140} stagger={1} dur={14} rise={10} blur={8} />
        <br />
        <Reveal text="被宙斯化身白牛带往克里特岛的腓尼基公主" start={156} stagger={1} dur={14} rise={10} blur={8} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff1d6", opacity: end * 0.5, mixBlendMode: "screen" }} />
    </Stage>
  );
};
