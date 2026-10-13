import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { H, W } from "../timeline";
import { mulberry32 } from "../lib/util";
import { FrameCanvas, glowSprite } from "./Canvas";

export type ParticleConfig = {
  count: number;
  seed: number;
  colors: string[];
  size: [number, number];
  /** px per frame */
  vx: [number, number];
  vy: [number, number];
  sway?: number;
  twinkle?: number;
  opacity?: number;
  area?: { x: number; y: number; w: number; h: number };
  hardness?: number;
  /** multiplies size & alpha each frame (audio reactivity etc.) */
  boost?: number;
  /** optional depth: larger particles move faster (parallax) */
  parallax?: boolean;
};

export const Particles: React.FC<ParticleConfig & { style?: React.CSSProperties; frameOffset?: number }> = (props) => {
  const frame = useCurrentFrame() + (props.frameOffset ?? 0);
  const { count, seed, colors, size, vx, vy, sway = 0, twinkle = 0, opacity = 1, hardness = 0.2 } = props;
  const area = props.area ?? { x: -40, y: -40, w: W + 80, h: H + 80 };
  const boost = props.boost ?? 1;

  const parts = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const depth = r();
      return {
        x: r() * area.w,
        y: r() * area.h,
        s: size[0] + (size[1] - size[0]) * Math.pow(r(), 2.2),
        vx: vx[0] + (vx[1] - vx[0]) * r(),
        vy: vy[0] + (vy[1] - vy[0]) * r(),
        ph: r() * Math.PI * 2,
        w: 0.02 + r() * 0.05,
        c: colors[Math.floor(r() * colors.length)],
        a: 0.35 + 0.65 * r(),
        depth,
      };
    });
  }, [seed, count, area.w, area.h, size[0], size[1], vx[0], vx[1], vy[0], vy[1], colors.join()]);

  return (
    <FrameCanvas
      style={props.style}
      deps={[frame, boost, opacity]}
      draw={(ctx) => {
        ctx.globalCompositeOperation = "lighter";
        for (const p of parts) {
          const k = props.parallax ? 0.4 + p.depth * 1.2 : 1;
          let x = p.x + p.vx * frame * k + Math.sin(frame * p.w + p.ph) * sway;
          let y = p.y + p.vy * frame * k + Math.cos(frame * p.w * 0.7 + p.ph) * sway * 0.5;
          x = ((x % area.w) + area.w) % area.w + area.x;
          y = ((y % area.h) + area.h) % area.h + area.y;
          const tw = twinkle ? 1 - twinkle + twinkle * (0.5 + 0.5 * Math.sin(frame * p.w * 3 + p.ph * 3)) : 1;
          const a = Math.min(1, p.a * tw * opacity * boost);
          if (a < 0.01) continue;
          const s = p.s * (props.parallax ? 0.6 + p.depth : 1) * (0.85 + 0.15 * boost);
          ctx.globalAlpha = a;
          ctx.drawImage(glowSprite(p.c, hardness), x - s * 2, y - s * 2, s * 4, s * 4);
        }
      }}
    />
  );
};
