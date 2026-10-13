import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DNA_SEQ, helixAt } from "../engine/forms";
import { GA, pulse } from "../lib/audio";
import { clamp, easeOut, envelope, mulberry32, progress } from "../lib/math";
import { DISPLAY, MONO, SANS } from "../fonts";
import { W } from "../timeline";

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const HAN = "生命细胞基因物种演变突选择遗传适应自然祖先灭绝海洋陆地鳍翼骨血光尘原核酸蛋白复制分裂繁衍";

/** Cumulative selection on text: each character locks in at its own generation. */
const Weasel: React.FC<{ text: string; pool: string; start: number; dur: number; seed: number; style: React.CSSProperties }> = ({ text, pool, start, dur, seed, style }) => {
  const f = useCurrentFrame();
  const r = mulberry32(seed);
  const locks = [...text].map(() => start + dur * (0.15 + 0.85 * Math.pow(r(), 0.8)));
  const tick = Math.floor(f / 2);
  return (
    <div style={style}>
      {[...text].map((ch, i) => {
        if (ch === " ") return <span key={i}>&nbsp;</span>;
        const locked = f >= locks[i];
        const flash = locked ? Math.exp(-(f - locks[i]) / 6) : 0;
        const c = locked ? ch : pool[Math.floor(hash(i + seed, tick) * pool.length)];
        return (
          <span key={i} style={{ display: "inline-block", minWidth: "0.5em", textAlign: "center",
            opacity: f < start ? 0 : locked ? 1 : 0.38, color: locked ? undefined : "#4fd7e8",
            textShadow: locked ? `0 0 ${20 + 40 * flash}px rgba(140,240,255,${0.5 + 0.5 * flash})` : "none" }}>{c}</span>
        );
      })}
    </div>
  );
};

export const Title: React.FC = () => {
  const f = useCurrentFrame();
  const vis = envelope(f, 30, 20, 200, 36);
  if (vis <= 0) return null;
  const gen = Math.min(GA.length ? 41 : 41, Math.floor(clamp((f - 40) / 130) * 41));
  return (
    <AbsoluteFill style={{ opacity: vis, filter: `blur(${(1 - vis) * 10}px)` }}>
      <div style={{ position: "absolute", left: 0, width: W, top: 700, textAlign: "center", color: "#effdff" }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.5em", paddingLeft: "0.5em", opacity: 0.6 }}>
          GENERATION {String(gen).padStart(3, "0")} · 累积选择
        </div>
        <Weasel text="ENDLESS FORMS" pool={LATIN} start={40} dur={120} seed={3}
          style={{ marginTop: 30, fontFamily: DISPLAY, fontWeight: 300, fontSize: 70, letterSpacing: "0.04em", lineHeight: 1.15 }} />
        <Weasel text="进化论" pool={HAN} start={56} dur={120} seed={9}
          style={{ marginTop: 34, fontFamily: SANS, fontWeight: 200, fontSize: 120, letterSpacing: "0.5em", paddingLeft: "0.5em" }} />
        <div style={{ marginTop: 40, fontFamily: SANS, fontWeight: 300, fontSize: 32, letterSpacing: "0.5em", paddingLeft: "0.5em",
          opacity: easeOut(progress(f, 150, 24)) }}>
          40 亿年 · 90 秒
        </div>
      </div>
    </AbsoluteFill>
  );
};

type Cap = { from: number; to: number; tag: string; title: string; sub: string; y?: number; size?: number };

const CAPS: Cap[] = [
  { from: 262, to: 470, tag: "01 / ORIGIN", title: "第一个细胞", sub: "一个分子学会了复制自己" },
  { from: 498, to: 700, tag: "02 / MULTICELLULARITY", title: "细胞开始合作", sub: "一个变成两个，两个变成一群" },
  { from: 742, to: 925, tag: "03 / CAMBRIAN EXPLOSION", title: "寒武纪大爆发", sub: "短短两千万年，动物的主要门类几乎全部登场" },
  { from: 975, to: 1060, tag: "04 / VERTEBRATES", title: "鱼", sub: "一根脊椎，开启了一条新的道路" },
  { from: 1100, to: 1180, tag: "05 / ONTO LAND", title: "登陆", sub: "鳍，慢慢变成了腿" },
  { from: 1215, to: 1410, tag: "06 / MESOZOIC", title: "恐龙时代", sub: "统治地球超过 1.6 亿年" },
  { from: 1448, to: 1530, tag: "07 / EXTINCTION", title: "一颗小行星", sub: "直径约 10 公里，75% 的物种消失", y: 820, size: 96 },
  { from: 1572, to: 1675, tag: "08 / SURVIVORS", title: "幸存者", sub: "一只夜行的小型哺乳动物" },
  { from: 1692, to: 1765, tag: "09 / FEATHERS", title: "恐龙并未完全消失", sub: "它们的后代，就是今天的鸟" },
  { from: 1798, to: 1880, tag: "10 / HOMININS", title: "不是阶梯，是分叉", sub: "700 万年前，我们与黑猩猩分道扬镳" },
  { from: 1915, to: 2000, tag: "11 / HOMO SAPIENS", title: "智人", sub: "30 万年前，走出非洲" },
  { from: 2048, to: 2235, tag: "12 / DNA", title: "四个字母", sub: "写下了 40 亿年从未中断的家谱" },
  { from: 2440, to: 2595, tag: "13 / TREE OF LIFE", title: "所有生命，同一个祖先", sub: "你和一棵树、一个细菌，都是远房亲戚" },
];

export const Captions: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {CAPS.map((c) => {
        const o = envelope(f, c.from, 16, c.to - 14, 14);
        if (o <= 0) return null;
        const e = easeOut(progress(f, c.from, 26));
        return (
          <div key={c.tag} style={{ position: "absolute", left: 0, width: W, top: c.y ?? 318, textAlign: "center", opacity: o, color: "#f4fdff" }}>
            <div style={{ position: "absolute", left: 90, right: 90, top: -50, height: 290,
              background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,4,10,0.5) 0%, rgba(0,4,10,0.28) 55%, rgba(0,0,0,0) 100%)" }} />
            <div style={{ position: "relative", fontFamily: MONO, fontSize: 18, letterSpacing: "0.45em", paddingLeft: "0.45em", color: "rgba(160,240,255,0.85)",
              transform: `translateY(${(1 - e) * 10}px)` }}>{c.tag}</div>
            <div style={{ position: "relative", marginTop: 14, fontFamily: SANS, fontWeight: 700, fontSize: c.size ?? 74, letterSpacing: `${0.12 + 0.2 * (1 - e)}em`,
              paddingLeft: "0.12em", lineHeight: 1.1, textShadow: "0 0 30px rgba(110,230,255,0.45), 0 2px 18px rgba(0,0,0,0.6)",
              filter: `blur(${(1 - e) * 8}px)` }}>{c.title}</div>
            <div style={{ position: "relative", marginTop: 16, fontFamily: SANS, fontWeight: 300, fontSize: 32, letterSpacing: "0.12em", paddingLeft: "0.12em",
              opacity: easeOut(progress(f, c.from + 10, 24)), textShadow: "0 2px 14px rgba(0,0,0,0.7)" }}>{c.sub}</div>
          </div>
        );
      })}
    </>
  );
};

const LETTER = "ATCG";

export const DnaLetters: React.FC = () => {
  const f = useCurrentFrame();
  const vis = envelope(f, 2040, 30, 2230, 20);
  if (vis <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: vis }}>
      {DNA_SEQ.map((base, m) => {
        const s = (m + 0.5) / DNA_SEQ.length;
        const A = helixAt(f, s, 0);
        const B = helixAt(f, s, 1);
        const pair = [1, 0, 3, 2][base];
        const hue = [95, 30, 265, 210];
        return [
          { p: A, b: base },
          { p: B, b: pair },
        ].map(({ p, b }, k) => {
          const front = (1 - p.z) / 2;
          if (front < 0.55) return null;
          return (
            <div key={`${m}-${k}`} style={{ position: "absolute", left: p.x + (p.x > 540 ? 22 : -46), top: p.y - 16, fontFamily: MONO,
              fontWeight: 600, fontSize: 18 + 12 * front, color: `hsl(${hue[b]},95%,72%)`, opacity: (front - 0.55) * 2.2,
              textShadow: `0 0 12px hsl(${hue[b]},95%,60%)` }}>{LETTER[b]}</div>
          );
        });
      })}
    </AbsoluteFill>
  );
};

export const Finale: React.FC = () => {
  const f = useCurrentFrame();
  const q = envelope(f, 2604, 24, 2688, 16);
  const end = envelope(f, 2700, 14, 2752, 8);
  const beat = pulse(f, "div", 10);
  return (
    <>
      {q > 0 && (
        <div style={{ position: "absolute", left: 90, right: 90, top: 1180, textAlign: "center", opacity: q, color: "#f2fbff" }}>
          <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 40, lineHeight: 1.8, letterSpacing: "0.08em" }}>
            从如此简单的开端，<br />无尽的、最美丽、最奇妙的生命形式<br />曾经、并且正在演化。
          </div>
          <div style={{ marginTop: 26, fontFamily: MONO, fontSize: 18, letterSpacing: "0.2em", color: "rgba(170,240,255,0.8)" }}>
            “ENDLESS FORMS MOST BEAUTIFUL”
          </div>
          <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 24, letterSpacing: "0.2em", color: "rgba(220,240,255,0.7)" }}>
            —— 达尔文《物种起源》1859
          </div>
        </div>
      )}
      {end > 0 && (
        <div style={{ position: "absolute", left: 0, width: W, top: 1150, textAlign: "center", opacity: end, color: "#f2fbff" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 84, letterSpacing: "0.08em",
            textShadow: `0 0 ${30 + 40 * beat}px rgba(120,240,255,0.7)` }}>ENDLESS FORMS</div>
          <div style={{ marginTop: 20, fontFamily: SANS, fontWeight: 200, fontSize: 64, letterSpacing: "0.5em", paddingLeft: "0.5em" }}>进化论</div>
          <div style={{ marginTop: 56, fontFamily: SANS, fontWeight: 300, fontSize: 26, letterSpacing: "0.25em", color: "rgba(220,240,255,0.75)" }}>
            画面与音乐 · 全部由代码生成
          </div>
          <div style={{ marginTop: 12, fontFamily: SANS, fontWeight: 300, fontSize: 22, letterSpacing: "0.18em", color: "rgba(170,240,255,0.65)" }}>
            BGM 主旋律由遗传算法进化 {GA[GA.length - 1].gen} 代而成
          </div>
        </div>
      )}
    </>
  );
};
