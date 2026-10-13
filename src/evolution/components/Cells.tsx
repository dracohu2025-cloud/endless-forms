import React from "react";
import { useCurrentFrame } from "remotion";
import { FrameCanvas } from "../../components/Canvas";
import { BIRTH, cells } from "../engine/embryo";
import { pulse } from "../lib/audio";
import { clamp, envelope } from "../lib/math";
import { H, W } from "../timeline";

const S = 3;
const w = W / S;
const h = H / S;
const fieldBuf = new Float32Array(w * h);
const hueBuf = new Float32Array(w * h);
const depthBuf = new Float32Array(w * h);
let img: ImageData | null = null;

const hsl2rgb = (hh: number, s: number, l: number): [number, number, number] => {
  const k = (n: number) => (n + hh / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const fn = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [fn(0) * 255, fn(8) * 255, fn(4) * 255];
};

/** Metaball membranes for the dividing cells (compact-support Wyvill kernel). */
export const Cells: React.FC = () => {
  const f = useCurrentFrame();
  const vis = envelope(f, BIRTH - 24, 26, 712, 14);
  if (vis <= 0) return null;
  return (
    <FrameCanvas
      deps={[f]}
      width={w}
      height={h}
      style={{ opacity: vis, filter: "blur(1.2px)" }}
      draw={(ctx) => {
        const cs = cells(f);
        fieldBuf.fill(0);
        hueBuf.fill(0);
        depthBuf.fill(0);
        for (const c of cs) {
          const R = (c.r * 2.1) / S;
          const cx = c.x / S;
          const cy = c.y / S;
          const x0 = Math.max(0, Math.floor(cx - R));
          const x1 = Math.min(w - 1, Math.ceil(cx + R));
          const y0 = Math.max(0, Math.floor(cy - R));
          const y1 = Math.min(h - 1, Math.ceil(cy + R));
          const R2 = R * R;
          for (let y = y0; y <= y1; y++) {
            const dy = y - cy;
            for (let x = x0; x <= x1; x++) {
              const dx = x - cx;
              const d2 = (dx * dx + dy * dy) / R2;
              if (d2 >= 1) continue;
              const q = 1 - d2;
              const v = q * q * q;
              const idx = y * w + x;
              fieldBuf[idx] += v;
              hueBuf[idx] += c.hue * v;
              depthBuf[idx] += c.z * v;
            }
          }
        }
        if (!img) img = ctx.createImageData(w, h);
        const d = img.data;
        const T = 0.5;
        const beat = pulse(f, "div", 8);
        for (let i = 0; i < w * h; i++) {
          const F = fieldBuf[i];
          if (F < 0.05) {
            d[i * 4 + 3] = 0;
            continue;
          }
          const hue = hueBuf[i] / F;
          const z = depthBuf[i] / F;
          const rim = Math.exp(-Math.pow((F - T) / 0.07, 2));
          const inside = clamp((F - T) / 0.9);
          const halo = clamp(F / T) ** 3 * (F < T ? 1 : 0);
          const light = (1 - 0.45 * clamp(z * 0.5 + 0.5)) * (1 + 0.6 * beat);
          const [r, g, b] = hsl2rgb(hue, 0.85, 0.62);
          const k = (rim * 1.0 + inside * 0.16 + halo * 0.12) * light;
          d[i * 4] = Math.min(255, r * k + 40 * rim * light);
          d[i * 4 + 1] = Math.min(255, g * k + 40 * rim * light);
          d[i * 4 + 2] = Math.min(255, b * k + 40 * rim * light);
          d[i * 4 + 3] = Math.min(255, 255 * Math.min(1, k * 1.4));
        }
        ctx.putImageData(img, 0, 0);
      }}
    />
  );
};
