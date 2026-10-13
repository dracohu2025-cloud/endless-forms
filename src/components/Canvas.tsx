import React, { useLayoutEffect, useRef } from "react";
import { H, W } from "../timeline";

/** A full-frame 2D canvas that is redrawn synchronously for every rendered frame. */
export const FrameCanvas: React.FC<{
  draw: (ctx: CanvasRenderingContext2D) => void;
  deps: unknown[];
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ draw, deps, width = W, height = H, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, c.width, c.height);
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...style }}
    />
  );
};

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Soft glowing dot sprite, cached per colour. */
export const glowSprite = (color: string, hardness = 0.25) => {
  const key = `${color}|${hardness}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(hardness, color);
  grad.addColorStop(Math.min(0.99, hardness + 0.25), withAlpha(color, 0.25));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  spriteCache.set(key, c);
  return c;
};

export const withAlpha = (hex: string, a: number) => {
  if (!hex.startsWith("#")) return hex;
  const v = hex.length === 4 ? hex.slice(1).split("").map((x) => x + x).join("") : hex.slice(1);
  const r = parseInt(v.slice(0, 2), 16);
  const gg = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${gg},${b},${a})`;
};
