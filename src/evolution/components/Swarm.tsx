import React from "react";
import { useCurrentFrame } from "remotion";
import { FrameCanvas } from "../../components/Canvas";
import { N, swarm } from "../engine/forms";
import { LOOK_STRIDE } from "../engine/rig";
import { loudness, pulse } from "../lib/audio";
import { mulberry32, noise2 } from "../lib/math";
import { H, W } from "../timeline";

const sprites = new Map<number, HTMLCanvasElement>();
const SPR = 48;

export const sprite = (hue: number, sat: number) => {
  const hq = ((Math.round(hue / 6) * 6) % 360 + 360) % 360;
  const sq = sat < 0.3 ? 0 : sat < 0.75 ? 1 : 2;
  const key = hq * 3 + sq;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = SPR;
  c.height = SPR;
  const g = c.getContext("2d")!;
  const s = [12, 55, 100][sq];
  const grad = g.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
  grad.addColorStop(0, `hsla(${hq},${s}%,94%,1)`);
  grad.addColorStop(0.1, `hsla(${hq},${s}%,74%,0.95)`);
  grad.addColorStop(0.3, `hsla(${hq},${s}%,58%,0.28)`);
  grad.addColorStop(0.6, `hsla(${hq},${s}%,50%,0.06)`);
  grad.addColorStop(1, `hsla(${hq},${s}%,50%,0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, SPR, SPR);
  sprites.set(key, c);
  return c;
};

const PHASE = (() => {
  const r = mulberry32(3);
  return Float32Array.from({ length: N }, () => r() * Math.PI * 2);
})();

let bloomCanvas: HTMLCanvasElement | null = null;

export const shake = (f: number) => {
  const a = 9 * pulse(f, "step", 5) + 26 * pulse(f, "impact", 14) + 5 * pulse(f, "drop", 8);
  return [a * noise2(f * 0.9, 1), a * noise2(f * 0.9, 2)];
};

export const Swarm: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <FrameCanvas
      deps={[f]}
      style={{ mixBlendMode: "screen" }}
      draw={(ctx) => {
        const { xy, look } = swarm(f);
        const kick = pulse(f, "kick", 4);
        const lv = loudness(f);
        const [sx, sy] = shake(f);
        ctx.translate(sx, sy);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < N; i++) {
          const x = xy[i * 2];
          const y = xy[i * 2 + 1];
          if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
          const k = i * LOOK_STRIDE;
          const tw = 0.78 + 0.22 * Math.sin(f * 0.17 + PHASE[i]);
          const a = Math.min(1, look[k + 2] * look[k + 4] * tw * (0.9 + 0.25 * lv));
          if (a < 0.02) continue;
          const r = look[k + 3] * (1 + 0.22 * kick) * 7;
          ctx.globalAlpha = a;
          ctx.drawImage(sprite(look[k], look[k + 1]), x - r, y - r, r * 2, r * 2);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (!bloomCanvas) {
          bloomCanvas = document.createElement("canvas");
          bloomCanvas.width = W / 4;
          bloomCanvas.height = H / 4;
        }
        const b = bloomCanvas.getContext("2d")!;
        b.globalCompositeOperation = "source-over";
        b.clearRect(0, 0, W / 4, H / 4);
        b.filter = "blur(5px)";
        b.drawImage(ctx.canvas, 0, 0, W / 4, H / 4);
        b.filter = "none";
        ctx.globalAlpha = 0.85 + 0.3 * kick;
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(bloomCanvas, 0, 0, W, H);
      }}
    />
  );
};
