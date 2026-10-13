import React from "react";
import { useCurrentFrame } from "remotion";
import { GA, SCALE } from "../lib/audio";
import { easeOut, envelope, progress, table } from "../lib/math";
import { MONO, SANS } from "../fonts";
import { BAR, DEEP_TIME, W } from "../timeline";

const fmtYears = (v: number) => {
  if (v >= 1e8) {
    const y = v / 1e8;
    return { num: y >= 10 ? y.toFixed(0) : y.toFixed(1), unit: "亿年前" };
  }
  if (v >= 1e4) return { num: Math.round(v / 1e4).toLocaleString("en-US"), unit: "万年前" };
  return { num: "今天", unit: "" };
};

const EONS = [
  { name: "太古宙", from: 4.0e9, to: 2.5e9, color: "#F0047F" },
  { name: "元古宙", from: 2.5e9, to: 5.39e8, color: "#F73563" },
  { name: "显生宙", from: 5.39e8, to: 0, color: "#9AD9DD" },
];

const BAR_TOP = 520;
const BAR_H = 900;
const yOf = (years: number) => BAR_TOP + (1 - years / 4.0e9) * BAR_H;

export const HUD: React.FC = () => {
  const f = useCurrentFrame();
  const vis = envelope(f, 30, 30, 2040, 30);
  const years = table(f, DEEP_TIME, true);
  const { num, unit } = fmtYears(years);
  const bar = Math.floor(f / BAR);
  const phrase = [...GA].reverse().find((p) => p.bar <= bar);
  const gaVis = envelope(f, 2 * BAR - 10, 20, 2040, 30);
  const target = GA[GA.length - 1].genome;
  const timeVis = envelope(f, 240, 40, 2040, 30);

  return (
    <>
      <div style={{ position: "absolute", left: 64, top: 96, opacity: vis, color: "#e8fbff" }}>
        <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 24, letterSpacing: "0.4em", opacity: 0.7 }}>距今</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
          <span style={{ fontFamily: MONO, fontWeight: 300, fontSize: 76, letterSpacing: "-0.02em", lineHeight: 1,
            textShadow: "0 0 24px rgba(120,240,255,0.5)", fontVariantNumeric: "tabular-nums" }}>{num}</span>
          <span style={{ fontFamily: SANS, fontWeight: 400, fontSize: 28, opacity: 0.85 }}>{unit}</span>
        </div>
      </div>

      {phrase && (
        <div style={{ position: "absolute", right: 64, top: 100, width: 330, opacity: gaVis, fontFamily: MONO, color: "#dffaff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, letterSpacing: "0.12em", opacity: 0.7 }}>
            <span>BGM 旋律进化</span>
            <span>GEN {String(phrase.gen).padStart(3, "0")}</span>
          </div>
          <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
            {phrase.genome.map((g, i) => {
              const ok = g === target[i];
              const hue = g < 0 ? 0 : 160 + ((SCALE[g] - SCALE[0]) / 24) * 160;
              return (
                <div key={i} style={{ flex: 1, height: g < 0 ? 8 : 24, marginTop: g < 0 ? 8 : 0, borderRadius: 2,
                  background: g < 0 ? "rgba(220,250,255,0.25)" : `hsla(${hue},95%,${ok ? 62 : 40}%,${ok ? 1 : 0.45})`,
                  boxShadow: ok && g >= 0 ? `0 0 10px hsla(${hue},95%,60%,0.8)` : "none" }} />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 17, letterSpacing: "0.12em" }}>
            <span style={{ opacity: 0.7 }}>适应度</span>
            <span style={{ color: phrase.fit >= 1 ? "#b8ff7a" : "#dffaff" }}>
              {phrase.fit >= 1 ? "已收敛 100%" : `${Math.round(phrase.fit * 100)}%`}
            </span>
          </div>
        </div>
      )}

      <div style={{ position: "absolute", left: W - 58, top: BAR_TOP, height: BAR_H, width: 6, opacity: timeVis * 0.9 }}>
        {EONS.map((e) => (
          <div key={e.name} style={{ position: "absolute", left: 0, width: 4, top: yOf(e.from) - BAR_TOP, height: yOf(e.to) - yOf(e.from),
            background: e.color, opacity: 0.75 }}>
            <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontFamily: SANS, fontSize: 18,
              color: e.color, writingMode: "vertical-rl", letterSpacing: "0.3em", whiteSpace: "nowrap", opacity: 0.9 }}>{e.name}</div>
          </div>
        ))}
        <div style={{ position: "absolute", left: -18, top: yOf(years) - BAR_TOP - 1, width: 40, height: 2, background: "#fff",
          boxShadow: "0 0 12px #fff" }} />
        <div style={{ position: "absolute", left: -6, top: yOf(years) - BAR_TOP - 8, width: 16, height: 16, borderRadius: "50%",
          border: "2px solid #fff", boxShadow: "0 0 14px rgba(255,255,255,0.9)", transform: `scale(${1 + 0.1 * Math.sin(f * 0.2)})` }} />
        <div style={{ position: "absolute", left: -34, top: -40, fontFamily: MONO, fontSize: 14, color: "rgba(230,250,255,0.6)", letterSpacing: "0.1em" }}>40亿年</div>
        <div style={{ position: "absolute", left: -12, top: BAR_H + 16, fontFamily: MONO, fontSize: 14, color: "rgba(230,250,255,0.6)" }}>今</div>
      </div>
      <div style={{ position: "absolute", left: 64, top: 268, opacity: vis * easeOut(progress(f, 60, 30)) * 0.55, fontFamily: MONO,
        fontSize: 15, letterSpacing: "0.35em", color: "#bdf6ff" }}>
        ENDLESS FORMS · {String(Math.floor(f / 30 / 60)).padStart(2, "0")}:{String(Math.floor(f / 30) % 60).padStart(2, "0")}
      </div>
    </>
  );
};
