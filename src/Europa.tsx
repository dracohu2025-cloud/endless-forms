import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Flash, Grain, Vignette } from "./components/Overlays";
import { TimeAxis } from "./components/TimeAxis";
import { Enlightenment } from "./scenes/Enlightenment";
import { Exploration } from "./scenes/Exploration";
import { EndCard, Finale } from "./scenes/Finale";
import { Greece } from "./scenes/Greece";
import { Industrial } from "./scenes/Industrial";
import { Intro } from "./scenes/Intro";
import { MiddleAges } from "./scenes/MiddleAges";
import { Renaissance } from "./scenes/Renaissance";
import { Rome } from "./scenes/Rome";
import { Wars } from "./scenes/Wars";
import { BAR, SCENES, SceneId } from "./timeline";

const SCENE_COMPONENTS: Record<SceneId, React.FC<{ from: number; dur: number }>> = {
  intro: Intro,
  greece: Greece,
  rome: Rome,
  middle: MiddleAges,
  renaissance: Renaissance,
  exploration: Exploration,
  enlightenment: Enlightenment,
  industrial: Industrial,
  wars: Wars,
  finale: Finale,
  end: EndCard,
};

export const Europa: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Audio src={staticFile("bgm.wav")} />
    {(Object.keys(SCENES) as SceneId[]).map((id) => {
      const [b0, b1] = SCENES[id];
      const from = b0 * BAR;
      const dur = (b1 - b0) * BAR;
      const C = SCENE_COMPONENTS[id];
      return (
        <Sequence key={id} from={from} durationInFrames={dur} name={id}>
          <C from={from} dur={dur} />
        </Sequence>
      );
    })}
    <Vignette strength={0.7} />
    <TimeAxis />
    <Flash />
    <Grain opacity={0.08} />
  </AbsoluteFill>
);
