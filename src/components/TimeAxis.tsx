import React from "react";
import { useCurrentFrame } from "remotion";
import { SERIF_SC } from "../fonts";
import { easeInOutCubic, envelope, formatYear, lerp, progress } from "../lib/util";
import { BAR, ERAS, SCENES, W } from "../timeline";

const X0 = 120;
const X1 = W - 120;

/** Persistent timeline at the top: era stops, a travelling spark and the rolling year. */
export const TimeAxis: React.FC = () => {
  const frame = useCurrentFrame();
  const vis = envelope(frame, SCENES.greece[0] * BAR - 10, 30, SCENES.finale[1] * BAR - 20, 20);
  if (vis <= 0.001) return null;

  const seg = (X1 - X0) / ERAS.length;
  let idx = 0;
  ERAS.forEach((e, i) => {
    if (frame >= SCENES[e.id][0] * BAR) idx = i;
  });
  const era = ERAS[idx];
  const [s0, s1] = SCENES[era.id];
  const p = easeInOutCubic(progress(frame, s0 * BAR, (s1 - s0) * BAR));
  const year = lerp(era.years[0], era.years[1], p);
  const x = X0 + seg * idx + seg * p;

  const light = frame >= SCENES.renaissance[0] * BAR && frame < SCENES.renaissance[1] * BAR;
  const ink = light ? "rgba(60,36,18," : "rgba(255,240,215,";

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 260, opacity: vis }}>
      <div
        style={{
          position: "absolute",
          top: 118,
          width: W,
          textAlign: "center",
          fontFamily: SERIF_SC,
          fontWeight: 600,
          fontSize: 36,
          letterSpacing: "0.16em",
          color: `${ink}0.95)`,
          fontVariantNumeric: "tabular-nums",
          textShadow: light ? "none" : "0 0 18px rgba(255,200,120,0.5)",
        }}
      >
        {formatYear(year)}
      </div>
      <div
        style={{ position: "absolute", left: X0, top: 196, width: X1 - X0, height: 2, background: `${ink}0.25)` }}
      />
      <div
        style={{
          position: "absolute",
          left: X0,
          top: 195,
          width: x - X0,
          height: 4,
          background: light
            ? "linear-gradient(90deg, rgba(120,60,20,0), rgba(140,60,25,0.9))"
            : "linear-gradient(90deg, rgba(255,200,120,0), rgba(255,215,150,0.95))",
        }}
      />
      {ERAS.map((e, i) => {
        const cx = X0 + seg * i + seg / 2;
        const active = i === idx;
        return (
          <React.Fragment key={e.id}>
            <div
              style={{
                position: "absolute",
                left: X0 + seg * i - 1,
                top: 189,
                width: 2,
                height: 16,
                background: `${ink}${i <= idx ? 0.8 : 0.3})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: cx - 60,
                width: 120,
                top: 214,
                textAlign: "center",
                fontFamily: SERIF_SC,
                fontSize: 20,
                fontWeight: active ? 700 : 400,
                letterSpacing: "0.05em",
                color: `${ink}${active ? 1 : i < idx ? 0.55 : 0.3})`,
              }}
            >
              {e.label}
            </div>
          </React.Fragment>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: x - 9,
          top: 188,
          width: 18,
          height: 18,
          borderRadius: 9,
          background: light ? "#8a3a1a" : "#fff3d6",
          boxShadow: light ? "0 0 12px rgba(140,60,25,0.6)" : "0 0 14px 4px rgba(255,200,120,0.9), 0 0 40px 10px rgba(255,170,80,0.45)",
        }}
      />
    </div>
  );
};
