import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import geo from "../data/geo.json";
import { FrameCanvas } from "../components/Canvas";
import { Particles } from "../components/Particles";
import { Stage } from "../components/Stage";
import { EraTitle, Reveal } from "../components/Typography";
import { GARAMOND } from "../fonts";
import { clamp, easeInOutCubic, easeOutCubic, lerp, progress } from "../lib/util";
import { W } from "../timeline";

const D2R = Math.PI / 180;
const GLOBE = { x: 540, y: 690, r: 330 };
const SUN = { x: 540, y: 700 };
const TILT = 0.36;
const ORBITS = [
  { r: 95, c: "#c9c0b0", s: 5 },
  { r: 150, c: "#f3dca4", s: 8 },
  { r: 215, c: "#6cb8ff", s: 9 },
  { r: 290, c: "#ff835a", s: 7 },
  { r: 390, c: "#ecc79c", s: 18 },
  { r: 500, c: "#eadbb0", s: 14 },
];
const EARTH = 2;
const omega = (r: number) => 0.03 * Math.pow(215 / r, 1.5);
const theta = (i: number, f: number) => [0.4, 2.1, 0.9, 3.6, 5.1, 2.6][i] + omega(ORBITS[i].r) * (f - 150);
const planetPos = (i: number, f: number) => {
  const t = theta(i, f);
  return { x: SUN.x + ORBITS[i].r * Math.cos(t), y: SUN.y + ORBITS[i].r * TILT * Math.sin(t), back: Math.sin(t) < 0 };
};

const ROUTES: { pts: [number, number][]; color: string; at: number; dur: number }[] = [
  { pts: [[37.2, -6.9], [28.1, -15.4], [26, -40], [24.0, -74.5]], color: "#ffd27a", at: 14, dur: 60 },
  { pts: [[38.7, -9.1], [15, -23.5], [-10, -28], [-34.4, 18.5], [-25.9, 32.6], [-3.2, 40.1], [11.25, 75.8]], color: "#ff9c5a", at: 26, dur: 80 },
  { pts: [[37.4, -6.0], [-22.9, -43.2], [-52.5, -69.5], [-30, -100], [-5, -140], [13.4, 144.8]], color: "#ffffff", at: 40, dur: 74 },
];

const toVec = (lat: number, lon: number) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];
const toLatLon = (v: number[]): [number, number] => [Math.asin(clamp(v[2], -1, 1)) / D2R, Math.atan2(v[1], v[0]) / D2R];
const slerp = (a: number[], b: number[], t: number) => {
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const om = Math.acos(dot);
  if (om < 1e-6) return a;
  const s = Math.sin(om);
  const k0 = Math.sin((1 - t) * om) / s;
  const k1 = Math.sin(t * om) / s;
  return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
};
const densify = (pts: [number, number][]) => {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = toVec(...pts[i]);
    const b = toVec(...pts[i + 1]);
    for (let k = 0; k < 30; k++) out.push(toLatLon(slerp(a, b, k / 30)));
  }
  out.push(pts[pts.length - 1]);
  return out;
};

export const Exploration: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const f = useCurrentFrame();
  const routes = useMemo(() => ROUTES.map((r) => ({ ...r, path: densify(r.pts) })), []);
  const dots = geo.globe as [number, number][];

  const lon0 = lerp(5, -50, easeInOutCubic(progress(f, 0, 130)));
  const lat0 = 22;
  const morph = easeInOutCubic(progress(f, 104, 46));
  const earth = planetPos(EARTH, f);
  const gx = lerp(GLOBE.x, earth.x, morph);
  const gy = lerp(GLOBE.y, earth.y, morph);
  const gr = Math.exp(lerp(Math.log(GLOBE.r), Math.log(ORBITS[EARTH].s), morph));
  const solar = easeOutCubic(progress(f, 112, 50));
  const roseA = (1 - morph) * easeOutCubic(progress(f, 0, 40));

  const project = (lat: number, lon: number) => {
    const la = lat * D2R;
    const dl = (lon - lon0) * D2R;
    const c0 = Math.cos(lat0 * D2R);
    const s0 = Math.sin(lat0 * D2R);
    const x = Math.cos(la) * Math.sin(dl);
    const y = c0 * Math.sin(la) - s0 * Math.cos(la) * Math.cos(dl);
    const z = s0 * Math.sin(la) + c0 * Math.cos(la) * Math.cos(dl);
    return { x: gx + gr * x, y: gy - gr * y, z };
  };

  return (
    <Stage from={from} dur={dur} zoom={[1.0, 1.04]}
      background="radial-gradient(ellipse 90% 70% at 50% 38%, #0b2346 0%, #04122a 50%, #01060f 100%)">
      <Particles count={200} seed={5} colors={["#ffffff", "#cfe0ff"]} size={[0.5, 1.8]} vx={[-0.03, 0.03]} vy={[-0.03, 0.03]}
        twinkle={0.8} opacity={0.7} />
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0, opacity: roseA * 0.5 }}>
        <g transform={`rotate(${f * 0.08} ${GLOBE.x} ${GLOBE.y})`} fill="none" stroke="#9cc7ff" strokeWidth={1.2}>
          {Array.from({ length: 32 }, (_, i) => {
            const a = (i / 32) * Math.PI * 2;
            const len = i % 8 === 0 ? 520 : i % 4 === 0 ? 430 : i % 2 === 0 ? 400 : 380;
            const w = i % 8 === 0 ? 0.06 : 0.04;
            const p = (r: number, aa: number) => `${GLOBE.x + r * Math.cos(aa)},${GLOBE.y + r * Math.sin(aa)}`;
            return <path key={i} d={`M${p(360, a - w)} L${p(len, a)} L${p(360, a + w)}`} opacity={i % 2 ? 0.5 : 0.9} />;
          })}
          {[362, 372, 470].map((r) => (
            <circle key={r} cx={GLOBE.x} cy={GLOBE.y} r={r} opacity={0.6} />
          ))}
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i / 72) * Math.PI * 2;
            const r1 = i % 6 === 0 ? 352 : 358;
            return <line key={i} x1={GLOBE.x + r1 * Math.cos(a)} y1={GLOBE.y + r1 * Math.sin(a)} x2={GLOBE.x + 362 * Math.cos(a)} y2={GLOBE.y + 362 * Math.sin(a)} />;
          })}
        </g>
      </svg>
      <FrameCanvas deps={[f]} draw={(ctx) => {
        if (solar > 0.001) {
          ctx.save();
          ctx.globalAlpha = solar;
          ORBITS.forEach((o, i) => {
            ctx.strokeStyle = i === EARTH ? "rgba(140,200,255,0.55)" : "rgba(200,210,255,0.22)";
            ctx.lineWidth = i === EARTH ? 2 : 1.3;
            ctx.beginPath();
            const sweep = clamp(solar * 1.3 - i * 0.05) * Math.PI * 2;
            ctx.ellipse(SUN.x, SUN.y, o.r, o.r * TILT, 0, -Math.PI / 2, -Math.PI / 2 + sweep);
            ctx.stroke();
          });
          ctx.restore();
        }
        const drawPlanets = (back: boolean) => {
          if (solar <= 0.001) return;
          ORBITS.forEach((o, i) => {
            if (i === EARTH) return;
            const p = planetPos(i, f);
            if (p.back !== back) return;
            ctx.globalAlpha = solar;
            const grad = ctx.createRadialGradient(p.x - o.s * 0.35, p.y - o.s * 0.35, 0, p.x, p.y, o.s);
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.35, o.c);
            grad.addColorStop(1, "rgba(30,30,50,1)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, o.s, 0, Math.PI * 2);
            ctx.fill();
            if (i === 5) {
              ctx.strokeStyle = "rgba(240,225,180,0.8)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.ellipse(p.x, p.y, o.s * 2, o.s * 0.6, -0.3, 0, Math.PI * 2);
              ctx.stroke();
            }
          });
          ctx.globalAlpha = 1;
        };
        drawPlanets(true);
        if (solar > 0.001) {
          const sr = 46 * solar;
          const glow = ctx.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 220 * solar + 1);
          glow.addColorStop(0, "rgba(255,240,200,0.95)");
          glow.addColorStop(0.2, "rgba(255,200,110,0.6)");
          glow.addColorStop(1, "rgba(255,150,60,0)");
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = glow;
          ctx.fillRect(SUN.x - 240, SUN.y - 240, 480, 480);
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#fff6dc";
          ctx.beginPath();
          ctx.arc(SUN.x, SUN.y, sr, 0, Math.PI * 2);
          ctx.fill();
        }

        // globe / earth
        const atm = ctx.createRadialGradient(gx, gy, gr * 0.9, gx, gy, gr * 1.25);
        atm.addColorStop(0, "rgba(90,170,255,0.35)");
        atm.addColorStop(1, "rgba(90,170,255,0)");
        ctx.fillStyle = atm;
        ctx.beginPath();
        ctx.arc(gx, gy, gr * 1.25, 0, Math.PI * 2);
        ctx.fill();
        const body = ctx.createRadialGradient(gx - gr * 0.35, gy - gr * 0.4, gr * 0.1, gx, gy, gr);
        body.addColorStop(0, "#14406e");
        body.addColorStop(1, "#04142c");
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();

        const detail = 1 - morph;
        if (detail > 0.02) {
          ctx.strokeStyle = `rgba(130,190,255,${0.22 * detail})`;
          ctx.lineWidth = 1;
          for (let lon = -180; lon < 180; lon += 15) {
            ctx.beginPath();
            let pen = false;
            for (let lat = -90; lat <= 90; lat += 5) {
              const p = project(lat, lon);
              if (p.z > 0) {
                if (pen) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
                pen = true;
              } else pen = false;
            }
            ctx.stroke();
          }
          for (let lat = -75; lat <= 75; lat += 15) {
            ctx.beginPath();
            let pen = false;
            for (let lon = -180; lon <= 180; lon += 5) {
              const p = project(lat, lon);
              if (p.z > 0) {
                if (pen) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
                pen = true;
              } else pen = false;
            }
            ctx.stroke();
          }
        }
        const ds = Math.max(0.6, (gr / GLOBE.r) * 3.2);
        for (const [lat, lon] of dots) {
          const p = project(lat, lon);
          if (p.z <= 0) continue;
          const eu = lat > 35 && lat < 72 && lon > -12 && lon < 40;
          ctx.fillStyle = eu ? `rgba(255,214,140,${0.4 + 0.6 * p.z})` : `rgba(160,215,255,${0.25 + 0.6 * p.z})`;
          ctx.fillRect(p.x - ds / 2, p.y - ds / 2, ds, ds);
        }
        if (detail > 0.02) {
          for (const r of routes) {
            const t = easeInOutCubic(progress(f, r.at, r.dur));
            const n = Math.floor(t * (r.path.length - 1));
            if (n < 1) continue;
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = detail;
            ctx.lineWidth = 3;
            ctx.shadowColor = r.color;
            ctx.shadowBlur = 12;
            ctx.setLineDash([10, 7]);
            ctx.beginPath();
            let pen = false;
            for (let i = 0; i <= n; i++) {
              const p = project(...r.path[i]);
              if (p.z > 0) {
                if (pen) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
                pen = true;
              } else pen = false;
            }
            ctx.stroke();
            ctx.setLineDash([]);
            const head = project(...r.path[n]);
            if (head.z > 0 && t < 1) {
              ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
          }
        }
        const shade = ctx.createRadialGradient(gx - gr * 0.3, gy - gr * 0.35, gr * 0.2, gx, gy, gr * 1.02);
        shade.addColorStop(0, "rgba(255,255,255,0.06)");
        shade.addColorStop(0.7, "rgba(0,0,0,0)");
        shade.addColorStop(1, "rgba(0,0,10,0.55)");
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
        drawPlanets(false);
      }} />
      <div style={{ position: "absolute", left: 0, top: 300, width: W, textAlign: "center", fontFamily: GARAMOND,
        fontStyle: "italic", fontWeight: 500, fontSize: 92, color: "#f6e6bf", letterSpacing: "0.04em",
        textShadow: "0 0 30px rgba(255,200,120,0.55)", opacity: 1 - easeOutCubic(progress(f, 222, 14)) }}>
        <Reveal text="F = G · m₁m₂ / r²" start={156} stagger={1.6} dur={16} rise={16} blur={12} />
      </div>
      <EraTitle
        date="1492 — 1522 年"
        title="大航海时代"
        en="AGE OF DISCOVERY"
        tone={{ text: "#f2f7ff", accent: "#ffd27a", sub: "rgba(160,210,255,0.9)", glow: "rgba(80,160,255,0.55)" }}
        lines={[{ text: "哥伦布 · 达·伽马 · 麦哲伦", at: 34 }]}
        exitAt={100}
        y={1160}
        titleSize={140}
      />
      <EraTitle
        date="1543 — 1687 年"
        title="科学革命"
        en="SCIENTIFIC REVOLUTION"
        start={128}
        tone={{ text: "#fff8ea", accent: "#ffd27a", sub: "rgba(255,226,170,0.9)", glow: "rgba(255,180,90,0.5)" }}
        lines={[
          { text: "哥白尼 · 伽利略 · 牛顿", at: 150, until: 196 },
          { text: "1687 ·《自然哲学的数学原理》", at: 200, size: 40 },
        ]}
        exitAt={226}
        y={1160}
      />
    </Stage>
  );
};
