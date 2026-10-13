import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { pulse } from "../lib/audio";
import { envelope, lerp, noise1 } from "../lib/util";

/**
 * Scene container: fades in/out, slow push-in, and a camera shake driven by
 * the drum hits of the soundtrack. `from` is the scene's global start frame.
 */
export const Stage: React.FC<{
  from: number;
  dur: number;
  background?: string;
  zoom?: [number, number];
  shake?: number;
  fadeIn?: number;
  fadeOut?: number;
  children: React.ReactNode;
}> = ({ from, dur, background = "#000", zoom = [1, 1.05], shake = 0, fadeIn = 8, fadeOut = 8, children }) => {
  const f = useCurrentFrame();
  const g = from + f;
  const a = envelope(f, 0, fadeIn, dur - fadeOut, fadeOut);
  const s = lerp(zoom[0], zoom[1], f / dur);
  const amp = shake * Math.min(2, pulse(g, 0.3, 4));
  const dx = (noise1(g * 0.9, 1) - 0.5) * 2 * amp * 14;
  const dy = (noise1(g * 0.9, 2) - 0.5) * 2 * amp * 14;
  return (
    <AbsoluteFill style={{ background: "#000", opacity: a }}>
      <AbsoluteFill style={{ background, transform: `translate(${dx}px, ${dy}px) scale(${s})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
