import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FrameCanvas } from "../../components/Canvas";
import { DOMAINS, HUMAN_LEAF, polar, TREE, TREE_CX, TREE_CY, TREE_R, treeRotation } from "../engine/tree";
import { pulse } from "../lib/audio";
import { easeOut, envelope, progress } from "../lib/math";
import { MONO, SANS } from "../fonts";
import { W } from "../timeline";

const START = 2250;

export const TreeOfLife: React.FC<{ bare?: boolean }> = ({ bare = false }) => {
  const f = useCurrentFrame();
  const vis = envelope(f, START, 20, 2600, 50);
  if (vis <= 0) return null;
  const grow = easeOut(progress(f, START, 190));
  const visR = TREE_R * grow;
  const rot = treeRotation(f);
  const leaf = TREE.leaves[HUMAN_LEAF];
  const [hx, hy] = polar(leaf.a, TREE_R + 10, rot);
  const tag = easeOut(progress(f, 2390, 30));
  const [ox, oy] = polar(leaf.a, TREE_R + 26, rot);
  const [lx, ly] = polar(leaf.a, TREE_R + 26 + 60 * tag, rot);
  const kick = pulse(f, "kick", 6);
  return (
    <AbsoluteFill style={{ opacity: vis }}>
      <FrameCanvas
        deps={[f]}
        style={{ mixBlendMode: "screen" }}
        draw={(ctx) => {
          ctx.globalCompositeOperation = "lighter";
          ctx.lineCap = "round";
          for (const pass of [0, 1]) {
            for (const b of TREE.branches) {
              if (b.r0 > visR) continue;
              const hue = DOMAINS[b.domain].hue;
              const depthA = Math.max(0.25, 1 - b.depth / 11);
              ctx.strokeStyle = `hsla(${hue},95%,${pass ? 70 : 60}%,${pass ? 0.75 * depthA : 0.16 * depthA * (1 + kick)})`;
              ctx.lineWidth = pass ? Math.max(0.8, 2.6 - b.depth * 0.22) : 7 - b.depth * 0.4;
              ctx.beginPath();
              if (b.a0 === b.a1) {
                const [x0, y0] = polar(b.a0, b.r0, rot);
                const [x1, y1] = polar(b.a0, Math.min(b.r1, visR), rot);
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
              } else {
                ctx.arc(TREE_CX, TREE_CY, b.r0, Math.min(b.a0, b.a1) + rot, Math.max(b.a0, b.a1) + rot);
              }
              ctx.stroke();
            }
          }
          const g = ctx.createRadialGradient(TREE_CX, TREE_CY, 0, TREE_CX, TREE_CY, 60);
          g.addColorStop(0, "rgba(255,255,255,0.95)");
          g.addColorStop(1, "rgba(160,240,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(TREE_CX, TREE_CY, 60, 0, Math.PI * 2);
          ctx.fill();
          if (tag > 0 && !bare) {
            ctx.strokeStyle = `rgba(255,236,170,${0.9 * tag})`;
            ctx.lineWidth = 2;
            const pr = 14 + 10 * Math.sin(f * 0.15);
            ctx.beginPath();
            ctx.arc(hx, hy, pr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(lx, ly);
            ctx.stroke();
          }
        }}
      />
      {!bare && DOMAINS.map((d, i) => {
        const span = TREE.leaves.filter((l) => l.domain === i);
        const a = span.reduce((s, l) => s + l.a, 0) / span.length;
        const [x, y] = polar(a, TREE_R + 80, rot);
        return (
          <div key={i} style={{ position: "absolute", left: Math.min(W - 300, Math.max(10, x - 140)), top: y - 30, width: 280, textAlign: "center",
            opacity: easeOut(progress(f, 2330 + i * 10, 30)), color: `hsl(${d.hue},95%,72%)`, textShadow: "0 0 8px #000, 0 0 18px #000, 0 0 30px #000" }}>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 32, letterSpacing: "0.15em" }}>{d.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.3em", opacity: 0.75 }}>{d.en}</div>
          </div>
        );
      })}
      {!bare && <div style={{ position: "absolute", left: Math.max(20, Math.min(W - 280, lx - 130)), top: ly + 8, width: 260, textAlign: "center", opacity: tag, transform: `translateY(${(1 - tag) * 10}px)` }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: "#fff1c0", letterSpacing: "0.12em", textShadow: "0 0 18px rgba(255,220,140,0.8)" }}>你在这里</div>
        <div style={{ fontFamily: MONO, fontSize: 18, color: "rgba(255,236,190,0.85)", letterSpacing: "0.25em" }}>YOU ARE HERE</div>
      </div>}
      {!bare && <div style={{ position: "absolute", left: 0, width: W, top: TREE_CY + 70, textAlign: "center", opacity: easeOut(progress(f, 2290, 30)) }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.3em", color: "rgba(220,250,255,0.85)" }}>LUCA</div>
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 300, letterSpacing: "0.2em", color: "rgba(220,250,255,0.7)" }}>最后的共同祖先</div>
      </div>}
    </AbsoluteFill>
  );
};
