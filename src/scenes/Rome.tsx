import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { FrameCanvas } from "../components/Canvas";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle } from "../components/Typography";
import { CINZEL } from "../fonts";
import { bassLevel, pulse } from "../lib/audio";
import { clamp, easeOutBack, easeOutCubic, progress } from "../lib/util";
import { W } from "../timeline";

const HY = 1010;
const F = 900;
const CAMY = 9;

const proj = (x: number, y: number, z: number): [number, number] => [540 + (F * x) / z, HY - (F * (y - CAMY)) / z];

/** Wall in the plane x = X with arched openings, as one even-odd path. */
const drawAqueduct = (ctx: CanvasRenderingContext2D, X: number, zCam: number, light: number) => {
  const BAY = 18;
  const zNear = 2.2;
  const zFar = 520;
  const first = Math.floor((zCam + zNear) / BAY) - 1;
  const last = Math.ceil((zCam + zFar) / BAY);

  const outline = (y0: number, y1: number) => {
    const za = Math.max(first * BAY, zCam + zNear) - zCam;
    const zb = last * BAY - zCam;
    const p = [proj(X, y0, za), proj(X, y1, za), proj(X, y1, zb), proj(X, y0, zb)];
    ctx.moveTo(p[0][0], p[0][1]);
    for (const q of p.slice(1)) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
  };
  const arch = (zc: number, r: number, yBase: number, spring: number) => {
    const z0 = zc - r;
    const z1 = zc + r;
    if (z1 - zCam < zNear || z0 - zCam > zFar) return;
    const pts: [number, number][] = [];
    pts.push(proj(X, yBase, Math.max(zNear, z0 - zCam)));
    pts.push(proj(X, spring, Math.max(zNear, z0 - zCam)));
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI - (i / 14) * Math.PI;
      const z = zc + Math.cos(a) * r - zCam;
      const y = spring + Math.sin(a) * r;
      pts.push(proj(X, y, Math.max(zNear, z)));
    }
    pts.push(proj(X, yBase, Math.max(zNear, z1 - zCam)));
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = pts.length - 1; i >= 1; i--) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };

  const grad = ctx.createLinearGradient(0, 0, 540, 0);
  grad.addColorStop(0, "#0d0304");
  grad.addColorStop(1, "#2a0a0b");
  ctx.fillStyle = grad;
  ctx.beginPath();
  outline(0, 30);
  for (let k = first; k <= last; k++) arch(k * BAY + BAY / 2, 6.2, 0, 14);
  outline(30.6, 43);
  for (let k = first; k <= last; k++) {
    arch(k * BAY + BAY / 4, 3.1, 30.6, 37);
    arch(k * BAY + (3 * BAY) / 4, 3.1, 30.6, 37);
  }
  ctx.fill("evenodd");

  ctx.strokeStyle = `rgba(255,150,80,${0.55 * light})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const y of [30, 43]) {
    const a = proj(X, y, Math.max(zNear, first * BAY - zCam));
    const b = proj(X, y, last * BAY - zCam);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
};

const drawRoad = (ctx: CanvasRenderingContext2D, zCam: number) => {
  const g = ctx.createLinearGradient(0, HY, 0, 1920);
  g.addColorStop(0, "#3a1209");
  g.addColorStop(0.15, "#1a0705");
  g.addColorStop(1, "#070202");
  ctx.fillStyle = g;
  ctx.fillRect(0, HY, W, 1920 - HY);
  ctx.strokeStyle = "rgba(255,140,70,0.07)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = -8; x <= 8; x += 2) {
    const a = proj(x, 0, 1.2);
    const b = proj(x, 0, 600);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  const S = 3;
  const start = Math.floor(zCam / S) * S;
  for (let z = start; z < zCam + 300; z += S) {
    const zz = z - zCam;
    if (zz < 1.2) continue;
    const a = proj(-8, 0, zz);
    const b = proj(8, 0, zz);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  const edge = ctx.createLinearGradient(0, HY, 0, 1920);
  edge.addColorStop(0, "rgba(255,170,90,0.5)");
  edge.addColorStop(1, "rgba(255,120,60,0.05)");
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const x of [-8, 8]) {
    const a = proj(x, 0, 1.2);
    const b = proj(x, 0, 600);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
};

const leafPath = (len: number, wid: number) =>
  `M0,0 Q${wid},${-len * 0.45} 0,${-len} Q${-wid},${-len * 0.45} 0,0 Z`;

export const Rome: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const zCam = f * 0.3;
  const thump = Math.min(1.2, pulse(g, 0.4, 5));
  const leaves = useMemo(() => {
    const out: { x: number; y: number; rot: number; at: number; s: number }[] = [];
    const R = 215;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 15; i++) {
        const t = i / 14;
        const ang = Math.PI / 2 + side * (0.32 + t * 2.35);
        const x = 540 + Math.cos(ang) * R;
        const y = 560 + Math.sin(ang) * R;
        const vx = side < 0 ? -Math.sin(ang) : Math.sin(ang);
        const vy = side < 0 ? Math.cos(ang) : -Math.cos(ang);
        const along = (Math.atan2(vx, -vy) * 180) / Math.PI;
        for (const o of [-1, 1]) {
          out.push({ x, y, rot: along + o * 38, at: 6 + i * 6 + (o > 0 ? 3 : 0), s: 1 - t * 0.35 });
        }
      }
    }
    return out;
  }, []);

  return (
    <Stage from={from} dur={dur} zoom={[1.0, 1.04]} shake={0.5}
      background="linear-gradient(180deg, #0c0206 0%, #2c0710 18%, #6a1414 36%, #c4501f 47%, #f08a3a 51%, #f6b066 52.6%, #3a1209 52.65%, #070202 100%)">
      <div style={{ position: "absolute", left: 540 - 520, top: HY - 520, width: 1040, height: 1040, borderRadius: 520,
        background: "radial-gradient(circle, rgba(255,226,170,0.95) 0%, rgba(255,190,110,0.85) 11%, rgba(255,120,50,0.35) 25%, rgba(200,60,30,0.12) 45%, rgba(0,0,0,0) 70%)",
        clipPath: `inset(0 0 ${520 - 2}px 0)` }} />
      <FrameCanvas deps={[f]} draw={(ctx) => {
        drawRoad(ctx, zCam);
        drawAqueduct(ctx, -26, zCam, 0.8 + 0.4 * bassLevel(g));
      }} />
      <Particles count={70} seed={8} colors={["#ffb070", "#ff7a3a", "#ffd9a0"]} size={[0.8, 2.6]} vx={[-0.4, 0.2]}
        vy={[-1.4, -0.4]} sway={20} twinkle={0.5} opacity={0.8} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="gold-r" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff0c0" />
            <stop offset="0.45" stopColor="#e4b456" />
            <stop offset="1" stopColor="#9a6a22" />
          </linearGradient>
        </defs>
        <g style={{ filter: `drop-shadow(0 0 ${10 + 14 * thump}px rgba(255,170,80,0.85))` }}>
          {leaves.map((l, i) => {
            const t = progress(f, l.at, 12);
            if (t <= 0) return null;
            const e = easeOutBack(t);
            return (
              <path key={i} d={leafPath(58 * l.s, 15 * l.s)} fill="url(#gold-r)" stroke="#6a4512" strokeWidth={1}
                transform={`translate(${l.x},${l.y}) rotate(${l.rot}) scale(${e})`} opacity={clamp(t * 3)} />
            );
          })}
          <path d="M520,790 Q540,770 560,790" stroke="url(#gold-r)" strokeWidth={5} fill="none"
            opacity={easeOutCubic(progress(f, 90, 20))} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: 0, top: 480, width: W, textAlign: "center", fontFamily: CINZEL,
        fontWeight: 900, fontSize: 150, letterSpacing: "0.08em", paddingLeft: "0.08em", lineHeight: 1,
        background: "linear-gradient(180deg, #fff3cf 0%, #e9bb5c 50%, #a26f22 100%)", WebkitBackgroundClip: "text",
        color: "transparent",
        filter: `drop-shadow(0 0 ${16 + 20 * thump}px rgba(255,160,70,0.8))`,
        transform: `scale(${1 + 0.6 * (1 - easeOutCubic(progress(f, 2, 16))) + 0.02 * thump})`,
        opacity: easeOutCubic(progress(f, 2, 10)) }}>
        SPQR
      </div>
      <EraTitle
        date="公元前 27 — 公元 476 年"
        title="罗马帝国"
        en="ROMAN EMPIRE"
        tone={{ text: "#fff1e0", accent: "#f2be6a", sub: "rgba(242,190,106,0.9)", glow: "rgba(255,110,50,0.55)" }}
        lines={[
          { text: "法律 · 道路 · 共和", at: 40, until: 132 },
          { text: "「条条大路通罗马」", at: 140 },
        ]}
        exitAt={224}
        y={1150}
      />
    </Stage>
  );
};
