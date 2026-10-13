import React from "react";
import { Composition } from "remotion";
import { Europa } from "./Europa";
import { loadFonts } from "./fonts";
import { FPS, H, TOTAL_FRAMES, W } from "./timeline";

loadFonts();

export const RemotionRoot: React.FC = () => (
  <Composition id="Europa" component={Europa} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
