import React from "react";
import { useCurrentFrame } from "remotion";
import { CINZEL, SERIF_SC } from "../fonts";
import { clamp, easeInCubic, easeOutCubic, easeOutExpo, progress } from "../lib/util";
import { W } from "../timeline";

/** Per-character cinematic reveal: blur → sharp, rise, slight overshoot in tracking. */
export const Reveal: React.FC<{
  text: string;
  start: number;
  stagger?: number;
  dur?: number;
  style?: React.CSSProperties;
  rise?: number;
  blur?: number;
  scaleFrom?: number;
  charStyle?: React.CSSProperties;
}> = ({ text, start, stagger = 2.5, dur = 18, style, rise = 34, blur = 18, scaleFrom = 1, charStyle }) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  return (
    <span style={{ display: "inline-block", whiteSpace: "pre", ...style }}>
      {chars.map((ch, i) => {
        const t = clamp((frame - start - i * stagger) / dur);
        const e = easeOutCubic(t);
        const ex = easeOutExpo(t);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: e,
              filter: e < 0.999 ? `blur(${(1 - e) * blur}px)` : undefined,
              transform: `translateY(${(1 - ex) * rise}px) scale(${scaleFrom + (1 - scaleFrom) * ex})`,
              ...charStyle,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

export type Tone = { text: string; accent: string; sub: string; glow: string; shadow?: string };

export type TitleLine = { text: string; at: number; until?: number; size?: number };

export const EraTitle: React.FC<{
  date: string;
  title: string;
  en: string;
  lines?: TitleLine[];
  tone: Tone;
  start?: number;
  exitAt: number;
  y?: number;
  titleSize?: number;
}> = ({ date, title, en, lines = [], tone, start = 6, exitAt, y = 1150, titleSize = 150 }) => {
  const frame = useCurrentFrame();
  const out = easeInCubic(progress(frame, exitAt, 14));
  const lineFade = (l: TitleLine) => {
    const a = easeOutCubic(progress(frame, l.at, 14));
    const b = l.until !== undefined ? easeInCubic(progress(frame, l.until, 10)) : 0;
    return a * (1 - b);
  };
  const ruleW = 90 * easeOutExpo(progress(frame, start, 30));

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: W,
        top: y,
        textAlign: "center",
        opacity: 1 - out,
        filter: out > 0.001 ? `blur(${out * 14}px)` : undefined,
        transform: `translateY(${-out * 30}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          color: tone.accent,
          fontFamily: SERIF_SC,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: "0.18em",
          height: 56,
        }}
      >
        <span style={{ width: ruleW, height: 2, background: tone.accent, opacity: 0.8 }} />
        <Reveal text={date} start={start} stagger={1.2} dur={16} rise={12} blur={8} />
        <span style={{ width: ruleW, height: 2, background: tone.accent, opacity: 0.8 }} />
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: SERIF_SC,
          fontWeight: 900,
          fontSize: titleSize,
          lineHeight: 1.08,
          letterSpacing: "0.1em",
          paddingLeft: "0.1em",
          color: tone.text,
          textShadow: tone.shadow ?? `0 0 40px ${tone.glow}, 0 0 90px ${tone.glow}, 0 6px 24px rgba(0,0,0,0.55)`,
        }}
      >
        <Reveal text={title} start={start + 6} stagger={4} dur={22} rise={50} blur={26} scaleFrom={1.25} />
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: CINZEL,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: "0.42em",
          paddingLeft: "0.42em",
          color: tone.sub,
        }}
      >
        <Reveal text={en} start={start + 16} stagger={0.8} dur={14} rise={10} blur={6} />
      </div>
      <div style={{ position: "relative", height: 90, marginTop: 34 }}>
        {lines.map((l, i) => {
          const a = lineFade(l);
          if (a <= 0.001) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 60,
                right: 60,
                top: 0,
                fontFamily: SERIF_SC,
                fontWeight: 500,
                fontSize: l.size ?? 44,
                letterSpacing: "0.14em",
                color: tone.text,
                opacity: a * 0.95,
                transform: `translateY(${(1 - a) * 14}px)`,
                filter: a < 0.999 ? `blur(${(1 - a) * 6}px)` : undefined,
                textShadow: tone.shadow ?? "0 2px 18px rgba(0,0,0,0.6)",
              }}
            >
              {l.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Huge faint year numerals drifting behind a scene. */
export const GhostYear: React.FC<{ text: string; color: string; y?: number; opacity?: number; size?: number }> = ({
  text,
  color,
  y = 1010,
  opacity = 0.09,
  size = 300,
}) => {
  const frame = useCurrentFrame();
  const a = easeOutCubic(progress(frame, 0, 40)) * (1 - easeInCubic(progress(frame, 200, 40)));
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: W,
        top: y,
        textAlign: "center",
        fontFamily: CINZEL,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "0.06em",
        color: "transparent",
        WebkitTextStroke: `2px ${color}`,
        opacity: opacity * a,
        transform: `translateX(${(frame - 120) * -0.6}px)`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
