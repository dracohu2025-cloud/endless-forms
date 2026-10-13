import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FrameCanvas } from "../../components/Canvas";
import { pulse } from "../lib/audio";
import { clamp, easeIn, easeOut, envelope, lerp, mulberry32, noise2, progress, smooth } from "../lib/math";
import { MARCH, MARCH_GROUND } from "../engine/forms";
import { H, W } from "../timeline";

const Layer: React.FC<{ o: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({ o, children, style }) =>
  o <= 0.001 ? null : <AbsoluteFill style={{ opacity: o, ...style }}>{children}</AbsoluteFill>;

const STARS = (() => {
  const r = mulberry32(8);
  return Array.from({ length: 260 }, () => ({ x: r() * W, y: r() * H, s: 0.4 + r() * r() * 2.4, p: r() * 6.3 }));
})();

const Stars: React.FC<{ f: number; maxY?: number; alpha?: number }> = ({ f, maxY = H, alpha = 1 }) => (
  <FrameCanvas
    deps={[f, maxY, alpha]}
    draw={(ctx) => {
      for (const s of STARS) {
        if (s.y > maxY) continue;
        ctx.globalAlpha = alpha * (0.35 + 0.35 * Math.sin(f * 0.06 + s.p)) * Math.min(1, s.s);
        ctx.fillStyle = "#e8f2ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }}
  />
);

/** God rays through water. */
const Rays: React.FC<{ f: number; color: string; count?: number }> = ({ f, color, count = 7 }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", filter: "blur(18px)" }}>
    {Array.from({ length: count }, (_, i) => {
      const x = 80 + (i * 960) / (count - 1) + 60 * noise2(i * 3.3, f * 0.006);
      const w = 70 + 60 * (0.5 + 0.5 * noise2(i * 7.1, f * 0.01));
      const a = 0.35 + 0.35 * (0.5 + 0.5 * noise2(i * 1.7, f * 0.012));
      return (
        <div key={i} style={{ position: "absolute", left: x - w / 2, top: -200, width: w, height: 1800,
          transform: `rotate(${12 + 6 * noise2(i, f * 0.004)}deg)`, transformOrigin: "50% 0%",
          background: `linear-gradient(180deg, ${color} 0%, rgba(0,0,0,0) 85%)`, opacity: a }} />
      );
    })}
  </AbsoluteFill>
);

const fern = (x: number, y: number, s: number, lean: number, seed: number) => {
  const r = mulberry32(seed);
  let d = "";
  const fronds = 7 + Math.floor(r() * 4);
  for (let k = 0; k < fronds; k++) {
    const a = -Math.PI / 2 + lean + (k / (fronds - 1) - 0.5) * 2.4;
    const len = s * (0.6 + 0.5 * r());
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    const cx = x + Math.cos(a + 0.4) * len * 0.5;
    const cy = y + Math.sin(a + 0.4) * len * 0.5 - len * 0.2;
    d += `M${x},${y} Q${cx},${cy} ${ex},${ey} `;
    for (let q = 1; q < 9; q++) {
      const t = q / 9;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
      const l = len * 0.16 * (1 - t);
      d += `M${px},${py} l${Math.cos(a - 1.1) * l},${Math.sin(a - 1.1) * l} M${px},${py} l${Math.cos(a + 1.1) * l},${Math.sin(a + 1.1) * l} `;
    }
  }
  return d;
};

const acacia = (x: number, y: number, k: number) =>
  `M${x},${y} L${x + 3 * k},${y - 120 * k} L${x - 40 * k},${y - 170 * k} M${x + 3 * k},${y - 120 * k} L${x + 34 * k},${y - 180 * k}`;

const HOMININS = ["地猿", "南方古猿", "能人", "直立人", "智人"];

/** Bush-shaped hominin cladogram growing beneath the march: branches, not a ladder. */
const Cladogram: React.FC<{ f: number }> = ({ f }) => {
  const g = easeOut(progress(f, 1812, 52));
  if (g <= 0) return null;
  const root = { x: 540, y: 1640 };
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {MARCH.map((m, k) => {
        const local = clamp(g * 1.6 - k * 0.15);
        if (local <= 0) return null;
        const midY = lerp(root.y, MARCH_GROUND + 70, 0.4 + 0.08 * k);
        const d = `M${root.x},${root.y} C${root.x},${midY} ${m.x},${midY + 30} ${m.x},${MARCH_GROUND + 14}`;
        const hue = lerp(28, 190, m.p);
        const alive = k === MARCH.length - 1;
        return (
          <g key={k}>
            <path d={d} pathLength={1} strokeDasharray={`${local} 1`} fill="none" stroke={`hsla(${hue},90%,70%,${alive ? 0.95 : 0.55})`}
              strokeWidth={alive ? 4 : 2.5} style={{ filter: `drop-shadow(0 0 6px hsl(${hue},90%,55%))` }} />
            {!alive && local > 0.95 && <circle cx={m.x} cy={MARCH_GROUND + 14} r={5} fill="none" stroke={`hsla(${hue},80%,70%,0.7)`} strokeWidth={2} />}
            <text x={m.x} y={MARCH_GROUND + 52} textAnchor="middle" fill={`hsla(${hue},70%,82%,${clamp(local * 3 - 2)})`}
              fontFamily="'Noto Sans SC'" fontWeight={alive ? 700 : 400} fontSize={alive ? 30 : 24} letterSpacing={2}>{HOMININS[k]}</text>
          </g>
        );
      })}
      <circle cx={root.x} cy={root.y} r={7 + 3 * Math.sin(f * 0.2)} fill="#fff1d6" style={{ filter: "drop-shadow(0 0 10px #ffb070)" }} />
      <text x={root.x} y={root.y + 42} textAnchor="middle" fill="rgba(255,230,200,0.75)" fontFamily="'JetBrains Mono', 'Noto Sans SC'" fontSize={20} letterSpacing={4}
        opacity={clamp(g * 2)}>共同祖先 · 700 万年前  ○ 已灭绝的旁支</text>
    </svg>
  );
};

export const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const ferns = useMemo(
    () => [fern(60, 1440, 240, -0.2, 1), fern(230, 1460, 170, 0.1, 2), fern(980, 1450, 260, 0.25, 3), fern(820, 1470, 150, -0.1, 4), fern(450, 1480, 120, 0, 5)].join(" "),
    [],
  );

  const abyss = envelope(f, -10, 1, 220, 50);
  const micro = envelope(f, 200, 50, 712, 20);
  const sea = envelope(f, 700, 30, 1085, 30);
  const shore = envelope(f, 1062, 40, 1170, 40);
  const meso = envelope(f, 1150, 50, 1440, 4);
  const fire = envelope(f, 1440, 2, 1480, 90);
  const night = envelope(f, 1520, 40, 1680, 50);
  const dawn = envelope(f, 1660, 50, 1765, 30);
  const savanna = envelope(f, 1750, 40, 1880, 30);
  const void_ = envelope(f, 1870, 30, 2010, 20);
  const dnaBg = envelope(f, 1990, 40, 2245, 40);
  const cosmos = envelope(f, 2230, 50, 2640, 60);

  // the camera rises through the water surface around bar 18
  const surface = lerp(-80, 1060, easeOut(progress(f, 1040, 70)));
  const sunY = lerp(1080, 960, smooth(progress(f, 1150, 300)));
  const impactFlash = pulse(f, "impact", 10);
  const streak = progress(f, 1390, 50);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Layer o={abyss} style={{ background: "radial-gradient(ellipse 70% 40% at 50% 104%, rgba(255,110,40,0.38) 0%, rgba(120,30,10,0.16) 40%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #010307 0%, #020a10 70%, #0a0604 100%)" }} />
      <Layer o={micro} style={{ background: "radial-gradient(circle at 50% 46%, #0b3a44 0%, #052129 32%, #020b10 62%, #000 100%)" }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
          <circle cx={540} cy={880} r={510} fill="none" stroke="#7ff3ff" strokeWidth={1.2} strokeDasharray="2 10" />
          <circle cx={540} cy={880} r={530} fill="none" stroke="#7ff3ff" strokeWidth={0.6} />
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i / 72) * Math.PI * 2;
            const l = i % 6 === 0 ? 22 : 9;
            return <line key={i} x1={540 + Math.cos(a) * 530} y1={880 + Math.sin(a) * 530} x2={540 + Math.cos(a) * (530 + l)} y2={880 + Math.sin(a) * (530 + l)} stroke="#7ff3ff" strokeWidth={1} />;
          })}
          <line x1={110} y1={1560} x2={290} y2={1560} stroke="#7ff3ff" strokeWidth={3} />
          <text x={110} y={1600} fill="#7ff3ff" fontFamily="'JetBrains Mono'" fontSize={24} letterSpacing={2}>10 μm</text>
        </svg>
      </Layer>
      <Layer o={sea} style={{ background: "linear-gradient(180deg, #0d4f78 0%, #07304d 30%, #031827 65%, #01080e 100%)" }}>
        <Rays f={f} color="rgba(140,230,255,0.55)" />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 420, background: "radial-gradient(ellipse 80% 70% at 50% 100%, rgba(80,160,170,0.22), rgba(0,0,0,0) 70%)" }} />
      </Layer>
      <Layer o={shore}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: Math.max(0, surface),
          background: "linear-gradient(180deg, #152a5e 0%, #5b4a8a 45%, #e88a6a 85%, #ffc38a 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: surface, bottom: 0,
          background: "linear-gradient(180deg, #2a5c78 0%, #0c2b40 30%, #04121c 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: surface - 2, height: 4, background: "rgba(255,230,200,0.85)", filter: "blur(2px)" }} />
        <div style={{ position: "absolute", left: 470, top: surface - 140, width: 140, height: 140, borderRadius: "50%",
          background: "radial-gradient(circle, #fff6dc 0%, #ffd29a 40%, rgba(255,180,120,0) 72%)" }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: smooth(progress(f, 1085, 30)) }}>
          <defs>
            <linearGradient id="beach" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a2a2c" />
              <stop offset="0.12" stopColor="#1a1416" />
              <stop offset="1" stopColor="#060506" />
            </linearGradient>
          </defs>
          <path d="M0,1300 C260,1272 560,1258 1080,1246 L1080,1920 L0,1920 Z" fill="url(#beach)" />
          <path d="M0,1300 C260,1272 560,1258 1080,1246" stroke="rgba(255,205,160,0.7)" strokeWidth={3} fill="none" style={{ filter: "blur(1px)" }} />
          <path d={`M0,${1306 + 4 * Math.sin(f * 0.07)} C260,${1279 + 4 * Math.sin(f * 0.07 + 1)} 560,${1266 + 4 * Math.sin(f * 0.07 + 2)} 1080,${1254 + 4 * Math.sin(f * 0.07 + 3)}`}
            stroke="rgba(200,240,255,0.35)" strokeWidth={6} fill="none" style={{ filter: "blur(3px)" }} />
        </svg>
      </Layer>
      <Layer o={meso}>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, #1c0f33 0%, #4a1f4f 35%, #c4474a 70%, #ff9a52 88%, #ffc070 100%)" }} />
        <div style={{ position: "absolute", left: 700 - 300, top: sunY - 300, width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,240,200,1) 0%, rgba(255,200,120,0.95) 34%, rgba(255,140,80,0.35) 48%, rgba(255,120,60,0) 70%)" }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <path d="M0,1080 L120,1030 L230,1060 L330,960 L390,920 L440,960 L560,1040 L700,1010 L860,1060 L1080,1020 L1080,1100 L0,1100 Z" fill="#2a1430" opacity={0.85} />
          <path d="M370,936 Q392,880 410,936" fill="none" stroke="rgba(255,120,60,0.6)" strokeWidth={3} />
          <rect x={0} y={1090} width={W} height={340} fill="#190a1c" />
          <path d="M0,1430 C200,1410 400,1425 600,1418 C800,1410 950,1425 1080,1415 L1080,1920 L0,1920 Z" fill="#07030a" />
          <path d={ferns} stroke="#07030a" strokeWidth={5} fill="none" strokeLinecap="round" />
        </svg>
        <Layer o={streak > 0 && streak < 1 ? 1 : 0}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="ast" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#fff6d0" stopOpacity="1" />
              </linearGradient>
            </defs>
            {(() => {
              const t = easeIn(streak);
              const x = lerp(1180, 760, t);
              const y = lerp(-120, 1000, t);
              return (
                <g style={{ filter: "drop-shadow(0 0 18px #ffb060)" }}>
                  <line x1={x + 420 * 0.45} y1={y - 420} x2={x} y2={y} stroke="url(#ast)" strokeWidth={10} strokeLinecap="round" />
                  <circle cx={x} cy={y} r={12} fill="#fff" />
                </g>
              );
            })()}
          </svg>
        </Layer>
      </Layer>
      <Layer o={fire} style={{ background: "radial-gradient(ellipse 120% 60% at 70% 52%, #ffe2b0 0%, #ff6a2a 18%, #6a1a10 45%, #160806 75%, #050302 100%)" }}>
        <div style={{ position: "absolute", left: 760 - 2000 * easeOut(progress(f, 1440, 40)), top: 1000 - 2000 * easeOut(progress(f, 1440, 40)),
          width: 4000 * easeOut(progress(f, 1440, 40)), height: 4000 * easeOut(progress(f, 1440, 40)), borderRadius: "50%",
          border: "30px solid rgba(255,220,170,0.45)", filter: "blur(14px)", opacity: 1 - progress(f, 1440, 40) }} />
      </Layer>
      <Layer o={clamp(envelope(f, 1460, 30, 1530, 40) * 0.9)} style={{ background: "linear-gradient(180deg, #1a1614 0%, #2a201a 60%, #120c0a 100%)" }} />
      <Layer o={night} style={{ background: "linear-gradient(180deg, #050816 0%, #0b1433 55%, #10183a 80%, #05060c 100%)" }}>
        <Stars f={f} maxY={1250} />
        <div style={{ position: "absolute", left: 760, top: 300, width: 120, height: 120, borderRadius: "50%",
          background: "radial-gradient(circle at 40% 40%, #fbf7e6 0%, #d8d4c4 60%, #a9a698 100%)", boxShadow: "0 0 80px 20px rgba(220,230,255,0.25)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 1330, bottom: 0, background: "#020308" }} />
      </Layer>
      <Layer o={dawn} style={{ background: "linear-gradient(180deg, #1d2b5c 0%, #5a5aa0 40%, #f2a0a0 78%, #ffd6a8 100%)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 1480, bottom: 0, background: "#0c0a14" }} />
      </Layer>
      <Layer o={savanna} style={{ background: "linear-gradient(180deg, #2a1838 0%, #8a3a3a 38%, #f08040 72%, #ffcf7a 92%)" }}>
        <div style={{ position: "absolute", left: 540 - 330, top: 1460 - 330, width: 660, height: 660, borderRadius: "50%",
          background: "radial-gradient(circle, #fff3c8 0%, #ffd27a 42%, rgba(255,160,80,0.3) 55%, rgba(255,140,60,0) 70%)" }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <path d={acacia(250, 1446, 1.6)} stroke="#2a0f10" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.85} />
          <ellipse cx={186} cy={1170} rx={120} ry={22} fill="#2a0f10" opacity={0.85} />
          <ellipse cx={300} cy={1160} rx={70} ry={18} fill="#2a0f10" opacity={0.85} />
          <path d="M0,1180 L140,1150 L260,1170 L420,1130 L600,1165 L800,1140 L1080,1170 L1080,1450 L0,1450 Z" fill="#3a1820" opacity={0.35} />
          <path d={`M0,${MARCH_GROUND} C300,${MARCH_GROUND - 6} 760,${MARCH_GROUND + 4} 1080,${MARCH_GROUND - 4} L1080,1920 L0,1920 Z`} fill="#0a0506" />
          <path d={`M0,${MARCH_GROUND} C300,${MARCH_GROUND - 6} 760,${MARCH_GROUND + 4} 1080,${MARCH_GROUND - 4}`} stroke="rgba(255,190,120,0.55)" strokeWidth={2} fill="none" />
        </svg>
        <Cladogram f={f} />
      </Layer>
      <Layer o={void_} style={{ background: "radial-gradient(ellipse 50% 40% at 50% 55%, #0e3344 0%, #06141c 50%, #010305 100%)" }}>
        <div style={{ position: "absolute", left: 540 - 380, top: 1600, width: 760, height: 90, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(120,230,255,0.25), rgba(0,0,0,0) 70%)" }} />
      </Layer>
      <Layer o={dnaBg} style={{ background: "radial-gradient(ellipse 60% 55% at 50% 50%, #1d0b3a 0%, #0a0418 55%, #000 100%)" }} />
      <Layer o={cosmos} style={{ background: "radial-gradient(ellipse 70% 45% at 50% 47%, #0a1c33 0%, #050a18 50%, #010207 100%)" }}>
        <Stars f={f} alpha={0.8} />
        <div style={{ position: "absolute", left: 540 - 520, top: 900 - 520, width: 1040, height: 1040, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(60,200,255,0.10) 0%, rgba(200,80,255,0.06) 45%, rgba(0,0,0,0) 70%)" }} />
      </Layer>
      <AbsoluteFill style={{ background: "#fff", opacity: Math.max(impactFlash * 0.95, 0.75 * pulse(f, "drop", 5) * (f < 800 ? 1 : 0.35)), mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};
