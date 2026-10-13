import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { Grain, Vignette } from "../components/Overlays";
import { Backdrop } from "./components/Backdrop";
import { Cells } from "./components/Cells";
import { HUD } from "./components/HUD";
import { Swarm } from "./components/Swarm";
import { Captions, DnaLetters, Finale, Title } from "./components/Text";
import { TreeOfLife } from "./components/TreeOfLife";
import { easeIn, progress } from "./lib/math";

const EdgeShade: React.FC = () => <AbsoluteFill style={{ boxShadow: "inset 0 0 160px rgba(0,30,40,0.6)", pointerEvents: "none" }} />;

export const Evolution: React.FC = () => {
  const f = useCurrentFrame();
  const fadeOut = easeIn(progress(f, 2735, 25));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("evolution.wav")} />
      <Backdrop />
      <Cells />
      <TreeOfLife />
      <Swarm />
      <DnaLetters />
      <Vignette strength={0.6} />
      <EdgeShade />
      <HUD />
      <Title />
      <Captions />
      <Finale />
      <Grain opacity={0.06} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
