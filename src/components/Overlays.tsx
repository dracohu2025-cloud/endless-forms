import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { pulse } from "../lib/audio";
import { mulberry32 } from "../lib/util";
import { H, W } from "../timeline";

const tiles: string[] = [];
const grainTile = (i: number) => {
  if (tiles[i]) return tiles[i];
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const img = g.createImageData(s, s);
  const r = mulberry32(991 + i * 17);
  for (let p = 0; p < s * s; p++) {
    const v = Math.floor(r() * 255);
    img.data[p * 4] = v;
    img.data[p * 4 + 1] = v;
    img.data[p * 4 + 2] = v;
    img.data[p * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  tiles[i] = c.toDataURL();
  return tiles[i];
};

/** Animated film grain. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const r = mulberry32(frame * 13 + 7);
  const tile = useMemo(() => grainTile(frame % 4), [frame % 4]);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${tile})`,
        backgroundSize: "256px 256px",
        backgroundPosition: `${Math.floor(r() * 256)}px ${Math.floor(r() * 256)}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.75 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 60% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Bloom flash on the big downbeats (section changes, stabs). */
export const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const p = Math.min(1, pulse(frame, 0.95, 3.2) * 0.55);
  if (p < 0.01) return null;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 42%, rgba(255,246,225,${p}) 0%, rgba(255,214,150,${p * 0.6}) 40%, rgba(255,190,120,${p * 0.15}) 100%)`,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};

/** Anamorphic light streak across the frame. */
export const LensStreak: React.FC<{ y: number; intensity: number; color?: string; width?: number }> = ({
  y,
  intensity,
  color = "255,220,160",
  width = W * 1.4,
}) => {
  if (intensity <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: W / 2 - width / 2,
        top: y - 60,
        width,
        height: 120,
        background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(${color},${0.9 * intensity}) 0%, rgba(${color},${0.25 * intensity}) 30%, rgba(${color},0) 70%)`,
        mixBlendMode: "screen",
        filter: "blur(2px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 58,
          height: 4,
          background: `linear-gradient(90deg, rgba(${color},0), rgba(255,255,255,${intensity}) 50%, rgba(${color},0))`,
        }}
      />
    </div>
  );
};

export const FullBleed: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...style }}>{children}</div>;
